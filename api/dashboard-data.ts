import type { VercelRequest, VercelResponse } from '../server/types.ts'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import {
  bodyRecord,
  getString,
  methodNotAllowed,
  setApiSecurityHeaders,
} from '../server/apiUtils.ts'
import {
  localSuperAdminDashboardPayload,
  verifyLocalSuperAdminSession,
} from '../server/adminSessions.ts'
import { postJsonWithTimeout } from '../server/googleScript.ts'
import {
  logRecruitingError,
  sendRecruitingErrorResponse,
} from '../server/recruitingErrors.ts'

const getSessionToken = (body: unknown) => {
  const payload = bodyRecord(body)
  return getString(payload, 'sessionToken', { stripMarkup: false })
}

const fetchSheetDashboard = async (
  scriptUrl: string,
  sessionToken: string,
) => {
  const result = await postJsonWithTimeout(scriptUrl, {
    formType: 'applicantAccount',
    action: 'dashboardData',
    sessionToken,
  }, 'Could not load dashboard data')
  return result.payload || {}
}

const dashboardResponse = (payload: Record<string, unknown>) => ({
  success: true,
  account: payload?.account || null,
  role: payload?.role || 'member',
  dashboardData: payload?.dashboardData || {},
})

const mergeById = <T extends Record<string, unknown>>(primary: T[], secondary: T[]) => {
  const seen = new Set<string>()
  const merged: T[] = []

  primary.concat(secondary).forEach((item, index) => {
    const id = String(item.id || item.email || item.name || index)
    if (seen.has(id)) return
    seen.add(id)
    merged.push(item)
  })

  return merged
}

const withRecruitingStoreData = async (payload: Record<string, unknown>) => {
  const role = typeof payload.role === 'string' ? payload.role : 'member'
  if (role !== 'super-admin' && role !== 'exec') {
    return payload
  }

  let storeDashboardData: Awaited<ReturnType<ReturnType<typeof createLocalRecruitingStore>['leadershipDashboardData']>> | null = null
  let storeErrorMessage = ''
  try {
    storeDashboardData = await createLocalRecruitingStore().leadershipDashboardData()
  } catch (error) {
    logRecruitingError('dashboard_recruiting_merge_failed', error)
    storeErrorMessage = error instanceof Error
      ? error.message
      : 'Recruiting storage is temporarily unavailable.'
  }
  const dashboardData = (payload.dashboardData && typeof payload.dashboardData === 'object'
    ? payload.dashboardData
    : {}) as Record<string, unknown>
  if (!storeDashboardData) {
    return {
      ...payload,
      dashboardData: {
        ...dashboardData,
        backendStatus: dashboardData.backendStatus || {
          source: 'vercel',
          message: storeErrorMessage || 'Recruiting storage is temporarily unavailable.',
          updatedAt: new Date().toISOString(),
        },
      },
    }
  }

  const storeCandidates = Array.isArray(storeDashboardData.candidates) ? storeDashboardData.candidates : []
  const storeInterviewers = Array.isArray(storeDashboardData.interviewerAvailability) ? storeDashboardData.interviewerAvailability : []
  const storeMembers = Array.isArray(storeDashboardData.memberSignups) ? storeDashboardData.memberSignups : []
  const storeCalendarEvents = Array.isArray(storeDashboardData.calendarEvents) ? storeDashboardData.calendarEvents : []
  const meaningfulStoreMembers = storeMembers.filter((member) => member.email !== 'sbodine@umich.edu')
  const hasStoreRecruitingData = storeCandidates.length > 0 || storeInterviewers.length > 0 || meaningfulStoreMembers.length > 0 || storeCalendarEvents.length > 0
  const sheetCandidates = Array.isArray(dashboardData.candidates) ? dashboardData.candidates as Record<string, unknown>[] : []
  const sheetInterviewers = Array.isArray(dashboardData.interviewerAvailability) ? dashboardData.interviewerAvailability as Record<string, unknown>[] : []
  const sheetMembers = Array.isArray(dashboardData.memberSignups) ? dashboardData.memberSignups as Record<string, unknown>[] : []
  const existingBackendStatus = dashboardData.backendStatus as { source?: unknown } | undefined
  const hasSheetDashboard = existingBackendStatus?.source === 'sheets'
  const nextDashboardData = {
    ...dashboardData,
    candidates: storeCandidates.length ? mergeById(storeCandidates as unknown as Record<string, unknown>[], sheetCandidates) : dashboardData.candidates,
    interviewerAvailability: storeInterviewers.length
      ? mergeById(storeInterviewers as unknown as Record<string, unknown>[], sheetInterviewers)
      : dashboardData.interviewerAvailability,
    memberSignups: meaningfulStoreMembers.length ? mergeById(storeMembers as unknown as Record<string, unknown>[], sheetMembers) : dashboardData.memberSignups,
    adminAccounts: dashboardData.adminAccounts || storeDashboardData.adminAccounts,
    calendarEvents: storeCalendarEvents.length ? storeCalendarEvents : dashboardData.calendarEvents,
    launchReadiness: storeDashboardData.launchReadiness,
    backendStatus: hasStoreRecruitingData ? {
      source: storeDashboardData.backendStatus?.source || 'vercel',
      message: hasSheetDashboard
        ? 'Loaded account data from Google Sheets and recruiting responses from the private Vercel backend.'
        : storeDashboardData.backendStatus?.message || 'Loaded recruiting data from the private Vercel backend.',
      updatedAt: new Date().toISOString(),
    } : dashboardData.backendStatus || storeDashboardData.backendStatus,
  }

  return {
    ...payload,
    dashboardData: nextDashboardData,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  if (req.method !== 'POST') {
    return methodNotAllowed(res)
  }

  const sessionToken = getSessionToken(req.body)
  if (sessionToken.length < 24) {
    return res.status(401).json({ error: 'A valid member session is required.' })
  }

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL
  if (verifyLocalSuperAdminSession(sessionToken)) {
    return res.status(200).json(await withRecruitingStoreData(localSuperAdminDashboardPayload()))
  }

  let storeSession: Awaited<ReturnType<ReturnType<typeof createLocalRecruitingStore>['dashboardData']>> | null = null
  let storeSessionError: unknown = null
  try {
    storeSession = await createLocalRecruitingStore().dashboardData(sessionToken)
  } catch (error) {
    storeSessionError = error
    logRecruitingError('dashboard_local_session_failed', error)
  }
  if (storeSession) {
    return res.status(200).json(dashboardResponse(await withRecruitingStoreData(storeSession as unknown as Record<string, unknown>)))
  }

  if (!scriptUrl) {
    if (storeSessionError) {
      return sendRecruitingErrorResponse(res, storeSessionError, 'Dashboard storage is temporarily unavailable.')
    }
    return res.status(500).json({ error: 'Dashboard backend not configured' })
  }

  try {
    const payload = await fetchSheetDashboard(scriptUrl, sessionToken)
    const mergedPayload = await withRecruitingStoreData(payload)

    return res.status(200).json(dashboardResponse(mergedPayload))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load dashboard data.'

    const authFailure = /session|required|auth|authorized|permission/i.test(message)
    return res.status(authFailure ? 401 : 500).json({ error: message || 'Could not load dashboard data' })
  }
}
