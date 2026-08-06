import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PortalPage } from '../../components/portal/PortalShell'
import PanelHead from '../../components/portal/PanelHead'
import EmptyState from '../../components/portal/EmptyState'
import ErrorSummary from '../../components/portal/ErrorSummary'
import StatusPill from '../../components/portal/StatusPill'
import type { StatusTone } from '../../components/portal/StatusPill'
import EventAccessChecklist from '../../components/portal/EventAccessChecklist'
import { usePortalAnnouncer } from '../../components/portal/PortalAnnouncer'
import { IconPlus, IconWarning } from '../../components/portal/Icons'
import { useMemberAuth } from '../../hooks/useMemberAuth'
import { ADMIN_ACCOUNTS, PUBLISH_APPROVERS } from '../../lib/dashboardAccess'
import { callPortal, isAdminBootstrap } from '../../lib/portalClient'
import type { AdminBootstrap, PortalBootstrap } from '../../lib/portalClient'
import {
  ACCESS_COMMITMENT_CATALOG,
  ACCESS_COMMITMENT_LABELS,
  canPublishEvent,
} from '../../lib/portalEvents'
import type {
  AccessCommitment,
  AccessCommitmentId,
  ClubEvent,
  ClubEventKind,
  ClubEventStatus,
  EventRsvp,
  RoomStatus,
} from '../../lib/portalEvents'
import AdminEventEditor from './AdminEventEditor'
import './AdminEvents.css'

/**
 * `/dashboard/events` (spec §6 T2).
 *
 * Two columns. Upcoming events on the left, a computed — never stored —
 * needs-attention list on the right, and under each event the access checklist
 * that turns a member's stated need into a commitment printed on the card they
 * RSVP'd from.
 *
 * Publishing is deliberately two people's job: anyone with the events scope
 * drafts, only a co-president publishes (Doc #54, in software). A non-publisher
 * gets a disabled button with the reason written out and an address to ask at.
 * There is no notification system in this product and this screen does not
 * pretend there is one.
 */

const KIND_LABEL: Record<ClubEventKind, string> = {
  fireside: 'Fireside',
  workshop: 'Workshop',
  social: 'Social',
  tabling: 'Tabling',
  meeting: 'Meeting',
  service: 'Service',
  'info-session': 'Info session',
}

const STATUS_TONE: Record<ClubEventStatus, StatusTone> = {
  draft: 'neutral',
  published: 'accent',
  cancelled: 'danger',
}

const STATUS_WORD: Record<ClubEventStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  cancelled: 'Cancelled',
}

const ROOM_TONE: Record<RoomStatus, StatusTone> = {
  'not-requested': 'warn',
  requested: 'info',
  confirmed: 'success',
}

const ROOM_WORD: Record<RoomStatus, string> = {
  'not-requested': 'Room not requested',
  requested: 'Room requested',
  confirmed: 'Room confirmed',
}

const DAY_MS = 24 * 60 * 60 * 1000

const easternWhen = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Detroit',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** "Wed, Oct 1, 7:00 PM Eastern" — never a bare "ET" (spec §6 T4). */
function easternLabel(iso: string): string {
  if (!iso) return 'Time not set'
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return 'Time not set'
  return `${easternWhen.format(new Date(parsed))} Eastern`
}

const eventsOfficer = ADMIN_ACCOUNTS.find((account) => account.scopes.includes('events') && account.title.startsWith('Events'))
const publisherNames = PUBLISH_APPROVERS
  .map((email) => ADMIN_ACCOUNTS.find((account) => account.email === email)?.name || email)

/** Every field `admin.event.upsert` accepts, so an edit never silently drops one. */
function eventPayload(event: ClubEvent, overrides: Record<string, unknown> = {}) {
  return {
    id: event.id,
    title: event.title,
    summary: event.summary,
    kind: event.kind,
    format: event.format,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    locationName: event.locationName,
    locationDetail: event.locationDetail,
    virtualUrl: event.virtualUrl,
    hostName: event.hostName,
    speakerName: event.speakerName,
    speakerOrg: event.speakerOrg,
    capacity: event.capacity,
    rsvpDeadline: event.rsvpDeadline,
    accessCommitments: event.accessCommitments,
    accommodationsContactEmail: event.accommodationsContactEmail,
    recordingUrl: event.recordingUrl,
    slidesUrl: event.slidesUrl,
    roomStatus: event.roomStatus,
    internalNotes: event.internalNotes,
    ...overrides,
  }
}

const unstatedCommitments = (event: ClubEvent) => ACCESS_COMMITMENT_CATALOG
  .filter((id) => !event.accessCommitments.some((commitment) => commitment.id === id))

const confirmedCount = (event: ClubEvent) => (
  event.accessCommitments.filter((commitment) => commitment.state === 'confirmed').length
)

type AttentionItem = { eventId: string; title: string; reason: string }

/**
 * Computed on every render from the events and RSVPs themselves. Nothing here is
 * stored, so a fixed problem disappears the moment the fix lands (spec §6 T2).
 */
function needsAttention(events: ClubEvent[], rsvps: EventRsvp[], now: number): AttentionItem[] {
  const items: AttentionItem[] = []

  events
    .filter((event) => event.status !== 'cancelled')
    .forEach((event) => {
      const startsAt = Date.parse(event.startsAt)
      const daysOut = Number.isNaN(startsAt) ? Number.POSITIVE_INFINITY : (startsAt - now) / DAY_MS
      const going = rsvps.filter((rsvp) => rsvp.eventId === event.id && rsvp.response === 'going').length
      const push = (reason: string) => { items.push({ eventId: event.id, title: event.title, reason }) }

      if (!event.hostName) push('Nobody is named as running the room.')
      if (event.roomStatus === 'not-requested' && daysOut <= 14 && daysOut >= 0) {
        push('The room has not been requested and it is inside two weeks.')
      }
      if (event.status === 'published' && !event.accommodationsContactEmail) {
        push('Published with no accommodations contact to write to.')
      }
      if (event.capacity > 0 && going > event.capacity) {
        push(`${going} people say they are going and the room holds ${event.capacity}.`)
      }
      if (event.status === 'draft' && event.accessCommitments.length === 0 && daysOut <= 7 && daysOut >= 0) {
        push('A week out and it still does not say what it can provide access-wise.')
      }
    })

  return items
}

export default function AdminEvents() {
  const { sessionToken, canPublish, account } = useMemberAuth()
  const { announce, announceUrgent } = usePortalAnnouncer()

  const [bootstrap, setBootstrap] = useState<AdminBootstrap | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<ClubEvent | null>(null)
  const [blockers, setBlockers] = useState<{ eventId: string; list: string[] } | null>(null)
  const [busyEventId, setBusyEventId] = useState('')
  const [pendingCommitmentId, setPendingCommitmentId] = useState('')
  const [askingPublishFor, setAskingPublishFor] = useState('')

  // React 19 StrictMode double-invokes this in dev; the flag is what keeps the
  // second run from writing state the first run already superseded.
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    callPortal<PortalBootstrap>('portal.bootstrap', sessionToken)
      .then((data) => {
        if (cancelled) return
        if (!isAdminBootstrap(data)) {
          setLoadError('This screen is for officers with the events scope.')
          return
        }
        setBootstrap(data)
        setLoadError('')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadError((error as { message?: string }).message || 'The events list did not load.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [sessionToken, refreshKey])

  const refresh = useCallback(() => { setRefreshKey((key) => key + 1) }, [])

  const events = useMemo(() => bootstrap?.admin.events || [], [bootstrap])
  const rsvps = useMemo(() => bootstrap?.admin.rsvps || [], [bootstrap])
  const eventAccess = useMemo(() => bootstrap?.admin.eventAccess || {}, [bootstrap])

  // Read once per render rather than on a timer: a ticking clock would reshuffle
  // the list under somebody's cursor. All three lists are tens of rows at most.
  const now = Date.now()
  const upcoming = events.filter((event) => {
    const ends = Date.parse(event.endsAt || event.startsAt)
    return Number.isNaN(ends) || ends >= now
  })
  const past = events
    .filter((event) => !upcoming.includes(event))
    .sort((left, right) => (right.startsAt || '').localeCompare(left.startsAt || ''))

  const attention = needsAttention(events, rsvps, now)

  const goingCount = useCallback(
    (eventId: string) => rsvps.filter((rsvp) => rsvp.eventId === eventId && rsvp.response === 'going').length,
    [rsvps],
  )

  const openEditor = (event: ClubEvent | null) => {
    setEditing(event)
    setEditorOpen(true)
    setBlockers(null)
  }

  const closeEditor = (message: string) => {
    setEditorOpen(false)
    setEditing(null)
    announce(message)
    refresh()
  }

  const publish = async (event: ClubEvent) => {
    const gate = canPublishEvent(event)
    const unstated = unstatedCommitments(event)
    const list = [...gate.blockers]

    if (unstated.length > 0) {
      list.push(
        `Answer yes, on request, or no for ${unstated.length === 1 ? 'one more commitment' : `${unstated.length} more commitments`}: ${unstated.map((id) => ACCESS_COMMITMENT_LABELS[id]).join(', ')}.`,
      )
    }

    if (list.length > 0) {
      setBlockers({ eventId: event.id, list })
      announceUrgent(`${event.title} is not ready to publish. ${list.length === 1 ? 'One thing' : `${list.length} things`} to fix.`)
      return
    }

    setBusyEventId(event.id)
    try {
      const result = await callPortal<{ event: ClubEvent }>('admin.event.publish', sessionToken, { eventId: event.id })
      setBlockers(null)
      announce(`Published ${result.event.title}. Members can see it and RSVP now.`)
      refresh()
    } catch (error) {
      const failure = error as { message?: string; blockers?: string[] }
      const serverList = failure.blockers && failure.blockers.length > 0
        ? failure.blockers
        : [failure.message || 'That event did not publish.']
      setBlockers({ eventId: event.id, list: serverList })
      announceUrgent(failure.message || 'That event did not publish.')
    } finally {
      setBusyEventId('')
    }
  }

  /**
   * The one click in "a member states a need → a lead confirms it → the member
   * sees it on the card". The commitment label is safe to announce: it is
   * printed on the public event card. What prompted it never is (spec §7.1).
   */
  const confirmCommitment = async (event: ClubEvent, commitmentId: AccessCommitmentId) => {
    const next: AccessCommitment[] = [
      ...event.accessCommitments.filter((commitment) => commitment.id !== commitmentId),
      { id: commitmentId, state: 'confirmed' },
    ]

    setPendingCommitmentId(commitmentId)
    try {
      await callPortal<{ event: ClubEvent }>(
        'admin.event.upsert',
        sessionToken,
        eventPayload(event, { accessCommitments: next }),
      )
      announce(`${ACCESS_COMMITMENT_LABELS[commitmentId]}: confirmed for ${event.title}.`)
      refresh()
    } catch (error) {
      const failure = error as { message?: string }
      announceUrgent(failure.message || 'That commitment did not save.')
    } finally {
      setPendingCommitmentId('')
    }
  }

  const renderCard = (event: ClubEvent) => {
    const going = goingCount(event.id)
    const confirmed = confirmedCount(event)
    const stated = event.accessCommitments.length
    const cardBlockers = blockers?.eventId === event.id ? blockers.list : []
    const asking = askingPublishFor === event.id

    return (
      <article className="evtcard" key={event.id}>
        <div className="evtcard__head">
          <div className="evtcard__title">
            <h3 className="evtcard__name">{event.title}</h3>
            <p className="evtcard__when">
              <time dateTime={event.startsAt || undefined}>{easternLabel(event.startsAt)}</time>
            </p>
          </div>
          <div className="evtcard__pills">
            <StatusPill label={STATUS_WORD[event.status]} tone={STATUS_TONE[event.status]} />
            <StatusPill label={KIND_LABEL[event.kind]} tone="neutral" glyph="◆" />
          </div>
        </div>

        {event.summary ? <p className="evtcard__summary">{event.summary}</p> : null}

        <dl className="evtcard__facts">
          <div className="evtcard__fact">
            <dt>Running it</dt>
            <dd>{event.hostName || 'Nobody yet'}</dd>
          </div>
          <div className="evtcard__fact">
            <dt>Where</dt>
            <dd>{event.locationName || (event.format === 'virtual' ? 'Online' : 'No room yet')}</dd>
          </div>
          <div className="evtcard__fact">
            <dt>Going</dt>
            <dd className="p-num">{event.capacity > 0 ? `${going} of ${event.capacity}` : String(going)}</dd>
          </div>
          <div className="evtcard__fact">
            <dt>Access answered</dt>
            <dd className="p-num">{`${stated} of ${ACCESS_COMMITMENT_CATALOG.length}, ${confirmed} confirmed`}</dd>
          </div>
        </dl>

        <div className="evtcard__pills">
          <StatusPill label={ROOM_WORD[event.roomStatus]} tone={ROOM_TONE[event.roomStatus]} />
          {stated < ACCESS_COMMITMENT_CATALOG.length ? (
            <StatusPill
              label={`${ACCESS_COMMITMENT_CATALOG.length - stated} access lines unanswered`}
              tone="warn"
            />
          ) : null}
        </div>

        <details className="evtcard__access">
          <summary className="evtcard__summarytoggle">
            Access requests from people coming
          </summary>
          <EventAccessChecklist
            event={event}
            rsvps={rsvps}
            accessViews={eventAccess[event.id] || []}
            pendingCommitmentId={pendingCommitmentId}
            onConfirm={(commitmentId) => { void confirmCommitment(event, commitmentId) }}
          />
        </details>

        {cardBlockers.length > 0 ? (
          <ErrorSummary
            headingLevel={4}
            title={`${event.title} is not ready to publish.`}
            errors={cardBlockers}
          />
        ) : null}

        <div className="p-btnrow evtcard__actions">
          <button type="button" className="p-btn" onClick={() => openEditor(event)}>
            Edit
            <span className="p-visually-hidden">{` ${event.title}`}</span>
          </button>

          {event.status === 'draft' && canPublish ? (
            <button
              type="button"
              className="p-btn p-btn--primary"
              disabled={busyEventId === event.id}
              onClick={() => { void publish(event) }}
            >
              {busyEventId === event.id ? 'Publishing' : 'Publish'}
              <span className="p-visually-hidden">{` ${event.title}`}</span>
            </button>
          ) : null}

          {event.status === 'draft' && !canPublish ? (
            <>
              <button type="button" className="p-btn" disabled>
                Publish
                <span className="p-visually-hidden">{` ${event.title}`}</span>
              </button>
              <button
                type="button"
                className="p-btn p-btn--quiet"
                aria-expanded={asking}
                onClick={() => setAskingPublishFor(asking ? '' : event.id)}
              >
                Ask a co-president
                <span className="p-visually-hidden">{` to publish ${event.title}`}</span>
              </button>
            </>
          ) : null}

          {event.status === 'published' ? (
            <Link className="p-btn" to={`/dashboard/events/${event.id}/check-in`}>
              Check-in
              <span className="p-visually-hidden">{` for ${event.title}`}</span>
            </Link>
          ) : null}
        </div>

        {event.status === 'draft' && !canPublish ? (
          <p className="evtcard__gate">
            A co-president publishes events — {publisherNames.join(' or ')}.
            {asking ? (
              <>
                {' '}The portal does not send messages, so this opens your own mail:{' '}
                <a
                  className="p-link"
                  href={`mailto:${PUBLISH_APPROVERS.join(',')}?subject=${encodeURIComponent(`Ready to publish: ${event.title}`)}`}
                >
                  email both co-presidents about {event.title}
                </a>.
              </>
            ) : null}
          </p>
        ) : null}
      </article>
    )
  }

  if (loading && !bootstrap) {
    return (
      <PortalPage title="Events" lede="Every club event, what it can promise access-wise, and what still needs a room.">
        <section className="p-panel" aria-labelledby="admin-events-loading">
          <PanelHead id="admin-events-loading" title="Loading the calendar" />
          <p className="p-skeleton evtskeleton" />
        </section>
      </PortalPage>
    )
  }

  if (loadError) {
    return (
      <PortalPage title="Events" lede="Every club event, what it can promise access-wise, and what still needs a room.">
        <section className="p-panel" aria-labelledby="admin-events-error">
          <PanelHead id="admin-events-error" title="The calendar did not load" />
          <ErrorSummary headingLevel={3} errors={[loadError]} />
          <div className="p-btnrow">
            <button type="button" className="p-btn p-btn--primary" onClick={refresh}>Try again</button>
          </div>
        </section>
      </PortalPage>
    )
  }

  return (
    <PortalPage
      title="Events"
      lede="Every club event, what it can promise access-wise, and what still needs a room."
      actions={(
        <button type="button" className="p-btn p-btn--primary" onClick={() => openEditor(null)}>
          <IconPlus />
          Draft an event
        </button>
      )}
    >
      <div className="evtlayout">
        <section className="p-panel" aria-labelledby="admin-events-upcoming">
          <PanelHead
            id="admin-events-upcoming"
            title="Upcoming"
            description="Drafts and published events together, so nothing sits half-planned out of sight."
            owner={eventsOfficer?.name}
            meta={[`${upcoming.length} on the calendar`]}
            attention={attention.length > 0
              ? `${attention.length} ${attention.length === 1 ? 'needs' : 'need'} a look`
              : undefined}
          />

          {upcoming.length === 0 ? (
            <EmptyState
              title="Nothing on the calendar yet."
              body="Draft the first fall event here — a room, a time, and a straight answer on each of the eleven access lines. A co-president publishes it and members can RSVP the same afternoon."
              action={(
                <button type="button" className="p-btn p-btn--primary" onClick={() => openEditor(null)}>
                  Draft an event
                </button>
              )}
            />
          ) : (
            <div className="evtlist">{upcoming.map(renderCard)}</div>
          )}
        </section>

        <section className="p-panel evtattention" aria-labelledby="admin-events-attention">
          <PanelHead
            id="admin-events-attention"
            title="Needs attention"
            description="Worked out from the events themselves. Fix the thing and the line disappears."
          />
          {attention.length === 0 ? (
            <EmptyState
              align="left"
              title="Nothing is overdue."
              body="Missing hosts, unrequested rooms inside two weeks, and events that have not said what they can provide all land here."
            />
          ) : (
            <ul className="evtattention__list">
              {attention.map((item, index) => (
                <li className="evtattention__item" key={`${item.eventId}-${index}`}>
                  <span className="evtattention__icon" aria-hidden="true"><IconWarning size={16} /></span>
                  <span className="evtattention__text">
                    <span className="evtattention__title">{item.title}</span>
                    <span className="evtattention__reason">{item.reason}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {past.length > 0 ? (
        <section className="p-panel" aria-labelledby="admin-events-past">
          <PanelHead
            id="admin-events-past"
            title="Already happened"
            description="Add the recording and the slides here — somebody who could not be in the room is waiting on them."
            meta={[`${past.length} past`]}
          />
          <div className="evtlist">{past.map(renderCard)}</div>
        </section>
      ) : null}

      <AdminEventEditor
        open={editorOpen}
        event={editing}
        sessionToken={sessionToken}
        defaultContactEmail={editing?.accommodationsContactEmail || account?.email || ''}
        onClose={() => { setEditorOpen(false); setEditing(null) }}
        onSaved={(_saved, message) => closeEditor(message)}
        onCancelled={(_cancelled, message) => closeEditor(message)}
      />
    </PortalPage>
  )
}
