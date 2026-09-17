import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowDown, ArrowUpRight, Plus } from "lucide-react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MEMBERSHIP_FORM_URL } from "../../lib/forms";
import { useClock } from "../../lib/useClock";
import { buildGCalUrl } from "../../lib/calendarLinks";
import { events, EVENT_BOUNDARIES, isPastEvent, type ClubEvent } from "../../lib/events";

function EventDate({ event }: { event: ClubEvent }) {
  return (
    <time className="eq-event-poster" dateTime={event.isoDate}>
      <span className="eq-sr-only">{event.date}</span>
      <span className="eq-event-poster-top" aria-hidden="true">
        <span className="eq-event-month-long">{event.date.split(" ")[0]}</span>
        <span className="eq-event-month-short">{event.month}</span>
        <span>{event.isoDate.slice(0, 4)}</span>
      </span>
      <strong aria-hidden="true" data-reveal>{event.day.padStart(2, "0")}</strong>
      <span className="eq-event-poster-bottom" aria-hidden="true">
        {new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(new Date(event.isoDate))}
      </span>
    </time>
  );
}

function UpcomingEvent({ event, preview }: { event: ClubEvent; preview: boolean }) {
  return (
    <article className="eq-event-feature" id={preview ? undefined : event.id} aria-labelledby={`${preview ? "preview-" : ""}${event.id}-title`}>
      <EventDate event={event} />
      <div className="eq-event-feature-copy">
        <h3 id={`${preview ? "preview-" : ""}${event.id}-title`} data-reveal>{event.title}</h3>
        {event.time && <p className="eq-event-hours">{event.time.replace(" - ", " – ")}{event.timezone && " ET"}</p>}
        <p>{preview ? event.preview || event.description : event.description}</p>
        {event.formatNote && <p className="eq-event-format-note">{event.formatNote}</p>}
        {!preview && <p className="eq-event-location">{event.location}</p>}
        <div className="eq-event-actions">
          {event.rsvpUrl && <a className="eq-button" href={event.rsvpUrl}>RSVP<ArrowUpRight size={18} aria-hidden="true" /></a>}
          {preview ? (
            <Link className="eq-text-link" to={`/events#${event.id}`}>Event details<ArrowUpRight size={18} aria-hidden="true" /></Link>
          ) : (
            <a className="eq-text-link" href={buildGCalUrl({ ...event, description: [event.description, event.formatNote, event.rsvpUrl ? `RSVP: ${event.rsvpUrl}` : undefined].filter(Boolean).join("\n\n") })} target="_blank" rel="noreferrer">
              Add to calendar<ArrowUpRight size={18} aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function EventRecap({ event, preview }: { event: ClubEvent; preview: boolean }) {
  const { hash, key: locationKey } = useLocation();
  const detail = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!preview && hash === `#${event.id}` && detail.current) detail.current.open = true;
  }, [event.id, hash, preview, locationKey]);
  return (
    <details className="eq-event-recap" ref={detail} id={preview ? undefined : event.id} onToggle={() => ScrollTrigger.refresh(true)}>
      <summary>
        <time dateTime={event.isoDate}>{event.date}</time>
        <div className="eq-event-recap-heading">
          <h3>{event.title}</h3>
          {event.host && <span>Hosted by {event.host}</span>}
        </div>
        <span className="eq-event-expand" aria-hidden="true"><Plus /></span>
      </summary>
      <div className="eq-event-recap-copy">
        <p>{event.archiveDescription || event.description}</p>
        <p className="eq-event-location">{event.location}{event.time && <><br />{event.time.replace(" - ", " – ")} ET</>}</p>
      </div>
    </details>
  );
}

export function UpcomingEvents({ preview = false }: { preview?: boolean }) {
  const now = useClock(...EVENT_BOUNDARIES);
  const upcoming = events.filter(event => !isPastEvent(event, now)).sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  return (
    <section className="eq-section eq-upcoming-events" id={preview ? "events" : "upcoming-events"} data-tone={preview ? "teal" : "cream"} aria-labelledby="upcoming-events-title">
      <div className="eq-events-heading">
        <h2 id="upcoming-events-title" data-reveal>Upcoming<br />events.</h2>
        {preview ? <Link className="eq-text-link" to="/events">All events<ArrowUpRight size={22} aria-hidden="true" /></Link> : <Link className="eq-text-link" to="#past-events">Explore past events<ArrowDown size={22} aria-hidden="true" /></Link>}
      </div>
      {upcoming.map(event => <UpcomingEvent key={event.id} event={event} preview={preview} />)}
      {!upcoming.length && <div className="eq-events-empty"><p>We’re planning what’s next. Join UBLDA to hear when new events are announced.</p><a className="eq-button" href={MEMBERSHIP_FORM_URL}>Join UBLDA<ArrowUpRight size={18} aria-hidden="true" /></a></div>}
    </section>
  );
}

export function PastEvents({ preview = false }: { preview?: boolean }) {
  const now = useClock(...EVENT_BOUNDARIES);
  const past = events.filter(event => isPastEvent(event, now)).sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  return (
    <section className={`eq-section eq-event-archive${preview ? " eq-event-archive--preview" : ""}`} id={preview ? "recent-events" : "past-events"} data-tone="gold" aria-labelledby="past-events-title">
      <div className="eq-events-heading">
        <h2 id="past-events-title" data-reveal>{preview ? <>Previously<br />at UBLDA.</> : <>Past events.<br />Shared experiences.</>}</h2>
        {preview && <Link className="eq-text-link" to="/events#past-events">View all past events<ArrowUpRight size={22} aria-hidden="true" /></Link>}
      </div>
      {(preview ? past.slice(0, 2) : past).map(event => <EventRecap key={event.id} event={event} preview={preview} />)}
    </section>
  );
}
