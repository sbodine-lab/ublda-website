export type AvailabilityPollStatus = "open" | "finalized"
export type AvailabilityResultsVisibility = "after-submit" | "admins-only"

export interface AvailabilityPollSummary {
  id: string
  slug: string
  title: string
  note: string
  status: AvailabilityPollStatus
  durationMinutes: number
  timezone: string
  deadline?: string
  eligibleCount: number
  responseCount: number
  hasResponded: boolean
  canManage: boolean
  updatedAt: string
}

export interface AvailabilityCandidate {
  dateKey: string
  startMinutes: number
  endMinutes: number
  availableCount: number
}

export interface AvailabilityResults {
  eligibleCount: number
  responseCount: number
  cellCounts: Record<string, number>
  candidates: AvailabilityCandidate[]
  missing?: Array<{ memberId: string; displayName: string }>
}

export interface AvailabilityPollDetail extends AvailabilityPollSummary {
  dateKeys: string[]
  startMinutes: number
  endMinutes: number
  slotMinutes: number
  resultsVisibility: AvailabilityResultsVisibility
  isEligible: boolean
  mySlotKeys: string[]
  results?: AvailabilityResults
  finalizedDateKey?: string
  finalizedStartMinutes?: number
}

export interface CreateAvailabilityPollInput {
  title: string
  note?: string
  durationMinutes: number
  dateKeys: string[]
  startMinutes: number
  endMinutes: number
  timezone: string
  electorateMemberIds: string[]
  deadline?: string
  resultsVisibility: AvailabilityResultsVisibility
}

export interface CreatedAvailabilityPoll {
  id: string
  slug: string
}

export interface AvailabilitySnapshot {
  polls: AvailabilityPollSummary[]
  activePoll?: AvailabilityPollDetail
  loading: boolean
  error?: string
}

export interface AvailabilityAdapter {
  readonly mode: "demo" | "live"
  subscribe(listener: () => void): () => void
  getSnapshot(): AvailabilitySnapshot
  createPoll(input: CreateAvailabilityPollInput): Promise<CreatedAvailabilityPoll>
  saveResponse(pollId: string, slotKeys: string[]): Promise<void>
  finalizePoll(pollId: string, dateKey: string, startMinutes: number): Promise<void>
}
