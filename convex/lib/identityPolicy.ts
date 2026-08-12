export type AliasStatus = "pending" | "verified" | "disabled";

export type AliasSyncPlan = {
  add: string[];
  reenable: string[];
  renew: string[];
  migrate: string[];
  disable: string[];
  selfLockout: boolean;
};

export const IDENTITY_APPROVAL_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function isValidApprovedEmail(email: string): boolean {
  return email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function identityApprovalExpiresAt(now: number): number {
  return now + IDENTITY_APPROVAL_TTL_MS;
}

export function pendingIdentityIsClaimable(
  identity: {
    status: AliasStatus;
    createdAt: number;
    approvalExpiresAt?: number;
  },
  now: number,
): boolean {
  if (identity.status !== "pending") return false;
  // Rows created before approval expiry was introduced inherit the same
  // bounded window from their creation timestamp. This closes stale invites
  // without invalidating recent invitations during rollout.
  const expiresAt = identity.approvalExpiresAt
    ?? identity.createdAt + IDENTITY_APPROVAL_TTL_MS;
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function isUsableLeadershipIdentity(identity: {
  status: AliasStatus;
  provider?: string;
}): boolean {
  return identity.status === "verified" && identity.provider !== "clerk";
}

export function hasUsableAdminContinuity(admins: Array<{
  role: "admin" | "member";
  status: "active" | "inactive";
  identities: Array<{ status: AliasStatus; provider?: string }>;
}>): boolean {
  return admins.some((admin) =>
    admin.role === "admin"
    && admin.status === "active"
    && admin.identities.some(isUsableLeadershipIdentity)
  );
}

export function planIdentityAliasSync(
  current: Array<{ email: string; status: AliasStatus; provider?: string }>,
  desiredEmails: string[],
  editingSelf: boolean,
): AliasSyncPlan {
  const desired = new Set(desiredEmails);
  const currentByEmail = new Map(current.map((identity) => [identity.email, identity]));
  const add = desiredEmails.filter((email) => !currentByEmail.has(email));
  const reenable = current
    .filter((identity) => desired.has(identity.email) && identity.status === "disabled")
    .map((identity) => identity.email);
  const renew = current
    .filter((identity) => desired.has(identity.email) && identity.status === "pending")
    .map((identity) => identity.email);
  // Saving an existing legacy Clerk alias is an explicit admin act that turns
  // it into the same bounded Logto invitation used for new members. It avoids
  // both an indefinite email-relink exception and a lockout for pre-cutover
  // roster rows.
  const migrate = current
    .filter((identity) =>
      desired.has(identity.email) &&
      identity.status === "verified" &&
      identity.provider === "clerk"
    )
    .map((identity) => identity.email);
  const disable = current
    .filter((identity) => !desired.has(identity.email) && identity.status !== "disabled")
    .map((identity) => identity.email);
  const retainedVerified = current.filter(
    (identity) =>
      desired.has(identity.email) &&
      isUsableLeadershipIdentity(identity),
  ).length;
  return {
    add,
    reenable,
    renew,
    migrate,
    disable,
    selfLockout: editingSelf && retainedVerified === 0,
  };
}
