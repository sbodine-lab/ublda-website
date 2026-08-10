import { v } from "convex/values";
import type { Infer } from "convex/values";
import {
  agentScope,
  outcomeRule,
  responsePrivacy,
  responseType,
  resultsVisibility,
  tieBreakRule,
} from "../schema";

export const agentPrincipal = v.object({
  tokenId: v.id("agentKeys"),
  memberId: v.id("members"),
  scopes: v.array(agentScope),
});

export const optionInput = v.object({
  key: v.optional(v.string()),
  label: v.string(),
  description: v.optional(v.string()),
  isOther: v.optional(v.boolean()),
});

export const decisionDraftInput = v.object({
  title: v.string(),
  summary: v.string(),
  context: v.string(),
  contextItems: v.optional(v.array(v.string())),
  responseType,
  options: v.optional(v.array(optionInput)),
  electorateMemberIds: v.optional(v.array(v.id("members"))),
  deadlineAt: v.optional(v.number()),
  timezone: v.optional(v.string()),
  autoClose: v.optional(v.boolean()),
  allowResponseEdits: v.optional(v.boolean()),
  resultsVisibility: v.optional(resultsVisibility),
  responsePrivacy: v.optional(responsePrivacy),
  minimumTurnout: v.optional(v.number()),
  outcomeRule: v.optional(outcomeRule),
  approvalThresholdPercent: v.optional(v.number()),
  approvalOptionKey: v.optional(v.string()),
  tieBreakRule: v.optional(tieBreakRule),
  statusQuoOptionKey: v.optional(v.string()),
});

export type DecisionDraftInput = Infer<typeof decisionDraftInput>;

export const ballotInput = v.object({
  selections: v.array(
    v.object({
      optionId: v.id("decisionOptions"),
      rank: v.optional(v.number()),
    }),
  ),
  otherText: v.optional(v.string()),
  responseText: v.optional(v.string()),
  reasoning: v.optional(v.string()),
});

export type BallotInput = Infer<typeof ballotInput>;
