import {
  INTERVIEW_STATUS_OPTIONS,
  getInterviewSlotByValue,
  normalizeStringArray,
} from './interviews.ts'
import type { InterviewSlot, InterviewStatus } from './interviews.ts'
import { normalizeUniqname } from './application.ts'

const UMICH_EMAIL_DOMAIN = '@umich.edu'
const uniqnamePattern = /^[a-z0-9._-]{2,32}$/
const statusValues = new Set<string>(INTERVIEW_STATUS_OPTIONS)

export type InterviewAssignmentData = {
  uniqname: string
  email: string
  assignedSlot: InterviewSlot | null
  interviewers: string[]
  interviewStatus: InterviewStatus
  feedback: string
  sessionToken: string
}

export type InterviewAssignmentSubmission = InterviewAssignmentData & {
  formType: 'interviewAssignment'
  submittedAt: string
  submissionId: string
  userAgent: string
}

type ValidationResult =
  | { success: true; data: InterviewAssignmentData; errors: [] }
  | { success: false; data: null; errors: string[] }

const getString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key]
  return typeof value === 'string' ? value.trim() : ''
}

const createSubmissionId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `assignment_${crypto.randomUUID()}`
  }

  return `assignment_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export const validateInterviewAssignmentPayload = (payload: unknown): ValidationResult => {
  if (!payload || typeof payload !== 'object') {
    return { success: false, data: null, errors: ['Submission was empty.'] }
  }

  const body = payload as Record<string, unknown>
  const errors: string[] = []
  const uniqname = normalizeUniqname(getString(body, 'uniqname') || getString(body, 'email'))
  const email = `${uniqname}${UMICH_EMAIL_DOMAIN}`
  const assignedSlotValue = getString(body, 'assignedSlot')
  const assignedSlot = assignedSlotValue ? getInterviewSlotByValue(assignedSlotValue) || null : null
  const interviewers = normalizeStringArray(body.interviewers || body.interviewer)
  const interviewStatus = (getString(body, 'interviewStatus') || getString(body, 'status') || 'Needs match') as InterviewStatus
  const feedback = getString(body, 'feedback')
  const sessionToken = getString(body, 'sessionToken')

  if (!uniqname || !uniqnamePattern.test(uniqname)) errors.push('A valid candidate uniqname is required.')
  if (assignedSlotValue && !assignedSlot) errors.push('Assigned slot is invalid.')
  if (!statusValues.has(interviewStatus)) errors.push('Interview status is invalid.')
  if (feedback.length > 2000) errors.push('Feedback must be 2,000 characters or fewer.')
  if (sessionToken.length < 24) errors.push('A valid admin session is required.')

  if (errors.length > 0) {
    return { success: false, data: null, errors }
  }

  return {
    success: true,
    data: {
      uniqname,
      email,
      assignedSlot,
      interviewers,
      interviewStatus,
      feedback,
      sessionToken,
    },
    errors: [],
  }
}

export const buildInterviewAssignmentSubmission = (
  data: InterviewAssignmentData,
  userAgent = '',
): InterviewAssignmentSubmission => ({
  ...data,
  formType: 'interviewAssignment',
  submittedAt: new Date().toISOString(),
  submissionId: createSubmissionId(),
  userAgent,
})
