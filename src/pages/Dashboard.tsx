import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Reveal from '../components/Reveal'
import { useMemberAuth } from '../hooks/useMemberAuth'
import {
  calendarItems,
  candidates,
  directoryMembers,
  leadershipActions,
  leadershipMetrics,
  memberActions,
  newsItems,
  opportunities,
  publishingQueue,
  resources,
  sponsors,
  interviewerAvailability,
} from '../lib/memberData'
import type { Candidate, DashboardAction, MemberProfile, WorkspaceMode } from '../lib/memberData'
import {
  getInterviewSlotByValue,
  overlappingSlotValues,
} from '../lib/interviews'
import './Dashboard.css'

const publicPreviewItems = [
  {
    title: 'Member profile',
    text: 'Status, attendance, track, and leadership next steps stay attached to your UMich account.',
  },
  {
    title: 'Opportunity board',
    text: 'A focused place for recruiting, networking, BLDA mentor, and project leads.',
  },
  {
    title: 'Leadership command center',
    text: 'E-board recruiting, Ross ratio, sponsor tracking, and publishing workflows live behind role access.',
  },
]

const memberTabs = ['Overview', 'Opportunities', 'Calendar', 'Directory', 'News', 'Resources', 'Profile']
const leadershipTabs = ['Overview', 'Recruiting', 'Members', 'Sponsors', 'Publishing', 'Resources', 'Profile']

const statusClass = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-')

const slotLabel = (value: string) => getInterviewSlotByValue(value)?.label || value || 'Unassigned'

const localPreviewMember: MemberProfile = {
  firstName: 'Preview',
  lastName: 'Member',
  uniqname: 'preview.member',
  email: 'preview.member@umich.edu',
  memberStatus: 'Local dashboard preview',
  attendance: {
    attended: 1,
    total: 4,
    streak: 1,
  },
  leadershipPosition: 'Interviewing',
  officerFocus: 'Recruiting preview',
  year: 'Update in profile',
  college: 'University of Michigan',
  track: 'Leadership operations',
  profileCompletion: 78,
  application: null,
}

function ActionCard({ action }: { action: DashboardAction }) {
  const content = (
    <>
      <span className={`portal-action__status portal-action__status--${action.tone}`}>{action.status}</span>
      <strong>{action.title}</strong>
      <p>{action.description}</p>
    </>
  )

  if (action.href.startsWith('/')) {
    return (
      <Link to={action.href} className="portal-action">
        {content}
      </Link>
    )
  }

  return (
    <a href={action.href} className="portal-action">
      {content}
    </a>
  )
}

export default function Dashboard() {
  const { status, member, signOut } = useMemberAuth()
  const effectiveMember = member || (import.meta.env.DEV && window.location.search.includes('preview=leadership') ? localPreviewMember : null)
  const [workspace, setWorkspace] = useState<WorkspaceMode>(() => (window.location.search.includes('preview=leadership') ? 'leadership' : 'member'))
  const [activeTab, setActiveTab] = useState(() => (window.location.search.includes('preview=leadership') ? 'Recruiting' : 'Overview'))
  const [candidateRows, setCandidateRows] = useState<Candidate[]>(candidates)
  const [assignmentSaveState, setAssignmentSaveState] = useState<Record<string, string>>({})
  const [assignmentAdminToken, setAssignmentAdminToken] = useState('')
  const attendancePercent = effectiveMember ? Math.round((effectiveMember.attendance.attended / effectiveMember.attendance.total) * 100) : 0
  const tabs = workspace === 'leadership' ? leadershipTabs : memberTabs
  const actions = workspace === 'leadership' ? leadershipActions : memberActions
  const totalInterviewerSlots = new Set(interviewerAvailability.flatMap((interviewer) => interviewer.availability)).size
  const matchedCandidates = candidateRows.filter((candidate) => candidate.assignedSlot).length

  const updateCandidate = (id: string, updates: Partial<Candidate>) => {
    setCandidateRows((current) => current.map((candidate) => (
      candidate.id === id ? { ...candidate, ...updates } : candidate
    )))
  }

  const saveAssignment = async (candidate: Candidate) => {
    setAssignmentSaveState((current) => ({ ...current, [candidate.id]: 'Saving...' }))

    try {
      const response = await fetch('/api/interview-assignment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ublda-admin-token': assignmentAdminToken,
        },
        body: JSON.stringify({
          email: candidate.email,
          assignedSlot: candidate.assignedSlot,
          interviewers: candidate.interviewers,
          interviewStatus: candidate.status,
          feedback: candidate.feedback,
        }),
      })
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(result?.error || 'Could not save assignment.')
      }

      setAssignmentSaveState((current) => ({ ...current, [candidate.id]: 'Saved to sheet' }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save assignment.'
      setAssignmentSaveState((current) => ({ ...current, [candidate.id]: message }))
    }
  }

  const updateWorkspace = (nextWorkspace: WorkspaceMode) => {
    setWorkspace(nextWorkspace)
    setActiveTab('Overview')
  }

  const workspaceSummary = useMemo(() => {
    if (workspace === 'leadership') {
      return {
        label: 'Leadership workspace',
        title: 'Recruiting and club operations, in one cockpit.',
        text: 'Track candidates, interviews, Ross ratio, sponsors, member health, and publishing queues without burying leaders in spreadsheets.',
      }
    }

    return {
      label: 'Member workspace',
        title: `Welcome back, ${effectiveMember?.firstName || 'member'}.`,
      text: 'Find your next action, upcoming events, opportunities, news, directory access, and profile settings from one homebase.',
    }
  }, [effectiveMember?.firstName, workspace])

  if (status === 'loading') {
    return (
      <main id="main-content" className="dashboard-page">
        <section className="dashboard-page__hero">
          <div className="container">
            <p className="dashboard-page__loading">Loading member homebase...</p>
          </div>
        </section>
      </main>
    )
  }

  if (!effectiveMember) {
    return (
      <main id="main-content" className="dashboard-page">
        <section className="dashboard-page__hero">
          <div className="container">
            <Reveal>
              <div className="dashboard-gate">
                <div className="dashboard-gate__copy">
                  <p className="section__label">Member Portal</p>
                  <h1>The UBLDA homebase is for signed-in members.</h1>
                  <p>
                    Public visitors can learn about UBLDA across the main site. Members
                    use the portal for status, events, opportunities, interviews, news,
                    directory access, and e-board recruiting workflows.
                  </p>
                  <div className="dashboard-gate__actions">
                    <Link to="/signin" className="btn btn--primary btn--lg">
                      Sign in with Google
                    </Link>
                    <Link to="/portal" className="dashboard-gate__secondary">
                      Leadership interview portal
                    </Link>
                  </div>
                </div>

                <div className="dashboard-gate__preview" aria-label="Member dashboard preview">
                  {publicPreviewItems.map((item) => (
                    <article key={item.title}>
                      <span>{item.title}</span>
                      <p>{item.text}</p>
                    </article>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
    )
  }

  const renderOverview = () => (
    <div className="portal-grid portal-grid--overview">
      <section className="portal-panel portal-panel--span-2">
        <div className="portal-panel__header">
          <div>
            <h2>Next best actions</h2>
            <p>The portal should always make the next useful thing obvious.</p>
          </div>
          <span className="portal-pill">{workspace === 'leadership' ? 'E-board preview' : 'Member view'}</span>
        </div>
        <div className="portal-actions">
          {actions.map((action) => (
            <ActionCard action={action} key={action.title} />
          ))}
        </div>
      </section>

      <section className="portal-panel">
        <div className="portal-panel__header">
          <div>
            <h2>Member snapshot</h2>
            <p>Identity, attendance, and role state.</p>
          </div>
        </div>
        <div className="portal-stat-list">
          <div>
            <span>Status</span>
            <strong>{effectiveMember.memberStatus}</strong>
          </div>
          <div>
            <span>Attendance</span>
            <strong>{attendancePercent}%</strong>
          </div>
          <div>
            <span>Focus</span>
            <strong>{workspace === 'leadership' ? effectiveMember.officerFocus : effectiveMember.track}</strong>
          </div>
        </div>
      </section>

      <section className="portal-panel">
        <div className="portal-panel__header">
          <div>
            <h2>Upcoming calendar</h2>
            <p>Events and recruiting windows.</p>
          </div>
        </div>
        <div className="portal-mini-list">
          {calendarItems.slice(0, 3).map((item) => (
            <article key={item.title}>
              <span>{item.date}</span>
              <strong>{item.title}</strong>
              <p>{item.time} · {item.status}</p>
            </article>
          ))}
        </div>
      </section>

      {workspace === 'leadership' ? (
        <section className="portal-panel portal-panel--span-2">
          <div className="portal-panel__header">
            <div>
              <h2>Recruiting pulse</h2>
              <p>A lightweight command center for e-board interview and membership health.</p>
            </div>
            <button type="button">Export slate</button>
          </div>
          <div className="leadership-metrics">
            {leadershipMetrics.map((metric) => (
              <article className={`leadership-metric leadership-metric--${metric.tone}`} key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <p>{metric.detail}</p>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="portal-panel portal-panel--span-2">
          <div className="portal-panel__header">
            <div>
              <h2>Recommended opportunities</h2>
              <p>Curated recruiting, networking, and project leads.</p>
            </div>
            <button type="button" onClick={() => setActiveTab('Opportunities')}>View board</button>
          </div>
          <div className="portal-mini-list portal-mini-list--two">
            {opportunities.slice(0, 4).map((opportunity) => (
              <article key={opportunity.title}>
                <span>{opportunity.type}</span>
                <strong>{opportunity.title}</strong>
                <p>{opportunity.timing} · Owner: {opportunity.owner}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )

  const renderOpportunities = () => (
    <section className="portal-panel">
      <div className="portal-panel__header">
        <div>
          <h2>Opportunities board</h2>
          <p>Recruiting, networking, project, and community leads with owners and timing.</p>
        </div>
        <div className="portal-filter-row" aria-label="Opportunity filters">
          {['All', 'Recruiting', 'Networking', 'Project', 'Community'].map((filter) => (
            <button type="button" key={filter}>{filter}</button>
          ))}
        </div>
      </div>
      <div className="opportunity-list">
        {opportunities.map((opportunity) => (
          <article className="opportunity-row" key={opportunity.title}>
            <div>
              <span>{opportunity.type}</span>
              <h3>{opportunity.title}</h3>
              <p>{opportunity.organization}</p>
            </div>
            <div>
              <strong>{opportunity.timing}</strong>
              <small>{opportunity.audience}</small>
              <small>Owner: {opportunity.owner}{opportunity.saved ? ' · Saved' : ''}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  )

  const renderCalendar = () => (
    <section className="portal-panel">
      <div className="portal-panel__header">
        <div>
          <h2>UBLDA calendar</h2>
          <p>Member events, interview windows, and BLDA network moments.</p>
        </div>
        <button type="button">Sync calendar</button>
      </div>
      <div className="calendar-list">
        {calendarItems.map((item) => (
          <article className="calendar-item" key={item.title}>
            <time>{item.date}</time>
            <div>
              <h3>{item.title}</h3>
              <p>{item.time} · {item.location}</p>
            </div>
            <span className={`portal-status portal-status--${statusClass(item.status)}`}>{item.status}</span>
          </article>
        ))}
      </div>
    </section>
  )

  const renderDirectory = () => (
    <section className="portal-panel">
      <div className="portal-panel__header">
        <div>
          <h2>UBLDA + BLDA directory</h2>
          <p>Privacy-safe people search. Contact fields should stay opt-in.</p>
        </div>
        <div className="portal-search">
          <span>Search</span>
          <input type="search" placeholder="Name, role, company, track" />
        </div>
      </div>
      <div className="directory-table" role="table" aria-label="Member directory">
        <div className="directory-table__row directory-table__row--head" role="row">
          <span>Name</span>
          <span>Group</span>
          <span>Role</span>
          <span>Company / program</span>
          <span>Focus</span>
          <span>Intro</span>
        </div>
        {directoryMembers.map((person) => (
          <div className="directory-table__row" role="row" key={`${person.affiliation}-${person.name}`}>
            <span>{person.name}</span>
            <span>{person.affiliation}</span>
            <span>{person.role}</span>
            <span>{person.company}</span>
            <span>{person.track}</span>
            <span>{person.openToChat ? 'Request intro' : 'Hidden'}</span>
          </div>
        ))}
      </div>
    </section>
  )

  const renderNews = () => (
    <section className="portal-panel">
      <div className="portal-panel__header">
        <div>
          <h2>Mission news</h2>
          <p>Short, curated context with why it matters for UBLDA members.</p>
        </div>
        <button type="button">Suggest article</button>
      </div>
      <div className="news-list">
        {newsItems.map((item) => (
          <article className="news-item" key={item.title}>
            <span>{item.theme} · {item.date}</span>
            <h3>{item.title}</h3>
            <p>{item.source}</p>
            <small>{item.whyItMatters}</small>
          </article>
        ))}
      </div>
    </section>
  )

  const renderResources = () => (
    <section className="portal-panel">
      <div className="portal-panel__header">
        <div>
          <h2>Recruiting prep and resources</h2>
          <p>A practical library for resumes, interviews, mentor conversations, and access needs.</p>
        </div>
        <button type="button">Suggest resource</button>
      </div>
      <div className="resource-grid">
        {resources.map((resource) => (
          <article className="resource-card" key={resource.title}>
            <span>{resource.category}</span>
            <h3>{resource.title}</h3>
            <p>{resource.format}</p>
            <small>{resource.nextStep}</small>
          </article>
        ))}
      </div>
    </section>
  )

  const renderRecruiting = () => (
    <div className="portal-grid portal-grid--ops">
      <section className="portal-panel portal-panel--span-2" id="recruiting">
        <div className="portal-panel__header">
          <div>
            <h2>E-board interview command center</h2>
            <p>Candidate resumes, ranked roles, availability overlap, assignments, interview status, and feedback.</p>
          </div>
          <Link to="/interviewer-availability">E-board availability form</Link>
        </div>

        <div className="interview-admin-summary" aria-label="Interview scheduling summary">
          <article>
            <span>Candidates</span>
            <strong>{candidateRows.length}</strong>
            <p>{matchedCandidates} matched to a slot</p>
          </article>
          <article>
            <span>E-board coverage</span>
            <strong>{totalInterviewerSlots}</strong>
            <p>unique 20-minute blocks submitted</p>
          </article>
          <article>
            <span>Window</span>
            <strong>May 7-10</strong>
            <p>Google Meet, 8 AM-10 PM ET</p>
          </article>
        </div>

        <div className="candidate-workbench">
          {candidateRows.map((candidate) => {
            const candidateSlots = candidate.availability
              .map((value) => getInterviewSlotByValue(value))
              .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot))
            const assignedInterviewers = interviewerAvailability.filter((interviewer) => candidate.interviewers.includes(interviewer.name))
            const overlapValues = assignedInterviewers.flatMap((interviewer) => {
              const interviewerSlots = interviewer.availability
                .map((value) => getInterviewSlotByValue(value))
                .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot))
              return overlappingSlotValues(candidateSlots, interviewerSlots)
            })
            const realisticSlotValues = Array.from(new Set(overlapValues))
            const fallbackValues = realisticSlotValues.length > 0 ? realisticSlotValues : candidate.availability

            return (
              <article className="candidate-card" key={candidate.id}>
                <div className="candidate-card__main">
                  <div>
                    <div className="candidate-card__title-row">
                      <h3>{candidate.name}</h3>
                      <mark className={`portal-status portal-status--${statusClass(candidate.status)}`}>{candidate.status}</mark>
                    </div>
                    <p>{candidate.program} · {candidate.email}</p>
                  </div>
                  <a href={candidate.resumeUrl} target="_blank" rel="noreferrer">View resume</a>
                </div>

                <div className="candidate-card__roles">
                  {candidate.rolePreferences.map((role, index) => (
                    <span key={role}>{index + 1}. {role}</span>
                  ))}
                </div>

                <div className="candidate-card__controls">
                  <label>
                    <span>Assigned slot</span>
                    <select
                      value={candidate.assignedSlot}
                      onChange={(event) => updateCandidate(candidate.id, {
                        assignedSlot: event.target.value,
                        status: event.target.value ? 'Matched' : 'Needs match',
                      })}
                    >
                      <option value="">Select overlap slot</option>
                      {fallbackValues.map((value) => (
                        <option key={value} value={value}>{slotLabel(value)}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Interviewers</span>
                    <select
                      value={candidate.interviewers[0] || ''}
                      onChange={(event) => updateCandidate(candidate.id, { interviewers: event.target.value ? [event.target.value] : [] })}
                    >
                      <option value="">Assign lead interviewer</option>
                      {interviewerAvailability.map((interviewer) => (
                        <option key={interviewer.name} value={interviewer.name}>{interviewer.name}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Status</span>
                    <select
                      value={candidate.status}
                      onChange={(event) => updateCandidate(candidate.id, { status: event.target.value as Candidate['status'] })}
                    >
                      {['Needs match', 'Matched', 'Invited', 'Interviewed', 'Offer', 'Hold', 'Declined'].map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="candidate-card__availability">
                  <span>Candidate availability</span>
                  <p>{candidate.availability.slice(0, 4).map(slotLabel).join(' · ')}{candidate.availability.length > 4 ? ` · +${candidate.availability.length - 4} more` : ''}</p>
                  <small>{realisticSlotValues.length} overlap block{realisticSlotValues.length === 1 ? '' : 's'} with assigned interviewer availability</small>
                </div>

                <label className="candidate-card__feedback">
                  <span>Notes / feedback</span>
                  <textarea
                    value={candidate.feedback}
                    onChange={(event) => updateCandidate(candidate.id, { feedback: event.target.value })}
                    placeholder="Rubric notes, interviewer feedback, follow-up risks, decision context."
                  />
                </label>

                <div className="candidate-card__save-row">
                  <button type="button" onClick={() => void saveAssignment(candidate)}>
                    Save assignment
                  </button>
                  {assignmentSaveState[candidate.id] && <span>{assignmentSaveState[candidate.id]}</span>}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="portal-panel">
        <div className="portal-panel__header">
          <div>
            <h2>E-board coverage</h2>
            <p>Use this to see who is actually free before assigning interviews.</p>
          </div>
        </div>
        <div className="interviewer-coverage-list">
          {interviewerAvailability.map((interviewer) => (
            <article key={interviewer.name}>
              <div>
                <strong>{interviewer.name}</strong>
                <span>{interviewer.role} · max {interviewer.maxInterviews}</span>
              </div>
              <p>{interviewer.availability.length} blocks submitted</p>
            </article>
          ))}
        </div>
        <label className="interview-admin-token">
          <span>Assignment save token</span>
          <input
            type="password"
            value={assignmentAdminToken}
            onChange={(event) => setAssignmentAdminToken(event.target.value)}
            placeholder="Required to save sheet updates"
          />
        </label>
        <div className="portal-control-stack">
          <Link to="/interviewer-availability">Collect e-board availability</Link>
          <Link to="/apply">Candidate form</Link>
          <button type="button">Draft Google Meet invites</button>
          <button type="button">Export Monday decision slate</button>
        </div>
      </section>
    </div>
  )

  const renderMembers = () => (
    <div className="portal-grid portal-grid--ops" id="members">
      <section className="portal-panel portal-panel--span-2">
        <div className="portal-panel__header">
          <div>
            <h2>Ross ratio and member health</h2>
            <p>Useful for leadership planning, not for public display.</p>
          </div>
        </div>
        <div className="leadership-metrics">
          {leadershipMetrics.map((metric) => (
            <article className={`leadership-metric leadership-metric--${metric.tone}`} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <p>{metric.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="portal-panel">
        <div className="portal-panel__header">
          <div>
            <h2>Attendance controls</h2>
            <p>Future admin utility for events.</p>
          </div>
        </div>
        <div className="portal-stat-list">
          <div>
            <span>Tracked events</span>
            <strong>4</strong>
          </div>
          <div>
            <span>Active members</span>
            <strong>30+</strong>
          </div>
          <div>
            <span>Needs profile</span>
            <strong>11</strong>
          </div>
        </div>
      </section>
    </div>
  )

  const renderSponsors = () => (
    <section className="portal-panel" id="sponsors">
      <div className="portal-panel__header">
        <div>
          <h2>Corporate sponsors tracker</h2>
          <p>Lightweight sponsor CRM for relationships, follow-ups, and expected value.</p>
        </div>
        <button type="button">Add sponsor</button>
      </div>
      <div className="sponsor-list">
        {sponsors.map((sponsor) => (
          <article className="sponsor-row" key={sponsor.company}>
            <div>
              <span>{sponsor.stage}</span>
              <h3>{sponsor.company}</h3>
              <p>{sponsor.contact}</p>
            </div>
            <div>
              <strong>{sponsor.value}</strong>
              <small>{sponsor.nextStep}</small>
              <small>Owner: {sponsor.owner}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  )

  const renderPublishing = () => (
    <section className="portal-panel">
      <div className="portal-panel__header">
        <div>
          <h2>Publishing queue</h2>
          <p>Keep comms, news, and opportunities from living in scattered docs.</p>
        </div>
        <button type="button">Create post</button>
      </div>
      <div className="publishing-list">
        {publishingQueue.map((item) => (
          <article className="publishing-row" key={item.title}>
            <div>
              <span>{item.channel}</span>
              <h3>{item.title}</h3>
            </div>
            <mark className={`portal-status portal-status--${statusClass(item.status)}`}>{item.status}</mark>
            <small>Owner: {item.owner}</small>
          </article>
        ))}
      </div>
    </section>
  )

  const renderProfile = () => (
    <div className="portal-grid portal-grid--profile" id="profile">
      <section className="portal-panel">
        <div className="portal-panel__header">
          <div>
            <h2>Profile completion</h2>
            <p>Foundation for personalization, directory, and recruiting context.</p>
          </div>
          <span className="portal-pill">{effectiveMember.profileCompletion}%</span>
        </div>
        <div className="profile-progress" aria-label="Profile completion">
          <span style={{ width: `${effectiveMember.profileCompletion}%` }} />
        </div>
        <div className="profile-task-list">
          {['Add year and college', 'Set interest lanes', 'Choose directory visibility', 'Attach LinkedIn', 'Confirm notification preferences'].map((task, index) => (
            <label key={task}>
              <input type="checkbox" defaultChecked={index < 2} />
              <span>{task}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="portal-panel">
        <div className="portal-panel__header">
          <div>
            <h2>Privacy and role settings</h2>
            <p>View preference is not the same thing as permission.</p>
          </div>
        </div>
        <div className="privacy-list">
          <label>
            <span>Show me in member directory</span>
            <input type="checkbox" defaultChecked />
          </label>
          <label>
            <span>Allow BLDA mentor intro requests</span>
            <input type="checkbox" defaultChecked />
          </label>
          <label>
            <span>Share attendance with e-board only</span>
            <input type="checkbox" defaultChecked />
          </label>
        </div>
      </section>
    </div>
  )

  const renderActivePanel = () => {
    if (activeTab === 'Overview') return renderOverview()
    if (activeTab === 'Opportunities') return renderOpportunities()
    if (activeTab === 'Calendar') return renderCalendar()
    if (activeTab === 'Directory') return renderDirectory()
    if (activeTab === 'News') return renderNews()
    if (activeTab === 'Resources') return renderResources()
    if (activeTab === 'Recruiting') return renderRecruiting()
    if (activeTab === 'Members') return renderMembers()
    if (activeTab === 'Sponsors') return renderSponsors()
    if (activeTab === 'Publishing') return renderPublishing()
    return renderProfile()
  }

  return (
    <main id="main-content" className="dashboard-page">
      <section className="dashboard-page__hero">
        <div className="container">
          <Reveal>
            <div className="portal-shell">
              <header className="portal-header">
                <div>
                  <p className="section__label">UBLDA Portal</p>
                  <h1>{workspaceSummary.title}</h1>
                  <p>{workspaceSummary.text}</p>
                </div>
                <div className="portal-header__actions">
                  <div className="workspace-switcher" aria-label="Workspace preview">
                    <span>{workspaceSummary.label}</span>
                    <div>
                      <button
                        type="button"
                        className={workspace === 'member' ? 'workspace-switcher__button workspace-switcher__button--active' : 'workspace-switcher__button'}
                        onClick={() => updateWorkspace('member')}
                      >
                        Member
                      </button>
                      <button
                        type="button"
                        className={workspace === 'leadership' ? 'workspace-switcher__button workspace-switcher__button--active' : 'workspace-switcher__button'}
                        onClick={() => updateWorkspace('leadership')}
                      >
                        Leadership
                      </button>
                    </div>
                  </div>
                  <button type="button" className="portal-header__signout" onClick={signOut}>
                    Sign out
                  </button>
                </div>
              </header>

              <div className="portal-body">
                <aside className="portal-sidebar" aria-label="Portal sections">
                  <div className="portal-sidebar__account">
                    <strong>{effectiveMember.firstName} {effectiveMember.lastName}</strong>
                    <span>{effectiveMember.email}</span>
                  </div>
                  <nav>
                    {tabs.map((tab) => (
                      <button
                        type="button"
                        key={tab}
                        className={activeTab === tab ? 'portal-nav__button portal-nav__button--active' : 'portal-nav__button'}
                        onClick={() => setActiveTab(tab)}
                      >
                        {tab}
                      </button>
                    ))}
                  </nav>
                  <div className="portal-sidebar__note">
                    <span>Prototype note</span>
                    <p>Leadership preview is a UI model. Real e-board access should be assigned server-side.</p>
                  </div>
                </aside>

                <section className="portal-content" aria-live="polite">
                  <div className="portal-tabs" role="tablist" aria-label="Portal tabs">
                    {tabs.map((tab) => (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab}
                        key={tab}
                        className={activeTab === tab ? 'portal-tabs__button portal-tabs__button--active' : 'portal-tabs__button'}
                        onClick={() => setActiveTab(tab)}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  {renderActivePanel()}
                </section>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  )
}
