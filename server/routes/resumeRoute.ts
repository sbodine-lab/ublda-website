import type { VercelRequest, VercelResponse } from '../types.ts'
import { createLocalRecruitingStore } from '../localRecruitingStore.js'
import { canAccessRecruitingAdmin } from '../recruitingAdmin.ts'
import {
  contentDisposition,
  methodNotAllowed,
  setApiSecurityHeaders,
  singleValue,
} from '../apiUtils.ts'
import {
  logRecruitingError,
  sendRecruitingErrorResponse,
  safeRecruitingSubmissionMetadata,
} from '../recruitingErrors.ts'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  if (req.method !== 'GET') {
    return methodNotAllowed(res)
  }

  const candidateEmail = singleValue(req.query?.candidate).trim().toLowerCase()
  const sessionToken = singleValue(req.query?.sessionToken).trim()

  if (!candidateEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail)) {
    return res.status(400).json({ error: 'Candidate email is required.' })
  }

  try {
    if (!await canAccessRecruitingAdmin(sessionToken)) {
      return res.status(401).json({ error: 'A recruiting admin session is required.' })
    }

    const resume = await createLocalRecruitingStore().readCandidateResume(candidateEmail)
    if (!resume) {
      return res.status(404).json({ error: 'Resume was not found.' })
    }

    res.setHeader?.('Content-Type', resume.mimeType || 'application/octet-stream')
    res.setHeader?.('Content-Disposition', contentDisposition(resume.fileName))
    res.setHeader?.('Content-Length', String(resume.content.length))
    return res.status(200).send(resume.content)
  } catch (error) {
    logRecruitingError('resume_read_failed', error, safeRecruitingSubmissionMetadata({ email: candidateEmail }))
    return sendRecruitingErrorResponse(res, error, 'Resume could not be loaded.')
  }
}
