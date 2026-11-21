export interface ClubEvent {
  id: string
  isoDate: string
  /** Exact start with UTC offset. Drives the countdown banner and RSVP popup. */
  startsAt?: string
  /** Exact ending with UTC offset, so listings retire in every visitor timezone. */
  endsAt?: string
  /** Feature this event in the site-wide countdown banner and RSVP popup. */
  promote?: boolean
  /** Short name for the banner and popup. Falls back to `title`. */
  shortTitle?: string
  /** One-line location for the banner, e.g. "Ross R1210". */
  shortLocation?: string
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
    // Source: Samantha Naber, email to UBLDA members 2026-11-18,
    // "UBLDA Panel Invitation: Disability, Business & Opportunity".
    id: 'disability-business-opportunity-panel',
    isoDate: '2026-12-03',
    startsAt: '2026-12-03T18:00:00-05:00',
    endsAt: '2026-12-03T19:30:00-05:00',
    timezone: 'America/Detroit',
    promote: true,
    date: 'December 3, 2026',
    month: 'Dec',
    day: '3',
    time: '6:00 PM - 7:30 PM',
    title: 'Disability, Business & Opportunity: A UBLDA Panel',
    shortTitle: 'Disability, Business & Opportunity',
    shortLocation: 'Ross R1210',
    preview:
      'A panel on how businesses hire, lead, and include people with disabilities, and what that means for the careers we are about to start. Free, with food provided.',
    description:
      'A panel on how businesses hire, lead, and include people with disabilities, and what that means for the careers we are about to start. Speakers include Zach Damon, Ann Arbor filmmaker and disability rights advocate, and Aparna Joshi, Professor of Business Administration and Management & Organizations at Michigan Ross. Scott E. Page, John Seely Brown Distinguished University Professor of Complexity, Social Science, and Management, will give opening remarks. More speakers will be announced soon.',
    archiveDescription:
      'UBLDA hosted a panel on how businesses hire, lead, and include people with disabilities, with Zach Damon, Professor Aparna Joshi, and opening remarks from Professor Scott E. Page. Co-sponsored by the U-M Office of Community, Culture and Belonging.',
    formatNote:
      'Free and open to every U-M student, whether or not you have a personal connection to disability. Food provided. Co-sponsored by the U-M Office of Community, Culture and Belonging.',
    location: 'Ross R1210, Ross School of Business',
    rsvpUrl: 'https://forms.gle/FPsfLTchpQ5VecTCA',
  },
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

export const EVENT_BOUNDARIES = events.flatMap(event => [event.startsAt, event.endsAt].flatMap(at => at ? [Date.parse(at)] : []))

/** The next promoted event that has not ended, for the banner and popup. */
export function featuredEvent(now: number, list: ClubEvent[] = events): ClubEvent | undefined {
  return list
    .filter(event => event.promote && event.startsAt && event.endsAt && !isPastEvent(event, now))
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!))[0]
}
