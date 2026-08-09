import type { VercelRequest, VercelResponse } from './types.ts'
import { randomUUID } from 'node:crypto'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import type { DashboardCalendarEvent } from '../src/lib/dashboardData.ts'
import {
  bodyRecord,
  getNumber,
  getString,
  methodNotAllowed,
  setApiSecurityHeaders,
} from '../server/apiUtils.ts'
import { recruitingAdminAccessForSession } from '../server/recruitingAdmin.ts'

const allowedDates = new Set(['2026-05-07', '2026-05-08', '2026-05-09'])
const minStartMinutes = 8 * 60
const maxEndMinutes = 22 * 60

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
  if (!allowedDates.has(date)) errors.push('Event date must be inside the May 7-9 interview window.')
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
    return methodNotAllowed(res)
  }

  const body = bodyRecord(req.body)
  const sessionToken = getString(body, 'sessionToken')
  const action = getString(body, 'action')
  const adminAccess = await recruitingAdminAccessForSession(sessionToken)
  if (!adminAccess.authorized) {
    return res.status(adminAccess.status).json({ error: adminAccess.error })
  }

  const store = createLocalRecruitingStore()
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
