import type { GenericId } from "convex/values";
import { assert } from "./errors";
import type { MutationCtx, QueryCtx } from "./server";
import type { AuditActor } from "./audit";
import { writeAuditEvent } from "./audit";
import type { DecisionDraftInput } from "./validators";
import type { Doc } from "./types";
import { tallyOptions } from "./tally";
import { decisionPublicSlug } from "./publicIds";
import { canonicalDecisionTimeZone } from "./timezones";

type ReadCtx = QueryCtx | MutationCtx;
type OptionSeed = {
  key: string;
  label: string;
  description?: string;
  isOther: boolean;
};

export function cleanText(value: string, label: string, maxLength: number): string {
  const cleaned = value.trim();
  assert(cleaned, "VALIDATION_ERROR", `${label} is required.`);
  assert(
    cleaned.length <= maxLength,
    "VALIDATION_ERROR",
    `${label} must be ${maxLength} characters or fewer.`,
  );
  return cleaned;
}

function toKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export function normalizeContextItems(items: string[] | undefined): string[] {
  if (!items) return [];
  assert(items.length <= 30, "VALIDATION_ERROR", "Use 30 context points or fewer.");
  return items
    .map((item, index) => {
      const cleaned = item.trim();
      assert(
        cleaned.length <= 1_000,
        "VALIDATION_ERROR",
        `Context point ${index + 1} must be 1,000 characters or fewer.`,
      );
      return cleaned;
    })
    .filter(Boolean);
}

export function normalizeOptions(input: DecisionDraftInput): OptionSeed[] {
  if (input.responseType === "input_only") return [];
  if (input.responseType === "yes_no_other") {
    if (!input.options?.length) {
      return [
        { key: "yes", label: "Yes", isOther: false },
        { key: "no", label: "No", isOther: false },
        {
          key: "other",
          label: "Propose something else",
          isOther: true,
        },
      ];
    }
  }

  const source = input.options ?? [];
  assert(
    source.length >= 2,
    "VALIDATION_ERROR",
    "This response type needs at least two options.",
  );
  assert(source.length <= 25, "VALIDATION_ERROR", "Use 25 options or fewer.");
  const keys = new Set<string>();
  const options = source.map((option, index) => {
    const label = cleanText(option.label, `Option ${index + 1}`, 160);
    const key = toKey(option.key ?? label);
    assert(key, "VALIDATION_ERROR", `Option ${index + 1} needs a usable key.`);
    assert(!keys.has(key), "VALIDATION_ERROR", `Option key ${key} is duplicated.`);
    keys.add(key);
    return {
      key,
      label,
      description: option.description?.trim() || undefined,
      isOther: option.isOther === true,
    };
  });
  for (const [index, option] of options.entries()) {
    assert(
      (option.description?.length ?? 0) <= 1_000,
      "VALIDATION_ERROR",
      `Option ${index + 1} description must be 1,000 characters or fewer.`,
    );
  }

  if (input.responseType === "yes_no_other") {
    assert(keys.has("yes") && keys.has("no"), "VALIDATION_ERROR", "Yes/no decisions need yes and no options.");
  }
  assert(
    options.filter((option) => option.isOther).length <= 1,
    "VALIDATION_ERROR",
    "Only one option can collect an Other response.",
  );
  return options;
}

export async function resolveElectorate(
  ctx: MutationCtx,
  memberIds: GenericId<"members">[] | undefined,
): Promise<Doc<"members">[]> {
  if (memberIds === undefined) {
    return await ctx.db
      .query("members")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  }
  assert(memberIds.length <= 100, "VALIDATION_ERROR", "Use 100 eligible voters or fewer.");
  const uniqueIds = [...new Set(memberIds)];
  const members = await Promise.all(
    uniqueIds.map((memberId) => ctx.db.get("members", memberId)),
  );
  assert(
    members.every((member) => member?.status === "active"),
    "VALIDATION_ERROR",
    "Every eligible voter must be an active member.",
  );
  return members as Doc<"members">[];
}

export function validateRules(
  input: DecisionDraftInput,
  optionSeeds: OptionSeed[],
  electorateSize: number,
): void {
  if (input.minimumTurnout !== undefined) {
    assert(Number.isInteger(input.minimumTurnout), "VALIDATION_ERROR", "Minimum turnout must be a whole number.");
    assert(input.minimumTurnout >= 1, "VALIDATION_ERROR", "Minimum turnout must be at least one.");
    assert(input.minimumTurnout <= electorateSize, "VALIDATION_ERROR", "Minimum turnout cannot exceed the electorate.");
  }
  if (input.approvalThresholdPercent !== undefined) {
    assert(
      input.approvalThresholdPercent > 0 && input.approvalThresholdPercent <= 100,
      "VALIDATION_ERROR",
      "Approval threshold must be between 0 and 100 percent.",
    );
  }
  const optionKeys = new Set(optionSeeds.map(({ key }) => key));
  const rule = input.outcomeRule ?? "advisory";
  if (rule === "approval_threshold") {
    assert(
      input.approvalThresholdPercent !== undefined,
      "VALIDATION_ERROR",
      "Approval-threshold decisions need a threshold.",
    );
    assert(
      optionKeys.has(input.approvalOptionKey ?? "yes"),
      "VALIDATION_ERROR",
      "The approval option key does not exist.",
    );
  }
  if ((input.tieBreakRule ?? "manual") === "status_quo") {
    assert(
      input.statusQuoOptionKey && optionKeys.has(input.statusQuoOptionKey),
      "VALIDATION_ERROR",
      "A status-quo tie break needs a matching option key.",
    );
  }
  if (rule === "borda") {
    assert(input.responseType === "ranked_choice", "VALIDATION_ERROR", "Borda scoring requires ranked choice.");
  }
  if (input.responseType === "ranked_choice") {
    assert(
      rule === "advisory" || rule === "borda" || rule === "plurality" || rule === "majority",
      "VALIDATION_ERROR",
      "Ranked decisions support advisory, Borda, plurality, or majority rules.",
    );
  }
}

export async function createDecisionRecord(
  ctx: MutationCtx,
  actor: AuditActor & { actorMemberId: GenericId<"members"> },
  input: DecisionDraftInput,
  requestId?: string,
): Promise<{ decisionId: GenericId<"decisions">; slug: string }> {
  const title = cleanText(input.title, "Title", 180);
  const summary = cleanText(input.summary, "Summary", 500);
  const context = cleanText(input.context, "Context", 12_000);
  const timezone = canonicalDecisionTimeZone(input.timezone);
  assert(
    timezone,
    "VALIDATION_ERROR",
    "Timezone must be a canonical IANA identifier such as America/Detroit.",
  );
  const contextItems = normalizeContextItems(input.contextItems);
  const optionSeeds = normalizeOptions(input);
  const electorate = await resolveElectorate(ctx, input.electorateMemberIds);
  assert(electorate.length > 0, "VALIDATION_ERROR", "Select at least one eligible voter.");
  validateRules(input, optionSeeds, electorate.length);

  const now = Date.now();
  const decisionId = await ctx.db.insert("decisions", {
    // This value exists only inside the transaction until the server-generated
    // document ID is available. It is replaced before the mutation commits.
    slug: "__pending_public_id__",
    title,
    summary,
    context,
    contextItems,
    responseType: input.responseType,
    electorateMode:
      input.electorateMemberIds === undefined
        ? "all_active_at_publish"
        : "explicit",
    status: "draft",
    revision: 1,
    openCycle: 0,
    createdByMemberId: actor.actorMemberId,
    createdAt: now,
    updatedAt: now,
    deadlineAt: input.deadlineAt,
    timezone,
    autoClose: input.autoClose ?? false,
    allowResponseEdits: input.allowResponseEdits ?? true,
    resultsVisibility: input.resultsVisibility ?? "after_close",
    responsePrivacy: input.responsePrivacy ?? "admins_can_view_individual",
    minimumTurnout: input.minimumTurnout,
    outcomeRule: input.outcomeRule ?? "advisory",
    approvalThresholdPercent: input.approvalThresholdPercent,
    approvalOptionKey:
      input.approvalOptionKey ??
      ((input.outcomeRule ?? "advisory") === "approval_threshold" ? "yes" : undefined),
    tieBreakRule: input.tieBreakRule ?? "manual",
    statusQuoOptionKey: input.statusQuoOptionKey,
  });
  const slug = decisionPublicSlug(String(decisionId));
  await ctx.db.patch("decisions", decisionId, { slug });
  for (const [position, option] of optionSeeds.entries()) {
    await ctx.db.insert("decisionOptions", {
      decisionId,
      ...option,
      position,
      createdAt: now,
    });
  }
  for (const member of electorate) {
    await ctx.db.insert("decisionElectorate", {
      decisionId,
      memberId: member._id,
      displayNameSnapshot: member.displayName,
      roleSnapshot: member.role,
      includedAt: now,
    });
  }
  await writeAuditEvent(ctx, {
    ...actor,
    action: "decision.created",
    entityType: "decision",
    entityId: decisionId,
    requestId,
    details: {
      slug,
      responseType: input.responseType,
      electorateSize: electorate.length,
      optionCount: optionSeeds.length,
    },
  });
  return { decisionId, slug };
}

export async function getDecisionBySlug(ctx: ReadCtx, slug: string) {
  return await ctx.db
    .query("decisions")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

export async function getDecisionBundle(
  ctx: ReadCtx,
  decision: Doc<"decisions">,
) {
  const [options, electorate] = await Promise.all([
    ctx.db
      .query("decisionOptions")
      .withIndex("by_decision", (q) => q.eq("decisionId", decision._id))
      .collect(),
    ctx.db
      .query("decisionElectorate")
      .withIndex("by_decision", (q) => q.eq("decisionId", decision._id))
      .collect(),
  ]);
  options.sort((a, b) => a.position - b.position);
  return { decision, options, electorate };
}

export async function computeDecisionResults(
  ctx: ReadCtx,
  decision: Doc<"decisions">,
) {
  const [{ options, electorate }, allBallots] = await Promise.all([
    getDecisionBundle(ctx, decision),
    ctx.db
      .query("ballots")
      .withIndex("by_decision", (q) => q.eq("decisionId", decision._id))
      .collect(),
  ]);
  const ballots = allBallots.filter(
    (ballot) => ballot.decisionRevision === decision.revision,
  );
  const optionById = new Map(options.map((option) => [String(option._id), option]));
  const tallies = tallyOptions(
    decision.responseType,
    options.map((option) => ({ optionId: String(option._id) })),
    ballots.map((ballot) => ({
      selections: ballot.selections.map((selection) => ({
        optionId: String(selection.optionId),
        rank: selection.rank,
      })),
    })),
  );
  const countById = new Map(tallies.map((tally) => [tally.optionId, tally.count]));
  const scoreById = new Map(tallies.map((tally) => [tally.optionId, tally.score]));

  const optionResults = options.map((option) => ({
    optionId: option._id,
    key: option.key,
    label: option.label,
    count: countById.get(String(option._id)) ?? 0,
    score: scoreById.get(String(option._id)) ?? 0,
  }));
  const metric = decision.outcomeRule === "borda" ? "score" : "count";
  const max = optionResults.length
    ? Math.max(...optionResults.map((option) => option[metric]))
    : 0;
  let recommended = max > 0
    ? optionResults.filter((option) => option[metric] === max)
    : [];
  let tied = recommended.length > 1;
  if (tied && decision.tieBreakRule === "status_quo" && decision.statusQuoOptionKey) {
    const statusQuo = recommended.find(
      (option) => option.key === decision.statusQuoOptionKey,
    );
    if (statusQuo) {
      recommended = [statusQuo];
      tied = false;
    }
  }
  if (decision.outcomeRule === "advisory") recommended = [];

  const responseCount = ballots.length;
  const eligibleCount = electorate.length;
  const turnoutMet =
    decision.minimumTurnout === undefined
      ? null
      : responseCount >= decision.minimumTurnout;
  let approvalMet: boolean | null = null;
  if (decision.outcomeRule === "majority") {
    approvalMet = responseCount > 0 && max / responseCount > 0.5;
  } else if (decision.outcomeRule === "approval_threshold") {
    const approvalOption = options.find(
      (option) => option.key === decision.approvalOptionKey,
    );
    const approvals = approvalOption
      ? countById.get(String(approvalOption._id)) ?? 0
      : 0;
    approvalMet =
      responseCount > 0 &&
      (approvals / responseCount) * 100 >=
        (decision.approvalThresholdPercent ?? 100);
    const approvalResult = optionResults.find(
      (option) => option.key === decision.approvalOptionKey,
    );
    recommended = approvalMet && approvalResult ? [approvalResult] : [];
    tied = false;
  }
  if (decision.outcomeRule === "majority" && approvalMet === false) {
    recommended = [];
  }

  const currentResponders = new Set(ballots.map((ballot) => String(ballot.memberId)));
  const missing = electorate
    .filter((entry) => !currentResponders.has(String(entry.memberId)))
    .map((entry) => ({
      memberId: entry.memberId,
      displayName: entry.displayNameSnapshot,
    }));

  return {
    eligibleCount,
    responseCount,
    pendingCount: missing.length,
    staleResponseCount: allBallots.length - ballots.length,
    turnoutMet,
    approvalMet,
    tied,
    recommendedOptionIds: recommended.map((option) => option.optionId),
    optionResults,
    missing,
    // Keep this private to server-side callers that separately authorize access.
    ballots,
    optionById,
  };
}

export async function publishDecisionRecord(
  ctx: MutationCtx,
  actor: AuditActor & { actorMemberId: GenericId<"members"> },
  decision: Doc<"decisions">,
  requestId?: string,
) {
  assert(decision.status === "draft", "CONFLICT", "Only a draft can be published.");
  if (decision.deadlineAt !== undefined) {
    assert(decision.deadlineAt > Date.now(), "VALIDATION_ERROR", "The deadline must be in the future.");
  }
  let electorate = await ctx.db
    .query("decisionElectorate")
    .withIndex("by_decision", (q) => q.eq("decisionId", decision._id))
    .collect();
  const now = Date.now();
  if (decision.electorateMode === "all_active_at_publish") {
    const currentRoster = await ctx.db
      .query("members")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    assert(
      currentRoster.length <= 100,
      "VALIDATION_ERROR",
      "Use an explicit electorate when the active roster exceeds 100 members.",
    );
    for (const entry of electorate) {
      await ctx.db.delete("decisionElectorate", entry._id);
    }
    electorate = [];
    for (const member of currentRoster) {
      const entryId = await ctx.db.insert("decisionElectorate", {
        decisionId: decision._id,
        memberId: member._id,
        displayNameSnapshot: member.displayName,
        roleSnapshot: member.role,
        includedAt: now,
      });
      const inserted = await ctx.db.get("decisionElectorate", entryId);
      if (inserted) electorate.push(inserted);
    }
  }
  assert(electorate.length > 0, "VALIDATION_ERROR", "The decision needs eligible voters.");
  if (decision.minimumTurnout !== undefined) {
    assert(
      decision.minimumTurnout <= electorate.length,
      "VALIDATION_ERROR",
      "Minimum turnout exceeds the publication roster.",
    );
  }
  // Draft electorate rows are editable selections. Publishing refreshes the
  // display-name/role fields and turns them into the immutable roster snapshot.
  for (const entry of electorate) {
    const member = await ctx.db.get("members", entry.memberId);
    assert(member?.status === "active", "VALIDATION_ERROR", "Every eligible voter must still be active.");
    await ctx.db.patch("decisionElectorate", entry._id, {
      displayNameSnapshot: member.displayName,
      roleSnapshot: member.role,
      includedAt: now,
    });
  }
  await ctx.db.patch("decisions", decision._id, {
    status: "open",
    publishedAt: now,
    openCycle: decision.openCycle + 1,
    updatedAt: now,
  });
  await writeAuditEvent(ctx, {
    ...actor,
    action: "decision.published",
    entityType: "decision",
    entityId: decision._id,
    requestId,
  });
  return { decisionId: decision._id, slug: decision.slug, status: "open" as const };
}

export async function closeDecisionRecord(
  ctx: MutationCtx,
  actor: AuditActor & { actorMemberId: GenericId<"members"> },
  decision: Doc<"decisions">,
  reason: string | undefined,
  requestId?: string,
) {
  assert(decision.status === "open", "CONFLICT", "Only an open decision can be closed.");
  const closeReason = reason?.trim() || undefined;
  assert(
    (closeReason?.length ?? 0) <= 2_000,
    "VALIDATION_ERROR",
    "Close reason must be 2,000 characters or fewer.",
  );
  const now = Date.now();
  await ctx.db.patch("decisions", decision._id, {
    status: "closed",
    closedAt: now,
    closedByMemberId: actor.actorMemberId,
    closeReason,
    updatedAt: now,
  });
  await writeAuditEvent(ctx, {
    ...actor,
    action: "decision.closed",
    entityType: "decision",
    entityId: decision._id,
    requestId,
    details: { reason: closeReason },
  });
  return { decisionId: decision._id, slug: decision.slug, status: "closed" as const };
}
