import type { VercelRequest, VercelResponse } from './types.ts'
import {
  buildInterviewerAvailabilitySubmission,
  validateInterviewerAvailabilityPayload,
} from '../src/lib/interviewerAvailability.ts'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import { sendRecruitingFailureAlertEmail } from '../server/bookingEmail.ts'
import {
  acceptsHoneypot,
  headerValue,
  methodNotAllowed,
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  if (req.method !== 'POST') {
    return methodNotAllowed(res)
  }

  if (acceptsHoneypot(req.body)) {
    return res.status(200).json({ success: true })
  }

  const result = validateInterviewerAvailabilityPayload(req.body ?? {})
  if (!result.success) {
    return validationError(res, result.errors, 'Please check the form and try again.')
  }

  try {
    const submission = buildInterviewerAvailabilitySubmission(result.data, headerValue(req.headers['user-agent']))
    const saved = await createLocalRecruitingStore().saveInterviewerAvailability(submission)

    return res.status(200).json({
      success: true,
      availabilitySummary: submission.availabilitySummary,
      updatedExistingSubmission: saved.updatedExistingSubmission,
    })
  } catch (error) {
    let recoveryAlertSent = false
    if (recruitingErrorStatus(error) >= 500) {
      const alert = await sendRecruitingFailureAlertEmail({
        workflow: 'interviewer-availability',
        name: `${result.data.firstName} ${result.data.lastName}`.trim(),
        email: result.data.email,
        errorCode: recruitingErrorCode(error),
        errorMessage: recruitingErrorMessage(error, 'Failed to submit availability'),
      })
      recoveryAlertSent = alert.sent
    }

    logRecruitingError('interviewer_availability_submit_failed', error, {
      ...safeRecruitingSubmissionMetadata({ email: result.data.email }),
      availabilityCount: result.data.availability.length,
      recoveryAlertSent,
    })
    return res.status(recruitingErrorStatus(error)).json({
      error: recruitingErrorMessage(error, 'Failed to submit availability'),
    })
  }
}
