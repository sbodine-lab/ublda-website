import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, timingSafeEqual } from 'node:crypto'

const superAdminSessionSecret = () => (
  process.env.UBLDA_SUPER_ADMIN_PASSWORD
  || process.env.SAM_BODINE_PASSWORD
  || ''
)

const localAdminFallbackEnabled = () => process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK === 'true'

const setApiSecurityHeaders = (res: VercelResponse) => {
  res.setHeader?.('Cache-Control', 'no-store, max-age=0')
  res.setHeader?.('Pragma', 'no-cache')
  res.setHeader?.('X-Content-Type-Options', 'nosniff')
}

const signSessionPayload = (payload: string) => {
  const secret = superAdminSessionSecret()
  if (!secret) {
    return ''
  }

  return createHmac('sha256', secret).update(payload).digest('base64url')
}

const safeEquals = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

const verifyLocalSuperAdminSession = (sessionToken: string) => {
  if (!localAdminFallbackEnabled() || !superAdminSessionSecret()) return false

  const [prefix, payload, signature] = sessionToken.split('.')
  if (prefix !== 'ublda_admin' || !payload || !signature) return false
  const expectedSignature = signSessionPayload(payload)
  if (!expectedSignature || !safeEquals(signature, expectedSignature)) return false

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { email?: string; exp?: number }
    return decoded.email === 'sbodine@umich.edu' && typeof decoded.exp === 'number' && decoded.exp > Date.now()
  } catch {
    return false
  }
}

const localSuperAdminPayload = () => ({
  success: true,
  account: {
    firstName: 'Sam',
    lastName: 'Bodine',
    uniqname: 'sbodine',
    email: 'sbodine@umich.edu',
    role: 'super-admin',
    adminTitle: 'Super Admin',
    adminScopes: ['recruiting', 'members', 'events', 'sponsors', 'publishing', 'system'],
  },
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

const getSessionToken = (body: unknown) => {
  if (!body || typeof body !== 'object') return ''
  const token = (body as Record<string, unknown>).sessionToken
  return typeof token === 'string' ? token.trim() : ''
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sessionToken = getSessionToken(req.body)
  if (sessionToken.length < 24) {
    return res.status(401).json({ error: 'A valid member session is required.' })
  }

  if (verifyLocalSuperAdminSession(sessionToken)) {
    return res.status(200).json(localSuperAdminPayload())
  }

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL
  if (!scriptUrl) {
    return res.status(500).json({ error: 'Dashboard backend not configured' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formType: 'applicantAccount',
        action: 'dashboardData',
        sessionToken,
      }),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok || payload?.success === false) {
      return res.status(response.ok ? 401 : 500).json({
        error: payload?.error || 'Could not load dashboard data',
      })
    }

    return res.status(200).json({
      success: true,
      account: payload?.account || null,
      role: payload?.role || 'member',
      dashboardData: payload?.dashboardData || {},
    })
  } catch {
    return res.status(500).json({ error: 'Could not load dashboard data' })
  } finally {
    clearTimeout(timeout)
  }
}
