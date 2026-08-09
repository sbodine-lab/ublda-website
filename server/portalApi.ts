import type { AdminScope } from '../src/lib/dashboardAccess.ts'
import {
  ADMIN_ACCOUNTS,
  ADMIN_SCOPES,
  DASHBOARD_ROLES,
  SUPER_ADMIN_EMAIL,
  adminAccountForEmail,
} from '../src/lib/dashboardAccess.ts'
import type { DashboardBackendStatus, DashboardData } from '../src/lib/dashboardData.ts'
import { INTERVIEW_SLOTS } from '../src/lib/interviews.ts'
import type { ConsentedAccessView } from '../src/lib/portalAccess.ts'
import { consentedAccessView, isAccessLead, validateAccessProfilePayload } from '../src/lib/portalAccess.ts'
import type { PortalAnnouncement } from '../src/lib/portalAnnouncements.ts'
import {
  buildAnnouncementPublicView,
  isAnnouncementVisible,
  validateAnnouncementPayload,
} from '../src/lib/portalAnnouncements.ts'
import type {
  AdminBootstrap,
  AdminWorkspace,
  MemberBootstrap,
  MemberParticipation,
  PortalOfficer,
  RecruitingPulse,
  UnprocessedIntakeRow,
} from '../src/lib/portalClient.ts'
import type { ClubEvent, ClubEventKind, EventRsvp } from '../src/lib/portalEvents.ts'
import {
  buildClubEventPublicView,
  toEventRsvpSelfView,
  validateClubEventPayload,
  validateRsvpPayload,
} from '../src/lib/portalEvents.ts'
import type {
  MemberAdminRow,
  MemberProfileRecord,
  MemberSchool,
  MemberSource,
  MemberStatus,
  MemberYear,
} from '../src/lib/portalMembers.ts'
import {
  BULK_ADMIT_LIMIT,
  MEMBER_SCHOOLS,
  MEMBER_SOURCES,
  MEMBER_STATUSES,
  MEMBER_YEARS,
  buildMemberProfileRecord,
  memberParticipation,
  toMemberSelfProfile,
  validateMemberAdminPayload,
  validateMemberSelfPayload,
} from '../src/lib/portalMembers.ts'
import { RESOURCE_REORDER_LIMIT, toPortalResourcePublicView, validatePortalResourcePayload } from '../src/lib/portalResources.ts'
import { buildLaunchReadiness } from './launchReadiness.ts'
import type { PortalWorkspace } from './localRecruitingStore.js'
import { createLocalRecruitingStore } from './localRecruitingStore.js'
import type { PortalActor, PortalSessionResolution, PortalSessionResult } from './portalSession.ts'
import {
  requireAdmin,
  requirePublisher,
  requireScope,
  requireSuperAdmin,
  resolvePortalSession,
} from './portalSession.ts'
import {
  logRecruitingError,
  recruitingErrorCode,
  recruitingErrorMessage,
  recruitingErrorStatus,
} from './recruitingErrors.ts'

/**
 * The whole portal API. `api/portal.ts` and the Vite dev middleware both call
 * `handlePortalRequest`, so dev and production execute this exact function.
 */
export type PortalHttpRequest = {
  method?: string
  body?: unknown
}

export type PortalHttpResponse = {
  status: number
  body: Record<string, unknown>
}

type ActionResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; errors?: string[]; blockers?: string[] }

type ActionContext = {
  actor: PortalActor
  payload: Record<string, unknown>
  /** Role-scoped recruiting payload from the session read. Only the admin half reads it. */
  dashboard: DashboardData | null
  now: string
}

type RegistryEntry = {
  access: 'member' | 'admin'
  scope?: AdminScope
  publisher?: boolean
  superAdmin?: boolean
  run: (context: ActionContext) => Promise<ActionResult>
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const portalStore = () => createLocalRecruitingStore()

const auditActor = (actor: PortalActor) => ({ email: actor.email, role: actor.role })

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
)

const readString = (payload: Record<string, unknown>, key: string) => (
  typeof payload[key] === 'string' ? (payload[key] as string).trim() : ''
)

const readEmail = (payload: Record<string, unknown>, key: string) => readString(payload, key).toLowerCase()

const readStringList = (payload: Record<string, unknown>, key: string) => (
  Array.isArray(payload[key])
    ? (payload[key] as unknown[])
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean)
    : []
)

const done = (data: Record<string, unknown>): ActionResult => ({ ok: true, data })

const validationFailure = (errors: string[], fallback: string): ActionResult => ({
  ok: false,
  status: 400,
  error: errors[0] || fallback,
  errors,
})

/** A store write that was refused. `blockers` is what the editor renders next to Publish. */
const blockedFailure = (blockers: string[], fallback: string): ActionResult => ({
  ok: false,
  status: 400,
  error: blockers[0] || fallback,
  errors: blockers,
  blockers,
})

// ── Projections ───────────────────────────────────────────────────────────────
// Every payload below is built as a fresh literal. A filter that deletes keys fails open
// on every field added later, so nothing here is ever a redaction of a stored record.

const goingCountsByEvent = (rsvps: EventRsvp[]) => {
  const counts = new Map<string, number>()
  rsvps.forEach((rsvp) => {
    if (rsvp.response !== 'going') return
    counts.set(rsvp.eventId, (counts.get(rsvp.eventId) || 0) + 1)
  })
  return counts
}

const byStartsAt = (left: ClubEvent, right: ClubEvent) => (
  (left.startsAt || '').localeCompare(right.startsAt || '')
)

const announcementReachesMember = (
  announcement: PortalAnnouncement,
  reader: { status: MemberStatus; isAdmin: boolean },
) => {
  if (announcement.audience === 'eboard') return reader.isAdmin
  if (announcement.audience === 'active-members') return reader.isAdmin || reader.status === 'active'
  return true
}

const officerList = (): PortalOfficer[] => ADMIN_ACCOUNTS.map((account) => ({
  name: account.name,
  title: account.title,
  email: account.email,
  askAbout: account.askAbout,
}))

const participationFor = (input: {
  rsvps: EventRsvp[]
  events: ClubEvent[]
}): MemberParticipation => {
  const attended = input.rsvps.filter((rsvp) => Boolean(rsvp.checkedInAt))
  const eventById = new Map(input.events.map((event) => [event.id, event]))
  const kinds = Array.from(new Set(
    attended
      .map((rsvp) => eventById.get(rsvp.eventId)?.kind)
      .filter((kind): kind is ClubEventKind => Boolean(kind)),
  ))
  const stamps = attended.map((rsvp) => rsvp.checkedInAt).sort()

  return {
    eventsAttended: attended.length,
    eventKindsAttended: kinds,
    firstEventAt: stamps[0] || '',
  }
}

const memberBootstrapCore = (input: {
  actor: PortalActor
  workspace: PortalWorkspace
  now: string
}): Omit<MemberBootstrap, 'role'> => {
  const email = input.actor.email
  const record = input.workspace.memberProfiles.find((profile) => profile.email === email)
    || buildMemberProfileRecord(email, {
      firstName: input.actor.account.firstName,
      lastName: input.actor.account.lastName,
      uniqname: input.actor.account.uniqname,
    }, email)

  const myRsvps = input.workspace.eventRsvps.filter((rsvp) => rsvp.email === email)
  const counts = goingCountsByEvent(input.workspace.eventRsvps)

  const events = input.workspace.clubEvents
    .filter((event) => event.status === 'published' || event.status === 'cancelled')
    .sort(byStartsAt)
    .map((event) => buildClubEventPublicView({
      event,
      rsvpCount: counts.get(event.id) || 0,
      yourRsvp: myRsvps.find((rsvp) => rsvp.eventId === event.id) || null,
    }))

  const announcements = input.workspace.announcements
    .filter((announcement) => (
      isAnnouncementVisible(announcement, input.now)
      && announcementReachesMember(announcement, { status: record.status, isAdmin: input.actor.isAdmin })
    ))
    .sort((left, right) => (
      Number(right.pinned) - Number(left.pinned)
      || (right.publishedAt || '').localeCompare(left.publishedAt || '')
    ))
    .map((announcement) => buildAnnouncementPublicView(
      announcement,
      adminAccountForEmail(announcement.authorEmail)?.name || 'UBLDA',
    ))

  const resources = input.workspace.resources
    .filter((resource) => resource.published && (resource.audience === 'all-members' || input.actor.isAdmin))
    .map(toPortalResourcePublicView)

  return {
    profile: toMemberSelfProfile(record),
    events,
    announcements,
    resources,
    officers: officerList(),
    participation: participationFor({ rsvps: myRsvps, events: input.workspace.clubEvents }),
  }
}

/**
 * `access` is present only when `consentedAccessView` resolves for THIS reader. There is no
 * role short-circuit: being super-admin grants nothing here.
 */
const memberAdminRow = (input: {
  record: MemberProfileRecord
  rsvps: EventRsvp[]
  readerEmail: string
  now: string
  /** False for an admin without the `members` scope: they may count members, not read them. */
  canSeeContact: boolean
}): MemberAdminRow => {
  const record = input.record
  const participation = memberParticipation(record.email, input.rsvps)

  const row: MemberAdminRow = {
    email: record.email,
    firstName: record.firstName,
    lastName: record.lastName,
    preferredName: record.preferredName,
    pronouns: record.pronouns,
    uniqname: record.uniqname,
    status: record.status,
    source: record.source,
    year: record.year,
    school: record.school,
    major: record.major,
    gradYear: record.gradYear,
    interests: [...record.interests],
    linkedinUrl: record.linkedinUrl,
    // Day-of-event phone, dietary needs, and officer notes are the sensitive half of a
    // roster row. `/dashboard/roster` is scope-gated in the router; without the same gate
    // here the guard is theatre — an events-only officer could read every member's phone
    // number and every note written about them straight from the bootstrap payload.
    phone: input.canSeeContact ? record.phone : '',
    dietary: input.canSeeContact ? record.dietary : '',
    notes: input.canSeeContact ? record.notes : '',
    joinedAt: record.joinedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy,
    attendanceCount: participation.attendanceCount,
    rsvpCount: participation.rsvpCount,
    lastAttendedAt: participation.lastAttendedAt,
  }

  const access = consentedAccessView({
    profile: record.access,
    preferredName: record.preferredName || record.firstName,
    readerEmail: input.readerEmail,
    now: input.now,
    // The roster is not "an event being planned", so there is no event for an
    // `appliesTo: 'rsvp-only'` consent to attach to — and `false` is the honest answer.
    // Passing "has a going RSVP to anything, ever" instead would silently widen a consent
    // scoped to individual rooms into a permanent roster-wide disclosure: one meeting
    // attended in September would expose that profile to all four leads every month after.
    // The per-event surface (EventAccessChecklist) resolves this correctly, per event.
    hasGoingRsvpForEvent: false,
  })

  return access ? { ...row, access } : row
}

/** The member wrote this note for the leads they named, and for nobody else. */
const adminRsvpView = (rsvp: EventRsvp, readerIsLead: boolean): EventRsvp => ({
  id: rsvp.id,
  eventId: rsvp.eventId,
  email: rsvp.email,
  response: rsvp.response,
  guestCount: rsvp.guestCount,
  accommodationNote: rsvp.shareAccommodationWithLeads && readerIsLead ? rsvp.accommodationNote : '',
  shareAccommodationWithLeads: rsvp.shareAccommodationWithLeads,
  respondedAt: rsvp.respondedAt,
  checkedInAt: rsvp.checkedInAt,
  checkedInBy: rsvp.checkedInBy,
})

const unprocessedIntakeRows = (workspace: PortalWorkspace): UnprocessedIntakeRow[] => {
  // "Triaged" means an officer has actually looked at this person — not merely that a
  // profile row exists. A member who fills in their own school and class year (which Member
  // Home actively invites them to do) creates that row themselves; keying the queue on
  // row-existence alone made them silently vanish from the Festifall landing zone before
  // anyone had admitted them. A self-created, still-prospect row is exactly the state the
  // queue exists to surface, so it stays until an officer moves it.
  const triaged = new Set(
    workspace.memberProfiles
      .filter((profile) => !(profile.source === 'self-signup' && profile.status === 'prospect'))
      .map((profile) => profile.email),
  )
  const withProfile = new Set(workspace.memberProfiles.map((profile) => profile.email))
  const untriagedProfiles = workspace.memberProfiles
    .filter((profile) => !triaged.has(profile.email))
    .map((profile) => ({
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      uniqname: profile.uniqname,
      createdAt: profile.createdAt,
    }))

  return workspace.accounts
    // withPreviewAdmin force-injects this account on every read in every environment, so it
    // is never evidence of a real signup and must never sit in the Festifall intake queue.
    .filter((account) => account.email !== SUPER_ADMIN_EMAIL && !withProfile.has(account.email))
    .sort((left, right) => (left.createdAt || '').localeCompare(right.createdAt || ''))
    .map((account) => ({
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      uniqname: account.uniqname,
      createdAt: account.createdAt,
    }))
    .concat(untriagedProfiles)
    .sort((left, right) => (left.createdAt || '').localeCompare(right.createdAt || ''))
}

const portalBackendStatus = (dashboard: DashboardData | null): DashboardBackendStatus => (
  dashboard?.backendStatus || {
    source: process.env.BLOB_READ_WRITE_TOKEN ? 'vercel' : 'preview',
    message: process.env.BLOB_READ_WRITE_TOKEN
      ? 'Loaded portal data from the private Vercel Blob backend.'
      : 'Loaded from durable local preview storage. Data lives in .ublda-local-data and survives dev-server restarts.',
    updatedAt: new Date().toISOString(),
  }
)

const recruitingPulseFor = async (dashboard: DashboardData | null): Promise<RecruitingPulse> => {
  if (dashboard) {
    const candidates = dashboard.candidates || []
    const covered = new Set<string>()
    ;(dashboard.interviewerAvailability || []).forEach((interviewer) => {
      const slots = Array.isArray(interviewer.availability) ? interviewer.availability : []
      slots.forEach((slot) => covered.add(slot))
    })

    return {
      candidateCount: candidates.length,
      unmatchedCount: candidates.filter((candidate) => !candidate.assignedSlot).length,
      uncoveredSlots: INTERVIEW_SLOTS.filter((slot) => !covered.has(slot.value)).length,
      scheduledCount: candidates.filter((candidate) => Boolean(candidate.assignedSlot)).length,
    }
  }

  // The local super-admin HMAC token carries no store session, so the role-scoped recruiting
  // payload does not exist for it. Slot coverage is still readable; candidate counts are not,
  // exactly as the existing localSuperAdminDashboardPayload() already behaves.
  const slots = await portalStore().publicInterviewSlots()
  return {
    candidateCount: 0,
    unmatchedCount: 0,
    uncoveredSlots: slots.filter((slot) => slot.interviewerCount === 0).length,
    scheduledCount: slots.filter((slot) => slot.isBooked).length,
  }
}

/**
 * Consented access needs, resolved PER EVENT — the only context in which an
 * `appliesTo: 'rsvp-only'` consent is allowed to resolve, because it is the only place
 * there is an "event being planned" (§3.4). Recomputed on every read from live profiles,
 * so a withdrawal takes effect immediately and nothing derived is ever cached.
 */
const eventAccessFor = (input: {
  workspace: PortalWorkspace
  readerEmail: string
  now: string
}): Record<string, ConsentedAccessView[]> => {
  const byEvent: Record<string, ConsentedAccessView[]> = {}
  const profileByEmail = new Map(input.workspace.memberProfiles.map((row) => [row.email, row]))

  input.workspace.clubEvents.forEach((event) => {
    const views: ConsentedAccessView[] = []

    input.workspace.eventRsvps
      .filter((rsvp) => rsvp.eventId === event.id && rsvp.response === 'going')
      .forEach((rsvp) => {
        const record = profileByEmail.get(rsvp.email)
        if (!record) return

        const view = consentedAccessView({
          profile: record.access,
          preferredName: record.preferredName || record.firstName,
          readerEmail: input.readerEmail,
          now: input.now,
          hasGoingRsvpForEvent: true,
        })
        if (view) views.push(view)
      })

    byEvent[event.id] = views
  })

  return byEvent
}

const adminWorkspaceFor = async (input: {
  actor: PortalActor
  workspace: PortalWorkspace
  dashboard: DashboardData | null
  now: string
}): Promise<AdminWorkspace> => {
  const readerIsLead = isAccessLead(input.actor.email)

  return {
    members: input.workspace.memberProfiles.map((record) => memberAdminRow({
      record,
      rsvps: input.workspace.eventRsvps,
      readerEmail: input.actor.email,
      now: input.now,
      canSeeContact: input.actor.isSuperAdmin || input.actor.scopes.includes('members'),
    })),
    unprocessedIntake: unprocessedIntakeRows(input.workspace),
    events: [...input.workspace.clubEvents].sort(byStartsAt),
    rsvps: input.workspace.eventRsvps.map((rsvp) => adminRsvpView(rsvp, readerIsLead)),
    announcements: [...input.workspace.announcements],
    resources: [...input.workspace.resources],
    eventAccess: eventAccessFor({
      workspace: input.workspace,
      readerEmail: input.actor.email,
      now: input.now,
    }),
    recruitingPulse: await recruitingPulseFor(input.dashboard),
    backendStatus: portalBackendStatus(input.dashboard),
    launchReadiness: buildLaunchReadiness(),
    // Super-admin only, and the live stored roles — not the static ADMIN_ACCOUNTS constant.
    // A grantRole to someone outside that constant is real, so the screen that manages
    // access has to be able to see it and take it back.
    adminAccounts: input.actor.isSuperAdmin
      ? input.workspace.accounts
        .filter((account) => account.role !== 'member')
        .sort((left, right) => left.email.localeCompare(right.email))
      : [],
  }
}

const buildBootstrap = async (context: ActionContext): Promise<MemberBootstrap | AdminBootstrap> => {
  const workspace = await portalStore().listPortalWorkspace()
  const core = memberBootstrapCore({ actor: context.actor, workspace, now: context.now })

  if (!context.actor.isAdmin) {
    // Two disjoint literals. A member payload has no `admin` key at all.
    return { role: 'member', ...core }
  }

  return {
    role: context.actor.isSuperAdmin ? 'super-admin' : 'exec',
    ...core,
    scopes: [...context.actor.scopes],
    canPublish: context.actor.canPublish,
    admin: await adminWorkspaceFor({
      actor: context.actor,
      workspace,
      dashboard: context.dashboard,
      now: context.now,
    }),
  }
}

// ── Roster export ─────────────────────────────────────────────────────────────

const csvCell = (value: string) => (
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
)

/** No access data, no accommodation note, no contact number, no admin note. Ever. */
const ROSTER_EXPORT_COLUMNS: { header: string; read: (row: MemberAdminRow) => string }[] = [
  { header: 'Email', read: (row) => row.email },
  { header: 'First name', read: (row) => row.firstName },
  { header: 'Last name', read: (row) => row.lastName },
  { header: 'Preferred name', read: (row) => row.preferredName },
  { header: 'Pronouns', read: (row) => row.pronouns },
  { header: 'Uniqname', read: (row) => row.uniqname },
  { header: 'Status', read: (row) => row.status },
  { header: 'Source', read: (row) => row.source },
  { header: 'Year', read: (row) => row.year },
  { header: 'School', read: (row) => row.school },
  { header: 'Major', read: (row) => row.major },
  { header: 'Graduation year', read: (row) => row.gradYear },
  { header: 'Interests', read: (row) => row.interests.join('; ') },
  { header: 'LinkedIn', read: (row) => row.linkedinUrl },
  { header: 'Dietary', read: (row) => row.dietary },
  { header: 'Joined', read: (row) => row.joinedAt },
  { header: 'Last attended', read: (row) => row.lastAttendedAt },
  { header: 'Events attended', read: (row) => String(row.attendanceCount) },
  { header: 'RSVPs', read: (row) => String(row.rsvpCount) },
  { header: 'Updated', read: (row) => row.updatedAt },
]

const rosterCsv = (rows: MemberAdminRow[]) => {
  const lines = [ROSTER_EXPORT_COLUMNS.map((column) => csvCell(column.header)).join(',')]
  rows.forEach((row) => {
    lines.push(ROSTER_EXPORT_COLUMNS.map((column) => csvCell(column.read(row))).join(','))
  })
  return `${lines.join('\n')}\n`
}

// ── Action registry ───────────────────────────────────────────────────────────

const ACTION_REGISTRY = new Map<string, RegistryEntry>([
  ['portal.bootstrap', {
    access: 'member',
    run: async (context) => done({ ...await buildBootstrap(context) }),
  }],

  ['member.saveProfile', {
    access: 'member',
    run: async ({ actor, payload }) => {
      const validated = validateMemberSelfPayload(payload)
      if (!validated.success) return validationFailure(validated.errors, 'That profile update did not save.')

      const record = await portalStore().saveMemberProfile(
        actor.email,
        validated.data,
        auditActor(actor),
        { audit: false },
      )

      return done({ profile: toMemberSelfProfile(record) })
    },
  }],

  ['member.saveAccess', {
    access: 'member',
    run: async ({ actor, payload }) => {
      const validated = validateAccessProfilePayload(payload)
      if (!validated.success) return validationFailure(validated.errors, 'That access profile did not save.')

      // Self only. The caller's own email is the key; no email is read from the payload.
      const record = await portalStore().saveMemberAccess(actor.email, validated.data, auditActor(actor))
      return done({ access: record.access })
    },
  }],

  ['member.withdrawAccessConsent', {
    access: 'member',
    run: async ({ actor }) => {
      const record = await portalStore().withdrawMemberAccessConsent(actor.email, auditActor(actor))
      return done({ access: record.access })
    },
  }],

  ['event.rsvp', {
    access: 'member',
    run: async ({ actor, payload }) => {
      const validated = validateRsvpPayload(payload)
      if (!validated.success) return validationFailure(validated.errors, 'That RSVP did not save.')

      // Always the caller's row, whatever email the payload carried.
      const result = await portalStore().saveEventRsvp(actor.email, validated.data)
      if (!result.ok) return blockedFailure(result.blockers, 'That RSVP did not save.')

      return done({
        rsvp: toEventRsvpSelfView(result.rsvp),
        event: buildClubEventPublicView({
          event: result.event,
          rsvpCount: result.rsvpCount,
          yourRsvp: result.rsvp,
        }),
      })
    },
  }],

  ['admin.member.upsert', {
    access: 'admin',
    scope: 'members',
    run: async ({ actor, payload, now }) => {
      const validated = validateMemberAdminPayload(payload)
      if (!validated.success) return validationFailure(validated.errors, 'That member did not save.')

      const email = validated.data.email || ''
      const record = await portalStore().saveMemberProfile(email, validated.data, auditActor(actor))
      const workspace = await portalStore().listPortalWorkspace()

      return done({
        member: memberAdminRow({
          record,
          rsvps: workspace.eventRsvps,
          readerEmail: actor.email,
          now,
          // This action is already gated on the `members` scope.
          canSeeContact: true,
        }),
      })
    },
  }],

  ['admin.member.bulkAdmit', {
    access: 'admin',
    scope: 'members',
    run: async ({ actor, payload, now }) => {
      const errors: string[] = []
      const requested = readStringList(payload, 'emails').map((email) => email.toLowerCase())
      const emails = requested.filter((email) => emailPattern.test(email))
      const status = readString(payload, 'status')
      const source = readString(payload, 'source')
      const year = readString(payload, 'year')
      const school = readString(payload, 'school')

      if (requested.length === 0) errors.push('Choose at least one person to admit.')
      if (requested.length > BULK_ADMIT_LIMIT) errors.push(`Admit ${BULK_ADMIT_LIMIT} people or fewer at a time.`)
      if (requested.length > 0 && emails.length === 0) errors.push('None of those were valid email addresses.')
      if (!MEMBER_STATUSES.some((option) => option === status)) errors.push('Choose a member status from the list.')
      if (!MEMBER_SOURCES.some((option) => option === source)) errors.push('Choose where these members came from.')
      if (year && !MEMBER_YEARS.some((option) => option === year)) errors.push('Choose a year from the list.')
      if (school && !MEMBER_SCHOOLS.some((option) => option === school)) errors.push('Choose a school from the list.')

      if (errors.length > 0) return validationFailure(errors, 'That intake batch did not save.')

      const admitted = await portalStore().bulkAdmitMembers({
        emails,
        status: status as MemberStatus,
        source: source as MemberSource,
        year: year as MemberYear,
        school: school as MemberSchool,
      }, auditActor(actor))

      const workspace = await portalStore().listPortalWorkspace()

      return done({
        members: admitted.map((record) => memberAdminRow({
          record,
          rsvps: workspace.eventRsvps,
          readerEmail: actor.email,
          now,
          // Gated on the `members` scope.
          canSeeContact: true,
        })),
      })
    },
  }],

  ['admin.event.upsert', {
    access: 'admin',
    scope: 'events',
    run: async ({ actor, payload }) => {
      const validated = validateClubEventPayload(payload)
      if (!validated.success) return validationFailure(validated.errors, 'That event did not save.')

      // `status` is not part of ClubEventData: a create forces 'draft' and an edit keeps
      // whatever the event already had. Publishing has its own gated action.
      const event = await portalStore().saveClubEvent(validated.data, auditActor(actor))
      return done({ event })
    },
  }],

  ['admin.event.publish', {
    access: 'admin',
    scope: 'events',
    publisher: true,
    run: async ({ actor, payload }) => {
      const eventId = readString(payload, 'eventId')
      if (!eventId) return validationFailure(['Choose an event to publish.'], 'That event did not publish.')

      const result = await portalStore().publishClubEvent(eventId, auditActor(actor))
      if (!result.ok) return blockedFailure(result.blockers, 'That event did not publish.')

      return done({ event: result.event })
    },
  }],

  ['admin.event.cancel', {
    access: 'admin',
    scope: 'events',
    run: async ({ actor, payload }) => {
      const eventId = readString(payload, 'eventId')
      if (!eventId) return validationFailure(['Choose an event to cancel.'], 'That event did not cancel.')

      const result = await portalStore().cancelClubEvent(eventId, readString(payload, 'reason'), auditActor(actor))
      if (!result.ok) return blockedFailure(result.blockers, 'That event did not cancel.')

      return done({ event: result.event })
    },
  }],

  ['admin.event.checkIn', {
    access: 'admin',
    scope: 'events',
    run: async ({ actor, payload }) => {
      const errors: string[] = []
      const eventId = readString(payload, 'eventId')
      const email = readEmail(payload, 'email')

      if (!eventId) errors.push('Choose an event to check people into.')
      if (!emailPattern.test(email)) errors.push('A valid member email is required.')
      if (typeof payload.checkedIn !== 'boolean') errors.push('Say whether this person is checked in.')
      if (errors.length > 0) return validationFailure(errors, 'That check-in did not save.')

      const result = await portalStore().checkInMember(
        eventId,
        email,
        payload.checkedIn === true,
        auditActor(actor),
      )
      if (!result.ok) return blockedFailure(result.blockers, 'That check-in did not save.')

      return done({ rsvp: result.rsvp })
    },
  }],

  ['admin.announcement.upsert', {
    access: 'admin',
    scope: 'announcements',
    run: async ({ actor, payload }) => {
      const validated = validateAnnouncementPayload(payload)
      if (!validated.success) return validationFailure(validated.errors, 'That announcement did not save.')

      const announcement = await portalStore().saveAnnouncement(validated.data, auditActor(actor))
      return done({ announcement })
    },
  }],

  ['admin.announcement.publish', {
    access: 'admin',
    scope: 'announcements',
    publisher: true,
    run: async ({ actor, payload }) => {
      const errors: string[] = []
      const id = readString(payload, 'id')
      const status = readString(payload, 'status')

      if (!id) errors.push('Choose an announcement.')
      if (status !== 'published' && status !== 'archived') errors.push('Choose publish or archive.')
      if (errors.length > 0) return validationFailure(errors, 'That announcement did not publish.')

      const result = await portalStore().publishAnnouncement(
        id,
        status === 'archived' ? 'archived' : 'published',
        auditActor(actor),
      )
      if (!result.ok) return blockedFailure(result.blockers, 'That announcement did not publish.')

      return done({ announcement: result.announcement })
    },
  }],

  ['admin.resource.upsert', {
    access: 'admin',
    scope: 'resources',
    run: async ({ actor, payload }) => {
      const validated = validatePortalResourcePayload(payload)
      if (!validated.success) return validationFailure(validated.errors, 'That resource did not save.')

      const resource = await portalStore().savePortalResource(validated.data, auditActor(actor))
      return done({ resource })
    },
  }],

  ['admin.resource.reorder', {
    access: 'admin',
    scope: 'resources',
    run: async ({ actor, payload }) => {
      const ids = readStringList(payload, 'ids')
      if (ids.length === 0) return validationFailure(['Send the new order of the library.'], 'The library did not reorder.')
      if (ids.length > RESOURCE_REORDER_LIMIT) {
        return validationFailure([`Reorder ${RESOURCE_REORDER_LIMIT} resources or fewer at a time.`], 'The library did not reorder.')
      }

      const resources = await portalStore().reorderPortalResources(ids, auditActor(actor))
      return done({ resources })
    },
  }],

  ['admin.export', {
    access: 'admin',
    superAdmin: true,
    run: async ({ actor, payload, now }) => {
      if (readString(payload, 'kind') !== 'roster') {
        return validationFailure(['The roster is the only export.'], 'That export is not available.')
      }

      const workspace = await portalStore().listPortalWorkspace()
      const rows = workspace.memberProfiles.map((record) => memberAdminRow({
        record,
        rsvps: workspace.eventRsvps,
        readerEmail: actor.email,
        now,
        // super-admin only; the CSV builder drops phone/notes/access regardless.
        canSeeContact: true,
      }))
      const filename = `ublda-roster-${now.slice(0, 10)}.csv`

      await portalStore().appendAuditEntry({
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'admin.export',
        targetType: 'member',
        targetId: 'roster',
        summary: `Exported the roster (${rows.length} member${rows.length === 1 ? '' : 's'}).`,
      })

      return done({ filename, csv: rosterCsv(rows) })
    },
  }],

  ['admin.grantRole', {
    access: 'admin',
    superAdmin: true,
    run: async ({ actor, payload }) => {
      const errors: string[] = []
      const email = readEmail(payload, 'email')
      const role = readString(payload, 'role')
      const scopes = readStringList(payload, 'scopes')
      const title = readString(payload, 'title')

      if (!emailPattern.test(email)) errors.push('A valid email address is required.')
      if (!DASHBOARD_ROLES.some((option) => option === role)) errors.push('Choose a role from the list.')
      if (scopes.some((scope) => !ADMIN_SCOPES.some((option) => option === scope))) {
        errors.push('One of those permissions is not on the list.')
      }
      // Changing your own row is the one way to lock the club out of its own console.
      if (email && email === actor.email) errors.push('Ask the other co-president to change your own role.')
      if (errors.length > 0) return validationFailure(errors, 'That role change did not save.')

      const result = await portalStore().grantAccountRole({
        email,
        role: role === 'super-admin' || role === 'exec' ? role : 'member',
        scopes: scopes as AdminScope[],
        title: title || undefined,
      }, auditActor(actor))
      if (!result.ok) return blockedFailure(result.blockers, 'That role change did not save.')

      return done({ account: result.account })
    },
  }],

  ['admin.audit.list', {
    access: 'admin',
    superAdmin: true,
    run: async ({ payload }) => {
      const requested = typeof payload.limit === 'number' && Number.isFinite(payload.limit)
        ? Math.trunc(payload.limit)
        : 100

      return done({ entries: await portalStore().readAuditLog(requested) })
    },
  }],
])

// ── Dispatcher ────────────────────────────────────────────────────────────────

const gateFor = (entry: RegistryEntry, result: PortalSessionResult): PortalSessionResult => {
  let gated = result
  if (entry.access === 'admin') gated = requireAdmin(gated)
  if (entry.scope) gated = requireScope(gated, entry.scope)
  if (entry.superAdmin) gated = requireSuperAdmin(gated)
  if (entry.publisher) gated = requirePublisher(gated)
  return gated
}

const errorResponse = (action: string, error: unknown, fallback: string): PortalHttpResponse => {
  logRecruitingError('portal_action_failed', error, { action })
  const code = recruitingErrorCode(error)

  return {
    status: recruitingErrorStatus(error),
    body: {
      error: recruitingErrorMessage(error, fallback),
      ...(code ? { code } : {}),
    },
  }
}

export const portalActionNames = () => Array.from(ACTION_REGISTRY.keys())

export const handlePortalRequest = async (request: PortalHttpRequest): Promise<PortalHttpResponse> => {
  if ((request.method || '').toUpperCase() !== 'POST') {
    return { status: 405, body: { error: 'Method not allowed' } }
  }

  const body = asRecord(request.body)
  const action = readString(body, 'action')
  const entry = ACTION_REGISTRY.get(action)

  if (!entry) {
    return { status: 400, body: { error: 'That portal action is not available.' } }
  }

  let resolution: PortalSessionResolution
  try {
    resolution = await resolvePortalSession(readString(body, 'sessionToken'))
  } catch (error) {
    return errorResponse(action, error, 'The portal could not read your session.')
  }

  const gated = gateFor(entry, resolution.result)
  if (!gated.authorized) {
    return { status: gated.status, body: { error: gated.error } }
  }

  try {
    const result = await entry.run({
      actor: gated.actor,
      payload: asRecord(body.payload),
      dashboard: resolution.dashboard,
      now: new Date().toISOString(),
    })

    if (result.ok) {
      return { status: 200, body: { success: true, action, data: result.data } }
    }

    return {
      status: result.status,
      body: {
        error: result.error,
        ...(result.errors ? { errors: result.errors } : {}),
        ...(result.blockers ? { blockers: result.blockers } : {}),
      },
    }
  } catch (error) {
    return errorResponse(action, error, 'That change did not save. Try again in a moment.')
  }
}
