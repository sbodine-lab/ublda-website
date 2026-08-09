import type { VercelRequest, VercelResponse } from '../server/types.ts'
import {
  buildInterviewAssignmentSubmission,
  validateInterviewAssignmentPayload,
} from '../src/lib/interviewAssignment.ts'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import {
  bodyRecord,
  getString,
  headerValue,
  methodNotAllowed,
  setApiSecurityHeaders,
  validationError,
} from '../server/apiUtils.ts'
import { postGoogleScript, shouldMirrorToLegacyScript } from '../server/googleScript.ts'
import { recruitingAdminAccessForSession } from '../server/recruitingAdmin.ts'

const mirrorToLegacyScript = async (submission: ReturnType<typeof buildInterviewAssignmentSubmission>) => {
  const result = await postGoogleScript(submission, 'Failed to mirror assignment')
  const payload = result?.payload

  return {
    row: payload?.row || null,
    calendarEventCreated: Boolean(payload?.calendarEventCreated),
  }
}

const assignmentErrorStatus = (error: unknown) => {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''
  return ['SLOT_TAKEN', 'INTERVIEWER_UNAVAILABLE'].includes(code) ? 400 : 500
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  if (req.method !== 'POST') {
    return methodNotAllowed(res)
  }

  const body = bodyRecord(req.body)
  if (getString(body, 'sessionToken').length < 24) {
    return res.status(401).json({ error: 'A valid admin session is required.' })
  }

  const result = validateInterviewAssignmentPayload(body)
  if (!result.success) {
    return validationError(res, result.errors, 'Please check the assignment and try again.')
  }

  try {
    const adminAccess = await recruitingAdminAccessForSession(result.data.sessionToken)
    if (!adminAccess.authorized) {
      return res.status(adminAccess.status).json({ error: adminAccess.error })
    }

    const submission = buildInterviewAssignmentSubmission(result.data, headerValue(req.headers['user-agent']))
    const saved = await createLocalRecruitingStore().saveInterviewAssignment(submission)
    const legacyResult = shouldMirrorToLegacyScript()
      ? await mirrorToLegacyScript(submission)
      : { row: null, calendarEventCreated: false }

    return res.status(200).json({
      success: true,
      source: 'vercel',
      updatedCandidate: saved.updatedCandidate,
      row: legacyResult.row,
      calendarEventCreated: legacyResult.calendarEventCreated,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save assignment'
    return res.status(assignmentErrorStatus(error)).json({ error: message })
  }
}
