export type DashboardRole = 'member' | 'exec' | 'super-admin'
export type AdminScope = 'recruiting' | 'members' | 'events' | 'announcements' | 'resources' | 'system'

export type AdminAccount = {
  email: string
  name: string
  title: string
  role: DashboardRole
  scopes: AdminScope[]
  /** One line, rendered on the Member Home "Who to ask" list. */
  askAbout: string
}

/**
 * A stored account as the portal exposes it. Declared here rather than in the store so the
 * browser can name the type without importing server code (and node:crypto with it).
 */
export type PortalAccountSummary = {
  email: string
  firstName: string
  lastName: string
  uniqname: string
  role: DashboardRole
  adminTitle: string
  adminScopes: AdminScope[]
  verifiedVia: 'google' | 'password' | ''
  createdAt: string
  updatedAt: string
}

export const SUPER_ADMIN_EMAIL = 'sbodine@umich.edu'

export const ADMIN_SCOPES: AdminScope[] = ['recruiting', 'members', 'events', 'announcements', 'resources', 'system']
export const DASHBOARD_ROLES: DashboardRole[] = ['member', 'exec', 'super-admin']

export const ADMIN_ACCOUNTS: AdminAccount[] = [
  {
    email: SUPER_ADMIN_EMAIL,
    name: 'Sam Bodine',
    title: 'Co-President',
    role: 'super-admin',
    scopes: ['recruiting', 'members', 'events', 'announcements', 'resources', 'system'],
    askAbout: 'Partnerships, this portal, and anything that needs a decision.',
  },
  {
    email: 'atchiang@umich.edu',
    name: 'Alexa Chiang',
    title: 'Co-President',
    role: 'exec',
    scopes: ['recruiting', 'members', 'events', 'announcements', 'resources'],
    askAbout: 'Speakers, event dates, and anything that needs a decision.',
  },
  {
    email: 'cooperry@umich.edu',
    name: 'Cooper Perry',
    title: 'Executive Vice President',
    role: 'exec',
    scopes: ['recruiting', 'members', 'events', 'announcements'],
    askAbout: 'Recruiting and how the exec team runs.',
  },
  {
    email: 'ylindsey@umich.edu',
    name: 'Lindsey Ye',
    title: 'VP Operations',
    role: 'exec',
    scopes: ['members', 'events', 'resources'],
    askAbout: 'Meeting logistics, Drive access, and club paperwork.',
  },
  {
    email: 'alexfors@umich.edu',
    name: 'Alex Forstner',
    title: 'VP Education',
    role: 'exec',
    scopes: ['members', 'events', 'resources'],
    askAbout: 'Workshops, curriculum, and member development.',
  },
  {
    email: 'landonem@umich.edu',
    name: 'Landon Miller',
    title: 'VP Finance',
    role: 'exec',
    scopes: ['members', 'events'],
    askAbout: 'Budget, reimbursements, and anything with a cost attached.',
  },
  {
    email: 'andsack@umich.edu',
    name: 'Andrew Sackett',
    title: 'Events & Programming',
    role: 'exec',
    scopes: ['events', 'announcements'],
    askAbout: 'Event logistics, rooms, and the day-of run of show.',
  },
  {
    email: 'snaber@umich.edu',
    name: 'Samantha Naber',
    title: 'Exec Admin',
    role: 'exec',
    scopes: ['recruiting', 'events', 'announcements'],
    askAbout: 'Recruiting logistics and interview scheduling.',
  },
  {
    email: 'sdeyoun@umich.edu',
    name: 'Solomon Deyoung',
    title: 'Exec Admin',
    role: 'exec',
    scopes: ['events', 'announcements'],
    askAbout: 'Event support and getting announcements out.',
  },
]

export const adminAccountForEmail = (email: string) => (
  ADMIN_ACCOUNTS.find((account) => account.email === email.toLowerCase())
)

export const roleForEmail = (email: string): DashboardRole => adminAccountForEmail(email)?.role || 'member'

export const scopesForEmail = (email: string): AdminScope[] => (
  adminAccountForEmail(email)?.scopes || []
)

export const canAccessScope = (email: string, scope: AdminScope) => (
  scopesForEmail(email).includes(scope)
)

/**
 * Doc #54: "nobody confirms a date or discusses fees except through Sam or Alexa."
 * This constant is that rule, in software.
 */
export const PUBLISH_APPROVERS: string[] = ['sbodine@umich.edu', 'atchiang@umich.edu']

export const canPublish = (email: string) => PUBLISH_APPROVERS.includes(email.toLowerCase())

/**
 * Elevation requires a VERIFIED identity provider, never an email string.
 * Anyone can self-register atchiang@umich.edu through the public form.
 */
export const effectiveRoleForAccount = (input: {
  email: string
  role?: DashboardRole
  verifiedVia?: 'google' | 'password' | ''
}): DashboardRole => {
  if (input.role && input.role !== 'member') return input.role
  if (input.verifiedVia === 'google') return roleForEmail(input.email)
  return 'member'
}
