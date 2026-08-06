import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PortalPage } from '../../components/portal/PortalShell'
import { EmptyState } from '../../components/portal/EmptyState'
import { StatusPill } from '../../components/portal/StatusPill'
import { Choice, FieldGroup, SelectField, TextareaField } from '../../components/portal/Field'
import { usePortalAnnouncer } from '../../components/portal/PortalAnnouncer'
import {
  AccessCommitmentList,
  RsvpButtons,
  eventFormatLabel,
  eventKindLabel,
  formatEventDay,
  formatEventTime,
  isUpcomingEvent,
  rsvpDeadlinePassed,
} from '../../components/portal/EventCard'
import { IconExternal } from '../../components/portal/Icons'
import { useMemberAuth } from '../../hooks/useMemberAuth'
import { googleCalendarUrl } from '../../lib/calendarLinks'
import { adminAccountForEmail } from '../../lib/dashboardAccess'
import { ACCESS_LEAD_EMAILS } from '../../lib/portalAccess'
import { callPortal } from '../../lib/portalClient'
import type { PortalBootstrap } from '../../lib/portalClient'
import { RSVP_GUEST_LIMIT, RSVP_NOTE_LIMIT } from '../../lib/portalEvents'
import type { ClubEventPublicView, EventRsvpSelfView, RsvpResponse } from '../../lib/portalEvents'
import './Member.css'

/**
 * `/members/events/:eventId` (spec §6 T4).
 *
 * The per-event accommodation note lives here, and it is the one field on the
 * member face where "who can read this" must be stated in words on the screen,
 * every time, in both states — not in a tooltip and not once at the top. The
 * box is unchecked by default and nothing on this page nudges it.
 *
 * `virtualUrl` is released by the server only when the member's own RSVP is
 * `going`; this page simply renders whatever came back, so there is no second
 * copy of that rule to fall out of sync.
 */

const LEAD_NAMES = ACCESS_LEAD_EMAILS
  .map((email) => adminAccountForEmail(email)?.name || email)
  .join(', ')

const GUEST_OPTIONS = Array.from({ length: RSVP_GUEST_LIMIT + 1 }, (_unused, count) => ({
  value: String(count),
  label: count === 0 ? 'Just me' : count === 1 ? 'Me and 1 guest' : `Me and ${count} guests`,
}))

export default function MemberEventDetail() {
  const { eventId = '' } = useParams()
  const { sessionToken } = useMemberAuth()
  const { announce, announceUrgent } = usePortalAnnouncer()

  const [bootstrap, setBootstrap] = useState<PortalBootstrap | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  const [note, setNote] = useState('')
  const [shareNote, setShareNote] = useState(false)
  const [guestCount, setGuestCount] = useState('0')
  const [noteLoaded, setNoteLoaded] = useState(false)
  const [pendingResponse, setPendingResponse] = useState<RsvpResponse | null>(null)
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => {
    let cancelled = false

    callPortal<PortalBootstrap>('portal.bootstrap', sessionToken)
      .then((data) => {
        if (cancelled) return
        setBootstrap(data)
        setLoadError('')
      })
      .catch((error: Error) => {
        if (cancelled) return
        setLoadError(error.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [sessionToken, reloadKey])

  /** Retrying is an event, not an effect — the skeleton comes back from here. */
  const retry = useCallback(() => {
    setLoading(true)
    setReloadKey((key) => key + 1)
  }, [])

  const event = useMemo(
    () => (bootstrap?.events || []).find((row) => row.id === eventId) || null,
    [bootstrap, eventId],
  )

  // Seed the editable fields once, from the server's copy. Re-seeding on every
  // bootstrap change would wipe whatever the member is part-way through typing.
  useEffect(() => {
    if (noteLoaded || !event) return
    setNote(event.yourRsvp?.accommodationNote || '')
    setShareNote(event.yourRsvp?.shareAccommodationWithLeads === true)
    setGuestCount(String(event.yourRsvp?.guestCount || 0))
    setNoteLoaded(true)
  }, [event, noteLoaded])

  const applyResult = useCallback((result: { event: ClubEventPublicView }) => {
    setBootstrap((previous) => (previous ? {
      ...previous,
      events: previous.events.map((row) => (row.id === result.event.id ? result.event : row)),
    } : previous))
  }, [])

  const writeRsvp = useCallback(async (response: RsvpResponse) => {
    if (!event) return
    const result = await callPortal<{ rsvp: EventRsvpSelfView; event: ClubEventPublicView }>(
      'event.rsvp',
      sessionToken,
      {
        eventId: event.id,
        response,
        guestCount: Number(guestCount) || 0,
        accommodationNote: note,
        shareAccommodationWithLeads: shareNote,
      },
    )
    applyResult(result)
  }, [applyResult, event, guestCount, note, sessionToken, shareNote])

  const handleRsvp = useCallback(async (response: RsvpResponse) => {
    if (!event) return
    setPendingResponse(response)
    try {
      await writeRsvp(response)
      announce(
        response === 'going' ? `You are going to ${event.title}.`
          : response === 'interested' ? `Marked interested in ${event.title}.`
            : `Marked can't make it for ${event.title}.`,
      )
    } catch (error) {
      announceUrgent((error as Error).message)
    } finally {
      setPendingResponse(null)
    }
  }, [announce, announceUrgent, event, writeRsvp])

  const handleSaveNote = useCallback(async () => {
    const response = event?.yourRsvp?.response
    if (!event || !response) return
    setSavingNote(true)
    try {
      await writeRsvp(response)
      // Never announce the content of an access note — it can be read aloud into
      // whatever room the member is standing in. Announce that it saved, only.
      announce('Your note for this event was saved.')
    } catch (error) {
      announceUrgent((error as Error).message)
    } finally {
      setSavingNote(false)
    }
  }, [announce, announceUrgent, event, writeRsvp])

  if (loading && !bootstrap) {
    return (
      <PortalPage title="Event">
        <div className="member-loading" role="status">
          <span className="p-visually-hidden">Loading this event.</span>
          <div className="p-skeleton member-loading__bar" />
          <div className="p-skeleton member-loading__block" />
        </div>
      </PortalPage>
    )
  }

  if (loadError) {
    return (
      <PortalPage title="Event">
        <section className="p-panel member-error" aria-labelledby="member-detail-error">
          <h2 className="p-panelhead__title" id="member-detail-error">This event could not load</h2>
          <p>{loadError}</p>
          <p className="p-btnrow">
            <button type="button" className="p-btn p-btn--primary" onClick={retry}>
              Try again
            </button>
          </p>
        </section>
      </PortalPage>
    )
  }

  if (!event) {
    return (
      <PortalPage title="Event">
        <section className="p-panel">
          <EmptyState
            title="That event is not on your list."
            body="It may have been unpublished, or the link may have been to a draft. The events page has everything that is live right now."
            action={<Link className="p-btn" to="/members/events">Back to events</Link>}
          />
        </section>
      </PortalPage>
    )
  }

  const cancelled = event.status === 'cancelled'
  const past = !isUpcomingEvent(event)
  const deadlinePassed = rsvpDeadlinePassed(event)
  const response = event.yourRsvp?.response || null
  const calendarHref = googleCalendarUrl({
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    details: event.summary,
    location: [event.locationName, event.locationDetail].filter(Boolean).join(' — '),
  })

  return (
    <PortalPage title={event.title}>
      <div className="p-cluster">
        <StatusPill label={eventKindLabel(event.kind)} tone="accent" />
        <StatusPill label={eventFormatLabel(event.format)} tone="neutral" />
        {cancelled ? <StatusPill label="Cancelled" tone="warn" /> : null}
        {past && event.yourRsvp?.checkedInAt ? <StatusPill label="You were there" tone="success" /> : null}
        <Link className="p-link" to="/members/events">All events</Link>
      </div>

      <section className="p-panel" aria-labelledby="member-detail-when">
        <h2 className="p-panelhead__title" id="member-detail-when">When and where</h2>
        <dl className="member-facts">
          <div className="member-facts__row">
            <dt>Date</dt>
            <dd><time dateTime={event.startsAt}>{formatEventDay(event.startsAt)}</time></dd>
          </div>
          <div className="member-facts__row">
            <dt>Time</dt>
            <dd>{formatEventTime(event.startsAt, event.endsAt)}</dd>
          </div>
          {event.locationName ? (
            <div className="member-facts__row">
              <dt>Where</dt>
              <dd>{event.locationName}</dd>
            </div>
          ) : null}
          {event.locationDetail ? (
            <div className="member-facts__row">
              <dt>Getting there</dt>
              <dd>{event.locationDetail}</dd>
            </div>
          ) : null}
          {event.hostName ? (
            <div className="member-facts__row">
              <dt>Run by</dt>
              <dd>{event.hostName}</dd>
            </div>
          ) : null}
          {event.speakerName ? (
            <div className="member-facts__row">
              <dt>Speaker</dt>
              <dd>{event.speakerName}{event.speakerOrg ? `, ${event.speakerOrg}` : ''}</dd>
            </div>
          ) : null}
          {event.rsvpDeadline ? (
            <div className="member-facts__row">
              <dt>RSVP by</dt>
              <dd>
                <time dateTime={event.rsvpDeadline}>{formatEventDay(event.rsvpDeadline)}</time>
              </dd>
            </div>
          ) : null}
        </dl>

        {event.summary ? <p className="member-detail__summary">{event.summary}</p> : null}

        <div className="p-btnrow">
          {!past && !cancelled && calendarHref ? (
            <a className="p-btn" href={calendarHref} target="_blank" rel="noopener noreferrer">
              Add to Google Calendar
              <IconExternal size={14} />
              <span className="p-visually-hidden"> — opens in a new tab</span>
            </a>
          ) : null}
          {event.recordingUrl ? (
            <a className="p-btn" href={event.recordingUrl} target="_blank" rel="noopener noreferrer">
              Recording
              <IconExternal size={14} />
              <span className="p-visually-hidden"> — opens in a new tab</span>
            </a>
          ) : null}
          {event.slidesUrl ? (
            <a className="p-btn" href={event.slidesUrl} target="_blank" rel="noopener noreferrer">
              Slides
              <IconExternal size={14} />
              <span className="p-visually-hidden"> — opens in a new tab</span>
            </a>
          ) : null}
        </div>

        {/* Released by the server only when your own RSVP is 'going'. */}
        {event.virtualUrl ? (
          <p className="member-detail__link">
            <a className="p-link" href={event.virtualUrl} target="_blank" rel="noopener noreferrer">
              Join link for this event
              <span className="p-visually-hidden"> — opens in a new tab</span>
            </a>
            {' — sent to you because you said you are going.'}
          </p>
        ) : null}
      </section>

      <section className="p-panel" aria-labelledby="member-detail-access">
        <h2 className="p-panelhead__title" id="member-detail-access">What this room can provide</h2>
        {event.accessCommitments.length > 0 ? (
          <AccessCommitmentList commitments={event.accessCommitments} labelledBy="member-detail-access" />
        ) : (
          <p>The access details for this room have not been written up yet.</p>
        )}
        {event.accommodationsContactEmail ? (
          <p className="member-detail__contact">
            {'Need something that is not on this list? Email '}
            <a className="p-link" href={`mailto:${event.accommodationsContactEmail}`}>
              {event.accommodationsContactEmail}
            </a>
            {'. Asking is normal here, and it does not have to be early.'}
          </p>
        ) : null}
      </section>

      <section className="p-panel" aria-labelledby="member-detail-rsvp">
        <h2 className="p-panelhead__title" id="member-detail-rsvp">Your RSVP</h2>

        {cancelled ? (
          <p>This event was cancelled, so RSVPs are closed.</p>
        ) : past ? (
          <p>{response ? `You said: ${response === 'going' ? "you're going" : response === 'interested' ? 'interested' : "can't make it"}.` : 'This event has already happened.'}</p>
        ) : (
          <>
            <RsvpButtons
              eventTitle={event.title}
              current={response}
              onSelect={(next) => { void handleRsvp(next) }}
              pending={pendingResponse}
              disabled={deadlinePassed}
              disabledReason="The RSVP deadline for this event has passed. The accommodations contact above can still help."
            />

            <SelectField
              label="Bringing anyone"
              hint="Guests are welcome. Telling us helps with seating and food."
              value={guestCount}
              disabled={deadlinePassed || !response}
              options={GUEST_OPTIONS}
              onChange={(changed) => {
                setGuestCount(changed.currentTarget.value)
              }}
            />

            <div className="member-note">
              <h3 className="member-note__title">Anything you need for this event</h3>
              <TextareaField
                id="member-accommodation-note"
                label="A note for this event"
                hint={`Optional, and specific to this one room. ${RSVP_NOTE_LIMIT} characters or fewer.`}
                rows={3}
                maxLength={RSVP_NOTE_LIMIT}
                showCount
                value={note}
                disabled={deadlinePassed}
                onChange={(changed) => setNote(changed.currentTarget.value)}
              />

              <FieldGroup legend="Who can read this note">
                <Choice
                  type="checkbox"
                  label="Share it with the four E-board leads"
                  note={LEAD_NAMES}
                  checked={shareNote}
                  disabled={deadlinePassed}
                  onChange={(changed) => setShareNote(changed.currentTarget.checked)}
                />
              </FieldGroup>

              {/* Stated in words, in both states, every time. */}
              <p className="member-note__who" data-shared={shareNote ? 'true' : undefined}>
                {shareNote
                  ? `Shared with ${LEAD_NAMES} when they plan this room. Nobody else, and it is left out of every export.`
                  : 'Right now this note is private. Nobody on the E-board can read it, including whoever is planning this room.'}
              </p>

              <div className="p-btnrow">
                <button
                  type="button"
                  className="p-btn p-btn--primary"
                  disabled={savingNote || deadlinePassed || !response}
                  onClick={() => { void handleSaveNote() }}
                >
                  {savingNote ? 'Saving…' : 'Save my note and guest count'}
                </button>
              </div>
              {!response ? (
                <p className="member-note__hint">
                  Choose one of the three answers above first — the note is saved alongside your RSVP.
                </p>
              ) : null}
              <p className="member-note__hint">
                {'Needs that apply to every event belong on your '}
                <Link className="p-link" to="/members/profile/access">access preferences</Link>
                {' page, so you only write them once.'}
              </p>
            </div>
          </>
        )}
      </section>
    </PortalPage>
  )
}
