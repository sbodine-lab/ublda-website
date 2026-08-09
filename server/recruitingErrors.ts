import { createHash } from 'node:crypto'
import type { VercelResponse } from './types.ts'

type RecruitingErrorMetadata = Record<string, string | number | boolean | null | undefined>

const STORAGE_UNAVAILABLE_MESSAGE = 'Recruiting storage is temporarily unavailable. Please refresh in a minute.'

const knownConflictCodes = new Set([
  'SLOT_TAKEN',
  'ALREADY_BOOKED',
  'NO_INTERVIEWER_COVERAGE',
  // updateData throws WRITE_CONFLICT after 5 CAS attempts against the blob. It is a
  // conflict the caller can retry, not a server fault — 409, never 500.
  'WRITE_CONFLICT',
])

const codeFromError = (error: unknown) => (
  typeof error === 'object' && error && 'code' in error ? String(error.code || '') : ''
)

export const recruitingErrorCode = (error: unknown) => {
  const explicitCode = codeFromError(error)
  if (explicitCode) return explicitCode

  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : String(error || '')
  if (/BlobStoreSuspendedError|Blob.*(suspended|paused|unavailable|quota|limit)|store has been suspended/i.test(`${name} ${message}`)) {
    return 'BLOB_UNAVAILABLE'
  }

  return ''
}

export const recruitingErrorStatus = (error: unknown) => {
  const code = recruitingErrorCode(error)
  if (code === 'BLOB_UNAVAILABLE') return 503
  if (knownConflictCodes.has(code)) return 409
  if (code === 'INVALID_SLOT') return 400
  return 500
}

export const recruitingErrorMessage = (error: unknown, fallback: string) => {
  const code = recruitingErrorCode(error)
  if (code === 'BLOB_UNAVAILABLE') return STORAGE_UNAVAILABLE_MESSAGE
  if (code && error instanceof Error && error.message) return error.message
  return fallback
}

export const sendRecruitingErrorResponse = (
  res: VercelResponse,
  error: unknown,
  fallback: string,
) => res.status(recruitingErrorStatus(error)).json({
  error: recruitingErrorMessage(error, fallback),
})

export const emailFingerprint = (email: string) => (
  createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 16)
)

export const safeRecruitingSubmissionMetadata = (submission: {
  email?: string
  slotValue?: string
  resumeFile?: {
    name?: string
    size?: number
    mimeType?: string
  }
} = {}) => {
  const email = submission.email?.trim().toLowerCase() || ''
  return {
    emailHash: email ? emailFingerprint(email) : '',
    emailDomain: email.includes('@') ? email.replace(/^.*@/, '@') : '',
    slotValue: submission.slotValue || '',
    resumeFileName: submission.resumeFile?.name || '',
    resumeFileSize: typeof submission.resumeFile?.size === 'number' ? submission.resumeFile.size : 0,
    resumeMimeType: submission.resumeFile?.mimeType || '',
    hasResumeFile: Boolean(submission.resumeFile?.name),
  }
}

export const logRecruitingError = (
  event: string,
  error: unknown,
  metadata: RecruitingErrorMetadata = {},
) => {
  const errorMessage = error instanceof Error ? error.message : String(error || '')
  console.error(JSON.stringify({
    event,
    code: recruitingErrorCode(error) || 'UNKNOWN',
    status: recruitingErrorStatus(error),
    message: errorMessage.slice(0, 300),
    ...metadata,
  }))
}
