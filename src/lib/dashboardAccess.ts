export type DashboardRole = 'member' | 'exec' | 'super-admin'
export type AdminScope = 'recruiting' | 'members' | 'announcements' | 'resources' | 'system'

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
    scopes: ['recruiting', 'members', 'announcements', 'resources', 'system'],
  },
  {
    email: 'atchiang@umich.edu',
    name: 'Alexa Chiang',
    title: 'Exec Admin',
    role: 'exec',
    scopes: ['recruiting', 'members', 'announcements', 'resources'],
  },
  {
    email: 'cooperry@umich.edu',
    name: 'Cooper Perry',
    title: 'Exec Admin',
    role: 'exec',
    scopes: ['recruiting', 'members'],
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
