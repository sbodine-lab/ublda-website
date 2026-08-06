import type { AccessProfile, ConsentedAccessView } from './portalAccess.ts'
import { emptyAccessProfile, normalizeAccessProfile } from './portalAccess.ts'

export type MemberStatus = 'prospect' | 'active' | 'inactive' | 'alumni'
export type MemberSource = 'self-signup' | 'festifall' | 'interest-form' | 'referral' | 'recruiting' | 'manual'
export type MemberYear = '' | 'Freshman' | 'Sophomore' | 'Junior' | 'Senior' | 'Grad'
export type MemberSchool = '' | 'Ross' | 'LSA' | 'CoE' | 'SI' | 'Kinesiology' | 'Nursing' | 'Other'
export type MemberInterest = 'consulting' | 'speakers' | 'finance' | 'mentorship' | 'operations' | 'marketing'

export const MEMBER_STATUSES: MemberStatus[] = ['prospect', 'active', 'inactive', 'alumni']
export const MEMBER_SOURCES: MemberSource[] = ['self-signup', 'festifall', 'interest-form', 'referral', 'recruiting', 'manual']
export const MEMBER_YEARS: MemberYear[] = ['', 'Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad']
export const MEMBER_SCHOOLS: MemberSchool[] = ['', 'Ross', 'LSA', 'CoE', 'SI', 'Kinesiology', 'Nursing', 'Other']
export const MEMBER_INTERESTS: MemberInterest[] = ['consulting', 'speakers', 'finance', 'mentorship', 'operations', 'marketing']

export const MEMBER_NAME_LIMIT = 80
export const MEMBER_MAJOR_LIMIT = 120
export const MEMBER_PRONOUNS_LIMIT = 40
export const MEMBER_LINKEDIN_LIMIT = 300
export const MEMBER_PHONE_LIMIT = 40
export const MEMBER_DIETARY_LIMIT = 300
export const MEMBER_NOTES_LIMIT = 1000
export const MEMBER_INTERESTS_LIMIT = 6
export const BULK_ADMIT_LIMIT = 100

/** The full record as stored. NEVER serialized wholesale to any client. */
export type MemberProfileRecord = {
  email: string
  firstName: string
  lastName: string
  preferredName: string
  pronouns: string
  uniqname: string
  status: MemberStatus
  source: MemberSource
  year: MemberYear
  school: MemberSchool
  major: string
  gradYear: string
  interests: MemberInterest[]
  linkedinUrl: string
  phone: string
  dietary: string
  notes: string
  joinedAt: string
  createdAt: string
  updatedAt: string
  updatedBy: string
  access: AccessProfile
}

/** Fields a member may write about themselves. Enforced server-side by allowlist. */
export const MEMBER_EDITABLE_FIELDS = [
  'preferredName', 'pronouns', 'year', 'school', 'major', 'gradYear',
  'interests', 'linkedinUrl', 'phone', 'dietary',
] as const

/** Fields an admin may write about a member. `access` appears in NEITHER list. */
export const ADMIN_EDITABLE_FIELDS = [
  'firstName', 'lastName', 'status', 'source', 'year', 'school', 'joinedAt', 'notes',
] as const

/** What the owning member receives about themselves. */
export type MemberSelfProfile = Omit<MemberProfileRecord, 'notes' | 'updatedBy'>

/** What an admin receives about a member. `access` is absent unless consent resolves. */
export type MemberAdminRow = Omit<MemberProfileRecord, 'access'> & {
  attendanceCount: number
  rsvpCount: number
  lastAttendedAt: string
  access?: ConsentedAccessView
}

export type MemberProfileValidation =
  | { success: true; data: Partial<MemberProfileRecord>; errors: [] }
  | { success: false; data: null; errors: string[] }

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const gradYearPattern = /^(19|20)\d{2}$/

const getString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key]
  return typeof value === 'string' ? value.replace(/[<>]/g, '').trim() : ''
}

const normalizeEmail = (value: unknown) => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
)

const isIsoDate = (value: string) => !Number.isNaN(Date.parse(value))

const validateInterests = (value: unknown, errors: string[]): MemberInterest[] | undefined => {
  if (!Array.isArray(value)) {
    errors.push('Interests must be a list.')
    return undefined
  }

  if (value.length > MEMBER_INTERESTS_LIMIT) {
    errors.push(`Choose ${MEMBER_INTERESTS_LIMIT} interests or fewer.`)
    return undefined
  }

  const seen = new Set<string>()
  const interests: MemberInterest[] = []

  value.forEach((entry) => {
    const candidate = typeof entry === 'string' ? entry.trim() : ''
    if (!MEMBER_INTERESTS.some((option) => option === candidate)) {
      errors.push('Interests include an option that is not on the list.')
      return
    }
    if (seen.has(candidate)) return
    seen.add(candidate)
    interests.push(candidate as MemberInterest)
  })

  return errors.length > 0 ? undefined : interests
}

/** Member self-edit. Keys outside MEMBER_EDITABLE_FIELDS are ignored, never written. */
export const validateMemberSelfPayload = (payload: unknown): MemberProfileValidation => {
  if (!payload || typeof payload !== 'object') {
    return { success: false, data: null, errors: ['Profile update was empty.'] }
  }

  const body = payload as Record<string, unknown>
  if (Object.keys(body).length === 0) {
    return { success: false, data: null, errors: ['Profile update was empty.'] }
  }

  const errors: string[] = []
  const data: Partial<MemberProfileRecord> = {}

  if (body.preferredName !== undefined) {
    const preferredName = getString(body, 'preferredName')
    if (preferredName.length > MEMBER_NAME_LIMIT) {
      errors.push(`Preferred name must be ${MEMBER_NAME_LIMIT} characters or fewer.`)
    } else {
      data.preferredName = preferredName
    }
  }

  if (body.pronouns !== undefined) {
    const pronouns = getString(body, 'pronouns')
    if (pronouns.length > MEMBER_PRONOUNS_LIMIT) {
      errors.push(`Pronouns must be ${MEMBER_PRONOUNS_LIMIT} characters or fewer.`)
    } else {
      data.pronouns = pronouns
    }
  }

  if (body.year !== undefined) {
    const year = getString(body, 'year')
    if (!MEMBER_YEARS.some((option) => option === year)) {
      errors.push('Choose a year from the list.')
    } else {
      data.year = year as MemberYear
    }
  }

  if (body.school !== undefined) {
    const school = getString(body, 'school')
    if (!MEMBER_SCHOOLS.some((option) => option === school)) {
      errors.push('Choose a school from the list.')
    } else {
      data.school = school as MemberSchool
    }
  }

  if (body.major !== undefined) {
    const major = getString(body, 'major')
    if (major.length > MEMBER_MAJOR_LIMIT) {
      errors.push(`Major must be ${MEMBER_MAJOR_LIMIT} characters or fewer.`)
    } else {
      data.major = major
    }
  }

  if (body.gradYear !== undefined) {
    const gradYear = getString(body, 'gradYear')
    if (gradYear && !gradYearPattern.test(gradYear)) {
      errors.push('Graduation year must be a four-digit year.')
    } else {
      data.gradYear = gradYear
    }
  }

  if (body.interests !== undefined) {
    const interests = validateInterests(body.interests, errors)
    if (interests) data.interests = interests
  }

  if (body.linkedinUrl !== undefined) {
    const linkedinUrl = getString(body, 'linkedinUrl')
    if (linkedinUrl.length > MEMBER_LINKEDIN_LIMIT) {
      errors.push(`LinkedIn URL must be ${MEMBER_LINKEDIN_LIMIT} characters or fewer.`)
    } else if (linkedinUrl && !linkedinUrl.startsWith('https://')) {
      errors.push('LinkedIn URL must start with https://.')
    } else {
      data.linkedinUrl = linkedinUrl
    }
  }

  if (body.phone !== undefined) {
    const phone = getString(body, 'phone')
    if (phone.length > MEMBER_PHONE_LIMIT) {
      errors.push(`Phone must be ${MEMBER_PHONE_LIMIT} characters or fewer.`)
    } else {
      data.phone = phone
    }
  }

  if (body.dietary !== undefined) {
    const dietary = getString(body, 'dietary')
    if (dietary.length > MEMBER_DIETARY_LIMIT) {
      errors.push(`Dietary preferences must be ${MEMBER_DIETARY_LIMIT} characters or fewer.`)
    } else {
      data.dietary = dietary
    }
  }

  return errors.length > 0
    ? { success: false, data: null, errors }
    : { success: true, data, errors: [] }
}

/** Admin edit of another member. `access` is not writable from this path, ever. */
export const validateMemberAdminPayload = (payload: unknown): MemberProfileValidation => {
  if (!payload || typeof payload !== 'object') {
    return { success: false, data: null, errors: ['Member update was empty.'] }
  }

  const body = payload as Record<string, unknown>
  if (Object.keys(body).length === 0) {
    return { success: false, data: null, errors: ['Member update was empty.'] }
  }

  const errors: string[] = []
  const data: Partial<MemberProfileRecord> = {}
  const email = normalizeEmail(body.email)

  if (!email || !emailPattern.test(email)) {
    errors.push('A valid member email is required.')
  } else {
    data.email = email
  }

  if (body.firstName !== undefined) {
    const firstName = getString(body, 'firstName')
    if (!firstName) {
      errors.push('First name is required.')
    } else if (firstName.length > MEMBER_NAME_LIMIT) {
      errors.push(`First name must be ${MEMBER_NAME_LIMIT} characters or fewer.`)
    } else {
      data.firstName = firstName
    }
  }

  if (body.lastName !== undefined) {
    const lastName = getString(body, 'lastName')
    if (!lastName) {
      errors.push('Last name is required.')
    } else if (lastName.length > MEMBER_NAME_LIMIT) {
      errors.push(`Last name must be ${MEMBER_NAME_LIMIT} characters or fewer.`)
    } else {
      data.lastName = lastName
    }
  }

  if (body.status !== undefined) {
    const status = getString(body, 'status')
    if (!MEMBER_STATUSES.some((option) => option === status)) {
      errors.push('Choose a member status from the list.')
    } else {
      data.status = status as MemberStatus
    }
  }

  if (body.source !== undefined) {
    const source = getString(body, 'source')
    if (!MEMBER_SOURCES.some((option) => option === source)) {
      errors.push('Choose a member source from the list.')
    } else {
      data.source = source as MemberSource
    }
  }

  if (body.year !== undefined) {
    const year = getString(body, 'year')
    if (!MEMBER_YEARS.some((option) => option === year)) {
      errors.push('Choose a year from the list.')
    } else {
      data.year = year as MemberYear
    }
  }

  if (body.school !== undefined) {
    const school = getString(body, 'school')
    if (!MEMBER_SCHOOLS.some((option) => option === school)) {
      errors.push('Choose a school from the list.')
    } else {
      data.school = school as MemberSchool
    }
  }

  if (body.joinedAt !== undefined) {
    const joinedAt = getString(body, 'joinedAt')
    if (joinedAt && !isIsoDate(joinedAt)) {
      errors.push('Joined date must be a real date.')
    } else {
      data.joinedAt = joinedAt
    }
  }

  if (body.notes !== undefined) {
    const notes = getString(body, 'notes')
    if (notes.length > MEMBER_NOTES_LIMIT) {
      errors.push(`Admin notes must be ${MEMBER_NOTES_LIMIT} characters or fewer.`)
    } else {
      data.notes = notes
    }
  }

  return errors.length > 0
    ? { success: false, data: null, errors }
    : { success: true, data, errors: [] }
}

export const buildMemberProfileRecord = (
  email: string,
  seed: Partial<MemberProfileRecord>,
  actorEmail: string,
): MemberProfileRecord => {
  const now = new Date().toISOString()
  const key = email.trim().toLowerCase()

  return {
    email: key,
    firstName: seed.firstName || '',
    lastName: seed.lastName || '',
    preferredName: seed.preferredName || '',
    pronouns: seed.pronouns || '',
    uniqname: seed.uniqname || key.replace(/@.*$/, ''),
    status: seed.status || 'prospect',
    source: seed.source || 'manual',
    year: seed.year || '',
    school: seed.school || '',
    major: seed.major || '',
    gradYear: seed.gradYear || '',
    interests: seed.interests ? [...seed.interests] : [],
    linkedinUrl: seed.linkedinUrl || '',
    phone: seed.phone || '',
    dietary: seed.dietary || '',
    notes: seed.notes || '',
    joinedAt: seed.joinedAt || now,
    createdAt: seed.createdAt || now,
    updatedAt: now,
    updatedBy: actorEmail.trim().toLowerCase(),
    access: seed.access ? normalizeAccessProfile(seed.access) : emptyAccessProfile(),
  }
}

/**
 * Applies an already-validated patch. `email`, `createdAt` and `access` are structurally
 * excluded here, so no caller — member or admin — can write access data down this path.
 */
export const applyMemberProfilePatch = (
  base: MemberProfileRecord,
  patch: Partial<MemberProfileRecord>,
  actorEmail: string,
  now: string,
): MemberProfileRecord => ({
  email: base.email,
  firstName: patch.firstName ?? base.firstName,
  lastName: patch.lastName ?? base.lastName,
  preferredName: patch.preferredName ?? base.preferredName,
  pronouns: patch.pronouns ?? base.pronouns,
  uniqname: patch.uniqname ?? base.uniqname,
  status: patch.status ?? base.status,
  source: patch.source ?? base.source,
  year: patch.year ?? base.year,
  school: patch.school ?? base.school,
  major: patch.major ?? base.major,
  gradYear: patch.gradYear ?? base.gradYear,
  interests: patch.interests ? [...patch.interests] : base.interests,
  linkedinUrl: patch.linkedinUrl ?? base.linkedinUrl,
  phone: patch.phone ?? base.phone,
  dietary: patch.dietary ?? base.dietary,
  notes: patch.notes ?? base.notes,
  joinedAt: patch.joinedAt ?? base.joinedAt,
  createdAt: base.createdAt,
  updatedAt: now,
  updatedBy: actorEmail.trim().toLowerCase(),
  access: base.access,
})

export const normalizeMemberProfileRecord = (value: unknown, fallbackEmail = ''): MemberProfileRecord => {
  const row = (value && typeof value === 'object' ? value : {}) as Partial<MemberProfileRecord>
  const email = (typeof row.email === 'string' && row.email ? row.email : fallbackEmail).trim().toLowerCase()
  const record = buildMemberProfileRecord(email, row, row.updatedBy || '')

  return {
    ...record,
    status: MEMBER_STATUSES.some((option) => option === row.status) ? row.status as MemberStatus : record.status,
    source: MEMBER_SOURCES.some((option) => option === row.source) ? row.source as MemberSource : record.source,
    year: MEMBER_YEARS.some((option) => option === row.year) ? row.year as MemberYear : '',
    school: MEMBER_SCHOOLS.some((option) => option === row.school) ? row.school as MemberSchool : '',
    interests: Array.isArray(row.interests)
      ? row.interests.filter((interest): interest is MemberInterest => MEMBER_INTERESTS.some((option) => option === interest))
      : [],
    createdAt: row.createdAt || record.createdAt,
    updatedAt: row.updatedAt || record.updatedAt,
    access: normalizeAccessProfile(row.access),
  }
}

export const memberDisplayName = (record: Pick<MemberProfileRecord, 'preferredName' | 'firstName' | 'lastName' | 'email'>) => {
  const first = record.preferredName || record.firstName
  const full = `${first} ${record.lastName}`.trim()
  return full || record.email
}

/** Attendance is DERIVED at read time, never denormalized — a counter drifts under a retried mutator. */
export const memberParticipation = (
  email: string,
  rsvps: { email: string; checkedInAt: string }[],
) => {
  const key = email.trim().toLowerCase()
  const mine = rsvps.filter((rsvp) => rsvp.email === key)
  const attended = mine
    .filter((rsvp) => Boolean(rsvp.checkedInAt))
    .map((rsvp) => rsvp.checkedInAt)
    .sort()

  return {
    attendanceCount: attended.length,
    rsvpCount: mine.length,
    lastAttendedAt: attended.length > 0 ? attended[attended.length - 1] : '',
  }
}

/** Allowlist construction, never redaction — `notes` and `updatedBy` are admin-only. */
export const toMemberSelfProfile = (record: MemberProfileRecord): MemberSelfProfile => ({
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
  phone: record.phone,
  dietary: record.dietary,
  joinedAt: record.joinedAt,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  access: record.access,
})
