import { createHash, randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BlobPreconditionFailedError, del, get, put } from '@vercel/blob'
import bcrypt from 'bcryptjs'
import type { ApplicantAccount, ApplicantApplicationSummary } from '../src/lib/applicantAccount.ts'
import type { ApplicationSubmission } from '../src/lib/application.ts'
import type { InterviewAssignmentSubmission } from '../src/lib/interviewAssignment.ts'
import type { InterviewerAvailabilitySubmission } from '../src/lib/interviewerAvailability.ts'
import type { InterviewBookingSubmission, PublicInterviewSlot } from '../src/lib/interviewBooking.ts'
import type { AdminScope, DashboardRole, PortalAccountSummary } from '../src/lib/dashboardAccess.ts'
import {
  ADMIN_ACCOUNTS,
  ADMIN_SCOPES,
  adminAccountForEmail,
  effectiveRoleForAccount,
  scopesForEmail,
} from '../src/lib/dashboardAccess.ts'
import type { DashboardCalendarEvent, DashboardData } from '../src/lib/dashboardData.ts'
import { INTERVIEW_SLOTS, getInterviewSlotByValue } from '../src/lib/interviews.ts'
import type { Candidate, InterviewerAvailability, MemberSignup } from '../src/lib/memberData.ts'
import type { AccessProfileInput } from '../src/lib/portalAccess.ts'
import {
  buildAccessProfile,
  normalizeAccessProfile,
  withdrawAccessProfile,
} from '../src/lib/portalAccess.ts'
import type { AuditEntry, PortalAuditActor } from '../src/lib/portalAudit.ts'
import { appendAudit, buildAuditEntry, readAuditEntries } from '../src/lib/portalAudit.ts'
import type {
  MemberInterest,
  MemberProfileRecord,
  MemberSchool,
  MemberSource,
  MemberStatus,
  MemberYear,
} from '../src/lib/portalMembers.ts'
import {
  BULK_ADMIT_LIMIT,
  applyMemberProfilePatch,
  buildMemberProfileRecord,
  memberDisplayName,
  normalizeMemberProfileRecord,
} from '../src/lib/portalMembers.ts'
import type { ClubEvent, ClubEventData, EventRsvp, RsvpData } from '../src/lib/portalEvents.ts'
import {
  buildClubEvent,
  buildEventRsvp,
  canPublishEvent,
  isRsvpOpen,
  mergeClubEvent,
  rsvpKey,
} from '../src/lib/portalEvents.ts'
import type { AnnouncementData, PortalAnnouncement } from '../src/lib/portalAnnouncements.ts'
import { buildAnnouncement, mergeAnnouncement } from '../src/lib/portalAnnouncements.ts'
import type { PortalResource, PortalResourceData } from '../src/lib/portalResources.ts'
import { buildPortalResource, mergePortalResource, sortPortalResources } from '../src/lib/portalResources.ts'
import { buildLaunchReadiness } from './launchReadiness.ts'

type StoredAccount = ApplicantAccount & {
  createdAt: string
  updatedAt: string
  sessionToken: string
  sessionExpiresAt: string
  passwordSalt: string
  passwordHash: string
  application: ApplicantApplicationSummary | null
}

type StoredInterviewerAvailability = InterviewerAvailability & {
  email: string
  uniqname: string
  notes: string
  availabilitySummary: string
  updatedAt: string
  submissionCount: number
}

type StoredSession = {
  email: string
  expiresAt: string
}

type StoredRateLimit = {
  count: number
  resetAt: number
}

type StoredResume = {
  email: string
  fileName: string
  mimeType: string
  size: number
  storageKey: string
  storageKind: 'blob' | 'local'
  uploadedAt: string
}

type LocalRecruitingData = {
  version: 1
  accounts: Record<string, StoredAccount>
  sessions: Record<string, StoredSession>
  candidates: Record<string, Candidate>
  interviewerAvailability: Record<string, StoredInterviewerAvailability>
  calendarEvents: Record<string, DashboardCalendarEvent>
  rateLimits: Record<string, StoredRateLimit>
  resumes: Record<string, StoredResume>
  // ── portal ──
  memberProfiles: Record<string, MemberProfileRecord>
  clubEvents: Record<string, ClubEvent>
  eventRsvps: Record<string, EventRsvp>
  announcements: Record<string, PortalAnnouncement>
  portalResources: Record<string, PortalResource>
  auditLog: AuditEntry[]
}

/** Never carries a password hash or a session token. */
export type { PortalAccountSummary } from '../src/lib/dashboardAccess.ts'

export type PortalWorkspace = {
  accounts: PortalAccountSummary[]
  memberProfiles: MemberProfileRecord[]
  clubEvents: ClubEvent[]
  eventRsvps: EventRsvp[]
  announcements: PortalAnnouncement[]
  resources: PortalResource[]
}

export type PortalWriteResult<T> =
  | ({ ok: true } & T)
  | { ok: false; blockers: string[] }

export type BulkAdmitInput = {
  emails: string[]
  status: MemberStatus
  source: MemberSource
  year?: MemberYear
  school?: MemberSchool
  interests?: MemberInterest[]
}

type BlobReadResult = {
  data: LocalRecruitingData
  etag: string | null
}

export type LocalAccountResponse = {
  account: ApplicantAccount
  sessionToken: string
  application: ApplicantApplicationSummary | null
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
const BCRYPT_COST = 12
const PASSWORD_HASH_ALGORITHM = 'bcrypt'
const BLOB_STATE_PATH = 'recruiting/state.json'
const BLOB_SLOT_LOCK_PREFIX = 'recruiting/slot-locks'
const BLOB_RESUME_PREFIX = 'recruiting/resumes'
export const LOCAL_PREVIEW_SESSION_TOKEN = 'local-preview-session-token'
const mutationQueues = new Map<string, Promise<unknown>>()
const BLOB_WRITE_MAX_ATTEMPTS = 5
const BLOB_READ_MAX_ATTEMPTS = 3
const BLOB_READ_RETRY_DELAY_MS = 250
const BOOKING_LOCK_TTL_MS = 1000 * 60 * 10
type RecruitingBlobClient = {
  get: typeof get
  put: typeof put
  del: typeof del
}
const defaultBlobClient: RecruitingBlobClient = { get, put, del }
let recruitingBlobClient = defaultBlobClient

export const setRecruitingBlobClientForTests = (client?: RecruitingBlobClient) => {
  recruitingBlobClient = client || defaultBlobClient
}

const emptyData = (): LocalRecruitingData => ({
  version: 1,
  accounts: {},
  sessions: {},
  candidates: {},
  interviewerAvailability: {},
  calendarEvents: {},
  rateLimits: {},
  resumes: {},
  memberProfiles: {},
  clubEvents: {},
  eventRsvps: {},
  announcements: {},
  portalResources: {},
  auditLog: [],
})

const shouldSeedLowDemandTestSignups = () => (
  process.env.UBLDA_ENABLE_TEST_SIGNUPS === 'true'
)

type SeededIntervieweeBooking = {
  id: string
  email: string
  firstName: string
  lastName: string
  program: string
  slotStart: string
  rolePreferences: string[]
  feedback: string
  resumeFileName?: string
}

const seededIntervieweeBookings: SeededIntervieweeBooking[] = [
  {
    id: 'seeded-shado-placeholder',
    email: 'shado-preserved-slot@example.com',
    firstName: 'Shado',
    lastName: 'Placeholder',
    program: 'Preserved occupied interview slot',
    slotStart: '2026-05-07T08:50:00-04:00',
    rolePreferences: ['Outreach and Partnerships'],
    feedback: 'Seeded Shado placeholder booking.',
  },
  {
    id: 'low-demand-test-1',
    email: 'low-demand-test-1@example.com',
    firstName: 'Avery',
    lastName: 'Lowell',
    program: 'Low-demand test signup',
    slotStart: '2026-05-07T09:40:00-04:00',
    rolePreferences: ['Events and Programming', 'Marketing and Social Media'],
    feedback: 'Seeded low-demand test booking.',
    resumeFileName: 'booking_low_demand_seed_1_1778097247067-low-demand-test-resume.pdf',
  },
  {
    id: 'low-demand-test-2',
    email: 'low-demand-test-2@example.com',
    firstName: 'Morgan',
    lastName: 'Vale',
    program: 'Low-demand test signup',
    slotStart: '2026-05-07T21:20:00-04:00',
    rolePreferences: ['Marketing and Social Media', 'Outreach and Partnerships'],
    feedback: 'Seeded low-demand test booking.',
    resumeFileName: 'booking_low_demand_seed_2_1778097247068-low-demand-test-resume.pdf',
  },
  {
    id: 'low-demand-test-3',
    email: 'low-demand-test-3@example.com',
    firstName: 'Riley',
    lastName: 'Stone',
    program: 'Low-demand test signup',
    slotStart: '2026-05-08T08:00:00-04:00',
    rolePreferences: ['Outreach and Partnerships', 'Events and Programming'],
    feedback: 'Seeded low-demand test booking.',
    resumeFileName: 'booking_low_demand_seed_3_1778097247069-low-demand-test-resume.pdf',
  },
  {
    id: 'low-demand-test-4',
    email: 'low-demand-test-4@example.com',
    firstName: 'Casey',
    lastName: 'Reed',
    program: 'Low-demand test signup',
    slotStart: '2026-05-08T20:30:00-04:00',
    rolePreferences: ['Events and Programming', 'Outreach and Partnerships'],
    feedback: 'Seeded low-demand test booking.',
    resumeFileName: 'booking_low_demand_seed_4_1778097247070-low-demand-test-resume.pdf',
  },
  {
    id: 'low-demand-test-5',
    email: 'low-demand-test-5@example.com',
    firstName: 'Jamie',
    lastName: 'Park',
    program: 'Low-demand test signup',
    slotStart: '2026-05-09T08:00:00-04:00',
    rolePreferences: ['Marketing and Social Media'],
    feedback: 'Seeded low-demand test booking.',
    resumeFileName: 'booking_low_demand_seed_5_1778097247071-low-demand-test-resume.pdf',
  },
  {
    id: 'low-demand-test-6',
    email: 'low-demand-test-6@example.com',
    firstName: 'Taylor',
    lastName: 'Brooks',
    program: 'Low-demand test signup',
    slotStart: '2026-05-09T21:20:00-04:00',
    rolePreferences: ['Outreach and Partnerships'],
    feedback: 'Seeded low-demand test booking.',
    resumeFileName: 'booking_low_demand_seed_6_1778097247071-low-demand-test-resume.pdf',
  },
]

const seededIntervieweeEmails = new Set(seededIntervieweeBookings.map((booking) => booking.email))

const interviewersForSlot = (data: LocalRecruitingData, slotValue: string) => (
  Object.values(data.interviewerAvailability)
    .filter((interviewer) => Array.isArray(interviewer.availability) && interviewer.availability.includes(slotValue))
    .map((interviewer) => interviewer.name)
    .sort((left, right) => left.localeCompare(right))
)

const seedLowDemandTestSignups = (data: LocalRecruitingData, force = false) => {
  if (!force && !shouldSeedLowDemandTestSignups()) return

  seededIntervieweeBookings.forEach((booking) => {
    const slot = INTERVIEW_SLOTS.find((candidateSlot) => candidateSlot.start === booking.slotStart)
    if (!slot) return
    const resume = localSeededResume(booking, force)
    if (resume && !data.resumes[booking.email]) {
      data.resumes[booking.email] = resume
    }

    const slotAlreadyBooked = Object.values(data.candidates).some((candidate) => (
      candidate.email !== booking.email && candidate.assignedSlot === slot.value
    ))
    if (slotAlreadyBooked || data.candidates[booking.email]) {
      return
    }

    data.candidates[booking.email] = {
      id: booking.id,
      name: `${booking.firstName} ${booking.lastName}`,
      program: booking.program,
      email: booking.email,
      rolePreferences: booking.rolePreferences,
      status: 'Invited',
      availability: [slot.value],
      resumeUrl: resume || data.resumes[booking.email] ? resumeUrlForEmail(booking.email) : '',
      assignedSlot: slot.value,
      interviewers: interviewersForSlot(data, slot.value).slice(0, 2),
      feedback: booking.feedback,
    }
  })
}

const isSeededVolatileCandidate = (candidate: Candidate | undefined) => (
  Boolean(candidate && seededIntervieweeEmails.has(candidate.email) && (
    candidate.id === 'seeded-shado-placeholder' ||
    candidate.id.startsWith('low-demand-test-') ||
    candidate.feedback === 'Seeded low-demand test booking.' ||
    candidate.feedback === 'Seeded Shado placeholder booking.'
  ))
)

const persistableRecruitingData = (data: LocalRecruitingData) => {
  const cloned = JSON.parse(JSON.stringify(data)) as LocalRecruitingData
  seededIntervieweeEmails.forEach((email) => {
    if (isSeededVolatileCandidate(cloned.candidates[email])) {
      delete cloned.candidates[email]
    }
    delete cloned.resumes?.[email]
  })
  return cloned
}

const isStaleBookingLock = (raw: string) => {
  try {
    const lock = JSON.parse(raw) as { createdAt?: unknown }
    const createdAt = typeof lock.createdAt === 'string' ? Date.parse(lock.createdAt) : Number.NaN
    return Number.isFinite(createdAt) && Date.now() - createdAt > BOOKING_LOCK_TTL_MS
  } catch {
    return false
  }
}

const defaultDataPath = () => (
  process.env.UBLDA_LOCAL_DATA_FILE ||
  path.join(process.cwd(), '.ublda-local-data', 'recruiting.json')
)

const shouldUseBlobStorage = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN)

const sessionExpiresAt = () => new Date(Date.now() + SESSION_TTL_MS).toISOString()

const legacyHashPassword = (password: string, salt = randomBytes(16).toString('base64url')) => ({
  salt,
  hash: pbkdf2Sync(password, salt, 120_000, 32, 'sha256').toString('base64url'),
})

const hashPassword = (password: string) => ({
  salt: PASSWORD_HASH_ALGORITHM,
  hash: bcrypt.hashSync(password, BCRYPT_COST),
})

const constantTimeEquals = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

const verifyPassword = (password: string, salt: string, expectedHash: string) => {
  if (!salt || !expectedHash) return false
  if (salt === PASSWORD_HASH_ALGORITHM || expectedHash.startsWith('$2')) {
    return bcrypt.compareSync(password, expectedHash)
  }

  return constantTimeEquals(legacyHashPassword(password, salt).hash, expectedHash)
}

const createSessionToken = () => `local_${Date.now()}_${randomBytes(18).toString('base64url')}`

const decorateAccount = (account: ApplicantAccount): ApplicantAccount => {
  // Elevation requires a verified provider. A password account that merely matches an
  // officer's email resolves to 'member' — see effectiveRoleForAccount.
  const role = effectiveRoleForAccount(account)
  const fallbackAdmin = role === 'member' ? undefined : adminAccountForEmail(account.email)

  return {
    firstName: account.firstName,
    lastName: account.lastName,
    uniqname: account.uniqname,
    email: account.email,
    role,
    adminTitle: account.adminTitle || fallbackAdmin?.title || 'Member',
    // `undefined` means nobody has ever set scopes for this account, so seed from the
    // roster. An explicit `[]` is a deliberate revocation and must survive decoration —
    // treating it as "unset" would silently restore what a super-admin just took away.
    adminScopes: Array.isArray(account.adminScopes)
      ? account.adminScopes
      : role === 'member' ? [] : scopesForEmail(account.email),
    verifiedVia: account.verifiedVia || '',
  }
}

const portalAccountSummary = (account: StoredAccount): PortalAccountSummary => {
  const role = effectiveRoleForAccount(account)

  return {
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    uniqname: account.uniqname,
    role,
    adminTitle: account.adminTitle || (role === 'member' ? 'Member' : adminAccountForEmail(account.email)?.title || 'Exec Admin'),
    // `undefined` means nobody has ever set scopes for this account, so seed from the
    // roster. An explicit `[]` is a deliberate revocation and must survive decoration —
    // treating it as "unset" would silently restore what a super-admin just took away.
    adminScopes: Array.isArray(account.adminScopes)
      ? account.adminScopes
      : role === 'member' ? [] : scopesForEmail(account.email),
    verifiedVia: account.verifiedVia || '',
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }
}

const memberSeedFromAccount = (account: StoredAccount | undefined): Partial<MemberProfileRecord> => (
  account
    ? { firstName: account.firstName, lastName: account.lastName, uniqname: account.uniqname }
    : {}
)

const memberSignupsFromAccounts = (accounts: Record<string, StoredAccount>): MemberSignup[] => (
  Object.values(accounts).map((account) => ({
    id: account.email,
    name: `${account.firstName} ${account.lastName}`.trim() || account.email,
    email: account.email,
    uniqname: account.uniqname,
    status: account.application?.status || 'Local preview account',
    source: 'Local preview accounts',
    updatedAt: account.updatedAt,
    detail: account.application ? `Submissions: ${account.application.submissionCount}` : '',
  }))
)

const statusForDashboard = (status: string): Candidate['status'] => {
  if (status === 'Future role pool') return 'Hold'
  if (status === 'Interview eligible' || status === 'Needs review') return 'Needs match'
  return 'Needs match'
}

const dashboardStatus = (): DashboardData['backendStatus'] => ({
  source: shouldUseBlobStorage() ? 'vercel' : 'preview',
  message: shouldUseBlobStorage()
    ? 'Loaded recruiting data from the private Vercel Blob backend.'
    : 'Loaded from durable local preview storage. Data lives in .ublda-local-data and survives dev-server restarts.',
  updatedAt: new Date().toISOString(),
})

const candidateIdFromEmail = (email: string) => email.replace(/@.*$/, '').replace(/[^a-z0-9._-]+/g, '-').slice(0, 48) || email

const localSeededResume = (booking: SeededIntervieweeBooking, force: boolean): StoredResume | null => {
  if (!force || !booking.resumeFileName) return null

  const storageKey = `${BLOB_RESUME_PREFIX}/${candidateIdFromEmail(booking.email)}/${booking.resumeFileName}`
  const resumePath = path.join(process.cwd(), '.ublda-local-data', storageKey)
  if (!existsSync(resumePath)) return null

  return {
    email: booking.email,
    fileName: booking.resumeFileName,
    mimeType: 'application/pdf',
    size: statSync(resumePath).size,
    storageKey,
    storageKind: 'local',
    uploadedAt: new Date('2026-05-06T19:54:07.000-04:00').toISOString(),
  }
}

const bookingError = (code: string, message: string) => Object.assign(new Error(message), { code })

const sleep = (ms: number) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

const resumeUrlForEmail = (email: string) => `/api/resume?candidate=${encodeURIComponent(email)}`

const safeResumeFileName = (fileName: string) => {
  const fallback = 'resume.pdf'
  const baseName = path.basename(fileName || fallback).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return (baseName || fallback).slice(0, 120)
}

const resumeStorageKey = (email: string, submissionId: string, fileName: string) => (
  `${BLOB_RESUME_PREFIX}/${candidateIdFromEmail(email)}/${submissionId}-${safeResumeFileName(fileName)}`
)

const isBlobWriteConflict = (error: unknown) => (
  error instanceof BlobPreconditionFailedError ||
  (error instanceof Error && /precondition|already exists|overwrite/i.test(error.message))
)

const writableBlobEtag = (etag: string | null | undefined) => etag?.replace(/^W\//, '') || null

const slotLockId = (slotValue: string) => createHash('sha256').update(slotValue).digest('base64url')

const bookingSlotRows = (data: LocalRecruitingData): PublicInterviewSlot[] => (
  INTERVIEW_SLOTS.map((slot) => {
    const interviewers = interviewersForSlot(data, slot.value)
    const bookedCandidate = Object.values(data.candidates).find((candidate) => candidate.assignedSlot === slot.value)

    return {
      value: slot.value,
      label: slot.label,
      dayLabel: slot.dayLabel,
      shortDayLabel: slot.dayLabel.replace(/^.*?, /, ''),
      timeLabel: slot.timeLabel,
      start: slot.start,
      end: slot.end,
      startMinutes: slot.startMinutes,
      interviewerCount: interviewers.length,
      interviewers,
      isBooked: Boolean(bookedCandidate),
      isAvailable: interviewers.length > 0 && !bookedCandidate,
    }
  })
)

const buildDashboardData = (
  data: LocalRecruitingData,
  role: string,
  accountEmail: string,
): DashboardData => {
  const dashboardData: DashboardData = {
    backendStatus: dashboardStatus(),
  }

  if (role === 'super-admin' || role === 'exec') {
    dashboardData.candidates = Object.values(data.candidates)
    dashboardData.interviewerAvailability = Object.values(data.interviewerAvailability)
    dashboardData.memberSignups = memberSignupsFromAccounts(data.accounts)
    dashboardData.adminAccounts = ADMIN_ACCOUNTS
    dashboardData.calendarEvents = Object.values(data.calendarEvents)
    dashboardData.launchReadiness = buildLaunchReadiness()
  } else {
    dashboardData.memberSignups = memberSignupsFromAccounts(data.accounts).filter((member) => member.email === accountEmail)
  }

  return dashboardData
}

export class LocalRecruitingStore {
  private readonly dataPath: string

  constructor(dataPath = defaultDataPath()) {
    this.dataPath = dataPath
  }

  private async readBlobData(): Promise<BlobReadResult> {
    for (let attempt = 0; attempt < BLOB_READ_MAX_ATTEMPTS; attempt += 1) {
      try {
        const blob = await recruitingBlobClient.get(BLOB_STATE_PATH, { access: 'private', useCache: false })
        if (!blob || blob.statusCode !== 200) {
          return { data: this.withPreviewAdmin(emptyData()), etag: null }
        }

        const raw = await new Response(blob.stream).text()
        return {
          data: this.withPreviewAdmin(JSON.parse(raw) as LocalRecruitingData),
          etag: writableBlobEtag(blob.blob.etag),
        }
      } catch {
        if (attempt === BLOB_READ_MAX_ATTEMPTS - 1) {
          throw bookingError(
            'BLOB_UNAVAILABLE',
            'Recruiting storage is temporarily unavailable. Please refresh in a minute.',
          )
        }

        await sleep(BLOB_READ_RETRY_DELAY_MS * (attempt + 1))
      }
    }

    throw bookingError('BLOB_UNAVAILABLE', 'Recruiting storage is temporarily unavailable. Please refresh in a minute.')
  }

  private async readData() {
    if (shouldUseBlobStorage()) {
      return (await this.readBlobData()).data
    }

    try {
      const raw = await readFile(this.dataPath, 'utf8')
      return this.withPreviewAdmin(JSON.parse(raw) as LocalRecruitingData)
    } catch {
      return this.withPreviewAdmin(emptyData())
    }
  }

  private async writeBlobData(data: LocalRecruitingData, etag: string | null) {
    const persistableData = persistableRecruitingData(data)
    await recruitingBlobClient.put(BLOB_STATE_PATH, `${JSON.stringify(persistableData, null, 2)}\n`, {
      access: 'private',
      allowOverwrite: Boolean(etag),
      addRandomSuffix: false,
      contentType: 'application/json',
      ...(etag ? { ifMatch: etag } : {}),
    })
  }

  private async writeData(data: LocalRecruitingData) {
    const persistableData = persistableRecruitingData(data)

    if (shouldUseBlobStorage()) {
      await recruitingBlobClient.put(BLOB_STATE_PATH, `${JSON.stringify(persistableData, null, 2)}\n`, {
        access: 'private',
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: 'application/json',
      })
      return
    }

    await mkdir(path.dirname(this.dataPath), { recursive: true })
    const tempPath = `${this.dataPath}.${process.pid}.${randomBytes(6).toString('base64url')}.tmp`
    await writeFile(tempPath, `${JSON.stringify(persistableData, null, 2)}\n`)
    await rename(tempPath, this.dataPath)
  }

  private localSlotLockPath(slotValue: string) {
    return path.join(path.dirname(this.dataPath), 'slot-locks', `${slotLockId(slotValue)}.json`)
  }

  private localResumePath(storageKey: string) {
    return path.join(path.dirname(this.dataPath), storageKey)
  }

  private blobSlotLockPath(slotValue: string) {
    return `${BLOB_SLOT_LOCK_PREFIX}/${slotLockId(slotValue)}.json`
  }

  private async storeResumeFile(submission: Pick<ApplicationSubmission | InterviewBookingSubmission, 'email' | 'resumeFile' | 'submissionId' | 'submittedAt'>): Promise<StoredResume> {
    const fileName = safeResumeFileName(submission.resumeFile.name)
    const storageKey = resumeStorageKey(submission.email, submission.submissionId, fileName)
    const content = Buffer.from(submission.resumeFile.contentBase64.replace(/\s+/g, ''), 'base64')
    const mimeType = submission.resumeFile.mimeType || 'application/octet-stream'

    if (shouldUseBlobStorage()) {
      await recruitingBlobClient.put(storageKey, content, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: mimeType,
      })
    } else {
      const resumePath = this.localResumePath(storageKey)
      await mkdir(path.dirname(resumePath), { recursive: true })
      await writeFile(resumePath, content)
    }

    return {
      email: submission.email,
      fileName,
      mimeType,
      size: submission.resumeFile.size,
      storageKey,
      storageKind: shouldUseBlobStorage() ? 'blob' : 'local',
      uploadedAt: submission.submittedAt,
    }
  }

  private async deleteResumeFile(resume: StoredResume) {
    if (resume.storageKind === 'blob' || shouldUseBlobStorage()) {
      await recruitingBlobClient.del(resume.storageKey).catch(() => undefined)
      return
    }

    await unlink(this.localResumePath(resume.storageKey)).catch(() => undefined)
  }

  private async releaseBookingLock(slotValue: string) {
    if (shouldUseBlobStorage()) {
      await recruitingBlobClient.del(this.blobSlotLockPath(slotValue)).catch(() => undefined)
      return
    }

    await unlink(this.localSlotLockPath(slotValue)).catch(() => undefined)
  }

  private async clearStaleBookingLock(slotValue: string) {
    if (shouldUseBlobStorage()) {
      const lock = await recruitingBlobClient.get(this.blobSlotLockPath(slotValue), {
        access: 'private',
        useCache: false,
      }).catch(() => null)
      if (!lock || lock.statusCode !== 200) return true

      const raw = await new Response(lock.stream).text()
      if (!isStaleBookingLock(raw)) return false

      await recruitingBlobClient.del(this.blobSlotLockPath(slotValue)).catch(() => undefined)
      return true
    }

    const lockPath = this.localSlotLockPath(slotValue)
    let raw = ''
    try {
      raw = await readFile(lockPath, 'utf8')
    } catch {
      return true
    }

    if (!isStaleBookingLock(raw)) return false

    await unlink(lockPath).catch(() => undefined)
    return true
  }

  private async acquireBookingLock(submission: InterviewBookingSubmission) {
    const payload = `${JSON.stringify({
      slotValue: submission.slotValue,
      email: submission.email,
      submissionId: submission.submissionId,
      createdAt: new Date().toISOString(),
    }, null, 2)}\n`

    const writeLock = async () => {
      if (shouldUseBlobStorage()) {
        await recruitingBlobClient.put(this.blobSlotLockPath(submission.slotValue), payload, {
          access: 'private',
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: 'application/json',
        })
      } else {
        const lockPath = this.localSlotLockPath(submission.slotValue)
        await mkdir(path.dirname(lockPath), { recursive: true })
        const file = await open(lockPath, 'wx')
        try {
          await file.writeFile(payload)
        } finally {
          await file.close()
        }
      }
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await writeLock()
        return () => this.releaseBookingLock(submission.slotValue)
      } catch (error) {
        const lockAlreadyExists = (
          isBlobWriteConflict(error) ||
          (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'EEXIST')
        )
        if (!lockAlreadyExists) {
          throw error
        }

        if (attempt === 0 && await this.clearStaleBookingLock(submission.slotValue)) {
          continue
        }

        throw bookingError('SLOT_TAKEN', 'That slot was just booked. Please choose another time.')
      }
    }

    throw bookingError('SLOT_TAKEN', 'That slot was just booked. Please choose another time.')
  }

  private async updateData<T>(mutator: (data: LocalRecruitingData) => T | Promise<T>): Promise<T> {
    if (shouldUseBlobStorage()) {
      for (let attempt = 0; attempt < BLOB_WRITE_MAX_ATTEMPTS; attempt += 1) {
        const { data, etag } = await this.readBlobData()
        const result = await mutator(data)

        try {
          await this.writeBlobData(data, etag)
          return result
        } catch (error) {
          if (!isBlobWriteConflict(error) || attempt === BLOB_WRITE_MAX_ATTEMPTS - 1) {
            throw error
          }
        }
      }

      throw bookingError('WRITE_CONFLICT', 'Could not save that change. Please try again.')
    }

    const key = shouldUseBlobStorage() ? `blob:${BLOB_STATE_PATH}` : `file:${this.dataPath}`
    const previous = mutationQueues.get(key) || Promise.resolve()

    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const data = await this.readData()
        const result = await mutator(data)
        await this.writeData(data)
        return result
      })

    mutationQueues.set(key, next.catch(() => undefined))
    return next
  }

  private withPreviewAdmin(data: LocalRecruitingData) {
    const now = new Date().toISOString()
    const email = 'sbodine@umich.edu'
    const existing = data.accounts[email]
    data.calendarEvents ||= {}
    data.rateLimits ||= {}
    data.resumes ||= {}
    // withPreviewAdmin runs on EVERY read path, blob and file, so it is the real migration
    // hook. A production document written before the portal shipped has none of these keys.
    data.memberProfiles ||= {}
    data.clubEvents ||= {}
    data.eventRsvps ||= {}
    data.announcements ||= {}
    data.portalResources ||= {}
    data.auditLog ||= []
    const shouldSeedDefaultPreview = !process.env.UBLDA_LOCAL_DATA_FILE && !shouldUseBlobStorage()
    seedLowDemandTestSignups(data, shouldSeedDefaultPreview)

    data.accounts[email] = {
      firstName: existing?.firstName || 'Sam',
      lastName: existing?.lastName || 'Bodine',
      uniqname: 'sbodine',
      email,
      role: existing?.role || 'super-admin',
      // Both of these come from the roster so the Console — whose whole job is documenting
      // who can do what — cannot disagree with it about the club's own super-admin. The
      // hand-written list here predated the 'events' scope and silently omitted it.
      adminTitle: existing?.adminTitle || adminAccountForEmail(email)?.title || 'Super Admin',
      adminScopes: existing?.adminScopes || [...ADMIN_SCOPES],
      createdAt: existing?.createdAt || now,
      updatedAt: existing?.updatedAt || now,
      sessionToken: existing?.sessionToken || LOCAL_PREVIEW_SESSION_TOKEN,
      sessionExpiresAt: existing?.sessionExpiresAt || sessionExpiresAt(),
      passwordSalt: existing?.passwordSalt || '',
      passwordHash: existing?.passwordHash || '',
      application: existing?.application || null,
    }
    delete data.sessions[LOCAL_PREVIEW_SESSION_TOKEN]

    return data
  }

  async upsertAccount(account: ApplicantAccount, password = ''): Promise<LocalAccountResponse> {
    return this.updateData((data) => {
      const now = new Date().toISOString()
      const existing = data.accounts[account.email]
      const sessionToken = existing?.sessionToken && existing.sessionToken !== LOCAL_PREVIEW_SESSION_TOKEN
        ? existing.sessionToken
        : createSessionToken()
      const passwordPair = password ? hashPassword(password) : {
        salt: existing?.passwordSalt || '',
        hash: existing?.passwordHash || '',
      }
      const stored: StoredAccount = {
        ...account,
        // A role granted in the Console is an administrative act, not session state: it has
        // to outlive the next sign-in. Sign-in callers never send these fields, so without
        // the carry-forward every grant would be silently wiped the next time that officer
        // authenticated. Carrying `role` forward cannot elevate anyone on its own — a
        // never-granted account has `role: 'member'` stored, and effectiveRoleForAccount
        // still requires a Google-verified identity to reach the roster.
        role: account.role || existing?.role,
        adminScopes: account.adminScopes || existing?.adminScopes,
        adminTitle: account.adminTitle || existing?.adminTitle || '',
        verifiedVia: account.verifiedVia || existing?.verifiedVia || 'password',
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        sessionToken,
        sessionExpiresAt: sessionExpiresAt(),
        passwordSalt: passwordPair.salt,
        passwordHash: passwordPair.hash,
        application: existing?.application || null,
      }

      data.accounts[stored.email] = stored
      data.sessions[sessionToken] = {
        email: stored.email,
        expiresAt: stored.sessionExpiresAt,
      }

      return {
        account: decorateAccount(stored),
        sessionToken,
        application: stored.application,
      }
    })
  }

  async signIn(email: string, password: string): Promise<LocalAccountResponse | null> {
    return this.updateData((data) => {
      const account = data.accounts[email]

      if (!account || !verifyPassword(password, account.passwordSalt, account.passwordHash)) {
        return null
      }

      account.updatedAt = new Date().toISOString()
      account.sessionToken = account.sessionToken || createSessionToken()
      account.sessionExpiresAt = sessionExpiresAt()
      data.sessions[account.sessionToken] = {
        email,
        expiresAt: account.sessionExpiresAt,
      }

      return {
        account: decorateAccount(account),
        sessionToken: account.sessionToken,
        application: account.application,
      }
    })
  }

  async restoreSession(sessionToken: string): Promise<LocalAccountResponse | null> {
    if (sessionToken === LOCAL_PREVIEW_SESSION_TOKEN) {
      return null
    }

    const data = await this.readData()
    const session = data.sessions[sessionToken]

    if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
      return null
    }

    const account = data.accounts[session.email]
    if (!account) {
      return null
    }

    return {
      account: decorateAccount(account),
      sessionToken,
      application: account.application,
    }
  }

  async deleteSession(sessionToken: string) {
    return this.updateData((data) => {
      const session = data.sessions[sessionToken]
      delete data.sessions[sessionToken]

      if (session) {
        const account = data.accounts[session.email]
        if (account?.sessionToken === sessionToken) {
          account.sessionToken = ''
          account.sessionExpiresAt = new Date(0).toISOString()
          account.updatedAt = new Date().toISOString()
        }
      }

      return { deleted: Boolean(session) }
    })
  }

  async saveApplication(submission: ApplicationSubmission) {
    const resume = await this.storeResumeFile(submission)
    const now = submission.submittedAt

    await this.updateData((data) => {
      data.resumes ||= {}
      data.resumes[submission.email] = resume

      const existingAccount = data.accounts[submission.email]
      const existingCandidate = data.candidates[submission.email]

      if (existingAccount) {
        existingAccount.application = {
          status: submission.status,
          interviewSlot: submission.interviewSlot.label,
          resumeUrl: resumeUrlForEmail(submission.email),
          updatedAt: now,
          submissionCount: (existingAccount.application?.submissionCount || 0) + 1,
        }
        existingAccount.updatedAt = now
      }

      data.candidates[submission.email] = {
        id: submission.uniqname,
        name: `${submission.firstName} ${submission.lastName}`.trim() || submission.email,
        program: [submission.college, submission.year].filter(Boolean).join(' · '),
        email: submission.email,
        rolePreferences: submission.rolePreferences,
        status: existingCandidate?.status || statusForDashboard(submission.status),
        availability: submission.availability.map((slot) => slot.value),
        resumeUrl: resumeUrlForEmail(submission.email),
        assignedSlot: existingCandidate?.assignedSlot || '',
        interviewers: existingCandidate?.interviewers || [],
        feedback: existingCandidate?.feedback || '',
      }
    })
  }

  async saveInterviewerAvailability(submission: InterviewerAvailabilitySubmission) {
    return this.updateData((data) => {
      const admin = adminAccountForEmail(submission.email)
      const existing = data.interviewerAvailability[submission.email]

      data.interviewerAvailability[submission.email] = {
        name: `${submission.firstName} ${submission.lastName}`.trim() || submission.email,
        role: admin?.title || 'E-board',
        email: submission.email,
        uniqname: submission.uniqname,
        availability: submission.availability.map((slot) => slot.value),
        availabilitySummary: submission.availabilitySummary,
        maxInterviews: submission.maxInterviews || 'As needed',
        notes: submission.notes,
        updatedAt: submission.submittedAt,
        submissionCount: (existing?.submissionCount || 0) + 1,
      }

      return { updatedExistingSubmission: Boolean(existing) }
    })
  }

  async saveInterviewAssignment(submission: InterviewAssignmentSubmission) {
    return this.updateData((data) => {
      const candidate = data.candidates[submission.email]
      const assignedSlotValue = submission.assignedSlot?.value || ''

      if (candidate) {
        if (assignedSlotValue) {
          const conflictingCandidate = Object.values(data.candidates).find((row) => (
            row.email !== submission.email && row.assignedSlot === assignedSlotValue
          ))
          if (conflictingCandidate) {
            throw bookingError('SLOT_TAKEN', 'That slot is already finalized for another interviewee.')
          }

          const availableNames = new Set(Object.values(data.interviewerAvailability)
            .filter((interviewer) => interviewer.availability.includes(assignedSlotValue))
            .map((interviewer) => interviewer.name))
          const unavailableInterviewers = submission.interviewers.filter((interviewer) => !availableNames.has(interviewer))
          if (unavailableInterviewers.length > 0) {
            throw bookingError('INTERVIEWER_UNAVAILABLE', 'Assigned interviewers must be available for the selected interview slot.')
          }
        }

        candidate.assignedSlot = assignedSlotValue
        candidate.interviewers = submission.interviewers
        candidate.status = submission.interviewStatus
        candidate.feedback = submission.feedback
      }

      return { updatedCandidate: Boolean(candidate) }
    })
  }

  async publicInterviewSlots() {
    const data = await this.readData()
    return bookingSlotRows(data)
  }

  async consumeRateLimit(key: string, maxAttempts: number, windowMs: number) {
    return this.updateData((data) => {
      data.rateLimits ||= {}

      const now = Date.now()
      const existing = data.rateLimits[key]
      if (!existing || existing.resetAt <= now) {
        data.rateLimits[key] = { count: 1, resetAt: now + windowMs }
        return { limited: false, retryAfterSeconds: 0 }
      }

      existing.count += 1

      return {
        limited: existing.count > maxAttempts,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      }
    })
  }

  async bookInterviewSlot(submission: InterviewBookingSubmission) {
    const preflightData = await this.readData()
    const slot = getInterviewSlotByValue(submission.slotValue)
    if (!slot) {
      throw bookingError('INVALID_SLOT', 'Choose a valid interview slot.')
    }

    const preflightInterviewers = Object.values(preflightData.interviewerAvailability)
      .filter((interviewer) => interviewer.availability.includes(submission.slotValue))

    if (preflightInterviewers.length === 0) {
      throw bookingError('NO_INTERVIEWER_COVERAGE', 'That slot no longer has e-board interviewer coverage.')
    }

    const preflightBookedCandidate = Object.values(preflightData.candidates).find((candidate) => candidate.assignedSlot === submission.slotValue)
    if (preflightBookedCandidate && preflightBookedCandidate.email !== submission.email) {
      throw bookingError('SLOT_TAKEN', 'That slot was just booked. Please choose another time.')
    }

    const preflightExistingCandidate = preflightData.candidates[submission.email]
    if (preflightExistingCandidate?.assignedSlot && preflightExistingCandidate.assignedSlot !== submission.slotValue) {
      throw bookingError('ALREADY_BOOKED', 'This email already has an interview slot. Email sbodine@umich.edu if you need to reschedule.')
    }

    const releaseLock = await this.acquireBookingLock(submission)
    let storedResume: StoredResume | null = null
    let previousResume: StoredResume | null = null

    try {
      const savedBooking = await this.updateData(async (data) => {
        data.resumes ||= {}
        const availableInterviewers = Object.values(data.interviewerAvailability)
          .filter((interviewer) => interviewer.availability.includes(submission.slotValue))
          .sort((left, right) => left.name.localeCompare(right.name))

        if (availableInterviewers.length === 0) {
          throw bookingError('NO_INTERVIEWER_COVERAGE', 'That slot no longer has e-board interviewer coverage.')
        }

        const bookedCandidate = Object.values(data.candidates).find((candidate) => candidate.assignedSlot === submission.slotValue)
        if (bookedCandidate && bookedCandidate.email !== submission.email) {
          throw bookingError('SLOT_TAKEN', 'That slot was just booked. Please choose another time.')
        }

        const existingCandidate = data.candidates[submission.email]
        if (existingCandidate?.assignedSlot && existingCandidate.assignedSlot !== submission.slotValue) {
          throw bookingError('ALREADY_BOOKED', 'This email already has an interview slot. Email sbodine@umich.edu if you need to reschedule.')
        }

        const interviewers = availableInterviewers.slice(0, 2).map((interviewer) => interviewer.name)
        const rolePreferences = submission.rolePreferences?.length
          ? submission.rolePreferences
          : existingCandidate?.rolePreferences?.length
            ? existingCandidate.rolePreferences
            : [submission.roleInterest || 'Open function preference'].filter(Boolean)
        const feedbackNotes = [
          existingCandidate?.feedback || '',
          submission.conflicts ? `Booking notes: ${submission.conflicts}` : '',
        ].filter(Boolean).join('\n')
        storedResume ||= await this.storeResumeFile(submission)
        previousResume = data.resumes[submission.email] || null
        data.resumes[submission.email] = storedResume

        data.candidates[submission.email] = {
          id: existingCandidate?.id || candidateIdFromEmail(submission.email),
          name: `${submission.firstName} ${submission.lastName}`.trim() || submission.email,
          program: existingCandidate?.program || 'Interview slot signup',
          email: submission.email,
          rolePreferences,
          status: 'Invited',
          availability: existingCandidate?.availability?.length ? existingCandidate.availability : [submission.slotValue],
          resumeUrl: resumeUrlForEmail(submission.email),
          assignedSlot: submission.slotValue,
          interviewers,
          feedback: feedbackNotes,
        }

        return {
          candidate: data.candidates[submission.email],
          slot,
          interviewers,
        }
      })
      const resumeToDelete = previousResume as StoredResume | null
      const activeResume = storedResume as StoredResume | null
      if (resumeToDelete && activeResume && resumeToDelete.storageKey !== activeResume.storageKey) {
        await this.deleteResumeFile(resumeToDelete)
      }
      return savedBooking
    } catch (error) {
      if (storedResume) {
        await this.deleteResumeFile(storedResume)
      }
      throw error
    } finally {
      await releaseLock()
    }
  }

  async saveCalendarEvent(event: DashboardCalendarEvent) {
    return this.updateData((data) => {
      data.calendarEvents[event.id] = event
      return event
    })
  }

  async deleteCalendarEvent(id: string) {
    return this.updateData((data) => {
      const existed = Boolean(data.calendarEvents[id])
      delete data.calendarEvents[id]
      return { deleted: existed }
    })
  }

  // ── Portal ────────────────────────────────────────────────────────────────
  // Every method below is a pure upsert with no external side effects, so it is safe
  // to run 2–5× under blob CAS retry, and every mutation appends its audit entry
  // inside the SAME mutator as the change it describes. Never nest updateData.

  private recordAudit(data: LocalRecruitingData, entry: Omit<AuditEntry, 'id' | 'at'>) {
    data.auditLog = appendAudit(data.auditLog || [], buildAuditEntry(entry))
  }

  private memberProfileFor(data: LocalRecruitingData, email: string, actorEmail: string): MemberProfileRecord {
    const key = email.trim().toLowerCase()
    const existing = data.memberProfiles[key]

    if (existing) return normalizeMemberProfileRecord(existing, key)

    // A record the member creates by filling in their own profile came from a self-signup,
    // not from an officer. `buildMemberProfileRecord` defaults `source` to 'manual', which
    // the roster drawer renders as "Added by an officer" — a false claim about where a
    // person came from, on the screen the club uses to decide who its members are.
    const seed = memberSeedFromAccount(data.accounts[key])
    const isSelfCreated = key === actorEmail.trim().toLowerCase()

    return buildMemberProfileRecord(
      key,
      isSelfCreated ? { ...seed, source: 'self-signup' } : seed,
      actorEmail,
    )
  }

  async listPortalWorkspace(): Promise<PortalWorkspace> {
    const data = await this.readData()

    return {
      accounts: Object.values(data.accounts).map(portalAccountSummary),
      memberProfiles: Object.values(data.memberProfiles).map((profile) => normalizeMemberProfileRecord(profile)),
      clubEvents: Object.values(data.clubEvents),
      eventRsvps: Object.values(data.eventRsvps),
      announcements: Object.values(data.announcements),
      resources: sortPortalResources(Object.values(data.portalResources)),
    }
  }

  /**
   * Applies an already-validated patch. `access` is structurally excluded by
   * applyMemberProfilePatch, so neither a member nor an admin can write access data here.
   * Pass `audit: false` for a member's own profile edit.
   */
  async saveMemberProfile(
    email: string,
    patch: Partial<MemberProfileRecord>,
    actor: PortalAuditActor,
    options: { audit?: boolean; action?: string } = {},
  ): Promise<MemberProfileRecord> {
    const key = email.trim().toLowerCase()

    return this.updateData((data) => {
      const now = new Date().toISOString()
      const existed = Boolean(data.memberProfiles[key])
      const base = this.memberProfileFor(data, key, actor.email)
      const record = applyMemberProfilePatch(base, patch, actor.email, now)

      data.memberProfiles[key] = record

      if (options.audit !== false) {
        this.recordAudit(data, {
          actorEmail: actor.email,
          actorRole: actor.role,
          action: options.action || 'admin.member.upsert',
          targetType: 'member',
          targetId: key,
          summary: `${existed ? 'Updated' : 'Added'} member ${memberDisplayName(record)} (${key}).`,
        })
      }

      return record
    })
  }

  /** Idempotent: rerunning with the same emails leaves already-admitted members untouched. */
  async bulkAdmitMembers(input: BulkAdmitInput, actor: PortalAuditActor): Promise<MemberProfileRecord[]> {
    const emails = Array.from(new Set(
      input.emails.map((email) => email.trim().toLowerCase()).filter(Boolean),
    )).slice(0, BULK_ADMIT_LIMIT)

    return this.updateData((data) => {
      const now = new Date().toISOString()
      const admitted: MemberProfileRecord[] = []
      let created = 0

      emails.forEach((key) => {
        const existing = data.memberProfiles[key]
        if (existing) {
          const current = normalizeMemberProfileRecord(existing, key)

          // Admitting somebody who already has a row — because they filled in their own
          // profile before anyone triaged them — has to actually admit them. Returning the
          // record untouched made bulk admit a silent no-op for exactly the people the
          // intake queue exists to catch. An already-admitted member is left alone.
          const needsAdmitting = current.source === 'self-signup' && current.status === 'prospect'
          if (!needsAdmitting) {
            admitted.push(current)
            return
          }

          const promoted: MemberProfileRecord = {
            ...current,
            status: input.status,
            source: input.source,
            year: current.year || input.year || '',
            school: current.school || input.school || '',
            interests: current.interests.length ? current.interests : (input.interests || []),
            joinedAt: current.joinedAt || now,
            updatedAt: now,
            updatedBy: actor.email,
          }

          data.memberProfiles[key] = promoted
          admitted.push(promoted)
          created += 1
          return
        }

        const record = buildMemberProfileRecord(key, {
          ...memberSeedFromAccount(data.accounts[key]),
          status: input.status,
          source: input.source,
          year: input.year || '',
          school: input.school || '',
          interests: input.interests || [],
          joinedAt: now,
        }, actor.email)

        data.memberProfiles[key] = record
        admitted.push(record)
        created += 1
      })

      if (created > 0) {
        this.recordAudit(data, {
          actorEmail: actor.email,
          actorRole: actor.role,
          action: 'admin.member.bulkAdmit',
          targetType: 'member',
          targetId: `batch:${created}`,
          summary: `Admitted ${created} member${created === 1 ? '' : 's'} from intake as ${input.status}.`,
        })
      }

      return admitted
    })
  }

  /** Owner-write only. The audit entry records the sharing scope and never the content. */
  async saveMemberAccess(
    email: string,
    input: AccessProfileInput,
    actor: PortalAuditActor,
  ): Promise<MemberProfileRecord> {
    const key = email.trim().toLowerCase()

    return this.updateData((data) => {
      const now = new Date().toISOString()
      const base = this.memberProfileFor(data, key, key)
      const record: MemberProfileRecord = {
        ...base,
        access: buildAccessProfile(input, base.access, now),
        updatedAt: now,
      }

      data.memberProfiles[key] = record

      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'member.saveAccess',
        targetType: 'member',
        targetId: key,
        summary: `Access sharing set to ${record.access.scope}.`,
      })

      return record
    })
  }

  async withdrawMemberAccessConsent(email: string, actor: PortalAuditActor): Promise<MemberProfileRecord> {
    const key = email.trim().toLowerCase()

    return this.updateData((data) => {
      const now = new Date().toISOString()
      const base = this.memberProfileFor(data, key, key)
      const record: MemberProfileRecord = {
        ...base,
        access: withdrawAccessProfile(normalizeAccessProfile(base.access), now),
        updatedAt: now,
      }

      data.memberProfiles[key] = record

      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'member.withdrawAccessConsent',
        targetType: 'member',
        targetId: key,
        summary: 'Access sharing withdrawn.',
      })

      return record
    })
  }

  /** Create forces `draft`; an edit never changes `status`. Publishing has its own method. */
  async saveClubEvent(input: ClubEventData, actor: PortalAuditActor): Promise<ClubEvent> {
    return this.updateData((data) => {
      const now = new Date().toISOString()
      const existing = input.id ? data.clubEvents[input.id] : undefined
      const event = existing
        ? mergeClubEvent(existing, input, now)
        : buildClubEvent(input, actor.email)

      data.clubEvents[event.id] = event

      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'admin.event.upsert',
        targetType: 'event',
        targetId: event.id,
        summary: `${existing ? 'Updated' : 'Drafted'} event “${event.title}”.`,
      })

      return event
    })
  }

  async publishClubEvent(eventId: string, actor: PortalAuditActor): Promise<PortalWriteResult<{ event: ClubEvent }>> {
    return this.updateData((data) => {
      const existing = data.clubEvents[eventId]
      if (!existing) {
        return { ok: false as const, blockers: ['That event no longer exists.'] }
      }

      const gate = canPublishEvent(existing)
      if (!gate.ok) {
        return { ok: false as const, blockers: gate.blockers }
      }

      const now = new Date().toISOString()
      const event: ClubEvent = {
        ...existing,
        status: 'published',
        publishedAt: existing.publishedAt || now,
        publishedBy: actor.email,
        updatedAt: now,
      }

      data.clubEvents[event.id] = event

      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'admin.event.publish',
        targetType: 'event',
        targetId: event.id,
        summary: `Published event “${event.title}”.`,
      })

      return { ok: true as const, event }
    })
  }

  async cancelClubEvent(
    eventId: string,
    reason: string,
    actor: PortalAuditActor,
  ): Promise<PortalWriteResult<{ event: ClubEvent }>> {
    return this.updateData((data) => {
      const existing = data.clubEvents[eventId]
      if (!existing) {
        return { ok: false as const, blockers: ['That event no longer exists.'] }
      }

      const now = new Date().toISOString()
      const trimmedReason = reason.trim().slice(0, 240)
      const internalNotes = [existing.internalNotes, trimmedReason ? `Cancelled: ${trimmedReason}` : '']
        .filter(Boolean)
        .join('\n')
        .slice(0, 1000)
      const event: ClubEvent = { ...existing, status: 'cancelled', internalNotes, updatedAt: now }

      data.clubEvents[event.id] = event

      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'admin.event.cancel',
        targetType: 'event',
        targetId: event.id,
        summary: `Cancelled event “${event.title}”.${trimmedReason ? ` Reason: ${trimmedReason}` : ''}`,
      })

      return { ok: true as const, event }
    })
  }

  /**
   * Writes the CALLER's row, always. `rsvpCount` counts 'going' responses.
   * Member RSVPs are not audited: the log is a capped 300-entry buffer and RSVP churn
   * would evict the admin actions it exists to record.
   */
  async saveEventRsvp(
    email: string,
    input: RsvpData,
  ): Promise<PortalWriteResult<{ rsvp: EventRsvp; event: ClubEvent; rsvpCount: number }>> {
    const key = email.trim().toLowerCase()

    return this.updateData((data) => {
      const event = data.clubEvents[input.eventId]
      if (!event) {
        return { ok: false as const, blockers: ['That event no longer exists.'] }
      }

      const now = new Date().toISOString()
      const gate = isRsvpOpen(event, now)
      if (!gate.ok) {
        return { ok: false as const, blockers: gate.blockers }
      }

      const id = rsvpKey(event.id, key)
      const rsvp = buildEventRsvp(key, { ...input, eventId: event.id }, data.eventRsvps[id], now)
      data.eventRsvps[id] = rsvp

      const rsvpCount = Object.values(data.eventRsvps)
        .filter((row) => row.eventId === event.id && row.response === 'going').length

      return { ok: true as const, rsvp, event, rsvpCount }
    })
  }

  /** Creates the RSVP row for a walk-in when there is none. */
  async checkInMember(
    eventId: string,
    email: string,
    checkedIn: boolean,
    actor: PortalAuditActor,
  ): Promise<PortalWriteResult<{ rsvp: EventRsvp }>> {
    const key = email.trim().toLowerCase()

    return this.updateData((data) => {
      const event = data.clubEvents[eventId]
      if (!event) {
        return { ok: false as const, blockers: ['That event no longer exists.'] }
      }

      const now = new Date().toISOString()
      const id = rsvpKey(eventId, key)
      const existing = data.eventRsvps[id]
      const rsvp: EventRsvp = {
        id,
        eventId,
        email: key,
        response: existing?.response || 'going',
        guestCount: existing?.guestCount || 0,
        accommodationNote: existing?.accommodationNote || '',
        shareAccommodationWithLeads: existing?.shareAccommodationWithLeads || false,
        respondedAt: existing?.respondedAt || now,
        checkedInAt: checkedIn ? existing?.checkedInAt || now : '',
        checkedInBy: checkedIn ? actor.email : '',
      }

      data.eventRsvps[id] = rsvp

      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'admin.event.checkIn',
        targetType: 'rsvp',
        targetId: id,
        summary: `${checkedIn ? 'Checked in' : 'Undid check-in for'} ${key} at “${event.title}”.`,
      })

      return { ok: true as const, rsvp }
    })
  }

  /** Create forces `draft`; an edit never changes `status`. */
  async saveAnnouncement(input: AnnouncementData, actor: PortalAuditActor): Promise<PortalAnnouncement> {
    return this.updateData((data) => {
      const now = new Date().toISOString()
      const existing = input.id ? data.announcements[input.id] : undefined
      const announcement = existing
        ? mergeAnnouncement(existing, input, now)
        : buildAnnouncement(input, actor.email)

      data.announcements[announcement.id] = announcement

      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'admin.announcement.upsert',
        targetType: 'announcement',
        targetId: announcement.id,
        summary: `${existing ? 'Updated' : 'Drafted'} announcement “${announcement.title}”.`,
      })

      return announcement
    })
  }

  async publishAnnouncement(
    id: string,
    status: 'published' | 'archived',
    actor: PortalAuditActor,
  ): Promise<PortalWriteResult<{ announcement: PortalAnnouncement }>> {
    return this.updateData((data) => {
      const existing = data.announcements[id]
      if (!existing) {
        return { ok: false as const, blockers: ['That announcement no longer exists.'] }
      }

      const now = new Date().toISOString()
      const announcement: PortalAnnouncement = {
        ...existing,
        status,
        publishedAt: status === 'published' ? existing.publishedAt || now : existing.publishedAt,
        approvedBy: actor.email,
        updatedAt: now,
      }

      data.announcements[announcement.id] = announcement

      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'admin.announcement.publish',
        targetType: 'announcement',
        targetId: announcement.id,
        summary: `${status === 'published' ? 'Published' : 'Archived'} announcement “${announcement.title}”.`,
      })

      return { ok: true as const, announcement }
    })
  }

  async savePortalResource(input: PortalResourceData, actor: PortalAuditActor): Promise<PortalResource> {
    return this.updateData((data) => {
      const now = new Date().toISOString()
      const existing = input.id ? data.portalResources[input.id] : undefined
      const nextOrder = Object.values(data.portalResources)
        .reduce((highest, row) => Math.max(highest, row.order), -1) + 1
      const resource = existing
        ? mergePortalResource(existing, input, now)
        : buildPortalResource(input, actor.email, nextOrder)

      data.portalResources[resource.id] = resource

      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'admin.resource.upsert',
        targetType: 'resource',
        targetId: resource.id,
        summary: `${existing ? 'Updated' : 'Added'} resource “${resource.title}”.`,
      })

      return resource
    })
  }

  /** Rewrites `order` for exactly the ids given; anything else keeps its place. */
  async reorderPortalResources(ids: string[], actor: PortalAuditActor): Promise<PortalResource[]> {
    return this.updateData((data) => {
      const now = new Date().toISOString()
      let moved = 0

      ids.forEach((id, index) => {
        const resource = data.portalResources[id]
        if (!resource) return
        if (resource.order === index) return

        data.portalResources[id] = { ...resource, order: index, updatedAt: now }
        moved += 1
      })

      if (ids.length > 0) {
        this.recordAudit(data, {
          actorEmail: actor.email,
          actorRole: actor.role,
          action: 'admin.resource.reorder',
          targetType: 'resource',
          targetId: `batch:${ids.length}`,
          summary: `Reordered the member library: ${moved} of ${ids.length} resource${ids.length === 1 ? '' : 's'} moved.`,
        })
      }

      return sortPortalResources(Object.values(data.portalResources))
    })
  }

  /** For actions that are audited but do not otherwise mutate the document, such as an export. */
  async appendAuditEntry(entry: Omit<AuditEntry, 'id' | 'at'>): Promise<AuditEntry> {
    return this.updateData((data) => {
      const built = buildAuditEntry(entry)
      data.auditLog = appendAudit(data.auditLog || [], built)
      return built
    })
  }

  /** Newest first. */
  async readAuditLog(limit = 100): Promise<AuditEntry[]> {
    const data = await this.readData()
    return readAuditEntries(data.auditLog || [], limit)
  }

  /**
   * The manual escape hatch: a super-admin can elevate an officer from the Console
   * without depending on the Google sign-in path working.
   */
  async grantAccountRole(
    input: { email: string; role: DashboardRole; scopes: AdminScope[]; title?: string },
    actor: PortalAuditActor,
  ): Promise<PortalWriteResult<{ account: PortalAccountSummary }>> {
    const key = input.email.trim().toLowerCase()

    return this.updateData((data) => {
      const existing = data.accounts[key]
      if (!existing) {
        return { ok: false as const, blockers: ['No account has signed in with that email yet.'] }
      }

      const now = new Date().toISOString()
      existing.role = input.role
      existing.adminScopes = input.role === 'member' ? [] : [...input.scopes]
      existing.adminTitle = input.title
        || adminAccountForEmail(key)?.title
        || (input.role === 'member' ? 'Member' : 'Exec Admin')
      existing.updatedAt = now

      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'admin.grantRole',
        targetType: 'admin-account',
        targetId: key,
        summary: `Set ${key} to ${input.role}${existing.adminScopes.length ? ` with ${existing.adminScopes.join(', ')}` : ''}.`,
      })

      return { ok: true as const, account: portalAccountSummary(existing) }
    })
  }

  async dashboardData(sessionToken: string): Promise<{ account: ApplicantAccount; role: string; dashboardData: DashboardData } | null> {
    const session = await this.restoreSession(sessionToken)
    if (!session) return null

    const data = await this.readData()
    const role = session.account.role || 'member'

    return {
      account: session.account,
      role,
      dashboardData: buildDashboardData(data, role, session.account.email),
    }
  }

  async leadershipDashboardData(): Promise<DashboardData> {
    const data = await this.readData()
    return buildDashboardData(data, 'super-admin', 'sbodine@umich.edu')
  }

  async readCandidateResume(email: string) {
    const data = await this.readData()
    const resume = data.resumes?.[email]
    if (!resume) return null

    if (resume.storageKind === 'blob' || shouldUseBlobStorage()) {
      const blob = await recruitingBlobClient.get(resume.storageKey, { access: 'private', useCache: false })
      if (!blob || blob.statusCode !== 200) return null
      const content = Buffer.from(await new Response(blob.stream).arrayBuffer())
      return { ...resume, content }
    }

    const content = await readFile(this.localResumePath(resume.storageKey))
    return { ...resume, content }
  }
}

export const createLocalRecruitingStore = (dataPath?: string) => new LocalRecruitingStore(dataPath)
