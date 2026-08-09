import { getInterviewSlotByValue, validateRolePreferences } from './interviews.ts'
import {
  MAX_RESUME_FILE_SIZE_BYTES,
  decodedResumeContentSize,
  isResumeFileAllowed,
} from './application.ts'
import type { ResumeFilePayload } from './application.ts'

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
  resumeFile: ResumeFilePayload
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

const getResumeFile = (payload: Record<string, unknown>): ResumeFilePayload | null => {
  const value = payload.resumeFile
  if (!value || typeof value !== 'object') return null

  const file = value as Record<string, unknown>
  const name = cleanBookingText(file.name, 180)
  const mimeType = cleanBookingText(file.mimeType, 120)
  const size = typeof file.size === 'number' ? file.size : Number(file.size || 0)
  const contentBase64 = typeof file.contentBase64 === 'string' ? file.contentBase64.trim() : ''

  return { name, mimeType, size, contentBase64 }
}

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
  const resumeFile = getResumeFile(body)
  const errors: string[] = []

  if (!firstName) errors.push('First name is required.')
  if (!lastName) errors.push('Last name is required.')
  if (!emailPattern.test(email)) errors.push('A valid email is required.')
  if (!getInterviewSlotByValue(slotValue)) errors.push('Choose a valid interview slot.')
  if (rolePreferences.length < 1) errors.push('Select your first-choice function.')
  if (!resumeFile) {
    errors.push('Resume upload is required.')
  } else {
    const decodedSize = resumeFile.contentBase64 ? decodedResumeContentSize(resumeFile.contentBase64) : null
    if (!resumeFile.name) errors.push('Resume file name is required.')
    if (!isResumeFileAllowed(resumeFile.name, resumeFile.mimeType)) errors.push('Resume must be a PDF, DOC, or DOCX file.')
    if (!resumeFile.contentBase64) errors.push('Resume file could not be read. Please try uploading it again.')
    if (resumeFile.contentBase64 && decodedSize === null) errors.push('Resume file could not be read. Please try uploading it again.')
    if (!Number.isFinite(resumeFile.size) || resumeFile.size <= 0) errors.push('Resume file is empty.')
    if (resumeFile.size > MAX_RESUME_FILE_SIZE_BYTES) errors.push('Resume file must be 2 MB or smaller.')
    if (decodedSize !== null && decodedSize > MAX_RESUME_FILE_SIZE_BYTES) errors.push('Resume file must be 2 MB or smaller.')
  }
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
          resumeFile: resumeFile!,
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
