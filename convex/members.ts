import { v } from "convex/values";
import { memberRole } from "./schema";
import { internalQuery, mutation, query, type MutationCtx } from "./lib/server";
import {
  identityEmail,
  identityHasVerifiedEmail,
  normalizeEmail,
  requireAdmin,
  requireMember,
  requireSignedInIdentity,
} from "./lib/auth";
import { assert, fail } from "./lib/errors";
import { writeAuditEvent } from "./lib/audit";
import { planIdentityAliasSync } from "./lib/identityPolicy";

function bootstrapAllowlist(): Set<string> {
  return new Set(
    (process.env.BOOTSTRAP_ADMIN_EMAILS ?? "")
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean),
  );
}

async function ensureAdminContinuity(
  ctx: MutationCtx,
  member: { _id: string; role: "admin" | "member"; status: "active" | "inactive" },
  nextRole: "admin" | "member",
  nextStatus: "active" | "inactive",
): Promise<void> {
  if (
    member.role !== "admin" ||
    member.status !== "active" ||
    (nextRole === "admin" && nextStatus === "active")
  ) {
    return;
  }
  const activeAdmins = await ctx.db
    .query("members")
    .withIndex("by_role_and_status", (q) =>
      q.eq("role", "admin").eq("status", "active"),
    )
    .collect();
  assert(
    activeAdmins.some((admin) => admin._id !== member._id),
    "VALIDATION_ERROR",
    "Keep at least one other active administrator before changing this account.",
  );
}

export const resolveIdentityInternal = internalQuery({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const mapping = await ctx.db
      .query("memberIdentities")
      .withIndex("by_token_identifier", (q) =>
        q.eq("tokenIdentifier", args.tokenIdentifier),
      )
      .unique();
    if (!mapping || mapping.status !== "verified") return null;
    const member = await ctx.db.get("members", mapping.memberId);
    return member?.status === "active" ? member : null;
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const member = await requireMember(ctx);
    const identities = await ctx.db
      .query("memberIdentities")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .collect();
    return {
      ...member,
      identities: identities.map(({ normalizedEmail, status, verifiedAt }) => ({
        normalizedEmail,
        status,
        verifiedAt,
      })),
    };
  },
});

export const bootstrapCurrentIdentity = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireSignedInIdentity(ctx);
    const existingMapping = await ctx.db
      .query("memberIdentities")
      .withIndex("by_token_identifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (existingMapping) {
      const member = await ctx.db.get("members", existingMapping.memberId);
      assert(member, "NOT_FOUND", "The linked member no longer exists.");
      assert(
        existingMapping.status === "verified" && member.status === "active",
        "FORBIDDEN",
        "This approved identity or member account is inactive.",
      );
      return member;
    }

    const anyMember = await ctx.db.query("members").first();
    assert(
      !anyMember,
      "FORBIDDEN",
      "The workspace is already initialized. Ask an administrator to approve this account.",
    );

    const email = identityEmail(identity);
    assert(email, "VALIDATION_ERROR", "Your account must include an email.");
    assert(
      identityHasVerifiedEmail(identity),
      "FORBIDDEN",
      "Your email must be verified.",
    );
    assert(
      bootstrapAllowlist().has(email),
      "FORBIDDEN",
      "This email is not in BOOTSTRAP_ADMIN_EMAILS.",
    );

    const now = Date.now();
    const displayName =
      typeof identity.name === "string" && identity.name.trim()
        ? identity.name.trim()
        : email.split("@")[0];
    const memberId = await ctx.db.insert("members", {
      displayName,
      role: "admin",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("memberIdentities", {
      memberId,
      provider: "clerk",
      tokenIdentifier: identity.tokenIdentifier,
      providerSubject: identity.subject,
      issuer: identity.issuer,
      normalizedEmail: email,
      status: "verified",
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await writeAuditEvent(ctx, {
      actorType: "member",
      actorMemberId: memberId,
      action: "workspace.bootstrapped",
      entityType: "member",
      entityId: memberId,
    });
    const member = await ctx.db.get("members", memberId);
    assert(member, "NOT_FOUND", "Failed to initialize the workspace.");
    return member;
  },
});

export const claimApprovedIdentity = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireSignedInIdentity(ctx);
    const byToken = await ctx.db
      .query("memberIdentities")
      .withIndex("by_token_identifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (byToken?.status === "verified") {
      const member = await ctx.db.get("members", byToken.memberId);
      assert(member?.status === "active", "FORBIDDEN", "This member is inactive.");
      return byToken.memberId;
    }

    const email = identityEmail(identity);
    assert(email, "VALIDATION_ERROR", "Your account must include an email.");
    assert(
      identityHasVerifiedEmail(identity),
      "FORBIDDEN",
      "Your email must be verified.",
    );
    const approved = await ctx.db
      .query("memberIdentities")
      .withIndex("by_normalized_email", (q) => q.eq("normalizedEmail", email))
      .unique();
    assert(
      approved && approved.status === "pending",
      "IDENTITY_NOT_APPROVED",
      "This account has not been approved for the UBLDA workspace.",
    );
    const member = await ctx.db.get("members", approved.memberId);
    assert(member?.status === "active", "FORBIDDEN", "This member is inactive.");

    const subjectCollision = await ctx.db
      .query("memberIdentities")
      .withIndex("by_provider_subject", (q) =>
        q.eq("provider", "clerk").eq("providerSubject", identity.subject),
      )
      .unique();
    assert(
      !subjectCollision || subjectCollision._id === approved._id,
      "CONFLICT",
      "That identity is already linked to another member.",
    );

    const now = Date.now();
    await ctx.db.patch("memberIdentities", approved._id, {
      tokenIdentifier: identity.tokenIdentifier,
      providerSubject: identity.subject,
      issuer: identity.issuer,
      status: "verified",
      verifiedAt: now,
      updatedAt: now,
    });
    await writeAuditEvent(ctx, {
      actorType: "member",
      actorMemberId: approved.memberId,
      action: "identity.claimed",
      entityType: "memberIdentity",
      entityId: approved._id,
      details: { email },
    });
    return approved.memberId;
  },
});

export const list = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    requireAdmin(actor);
    const rows = args.includeInactive
      ? await ctx.db.query("members").collect()
      : await ctx.db
          .query("members")
          .withIndex("by_status", (q) => q.eq("status", "active"))
          .collect();
    return Promise.all(
      rows.map(async (member) => {
        const identities = await ctx.db
          .query("memberIdentities")
          .withIndex("by_member", (q) => q.eq("memberId", member._id))
          .collect();
        return {
          ...member,
          identities: identities.map(({ _id, normalizedEmail, status, verifiedAt }) => ({
            _id,
            normalizedEmail,
            status,
            verifiedAt,
          })),
        };
      }),
    );
  },
});

export const eligible = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);
    const members = await ctx.db
      .query("members")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    return members
      .map(({ _id, displayName, role, avatarUrl }) => ({
        memberId: _id,
        displayName,
        role,
        avatarUrl: avatarUrl ?? null,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  },
});

export const upsertMember = mutation({
  args: {
    memberId: v.optional(v.id("members")),
    displayName: v.string(),
    role: memberRole,
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    approvedEmails: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    requireAdmin(actor);
    const displayName = args.displayName.trim();
    assert(displayName, "VALIDATION_ERROR", "Display name is required.");
    const emails = [
      ...new Set((args.approvedEmails ?? []).map(normalizeEmail).filter(Boolean)),
    ];
    assert(emails.length <= 10, "VALIDATION_ERROR", "Use 10 approved emails or fewer per member.");
    for (const email of emails) {
      assert(email.includes("@"), "VALIDATION_ERROR", `Invalid email: ${email}`);
      const existing = await ctx.db
        .query("memberIdentities")
        .withIndex("by_normalized_email", (q) => q.eq("normalizedEmail", email))
        .unique();
      assert(
        !existing || existing.memberId === args.memberId,
        "CONFLICT",
        `${email} is already assigned to another member.`,
      );
    }
    const now = Date.now();
    let memberId = args.memberId;
    if (memberId) {
      const existing = await ctx.db.get("members", memberId);
      assert(existing, "NOT_FOUND", "Member not found.");
      if (memberId === actor._id && args.status === "inactive") {
        fail("VALIDATION_ERROR", "You cannot deactivate your own member account.");
      }
      await ensureAdminContinuity(
        ctx,
        existing,
        args.role,
        args.status ?? existing.status,
      );
      await ctx.db.patch("members", memberId, {
        displayName,
        role: args.role,
        status: args.status ?? existing.status,
        updatedAt: now,
      });
    } else {
      assert(emails.length > 0, "VALIDATION_ERROR", "Approve at least one email for a new member.");
      memberId = await ctx.db.insert("members", {
        displayName,
        role: args.role,
        status: args.status ?? "active",
        createdAt: now,
        updatedAt: now,
        createdByMemberId: actor._id,
      });
    }
    const currentIdentities = await ctx.db
      .query("memberIdentities")
      .withIndex("by_member", (q) => q.eq("memberId", memberId!))
      .collect();
    const aliasPlan = args.approvedEmails === undefined
      ? { add: [], reenable: [], disable: [], selfLockout: false }
      : planIdentityAliasSync(
          currentIdentities.map((identity) => ({
            email: identity.normalizedEmail,
            status: identity.status,
          })),
          emails,
          memberId === actor._id,
        );
    assert(
      !aliasPlan.selfLockout,
      "VALIDATION_ERROR",
      "Keep at least one currently verified identity on your own account.",
    );
    const identityByEmail = new Map(
      currentIdentities.map((identity) => [identity.normalizedEmail, identity]),
    );
    for (const email of aliasPlan.disable) {
      const identity = identityByEmail.get(email);
      if (!identity) continue;
      await ctx.db.patch("memberIdentities", identity._id, {
        status: "disabled",
        tokenIdentifier: undefined,
        providerSubject: undefined,
        issuer: undefined,
        updatedAt: now,
      });
    }
    for (const email of aliasPlan.reenable) {
      const identity = identityByEmail.get(email);
      if (!identity) continue;
      await ctx.db.patch("memberIdentities", identity._id, {
        status: "pending",
        tokenIdentifier: undefined,
        providerSubject: undefined,
        issuer: undefined,
        verifiedAt: undefined,
        updatedAt: now,
      });
    }
    for (const email of aliasPlan.add) {
      await ctx.db.insert("memberIdentities", {
        memberId,
        provider: "clerk",
        normalizedEmail: email,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        createdByMemberId: actor._id,
      });
    }
    await writeAuditEvent(ctx, {
      actorType: "member",
      actorMemberId: actor._id,
      action: args.memberId ? "member.updated" : "member.created",
      entityType: "member",
      entityId: memberId,
      details: {
        role: args.role,
        addedApprovedIdentities: aliasPlan.add.length,
        reenabledApprovedIdentities: aliasPlan.reenable.length,
        disabledApprovedIdentities: aliasPlan.disable.length,
      },
    });
    return memberId;
  },
});

export const create = mutation({
  args: {
    displayName: v.string(),
    role: memberRole,
    approvedEmails: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    requireAdmin(actor);
    const displayName = args.displayName.trim();
    assert(displayName, "VALIDATION_ERROR", "Display name is required.");
    const emails = [...new Set(args.approvedEmails.map(normalizeEmail).filter(Boolean))];
    assert(emails.length > 0, "VALIDATION_ERROR", "Approve at least one email.");
    assert(emails.length <= 10, "VALIDATION_ERROR", "Use 10 approved emails or fewer per member.");
    for (const email of emails) {
      assert(email.includes("@"), "VALIDATION_ERROR", `Invalid email: ${email}`);
      const existing = await ctx.db
        .query("memberIdentities")
        .withIndex("by_normalized_email", (q) => q.eq("normalizedEmail", email))
        .unique();
      assert(!existing, "CONFLICT", `${email} is already assigned to a member.`);
    }

    const now = Date.now();
    const memberId = await ctx.db.insert("members", {
      displayName,
      role: args.role,
      status: "active",
      createdAt: now,
      updatedAt: now,
      createdByMemberId: actor._id,
    });
    for (const email of emails) {
      await ctx.db.insert("memberIdentities", {
        memberId,
        provider: "clerk",
        normalizedEmail: email,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        createdByMemberId: actor._id,
      });
    }
    await writeAuditEvent(ctx, {
      actorType: "member",
      actorMemberId: actor._id,
      action: "member.created",
      entityType: "member",
      entityId: memberId,
      details: { role: args.role, approvedIdentityCount: emails.length },
    });
    return memberId;
  },
});

export const addApprovedIdentity = mutation({
  args: { memberId: v.id("members"), email: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    requireAdmin(actor);
    const member = await ctx.db.get("members", args.memberId);
    assert(member, "NOT_FOUND", "Member not found.");
    const email = normalizeEmail(args.email);
    assert(email.includes("@"), "VALIDATION_ERROR", "Enter a valid email.");
    const existing = await ctx.db
      .query("memberIdentities")
      .withIndex("by_normalized_email", (q) => q.eq("normalizedEmail", email))
      .unique();
    assert(!existing, "CONFLICT", "That email is already assigned.");
    const now = Date.now();
    const identityId = await ctx.db.insert("memberIdentities", {
      memberId: member._id,
      provider: "clerk",
      normalizedEmail: email,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      createdByMemberId: actor._id,
    });
    await writeAuditEvent(ctx, {
      actorType: "member",
      actorMemberId: actor._id,
      action: "identity.approved",
      entityType: "memberIdentity",
      entityId: identityId,
      details: { memberId: member._id, email },
    });
    return identityId;
  },
});

export const setIdentityStatus = mutation({
  args: {
    identityId: v.id("memberIdentities"),
    status: v.union(v.literal("pending"), v.literal("disabled")),
  },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    requireAdmin(actor);
    const identity = await ctx.db.get("memberIdentities", args.identityId);
    assert(identity, "NOT_FOUND", "Identity not found.");
    if (identity.memberId === actor._id && identity.status === "verified") {
      const ownIdentities = await ctx.db
        .query("memberIdentities")
        .withIndex("by_member", (q) => q.eq("memberId", actor._id))
        .collect();
      assert(
        ownIdentities.some(
          (candidate) =>
            candidate._id !== identity._id && candidate.status === "verified",
        ),
        "VALIDATION_ERROR",
        "Keep at least one other verified identity on your own account.",
      );
    }
    await ctx.db.patch("memberIdentities", identity._id, {
      status: args.status,
      tokenIdentifier: undefined,
      providerSubject: undefined,
      issuer: undefined,
      verifiedAt: undefined,
      updatedAt: Date.now(),
    });
    await writeAuditEvent(ctx, {
      actorType: "member",
      actorMemberId: actor._id,
      action: `identity.${args.status}`,
      entityType: "memberIdentity",
      entityId: identity._id,
    });
    return null;
  },
});

export const update = mutation({
  args: {
    memberId: v.id("members"),
    displayName: v.optional(v.string()),
    role: v.optional(memberRole),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    requireAdmin(actor);
    const member = await ctx.db.get("members", args.memberId);
    assert(member, "NOT_FOUND", "Member not found.");
    if (args.memberId === actor._id && args.status === "inactive") {
      fail("VALIDATION_ERROR", "You cannot deactivate your own member account.");
    }
    await ensureAdminContinuity(
      ctx,
      member,
      args.role ?? member.role,
      args.status ?? member.status,
    );
    const displayName = args.displayName?.trim();
    if (args.displayName !== undefined) {
      assert(displayName, "VALIDATION_ERROR", "Display name cannot be empty.");
    }
    await ctx.db.patch("members", member._id, {
      displayName: displayName ?? member.displayName,
      role: args.role ?? member.role,
      status: args.status ?? member.status,
      updatedAt: Date.now(),
    });
    await writeAuditEvent(ctx, {
      actorType: "member",
      actorMemberId: actor._id,
      action: "member.updated",
      entityType: "member",
      entityId: member._id,
      details: { role: args.role, status: args.status },
    });
    return null;
  },
});
