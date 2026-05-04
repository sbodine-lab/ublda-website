export const INTERVIEW_WINDOW_DAYS = [
  {
    date: '2026-05-07',
    shortLabel: 'Thu, May 7',
    label: 'Thursday, May 7',
  },
  {
    date: '2026-05-08',
    shortLabel: 'Fri, May 8',
    label: 'Friday, May 8',
  },
  {
    date: '2026-05-09',
    shortLabel: 'Sat, May 9',
    label: 'Saturday, May 9',
  },
  {
    date: '2026-05-10',
    shortLabel: 'Sun, May 10',
    label: 'Sunday, May 10',
  },
] as const

export const INTERVIEW_START_HOUR_ET = 8
export const INTERVIEW_END_HOUR_ET = 22
export const INTERVIEW_BLOCK_MINUTES = 20
export const INTERVIEW_BUFFER_MINUTES = 10
export const INTERVIEW_SLOT_INTERVAL_MINUTES = INTERVIEW_BLOCK_MINUTES + INTERVIEW_BUFFER_MINUTES

export type InterviewSlot = {
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

const formatHour = (hour24: number) => {
  const hour12 = hour24 % 12 || 12
  const suffix = hour24 < 12 ? 'AM' : 'PM'
  return `${hour12}:${'00'} ${suffix}`
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

export const INTERVIEW_SLOTS: InterviewSlot[] = INTERVIEW_WINDOW_DAYS.flatMap((day) => {
  const startMinutes = INTERVIEW_START_HOUR_ET * 60
  const endMinutes = INTERVIEW_END_HOUR_ET * 60
  const slots: InterviewSlot[] = []

  for (let minute = startMinutes; minute < endMinutes; minute += INTERVIEW_SLOT_INTERVAL_MINUTES) {
    const end = minute + INTERVIEW_BLOCK_MINUTES
    const bufferEnd = end + INTERVIEW_BUFFER_MINUTES
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
    const bufferEndValue = isoWithEasternOffset(day.date, bufferEnd)

    slots.push({
      value: `${start}/${endValue}`,
      label: `${day.shortLabel}, ${timeLabel}`,
      dayLabel: day.label,
      timeLabel,
      bufferLabel,
      start,
      end: endValue,
      bufferEnd: bufferEndValue,
      startMinutes: minute,
    })
  }

  return slots
})

export const INTERVIEW_DAY_PARTS = [
  {
    key: 'morning',
    label: 'Morning',
    rangeLabel: '8 AM-noon',
    startMinutes: 8 * 60,
    endMinutes: 12 * 60,
  },
  {
    key: 'afternoon',
    label: 'Afternoon',
    rangeLabel: 'noon-5 PM',
    startMinutes: 12 * 60,
    endMinutes: 17 * 60,
  },
  {
    key: 'evening',
    label: 'Evening',
    rangeLabel: '5-10 PM',
    startMinutes: 17 * 60,
    endMinutes: 22 * 60,
  },
] as const

export const INTERVIEW_SLOT_GROUPS = INTERVIEW_WINDOW_DAYS.map((day) => ({
  ...day,
  slots: INTERVIEW_SLOTS.filter((slot) => slot.dayLabel === day.label),
  parts: INTERVIEW_DAY_PARTS.map((part) => ({
    ...part,
    slots: INTERVIEW_SLOTS.filter((slot) => (
      slot.dayLabel === day.label &&
      slot.startMinutes >= part.startMinutes &&
      slot.startMinutes < part.endMinutes
    )),
  })),
}))

export const INTERVIEW_WINDOW_LABEL = 'Thursday, May 7 through Sunday, May 10'
export const INTERVIEW_DAY_RANGE_LABEL = `${INTERVIEW_WINDOW_LABEL}, ${formatHour(INTERVIEW_START_HOUR_ET)}-${formatHour(INTERVIEW_END_HOUR_ET)} ET`
export const INTERVIEW_BLOCK_WITH_BUFFER_LABEL = `${INTERVIEW_BLOCK_MINUTES}-minute interview + ${INTERVIEW_BUFFER_MINUTES}-minute buffer`

export const BOARD_POSITION_OPTIONS = [
  'VP of Member Experience',
  'VP of Events & Programming',
  'VP of Partnerships & Sponsorships',
  'VP of Marketing & Community',
  'VP of Accessibility Projects',
  'Open to any role',
] as const

export const INTERVIEWER_OPTIONS = [
  'Sam Bodine',
  'Alexa Chiang',
  'Cooper Ryan',
  'E-board member',
] as const

export const INTERVIEW_STATUS_OPTIONS = [
  'Needs match',
  'Matched',
  'Invited',
  'Interviewed',
  'Offer',
  'Hold',
  'Declined',
] as const

export type InterviewStatus = (typeof INTERVIEW_STATUS_OPTIONS)[number]
export type BoardPosition = (typeof BOARD_POSITION_OPTIONS)[number]
export type InterviewerName = (typeof INTERVIEWER_OPTIONS)[number]

const slotByValue = new Map(INTERVIEW_SLOTS.map((slot) => [slot.value, slot]))
const boardPositionValues = new Set<string>(BOARD_POSITION_OPTIONS)

export const getInterviewSlotByValue = (value: string) => slotByValue.get(value)

export const getSlotsFromValues = (values: string[]) => {
  const seen = new Set<string>()

  return values.reduce<InterviewSlot[]>((slots, value) => {
    if (seen.has(value)) {
      return slots
    }

    const slot = slotByValue.get(value)
    if (slot) {
      seen.add(value)
      slots.push(slot)
    }

    return slots
  }, [])
}

export const sortSlotValues = (values: Iterable<string>) => {
  const selected = new Set(values)
  return INTERVIEW_SLOTS.filter((slot) => selected.has(slot.value)).map((slot) => slot.value)
}

export const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return typeof value === 'string' && value ? [value] : []
  }

  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
}

export const validateRolePreferences = (value: unknown) => {
  const preferences = normalizeStringArray(value)
  const unique = Array.from(new Set(preferences))

  return unique.filter((preference) => boardPositionValues.has(preference))
}

export const availabilitySummary = (slots: InterviewSlot[]) => {
  if (slots.length === 0) {
    return 'None selected'
  }

  const counts = new Map<string, number>()
  slots.forEach((slot) => counts.set(slot.dayLabel, (counts.get(slot.dayLabel) || 0) + 1))

  return Array.from(counts.entries())
    .map(([day, count]) => `${day}: ${count} slot${count === 1 ? '' : 's'}`)
    .join('; ')
}

export const overlappingSlotValues = (candidateSlots: InterviewSlot[], interviewerSlots: InterviewSlot[]) => {
  const interviewerValues = new Set(interviewerSlots.map((slot) => slot.value))
  return candidateSlots.filter((slot) => interviewerValues.has(slot.value)).map((slot) => slot.value)
}
