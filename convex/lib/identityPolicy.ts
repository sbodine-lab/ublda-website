export type AliasStatus = "pending" | "verified" | "disabled";

export type AliasSyncPlan = {
  add: string[];
  reenable: string[];
  disable: string[];
  selfLockout: boolean;
};

export function planIdentityAliasSync(
  current: Array<{ email: string; status: AliasStatus }>,
  desiredEmails: string[],
  editingSelf: boolean,
): AliasSyncPlan {
  const desired = new Set(desiredEmails);
  const currentByEmail = new Map(current.map((identity) => [identity.email, identity]));
  const add = desiredEmails.filter((email) => !currentByEmail.has(email));
  const reenable = current
    .filter((identity) => desired.has(identity.email) && identity.status === "disabled")
    .map((identity) => identity.email);
  const disable = current
    .filter((identity) => !desired.has(identity.email) && identity.status !== "disabled")
    .map((identity) => identity.email);
  const retainedVerified = current.filter(
    (identity) => desired.has(identity.email) && identity.status === "verified",
  ).length;
  return {
    add,
    reenable,
    disable,
    selfLockout: editingSelf && retainedVerified === 0,
  };
}
