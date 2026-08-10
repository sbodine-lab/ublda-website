import assert from "node:assert/strict"
import { test } from "node:test"
import {
  ballotInputForBackend,
  decisionInputForBackend,
  mapDecisionResults,
  mapOwnResponse,
  type BackendDecisionDetail,
} from "../src/features/decisions/liveContracts.ts"
import { createLiveDecisionAdapter } from "../src/features/decisions/liveAdapter.ts"
import type {
  CreateDecisionInput,
  DecisionCenterSnapshot,
  DecisionRecord,
} from "../src/features/decisions/types.ts"

const baseCreateInput = (): CreateDecisionInput => ({
  title: "Should we trial the shorter format?",
  overview: "Choose whether to run a four-week trial.",
  contextPoints: ["Keep a decision block.", "Review after four weeks."],
  ballotType: "binary",
  options: [],
  allowOther: false,
  electorateMemberIds: ["member-a", "member-b"],
  deadline: "2026-08-15T01:00:00.000Z",
  timezone: "America/Detroit",
  autoClose: false,
  rules: {
    minimumTurnout: 2,
    approvalThreshold: 60,
    outcomeRule: "approval-threshold",
    tieRule: "manual",
    resultsVisibility: "after-close",
    allowResponseEdits: true,
  },
  status: "open",
})

const baseDetail = (): BackendDecisionDetail => ({
  _id: "decision-a",
  slug: "shorter-format",
  title: "Shorter format",
  summary: "Choose a meeting format.",
  context: "Full context",
  contextItems: ["One saved fact"],
  responseType: "yes_no_other",
  status: "closed",
  revision: 3,
  createdByMemberId: "member-a",
  createdAt: Date.parse("2026-08-01T12:00:00.000Z"),
  updatedAt: Date.parse("2026-08-09T12:00:00.000Z"),
  timezone: "America/Detroit",
  autoClose: false,
  allowResponseEdits: true,
  resultsVisibility: "after_close",
  minimumTurnout: 2,
  outcomeRule: "approval_threshold",
  approvalThresholdPercent: 60,
  tieBreakRule: "manual",
  options: [
    { _id: "option-yes", key: "yes", label: "Yes", isOther: false },
    { _id: "option-no", key: "no", label: "No", isOther: false },
    { _id: "option-other", key: "other", label: "Propose something else", isOther: true },
  ],
  eligibleCount: 3,
  isEligible: true,
  canManage: false,
  myResponse: null,
  needsReconfirmation: false,
})

test("binary live drafts preserve explicit rules and make Other opt-in", () => {
  const input = baseCreateInput()
  const withoutOther = decisionInputForBackend(input)
  assert.deepEqual(withoutOther.options?.map((option) => option.key), ["yes", "no"])
  assert.equal(withoutOther.approvalThresholdPercent, 60)
  assert.equal(withoutOther.approvalOptionKey, "yes")
  assert.equal(withoutOther.minimumTurnout, 2)
  assert.equal(withoutOther.resultsVisibility, "after_close")
  assert.equal(withoutOther.deadlineAt, Date.parse(input.deadline!))
  assert.equal(withoutOther.autoClose, false)

  const withOther = decisionInputForBackend({ ...input, allowOther: true })
  assert.deepEqual(withOther.options?.map((option) => option.key), ["yes", "no", "other"])
  assert.equal(withOther.options?.at(-1)?.isOther, true)
})

test("single-choice Other and long context map without exceeding summary limits", () => {
  const overview = "x".repeat(700)
  const mapped = decisionInputForBackend({
    ...baseCreateInput(),
    ballotType: "single",
    overview,
    options: [{ label: "Option A" }, { label: "Option B" }],
    allowOther: true,
    rules: { ...baseCreateInput().rules, outcomeRule: "plurality", approvalThreshold: undefined },
  })
  assert.equal(mapped.summary.length, 500)
  assert.match(mapped.context, /^x{700}/)
  assert.deepEqual(mapped.options?.map((option) => option.key), ["option_a", "option_b", "other"])
})

test("ballot mapping requires a real Other option and preserves ranked order", () => {
  const detail = baseDetail()
  const decision: DecisionRecord = {
    id: detail._id,
    slug: detail.slug,
    title: detail.title,
    overview: detail.summary,
    contextPoints: [],
    status: "open",
    ballotType: "binary",
    options: detail.options.map((option) => ({
      id: option._id,
      key: option.key,
      label: option.label,
      isOther: option.isOther,
    })),
    allowOther: true,
    electorateMemberIds: ["member-a"],
    creatorMemberId: "member-a",
    createdAt: new Date(detail.createdAt).toISOString(),
    updatedAt: new Date(detail.updatedAt).toISOString(),
    timezone: detail.timezone,
    autoClose: false,
    revision: detail.revision,
    rules: {
      outcomeRule: "advisory",
      tieRule: "manual",
      resultsVisibility: "after-close",
      allowResponseEdits: true,
    },
  }
  assert.deepEqual(
    ballotInputForBackend(
      decision,
      { type: "binary", choice: "other", otherText: "Try it twice first." },
      "Lower-risk trial.",
    ),
    {
      selections: [{ optionId: "option-other" }],
      otherText: "Try it twice first.",
      reasoning: "Lower-risk trial.",
    },
  )
  assert.deepEqual(
    ballotInputForBackend(
      { ...decision, ballotType: "ranked" },
      { type: "ranked", ranking: ["option-no", "option-yes", "option-other"] },
    ).selections,
    [
      { optionId: "option-no", rank: 1 },
      { optionId: "option-yes", rank: 2 },
      { optionId: "option-other", rank: 3 },
    ],
  )
})

test("aggregate mapping contains counts but no voter identity or prose", () => {
  const mapped = mapDecisionResults(baseDetail(), {
    eligibleCount: 3,
    responseCount: 2,
    pendingCount: 1,
    optionResults: [
      { optionId: "option-yes", key: "yes", label: "Yes", count: 1, score: 0 },
      { optionId: "option-no", key: "no", label: "No", count: 0, score: 0 },
      { optionId: "option-other", key: "other", label: "Propose something else", count: 1, score: 0 },
    ],
    missing: null,
    individualResponses: null,
  })
  assert.equal(mapped.eligibleCount, 3)
  assert.equal(mapped.responseCount, 2)
  assert.equal(mapped.turnoutPercentage, 67)
  assert.deepEqual(mapped.missingMemberIds, [])
  assert.deepEqual(mapped.tally.map(({ label, count }) => ({ label, count })), [
    { label: "Yes", count: 1 },
    { label: "No", count: 0 },
    { label: "Proposed something else", count: 1 },
  ])
  assert.equal(JSON.stringify(mapped).includes("displayName"), false)
  assert.equal(JSON.stringify(mapped).includes("reasoning"), false)
})

test("a stale own response retains the prior revision for reconfirmation", () => {
  const detail = baseDetail()
  detail.myResponse = {
    selections: [{ optionId: "option-yes" }],
    otherText: null,
    responseText: null,
    reasoning: "Still my answer.",
    submittedAt: Date.parse("2026-08-04T12:00:00.000Z"),
    updatedAt: Date.parse("2026-08-04T12:00:00.000Z"),
    decisionRevision: 2,
    isCurrent: false,
  }
  const response = mapOwnResponse(detail, "member-b")
  assert.equal(response?.confirmedRevision, 2)
  assert.deepEqual(response?.answer, { type: "binary", choice: "yes", otherText: undefined })
  assert.equal(response?.rationale, "Still my answer.")
})

test("mutable live adapter publishes snapshots and delegates operations", async () => {
  const adapter = createLiveDecisionAdapter()
  let notified = 0
  adapter.subscribe(() => { notified += 1 })
  const snapshot: DecisionCenterSnapshot = {
    auth: { status: "signed-out" },
    decisions: [],
    members: [],
    responses: [],
    activity: [],
    agentKeys: [],
  }
  adapter.replaceSnapshot(snapshot)
  assert.equal(adapter.getSnapshot(), snapshot)
  assert.equal(notified, 1)

  let signedOut = false
  adapter.replaceOperations({
    async signIn() { return { status: "complete" } },
    async verifySignInCode() {},
    async signOut() { signedOut = true },
    async submitResponse() { throw new Error("unused") },
    async createDecision() { throw new Error("unused") },
    async closeDecision() {},
    async reopenDecision() {},
    async finalizeDecision() {},
    async upsertMember() { throw new Error("unused") },
    async createAgentKey() { throw new Error("unused") },
    async revokeAgentKey() {},
  })
  await adapter.signOut()
  assert.equal(signedOut, true)
})
