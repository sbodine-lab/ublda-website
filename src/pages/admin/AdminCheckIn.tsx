import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PortalPage } from '../../components/portal/PortalShell'
import PanelHead from '../../components/portal/PanelHead'
import EmptyState from '../../components/portal/EmptyState'
import ErrorSummary from '../../components/portal/ErrorSummary'
import StatCard from '../../components/portal/StatCard'
import StatusPill from '../../components/portal/StatusPill'
import type { StatusTone } from '../../components/portal/StatusPill'
import DataTable from '../../components/portal/DataTable'
import type { DataTableColumn } from '../../components/portal/DataTable'
import { Field } from '../../components/portal/Field'
import { usePortalAnnouncer } from '../../components/portal/PortalAnnouncer'
import { useMemberAuth } from '../../hooks/useMemberAuth'
import { callPortal, isAdminBootstrap } from '../../lib/portalClient'
import type { PortalBootstrap } from '../../lib/portalClient'
import type { ClubEvent, EventRsvp, RsvpResponse } from '../../lib/portalEvents'
import type { MemberAdminRow } from '../../lib/portalMembers'
import './AdminCheckIn.css'

/**
 * `/dashboard/events/:eventId/check-in` (spec §6 T2).
 *
 * This screen gets used standing up, in a doorway, one-handed, often by whoever
 * happened to arrive first. So: no modal, no confirmation, no second step. One
 * press marks somebody in, the same press marks them back out, and the running
 * count goes out through the polite live region so it is audible without
 * looking. Targets are 44px in BOTH pointer modes, not only on touch — the
 * mouse-and-keyboard case is somebody balancing a laptop on a table edge.
 *
 * Type-to-filter with Enter checking in the first match is the keyboard path:
 * it means the whole job can be done from the search box without ever leaving
 * it, which is faster than any list of buttons.
 */

const RESPONSE_TONE: Record<RsvpResponse, StatusTone> = {
  going: 'success',
  interested: 'info',
  'not-going': 'neutral',
}

const RESPONSE_WORD: Record<RsvpResponse, string> = {
  going: 'Going',
  interested: 'Interested',
  'not-going': 'Can’t make it',
}

const easternWhen = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Detroit',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const easternClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Detroit',
  hour: 'numeric',
  minute: '2-digit',
})

function easternLabel(iso: string): string {
  if (!iso) return ''
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return ''
  return `${easternWhen.format(new Date(parsed))} Eastern`
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type RosterRow = {
  email: string
  name: string
  response: RsvpResponse
  guestCount: number
  checkedInAt: string
  onTheList: boolean
}

function displayName(email: string, member: MemberAdminRow | undefined): string {
  if (!member) return email
  const first = member.preferredName || member.firstName
  const full = [first, member.lastName].filter(Boolean).join(' ').trim()
  return full || email
}

export default function AdminCheckIn() {
  const { eventId = '' } = useParams()
  const { sessionToken } = useMemberAuth()
  const { announce, announceUrgent } = usePortalAnnouncer()

  const [event, setEvent] = useState<ClubEvent | null>(null)
  const [members, setMembers] = useState<MemberAdminRow[]>([])
  const [rsvps, setRsvps] = useState<EventRsvp[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [missing, setMissing] = useState(false)

  const [query, setQuery] = useState('')
  const [walkIn, setWalkIn] = useState('')
  const [walkInError, setWalkInError] = useState('')
  const [busyEmail, setBusyEmail] = useState('')
  const filterTimer = useRef<number | null>(null)

  // StrictMode runs this twice in dev; the flag keeps the second pass from
  // overwriting state the first already settled.
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
        const found = data.admin.events.find((row) => row.id === eventId) || null
        setEvent(found)
        setMissing(!found)
        setMembers(data.admin.members)
        setRsvps(data.admin.rsvps.filter((rsvp) => rsvp.eventId === eventId))
        setLoadError('')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadError((error as { message?: string }).message || 'The door list did not load.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [sessionToken, eventId])

  useEffect(() => () => {
    if (filterTimer.current !== null) window.clearTimeout(filterTimer.current)
  }, [])

  const memberFor = useCallback(
    (email: string) => members.find((member) => member.email === email),
    [members],
  )

  const rows: RosterRow[] = rsvps
    .map((rsvp) => ({
      email: rsvp.email,
      name: displayName(rsvp.email, memberFor(rsvp.email)),
      response: rsvp.response,
      guestCount: rsvp.guestCount,
      checkedInAt: rsvp.checkedInAt,
      onTheList: rsvp.response === 'going',
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? rows.filter((row) => row.name.toLowerCase().includes(needle) || row.email.includes(needle))
    : rows

  const checkedInCount = rows.filter((row) => Boolean(row.checkedInAt)).length
  const expected = rows.filter((row) => row.onTheList).length

  /** Debounced ≥500ms so a fast typist is not read a count per keystroke. */
  const announceFilter = (value: string) => {
    if (filterTimer.current !== null) window.clearTimeout(filterTimer.current)
    filterTimer.current = window.setTimeout(() => {
      const trimmed = value.trim().toLowerCase()
      if (!trimmed) return
      const count = rows.filter(
        (row) => row.name.toLowerCase().includes(trimmed) || row.email.includes(trimmed),
      ).length
      announce(`${count === 1 ? '1 person matches' : `${count} people match`} ${value.trim()}.`)
    }, 500)
  }

  const setCheckedIn = async (email: string, checkedIn: boolean, name: string) => {
    setBusyEmail(email)
    try {
      const result = await callPortal<{ rsvp: EventRsvp }>('admin.event.checkIn', sessionToken, {
        eventId,
        email,
        checkedIn,
      })

      const next = rsvps.some((rsvp) => rsvp.email === result.rsvp.email)
        ? rsvps.map((rsvp) => (rsvp.email === result.rsvp.email ? result.rsvp : rsvp))
        : [...rsvps, result.rsvp]
      setRsvps(next)

      const total = next.filter((rsvp) => Boolean(rsvp.checkedInAt)).length
      announce(
        checkedIn
          ? `${name} checked in. ${total} checked in.`
          : `${name} is no longer checked in. ${total} checked in.`,
      )
    } catch (error) {
      const failure = error as { message?: string }
      announceUrgent(failure.message || 'That check-in did not save.')
    } finally {
      setBusyEmail('')
    }
  }

  /** Enter in the search box checks in the first match. The whole keyboard path. */
  const handleSearchKeyDown = (key: string) => {
    if (key !== 'Enter') return

    // With an empty box every row "matches", so Enter would check in whoever happens to sort
    // first — and clicking into a search field and hitting Enter before typing is a reflex.
    // There is no confirmation step by design, so the guard has to live here. Attendance is
    // the one number this club records about people; a false positive in it is a fabricated
    // claim that then shows up on that member's own page and in the record they download.
    if (!query.trim()) {
      announce('Type a name first, then press Enter to check that person in.')
      return
    }

    const first = visible[0]
    if (!first) {
      announceUrgent(`Nobody on the list matches ${query.trim()}.`)
      return
    }
    if (first.checkedInAt) {
      announce(`${first.name} is already checked in.`)
      return
    }
    void setCheckedIn(first.email, true, first.name)
  }

  const addWalkIn = async () => {
    const email = walkIn.trim().toLowerCase()
    if (!emailPattern.test(email)) {
      setWalkInError('That does not look like an email address.')
      return
    }
    setWalkInError('')
    await setCheckedIn(email, true, email)
    setWalkIn('')
  }

  const columns: DataTableColumn<RosterRow>[] = [
    {
      id: 'name',
      header: 'Name',
      isRowHeader: true,
      sortValue: (row) => row.name,
      cell: (row) => (
        <span className="chk-name">
          <span>{row.name}</span>
          {row.name !== row.email ? <span className="p-meta">{row.email}</span> : null}
        </span>
      ),
    },
    {
      id: 'response',
      header: 'RSVP',
      sortValue: (row) => row.response,
      cell: (row) => <StatusPill label={RESPONSE_WORD[row.response]} tone={RESPONSE_TONE[row.response]} />,
    },
    {
      id: 'guests',
      header: 'Guests',
      align: 'end',
      sortValue: (row) => row.guestCount,
      cell: (row) => <span className="p-num">{row.guestCount}</span>,
    },
    {
      id: 'checkedIn',
      header: 'Checked in',
      sortValue: (row) => row.checkedInAt || '',
      cell: (row) => (row.checkedInAt ? (
        <time className="p-num" dateTime={row.checkedInAt}>
          {easternClock.format(new Date(row.checkedInAt))}
        </time>
      ) : (
        <span className="p-muted">Not yet</span>
      )),
    },
  ]

  if (loading && !event && !loadError) {
    return (
      <PortalPage title="Check-in" lede="One action per person, at the door, with nothing in the way.">
        <section className="p-panel" aria-labelledby="chk-loading">
          <PanelHead id="chk-loading" title="Loading the door list" />
          <p className="p-skeleton chk-skeleton" />
        </section>
      </PortalPage>
    )
  }

  if (loadError) {
    return (
      <PortalPage title="Check-in" lede="One action per person, at the door, with nothing in the way.">
        <section className="p-panel" aria-labelledby="chk-error">
          <PanelHead id="chk-error" title="The door list did not load" />
          <ErrorSummary headingLevel={3} errors={[loadError]} />
          <div className="p-btnrow">
            <Link className="p-btn" to="/dashboard/events">Back to events</Link>
          </div>
        </section>
      </PortalPage>
    )
  }

  if (missing || !event) {
    return (
      <PortalPage title="Check-in" lede="One action per person, at the door, with nothing in the way.">
        <section className="p-panel" aria-labelledby="chk-missing">
          <PanelHead id="chk-missing" title="Door list" />
          <EmptyState
            title="That event is not on the calendar."
            body="It may have been drafted under a different name, or the link is older than the event. The events screen has everything that exists."
            action={<Link className="p-btn p-btn--primary" to="/dashboard/events">Go to events</Link>}
          />
        </section>
      </PortalPage>
    )
  }

  return (
    <PortalPage
      title="Check-in"
      lede={`${event.title} · ${easternLabel(event.startsAt)}${event.locationName ? ` · ${event.locationName}` : ''}`}
      actions={<Link className="p-btn" to="/dashboard/events">Back to events</Link>}
    >
      <div className="p-statgrid">
        <StatCard label="Checked in" value={checkedInCount} qualifier="here" />
        <StatCard label="Said they are going" value={expected} qualifier="expected" />
        <StatCard
          label="On the list"
          value={rows.length}
          qualifier="responses"
          hint="Anyone who answered, whichever way they answered."
        />
      </div>

      <section className="p-panel" aria-labelledby="chk-roster">
        <PanelHead
          id="chk-roster"
          title="Door list"
          description="Type a name and press Enter to check in the first match. Press the same button again to undo it."
          owner={event.hostName || undefined}
          meta={[`${checkedInCount} checked in`]}
        />

        <div className="chk-controls">
          <Field
            id="chk-search"
            className="chk-search"
            label="Find somebody"
            type="search"
            autoComplete="off"
            hint="Enter checks in the first match."
            value={query}
            onChange={(e) => { setQuery(e.target.value); announceFilter(e.target.value) }}
            onKeyDown={(e) => handleSearchKeyDown(e.key)}
          />
        </div>

        <DataTable
          className="chk-roster"
          caption={`Everyone who responded to ${event.title}, with a check-in control for each.`}
          columns={columns}
          rows={visible}
          rowKey={(row) => row.email}
          defaultSort={{ columnId: 'name', direction: 'ascending' }}
          rowActionsHeader="Check-in"
          rowActions={(row) => (
            <button
              type="button"
              className={row.checkedInAt ? 'p-btn p-btn--target' : 'p-btn p-btn--primary p-btn--target'}
              disabled={busyEmail === row.email}
              onClick={() => { void setCheckedIn(row.email, !row.checkedInAt, row.name) }}
            >
              {/* The name states the target, and the undo state says what it undoes. */}
              {row.checkedInAt ? 'Undo' : 'Check in'}
              <span className="p-visually-hidden">
                {row.checkedInAt ? ` check-in for ${row.name}` : ` ${row.name}`}
              </span>
            </button>
          )}
          empty={needle ? (
            <EmptyState
              align="left"
              title={`Nobody matches “${query.trim()}”.`}
              body="Try a shorter piece of the name, or add them as a walk-in below — that works whether or not they ever RSVP'd."
            />
          ) : (
            <EmptyState
              align="left"
              title="Nobody has RSVP'd yet."
              body="The door still works. Add anyone who turns up as a walk-in and they land on the roster with the rest."
            />
          )}
        />
      </section>

      <section className="p-panel" aria-labelledby="chk-walkin">
        <PanelHead
          id="chk-walkin"
          title="Add a walk-in"
          description="Somebody who turned up without RSVPing. This creates their row and checks them in at the same time."
        />
        <div className="chk-walkin">
          <Field
            id="chk-walkin-email"
            className="chk-walkin__field"
            label="Their umich email"
            type="email"
            autoComplete="off"
            inputMode="email"
            error={walkInError || undefined}
            hint="Use the address they would sign in with, so tonight counts towards their record."
            value={walkIn}
            onChange={(e) => { setWalkIn(e.target.value); setWalkInError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addWalkIn() } }}
          />
          <button
            type="button"
            className="p-btn p-btn--primary p-btn--target chk-walkin__submit"
            disabled={busyEmail === walkIn.trim().toLowerCase() && Boolean(walkIn)}
            onClick={() => { void addWalkIn() }}
          >
            Add walk-in
          </button>
        </div>
      </section>
    </PortalPage>
  )
}
