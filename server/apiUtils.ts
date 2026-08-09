import type { VercelRequest, VercelResponse } from '../api/types.ts'

export type JsonRecord = Record<string, unknown>

export const setApiSecurityHeaders = (res: VercelResponse) => {
  res.setHeader?.('Cache-Control', 'no-store, max-age=0')
  res.setHeader?.('Pragma', 'no-cache')
  res.setHeader?.('X-Content-Type-Options', 'nosniff')
}

export const methodNotAllowed = (res: VercelResponse) => (
  res.status(405).json({ error: 'Method not allowed' })
)

export const validationError = (
  res: VercelResponse,
  errors: string[],
  fallback: string,
) => res.status(400).json({
  error: errors[0] || fallback,
  errors,
})

export const bodyRecord = (body: unknown): JsonRecord => (
  body && typeof body === 'object' ? body as JsonRecord : {}
)

export const headerValue = (value: string | string[] | undefined) => (
  Array.isArray(value) ? value[0] || '' : value || ''
)

export const singleValue = (value: string | string[] | undefined) => headerValue(value)

export const cleanString = (value: unknown, options: { stripMarkup?: boolean } = {}) => {
  if (typeof value !== 'string') return ''
  const stripped = options.stripMarkup === false ? value : value.replace(/[<>]/g, '')
  return stripped.trim()
}

export const getString = (
  payload: JsonRecord,
  key: string,
  options: { stripMarkup?: boolean } = {},
) => cleanString(payload[key], options)

export const getNumber = (payload: JsonRecord, key: string) => {
  const value = payload[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
}

export const acceptsHoneypot = (body: unknown, field = 'website') => {
  const payload = bodyRecord(body)
  return typeof payload[field] === 'string' && payload[field].trim().length > 0
}

export const requestIp = (req: VercelRequest) => {
  const forwardedFor = req.headers['x-forwarded-for']
  const forwarded = headerValue(forwardedFor)
  return forwarded.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
}

export const bearerToken = (value: string | string[] | undefined) => {
  const match = headerValue(value).match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || ''
}

export const queryOrBearerSessionToken = (req: VercelRequest) => (
  singleValue(req.query?.sessionToken).trim() || bearerToken(req.headers.authorization)
)

export const contentDisposition = (fileName: string, disposition: 'inline' | 'attachment' = 'inline') => {
  const safeName = fileName.replace(/["\r\n]/g, '')
  return `${disposition}; filename="${safeName || 'resume.pdf'}"`
}
