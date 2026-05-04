import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.ts'

const superAdminSessionSecret = () => (
  process.env.UBLDA_SUPER_ADMIN_PASSWORD
  || process.env.SAM_BODINE_PASSWORD
  || ''
)

const localAdminFallbackEnabled = () => process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK === 'true'

const setApiSecurityHeaders = (res: VercelResponse) => {
  res.setHeader?.('Cache-Control', 'no-store, max-age=0')
  res.setHeader?.('Pragma', 'no-cache')
  res.setHeader?.('X-Content-Type-Options', 'nosniff')
}

const signSessionPayload = (payload: string) => {
  const secret = superAdminSessionSecret()
  if (!secret) {
    return ''
  }

  return createHmac('sha256', secret).update(payload).digest('base64url')
}

const safeEquals = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

const verifyLocalSuperAdminSession = (sessionToken: string) => {
  if (!localAdminFallbackEnabled() || !superAdminSessionSecret()) return false

  const [prefix, payload, signature] = sessionToken.split('.')
  if (prefix !== 'ublda_admin' || !payload || !signature) return false
  const expectedSignature = signSessionPayload(payload)
  if (!expectedSignature || !safeEquals(signature, expectedSignature)) return false

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { email?: string; exp?: number }
    return decoded.email === 'sbodine@umich.edu' && typeof decoded.exp === 'number' && decoded.exp > Date.now()
  } catch {
    return false
  }
}

const localSuperAdminPayload = () => ({
  success: true,
  account: {
    firstName: 'Sam',
    lastName: 'Bodine',
    uniqname: 'sbodine',
    email: 'sbodine@umich.edu',
    role: 'super-admin',
    adminTitle: 'Super Admin',
    adminScopes: ['recruiting', 'members', 'events', 'sponsors', 'publishing', 'system'],
  },
  role: 'super-admin',
  dashboardData: {
    candidates: [],
    interviewerAvailability: [],
    memberSignups: [],
    backendStatus: {
      source: 'vercel',
      message: 'Signed in through Vercel super-admin session. Publish the Apps Script backend for live sheet data.',
      updatedAt: new Date().toISOString(),
    },
  },
})

const superAdminAccount = {
  firstName: 'Sam',
  lastName: 'Bodine',
  uniqname: 'sbodine',
  email: 'sbodine@umich.edu',
}

const getSessionToken = (body: unknown) => {
  if (!body || typeof body !== 'object') return ''
  const token = (body as Record<string, unknown>).sessionToken
  return typeof token === 'string' ? token.trim() : ''
}

const fetchScriptJson = async (
  scriptUrl: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
) => {
  const response = await fetch(scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const payload = await response.json().catch(() => null)

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || 'Could not load dashboard data')
  }

  return payload
}

const fetchSheetDashboard = async (
  scriptUrl: string,
  sessionToken: string,
  signal: AbortSignal,
) => fetchScriptJson(scriptUrl, {
  formType: 'applicantAccount',
  action: 'dashboardData',
  sessionToken,
}, signal)

const fetchSheetDashboardForLocalSuperAdmin = async (
  scriptUrl: string,
  signal: AbortSignal,
) => {
  const signInPayload = await fetchScriptJson(scriptUrl, {
    formType: 'applicantAccount',
    action: 'googleSignIn',
    account: superAdminAccount,
    origin: 'https://ublda.org',
  }, signal)
  const sheetSessionToken = typeof signInPayload?.sessionToken === 'string' ? signInPayload.sessionToken : ''

  if (sheetSessionToken.length < 24) {
    throw new Error('Could not create a live dashboard session.')
  }

  return fetchSheetDashboard(scriptUrl, sheetSessionToken, signal)
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
  const storeDashboardData = await createLocalRecruitingStore().leadershipDashboardData()
  const dashboardData = (payload.dashboardData && typeof payload.dashboardData === 'object'
    ? payload.dashboardData
    : {}) as Record<string, unknown>
  const storeCandidates = Array.isArray(storeDashboardData.candidates) ? storeDashboardData.candidates : []
  const storeInterviewers = Array.isArray(storeDashboardData.interviewerAvailability) ? storeDashboardData.interviewerAvailability : []
  const storeMembers = Array.isArray(storeDashboardData.memberSignups) ? storeDashboardData.memberSignups : []
  const meaningfulStoreMembers = storeMembers.filter((member) => member.email !== 'sbodine@umich.edu')
  const hasStoreRecruitingData = storeCandidates.length > 0 || storeInterviewers.length > 0 || meaningfulStoreMembers.length > 0
  const sheetCandidates = Array.isArray(dashboardData.candidates) ? dashboardData.candidates as Record<string, unknown>[] : []
  const sheetInterviewers = Array.isArray(dashboardData.interviewerAvailability) ? dashboardData.interviewerAvailability as Record<string, unknown>[] : []
  const sheetMembers = Array.isArray(dashboardData.memberSignups) ? dashboardData.memberSignups as Record<string, unknown>[] : []
  const nextDashboardData = {
    ...dashboardData,
    candidates: storeCandidates.length ? mergeById(storeCandidates as unknown as Record<string, unknown>[], sheetCandidates) : dashboardData.candidates,
    interviewerAvailability: storeInterviewers.length
      ? mergeById(storeInterviewers as unknown as Record<string, unknown>[], sheetInterviewers)
      : dashboardData.interviewerAvailability,
    memberSignups: meaningfulStoreMembers.length ? mergeById(storeMembers as unknown as Record<string, unknown>[], sheetMembers) : dashboardData.memberSignups,
    adminAccounts: dashboardData.adminAccounts || storeDashboardData.adminAccounts,
    backendStatus: hasStoreRecruitingData ? {
      source: storeDashboardData.backendStatus?.source || 'vercel',
      message: dashboardData.backendStatus
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
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sessionToken = getSessionToken(req.body)
  if (sessionToken.length < 24) {
    return res.status(401).json({ error: 'A valid member session is required.' })
  }

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL
  if (!scriptUrl) {
    if (verifyLocalSuperAdminSession(sessionToken)) {
      return res.status(200).json(await withRecruitingStoreData(localSuperAdminPayload()))
    }

    return res.status(500).json({ error: 'Dashboard backend not configured' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const payload = verifyLocalSuperAdminSession(sessionToken)
      ? await fetchSheetDashboardForLocalSuperAdmin(scriptUrl, controller.signal)
      : await fetchSheetDashboard(scriptUrl, sessionToken, controller.signal)
    const mergedPayload = await withRecruitingStoreData(payload)

    return res.status(200).json(dashboardResponse(mergedPayload))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load dashboard data.'

    if (verifyLocalSuperAdminSession(sessionToken)) {
      const localPayload = await withRecruitingStoreData(localSuperAdminPayload())
      return res.status(200).json({
        ...localPayload,
        warning: message || 'Could not load live sheet data.',
      })
    }

    const authFailure = /session|required|auth|authorized|permission/i.test(message)
    return res.status(authFailure ? 401 : 500).json({ error: message || 'Could not load dashboard data' })
  } finally {
    clearTimeout(timeout)
  }
}
