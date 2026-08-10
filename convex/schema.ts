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
    provider: v.literal("clerk"),
    tokenIdentifier: v.optional(v.string()),
    providerSubject: v.optional(v.string()),
    issuer: v.optional(v.string()),
    normalizedEmail: v.string(),
    status: identityStatus,
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
