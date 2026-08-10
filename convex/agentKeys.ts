import { makeFunctionReference } from "convex/server";
import { v, type GenericId } from "convex/values";
import { agentScope } from "./schema";
import { action, internalMutation, mutation, query } from "./lib/server";
import { requireActionMember, requireMember } from "./lib/auth";
import { assert, fail } from "./lib/errors";
import { randomBase64Url, sha256Hex } from "./lib/crypto";
import { writeAuditEvent } from "./lib/audit";
import type { AgentScope } from "./lib/types";

const storeReference = makeFunctionReference<
  "mutation",
  {
    name: string;
    prefix: string;
    secretHash: string;
    scopes: AgentScope[];
    actorMemberId: GenericId<"members">;
    expiresAt?: number;
    rateLimitPerMinute: number;
  },
  { agentKeyId: GenericId<"agentKeys">; createdAt: number }
>("agentKeys:storeInternal");

export const storeInternal = internalMutation({
  args: {
    name: v.string(),
    prefix: v.string(),
    secretHash: v.string(),
    scopes: v.array(agentScope),
    actorMemberId: v.id("members"),
    expiresAt: v.optional(v.number()),
    rateLimitPerMinute: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await ctx.db.get("members", args.actorMemberId);
    assert(actor?.status === "active", "FORBIDDEN", "Member is inactive.");
    const collision = await ctx.db
      .query("agentKeys")
      .withIndex("by_prefix", (q) => q.eq("prefix", args.prefix))
      .unique();
    assert(!collision, "CONFLICT", "Token prefix collision. Try again.");
    const now = Date.now();
    const agentKeyId = await ctx.db.insert("agentKeys", {
      name: args.name,
      prefix: args.prefix,
      secretHash: args.secretHash,
      hashAlgorithm: "SHA-256",
      scopes: args.scopes,
      createdByMemberId: actor._id,
      status: "active",
      rateLimitPerMinute: args.rateLimitPerMinute,
      createdAt: now,
      expiresAt: args.expiresAt,
    });
    await writeAuditEvent(ctx, {
      actorType: "member",
      actorMemberId: actor._id,
      action: "agent_key.created",
      entityType: "agentKey",
      entityId: agentKeyId,
      details: { name: args.name, prefix: args.prefix, scopes: args.scopes },
    });
    return { agentKeyId, createdAt: now };
  },
});

export const createAgentKey = action({
  args: {
    name: v.string(),
    scopes: v.array(agentScope),
    expiresAt: v.optional(v.number()),
    rateLimitPerMinute: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActionMember(ctx);
    const name = args.name.trim();
    assert(name && name.length <= 120, "VALIDATION_ERROR", "Token name is required and must be 120 characters or fewer.");
    const scopes = [...new Set(args.scopes)];
    assert(scopes.length > 0, "VALIDATION_ERROR", "Select at least one scope.");
    if (args.expiresAt !== undefined) {
      assert(args.expiresAt > Date.now(), "VALIDATION_ERROR", "Expiration must be in the future.");
    }
    const rateLimitPerMinute = args.rateLimitPerMinute ?? 30;
    assert(
      Number.isInteger(rateLimitPerMinute) && rateLimitPerMinute >= 1 && rateLimitPerMinute <= 120,
      "VALIDATION_ERROR",
      "Rate limit must be a whole number from 1 to 120 requests per minute.",
    );
    const prefix = randomBase64Url(9);
    const token = `ublda_dc_${prefix}_${randomBase64Url(32)}`;
    const secretHash = await sha256Hex(token);
    const stored = await ctx.runMutation(storeReference, {
      name,
      prefix,
      secretHash,
      scopes,
      actorMemberId: actor._id,
      expiresAt: args.expiresAt,
      rateLimitPerMinute,
    });
    return {
      ...stored,
      name,
      prefix,
      scopes,
      expiresAt: args.expiresAt ?? null,
      // This is the only response that contains the plaintext token.
      token,
    };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const actor = await requireMember(ctx);
    const keys = await ctx.db
      .query("agentKeys")
      .withIndex("by_creator", (q) => q.eq("createdByMemberId", actor._id))
      .collect();
    return keys
      .map((key) => ({
        agentKeyId: key._id,
        name: key.name,
        prefix: key.prefix,
        scopes: key.scopes,
        createdByMemberId: key.createdByMemberId,
        status: key.status,
        rateLimitPerMinute: key.rateLimitPerMinute,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt ?? null,
        revokedAt: key.revokedAt ?? null,
        lastUsedAt: key.lastUsedAt ?? null,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const revokeAgentKey = mutation({
  args: { agentKeyId: v.id("agentKeys") },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    const key = await ctx.db.get("agentKeys", args.agentKeyId);
    assert(key, "NOT_FOUND", "Agent token not found.");
    assert(
      actor.role === "admin" || key.createdByMemberId === actor._id,
      "FORBIDDEN",
      "You can only revoke your own agent tokens.",
    );
    if (key.status === "revoked") return null;
    const now = Date.now();
    await ctx.db.patch("agentKeys", key._id, { status: "revoked", revokedAt: now });
    await writeAuditEvent(ctx, {
      actorType: "member",
      actorMemberId: actor._id,
      action: "agent_key.revoked",
      entityType: "agentKey",
      entityId: key._id,
      details: { prefix: key.prefix },
    });
    return null;
  },
});

export const authorizeInternal = internalMutation({
  args: {
    prefix: v.string(),
    secretHash: v.string(),
    requiredScopes: v.array(agentScope),
    consumeRateLimit: v.boolean(),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = await ctx.db
      .query("agentKeys")
      .withIndex("by_prefix", (q) => q.eq("prefix", args.prefix))
      .unique();
    if (!key || key.secretHash !== args.secretHash || key.status !== "active") {
      fail("UNAUTHENTICATED", "Invalid or revoked agent token.");
    }
    if (key.expiresAt !== undefined && key.expiresAt <= Date.now()) {
      fail("UNAUTHENTICATED", "Agent token has expired.");
    }
    const member = await ctx.db.get("members", key.createdByMemberId);
    assert(member?.status === "active", "FORBIDDEN", "Agent principal is inactive.");
    for (const scope of args.requiredScopes) {
      assert(key.scopes.includes(scope), "FORBIDDEN", `Agent token is missing ${scope}.`);
    }
    if (args.consumeRateLimit) {
      const now = Date.now();
      const inCurrentWindow =
        key.rateWindowStartedAt !== undefined && now - key.rateWindowStartedAt < 60_000;
      const windowCount = inCurrentWindow ? (key.rateWindowCount ?? 0) : 0;
      assert(windowCount < key.rateLimitPerMinute, "RATE_LIMITED", "Agent token rate limit exceeded.");
      await ctx.db.patch("agentKeys", key._id, {
        lastUsedAt: now,
        rateWindowStartedAt: inCurrentWindow ? key.rateWindowStartedAt : now,
        rateWindowCount: windowCount + 1,
      });
    }
    return {
      tokenId: key._id,
      memberId: member._id,
      scopes: key.scopes,
      clientName: key.name,
      expiresAt: key.expiresAt,
    };
  },
});
