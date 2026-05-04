import type { AdminAccount } from './dashboardAccess'
import type { Candidate, InterviewerAvailability, LeadershipMetric } from './memberData'

export type DashboardBackendStatus = {
  source: 'preview' | 'sheets'
  message: string
  updatedAt: string
}

export type DashboardData = {
  candidates?: Candidate[]
  interviewerAvailability?: InterviewerAvailability[]
  adminAccounts?: AdminAccount[]
  metrics?: LeadershipMetric[]
  backendStatus?: DashboardBackendStatus
}

export const emptyDashboardData: DashboardData = {}

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
