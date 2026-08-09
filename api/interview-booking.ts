import type { VercelRequest, VercelResponse } from '../server/types.ts'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import {
  buildInterviewBookingSubmission,
  validateInterviewBookingPayload,
} from '../src/lib/interviewBooking.ts'
import {
  bookingEmailLaunchError,
  sendRecruitingFailureAlertEmail,
  sendBookingConfirmationEmail,
} from '../server/bookingEmail.ts'
import {
  acceptsHoneypot,
  headerValue,
  methodNotAllowed,
  requestIp,
  setApiSecurityHeaders,
  validationError,
} from '../server/apiUtils.ts'
import {
  logRecruitingError,
  recruitingErrorCode,
  recruitingErrorMessage,
  recruitingErrorStatus,
  safeRecruitingSubmissionMetadata,
} from '../server/recruitingErrors.ts'

const BOOKING_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const BOOKING_RATE_LIMIT_MAX_ATTEMPTS = 6

const bookingStatusCode = (error: unknown) => {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (code === 'BLOB_UNAVAILABLE') return 503
  if (code === 'SLOT_TAKEN' || code === 'ALREADY_BOOKED' || code === 'NO_INTERVIEWER_COVERAGE') return 409
  if (code === 'INVALID_SLOT') return 400
  return recruitingErrorStatus(error)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  const store = createLocalRecruitingStore()

  if (req.method === 'GET') {
    try {
      const slots = await store.publicInterviewSlots()
      return res.status(200).json({
        success: true,
        timeZone: 'Eastern Time (ET, Ann Arbor)',
        slots,
      })
    } catch (error) {
      logRecruitingError('interview_booking_slots_failed', error)
      return res.status(bookingStatusCode(error)).json({
        error: recruitingErrorMessage(error, 'Could not load interview slots.'),
      })
    }
  }

  if (req.method !== 'POST') {
    return methodNotAllowed(res)
  }

  if (acceptsHoneypot(req.body)) {
    return res.status(200).json({ success: true })
  }

  const result = validateInterviewBookingPayload(req.body ?? {})
  if (!result.success) {
    return validationError(res, result.errors, 'Please check the form and try again.')
  }

  const emailLaunchError = bookingEmailLaunchError()
  if (emailLaunchError) {
    return res.status(503).json(emailLaunchError)
  }

  let submission: ReturnType<typeof buildInterviewBookingSubmission> | null = null

  try {
    const rateLimit = await store.consumeRateLimit(`booking:${requestIp(req)}`, BOOKING_RATE_LIMIT_MAX_ATTEMPTS, BOOKING_RATE_LIMIT_WINDOW_MS)
    if (rateLimit.limited) {
      res.setHeader?.('Retry-After', String(rateLimit.retryAfterSeconds))
      return res.status(429).json({ error: 'Too many booking attempts. Please wait a few minutes and try again.' })
    }

    submission = buildInterviewBookingSubmission(result.data, headerValue(req.headers['user-agent']))
    const saved = await store.bookInterviewSlot(submission)
    const email = await sendBookingConfirmationEmail({
      submission,
      slot: saved.slot,
      interviewers: saved.interviewers,
      candidate: saved.candidate,
    })

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
      email,
    })
  } catch (error) {
    let recoveryAlertSent = false
    if (recruitingErrorStatus(error) >= 500) {
      const alert = await sendRecruitingFailureAlertEmail({
        workflow: 'interview-booking',
        name: `${result.data.firstName} ${result.data.lastName}`.trim(),
        email: result.data.email,
        slotLabel: result.data.slotValue,
        resumeFileName: result.data.resumeFile.name,
        resumeFileSize: result.data.resumeFile.size,
        errorCode: recruitingErrorCode(error),
        errorMessage: recruitingErrorMessage(error, 'Could not book that interview slot.'),
        submissionId: submission?.submissionId,
      })
      recoveryAlertSent = alert.sent
    }
    logRecruitingError('interview_booking_submit_failed', error, {
      ...safeRecruitingSubmissionMetadata(result.data),
      recoveryAlertSent,
    })
    return res.status(bookingStatusCode(error)).json({
      error: recruitingErrorMessage(error, 'Could not book that interview slot.'),
    })
  }
}
