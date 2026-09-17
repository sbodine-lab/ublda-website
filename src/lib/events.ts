export interface ClubEvent {
  id: string
  isoDate: string
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
    id: 'alli-hirt-microsoft',
    isoDate: '2026-10-01',
    date: 'October 1, 2026',
    month: 'Oct',
    day: '1',
    time: '7:00 PM - 8:00 PM',
    timezone: 'America/Detroit',
    title: 'A conversation with Alli Hirt, Microsoft',
    host: 'UBLDA',
    preview: 'Meet Michigan alum Alli Hirt, Director of Accessibility Engineering at Microsoft, for a conversation about her career and accessibility in everyday products, followed by audience Q&A. Attendance is free.',
    description:
      'Join Michigan alum Alli Hirt, Director of Accessibility Engineering at Microsoft, for a conversation about her career and accessibility in the products people use every day. Two student moderators will lead the discussion, followed by audience Q&A. Attendance is free; RSVP to receive room details the week of the event and submit a question for Alli.',
    formatNote: 'Students gather in person at Ross. Alli joins live by video from Seattle and will not be on campus.',
    location: 'Ross School of Business, 701 Tappan Avenue. Room details emailed the week of the event.',
    rsvpUrl: 'https://docs.google.com/forms/d/e/1FAIpQLScB4BYm2kkqSO5Q9n6j5BrV8Xxtb1k3MZi00plC3HnvRXMeiw/viewform',
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
