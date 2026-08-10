import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BlobPreconditionFailedError, get, put } from '@vercel/blob'
import bcrypt from 'bcryptjs'
import {
  PROGRAM_SLOT_STATUS_LABELS,
  SPEAKER_FORMAT_LABELS,
  SPEAKER_OPS_MEMBERS,
  SPEAKER_OPS_SESSION_DAYS,
  SPEAKER_STAGES,
  type ProgramSlot,
  type ProgramSlotStatus,
  type RoomRequest,
  type RoomRequestStatus,
  type SpeakerFormat,
  type SpeakerLead,
  type SpeakerOpsAccount,
  type SpeakerOpsActivity,
  type SpeakerOpsMemberEmail,
  type SpeakerOpsWorkspace,
  type SpeakerStage,
} from '../src/lib/speakerOps.ts'

type StoredAccount = SpeakerOpsAccount & {
  passwordHash: string
  createdAt: string
  updatedAt: string
}

type StoredSession = {
  email: SpeakerOpsMemberEmail
  expiresAt: string
  createdAt: string
}

type SpeakerOpsData = {
  version: 1 | 2
  accounts: Record<string, StoredAccount>
  sessions: Record<string, StoredSession>
  leads: Record<string, SpeakerLead>
  slots: Record<string, ProgramSlot>
  roomRequests: Record<string, RoomRequest>
  activity: SpeakerOpsActivity[]
}

export type SpeakerOpsSession = {
  account: SpeakerOpsAccount
  sessionToken: string
  sessionExpiresAt: string
}

export type SpeakerOpsWriteResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

type StoreOptions = {
  forceLocal?: boolean
}

const BLOB_PATH = 'speaker-ops/state.json'
const SESSION_TTL_MS = SPEAKER_OPS_SESSION_DAYS * 24 * 60 * 60 * 1000
const BCRYPT_COST = 12
const WRITE_ATTEMPTS = 5
const confirmers = new Set<SpeakerOpsMemberEmail>(['atchiang@umich.edu', 'sbodine@umich.edu'])
const queues = new Map<string, Promise<unknown>>()

const defaultDataPath = () => process.env.UBLDA_SPEAKER_OPS_DATA_FILE
  ? path.resolve(process.env.UBLDA_SPEAKER_OPS_DATA_FILE)
  : path.join(process.cwd(), '.ublda-local-data', 'speaker-ops.json')
const isoNow = () => new Date().toISOString()
const cleanEmail = (email: string) => email.trim().toLowerCase() as SpeakerOpsMemberEmail
const cleanText = (value: string, max = 500) => value.replace(/[<>]/g, '').trim().slice(0, max)
const tokenHash = (token: string) => createHash('sha256').update(token).digest('base64url')
const randomId = (prefix: string) => `${prefix}_${randomBytes(10).toString('base64url')}`
const createSessionToken = () => randomBytes(32).toString('base64url')
const canUseBlob = (forceLocal: boolean) => !forceLocal && Boolean(process.env.BLOB_READ_WRITE_TOKEN)

const leadSeeds = (): SpeakerLead[] => {
  const updatedAt = '2026-08-10T19:00:00.000Z'
  return [
    {
      id: 'deb-ruh',
      name: 'Debra Ruh',
      organization: 'Ruh Global IMPACT',
      stage: 'committed',
      term: 'fall-2026',
      format: 'flexible',
      ownerEmail: 'andsack@umich.edu',
      nextAction: 'Ask for two fall date windows after Ross replies.',
      evidence: 'Aug 10 email: she is looking forward to a fall fireside.',
      blocker: 'No Ross room has been requested or approved.',
      lastContactAt: '2026-08-10T14:00:00.000Z',
      updatedAt,
    },
    {
      id: 'rich-donovan',
      name: 'Rich Donovan',
      organization: 'The Return on Disability Group',
      stage: 'committed',
      term: 'winter-2027',
      format: 'flexible',
      ownerEmail: 'andsack@umich.edu',
      nextAction: 'Hold until a winter room window is available.',
      evidence: 'Accepted in principle and asked the club to tell him when.',
      blocker: 'No date, format, or room is confirmed.',
      lastContactAt: '2026-07-28T16:00:00.000Z',
      updatedAt,
    },
    {
      id: 'grant-shelton',
      name: 'Grant Shelton',
      organization: 'GTH Consulting',
      stage: 'interested',
      term: 'winter-2027',
      format: 'virtual',
      ownerEmail: 'sdeyoun@umich.edu',
      nextAction: 'Keep warm for winter; send audience, topic, format, and funding facts when dates open.',
      evidence: 'Gmail and the Drive tracker: his manager is open to a Zoom fireside if the fit is clear.',
      blocker: 'Fall is capped; in-person would require travel support or a co-sponsor.',
      lastContactAt: '2026-08-03T14:00:00.000Z',
      updatedAt,
    },
    {
      id: 'tiffany-yu',
      name: 'Tiffany Yu',
      organization: 'Diversability',
      stage: 'funding-blocked',
      term: 'later',
      format: 'in-person',
      ownerEmail: 'sbodine@umich.edu',
      nextAction: 'Wait for an approved co-host or funding source.',
      evidence: 'Representative quoted a discounted $15,000 in-person rate.',
      blocker: 'UBLDA has no approved speaker budget.',
      lastContactAt: '2026-08-10T15:00:00.000Z',
      updatedAt,
    },
    {
      id: 'diego-mariscal',
      name: 'Diego Mariscal',
      organization: '2Gether-International',
      stage: 'interested',
      term: 'winter-2027',
      format: 'flexible',
      ownerEmail: 'andsack@umich.edu',
      nextAction: 'Book the planning call requested by his communications team.',
      evidence: 'Accepted; communications team followed up Aug 5 for details.',
      blocker: 'Audience, format, and date still need a planning call.',
      lastContactAt: '2026-08-05T15:00:00.000Z',
      updatedAt,
    },
    {
      id: 'neil-milliken',
      name: 'Neil Milliken',
      organization: 'Atos',
      stage: 'in-conversation',
      term: 'fall-2026',
      format: 'virtual',
      ownerEmail: 'andsack@umich.edu',
      nextAction: 'Re-verify the two date windows from the July call.',
      evidence: 'Brain notes a July 28 call and two dates; Gmail does not show them.',
      blocker: 'Exact dates are not supported by the email thread.',
      lastContactAt: '2026-07-28T18:00:00.000Z',
      updatedAt,
    },
    {
      id: 'microsoft-alum',
      name: 'Microsoft alumnus',
      organization: 'Microsoft',
      stage: 'prospect',
      term: 'fall-2026',
      format: 'in-person',
      ownerEmail: 'alexfors@umich.edu',
      nextAction: 'Verify the speaker name and direct contact.',
      evidence: 'The internal recap mentions an Oct 1 target; no contact appears in Gmail.',
      blocker: 'Speaker identity and availability are unverified.',
      lastContactAt: '',
      updatedAt,
    },
    {
      id: 'mindy-scheier',
      name: 'Mindy Scheier',
      organization: 'Runway of Dreams',
      stage: 'interested',
      term: 'winter-2027',
      format: 'flexible',
      ownerEmail: 'landonem@umich.edu',
      nextAction: 'Keep warm until the winter slot clears the room gate.',
      evidence: 'Said she would be honored; planning remains open.',
      blocker: 'No date, format, or room is confirmed.',
      lastContactAt: '2026-07-25T14:00:00.000Z',
      updatedAt,
    },
    {
      id: 'alex-singleton',
      name: 'Alex Singleton',
      organization: 'Organization to verify',
      stage: 'in-conversation',
      term: 'winter-2027',
      format: 'virtual',
      ownerEmail: 'cooperry@umich.edu',
      nextAction: 'Keep the warm introduction moving; do not hold a date yet.',
      evidence: 'Drive tracker: warm introduction is in progress through Lloyd.',
      blocker: 'Direct contact, organization, topic, and availability are not yet verified.',
      lastContactAt: '',
      updatedAt,
    },
    {
      id: 'dustin-giannelli',
      name: 'Dustin Giannelli',
      organization: 'HearsDustin LLC',
      stage: 'interested',
      term: 'winter-2027',
      format: 'unknown',
      ownerEmail: 'sdeyoun@umich.edu',
      nextAction: 'Answer his audience, format, timing, location, and sponsor questions before a short call.',
      evidence: 'Gmail: he offered an introduction call and asked five concrete planning questions.',
      blocker: 'Format, timing, room, and sponsor or budget position are still open.',
      lastContactAt: '2026-08-04T14:00:00.000Z',
      updatedAt,
    },
    {
      id: 'maayan-ziv',
      name: 'Maayan Ziv',
      organization: 'AccessNow',
      stage: 'interested',
      term: 'winter-2027',
      format: 'unknown',
      ownerEmail: 'atchiang@umich.edu',
      nextAction: 'Send a winter hold note after the winter planning window opens.',
      evidence: 'Brain and Drive tracker: interested, with timing affected by fall travel.',
      blocker: 'The current Gmail search did not surface a direct date commitment.',
      lastContactAt: '',
      updatedAt,
    },
    {
      id: 'scott-fiedor',
      name: 'Scott Fiedor',
      organization: 'Organization to verify',
      stage: 'interested',
      term: 'winter-2027',
      format: 'unknown',
      ownerEmail: 'snaber@umich.edu',
      nextAction: 'Send a winter hold note after the winter planning window opens.',
      evidence: 'Drive tracker: interested, with no date selected.',
      blocker: 'Organization, format, topic, and availability need direct verification.',
      lastContactAt: '',
      updatedAt,
    },
    {
      id: 'diane-swonk',
      name: 'Diane Swonk',
      organization: 'KPMG',
      stage: 'deferred',
      term: 'later',
      format: 'in-person',
      ownerEmail: 'sbodine@umich.edu',
      nextAction: 'Reconnect for a 2027 date outside finals.',
      evidence: 'KPMG agreed Aug 10 to reconnect in 2027.',
      blocker: 'Dec 14–16 overlaps Ross final exams.',
      lastContactAt: '2026-08-10T15:30:00.000Z',
      updatedAt,
    },
  ]
}

const slotSeeds = (): ProgramSlot[] => [
  {
    id: 'fall-2026',
    label: 'Fall 2026 fireside',
    term: 'fall-2026',
    status: 'planning',
    preferredStart: '2026-10-01T19:00:00-04:00',
    backupStart: '2026-10-08T19:00:00-04:00',
    leadId: '',
    roomRequestId: 'room-fall-2026',
    updatedAt: '2026-08-10T16:00:00.000Z',
  },
  {
    id: 'winter-2027',
    label: 'Winter 2027 fireside',
    term: 'winter-2027',
    status: 'planning',
    preferredStart: '2027-02-04T19:00:00-05:00',
    backupStart: '2027-02-11T19:00:00-05:00',
    leadId: '',
    roomRequestId: 'room-winter-2027',
    updatedAt: '2026-08-10T16:00:00.000Z',
  },
]

const roomSeeds = (): RoomRequest[] => slotSeeds().map((slot) => ({
  id: slot.roomRequestId,
  slotId: slot.id,
  status: 'draft',
  preferredStart: slot.preferredStart,
  backupStart: slot.backupStart,
  setupMinutes: 30,
  teardownMinutes: 15,
  estimatedAttendance: 45,
  accessibilityNotes: 'Step-free route and accessible seating required.',
  equipmentNotes: 'Two chairs, two wireless microphones, projector optional.',
  requestedByEmail: 'atchiang@umich.edu',
  submittedAt: '',
  responseDueAt: '',
  reference: '',
  roomName: '',
  updatedAt: '2026-08-10T16:00:00.000Z',
}))

const emptyData = (): SpeakerOpsData => ({
  version: 2,
  accounts: {},
  sessions: {},
  leads: Object.fromEntries(leadSeeds().map((lead) => [lead.id, lead])),
  slots: Object.fromEntries(slotSeeds().map((slot) => [slot.id, slot])),
  roomRequests: Object.fromEntries(roomSeeds().map((request) => [request.id, request])),
  activity: [{
    id: 'seed_context_2026_08_10',
    actorEmail: 'system',
    action: 'Context checked',
    detail: 'Brain, Gmail, Google Drive, Ross calendar, and Ross room guidance reconciled Aug 10. Program capped at one fall and one winter fireside.',
    createdAt: '2026-08-10T19:00:00.000Z',
  }],
})

const migrateData = (data: SpeakerOpsData) => {
  if (data.version === 2) return data

  const migratedSeeds = Object.fromEntries(leadSeeds().map((lead) => [lead.id, lead]))
  data.leads = { ...data.leads, ...migratedSeeds }
  delete data.leads['grant-kessler']
  data.version = 2
  data.activity.unshift({
    id: 'context_reconciled_2026_08_10',
    actorEmail: 'system',
    action: 'Pipeline reconciled',
    detail: 'Corrected Grant Shelton and loaded the verified Brain, Gmail, and Drive pipeline under the two-event cap.',
    createdAt: '2026-08-10T19:00:00.000Z',
  })
  return data
}

const accountView = (account: StoredAccount): SpeakerOpsAccount => ({
  name: account.name,
  email: account.email,
  title: account.title,
  mustChangePassword: account.mustChangePassword,
  canConfirmProgram: account.canConfirmProgram,
  lastSignedInAt: account.lastSignedInAt,
})

const memberView = (email: SpeakerOpsMemberEmail) => {
  const member = SPEAKER_OPS_MEMBERS.find((candidate) => candidate.email === email)!
  return {
    name: member.name,
    email: member.email,
    title: member.title,
    canConfirmProgram: confirmers.has(email),
  }
}

const sessionExpiry = () => new Date(Date.now() + SESSION_TTL_MS).toISOString()

const addBusinessDays = (iso: string, count: number) => {
  const date = new Date(iso)
  let added = 0
  while (added < count) {
    date.setUTCDate(date.getUTCDate() + 1)
    const day = date.getUTCDay()
    if (day !== 0 && day !== 6) added += 1
  }
  return date.toISOString()
}

const isMemberEmail = (email: string): email is SpeakerOpsMemberEmail => (
  SPEAKER_OPS_MEMBERS.some((member) => member.email === email)
)

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export class SpeakerOpsStore {
  private readonly dataPath: string
  private readonly forceLocal: boolean

  constructor(dataPath = defaultDataPath(), options: StoreOptions = {}) {
    this.dataPath = dataPath
    this.forceLocal = Boolean(options.forceLocal)
  }

  private storageKey() {
    return canUseBlob(this.forceLocal) ? BLOB_PATH : this.dataPath
  }

  private async readLocal() {
    try {
      return JSON.parse(await readFile(this.dataPath, 'utf8')) as SpeakerOpsData
    } catch {
      return emptyData()
    }
  }

  private async writeLocal(data: SpeakerOpsData) {
    await mkdir(path.dirname(this.dataPath), { recursive: true })
    const tempPath = `${this.dataPath}.${process.pid}.${randomBytes(5).toString('base64url')}.tmp`
    await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 })
    await rename(tempPath, this.dataPath)
  }

  private async readBlob() {
    const blob = await get(BLOB_PATH, { access: 'private', useCache: false })
    if (!blob || blob.statusCode !== 200) return { data: emptyData(), etag: null as string | null }
    const raw = await new Response(blob.stream).text()
    return { data: JSON.parse(raw) as SpeakerOpsData, etag: blob.blob.etag?.replace(/^W\//, '') || null }
  }

  private async writeBlob(data: SpeakerOpsData, etag: string | null) {
    await put(BLOB_PATH, `${JSON.stringify(data, null, 2)}\n`, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: Boolean(etag),
      contentType: 'application/json',
      ...(etag ? { ifMatch: etag } : {}),
    })
  }

  private async readData() {
    const data = canUseBlob(this.forceLocal) ? (await this.readBlob()).data : await this.readLocal()
    return migrateData(data)
  }

  private async updateData<T>(mutation: (data: SpeakerOpsData) => Promise<T> | T): Promise<T> {
    const key = this.storageKey()
    const previous = queues.get(key) || Promise.resolve()
    const task = previous.catch(() => undefined).then(async () => {
      if (!canUseBlob(this.forceLocal)) {
        const data = migrateData(await this.readLocal())
        const result = await mutation(data)
        await this.writeLocal(data)
        return result
      }

      for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
        const { data: rawData, etag } = await this.readBlob()
        const data = migrateData(rawData)
        const result = await mutation(data)
        try {
          await this.writeBlob(data, etag)
          return result
        } catch (error) {
          if (!(error instanceof BlobPreconditionFailedError) || attempt === WRITE_ATTEMPTS - 1) throw error
        }
      }
      throw new Error('Speaker Ops storage could not be updated.')
    })
    queues.set(key, task)
    try {
      return await task
    } finally {
      if (queues.get(key) === task) queues.delete(key)
    }
  }

  private activeSession(data: SpeakerOpsData, sessionToken: string) {
    const session = data.sessions[tokenHash(sessionToken)]
    if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null
    const account = data.accounts[session.email]
    return account ? { session, account } : null
  }

  private appendActivity(
    data: SpeakerOpsData,
    actorEmail: SpeakerOpsMemberEmail,
    action: string,
    detail: string,
  ) {
    data.activity.unshift({
      id: randomId('activity'),
      actorEmail,
      action: cleanText(action, 80),
      detail: cleanText(detail, 300),
      createdAt: isoNow(),
    })
    data.activity = data.activity.slice(0, 250)
  }

  async provisionAccounts(passwords: Record<string, string>) {
    return this.updateData(async (data) => {
      const nextAccounts: Record<string, StoredAccount> = {}
      const now = isoNow()
      for (const member of SPEAKER_OPS_MEMBERS) {
        const password = passwords[member.email]
        if (!password || password.length < 16) throw new Error(`A 16-character temporary password is required for ${member.email}.`)
        const existing = data.accounts[member.email]
        nextAccounts[member.email] = {
          name: member.name,
          email: member.email,
          title: member.title,
          mustChangePassword: true,
          canConfirmProgram: confirmers.has(member.email),
          lastSignedInAt: existing?.lastSignedInAt || '',
          passwordHash: await bcrypt.hash(password, BCRYPT_COST),
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        }
      }
      data.accounts = nextAccounts
      data.sessions = {}
      this.appendActivity(data, 'sbodine@umich.edu', 'Access provisioned', 'Nine leadership accounts provisioned; all sessions reset.')
      return { count: Object.keys(nextAccounts).length }
    })
  }

  async signIn(emailInput: string, password: string): Promise<SpeakerOpsSession | null> {
    const email = cleanEmail(emailInput)
    if (!isMemberEmail(email)) return null

    return this.updateData(async (data) => {
      const account = data.accounts[email]
      if (!account || !(await bcrypt.compare(password, account.passwordHash))) return null

      const sessionToken = createSessionToken()
      const sessionExpiresAt = sessionExpiry()
      data.sessions[tokenHash(sessionToken)] = { email, expiresAt: sessionExpiresAt, createdAt: isoNow() }
      account.lastSignedInAt = isoNow()
      account.updatedAt = account.lastSignedInAt
      return { account: accountView(account), sessionToken, sessionExpiresAt }
    })
  }

  async restoreSession(sessionToken: string): Promise<SpeakerOpsSession | null> {
    if (!sessionToken) return null
    const data = await this.readData()
    const active = this.activeSession(data, sessionToken)
    if (!active) return null
    return {
      account: accountView(active.account),
      sessionToken,
      sessionExpiresAt: active.session.expiresAt,
    }
  }

  async logout(sessionToken: string) {
    return this.updateData((data) => ({ deleted: Boolean(delete data.sessions[tokenHash(sessionToken)]) }))
  }

  async changePassword(sessionToken: string, currentPassword: string, nextPassword: string): Promise<SpeakerOpsWriteResult<SpeakerOpsSession>> {
    if (nextPassword.length < 12) return { ok: false, error: 'Use at least 12 characters.' }
    if (safeEqual(currentPassword, nextPassword)) return { ok: false, error: 'Choose a new password.' }

    return this.updateData(async (data) => {
      const active = this.activeSession(data, sessionToken)
      if (!active || !(await bcrypt.compare(currentPassword, active.account.passwordHash))) {
        return { ok: false, error: 'Current password is incorrect.' }
      }
      active.account.passwordHash = await bcrypt.hash(nextPassword, BCRYPT_COST)
      active.account.mustChangePassword = false
      active.account.updatedAt = isoNow()
      this.appendActivity(data, active.account.email, 'Password changed', 'Completed first-login password change.')
      return {
        ok: true,
        account: accountView(active.account),
        sessionToken,
        sessionExpiresAt: active.session.expiresAt,
      }
    })
  }

  async workspace(sessionToken: string): Promise<SpeakerOpsWorkspace | null> {
    const data = await this.readData()
    const active = this.activeSession(data, sessionToken)
    if (!active) return null
    return {
      account: accountView(active.account),
      members: SPEAKER_OPS_MEMBERS.map((member) => memberView(member.email)),
      leads: Object.values(data.leads),
      slots: Object.values(data.slots),
      roomRequests: Object.values(data.roomRequests),
      activity: data.activity,
      sessionExpiresAt: active.session.expiresAt,
    }
  }

  async updateLead(sessionToken: string, leadInput: Partial<SpeakerLead> & { id: string }): Promise<SpeakerOpsWriteResult<{ lead: SpeakerLead }>> {
    return this.updateData((data) => {
      const active = this.activeSession(data, sessionToken)
      if (!active) return { ok: false, error: 'Session expired. Sign in again.' }
      const lead = data.leads[leadInput.id]
      if (!lead) return { ok: false, error: 'Speaker was not found.' }

      if (leadInput.stage && SPEAKER_STAGES.includes(leadInput.stage as SpeakerStage)) lead.stage = leadInput.stage
      if (leadInput.term && ['fall-2026', 'winter-2027', 'later'].includes(leadInput.term)) lead.term = leadInput.term
      if (leadInput.format && Object.keys(SPEAKER_FORMAT_LABELS).includes(leadInput.format)) lead.format = leadInput.format as SpeakerFormat
      if (leadInput.ownerEmail && isMemberEmail(leadInput.ownerEmail)) lead.ownerEmail = leadInput.ownerEmail
      if (typeof leadInput.nextAction === 'string') lead.nextAction = cleanText(leadInput.nextAction, 240)
      if (typeof leadInput.evidence === 'string') lead.evidence = cleanText(leadInput.evidence, 500)
      if (typeof leadInput.blocker === 'string') lead.blocker = cleanText(leadInput.blocker, 300)
      lead.updatedAt = isoNow()
      this.appendActivity(data, active.account.email, 'Speaker updated', `${lead.name}: ${lead.nextAction || 'No next action'}`)
      return { ok: true, lead: { ...lead } }
    })
  }

  async updateRoomRequest(sessionToken: string, input: Partial<RoomRequest> & { id: string }): Promise<SpeakerOpsWriteResult<{ roomRequest: RoomRequest }>> {
    return this.updateData((data) => {
      const active = this.activeSession(data, sessionToken)
      if (!active) return { ok: false, error: 'Session expired. Sign in again.' }
      const request = data.roomRequests[input.id]
      if (!request) return { ok: false, error: 'Room request was not found.' }

      const status = input.status
      if (status && ['draft', 'submitted', 'approved', 'declined'].includes(status)) request.status = status as RoomRequestStatus
      if (typeof input.preferredStart === 'string') request.preferredStart = cleanText(input.preferredStart, 80)
      if (typeof input.backupStart === 'string') request.backupStart = cleanText(input.backupStart, 80)
      if (typeof input.setupMinutes === 'number') request.setupMinutes = Math.max(0, Math.min(180, Math.round(input.setupMinutes)))
      if (typeof input.teardownMinutes === 'number') request.teardownMinutes = Math.max(0, Math.min(180, Math.round(input.teardownMinutes)))
      if (typeof input.estimatedAttendance === 'number') request.estimatedAttendance = Math.max(1, Math.min(500, Math.round(input.estimatedAttendance)))
      if (typeof input.accessibilityNotes === 'string') request.accessibilityNotes = cleanText(input.accessibilityNotes, 500)
      if (typeof input.equipmentNotes === 'string') request.equipmentNotes = cleanText(input.equipmentNotes, 500)
      if (input.requestedByEmail && isMemberEmail(input.requestedByEmail)) request.requestedByEmail = input.requestedByEmail
      if (typeof input.reference === 'string') request.reference = cleanText(input.reference, 120)
      if (typeof input.roomName === 'string') request.roomName = cleanText(input.roomName, 120)

      if (request.status === 'submitted' && !request.submittedAt) {
        request.submittedAt = isoNow()
        request.responseDueAt = addBusinessDays(request.submittedAt, 3)
      }
      if (request.status === 'approved' && !request.roomName) {
        return { ok: false, error: 'Enter the Ross room before marking the request approved.' }
      }
      request.updatedAt = isoNow()
      const slot = data.slots[request.slotId]
      if (slot) {
        if (request.status === 'submitted' && slot.status === 'planning') slot.status = 'room-requested'
        if (request.status === 'approved' && slot.status !== 'confirmed') slot.status = 'room-approved'
        if (request.status === 'declined') slot.status = 'planning'
        slot.updatedAt = request.updatedAt
      }
      this.appendActivity(data, active.account.email, 'Room request updated', `${request.slotId}: ${request.status}`)
      return { ok: true, roomRequest: { ...request } }
    })
  }

  async updateSlot(sessionToken: string, input: Partial<ProgramSlot> & { id: ProgramSlot['id'] }): Promise<SpeakerOpsWriteResult<{ slot: ProgramSlot }>> {
    return this.updateData((data) => {
      const active = this.activeSession(data, sessionToken)
      if (!active) return { ok: false, error: 'Session expired. Sign in again.' }
      const slot = data.slots[input.id]
      if (!slot) return { ok: false, error: 'Program slot was not found.' }

      if (typeof input.leadId === 'string' && (!input.leadId || data.leads[input.leadId])) slot.leadId = input.leadId
      if (typeof input.preferredStart === 'string') slot.preferredStart = cleanText(input.preferredStart, 80)
      if (typeof input.backupStart === 'string') slot.backupStart = cleanText(input.backupStart, 80)
      if (input.status && Object.keys(PROGRAM_SLOT_STATUS_LABELS).includes(input.status)) {
        const nextStatus = input.status as ProgramSlotStatus
        if (nextStatus === 'confirmed') {
          if (!active.account.canConfirmProgram) return { ok: false, error: 'Only Sam or Alexa can confirm a programmed date.' }
          const request = data.roomRequests[slot.roomRequestId]
          if (request?.status !== 'approved') return { ok: false, error: 'Ross must approve the room before the fireside can be confirmed.' }
          if (!slot.leadId) return { ok: false, error: 'Choose a speaker before confirming the fireside.' }
        }
        slot.status = nextStatus
      }
      slot.updatedAt = isoNow()
      this.appendActivity(data, active.account.email, 'Program slot updated', `${slot.label}: ${slot.status}`)
      return { ok: true, slot: { ...slot } }
    })
  }
}

export const createSpeakerOpsStore = (dataPath?: string, options?: StoreOptions) => (
  new SpeakerOpsStore(dataPath, options)
)
