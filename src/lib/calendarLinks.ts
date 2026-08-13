/**
 * Google Calendar links, in one place.
 *
 * The public events page hand-authors dates in English
 * ("October 1, 2026" + "7:00 PM - 8:00 PM"). Keep that conversion here so the
 * page component only owns presentation.
 */

const GCAL_RENDER = 'https://calendar.google.com/calendar/render'

/**
 * The shape the marketing events page passes in. Declared structurally rather
 * than imported so `src/pages/Events.tsx` keeps its own local `Event` type.
 */
export type MarketingCalendarEvent = {
  /** "October 1, 2026" */
  date: string
  /** "7:00 PM - 8:00 PM". Absent means an all-day entry. */
  time?: string
  title: string
  description: string
  location: string
}

export function buildGCalUrl(event: MarketingCalendarEvent): string {
  const months: Record<string, string> = {
    January: '01', February: '02', March: '03', April: '04',
    May: '05', June: '06', July: '07', August: '08',
    September: '09', October: '10', November: '11', December: '12',
  }

  const parts = event.date.split(/[\s,]+/)
  const m = months[parts[0]] || '01'
  const d = parts[1].padStart(2, '0')
  const y = parts[2]

  let dates: string
  if (event.time) {
    const [startStr, endStr] = event.time.split(' - ')
    const toMil = (t: string) => {
      const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i)
      if (!match) return '000000'
      let h = parseInt(match[1])
      const min = match[2]
      const ampm = match[3].toUpperCase()
      if (ampm === 'PM' && h !== 12) h += 12
      if (ampm === 'AM' && h === 12) h = 0
      return `${String(h).padStart(2, '0')}${min}00`
    }
    dates = `${y}${m}${d}T${toMil(startStr)}/${y}${m}${d}T${toMil(endStr)}`
  } else {
    const nextDay = String(parseInt(d) + 1).padStart(2, '0')
    dates = `${y}${m}${d}/${y}${m}${nextDay}`
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates,
    details: event.description,
    location: event.location,
  })

  return `${GCAL_RENDER}?${params.toString()}`
}
