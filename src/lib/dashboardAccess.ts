export type DashboardRole = 'member' | 'exec' | 'super-admin'
export type AdminScope = 'recruiting' | 'members' | 'events' | 'sponsors' | 'publishing' | 'system'

export type AdminAccount = {
  email: string
  name: string
  title: string
  role: DashboardRole
  scopes: AdminScope[]
}

export const SUPER_ADMIN_EMAIL = 'sbodine@umich.edu'

export const ADMIN_ACCOUNTS: AdminAccount[] = [
  {
    email: SUPER_ADMIN_EMAIL,
    name: 'Sam Bodine',
    title: 'Super Admin',
    role: 'super-admin',
    scopes: ['recruiting', 'members', 'events', 'sponsors', 'publishing', 'system'],
  },
  {
    email: 'atchiang@umich.edu',
    name: 'Alexa Chiang',
    title: 'Exec Admin',
    role: 'exec',
    scopes: ['recruiting', 'events', 'members', 'publishing'],
  },
  {
    email: 'cooperry@umich.edu',
    name: 'Cooper Ryan',
    title: 'Exec Admin',
    role: 'exec',
    scopes: ['recruiting', 'members', 'sponsors'],
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
