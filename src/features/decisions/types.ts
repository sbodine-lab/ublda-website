export type DecisionStatus = "draft" | "open" | "closed" | "finalized"

export type BallotType = "binary" | "single" | "ranked" | "input"

export type ResultsVisibility = "after-submit" | "after-close" | "admins-only"

export type TieRule = "manual" | "runoff" | "chair"

export type DecisionOutcomeRule =
  | "advisory"
  | "plurality"
  | "majority"
  | "approval-threshold"
  | "borda"

export type MemberRole = "admin" | "member"

export interface DecisionMember {
  id: string
  displayName: string
  role: MemberRole
  identityAliases: string[]
  active: boolean
}

export interface DecisionOption {
  id: string
  key?: string
  label: string
  description?: string
  isOther?: boolean
}

export interface DecisionRules {
  minimumTurnout?: number
  approvalThreshold?: number
  outcomeRule: DecisionOutcomeRule
  tieRule: TieRule
  resultsVisibility: ResultsVisibility
  allowResponseEdits: boolean
}

export interface DecisionRecord {
  id: string
  slug: string
  title: string
  overview: string
  contextPoints: string[]
  status: DecisionStatus
  ballotType: BallotType
  options: DecisionOption[]
  allowOther: boolean
  electorateMemberIds: string[]
  creatorMemberId: string
  createdAt: string
  updatedAt: string
  deadline?: string
  timezone: string
  autoClose: boolean
  revision: number
  rules: DecisionRules
  outcome?: string
  /** Privacy-safe aggregate counts supplied by the live backend. */
  eligibleCount?: number
  responseCount?: number
  /** Explicit viewer permissions. Never infer eligibility from management access. */
  isEligible?: boolean
  canManage?: boolean
  /** Present only when the backend's result-visibility policy allows it. */
  resultSummary?: DecisionResults
}

export type BallotAnswer =
  | { type: "binary"; choice?: "yes" | "no" | "other"; otherText?: string }
  | { type: "single"; optionId?: string; otherText?: string }
  | { type: "ranked"; ranking: string[] }
  | { type: "input"; text: string }

export interface DecisionResponse {
  id: string
  decisionId: string
  memberId: string
  answer: BallotAnswer
  rationale?: string
  submittedAt: string
  revisedAt?: string
  confirmedRevision: number
}

export interface DecisionActivity {
  id: string
  decisionId?: string
  actorMemberId: string
  type:
    | "created"
    | "published"
    | "responded"
    | "updated-response"
    | "closed"
    | "reopened"
    | "finalized"
    | "member-added"
    | "agent-key-created"
    | "agent-key-revoked"
  at: string
  detail: string
  actorDisplayName?: string
}

export type AgentScope =
  | "decisions:read"
  | "decisions:write"
  | "decisions:publish"
  | "decisions:manage"
  | "results:read"

export interface AgentKeyRecord {
  id: string
  name: string
  prefix: string
  scopes: AgentScope[]
  createdAt: string
  lastUsedAt?: string
  expiresAt?: string
  revokedAt?: string
}

export interface DecisionViewer {
  memberId: string
  displayName: string
  role: MemberRole
}

export type DecisionAuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "access-denied"; message: string }
  | { status: "misconfigured"; message: string }
  | { status: "signed-in"; viewer: DecisionViewer }

export interface CreateDecisionInput {
  title: string
  overview: string
  contextPoints: string[]
  ballotType: BallotType
  options: Array<Pick<DecisionOption, "label" | "description">>
  allowOther: boolean
  electorateMemberIds: string[]
  deadline?: string
  timezone: string
  autoClose: boolean
  rules: DecisionRules
  status: "draft" | "open"
}

export interface UpsertMemberInput {
  id?: string
  displayName: string
  role: MemberRole
  identityAliases: string[]
  active: boolean
}

export interface CreateAgentKeyInput {
  name: string
  scopes: AgentScope[]
  expiresAt?: string
}

export interface CreatedAgentKey {
  record: AgentKeyRecord
  secret: string
}

export interface DecisionCenterSnapshot {
  auth: DecisionAuthState
  decisions: DecisionRecord[]
  members: DecisionMember[]
  responses: DecisionResponse[]
  activity: DecisionActivity[]
  agentKeys: AgentKeyRecord[]
}

export interface DecisionCenterAdapter {
  readonly mode: "demo" | "live"
  subscribe(listener: () => void): () => void
  getSnapshot(): DecisionCenterSnapshot
  signIn(): Promise<void>
  signOut(): Promise<void>
  submitResponse(
    decisionId: string,
    answer: BallotAnswer,
    rationale?: string,
  ): Promise<DecisionResponse>
  createDecision(input: CreateDecisionInput): Promise<DecisionRecord>
  closeDecision(decisionId: string): Promise<void>
  reopenDecision(decisionId: string): Promise<void>
  finalizeDecision(decisionId: string, outcome: string, note?: string): Promise<void>
  upsertMember(input: UpsertMemberInput): Promise<DecisionMember>
  createAgentKey(input: CreateAgentKeyInput): Promise<CreatedAgentKey>
  revokeAgentKey(agentKeyId: string): Promise<void>
}

export interface DecisionTallyRow {
  id: string
  label: string
  count: number
  percentage: number
}

export interface DecisionResults {
  eligibleCount: number
  responseCount: number
  turnoutPercentage: number
  tally: DecisionTallyRow[]
  tallyUnit: "responses" | "points"
  missingMemberIds: string[]
}
