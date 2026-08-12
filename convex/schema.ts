import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const memberRole = v.union(v.literal("admin"), v.literal("member"));
export const memberStatus = v.union(v.literal("active"), v.literal("inactive"));
export const identityStatus = v.union(
  v.literal("pending"),
  v.literal("verified"),
  v.literal("disabled"),
);
export const decisionStatus = v.union(
  v.literal("draft"),
  v.literal("open"),
  v.literal("closed"),
  v.literal("finalized"),
);
export const responseType = v.union(
  v.literal("yes_no_other"),
  v.literal("single_choice"),
  v.literal("ranked_choice"),
  v.literal("input_only"),
);
export const resultsVisibility = v.union(
  v.literal("after_submit"),
  v.literal("after_close"),
  v.literal("admins_only"),
);
export const responsePrivacy = v.union(
  v.literal("aggregate_only"),
  v.literal("admins_can_view_individual"),
);
export const outcomeRule = v.union(
  v.literal("advisory"),
  v.literal("plurality"),
  v.literal("majority"),
  v.literal("approval_threshold"),
  v.literal("borda"),
);
export const tieBreakRule = v.union(
  v.literal("manual"),
  v.literal("status_quo"),
  v.literal("runoff"),
  v.literal("creator_decides"),
);
export const availabilityPollStatus = v.union(
  v.literal("open"),
  v.literal("finalized"),
);
export const availabilityResultsVisibility = v.union(
  v.literal("after_submit"),
  v.literal("admins_only"),
);
export const clubEventType = v.union(
  v.literal("meeting"),
  v.literal("event"),
  v.literal("deadline"),
  v.literal("project"),
);
export const clubEventStatus = v.union(
  v.literal("tentative"),
  v.literal("confirmed"),
  v.literal("cancelled"),
);
export const projectLane = v.union(
  v.literal("community-career"),
  v.literal("advisory"),
  v.literal("catalyst"),
  v.literal("operations"),
);
export const projectStatus = v.union(
  v.literal("planned"),
  v.literal("active"),
  v.literal("blocked"),
  v.literal("complete"),
);
export const projectTaskStatus = v.union(
  v.literal("todo"),
  v.literal("working"),
  v.literal("blocked"),
  v.literal("done"),
);
export const projectTaskPriority = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);
export const agentScope = v.union(
  v.literal("decisions:read"),
  v.literal("decisions:write"),
  v.literal("decisions:publish"),
  v.literal("decisions:manage"),
  v.literal("results:read"),
);

export default defineSchema({
  members: defineTable({
    displayName: v.string(),
    role: memberRole,
    status: memberStatus,
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdByMemberId: v.optional(v.id("members")),
  })
    .index("by_status", ["status"])
    .index("by_role_and_status", ["role", "status"]),

  memberIdentities: defineTable({
    memberId: v.id("members"),
    provider: v.union(v.literal("clerk"), v.literal("logto")),
    tokenIdentifier: v.optional(v.string()),
    providerSubject: v.optional(v.string()),
    issuer: v.optional(v.string()),
    normalizedEmail: v.string(),
    status: identityStatus,
    approvalExpiresAt: v.optional(v.number()),
    verifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdByMemberId: v.optional(v.id("members")),
  })
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_provider_subject", ["provider", "providerSubject"])
    .index("by_normalized_email", ["normalizedEmail"])
    .index("by_member", ["memberId"]),

  decisions: defineTable({
    slug: v.string(),
    title: v.string(),
    summary: v.string(),
    context: v.string(),
    contextItems: v.array(v.string()),
    responseType,
    electorateMode: v.union(
      v.literal("all_active_at_publish"),
      v.literal("explicit"),
    ),
    status: decisionStatus,
    revision: v.number(),
    openCycle: v.number(),
    createdByMemberId: v.id("members"),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.number()),
    deadlineAt: v.optional(v.number()),
    timezone: v.string(),
    autoClose: v.boolean(),
    allowResponseEdits: v.boolean(),
    closedAt: v.optional(v.number()),
    closedByMemberId: v.optional(v.id("members")),
    closeReason: v.optional(v.string()),
    finalizedAt: v.optional(v.number()),
    finalizedByMemberId: v.optional(v.id("members")),
    finalizedOptionId: v.optional(v.id("decisionOptions")),
    finalOutcomeText: v.optional(v.string()),
    finalizationNote: v.optional(v.string()),
    resultsVisibility,
    responsePrivacy,
    minimumTurnout: v.optional(v.number()),
    outcomeRule,
    approvalThresholdPercent: v.optional(v.number()),
    approvalOptionKey: v.optional(v.string()),
    tieBreakRule,
    statusQuoOptionKey: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_creator_and_status", ["createdByMemberId", "status"])
    .index("by_status_and_deadline", ["status", "deadlineAt"]),

  decisionOptions: defineTable({
    decisionId: v.id("decisions"),
    key: v.string(),
    label: v.string(),
    description: v.optional(v.string()),
    position: v.number(),
    isOther: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_decision", ["decisionId"])
    .index("by_decision_and_key", ["decisionId", "key"]),

  decisionElectorate: defineTable({
    decisionId: v.id("decisions"),
    memberId: v.id("members"),
    displayNameSnapshot: v.string(),
    roleSnapshot: memberRole,
    includedAt: v.number(),
  })
    .index("by_decision", ["decisionId"])
    .index("by_member", ["memberId"])
    .index("by_decision_and_member", ["decisionId", "memberId"]),

  ballots: defineTable({
    decisionId: v.id("decisions"),
    memberId: v.id("members"),
    decisionRevision: v.number(),
    selections: v.array(
      v.object({
        optionId: v.id("decisionOptions"),
        rank: v.optional(v.number()),
      }),
    ),
    otherText: v.optional(v.string()),
    responseText: v.optional(v.string()),
    reasoning: v.optional(v.string()),
    submittedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_decision", ["decisionId"])
    .index("by_member", ["memberId"])
    .index("by_decision_and_member", ["decisionId", "memberId"]),

  availabilityPolls: defineTable({
    slug: v.string(),
    title: v.string(),
    note: v.string(),
    durationMinutes: v.number(),
    dateKeys: v.array(v.string()),
    startMinutes: v.number(),
    endMinutes: v.number(),
    slotMinutes: v.number(),
    timezone: v.string(),
    status: availabilityPollStatus,
    resultsVisibility: availabilityResultsVisibility,
    createdByMemberId: v.id("members"),
    createdAt: v.number(),
    updatedAt: v.number(),
    deadlineAt: v.optional(v.number()),
    finalizedDateKey: v.optional(v.string()),
    finalizedStartMinutes: v.optional(v.number()),
    finalizedAt: v.optional(v.number()),
    finalizedByMemberId: v.optional(v.id("members")),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_creator_and_status", ["createdByMemberId", "status"]),

  availabilityElectorate: defineTable({
    pollId: v.id("availabilityPolls"),
    memberId: v.id("members"),
    displayNameSnapshot: v.string(),
    includedAt: v.number(),
  })
    .index("by_poll", ["pollId"])
    .index("by_member", ["memberId"])
    .index("by_poll_and_member", ["pollId", "memberId"]),

  availabilityResponses: defineTable({
    pollId: v.id("availabilityPolls"),
    memberId: v.id("members"),
    availableSlotKeys: v.array(v.string()),
    submittedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_poll", ["pollId"])
    .index("by_member", ["memberId"])
    .index("by_poll_and_member", ["pollId", "memberId"]),

  clubEvents: defineTable({
    title: v.string(),
    type: clubEventType,
    startAt: v.number(),
    endAt: v.optional(v.number()),
    timezone: v.string(),
    location: v.optional(v.string()),
    ownerMemberId: v.optional(v.id("members")),
    projectId: v.optional(v.id("projects")),
    status: clubEventStatus,
    notes: v.optional(v.string()),
    createdByMemberId: v.id("members"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_start", ["startAt"])
    .index("by_project", ["projectId"]),

  projects: defineTable({
    name: v.string(),
    lane: projectLane,
    ownerMemberId: v.optional(v.id("members")),
    status: projectStatus,
    dueDate: v.optional(v.string()),
    summary: v.optional(v.string()),
    position: v.number(),
    createdByMemberId: v.id("members"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_lane_and_position", ["lane", "position"])
    .index("by_status", ["status"]),

  projectTasks: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    ownerMemberId: v.optional(v.id("members")),
    status: projectTaskStatus,
    dueDate: v.optional(v.string()),
    priority: projectTaskPriority,
    completionSignal: v.optional(v.string()),
    position: v.number(),
    createdByMemberId: v.id("members"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project_and_position", ["projectId", "position"])
    .index("by_owner_and_status", ["ownerMemberId", "status"]),

  directoryProfiles: defineTable({
    memberId: v.id("members"),
    clubRole: v.string(),
    team: v.string(),
    schoolYear: v.optional(v.string()),
    major: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    isLeadership: v.boolean(),
    updatedByMemberId: v.id("members"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_member", ["memberId"]),

  agentKeys: defineTable({
    name: v.string(),
    prefix: v.string(),
    secretHash: v.string(),
    hashAlgorithm: v.literal("SHA-256"),
    scopes: v.array(agentScope),
    createdByMemberId: v.id("members"),
    status: v.union(v.literal("active"), v.literal("revoked")),
    rateLimitPerMinute: v.number(),
    rateWindowStartedAt: v.optional(v.number()),
    rateWindowCount: v.optional(v.number()),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_prefix", ["prefix"])
    .index("by_creator", ["createdByMemberId"])
    .index("by_status", ["status"]),

  agentRequests: defineTable({
    agentKeyId: v.id("agentKeys"),
    idempotencyKey: v.string(),
    operation: v.string(),
    requestHash: v.string(),
    responseJson: v.string(),
    createdAt: v.number(),
  })
    .index("by_key_and_idempotency", ["agentKeyId", "idempotencyKey"])
    .index("by_created_at", ["createdAt"]),

  auditEvents: defineTable({
    actorType: v.union(
      v.literal("member"),
      v.literal("agent"),
      v.literal("system"),
    ),
    actorMemberId: v.optional(v.id("members")),
    agentKeyId: v.optional(v.id("agentKeys")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    requestId: v.optional(v.string()),
    detailsJson: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_actor_member", ["actorMemberId"])
    .index("by_created_at", ["createdAt"]),
});
