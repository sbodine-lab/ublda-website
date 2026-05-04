import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { get, put } from '@vercel/blob'
import type { ApplicantAccount, ApplicantApplicationSummary } from '../src/lib/applicantAccount.ts'
import type { ApplicationSubmission } from '../src/lib/application.ts'
import type { InterviewAssignmentSubmission } from '../src/lib/interviewAssignment.ts'
import type { InterviewerAvailabilitySubmission } from '../src/lib/interviewerAvailability.ts'
import { ADMIN_ACCOUNTS, adminAccountForEmail, roleForEmail } from '../src/lib/dashboardAccess.ts'
import type { DashboardData } from '../src/lib/dashboardData.ts'
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

type LocalRecruitingData = {
  version: 1
  accounts: Record<string, StoredAccount>
  sessions: Record<string, StoredSession>
  candidates: Record<string, Candidate>
  interviewerAvailability: Record<string, StoredInterviewerAvailability>
}

export type LocalAccountResponse = {
  account: ApplicantAccount
  sessionToken: string
  application: ApplicantApplicationSummary | null
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
const BLOB_STATE_PATH = 'recruiting/state.json'
export const LOCAL_PREVIEW_SESSION_TOKEN = 'local-preview-session-token'

const emptyData = (): LocalRecruitingData => ({
  version: 1,
  accounts: {},
  sessions: {},
  candidates: {},
  interviewerAvailability: {},
})

const defaultDataPath = () => (
  process.env.UBLDA_LOCAL_DATA_FILE ||
  path.join(process.cwd(), '.ublda-local-data', 'recruiting.json')
)

const shouldUseBlobStorage = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN)

const sessionExpiresAt = () => new Date(Date.now() + SESSION_TTL_MS).toISOString()

const hashPassword = (password: string, salt = randomBytes(16).toString('base64url')) => ({
  salt,
  hash: pbkdf2Sync(password, salt, 120_000, 32, 'sha256').toString('base64url'),
})

const constantTimeEquals = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

const verifyPassword = (password: string, salt: string, expectedHash: string) => {
  if (!salt || !expectedHash) return false
  return constantTimeEquals(hashPassword(password, salt).hash, expectedHash)
}

const createSessionToken = () => `local_${Date.now()}_${randomBytes(18).toString('base64url')}`

const decorateAccount = (account: ApplicantAccount): ApplicantAccount => {
  const admin = adminAccountForEmail(account.email)
  return {
    firstName: account.firstName,
    lastName: account.lastName,
    uniqname: account.uniqname,
    email: account.email,
    role: admin?.role || 'member',
    adminTitle: admin?.title || 'Member',
    adminScopes: admin?.scopes || [],
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

  private async readData() {
    if (shouldUseBlobStorage()) {
      try {
        const blob = await get(BLOB_STATE_PATH, { access: 'private', useCache: false })
        if (!blob || blob.statusCode !== 200) {
          return this.withPreviewAdmin(emptyData())
        }

        const raw = await new Response(blob.stream).text()
        return this.withPreviewAdmin(JSON.parse(raw) as LocalRecruitingData)
      } catch {
        return this.withPreviewAdmin(emptyData())
      }
    }

    try {
      const raw = await readFile(this.dataPath, 'utf8')
      return this.withPreviewAdmin(JSON.parse(raw) as LocalRecruitingData)
    } catch {
      return this.withPreviewAdmin(emptyData())
    }
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
    const tempPath = `${this.dataPath}.${process.pid}.tmp`
    await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`)
    await rename(tempPath, this.dataPath)
  }

  private withPreviewAdmin(data: LocalRecruitingData) {
    const now = new Date().toISOString()
    const email = 'sbodine@umich.edu'
    const existing = data.accounts[email]

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
    data.sessions[LOCAL_PREVIEW_SESSION_TOKEN] = {
      email,
      expiresAt: sessionExpiresAt(),
    }

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

  async dashboardData(sessionToken: string): Promise<{ account: ApplicantAccount; role: string; dashboardData: DashboardData } | null> {
    const session = await this.restoreSession(sessionToken)
    if (!session) return null

    const data = await this.readData()
    const role = roleForEmail(session.account.email)

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
