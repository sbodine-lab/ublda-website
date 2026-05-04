import type { AdminAccount } from './dashboardAccess'
import type { Candidate, InterviewerAvailability, LeadershipMetric, MemberSignup } from './memberData'

export type DashboardBackendStatus = {
  source: 'preview' | 'sheets' | 'vercel'
  message: string
  updatedAt: string
}

export type DashboardCalendarEvent = {
  id: string
  title: string
  date: string
  startMinutes: number
  durationMinutes: number
  owner: string
  location: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type DashboardData = {
  candidates?: Candidate[]
  interviewerAvailability?: InterviewerAvailability[]
  memberSignups?: MemberSignup[]
  adminAccounts?: AdminAccount[]
  calendarEvents?: DashboardCalendarEvent[]
  metrics?: LeadershipMetric[]
  backendStatus?: DashboardBackendStatus
}

export const emptyDashboardData: DashboardData = {}
export const DASHBOARD_DATA_CHANGED_EVENT = 'ublda-dashboard-data-changed'
export const DASHBOARD_DATA_CHANGED_STORAGE_KEY = 'ubldaDashboardDataChangedAt'

type BrowserEventTarget = {
  localStorage?: {
    setItem: (key: string, value: string) => void
  }
  dispatchEvent?: (event: { type: string }) => boolean
  CustomEvent?: new (type: string, init?: { detail?: unknown }) => { type: string }
}

export const notifyDashboardDataChanged = () => {
  const browser = globalThis as typeof globalThis & BrowserEventTarget
  if (!browser.localStorage || !browser.dispatchEvent || !browser.CustomEvent) return

  const stamp = String(Date.now())
  browser.localStorage.setItem(DASHBOARD_DATA_CHANGED_STORAGE_KEY, stamp)
  browser.dispatchEvent(new browser.CustomEvent(DASHBOARD_DATA_CHANGED_EVENT, { detail: { stamp } }))
}

export const readDashboardData = async (sessionToken: string): Promise<DashboardData> => {
  if (!sessionToken) {
    return emptyDashboardData
  }

  const response = await fetch('/api/dashboard-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken }),
  })
  const payload = await response.json().catch(() => null) as { dashboardData?: DashboardData; error?: string } | null

  if (!response.ok) {
    throw new Error(payload?.error || 'Could not load dashboard data.')
  }

  return payload?.dashboardData || emptyDashboardData
}
