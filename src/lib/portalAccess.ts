export type AccessCategory = 'physical-space' | 'communication' | 'sensory' | 'materials' | 'food' | 'timing'
export type AccessPriority = 'required' | 'helpful'
export type AccessScope = 'private' | 'shared-with-leads'
export type AccessFollowUpPreference = 'email' | 'before-event' | 'do-not-contact'
export type AccessAppliesTo = 'all-events' | 'rsvp-only'

export const ACCESS_CATEGORIES: { id: AccessCategory; label: string }[] = [
  { id: 'physical-space', label: 'Getting into and around the room' },
  { id: 'communication', label: 'Communication' },
  { id: 'sensory', label: 'Sensory' },
  { id: 'materials', label: 'Materials' },
  { id: 'food', label: 'Food' },
  { id: 'timing', label: 'Timing and pacing' },
]

/**
 * The curated catalog. There is no diagnosis field, no disability-type field, and no
 * "do you have a disability?" question anywhere in this product. The portal asks what
 * someone needs in a room, never what is true about their body.
 */
export const ACCESS_NEED_CATALOG: { id: string; category: AccessCategory; label: string }[] = [
  // physical-space
  { id: 'step-free-entry', category: 'physical-space', label: 'Step-free entry' },
  { id: 'step-free-route-inside', category: 'physical-space', label: 'Step-free route inside the building' },
  { id: 'wheelchair-space-at-table', category: 'physical-space', label: 'Wheelchair space at the table' },
  { id: 'seat-near-exit', category: 'physical-space', label: 'Seat reserved near an exit' },
  { id: 'seat-near-front', category: 'physical-space', label: 'Seat reserved near the front' },
  { id: 'accessible-restroom', category: 'physical-space', label: 'Accessible restroom on the same floor' },
  { id: 'service-animal', category: 'physical-space', label: 'Service animal attending' },
  // communication
  { id: 'asl-interpreter', category: 'communication', label: 'ASL interpreter' },
  { id: 'live-captioning', category: 'communication', label: 'Live captioning' },
  { id: 'captions-on-video', category: 'communication', label: 'Captions on all video' },
  { id: 'mic-always-used', category: 'communication', label: 'Microphone always used' },
  { id: 'speaker-faces-audience', category: 'communication', label: 'Speaker faces the audience' },
  { id: 'agenda-in-advance', category: 'communication', label: 'Written agenda in advance' },
  { id: 'no-cold-calling', category: 'communication', label: 'No cold-calling' },
  // sensory
  { id: 'quiet-space', category: 'sensory', label: 'Quiet space available' },
  { id: 'no-strobe-or-flashing', category: 'sensory', label: 'No strobe or flashing content' },
  { id: 'lighting-adjustable', category: 'sensory', label: 'Adjustable lighting' },
  { id: 'scent-free', category: 'sensory', label: 'Scent-free request' },
  { id: 'volume-limits', category: 'sensory', label: 'Volume kept low' },
  // materials
  { id: 'slides-in-advance', category: 'materials', label: 'Slides shared in advance' },
  { id: 'screen-reader-files', category: 'materials', label: 'Screen-reader compatible files' },
  { id: 'large-print', category: 'materials', label: 'Large print' },
  { id: 'plain-language-summary', category: 'materials', label: 'Plain-language summary' },
  // food
  { id: 'ingredients-labeled', category: 'food', label: 'Ingredients labeled' },
  { id: 'allergy-nut', category: 'food', label: 'Nut allergy' },
  { id: 'allergy-gluten', category: 'food', label: 'Gluten' },
  { id: 'allergy-dairy', category: 'food', label: 'Dairy' },
  { id: 'allergy-shellfish', category: 'food', label: 'Shellfish' },
  { id: 'allergy-other', category: 'food', label: 'Other allergy (describe below)' },
  { id: 'texture-or-swallow', category: 'food', label: 'Texture or swallowing needs' },
  { id: 'halal', category: 'food', label: 'Halal' },
  { id: 'kosher', category: 'food', label: 'Kosher' },
  { id: 'vegan', category: 'food', label: 'Vegan' },
  { id: 'seated-not-buffet', category: 'food', label: 'Seated service rather than buffet' },
  // timing
  { id: 'breaks-every-30', category: 'timing', label: 'Breaks every 30 minutes' },
  { id: 'under-60-min', category: 'timing', label: 'Prefer events under 60 minutes' },
  { id: 'late-or-early-exit', category: 'timing', label: 'Late arrival or early exit without explaining' },
  { id: 'recording-if-absent', category: 'timing', label: 'Recording if I cannot attend' },
]

export type AccessNeed = { id: string; priority: AccessPriority; detail: string }

export type AccessProfile = {
  needs: AccessNeed[]
  generalNote: string
  followUpPreference: AccessFollowUpPreference
  scope: AccessScope
  appliesTo: AccessAppliesTo
  consentAt: string
  consentText: string
  expiresAt: string
  withdrawnAt: string
  hasOpened: boolean
  updatedAt: string
}

export const ACCESS_NEEDS_LIMIT = 50
export const ACCESS_DETAIL_LIMIT = 240
export const ACCESS_GENERAL_NOTE_LIMIT = 600
export const ACCESS_CONSENT_TEXT_LIMIT = 600

export const ACCESS_PRIORITIES: AccessPriority[] = ['required', 'helpful']
export const ACCESS_SCOPES: AccessScope[] = ['private', 'shared-with-leads']
export const ACCESS_FOLLOW_UP_PREFERENCES: AccessFollowUpPreference[] = ['email', 'before-event', 'do-not-contact']
export const ACCESS_APPLIES_TO: AccessAppliesTo[] = ['all-events', 'rsvp-only']

const accessNeedIds = new Set(ACCESS_NEED_CATALOG.map((need) => need.id))

export const accessNeedLabel = (id: string) => (
  ACCESS_NEED_CATALOG.find((need) => need.id === id)?.label || id
)

export const emptyAccessProfile = (): AccessProfile => ({
  needs: [],
  generalNote: '',
  followUpPreference: 'email',
  scope: 'private',
  appliesTo: 'rsvp-only',
  consentAt: '',
  consentText: '',
  expiresAt: '',
  withdrawnAt: '',
  hasOpened: false,
  updatedAt: '',
})

export const ACCESS_CONSENT_TEXT =
  'Our events are small. Even without your name attached, a lead planning the room may be ' +
  'able to work out that a request is yours. Share only what you are comfortable with them knowing.'

/** The exact, named roster the member is consenting to. Rendered on the consent screen. */
export const ACCESS_LEAD_EMAILS = [
  'sbodine@umich.edu', // Co-President
  'atchiang@umich.edu', // Co-President
  'ylindsey@umich.edu', // VP Operations
  'andsack@umich.edu', // Events & Programming
] as const

export const isAccessLead = (email: string) => (
  ACCESS_LEAD_EMAILS.some((lead) => lead === email.trim().toLowerCase())
)

export type ConsentedAccessView = {
  preferredName: string
  needs: AccessNeed[]
  generalNote: string
  followUpPreference: AccessFollowUpPreference
}

/**
 * Consent runs to the end of the current term and is then evaluated lazily on read —
 * no migration, no version bumping. Jan–Apr expires Apr 30; May–Dec expires Dec 31,
 * so a summer signup carries into the fall term rather than lapsing before Festifall.
 */
export const accessConsentExpiresAt = (now: string) => {
  const parsed = new Date(now)
  const stamp = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  const year = stamp.getUTCFullYear()
  return stamp.getUTCMonth() <= 3
    ? new Date(Date.UTC(year, 3, 30, 23, 59, 59)).toISOString()
    : new Date(Date.UTC(year, 11, 31, 23, 59, 59)).toISOString()
}

/**
 * THE ONLY read path for access data. Returns null unless every condition holds.
 * A super-admin role grants nothing here: access data is readable only by the leads
 * the member named, so there is no role short-circuit anywhere in this function.
 */
export const consentedAccessView = (input: {
  profile: AccessProfile
  preferredName: string
  readerEmail: string
  now: string
  hasGoingRsvpForEvent?: boolean
}): ConsentedAccessView | null => {
  const profile = input.profile
  if (!profile || typeof profile !== 'object') return null
  if (profile.scope !== 'shared-with-leads') return null
  if (profile.withdrawnAt) return null

  const expiresAt = Date.parse(profile.expiresAt || '')
  const now = Date.parse(input.now || '')
  const nowMs = Number.isNaN(now) ? Date.now() : now
  if (Number.isNaN(expiresAt) || expiresAt <= nowMs) return null

  if (!isAccessLead(input.readerEmail || '')) return null
  if (profile.appliesTo !== 'all-events' && input.hasGoingRsvpForEvent !== true) return null

  return {
    preferredName: input.preferredName,
    needs: (Array.isArray(profile.needs) ? profile.needs : []).map((need) => ({
      id: need.id,
      priority: need.priority,
      detail: need.detail,
    })),
    generalNote: profile.generalNote || '',
    followUpPreference: profile.followUpPreference,
  }
}

export type AccessProfileInput = {
  needs: AccessNeed[]
  generalNote: string
  followUpPreference: AccessFollowUpPreference
  scope: AccessScope
  appliesTo: AccessAppliesTo
  consentText: string
}

export type AccessProfileValidation =
  | { success: true; data: AccessProfileInput; errors: [] }
  | { success: false; data: null; errors: string[] }

const getString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key]
  return typeof value === 'string' ? value.replace(/[<>]/g, '').trim() : ''
}

export const validateAccessProfilePayload = (payload: unknown): AccessProfileValidation => {
  if (!payload || typeof payload !== 'object') {
    return { success: false, data: null, errors: ['Access profile was empty.'] }
  }

  const body = payload as Record<string, unknown>
  if (Object.keys(body).length === 0) {
    return { success: false, data: null, errors: ['Access profile was empty.'] }
  }

  const errors: string[] = []
  const rawNeeds = Array.isArray(body.needs) ? body.needs : []

  if (body.needs !== undefined && !Array.isArray(body.needs)) {
    errors.push('Access needs must be a list.')
  }
  if (rawNeeds.length > ACCESS_NEEDS_LIMIT) {
    errors.push(`Access needs must be ${ACCESS_NEEDS_LIMIT} items or fewer.`)
  }

  const seen = new Set<string>()
  const needs: AccessNeed[] = []

  rawNeeds.slice(0, ACCESS_NEEDS_LIMIT).forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      errors.push('Each access need must include an option from the list.')
      return
    }

    const row = entry as Record<string, unknown>
    const id = getString(row, 'id')
    const priority = getString(row, 'priority') || 'required'
    const detail = getString(row, 'detail')

    if (!accessNeedIds.has(id)) {
      errors.push('Access needs include an option that is not on the list.')
      return
    }
    if (seen.has(id)) return
    if (!ACCESS_PRIORITIES.some((value) => value === priority)) {
      errors.push('Each access need must be marked required or helpful.')
      return
    }
    if (detail.length > ACCESS_DETAIL_LIMIT) {
      errors.push(`Access details must be ${ACCESS_DETAIL_LIMIT} characters or fewer.`)
      return
    }

    seen.add(id)
    needs.push({ id, priority: priority as AccessPriority, detail })
  })

  const generalNote = getString(body, 'generalNote')
  const consentText = getString(body, 'consentText')
  const followUpPreference = getString(body, 'followUpPreference') || 'email'
  const scope = getString(body, 'scope') || 'private'
  const appliesTo = getString(body, 'appliesTo') || 'rsvp-only'

  if (generalNote.length > ACCESS_GENERAL_NOTE_LIMIT) {
    errors.push(`The general note must be ${ACCESS_GENERAL_NOTE_LIMIT} characters or fewer.`)
  }
  if (consentText.length > ACCESS_CONSENT_TEXT_LIMIT) {
    errors.push(`The consent text must be ${ACCESS_CONSENT_TEXT_LIMIT} characters or fewer.`)
  }
  if (!ACCESS_FOLLOW_UP_PREFERENCES.some((value) => value === followUpPreference)) {
    errors.push('Choose how you would like to be followed up with.')
  }
  if (!ACCESS_SCOPES.some((value) => value === scope)) {
    errors.push('Choose who can see this: private, or shared with the named leads.')
  }
  if (!ACCESS_APPLIES_TO.some((value) => value === appliesTo)) {
    errors.push('Choose whether this applies to all events or only events you RSVP to.')
  }
  if (scope === 'shared-with-leads' && !consentText) {
    errors.push('Sharing with leads requires the consent wording shown on the page.')
  }

  if (errors.length > 0) {
    return { success: false, data: null, errors }
  }

  return {
    success: true,
    data: {
      needs,
      generalNote,
      followUpPreference: followUpPreference as AccessFollowUpPreference,
      scope: scope as AccessScope,
      appliesTo: appliesTo as AccessAppliesTo,
      consentText,
    },
    errors: [],
  }
}

export const normalizeAccessProfile = (value: unknown): AccessProfile => {
  const base = emptyAccessProfile()
  if (!value || typeof value !== 'object') return base

  const row = value as Record<string, unknown>
  const rawNeeds = Array.isArray(row.needs) ? row.needs : []
  const needs: AccessNeed[] = rawNeeds
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry): AccessNeed => ({
      id: typeof entry.id === 'string' ? entry.id : '',
      priority: entry.priority === 'helpful' ? 'helpful' : 'required',
      detail: typeof entry.detail === 'string' ? entry.detail : '',
    }))
    .filter((need) => accessNeedIds.has(need.id))
    .slice(0, ACCESS_NEEDS_LIMIT)

  return {
    needs,
    generalNote: typeof row.generalNote === 'string' ? row.generalNote : base.generalNote,
    followUpPreference: ACCESS_FOLLOW_UP_PREFERENCES.some((option) => option === row.followUpPreference)
      ? row.followUpPreference as AccessFollowUpPreference
      : base.followUpPreference,
    scope: row.scope === 'shared-with-leads' ? 'shared-with-leads' : 'private',
    appliesTo: row.appliesTo === 'all-events' ? 'all-events' : 'rsvp-only',
    consentAt: typeof row.consentAt === 'string' ? row.consentAt : base.consentAt,
    consentText: typeof row.consentText === 'string' ? row.consentText : base.consentText,
    expiresAt: typeof row.expiresAt === 'string' ? row.expiresAt : base.expiresAt,
    withdrawnAt: typeof row.withdrawnAt === 'string' ? row.withdrawnAt : base.withdrawnAt,
    hasOpened: row.hasOpened === true,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : base.updatedAt,
  }
}

/** Owner-write only. Stamps consent, refreshes lazy expiry, clears any prior withdrawal. */
export const buildAccessProfile = (
  input: AccessProfileInput,
  previous: AccessProfile,
  now: string,
): AccessProfile => ({
  needs: input.needs.map((need) => ({ ...need })),
  generalNote: input.generalNote,
  followUpPreference: input.followUpPreference,
  scope: input.scope,
  appliesTo: input.appliesTo,
  consentAt: now,
  consentText: input.consentText || previous.consentText,
  expiresAt: accessConsentExpiresAt(now),
  withdrawnAt: '',
  hasOpened: true,
  updatedAt: now,
})

/** One button, no confirmation modal, retroactive by construction. */
export const withdrawAccessProfile = (previous: AccessProfile, now: string): AccessProfile => ({
  ...previous,
  scope: 'private',
  withdrawnAt: now,
  hasOpened: true,
  updatedAt: now,
})
