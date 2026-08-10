import { query } from "./lib/server";
import { requireMember } from "./lib/auth";

export const current = query({
  args: {},
  handler: async (ctx) => {
    const member = await requireMember(ctx);
    return {
      memberId: member._id,
      displayName: member.displayName,
      role: member.role,
      status: member.status,
      avatarUrl: member.avatarUrl ?? null,
    };
  },
});
