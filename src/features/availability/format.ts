export function minutesLabel(minutes: number): string {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const hour24 = Math.floor(normalized / 60)
  const minute = normalized % 60
  const hour = hour24 % 12 || 12
  return `${hour}${minute ? `:${String(minute).padStart(2, "0")}` : ""} ${hour24 < 12 ? "am" : "pm"}`
}

export function dateLabel(dateKey: string, options?: Intl.DateTimeFormatOptions): string {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...options,
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

export function dayParts(dateKey: string): { day: string; date: string } {
  return {
    day: dateLabel(dateKey, { weekday: "short" }).split(" ")[0],
    date: String(Number(dateKey.slice(-2))),
  }
}

export function timezoneLabel(timezone: string): string {
  if (timezone === "America/Detroit") return "Detroit time"
  return timezone.replaceAll("_", " ").replace("/", " · ")
}

export function candidateLabel(dateKey: string, startMinutes: number, endMinutes: number): string {
  return `${dateLabel(dateKey, { weekday: "short", month: "short", day: "numeric" })} · ${minutesLabel(startMinutes)}–${minutesLabel(endMinutes)}`
}

export function parseTimeInput(value: string): number {
  const [hours, minutes] = value.split(":").map(Number)
  return hours * 60 + minutes
}

export function timeInputValue(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

function offsetAt(epoch: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(epoch))
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const asUtc = Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
    Number(value.hour),
    Number(value.minute),
    Number(value.second),
  )
  return asUtc - Math.floor(epoch / 1000) * 1000
}

export function zonedDateTimeToIso(localValue: string, timezone: string): string | undefined {
  const match = localValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) return undefined
  const target = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  )
  let epoch = target
  for (let attempt = 0; attempt < 3; attempt += 1) epoch = target - offsetAt(epoch, timezone)
  return new Date(epoch).toISOString()
}

export function nextWeekdays(count: number): string[] {
  const dates: string[] = []
  const cursor = new Date()
  cursor.setHours(12, 0, 0, 0)
  cursor.setDate(cursor.getDate() + 1)
  while (dates.length < count) {
    const day = cursor.getDay()
    if (day !== 0 && day !== 6) {
      dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`)
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

/* Mirrors convex/lib/availability.ts. The Convex source is not part of the
   app's TypeScript project, so the limits are restated here for the form. */
export const SLOT_MINUTES = 15
export const MIN_DURATION_MINUTES = SLOT_MINUTES
export const MAX_DURATION_MINUTES = 12 * 60
export const MAX_WINDOW_MINUTES = 24 * 60

/** "45 min", "1 hr", "1 hr 30 min", "2 hr 15 min". */
export function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} min`
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`
}

/** Snap a minute count to the nearest slot boundary, clamped to the day. */
export function snapToSlot(minutes: number): number {
  const snapped = Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES
  return Math.min(24 * 60, Math.max(0, snapped))
}

/** Same rules the backend applies, so the form can explain before submitting. */
export function timeShapeError(input: {
  durationMinutes: number
  startMinutes: number
  endMinutes: number
}): string | null {
  const { durationMinutes, startMinutes, endMinutes } = input
  if (
    !Number.isInteger(durationMinutes)
    || durationMinutes < MIN_DURATION_MINUTES
    || durationMinutes > MAX_DURATION_MINUTES
    || durationMinutes % SLOT_MINUTES !== 0
  ) {
    return `Event length must be between ${MIN_DURATION_MINUTES} minutes and ${MAX_DURATION_MINUTES / 60} hours, in ${SLOT_MINUTES}-minute steps.`
  }
  if (!Number.isInteger(startMinutes) || !Number.isInteger(endMinutes)) return "Choose an earliest and latest time."
  if (endMinutes <= startMinutes) return "The latest time must be after the earliest time."
  if (endMinutes - startMinutes > MAX_WINDOW_MINUTES) return `The time window can be at most ${MAX_WINDOW_MINUTES / 60} hours.`
  if (endMinutes - startMinutes < durationMinutes) {
    return `The window is shorter than the event (${durationLabel(durationMinutes)}). Widen the times or shorten the event.`
  }
  return null
}

/** Calendar date of an ISO instant as seen in the poll's timezone. */
export function zonedDateKey(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso))
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}
