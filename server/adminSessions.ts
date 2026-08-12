/**
 * The shared-password/HMAC administrator plane is permanently retired.
 *
 * These two fail-closed compatibility exports remain while older recruiting
 * routes migrate to Logto + Convex authorization. They deliberately do not
 * read an environment secret, parse a token, or construct an admin payload.
 */
export const verifyLocalSuperAdminSession = (_sessionToken: string) => {
  void _sessionToken
  return false
}

export const localSuperAdminDashboardPayload = (): never => {
  throw new Error('Legacy local administrator sessions are retired.')
}
