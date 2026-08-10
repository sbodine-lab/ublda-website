import { v, type GenericId } from "convex/values";
import { agentScope } from "./schema";
import { internalMutation, internalQuery } from "./lib/server";
import { agentPrincipal } from "./lib/validators";
import type { Infer } from "convex/values";
import type { AgentScope } from "./lib/types";
import { assert } from "./lib/errors";
import { canManageDecision, requireDecisionManager } from "./lib/auth";
import {
  closeDecisionRecord,
  computeDecisionResults,
  createDecisionRecord,
  getDecisionBundle,
  getDecisionBySlug,
  publishDecisionRecord,
} from "./lib/decisionService";
import { decisionDraftInput } from "./lib/validators";
import { writeAuditEvent } from "./lib/audit";

type AgentPrincipal = Infer<typeof agentPrincipal>;

function requireScope(principal: AgentPrincipal, scope: AgentScope): void {
  assert(
    principal.scopes.includes(scope),
    "FORBIDDEN",
    `Agent token is missing ${scope}.`,
  );
}

async function requireActivePrincipal(ctx: Parameters<typeof createDecisionRecord>[0], principal: AgentPrincipal) {
  const member = await ctx.db.get("members", principal.memberId);
  assert(member?.status === "active", "FORBIDDEN", "Agent principal is inactive.");
  return member;
}

async function resolveDecision(
  ctx: Parameters<typeof getDecisionBySlug>[0],
  input: { decisionId?: GenericId<"decisions">; slug?: string },
) {
  assert(input.decisionId || input.slug, "VALIDATION_ERROR", "Provide a decision ID or slug.");
  const decision = input.decisionId
    ? await ctx.db.get("decisions", input.decisionId)
    : await getDecisionBySlug(ctx, input.slug!);
  assert(decision, "NOT_FOUND", "Decision not found.");
  return decision;
}

async function replayIdempotent(
  ctx: Parameters<typeof createDecisionRecord>[0],
  principal: AgentPrincipal,
  input: {
    operation: string;
    idempotencyKey?: string;
    requestHash: string;
  },
): Promise<unknown | null> {
  if (!input.idempotencyKey) return null;
  const idempotencyKey = input.idempotencyKey;
  const existing = await ctx.db
    .query("agentRequests")
    .withIndex("by_key_and_idempotency", (q) =>
      q
        .eq("agentKeyId", principal.tokenId)
        .eq("idempotencyKey", idempotencyKey),
    )
    .unique();
  if (!existing) return null;
  assert(
    existing.operation === input.operation && existing.requestHash === input.requestHash,
    "IDEMPOTENCY_CONFLICT",
    "This idempotency key was already used for a different request.",
  );
  return JSON.parse(existing.responseJson) as unknown;
}

async function saveIdempotent(
  ctx: Parameters<typeof createDecisionRecord>[0],
  principal: AgentPrincipal,
  input: {
    operation: string;
    idempotencyKey?: string;
    requestHash: string;
    response: unknown;
  },
): Promise<void> {
  if (!input.idempotencyKey) return;
  await ctx.db.insert("agentRequests", {
    agentKeyId: principal.tokenId,
    idempotencyKey: input.idempotencyKey,
    operation: input.operation,
    requestHash: input.requestHash,
    responseJson: JSON.stringify(input.response),
    createdAt: Date.now(),
  });
}

async function auditReplay(
  ctx: Parameters<typeof createDecisionRecord>[0],
  principal: AgentPrincipal,
  operation: string,
  response: unknown,
  requestId?: string,
): Promise<void> {
  const record =
    response && typeof response === "object"
      ? (response as Record<string, unknown>)
      : {};
  await writeAuditEvent(ctx, {
    actorType: "agent",
    actorMemberId: principal.memberId,
    agentKeyId: principal.tokenId,
    action: `agent.${operation}.idempotent_replay`,
    entityType: "decision",
    entityId:
      typeof record.decisionId === "string" ? record.decisionId : "workspace",
    requestId,
  });
}

const idempotencyArgs = {
  idempotencyKey: v.optional(v.string()),
  requestHash: v.string(),
  requestId: v.optional(v.string()),
};

export const createDraftInternal = internalMutation({
  args: {
    principal: agentPrincipal,
    input: decisionDraftInput,
    ...idempotencyArgs,
  },
  handler: async (ctx, args) => {
    requireScope(args.principal, "decisions:write");
    await requireActivePrincipal(ctx, args.principal);
    const replay = await replayIdempotent(ctx, args.principal, {
      operation: "create-draft",
      idempotencyKey: args.idempotencyKey,
      requestHash: args.requestHash,
    });
    if (replay !== null) {
      await auditReplay(ctx, args.principal, "create_draft", replay, args.requestId);
      return replay;
    }
    const response = await createDecisionRecord(
      ctx,
      {
        actorType: "agent",
        actorMemberId: args.principal.memberId,
        agentKeyId: args.principal.tokenId,
      },
      args.input,
      args.requestId,
    );
    await saveIdempotent(ctx, args.principal, {
      operation: "create-draft",
      idempotencyKey: args.idempotencyKey,
      requestHash: args.requestHash,
      response,
    });
    return response;
  },
});

export const publishInternal = internalMutation({
  args: {
    principal: agentPrincipal,
    decisionId: v.optional(v.id("decisions")),
    slug: v.optional(v.string()),
    ...idempotencyArgs,
  },
  handler: async (ctx, args) => {
    requireScope(args.principal, "decisions:publish");
    const member = await requireActivePrincipal(ctx, args.principal);
    const replay = await replayIdempotent(ctx, args.principal, {
      operation: "publish",
      idempotencyKey: args.idempotencyKey,
      requestHash: args.requestHash,
    });
    if (replay !== null) {
      await auditReplay(ctx, args.principal, "publish", replay, args.requestId);
      return replay;
    }
    const decision = await resolveDecision(ctx, args);
    requireDecisionManager(member, decision);
    const response = await publishDecisionRecord(
      ctx,
      {
        actorType: "agent",
        actorMemberId: member._id,
        agentKeyId: args.principal.tokenId,
      },
      decision,
      args.requestId,
    );
    await saveIdempotent(ctx, args.principal, {
      operation: "publish",
      idempotencyKey: args.idempotencyKey,
      requestHash: args.requestHash,
      response,
    });
    return response;
  },
});

export const closeInternal = internalMutation({
  args: {
    principal: agentPrincipal,
    decisionId: v.optional(v.id("decisions")),
    slug: v.optional(v.string()),
    reason: v.optional(v.string()),
    ...idempotencyArgs,
  },
  handler: async (ctx, args) => {
    requireScope(args.principal, "decisions:manage");
    const member = await requireActivePrincipal(ctx, args.principal);
    const replay = await replayIdempotent(ctx, args.principal, {
      operation: "close",
      idempotencyKey: args.idempotencyKey,
      requestHash: args.requestHash,
    });
    if (replay !== null) {
      await auditReplay(ctx, args.principal, "close", replay, args.requestId);
      return replay;
    }
    const decision = await resolveDecision(ctx, args);
    requireDecisionManager(member, decision);
    const response = await closeDecisionRecord(
      ctx,
      {
        actorType: "agent",
        actorMemberId: member._id,
        agentKeyId: args.principal.tokenId,
      },
      decision,
      args.reason,
      args.requestId,
    );
    await saveIdempotent(ctx, args.principal, {
      operation: "close",
      idempotencyKey: args.idempotencyKey,
      requestHash: args.requestHash,
      response,
    });
    return response;
  },
});

export const listInternal = internalQuery({
  args: {
    principal: agentPrincipal,
    status: v.optional(v.union(v.literal("draft"), v.literal("open"), v.literal("closed"), v.literal("finalized"))),
    limit: v.number(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireScope(args.principal, "decisions:read");
    assert(
      Number.isInteger(args.limit) && args.limit >= 1 && args.limit <= 100,
      "VALIDATION_ERROR",
      "List limit must be a whole number from 1 to 100.",
    );
    const member = await ctx.db.get("members", args.principal.memberId);
    assert(member?.status === "active", "FORBIDDEN", "Agent principal is inactive.");
    const page = args.status
      ? await ctx.db
          .query("decisions")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .order("desc")
          .paginate({ numItems: args.limit, cursor: args.cursor ?? null })
      : await ctx.db
          .query("decisions")
          .order("desc")
          .paginate({ numItems: args.limit, cursor: args.cursor ?? null });
    const output = [];
    for (const decision of page.page) {
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
      const [eligibleRows, ballots] = await Promise.all([
        ctx.db
          .query("decisionElectorate")
          .withIndex("by_decision", (q) => q.eq("decisionId", decision._id))
          .collect(),
        ctx.db
          .query("ballots")
          .withIndex("by_decision", (q) => q.eq("decisionId", decision._id))
          .collect(),
      ]);
      output.push({
        decisionId: decision._id,
        slug: decision.slug,
        title: decision.title,
        summary: decision.summary,
        responseType: decision.responseType,
        status: decision.status,
        deadlineAt: decision.deadlineAt ?? null,
        eligibleCount: eligibleRows.length,
        responseCount: ballots.filter(
          (ballot) => ballot.decisionRevision === decision.revision,
        ).length,
        canManage: manager,
        updatedAt: decision.updatedAt,
      });
    }
    return {
      items: output,
      nextCursor: page.isDone ? null : page.continueCursor,
    };
  },
});

export const getInternal = internalQuery({
  args: {
    principal: agentPrincipal,
    decisionId: v.optional(v.id("decisions")),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireScope(args.principal, "decisions:read");
    const member = await ctx.db.get("members", args.principal.memberId);
    assert(member?.status === "active", "FORBIDDEN", "Agent principal is inactive.");
    const decision = await resolveDecision(ctx, args);
    const manager = canManageDecision(member, decision);
    const electorateEntry = await ctx.db
      .query("decisionElectorate")
      .withIndex("by_decision_and_member", (q) =>
        q.eq("decisionId", decision._id).eq("memberId", member._id),
      )
      .unique();
    assert(manager || (electorateEntry && decision.status !== "draft"), "FORBIDDEN", "Decision is not visible to this principal.");
    const { options, electorate } = await getDecisionBundle(ctx, decision);
    return {
      decision: {
        decisionId: decision._id,
        slug: decision.slug,
        title: decision.title,
        summary: decision.summary,
        overview: decision.context,
        contextItems: decision.contextItems,
        responseType: decision.responseType,
        status: decision.status,
        revision: decision.revision,
        deadlineAt: decision.deadlineAt ?? null,
        timezone: decision.timezone,
        autoClose: decision.autoClose,
        allowResponseEdits: decision.allowResponseEdits,
        resultsVisibility: decision.resultsVisibility,
        minimumTurnout: decision.minimumTurnout ?? null,
        outcomeRule: decision.outcomeRule,
        approvalThresholdPercent: decision.approvalThresholdPercent ?? null,
        tieBreakRule: decision.tieBreakRule,
      },
      options: options.map(({ _id, key, label, description, isOther, position }) => ({
        optionId: _id,
        key,
        label,
        description: description ?? null,
        isOther,
        position,
      })),
      eligibleCount: electorate.length,
      canManage: manager,
    };
  },
});

export const responseStatusInternal = internalQuery({
  args: {
    principal: agentPrincipal,
    decisionId: v.optional(v.id("decisions")),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireScope(args.principal, "decisions:manage");
    const member = await ctx.db.get("members", args.principal.memberId);
    assert(member?.status === "active", "FORBIDDEN", "Agent principal is inactive.");
    const decision = await resolveDecision(ctx, args);
    requireDecisionManager(member, decision);
    const results = await computeDecisionResults(ctx, decision);
    return {
      decisionId: decision._id,
      eligibleCount: results.eligibleCount,
      responseCount: results.responseCount,
      pendingCount: results.pendingCount,
      staleResponseCount: results.staleResponseCount,
      missing: results.missing,
    };
  },
});

export const aggregateResultsInternal = internalQuery({
  args: {
    principal: agentPrincipal,
    decisionId: v.optional(v.id("decisions")),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireScope(args.principal, "results:read");
    const member = await ctx.db.get("members", args.principal.memberId);
    assert(member?.status === "active", "FORBIDDEN", "Agent principal is inactive.");
    const decision = await resolveDecision(ctx, args);
    const manager = canManageDecision(member, decision);
    if (!manager) {
      const electorate = await ctx.db
        .query("decisionElectorate")
        .withIndex("by_decision_and_member", (q) =>
          q.eq("decisionId", decision._id).eq("memberId", member._id),
        )
        .unique();
      assert(electorate && decision.status !== "draft", "FORBIDDEN", "Results are not visible to this principal.");
      assert(decision.resultsVisibility !== "admins_only", "FORBIDDEN", "Results are manager-only.");
      if (decision.resultsVisibility === "after_close") {
        assert(decision.status === "closed" || decision.status === "finalized", "FORBIDDEN", "Results are not available until close.");
      }
      if (decision.resultsVisibility === "after_submit") {
        const ballot = await ctx.db
          .query("ballots")
          .withIndex("by_decision_and_member", (q) =>
            q.eq("decisionId", decision._id).eq("memberId", member._id),
          )
          .unique();
        assert(ballot?.decisionRevision === decision.revision, "FORBIDDEN", "Submit a current response first.");
      }
    }
    const results = await computeDecisionResults(ctx, decision);
    return {
      decisionId: decision._id,
      slug: decision.slug,
      status: decision.status,
      eligibleCount: results.eligibleCount,
      responseCount: results.responseCount,
      pendingCount: results.pendingCount,
      staleResponseCount: results.staleResponseCount,
      turnoutMet: results.turnoutMet,
      approvalMet: results.approvalMet,
      tied: results.tied,
      recommendedOptionIds: results.recommendedOptionIds,
      optionResults: results.optionResults,
    };
  },
});

export const recordReadInternal = internalMutation({
  args: {
    principal: agentPrincipal,
    operation: v.string(),
    entityId: v.string(),
    requestId: v.optional(v.string()),
    requiredScope: agentScope,
  },
  handler: async (ctx, args) => {
    requireScope(args.principal, args.requiredScope);
    await requireActivePrincipal(ctx, args.principal);
    await writeAuditEvent(ctx, {
      actorType: "agent",
      actorMemberId: args.principal.memberId,
      agentKeyId: args.principal.tokenId,
      action: `agent.${args.operation}`,
      entityType: args.operation === "list" ? "workspace" : "decision",
      entityId: args.entityId,
      requestId: args.requestId,
    });
    return null;
  },
});
