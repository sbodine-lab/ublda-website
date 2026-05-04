import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import type { DashboardCalendarEvent } from '../src/lib/dashboardData.ts'

const allowedDates = new Set(['2026-05-07', '2026-05-08', '2026-05-09', '2026-05-10'])
const minStartMinutes = 8 * 60
const maxEndMinutes = 22 * 60

const setApiSecurityHeaders = (res: VercelResponse) => {
  res.setHeader?.('Cache-Control', 'no-store, max-age=0')
  res.setHeader?.('Pragma', 'no-cache')
  res.setHeader?.('X-Content-Type-Options', 'nosniff')
}

const superAdminSessionSecret = () => (
  process.env.UBLDA_SUPER_ADMIN_PASSWORD
  || process.env.SAM_BODINE_PASSWORD
  || ''
)

const localAdminFallbackEnabled = () => process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK === 'true'

const signSessionPayload = (payload: string) => {
  const secret = superAdminSessionSecret()
  if (!secret) return ''
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

const getString = (body: Record<string, unknown>, key: string) => {
  const value = body[key]
  return typeof value === 'string' ? value.trim() : ''
}

const getNumber = (body: Record<string, unknown>, key: string) => {
  const value = body[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
}

const validateEvent = (body: Record<string, unknown>) => {
  const id = getString(body, 'id') || `manual_${randomUUID()}`
  const title = getString(body, 'title')
  const date = getString(body, 'date')
  const startMinutes = getNumber(body, 'startMinutes')
  const durationMinutes = getNumber(body, 'durationMinutes')
  const owner = getString(body, 'owner') || 'UBLDA'
  const location = getString(body, 'location') || 'Google Meet'
  const notes = getString(body, 'notes')
  const errors: string[] = []

  if (!title || title.length > 120) errors.push('Event title is required and must be 120 characters or fewer.')
  if (!allowedDates.has(date)) errors.push('Event date must be inside the May 7-10 interview window.')
  if (!Number.isFinite(startMinutes) || startMinutes < minStartMinutes || startMinutes >= maxEndMinutes) errors.push('Event start time is outside the interview window.')
  if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 180) errors.push('Event duration must be between 15 and 180 minutes.')
  if (Number.isFinite(startMinutes) && Number.isFinite(durationMinutes) && startMinutes + durationMinutes > maxEndMinutes) errors.push('Event must end by 10:00 PM ET.')
  if (notes.length > 1000) errors.push('Notes must be 1,000 characters or fewer.')

  if (errors.length) return { event: null, errors }

  const now = new Date().toISOString()
  const event: DashboardCalendarEvent = {
    id,
    title,
    date,
    startMinutes,
    durationMinutes,
    owner,
    location,
    notes,
    createdAt: getString(body, 'createdAt') || now,
    updatedAt: now,
  }

  return { event, errors: [] }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {}
  const sessionToken = getString(body, 'sessionToken')
  const action = getString(body, 'action')

  if (sessionToken.length < 24) {
    return res.status(401).json({ error: 'A valid admin session is required.' })
  }

  const store = createLocalRecruitingStore()
  const storeSession = await store.dashboardData(sessionToken)
  const localSuperAdmin = verifyLocalSuperAdminSession(sessionToken)
  if (!localSuperAdmin && (!storeSession || !['super-admin', 'exec'].includes(storeSession.role))) {
    return res.status(403).json({ error: 'Admin access is required.' })
  }

  try {
    if (action === 'delete') {
      const id = getString(body, 'id')
      if (!id) return res.status(400).json({ error: 'Event id is required.' })
      const result = await store.deleteCalendarEvent(id)
      return res.status(200).json({ success: true, ...result })
    }

    const { event, errors } = validateEvent(body)
    if (!event) return res.status(400).json({ error: errors.join(' ') })

    const savedEvent = await store.saveCalendarEvent(event)
    return res.status(200).json({ success: true, event: savedEvent })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Could not save calendar event.' })
  }
}
