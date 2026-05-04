import type { VercelRequest, VercelResponse } from '@vercel/node'

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

type InterviewerAvailabilityData = {
  firstName: string
  lastName: string
  uniqname: string
  email: string
  availability: InterviewSlot[]
  availabilitySummary: string
  maxInterviews: string
  notes: string
}

const interviewWindowDays = [
  { date: '2026-05-07', shortLabel: 'Thu, May 7', label: 'Thursday, May 7' },
  { date: '2026-05-08', shortLabel: 'Fri, May 8', label: 'Friday, May 8' },
  { date: '2026-05-09', shortLabel: 'Sat, May 9', label: 'Saturday, May 9' },
  { date: '2026-05-10', shortLabel: 'Sun, May 10', label: 'Sunday, May 10' },
] as const

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
const interviewSlotValues = new Set(interviewSlots.map((slot) => slot.value))
const uniqnamePattern = /^[a-z0-9._-]{2,32}$/

const getString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key]
  return typeof value === 'string' ? value.trim() : ''
}

const normalizeUniqname = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase().replace(/@.*$/, '') : '')

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return typeof value === 'string' && value ? [value] : []
  }

  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
}

const getSlotsFromValues = (values: string[]) => {
  const seen = new Set<string>()
  return values.reduce<InterviewSlot[]>((slots, value) => {
    if (seen.has(value)) return slots
    const slot = slotByValue.get(value)
    if (slot) {
      seen.add(value)
      slots.push(slot)
    }
    return slots
  }, [])
}

const availabilitySummary = (slots: InterviewSlot[]) => {
  if (slots.length === 0) return 'None selected'

  const counts = new Map<string, number>()
  slots.forEach((slot) => counts.set(slot.dayLabel, (counts.get(slot.dayLabel) || 0) + 1))

  return Array.from(counts.entries())
    .map(([day, count]) => `${day}: ${count} slot${count === 1 ? '' : 's'}`)
    .join('; ')
}

const createSubmissionId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `interviewer_${crypto.randomUUID()}`
  }

  return `interviewer_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

const validateInterviewerAvailabilityPayload = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return { success: false as const, data: null, errors: ['Submission was empty.'] }
  }

  const body = payload as Record<string, unknown>
  const errors: string[] = []
  const firstName = getString(body, 'firstName')
  const lastName = getString(body, 'lastName')
  const uniqname = normalizeUniqname(getString(body, 'uniqname') || getString(body, 'email'))
  const email = `${uniqname}@umich.edu`
  const availabilityValues = normalizeStringArray(body.availability || body.interviewAvailability)
  const invalidSlot = availabilityValues.find((value) => !interviewSlotValues.has(value))
  const availability = getSlotsFromValues(availabilityValues)
  const maxInterviews = getString(body, 'maxInterviews') || 'As needed'
  const notes = getString(body, 'notes')

  if (!firstName) errors.push('First name is required.')
  if (!lastName) errors.push('Last name is required.')
  if (!uniqname || !uniqnamePattern.test(uniqname)) errors.push('A valid UMich uniqname is required.')
  if (invalidSlot) errors.push('Availability includes an invalid interview slot.')
  if (availability.length === 0) errors.push('Select every interview slot you can help interview.')
  if (notes.length > 800) errors.push('Notes must be 800 characters or fewer.')

  return errors.length
    ? { success: false as const, data: null, errors }
    : {
        success: true as const,
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

const buildInterviewerAvailabilitySubmission = (
  data: InterviewerAvailabilityData,
  userAgent = '',
) => ({
  ...data,
  formType: 'interviewerAvailability',
  dedupeKey: data.email,
  submittedAt: new Date().toISOString(),
  submissionId: createSubmissionId(),
  userAgent,
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body ?? {}

  if (typeof body.website === 'string' && body.website.trim()) {
    return res.status(200).json({ success: true })
  }

  const result = validateInterviewerAvailabilityPayload(body)
  if (!result.success) {
    return res.status(400).json({
      error: result.errors[0] || 'Please check the form and try again.',
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
    const submission = buildInterviewerAvailabilitySubmission(result.data, req.headers['user-agent'] || '')
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok || payload?.success === false) {
      return res.status(response.ok ? 400 : 500).json({
        error: payload?.error || 'Failed to submit availability',
      })
    }

    return res.status(200).json({
      success: true,
      availabilitySummary: submission.availabilitySummary,
      updatedExistingSubmission: Boolean(payload?.updatedExistingSubmission),
    })
  } catch {
    return res.status(500).json({ error: 'Failed to submit availability' })
  } finally {
    clearTimeout(timeout)
  }
}
