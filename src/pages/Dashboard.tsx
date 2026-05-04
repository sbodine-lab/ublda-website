import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMemberAuth } from '../hooks/useMemberAuth'
import { ADMIN_ACCOUNTS } from '../lib/dashboardAccess'
import type { AdminAccount, AdminScope, DashboardRole } from '../lib/dashboardAccess'
import {
  DASHBOARD_DATA_CHANGED_EVENT,
  DASHBOARD_DATA_CHANGED_STORAGE_KEY,
  readDashboardData,
} from '../lib/dashboardData'
import type { DashboardCalendarEvent, DashboardData } from '../lib/dashboardData'
import type {
  Candidate,
  MemberProfile,
  MemberSignup,
  Opportunity,
} from '../lib/memberData'
import {
  INTERVIEW_BLOCK_MINUTES,
  INTERVIEW_BUFFER_MINUTES,
  INTERVIEW_SLOTS,
  INTERVIEW_WINDOW_DAYS,
  getInterviewSlotByValue,
  sortSlotValues,
} from '../lib/interviews'
import { matchInterviewCandidate, matchOpenInterviewSlate } from '../lib/interviewMatching'
import type { InterviewerAvoidance } from '../lib/interviewMatching'
import './Dashboard.css'

type AdminDashboardTab = 'Overview' | 'Members' | 'E-board' | 'Recruiting' | 'Announcements' | 'Resources' | 'Settings'
type ActivityTone = 'neutral' | 'good' | 'watch'

type ManagedMember = {
  id: string
  name: string
  email: string
  uniqname: string
  role: DashboardRole
  status: string
  year: string
  lastActive: string
  source: string
}

type DashboardActivity = {
  id: string
  title: string
  detail: string
  time: string
  tone: ActivityTone
}

type AnnouncementRecord = {
  title: string
  channel: string
  owner: string
  status: 'Ready' | 'Draft' | 'Review'
  audience: 'Members' | 'E-board' | 'Candidates'
  scheduledFor: string
}

type ResourceRecord = {
  title: string
  category: string
  format: string
  nextStep: string
  status: 'Published' | 'Draft' | 'Needs review'
  owner: string
}

type DashboardWeather = {
  label: string
  temperature: string
  detail: string
  tone: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'neutral'
}

type ManualEventDraft = {
  title: string
  date: string
  startMinutes: number
  durationMinutes: number
  owner: string
  location: string
  notes: string
}

const adminTabs: AdminDashboardTab[] = ['Overview', 'Members', 'E-board', 'Recruiting', 'Announcements', 'Resources', 'Settings']
const memberTabs: AdminDashboardTab[] = ['Overview', 'Resources', 'Settings']
const scopeOptions: AdminScope[] = ['recruiting', 'members', 'announcements', 'resources', 'system']

const localPreviewMember: MemberProfile = {
  firstName: 'Sam',
  lastName: 'Bodine',
  uniqname: 'sbodine',
  email: 'sbodine@umich.edu',
  role: 'super-admin',
  adminTitle: 'Super Admin',
  adminScopes: ['recruiting', 'members', 'announcements', 'resources', 'system'],
  memberStatus: 'Super admin preview',
  attendance: {
    attended: 1,
    total: 4,
    streak: 1,
  },
  leadershipPosition: 'Full operating control',
  officerFocus: 'System, recruiting, members, announcements, resources',
  year: 'Update in profile',
  college: 'University of Michigan',
  track: 'Leadership operations',
  profileCompletion: 78,
  application: null,
}

const statusClass = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-')

const slotLabel = (value: string) => {
  const slot = getInterviewSlotByValue(value)
  return slot ? `${slot.dayLabel.replace(/^.*?, /, '')}, ${slot.timeLabel}` : value || 'Unassigned'
}

const timeOnly = (value: string) => {
  const slot = getInterviewSlotByValue(value)
  return slot ? slot.timeLabel.replace(' ET', '') : 'Open'
}

const tabFromLocation = (search: string, hash: string): AdminDashboardTab | null => {
  const queryTab = new URLSearchParams(search).get('tab')
  const normalized = queryTab ? queryTab.replace(/-/g, ' ') : ''
  const match = adminTabs.find((tab) => tab.toLowerCase().replace(/-/g, ' ') === normalized.toLowerCase())
  return match || (hash === '#recruiting' ? 'Recruiting' : null)
}

const initialTab = (): AdminDashboardTab => {
  return tabFromLocation(window.location.search, window.location.hash) || 'Overview'
}

const formatScope = (scope: AdminScope) => {
  if (scope === 'system') return 'system'
  return scope
}

const roleLabel = (role: DashboardRole) => {
  if (role === 'super-admin') return 'Super Admin'
  if (role === 'exec') return 'E-board Admin'
  return 'Member'
}

const uniqnameFromEmail = (email: string) => email.replace(/@.*$/, '')

const interviewerUniqname = (interviewer: { name: string } & Record<string, unknown>) => (
  typeof interviewer.uniqname === 'string' ? interviewer.uniqname : interviewer.name.toLowerCase().replace(/[^a-z0-9]+/g, '')
)

const managedMembersFromData = (
  signups: MemberSignup[],
  admins: AdminAccount[],
  currentMember: MemberProfile,
): ManagedMember[] => {
  const byEmail = new Map<string, ManagedMember>()

  admins.forEach((admin) => {
    const uniqname = uniqnameFromEmail(admin.email)
    byEmail.set(admin.email, {
      id: admin.email,
      name: admin.name,
      email: admin.email,
      uniqname,
      role: admin.role,
      status: admin.role === 'super-admin' ? 'Active super admin' : 'Active admin',
      year: 'E-board',
      lastActive: 'Today',
      source: 'Admin roster',
    })
  })

  signups.forEach((signup) => {
    const email = signup.email || `${signup.uniqname}@umich.edu`
    const existing = byEmail.get(email)
    byEmail.set(email, {
      id: signup.id || email,
      name: signup.name || existing?.name || email,
      email,
      uniqname: signup.uniqname || uniqnameFromEmail(email),
      role: existing?.role || 'member',
      status: existing?.status || signup.status || 'Member account active',
      year: signup.detail || existing?.year || 'Member',
      lastActive: signup.updatedAt ? new Date(signup.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recently',
      source: signup.source || existing?.source || 'Member sign-up',
    })
  })

  if (!byEmail.has(currentMember.email)) {
    byEmail.set(currentMember.email, {
      id: currentMember.email,
      name: `${currentMember.firstName} ${currentMember.lastName}`.trim(),
      email: currentMember.email,
      uniqname: currentMember.uniqname,
      role: currentMember.role,
      status: currentMember.memberStatus,
      year: currentMember.year,
      lastActive: 'Now',
      source: 'Signed-in account',
    })
  }

  return Array.from(byEmail.values()).sort((a, b) => {
    const rank = { 'super-admin': 0, exec: 1, member: 2 }
    if (rank[a.role] !== rank[b.role]) return rank[a.role] - rank[b.role]
    return a.name.localeCompare(b.name)
  })
}

const useNow = () => {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  return now
}

const formatMinutes = (totalMinutes: number) => {
  const hour24 = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  const hour12 = hour24 % 12 || 12
  const suffix = hour24 < 12 ? 'AM' : 'PM'
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`
}

const weatherFromCode = (code: number | null): Pick<DashboardWeather, 'label' | 'tone'> => {
  if (code === null) return { label: 'Campus forecast', tone: 'neutral' }
  if ([0, 1].includes(code)) return { label: 'Clear', tone: 'sunny' }
  if ([2, 3, 45, 48].includes(code)) return { label: 'Cloudy', tone: 'cloudy' }
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) return { label: 'Rain nearby', tone: 'rainy' }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Snow nearby', tone: 'snowy' }
  return { label: 'Campus forecast', tone: 'neutral' }
}

const emptyManualEventDraft = (): ManualEventDraft => ({
  title: '',
  date: INTERVIEW_WINDOW_DAYS[0].date,
  startMinutes: 9 * 60,
  durationMinutes: INTERVIEW_BLOCK_MINUTES,
  owner: 'Sam Bodine',
  location: 'Google Meet',
  notes: '',
})

function DashboardIcon({ name }: { name: AdminDashboardTab | 'time' | 'weather' | 'member' | 'health' | 'calendar' | 'announce' | 'resource' | 'database' | 'shield' | 'plus' | 'move' }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (name === 'Overview') return <svg {...common}><path d="M4 11.2 12 4l8 7.2" /><path d="M6.5 10.5v8h11v-8" /><path d="M10 18.5v-5h4v5" /></svg>
  if (name === 'Members') return <svg {...common}><path d="M7.5 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M16.5 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /><path d="M3.5 19c.7-3 2.6-4.5 5.7-4.5S14.2 16 15 19" /><path d="M14.2 14.6c2.9.1 4.8 1.5 5.6 4.4" /></svg>
  if (name === 'E-board') return <svg {...common}><path d="M12 3.5 18.8 7v5.2c0 4.2-2.7 7.3-6.8 8.3-4.1-1-6.8-4.1-6.8-8.3V7L12 3.5Z" /><path d="M9 12.1h6" /><path d="M12 9.1v6" /></svg>
  if (name === 'Recruiting') return <svg {...common}><path d="M5 5.5h14v14H5z" /><path d="M8 3.5v4" /><path d="M16 3.5v4" /><path d="M5 10h14" /><path d="m9 15 2 2 4-4" /></svg>
  if (name === 'Announcements') return <svg {...common}><path d="M4 13.5h3l9 4.5V6l-9 4.5H4v3Z" /><path d="M7 13.5 8.5 20" /><path d="M19.5 9.5c.7.7 1 1.5 1 2.5s-.3 1.8-1 2.5" /></svg>
  if (name === 'Resources') return <svg {...common}><path d="M5 4.5h9.5A3.5 3.5 0 0 1 18 8v11.5H7.5A2.5 2.5 0 0 1 5 17V4.5Z" /><path d="M8 8h6" /><path d="M8 12h6" /><path d="M7.5 19.5A2.5 2.5 0 0 1 10 17h8" /></svg>
  if (name === 'Settings') return <svg {...common}><path d="M4 7h8" /><path d="M16 7h4" /><path d="M14 4.8v4.4" /><path d="M4 12h3" /><path d="M11 12h9" /><path d="M9 9.8v4.4" /><path d="M4 17h10" /><path d="M18 17h2" /><path d="M16 14.8v4.4" /></svg>
  if (name === 'calendar') return <svg {...common}><path d="M5 5.5h14v14H5z" /><path d="M8 3.5v4" /><path d="M16 3.5v4" /><path d="M5 10h14" /><path d="M8.5 14h2" /><path d="M13.5 14h2" /></svg>
  if (name === 'member') return <svg {...common}><path d="M10 11.5a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6Z" /><path d="M3.8 19c.8-3.2 2.9-4.8 6.2-4.8 1.7 0 3 .4 4.1 1.2" /><path d="M17 13v6" /><path d="M14 16h6" /></svg>
  if (name === 'announce') return <svg {...common}><path d="M5 13.5h3.2l8.3 4.2V6.3l-8.3 4.2H5v3Z" /><path d="M8.2 13.5 9.5 19" /><path d="M19 10.5v3" /></svg>
  if (name === 'resource') return <svg {...common}><path d="M6 4.5h9a3 3 0 0 1 3 3v12H8a2 2 0 0 1-2-2v-13Z" /><path d="M9 8.5h5.5" /><path d="M9 12h5.5" /><path d="M9 15.5h3" /></svg>
  if (name === 'time') return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 7.5v5l3.2 2" /></svg>
  if (name === 'weather') return <svg {...common}><circle cx="12" cy="12" r="3.5" /><path d="M12 2.8v2" /><path d="M12 19.2v2" /><path d="M2.8 12h2" /><path d="M19.2 12h2" /><path d="m5.5 5.5 1.4 1.4" /><path d="m17.1 17.1 1.4 1.4" /><path d="m18.5 5.5-1.4 1.4" /><path d="m6.9 17.1-1.4 1.4" /></svg>
  if (name === 'database') return <svg {...common}><ellipse cx="12" cy="6" rx="6" ry="3" /><path d="M6 6v6c0 1.7 2.7 3 6 3s6-1.3 6-3V6" /><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" /></svg>
  if (name === 'shield') return <svg {...common}><path d="M12 3.5 18.5 6v5.4c0 4.2-2.5 7.3-6.5 9.1-4-1.8-6.5-4.9-6.5-9.1V6L12 3.5Z" /><path d="m9.5 12 1.7 1.7 3.6-4" /></svg>
  if (name === 'plus') return <svg {...common}><path d="M12 5v14" /><path d="M5 12h14" /></svg>
  if (name === 'move') return <svg {...common}><path d="M12 3v18" /><path d="m8 7 4-4 4 4" /><path d="m8 17 4 4 4-4" /><path d="M3 12h18" /><path d="m7 8-4 4 4 4" /><path d="m17 8 4 4-4 4" /></svg>
  return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>
}

function StatCard({
  icon,
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  icon: Parameters<typeof DashboardIcon>[0]['name']
  label: string
  value: string
  detail: string
  tone?: ActivityTone
}) {
  return (
    <article className={`admin-stat admin-stat--${tone}`}>
      <span className="admin-stat__icon"><DashboardIcon name={icon} /></span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        <small>{detail}</small>
      </div>
    </article>
  )
}

function StatusPill({ value }: { value: string }) {
  return <mark className={`admin-status admin-status--${statusClass(value)}`}>{value}</mark>
}

export default function Dashboard() {
  const { status, member, sessionToken, signOut } = useMemberAuth()
  const location = useLocation()
  const previewingLeadership = import.meta.env.DEV && window.location.search.includes('preview=leadership')
  const effectiveMember = useMemo(() => member || (previewingLeadership ? localPreviewMember : null), [member, previewingLeadership])
  const isLeadership = effectiveMember?.role === 'super-admin' || effectiveMember?.role === 'exec'
  const canManageSystem = effectiveMember?.role === 'super-admin'
  const tabs = isLeadership ? adminTabs : memberTabs
  const [activeTab, setActiveTab] = useState<AdminDashboardTab>(initialTab)
  const [dashboardData, setDashboardData] = useState<DashboardData>({})
  const [dashboardState, setDashboardState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [dashboardError, setDashboardError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [candidateRows, setCandidateRows] = useState<Candidate[]>([])
  const [memberRows, setMemberRows] = useState<ManagedMember[]>([])
  const [adminRows, setAdminRows] = useState<AdminAccount[]>(ADMIN_ACCOUNTS)
  const [interviewerAvoidance, setInterviewerAvoidance] = useState<InterviewerAvoidance>({})
  const [assignmentSaveState, setAssignmentSaveState] = useState<Record<string, string>>({})
  const [matchingNotice, setMatchingNotice] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [memberRoleFilter, setMemberRoleFilter] = useState<'all' | DashboardRole>('all')
  const [showAddMember, setShowAddMember] = useState(false)
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [newMember, setNewMember] = useState({ name: '', uniqname: '', role: 'member' as DashboardRole, year: '' })
  const [newAdmin, setNewAdmin] = useState({ name: '', uniqname: '', scopes: ['recruiting'] as AdminScope[] })
  const [announcementRows, setAnnouncementRows] = useState<AnnouncementRecord[]>([])
  const [opportunityRows, setOpportunityRows] = useState<Opportunity[]>([])
  const [resourceRows, setResourceRows] = useState<ResourceRecord[]>([])
  const [activityRows, setActivityRows] = useState<DashboardActivity[]>([])
  const [manualCalendarEvents, setManualCalendarEvents] = useState<DashboardCalendarEvent[]>([])
  const [showManualEventForm, setShowManualEventForm] = useState(false)
  const [manualEventDraft, setManualEventDraft] = useState<ManualEventDraft>(emptyManualEventDraft)
  const [calendarSaveState, setCalendarSaveState] = useState('')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [weather, setWeather] = useState<DashboardWeather>({
    label: 'Campus forecast',
    temperature: '--',
    detail: 'Ann Arbor, MI',
    tone: 'neutral',
  })
  const [toastMessage, setToastMessage] = useState('')
  const now = useNow()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Detroit'
  const liveInterviewerAvailability = useMemo(() => dashboardData.interviewerAvailability || [], [dashboardData.interviewerAvailability])
  const liveMemberSignups = useMemo(() => dashboardData.memberSignups || [], [dashboardData.memberSignups])
  const liveAdminAccounts = useMemo(() => dashboardData.adminAccounts?.length ? dashboardData.adminAccounts : ADMIN_ACCOUNTS, [dashboardData.adminAccounts])
  const interviewerAvailabilityBySlot = useMemo(() => {
    const bySlot = new Map<string, typeof liveInterviewerAvailability>()

    liveInterviewerAvailability.forEach((interviewer) => {
      const uniqueSlots = new Set(interviewer.availability)
      uniqueSlots.forEach((slotValue) => {
        if (!getInterviewSlotByValue(slotValue)) return
        const current = bySlot.get(slotValue) || []
        if (!current.some((row) => row.name === interviewer.name)) {
          bySlot.set(slotValue, [...current, interviewer])
        }
      })
    })

    return bySlot
  }, [liveInterviewerAvailability])
  const matchedCandidates = candidateRows.filter((candidate) => candidate.assignedSlot).length
  const unscheduledCandidates = candidateRows.filter((candidate) => !candidate.assignedSlot)
  const totalInterviewerSlots = new Set(liveInterviewerAvailability.flatMap((interviewer) => interviewer.availability)).size
  const pendingMembers = memberRows.filter((row) => /pending|request|review/i.test(row.status)).length
  const activeMembers = memberRows.filter((row) => row.role === 'member').length
  const liveAnnouncements = announcementRows.filter((row) => row.status === 'Ready').length
  const draftAnnouncements = announcementRows.filter((row) => row.status !== 'Ready').length
  const displayName = `${effectiveMember?.firstName || ''} ${effectiveMember?.lastName || ''}`.trim()
  const requestedTab = useMemo(() => tabFromLocation(location.search, location.hash), [location.hash, location.search])

  useEffect(() => {
    if (requestedTab && tabs.includes(requestedTab)) {
      setActiveTab(requestedTab)
      return
    }

    if (!tabs.includes(activeTab)) {
      setActiveTab('Overview')
    }
  }, [activeTab, requestedTab, tabs])

  useEffect(() => {
    if (!effectiveMember || !isLeadership || !sessionToken || previewingLeadership) {
      return
    }

    let cancelled = false
    setDashboardState('loading')
    setDashboardError('')

    readDashboardData(sessionToken)
      .then((nextData) => {
        if (cancelled) return
        setDashboardData(nextData)
        setCandidateRows(nextData.candidates || [])
        setAdminRows(nextData.adminAccounts?.length ? nextData.adminAccounts : ADMIN_ACCOUNTS)
        setManualCalendarEvents(nextData.calendarEvents || [])
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
  }, [effectiveMember, isLeadership, previewingLeadership, reloadKey, sessionToken])

  useEffect(() => {
    if (!effectiveMember) return
    setMemberRows(managedMembersFromData(liveMemberSignups, liveAdminAccounts, effectiveMember))
  }, [effectiveMember, liveAdminAccounts, liveMemberSignups])

  useEffect(() => {
    let cancelled = false

    fetch('https://api.open-meteo.com/v1/forecast?latitude=42.2808&longitude=-83.7430&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto')
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (cancelled || !payload?.current) return
        const current = payload.current as { temperature_2m?: number; weather_code?: number }
        const code = typeof current.weather_code === 'number' ? current.weather_code : null
        const summary = weatherFromCode(code)
        setWeather({
          ...summary,
          temperature: typeof current.temperature_2m === 'number' ? `${Math.round(current.temperature_2m)}°F` : '--',
          detail: 'Ann Arbor, MI',
        })
      })
      .catch(() => {
        if (!cancelled) {
          setWeather((current) => ({ ...current, detail: 'Ann Arbor, MI' }))
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!effectiveMember || !isLeadership || previewingLeadership) return

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
  }, [effectiveMember, isLeadership, previewingLeadership])

  const pushActivity = (title: string, detail: string, tone: ActivityTone = 'neutral') => {
    setToastMessage(title)
    setActivityRows((current) => [{
      id: `${Date.now()}-${title}`,
      title,
      detail,
      time: 'Just now',
      tone,
    }, ...current].slice(0, 6))
  }

  const updateCandidate = (id: string, updates: Partial<Candidate>) => {
    setCandidateRows((current) => current.map((candidate) => (
      candidate.id === id ? { ...candidate, ...updates } : candidate
    )))
  }

  const updateCandidateInterviewers = (id: string, index: number, value: string) => {
    setCandidateRows((current) => current.map((candidate) => {
      if (candidate.id !== id) return candidate

      const nextInterviewers = [...candidate.interviewers]
      nextInterviewers[index] = value
      return {
        ...candidate,
        interviewers: Array.from(new Set(nextInterviewers.filter(Boolean))).slice(0, 2),
      }
    }))
  }

  const toggleAvoidedInterviewer = (candidateId: string, interviewerName: string) => {
    setInterviewerAvoidance((current) => {
      const avoided = new Set(current[candidateId] || [])
      if (avoided.has(interviewerName)) {
        avoided.delete(interviewerName)
      } else {
        avoided.add(interviewerName)
      }

      return {
        ...current,
        [candidateId]: Array.from(avoided),
      }
    })
  }

  const applyCandidateMatch = (candidate: Candidate) => {
    const match = matchInterviewCandidate(
      candidate,
      liveInterviewerAvailability,
      candidateRows,
      interviewerAvoidance[candidate.id] || [],
    )

    if (!match) {
      setAssignmentSaveState((current) => ({ ...current, [candidate.id]: 'No conflict-safe overlap found.' }))
      return
    }

    updateCandidate(candidate.id, {
      assignedSlot: match.assignedSlot,
      interviewers: match.interviewers,
      status: 'Matched',
    })
    setAssignmentSaveState((current) => ({ ...current, [candidate.id]: `Matched ${match.interviewers.length} interviewer${match.interviewers.length === 1 ? '' : 's'}.` }))
    pushActivity('Interview auto-matched', `${candidate.name} was matched to ${slotLabel(match.assignedSlot)}.`, 'good')
  }

  const applySlateMatch = () => {
    const result = matchOpenInterviewSlate(candidateRows, liveInterviewerAvailability, interviewerAvoidance)
    setCandidateRows(result.candidates)
    setMatchingNotice(result.matchedCount
      ? `Auto-matched ${result.matchedCount} candidate${result.matchedCount === 1 ? '' : 's'} using overlap, capacity, and conflict flags.`
      : 'No open candidates had a conflict-safe overlap.')
    pushActivity('Auto-match run', result.matchedCount ? `${result.matchedCount} candidates matched.` : 'No new matches found.', result.matchedCount ? 'good' : 'watch')
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
      pushActivity('Interview saved', `${candidate.name} assignment saved to the dashboard backend.`, 'good')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save assignment.'
      setAssignmentSaveState((current) => ({ ...current, [candidate.id]: message }))
    }
  }

  const addMember = () => {
    const trimmedName = newMember.name.trim()
    const uniqname = newMember.uniqname.trim().toLowerCase().replace(/@.*$/, '')
    if (!trimmedName || !uniqname) return

    const row: ManagedMember = {
      id: `${uniqname}@umich.edu`,
      name: trimmedName,
      email: `${uniqname}@umich.edu`,
      uniqname,
      role: newMember.role,
      status: newMember.role === 'member' ? 'Member account active' : 'Active admin',
      year: newMember.year || 'Member',
      lastActive: 'Just added',
      source: 'Manual dashboard add',
    }
    setMemberRows((current) => [row, ...current.filter((memberRow) => memberRow.email !== row.email)])
    setNewMember({ name: '', uniqname: '', role: 'member', year: '' })
    setShowAddMember(false)
    pushActivity('Member added', `${row.name} was added as ${roleLabel(row.role)}.`, 'good')
  }

  const updateMemberRole = (email: string, role: DashboardRole) => {
    setMemberRows((current) => current.map((row) => (
      row.email === email ? { ...row, role, status: role === 'member' ? 'Member account active' : 'Active admin' } : row
    )))
    pushActivity('Role updated', `${email} changed to ${roleLabel(role)}.`, 'good')
  }

  const removeMember = (email: string) => {
    setMemberRows((current) => current.filter((row) => row.email !== email))
    pushActivity('Member removed', `${email} was removed from the dashboard list.`, 'watch')
  }

  const addAdmin = () => {
    const name = newAdmin.name.trim()
    const uniqname = newAdmin.uniqname.trim().toLowerCase().replace(/@.*$/, '')
    if (!name || !uniqname) return

    const admin: AdminAccount = {
      name,
      email: `${uniqname}@umich.edu`,
      title: 'Exec Admin',
      role: 'exec',
      scopes: newAdmin.scopes,
    }
    setAdminRows((current) => [admin, ...current.filter((row) => row.email !== admin.email)])
    setMemberRows((current) => current.map((row) => (
      row.email === admin.email ? { ...row, role: 'exec', status: 'Active admin' } : row
    )))
    setNewAdmin({ name: '', uniqname: '', scopes: ['recruiting'] })
    setShowAddAdmin(false)
    pushActivity('E-board admin invited', `${admin.name} was added with ${admin.scopes.length} scopes.`, 'good')
  }

  const removeAdmin = (email: string) => {
    setAdminRows((current) => current.filter((admin) => admin.email !== email || admin.role === 'super-admin'))
    pushActivity('Admin access changed', `${email} was removed from the e-board admin roster.`, 'watch')
  }

  const persistCalendarEvent = async (event: DashboardCalendarEvent, action: 'save' | 'delete') => {
    if (previewingLeadership) {
      setCalendarSaveState('Preview mode. Sign in to persist calendar edits.')
      return
    }

    if (!sessionToken) {
      setCalendarSaveState('Sign in with an admin account before saving calendar edits.')
      return
    }

    const response = await fetch('/api/dashboard-calendar-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action === 'delete'
        ? { action, id: event.id, sessionToken }
        : { action, sessionToken, ...event }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(payload?.error || 'Could not save calendar event.')
  }

  const addManualCalendarEvent = async () => {
    const title = manualEventDraft.title.trim()
    if (!title) {
      setCalendarSaveState('Add an event title first.')
      return
    }

    const nowStamp = new Date().toISOString()
    const event: DashboardCalendarEvent = {
      id: `manual_${Date.now()}`,
      title,
      date: manualEventDraft.date,
      startMinutes: manualEventDraft.startMinutes,
      durationMinutes: manualEventDraft.durationMinutes,
      owner: manualEventDraft.owner.trim() || displayName || 'UBLDA',
      location: manualEventDraft.location.trim() || 'Google Meet',
      notes: manualEventDraft.notes.trim(),
      createdAt: nowStamp,
      updatedAt: nowStamp,
    }

    setManualCalendarEvents((current) => [...current, event])
    setManualEventDraft(emptyManualEventDraft())
    setShowManualEventForm(false)
    setCalendarSaveState('Saving event...')
    try {
      await persistCalendarEvent(event, 'save')
      setCalendarSaveState('Calendar event saved.')
      pushActivity('Calendar event added', `${event.title} added to ${INTERVIEW_WINDOW_DAYS.find((day) => day.date === event.date)?.shortLabel || event.date}.`, 'good')
    } catch (error) {
      setCalendarSaveState(error instanceof Error ? error.message : 'Could not save calendar event.')
    }
  }

  const removeManualCalendarEvent = async (event: DashboardCalendarEvent) => {
    setManualCalendarEvents((current) => current.filter((row) => row.id !== event.id))
    setCalendarSaveState('Deleting event...')
    try {
      await persistCalendarEvent(event, 'delete')
      setCalendarSaveState('Calendar event deleted.')
      pushActivity('Calendar event deleted', event.title, 'watch')
    } catch (error) {
      setCalendarSaveState(error instanceof Error ? error.message : 'Could not delete calendar event.')
    }
  }

  const pushAnnouncement = (title: string) => {
    setAnnouncementRows((current) => current.map((row) => (
      row.title === title ? { ...row, status: 'Ready', scheduledFor: 'Pushed just now' } : row
    )))
    pushActivity('Announcement pushed', `${title} is now live.`, 'good')
  }

  const deleteAnnouncement = (title: string) => {
    setAnnouncementRows((current) => current.filter((row) => row.title !== title))
    pushActivity('Announcement deleted', title, 'watch')
  }

  const toggleOpportunity = (title: string) => {
    setOpportunityRows((current) => current.map((row) => (
      row.title === title ? { ...row, saved: !row.saved } : row
    )))
    pushActivity('Opportunity updated', title, 'good')
  }

  const updateResourceStatus = (title: string, status: ResourceRecord['status']) => {
    setResourceRows((current) => current.map((row) => (
      row.title === title ? { ...row, status } : row
    )))
    pushActivity('Resource updated', `${title} marked ${status.toLowerCase()}.`, 'good')
  }

  const filteredMembers = memberRows.filter((row) => {
    const haystack = `${row.name} ${row.email} ${row.uniqname}`.toLowerCase()
    const matchesSearch = haystack.includes(memberSearch.toLowerCase())
    const matchesRole = memberRoleFilter === 'all' || row.role === memberRoleFilter
    return matchesSearch && matchesRole
  })

  const interviewerLoad = useMemo(() => {
    const loads = new Map<string, number>()
    candidateRows.forEach((candidate) => {
      if (!candidate.assignedSlot) return
      candidate.interviewers.forEach((interviewer) => loads.set(interviewer, (loads.get(interviewer) || 0) + 1))
    })
    return loads
  }, [candidateRows])

  const slotsByDay = useMemo(() => INTERVIEW_WINDOW_DAYS.map((day) => {
    const coverage = INTERVIEW_SLOTS
      .filter((slot) => slot.start.includes(day.date))
      .map((slot) => ({
        slot,
        interviewers: interviewerAvailabilityBySlot.get(slot.value) || [],
      }))

    return {
      ...day,
      scheduled: sortSlotValues(candidateRows.map((candidate) => candidate.assignedSlot).filter(Boolean)).filter((slotValue) => slotValue.includes(day.date)),
      manualEvents: manualCalendarEvents
        .filter((event) => event.date === day.date)
        .sort((a, b) => a.startMinutes - b.startMinutes),
      coverage,
      coveredCount: coverage.filter((row) => row.interviewers.length > 0).length,
    }
  }), [candidateRows, interviewerAvailabilityBySlot, manualCalendarEvents])

  if (status === 'loading') {
    return (
      <main id="main-content" className="admin-dashboard admin-dashboard--loading">
        <p>Loading dashboard...</p>
      </main>
    )
  }

  if (!effectiveMember) {
    return (
      <main id="main-content" className="admin-dashboard-gate">
        <section>
          <p>UBLDA Portal</p>
          <h1>The UBLDA dashboard is for signed-in members.</h1>
          <p>Members use the dashboard for resources and updates. Admins use it for members, e-board operations, recruiting, announcements, and settings.</p>
          <div>
            <Link to="/signin">Sign in</Link>
            <Link to="/interviewer-availability">E-board availability form</Link>
          </div>
        </section>
      </main>
    )
  }

  const greetingHour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone }).format(now))
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening'
  const timeLabel = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).format(now)
  const dateLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone }).format(now)
  const backendMessage = dashboardError || dashboardData.backendStatus?.message || (previewingLeadership ? 'Preview dashboard data' : 'Waiting for dashboard data')
  const backendReady = dashboardState === 'ready' || previewingLeadership

  const renderOverview = () => (
    <div className="admin-dashboard__stack">
      <section className="admin-overview-hero">
        <div>
          <h1>{greeting}, {effectiveMember.firstName}.</h1>
          <p>Here is what is happening across UBLDA today.</p>
        </div>
        <div className="admin-overview-hero__cards">
          <article className="admin-overview-card admin-overview-card--time">
            <span><DashboardIcon name="time" /></span>
            <div>
              <small>Local time</small>
              <strong>{timeLabel}</strong>
              <em>{dateLabel}</em>
            </div>
          </article>
          <article className={`admin-overview-card admin-overview-card--weather admin-overview-card--${weather.tone}`}>
            <span className="admin-overview-hero__weather"><DashboardIcon name="weather" /></span>
            <div>
              <small>{weather.label}</small>
              <strong>{weather.temperature}</strong>
              <em>{weather.detail}</em>
            </div>
          </article>
        </div>
      </section>

      {isLeadership && (
        <section className="admin-panel admin-panel--compact">
          <div className="admin-panel__title">
            <h2>Quick actions</h2>
          </div>
          <div className="admin-quick-actions">
            <button type="button" onClick={() => { setActiveTab('Members'); setShowAddMember(true) }}><DashboardIcon name="plus" /> Add member</button>
            <button type="button" onClick={() => { setActiveTab('E-board'); setShowAddAdmin(true) }}><DashboardIcon name="E-board" /> Invite admin</button>
            <button type="button" onClick={() => setActiveTab('Announcements')}><DashboardIcon name="Announcements" /> Create announcement</button>
            <button type="button" onClick={() => setActiveTab('Recruiting')}><DashboardIcon name="calendar" /> Open interview calendar</button>
          </div>
        </section>
      )}

      <section className="admin-stat-grid">
        <StatCard icon="Members" label="Active members" value={String(activeMembers)} detail={`${memberRows.length} total accounts`} />
        <StatCard icon="E-board" label="E-board admins" value={String(adminRows.length)} detail={adminRows.every((admin) => admin.role !== 'member') ? 'All active' : 'Review roles'} />
        <StatCard icon="member" label="Pending account requests" value={String(pendingMembers)} detail={pendingMembers ? 'Requires review' : 'Clear'} tone={pendingMembers ? 'watch' : 'good'} />
        <StatCard icon="announce" label="Announcements live" value={String(liveAnnouncements)} detail={`${draftAnnouncements} draft${draftAnnouncements === 1 ? '' : 's'}`} />
      </section>

      <div className="admin-dashboard__three">
        <section className="admin-panel">
          <div className="admin-panel__title">
            <h2>Today</h2>
            <button type="button" onClick={() => setActiveTab('Settings')}>View full task list</button>
          </div>
          <div className="admin-task-list">
            {[
              ['Review pending account requests', `${pendingMembers} request${pendingMembers === 1 ? '' : 's'} awaiting approval`, pendingMembers ? 'Due today' : 'Clear'],
              ['Upcoming interview slots', `${matchedCandidates} interview${matchedCandidates === 1 ? '' : 's'} scheduled`, matchedCandidates ? 'On schedule' : 'Open'],
              ['Pending announcements', `${draftAnnouncements} announcement${draftAnnouncements === 1 ? '' : 's'} ready to review`, draftAnnouncements ? '4:00 PM' : 'Clear'],
              ['Resource review', `${resourceRows.filter((row) => row.status === 'Needs review').length} resource${resourceRows.filter((row) => row.status === 'Needs review').length === 1 ? '' : 's'} need content update`, 'All day'],
            ].map(([title, detail, meta]) => (
              <article className="admin-task-row" key={title}>
                <span><DashboardIcon name={title.includes('interview') ? 'Recruiting' : title.includes('announcement') ? 'Announcements' : title.includes('Resource') ? 'Resources' : 'Members'} /></span>
                <div>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </div>
                <em>{meta}</em>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__title">
            <h2>System health</h2>
            <button type="button" onClick={() => setReloadKey((current) => current + 1)}>Refresh</button>
          </div>
          <div className="admin-health-list">
            <article>
              <span><DashboardIcon name="database" /></span>
              <div>
                <strong>Backend</strong>
                <small>Private Vercel store</small>
              </div>
              <StatusPill value={backendReady ? 'Healthy' : dashboardState} />
            </article>
            <article>
              <span><DashboardIcon name="shield" /></span>
              <div>
                <strong>Authentication</strong>
                <small>{roleLabel(effectiveMember.role)}</small>
              </div>
              <StatusPill value="Active" />
            </article>
            <article>
              <span><DashboardIcon name="database" /></span>
              <div>
                <strong>Last sync</strong>
                <small>{backendMessage}</small>
              </div>
              <StatusPill value={dashboardState === 'error' ? 'Review' : 'Synced'} />
            </article>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__title">
            <h2>Recent activity</h2>
            <button type="button" onClick={() => setActiveTab('Settings')}>View all</button>
          </div>
          <div className="admin-activity-list">
            {activityRows.length === 0 && <p className="admin-empty-copy">No admin activity recorded in this session yet.</p>}
            {activityRows.map((item) => (
              <article className={`admin-activity admin-activity--${item.tone}`} key={item.id}>
                <span />
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
                <time>{item.time}</time>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )

  const renderMembers = () => (
    <div className="admin-dashboard__stack">
      <section className="admin-page-heading">
        <div>
          <h1>Members</h1>
          <p>Manage member accounts, requests, statuses, and dashboard roles.</p>
        </div>
        <div className="admin-page-heading__actions">
          <button type="button" onClick={() => setShowAddMember((current) => !current)}>Add member</button>
          <button type="button" onClick={() => pushActivity('CSV import staged', 'Import is ready for backend persistence.', 'neutral')}>Import CSV</button>
          <button type="button" onClick={() => pushActivity('Member export prepared', `${filteredMembers.length} rows ready.`, 'good')}>Export</button>
        </div>
      </section>

      <div className="admin-role-banner">
        <strong>{canManageSystem ? 'Super Admin: full member controls' : 'Admin: scoped member controls'}</strong>
        <span>{canManageSystem ? 'You can add, remove, and change roles from this workspace.' : 'Admins can review members within their assigned scopes.'}</span>
      </div>

      <section className="admin-stat-grid">
        <StatCard icon="Members" label="Active members" value={String(activeMembers)} detail={`${memberRows.length} total accounts`} />
        <StatCard icon="member" label="Pending requests" value={String(pendingMembers)} detail={pendingMembers ? 'Needs review' : 'Clear'} tone={pendingMembers ? 'watch' : 'good'} />
        <StatCard icon="Recruiting" label="Leadership candidates" value={String(candidateRows.length)} detail={`${matchedCandidates} matched`} />
        <StatCard icon="shield" label="Recently removed" value="0" detail="No removals this session" />
      </section>

      {showAddMember && (
        <section className="admin-panel admin-form-panel">
          <div className="admin-form-grid">
            <label>Name<input value={newMember.name} onChange={(event) => setNewMember((current) => ({ ...current, name: event.target.value }))} placeholder="Avery Chen" /></label>
            <label>Uniqname<input value={newMember.uniqname} onChange={(event) => setNewMember((current) => ({ ...current, uniqname: event.target.value }))} placeholder="averychen" /></label>
            <label>Role<select value={newMember.role} onChange={(event) => setNewMember((current) => ({ ...current, role: event.target.value as DashboardRole }))}><option value="member">Member</option><option value="exec">E-board Admin</option><option value="super-admin">Super Admin</option></select></label>
            <label>Year / detail<input value={newMember.year} onChange={(event) => setNewMember((current) => ({ ...current, year: event.target.value }))} placeholder="Sophomore" /></label>
          </div>
          <div className="admin-form-actions">
            <button type="button" onClick={addMember}>Create member</button>
            <button type="button" onClick={() => setShowAddMember(false)}>Cancel</button>
          </div>
        </section>
      )}

      <div className="admin-dashboard__two admin-dashboard__two--wide">
        <section className="admin-panel">
          <div className="admin-table-toolbar">
            <div>
              <h2>Member directory</h2>
              <p>{filteredMembers.length} visible accounts</p>
            </div>
            <div>
              <input type="search" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search name, email, uniqname" />
              <select value={memberRoleFilter} onChange={(event) => setMemberRoleFilter(event.target.value as typeof memberRoleFilter)}>
                <option value="all">All roles</option>
                <option value="member">Members</option>
                <option value="exec">E-board admins</option>
                <option value="super-admin">Super admins</option>
              </select>
            </div>
          </div>
          <div className="admin-table admin-table--members">
            <div className="admin-table__row admin-table__row--head">
              <span>Name</span><span>Email / uniqname</span><span>Role</span><span>Status</span><span>Year</span><span>Last active</span><span>Actions</span>
            </div>
            {filteredMembers.map((row) => (
              <div className="admin-table__row" key={row.email}>
                <strong>{row.name}</strong>
                <span>{row.email}<small>{row.uniqname}</small></span>
                <select value={row.role} disabled={!canManageSystem && row.role === 'super-admin'} onChange={(event) => updateMemberRole(row.email, event.target.value as DashboardRole)}>
                  <option value="member">Member</option>
                  <option value="exec">E-board Admin</option>
                  <option value="super-admin">Super Admin</option>
                </select>
                <StatusPill value={row.status} />
                <span>{row.year}</span>
                <span>{row.lastActive}</span>
                <div className="admin-row-actions">
                  <button type="button" onClick={() => pushActivity('Member opened', row.name, 'neutral')}>View</button>
                  <button type="button" disabled={!canManageSystem || row.email === effectiveMember.email} onClick={() => removeMember(row.email)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="admin-side-stack">
          <section className="admin-panel">
            <div className="admin-panel__title"><h2>Account requests</h2></div>
            <div className="admin-mini-list">
              {memberRows.filter((row) => /pending|request|review/i.test(row.status)).slice(0, 4).map((row) => (
                <article key={row.email}>
                  <div><strong>{row.name}</strong><small>{row.email}</small></div>
                  <button type="button" onClick={() => updateMemberRole(row.email, 'member')}>Approve</button>
                </article>
              ))}
              {pendingMembers === 0 && <p className="admin-empty-copy">No account requests are waiting.</p>}
            </div>
          </section>
          <section className="admin-panel">
            <div className="admin-panel__title"><h2>Recent role changes</h2></div>
            <div className="admin-activity-list">
              {activityRows.slice(0, 4).map((item) => <article className="admin-activity" key={item.id}><span /><div><strong>{item.title}</strong><small>{item.detail}</small></div></article>)}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )

  const renderEboard = () => (
    <div className="admin-dashboard__stack">
      <section className="admin-page-heading">
        <div>
          <h1>E-board</h1>
          <p>Manage executive board accounts, scopes, and interview availability coverage.</p>
        </div>
        <div className="admin-page-heading__actions">
          <button type="button" onClick={() => setShowAddAdmin((current) => !current)}>Invite e-board admin</button>
          <button type="button" onClick={() => pushActivity('Scopes reviewed', 'E-board permission controls opened.', 'neutral')}>Manage scopes</button>
          <button type="button" onClick={() => pushActivity('Availability exported', `${liveInterviewerAvailability.length} responses exported.`, 'good')}>Export availability</button>
        </div>
      </section>

      <div className="admin-role-banner">
        <strong>{canManageSystem ? 'Super Admin can edit roles and scopes.' : 'Admins can view availability and manage assigned interviews.'}</strong>
        <span>Scope changes update the current dashboard session immediately.</span>
      </div>

      <section className="admin-stat-grid">
        <StatCard icon="E-board" label="E-board admins" value={String(adminRows.length)} detail="Admin roster" />
        <StatCard icon="Recruiting" label="Availability responses" value={String(liveInterviewerAvailability.length)} detail="Submitted forms" />
        <StatCard icon="calendar" label="Open interview capacity" value={String(totalInterviewerSlots)} detail="Unique slots covered" />
        <StatCard icon="member" label="Missing availability" value={String(Math.max(adminRows.length - liveInterviewerAvailability.length, 0))} detail="Need reminders" tone={adminRows.length > liveInterviewerAvailability.length ? 'watch' : 'good'} />
      </section>

      {showAddAdmin && (
        <section className="admin-panel admin-form-panel">
          <div className="admin-form-grid">
            <label>Name<input value={newAdmin.name} onChange={(event) => setNewAdmin((current) => ({ ...current, name: event.target.value }))} placeholder="Maya Patel" /></label>
            <label>Uniqname<input value={newAdmin.uniqname} onChange={(event) => setNewAdmin((current) => ({ ...current, uniqname: event.target.value }))} placeholder="mayap" /></label>
            <fieldset>
              <legend>Scopes</legend>
              <div className="admin-scope-picker">
                {scopeOptions.filter((scope) => scope !== 'system').map((scope) => (
                  <label key={scope}><input type="checkbox" checked={newAdmin.scopes.includes(scope)} onChange={() => setNewAdmin((current) => ({ ...current, scopes: current.scopes.includes(scope) ? current.scopes.filter((item) => item !== scope) : [...current.scopes, scope] }))} />{formatScope(scope)}</label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="admin-form-actions">
            <button type="button" onClick={addAdmin}>Invite admin</button>
            <button type="button" onClick={() => setShowAddAdmin(false)}>Cancel</button>
          </div>
        </section>
      )}

      <div className="admin-dashboard__two admin-dashboard__two--wide">
        <section className="admin-panel">
          <div className="admin-panel__title"><h2>Executive board accounts</h2><Link to="/interviewer-availability">Open availability form</Link></div>
          <div className="admin-table admin-table--eboard">
            <div className="admin-table__row admin-table__row--head">
              <span>Name</span><span>Email</span><span>Admin role</span><span>Availability</span><span>Max interviews</span><span>Actions</span>
            </div>
            {adminRows.map((admin) => {
              const availability = liveInterviewerAvailability.find((row) => row.name === admin.name || interviewerUniqname(row as { name: string } & Record<string, unknown>) === uniqnameFromEmail(admin.email))
              return (
                <div className="admin-table__row" key={admin.email}>
                  <strong>{admin.name}</strong>
                  <span>{admin.email}</span>
                  <StatusPill value={roleLabel(admin.role)} />
                  <span>{availability ? `${availability.availability.length} slots` : 'Missing'}</span>
                  <span>{availability?.maxInterviews || 'As needed'}</span>
                  <div className="admin-row-actions">
                    <button type="button" onClick={() => pushActivity('Availability opened', admin.name, 'neutral')}>View</button>
                    <button type="button" disabled={!canManageSystem || admin.role === 'super-admin'} onClick={() => removeAdmin(admin.email)}>Remove</button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <aside className="admin-side-stack">
          <section className="admin-panel">
            <div className="admin-panel__title"><h2>Availability coverage</h2></div>
            <div className="admin-coverage-list">
              {INTERVIEW_WINDOW_DAYS.map((day) => {
                const covered = new Set(liveInterviewerAvailability.flatMap((row) => row.availability.filter((slot) => slot.includes(day.date)))).size
                const total = INTERVIEW_SLOTS.filter((slot) => slot.start.includes(day.date)).length || 1
                return (
                  <article key={day.date}>
                    <div><strong>{day.shortLabel}</strong><small>{covered}/{total} slots covered</small></div>
                    <span><i style={{ width: `${Math.min((covered / total) * 100, 100)}%` }} /></span>
                  </article>
                )
              })}
            </div>
          </section>
          <section className="admin-panel">
            <div className="admin-panel__title"><h2>Missing responses</h2></div>
            <div className="admin-mini-list">
              {adminRows.filter((admin) => !liveInterviewerAvailability.some((row) => row.name === admin.name || interviewerUniqname(row as { name: string } & Record<string, unknown>) === uniqnameFromEmail(admin.email))).map((admin) => (
                <article key={admin.email}><div><strong>{admin.name}</strong><small>{admin.email}</small></div><button type="button" onClick={() => pushActivity('Reminder staged', `${admin.name} availability reminder is ready.`, 'neutral')}>Remind</button></article>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )

  const renderRecruiting = () => (
    <div className="admin-dashboard__stack">
      <section className="admin-page-heading">
        <div>
          <h1>Recruiting</h1>
          <p>Move interview slots, assign interviewers, review candidate availability, and keep the Google Meet schedule realistic.</p>
        </div>
        <div className="admin-page-heading__actions">
          <button type="button" onClick={applySlateMatch}>Auto-match</button>
          <button type="button" onClick={() => setShowManualEventForm((current) => !current)}>Add event</button>
          <Link to="/apply">Candidate form</Link>
          <Link to="/interviewer-availability">E-board form</Link>
        </div>
      </section>

      <section className="admin-recruiting-controls">
        <div><strong>May 7-10</strong><span>Google Meet</span></div>
        <div><strong>{INTERVIEW_BLOCK_MINUTES}-minute interviews</strong><span>{INTERVIEW_BUFFER_MINUTES}-minute buffers</span></div>
        <div><strong>{candidateRows.length} candidates</strong><span>{matchedCandidates} scheduled</span></div>
        <button type="button" onClick={() => setReloadKey((current) => current + 1)}>Refresh data</button>
      </section>

      {matchingNotice && <div className="admin-role-banner"><strong>Matcher</strong><span>{matchingNotice}</span></div>}
      {calendarSaveState && <div className="admin-role-banner"><strong>Calendar</strong><span>{calendarSaveState}</span></div>}

      {showManualEventForm && (
        <section className="admin-panel admin-form-panel">
          <div className="admin-panel__title"><h2>Add calendar event</h2><span>Manual entries sit beside matched interviews.</span></div>
          <div className="admin-form-grid admin-form-grid--calendar">
            <label>Title<input value={manualEventDraft.title} onChange={(event) => setManualEventDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Interview block hold" /></label>
            <label>Date<select value={manualEventDraft.date} onChange={(event) => setManualEventDraft((current) => ({ ...current, date: event.target.value }))}>{INTERVIEW_WINDOW_DAYS.map((day) => <option value={day.date} key={day.date}>{day.shortLabel}</option>)}</select></label>
            <label>Start<select value={manualEventDraft.startMinutes} onChange={(event) => setManualEventDraft((current) => ({ ...current, startMinutes: Number(event.target.value) }))}>{INTERVIEW_SLOTS.filter((slot) => slot.start.includes(manualEventDraft.date)).map((slot) => <option value={slot.startMinutes} key={slot.value}>{timeOnly(slot.value)}</option>)}</select></label>
            <label>Duration<select value={manualEventDraft.durationMinutes} onChange={(event) => setManualEventDraft((current) => ({ ...current, durationMinutes: Number(event.target.value) }))}><option value={30}>30 min</option><option value={50}>30 min + buffer</option><option value={60}>60 min</option><option value={90}>90 min</option></select></label>
            <label>Owner<input value={manualEventDraft.owner} onChange={(event) => setManualEventDraft((current) => ({ ...current, owner: event.target.value }))} placeholder={displayName || 'UBLDA'} /></label>
            <label>Location<input value={manualEventDraft.location} onChange={(event) => setManualEventDraft((current) => ({ ...current, location: event.target.value }))} placeholder="Google Meet" /></label>
            <label className="admin-form-grid__wide">Notes<textarea value={manualEventDraft.notes} onChange={(event) => setManualEventDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional details for the schedule." /></label>
          </div>
          <div className="admin-form-actions">
            <button type="button" onClick={() => void addManualCalendarEvent()}>Add to calendar</button>
            <button type="button" onClick={() => setShowManualEventForm(false)}>Cancel</button>
          </div>
        </section>
      )}

      <div className="admin-dashboard__two admin-dashboard__two--calendar">
        <section className="admin-panel admin-calendar-panel">
          <div className="admin-panel__title"><h2>Interview calendar</h2><span>{INTERVIEW_BLOCK_MINUTES} min + {INTERVIEW_BUFFER_MINUTES} min buffer spacing</span></div>
          <div className="admin-calendar">
            {slotsByDay.map((day) => (
              <section className="admin-calendar__day" key={day.date}>
                <header><strong>{day.shortLabel}</strong><span>{day.scheduled.length + day.manualEvents.length} scheduled · {day.coveredCount}/{day.coverage.length} covered</span></header>
                <div className="admin-calendar__body">
                  <section className="admin-calendar-coverage" aria-label={`E-board availability for ${day.shortLabel}`}>
                    <div className="admin-calendar-coverage__header">
                      <strong>E-board availability</strong>
                      <span>{day.coveredCount}/{day.coverage.length} slots</span>
                    </div>
                    <div className="admin-calendar-coverage__slots">
                      {day.coverage.map(({ slot, interviewers }) => {
                        const coverageClass = interviewers.length >= 2 ? 'admin-coverage-slot--strong' : interviewers.length === 1 ? 'admin-coverage-slot--covered' : 'admin-coverage-slot--empty'
                        const interviewerNames = interviewers.map((interviewer) => interviewer.name).join(', ')

                        return (
                          <article className={`admin-coverage-slot ${coverageClass}`} key={slot.value} title={interviewerNames || 'No e-board availability submitted for this slot'}>
                            <time>{slot.timeLabel.replace(' ET', '')}</time>
                            <strong aria-label={interviewerNames || 'No e-board availability'}>{interviewers.length}</strong>
                          </article>
                        )
                      })}
                    </div>
                  </section>
                  {day.scheduled.length === 0 && day.manualEvents.length === 0 && <p className="admin-empty-copy">No interviews scheduled.</p>}
                  {day.manualEvents.map((event) => (
                    <article className="admin-interview-card admin-interview-card--manual" key={event.id}>
                      <button type="button" aria-label={`Delete ${event.title}`} onClick={() => void removeManualCalendarEvent(event)}>x</button>
                      <time>{formatMinutes(event.startMinutes)}-{formatMinutes(event.startMinutes + event.durationMinutes)}</time>
                      <strong>{event.title}</strong>
                      <small>{event.location} · {event.owner}</small>
                      {event.notes && <small>{event.notes}</small>}
                    </article>
                  ))}
                  {day.scheduled.map((slotValue) => {
                    const candidate = candidateRows.find((row) => row.assignedSlot === slotValue)
                    if (!candidate) return null
                    return (
                      <article className="admin-interview-card" key={`${candidate.id}-${slotValue}`}>
                        <button type="button" aria-label={`Move ${candidate.name}`}><DashboardIcon name="move" /></button>
                        <time>{timeOnly(slotValue)}</time>
                        <strong>{candidate.name}</strong>
                        <small>{candidate.rolePreferences.slice(0, 2).join(' / ')}</small>
                        <div>{candidate.interviewers.map((interviewer) => <span key={interviewer}>{interviewer.split(' ').map((part) => part[0]).join('')}</span>)}</div>
                        <select value={candidate.assignedSlot} onChange={(event) => updateCandidate(candidate.id, { assignedSlot: event.target.value, status: event.target.value ? 'Matched' : 'Needs match' })}>
                          {INTERVIEW_SLOTS.map((slot) => <option value={slot.value} key={slot.value}>{slot.label}</option>)}
                        </select>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>

        <aside className="admin-side-stack">
          <section className="admin-panel">
            <div className="admin-panel__title"><h2>Unscheduled candidates</h2></div>
            <div className="admin-mini-list">
              {unscheduledCandidates.slice(0, 6).map((candidate) => (
                <article key={candidate.id}>
                  <div><strong>{candidate.name}</strong><small>{candidate.availability.length} available slots</small></div>
                  <button type="button" onClick={() => applyCandidateMatch(candidate)}>Match</button>
                </article>
              ))}
              {unscheduledCandidates.length === 0 && <p className="admin-empty-copy">No unscheduled candidates.</p>}
            </div>
          </section>
          <section className="admin-panel">
            <div className="admin-panel__title"><h2>Interviewer workload</h2></div>
            <div className="admin-mini-list">
              {liveInterviewerAvailability.map((interviewer) => (
                <article key={interviewer.name}>
                  <div><strong>{interviewer.name}</strong><small>{interviewer.availability.length} slots submitted</small></div>
                  <StatusPill value={`${interviewerLoad.get(interviewer.name) || 0}/${interviewer.maxInterviews || '∞'}`} />
                </article>
              ))}
              {liveInterviewerAvailability.length === 0 && <p className="admin-empty-copy">No interviewer availability loaded.</p>}
            </div>
          </section>
        </aside>
      </div>

      <section className="admin-panel">
        <div className="admin-panel__title"><h2>Candidate assignments</h2><span>Candidate and interviewer side controls</span></div>
        {candidateRows.length === 0 ? (
          <div className="admin-empty-state">
            <strong>No candidate submissions loaded yet.</strong>
            <p>Candidate form responses will appear here with resumes, ranked roles, and availability.</p>
            <Link to="/apply">Open candidate form</Link>
          </div>
        ) : (
          <div className="admin-table admin-table--candidates">
            <div className="admin-table__row admin-table__row--head">
              <span>Candidate</span><span>Resume / roles</span><span>Assigned slot</span><span>Interviewers</span><span>Status</span><span>Conflict check</span><span>Save</span>
            </div>
            {candidateRows.map((candidate) => {
              const avoidedInterviewers = new Set(interviewerAvoidance[candidate.id] || [])
              const candidateSlots = sortSlotValues(candidate.availability)
              const eligibleSlots = candidateSlots.length ? candidateSlots : INTERVIEW_SLOTS.map((slot) => slot.value)
              return (
                <div className="admin-table__row" key={candidate.id}>
                  <strong>{candidate.name}<small>{candidate.email}</small></strong>
                  <span><a href={candidate.resumeUrl} target="_blank" rel="noreferrer">View resume</a><small>{candidate.rolePreferences.join(' · ')}</small></span>
                  <select value={candidate.assignedSlot} onChange={(event) => updateCandidate(candidate.id, { assignedSlot: event.target.value, status: event.target.value ? 'Matched' : 'Needs match' })}>
                    <option value="">Select slot</option>
                    {eligibleSlots.map((slotValue) => <option key={slotValue} value={slotValue}>{slotLabel(slotValue)}</option>)}
                  </select>
                  <div className="admin-interviewer-selects">
                    <select value={candidate.interviewers[0] || ''} onChange={(event) => updateCandidateInterviewers(candidate.id, 0, event.target.value)}>
                      <option value="">Lead</option>
                      {liveInterviewerAvailability.map((row) => <option key={row.name} value={row.name}>{row.name}</option>)}
                    </select>
                    <select value={candidate.interviewers[1] || ''} onChange={(event) => updateCandidateInterviewers(candidate.id, 1, event.target.value)}>
                      <option value="">Second</option>
                      {liveInterviewerAvailability.filter((row) => row.name !== candidate.interviewers[0]).map((row) => <option key={row.name} value={row.name}>{row.name}</option>)}
                    </select>
                  </div>
                  <select value={candidate.status} onChange={(event) => updateCandidate(candidate.id, { status: event.target.value as Candidate['status'] })}>
                    {['Needs match', 'Matched', 'Invited', 'Interviewed', 'Offer', 'Hold', 'Declined'].map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <details className="admin-avoidance">
                    <summary>Avoid pairing</summary>
                    {liveInterviewerAvailability.map((row) => (
                      <label key={row.name}><input type="checkbox" checked={avoidedInterviewers.has(row.name)} onChange={() => toggleAvoidedInterviewer(candidate.id, row.name)} />{row.name}</label>
                    ))}
                  </details>
                  <div className="admin-row-actions">
                    <button type="button" onClick={() => applyCandidateMatch(candidate)}>Auto</button>
                    <button type="button" onClick={() => void saveAssignment(candidate)}>Save</button>
                    {assignmentSaveState[candidate.id] && <small>{assignmentSaveState[candidate.id]}</small>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )

  const renderAnnouncements = () => (
    <div className="admin-dashboard__stack">
      <section className="admin-page-heading">
        <div>
          <h1>Announcements</h1>
          <p>Publish member updates, candidate reminders, and opportunities from one queue.</p>
        </div>
        <div className="admin-page-heading__actions">
          <button type="button" onClick={() => setAnnouncementRows((current) => [{ title: 'New announcement draft', channel: 'Portal', owner: effectiveMember.firstName, status: 'Draft', audience: 'Members', scheduledFor: 'Draft' }, ...current])}>New announcement</button>
          <button type="button" onClick={() => setOpportunityRows((current) => [{ title: 'New opportunity draft', organization: 'UBLDA', type: 'Community', timing: 'Draft', audience: 'Members', owner: effectiveMember.firstName }, ...current])}>New opportunity</button>
          <button type="button" onClick={() => pushActivity('Push reviewed', 'Announcement queue is ready for publishing.', 'good')}>Push update</button>
        </div>
      </section>

      <section className="admin-stat-grid">
        <StatCard icon="Announcements" label="Live announcements" value={String(liveAnnouncements)} detail="Ready to show" />
        <StatCard icon="announce" label="Drafts" value={String(draftAnnouncements)} detail="Need review" tone={draftAnnouncements ? 'watch' : 'good'} />
        <StatCard icon="Resources" label="Opportunities posted" value={String(opportunityRows.length)} detail="Opportunity board" />
        <StatCard icon="time" label="Scheduled pushes" value={String(announcementRows.filter((row) => /AM|PM/.test(row.scheduledFor)).length)} detail="Timed updates" />
      </section>

      <div className="admin-dashboard__two admin-dashboard__two--wide">
        <section className="admin-panel">
          <div className="admin-panel__title"><h2>Announcement queue</h2><span>{canManageSystem ? 'Publish and delete' : 'Draft within scope'}</span></div>
          <div className="admin-table admin-table--announcements">
            <div className="admin-table__row admin-table__row--head"><span>Title</span><span>Audience</span><span>Channel</span><span>Status</span><span>Owner</span><span>Scheduled</span><span>Actions</span></div>
            {announcementRows.length === 0 && <p className="admin-empty-copy">No announcements have been created yet.</p>}
            {announcementRows.map((row) => (
              <div className="admin-table__row" key={row.title}>
                <strong>{row.title}</strong>
                <span>{row.audience}</span>
                <span>{row.channel}</span>
                <StatusPill value={row.status} />
                <span>{row.owner}</span>
                <span>{row.scheduledFor}</span>
                <div className="admin-row-actions"><button type="button" onClick={() => pushAnnouncement(row.title)}>Push</button><button type="button" onClick={() => deleteAnnouncement(row.title)}>Delete</button></div>
              </div>
            ))}
          </div>
        </section>
        <aside className="admin-panel admin-composer">
          <h2>Create push</h2>
          <label>Audience<select><option>Members</option><option>E-board</option><option>Candidates</option></select></label>
          <label>Channel<select><option>Portal</option><option>Email + portal</option></select></label>
          <label>Message<textarea placeholder="Write a concise announcement..." /></label>
          <button type="button" onClick={() => pushActivity('Announcement draft created', 'Composer content staged in the queue.', 'good')}>Publish</button>
        </aside>
      </div>

      <section className="admin-panel">
        <div className="admin-panel__title"><h2>Opportunities board</h2><span>Publish, unpublish, or delete member opportunities.</span></div>
        <div className="admin-opportunity-grid">
          {opportunityRows.length === 0 && <p className="admin-empty-copy">No opportunities have been created yet.</p>}
          {opportunityRows.map((row) => (
            <article key={row.title}>
              <span>{row.type}</span>
              <h3>{row.title}</h3>
              <p>{row.organization} · {row.timing}</p>
              <small>Owner: {row.owner}</small>
              <button type="button" onClick={() => toggleOpportunity(row.title)}>{row.saved ? 'Unpublish' : 'Publish'}</button>
            </article>
          ))}
        </div>
      </section>
    </div>
  )

  const renderResources = () => (
    <div className="admin-dashboard__stack">
      <section className="admin-page-heading">
        <div>
          <h1>Resources</h1>
          <p>Keep interview prep, resume guides, networking templates, and accessibility resources easy to find.</p>
        </div>
        <div className="admin-page-heading__actions">
          <button type="button" onClick={() => setResourceRows((current) => [{ title: 'New resource draft', category: 'Mentorship', format: 'Draft', nextStep: 'Add next step', status: 'Draft', owner: effectiveMember.firstName }, ...current])}>Add resource</button>
          <button type="button" onClick={() => pushActivity('Category created', 'New category staged for resources.', 'neutral')}>New category</button>
          <button type="button" onClick={() => pushActivity('Suggestion noted', 'Resource suggestion added to review queue.', 'good')}>Suggest resource</button>
        </div>
      </section>

      <section className="admin-stat-grid">
        <StatCard icon="Resources" label="Published resources" value={String(resourceRows.filter((row) => row.status === 'Published').length)} detail="Visible to members" />
        <StatCard icon="resource" label="Draft resources" value={String(resourceRows.filter((row) => row.status === 'Draft').length)} detail="In progress" />
        <StatCard icon="database" label="Categories" value={String(new Set(resourceRows.map((row) => row.category)).size)} detail="Resource filters" />
        <StatCard icon="shield" label="Needs review" value={String(resourceRows.filter((row) => row.status === 'Needs review').length)} detail="Content updates" tone={resourceRows.some((row) => row.status === 'Needs review') ? 'watch' : 'good'} />
      </section>

      <div className="admin-dashboard__two admin-dashboard__two--wide">
        <section className="admin-panel">
          <div className="admin-table-toolbar">
            <div><h2>Resource library</h2><p>{resourceRows.length} resources</p></div>
            <input type="search" placeholder="Search resources" />
          </div>
          <div className="admin-resource-grid">
            {resourceRows.length === 0 && <p className="admin-empty-copy">No resources have been created yet.</p>}
            {resourceRows.map((row) => (
              <article key={row.title}>
                <span>{row.category}</span>
                <h3>{row.title}</h3>
                <p>{row.format}</p>
                <small>{row.nextStep}</small>
                <div>
                  <StatusPill value={row.status} />
                  <select value={row.status} onChange={(event) => updateResourceStatus(row.title, event.target.value as ResourceRecord['status'])}>
                    <option>Published</option>
                    <option>Draft</option>
                    <option>Needs review</option>
                  </select>
                </div>
              </article>
            ))}
          </div>
        </section>
        <aside className="admin-side-stack">
          <section className="admin-panel">
            <div className="admin-panel__title"><h2>Categories</h2></div>
            <div className="admin-filter-list">
              {resourceRows.length === 0 && <p className="admin-empty-copy">No categories yet.</p>}
              {Array.from(new Set(resourceRows.map((row) => row.category))).map((category) => <button type="button" key={category}>{category}</button>)}
            </div>
          </section>
          <section className="admin-panel">
            <div className="admin-panel__title"><h2>Needs review</h2></div>
            <div className="admin-mini-list">
              {resourceRows.filter((row) => row.status === 'Needs review').map((row) => <article key={row.title}><div><strong>{row.title}</strong><small>{row.owner}</small></div><button type="button" onClick={() => updateResourceStatus(row.title, 'Published')}>Publish</button></article>)}
              {resourceRows.every((row) => row.status !== 'Needs review') && <p className="admin-empty-copy">No resources need review.</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )

  const renderSettings = () => (
    <div className="admin-dashboard__stack">
      <section className="admin-page-heading">
        <div>
          <h1>Settings</h1>
          <p>Manage account preferences, access, backend status, and notification defaults.</p>
        </div>
        <div className="admin-page-heading__actions">
          <button type="button" onClick={() => pushActivity('Settings saved', 'Dashboard preferences updated.', 'good')}>Save changes</button>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </section>

      <section className="admin-settings-layout">
        <nav aria-label="Settings sections">
          {['Account', 'Roles', 'Backend', 'Timezone', 'Notifications'].map((item) => <button type="button" className={item === 'Account' ? 'active' : ''} key={item}>{item}</button>)}
        </nav>
        <div className="admin-settings-sections">
          <section className="admin-panel">
            <div className="admin-panel__title"><h2>Account</h2><span>{effectiveMember.email}</span></div>
            <div className="admin-preference-list">
              <label><span>Display name</span><input defaultValue={displayName} /></label>
              <label><span>Dashboard role</span><input value={roleLabel(effectiveMember.role)} readOnly /></label>
              <label><span>Default landing tab</span><select defaultValue="Overview"><option>Overview</option><option>Recruiting</option><option>Members</option></select></label>
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel__title"><h2>Roles and permissions</h2><span>{canManageSystem ? 'Editable by Super Admin' : 'Read-only for Admins'}</span></div>
            <div className="admin-permission-table">
              <div className="admin-permission-table__row admin-permission-table__row--head"><span>Role</span><span>Members</span><span>E-board</span><span>Recruiting</span><span>Announce</span><span>Resources</span><span>System</span></div>
              {[
                ['Super Admin', true, true, true, true, true, true],
                ['Admin', true, true, true, true, true, false],
                ['Member', false, false, false, false, true, false],
              ].map((row) => (
                <div className="admin-permission-table__row" key={String(row[0])}>
                  <strong>{row[0]}</strong>
                  {row.slice(1).map((allowed, index) => <span className={allowed ? 'allowed' : ''} key={index}>{allowed ? 'Yes' : 'No'}</span>)}
                </div>
              ))}
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel__title"><h2>Backend</h2><span>{backendReady ? 'Online' : 'Needs review'}</span></div>
            <div className="admin-health-list">
              <article><span><DashboardIcon name="database" /></span><div><strong>Recruiting store</strong><small>{backendMessage}</small></div><StatusPill value={backendReady ? 'Active' : 'Review'} /></article>
              <article><span><DashboardIcon name="shield" /></span><div><strong>Auth sessions</strong><small>Role-aware dashboard access</small></div><StatusPill value="Active" /></article>
              <article><span><DashboardIcon name="calendar" /></span><div><strong>Manual calendar events</strong><small>{manualCalendarEvents.length} saved event{manualCalendarEvents.length === 1 ? '' : 's'}</small></div><StatusPill value="Active" /></article>
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel__title"><h2>Timezone and notifications</h2></div>
            <div className="admin-preference-list">
              <label><span>Default location</span><select defaultValue="Ann Arbor, MI"><option>Ann Arbor, MI</option></select></label>
              <label><span>Time display</span><select defaultValue="browser"><option value="browser">Use browser timezone</option><option value="et">Always Eastern Time</option></select></label>
              <label><span>Dashboard notifications</span><input type="checkbox" defaultChecked /></label>
            </div>
          </section>
        </div>
      </section>
    </div>
  )

  const renderActivePanel = () => {
    if (activeTab === 'Overview') return renderOverview()
    if (activeTab === 'Members') return renderMembers()
    if (activeTab === 'E-board') return renderEboard()
    if (activeTab === 'Recruiting') return renderRecruiting()
    if (activeTab === 'Announcements') return renderAnnouncements()
    if (activeTab === 'Resources') return renderResources()
    return renderSettings()
  }

  return (
    <main id="main-content" className="admin-dashboard">
      <aside className="admin-dashboard__sidebar" aria-label="Dashboard navigation">
        <Link to="/" className="admin-sidebar-brand" aria-label="UBLDA home">
          <img src="/logo.png" alt="" />
          <span>UBLDA</span>
        </Link>
        <nav>
          {tabs.map((tab) => (
            <button type="button" className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => setActiveTab(tab)}>
              <DashboardIcon name={tab} />
              <span>{tab}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-account">
          <button type="button" className="admin-sidebar-account__trigger" onClick={() => setAccountMenuOpen((current) => !current)} aria-expanded={accountMenuOpen}>
            <span>{effectiveMember.firstName[0]}{effectiveMember.lastName[0]}</span>
            <div>
              <strong>{effectiveMember.firstName} {effectiveMember.lastName}</strong>
              <small>{effectiveMember.adminTitle}</small>
            </div>
            <i>v</i>
          </button>
          {accountMenuOpen && (
            <div className="admin-sidebar-account__menu">
              <button type="button" onClick={() => { setActiveTab('Settings'); setAccountMenuOpen(false) }}>Account settings</button>
              <button type="button" onClick={() => { navigator.clipboard?.writeText(effectiveMember.email); pushActivity('Email copied', effectiveMember.email, 'good'); setAccountMenuOpen(false) }}>Copy email</button>
              <button type="button" onClick={() => { setActiveTab('Members'); setAccountMenuOpen(false) }}>View member record</button>
              <button type="button" onClick={signOut}>Sign out</button>
            </div>
          )}
        </div>
      </aside>

      <section className="admin-dashboard__main">
        <header className="admin-dashboard__topbar">
          <div className="admin-topbar-control">
            <DashboardIcon name="Recruiting" />
            <span>Ann Arbor, MI ({timeZone.includes('Detroit') ? 'ET' : timeZone})</span>
          </div>
          <button type="button" className="admin-topbar-bell" onClick={() => setActiveTab('Announcements')} aria-label="Notifications">
            <DashboardIcon name="Announcements" />
            <span>{draftAnnouncements + pendingMembers}</span>
          </button>
          <div className="admin-topbar-control">
            <DashboardIcon name="shield" />
            <span>{roleLabel(effectiveMember.role)}</span>
          </div>
        </header>
        {toastMessage && (
          <div className="admin-dashboard__toast" role="status">
            <span>{toastMessage}</span>
            <button type="button" onClick={() => setToastMessage('')}>Dismiss</button>
          </div>
        )}
        {renderActivePanel()}
      </section>
    </main>
  )
}
