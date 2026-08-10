import { v } from "convex/values";
import {
  outcomeRule,
  responsePrivacy,
  responseType,
  resultsVisibility,
  tieBreakRule,
} from "./schema";
import { mutation, query } from "./lib/server";
import {
  canManageDecision,
  requireDecisionManager,
  requireMember,
} from "./lib/auth";
import { assert } from "./lib/errors";
import { decisionDraftInput, optionInput } from "./lib/validators";
import {
  cleanText,
  closeDecisionRecord,
  computeDecisionResults,
  createDecisionRecord,
  getDecisionBundle,
  getDecisionBySlug,
  normalizeOptions,
  normalizeContextItems,
  publishDecisionRecord,
  resolveElectorate,
  validateRules,
} from "./lib/decisionService";
import { writeAuditEvent } from "./lib/audit";
import type { QueryCtx } from "./lib/server";
import type { Doc } from "./lib/types";
import { decisionUpdateViolation } from "./lib/updatePolicy";
import { canonicalDecisionTimeZone } from "./lib/timezones";

async function assertCanView(
  ctx: QueryCtx,
  member: Awaited<ReturnType<typeof requireMember>>,
  decision: Pick<Doc<"decisions">, "_id" | "status" | "createdByMemberId">,
) {
  if (canManageDecision(member, decision)) return;
  assert(decision.status !== "draft", "FORBIDDEN", "This draft is private.");
  const electorate = await ctx.db
    .query("decisionElectorate")
    .withIndex("by_decision_and_member", (q) =>
      q.eq("decisionId", decision._id).eq("memberId", member._id),
    )
    .unique();
  assert(electorate, "FORBIDDEN", "You are not an eligible voter for this decision.");
}

export const list = query({
  args: { status: v.optional(v.union(v.literal("draft"), v.literal("open"), v.literal("closed"), v.literal("finalized"))) },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const all = args.status
      ? await ctx.db
          .query("decisions")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .collect()
      : await ctx.db.query("decisions").collect();
    const visible = [];
    for (const decision of all) {
      const manager = canManageDecision(member, decision);
      const electorate = manager
        ? null
        : await ctx.db
            .query("decisionElectorate")
            .withIndex("by_decision_and_member", (q) =>
              q.eq("decisionId", decision._id).eq("memberId", member._id),
            )
            .unique();
      if (!manager && (!electorate || decision.status === "draft")) continue;
      const [eligible, ballots, myBallot] = await Promise.all([
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
      visible.push({
        decisionId: decision._id,
        slug: decision.slug,
        title: decision.title,
        summary: decision.summary,
        responseType: decision.responseType,
        status: decision.status,
        deadlineAt: decision.deadlineAt ?? null,
        timezone: decision.timezone,
        autoClose: decision.autoClose,
        eligibleCount: eligible.length,
        responseCount: ballots.filter(
          (ballot) => ballot.decisionRevision === decision.revision,
        ).length,
        hasResponded: myBallot?.decisionRevision === decision.revision,
        needsReconfirmation:
          Boolean(myBallot) && myBallot?.decisionRevision !== decision.revision,
        canManage: manager,
        updatedAt: decision.updatedAt,
      });
    }
    return visible.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const decision = await getDecisionBySlug(ctx, args.slug);
    assert(decision, "NOT_FOUND", "Decision not found.");
    await assertCanView(ctx, member, decision);
    const [{ options, electorate }, myBallot] = await Promise.all([
      getDecisionBundle(ctx, decision),
      ctx.db
        .query("ballots")
        .withIndex("by_decision_and_member", (q) =>
          q.eq("decisionId", decision._id).eq("memberId", member._id),
        )
        .unique(),
    ]);
    return {
      ...decision,
      options,
      eligibleCount: electorate.length,
      isEligible: electorate.some((entry) => entry.memberId === member._id),
      deadlineReached:
        decision.deadlineAt !== undefined && decision.deadlineAt <= Date.now(),
      canManage: canManageDecision(member, decision),
      myResponse:
        myBallot
          ? {
              selections: myBallot.selections,
              otherText: myBallot.otherText ?? null,
              responseText: myBallot.responseText ?? null,
              reasoning: myBallot.reasoning ?? null,
              submittedAt: myBallot.submittedAt,
              updatedAt: myBallot.updatedAt,
              decisionRevision: myBallot.decisionRevision,
              isCurrent: myBallot.decisionRevision === decision.revision,
            }
          : null,
      needsReconfirmation:
        Boolean(myBallot) && myBallot?.decisionRevision !== decision.revision,
    };
  },
});

export const activity = query({
  args: { decisionId: v.id("decisions"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    const decision = await ctx.db.get("decisions", args.decisionId);
    assert(decision, "NOT_FOUND", "Decision not found.");
    requireDecisionManager(actor, decision);
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 50), 1), 100);
    const events = await ctx.db
      .query("auditEvents")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", "decision").eq("entityId", String(decision._id)),
      )
      .order("desc")
      .take(limit);
    return await Promise.all(
      events.map(async (event) => {
        const member = event.actorMemberId
          ? await ctx.db.get("members", event.actorMemberId)
          : null;
        return {
          eventId: event._id,
          action: event.action,
          actorType: event.actorType,
          actorDisplayName:
            member?.displayName ??
            (event.actorType === "system" ? "System" : "Authorized agent"),
          requestId: event.requestId ?? null,
          createdAt: event.createdAt,
        };
      }),
    );
  },
});

export const create = mutation({
  args: { input: decisionDraftInput },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    return await createDecisionRecord(
      ctx,
      { actorType: "member", actorMemberId: member._id },
      args.input,
    );
  },
});

export const update = mutation({
  args: {
    decisionId: v.id("decisions"),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    context: v.optional(v.string()),
    contextItems: v.optional(v.array(v.string())),
    responseType: v.optional(responseType),
    options: v.optional(v.array(optionInput)),
    electorateMemberIds: v.optional(v.array(v.id("members"))),
    deadlineAt: v.optional(v.number()),
    clearDeadline: v.optional(v.boolean()),
    timezone: v.optional(v.string()),
    autoClose: v.optional(v.boolean()),
    allowResponseEdits: v.optional(v.boolean()),
    resultsVisibility: v.optional(resultsVisibility),
    responsePrivacy: v.optional(responsePrivacy),
    minimumTurnout: v.optional(v.number()),
    clearMinimumTurnout: v.optional(v.boolean()),
    outcomeRule: v.optional(outcomeRule),
    approvalThresholdPercent: v.optional(v.number()),
    approvalOptionKey: v.optional(v.string()),
    tieBreakRule: v.optional(tieBreakRule),
    statusQuoOptionKey: v.optional(v.string()),
    requireReconfirmation: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    const decision = await ctx.db.get("decisions", args.decisionId);
    assert(decision, "NOT_FOUND", "Decision not found.");
    requireDecisionManager(actor, decision);
    assert(decision.status !== "finalized", "CONFLICT", "A finalized decision cannot be edited.");
    const allBallots = await ctx.db
      .query("ballots")
      .withIndex("by_decision", (q) => q.eq("decisionId", decision._id))
      .collect();
    const hasBallots = allBallots.length > 0;
    const rulesOrStructureChange =
      args.responseType !== undefined ||
      args.options !== undefined ||
      args.electorateMemberIds !== undefined ||
      args.minimumTurnout !== undefined ||
      args.clearMinimumTurnout ||
      args.outcomeRule !== undefined ||
      args.approvalThresholdPercent !== undefined ||
      args.approvalOptionKey !== undefined ||
      args.tieBreakRule !== undefined ||
      args.statusQuoOptionKey !== undefined;
    assert(
      !hasBallots || !rulesOrStructureChange,
      "CONFLICT",
      "Options, electorate, and counting rules lock after the first ballot.",
    );
    const contentChange =
      args.title !== undefined ||
      args.summary !== undefined ||
      args.context !== undefined ||
      args.contextItems !== undefined;
    const updateViolation = decisionUpdateViolation({
      status: decision.status,
      hasBallots,
      hasContentChange: contentChange,
      currentResponsePrivacy: decision.responsePrivacy,
      nextResponsePrivacy: args.responsePrivacy,
      currentResultsVisibility: decision.resultsVisibility,
      nextResultsVisibility: args.resultsVisibility,
    });
    assert(!updateViolation, "CONFLICT", updateViolation ?? "Decision update is not allowed.");
    if (hasBallots && contentChange) {
      assert(
        args.requireReconfirmation === true,
        "VALIDATION_ERROR",
        "Material context edits require voter reconfirmation.",
      );
    }

    const currentOptions = await ctx.db
      .query("decisionOptions")
      .withIndex("by_decision", (q) => q.eq("decisionId", decision._id))
      .collect();
    currentOptions.sort((a, b) => a.position - b.position);
    const electorate = args.electorateMemberIds
      ? await resolveElectorate(ctx, args.electorateMemberIds)
      : await Promise.all(
          (
            await ctx.db
              .query("decisionElectorate")
              .withIndex("by_decision", (q) => q.eq("decisionId", decision._id))
              .collect()
          ).map((entry) => ctx.db.get("members", entry.memberId)),
        );
    const synthetic = {
      title: args.title ?? decision.title,
      summary: args.summary ?? decision.summary,
      context: args.context ?? decision.context,
      contextItems: args.contextItems ?? decision.contextItems,
      responseType: args.responseType ?? decision.responseType,
      options:
        args.options ??
        currentOptions.map(({ key, label, description, isOther }) => ({
          key,
          label,
          description,
          isOther,
        })),
      electorateMemberIds: electorate
        .filter((member) => member !== null)
        .map((member) => member!._id),
      deadlineAt: args.clearDeadline ? undefined : (args.deadlineAt ?? decision.deadlineAt),
      timezone: args.timezone ?? decision.timezone,
      autoClose: args.autoClose ?? decision.autoClose,
      allowResponseEdits: args.allowResponseEdits ?? decision.allowResponseEdits,
      resultsVisibility: args.resultsVisibility ?? decision.resultsVisibility,
      responsePrivacy: args.responsePrivacy ?? decision.responsePrivacy,
      minimumTurnout: args.clearMinimumTurnout
        ? undefined
        : (args.minimumTurnout ?? decision.minimumTurnout),
      outcomeRule: args.outcomeRule ?? decision.outcomeRule,
      approvalThresholdPercent:
        args.approvalThresholdPercent ?? decision.approvalThresholdPercent,
      approvalOptionKey: args.approvalOptionKey ?? decision.approvalOptionKey,
      tieBreakRule: args.tieBreakRule ?? decision.tieBreakRule,
      statusQuoOptionKey: args.statusQuoOptionKey ?? decision.statusQuoOptionKey,
    };
    const normalizedOptions = normalizeOptions(synthetic);
    validateRules(synthetic, normalizedOptions, electorate.length);

    if (args.options !== undefined || args.responseType !== undefined) {
      for (const option of currentOptions) await ctx.db.delete("decisionOptions", option._id);
      const now = Date.now();
      for (const [position, option] of normalizedOptions.entries()) {
        await ctx.db.insert("decisionOptions", {
          decisionId: decision._id,
          ...option,
          position,
          createdAt: now,
        });
      }
    }
    if (args.electorateMemberIds !== undefined) {
      assert(decision.status === "draft", "CONFLICT", "Electorate changes are draft-only.");
      const old = await ctx.db
        .query("decisionElectorate")
        .withIndex("by_decision", (q) => q.eq("decisionId", decision._id))
        .collect();
      for (const entry of old) await ctx.db.delete("decisionElectorate", entry._id);
      const now = Date.now();
      for (const member of electorate) {
        assert(member, "VALIDATION_ERROR", "Eligible member not found.");
        await ctx.db.insert("decisionElectorate", {
          decisionId: decision._id,
          memberId: member._id,
          displayNameSnapshot: member.displayName,
          roleSnapshot: member.role,
          includedAt: now,
        });
      }
    }
    const now = Date.now();
    await ctx.db.patch("decisions", decision._id, {
      title: cleanText(synthetic.title, "Title", 180),
      summary: cleanText(synthetic.summary, "Summary", 500),
      context: cleanText(synthetic.context, "Context", 12_000),
      contextItems: normalizeContextItems(synthetic.contextItems),
      responseType: synthetic.responseType,
      revision: hasBallots && contentChange ? decision.revision + 1 : decision.revision,
      deadlineAt: synthetic.deadlineAt,
      timezone: (() => {
        const timezone = canonicalDecisionTimeZone(synthetic.timezone);
        assert(
          timezone,
          "VALIDATION_ERROR",
          "Timezone must be a canonical IANA identifier such as America/Detroit.",
        );
        return timezone;
      })(),
      autoClose: synthetic.autoClose,
      allowResponseEdits: synthetic.allowResponseEdits,
      resultsVisibility: synthetic.resultsVisibility,
      responsePrivacy: synthetic.responsePrivacy,
      minimumTurnout: synthetic.minimumTurnout,
      outcomeRule: synthetic.outcomeRule,
      approvalThresholdPercent: synthetic.approvalThresholdPercent,
      approvalOptionKey: synthetic.approvalOptionKey,
      tieBreakRule: synthetic.tieBreakRule,
      statusQuoOptionKey: synthetic.statusQuoOptionKey,
      electorateMode:
        args.electorateMemberIds !== undefined
          ? "explicit"
          : decision.electorateMode,
      updatedAt: now,
    });
    await writeAuditEvent(ctx, {
      actorType: "member",
      actorMemberId: actor._id,
      action: "decision.updated",
      entityType: "decision",
      entityId: decision._id,
      details: {
        revision: hasBallots && contentChange ? decision.revision + 1 : decision.revision,
        votersMustReconfirm: hasBallots && contentChange,
      },
    });
    return null;
  },
});

export const publish = mutation({
  args: { decisionId: v.id("decisions") },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    const decision = await ctx.db.get("decisions", args.decisionId);
    assert(decision, "NOT_FOUND", "Decision not found.");
    requireDecisionManager(actor, decision);
    return await publishDecisionRecord(ctx, { actorType: "member", actorMemberId: actor._id }, decision);
  },
});

export const close = mutation({
  args: { decisionId: v.id("decisions"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    const decision = await ctx.db.get("decisions", args.decisionId);
    assert(decision, "NOT_FOUND", "Decision not found.");
    requireDecisionManager(actor, decision);
    return await closeDecisionRecord(ctx, { actorType: "member", actorMemberId: actor._id }, decision, args.reason);
  },
});

export const reopen = mutation({
  args: {
    decisionId: v.id("decisions"),
    reason: v.string(),
    deadlineAt: v.optional(v.number()),
    clearDeadline: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    const decision = await ctx.db.get("decisions", args.decisionId);
    assert(decision, "NOT_FOUND", "Decision not found.");
    requireDecisionManager(actor, decision);
    assert(
      decision.status === "closed",
      "CONFLICT",
      "Only a closed decision can be reopened. Finalized records are immutable.",
    );
    const reason = cleanText(args.reason, "Reopen reason", 1_000);
    const deadlineAt = args.clearDeadline
      ? undefined
      : (args.deadlineAt ?? decision.deadlineAt);
    if (deadlineAt !== undefined) {
      assert(deadlineAt > Date.now(), "VALIDATION_ERROR", "The new deadline must be in the future.");
    }
    const now = Date.now();
    await ctx.db.patch("decisions", decision._id, {
      status: "open",
      deadlineAt,
      openCycle: decision.openCycle + 1,
      closedAt: undefined,
      closedByMemberId: undefined,
      closeReason: undefined,
      updatedAt: now,
    });
    await writeAuditEvent(ctx, {
      actorType: "member",
      actorMemberId: actor._id,
      action: "decision.reopened",
      entityType: "decision",
      entityId: decision._id,
      details: { reason, previousStatus: decision.status, openCycle: decision.openCycle + 1 },
    });
    return null;
  },
});

export const finalize = mutation({
  args: {
    decisionId: v.id("decisions"),
    outcomeOptionId: v.optional(v.id("decisionOptions")),
    outcomeText: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    const decision = await ctx.db.get("decisions", args.decisionId);
    assert(decision, "NOT_FOUND", "Decision not found.");
    requireDecisionManager(actor, decision);
    assert(decision.status === "closed", "CONFLICT", "Close the decision before finalizing it.");
    const results = await computeDecisionResults(ctx, decision);
    const outcomeOptionId = args.outcomeOptionId;
    if (outcomeOptionId) {
      const option = await ctx.db.get("decisionOptions", outcomeOptionId);
      assert(option?.decisionId === decision._id, "VALIDATION_ERROR", "Outcome option does not belong to this decision.");
    }
    const outcomeText = args.outcomeText?.trim() || undefined;
    assert(
      (outcomeText?.length ?? 0) <= 4_000,
      "VALIDATION_ERROR",
      "Outcome text must be 4,000 characters or fewer.",
    );
    assert(
      outcomeOptionId || outcomeText,
      "VALIDATION_ERROR",
      "Record the final outcome before finalizing.",
    );
    const note = args.note?.trim() || undefined;
    assert(
      (note?.length ?? 0) <= 4_000,
      "VALIDATION_ERROR",
      "Finalization note must be 4,000 characters or fewer.",
    );
    if (results.tied || results.turnoutMet === false || results.approvalMet === false) {
      assert(note, "VALIDATION_ERROR", "Explain a manual finalization when the computed rule is unresolved or unmet.");
    }
    const now = Date.now();
    await ctx.db.patch("decisions", decision._id, {
      status: "finalized",
      finalizedAt: now,
      finalizedByMemberId: actor._id,
      finalizedOptionId: outcomeOptionId,
      finalOutcomeText: outcomeText,
      finalizationNote: note,
      updatedAt: now,
    });
    await writeAuditEvent(ctx, {
      actorType: "member",
      actorMemberId: actor._id,
      action: "decision.finalized",
      entityType: "decision",
      entityId: decision._id,
      details: {
        outcomeOptionId,
        responseCount: results.responseCount,
        eligibleCount: results.eligibleCount,
        turnoutMet: results.turnoutMet,
        approvalMet: results.approvalMet,
        tied: results.tied,
      },
    });
    return null;
  },
});

export const responseStatus = query({
  args: { decisionId: v.id("decisions") },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    const decision = await ctx.db.get("decisions", args.decisionId);
    assert(decision, "NOT_FOUND", "Decision not found.");
    requireDecisionManager(actor, decision);
    const results = await computeDecisionResults(ctx, decision);
    return {
      eligibleCount: results.eligibleCount,
      responseCount: results.responseCount,
      pendingCount: results.pendingCount,
      staleResponseCount: results.staleResponseCount,
      missing: results.missing,
    };
  },
});
