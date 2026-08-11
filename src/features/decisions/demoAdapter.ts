import type {
  AgentKeyRecord,
  CreateAgentKeyInput,
  CreatedAgentKey,
  DecisionActivity,
  DecisionCenterAdapter,
  DecisionCenterSnapshot,
  DecisionMember,
  DecisionRecord,
  DecisionResponse,
  UpsertMemberInput,
} from "./types"

const isoNow = () => new Date().toISOString()

const uid = (prefix: string) => {
  const value = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}_${value}`
}

const demoMembers: DecisionMember[] = [
  {
    id: "member-preview-admin",
    displayName: "Preview Admin",
    role: "admin",
    identityAliases: ["preview.admin@example.invalid"],
    active: true,
  },
  {
    id: "member-community",
    displayName: "Community Lead",
    role: "member",
    identityAliases: ["community.lead@example.invalid"],
    active: true,
  },
  {
    id: "member-events",
    displayName: "Events Lead",
    role: "member",
    identityAliases: ["events.lead@example.invalid"],
    active: true,
  },
  {
    id: "member-finance",
    displayName: "Finance Lead",
    role: "member",
    identityAliases: ["finance.lead@example.invalid"],
    active: true,
  },
  {
    id: "member-partnerships",
    displayName: "Partnerships Lead",
    role: "member",
    identityAliases: ["partnerships.lead@example.invalid"],
    active: true,
  },
  {
    id: "member-communications",
    displayName: "Communications Lead",
    role: "member",
    identityAliases: ["communications.lead@example.invalid"],
    active: true,
  },
  {
    id: "member-operations",
    displayName: "Operations Lead",
    role: "member",
    identityAliases: ["operations.lead@example.invalid"],
    active: true,
  },
  {
    id: "member-programming",
    displayName: "Programming Lead",
    role: "member",
    identityAliases: ["programming.lead@example.invalid"],
    active: true,
  },
  {
    id: "member-membership",
    displayName: "Membership Lead",
    role: "member",
    identityAliases: ["membership.lead@example.invalid"],
    active: true,
  },
]

const demoElectorate = demoMembers.map((member) => member.id)
const demoCreatedAt = "2026-08-08T14:30:00.000Z"

const demoDecisions: DecisionRecord[] = [
  {
    id: "decision-weekly-format",
    slug: "v_8f3b92d1c4a74eb5a61f0d27",
    title: "Should we change the weekly meeting format?",
    overview: "Decide whether the next four meetings should use a shorter agenda and move project updates into async notes.",
    contextPoints: [
      "The proposed format keeps a 30-minute decision block.",
      "Project owners would post updates before the meeting.",
      "We would review the format again after four meetings.",
    ],
    status: "open",
    ballotType: "binary",
    options: [],
    allowOther: true,
    electorateMemberIds: demoElectorate,
    creatorMemberId: "member-preview-admin",
    createdAt: demoCreatedAt,
    updatedAt: demoCreatedAt,
    deadline: "2026-08-14T21:00:00.000Z",
    timezone: "America/Detroit",
    autoClose: false,
    revision: 1,
    rules: {
      minimumTurnout: 5,
      approvalThreshold: 60,
      outcomeRule: "approval-threshold",
      tieRule: "manual",
      resultsVisibility: "after-submit",
      allowResponseEdits: true,
    },
  },
  {
    id: "decision-fall-focus",
    slug: "v_52a9ce03e6f847178b14d2c0",
    title: "Choose the fall programming focus",
    overview: "Pick the primary theme that should guide the first month of programming.",
    contextPoints: ["This is a draft. Options can still change before anyone responds."],
    status: "draft",
    ballotType: "single",
    options: [
      { id: "option-careers", label: "Career readiness" },
      { id: "option-community", label: "Community building" },
      { id: "option-workshops", label: "Practical workshops" },
    ],
    allowOther: true,
    electorateMemberIds: demoElectorate,
    creatorMemberId: "member-preview-admin",
    createdAt: "2026-08-07T16:00:00.000Z",
    updatedAt: "2026-08-07T16:00:00.000Z",
    timezone: "America/Detroit",
    autoClose: false,
    revision: 1,
    rules: {
      outcomeRule: "advisory",
      tieRule: "manual",
      resultsVisibility: "after-close",
      allowResponseEdits: true,
    },
  },
  {
    id: "decision-retro-location",
    slug: "v_b9071df54e2a4c96a8137f40",
    title: "Rank the workshop location options",
    overview: "This closed preview demonstrates exact turnout and ranked first-choice results.",
    contextPoints: ["Final selection remains a manual board decision."],
    status: "closed",
    ballotType: "ranked",
    options: [
      { id: "option-campus", label: "Campus room" },
      { id: "option-library", label: "Public library" },
      { id: "option-partner", label: "Partner office" },
    ],
    allowOther: false,
    electorateMemberIds: demoElectorate,
    creatorMemberId: "member-preview-admin",
    createdAt: "2026-07-24T13:00:00.000Z",
    updatedAt: "2026-07-28T20:00:00.000Z",
    deadline: "2026-07-28T20:00:00.000Z",
    timezone: "America/Detroit",
    autoClose: false,
    revision: 1,
    rules: {
      minimumTurnout: 5,
      outcomeRule: "advisory",
      tieRule: "manual",
      resultsVisibility: "after-close",
      allowResponseEdits: true,
    },
  },
]

const demoResponses: DecisionResponse[] = [
  {
    id: "response-community-open",
    decisionId: "decision-weekly-format",
    memberId: "member-community",
    answer: { type: "binary", choice: "yes" },
    rationale: "The trial period makes this easy to revisit.",
    submittedAt: "2026-08-08T17:20:00.000Z",
    confirmedRevision: 1,
  },
  {
    id: "response-events-open",
    decisionId: "decision-weekly-format",
    memberId: "member-events",
    answer: { type: "binary", choice: "other", otherText: "Try it for two meetings first." },
    rationale: "A shorter trial would give us enough signal.",
    submittedAt: "2026-08-09T13:10:00.000Z",
    confirmedRevision: 1,
  },
  {
    id: "response-finance-open",
    decisionId: "decision-weekly-format",
    memberId: "member-finance",
    answer: { type: "binary", choice: "yes" },
    submittedAt: "2026-08-09T15:35:00.000Z",
    confirmedRevision: 1,
  },
  {
    id: "response-preview-ranked",
    decisionId: "decision-retro-location",
    memberId: "member-preview-admin",
    answer: { type: "ranked", ranking: ["option-campus", "option-library", "option-partner"] },
    rationale: "The campus room removes travel friction.",
    submittedAt: "2026-07-25T18:00:00.000Z",
    confirmedRevision: 1,
  },
  {
    id: "response-community-ranked",
    decisionId: "decision-retro-location",
    memberId: "member-community",
    answer: { type: "ranked", ranking: ["option-library", "option-campus", "option-partner"] },
    submittedAt: "2026-07-25T19:30:00.000Z",
    confirmedRevision: 1,
  },
  {
    id: "response-events-ranked",
    decisionId: "decision-retro-location",
    memberId: "member-events",
    answer: { type: "ranked", ranking: ["option-campus", "option-partner", "option-library"] },
    submittedAt: "2026-07-26T15:00:00.000Z",
    confirmedRevision: 1,
  },
  {
    id: "response-finance-ranked",
    decisionId: "decision-retro-location",
    memberId: "member-finance",
    answer: { type: "ranked", ranking: ["option-partner", "option-campus", "option-library"] },
    submittedAt: "2026-07-26T21:05:00.000Z",
    confirmedRevision: 1,
  },
  {
    id: "response-partnerships-ranked",
    decisionId: "decision-retro-location",
    memberId: "member-partnerships",
    answer: { type: "ranked", ranking: ["option-campus", "option-partner", "option-library"] },
    submittedAt: "2026-07-27T16:40:00.000Z",
    confirmedRevision: 1,
  },
]

const demoActivity: DecisionActivity[] = [
  {
    id: "activity-created-open",
    decisionId: "decision-weekly-format",
    actorMemberId: "member-preview-admin",
    type: "created",
    at: demoCreatedAt,
    detail: "Created the decision.",
  },
  {
    id: "activity-published-open",
    decisionId: "decision-weekly-format",
    actorMemberId: "member-preview-admin",
    type: "published",
    at: demoCreatedAt,
    detail: "Opened voting with seven eligible members.",
  },
  {
    id: "activity-closed-ranked",
    decisionId: "decision-retro-location",
    actorMemberId: "member-preview-admin",
    type: "closed",
    at: "2026-07-28T20:00:00.000Z",
    detail: "Closed responses manually.",
  },
]

function initialSnapshot(): DecisionCenterSnapshot {
  return {
    auth: { status: "signed-out" },
    decisions: structuredClone(demoDecisions),
    members: structuredClone(demoMembers),
    responses: structuredClone(demoResponses),
    activity: structuredClone(demoActivity),
    agentKeys: [],
  }
}

function createActivity(
  actorMemberId: string,
  type: DecisionActivity["type"],
  detail: string,
  decisionId?: string,
): DecisionActivity {
  return { id: uid("activity"), actorMemberId, type, detail, decisionId, at: isoNow() }
}

export function createDemoDecisionAdapter(): DecisionCenterAdapter {
  let snapshot = initialSnapshot()
  const listeners = new Set<() => void>()

  const update = (next: DecisionCenterSnapshot) => {
    snapshot = next
    listeners.forEach((listener) => listener())
  }

  const viewerId = () => {
    if (snapshot.auth.status !== "signed-in") throw new Error("Sign in is required.")
    return snapshot.auth.viewer.memberId
  }

  return {
    mode: "demo",
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot() {
      return snapshot
    },
    async signInWithGoogle() {
      update({
        ...snapshot,
        auth: {
          status: "signed-in",
          viewer: { memberId: "member-preview-admin", displayName: "Preview Admin", role: "admin" },
        },
      })
    },
    async signInWithEmailCode() {
      return undefined
    },
    async signIn() {
      update({
        ...snapshot,
        auth: {
          status: "signed-in",
          viewer: { memberId: "member-preview-admin", displayName: "Preview Admin", role: "admin" },
        },
      })
      return { status: "complete" }
    },
    async verifySignInCode() {
      return undefined
    },
    async signOut() {
      update({ ...snapshot, auth: { status: "signed-out" } })
    },
    async submitResponse(decisionId, answer, rationale) {
      const memberId = viewerId()
      const decision = snapshot.decisions.find((item) => item.id === decisionId)
      if (!decision) throw new Error("Decision not found.")
      if (decision.status !== "open") throw new Error("This decision is not accepting responses.")
      if (!decision.electorateMemberIds.includes(memberId)) throw new Error("You are not eligible for this decision.")

      const existing = snapshot.responses.find(
        (response) => response.decisionId === decisionId && response.memberId === memberId,
      )
      const timestamp = isoNow()
      const response: DecisionResponse = existing
        ? {
            ...existing,
            answer,
            rationale: rationale?.trim() || undefined,
            revisedAt: timestamp,
            confirmedRevision: decision.revision,
          }
        : {
            id: uid("response"),
            decisionId,
            memberId,
            answer,
            rationale: rationale?.trim() || undefined,
            submittedAt: timestamp,
            confirmedRevision: decision.revision,
          }

      update({
        ...snapshot,
        responses: existing
          ? snapshot.responses.map((item) => item.id === existing.id ? response : item)
          : [...snapshot.responses, response],
        activity: [
          ...snapshot.activity,
          createActivity(
            memberId,
            existing ? "updated-response" : "responded",
            existing ? "Updated their response." : "Submitted a response.",
            decisionId,
          ),
        ],
      })
      return response
    },
    async createDecision(input) {
      const memberId = viewerId()
      const createdAt = isoNow()
      const existingSlugs = new Set(snapshot.decisions.map((decision) => decision.slug))
      let slug = uid("v")
      while (existingSlugs.has(slug)) {
        slug = uid("v")
      }
      const decisionId = uid("decision")
      const decision: DecisionRecord = {
        id: decisionId,
        slug,
        title: input.title.trim(),
        overview: input.overview.trim(),
        contextPoints: input.contextPoints.map((point) => point.trim()).filter(Boolean),
        status: input.status,
        ballotType: input.ballotType,
        options: input.options.map((option) => ({ ...option, id: uid("option") })),
        allowOther: input.allowOther,
        electorateMemberIds: [...input.electorateMemberIds],
        creatorMemberId: memberId,
        createdAt,
        updatedAt: createdAt,
        deadline: input.deadline,
        timezone: input.timezone,
        autoClose: input.autoClose,
        revision: 1,
        rules: { ...input.rules },
      }
      update({
        ...snapshot,
        decisions: [decision, ...snapshot.decisions],
        activity: [
          ...snapshot.activity,
          createActivity(memberId, "created", "Created the decision.", decisionId),
          ...(input.status === "open"
            ? [createActivity(memberId, "published", "Opened the decision for responses.", decisionId)]
            : []),
        ],
      })
      return decision
    },
    async closeDecision(decisionId) {
      const memberId = viewerId()
      update({
        ...snapshot,
        decisions: snapshot.decisions.map((decision) => decision.id === decisionId
          ? { ...decision, status: "closed", updatedAt: isoNow() }
          : decision),
        activity: [...snapshot.activity, createActivity(memberId, "closed", "Closed responses manually.", decisionId)],
      })
    },
    async reopenDecision(decisionId) {
      const memberId = viewerId()
      update({
        ...snapshot,
        decisions: snapshot.decisions.map((decision) => decision.id === decisionId
          ? { ...decision, status: "open", updatedAt: isoNow() }
          : decision),
        activity: [...snapshot.activity, createActivity(memberId, "reopened", "Reopened responses manually.", decisionId)],
      })
    },
    async finalizeDecision(decisionId, outcome, note) {
      const memberId = viewerId()
      update({
        ...snapshot,
        decisions: snapshot.decisions.map((decision) => decision.id === decisionId
          ? { ...decision, status: "finalized", outcome: outcome.trim(), updatedAt: isoNow() }
          : decision),
        activity: [
          ...snapshot.activity,
          createActivity(
            memberId,
            "finalized",
            `Recorded outcome: ${outcome.trim()}${note?.trim() ? ` (${note.trim()})` : ""}`,
            decisionId,
          ),
        ],
      })
    },
    async upsertMember(input: UpsertMemberInput) {
      const actorMemberId = viewerId()
      const existing = input.id ? snapshot.members.find((member) => member.id === input.id) : undefined
      const member: DecisionMember = {
        id: existing?.id ?? uid("member"),
        displayName: input.displayName.trim(),
        role: input.role,
        identityAliases: input.identityAliases.map((alias) => alias.trim().toLowerCase()).filter(Boolean),
        active: input.active,
      }
      update({
        ...snapshot,
        members: existing
          ? snapshot.members.map((item) => item.id === existing.id ? member : item)
          : [...snapshot.members, member],
        activity: existing
          ? snapshot.activity
          : [...snapshot.activity, createActivity(actorMemberId, "member-added", `Added ${member.displayName} to the roster.`)],
      })
      return member
    },
    async createAgentKey(input: CreateAgentKeyInput): Promise<CreatedAgentKey> {
      const actorMemberId = viewerId()
      const id = uid("agent-key")
      const suffix = Math.random().toString(36).slice(2, 10)
      const secret = `ublda_demo_${suffix}_${Math.random().toString(36).slice(2, 26)}`
      const record: AgentKeyRecord = {
        id,
        name: input.name.trim(),
        prefix: `ublda_demo_${suffix}`,
        scopes: [...input.scopes],
        createdAt: isoNow(),
        expiresAt: input.expiresAt,
      }
      update({
        ...snapshot,
        agentKeys: [record, ...snapshot.agentKeys],
        activity: [...snapshot.activity, createActivity(actorMemberId, "agent-key-created", `Created agent key “${record.name}”.`)],
      })
      return { record, secret }
    },
    async revokeAgentKey(agentKeyId) {
      const actorMemberId = viewerId()
      const target = snapshot.agentKeys.find((key) => key.id === agentKeyId)
      update({
        ...snapshot,
        agentKeys: snapshot.agentKeys.map((key) => key.id === agentKeyId
          ? { ...key, revokedAt: isoNow() }
          : key),
        activity: [
          ...snapshot.activity,
          createActivity(actorMemberId, "agent-key-revoked", `Revoked agent key “${target?.name ?? "Unknown"}”.`),
        ],
      })
    },
  }
}

export function createUnavailableLiveDecisionAdapter(message: string): DecisionCenterAdapter {
  const snapshot: DecisionCenterSnapshot = {
    auth: { status: "misconfigured", message },
    decisions: [],
    members: [],
    responses: [],
    activity: [],
    agentKeys: [],
  }
  const unavailable = async (): Promise<never> => {
    throw new Error(message)
  }
  return {
    mode: "live",
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
    signInWithGoogle: unavailable,
    signInWithEmailCode: unavailable,
    signIn: unavailable,
    verifySignInCode: unavailable,
    signOut: unavailable,
    submitResponse: unavailable,
    createDecision: unavailable,
    closeDecision: unavailable,
    reopenDecision: unavailable,
    finalizeDecision: unavailable,
    upsertMember: unavailable,
    createAgentKey: unavailable,
    revokeAgentKey: unavailable,
  }
}

export const demoDecisionAdapter = createDemoDecisionAdapter()
