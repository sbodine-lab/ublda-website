import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PortalPage } from '../../components/portal/PortalShell'
import { PanelHead } from '../../components/portal/PanelHead'
import { EmptyState } from '../../components/portal/EmptyState'
import { StatusPill } from '../../components/portal/StatusPill'
import { usePortalAnnouncer } from '../../components/portal/PortalAnnouncer'
import {
  EventCard,
  byStartAscending,
  eventKindLabel,
  formatEventDay,
  formatEventDayShort,
  isUpcomingEvent,
  rsvpDeadlinePassed,
} from '../../components/portal/EventCard'
import { IconDownload, IconMail } from '../../components/portal/Icons'
import { useMemberAuth } from '../../hooks/useMemberAuth'
import { callPortal } from '../../lib/portalClient'
import type { PortalBootstrap } from '../../lib/portalClient'
import type { ClubEventPublicView, EventRsvpSelfView, RsvpResponse } from '../../lib/portalEvents'
import type { MemberSelfProfile } from '../../lib/portalMembers'
import './Member.css'

/**
 * `/members/home` — the first authenticated screen (spec §6 T4).
 *
 * This replaces the dead-end "Recruiting dashboard access is limited to UBLDA
 * leads" gate. The first thing a member of a disability-inclusion club sees
 * after signing in cannot be an exclusion notice, so it is now their name, the
 * next room they can be in, and the nine people they can ask for help.
 *
 * Six blocks, in this order, and nothing else:
 *   1 identity · 2 next event · 3 access prompt · 4 announcements
 *   5 your participation · 6 who to ask
 *
 * No completion percentage. No denominator. No streak. No "inactive." For a
 * membership that includes people managing fatigue, flares and inaccessible
 * venues, a denominator is an accusation — counts only, everywhere.
 */

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

const recordFileDate = (iso: string) => {
  const ms = Date.parse(iso || '')
  return Number.isNaN(ms)
    ? ''
    : new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

/**
 * "Download my record" — generated in the browser, résumé-ready, real data only.
 * A member who is asked "what did you do in that club?" should be able to answer
 * without emailing an officer.
 */
const buildRecordMarkdown = (input: {
  profile: MemberSelfProfile
  attended: ClubEventPublicView[]
  generatedAt: string
}) => {
  const name = [input.profile.preferredName || input.profile.firstName, input.profile.lastName]
    .filter(Boolean).join(' ') || input.profile.email
  const lines: string[] = []

  lines.push(`# ${name} — UBLDA`)
  lines.push('')
  lines.push('**University of Michigan Business Leaders for Disability Advancement**')
  lines.push('')

  const facts: string[] = []
  if (input.profile.joinedAt) facts.push(`- Member since ${recordFileDate(input.profile.joinedAt)}`)
  if (input.profile.school) facts.push(`- School: ${input.profile.school}`)
  if (input.profile.major) facts.push(`- Major: ${input.profile.major}`)
  if (input.profile.gradYear) facts.push(`- Class of ${input.profile.gradYear}`)
  if (input.profile.interests.length > 0) {
    facts.push(`- Interests: ${input.profile.interests.map(titleCase).join(', ')}`)
  }
  if (facts.length > 0) {
    lines.push(...facts)
    lines.push('')
  }

  if (input.attended.length > 0) {
    lines.push(`## Events attended (${input.attended.length})`)
    lines.push('')
    input.attended.forEach((event) => {
      const where = event.locationName ? ` · ${event.locationName}` : ''
      lines.push(`- **${event.title}** — ${formatEventDay(event.startsAt)}${where}`)
      if (event.speakerName) {
        lines.push(`  - ${event.speakerName}${event.speakerOrg ? `, ${event.speakerOrg}` : ''}`)
      }
    })
    lines.push('')
  }

  lines.push(`_Generated from the UBLDA member portal on ${recordFileDate(input.generatedAt)}._`)
  lines.push('')

  return lines.join('\n')
}

export default function MemberHome() {
  const { sessionToken, account, signOut } = useMemberAuth()
  const { announce, announceUrgent } = usePortalAnnouncer()
  const navigate = useNavigate()

  const [bootstrap, setBootstrap] = useState<PortalBootstrap | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [rsvpPending, setRsvpPending] = useState<RsvpResponse | null>(null)

  useEffect(() => {
    // React 19 StrictMode double-invokes effects; the flag is what keeps the
    // first, cancelled response from overwriting the second.
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

  const profile = bootstrap?.profile || null
  const events = useMemo(() => bootstrap?.events || [], [bootstrap])

  const nextEvent = useMemo(() => (
    events
      .filter((event) => event.status === 'published' && isUpcomingEvent(event))
      .sort(byStartAscending)[0] || null
  ), [events])

  const attended = useMemo(() => (
    events.filter((event) => Boolean(event.yourRsvp?.checkedInAt)).sort(byStartAscending)
  ), [events])

  const announcements = useMemo(() => (bootstrap?.announcements || []).slice(0, 3), [bootstrap])

  const handleRsvp = useCallback(async (response: RsvpResponse) => {
    if (!nextEvent) return
    setRsvpPending(response)

    try {
      const result = await callPortal<{ rsvp: EventRsvpSelfView; event: ClubEventPublicView }>(
        'event.rsvp',
        sessionToken,
        { eventId: nextEvent.id, response, guestCount: nextEvent.yourRsvp?.guestCount || 0 },
      )
      setBootstrap((previous) => (previous ? {
        ...previous,
        events: previous.events.map((event) => (event.id === result.event.id ? result.event : event)),
      } : previous))
      announce(
        response === 'going' ? `You are going to ${nextEvent.title}.`
          : response === 'interested' ? `Marked interested in ${nextEvent.title}.`
            : `Marked can't make it for ${nextEvent.title}.`,
      )
    } catch (error) {
      announceUrgent((error as Error).message)
    } finally {
      setRsvpPending(null)
    }
  }, [announce, announceUrgent, nextEvent, sessionToken])

  const handleDownloadRecord = useCallback(() => {
    if (!profile) return
    const markdown = buildRecordMarkdown({ profile, attended, generatedAt: new Date().toISOString() })
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ublda-record-${profile.uniqname || 'member'}.md`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    announce('Your UBLDA record downloaded as a Markdown file.')
  }, [announce, attended, profile])

  const handleSignOut = useCallback(() => {
    signOut()
    navigate('/signin', { replace: true })
  }, [navigate, signOut])

  const firstName = profile?.preferredName || profile?.firstName || account?.firstName || ''
  const schoolLine = [profile?.school, profile?.gradYear ? `Class of ${profile.gradYear}` : '']
    .filter(Boolean).join(' · ')

  if (loading && !bootstrap) {
    return (
      <PortalPage title="Home" lede="Your next event, what the club has said lately, and who to ask.">
        <div className="member-loading" role="status">
          <span className="p-visually-hidden">Loading your portal.</span>
          <div className="p-skeleton member-loading__bar" />
          <div className="p-skeleton member-loading__block" />
          <div className="p-skeleton member-loading__block" />
        </div>
      </PortalPage>
    )
  }

  return (
    <PortalPage title="Home" lede="Your next event, what the club has said lately, and who to ask.">
      {loadError ? (
        <section className="p-panel member-error" aria-labelledby="member-home-error">
          <h2 className="p-panelhead__title" id="member-home-error">The portal could not load</h2>
          <p>{loadError}</p>
          <p className="p-btnrow">
            <button type="button" className="p-btn p-btn--primary" onClick={retry}>
              Try again
            </button>
          </p>
        </section>
      ) : null}

      {/* ── 1. Identity ─────────────────────────────────────────────── */}
      <section className="p-panel member-identity" aria-labelledby="member-identity-head">
        <div className="member-identity__text">
          <h2 className="member-identity__name" id="member-identity-head">
            {firstName ? `Hi, ${firstName}.` : 'Welcome in.'}
          </h2>
          {schoolLine ? <p className="member-identity__meta">{schoolLine}</p> : (
            <p className="member-identity__meta">
              <Link className="p-link" to="/members/profile">Add your school and class year</Link>
              {' so event invites and the club roster read right.'}
            </p>
          )}
          {profile?.email ? <p className="p-meta">{profile.email}</p> : null}
        </div>
        <div className="member-identity__actions">
          <Link className="p-btn" to="/members/profile">Edit profile</Link>
          <button type="button" className="p-btn p-btn--quiet" onClick={handleSignOut}>Sign out</button>
        </div>
      </section>

      {/* ── 2. Next event + 3. Access prompt ────────────────────────── */}
      <section className="p-panel" aria-labelledby="member-next-head">
        <PanelHead
          id="member-next-head"
          title="Your next event"
          description="The soonest published event, and what that room can and cannot provide."
        />
        {nextEvent ? (
          <EventCard
            event={nextEvent}
            to={`/members/events/${nextEvent.id}`}
            rsvp={{
              current: nextEvent.yourRsvp?.response || null,
              onSelect: handleRsvp,
              pending: rsvpPending,
              disabled: rsvpDeadlinePassed(nextEvent),
              disabledReason: 'RSVPs for this one have closed. Email the accommodations contact below and we will sort it out.',
            }}
            footer={(
              /* Block 3 sits here on purpose: the RSVP row is the only moment a
                 member is thinking about the room they are about to walk into. */
              <p className="member-prompt">
                <strong>Anything you need to be there?</strong>
                {' Private by default. '}
                <Link className="p-link" to={`/members/events/${nextEvent.id}`}>
                  Add a note for this event
                </Link>
                {' or '}
                <Link className="p-link" to="/members/profile/access">
                  set your access preferences
                </Link>
                .
              </p>
            )}
          />
        ) : (
          <>
            <EmptyState
              title="Nothing on the calendar yet."
              body="The fall speaker series is being booked now. The moment a date is confirmed it lands here first — with the room's access details attached, before you have to ask."
              action={<Link className="p-btn" to="/members/profile/access">Set your access preferences</Link>}
            />
            <p className="member-prompt">
              <strong>Anything you need to be in the room?</strong>
              {' Private by default — you choose, by name, who can read it. '}
              <Link className="p-link" to="/members/profile/access">Tell us once</Link>
              {' and we plan around it.'}
            </p>
          </>
        )}
      </section>

      {/* ── 4. Announcements ────────────────────────────────────────── */}
      <section className="p-panel" aria-labelledby="member-news-head">
        <PanelHead
          id="member-news-head"
          title="From the E-board"
          description="The three most recent announcements."
        />
        {announcements.length > 0 ? (
          <ul className="member-news">
            {announcements.map((announcement) => (
              <li className="member-news__item" key={announcement.id}>
                <div className="p-cluster">
                  {announcement.pinned ? <StatusPill label="Pinned" tone="accent" /> : null}
                  <h3 className="member-news__title">{announcement.title}</h3>
                </div>
                <p className="member-news__meta">
                  {announcement.postedBy}
                  {announcement.publishedAt ? (
                    <>
                      {' · '}
                      <time dateTime={announcement.publishedAt}>{formatEventDay(announcement.publishedAt)}</time>
                    </>
                  ) : null}
                </p>
                <p className="member-news__body">{announcement.body}</p>
                {announcement.ctaLabel && announcement.ctaHref ? (
                  announcement.ctaHref.startsWith('/') ? (
                    <Link className="p-btn p-btn--sm" to={announcement.ctaHref}>{announcement.ctaLabel}</Link>
                  ) : (
                    <a className="p-btn p-btn--sm" href={announcement.ctaHref} target="_blank" rel="noopener noreferrer">
                      {announcement.ctaLabel}
                    </a>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Quiet week."
            body="When there is something to say, it goes here first — before the group chat, and without you having to scroll for it."
          />
        )}
      </section>

      {/* ── 5. Your participation ───────────────────────────────────── */}
      <section className="p-panel" aria-labelledby="member-part-head">
        <PanelHead
          id="member-part-head"
          title="What you have been part of"
          description="Events you were checked in at."
          actions={profile ? (
            <button type="button" className="p-btn" onClick={handleDownloadRecord}>
              <IconDownload size={16} />
              Download my record
            </button>
          ) : undefined}
        />
        {attended.length > 0 ? (
          <>
            <p className="member-count">
              <span className="member-count__figure p-num">{attended.length}</span>
              <span className="member-count__label">
                {attended.length === 1 ? 'event attended' : 'events attended'}
              </span>
            </p>
            <ul className="member-chips">
              {attended.map((event) => (
                <li key={event.id}>
                  <Link className="member-chip" to={`/members/events/${event.id}`}>
                    <span className="member-chip__kind">{eventKindLabel(event.kind)}</span>
                    <span className="member-chip__title">{event.title}</span>
                    <span className="member-chip__when">{formatEventDayShort(event.startsAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState
            title="Nothing here yet — the calendar is the empty part, not you."
            body="Every event you are checked in at shows up here with its date, and you can download the whole thing as a résumé-ready file whenever you need it."
            action={<Link className="p-btn" to="/members/events">See the events list</Link>}
          />
        )}
      </section>

      {/* ── 6. Who to ask ───────────────────────────────────────────── */}
      <section className="p-panel" aria-labelledby="member-officers-head">
        <PanelHead
          id="member-officers-head"
          title="Who to ask"
          description="The E-board, and what each of them actually handles. Email any of them directly."
        />
        <ul className="member-officers">
          {(bootstrap?.officers || []).map((officer) => (
            <li className="member-officer" key={officer.email}>
              <p className="member-officer__name">{officer.name}</p>
              <p className="member-officer__title">{officer.title}</p>
              <p className="member-officer__ask">{officer.askAbout}</p>
              <a className="p-link member-officer__mail" href={`mailto:${officer.email}`}>
                <IconMail size={14} />
                {officer.email}
                <span className="p-visually-hidden">{` — email ${officer.name}`}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </PortalPage>
  )
}
