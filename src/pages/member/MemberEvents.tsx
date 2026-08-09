import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PortalPage } from '../../components/portal/PortalShell'
import { PanelHead } from '../../components/portal/PanelHead'
import { EmptyState } from '../../components/portal/EmptyState'
import { usePortalAnnouncer } from '../../components/portal/PortalAnnouncer'
import {
  EventCard,
  byStartAscending,
  byStartDescending,
  isUpcomingEvent,
  rsvpDeadlinePassed,
} from '../../components/portal/EventCard'
import { useMemberAuth } from '../../hooks/useMemberAuth'
import { callPortal } from '../../lib/portalClient'
import type { PortalBootstrap } from '../../lib/portalClient'
import type { ClubEventPublicView, EventRsvpSelfView, RsvpResponse } from '../../lib/portalEvents'
import './Member.css'

/**
 * `/members/events` (spec §6 T4).
 *
 * Two plain lists, upcoming and past. Every card carries the event's access
 * commitments in full — including the `not-available` ones. A member deciding
 * whether they can be in a room should not have to email anyone to find out
 * whether there will be captions.
 *
 * Upcoming and Past are sections, not tabs: both are short, both are worth
 * scanning, and a keyboard user should not have to operate a widget to see the
 * recording of a talk they missed.
 */
export default function MemberEvents() {
  const { sessionToken } = useMemberAuth()
  const { announce, announceUrgent } = usePortalAnnouncer()

  const [bootstrap, setBootstrap] = useState<PortalBootstrap | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [pendingEventId, setPendingEventId] = useState('')
  const [pendingResponse, setPendingResponse] = useState<RsvpResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    callPortal<PortalBootstrap>('portal.bootstrap', sessionToken)
      .then((data) => {
        if (cancelled) return
        setBootstrap(data)
        setLoadError('')
        const upcoming = data.events.filter((event) => isUpcomingEvent(event)).length
        announce(upcoming === 1 ? '1 upcoming event.' : `${upcoming} upcoming events.`)
      })
      .catch((error: Error) => {
        if (cancelled) return
        setLoadError(error.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [announce, sessionToken, reloadKey])

  /** Retrying is an event, not an effect — the skeleton comes back from here. */
  const retry = useCallback(() => {
    setLoading(true)
    setReloadKey((key) => key + 1)
  }, [])

  const events = useMemo(() => bootstrap?.events || [], [bootstrap])
  const upcoming = useMemo(() => (
    events.filter((event) => isUpcomingEvent(event)).sort(byStartAscending)
  ), [events])
  const past = useMemo(() => (
    events.filter((event) => !isUpcomingEvent(event)).sort(byStartDescending)
  ), [events])

  const handleRsvp = useCallback(async (event: ClubEventPublicView, response: RsvpResponse) => {
    setPendingEventId(event.id)
    setPendingResponse(response)

    try {
      const result = await callPortal<{ rsvp: EventRsvpSelfView; event: ClubEventPublicView }>(
        'event.rsvp',
        sessionToken,
        { eventId: event.id, response, guestCount: event.yourRsvp?.guestCount || 0 },
      )
      setBootstrap((previous) => (previous ? {
        ...previous,
        events: previous.events.map((row) => (row.id === result.event.id ? result.event : row)),
      } : previous))
      announce(
        response === 'going' ? `You are going to ${event.title}.`
          : response === 'interested' ? `Marked interested in ${event.title}.`
            : `Marked can't make it for ${event.title}.`,
      )
    } catch (error) {
      announceUrgent((error as Error).message)
    } finally {
      setPendingEventId('')
      setPendingResponse(null)
    }
  }, [announce, announceUrgent, sessionToken])

  if (loading && !bootstrap) {
    return (
      <PortalPage title="Events" lede="What is coming up, and what the room can provide.">
        <div className="member-loading" role="status">
          <span className="p-visually-hidden">Loading events.</span>
          <div className="p-skeleton member-loading__block" />
          <div className="p-skeleton member-loading__block" />
        </div>
      </PortalPage>
    )
  }

  return (
    <PortalPage title="Events" lede="What is coming up, and what the room can provide.">
      {loadError ? (
        <section className="p-panel member-error" aria-labelledby="member-events-error">
          <h2 className="p-panelhead__title" id="member-events-error">Events could not load</h2>
          <p>{loadError}</p>
          <p className="p-btnrow">
            <button type="button" className="p-btn p-btn--primary" onClick={retry}>
              Try again
            </button>
          </p>
        </section>
      ) : null}

      <section className="p-panel" aria-labelledby="member-upcoming-head">
        <PanelHead
          id="member-upcoming-head"
          title="Upcoming"
          description="Every card lists what the room can and cannot provide. Nothing is left off."
          meta={upcoming.length > 0 ? [upcoming.length === 1 ? '1 event' : `${upcoming.length} events`] : undefined}
        />
        {upcoming.length > 0 ? (
          <div className="member-cardlist">
            {upcoming.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                to={`/members/events/${event.id}`}
                rsvp={{
                  current: event.yourRsvp?.response || null,
                  onSelect: (response) => { void handleRsvp(event, response) },
                  pending: pendingEventId === event.id ? pendingResponse : null,
                  disabled: rsvpDeadlinePassed(event),
                  disabledReason: 'RSVPs for this one have closed. The accommodations contact on the detail page can still help.',
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nothing scheduled yet."
            body="Fall programming is being booked now. When a date is confirmed it appears here with the room's access commitments already attached — you should never have to ask whether you can get in."
            action={<Link className="p-btn" to="/members/profile/access">Set your access preferences</Link>}
          />
        )}
      </section>

      <section className="p-panel" aria-labelledby="member-past-head">
        <PanelHead
          id="member-past-head"
          title="Past"
          description="Recordings and slides, where we have them."
          meta={past.length > 0 ? [past.length === 1 ? '1 event' : `${past.length} events`] : undefined}
        />
        {past.length > 0 ? (
          <div className="member-cardlist">
            {past.map((event) => (
              <EventCard key={event.id} event={event} to={`/members/events/${event.id}`} past />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No history here yet."
            body="Once you have been to something, it stays on this list with the recording and slides, and it goes into the record you can download from Home."
          />
        )}
      </section>
    </PortalPage>
  )
}
