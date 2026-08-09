import { createHmac, timingSafeEqual } from 'node:crypto'
import type { ApplicantAccount } from '../src/lib/applicantAccount.ts'

export const SUPER_ADMIN_EMAIL = 'sbodine@umich.edu'

export const superAdminAccount = {
  firstName: 'Sam',
  lastName: 'Bodine',
  uniqname: 'sbodine',
  email: SUPER_ADMIN_EMAIL,
  role: 'super-admin',
  adminTitle: 'Super Admin',
  adminScopes: ['recruiting', 'members', 'announcements', 'resources', 'system'],
} as const

export const superAdminPassword = () => (
  process.env.UBLDA_SUPER_ADMIN_PASSWORD
  || process.env.SAM_BODINE_PASSWORD
  || ''
)

export const localAdminFallbackEnabled = () => (
  process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK === 'true'
)

const safeEquals = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export const signLocalAdminSessionPayload = (payload: string) => {
  const secret = superAdminPassword()
  if (!secret) return ''
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export const verifyLocalSuperAdminSession = (sessionToken: string) => {
  if (!localAdminFallbackEnabled() || !superAdminPassword()) return false

  const [prefix, payload, signature] = sessionToken.split('.')
  if (prefix !== 'ublda_admin' || !payload || !signature) return false
  const expectedSignature = signLocalAdminSessionPayload(payload)
  if (!expectedSignature || !safeEquals(signature, expectedSignature)) return false

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { email?: string; exp?: number }
    return decoded.email === SUPER_ADMIN_EMAIL && typeof decoded.exp === 'number' && decoded.exp > Date.now()
  } catch {
    return false
  }
}

export const createLocalSuperAdminSessionToken = () => {
  if (!superAdminPassword()) {
    throw new Error('Super-admin session secret is not configured.')
  }

  const payload = Buffer.from(JSON.stringify({
    email: SUPER_ADMIN_EMAIL,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
  })).toString('base64url')

  return `ublda_admin.${payload}.${signLocalAdminSessionPayload(payload)}`
}

export const superAdminPasswordAccount = (
  identity: string,
  password: string,
  invalidMessage: string,
): Pick<ApplicantAccount, 'firstName' | 'lastName' | 'uniqname' | 'email'> | null => {
  const normalizedIdentity = identity.toLowerCase()
  if (normalizedIdentity !== 'sbodine' && normalizedIdentity !== SUPER_ADMIN_EMAIL) {
    return null
  }

  const expectedPassword = superAdminPassword()
  if (!expectedPassword || !safeEquals(password, expectedPassword)) {
    throw new Error(invalidMessage)
  }

  return {
    firstName: superAdminAccount.firstName,
    lastName: superAdminAccount.lastName,
    uniqname: superAdminAccount.uniqname,
    email: superAdminAccount.email,
  }
}

export const localSuperAdminAuthResponse = () => ({
  success: true,
  account: superAdminAccount,
  sessionToken: createLocalSuperAdminSessionToken(),
  application: null,
})

export const localSuperAdminDashboardPayload = () => ({
  success: true,
  account: superAdminAccount,
  role: 'super-admin',
  dashboardData: {
    candidates: [],
    interviewerAvailability: [],
    memberSignups: [],
    backendStatus: {
      source: 'vercel',
      message: 'Signed in through Vercel super-admin session. Publish the Apps Script backend for live sheet data.',
      updatedAt: new Date().toISOString(),
    },
  },
})
