import type { UserIdentity } from "convex/server";
import type { GenericId } from "convex/values";
import type { ActionCtx, MutationCtx, QueryCtx } from "./server";
import type { Doc } from "./types";
import { assert, fail } from "./errors";
import { makeFunctionReference } from "convex/server";
import { effectiveLeadershipRole } from "../../shared/adminPolicy";

type DatabaseCtx = QueryCtx | MutationCtx;
type AuthCtx = Pick<QueryCtx, "auth"> | Pick<ActionCtx, "auth">;

export type AuthenticatedMember = Doc<"members">;

const resolveIdentityReference = makeFunctionReference<
  "query",
  { tokenIdentifier: string },
  AuthenticatedMember | null
>("members:resolveIdentityInternal");

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function identityEmail(identity: UserIdentity): string | null {
  const claims = identity as UserIdentity & Record<string, unknown>;
  const raw = claims.email ?? claims.email_address;
  return typeof raw === "string" && raw.trim() ? normalizeEmail(raw) : null;
}

export function identityHasVerifiedEmail(identity: UserIdentity): boolean {
  const claims = identity as UserIdentity & Record<string, unknown>;
  return claims.emailVerified === true || claims.email_verified === true;
}

export async function requireSignedInIdentity(ctx: AuthCtx): Promise<UserIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) fail("UNAUTHENTICATED", "Sign in to continue.");
  return identity;
}

export async function requireMember(ctx: DatabaseCtx): Promise<AuthenticatedMember> {
  const identity = await requireSignedInIdentity(ctx);
  const mapping = await ctx.db
    .query("memberIdentities")
    .withIndex("by_token_identifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

  if (!mapping || mapping.status !== "verified") {
    fail(
      "IDENTITY_NOT_APPROVED",
      "This account has not been approved for the UBLDA workspace.",
    );
  }
  const member = await ctx.db.get("members", mapping.memberId);
  if (!member || member.status !== "active") {
    fail("FORBIDDEN", "This member account is inactive.");
  }
  return {
    ...member,
    role: effectiveLeadershipRole(member.role, mapping.normalizedEmail),
  };
}

export async function requireActionMember(
  ctx: ActionCtx,
): Promise<AuthenticatedMember> {
  const identity = await requireSignedInIdentity(ctx);
  const member = await ctx.runQuery(resolveIdentityReference, {
    tokenIdentifier: identity.tokenIdentifier,
  });
  if (!member) {
    fail(
      "IDENTITY_NOT_APPROVED",
      "This account has not been approved for the UBLDA workspace.",
    );
  }
  return member;
}

export function requireAdmin(member: AuthenticatedMember): void {
  assert(member.role === "admin", "FORBIDDEN", "An administrator is required.");
}

export function canManageDecision(
  member: AuthenticatedMember,
  decision: { createdByMemberId: GenericId<"members"> },
): boolean {
  return member.role === "admin" || member._id === decision.createdByMemberId;
}

export function requireDecisionManager(
  member: AuthenticatedMember,
  decision: { createdByMemberId: GenericId<"members"> },
): void {
  assert(
    canManageDecision(member, decision),
    "FORBIDDEN",
    "Only the decision creator or an administrator can do that.",
  );
}
