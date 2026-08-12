import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BlobPreconditionFailedError, get, put } from '@vercel/blob'
import {
  PROGRAM_SLOT_STATUS_LABELS,
  SPEAKER_FORMAT_LABELS,
  SPEAKER_OPS_MEMBERS,
  SPEAKER_STAGES,
  type ProgramSlot,
  type ProgramSlotStatus,
  type RoomRequest,
  type RoomRequestStatus,
  type SpeakerFormat,
  type SpeakerLead,
  type SpeakerOpsActivity,
  type SpeakerOpsMemberEmail,
  type SpeakerOpsViewer,
  type SpeakerOpsWorkspace,
  type SpeakerStage,
} from '../src/lib/speakerOps.ts'

type SpeakerOpsData = {
  version: 3
  leads: Record<string, SpeakerLead>
  slots: Record<string, ProgramSlot>
  roomRequests: Record<string, RoomRequest>
  activity: SpeakerOpsActivity[]
}

type LegacySpeakerOpsData = Omit<SpeakerOpsData, 'version'> & {
  version?: 1 | 2 | 3
}

export type SpeakerOpsActor = {
  memberId: string
  displayName: string
  email: string
  role: 'admin' | 'member'
}

export type SpeakerOpsWriteResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

type StoreOptions = {
  forceLocal?: boolean
}

const BLOB_PATH = 'speaker-ops/state.json'
const WRITE_ATTEMPTS = 5
const queues = new Map<string, Promise<unknown>>()

const defaultDataPath = () => process.env.UBLDA_SPEAKER_OPS_DATA_FILE
  ? path.resolve(process.env.UBLDA_SPEAKER_OPS_DATA_FILE)
  : path.join(process.cwd(), '.ublda-local-data', 'speaker-ops.json')
const isoNow = () => new Date().toISOString()
const cleanText = (value: string, max = 500) => value.replace(/[<>]/g, '').trim().slice(0, max)
const randomId = (prefix: string) => `${prefix}_${randomBytes(10).toString('base64url')}`
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
  version: 3,
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

const migrateData = (raw: LegacySpeakerOpsData): SpeakerOpsData => {
  const seeded = emptyData()
  const leads = { ...seeded.leads, ...(raw.leads || {}) }
  const activity = Array.isArray(raw.activity) ? [...raw.activity] : seeded.activity

  if (raw.version === 1) {
    Object.assign(leads, Object.fromEntries(leadSeeds().map((lead) => [lead.id, lead])))
    delete leads['grant-kessler']
    activity.unshift({
      id: 'context_reconciled_2026_08_10',
      actorEmail: 'system',
      action: 'Pipeline reconciled',
      detail: 'Corrected Grant Shelton and loaded the verified Brain, Gmail, and Drive pipeline under the two-event cap.',
      createdAt: '2026-08-10T19:00:00.000Z',
    })
  }

  return {
    version: 3,
    leads,
    slots: { ...seeded.slots, ...(raw.slots || {}) },
    roomRequests: { ...seeded.roomRequests, ...(raw.roomRequests || {}) },
    activity,
  }
}

const memberView = (email: SpeakerOpsMemberEmail) => {
  const member = SPEAKER_OPS_MEMBERS.find((candidate) => candidate.email === email)!
  return {
    name: member.name,
    email: member.email,
    title: member.title,
    canConfirmProgram: false,
  }
}

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
const memberForActor = (actor: SpeakerOpsActor) => {
  const member = SPEAKER_OPS_MEMBERS.find((candidate) => candidate.email === actor.email)
  return member || {
    name: actor.displayName || actor.email,
    email: actor.email,
    title: 'Leadership Team',
  }
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
      return JSON.parse(await readFile(this.dataPath, 'utf8')) as LegacySpeakerOpsData
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
    // Vercel Blob returns weak ETags (for example `W/<opaque>`). `ifMatch`
    // expects that exact validator; stripping the prefix makes every
    // conditional write fail even when no concurrent writer exists.
    return { data: JSON.parse(raw) as LegacySpeakerOpsData, etag: blob.blob.etag || null }
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

  private appendActivity(
    data: SpeakerOpsData,
    actorEmail: string,
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

  async workspace(actor: SpeakerOpsActor): Promise<SpeakerOpsWorkspace> {
    const member = memberForActor(actor)
    const rawData = canUseBlob(this.forceLocal)
      ? (await this.readBlob()).data
      : await this.readLocal()
    const data = migrateData(rawData)
    if (rawData.version !== 3) {
      // Migration is the only read path allowed to persist. Current v3
      // workspace reads remain side-effect-free.
      await this.updateData((stored) => {
        Object.assign(stored, data)
      })
    }
    return {
      viewer: {
        memberId: actor.memberId,
        name: actor.displayName || member.name,
        email: member.email,
        title: member.title,
        role: actor.role,
        canConfirmProgram: actor.role === 'admin',
      } satisfies SpeakerOpsViewer,
      members: SPEAKER_OPS_MEMBERS.map((candidate) => memberView(candidate.email)),
      leads: Object.values(data.leads),
      slots: Object.values(data.slots),
      roomRequests: Object.values(data.roomRequests),
      activity: data.activity,
    }
  }

  async updateLead(actor: SpeakerOpsActor, leadInput: Partial<SpeakerLead> & { id: string }): Promise<SpeakerOpsWriteResult<{ lead: SpeakerLead }>> {
    const member = memberForActor(actor)
    return this.updateData((data) => {
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
      this.appendActivity(data, member.email, 'Speaker updated', `${lead.name}: ${lead.nextAction || 'No next action'}`)
      return { ok: true, lead: { ...lead } }
    })
  }

  async updateRoomRequest(actor: SpeakerOpsActor, input: Partial<RoomRequest> & { id: string }): Promise<SpeakerOpsWriteResult<{ roomRequest: RoomRequest }>> {
    const member = memberForActor(actor)
    return this.updateData((data) => {
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
      this.appendActivity(data, member.email, 'Room request updated', `${request.slotId}: ${request.status}`)
      return { ok: true, roomRequest: { ...request } }
    })
  }

  async updateSlot(actor: SpeakerOpsActor, input: Partial<ProgramSlot> & { id: ProgramSlot['id'] }): Promise<SpeakerOpsWriteResult<{ slot: ProgramSlot }>> {
    const member = memberForActor(actor)
    return this.updateData((data) => {
      const slot = data.slots[input.id]
      if (!slot) return { ok: false, error: 'Program slot was not found.' }

      if (typeof input.leadId === 'string' && (!input.leadId || data.leads[input.leadId])) slot.leadId = input.leadId
      if (typeof input.preferredStart === 'string') slot.preferredStart = cleanText(input.preferredStart, 80)
      if (typeof input.backupStart === 'string') slot.backupStart = cleanText(input.backupStart, 80)
      if (input.status && Object.keys(PROGRAM_SLOT_STATUS_LABELS).includes(input.status)) {
        const nextStatus = input.status as ProgramSlotStatus
        if (nextStatus === 'confirmed') {
          if (actor.role !== 'admin') return { ok: false, error: 'Only a workspace administrator can confirm a programmed date.' }
          const request = data.roomRequests[slot.roomRequestId]
          if (request?.status !== 'approved') return { ok: false, error: 'Ross must approve the room before the fireside can be confirmed.' }
          if (!slot.leadId) return { ok: false, error: 'Choose a speaker before confirming the fireside.' }
        }
        slot.status = nextStatus
      }
      slot.updatedAt = isoNow()
      this.appendActivity(data, member.email, 'Program slot updated', `${slot.label}: ${slot.status}`)
      return { ok: true, slot: { ...slot } }
    })
  }
}

export const createSpeakerOpsStore = (dataPath?: string, options?: StoreOptions) => (
  new SpeakerOpsStore(dataPath, options)
)
