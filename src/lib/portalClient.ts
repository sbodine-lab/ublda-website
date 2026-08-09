import type { AdminScope, PortalAccountSummary } from './dashboardAccess.ts'
import type { DashboardBackendStatus, DashboardLaunchReadiness } from './dashboardData.ts'
import type { ConsentedAccessView } from './portalAccess.ts'
import type { AuditEntry } from './portalAudit.ts'
import type { ClubEvent, ClubEventPublicView, EventRsvp } from './portalEvents.ts'
import type { MemberAdminRow, MemberSelfProfile } from './portalMembers.ts'
import type { AnnouncementPublicView, PortalAnnouncement } from './portalAnnouncements.ts'
import type { PortalResource } from './portalResources.ts'

/** Rendered on the Member Home "Who to ask" list. NEVER carries role or scopes. */
export type PortalOfficer = {
  name: string
  title: string
  email: string
  askAbout: string
}

/** Counts only, never ratios. A denominator is an accusation. */
export type MemberParticipation = {
  eventsAttended: number
  eventKindsAttended: string[]
  firstEventAt: string
}

/** `addedBy` is admin-only and is never copied into the member payload. */
export type PortalResourcePublicView = Omit<PortalResource, 'addedBy'>

export type UnprocessedIntakeRow = {
  email: string
  firstName: string
  lastName: string
  uniqname: string
  createdAt: string
}

export type RecruitingPulse = {
  candidateCount: number
  unmatchedCount: number
  uncoveredSlots: number
  scheduledCount: number
}

export type AdminWorkspace = {
  members: MemberAdminRow[]
  unprocessedIntake: UnprocessedIntakeRow[]
  events: ClubEvent[]
  rsvps: EventRsvp[]
  announcements: PortalAnnouncement[]
  resources: PortalResource[]
  /**
   * Consented access needs keyed by event id, resolved server-side with that event as the
   * context. This is the ONLY place an `appliesTo: 'rsvp-only'` consent resolves — a roster
   * row has no event, so it must not.
   */
  eventAccess: Record<string, ConsentedAccessView[]>
  recruitingPulse: RecruitingPulse
  backendStatus: DashboardBackendStatus
  launchReadiness: DashboardLaunchReadiness
  /** Live stored officer accounts. Populated for super-admins only; [] for everyone else. */
  adminAccounts: PortalAccountSummary[]
}

/**
 * The two bootstrap shapes are disjoint literals built by allowlist on the server. A member
 * payload has no `admin` key at all — not an empty one, not a filtered one.
 */
export type MemberBootstrap = {
  role: 'member'
  profile: MemberSelfProfile
  events: ClubEventPublicView[]
  announcements: AnnouncementPublicView[]
  resources: PortalResourcePublicView[]
  officers: PortalOfficer[]
  participation: MemberParticipation
}

export type AdminBootstrap = Omit<MemberBootstrap, 'role'> & {
  role: 'exec' | 'super-admin'
  scopes: AdminScope[]
  canPublish: boolean
  admin: AdminWorkspace
}

export type PortalBootstrap = MemberBootstrap | AdminBootstrap

/** Response `data` shapes for the actions that do not simply echo a record back. */
export type PortalAuditListData = { entries: AuditEntry[] }
export type PortalExportData = { filename: string; csv: string }

export const isAdminBootstrap = (bootstrap: PortalBootstrap): bootstrap is AdminBootstrap => (
  bootstrap.role !== 'member'
)

export type PortalErrorBody = {
  error?: string
  errors?: string[]
  blockers?: string[]
  code?: string
}

/** A failed call throws this. The extra fields drive the ErrorSummary and the toast. */
export type PortalCallError = Error & {
  status: number
  errors: string[]
  blockers: string[]
  code: string
}

export const portalCallError = (input: {
  message: string
  status: number
  errors?: string[]
  blockers?: string[]
  code?: string
}): PortalCallError => Object.assign(new Error(input.message), {
  status: input.status,
  errors: input.errors || [],
  blockers: input.blockers || [],
  code: input.code || '',
})

const STORAGE_WARMING_MESSAGE = 'Storage is warming up. Give it a few seconds and try again.'
const GENERIC_FAILURE_MESSAGE = 'That did not go through. Try again in a moment.'

/**
 * The single browser entry point to /api/portal. Every screen goes through it, so the
 * request shape and the error shape are defined in exactly one place.
 */
export const callPortal = async <T>(
  action: string,
  sessionToken: string,
  payload: Record<string, unknown> = {},
): Promise<T> => {
  if (!sessionToken) {
    throw portalCallError({ message: 'Sign in again — that session is no longer valid.', status: 401 })
  }

  let response: Response
  try {
    response = await fetch('/api/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, sessionToken, payload }),
    })
  } catch {
    throw portalCallError({ message: 'No connection to the portal. Check your network and try again.', status: 0 })
  }

  const body = await response.json().catch(() => null) as (PortalErrorBody & {
    success?: boolean
    data?: unknown
  }) | null

  if (!response.ok || !body?.success) {
    throw portalCallError({
      message: body?.error || (response.status === 503 ? STORAGE_WARMING_MESSAGE : GENERIC_FAILURE_MESSAGE),
      status: response.status,
      errors: Array.isArray(body?.errors) ? body.errors : [],
      blockers: Array.isArray(body?.blockers) ? body.blockers : [],
      code: typeof body?.code === 'string' ? body.code : '',
    })
  }

  return body.data as T
}
