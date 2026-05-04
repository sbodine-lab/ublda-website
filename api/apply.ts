import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'

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

type ResumeFilePayload = {
  name: string
  mimeType: string
  size: number
  contentBase64: string
}

type ApplicationStatus = 'Interview eligible' | 'Needs review' | 'Future role pool'
type RossStatus = 'ross-bba' | 'business-minor' | 'non-ross' | 'unsure'
type InterestType = 'leadership-interview' | 'future-role' | 'either'

type ApplicationData = {
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

type ValidationResult =
  | { success: true; data: ApplicationData; errors: [] }
  | { success: false; data: null; errors: string[] }

const interviewWindowDays = [
  { date: '2026-05-07', shortLabel: 'Thu, May 7', label: 'Thursday, May 7' },
  { date: '2026-05-08', shortLabel: 'Fri, May 8', label: 'Friday, May 8' },
  { date: '2026-05-09', shortLabel: 'Sat, May 9', label: 'Saturday, May 9' },
  { date: '2026-05-10', shortLabel: 'Sun, May 10', label: 'Sunday, May 10' },
] as const

const boardPositionOptions = [
  'VP of Member Experience',
  'VP of Events & Programming',
  'VP of Partnerships & Sponsorships',
  'VP of Marketing & Community',
  'VP of Accessibility Projects',
  'Open to any role',
] as const

const rossStatusOptions = ['ross-bba', 'business-minor', 'non-ross', 'unsure'] as const
const interestTypeOptions = ['leadership-interview', 'future-role', 'either'] as const
const commitmentOptions = ['2-3 hours/week', '3-5 hours/week', '5+ hours/week', 'Unsure, but interested'] as const
const resumeMimeTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const
const resumeFileExtensions = ['.pdf', '.doc', '.docx'] as const

const UMICH_EMAIL_DOMAIN = '@umich.edu'
const NOTES_WORD_LIMIT = 75
const MAX_RESUME_FILE_SIZE_BYTES = 2 * 1024 * 1024
const uniqnamePattern = /^[a-z0-9._-]{2,32}$/
const boardPositionValues = new Set<string>(boardPositionOptions)
const rossStatusValues = new Set<string>(rossStatusOptions)
const interestTypeValues = new Set<string>(interestTypeOptions)
const commitmentValues = new Set<string>(commitmentOptions)
const resumeMimeTypeValues = new Set<string>(resumeMimeTypes)
const interviewBlockMinutes = 30
const interviewBufferMinutes = 20
const interviewSlotIntervalMinutes = interviewBlockMinutes + interviewBufferMinutes
const interviewStartMinutes = 8 * 60
const interviewEndMinutes = 22 * 60

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

  for (let minute = interviewStartMinutes; minute + interviewBlockMinutes <= interviewEndMinutes; minute += interviewSlotIntervalMinutes) {
    const end = minute + interviewBlockMinutes
    const bufferEnd = end + interviewBufferMinutes
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

const validateRolePreferences = (value: unknown) => {
  const unique = Array.from(new Set(normalizeStringArray(value)))
  return unique.filter((preference) => boardPositionValues.has(preference))
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

const countWords = (value: string) => value.trim().split(/\s+/).filter(Boolean).length

const statusForRossStatus = (rossStatus: RossStatus): ApplicationStatus => {
  if (rossStatus === 'ross-bba') return 'Interview eligible'
  if (rossStatus === 'non-ross') return 'Future role pool'
  return 'Needs review'
}

const getResumeFile = (payload: Record<string, unknown>): ResumeFilePayload | null => {
  const value = payload.resumeFile
  if (!value || typeof value !== 'object') return null

  const file = value as Record<string, unknown>
  const name = typeof file.name === 'string' ? file.name.trim() : ''
  const mimeType = typeof file.mimeType === 'string' ? file.mimeType.trim() : ''
  const size = typeof file.size === 'number' ? file.size : Number(file.size || 0)
  const contentBase64 = typeof file.contentBase64 === 'string' ? file.contentBase64.trim() : ''

  return { name, mimeType, size, contentBase64 }
}

const isResumeFileAllowed = (name: string, mimeType: string) => {
  const lowerName = name.toLowerCase()
  const hasAllowedExtension = resumeFileExtensions.some((extension) => lowerName.endsWith(extension))
  return resumeMimeTypeValues.has(mimeType) || hasAllowedExtension
}

const validateApplicationPayload = (payload: unknown): ValidationResult => {
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
  if (availability.length === 0) errors.push('Select every interview slot you are available for.')
  if (!resumeFile) {
    errors.push('Resume upload is required.')
  } else {
    if (!resumeFile.name) errors.push('Resume file name is required.')
    if (!isResumeFileAllowed(resumeFile.name, resumeFile.mimeType)) errors.push('Resume must be a PDF, DOC, or DOCX file.')
    if (!resumeFile.contentBase64) errors.push('Resume file could not be read. Please try uploading it again.')
    if (!Number.isFinite(resumeFile.size) || resumeFile.size <= 0) errors.push('Resume file is empty.')
    if (resumeFile.size > MAX_RESUME_FILE_SIZE_BYTES) errors.push('Resume file must be 2 MB or smaller.')
  }
  if (weeklyCommitment !== 'Not specified' && !commitmentValues.has(weeklyCommitment)) {
    errors.push('Weekly commitment selection is invalid.')
  }
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

const buildApplicationSubmission = (data: ApplicationData, userAgent = '') => ({
  ...data,
  formType: 'leadershipInterest' as const,
  dedupeKey: data.email,
  submittedAt: new Date().toISOString(),
  submissionId: `app_${randomUUID()}`,
  userAgent,
})

const shouldMirrorToLegacyScript = () => process.env.UBLDA_RECRUITING_WRITE_MODE === 'legacy-script'

const mirrorToLegacyScript = async (submission: ReturnType<typeof buildApplicationSubmission>, userAgent: string) => {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL
  if (!scriptUrl) return { calendarEventCreated: false }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...submission, userAgent }),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || 'Failed to mirror candidate submission')
    }

    return { calendarEventCreated: Boolean(payload?.calendarEventCreated) }
  } finally {
    clearTimeout(timeout)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body ?? {}

  if (typeof body.website === 'string' && body.website.trim()) {
    return res.status(200).json({ success: true })
  }

  const result = validateApplicationPayload(body)
  if (!result.success) {
    return res.status(400).json({
      error: result.errors[0] || 'Please check the form and try again.',
      errors: result.errors,
    })
  }

  try {
    const submission = buildApplicationSubmission(result.data, req.headers['user-agent'] || '')
    await createLocalRecruitingStore().saveApplication(submission)
    const legacyResult = shouldMirrorToLegacyScript()
      ? await mirrorToLegacyScript(submission, req.headers['user-agent'] || '')
      : { calendarEventCreated: false }

    return res.status(200).json({
      success: true,
      status: submission.status,
      source: 'vercel',
      calendarEventCreated: legacyResult.calendarEventCreated,
    })
  } catch {
    return res.status(500).json({ error: 'Failed to submit' })
  }
}
