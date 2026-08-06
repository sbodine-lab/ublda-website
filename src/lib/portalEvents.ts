export type ClubEventKind = 'fireside' | 'workshop' | 'social' | 'tabling' | 'meeting' | 'service' | 'info-session'
export type ClubEventFormat = 'in-person' | 'virtual' | 'hybrid'
export type ClubEventStatus = 'draft' | 'published' | 'cancelled'
export type RoomStatus = 'not-requested' | 'requested' | 'confirmed'
export type CommitmentState = 'confirmed' | 'on-request' | 'not-available'

export const CLUB_EVENT_KINDS: ClubEventKind[] = ['fireside', 'workshop', 'social', 'tabling', 'meeting', 'service', 'info-session']
export const CLUB_EVENT_FORMATS: ClubEventFormat[] = ['in-person', 'virtual', 'hybrid']
export const CLUB_EVENT_STATUSES: ClubEventStatus[] = ['draft', 'published', 'cancelled']
export const ROOM_STATUSES: RoomStatus[] = ['not-requested', 'requested', 'confirmed']
export const COMMITMENT_STATES: CommitmentState[] = ['confirmed', 'on-request', 'not-available']

export const ACCESS_COMMITMENT_CATALOG = [
  'step-free-route', 'accessible-restroom-same-floor', 'live-captions', 'asl-interpreter',
  'mic-always-used', 'slides-shared-in-advance', 'quiet-space-available',
  'food-labeled-allergens', 'seating-reserved-front', 'no-flashing-content',
  'recording-available-after',
] as const
export type AccessCommitmentId = (typeof ACCESS_COMMITMENT_CATALOG)[number]

export type AccessCommitment = { id: AccessCommitmentId; state: CommitmentState }

export const ACCESS_COMMITMENT_LABELS: Record<AccessCommitmentId, string> = {
  'step-free-route': 'Step-free route to the room',
  'accessible-restroom-same-floor': 'Accessible restroom on the same floor',
  'live-captions': 'Live captions',
  'asl-interpreter': 'ASL interpreter',
  'mic-always-used': 'Microphone always used',
  'slides-shared-in-advance': 'Slides shared in advance',
  'quiet-space-available': 'Quiet space available',
  'food-labeled-allergens': 'Food labeled with allergens',
  'seating-reserved-front': 'Seating reserved at the front',
  'no-flashing-content': 'No flashing content',
  'recording-available-after': 'Recording available afterwards',
}

export const EVENT_TITLE_LIMIT = 120
export const EVENT_SUMMARY_LIMIT = 600
export const EVENT_LOCATION_NAME_LIMIT = 120
export const EVENT_LOCATION_DETAIL_LIMIT = 240
export const EVENT_NAME_LIMIT = 120
export const EVENT_URL_LIMIT = 500
export const EVENT_INTERNAL_NOTES_LIMIT = 1000
export const EVENT_CAPACITY_LIMIT = 1000
export const RSVP_NOTE_LIMIT = 300
export const RSVP_GUEST_LIMIT = 2

export type ClubEvent = {
  id: string
  title: string
  summary: string
  kind: ClubEventKind
  format: ClubEventFormat
  startsAt: string
  endsAt: string
  locationName: string
  locationDetail: string
  virtualUrl: string
  hostName: string
  speakerName: string
  speakerOrg: string
  capacity: number
  rsvpDeadline: string
  status: ClubEventStatus
  accessCommitments: AccessCommitment[]
  accommodationsContactEmail: string
  recordingUrl: string
  slidesUrl: string
  roomStatus: RoomStatus
  internalNotes: string
  createdAt: string
  updatedAt: string
  createdBy: string
  publishedAt: string
  publishedBy: string
}

/** The author-supplied half of a ClubEvent. Server fields are never accepted from a client. */
export type ClubEventData = Pick<ClubEvent,
  | 'id' | 'title' | 'summary' | 'kind' | 'format' | 'startsAt' | 'endsAt'
  | 'locationName' | 'locationDetail' | 'virtualUrl' | 'hostName' | 'speakerName' | 'speakerOrg'
  | 'capacity' | 'rsvpDeadline' | 'accessCommitments' | 'accommodationsContactEmail'
  | 'recordingUrl' | 'slidesUrl' | 'roomStatus' | 'internalNotes'
>

export type RsvpResponse = 'going' | 'interested' | 'not-going'
export const RSVP_RESPONSES: RsvpResponse[] = ['going', 'interested', 'not-going']

export type EventRsvp = {
  id: string
  eventId: string
  email: string
  response: RsvpResponse
  guestCount: number
  accommodationNote: string
  shareAccommodationWithLeads: boolean
  respondedAt: string
  checkedInAt: string
  checkedInBy: string
}

export type EventRsvpSelfView = Omit<EventRsvp, 'checkedInBy'>

export type RsvpData = {
  eventId: string
  response: RsvpResponse
  guestCount: number
  /**
   * OPTIONAL ON PURPOSE. `undefined` means "the caller said nothing about the note, leave it
   * alone"; `''` means "the member cleared it." Collapsing the two would let a bare
   * going/interested/can't-make-it click erase an accommodation note the member wrote on a
   * different screen — the most sensitive free-text field in the product, deleted with no
   * warning and no undo by the product's own primary call to action.
   */
  accommodationNote?: string
  shareAccommodationWithLeads?: boolean
}

/** Member-visible projection. Constructed as a fresh literal — never a redaction. */
export type ClubEventPublicView = Pick<ClubEvent,
  | 'id' | 'title' | 'summary' | 'kind' | 'format' | 'startsAt' | 'endsAt'
  | 'locationName' | 'locationDetail' | 'hostName' | 'speakerName' | 'speakerOrg'
  | 'capacity' | 'rsvpDeadline' | 'accessCommitments' | 'accommodationsContactEmail'
  | 'recordingUrl' | 'slidesUrl' | 'status'
> & { virtualUrl: string; rsvpCount: number; yourRsvp: EventRsvpSelfView | null }

export type ClubEventValidation =
  | { success: true; data: ClubEventData; errors: [] }
  | { success: false; data: null; errors: string[] }

export type RsvpValidation =
  | { success: true; data: RsvpData; errors: [] }
  | { success: false; data: null; errors: string[] }

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const commitmentIds = new Set<string>(ACCESS_COMMITMENT_CATALOG)

const createId = (prefix: string) => {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

  return `${prefix}_${suffix}`
}

const getString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key]
  return typeof value === 'string' ? value.replace(/[<>]/g, '').trim() : ''
}

const isSafeHref = (value: string) => value.startsWith('https://') || value.startsWith('/')

const getInteger = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key]
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Math.trunc(Number(value))
  return 0
}

export const rsvpKey = (eventId: string, email: string) => `${eventId}:${email.trim().toLowerCase()}`

export const validateClubEventPayload = (payload: unknown): ClubEventValidation => {
  if (!payload || typeof payload !== 'object') {
    return { success: false, data: null, errors: ['Event was empty.'] }
  }

  const body = payload as Record<string, unknown>
  if (Object.keys(body).length === 0) {
    return { success: false, data: null, errors: ['Event was empty.'] }
  }

  const errors: string[] = []
  const id = getString(body, 'id')
  const title = getString(body, 'title')
  const summary = getString(body, 'summary')
  const kind = getString(body, 'kind')
  const format = getString(body, 'format')
  const startsAt = getString(body, 'startsAt')
  const endsAt = getString(body, 'endsAt')
  const locationName = getString(body, 'locationName')
  const locationDetail = getString(body, 'locationDetail')
  const virtualUrl = getString(body, 'virtualUrl')
  const hostName = getString(body, 'hostName')
  const speakerName = getString(body, 'speakerName')
  const speakerOrg = getString(body, 'speakerOrg')
  const rsvpDeadline = getString(body, 'rsvpDeadline')
  const accommodationsContactEmail = getString(body, 'accommodationsContactEmail').toLowerCase()
  const recordingUrl = getString(body, 'recordingUrl')
  const slidesUrl = getString(body, 'slidesUrl')
  const roomStatus = getString(body, 'roomStatus') || 'not-requested'
  const internalNotes = getString(body, 'internalNotes')
  const capacity = getInteger(body, 'capacity')

  if (!title) errors.push('Event title is required.')
  if (title.length > EVENT_TITLE_LIMIT) errors.push(`Event title must be ${EVENT_TITLE_LIMIT} characters or fewer.`)
  if (summary.length > EVENT_SUMMARY_LIMIT) errors.push(`Event summary must be ${EVENT_SUMMARY_LIMIT} characters or fewer.`)
  if (!CLUB_EVENT_KINDS.some((option) => option === kind)) errors.push('Choose an event kind from the list.')
  if (!CLUB_EVENT_FORMATS.some((option) => option === format)) errors.push('Choose an event format from the list.')
  if (!startsAt || Number.isNaN(Date.parse(startsAt))) errors.push('Event start time is required.')
  if (!endsAt || Number.isNaN(Date.parse(endsAt))) errors.push('Event end time is required.')
  if (locationName.length > EVENT_LOCATION_NAME_LIMIT) errors.push(`Location must be ${EVENT_LOCATION_NAME_LIMIT} characters or fewer.`)
  if (locationDetail.length > EVENT_LOCATION_DETAIL_LIMIT) errors.push(`Location detail must be ${EVENT_LOCATION_DETAIL_LIMIT} characters or fewer.`)
  if (hostName.length > EVENT_NAME_LIMIT) errors.push(`Host name must be ${EVENT_NAME_LIMIT} characters or fewer.`)
  if (speakerName.length > EVENT_NAME_LIMIT) errors.push(`Speaker name must be ${EVENT_NAME_LIMIT} characters or fewer.`)
  if (speakerOrg.length > EVENT_NAME_LIMIT) errors.push(`Speaker organization must be ${EVENT_NAME_LIMIT} characters or fewer.`)
  if (capacity < 0 || capacity > EVENT_CAPACITY_LIMIT) errors.push(`Capacity must be between 0 and ${EVENT_CAPACITY_LIMIT}.`)
  if (rsvpDeadline && Number.isNaN(Date.parse(rsvpDeadline))) errors.push('RSVP deadline must be a real date.')
  if (accommodationsContactEmail && !emailPattern.test(accommodationsContactEmail)) {
    errors.push('The accommodations contact must be a valid email address.')
  }
  if (!ROOM_STATUSES.some((option) => option === roomStatus)) errors.push('Choose a room status from the list.')
  if (internalNotes.length > EVENT_INTERNAL_NOTES_LIMIT) errors.push(`Internal notes must be ${EVENT_INTERNAL_NOTES_LIMIT} characters or fewer.`)

  const urls: [string, string][] = [
    [virtualUrl, 'Virtual link'],
    [recordingUrl, 'Recording link'],
    [slidesUrl, 'Slides link'],
  ]
  urls.forEach(([value, label]) => {
    if (!value) return
    if (value.length > EVENT_URL_LIMIT) errors.push(`${label} must be ${EVENT_URL_LIMIT} characters or fewer.`)
    else if (!isSafeHref(value)) errors.push(`${label} must start with https://.`)
  })

  const rawCommitments = Array.isArray(body.accessCommitments) ? body.accessCommitments : []
  if (body.accessCommitments !== undefined && !Array.isArray(body.accessCommitments)) {
    errors.push('Access commitments must be a list.')
  }
  if (rawCommitments.length > ACCESS_COMMITMENT_CATALOG.length) {
    errors.push(`Access commitments must be ${ACCESS_COMMITMENT_CATALOG.length} items or fewer.`)
  }

  const seen = new Set<string>()
  const accessCommitments: AccessCommitment[] = []

  rawCommitments.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      errors.push('Each access commitment needs an option and a state.')
      return
    }

    const row = entry as Record<string, unknown>
    const commitmentId = getString(row, 'id')
    const state = getString(row, 'state')

    if (!commitmentIds.has(commitmentId)) {
      errors.push('Access commitments include an option that is not on the list.')
      return
    }
    if (!COMMITMENT_STATES.some((option) => option === state)) {
      errors.push('Each access commitment must be confirmed, on request, or not available.')
      return
    }
    if (seen.has(commitmentId)) return

    seen.add(commitmentId)
    accessCommitments.push({ id: commitmentId as AccessCommitmentId, state: state as CommitmentState })
  })

  if (errors.length > 0) {
    return { success: false, data: null, errors }
  }

  return {
    success: true,
    data: {
      id,
      title,
      summary,
      kind: kind as ClubEventKind,
      format: format as ClubEventFormat,
      startsAt,
      endsAt,
      locationName,
      locationDetail,
      virtualUrl,
      hostName,
      speakerName,
      speakerOrg,
      capacity,
      rsvpDeadline,
      accessCommitments,
      accommodationsContactEmail,
      recordingUrl,
      slidesUrl,
      roomStatus: roomStatus as RoomStatus,
      internalNotes,
    },
    errors: [],
  }
}

export const validateRsvpPayload = (payload: unknown): RsvpValidation => {
  if (!payload || typeof payload !== 'object') {
    return { success: false, data: null, errors: ['RSVP was empty.'] }
  }

  const body = payload as Record<string, unknown>
  if (Object.keys(body).length === 0) {
    return { success: false, data: null, errors: ['RSVP was empty.'] }
  }

  const errors: string[] = []
  const eventId = getString(body, 'eventId')
  const response = getString(body, 'response')
  const guestCount = getInteger(body, 'guestCount')
  // Only read these when the caller actually sent them — see RsvpData.
  const sentNote = Object.prototype.hasOwnProperty.call(body, 'accommodationNote')
  const sentShare = Object.prototype.hasOwnProperty.call(body, 'shareAccommodationWithLeads')
  const accommodationNote = getString(body, 'accommodationNote')

  if (!eventId) errors.push('An event is required to RSVP.')
  if (!RSVP_RESPONSES.some((option) => option === response)) {
    errors.push('Choose going, interested, or can’t make it.')
  }
  if (guestCount < 0 || guestCount > RSVP_GUEST_LIMIT) {
    errors.push(`Guests must be between 0 and ${RSVP_GUEST_LIMIT}.`)
  }
  if (accommodationNote.length > RSVP_NOTE_LIMIT) {
    errors.push(`The accommodation note must be ${RSVP_NOTE_LIMIT} characters or fewer.`)
  }

  if (errors.length > 0) {
    return { success: false, data: null, errors }
  }

  return {
    success: true,
    data: {
      eventId,
      response: response as RsvpResponse,
      guestCount,
      ...(sentNote ? { accommodationNote } : {}),
      ...(sentShare ? { shareAccommodationWithLeads: body.shareAccommodationWithLeads === true } : {}),
    },
    errors: [],
  }
}

export const buildClubEvent = (data: ClubEventData, actorEmail: string): ClubEvent => {
  const now = new Date().toISOString()

  return {
    id: data.id || createId('event'),
    title: data.title,
    summary: data.summary,
    kind: data.kind,
    format: data.format,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    locationName: data.locationName,
    locationDetail: data.locationDetail,
    virtualUrl: data.virtualUrl,
    hostName: data.hostName,
    speakerName: data.speakerName,
    speakerOrg: data.speakerOrg,
    capacity: data.capacity,
    rsvpDeadline: data.rsvpDeadline,
    status: 'draft',
    accessCommitments: data.accessCommitments.map((commitment) => ({ ...commitment })),
    accommodationsContactEmail: data.accommodationsContactEmail,
    recordingUrl: data.recordingUrl,
    slidesUrl: data.slidesUrl,
    roomStatus: data.roomStatus,
    internalNotes: data.internalNotes,
    createdAt: now,
    updatedAt: now,
    createdBy: actorEmail.trim().toLowerCase(),
    publishedAt: '',
    publishedBy: '',
  }
}

/** Edits an existing event. `status` and the publish stamps are never writable here. */
export const mergeClubEvent = (existing: ClubEvent, data: ClubEventData, now: string): ClubEvent => ({
  ...buildClubEvent({ ...data, id: existing.id }, existing.createdBy),
  status: existing.status,
  createdAt: existing.createdAt,
  createdBy: existing.createdBy,
  publishedAt: existing.publishedAt,
  publishedBy: existing.publishedBy,
  updatedAt: now,
})

export const buildEventRsvp = (
  email: string,
  data: RsvpData,
  previous: EventRsvp | undefined,
  now: string,
): EventRsvp => {
  const key = email.trim().toLowerCase()

  return {
    id: rsvpKey(data.eventId, key),
    eventId: data.eventId,
    email: key,
    response: data.response,
    guestCount: data.guestCount,
    accommodationNote: data.accommodationNote ?? previous?.accommodationNote ?? '',
    shareAccommodationWithLeads:
      data.shareAccommodationWithLeads ?? previous?.shareAccommodationWithLeads ?? false,
    respondedAt: now,
    checkedInAt: previous?.checkedInAt || '',
    checkedInBy: previous?.checkedInBy || '',
  }
}

export const toEventRsvpSelfView = (rsvp: EventRsvp): EventRsvpSelfView => ({
  id: rsvp.id,
  eventId: rsvp.eventId,
  email: rsvp.email,
  response: rsvp.response,
  guestCount: rsvp.guestCount,
  accommodationNote: rsvp.accommodationNote,
  shareAccommodationWithLeads: rsvp.shareAccommodationWithLeads,
  respondedAt: rsvp.respondedAt,
  checkedInAt: rsvp.checkedInAt,
})

/**
 * Allowlist construction. `virtualUrl` is released only when the event is published and
 * the reader's own RSVP is 'going'; admin fields are absent because they are never copied.
 */
export const buildClubEventPublicView = (input: {
  event: ClubEvent
  rsvpCount: number
  yourRsvp: EventRsvp | null
}): ClubEventPublicView => {
  const event = input.event
  const releaseVirtualUrl = event.status === 'published' && input.yourRsvp?.response === 'going'

  return {
    id: event.id,
    title: event.title,
    summary: event.summary,
    kind: event.kind,
    format: event.format,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    locationName: event.locationName,
    locationDetail: event.locationDetail,
    hostName: event.hostName,
    speakerName: event.speakerName,
    speakerOrg: event.speakerOrg,
    capacity: event.capacity,
    rsvpDeadline: event.rsvpDeadline,
    accessCommitments: event.accessCommitments.map((commitment) => ({ ...commitment })),
    accommodationsContactEmail: event.accommodationsContactEmail,
    recordingUrl: event.recordingUrl,
    slidesUrl: event.slidesUrl,
    status: event.status,
    virtualUrl: releaseVirtualUrl ? event.virtualUrl : '',
    rsvpCount: input.rsvpCount,
    yourRsvp: input.yourRsvp ? toEventRsvpSelfView(input.yourRsvp) : null,
  }
}

/**
 * An event for this club cannot be published without stating what it can and cannot
 * provide access-wise. `not-available` must be stated, not omitted.
 */
export const canPublishEvent = (event: ClubEvent): { ok: boolean; blockers: string[] } => {
  const blockers: string[] = []

  if (!Array.isArray(event.accessCommitments) || event.accessCommitments.length === 0) {
    blockers.push('State what this event can and cannot provide access-wise before publishing it.')
  }
  if (!event.accommodationsContactEmail) {
    blockers.push('Add an accommodations contact email before publishing.')
  }
  if (!event.hostName) {
    blockers.push('Name the person running this event before publishing.')
  }
  if (!event.startsAt || !event.endsAt || Date.parse(event.endsAt) <= Date.parse(event.startsAt)) {
    blockers.push('The end time has to come after the start time.')
  }

  return { ok: blockers.length === 0, blockers }
}

export const isRsvpOpen = (event: ClubEvent, now: string): { ok: boolean; blockers: string[] } => {
  const blockers: string[] = []
  const nowMs = Number.isNaN(Date.parse(now)) ? Date.now() : Date.parse(now)

  if (event.status === 'cancelled') {
    blockers.push('That event was cancelled.')
  } else if (event.status !== 'published') {
    blockers.push('That event is not published yet.')
  }

  if (event.rsvpDeadline && !Number.isNaN(Date.parse(event.rsvpDeadline)) && Date.parse(event.rsvpDeadline) < nowMs) {
    blockers.push('The RSVP deadline for that event has passed.')
  }

  return { ok: blockers.length === 0, blockers }
}
