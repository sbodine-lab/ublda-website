import type {
  AgentKeyRecord,
  BallotAnswer,
  BallotType,
  CreateDecisionInput,
  DecisionMember,
  DecisionOption,
  DecisionRecord,
  DecisionResponse,
  DecisionResults,
  ResultsVisibility,
  TieRule,
} from "./types"

export interface BackendViewer {
  memberId: string
  displayName: string
  role: "admin" | "member"
  avatarUrl?: string | null
}

export interface BackendDecisionSummary {
  decisionId: string
  slug: string
  title: string
  summary: string
  status: DecisionRecord["status"]
  responseType: BackendResponseType
  deadlineAt: number | null
  timezone?: string
  autoClose?: boolean
  eligibleCount: number
  responseCount: number
  hasResponded: boolean
  needsReconfirmation: boolean
  isEligible?: boolean
  canManage: boolean
  updatedAt: number
}

export interface BackendWorkspaceSnapshot {
  viewer: BackendViewer
  decisions: BackendDecisionSummary[]
}

export type BackendResponseType =
  | "yes_no_other"
  | "single_choice"
  | "ranked_choice"
  | "input_only"

export interface BackendDecisionOption {
  _id: string
  key: string
  label: string
  description?: string
  isOther: boolean
  position?: number
}

export interface BackendBallotSelection {
  optionId: string
  rank?: number
}

export interface BackendOwnResponse {
  selections: BackendBallotSelection[]
  otherText: string | null
  responseText: string | null
  reasoning: string | null
  submittedAt: number
  updatedAt: number
  decisionRevision?: number
  isCurrent?: boolean
}

export interface BackendDecisionDetail {
  _id: string
  slug: string
  title: string
  summary: string
  context: string
  contextItems: string[]
  responseType: BackendResponseType
  status: DecisionRecord["status"]
  revision: number
  createdByMemberId: string
  createdAt: number
  updatedAt: number
  deadlineAt?: number
  timezone: string
  autoClose: boolean
  allowResponseEdits: boolean
  resultsVisibility: "after_submit" | "after_close" | "admins_only"
  minimumTurnout?: number
  outcomeRule: "advisory" | "plurality" | "majority" | "approval_threshold" | "borda"
  approvalThresholdPercent?: number
  tieBreakRule: "manual" | "status_quo" | "runoff" | "creator_decides"
  finalizedOptionId?: string
  finalOutcomeText?: string
  finalizationNote?: string
  options: BackendDecisionOption[]
  eligibleCount: number
  responseCount?: number
  isEligible?: boolean
  canManage: boolean
  myResponse: BackendOwnResponse | null
  needsReconfirmation: boolean
}

export interface BackendOptionResult {
  optionId: string
  key: string
  label: string
  count: number
  score: number
}

export interface BackendIndividualResponse {
  memberId: string
  displayName: string
  selections: BackendBallotSelection[]
  otherText: string | null
  responseText: string | null
  reasoning: string | null
  updatedAt: number
}

export interface BackendAggregateResults {
  eligibleCount: number
  responseCount: number
  pendingCount: number
  optionResults: BackendOptionResult[]
  missing: Array<{ memberId: string; displayName: string }> | null
  individualResponses: BackendIndividualResponse[] | null
}

export interface BackendEligibleMember {
  memberId: string
  displayName: string
  role: "admin" | "member"
}

export interface BackendAdminMember {
  _id: string
  displayName: string
  role: "admin" | "member"
  status: "active" | "inactive"
  identities: Array<{
    normalizedEmail: string
    status: "pending" | "verified" | "disabled"
  }>
}

export interface BackendAgentKey {
  agentKeyId: string
  name: string
  prefix: string
  scopes: AgentKeyRecord["scopes"]
  status: "active" | "revoked"
  createdAt: number
  lastUsedAt?: number | null
  expiresAt?: number | null
  revokedAt?: number | null
}

export interface BackendDecisionActivity {
  eventId: string
  action: string
  actorType: "member" | "agent" | "system"
  actorDisplayName: string
  createdAt: number
}

export interface BackendCreatedAgentKey {
  agentKeyId: string
  name: string
  prefix: string
  scopes: AgentKeyRecord["scopes"]
  createdAt: number
  expiresAt: number | null
  token: string
}

export interface BackendCreateDecisionResult {
  decisionId: string
  slug: string
}

export interface BackendSubmitResult {
  ballotId: string
  submittedAt: number
  updatedAt: number
}

const responseTypeMap: Record<BackendResponseType, BallotType> = {
  yes_no_other: "binary",
  single_choice: "single",
  ranked_choice: "ranked",
  input_only: "input",
}

const backendResponseTypeMap: Record<BallotType, BackendResponseType> = {
  binary: "yes_no_other",
  single: "single_choice",
  ranked: "ranked_choice",
  input: "input_only",
}

const resultsVisibilityMap: Record<BackendDecisionDetail["resultsVisibility"], ResultsVisibility> = {
  after_submit: "after-submit",
  after_close: "after-close",
  admins_only: "admins-only",
}

const backendResultsVisibilityMap: Record<ResultsVisibility, BackendDecisionDetail["resultsVisibility"]> = {
  "after-submit": "after_submit",
  "after-close": "after_close",
  "admins-only": "admins_only",
}

const tieRuleMap: Record<BackendDecisionDetail["tieBreakRule"], TieRule> = {
  manual: "manual",
  status_quo: "manual",
  runoff: "runoff",
  creator_decides: "chair",
}

const backendTieRuleMap: Record<TieRule, BackendDecisionDetail["tieBreakRule"]> = {
  manual: "manual",
  runoff: "runoff",
  chair: "creator_decides",
}

function iso(timestamp: number | undefined): string | undefined {
  return timestamp === undefined ? undefined : new Date(timestamp).toISOString()
}

function optionFromBackend(option: BackendDecisionOption): DecisionOption {
  return {
    id: option._id,
    key: option.key,
    label: option.label,
    description: option.description,
    isOther: option.isOther,
  }
}

export function mapDecisionSummary(
  summary: BackendDecisionSummary,
  viewerMemberId: string,
): DecisionRecord {
  return {
    id: summary.decisionId,
    slug: summary.slug,
    title: summary.title,
    overview: summary.summary,
    contextPoints: [],
    status: summary.status,
    ballotType: responseTypeMap[summary.responseType],
    options: [],
    allowOther: false,
    electorateMemberIds: summary.isEligible ? [viewerMemberId] : [],
    creatorMemberId: "",
    createdAt: iso(summary.updatedAt)!,
    updatedAt: iso(summary.updatedAt)!,
    deadline: iso(summary.deadlineAt ?? undefined),
    timezone: summary.timezone ?? "America/Detroit",
    autoClose: summary.autoClose ?? false,
    revision: 1,
    rules: {
      outcomeRule: "advisory",
      tieRule: "manual",
      resultsVisibility: "after-close",
      allowResponseEdits: true,
    },
    eligibleCount: summary.eligibleCount,
    responseCount: summary.responseCount,
    isEligible: summary.isEligible,
    canManage: summary.canManage,
  }
}

export function mapDecisionResults(
  detail: BackendDecisionDetail,
  results: BackendAggregateResults,
): DecisionResults {
  const useBorda = detail.responseType === "ranked_choice" && detail.outcomeRule === "borda"
  const metricTotal = results.optionResults.reduce(
    (sum, option) => sum + (useBorda ? option.score : option.count),
    0,
  )
  const tally = detail.responseType === "input_only"
    ? [{
        id: "written-response",
        label: "Written response",
        count: results.responseCount,
        percentage: results.responseCount === 0 ? 0 : 100,
      }]
    : results.optionResults.map((option) => {
        const value = useBorda ? option.score : option.count
        const detailOption = detail.options.find((item) => item._id === option.optionId)
        return {
          id: option.optionId,
          label: detailOption?.isOther ? "Proposed something else" : option.label,
          count: value,
          percentage: metricTotal === 0 ? 0 : Math.round((value / metricTotal) * 100),
        }
      })

  return {
    eligibleCount: results.eligibleCount,
    responseCount: results.responseCount,
    turnoutPercentage: results.eligibleCount === 0
      ? 0
      : Math.round((results.responseCount / results.eligibleCount) * 100),
    tally,
    tallyUnit: useBorda ? "points" : "responses",
    missingMemberIds: results.missing?.map((member) => member.memberId) ?? [],
  }
}

function answerFromBackend(
  detail: BackendDecisionDetail,
  response: Pick<BackendOwnResponse, "selections" | "otherText" | "responseText">,
): BallotAnswer {
  if (detail.responseType === "input_only") {
    return { type: "input", text: response.responseText ?? "" }
  }
  if (detail.responseType === "ranked_choice") {
    return {
      type: "ranked",
      ranking: [...response.selections]
        .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
        .map((selection) => selection.optionId),
    }
  }

  const selected = detail.options.find(
    (option) => option._id === response.selections[0]?.optionId,
  )
  if (detail.responseType === "yes_no_other") {
    const choice = selected?.key === "yes" || selected?.key === "no"
      ? selected.key
      : "other"
    return {
      type: "binary",
      choice,
      otherText: choice === "other" ? response.otherText ?? "" : undefined,
    }
  }
  return selected?.isOther
    ? { type: "single", otherText: response.otherText ?? "" }
    : { type: "single", optionId: selected?._id }
}

export function mapOwnResponse(
  detail: BackendDecisionDetail,
  viewerMemberId: string,
): DecisionResponse | undefined {
  if (!detail.myResponse) return undefined
  return {
    id: `response-${detail._id}-${viewerMemberId}`,
    decisionId: detail._id,
    memberId: viewerMemberId,
    answer: answerFromBackend(detail, detail.myResponse),
    rationale: detail.myResponse.reasoning ?? undefined,
    submittedAt: iso(detail.myResponse.submittedAt)!,
    revisedAt: iso(detail.myResponse.updatedAt),
    confirmedRevision: detail.myResponse.decisionRevision
      ?? (detail.myResponse.isCurrent === false ? Math.max(detail.revision - 1, 0) : detail.revision),
  }
}

export function mapIndividualResponses(
  detail: BackendDecisionDetail,
  results: BackendAggregateResults | undefined,
): DecisionResponse[] {
  return results?.individualResponses?.map((response) => ({
    id: `response-${detail._id}-${response.memberId}`,
    decisionId: detail._id,
    memberId: response.memberId,
    answer: answerFromBackend(detail, response),
    rationale: response.reasoning ?? undefined,
    submittedAt: iso(response.updatedAt)!,
    revisedAt: iso(response.updatedAt),
    confirmedRevision: detail.revision,
  })) ?? []
}

export function mapDecisionDetail(
  detail: BackendDecisionDetail,
  summary: BackendDecisionSummary | undefined,
  results: BackendAggregateResults | undefined,
  viewerMemberId: string,
): DecisionRecord {
  const options = detail.options.map(optionFromBackend)
  const finalizedOption = options.find((option) => option.id === detail.finalizedOptionId)
  const resultSummary = results ? mapDecisionResults(detail, results) : undefined
  return {
    id: detail._id,
    slug: detail.slug,
    title: detail.title,
    overview: detail.summary,
    contextPoints: detail.contextItems.length > 0
      ? detail.contextItems
      : detail.context.split("\n").map((item) => item.trim()).filter(Boolean),
    status: detail.status,
    ballotType: responseTypeMap[detail.responseType],
    options,
    allowOther: options.some((option) => option.isOther),
    electorateMemberIds: detail.isEligible ? [viewerMemberId] : [],
    creatorMemberId: detail.createdByMemberId,
    createdAt: iso(detail.createdAt)!,
    updatedAt: iso(detail.updatedAt)!,
    deadline: iso(detail.deadlineAt),
    timezone: detail.timezone,
    autoClose: detail.autoClose,
    revision: detail.revision,
    rules: {
      minimumTurnout: detail.minimumTurnout,
      approvalThreshold: detail.approvalThresholdPercent,
      outcomeRule: detail.outcomeRule === "approval_threshold"
        ? "approval-threshold"
        : detail.outcomeRule,
      tieRule: tieRuleMap[detail.tieBreakRule],
      resultsVisibility: resultsVisibilityMap[detail.resultsVisibility],
      allowResponseEdits: detail.allowResponseEdits,
    },
    outcome: detail.finalOutcomeText ?? finalizedOption?.label,
    eligibleCount: detail.eligibleCount,
    responseCount: results?.responseCount ?? summary?.responseCount ?? detail.responseCount,
    isEligible: detail.isEligible,
    canManage: detail.canManage,
    resultSummary,
  }
}

export function mapMembers(
  eligible: BackendEligibleMember[],
  adminMembers?: BackendAdminMember[],
): DecisionMember[] {
  if (adminMembers) {
    return adminMembers.map((member) => ({
      id: member._id,
      displayName: member.displayName,
      role: member.role,
      identityAliases: member.identities
        .filter((identity) => identity.status !== "disabled")
        .map((identity) => identity.normalizedEmail),
      active: member.status === "active",
    }))
  }
  return eligible.map((member) => ({
    id: member.memberId,
    displayName: member.displayName,
    role: member.role,
    identityAliases: [],
    active: true,
  }))
}

export function mapAgentKeys(keys: BackendAgentKey[]): AgentKeyRecord[] {
  return keys.map((key) => ({
    id: key.agentKeyId,
    name: key.name,
    prefix: key.prefix,
    scopes: key.scopes,
    createdAt: iso(key.createdAt)!,
    lastUsedAt: iso(key.lastUsedAt ?? undefined),
    expiresAt: iso(key.expiresAt ?? undefined),
    revokedAt: key.status === "revoked" ? iso(key.revokedAt ?? key.createdAt) : undefined,
  }))
}

function optionKey(label: string, index: number): string {
  return label
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/(^_|_$)/g, "")
    .slice(0, 60) || `option_${index + 1}`
}

export function decisionInputForBackend(input: CreateDecisionInput) {
  const regularOptions = input.options.map((option, index) => ({
    key: optionKey(option.label, index),
    label: option.label,
    description: option.description,
    isOther: false,
  }))
  const options = input.ballotType === "binary"
    ? [
        { key: "yes", label: "Yes", isOther: false },
        { key: "no", label: "No", isOther: false },
        ...(input.allowOther
          ? [{ key: "other", label: "Propose something else", isOther: true }]
          : []),
      ]
    : input.ballotType === "single"
      ? [
          ...regularOptions,
          ...(input.allowOther
            ? [{ key: "other", label: "Propose something else", isOther: true }]
            : []),
        ]
      : input.ballotType === "ranked"
        ? regularOptions
        : undefined

  return {
    title: input.title,
    summary: input.overview.slice(0, 500),
    context: [input.overview, ...input.contextPoints].join("\n\n"),
    contextItems: input.contextPoints,
    responseType: backendResponseTypeMap[input.ballotType],
    options,
    electorateMemberIds: input.electorateMemberIds,
    deadlineAt: input.deadline ? new Date(input.deadline).getTime() : undefined,
    timezone: input.timezone,
    autoClose: input.autoClose,
    allowResponseEdits: input.rules.allowResponseEdits,
    resultsVisibility: backendResultsVisibilityMap[input.rules.resultsVisibility],
    responsePrivacy: "admins_can_view_individual" as const,
    minimumTurnout: input.rules.minimumTurnout,
    outcomeRule: input.rules.outcomeRule === "approval-threshold"
      ? "approval_threshold" as const
      : input.rules.outcomeRule,
    approvalThresholdPercent: input.rules.approvalThreshold,
    approvalOptionKey: input.rules.outcomeRule === "approval-threshold" ? "yes" : undefined,
    tieBreakRule: backendTieRuleMap[input.rules.tieRule],
  }
}

export function ballotInputForBackend(
  decision: DecisionRecord,
  answer: BallotAnswer,
  rationale?: string,
) {
  if (answer.type === "input") {
    return {
      selections: [],
      responseText: answer.text,
      reasoning: rationale?.trim() || undefined,
    }
  }
  if (answer.type === "ranked") {
    return {
      selections: answer.ranking.map((optionId, index) => ({ optionId, rank: index + 1 })),
      reasoning: rationale?.trim() || undefined,
    }
  }
  if (answer.type === "binary") {
    const option = decision.options.find((item) => item.key === answer.choice)
    if (!option) throw new Error("That response option is no longer available.")
    return {
      selections: [{ optionId: option.id }],
      otherText: answer.choice === "other" ? answer.otherText?.trim() : undefined,
      reasoning: rationale?.trim() || undefined,
    }
  }
  const option = answer.optionId
    ? decision.options.find((item) => item.id === answer.optionId)
    : decision.options.find((item) => item.isOther)
  if (!option) throw new Error("That response option is no longer available.")
  return {
    selections: [{ optionId: option.id }],
    otherText: option.isOther ? answer.otherText?.trim() : undefined,
    reasoning: rationale?.trim() || undefined,
  }
}
