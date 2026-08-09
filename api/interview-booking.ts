import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import {
  buildInterviewBookingSubmission,
  validateInterviewBookingPayload,
} from '../src/lib/interviewBooking.ts'

const setApiSecurityHeaders = (res: VercelResponse) => {
  res.setHeader?.('Cache-Control', 'no-store, max-age=0')
  res.setHeader?.('Pragma', 'no-cache')
  res.setHeader?.('X-Content-Type-Options', 'nosniff')
}

const BOOKING_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const BOOKING_RATE_LIMIT_MAX_ATTEMPTS = 6

const requestIp = (req: VercelRequest) => {
  const forwardedFor = req.headers['x-forwarded-for']
  if (Array.isArray(forwardedFor)) return forwardedFor[0] || 'unknown'
  if (typeof forwardedFor === 'string') return forwardedFor.split(',')[0]?.trim() || 'unknown'
  return req.socket?.remoteAddress || 'unknown'
}

const bookingStatusCode = (error: unknown) => {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (code === 'SLOT_TAKEN' || code === 'ALREADY_BOOKED' || code === 'NO_INTERVIEWER_COVERAGE') return 409
  if (code === 'INVALID_SLOT') return 400
  return 500
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  const store = createLocalRecruitingStore()

  if (req.method === 'GET') {
    const slots = await store.publicInterviewSlots()
    return res.status(200).json({
      success: true,
      timeZone: 'Eastern Time (ET, Ann Arbor)',
      slots,
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body ?? {}
  if (body && typeof body === 'object' && typeof body.website === 'string' && body.website.trim()) {
    return res.status(200).json({ success: true })
  }

  const result = validateInterviewBookingPayload(body)
  if (!result.success) {
    return res.status(400).json({
      error: result.errors[0] || 'Please check the form and try again.',
      errors: result.errors,
    })
  }

  const rateLimit = await store.consumeRateLimit(`booking:${requestIp(req)}`, BOOKING_RATE_LIMIT_MAX_ATTEMPTS, BOOKING_RATE_LIMIT_WINDOW_MS)
  if (rateLimit.limited) {
    res.setHeader?.('Retry-After', String(rateLimit.retryAfterSeconds))
    return res.status(429).json({ error: 'Too many booking attempts. Please wait a few minutes and try again.' })
  }

  try {
    const submission = buildInterviewBookingSubmission(result.data, req.headers['user-agent'] || '')
    const saved = await store.bookInterviewSlot(submission)

    return res.status(200).json({
      success: true,
      slot: {
        value: saved.slot.value,
        label: saved.slot.label,
        timeLabel: saved.slot.timeLabel,
        dayLabel: saved.slot.dayLabel,
        start: saved.slot.start,
        end: saved.slot.end,
      },
      interviewers: saved.interviewers,
      candidate: {
        name: saved.candidate.name,
        email: saved.candidate.email,
      },
      email: {
        sent: false,
        reason: 'Confirmation email provider is not configured yet.',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not book that interview slot.'
    return res.status(bookingStatusCode(error)).json({ error: message })
  }
}
