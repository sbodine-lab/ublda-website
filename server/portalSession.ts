import type { ApplicantAccount } from '../src/lib/applicantAccount.ts'
import type { AdminScope, DashboardRole } from '../src/lib/dashboardAccess.ts'
import { ADMIN_SCOPES, adminAccountForEmail, canPublish, scopesForEmail } from '../src/lib/dashboardAccess.ts'
import type { DashboardData } from '../src/lib/dashboardData.ts'
import { SUPER_ADMIN_EMAIL, verifyLocalSuperAdminSession } from './adminSessions.ts'
import { createLocalRecruitingStore } from './localRecruitingStore.js'

export type PortalActor = {
  email: string
  account: ApplicantAccount
  role: DashboardRole
  scopes: AdminScope[]
  /** role === 'exec' || role === 'super-admin' */
  isAdmin: boolean
  isSuperAdmin: boolean
  /** PUBLISH_APPROVERS.includes(email) */
  canPublish: boolean
}

export type PortalSessionResult =
  | { authorized: true; actor: PortalActor }
  | { authorized: false; status: 401 | 403; error: string }

/**
 * `portalSessionFor` resolves the session by reading the store, and for an exec that read
 * already carries the role-scoped recruiting payload the Overview screen needs. Handing it
 * back alongside the result means one bootstrap costs one session read, not two — the whole
 * document is downloaded and parsed on every read, so a second one is a real cost.
 * It is never a member's payload: only the admin half of the bootstrap ever looks at it.
 */
export type PortalSessionResolution = {
  result: PortalSessionResult
  dashboard: DashboardData | null
}

const SESSION_REQUIRED = 'Sign in again — that session is no longer valid.'
const MIN_SESSION_TOKEN_LENGTH = 24

const actorFor = (input: {
  account: ApplicantAccount
  role: DashboardRole
}): PortalActor => {
  const email = input.account.email.trim().toLowerCase()
  const isAdmin = input.role === 'exec' || input.role === 'super-admin'
  // Scopes resolve server-side from the STORED account, never from anything the client sent.
  // The stored list wins over ADMIN_ACCOUNTS whenever it exists — including when it is empty,
  // which is what revoking looks like. Letting the static roster win instead would mean
  // admin.grantRole could never take a scope away from the nine people on it, so the Console
  // would report a successful revocation while the officer kept full access until someone
  // edited a hardcoded array and redeployed. The roster is the seed, not the authority.
  const rosterScopes = scopesForEmail(email)
  const storedScopes = input.account.adminScopes
  const effectiveScopes = Array.isArray(storedScopes) ? storedScopes : rosterScopes

  return {
    email,
    account: input.account,
    role: input.role,
    scopes: isAdmin ? effectiveScopes : [],
    isAdmin,
    isSuperAdmin: input.role === 'super-admin',
    canPublish: canPublish(email),
  }
}

/**
 * Resolution order, exactly: reject a token too short to be one → the local super-admin HMAC
 * token → the stored session → 401. Store failures are RETHROWN so the handler can map
 * BLOB_UNAVAILABLE to 503 instead of pretending the session was bad.
 */
export const resolvePortalSession = async (sessionToken: string): Promise<PortalSessionResolution> => {
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : ''

  if (token.length < MIN_SESSION_TOKEN_LENGTH) {
    return { result: { authorized: false, status: 401, error: SESSION_REQUIRED }, dashboard: null }
  }

  if (verifyLocalSuperAdminSession(token)) {
    const roster = adminAccountForEmail(SUPER_ADMIN_EMAIL)
    const account: ApplicantAccount = {
      firstName: roster?.name.split(' ')[0] || 'Sam',
      lastName: roster?.name.split(' ').slice(1).join(' ') || 'Bodine',
      uniqname: SUPER_ADMIN_EMAIL.replace(/@.*$/, ''),
      email: SUPER_ADMIN_EMAIL,
      role: 'super-admin',
      adminTitle: roster?.title || 'Co-President',
      adminScopes: [...ADMIN_SCOPES],
      verifiedVia: 'google',
    }

    return {
      result: { authorized: true, actor: actorFor({ account, role: 'super-admin' }) },
      dashboard: null,
    }
  }

  const session = await createLocalRecruitingStore().dashboardData(token)
  if (!session) {
    return { result: { authorized: false, status: 401, error: SESSION_REQUIRED }, dashboard: null }
  }

  const role: DashboardRole = session.role === 'super-admin' || session.role === 'exec'
    ? session.role
    : 'member'

  return {
    result: { authorized: true, actor: actorFor({ account: session.account, role }) },
    dashboard: session.dashboardData || null,
  }
}

export const portalSessionFor = async (sessionToken: string): Promise<PortalSessionResult> => (
  (await resolvePortalSession(sessionToken)).result
)

export const requireAdmin = (result: PortalSessionResult): PortalSessionResult => {
  if (!result.authorized) return result
  if (result.actor.isAdmin) return result

  return {
    authorized: false,
    status: 403,
    error: 'That part of the portal is run by the exec team.',
  }
}

export const requireScope = (result: PortalSessionResult, scope: AdminScope): PortalSessionResult => {
  const admin = requireAdmin(result)
  if (!admin.authorized) return admin
  if (admin.actor.isSuperAdmin) return admin
  if (admin.actor.scopes.includes(scope)) return admin

  return {
    authorized: false,
    status: 403,
    error: `Your account does not cover ${scope}. Ask a co-president to add it.`,
  }
}

export const requireSuperAdmin = (result: PortalSessionResult): PortalSessionResult => {
  const admin = requireAdmin(result)
  if (!admin.authorized) return admin
  if (admin.actor.isSuperAdmin) return admin

  return {
    authorized: false,
    status: 403,
    error: 'That action is limited to the club super-admin.',
  }
}

/**
 * Doc #54: nobody confirms a date or discusses fees except through Sam or Alexa.
 * A publisher must still hold the scope for the thing being published — callers pair
 * requireScope with this, never this alone.
 */
export const requirePublisher = (result: PortalSessionResult): PortalSessionResult => {
  const admin = requireAdmin(result)
  if (!admin.authorized) return admin
  if (admin.actor.canPublish) return admin

  return {
    authorized: false,
    status: 403,
    error: 'A co-president publishes events and announcements.',
  }
}
