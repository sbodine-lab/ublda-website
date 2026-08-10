import { query } from "./lib/server";
import { canManageDecision, requireMember } from "./lib/auth";

export const workspaceSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const member = await requireMember(ctx);
    const allDecisions = await ctx.db.query("decisions").collect();
    const decisions = [];
    for (const decision of allDecisions) {
      const manager = canManageDecision(member, decision);
      const electorate = await ctx.db
        .query("decisionElectorate")
        .withIndex("by_decision_and_member", (q) =>
          q.eq("decisionId", decision._id).eq("memberId", member._id),
        )
        .unique();
      if (!manager && (!electorate || decision.status === "draft")) continue;
      const [eligible, responses, myResponse] = await Promise.all([
        ctx.db
          .query("decisionElectorate")
          .withIndex("by_decision", (q) => q.eq("decisionId", decision._id))
          .collect(),
        ctx.db
          .query("ballots")
          .withIndex("by_decision", (q) => q.eq("decisionId", decision._id))
          .collect(),
        ctx.db
          .query("ballots")
          .withIndex("by_decision_and_member", (q) =>
            q.eq("decisionId", decision._id).eq("memberId", member._id),
          )
          .unique(),
      ]);
      decisions.push({
        decisionId: decision._id,
        slug: decision.slug,
        title: decision.title,
        summary: decision.summary,
        status: decision.status,
        responseType: decision.responseType,
        timezone: decision.timezone,
        autoClose: decision.autoClose,
        deadlineAt: decision.deadlineAt ?? null,
        eligibleCount: eligible.length,
        responseCount: responses.filter(
          (response) => response.decisionRevision === decision.revision,
        ).length,
        hasResponded: myResponse?.decisionRevision === decision.revision,
        isEligible: Boolean(electorate),
        needsReconfirmation:
          Boolean(myResponse) && myResponse?.decisionRevision !== decision.revision,
        canManage: manager,
        updatedAt: decision.updatedAt,
      });
    }
    return {
      viewer: {
        memberId: member._id,
        displayName: member.displayName,
        role: member.role,
        avatarUrl: member.avatarUrl ?? null,
      },
      decisions: decisions.sort((a, b) => b.updatedAt - a.updatedAt),
    };
  },
});
