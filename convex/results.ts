import { v } from "convex/values";
import { query } from "./lib/server";
import { canManageDecision, requireMember } from "./lib/auth";
import { assert } from "./lib/errors";
import { computeDecisionResults, getDecisionBySlug } from "./lib/decisionService";

export const get = query({
  args: {
    decisionId: v.optional(v.id("decisions")),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    assert(args.decisionId || args.slug, "VALIDATION_ERROR", "Provide a decision ID or slug.");
    const decision = args.decisionId
      ? await ctx.db.get("decisions", args.decisionId)
      : await getDecisionBySlug(ctx, args.slug!);
    assert(decision, "NOT_FOUND", "Decision not found.");
    const manager = canManageDecision(actor, decision);
    const electorate = await ctx.db
      .query("decisionElectorate")
      .withIndex("by_decision_and_member", (q) =>
        q.eq("decisionId", decision._id).eq("memberId", actor._id),
      )
      .unique();
    assert(manager || electorate, "FORBIDDEN", "You cannot view this decision.");

    if (!manager) {
      if (decision.resultsVisibility === "admins_only") {
        assert(false, "FORBIDDEN", "Results are limited to decision managers.");
      }
      if (decision.resultsVisibility === "after_close") {
        assert(
          decision.status === "closed" || decision.status === "finalized",
          "FORBIDDEN",
          "Results will be available after the decision closes.",
        );
      }
      if (decision.resultsVisibility === "after_submit") {
        const response = await ctx.db
          .query("ballots")
          .withIndex("by_decision_and_member", (q) =>
            q.eq("decisionId", decision._id).eq("memberId", actor._id),
          )
          .unique();
        assert(
          response?.decisionRevision === decision.revision,
          "FORBIDDEN",
          "Submit your response before viewing interim results.",
        );
      }
    }

    const results = await computeDecisionResults(ctx, decision);
    let individualResponses: Array<Record<string, unknown>> | null = null;
    if (manager && decision.responsePrivacy === "admins_can_view_individual") {
      const electorateRows = await ctx.db
        .query("decisionElectorate")
        .withIndex("by_decision", (q) => q.eq("decisionId", decision._id))
        .collect();
      const nameByMember = new Map(
        electorateRows.map((entry) => [String(entry.memberId), entry.displayNameSnapshot]),
      );
      individualResponses = results.ballots.map((ballot) => ({
        memberId: ballot.memberId,
        displayName: nameByMember.get(String(ballot.memberId)) ?? "Member",
        selections: ballot.selections,
        otherText: ballot.otherText ?? null,
        responseText: ballot.responseText ?? null,
        reasoning: ballot.reasoning ?? null,
        updatedAt: ballot.updatedAt,
      }));
    }
    return {
      decision: {
        decisionId: decision._id,
        slug: decision.slug,
        title: decision.title,
        status: decision.status,
        outcomeRule: decision.outcomeRule,
        minimumTurnout: decision.minimumTurnout ?? null,
        approvalThresholdPercent: decision.approvalThresholdPercent ?? null,
        tieBreakRule: decision.tieBreakRule,
        finalizedOptionId: decision.finalizedOptionId ?? null,
        finalOutcomeText: decision.finalOutcomeText ?? null,
        finalizationNote: decision.finalizationNote ?? null,
      },
      eligibleCount: results.eligibleCount,
      responseCount: results.responseCount,
      pendingCount: results.pendingCount,
      staleResponseCount: results.staleResponseCount,
      turnoutMet: results.turnoutMet,
      approvalMet: results.approvalMet,
      tied: results.tied,
      recommendedOptionIds: results.recommendedOptionIds,
      optionResults: results.optionResults,
      // Missing names and individual free text are manager-only.
      missing: manager ? results.missing : null,
      individualResponses,
    };
  },
});
