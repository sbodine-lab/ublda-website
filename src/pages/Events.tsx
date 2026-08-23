import { Link } from 'react-router-dom'
import { buildGCalUrl } from '../lib/calendarLinks'
import './Events.css'

interface Event {
  /** "September 2, 2026" */
  date: string
  /** ISO date for <time dateTime>, e.g. "2026-09-02" */
  iso: string
  /** Optional second day for multi-day listings, e.g. "2026-09-09" */
  isoEnd?: string
  /** Display date when it differs from `date`, e.g. "Sept 8–9, 2026" */
  dateLabel?: string
  time?: string
  title: string
  host?: string
  description: string
  location: string
  past?: boolean
  rsvpUrl?: string
  link?: { href: string; label: string }
}

const events: Event[] = [
  {
    date: 'September 2, 2026',
    iso: '2026-09-02',
    time: '3:00 PM - 8:00 PM',
    title: 'Festifall Central',
    host: 'Center for Campus Involvement',
    description:
      'The all-campus student organization fair. Come find the UBLDA table, meet the e-board, and sign up in person. Sessions run 3–5 PM and 6–8 PM.',
    location: 'The Diag, Central Campus',
    link: { href: 'https://campusinvolvement.umich.edu/attending-festifall', label: 'Festifall details' },
  },
  {
    date: 'September 8, 2026',
    iso: '2026-09-08',
    isoEnd: '2026-09-09',
    dateLabel: 'September 8–9, 2026',
    time: '5:30 PM - 7:30 PM',
    title: 'BBA Meet the Clubs',
    host: 'Ross BBA Program',
    description:
      'The Ross club fair that opens fall recruiting. Stop by our table to hear about general membership, the speaker series, and UBLDA Advisory, our consulting program.',
    location: 'Ross School of Business',
  },
  {
    date: 'April 16, 2026',
    iso: '2026-04-16',
    time: '6:00 PM - 7:00 PM',
    title: 'Fireside Chat with Lloyd Lewis, CEO of Arc Thrift Stores',
    description:
      'Lloyd runs a 1,600-person, 24-store operation with $2.3B in total economic impact on Colorado and has funded $250M+ to nonprofits supporting people with intellectual and developmental disabilities. He grew employees with IDD from 10 to 350+ under his leadership. Joined us live from Colorado while we gathered in person at Ross.',
    location: 'Ross R1240, Ross School of Business',
    past: true,
  },
  {
    date: 'March 11, 2026',
    iso: '2026-03-11',
    time: '7:00 PM - 8:00 PM',
    title: 'Fireside Chat with Andrew Parker, CEO & Co-Founder of Nestidd',
    description:
      'Andrew Parker (Ross alum) built Nestidd into an 800+ property housing platform for people with intellectual and developmental disabilities. How he did it and why mission-driven business wins.',
    location: 'Ross B0560, Ross School of Business',
    past: true,
  },
  {
    date: 'February 13, 2026',
    iso: '2026-02-13',
    title: '2nd Annual RossAbilities Conference',
    host: 'BLDA (MBA). UBLDA members attended.',
    description:
      'A full day of speakers, panels, and real conversations on disability inclusion and what accessible business actually looks like.',
    location: 'Tauber Colloquium, Ross School of Business',
    past: true,
  },
  {
    date: 'January 17, 2026',
    iso: '2026-01-17',
    time: '12:00 PM - 2:00 PM',
    title: 'Adaptive Basketball Event',
    host: 'BLDA (MBA). UBLDA members attended.',
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
          <h1 className="events-page__headline">Events</h1>
          <p className="events-page__intro">
            Speaker series, conferences, and hands-on experiences. Everything is open
            to the campus community unless noted.
          </p>
        </div>
      </section>

      <section className="events-page__section">
        <div className="container">
          <h2 className="events-page__section-title">Upcoming</h2>
          {upcoming.length > 0 ? (
            <div className="ev-table" role="list">
              {upcoming.map((event) => (
                <EventRow key={event.title} event={event} />
              ))}
            </div>
          ) : (
            <p className="events-page__empty">
              Nothing scheduled right now. Members hear about new events first, so{' '}
              <Link to="/join" className="events-page__inline-link">join the mailing list</Link>.
            </p>
          )}
        </div>
      </section>

      <section className="events-page__section">
        <div className="container">
          <h2 className="events-page__section-title">Past events</h2>
          <div className="ev-table ev-table--past" role="list">
            {past.map((event) => (
              <EventRow key={event.title} event={event} />
            ))}
          </div>
        </div>
      </section>

      <section className="events-page__cta">
        <div className="container">
          <div className="events-page__cta-layout">
            <div>
              <h2 className="events-page__cta-headline">Don't miss the next one.</h2>
              <p className="events-page__cta-sub">
                Members get priority access to all UBLDA events, plus workshops and
                networking sessions that don't go on the public calendar.
              </p>
            </div>
            <Link to="/join" className="btn btn--primary btn--lg">
              Join UBLDA
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

function EventRow({ event }: { event: Event }) {
  const [weekday, monthDay, year] = formatDate(event.iso)
  const weekdayLabel = event.isoEnd
    ? `${weekday.slice(0, 3)}–${formatDate(event.isoEnd)[0].slice(0, 3)}`
    : weekday
  return (
    <article className="ev-row" role="listitem">
      <div className="ev-row__date">
        <time dateTime={event.isoEnd ? `${event.iso}/${event.isoEnd}` : event.iso}>
          <span className="ev-row__weekday">{weekdayLabel}</span>
          <span className="ev-row__day">{event.dateLabel ? event.dateLabel.replace(`, ${year}`, '') : monthDay}</span>
          <span className="ev-row__year">{year}</span>
        </time>
      </div>

      <div className="ev-row__body">
        <h3 className="ev-row__title">{event.title}</h3>
        {event.host && <p className="ev-row__host">Hosted by {event.host}</p>}
        <p className="ev-row__desc">{event.description}</p>
        {!event.past && (
          <div className="ev-row__actions">
            {event.rsvpUrl && (
              <a href={event.rsvpUrl} target="_blank" rel="noopener noreferrer" className="ev-row__action ev-row__action--primary">
                RSVP
              </a>
            )}
            <a href={buildGCalUrl(event)} target="_blank" rel="noopener noreferrer" className="ev-row__action">
              Add to Google Calendar
            </a>
            {event.link && (
              <a href={event.link.href} target="_blank" rel="noopener noreferrer" className="ev-row__action">
                {event.link.label}
              </a>
            )}
          </div>
        )}
      </div>

      <dl className="ev-row__meta">
        {event.time && (
          <div className="ev-row__meta-item">
            <dt>Time</dt>
            <dd>{event.time.replace(' - ', '–')}</dd>
          </div>
        )}
        <div className="ev-row__meta-item">
          <dt>Location</dt>
          <dd>{event.location}</dd>
        </div>
      </dl>
    </article>
  )
}

/** "2026-09-02" → ["Wednesday", "September 2", "2026"]. Parsed as local time so the weekday doesn't shift. */
function formatDate(iso: string): [string, string, string] {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' })
  const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  return [weekday, monthDay, String(y)]
}
