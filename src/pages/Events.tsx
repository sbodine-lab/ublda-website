import { MEMBERSHIP_FORM_URL } from '../lib/forms'
import Reveal from '../components/Reveal'
import { buildGCalUrl } from '../lib/calendarLinks'
import './Events.css'

import { events, type ClubEvent } from '../lib/events'

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
              Coming up <em className="headline-accent">at UBLDA.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="events-page__intro">
              Conversations with business leaders and events with the wider
              disability community at Michigan Ross.
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
              Join UBLDA to receive event announcements and registration details.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <a href={MEMBERSHIP_FORM_URL} className="btn btn--primary btn--lg">
              Join UBLDA
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
          </Reveal>
        </div>
      </section>
    </main>
  )
}

function EventCard({ event }: { event: ClubEvent }) {
  return (
    <article className={`ev-card ${event.past ? 'ev-card--past' : ''}`}>
      <div className="ev-card__date-block">
        <span className="ev-card__month">{event.month}</span>
        <span className="ev-card__day">{event.day}</span>
      </div>
      <div className="ev-card__body">
        {event.time && <p className="ev-card__time">{event.date} · {event.time}{event.timezone ? ' ET' : ''}</p>}
        <h3 className="ev-card__title">{event.title}</h3>
        {event.host && <p className="ev-card__host">Hosted by {event.host}</p>}
        <p className="ev-card__desc">{event.description}</p>
        {event.formatNote && <p className="ev-card__format">{event.formatNote}</p>}
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
                className="btn btn--primary"
              >
                RSVP
              </a>
            )}
            {!event.past && (
              <a
                href={buildGCalUrl({ ...event, description: [event.description, event.formatNote, event.rsvpUrl ? `RSVP: ${event.rsvpUrl}` : undefined].filter(Boolean).join('\n\n') })}
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
