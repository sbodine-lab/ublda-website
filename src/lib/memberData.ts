import type { ApplicantAccount, ApplicantApplicationSummary } from './applicantAccount'
import type { AdminScope, DashboardRole } from './dashboardAccess.ts'
import { adminAccountForEmail, roleForEmail, scopesForEmail } from './dashboardAccess.ts'

export type WorkspaceMode = 'member' | 'leadership'
export type DashboardTab =
  | 'Overview'
  | 'Opportunities'
  | 'Calendar'
  | 'Directory'
  | 'News'
  | 'Resources'
  | 'Profile'
  | 'Recruiting'
  | 'Members'
  | 'Sponsors'
  | 'Publishing'
  | 'Admin'

export type MemberProfile = ApplicantAccount & {
  memberStatus: string
  attendance: {
    attended: number
    total: number
    streak: number
  }
  leadershipPosition: string
  officerFocus: string
  role: DashboardRole
  adminTitle: string
  adminScopes: AdminScope[]
  year: string
  college: string
  track: string
  profileCompletion: number
  application?: ApplicantApplicationSummary | null
}

export type DashboardAction = {
  title: string
  description: string
  status: string
  href: string
  tone: 'urgent' | 'ready' | 'neutral'
}

export type Opportunity = {
  title: string
  organization: string
  type: 'Recruiting' | 'Networking' | 'Project' | 'Community'
  timing: string
  audience: string
  owner: string
  saved?: boolean
}

export type NewsItem = {
  title: string
  source: string
  theme: string
  date: string
  whyItMatters: string
}

export type DirectoryMember = {
  name: string
  affiliation: 'UBLDA' | 'BLDA'
  role: string
  company: string
  year: string
  track: string
  openToChat: boolean
}

export type CalendarItem = {
  title: string
  date: string
  time: string
  location: string
  status: 'RSVP open' | 'Invited' | 'Planning' | 'Draft'
}

export type Candidate = {
  id: string
  name: string
  program: string
  email: string
  rolePreferences: string[]
  status: 'Needs match' | 'Matched' | 'Invited' | 'Interviewed' | 'Offer' | 'Hold' | 'Declined'
  availability: string[]
  resumeUrl: string
  assignedSlot: string
  interviewers: string[]
  feedback: string
}

export type InterviewerAvailability = {
  name: string
  role: string
  availability: string[]
  maxInterviews: string
}

export type MemberSignup = {
  id: string
  name: string
  email: string
  uniqname: string
  status: string
  source: string
  updatedAt: string
  detail: string
}

export type Sponsor = {
  company: string
  contact: string
  stage: 'Prospect' | 'Warm intro' | 'Meeting set' | 'Proposal' | 'Committed'
  nextStep: string
  owner: string
  value: string
}

export type LeadershipMetric = {
  label: string
  value: string
  detail: string
  tone: 'healthy' | 'watch' | 'neutral'
}

export type PublishingItem = {
  title: string
  channel: string
  status: 'Draft' | 'Review' | 'Ready'
  owner: string
}

export type ResourceItem = {
  title: string
  category: 'Resume' | 'Interview' | 'Networking' | 'Mentorship' | 'Accessibility'
  format: string
  nextStep: string
}

export const buildMemberProfile = (
  account: ApplicantAccount,
  application?: ApplicantApplicationSummary | null,
): MemberProfile => {
  const isLeadershipApplicant = application?.status === 'Interview eligible' || application?.status === 'Needs review'
  const fallbackAdmin = adminAccountForEmail(account.email)
  const role = account.role || roleForEmail(account.email)
  const adminScopes = account.adminScopes?.length ? account.adminScopes : scopesForEmail(account.email)

  return {
    ...account,
    role,
    adminTitle: account.adminTitle || fallbackAdmin?.title || (role === 'member' ? 'Member' : 'Exec Admin'),
    adminScopes,
    memberStatus: role === 'super-admin'
      ? 'Super admin'
      : role === 'exec'
        ? 'Exec dashboard active'
        : application ? 'Leadership candidate' : 'Member account active',
    attendance: {
      attended: application ? 1 : 0,
      total: 4,
      streak: application ? 1 : 0,
    },
    leadershipPosition: role === 'super-admin'
      ? 'Full operating control'
      : role === 'exec'
        ? 'E-board operations'
        : isLeadershipApplicant ? 'Interviewing' : 'Not assigned',
    officerFocus: role === 'super-admin'
      ? 'System, recruiting, members, sponsors, publishing'
      : role === 'exec'
        ? adminScopes.join(', ') || 'E-board operations'
        : 'Recruiting preview',
    year: 'Update in profile',
    college: 'University of Michigan',
    track: application ? 'Leadership interest' : 'Member resources',
    profileCompletion: application ? 78 : 42,
    application,
  }
}

export const memberActions: DashboardAction[] = [
  {
    title: 'Complete your member profile',
    description: 'Add year, college, interests, LinkedIn, and directory visibility.',
    status: 'Profile 42%',
    href: '#profile',
    tone: 'urgent',
  },
  {
    title: 'Choose a leadership interview slot',
    description: 'Drop your resume and select every interview slot you can make.',
    status: 'Open now',
    href: '/portal',
    tone: 'ready',
  },
  {
    title: 'Review this week\'s opportunities',
    description: 'Recruiting, networking, and project leads curated for UBLDA members.',
    status: '4 new',
    href: '#opportunities',
    tone: 'neutral',
  },
]

export const leadershipActions: DashboardAction[] = [
  {
    title: 'Clear candidates without interview slots',
    description: 'Match candidate availability against e-board interviewer coverage before Wednesday ends.',
    status: '3 pending',
    href: '#recruiting',
    tone: 'urgent',
  },
  {
    title: 'Check Ross ratio before final offers',
    description: 'Keep e-board composition aligned with Ross club expectations.',
    status: '72% Ross/BBA',
    href: '#members',
    tone: 'ready',
  },
  {
    title: 'Move sponsor intros to next step',
    description: 'Two warm leads need a follow-up owner and meeting date.',
    status: '2 warm',
    href: '#sponsors',
    tone: 'neutral',
  },
]

export const leadershipMetrics: LeadershipMetric[] = [
  {
    label: 'Ross/BBA ratio',
    value: '72%',
    detail: '13 of 18 tracked leaders / candidates',
    tone: 'healthy',
  },
  {
    label: 'Interview coverage',
    value: '4 days',
    detail: '30-minute Google Meet holds with 20-minute buffers, May 7-10',
    tone: 'watch',
  },
  {
    label: 'Candidate pool',
    value: '24',
    detail: '16 Ross, 8 future-role pool',
    tone: 'neutral',
  },
  {
    label: 'Sponsor pipeline',
    value: '$4.5k',
    detail: 'Soft target from warm leads',
    tone: 'healthy',
  },
]

export const opportunities: Opportunity[] = [
  {
    title: 'Michigan startup diligence sprint',
    organization: 'UBLDA x founder network',
    type: 'Project',
    timing: 'Rolling team formation',
    audience: 'Analysts, operators, builders',
    owner: 'Sam',
    saved: true,
  },
  {
    title: 'AI tooling coffee chats',
    organization: 'BLDA MBA mentors',
    type: 'Networking',
    timing: 'May mentor matches',
    audience: 'Members exploring product, VC, and ops',
    owner: 'BLDA',
  },
  {
    title: 'Lower-middle-market search fund primer',
    organization: 'Ross alumni circle',
    type: 'Recruiting',
    timing: 'Early fall pipeline',
    audience: 'Sophomores and juniors',
    owner: 'Alexa',
  },
  {
    title: 'Community build night',
    organization: 'UBLDA internal',
    type: 'Community',
    timing: 'Next member meeting',
    audience: 'All members',
    owner: 'Events',
  },
]

export const newsItems: NewsItem[] = [
  {
    title: 'Private markets teams are moving from static memos to live operating dashboards',
    source: 'Member brief',
    theme: 'Data rooms',
    date: 'This week',
    whyItMatters: 'Good context for students interested in diligence, AI workflows, and sponsor-backed operating roles.',
  },
  {
    title: 'AI workflow adoption is changing what junior investing roles reward',
    source: 'UBLDA notes',
    theme: 'Careers',
    date: 'This week',
    whyItMatters: 'The member portal can train people to show practical leverage, not just polished interest.',
  },
  {
    title: 'Search, ETA, and independent sponsors keep pulling students toward hands-on diligence',
    source: 'BLDA readout',
    theme: 'Entrepreneurship',
    date: 'May',
    whyItMatters: 'Matches UBLDA\'s goal of giving undergrads earlier access to MBA-style networks.',
  },
]

export const directoryMembers: DirectoryMember[] = [
  {
    name: 'Sam Bodine',
    affiliation: 'UBLDA',
    role: 'Co-President',
    company: 'Ross BBA',
    year: 'BBA',
    track: 'Startups, AI tooling',
    openToChat: true,
  },
  {
    name: 'Alexa Chiang',
    affiliation: 'UBLDA',
    role: 'Co-President',
    company: 'Ross BBA',
    year: 'BBA',
    track: 'Leadership, events',
    openToChat: true,
  },
  {
    name: 'BLDA mentor pool',
    affiliation: 'BLDA',
    role: 'MBA members',
    company: 'MBA / alumni companies',
    year: 'MBA',
    track: 'Networking, recruiting',
    openToChat: true,
  },
]

export const calendarItems: CalendarItem[] = [
  {
    title: 'Leadership interviews',
    date: 'May 7-10',
    time: '8:00 AM-10:00 PM ET',
    location: 'Google Meet',
    status: 'Invited',
  },
  {
    title: 'Member onboarding',
    date: 'Fall kickoff',
    time: 'TBA',
    location: 'Ross',
    status: 'Planning',
  },
  {
    title: 'BLDA mentor mixer',
    date: 'Fall',
    time: 'Evening',
    location: 'Ross / Ann Arbor',
    status: 'Draft',
  },
]

export const candidates: Candidate[] = []

export const interviewerAvailability: InterviewerAvailability[] = []

export const sponsors: Sponsor[] = [
  {
    company: 'Ann Arbor VC Network',
    contact: 'Partner intro',
    stage: 'Warm intro',
    nextStep: 'Send sponsorship one-pager',
    owner: 'Sam',
    value: '$1.5k',
  },
  {
    company: 'Accessibility tech startup',
    contact: 'Founder',
    stage: 'Meeting set',
    nextStep: 'Prep student impact story',
    owner: 'Alexa',
    value: '$2k',
  },
  {
    company: 'Ross alumni sponsor',
    contact: 'MBA alum',
    stage: 'Prospect',
    nextStep: 'Find BLDA bridge',
    owner: 'BLDA',
    value: '$1k',
  },
]

export const publishingQueue: PublishingItem[] = [
  {
    title: 'Leadership interview reminder',
    channel: 'Email + LinkedIn',
    status: 'Ready',
    owner: 'Sam',
  },
  {
    title: 'BLDA mentor mixer save-the-date',
    channel: 'Newsletter',
    status: 'Draft',
    owner: 'Events',
  },
  {
    title: 'Opportunity board weekly brief',
    channel: 'Member portal',
    status: 'Review',
    owner: 'Comms',
  },
]

export const resources: ResourceItem[] = [
  {
    title: 'Leadership interview prep pack',
    category: 'Interview',
    format: 'Checklist + question bank',
    nextStep: 'Review before selecting a slot',
  },
  {
    title: 'Resume readiness rubric',
    category: 'Resume',
    format: 'Self-review guide',
    nextStep: 'Upload updated resume',
  },
  {
    title: 'BLDA coffee chat template',
    category: 'Networking',
    format: 'Email and agenda prompts',
    nextStep: 'Request a mentor intro',
  },
  {
    title: 'Accessibility at recruiting events',
    category: 'Accessibility',
    format: 'Member support guide',
    nextStep: 'Add access needs to profile',
  },
]
