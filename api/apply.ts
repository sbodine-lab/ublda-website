import type { VercelRequest, VercelResponse } from '../server/types.ts'
import {
  buildApplicationSubmission,
  validateApplicationPayload,
} from '../src/lib/application.ts'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import { sendRecruitingFailureAlertEmail } from '../server/bookingEmail.ts'
import {
  acceptsHoneypot,
  headerValue,
  methodNotAllowed,
  setApiSecurityHeaders,
  validationError,
} from '../server/apiUtils.ts'
import { postGoogleScript, shouldMirrorToLegacyScript } from '../server/googleScript.ts'
import {
  logRecruitingError,
  recruitingErrorCode,
  recruitingErrorMessage,
  recruitingErrorStatus,
  safeRecruitingSubmissionMetadata,
} from '../server/recruitingErrors.ts'

const mirrorToLegacyScript = async (submission: ReturnType<typeof buildApplicationSubmission>, userAgent: string) => {
  const result = await postGoogleScript(
    { ...submission, userAgent },
    'Failed to mirror candidate submission',
  )

  return { calendarEventCreated: Boolean(result?.payload?.calendarEventCreated) }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  if (req.method !== 'POST') {
    return methodNotAllowed(res)
  }

  if (acceptsHoneypot(req.body)) {
    return res.status(200).json({ success: true })
  }

  const result = validateApplicationPayload(req.body ?? {})
  if (!result.success) {
    return validationError(res, result.errors, 'Please check the form and try again.')
  }

  let submission: ReturnType<typeof buildApplicationSubmission> | null = null

  try {
    const userAgent = headerValue(req.headers['user-agent'])
    submission = buildApplicationSubmission(result.data, userAgent)
    await createLocalRecruitingStore().saveApplication(submission)
    const legacyResult = shouldMirrorToLegacyScript()
      ? await mirrorToLegacyScript(submission, userAgent)
      : { calendarEventCreated: false }

    return res.status(200).json({
      success: true,
      status: submission.status,
      source: 'vercel',
      calendarEventCreated: legacyResult.calendarEventCreated,
    })
  } catch (error) {
    let recoveryAlertSent = false
    if (recruitingErrorStatus(error) >= 500) {
      const alert = await sendRecruitingFailureAlertEmail({
        workflow: 'leadership-application',
        name: `${result.data.firstName} ${result.data.lastName}`.trim(),
        email: result.data.email,
        slotLabel: result.data.interviewSlot.label,
        resumeFileName: result.data.resumeFile.name,
        resumeFileSize: result.data.resumeFile.size,
        errorCode: recruitingErrorCode(error),
        errorMessage: recruitingErrorMessage(error, 'Failed to submit'),
        submissionId: submission?.submissionId,
      })
      recoveryAlertSent = alert.sent
    }

    logRecruitingError('leadership_application_submit_failed', error, {
      ...safeRecruitingSubmissionMetadata({
        email: result.data.email,
        slotValue: result.data.interviewSlot.value,
        resumeFile: result.data.resumeFile,
      }),
      recoveryAlertSent,
    })
    return res.status(recruitingErrorStatus(error)).json({
      error: recruitingErrorMessage(error, 'Failed to submit'),
    })
  }
}
