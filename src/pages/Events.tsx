import { Link } from 'react-router-dom'
import Reveal from '../components/Reveal'
import './Events.css'

interface Event {
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
}

function buildGCalUrl(event: Event): string {
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

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

const events: Event[] = [
  {
    date: 'April 16, 2026',
    month: 'Apr',
    day: '16',
    time: '6:00 PM - 7:00 PM',
    title: 'Fireside Chat with Lloyd Lewis, CEO of Arc Thrift Stores',
    description:
      'Lloyd runs a 1,600-person, 24-store operation with $2.3B in total economic impact on Colorado and has funded $250M+ to nonprofits supporting people with intellectual and developmental disabilities. He grew employees with IDD from 10 to 350+ under his leadership. Joining us live from Colorado while we gather in person at Ross. Dinner catered — come hungry.',
    location: 'Ross R1240, Ross School of Business',
    rsvpUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSeOzfhOfoWDXJYMY_7H-r_tjrKrZfYBATXSoWnBhzMpcecwSw/viewform',
  },
  {
    date: 'March 11, 2026',
    month: 'Mar',
    day: '11',
    time: '7:00 PM - 8:00 PM',
    title: 'Fireside Chat with Andrew Parker, CEO & Co-Founder of Nestidd',
    description:
      'Andrew Parker (Ross alum) built Nestidd into an 800+ property housing platform for people with intellectual and developmental disabilities. Hear how he did it and why mission-driven business wins. Raising Cane\'s provided.',
    location: 'Ross B0560, Ross School of Business',
    past: true,
  },
  {
    date: 'February 13, 2026',
    month: 'Feb',
    day: '13',
    title: '2nd Annual RossAbilities Conference',
    host: 'Hosted by BLDA (MBA) — UBLDA members attended',
    description:
      'A full day of speakers, panels, and real conversations on disability inclusion and what accessible business actually looks like.',
    location: 'Tauber Colloquium, Ross School of Business',
    past: true,
  },
  {
    date: 'January 17, 2026',
    month: 'Jan',
    day: '17',
    time: '12:00 PM - 2:00 PM',
    title: 'Adaptive Basketball Event',
    host: 'Hosted by BLDA (MBA) — UBLDA members attended',
    description:
      'Wheelchair basketball against the medical school. No experience needed. We ran chair skills and drills before tip-off.',
    location: 'Sports Coliseum, 701 Tappan Street, Ann Arbor, MI 48109',
    past: true,
  },
]

export default function Events() {
  const upcoming = events.filter((e) => !e.past)
  const past = events.filter((e) => e.past)

  return (
    <main id="main-content" className="events-page">
      <section className="events-page__hero">
        <div className="container">
          <Reveal>
            <p className="section__label">Events</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="events-page__headline">
              What we've <em>been up to.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="events-page__intro">
              Speaker series, conferences, and hands-on experiences.
              See what's next and what we've done so far.
            </p>
          </Reveal>
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="section">
          <div className="container">
            <Reveal>
              <h2 className="events-page__section-title">Upcoming</h2>
            </Reveal>
            <div className="events-page__list">
              {upcoming.map((event, i) => (
                <Reveal key={event.title} delay={i * 0.1}>
                  <EventCard event={event} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="container">
          <Reveal>
            <h2 className="events-page__section-title">Past Events</h2>
          </Reveal>
          <div className="events-page__list">
            {past.map((event, i) => (
              <Reveal key={event.title} delay={i * 0.1}>
                <EventCard event={event} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section events-page__cta">
        <div className="container container--narrow" style={{ textAlign: 'center' }}>
          <Reveal>
            <h2 className="events-page__cta-headline">
              Don't miss the next one.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="events-page__cta-sub">
              Members get priority access to all UBLDA events, plus exclusive workshops and networking sessions you won't find on the public calendar.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <Link to="/join" className="btn btn--primary btn--lg">
              Join UBLDA
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          </Reveal>
        </div>
      </section>
    </main>
  )
}

function EventCard({ event }: { event: Event }) {
  return (
    <article className={`ev-card ${event.past ? 'ev-card--past' : ''}`}>
      <div className="ev-card__date-block">
        <span className="ev-card__month">{event.month}</span>
        <span className="ev-card__day">{event.day}</span>
      </div>
      <div className="ev-card__body">
        {event.time && <p className="ev-card__time">{event.time}</p>}
        <h3 className="ev-card__title">{event.title}</h3>
        {event.host && <p className="ev-card__host">Hosted by {event.host}</p>}
        <p className="ev-card__desc">{event.description}</p>
        <div className="ev-card__footer">
          <span className="ev-card__location">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1.5a4.5 4.5 0 0 1 4.5 4.5c0 3.5-4.5 8.5-4.5 8.5S3.5 9.5 3.5 6A4.5 4.5 0 0 1 8 1.5z" stroke="currentColor" strokeWidth="1.2"/><circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/></svg>
            {event.location}
          </span>
          <div className="ev-card__actions">
            {!event.past && event.rsvpUrl && (
              <a
                href={event.rsvpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ev-card__gcal"
              >
                RSVP
              </a>
            )}
            {!event.past && (
              <a
                href={buildGCalUrl(event)}
                target="_blank"
                rel="noopener noreferrer"
                className="ev-card__gcal"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M5 1.5v3M11 1.5v3M2 7h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                Add to Google Calendar
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
