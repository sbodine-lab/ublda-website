import type {
  AvailabilityPollDetail,
  AvailabilityPollSummary,
  AvailabilityResults,
} from "./types"

export interface BackendAvailabilitySummary {
  pollId: string
  slug: string
  title: string
  note: string
  status: "open" | "finalized"
  durationMinutes: number
  timezone: string
  deadlineAt: number | null
  eligibleCount: number
  responseCount: number
  hasResponded: boolean
  canManage: boolean
  updatedAt: number
}

export interface BackendAvailabilityResults {
  responseCount: number
  eligibleCount: number
  cellCounts: Record<string, number>
  candidates: Array<{
    dateKey: string
    startMinutes: number
    endMinutes: number
    availableCount: number
  }>
  missing: Array<{ memberId: string; displayName: string }> | null
}

export interface BackendAvailabilityDetail {
  _id: string
  slug: string
  title: string
  note: string
  status: "open" | "finalized"
  durationMinutes: number
  dateKeys: string[]
  startMinutes: number
  endMinutes: number
  slotMinutes: number
  timezone: string
  resultsVisibility: "after_submit" | "admins_only"
  deadlineAt?: number
  createdAt: number
  updatedAt: number
  eligibleCount: number
  responseCount: number
  isEligible: boolean
  canManage: boolean
  myResponse: {
    availableSlotKeys: string[]
    submittedAt: number
    updatedAt: number
  } | null
  results: BackendAvailabilityResults | null
  finalizedDateKey?: string
  finalizedStartMinutes?: number
}

export function mapAvailabilitySummary(row: BackendAvailabilitySummary): AvailabilityPollSummary {
  return {
    id: row.pollId,
    slug: row.slug,
    title: row.title,
    note: row.note,
    status: row.status,
    durationMinutes: row.durationMinutes,
    timezone: row.timezone,
    deadline: row.deadlineAt === null ? undefined : new Date(row.deadlineAt).toISOString(),
    eligibleCount: row.eligibleCount,
    responseCount: row.responseCount,
    hasResponded: row.hasResponded,
    canManage: row.canManage,
    updatedAt: new Date(row.updatedAt).toISOString(),
  }
}

function mapResults(results: BackendAvailabilityResults | null): AvailabilityResults | undefined {
  if (!results) return undefined
  return {
    eligibleCount: results.eligibleCount,
    responseCount: results.responseCount,
    cellCounts: results.cellCounts,
    candidates: results.candidates,
    missing: results.missing ?? undefined,
  }
}

export function mapAvailabilityDetail(
  row: BackendAvailabilityDetail,
  summary?: BackendAvailabilitySummary,
): AvailabilityPollDetail {
  return {
    id: row._id,
    slug: row.slug,
    title: row.title,
    note: row.note,
    status: row.status,
    durationMinutes: row.durationMinutes,
    dateKeys: row.dateKeys,
    startMinutes: row.startMinutes,
    endMinutes: row.endMinutes,
    slotMinutes: row.slotMinutes,
    timezone: row.timezone,
    deadline: row.deadlineAt === undefined ? undefined : new Date(row.deadlineAt).toISOString(),
    eligibleCount: row.eligibleCount,
    responseCount: row.responseCount,
    hasResponded: Boolean(row.myResponse),
    canManage: row.canManage,
    isEligible: row.isEligible,
    resultsVisibility: row.resultsVisibility === "after_submit" ? "after-submit" : "admins-only",
    mySlotKeys: row.myResponse?.availableSlotKeys ?? [],
    results: mapResults(row.results),
    finalizedDateKey: row.finalizedDateKey,
    finalizedStartMinutes: row.finalizedStartMinutes,
    updatedAt: new Date(row.updatedAt ?? summary?.updatedAt ?? row.createdAt).toISOString(),
  }
}
