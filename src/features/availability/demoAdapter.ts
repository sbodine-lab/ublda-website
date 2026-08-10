import type {
  AvailabilityAdapter,
  AvailabilityPollDetail,
  AvailabilityPollSummary,
  AvailabilitySnapshot,
  CreateAvailabilityPollInput,
} from "./types"

const dateKeys = ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"]
const slots = (date: string, start: number, end: number) => {
  const values: string[] = []
  for (let minute = start; minute < end; minute += 15) values.push(`${date}@${minute}`)
  return values
}

function demoResults() {
  const responses = [
    [...slots(dateKeys[1], 18 * 60, 20 * 60), ...slots(dateKeys[2], 19 * 60, 21 * 60)],
    [...slots(dateKeys[1], 17 * 60 + 30, 19 * 60 + 30), ...slots(dateKeys[3], 17 * 60, 19 * 60)],
    [...slots(dateKeys[1], 18 * 60, 20 * 60), ...slots(dateKeys[2], 18 * 60 + 30, 20 * 60)],
    [...slots(dateKeys[0], 17 * 60, 18 * 60 + 30), ...slots(dateKeys[1], 18 * 60, 19 * 60)],
    [...slots(dateKeys[1], 18 * 60, 19 * 60 + 30), ...slots(dateKeys[3], 17 * 60 + 30, 19 * 60)],
    [...slots(dateKeys[1], 18 * 60, 20 * 60), ...slots(dateKeys[2], 19 * 60, 20 * 60)],
    [...slots(dateKeys[1], 18 * 60, 19 * 60 + 30), ...slots(dateKeys[2], 19 * 60, 20 * 60 + 30)],
    [...slots(dateKeys[1], 18 * 60, 20 * 60), ...slots(dateKeys[3], 17 * 60, 18 * 60 + 30)],
  ]
  const cellCounts: Record<string, number> = {}
  for (const date of dateKeys) {
    for (let minute = 17 * 60; minute < 21 * 60; minute += 15) {
      const key = `${date}@${minute}`
      cellCounts[key] = responses.filter((response) => response.includes(key)).length
    }
  }
  const candidates = [
    { dateKey: dateKeys[1], startMinutes: 18 * 60, endMinutes: 18 * 60 + 45, availableCount: 8 },
    { dateKey: dateKeys[2], startMinutes: 19 * 60, endMinutes: 19 * 60 + 45, availableCount: 7 },
    { dateKey: dateKeys[3], startMinutes: 17 * 60 + 30, endMinutes: 18 * 60 + 15, availableCount: 7 },
  ]
  return {
    eligibleCount: 9,
    responseCount: 8,
    cellCounts,
    candidates,
    missing: [{ memberId: "member-9", displayName: "Alexa" }],
  }
}

let activePoll: AvailabilityPollDetail = {
  id: "availability-fall-kickoff",
  slug: "s_preview_fall_kickoff",
  title: "fall kickoff",
  note: "find 45 minutes for the full board.",
  status: "open",
  durationMinutes: 45,
  dateKeys,
  startMinutes: 17 * 60,
  endMinutes: 21 * 60,
  slotMinutes: 15,
  timezone: "America/Detroit",
  deadline: "2026-08-16T20:00:00.000-04:00",
  eligibleCount: 9,
  responseCount: 8,
  hasResponded: true,
  canManage: true,
  isEligible: true,
  resultsVisibility: "after-submit",
  mySlotKeys: [...slots(dateKeys[0], 17 * 60, 18 * 60), ...slots(dateKeys[2], 19 * 60, 20 * 60 + 30)],
  results: demoResults(),
  updatedAt: "2026-08-10T03:00:00.000Z",
}

let polls: AvailabilityPollSummary[] = [
  activePoll,
  {
    id: "availability-weekly",
    slug: "s_preview_weekly",
    title: "weekly e-board meeting",
    note: "",
    status: "open",
    durationMinutes: 60,
    timezone: "America/Detroit",
    deadline: "2026-08-23T20:00:00.000-04:00",
    eligibleCount: 9,
    responseCount: 6,
    hasResponded: false,
    canManage: true,
    updatedAt: "2026-08-09T03:00:00.000Z",
  },
]
let snapshot: AvailabilitySnapshot = { polls, activePoll, loading: false }
const listeners = new Set<() => void>()
const emit = () => {
  snapshot = { polls: [...polls], activePoll: { ...activePoll }, loading: false }
  listeners.forEach((listener) => listener())
}

export const demoAvailabilityAdapter: AvailabilityAdapter = {
  mode: "demo",
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot: () => snapshot,
  async createPoll(input: CreateAvailabilityPollInput) {
    const id = `availability-${Date.now()}`
    const slug = `s_preview_${Date.now()}`
    activePoll = {
      id,
      slug,
      title: input.title,
      note: input.note ?? "",
      status: "open",
      durationMinutes: input.durationMinutes,
      dateKeys: input.dateKeys,
      startMinutes: input.startMinutes,
      endMinutes: input.endMinutes,
      slotMinutes: 15,
      timezone: input.timezone,
      deadline: input.deadline,
      eligibleCount: input.electorateMemberIds.length,
      responseCount: 0,
      hasResponded: false,
      canManage: true,
      isEligible: true,
      resultsVisibility: input.resultsVisibility,
      mySlotKeys: [],
      results: {
        eligibleCount: input.electorateMemberIds.length,
        responseCount: 0,
        cellCounts: {},
        candidates: [],
        missing: [],
      },
      updatedAt: new Date().toISOString(),
    }
    polls = [activePoll, ...polls]
    emit()
    return { id, slug }
  },
  async saveResponse(pollId, slotKeys) {
    if (activePoll.id !== pollId) throw new Error("Scheduling poll not found.")
    activePoll = {
      ...activePoll,
      mySlotKeys: [...slotKeys],
      hasResponded: true,
      responseCount: Math.max(activePoll.responseCount, 1),
      updatedAt: new Date().toISOString(),
    }
    polls = polls.map((poll) => poll.id === pollId ? activePoll : poll)
    emit()
  },
  async finalizePoll(pollId, dateKey, startMinutes) {
    if (activePoll.id !== pollId) throw new Error("Scheduling poll not found.")
    activePoll = {
      ...activePoll,
      status: "finalized",
      finalizedDateKey: dateKey,
      finalizedStartMinutes: startMinutes,
      updatedAt: new Date().toISOString(),
    }
    polls = polls.map((poll) => poll.id === pollId ? activePoll : poll)
    emit()
  },
}
