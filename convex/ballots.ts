import { v } from "convex/values";
import { ballotInput } from "./lib/validators";
import { mutation, query } from "./lib/server";
import { requireMember } from "./lib/auth";
import { assert } from "./lib/errors";
import { getDecisionBySlug } from "./lib/decisionService";
import { writeAuditEvent } from "./lib/audit";

export const myResponse = query({
  args: {
    decisionId: v.optional(v.id("decisions")),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    assert(args.decisionId || args.slug, "VALIDATION_ERROR", "Provide a decision ID or slug.");
    const decision = args.decisionId
      ? await ctx.db.get("decisions", args.decisionId)
      : await getDecisionBySlug(ctx, args.slug!);
    assert(decision, "NOT_FOUND", "Decision not found.");
    const electorate = await ctx.db
      .query("decisionElectorate")
      .withIndex("by_decision_and_member", (q) =>
        q.eq("decisionId", decision._id).eq("memberId", member._id),
      )
      .unique();
    assert(electorate || member.role === "admin", "FORBIDDEN", "You are not eligible for this decision.");
    const ballot = await ctx.db
      .query("ballots")
      .withIndex("by_decision_and_member", (q) =>
        q.eq("decisionId", decision._id).eq("memberId", member._id),
      )
      .unique();
    if (!ballot) return null;
    return {
      selections: ballot.selections,
      otherText: ballot.otherText ?? null,
      responseText: ballot.responseText ?? null,
      reasoning: ballot.reasoning ?? null,
      submittedAt: ballot.submittedAt,
      updatedAt: ballot.updatedAt,
      decisionRevision: ballot.decisionRevision,
      isCurrent: ballot.decisionRevision === decision.revision,
    };
  },
});

export const submit = mutation({
  args: { decisionId: v.id("decisions"), input: ballotInput },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const decision = await ctx.db.get("decisions", args.decisionId);
    assert(decision, "NOT_FOUND", "Decision not found.");
    assert(decision.status === "open", "DECISION_CLOSED", "This decision is not accepting responses.");
    if (decision.autoClose && decision.deadlineAt !== undefined) {
      assert(decision.deadlineAt > Date.now(), "DECISION_CLOSED", "The response deadline has passed.");
    }
    const electorate = await ctx.db
      .query("decisionElectorate")
      .withIndex("by_decision_and_member", (q) =>
        q.eq("decisionId", decision._id).eq("memberId", member._id),
      )
      .unique();
    assert(electorate, "FORBIDDEN", "You are not an eligible voter for this decision.");
    const options = await ctx.db
      .query("decisionOptions")
      .withIndex("by_decision", (q) => q.eq("decisionId", decision._id))
      .collect();
    const optionById = new Map(options.map((option) => [String(option._id), option]));
    const selectionIds = args.input.selections.map(({ optionId }) => String(optionId));
    assert(
      new Set(selectionIds).size === selectionIds.length,
      "VALIDATION_ERROR",
      "An option can only be selected once.",
    );
    assert(
      selectionIds.every((optionId) => optionById.has(optionId)),
      "VALIDATION_ERROR",
      "A selected option does not belong to this decision.",
    );

    if (decision.responseType === "input_only") {
      assert(args.input.selections.length === 0, "VALIDATION_ERROR", "Input-only decisions do not accept option selections.");
      assert(args.input.responseText?.trim(), "VALIDATION_ERROR", "Enter a response.");
    } else if (
      decision.responseType === "yes_no_other" ||
      decision.responseType === "single_choice"
    ) {
      assert(args.input.selections.length === 1, "VALIDATION_ERROR", "Choose exactly one response.");
    } else {
      assert(
        args.input.selections.length === options.length,
        "VALIDATION_ERROR",
        "Rank every option exactly once.",
      );
      const ranks = args.input.selections
        .map(({ rank }) => rank)
        .sort((a, b) => (a ?? 0) - (b ?? 0));
      assert(
        ranks.every((rank, index) => rank === index + 1),
        "VALIDATION_ERROR",
        "Ranks must be consecutive starting at one.",
      );
    }

    const otherSelected = args.input.selections.some(
      ({ optionId, rank }) =>
        optionById.get(String(optionId))?.isOther &&
        (decision.responseType !== "ranked_choice" || rank === 1),
    );
    if (otherSelected) {
      assert(args.input.otherText?.trim(), "VALIDATION_ERROR", "Explain the alternative you are proposing.");
    }
    const otherText = otherSelected
      ? args.input.otherText?.trim() || undefined
      : undefined;
    const responseText =
      decision.responseType === "input_only"
        ? args.input.responseText?.trim() || undefined
        : undefined;
    const reasoning = args.input.reasoning?.trim() || undefined;
    assert((otherText?.length ?? 0) <= 4_000, "VALIDATION_ERROR", "Other response is too long.");
    assert((responseText?.length ?? 0) <= 8_000, "VALIDATION_ERROR", "Response is too long.");
    assert((reasoning?.length ?? 0) <= 8_000, "VALIDATION_ERROR", "Reasoning is too long.");

    const existing = await ctx.db
      .query("ballots")
      .withIndex("by_decision_and_member", (q) =>
        q.eq("decisionId", decision._id).eq("memberId", member._id),
      )
      .unique();
    if (
      existing?.decisionRevision === decision.revision &&
      !decision.allowResponseEdits
    ) {
      assert(false, "FORBIDDEN", "Responses cannot be edited for this decision.");
    }
    const now = Date.now();
    const ballot = {
      decisionId: decision._id,
      memberId: member._id,
      decisionRevision: decision.revision,
      selections: args.input.selections,
      otherText,
      responseText,
      reasoning,
      submittedAt: existing?.submittedAt ?? now,
      updatedAt: now,
    };
    const ballotId = existing
      ? (await ctx.db.replace("ballots", existing._id, ballot), existing._id)
      : await ctx.db.insert("ballots", ballot);
    await writeAuditEvent(ctx, {
      actorType: "member",
      actorMemberId: member._id,
      action: existing ? "ballot.updated" : "ballot.submitted",
      entityType: "ballot",
      entityId: ballotId,
      // Deliberately never put selections or free-text responses in audit logs.
      details: { decisionId: decision._id, decisionRevision: decision.revision },
    });
    return { ballotId, submittedAt: ballot.submittedAt, updatedAt: now };
  },
});
