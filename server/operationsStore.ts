import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BlobPreconditionFailedError, get, put } from '@vercel/blob'
import {
  ATTENDANCE_STATUS_LABELS,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_STATUS_LABELS,
  OPERATIONS_SUPER_ADMINS,
  REVIEW_STAGE_LABELS,
  STRIKE_REASON_LABELS,
  STRIKE_STATUS_LABELS,
  type AdversarialReview,
  type AttendanceRecord,
  type AttendanceStatus,
  type DocumentCurrentStatus,
  type DocumentSourceStatus,
  type OperationsAccount,
  type OperationsActivity,
  type OperationsDocument,
  type OperationsEvent,
  type OperationsRole,
  type OperationsWorkspace,
  type ReviewDecision,
  type ReviewStage,
  type StrikeReason,
  type StrikeEscalation,
  type StrikeRecord,
  type StrikeStatus,
} from '../src/lib/operations.ts'
import type { SpeakerOpsActor } from './speakerOpsStore.js'

type OperationsData = {
  version: 1
  accounts: Record<string, OperationsAccount>
  events: Record<string, Omit<OperationsEvent, 'status'>>
  attendance: Record<string, AttendanceRecord>
  strikes: Record<string, StrikeRecord>
  escalations: Record<string, StrikeEscalation>
  documents: Record<string, OperationsDocument>
  reviews: Record<string, AdversarialReview>
  activity: OperationsActivity[]
}

type LegacyOperationsData = Partial<OperationsData> & { version?: number }

export type OperationsWriteResult<T> = ({ ok: true } & T) | { ok: false; error: string }

type StoreOptions = {
  forceLocal?: boolean
  now?: () => Date
}

const BLOB_PATH = 'operations/state.json'
const WRITE_ATTEMPTS = 5
const queues = new Map<string, Promise<unknown>>()
const defaultDataPath = () => process.env.UBLDA_OPERATIONS_DATA_FILE
  ? path.resolve(process.env.UBLDA_OPERATIONS_DATA_FILE)
  : path.join(process.cwd(), '.ublda-local-data', 'operations.json')
const cleanText = (value: unknown, max = 500) => typeof value === 'string'
  ? value.replace(/[<>]/g, '').trim().slice(0, max)
  : ''
const randomId = (prefix: string) => `${prefix}_${randomBytes(10).toString('base64url')}`
const canUseBlob = (forceLocal: boolean) => !forceLocal && Boolean(process.env.BLOB_READ_WRITE_TOKEN)
const mutationRejected = (result: unknown) => Boolean(
  result && typeof result === 'object' && 'ok' in result && (result as { ok?: unknown }).ok === false,
)

export const isOperationsSuperAdmin = (email: string) => (
  (OPERATIONS_SUPER_ADMINS as readonly string[]).includes(email.trim().toLowerCase())
)

export const validDocumentDriveUrl = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password) return ''
    const validPath = url.hostname === 'drive.google.com'
      ? /^\/file\/d\/[A-Za-z0-9_-]+\/view\/?$/.test(url.pathname)
      : url.hostname === 'docs.google.com'
        ? /^\/(?:document|spreadsheets|presentation)\/d\/[A-Za-z0-9_-]+(?:\/(?:edit|view))?\/?$/.test(url.pathname)
        : false
    if (!validPath) return ''
    url.hash = ''
    return url.toString().slice(0, 500)
  } catch {
    return ''
  }
}

const accountSeeds = (updatedAt: string): OperationsAccount[] => [
  { name: 'Sam Bodine', email: 'sbodine@umich.edu', title: 'Co-President', role: 'super_admin', updatedAt, updatedBy: 'system' },
  { name: 'Alexa Chiang', email: 'atchiang@umich.edu', title: 'Co-President', role: 'super_admin', updatedAt, updatedBy: 'system' },
  { name: 'Cooper Perry', email: 'cooperry@umich.edu', title: 'Executive Vice President', role: 'super_admin', updatedAt, updatedBy: 'system' },
  { name: 'Alex Forstner', email: 'alexfors@umich.edu', title: 'VP Education', role: 'officer', updatedAt, updatedBy: 'system' },
  { name: 'Andrew Sackett', email: 'andsack@umich.edu', title: 'VP Events', role: 'officer', updatedAt, updatedBy: 'system' },
  { name: 'Landon Miller', email: 'landonem@umich.edu', title: 'VP Finance', role: 'officer', updatedAt, updatedBy: 'system' },
  { name: 'Lindsey Ye', email: 'ylindsey@umich.edu', title: 'VP Operations', role: 'officer', updatedAt, updatedBy: 'system' },
  { name: 'Samantha Naber', email: 'snaber@umich.edu', title: 'Leadership Team', role: 'officer', updatedAt, updatedBy: 'system' },
  { name: 'Solomon Deyoung', email: 'sdeyoun@umich.edu', title: 'Leadership Team', role: 'officer', updatedAt, updatedBy: 'system' },
]

const eventSeeds = (): Array<Omit<OperationsEvent, 'status'>> => [{
  id: 'team-meeting-2026-08-14',
  title: 'UBLDA Team Meeting',
  startsAt: '2026-08-14T15:45:00-04:00',
  endsAt: '2026-08-14T16:15:00-04:00',
  timezone: 'America/Detroit',
  location: 'Location / Meet link not yet verified',
  sourceNote: 'The user confirmed the live Calendar window of 3:45–4:15 PM ET. The location or Google Meet link has not yet been verified.',
  sourceStatus: 'user_confirmed',
  calendarStartsAt: '2026-08-14T15:45:00-04:00',
  calendarEndsAt: '2026-08-14T16:15:00-04:00',
  calendarUrl: '',
  lastVerifiedAt: '2026-08-14T00:00:00-04:00',
}]

const documentSeeds = (updatedAt: string): OperationsDocument[] => [
  {
    id: 'constitution',
    title: 'UBLDA - Constitution.docx',
    category: 'constitution',
    driveUrl: 'https://drive.google.com/file/d/1OQM2b62K93_uKrNVAh0iTSRHtBAP8bDD/view',
    sourceStatus: 'verified',
    currentStatus: 'current',
    sourceNote: 'Verified in Drive under Core Documents (DOCX). Governance review is still required: named roles conflict with current responsibilities, and the advisor, weekly-meeting, and 75% participation requirements need confirmation.',
    ownerEmail: 'cooperry@umich.edu',
    lastVerifiedAt: '2026-08-14T00:00:00-04:00',
    updatedAt,
    updatedBy: 'system',
  },
  {
    id: 'team-meeting-notes-2026-08-14',
    title: 'UBLDA Team Meeting Notes — August 14, 2026',
    category: 'meeting_notes',
    driveUrl: 'https://docs.google.com/document/d/1TKPrLVm80gsmUnNn5g2iwfmAwIWIlsTMiHJJlL3bx8M/edit',
    sourceStatus: 'verified',
    currentStatus: 'current',
    sourceNote: 'Verified shared notes document for today\'s team meeting. A canonical Meeting Notes folder link was not supplied, so this record links directly to the verified file.',
    ownerEmail: 'ylindsey@umich.edu',
    lastVerifiedAt: '2026-08-14T00:00:00-04:00',
    updatedAt,
    updatedBy: 'system',
  },
  {
    id: 'founding-notes-2026-06-28',
    title: 'Founding Team Meeting Notes — June 28, 2026',
    category: 'meeting_notes',
    driveUrl: 'https://docs.google.com/document/d/1FS__OHUyk2ryLXH7LN8Ii06JAtr_SNcBcChK91fn0vI',
    sourceStatus: 'verified',
    currentStatus: 'current',
    sourceNote: 'Brain document #14; source of the current three-strike operating rule.',
    ownerEmail: 'cooperry@umich.edu',
    lastVerifiedAt: '2026-08-14T00:00:00-04:00',
    updatedAt,
    updatedBy: 'system',
  },
  {
    id: 'meeting-notes-2026-07-29',
    title: 'Full E-Board Meeting Notes — July 29, 2026',
    category: 'archive',
    driveUrl: 'https://docs.google.com/document/d/1SRRQmmC0yx271dYn6tmrSudjmsfTO6c9HAhjL_myNck/edit',
    sourceStatus: 'verified',
    currentStatus: 'archived',
    sourceNote: 'Public notes link recorded in the Brain July 29 artifact handoff.',
    ownerEmail: 'ylindsey@umich.edu',
    lastVerifiedAt: '2026-07-29T00:00:00-04:00',
    updatedAt,
    updatedBy: 'system',
  },
]

const emptyData = (): OperationsData => {
  const seededAt = '2026-08-14T00:00:00-04:00'
  const accounts = Object.fromEntries(accountSeeds(seededAt).map((account) => [account.email, account]))
  const events = Object.fromEntries(eventSeeds().map((event) => [event.id, event]))
  const attendance = Object.fromEntries(accountSeeds(seededAt).map((account) => {
    const invited = account.email !== 'atchiang@umich.edu'
    const record: AttendanceRecord = {
      id: `attendance-team-meeting-2026-08-14-${account.email.split('@')[0]}`,
      eventId: 'team-meeting-2026-08-14',
      memberEmail: account.email,
      invited,
      inviteSourceNote: invited
        ? 'Included on the live Google Calendar invite snapshot.'
        : 'Not listed among the eight invitees on the live Google Calendar snapshot; do not infer an absence.',
      status: invited ? 'unrecorded' : 'not_invited',
      noticeAt: '',
      notes: '',
      updatedAt: seededAt,
      updatedBy: 'system',
    }
    return [record.id, record]
  }))
  const documents = Object.fromEntries(documentSeeds(seededAt).map((document) => [document.id, document]))
  const review: AdversarialReview = {
    id: 'review-constitution',
    title: 'Constitution independent review',
    artifactType: 'document',
    artifactId: 'constitution',
    ownerEmail: 'sbodine@umich.edu',
    reviewerEmail: 'cooperry@umich.edu',
    stage: 'draft',
    independentReviewer: true,
    reviewNotes: [],
    history: [],
    updatedAt: seededAt,
  }
  return {
    version: 1,
    accounts,
    events,
    attendance,
    strikes: {},
    escalations: {},
    documents,
    reviews: { [review.id]: review },
    activity: [],
  }
}

const normalizeAccount = (seed: OperationsAccount, raw?: Partial<OperationsAccount>): OperationsAccount => {
  const email = seed.email.toLowerCase()
  const requestedRole = raw?.role
  const allowedRole = requestedRole && ['officer', 'member', 'inactive'].includes(requestedRole)
    ? requestedRole as OperationsRole
    : seed.role
  return {
    ...seed,
    ...raw,
    email,
    name: cleanText(raw?.name || seed.name, 120) || seed.name,
    title: cleanText(raw?.title || seed.title, 120) || seed.title,
    role: isOperationsSuperAdmin(email) ? 'super_admin' : allowedRole,
    updatedAt: cleanText(raw?.updatedAt || seed.updatedAt, 80),
    updatedBy: cleanText(raw?.updatedBy || seed.updatedBy, 160),
  }
}

const normalizeData = (raw: LegacyOperationsData): OperationsData => {
  const seed = emptyData()
  const accounts = Object.fromEntries(Object.values(seed.accounts).map((account) => [
    account.email,
    normalizeAccount(account, raw.accounts?.[account.email]),
  ]))
  const attendance = Object.fromEntries(Object.values(seed.attendance).map((record) => {
    const stored = raw.attendance?.[record.id]
    if (!record.invited) return [record.id, { ...record, ...(stored || {}), invited: false, status: 'not_invited' as const, inviteSourceNote: record.inviteSourceNote }]
    return [record.id, { ...record, ...(stored || {}), invited: true, inviteSourceNote: record.inviteSourceNote }]
  }))
  const documents = Object.fromEntries(Object.values(seed.documents).map((document) => {
    const merged = { ...document, ...(raw.documents?.[document.id] || {}) }
    const driveUrl = validDocumentDriveUrl(merged.driveUrl)
    const sourceStatus = merged.sourceStatus === 'verified' && driveUrl ? 'verified' as const : 'unverified' as const
    return [document.id, {
      ...merged,
      driveUrl,
      sourceStatus,
      lastVerifiedAt: sourceStatus === 'verified' ? cleanText(merged.lastVerifiedAt, 80) : '',
    }]
  }))
  return {
    version: 1,
    accounts,
    events: { ...seed.events, ...(raw.events || {}) },
    attendance,
    strikes: raw.strikes || {},
    escalations: raw.escalations || {},
    documents,
    reviews: { ...seed.reviews, ...(raw.reviews || {}) },
    activity: Array.isArray(raw.activity) ? raw.activity.slice(0, 250) : [],
  }
}

export const operationsEventStatus = (
  event: Pick<OperationsEvent, 'startsAt' | 'endsAt'>,
  now = new Date(),
): OperationsEvent['status'] => {
  const current = now.getTime()
  const starts = new Date(event.startsAt).getTime()
  const ends = new Date(event.endsAt).getTime()
  if (current < starts) return 'upcoming'
  if (current < ends) return 'active'
  return 'inactive'
}

const policy = {
  escalationAt: 3 as const,
  source: 'Brain document #14 — UBLDA Founding Team Meeting Notes, June 28, 2026',
  sourceUrl: 'https://docs.google.com/document/d/1FS__OHUyk2ryLXH7LN8Ii06JAtr_SNcBcChK91fn0vI',
  rules: [
    'More than one missed meeting in a month may earn a strike, with exceptions for illness and genuine academic, club, or career conflicts.',
    'No notice at least 24 hours before a general team meeting may earn a strike.',
    'No notice at least 72 hours before a club event may earn a strike.',
    'A missed deliverable without notice may earn a strike.',
    'Not responding within a reasonable time may earn a communication strike.',
    'Three active strikes trigger a standing review with Sam, Alexa, and Cooper.',
  ],
}

const accountRoleFor = (data: OperationsData, actor: SpeakerOpsActor): OperationsRole => {
  if (isOperationsSuperAdmin(actor.email)) return 'super_admin'
  return data.accounts[actor.email.toLowerCase()]?.role || 'member'
}

export class OperationsAccessError extends Error {
  readonly status = 403

  constructor(message: string) {
    super(message)
    this.name = 'OperationsAccessError'
  }
}

export class OperationsStore {
  private readonly dataPath: string
  private readonly forceLocal: boolean
  private readonly now: () => Date

  constructor(dataPath = defaultDataPath(), options: StoreOptions = {}) {
    this.dataPath = dataPath
    this.forceLocal = Boolean(options.forceLocal)
    this.now = options.now || (() => new Date())
  }

  private storageKey() {
    return canUseBlob(this.forceLocal) ? BLOB_PATH : this.dataPath
  }

  private async readLocal(): Promise<LegacyOperationsData> {
    try {
      return JSON.parse(await readFile(this.dataPath, 'utf8')) as LegacyOperationsData
    } catch {
      return emptyData()
    }
  }

  private async writeLocal(data: OperationsData) {
    await mkdir(path.dirname(this.dataPath), { recursive: true })
    const tempPath = `${this.dataPath}.${process.pid}.${randomBytes(5).toString('base64url')}.tmp`
    await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 })
    await rename(tempPath, this.dataPath)
  }

  private async readBlob() {
    const blob = await get(BLOB_PATH, { access: 'private', useCache: false })
    if (!blob || blob.statusCode !== 200) return { data: emptyData() as LegacyOperationsData, etag: null as string | null }
    const raw = await new Response(blob.stream).text()
    const etag = blob.blob.etag?.replace(/^W\//, '') || null
    return { data: JSON.parse(raw) as LegacyOperationsData, etag }
  }

  private async writeBlob(data: OperationsData, etag: string | null) {
    await put(BLOB_PATH, `${JSON.stringify(data, null, 2)}\n`, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: Boolean(etag),
      contentType: 'application/json',
      ...(etag ? { ifMatch: etag } : {}),
    })
  }

  private async readData() {
    const raw = canUseBlob(this.forceLocal) ? (await this.readBlob()).data : await this.readLocal()
    return normalizeData(raw)
  }

  private async updateData<T>(mutation: (data: OperationsData) => T | Promise<T>): Promise<T> {
    const key = this.storageKey()
    const previous = queues.get(key) || Promise.resolve()
    const task = previous.catch(() => undefined).then(async () => {
      if (!canUseBlob(this.forceLocal)) {
        const data = normalizeData(await this.readLocal())
        const result = await mutation(data)
        if (mutationRejected(result)) return result
        await this.writeLocal(data)
        return result
      }
      for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
        const { data: raw, etag } = await this.readBlob()
        const data = normalizeData(raw)
        const result = await mutation(data)
        if (mutationRejected(result)) return result
        try {
          await this.writeBlob(data, etag)
          return result
        } catch (error) {
          if (!(error instanceof BlobPreconditionFailedError) || attempt === WRITE_ATTEMPTS - 1) throw error
        }
      }
      throw new Error('Operations storage could not be updated.')
    })
    queues.set(key, task)
    try {
      return await task
    } finally {
      if (queues.get(key) === task) queues.delete(key)
    }
  }

  private requireWrite(actor: SpeakerOpsActor): { ok: true } | { ok: false; error: string } {
    return isOperationsSuperAdmin(actor.email)
      ? { ok: true }
      : { ok: false, error: 'Only the three Operations super admins can change this workspace.' }
  }

  private appendActivity(data: OperationsData, actorEmail: string, action: string, detail: string) {
    data.activity.unshift({
      id: randomId('activity'),
      actorEmail: actorEmail.toLowerCase(),
      action: cleanText(action, 100),
      detail: cleanText(detail, 500),
      createdAt: this.now().toISOString(),
    })
    data.activity = data.activity.slice(0, 250)
  }

  private syncEscalation(data: OperationsData, memberEmail: string, actorEmail: string) {
    const activeCount = Object.values(data.strikes).filter((strike) => (
      strike.memberEmail === memberEmail && strike.status === 'active'
    )).length
    const open = Object.values(data.escalations).find((escalation) => (
      escalation.memberEmail === memberEmail && escalation.status === 'open'
    ))
    const createdAt = this.now().toISOString()
    if (activeCount >= policy.escalationAt && !open) {
      const due = new Date(this.now())
      due.setUTCDate(due.getUTCDate() + 7)
      const escalation: StrikeEscalation = {
        id: randomId('escalation'),
        memberEmail,
        ownerEmail: 'sbodine@umich.edu',
        dueAt: due.toISOString(),
        status: 'open',
        openedAt: createdAt,
        resolvedAt: '',
        resolutionNote: '',
        history: [{
          id: randomId('escalation-history'),
          action: 'opened',
          activeStrikeCount: activeCount,
          actorEmail: actorEmail.toLowerCase(),
          note: 'Three active strikes triggered a standing review with Sam, Alexa, and Cooper.',
          createdAt,
        }],
        updatedAt: createdAt,
      }
      data.escalations[escalation.id] = escalation
      return
    }
    if (activeCount < policy.escalationAt && open) {
      open.status = 'resolved'
      open.resolvedAt = createdAt
      open.resolutionNote = 'Automatically resolved when the active strike count dropped below three.'
      open.updatedAt = createdAt
      open.history.unshift({
        id: randomId('escalation-history'),
        action: 'resolved',
        activeStrikeCount: activeCount,
        actorEmail: actorEmail.toLowerCase(),
        note: open.resolutionNote,
        createdAt,
      })
    }
  }

  async workspace(actor: SpeakerOpsActor): Promise<OperationsWorkspace> {
    const data = await this.readData()
    const email = actor.email.toLowerCase()
    const role = accountRoleFor(data, actor)
    if (role === 'inactive') {
      throw new OperationsAccessError('This Operations account is inactive.')
    }
    const activeStrikes = Object.values(data.strikes).filter((strike) => strike.status === 'active')
    return {
      viewer: {
        memberId: actor.memberId,
        name: actor.displayName || data.accounts[email]?.name || email,
        email,
        role,
        canWrite: isOperationsSuperAdmin(email),
      },
      accounts: Object.values(data.accounts),
      events: Object.values(data.events).map((event) => ({
        ...event,
        status: operationsEventStatus(event, this.now()),
      })),
      attendance: Object.values(data.attendance),
      strikes: Object.values(data.strikes),
      strikeSummary: Object.values(data.accounts).map((account) => {
        const activeCount = activeStrikes.filter((strike) => strike.memberEmail === account.email).length
        return { memberEmail: account.email, activeCount, escalationRequired: activeCount >= policy.escalationAt }
      }),
      escalations: Object.values(data.escalations),
      documents: Object.values(data.documents),
      reviews: Object.values(data.reviews),
      activity: data.activity,
      policy,
    }
  }

  async updateAttendance(
    actor: SpeakerOpsActor,
    input: Pick<AttendanceRecord, 'eventId' | 'memberEmail'> & Partial<AttendanceRecord>,
  ): Promise<OperationsWriteResult<{ attendance: AttendanceRecord }>> {
    const authorized = this.requireWrite(actor)
    if (!authorized.ok) return authorized
    return this.updateData((data) => {
      if (!data.events[input.eventId]) return { ok: false, error: 'Event was not found.' }
      const memberEmail = input.memberEmail.toLowerCase()
      if (!data.accounts[memberEmail]) return { ok: false, error: 'Member was not found.' }
      const existing = Object.values(data.attendance).find((record) => (
        record.eventId === input.eventId && record.memberEmail === memberEmail
      ))
      if (!existing) return { ok: false, error: 'Attendance record was not found.' }
      if (!existing.invited) {
        return { ok: false, error: 'This person was not on the meeting invite; attendance cannot imply an absence.' }
      }
      if (input.status && Object.keys(ATTENDANCE_STATUS_LABELS).includes(input.status)) {
        existing.status = input.status as AttendanceStatus
      }
      if (typeof input.noticeAt === 'string') existing.noticeAt = cleanText(input.noticeAt, 80)
      if (typeof input.notes === 'string') existing.notes = cleanText(input.notes, 800)
      existing.updatedAt = this.now().toISOString()
      existing.updatedBy = actor.email.toLowerCase()
      this.appendActivity(data, actor.email, 'Attendance updated', `${memberEmail}: ${existing.status}`)
      return { ok: true, attendance: { ...existing } }
    })
  }

  async createStrike(
    actor: SpeakerOpsActor,
    input: Pick<StrikeRecord, 'memberEmail' | 'reason' | 'detail'> & Partial<Pick<StrikeRecord, 'eventId'>>,
  ): Promise<OperationsWriteResult<{ strike: StrikeRecord }>> {
    const authorized = this.requireWrite(actor)
    if (!authorized.ok) return authorized
    return this.updateData((data) => {
      const memberEmail = input.memberEmail.toLowerCase()
      if (!data.accounts[memberEmail]) return { ok: false, error: 'Member was not found.' }
      if (!Object.keys(STRIKE_REASON_LABELS).includes(input.reason)) return { ok: false, error: 'Choose a valid strike reason.' }
      const detail = cleanText(input.detail, 800)
      if (!detail) return { ok: false, error: 'Document the evidence before adding a strike.' }
      if (input.eventId && !data.events[input.eventId]) return { ok: false, error: 'Event was not found.' }
      const createdAt = this.now().toISOString()
      const strike: StrikeRecord = {
        id: randomId('strike'),
        memberEmail,
        reason: input.reason as StrikeReason,
        detail,
        eventId: cleanText(input.eventId, 120),
        status: 'active',
        issuedAt: createdAt,
        issuedBy: actor.email.toLowerCase(),
        updatedAt: createdAt,
        audit: [{
          id: randomId('audit'),
          action: 'created',
          fromStatus: '',
          toStatus: 'active',
          note: detail,
          actorEmail: actor.email.toLowerCase(),
          createdAt,
        }],
      }
      data.strikes[strike.id] = strike
      this.syncEscalation(data, memberEmail, actor.email)
      this.appendActivity(data, actor.email, 'Strike added', `${memberEmail}: ${STRIKE_REASON_LABELS[strike.reason]}`)
      return { ok: true, strike }
    })
  }

  async updateStrikeStatus(
    actor: SpeakerOpsActor,
    input: { id: string; status: StrikeStatus; note: string },
  ): Promise<OperationsWriteResult<{ strike: StrikeRecord }>> {
    const authorized = this.requireWrite(actor)
    if (!authorized.ok) return authorized
    return this.updateData((data) => {
      const strike = data.strikes[input.id]
      if (!strike) return { ok: false, error: 'Strike was not found.' }
      if (!Object.keys(STRIKE_STATUS_LABELS).includes(input.status)) return { ok: false, error: 'Choose a valid strike status.' }
      const note = cleanText(input.note, 800)
      if (!note) return { ok: false, error: 'Add an audit note for this status change.' }
      const previous = strike.status
      const createdAt = this.now().toISOString()
      strike.status = input.status
      strike.updatedAt = createdAt
      strike.audit.unshift({
        id: randomId('audit'),
        action: previous === input.status ? 'note_added' : 'status_changed',
        fromStatus: previous,
        toStatus: input.status,
        note,
        actorEmail: actor.email.toLowerCase(),
        createdAt,
      })
      this.syncEscalation(data, strike.memberEmail, actor.email)
      this.appendActivity(data, actor.email, 'Strike reviewed', `${strike.memberEmail}: ${STRIKE_STATUS_LABELS[input.status]}`)
      return { ok: true, strike: { ...strike } }
    })
  }

  async updateAccount(
    actor: SpeakerOpsActor,
    input: { email: string; role: OperationsRole },
  ): Promise<OperationsWriteResult<{ account: OperationsAccount }>> {
    const authorized = this.requireWrite(actor)
    if (!authorized.ok) return authorized
    return this.updateData((data) => {
      const email = input.email.toLowerCase()
      const account = data.accounts[email]
      if (!account) return { ok: false, error: 'Account was not found.' }
      if (isOperationsSuperAdmin(email)) {
        if (input.role !== 'super_admin') return { ok: false, error: 'The three fixed super-admin accounts cannot be demoted here.' }
      } else if (!['officer', 'member', 'inactive'].includes(input.role)) {
        return { ok: false, error: 'Only the fixed allowlist can hold the super-admin role.' }
      }
      account.role = isOperationsSuperAdmin(email) ? 'super_admin' : input.role
      account.updatedAt = this.now().toISOString()
      account.updatedBy = actor.email.toLowerCase()
      this.appendActivity(data, actor.email, 'Account role updated', `${email}: ${account.role}`)
      return { ok: true, account: { ...account } }
    })
  }

  async updateDocument(
    actor: SpeakerOpsActor,
    input: Partial<OperationsDocument> & { id: string },
  ): Promise<OperationsWriteResult<{ document: OperationsDocument }>> {
    const authorized = this.requireWrite(actor)
    if (!authorized.ok) return authorized
    return this.updateData((data) => {
      const document = data.documents[input.id]
      if (!document) return { ok: false, error: 'Document was not found.' }
      if (input.category && Object.keys(DOCUMENT_CATEGORY_LABELS).includes(input.category)) document.category = input.category
      if (input.currentStatus && Object.keys(DOCUMENT_STATUS_LABELS).includes(input.currentStatus)) {
        document.currentStatus = input.currentStatus as DocumentCurrentStatus
      }
      if (input.sourceStatus && ['verified', 'unverified'].includes(input.sourceStatus)) {
        document.sourceStatus = input.sourceStatus as DocumentSourceStatus
      }
      if (typeof input.driveUrl === 'string') document.driveUrl = validDocumentDriveUrl(input.driveUrl)
      if (typeof input.sourceNote === 'string') document.sourceNote = cleanText(input.sourceNote, 1000)
      if (input.ownerEmail && data.accounts[input.ownerEmail.toLowerCase()]) document.ownerEmail = input.ownerEmail.toLowerCase()
      if (document.sourceStatus === 'verified' && !document.driveUrl) {
        return { ok: false, error: 'A verified document needs a valid Drive link.' }
      }
      document.lastVerifiedAt = document.sourceStatus === 'verified' ? this.now().toISOString() : ''
      document.updatedAt = this.now().toISOString()
      document.updatedBy = actor.email.toLowerCase()
      this.appendActivity(data, actor.email, 'Document updated', `${document.title}: ${document.currentStatus}`)
      return { ok: true, document: { ...document } }
    })
  }

  async updateReview(
    actor: SpeakerOpsActor,
    input: { id: string; decision?: ReviewDecision; reviewerEmail?: string; note: string },
  ): Promise<OperationsWriteResult<{ review: AdversarialReview }>> {
    const authorized = this.requireWrite(actor)
    if (!authorized.ok) return authorized
    return this.updateData((data) => {
      const review = data.reviews[input.id]
      if (!review) return { ok: false, error: 'Review was not found.' }
      const note = cleanText(input.note, 1200)
      const createdAt = this.now().toISOString()

      if (input.reviewerEmail) {
        const reviewerEmail = input.reviewerEmail.toLowerCase()
        if (!['draft', 'changes_requested'].includes(review.stage)) {
          return { ok: false, error: 'Reviewer assignment is frozen after the artifact is submitted for review.' }
        }
        if (actor.email.toLowerCase() === review.ownerEmail) {
          return { ok: false, error: 'The artifact owner cannot assign or replace the independent reviewer.' }
        }
        if (!isOperationsSuperAdmin(reviewerEmail)) {
          return { ok: false, error: 'The assigned reviewer must be one of the three privileged reviewers.' }
        }
        if (reviewerEmail === review.ownerEmail) {
          return { ok: false, error: 'The reviewer must be independent from the artifact owner.' }
        }
        const previousReviewer = review.reviewerEmail
        review.reviewerEmail = reviewerEmail
        review.independentReviewer = true
        review.history.unshift({
          id: randomId('review-history'),
          action: 'assigned',
          fromStage: review.stage,
          toStage: review.stage,
          actorEmail: actor.email.toLowerCase(),
          note: note || `Reviewer changed from ${previousReviewer} to ${reviewerEmail}.`,
          createdAt,
        })
      }

      if (input.decision) {
        const transitions: Record<ReviewDecision, { from: ReviewStage[]; to: ReviewStage; reviewerOnly?: boolean }> = {
          submit: { from: ['draft', 'changes_requested'], to: 'ready_for_review' },
          start_review: { from: ['ready_for_review'], to: 'in_review', reviewerOnly: true },
          approve: { from: ['in_review'], to: 'approved', reviewerOnly: true },
          request_changes: { from: ['in_review'], to: 'changes_requested', reviewerOnly: true },
          reopen: { from: ['approved'], to: 'draft' },
        }
        const transition = transitions[input.decision]
        if (!transition.from.includes(review.stage)) return { ok: false, error: `This review cannot ${input.decision.replaceAll('_', ' ')} from ${REVIEW_STAGE_LABELS[review.stage]}.` }
        if (transition.reviewerOnly && actor.email.toLowerCase() !== review.reviewerEmail) {
          return { ok: false, error: 'Only the assigned independent reviewer can take that action.' }
        }
        if (['approve', 'request_changes'].includes(input.decision) && !note) {
          return { ok: false, error: 'The reviewer must record a review note with the decision.' }
        }
        if (review.ownerEmail === review.reviewerEmail) {
          return { ok: false, error: 'Independent review requires a reviewer other than the artifact owner.' }
        }
        const fromStage = review.stage
        review.stage = transition.to
        review.independentReviewer = review.ownerEmail !== review.reviewerEmail
        review.history.unshift({
          id: randomId('review-history'),
          action: input.decision,
          fromStage,
          toStage: review.stage,
          actorEmail: actor.email.toLowerCase(),
          note,
          createdAt,
        })
      }

      if (note) {
        review.reviewNotes.unshift({
          id: randomId('review-note'),
          authorEmail: actor.email.toLowerCase(),
          note,
          createdAt,
        })
      }
      review.updatedAt = createdAt
      this.appendActivity(data, actor.email, 'Review updated', `${review.title}: ${REVIEW_STAGE_LABELS[review.stage]}`)
      return { ok: true, review: { ...review } }
    })
  }
}

export const createOperationsStore = (dataPath?: string, options?: StoreOptions) => (
  new OperationsStore(dataPath, options)
)
