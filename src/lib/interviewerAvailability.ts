import {
  INTERVIEW_SLOTS,
  availabilitySummary,
  getSlotsFromValues,
  normalizeStringArray,
} from './interviews.ts'
import type { InterviewSlot } from './interviews.ts'
import { normalizeUniqname } from './application.ts'

const UMICH_EMAIL_DOMAIN = '@umich.edu'
const uniqnamePattern = /^[a-z0-9._-]{2,32}$/
const interviewSlotValues = new Set(INTERVIEW_SLOTS.map((slot) => slot.value))

export type InterviewerAvailabilityData = {
  firstName: string
  lastName: string
  uniqname: string
  email: string
  availability: InterviewSlot[]
  availabilitySummary: string
  maxInterviews: string
  notes: string
}

export type InterviewerAvailabilitySubmission = InterviewerAvailabilityData & {
  formType: 'interviewerAvailability'
  dedupeKey: string
  submittedAt: string
  submissionId: string
  userAgent: string
}

type ValidationResult =
  | { success: true; data: InterviewerAvailabilityData; errors: [] }
  | { success: false; data: null; errors: string[] }

const getString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key]
  return typeof value === 'string' ? value.trim() : ''
}

const createSubmissionId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `interviewer_${crypto.randomUUID()}`
  }

  return `interviewer_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export const validateInterviewerAvailabilityPayload = (payload: unknown): ValidationResult => {
  if (!payload || typeof payload !== 'object') {
    return { success: false, data: null, errors: ['Submission was empty.'] }
  }

  const body = payload as Record<string, unknown>
  const errors: string[] = []
  const firstName = getString(body, 'firstName')
  const lastName = getString(body, 'lastName')
  const uniqname = normalizeUniqname(getString(body, 'uniqname') || getString(body, 'email'))
  const email = `${uniqname}${UMICH_EMAIL_DOMAIN}`
  const availabilityValues = normalizeStringArray(body.availability || body.interviewAvailability)
  const invalidSlot = availabilityValues.find((value) => !interviewSlotValues.has(value))
  const availability = getSlotsFromValues(availabilityValues)
  const maxInterviews = getString(body, 'maxInterviews') || 'As needed'
  const notes = getString(body, 'notes')

  if (!firstName) errors.push('First name is required.')
  if (!lastName) errors.push('Last name is required.')
  if (!uniqname || !uniqnamePattern.test(uniqname)) errors.push('A valid UMich uniqname is required.')
  if (invalidSlot) errors.push('Availability includes an invalid interview block.')
  if (availability.length === 0) errors.push('Select every interview block you can help interview.')
  if (notes.length > 800) errors.push('Notes must be 800 characters or fewer.')

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
      availability,
      availabilitySummary: availabilitySummary(availability),
      maxInterviews,
      notes,
    },
    errors: [],
  }
}

export const buildInterviewerAvailabilitySubmission = (
  data: InterviewerAvailabilityData,
  userAgent = '',
): InterviewerAvailabilitySubmission => ({
  ...data,
  formType: 'interviewerAvailability',
  dedupeKey: data.email,
  submittedAt: new Date().toISOString(),
  submissionId: createSubmissionId(),
  userAgent,
})
