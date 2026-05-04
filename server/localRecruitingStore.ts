import { createHash, randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto'
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BlobPreconditionFailedError, del, get, put } from '@vercel/blob'
import bcrypt from 'bcryptjs'
import type { ApplicantAccount, ApplicantApplicationSummary } from '../src/lib/applicantAccount.ts'
import type { ApplicationSubmission } from '../src/lib/application.ts'
import type { InterviewAssignmentSubmission } from '../src/lib/interviewAssignment.ts'
import type { InterviewerAvailabilitySubmission } from '../src/lib/interviewerAvailability.ts'
import type { InterviewBookingSubmission, PublicInterviewSlot } from '../src/lib/interviewBooking.ts'
import { ADMIN_ACCOUNTS, adminAccountForEmail } from '../src/lib/dashboardAccess.ts'
import type { DashboardCalendarEvent, DashboardData } from '../src/lib/dashboardData.ts'
import { INTERVIEW_SLOTS, getInterviewSlotByValue } from '../src/lib/interviews.ts'
import type { Candidate, InterviewerAvailability, MemberSignup } from '../src/lib/memberData.ts'

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

type LocalRecruitingData = {
  version: 1
  accounts: Record<string, StoredAccount>
  sessions: Record<string, StoredSession>
  candidates: Record<string, Candidate>
  interviewerAvailability: Record<string, StoredInterviewerAvailability>
  calendarEvents: Record<string, DashboardCalendarEvent>
  rateLimits: Record<string, StoredRateLimit>
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
export const LOCAL_PREVIEW_SESSION_TOKEN = 'local-preview-session-token'
const mutationQueues = new Map<string, Promise<unknown>>()
const BLOB_WRITE_MAX_ATTEMPTS = 5

const emptyData = (): LocalRecruitingData => ({
  version: 1,
  accounts: {},
  sessions: {},
  candidates: {},
  interviewerAvailability: {},
  calendarEvents: {},
  rateLimits: {},
})

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
  return {
    firstName: account.firstName,
    lastName: account.lastName,
    uniqname: account.uniqname,
    email: account.email,
    role: account.role || 'member',
    adminTitle: account.adminTitle || 'Member',
    adminScopes: account.adminScopes || [],
  }
}

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

const bookingError = (code: string, message: string) => Object.assign(new Error(message), { code })

const isBlobWriteConflict = (error: unknown) => (
  error instanceof BlobPreconditionFailedError ||
  (error instanceof Error && /precondition|already exists|overwrite/i.test(error.message))
)

const slotLockId = (slotValue: string) => createHash('sha256').update(slotValue).digest('base64url')

const bookingSlotRows = (data: LocalRecruitingData): PublicInterviewSlot[] => (
  INTERVIEW_SLOTS.map((slot) => {
    const interviewers = Object.values(data.interviewerAvailability)
      .filter((interviewer) => interviewer.availability.includes(slot.value))
      .map((interviewer) => interviewer.name)
      .sort((left, right) => left.localeCompare(right))
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
    try {
      const blob = await get(BLOB_STATE_PATH, { access: 'private', useCache: false })
      if (!blob || blob.statusCode !== 200) {
        return { data: this.withPreviewAdmin(emptyData()), etag: null }
      }

      const raw = await new Response(blob.stream).text()
      return {
        data: this.withPreviewAdmin(JSON.parse(raw) as LocalRecruitingData),
        etag: blob.blob.etag,
      }
    } catch {
      return { data: this.withPreviewAdmin(emptyData()), etag: null }
    }
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
    await put(BLOB_STATE_PATH, `${JSON.stringify(data, null, 2)}\n`, {
      access: 'private',
      allowOverwrite: Boolean(etag),
      addRandomSuffix: false,
      contentType: 'application/json',
      ...(etag ? { ifMatch: etag } : {}),
    })
  }

  private async writeData(data: LocalRecruitingData) {
    if (shouldUseBlobStorage()) {
      await put(BLOB_STATE_PATH, `${JSON.stringify(data, null, 2)}\n`, {
        access: 'private',
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: 'application/json',
      })
      return
    }

    await mkdir(path.dirname(this.dataPath), { recursive: true })
    const tempPath = `${this.dataPath}.${process.pid}.${randomBytes(6).toString('base64url')}.tmp`
    await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`)
    await rename(tempPath, this.dataPath)
  }

  private localSlotLockPath(slotValue: string) {
    return path.join(path.dirname(this.dataPath), 'slot-locks', `${slotLockId(slotValue)}.json`)
  }

  private blobSlotLockPath(slotValue: string) {
    return `${BLOB_SLOT_LOCK_PREFIX}/${slotLockId(slotValue)}.json`
  }

  private async releaseBookingLock(slotValue: string) {
    if (shouldUseBlobStorage()) {
      await del(this.blobSlotLockPath(slotValue)).catch(() => undefined)
      return
    }

    await unlink(this.localSlotLockPath(slotValue)).catch(() => undefined)
  }

  private async acquireBookingLock(submission: InterviewBookingSubmission) {
    const payload = `${JSON.stringify({
      slotValue: submission.slotValue,
      email: submission.email,
      submissionId: submission.submissionId,
      createdAt: new Date().toISOString(),
    }, null, 2)}\n`

    try {
      if (shouldUseBlobStorage()) {
        await put(this.blobSlotLockPath(submission.slotValue), payload, {
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
    } catch (error) {
      if (
        isBlobWriteConflict(error) ||
        (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'EEXIST')
      ) {
        throw bookingError('SLOT_TAKEN', 'That slot was just booked. Please choose another time.')
      }

      throw error
    }

    return () => this.releaseBookingLock(submission.slotValue)
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

    data.accounts[email] = {
      firstName: existing?.firstName || 'Sam',
      lastName: existing?.lastName || 'Bodine',
      uniqname: 'sbodine',
      email,
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
    const data = await this.readData()
    const now = new Date().toISOString()
    const existing = data.accounts[account.email]
    const sessionToken = existing?.sessionToken || createSessionToken()
    const passwordPair = password ? hashPassword(password) : {
      salt: existing?.passwordSalt || '',
      hash: existing?.passwordHash || '',
    }
    const stored: StoredAccount = {
      ...account,
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
    await this.writeData(data)

    return {
      account: decorateAccount(stored),
      sessionToken,
      application: stored.application,
    }
  }

  async signIn(email: string, password: string): Promise<LocalAccountResponse | null> {
    const data = await this.readData()
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
    await this.writeData(data)

    return {
      account: decorateAccount(account),
      sessionToken: account.sessionToken,
      application: account.application,
    }
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
    const data = await this.readData()
    const existingAccount = data.accounts[submission.email]
    const existingCandidate = data.candidates[submission.email]
    const now = submission.submittedAt

    if (existingAccount) {
      existingAccount.application = {
        status: submission.status,
        interviewSlot: submission.interviewSlot.label,
        resumeUrl: `local-preview://${submission.resumeFile.name}`,
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
      resumeUrl: `local-preview://${submission.resumeFile.name}`,
      assignedSlot: existingCandidate?.assignedSlot || '',
      interviewers: existingCandidate?.interviewers || [],
      feedback: existingCandidate?.feedback || '',
    }

    await this.writeData(data)
  }

  async saveInterviewerAvailability(submission: InterviewerAvailabilitySubmission) {
    const data = await this.readData()
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

    await this.writeData(data)
    return { updatedExistingSubmission: Boolean(existing) }
  }

  async saveInterviewAssignment(submission: InterviewAssignmentSubmission) {
    const data = await this.readData()
    const candidate = data.candidates[submission.email]

    if (candidate) {
      candidate.assignedSlot = submission.assignedSlot?.value || ''
      candidate.interviewers = submission.interviewers
      candidate.status = submission.interviewStatus
      candidate.feedback = submission.feedback
    }

    await this.writeData(data)
    return { updatedCandidate: Boolean(candidate) }
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

    try {
      return await this.updateData((data) => {
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

        data.candidates[submission.email] = {
          id: existingCandidate?.id || candidateIdFromEmail(submission.email),
          name: `${submission.firstName} ${submission.lastName}`.trim() || submission.email,
          program: existingCandidate?.program || 'Interview slot signup',
          email: submission.email,
          rolePreferences,
          status: 'Invited',
          availability: existingCandidate?.availability?.length ? existingCandidate.availability : [submission.slotValue],
          resumeUrl: existingCandidate?.resumeUrl || '',
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
    } finally {
      await releaseLock()
    }
  }

  async saveCalendarEvent(event: DashboardCalendarEvent) {
    const data = await this.readData()
    data.calendarEvents[event.id] = event
    await this.writeData(data)
    return event
  }

  async deleteCalendarEvent(id: string) {
    const data = await this.readData()
    const existed = Boolean(data.calendarEvents[id])
    delete data.calendarEvents[id]
    await this.writeData(data)
    return { deleted: existed }
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
}

export const createLocalRecruitingStore = (dataPath?: string) => new LocalRecruitingStore(dataPath)
