import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, Check, X } from "lucide-react";
import { buildGCalUrl } from "../../lib/calendarLinks";
import { useClock } from "../../lib/useClock";
import { EVENT_BOUNDARIES, featuredEvent, type ClubEvent } from "../../lib/events";
import {
  bannerVisible,
  markFormOpened,
  markGoing,
  popupMode,
  rsvpParamMatches,
  updateRsvp,
  useRsvpRecord,
} from "../../lib/rsvpStatus";
import "./eventPromo.css";

const INVITE_DELAY_MS = 2500;
const CONFIRM_DELAY_MS = 1200;

/* ---- Time helpers ------------------------------------------------------- */

function useTicker(target: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Seconds only matter in the final hour; otherwise a slow tick is enough.
    const step = target - now < 60 * 60 * 1000 ? 1000 : 15_000;
    const id = window.setTimeout(() => setNow(Date.now()), step);
    return () => window.clearTimeout(id);
  }, [now, target]);
  return now;
}

function countdownParts(ms: number): [number, string][] {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return d > 0 ? [[d, "d"], [h, "h"], [m, "m"]] : [[h, "h"], [m, "m"], [sec, "s"]];
}

function countdownSentence(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `Starts in ${d} ${d === 1 ? "day" : "days"} and ${h} ${h === 1 ? "hour" : "hours"}`;
  if (h > 0) return `Starts in ${h} ${h === 1 ? "hour" : "hours"} and ${m} ${m === 1 ? "minute" : "minutes"}`;
  return `Starts in ${Math.max(1, m)} ${m === 1 ? "minute" : "minutes"}`;
}

/** "Thu, Dec 3" and "6–7:30 PM ET" in the event's own timezone. */
function eventWhen(event: ClubEvent) {
  const timeZone = event.timezone || "America/Detroit";
  const start = new Date(event.startsAt!);
  const end = new Date(event.endsAt!);
  const day = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(start);
  const clock = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(d).replace(":00", "");
  const [a, b] = [clock(start), clock(end)];
  const sameHalf = a.slice(-2) === b.slice(-2);
  const time = `${sameHalf ? a.slice(0, -3) : a}–${b} ET`;
  return { day, time };
}

function calendarUrl(event: ClubEvent) {
  return buildGCalUrl({
    ...event,
    description: [event.description, event.formatNote, event.rsvpUrl ? `RSVP: ${event.rsvpUrl}` : undefined].filter(Boolean).join("\n\n"),
  });
}

/* ---- Site-wide promo ---------------------------------------------------- */

export function EventPromo() {
  const now = useClock(...EVENT_BOUNDARIES);
  const event = featuredEvent(now);
  if (!event) return null;
  return <Promo key={event.id} event={event} />;
}

function Promo({ event }: { event: ClubEvent }) {
  const record = useRsvpRecord(event.id);
  const startsAt = Date.parse(event.startsAt!);
  const endsAt = Date.parse(event.endsAt!);
  const now = useTicker(startsAt);
  const location = useLocation();
  const navigate = useNavigate();
  // "Thanks" card after a visitor confirms, so the change is visible. A visit
  // from the Google Form's confirmation link (ublda.org/?rsvp=done) counts too.
  const [thanks, setThanks] = useState(() => rsvpParamMatches(new URLSearchParams(location.search).get("rsvp"), event.id));

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!rsvpParamMatches(params.get("rsvp"), event.id)) return;
    markGoing(event.id);
    params.delete("rsvp");
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "", hash: location.hash }, { replace: true });
  }, [event.id, location.hash, location.pathname, location.search, navigate]);

  const openForm = () => markFormOpened(event.id);
  const confirm = () => { markGoing(event.id); setThanks(true); };

  return (
    <>
      {bannerVisible(record, endsAt, now) && (
        <CountdownBar event={event} now={now} going={!!record.going} onOpenForm={openForm} onHide={() => updateRsvp(event.id, { bannerHidden: true })} />
      )}
      {thanks ? (
        <ThanksCard event={event} onClose={() => setThanks(false)} />
      ) : (
        <RsvpPopup event={event} mode={popupMode(record, startsAt, now)} onOpenForm={openForm} onConfirm={confirm} />
      )}
    </>
  );
}

/* ---- Countdown banner --------------------------------------------------- */

function CountdownBar({ event, now, going, onOpenForm, onHide }: {
  event: ClubEvent; now: number; going: boolean; onOpenForm: () => void; onHide: () => void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const startsAt = Date.parse(event.startsAt!);
  const live = now >= startsAt;
  const { day, time } = eventWhen(event);

  // Reserve room at the bottom of the page so the bar never covers the footer.
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty("--eq-promo-h", `${el.offsetHeight}px`);
    set();
    const observer = new ResizeObserver(set);
    observer.observe(el);
    return () => { observer.disconnect(); root.style.removeProperty("--eq-promo-h"); };
  }, []);

  return (
    <div className="eq-promo-bar" ref={bar} role="region" aria-label={`${event.shortTitle || event.title} announcement`}>
      <div className="eq-promo-bar-info">
        <Link className="eq-promo-bar-title" to={`/events#${event.id}`}>{event.shortTitle || event.title}</Link>
        <span className="eq-promo-bar-meta">
          {live ? <><span className="eq-promo-live" aria-hidden="true" />Happening now</> : day}
          <span aria-hidden="true"> · </span>{live ? event.shortLocation : time}
          {!live && event.shortLocation && <span className="eq-promo-bar-room"><span aria-hidden="true"> · </span>{event.shortLocation}</span>}
        </span>
      </div>
      {!live && (
        <div className="eq-promo-countdown">
          <span className="eq-sr-only">{countdownSentence(startsAt - now)}</span>
          <span aria-hidden="true">
            {countdownParts(startsAt - now).map(([value, unit]) => (
              <span key={unit} className="eq-promo-unit"><strong>{String(value).padStart(2, "0")}</strong>{unit}</span>
            ))}
          </span>
        </div>
      )}
      <div className="eq-promo-bar-actions">
        {going ? (
          <>
            <span className="eq-promo-going"><Check size={16} aria-hidden="true" />You’re going</span>
            <a className="eq-promo-link" href={calendarUrl(event)} target="_blank" rel="noreferrer">
              Add to calendar<span className="eq-sr-only"> (opens in a new tab)</span>
            </a>
          </>
        ) : event.rsvpUrl && !live ? (
          <a className="eq-promo-rsvp" href={event.rsvpUrl} target="_blank" rel="noreferrer" onClick={onOpenForm}>
            RSVP<ArrowUpRight size={16} aria-hidden="true" /><span className="eq-sr-only"> (form opens in a new tab)</span>
          </a>
        ) : (
          <Link className="eq-promo-link" to={`/events#${event.id}`}>Event details</Link>
        )}
        <button type="button" className="eq-promo-icon" onClick={onHide} aria-label="Hide announcement">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/* ---- Popup -------------------------------------------------------------- */

function RsvpPopup({ event, mode, onOpenForm, onConfirm }: {
  event: ClubEvent; mode: ReturnType<typeof popupMode>; onOpenForm: () => void; onConfirm: () => void;
}) {
  // Each mode waits a beat before appearing, so it never flashes on page load.
  const [readyFor, setReadyFor] = useState<ReturnType<typeof popupMode>>(null);
  // After RSVP is clicked in the popup, the follow-up question replaces it at once,
  // so it is waiting when the visitor comes back from the form's tab.
  const [openedHere, setOpenedHere] = useState(false);
  const counted = useRef(false);
  const card = useRef<HTMLDivElement>(null);
  const { day, time } = eventWhen(event);
  const ready = !!mode && (readyFor === mode || (mode === "confirm" && openedHere));

  useEffect(() => {
    if (!mode || readyFor === mode) return;
    const id = window.setTimeout(() => setReadyFor(mode), mode === "invite" ? INVITE_DELAY_MS : CONFIRM_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [mode, readyFor]);

  // Count one impression per page load, so an ignored invite fades out on its own.
  useEffect(() => {
    if (!ready || mode !== "invite" || counted.current) return;
    counted.current = true;
    updateRsvp(event.id, r => ({ impressions: (r.impressions || 0) + 1 }));
  }, [event.id, mode, ready]);

  const dismiss = () => updateRsvp(event.id, mode === "confirm" ? { notYet: true, popupDismissed: true } : { popupDismissed: true });

  useEffect(() => {
    if (!ready || !mode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Leave Escape to the menu or a profile dialog when one of those is open.
      const focusInside = card.current?.contains(document.activeElement);
      if (!focusInside && document.querySelector("dialog[open], .eq-header--open")) return;
      dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!mode || !ready) return null;

  const openFromPopup = () => { setOpenedHere(true); onOpenForm(); };

  return (
    <div className="eq-promo-popup" ref={card} role="dialog" aria-modal="false" aria-labelledby="eq-promo-title" aria-describedby="eq-promo-body">
      <button type="button" className="eq-promo-icon eq-promo-close" onClick={dismiss} aria-label={mode === "confirm" ? "Not yet, close" : "Close invitation"}>
        <X size={18} aria-hidden="true" />
      </button>
      {mode === "invite" ? (
        <>
          <p className="eq-promo-kicker">{day} · {time}{event.shortLocation && ` · ${event.shortLocation}`}</p>
          <h2 id="eq-promo-title" className="eq-promo-title">{event.shortTitle || event.title}</h2>
          <p id="eq-promo-body" className="eq-promo-body">{event.preview || event.description}</p>
          <div className="eq-promo-actions">
            {event.rsvpUrl && (
              <a className="eq-promo-rsvp" href={event.rsvpUrl} target="_blank" rel="noreferrer" onClick={openFromPopup}>
                RSVP<ArrowUpRight size={16} aria-hidden="true" /><span className="eq-sr-only"> (form opens in a new tab)</span>
              </a>
            )}
            <button type="button" className="eq-promo-text" onClick={onConfirm}>I already RSVP’d</button>
          </div>
        </>
      ) : (
        <>
          <p className="eq-promo-kicker">{event.shortTitle || event.title}</p>
          <h2 id="eq-promo-title" className="eq-promo-title">Did you finish your RSVP?</h2>
          <p id="eq-promo-body" className="eq-promo-body">The form opened in a new tab. Let us know and we’ll stop asking.</p>
          <div className="eq-promo-actions">
            <button type="button" className="eq-promo-rsvp" onClick={onConfirm}>Yes, I’m going</button>
            <button type="button" className="eq-promo-text" onClick={dismiss}>Not yet</button>
          </div>
          {event.rsvpUrl && (
            <a className="eq-promo-again" href={event.rsvpUrl} target="_blank" rel="noreferrer" onClick={openFromPopup}>
              Open the form again<span className="eq-sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </>
      )}
    </div>
  );
}

function ThanksCard({ event, onClose }: { event: ClubEvent; onClose: () => void }) {
  const { day } = eventWhen(event);
  return (
    <div className="eq-promo-popup eq-promo-popup--thanks" role="status">
      <button type="button" className="eq-promo-icon eq-promo-close" onClick={onClose} aria-label="Close">
        <X size={18} aria-hidden="true" />
      </button>
      <p className="eq-promo-kicker"><Check size={16} aria-hidden="true" /> RSVP noted</p>
      <h2 className="eq-promo-title">See you {day.replace(/^\w+, /, "")}.</h2>
      <p className="eq-promo-body">We won’t ask again on this device.</p>
      <div className="eq-promo-actions">
        <a className="eq-promo-rsvp" href={calendarUrl(event)} target="_blank" rel="noreferrer">
          Add to calendar<ArrowUpRight size={16} aria-hidden="true" /><span className="eq-sr-only"> (opens in a new tab)</span>
        </a>
        <button type="button" className="eq-promo-text" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
