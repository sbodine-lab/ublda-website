import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'

type InterviewSlot = {
  value: string
  label: string
  dayLabel: string
  timeLabel: string
  bufferLabel: string
  start: string
  end: string
  bufferEnd: string
  startMinutes: number
}

type InterviewStatus = 'Needs match' | 'Matched' | 'Invited' | 'Interviewed' | 'Offer' | 'Hold' | 'Declined'

type InterviewAssignmentData = {
  uniqname: string
  email: string
  assignedSlot: InterviewSlot | null
  interviewers: string[]
  interviewStatus: InterviewStatus
  feedback: string
  sessionToken: string
}

type ValidationResult =
  | { success: true; data: InterviewAssignmentData; errors: [] }
  | { success: false; data: null; errors: string[] }

const interviewWindowDays = [
  { date: '2026-05-07', shortLabel: 'Thu, May 7', label: 'Thursday, May 7' },
  { date: '2026-05-08', shortLabel: 'Fri, May 8', label: 'Friday, May 8' },
  { date: '2026-05-09', shortLabel: 'Sat, May 9', label: 'Saturday, May 9' },
  { date: '2026-05-10', shortLabel: 'Sun, May 10', label: 'Sunday, May 10' },
] as const

const interviewStatusOptions = ['Needs match', 'Matched', 'Invited', 'Interviewed', 'Offer', 'Hold', 'Declined'] as const
const scheduledStatusValues = new Set<string>(['Matched', 'Invited', 'Interviewed', 'Offer'])
const statusValues = new Set<string>(interviewStatusOptions)
const uniqnamePattern = /^[a-z0-9._-]{2,32}$/
const UMICH_EMAIL_DOMAIN = '@umich.edu'

const setApiSecurityHeaders = (res: VercelResponse) => {
  res.setHeader?.('Cache-Control', 'no-store, max-age=0')
  res.setHeader?.('Pragma', 'no-cache')
  res.setHeader?.('X-Content-Type-Options', 'nosniff')
}

const formatTime = (hour24: number, minute: number) => {
  const hour12 = hour24 % 12 || 12
  const suffix = hour24 < 12 ? 'AM' : 'PM'
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`
}

const isoWithEasternOffset = (date: string, totalMinutes: number) => {
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-04:00`
}

const interviewSlots = interviewWindowDays.flatMap((day) => {
  const slots: InterviewSlot[] = []

  for (let minute = 8 * 60; minute < 22 * 60; minute += 30) {
    const end = minute + 20
    const bufferEnd = end + 10
    const startHour = Math.floor(minute / 60)
    const startMinute = minute % 60
    const endHour = Math.floor(end / 60)
    const endMinute = end % 60
    const bufferEndHour = Math.floor(bufferEnd / 60)
    const bufferEndMinute = bufferEnd % 60
    const timeLabel = `${formatTime(startHour, startMinute)}-${formatTime(endHour, endMinute)} ET`
    const bufferLabel = `buffer until ${formatTime(bufferEndHour, bufferEndMinute)} ET`
    const start = isoWithEasternOffset(day.date, minute)
    const endValue = isoWithEasternOffset(day.date, end)

    slots.push({
      value: `${start}/${endValue}`,
      label: `${day.shortLabel}, ${timeLabel}`,
      dayLabel: day.label,
      timeLabel,
      bufferLabel,
      start,
      end: endValue,
      bufferEnd: isoWithEasternOffset(day.date, bufferEnd),
      startMinutes: minute,
    })
  }

  return slots
})

const slotByValue = new Map(interviewSlots.map((slot) => [slot.value, slot]))

const getString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key]
  return typeof value === 'string' ? value.trim() : ''
}

const normalizeUniqname = (value: unknown) => (
  typeof value === 'string' ? value.trim().toLowerCase().replace(/@.*$/, '') : ''
)

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return typeof value === 'string' && value ? [value] : []
  }

  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
}

const validateInterviewAssignmentPayload = (payload: unknown): ValidationResult => {
  if (!payload || typeof payload !== 'object') {
    return { success: false, data: null, errors: ['Submission was empty.'] }
  }

  const body = payload as Record<string, unknown>
  const errors: string[] = []
  const uniqname = normalizeUniqname(getString(body, 'uniqname') || getString(body, 'email'))
  const email = `${uniqname}${UMICH_EMAIL_DOMAIN}`
  const assignedSlotValue = getString(body, 'assignedSlot')
  const assignedSlot = assignedSlotValue ? slotByValue.get(assignedSlotValue) || null : null
  const submittedInterviewers = normalizeStringArray(body.interviewers || body.interviewer)
  const interviewers = Array.from(new Set(submittedInterviewers))
  const interviewStatus = (getString(body, 'interviewStatus') || getString(body, 'status') || 'Needs match') as InterviewStatus
  const feedback = getString(body, 'feedback')
  const sessionToken = getString(body, 'sessionToken')

  if (sessionToken.length < 24) errors.push('A valid admin session is required.')
  if (!uniqname || !uniqnamePattern.test(uniqname)) errors.push('A valid candidate uniqname is required.')
  if (assignedSlotValue && !assignedSlot) errors.push('Assigned slot is invalid.')
  if (!statusValues.has(interviewStatus)) errors.push('Interview status is invalid.')
  if (submittedInterviewers.length !== interviewers.length) errors.push('Interviewers must be unique.')
  if (interviewers.length > 2) errors.push('Assign no more than two interviewers.')
  if (scheduledStatusValues.has(interviewStatus) && !assignedSlot) {
    errors.push('Select an assigned slot before using this interview status.')
  }
  if ((assignedSlot || scheduledStatusValues.has(interviewStatus)) && interviewers.length === 0) {
    errors.push('Assign at least one interviewer with the interview slot.')
  }
  if (feedback.length > 2000) errors.push('Feedback must be 2,000 characters or fewer.')

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

const buildInterviewAssignmentSubmission = (data: InterviewAssignmentData, userAgent = '') => ({
  ...data,
  formType: 'interviewAssignment',
  submittedAt: new Date().toISOString(),
  submissionId: `assignment_${randomUUID()}`,
  userAgent,
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const result = validateInterviewAssignmentPayload(req.body ?? {})
  if (!result.success) {
    return res.status(400).json({
      error: result.errors[0] || 'Please check the assignment and try again.',
      errors: result.errors,
    })
  }

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL
  if (!scriptUrl) {
    return res.status(500).json({ error: 'Form backend not configured' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const submission = buildInterviewAssignmentSubmission(result.data, req.headers['user-agent'] || '')
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok || payload?.success === false) {
      return res.status(response.ok ? 400 : 500).json({
        error: payload?.error || 'Failed to save assignment',
      })
    }

    return res.status(200).json({
      success: true,
      row: payload?.row || null,
      calendarEventCreated: Boolean(payload?.calendarEventCreated),
    })
  } catch {
    return res.status(500).json({ error: 'Failed to save assignment' })
  } finally {
    clearTimeout(timeout)
  }
}
