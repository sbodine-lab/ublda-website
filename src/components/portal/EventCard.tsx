/* These portal primitives deliberately export their helper constants and hooks
   alongside the component: splitting one small file into two to satisfy Fast
   Refresh would cost more than the dev-time reload it saves. Same call the
   codebase already makes in src/hooks/useMemberAuth.tsx. */
/* eslint-disable react-refresh/only-export-components */
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { StatusPill } from './StatusPill'
import { IconExternal, IconPlace } from './Icons'
import { googleCalendarUrl } from '../../lib/calendarLinks'
import { ACCESS_COMMITMENT_LABELS } from '../../lib/portalEvents'
import type {
  AccessCommitment,
  ClubEventPublicView,
  CommitmentState,
  RsvpResponse,
} from '../../lib/portalEvents'
import '../../pages/member/Member.css'

/**
 * The member-face event card, shared by Member Home and Member Events (spec §6 T4).
 *
 * Two things on this card are not decoration and must never be dropped:
 *
 *  1. **Times read "7:00 PM Eastern", never a bare "ET."** An abbreviation a
 *     screen reader spells out as two letters is not a time zone, and half the
 *     club is reading this on a phone in a hallway.
 *  2. **Access commitments render in full, including `not-available`.** An
 *     event that cannot provide captions says so on the card the member RSVPs
 *     from. Stating what is missing is the feature; hiding it would make the
 *     card a promise the room cannot keep.
 */

const EASTERN = 'America/Detroit'

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', timeZone: EASTERN,
})
const shortDayFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', timeZone: EASTERN,
})
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: EASTERN })
const dateNumberFormatter = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: EASTERN })
const clockFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', timeZone: EASTERN,
})

const parse = (iso: string) => {
  const ms = Date.parse(iso || '')
  return Number.isNaN(ms) ? null : new Date(ms)
}

/** "Thursday, October 1". '' when the instant is not real. */
export const formatEventDay = (iso: string) => {
  const date = parse(iso)
  return date ? dayFormatter.format(date) : ''
}

/** "Oct 1". Used in dense chip lists. */
export const formatEventDayShort = (iso: string) => {
  const date = parse(iso)
  return date ? shortDayFormatter.format(date) : ''
}

export const formatEventMonth = (iso: string) => {
  const date = parse(iso)
  return date ? monthFormatter.format(date) : ''
}

export const formatEventDateNumber = (iso: string) => {
  const date = parse(iso)
  return date ? dateNumberFormatter.format(date) : ''
}

/**
 * "7:00 PM Eastern" for a single instant, "7:00 PM to 8:00 PM Eastern" for a
 * range. The zone is spelled out once, in full, always.
 */
export const formatEventTime = (startsAt: string, endsAt?: string) => {
  const start = parse(startsAt)
  if (!start) return ''
  const end = parse(endsAt || '')
  const startText = clockFormatter.format(start)
  if (!end || end.getTime() <= start.getTime()) return `${startText} Eastern`
  return `${startText} to ${clockFormatter.format(end)} Eastern`
}

/** "Info session", "Fireside". Never the raw slug. */
export const eventKindLabel = (kind: string) => {
  const words = kind.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const eventFormatLabel = (format: string) => (
  format === 'in-person' ? 'In person' : format === 'virtual' ? 'Virtual' : 'Hybrid'
)

export const isUpcomingEvent = (event: { startsAt: string }, now = Date.now()) => {
  const ms = Date.parse(event.startsAt || '')
  return Number.isNaN(ms) ? true : ms >= now
}

export const byStartAscending = (
  left: { startsAt: string }, right: { startsAt: string },
) => (left.startsAt || '').localeCompare(right.startsAt || '')

export const byStartDescending = (
  left: { startsAt: string }, right: { startsAt: string },
) => (right.startsAt || '').localeCompare(left.startsAt || '')

export const rsvpDeadlinePassed = (event: { rsvpDeadline: string }, now = Date.now()) => {
  const ms = Date.parse(event.rsvpDeadline || '')
  return Number.isNaN(ms) ? false : ms < now
}

/* ── Access commitments ─────────────────────────────────────────────── */

const COMMITMENT_TONE: Record<CommitmentState, 'success' | 'info' | 'neutral'> = {
  confirmed: 'success',
  'on-request': 'info',
  'not-available': 'neutral',
}

/** Plain words. "Not available" is a fact the member is entitled to read. */
const COMMITMENT_WORD: Record<CommitmentState, string> = {
  confirmed: 'Confirmed',
  'on-request': 'On request',
  'not-available': 'Not available',
}

const COMMITMENT_ORDER: CommitmentState[] = ['confirmed', 'on-request', 'not-available']

export type AccessCommitmentListProps = {
  commitments: AccessCommitment[]
  /** Names the list for screen readers: "Access at Fireside chat". */
  labelledBy?: string
  className?: string
}

/**
 * Every commitment the event stated, sorted confirmed → on request → not
 * available. Colour is never the only cue: each row carries the state as a word.
 */
export function AccessCommitmentList({ commitments, labelledBy, className }: AccessCommitmentListProps) {
  if (commitments.length === 0) return null

  const sorted = [...commitments].sort((left, right) => (
    COMMITMENT_ORDER.indexOf(left.state) - COMMITMENT_ORDER.indexOf(right.state)
  ))

  return (
    <ul className={className ? `member-access-list ${className}` : 'member-access-list'} aria-labelledby={labelledBy}>
      {sorted.map((commitment) => (
        <li className="member-access-list__row" key={commitment.id}>
          <span className="member-access-list__label">
            {ACCESS_COMMITMENT_LABELS[commitment.id] || commitment.id}
          </span>
          <StatusPill label={COMMITMENT_WORD[commitment.state]} tone={COMMITMENT_TONE[commitment.state]} />
        </li>
      ))}
    </ul>
  )
}

/* ── RSVP ───────────────────────────────────────────────────────────── */

const RSVP_CHOICES: { response: RsvpResponse; label: string }[] = [
  { response: 'going', label: "I'm going" },
  { response: 'interested', label: 'Interested' },
  { response: 'not-going', label: "Can't make it" },
]

export const rsvpWord = (response: RsvpResponse) => (
  response === 'going' ? "You're going" : response === 'interested' ? "You're interested" : "You can't make it"
)

export type RsvpButtonsProps = {
  /** Stated in each button's accessible name — a row of bare verbs is not a name. */
  eventTitle: string
  current: RsvpResponse | null
  onSelect: (response: RsvpResponse) => void
  /** The response currently being written. Locks the row and says so. */
  pending?: RsvpResponse | null
  disabled?: boolean
  /** Rendered visibly when disabled. Never disable a control without a reason. */
  disabledReason?: string
}

/**
 * Three explicit buttons — never a single toggle. "Interested" and "can't make
 * it" are real answers a member is allowed to give without explaining, and a
 * toggle silently makes one of them mean "I did not answer".
 */
export function RsvpButtons({
  eventTitle, current, onSelect, pending = null, disabled, disabledReason,
}: RsvpButtonsProps) {
  return (
    <div className="member-rsvp">
      <div className="member-rsvp__row" role="group" aria-label={`RSVP for ${eventTitle}`}>
        {RSVP_CHOICES.map((choice) => {
          const selected = current === choice.response
          return (
            <button
              key={choice.response}
              type="button"
              className="p-btn p-btn--target member-rsvp__btn"
              data-selected={selected ? 'true' : undefined}
              aria-pressed={selected}
              disabled={disabled || pending !== null}
              onClick={() => onSelect(choice.response)}
            >
              {pending === choice.response ? 'Saving…' : choice.label}
              <span className="p-visually-hidden">{` — ${eventTitle}`}</span>
            </button>
          )
        })}
      </div>
      {disabled && disabledReason ? <p className="member-rsvp__note">{disabledReason}</p> : null}
      {!disabled && current ? (
        <p className="member-rsvp__note">{`${rsvpWord(current)}.`}</p>
      ) : null}
    </div>
  )
}

/* ── Card ───────────────────────────────────────────────────────────── */

export type EventCardProps = {
  event: ClubEventPublicView
  /** Card titles sit under a section `<h2>`, so 3 is right almost everywhere. */
  headingLevel?: 2 | 3
  /** Links the title to the detail route. */
  to?: string
  /** Past events render the recording, the slides, and whether you were there. */
  past?: boolean
  /** The three RSVP buttons. Omit to render a read-only card. */
  rsvp?: Omit<RsvpButtonsProps, 'eventTitle'>
  /** Slot directly under the RSVP row. The access prompt lives here. */
  footer?: ReactNode
  className?: string
}

export function EventCard({
  event, headingLevel = 3, to, past, rsvp, footer, className,
}: EventCardProps) {
  const Heading = (headingLevel === 2 ? 'h2' : 'h3') as 'h3'
  const cancelled = event.status === 'cancelled'
  const attended = Boolean(event.yourRsvp?.checkedInAt)
  const calendarHref = googleCalendarUrl({
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    details: event.summary,
    location: [event.locationName, event.locationDetail].filter(Boolean).join(' — '),
  })
  const accessHeadingId = `event-access-${event.id}`
  const classes = ['member-card']
  if (past) classes.push('member-card--past')
  if (className) classes.push(className)

  return (
    <article className={classes.join(' ')}>
      <div className="member-card__date" aria-hidden="true">
        <span className="member-card__month">{formatEventMonth(event.startsAt)}</span>
        <span className="member-card__day">{formatEventDateNumber(event.startsAt)}</span>
      </div>

      <div className="member-card__body">
        <div className="p-cluster">
          <StatusPill label={eventKindLabel(event.kind)} tone="accent" />
          <StatusPill label={eventFormatLabel(event.format)} tone="neutral" />
          {cancelled ? <StatusPill label="Cancelled" tone="warn" /> : null}
          {past && attended ? <StatusPill label="You were there" tone="success" /> : null}
          {past && !attended ? <StatusPill label="Not checked in" tone="neutral" /> : null}
        </div>

        <Heading className="member-card__title">
          {to ? <Link className="member-card__titlelink" to={to}>{event.title}</Link> : event.title}
        </Heading>

        <p className="member-card__when">
          <time dateTime={event.startsAt}>{formatEventDay(event.startsAt)}</time>
          {' · '}
          {formatEventTime(event.startsAt, event.endsAt)}
        </p>

        {event.locationName ? (
          <p className="member-card__where">
            <IconPlace size={15} />
            <span>{event.locationName}</span>
          </p>
        ) : null}

        {event.speakerName ? (
          <p className="member-card__speaker">
            {event.speakerName}
            {event.speakerOrg ? `, ${event.speakerOrg}` : ''}
          </p>
        ) : null}

        {event.summary ? <p className="member-card__summary">{event.summary}</p> : null}

        {event.accessCommitments.length > 0 ? (
          <div className="member-card__access">
            <p className="member-card__accesshead" id={accessHeadingId}>What this room can provide</p>
            <AccessCommitmentList commitments={event.accessCommitments} labelledBy={accessHeadingId} />
          </div>
        ) : null}

        {rsvp && !cancelled && !past ? (
          <RsvpButtons {...rsvp} eventTitle={event.title} />
        ) : null}

        {footer}

        <div className="member-card__actions">
          {to ? <Link className="p-btn p-btn--sm" to={to}>{past ? 'Event details' : 'Details and accommodations'}</Link> : null}
          {!past && !cancelled && calendarHref ? (
            <a className="p-btn p-btn--sm" href={calendarHref} target="_blank" rel="noopener noreferrer">
              Add to Google Calendar
              <IconExternal size={14} />
              <span className="p-visually-hidden">{` — ${event.title}, opens in a new tab`}</span>
            </a>
          ) : null}
          {past && event.recordingUrl ? (
            <a className="p-btn p-btn--sm" href={event.recordingUrl} target="_blank" rel="noopener noreferrer">
              Recording
              <IconExternal size={14} />
              <span className="p-visually-hidden">{` for ${event.title}, opens in a new tab`}</span>
            </a>
          ) : null}
          {past && event.slidesUrl ? (
            <a className="p-btn p-btn--sm" href={event.slidesUrl} target="_blank" rel="noopener noreferrer">
              Slides
              <IconExternal size={14} />
              <span className="p-visually-hidden">{` for ${event.title}, opens in a new tab`}</span>
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default EventCard
