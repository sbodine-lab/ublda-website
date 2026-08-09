import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PortalPage } from '../../components/portal/PortalShell'
import { usePortalAnnouncer } from '../../components/portal/PortalAnnouncer'
import { useMemberAuth } from '../../hooks/useMemberAuth'
import {
  DASHBOARD_DATA_CHANGED_EVENT,
  DASHBOARD_DATA_CHANGED_STORAGE_KEY,
  readDashboardData,
} from '../../lib/dashboardData'
import type { DashboardCalendarEvent, DashboardData } from '../../lib/dashboardData'
import type { Candidate } from '../../lib/memberData'
import {
  INTERVIEW_STATUS_OPTIONS,
  INTERVIEW_SLOTS,
  INTERVIEW_WINDOW_DAYS,
  getInterviewSlotByValue,
  sortSlotValues,
} from '../../lib/interviews'
import { matchOpenInterviewSlate } from '../../lib/interviewMatching'
import { callPortal } from '../../lib/portalClient'
import type { MemberAdminRow } from '../../lib/portalMembers'
import '../Dashboard.css'

/**
 * The recruiting screen, re-hosted inside the portal shell (spec §6 T3).
 *
 * This is a PORT, not a rewrite. The candidate queue, `matchOpenInterviewSlate`
 * auto-match, `saveAssignment` → `/api/interview-assignment`, the resume panel,
 * the `INTERVIEW_WINDOW_DAYS` calendar, interviewer coverage and the scheduled
 * list are the same code and the same 2,782 lines of tested CSS they were in
 * `Dashboard.tsx`. Rewriting working, tested recruiting UI during Festifall
 * season would be pure risk with zero user benefit (spec §1.2).
 *
 * What changed, and only this:
 *  · the page's own sidebar / topbar / account menu are gone — `AdminShell`
 *    supplies them, and with them went the literal `<i>v</i>` chevron that a
 *    screen reader announced as the letter "v" (spec §7.1);
 *  · the local toast became the shell's polite live region;
 *  · every icon-only or ambiguous control now names its target;
 *  · two additions: `Export CSV` and `Convert to member`.
 */

const statusClass = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/**
 * Landmine §10.8, carried across unchanged: this heuristic matches "test" in a
 * real person's program or feedback text. It only sorts, never hides, and it is
 * deliberately NOT extended into anything the portal owns.
 */
const isTestingCandidate = (candidate: Candidate) => (
  /test|placeholder|preserved|low-demand/i.test(`${candidate.id} ${candidate.email} ${candidate.program} ${candidate.feedback}`)
)

const sortCandidatesForDashboard = (candidates: Candidate[]) => (
  [...candidates].sort((left, right) => {
    const leftRank = isTestingCandidate(left) ? 1 : 0
    const rightRank = isTestingCandidate(right) ? 1 : 0
    if (leftRank !== rightRank) return leftRank - rightRank
    return left.name.localeCompare(right.name)
  })
)

const slotLabel = (value: string) => {
  const slot = getInterviewSlotByValue(value)
  return slot ? slot.label : value || 'Unassigned'
}

const timeOnly = (value: string) => {
  const slot = getInterviewSlotByValue(value)
  return slot ? slot.timeLabel.replace(' ET', '') : 'Open'
}

const formatMinutes = (totalMinutes: number) => {
  const hour24 = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  const hour12 = hour24 % 12 || 12
  const suffix = hour24 < 12 ? 'AM' : 'PM'
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`
}

/**
 * Known issue, logged and deliberately not fixed in this build (spec §10.17):
 * `api/resume.ts` takes the session token as a query parameter, so it lands in
 * access logs and `Referer`. The fix is a fetch + blob-URL rewrite of the
 * viewer with tests attached; it is out of scope here.
 */
const candidateResumeHref = (candidate: Candidate, sessionToken: string, previewingLeadership: boolean) => {
  if (!candidate.resumeUrl) return ''
  if (/^https?:\/\//i.test(candidate.resumeUrl)) return candidate.resumeUrl

  const token = sessionToken || (previewingLeadership ? 'local-preview-session-token' : '')
  if (!token || candidate.resumeUrl.startsWith('local-preview://')) return ''

  const separator = candidate.resumeUrl.includes('?') ? '&' : '?'
  return `${candidate.resumeUrl}${separator}sessionToken=${encodeURIComponent(token)}`
}

/** "Tommy Hartnett" → first / last. One space is all the candidate form collects. */
const splitCandidateName = (name: string) => {
  const parts = name.trim().split(/\s+/)
  return {
    firstName: parts[0] || name.trim() || 'Member',
    lastName: parts.slice(1).join(' ') || parts[0] || 'Member',
  }
}

function StatusPill({ value }: { value: string }) {
  return <mark className={`admin-status admin-status--${statusClass(value)}`}>{value}</mark>
}

export default function AdminRecruiting() {
  const { sessionToken } = useMemberAuth()
  const { announce, announceUrgent } = usePortalAnnouncer()
  const previewingLeadership = import.meta.env.DEV && window.location.search.includes('preview=leadership')

  const [dashboardData, setDashboardData] = useState<DashboardData>({})
  const [dashboardState, setDashboardState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [dashboardError, setDashboardError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [candidateRows, setCandidateRows] = useState<Candidate[]>([])
  const [assignmentSaveState, setAssignmentSaveState] = useState<Record<string, string>>({})
  const [convertState, setConvertState] = useState<Record<string, string>>({})
  const [exporting, setExporting] = useState(false)

  const interviewerRows = useMemo(() => dashboardData.interviewerAvailability || [], [dashboardData.interviewerAvailability])

  // StrictMode double-invokes effects in dev (spec §10.12), so every fetch
  // effect carries the cancelled flag rather than a mounted ref.
  useEffect(() => {
    if (!sessionToken && !previewingLeadership) return

    let cancelled = false
    setDashboardState('loading')
    setDashboardError('')

    readDashboardData(sessionToken || 'local-preview-session-token')
      .then((nextData) => {
        if (cancelled) return
        const normalizedCandidates = sortCandidatesForDashboard((nextData.candidates || []).map((candidate) => ({
          ...candidate,
          interviewers: candidate.interviewers.slice(0, 2),
        })))
        setDashboardData(nextData)
        setCandidateRows(normalizedCandidates)
        setDashboardState('ready')
      })
      .catch((error) => {
        if (cancelled) return
        setDashboardError(error instanceof Error ? error.message : 'Could not load dashboard data.')
        setDashboardState('error')
      })

    return () => {
      cancelled = true
    }
  }, [previewingLeadership, reloadKey, sessionToken])

  useEffect(() => {
    if (!sessionToken || previewingLeadership) return

    const refreshDashboard = () => setReloadKey((current) => current + 1)
    const handleStorage = (event: StorageEvent) => {
      if (event.key === DASHBOARD_DATA_CHANGED_STORAGE_KEY) refreshDashboard()
    }

    window.addEventListener(DASHBOARD_DATA_CHANGED_EVENT, refreshDashboard)
    window.addEventListener('storage', handleStorage)
    window.addEventListener('focus', refreshDashboard)

    return () => {
      window.removeEventListener(DASHBOARD_DATA_CHANGED_EVENT, refreshDashboard)
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('focus', refreshDashboard)
    }
  }, [previewingLeadership, sessionToken])

  const interviewersForSlot = (slotValue: string) => (
    interviewerRows.filter((interviewer) => interviewer.availability.includes(slotValue))
  )

  const updateCandidate = (id: string, updates: Partial<Candidate>) => {
    setCandidateRows((current) => current.map((candidate) => (
      candidate.id === id ? { ...candidate, ...updates } : candidate
    )))
  }

  const updateCandidateSlot = (id: string, slotValue: string) => {
    const availableNames = new Set(interviewersForSlot(slotValue).map((interviewer) => interviewer.name))
    setCandidateRows((current) => current.map((candidate) => {
      if (candidate.id !== id) return candidate
      return {
        ...candidate,
        assignedSlot: slotValue,
        interviewers: slotValue ? candidate.interviewers.filter((name) => availableNames.has(name)).slice(0, 2) : [],
        status: slotValue ? (candidate.status === 'Needs match' ? 'Matched' : candidate.status) : 'Needs match',
      }
    }))
  }

  const updateCandidateInterviewers = (id: string, names: string[]) => {
    setCandidateRows((current) => current.map((candidate) => (
      candidate.id === id ? { ...candidate, interviewers: Array.from(new Set(names.filter(Boolean))).slice(0, 2) } : candidate
    )))
  }

  const autoMatch = () => {
    const result = matchOpenInterviewSlate(candidateRows, interviewerRows, {})
    setCandidateRows(result.candidates)
    announce(result.matchedCount
      ? `Auto-matched ${result.matchedCount} candidate${result.matchedCount === 1 ? '' : 's'}.`
      : 'No covered matches found.')
  }

  const saveAssignment = async (candidate: Candidate) => {
    setAssignmentSaveState((current) => ({ ...current, [candidate.id]: 'Saving...' }))

    try {
      if (previewingLeadership) {
        setAssignmentSaveState((current) => ({ ...current, [candidate.id]: 'Preview mode. Sign in to save.' }))
        return
      }

      if (!sessionToken) throw new Error('Sign in with an admin account before saving.')

      const response = await fetch('/api/interview-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: candidate.email,
          assignedSlot: candidate.assignedSlot,
          interviewers: candidate.interviewers,
          interviewStatus: candidate.status,
          feedback: candidate.feedback,
          sessionToken,
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Could not save assignment.')

      setAssignmentSaveState((current) => ({ ...current, [candidate.id]: 'Saved' }))
      announce(`Assignment saved for ${candidate.name}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save assignment.'
      setAssignmentSaveState((current) => ({ ...current, [candidate.id]: message }))
      announceUrgent(message)
    }
  }

  /**
   * Addition 1 of 2. Wired to the existing `api/recruiting-export.ts`. Fetched
   * rather than linked so the session token never enters browser history or a
   * `Referer` header — it still reaches the server in the query string, which is
   * that endpoint's shape and not this screen's to change.
   */
  const exportCandidates = async () => {
    if (!sessionToken) {
      announceUrgent('Sign in with an admin account before exporting.')
      return
    }

    setExporting(true)
    try {
      const response = await fetch(
        `/api/recruiting-export?type=candidates&sessionToken=${encodeURIComponent(sessionToken)}`,
      )
      if (!response.ok) throw new Error('Could not build the candidate export.')

      const csv = await response.text()
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `ublda-candidates-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      announce('Candidate CSV downloaded.')
    } catch (error) {
      announceUrgent(error instanceof Error ? error.message : 'Could not build the candidate export.')
    } finally {
      setExporting(false)
    }
  }

  /**
   * Addition 2 of 2. An offer-stage candidate becomes a real member record with
   * `source: 'recruiting'`, which is the one hand-off recruiting owes the
   * roster. Everything else about them stays in recruiting.
   */
  const convertToMember = async (candidate: Candidate) => {
    setConvertState((current) => ({ ...current, [candidate.id]: 'Converting...' }))

    try {
      const { firstName, lastName } = splitCandidateName(candidate.name)
      const result = await callPortal<{ member: MemberAdminRow }>('admin.member.upsert', sessionToken, {
        email: candidate.email,
        firstName,
        lastName,
        status: 'prospect',
        source: 'recruiting',
      })

      setConvertState((current) => ({ ...current, [candidate.id]: 'On the roster' }))
      announce(`${result.member.firstName} ${result.member.lastName} added to the roster as a prospect.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add this candidate to the roster.'
      setConvertState((current) => ({ ...current, [candidate.id]: message }))
      announceUrgent(message)
    }
  }

  const matchedCandidates = candidateRows.filter((candidate) => candidate.assignedSlot).length
  const calendarEvents = useMemo<DashboardCalendarEvent[]>(() => dashboardData.calendarEvents || [], [dashboardData.calendarEvents])
  const resumeRows = useMemo(() => (
    candidateRows.filter((candidate) => candidate.resumeUrl || /resume/i.test(candidate.feedback || ''))
  ), [candidateRows])
  const interviewersBySlot = useMemo(() => {
    const map = new Map<string, string[]>()
    interviewerRows.forEach((interviewer) => {
      interviewer.availability.forEach((slotValue) => {
        map.set(slotValue, [...(map.get(slotValue) || []), interviewer.name])
      })
    })
    return map
  }, [interviewerRows])
  const candidatesBySlot = useMemo(() => {
    const map = new Map<string, Candidate[]>()
    candidateRows.forEach((candidate) => {
      if (!candidate.assignedSlot) return
      map.set(candidate.assignedSlot, [...(map.get(candidate.assignedSlot) || []), candidate])
    })
    return map
  }, [candidateRows])
  const calendarDays = useMemo(() => INTERVIEW_WINDOW_DAYS.map((day) => {
    const daySlots = INTERVIEW_SLOTS
      .filter((slot) => slot.start.includes(day.date))
      .map((slot) => ({
        slot,
        interviewers: interviewersBySlot.get(slot.value) || [],
        candidates: candidatesBySlot.get(slot.value) || [],
      }))
    const usefulSlots = daySlots.filter((row) => row.candidates.length > 0)
    const manualEvents = calendarEvents
      .filter((event) => event.date === day.date)
      .sort((left, right) => left.startMinutes - right.startMinutes)

    return {
      ...day,
      coveredCount: daySlots.filter((row) => row.interviewers.length > 0).length,
      scheduledCount: daySlots.reduce((count, row) => count + row.candidates.length, 0) + manualEvents.length,
      slots: usefulSlots,
      manualEvents,
      totalSlots: daySlots.length,
    }
  }), [calendarEvents, candidatesBySlot, interviewersBySlot])

  // Blob reads retry 3× then throw BLOB_UNAVAILABLE (spec §10.9), so this screen
  // says so rather than painting an empty queue that reads as "nobody applied".
  const loadFailed = dashboardState === 'error'

  return (
    <PortalPage
      title="Recruiting"
      lede="Review candidates, assign interviewers, and save the schedule."
      actions={
        <>
          <button type="button" className="p-btn p-btn--primary" onClick={autoMatch}>Auto-match</button>
          <button type="button" className="p-btn" onClick={() => setReloadKey((current) => current + 1)}>
            {dashboardState === 'loading' ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="p-btn" onClick={() => void exportCandidates()} disabled={exporting}>
            {exporting ? 'Preparing CSV…' : 'Export CSV'}
          </button>
          <Link className="p-btn" to="/interview-signup">Candidate form</Link>
          <Link className="p-btn" to="/interviewer-availability">Interviewer form</Link>
        </>
      }
    >
      {loadFailed ? (
        <div className="p-errorsummary" role="alert" tabIndex={-1}>
          <h2 className="p-errorsummary__title">Recruiting data did not load.</h2>
          <p className="p-errorsummary__item">
            {dashboardError || 'Storage is warming up. Give it a few seconds and try again.'}
          </p>
        </div>
      ) : null}

      <div className="admin-dashboard admin-dashboard--recruiting">
        <div className="admin-dashboard__stack">
          <section className="admin-panel admin-recruiting-focus" aria-labelledby="recruiting-candidates">
            <div className="admin-panel__title">
              <div>
                <h2 id="recruiting-candidates">Candidates</h2>
                <span>{candidateRows.length} candidate{candidateRows.length === 1 ? '' : 's'}</span>
              </div>
            </div>
            {candidateRows.length === 0 ? (
              <div className="admin-empty-state">
                <strong>No candidates yet.</strong>
                <p>Candidate submissions will appear here after the signup form is submitted.</p>
                <Link to="/interview-signup">Open candidate form</Link>
              </div>
            ) : (
              <div className="admin-candidate-queue">
                {candidateRows.map((candidate) => {
                  const candidateSlots = sortSlotValues(candidate.availability)
                  const eligibleSlots = candidateSlots.length ? candidateSlots : INTERVIEW_SLOTS.map((slot) => slot.value)
                  const interviewerOptions = candidate.assignedSlot ? interviewersForSlot(candidate.assignedSlot) : []
                  const resumeHref = candidateResumeHref(candidate, sessionToken, previewingLeadership)
                  const secondOptions = interviewerOptions.filter((interviewer) => interviewer.name !== candidate.interviewers[0])

                  return (
                    <article className="admin-candidate-card" key={candidate.id}>
                      <header>
                        <div>
                          <strong>{candidate.name}</strong>
                          <small>{candidate.email}</small>
                        </div>
                        <StatusPill value={candidate.status} />
                      </header>
                      <div className="admin-candidate-card__meta">
                        <span>{candidate.rolePreferences[0] || 'No role preference'}</span>
                        <span>{candidate.availability.length} available slot{candidate.availability.length === 1 ? '' : 's'}</span>
                        {resumeHref ? (
                          <a href={resumeHref} target="_blank" rel="noreferrer">
                            Resume
                            <span className="p-visually-hidden">{` for ${candidate.name}, opens in a new tab`}</span>
                          </a>
                        ) : <span>Resume pending</span>}
                      </div>
                      <div className="admin-candidate-card__controls">
                        <label>
                          Interview time
                          <select
                            value={candidate.assignedSlot}
                            onChange={(event) => updateCandidateSlot(candidate.id, event.target.value)}
                          >
                            <option value="">Select slot</option>
                            {eligibleSlots.map((slotValue) => <option key={slotValue} value={slotValue}>{slotLabel(slotValue)}</option>)}
                          </select>
                        </label>
                        <label>
                          Lead interviewer
                          <select
                            value={candidate.interviewers[0] || ''}
                            onChange={(event) => updateCandidateInterviewers(candidate.id, [event.target.value, candidate.interviewers[1] || ''])}
                            disabled={!candidate.assignedSlot || interviewerOptions.length === 0}
                          >
                            <option value="">{candidate.assignedSlot ? 'Select interviewer' : 'Select slot first'}</option>
                            {interviewerOptions.map((interviewer) => <option key={interviewer.name} value={interviewer.name}>{interviewer.name}</option>)}
                          </select>
                        </label>
                        <label>
                          Second interviewer
                          <select
                            value={candidate.interviewers[1] || ''}
                            onChange={(event) => updateCandidateInterviewers(candidate.id, [candidate.interviewers[0] || '', event.target.value])}
                            disabled={!candidate.interviewers[0] || secondOptions.length === 0}
                          >
                            <option value="">None</option>
                            {secondOptions.map((interviewer) => <option key={interviewer.name} value={interviewer.name}>{interviewer.name}</option>)}
                          </select>
                        </label>
                        <label>
                          Status
                          <select
                            value={candidate.status}
                            onChange={(event) => updateCandidate(candidate.id, { status: event.target.value as Candidate['status'] })}
                          >
                            {INTERVIEW_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </label>
                      </div>
                      <div className="admin-candidate-card__actions">
                        <button type="button" onClick={() => void saveAssignment(candidate)}>
                          Save assignment
                          <span className="p-visually-hidden">{` for ${candidate.name}`}</span>
                        </button>
                        {candidate.status === 'Offer' ? (
                          <button type="button" onClick={() => void convertToMember(candidate)}>
                            Convert to member
                            <span className="p-visually-hidden">{`: add ${candidate.name} to the roster`}</span>
                          </button>
                        ) : null}
                        {assignmentSaveState[candidate.id] && <small>{assignmentSaveState[candidate.id]}</small>}
                        {convertState[candidate.id] && <small>{convertState[candidate.id]}</small>}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="admin-panel admin-resume-panel" aria-labelledby="recruiting-resumes">
            <div className="admin-panel__title">
              <h2 id="recruiting-resumes">Resume uploads</h2>
              <span>{resumeRows.length}/{candidateRows.length} candidate{candidateRows.length === 1 ? '' : 's'}</span>
            </div>
            {resumeRows.length === 0 ? (
              <div className="admin-empty-state">
                <strong>No uploaded resumes loaded yet.</strong>
                <p>Resume files come through the candidate form and stay private to recruiting admins.</p>
                <Link to="/interview-signup">Open candidate form</Link>
              </div>
            ) : (
              <div className="admin-resume-list">
                {resumeRows.map((candidate) => {
                  const resumeHref = candidateResumeHref(candidate, sessionToken, previewingLeadership)
                  return (
                    <article key={`resume-${candidate.id}`}>
                      <div>
                        <strong>{candidate.name}</strong>
                        <small>{candidate.email}</small>
                      </div>
                      {resumeHref ? (
                        <a href={resumeHref} target="_blank" rel="noreferrer">
                          View resume
                          <span className="p-visually-hidden">{` for ${candidate.name}, opens in a new tab`}</span>
                        </a>
                      ) : <span>Stored resume</span>}
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="admin-panel admin-calendar-panel" aria-labelledby="recruiting-calendar">
            <div className="admin-panel__title">
              <h2 id="recruiting-calendar">Calendar</h2>
              <span>{matchedCandidates + calendarEvents.length} scheduled item{matchedCandidates + calendarEvents.length === 1 ? '' : 's'}</span>
            </div>
            {/* The calendar is an `overflow-x: auto` region. Without a tab stop it
                scrolls with a mouse and not at all with a keyboard, which is a
                2.1.1 failure at every width below ~1100px. */}
            <div
              className="admin-calendar"
              role="region"
              tabIndex={0}
              aria-labelledby="recruiting-calendar"
            >
              {calendarDays.map((day) => (
                <section className="admin-calendar__day" key={day.date} aria-label={`${day.shortLabel}, ${day.scheduledCount} scheduled`}>
                  <header>
                    <strong>{day.shortLabel}</strong>
                    <span>{day.scheduledCount} scheduled · {day.coveredCount}/{day.totalSlots} covered</span>
                  </header>
                  <div className="admin-calendar__body">
                    {day.manualEvents.map((event) => (
                      <article className="admin-interview-card admin-interview-card--manual" key={event.id}>
                        <time>{formatMinutes(event.startMinutes)}-{formatMinutes(event.startMinutes + event.durationMinutes)}</time>
                        <strong>{event.title}</strong>
                        <small>{event.location} · {event.owner}</small>
                        {event.notes && <small>{event.notes}</small>}
                      </article>
                    ))}
                    {day.slots.map(({ slot, interviewers, candidates }) => (
                      <article className="admin-interview-card" key={slot.value}>
                        <time>{timeOnly(slot.value)}</time>
                        <strong>{candidates.map((candidate) => candidate.name).join(', ') || 'Open covered slot'}</strong>
                        <small>{interviewers.length ? interviewers.join(', ') : 'No interviewer coverage'}</small>
                      </article>
                    ))}
                    {day.manualEvents.length === 0 && day.slots.length === 0 && <p className="admin-empty-copy">No covered or scheduled slots yet.</p>}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <div className="admin-dashboard__two">
            <section className="admin-panel" aria-labelledby="recruiting-coverage">
              <div className="admin-panel__title"><h2 id="recruiting-coverage">Interviewer coverage</h2></div>
              {interviewerRows.length === 0 ? (
                <div className="admin-empty-state">
                  <strong>No interviewer availability yet.</strong>
                  <p>Send the interviewer form before opening candidate signups widely.</p>
                  <Link to="/interviewer-availability">Open interviewer form</Link>
                </div>
              ) : (
                <div className="admin-mini-list">
                  {interviewerRows.map((interviewer) => (
                    <article key={interviewer.email || interviewer.name}>
                      <div>
                        <strong>{interviewer.name}</strong>
                        <small>{interviewer.availability.length} slot{interviewer.availability.length === 1 ? '' : 's'} · {interviewer.maxInterviews}</small>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="admin-panel" aria-labelledby="recruiting-scheduled">
              <div className="admin-panel__title"><h2 id="recruiting-scheduled">Scheduled interviews</h2></div>
              <div className="admin-mini-list">
                {candidateRows.filter((candidate) => candidate.assignedSlot).map((candidate) => (
                  <article key={`${candidate.id}-${candidate.assignedSlot}`}>
                    <div>
                      <strong>{candidate.name}</strong>
                      <small>{slotLabel(candidate.assignedSlot)} · {candidate.interviewers.join(', ') || 'No interviewer'}</small>
                    </div>
                  </article>
                ))}
                {candidateRows.every((candidate) => !candidate.assignedSlot) && <p className="admin-empty-copy">No scheduled interviews yet.</p>}
              </div>
            </section>
          </div>
        </div>
      </div>
    </PortalPage>
  )
}
