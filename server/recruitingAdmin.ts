export type RecruitingAdminRole = 'super-admin' | 'exec'
export type RecruitingAdminAccess =
  | { authorized: true; role: RecruitingAdminRole }
  | { authorized: false; status: 401 | 403; error: string }

const RETIRED_ADMIN_ERROR = 'This legacy recruiting admin endpoint is retired. Sign in through the leadership workspace.'

/**
 * Recruiting administration now belongs exclusively to Logto + Convex. These
 * compatibility functions intentionally reject every local-store, Apps Script,
 * preview, and shared-password token, including sessions minted before cutover.
 */
export const recruitingAdminRoleForSession = async (_sessionToken: string): Promise<RecruitingAdminRole | ''> => {
  void _sessionToken
  return ''
}

export const recruitingAdminAccessForSession = async (_sessionToken: string): Promise<RecruitingAdminAccess> => {
  void _sessionToken
  return {
    authorized: false,
    status: 401,
    error: RETIRED_ADMIN_ERROR,
  }
}

export const canAccessRecruitingAdmin = async (_sessionToken: string) => {
  void _sessionToken
  return false
}
