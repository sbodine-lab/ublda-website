import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PortalPage } from '../../components/portal/PortalShell'
import { usePortalAnnouncer } from '../../components/portal/PortalAnnouncer'
import PanelHead from '../../components/portal/PanelHead'
import StatCard from '../../components/portal/StatCard'
import StatusPill from '../../components/portal/StatusPill'
import EmptyState from '../../components/portal/EmptyState'
import ErrorSummary from '../../components/portal/ErrorSummary'
import { useMemberAuth } from '../../hooks/useMemberAuth'
import { callPortal, isAdminBootstrap } from '../../lib/portalClient'
import type { AdminWorkspace, PortalBootstrap } from '../../lib/portalClient'
import type { StatusTone } from '../../components/portal/StatusPill'
import './AdminOverview.css'

/**
 * `/dashboard/overview` (spec §6 T3).
 *
 * Every figure on this screen is computed from data the portal itself accepts a
 * write for: `memberProfiles`, `clubEvents`, `eventRsvps`, and the recruiting
 * queue. Nothing is mirrored from the Brain, from Drive, or from a Sheet — a
 * screen that owns nothing gets opened twice and then trusted less than the
 * group chat (spec §1.2).
 *
 * The old "Testing accounts" panel is gone. Seeded fixtures were an exec's first
 * paint of their own club; dev scaffolding does not belong on the landing screen.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const HORIZON_DAYS = 14

const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Detroit',
})

/** "Wed, Oct 1, 7:00 PM Eastern" — never a bare "ET" (spec §6 T4). */
const formatEventTime = (iso: string) => {
  const stamp = Date.parse(iso)
  if (!iso || Number.isNaN(stamp)) return 'Date not set'
  return `${dateTimeFormat.format(new Date(stamp))} Eastern`
}

const ROOM_TONE: Record<string, StatusTone> = {
  'not-requested': 'warn',
  requested: 'info',
  confirmed: 'success',
}

const ROOM_LABEL: Record<string, string> = {
  'not-requested': 'Room not requested',
  requested: 'Room requested',
  confirmed: 'Room confirmed',
}

const STATUS_TONE: Record<string, StatusTone> = {
  draft: 'neutral',
  published: 'success',
  cancelled: 'danger',
}

const READINESS_TONE: Record<string, StatusTone> = {
  pass: 'success',
  warn: 'warn',
  fail: 'danger',
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

export default function AdminOverview() {
  const { sessionToken } = useMemberAuth()
  const { announce, announceUrgent } = usePortalAnnouncer()

  const [workspace, setWorkspace] = useState<AdminWorkspace | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [loadedAt, setLoadedAt] = useState('')

  // React 19 StrictMode double-invokes this in dev (spec §10.12).
  useEffect(() => {
    if (!sessionToken) return
    let cancelled = false

    // No setLoadState('loading') here: the initial state is already 'loading', and a
    // synchronous setState in an effect body triggers a cascading render. `refresh()`
    // sets it instead, which is where a reload actually originates.
    callPortal<PortalBootstrap>('portal.bootstrap', sessionToken)
      .then((bootstrap) => {
        if (cancelled) return
        if (!isAdminBootstrap(bootstrap)) {
          setLoadError('This account does not hold an officer role yet.')
          setLoadState('error')
          return
        }
        setWorkspace(bootstrap.admin)
        setLoadedAt(new Date().toISOString())
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : 'The overview did not load.')
        setLoadState('error')
      })

    return () => { cancelled = true }
  }, [reloadKey, sessionToken])

  const refresh = useCallback(() => {
    setLoadState('loading')
    setReloadKey((current) => current + 1)
    announce('Refreshing the overview.')
  }, [announce])

  useEffect(() => {
    if (loadState === 'error' && loadError) announceUrgent(loadError)
  }, [announceUrgent, loadError, loadState])

  const figures = useMemo(() => {
    // Anchored to the load, not to Date.now(): reading the clock during render is impure,
    // so two renders of the same data could disagree on what "the next 14 days" contains.
    const now = Date.parse(loadedAt) || 0
    const horizon = now + HORIZON_DAYS * DAY_MS
    const events = workspace?.events || []
    const rsvps = workspace?.rsvps || []

    const upcoming = events
      .filter((event) => {
        const startsAt = Date.parse(event.startsAt)
        return !Number.isNaN(startsAt) && startsAt >= now && startsAt <= horizon && event.status !== 'cancelled'
      })
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt))

    const upcomingIds = new Set(upcoming.map((event) => event.id))
    const roomsPending = new Set(
      upcoming.filter((event) => event.roomStatus !== 'confirmed').map((event) => event.id),
    )

    return {
      activeMembers: (workspace?.members || []).filter((member) => member.status === 'active').length,
      prospects: (workspace?.members || []).filter((member) => member.status === 'prospect').length,
      publishedSoon: upcoming.filter((event) => event.status === 'published').length,
      upcoming,
      // A person who said yes to a room nobody has booked. This is the number
      // that turns into an apology if it stays above zero.
      rsvpsAwaitingRoom: rsvps.filter((rsvp) => (
        rsvp.response === 'going' && upcomingIds.has(rsvp.eventId) && roomsPending.has(rsvp.eventId)
      )).length,
      unprocessedIntake: workspace?.unprocessedIntake.length || 0,
      // The freshness stamp has to describe the DATA, not the fetch. Stamping the moment we
      // loaded means the panel reads "updated just now" forever, so the one mechanism whose
      // stated job is making staleness visible could never show any.
      lastChangeAt: [...events, ...rsvps]
        .map((row) => ('updatedAt' in row ? row.updatedAt : row.respondedAt) || '')
        .filter(Boolean)
        .sort()
        .pop() || '',
    }
  }, [loadedAt, workspace])

  const pulse = workspace?.recruitingPulse
  const backend = workspace?.backendStatus
  const readiness = workspace?.launchReadiness

  return (
    <PortalPage
      title="Overview"
      lede="What the portal itself knows: members, events, RSVPs, and the recruiting queue."
      actions={
        <button type="button" className="p-btn" onClick={refresh}>
          {loadState === 'loading' ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      {loadState === 'error' ? (
        <ErrorSummary errors={[loadError || 'The overview did not load.']} title="The overview did not load." />
      ) : null}

      <div className="p-statgrid">
        <StatCard
          label="Active members"
          value={loadState === 'ready' ? figures.activeMembers : '—'}
          qualifier="on the roster"
          hint={figures.prospects > 0 ? `${plural(figures.prospects, 'prospect', 'prospects')} alongside them` : 'Admitted through the roster, never guessed'}
          action={<Link className="p-link" to="/dashboard/roster">Open the roster</Link>}
        />
        <StatCard
          label="Published events"
          value={loadState === 'ready' ? figures.publishedSoon : '—'}
          qualifier="next 14 days"
          hint="Members can only RSVP to a published event"
          action={<Link className="p-link" to="/dashboard/events">Open events</Link>}
        />
        <StatCard
          label="RSVPs awaiting a room"
          value={loadState === 'ready' ? figures.rsvpsAwaitingRoom : '—'}
          qualifier="people"
          tone={figures.rsvpsAwaitingRoom > 0 ? 'attention' : 'default'}
          hint={figures.rsvpsAwaitingRoom > 0
            ? 'Somebody said yes to a room that is not booked'
            : 'Every upcoming yes has a confirmed room'}
          action={<Link className="p-link" to="/dashboard/events">Check room status</Link>}
        />
        <StatCard
          label="Unmatched candidates"
          value={loadState === 'ready' ? pulse?.unmatchedCount ?? 0 : '—'}
          qualifier="waiting"
          tone={(pulse?.unmatchedCount || 0) > 0 ? 'attention' : 'default'}
          hint={(pulse?.unmatchedCount || 0) > 0
            ? 'Nobody has an interview time yet'
            : 'Everyone in the queue has a time'}
          action={<Link className="p-link" to="/dashboard/recruiting">Open recruiting</Link>}
        />
      </div>

      <section className="p-panel" aria-labelledby="overview-next-14">
        <PanelHead
          id="overview-next-14"
          title="Next 14 days"
          description="Published and draft events, with the person running each one and where the room stands."
          meta={loadState === 'ready' ? [plural(figures.upcoming.length, 'event', 'events')] : undefined}
          attention={figures.unprocessedIntake > 0 ? `${plural(figures.unprocessedIntake, 'signup', 'signups')} not yet admitted` : undefined}
          updatedAt={figures.lastChangeAt}
        />
        {loadState === 'loading' ? (
          <p className="p-meta">Loading events…</p>
        ) : figures.upcoming.length === 0 ? (
          <EmptyState
            title="Nothing on the calendar in the next two weeks."
            body="The first event of the fall belongs here. Draft it, state what the room can and cannot provide, and a co-president publishes it."
            action={<Link className="p-btn p-btn--primary" to="/dashboard/events">Draft an event</Link>}
          />
        ) : (
          <ul className="overview-list">
            {figures.upcoming.map((event) => {
              const commitments = event.accessCommitments || []
              const confirmed = commitments.filter((entry) => entry.state === 'confirmed').length
              return (
                <li className="overview-row" key={event.id}>
                  <div className="overview-row__text">
                    <Link className="overview-row__title" to="/dashboard/events">{event.title}</Link>
                    <p className="overview-row__meta">
                      <time dateTime={event.startsAt}>{formatEventTime(event.startsAt)}</time>
                      {event.locationName ? ` · ${event.locationName}` : ''}
                      {` · ${event.hostName || 'No one is running this yet'}`}
                    </p>
                    <p className="overview-row__meta">
                      {commitments.length === 0
                        ? 'No access commitments stated yet'
                        : `${confirmed} of ${commitments.length} access commitments confirmed`}
                    </p>
                  </div>
                  <div className="overview-row__pills">
                    <StatusPill
                      label={event.status === 'published' ? 'Published' : event.status === 'draft' ? 'Draft' : 'Cancelled'}
                      tone={STATUS_TONE[event.status] || 'neutral'}
                    />
                    <StatusPill
                      label={ROOM_LABEL[event.roomStatus] || 'Room status unknown'}
                      tone={ROOM_TONE[event.roomStatus] || 'neutral'}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="overview-split">
        <section className="p-panel" aria-labelledby="overview-pulse">
          <PanelHead
            id="overview-pulse"
            title="Recruiting pulse"
            description="Counts from the live interview queue. Open recruiting to act on any of them."
            updatedAt={figures.lastChangeAt}
          />
          {pulse ? (
            <dl className="overview-pulse">
              <div className="overview-pulse__row">
                <dt>Candidates in the queue</dt>
                <dd className="p-num">{pulse.candidateCount}</dd>
              </div>
              <div className="overview-pulse__row">
                <dt>Without an interview time</dt>
                <dd className="p-num">{pulse.unmatchedCount}</dd>
              </div>
              <div className="overview-pulse__row">
                <dt>Slots with no interviewer</dt>
                <dd className="p-num">{pulse.uncoveredSlots}</dd>
              </div>
              <div className="overview-pulse__row">
                <dt>Interviews scheduled</dt>
                <dd className="p-num">{pulse.scheduledCount}</dd>
              </div>
            </dl>
          ) : (
            <p className="p-meta">Loading the recruiting queue…</p>
          )}
          <p className="overview-foot">
            <Link className="p-link" to="/dashboard/recruiting">Open recruiting</Link>
          </p>
        </section>

        <section className="p-panel" aria-labelledby="overview-backend">
          <PanelHead
            id="overview-backend"
            title="Storage and launch readiness"
            description="Where portal data is being written right now, and what is still unconfigured."
            updatedAt={readiness?.generatedAt}
          />
          {backend ? (
            <p className="overview-backend">
              <StatusPill
                label={backend.source === 'vercel' ? 'Vercel Blob' : 'Local preview storage'}
                tone={backend.source === 'vercel' ? 'success' : 'info'}
              />
              <span className="p-meta">{backend.message}</span>
            </p>
          ) : null}
          {readiness ? (
            <ul className="overview-checks">
              {readiness.checks.map((check) => (
                <li className="overview-check" key={check.id}>
                  <StatusPill
                    label={check.label}
                    tone={READINESS_TONE[check.status] || 'neutral'}
                    detail={check.status === 'pass' ? 'ready' : check.status === 'warn' ? 'needs attention' : 'blocking'}
                  />
                  <span className="p-meta">{check.detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-meta">Loading readiness checks…</p>
          )}
        </section>
      </div>
    </PortalPage>
  )
}
