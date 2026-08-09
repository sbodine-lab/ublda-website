import type { VercelRequest, VercelResponse } from './types.ts'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import { canAccessRecruitingAdmin } from '../server/recruitingAdmin.ts'
import {
  methodNotAllowed,
  queryOrBearerSessionToken,
  setApiSecurityHeaders,
} from '../server/apiUtils.ts'
import {
  logRecruitingError,
  recruitingErrorMessage,
  sendRecruitingErrorResponse,
  safeRecruitingSubmissionMetadata,
} from '../server/recruitingErrors.ts'

const asRows = (value: unknown): Record<string, unknown>[] => (
  Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object') : []
)

const stringValue = (value: unknown) => (typeof value === 'string' ? value : '')

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  if (req.method !== 'GET') {
    return methodNotAllowed(res)
  }

  const sessionToken = queryOrBearerSessionToken(req)
  if (!await canAccessRecruitingAdmin(sessionToken)) {
    return res.status(401).json({ error: 'A recruiting admin session is required.' })
  }

  const store = createLocalRecruitingStore()
  try {
    const [slots, dashboardData] = await Promise.all([
      store.publicInterviewSlots(),
      store.leadershipDashboardData(),
    ])
    const candidates = asRows(dashboardData.candidates)
    const interviewers = asRows(dashboardData.interviewerAvailability)
    const resumeChecks = await Promise.all(candidates.map(async (candidate) => {
      const email = stringValue(candidate.email).toLowerCase()
      if (!email) {
        return {
          email,
          resumePresent: false,
          resumeError: 'Candidate email is missing.',
        }
      }

      try {
        const resume = await store.readCandidateResume(email)
        return {
          email,
          resumePresent: Boolean(resume),
          resumeFileName: resume?.fileName || '',
          resumeSize: resume?.size || 0,
          uploadedAt: resume?.uploadedAt || '',
        }
      } catch (error) {
        logRecruitingError('recruiting_health_resume_check_failed', error, safeRecruitingSubmissionMetadata({ email }))
        return {
          email,
          resumePresent: false,
          resumeError: recruitingErrorMessage(error, 'Resume could not be checked.'),
        }
      }
    }))
    const resumeByEmail = new Map(resumeChecks.map((resume) => [resume.email, resume]))
    const bookedSlots = slots.filter((slot) => slot.isBooked)
    const openSlots = slots.filter((slot) => slot.isAvailable)
    const coveredSlots = slots.filter((slot) => slot.interviewerCount > 0)

    return res.status(200).json({
      success: true,
      checkedAt: new Date().toISOString(),
      storage: dashboardData.backendStatus || null,
      counts: {
        candidates: candidates.length,
        interviewers: interviewers.length,
        resumes: resumeChecks.filter((resume) => resume.resumePresent).length,
        totalSlots: slots.length,
        coveredSlots: coveredSlots.length,
        openSlots: openSlots.length,
        bookedSlots: bookedSlots.length,
      },
      candidates: candidates.map((candidate) => {
        const email = stringValue(candidate.email).toLowerCase()
        const resume = resumeByEmail.get(email)
        return {
          name: stringValue(candidate.name),
          email,
          assignedSlot: stringValue(candidate.assignedSlot),
          status: stringValue(candidate.status),
          resumePresent: Boolean(resume?.resumePresent),
          resumeFileName: resume?.resumeFileName || '',
          resumeSize: resume?.resumeSize || 0,
          resumeUploadedAt: resume?.uploadedAt || '',
          resumeError: resume?.resumeError || '',
        }
      }),
      interviewers: interviewers.map((interviewer) => ({
        name: stringValue(interviewer.name),
        email: stringValue(interviewer.email).toLowerCase(),
        availabilityCount: Array.isArray(interviewer.availability) ? interviewer.availability.length : 0,
        maxInterviews: stringValue(interviewer.maxInterviews),
        updatedAt: stringValue(interviewer.updatedAt),
      })),
    })
  } catch (error) {
    logRecruitingError('recruiting_health_failed', error)
    return sendRecruitingErrorResponse(res, error, 'Recruiting health could not be checked.')
  }
}
