export interface ClubEvent {
  id: string
  isoDate: string
  /** Exact ending with UTC offset, so listings retire in every visitor timezone. */
  endsAt?: string
  archiveDescription?: string
  preview?: string
  date: string
  month: string
  day: string
  time?: string
  title: string
  host?: string
  description: string
  location: string
  tags?: string[]
  past?: boolean
  rsvpUrl?: string
  formatNote?: string
  timezone?: string
}

export const events: ClubEvent[] = [
  {
    id: 'lloyd-lewis-arc-thrift',
    isoDate: '2026-04-16',
    date: 'April 16, 2026',
    month: 'Apr',
    day: '16',
    time: '6:00 PM - 7:00 PM',
    title: 'Fireside Chat with Lloyd Lewis, CEO of Arc Thrift Stores',
    description:
      'Lloyd Lewis joined us remotely from Colorado to discuss Arc Thrift Stores and its employment of people with intellectual and developmental disabilities. Students gathered at Ross for the conversation.',
    location: 'Ross R1240, Ross School of Business',
    past: true,
  },
  {
    id: 'andrew-parker-nestidd',
    isoDate: '2026-03-11',
    date: 'March 11, 2026',
    month: 'Mar',
    day: '11',
    time: '7:00 PM - 8:00 PM',
    title: 'Fireside Chat with Andrew Parker, CEO & Co-Founder of Nestidd',
    description:
      'Ross alum Andrew Parker discussed building Nestidd, a housing company serving people with intellectual and developmental disabilities, at our first fireside chat.',
    location: 'Ross B0560, Ross School of Business',
    past: true,
  },
  {
    id: 'rossabilities-conference',
    isoDate: '2026-02-13',
    date: 'February 13, 2026',
    month: 'Feb',
    day: '13',
    title: '2nd Annual RossAbilities Conference',
    host: 'BLDA (MBA); UBLDA members attended',
    description:
      'UBLDA members attended BLDA’s annual conference on disability inclusion in business.',
    location: 'Tauber Colloquium, Ross School of Business',
    past: true,
  },
  {
    id: 'adaptive-basketball',
    isoDate: '2026-01-17',
    date: 'January 17, 2026',
    month: 'Jan',
    day: '17',
    time: '12:00 PM - 2:00 PM',
    title: 'Adaptive Basketball Event',
    host: 'BLDA (MBA); UBLDA members attended',
    description:
      'UBLDA members joined BLDA for wheelchair basketball with medical students, starting with chair skills and drills.',
    location: 'Sports Coliseum, 721 S 5th Ave, Ann Arbor, MI',
    past: true,
  },
]

/** Legacy recaps remain archived. Dated announcements expire automatically. */
export function isPastEvent(event: ClubEvent, now: number): boolean {
  if (event.past) return true
  if (event.endsAt) return now >= Date.parse(event.endsAt)
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: event.timezone || 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(now))
  return event.isoDate < localDate
}

export const EVENT_BOUNDARIES = events.flatMap(event => event.endsAt ? [Date.parse(event.endsAt)] : [])
