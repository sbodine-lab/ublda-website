import {
  BOARD_POSITION_OPTIONS,
  INTERVIEW_SLOTS,
  availabilitySummary,
  getSlotsFromValues,
  normalizeStringArray,
  validateRolePreferences,
} from './interviews.ts'
import type { InterviewSlot } from './interviews.ts'

export const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate student'] as const

export const ROSS_STATUS_OPTIONS = [
  {
    value: 'ross-bba',
    label: 'Yes, I am currently enrolled at Ross/BBA',
  },
  {
    value: 'business-minor',
    label: 'Business minor / Ross-affiliated',
  },
  {
    value: 'non-ross',
    label: 'No, I am not currently a Ross student',
  },
  {
    value: 'unsure',
    label: 'Unsure / I want to confirm',
  },
] as const

export const ROLE_OPTIONS = BOARD_POSITION_OPTIONS
export { INTERVIEW_SLOTS }

export const COMMITMENT_OPTIONS = [
  '2-3 hours/week',
  '3-5 hours/week',
  '5+ hours/week',
  'Unsure, but interested',
] as const

export const INTEREST_TYPE_OPTIONS = [
  {
    value: 'leadership-interview',
    label: 'Current e-board interview',
  },
  {
    value: 'future-role',
    label: 'Future project or committee role',
  },
  {
    value: 'either',
    label: 'Either',
  },
] as const

export const NOTES_WORD_LIMIT = 75
export const MAX_RESUME_FILE_SIZE_BYTES = 2 * 1024 * 1024
export const RESUME_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const
export const RESUME_FILE_EXTENSIONS = ['.pdf', '.doc', '.docx'] as const

const UMICH_EMAIL_DOMAIN = '@umich.edu'
const uniqnamePattern = /^[a-z0-9._-]{2,32}$/

export type RossStatus = (typeof ROSS_STATUS_OPTIONS)[number]['value']
export type InterestType = (typeof INTEREST_TYPE_OPTIONS)[number]['value']
export type ApplicationStatus = 'Interview eligible' | 'Needs review' | 'Future role pool'
export type { InterviewSlot }

export type ResumeFilePayload = {
  name: string
  mimeType: string
  size: number
  contentBase64: string
}

export type ApplicationData = {
  firstName: string
  lastName: string
  uniqname: string
  email: string
  year: string
  expectedGraduation: string
  college: string
  rossStatus: RossStatus
  interestType: InterestType
  preferredRole: string
  rolePreferences: string[]
  availability: InterviewSlot[]
  availabilitySummary: string
  interviewSlot: InterviewSlot
  resumeFile: ResumeFilePayload
  weeklyCommitment: string
  notes: string
  status: ApplicationStatus
}

export type ApplicationSubmission = ApplicationData & {
  formType: 'leadershipInterest'
  dedupeKey: string
  submittedAt: string
  submissionId: string
  userAgent: string
}

type ValidationResult =
  | { success: true; data: ApplicationData; errors: [] }
  | { success: false; data: null; errors: string[] }

const rossStatusValues = new Set<string>(ROSS_STATUS_OPTIONS.map((option) => option.value))
const interestTypeValues = new Set<string>(INTEREST_TYPE_OPTIONS.map((option) => option.value))
const commitmentValues = new Set<string>(COMMITMENT_OPTIONS)
const resumeMimeTypeValues = new Set<string>(RESUME_MIME_TYPES)
const resumeFileExtensionValues = new Set<string>(RESUME_FILE_EXTENSIONS)

const getString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key]
  return typeof value === 'string' ? value.trim() : ''
}

export const countWords = (value: string) => value.trim().split(/\s+/).filter(Boolean).length

export const clampToWordLimit = (value: string, limit: number) => {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (words.length <= limit) {
    return value
  }

  return words.slice(0, limit).join(' ')
}

export const normalizeUniqname = (value: unknown) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().toLowerCase().replace(/@.*$/, '')
}

const statusForRossStatus = (rossStatus: RossStatus): ApplicationStatus => {
  if (rossStatus === 'ross-bba') {
    return 'Interview eligible'
  }

  if (rossStatus === 'non-ross') {
    return 'Future role pool'
  }

  return 'Needs review'
}

const createSubmissionId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `app_${crypto.randomUUID()}`
  }

  return `app_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

const getResumeFile = (payload: Record<string, unknown>): ResumeFilePayload | null => {
  const value = payload.resumeFile
  if (!value || typeof value !== 'object') {
    return null
  }

  const file = value as Record<string, unknown>
  const name = typeof file.name === 'string' ? file.name.trim() : ''
  const mimeType = typeof file.mimeType === 'string' ? file.mimeType.trim() : ''
  const size = typeof file.size === 'number' ? file.size : Number(file.size || 0)
  const contentBase64 = typeof file.contentBase64 === 'string' ? file.contentBase64.trim() : ''

  return { name, mimeType, size, contentBase64 }
}

export const isResumeFileAllowed = (name: string, mimeType: string) => {
  const lowerName = name.toLowerCase()
  const hasAllowedExtension = Array.from(resumeFileExtensionValues).some((extension) => lowerName.endsWith(extension))
  return resumeMimeTypeValues.has(mimeType) || hasAllowedExtension
}

export const validateApplicationPayload = (payload: unknown): ValidationResult => {
  if (!payload || typeof payload !== 'object') {
    return { success: false, data: null, errors: ['Submission was empty.'] }
  }

  const body = payload as Record<string, unknown>
  const errors: string[] = []
  const uniqname = normalizeUniqname(getString(body, 'uniqname') || getString(body, 'email'))
  const email = `${uniqname}${UMICH_EMAIL_DOMAIN}`
  const firstName = getString(body, 'firstName')
  const lastName = getString(body, 'lastName')
  const year = getString(body, 'year')
  const expectedGraduation = getString(body, 'expectedGraduation')
  const college = getString(body, 'college')
  const rossStatus = getString(body, 'rossStatus') as RossStatus
  const interestType = (getString(body, 'interestType') || 'leadership-interview') as InterestType
  const rolePreferences = validateRolePreferences(body.rolePreferences || body.preferredRoles || body.preferredRole)
  const preferredRole = rolePreferences[0] || getString(body, 'preferredRole')
  const availabilityValues = normalizeStringArray(body.availability || body.interviewAvailability || body.interviewSlots || body.interviewSlot)
  const availability = getSlotsFromValues(availabilityValues)
  const interviewSlot = availability[0]
  const resumeFile = getResumeFile(body)
  const weeklyCommitment = getString(body, 'weeklyCommitment') || 'Not specified'
  const notes = getString(body, 'notes')

  if (!firstName) errors.push('First name is required.')
  if (!lastName) errors.push('Last name is required.')
  if (!uniqname || !uniqnamePattern.test(uniqname)) errors.push('A valid UMich uniqname is required.')
  if (!year) errors.push('Year is required.')
  if (!expectedGraduation) errors.push('Expected graduation is required.')
  if (!college) errors.push('College or program is required.')
  if (!rossStatusValues.has(rossStatus)) errors.push('Ross/BBA status is required.')
  if (!interestTypeValues.has(interestType)) errors.push('Interest type is required.')
  if (rolePreferences.length < 3) errors.push('Rank your top three board position interests.')
  if (availability.length === 0) errors.push('Select every interview block you are available for.')
  if (!resumeFile) {
    errors.push('Resume upload is required.')
  } else {
    if (!resumeFile.name) errors.push('Resume file name is required.')
    if (!isResumeFileAllowed(resumeFile.name, resumeFile.mimeType)) errors.push('Resume must be a PDF, DOC, or DOCX file.')
    if (!resumeFile.contentBase64) errors.push('Resume file could not be read. Please try uploading it again.')
    if (!Number.isFinite(resumeFile.size) || resumeFile.size <= 0) errors.push('Resume file is empty.')
    if (resumeFile.size > MAX_RESUME_FILE_SIZE_BYTES) errors.push('Resume file must be 2 MB or smaller.')
  }
  if (weeklyCommitment !== 'Not specified' && !commitmentValues.has(weeklyCommitment)) errors.push('Weekly commitment selection is invalid.')
  if (countWords(notes) > NOTES_WORD_LIMIT) errors.push(`Optional notes must be ${NOTES_WORD_LIMIT} words or fewer.`)

  if (errors.length > 0) {
    return { success: false, data: null, errors }
  }

  return {
    success: true,
    data: {
      firstName,
      lastName,
      uniqname,
      email,
      year,
      expectedGraduation,
      college,
      rossStatus,
      interestType,
      preferredRole,
      rolePreferences,
      availability,
      availabilitySummary: availabilitySummary(availability),
      interviewSlot: interviewSlot!,
      resumeFile: resumeFile!,
      weeklyCommitment,
      notes,
      status: statusForRossStatus(rossStatus),
    },
    errors: [],
  }
}

export const buildApplicationSubmission = (
  data: ApplicationData,
  userAgent = '',
): ApplicationSubmission => ({
  ...data,
  formType: 'leadershipInterest',
  dedupeKey: data.email,
  submittedAt: new Date().toISOString(),
  submissionId: createSubmissionId(),
  userAgent,
})
