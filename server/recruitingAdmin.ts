import { createLocalRecruitingStore } from './localRecruitingStore.js'
import { verifyLocalSuperAdminSession } from './adminSessions.ts'
import { postRawJsonWithTimeout } from './googleScript.ts'
import { logRecruitingError } from './recruitingErrors.ts'

export type RecruitingAdminRole = 'super-admin' | 'exec'
export type RecruitingAdminAccess =
  | { authorized: true; role: RecruitingAdminRole }
  | { authorized: false; status: 401 | 403; error: string }

export { verifyLocalSuperAdminSession } from './adminSessions.ts'

const fetchScriptDashboardRole = async (sessionToken: string): Promise<RecruitingAdminRole | ''> => {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL
  if (!scriptUrl) return ''

  try {
    const { response, payload } = await postRawJsonWithTimeout(scriptUrl, {
      formType: 'applicantAccount',
      action: 'dashboardData',
      sessionToken,
    })
    const dashboardPayload = payload as { role?: string; account?: { adminScopes?: string[] } } | null

    if (!response.ok || !dashboardPayload) return ''
    if (dashboardPayload.role === 'super-admin' || dashboardPayload.role === 'exec') return dashboardPayload.role
    if (dashboardPayload.account?.adminScopes?.includes('recruiting')) return 'exec'
    return ''
  } catch {
    return ''
  }
}

export const recruitingAdminRoleForSession = async (sessionToken: string): Promise<RecruitingAdminRole | ''> => {
  if (sessionToken.length < 24) return ''
  if (verifyLocalSuperAdminSession(sessionToken)) return 'super-admin'

  try {
    const localSession = await createLocalRecruitingStore().dashboardData(sessionToken)
    if (localSession?.role === 'super-admin' || localSession?.role === 'exec') return localSession.role
  } catch (error) {
    logRecruitingError('recruiting_admin_session_lookup_failed', error)
  }

  return fetchScriptDashboardRole(sessionToken)
}

export const recruitingAdminAccessForSession = async (sessionToken: string): Promise<RecruitingAdminAccess> => {
  if (sessionToken.length < 24) {
    return { authorized: false, status: 401, error: 'A valid admin session is required.' }
  }
  if (verifyLocalSuperAdminSession(sessionToken)) {
    return { authorized: true, role: 'super-admin' }
  }

  try {
    const localSession = await createLocalRecruitingStore().dashboardData(sessionToken)
    if (localSession?.role === 'super-admin' || localSession?.role === 'exec') {
      return { authorized: true, role: localSession.role }
    }
    if (localSession) {
      return { authorized: false, status: 403, error: 'Admin access is required.' }
    }
  } catch (error) {
    logRecruitingError('recruiting_admin_session_lookup_failed', error)
  }

  const scriptRole = await fetchScriptDashboardRole(sessionToken)
  if (scriptRole) return { authorized: true, role: scriptRole }

  return { authorized: false, status: 401, error: 'A valid admin session is required.' }
}

export const canAccessRecruitingAdmin = async (sessionToken: string) => (
  Boolean(await recruitingAdminRoleForSession(sessionToken))
)
