import { getInterviewSlotByValue, validateRolePreferences } from './interviews.ts'

export type PublicInterviewSlot = {
  value: string
  label: string
  dayLabel: string
  shortDayLabel: string
  timeLabel: string
  start: string
  end: string
  startMinutes: number
  interviewerCount: number
  interviewers: string[]
  isBooked: boolean
  isAvailable: boolean
}

export type InterviewBookingData = {
  firstName: string
  lastName: string
  email: string
  slotValue: string
  roleInterest: string
  rolePreferences: string[]
  conflicts: string
}

export type InterviewBookingSubmission = InterviewBookingData & {
  formType: 'interviewBooking'
  submissionId: string
  submittedAt: string
  userAgent: string
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const replaceControlCharacters = (value: string) => (
  Array.from(value, (character) => {
    const code = character.charCodeAt(0)
    return code <= 0x1f || code === 0x7f ? ' ' : character
  }).join('')
)
const stripMarkupDelimiters = (value: string) => value.replace(/[<>]/g, '')

export const cleanBookingText = (value: unknown, maxLength = 160) => (
  typeof value === 'string'
    ? stripMarkupDelimiters(replaceControlCharacters(value)).replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : ''
)

export const normalizeBookingEmail = (value: unknown) => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
)

export const validateInterviewBookingPayload = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return { success: false as const, data: null, errors: ['Submission was empty.'] }
  }

  const body = payload as Record<string, unknown>
  const firstName = cleanBookingText(body.firstName, 80)
  const lastName = cleanBookingText(body.lastName, 80)
  const email = normalizeBookingEmail(body.email)
  const slotValue = cleanBookingText(body.slotValue || body.selectedSlot, 220)
  const roleInterest = cleanBookingText(body.roleInterest, 180)
  const rolePreferences = validateRolePreferences(body.rolePreferences || body.functionPreferences || body.roleInterest)
  const conflicts = cleanBookingText(body.conflicts || body.notes, 1000)
  const errors: string[] = []

  if (!firstName) errors.push('First name is required.')
  if (!lastName) errors.push('Last name is required.')
  if (!emailPattern.test(email)) errors.push('A valid email is required.')
  if (!getInterviewSlotByValue(slotValue)) errors.push('Choose a valid interview slot.')
  if (rolePreferences.length < 3) errors.push('Rank all three function preferences.')
  if (firstName.length > 80 || lastName.length > 80) errors.push('Names must be 80 characters or fewer.')
  if (roleInterest.length > 180) errors.push('Role interest must be 180 characters or fewer.')
  if (conflicts.length > 1000) errors.push('Notes must be 1000 characters or fewer.')

  return errors.length
    ? { success: false as const, data: null, errors }
    : {
        success: true as const,
        data: {
          firstName,
          lastName,
          email,
          slotValue,
          roleInterest: rolePreferences[0] || roleInterest,
          rolePreferences,
          conflicts,
        },
        errors: [],
      }
}

export const buildInterviewBookingSubmission = (
  data: InterviewBookingData,
  userAgent = '',
): InterviewBookingSubmission => {
  if (typeof crypto === 'undefined' || !('randomUUID' in crypto)) {
    throw new Error('A secure random source is required to submit an interview booking.')
  }

  return {
    ...data,
    formType: 'interviewBooking',
    submissionId: `booking_${crypto.randomUUID()}`,
    submittedAt: new Date().toISOString(),
    userAgent,
  }
}
