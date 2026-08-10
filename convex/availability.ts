import { v } from "convex/values";
import {
  availabilityResultsVisibility,
} from "./schema";
import { mutation, query, type MutationCtx, type QueryCtx } from "./lib/server";
import {
  canManageDecision,
  requireAdmin,
  requireDecisionManager,
  requireMember,
} from "./lib/auth";
import { assert } from "./lib/errors";
import { availabilityPublicSlug } from "./lib/publicIds";
import { canonicalDecisionTimeZone } from "./lib/timezones";
import {
  AVAILABILITY_SLOT_MINUTES,
  availabilityResults,
  normalizeAvailabilitySlots,
  validDateKey,
} from "./lib/availability";
import { writeAuditEvent } from "./lib/audit";
import type { Doc } from "./lib/types";

const createPollInput = v.object({
  title: v.string(),
  note: v.optional(v.string()),
  durationMinutes: v.number(),
  dateKeys: v.array(v.string()),
  startMinutes: v.number(),
  endMinutes: v.number(),
  timezone: v.optional(v.string()),
  electorateMemberIds: v.optional(v.array(v.id("members"))),
  deadlineAt: v.optional(v.number()),
  resultsVisibility: v.optional(availabilityResultsVisibility),
});

function cleanText(value: string, max: number, field: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  assert(normalized.length > 0, "VALIDATION_ERROR", `${field} is required.`);
  assert(normalized.length <= max, "VALIDATION_ERROR", `${field} is too long.`);
  return normalized;
}

function normalizedDates(values: string[]): string[] {
  const dates = [...new Set(values.map((value) => value.trim()))].sort();
  assert(dates.length > 0 && dates.length <= 14, "VALIDATION_ERROR", "Choose between 1 and 14 dates.");
  assert(dates.every(validDateKey), "VALIDATION_ERROR", "Every possible date must use YYYY-MM-DD.");
  return dates;
}

function validateTimeShape(input: {
  durationMinutes: number;
  startMinutes: number;
  endMinutes: number;
}) {
  const { durationMinutes, startMinutes, endMinutes } = input;
  assert(
    Number.isInteger(durationMinutes)
    && durationMinutes >= 15
    && durationMinutes <= 180
    && durationMinutes % AVAILABILITY_SLOT_MINUTES === 0,
    "VALIDATION_ERROR",
    "Meeting length must be 15 to 180 minutes in 15-minute steps.",
  );
  assert(
    Number.isInteger(startMinutes)
    && Number.isInteger(endMinutes)
    && startMinutes >= 0
    && endMinutes <= 24 * 60
    && startMinutes % AVAILABILITY_SLOT_MINUTES === 0
    && endMinutes % AVAILABILITY_SLOT_MINUTES === 0
    && endMinutes - startMinutes >= durationMinutes
    && endMinutes - startMinutes <= 12 * 60,
    "VALIDATION_ERROR",
    "Choose a valid time window no longer than 12 hours.",
  );
}

async function pollElectorate(ctx: QueryCtx | MutationCtx, pollId: Doc<"availabilityPolls">["_id"]) {
  return await ctx.db
    .query("availabilityElectorate")
    .withIndex("by_poll", (q) => q.eq("pollId", pollId))
    .collect();
}

async function pollResponses(ctx: QueryCtx | MutationCtx, pollId: Doc<"availabilityPolls">["_id"]) {
  return await ctx.db
    .query("availabilityResponses")
    .withIndex("by_poll", (q) => q.eq("pollId", pollId))
    .collect();
}

async function resolveElectorate(ctx: MutationCtx, ids?: Doc<"members">["_id"][]) {
  const members = ids?.length
    ? await Promise.all([...new Set(ids)].map((id) => ctx.db.get("members", id)))
    : await ctx.db
        .query("members")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .collect();
  assert(members.length > 0 && members.length <= 50, "VALIDATION_ERROR", "Choose between 1 and 50 members.");
  assert(members.every((member) => member?.status === "active"), "VALIDATION_ERROR", "Every selected member must be active.");
  return members.filter((member): member is Doc<"members"> => Boolean(member));
}

function canManage(member: Doc<"members">, poll: Doc<"availabilityPolls">) {
  return canManageDecision(member, poll);
}

async function resultBundle(
  ctx: QueryCtx,
  poll: Doc<"availabilityPolls">,
  actor: Doc<"members">,
  electorate: Awaited<ReturnType<typeof pollElectorate>>,
  responses: Awaited<ReturnType<typeof pollResponses>>,
  myResponse: Doc<"availabilityResponses"> | null,
) {
  const manager = canManage(actor, poll);
  const resultsAllowed = manager
    || poll.resultsVisibility === "after_submit" && Boolean(myResponse);
  if (!resultsAllowed) return null;
  const result = availabilityResults(
    poll,
    responses.map((response) => ({
      memberId: String(response.memberId),
      availableSlotKeys: response.availableSlotKeys,
    })),
  );
  const responded = new Set(responses.map((response) => response.memberId));
  return {
    responseCount: result.responseCount,
    eligibleCount: electorate.length,
    cellCounts: result.cellCounts,
    candidates: result.candidates.map((candidate) => ({
      dateKey: candidate.dateKey,
      startMinutes: candidate.startMinutes,
      endMinutes: candidate.endMinutes,
      availableCount: candidate.availableCount,
    })),
    missing: manager
      ? electorate
          .filter((entry) => !responded.has(entry.memberId))
          .map((entry) => ({ memberId: entry.memberId, displayName: entry.displayNameSnapshot }))
      : null,
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const actor = await requireMember(ctx);
    const polls = await ctx.db.query("availabilityPolls").collect();
    const visible = [];
    for (const poll of polls) {
      const manager = canManage(actor, poll);
      const eligible = await ctx.db
        .query("availabilityElectorate")
        .withIndex("by_poll_and_member", (q) =>
          q.eq("pollId", poll._id).eq("memberId", actor._id),
        )
        .unique();
      if (!manager && !eligible) continue;
      const [electorate, responses, myResponse] = await Promise.all([
        pollElectorate(ctx, poll._id),
        pollResponses(ctx, poll._id),
        ctx.db
          .query("availabilityResponses")
          .withIndex("by_poll_and_member", (q) =>
            q.eq("pollId", poll._id).eq("memberId", actor._id),
          )
          .unique(),
      ]);
      visible.push({
        pollId: poll._id,
        slug: poll.slug,
        title: poll.title,
        note: poll.note,
        status: poll.status,
        durationMinutes: poll.durationMinutes,
        timezone: poll.timezone,
        deadlineAt: poll.deadlineAt ?? null,
        eligibleCount: electorate.length,
        responseCount: responses.length,
        hasResponded: Boolean(myResponse),
        canManage: manager,
        updatedAt: poll.updatedAt,
      });
    }
    return visible.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    const poll = await ctx.db
      .query("availabilityPolls")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    assert(poll, "NOT_FOUND", "Scheduling poll not found.");
    const eligible = await ctx.db
      .query("availabilityElectorate")
      .withIndex("by_poll_and_member", (q) =>
        q.eq("pollId", poll._id).eq("memberId", actor._id),
      )
      .unique();
    assert(canManage(actor, poll) || eligible, "FORBIDDEN", "You are not included in this scheduling poll.");
    const [electorate, responses, myResponse] = await Promise.all([
      pollElectorate(ctx, poll._id),
      pollResponses(ctx, poll._id),
      ctx.db
        .query("availabilityResponses")
        .withIndex("by_poll_and_member", (q) =>
          q.eq("pollId", poll._id).eq("memberId", actor._id),
        )
        .unique(),
    ]);
    return {
      ...poll,
      eligibleCount: electorate.length,
      responseCount: responses.length,
      isEligible: Boolean(eligible),
      canManage: canManage(actor, poll),
      myResponse: myResponse
        ? {
            availableSlotKeys: myResponse.availableSlotKeys,
            submittedAt: myResponse.submittedAt,
            updatedAt: myResponse.updatedAt,
          }
        : null,
      results: await resultBundle(ctx, poll, actor, electorate, responses, myResponse),
    };
  },
});

export const create = mutation({
  args: { input: createPollInput },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    requireAdmin(actor);
    const title = cleanText(args.input.title, 160, "Title");
    const note = args.input.note?.trim().replace(/\s+/g, " ") ?? "";
    assert(note.length <= 500, "VALIDATION_ERROR", "Context is too long.");
    const dateKeys = normalizedDates(args.input.dateKeys);
    validateTimeShape(args.input);
    const timezone = canonicalDecisionTimeZone(args.input.timezone);
    assert(timezone, "VALIDATION_ERROR", "Use a canonical IANA timezone.");
    if (args.input.deadlineAt !== undefined) {
      assert(Number.isFinite(args.input.deadlineAt) && args.input.deadlineAt > Date.now(), "VALIDATION_ERROR", "Reply deadline must be in the future.");
    }
    const electorate = await resolveElectorate(ctx, args.input.electorateMemberIds);
    const now = Date.now();
    const pollId = await ctx.db.insert("availabilityPolls", {
      slug: "pending",
      title,
      note,
      durationMinutes: args.input.durationMinutes,
      dateKeys,
      startMinutes: args.input.startMinutes,
      endMinutes: args.input.endMinutes,
      slotMinutes: AVAILABILITY_SLOT_MINUTES,
      timezone,
      status: "open",
      resultsVisibility: args.input.resultsVisibility ?? "after_submit",
      createdByMemberId: actor._id,
      createdAt: now,
      updatedAt: now,
      deadlineAt: args.input.deadlineAt,
    });
    const slug = availabilityPublicSlug(String(pollId));
    await ctx.db.patch("availabilityPolls", pollId, { slug });
    for (const member of electorate) {
      await ctx.db.insert("availabilityElectorate", {
        pollId,
        memberId: member._id,
        displayNameSnapshot: member.displayName,
        includedAt: now,
      });
    }
    await writeAuditEvent(ctx, {
      actorType: "member",
      actorMemberId: actor._id,
      action: "availability.created",
      entityType: "availabilityPoll",
      entityId: pollId,
    });
    return { pollId, slug };
  },
});

export const saveResponse = mutation({
  args: {
    pollId: v.id("availabilityPolls"),
    availableSlotKeys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    const poll = await ctx.db.get("availabilityPolls", args.pollId);
    assert(poll, "NOT_FOUND", "Scheduling poll not found.");
    assert(poll.status === "open", "POLL_CLOSED", "This scheduling poll is closed.");
    assert(!poll.deadlineAt || poll.deadlineAt > Date.now(), "POLL_CLOSED", "The reply deadline has passed.");
    const eligible = await ctx.db
      .query("availabilityElectorate")
      .withIndex("by_poll_and_member", (q) =>
        q.eq("pollId", poll._id).eq("memberId", actor._id),
      )
      .unique();
    assert(eligible, "FORBIDDEN", "You are not included in this scheduling poll.");
    const availableSlotKeys = normalizeAvailabilitySlots(poll, args.availableSlotKeys);
    assert(availableSlotKeys.length <= 14 * 48, "VALIDATION_ERROR", "Too many availability slots.");
    const existing = await ctx.db
      .query("availabilityResponses")
      .withIndex("by_poll_and_member", (q) =>
        q.eq("pollId", poll._id).eq("memberId", actor._id),
      )
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch("availabilityResponses", existing._id, { availableSlotKeys, updatedAt: now });
    } else {
      await ctx.db.insert("availabilityResponses", {
        pollId: poll._id,
        memberId: actor._id,
        availableSlotKeys,
        submittedAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.patch("availabilityPolls", poll._id, { updatedAt: now });
    return { availableSlotKeys, savedAt: now };
  },
});

export const finalize = mutation({
  args: {
    pollId: v.id("availabilityPolls"),
    dateKey: v.string(),
    startMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    const poll = await ctx.db.get("availabilityPolls", args.pollId);
    assert(poll, "NOT_FOUND", "Scheduling poll not found.");
    requireDecisionManager(actor, poll);
    const normalized = normalizeAvailabilitySlots(poll, [
      `${args.dateKey}@${args.startMinutes}`,
    ]);
    assert(normalized.length === 1, "VALIDATION_ERROR", "Choose a valid start time.");
    assert(args.startMinutes + poll.durationMinutes <= poll.endMinutes, "VALIDATION_ERROR", "The meeting must fit inside the poll window.");
    const now = Date.now();
    await ctx.db.patch("availabilityPolls", poll._id, {
      status: "finalized",
      finalizedDateKey: args.dateKey,
      finalizedStartMinutes: args.startMinutes,
      finalizedAt: now,
      finalizedByMemberId: actor._id,
      updatedAt: now,
    });
    await writeAuditEvent(ctx, {
      actorType: "member",
      actorMemberId: actor._id,
      action: "availability.finalized",
      entityType: "availabilityPoll",
      entityId: poll._id,
    });
  },
});
