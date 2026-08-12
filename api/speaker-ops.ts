import type { VercelRequest, VercelResponse } from '../server/types.ts'
import { headerValue, methodNotAllowed, requestIp, setApiSecurityHeaders } from '../server/apiUtils.ts'
import { handleSpeakerOpsRequest } from '../server/speakerOpsService.js'

const MAX_REQUEST_BYTES = 64 * 1_024
const allowedFetchSites = new Set(['same-origin', 'same-site'])

type SpeakerOpsHandlerOptions = {
  allowedOrigins?: Set<string>
  handleRequest?: typeof handleSpeakerOpsRequest
}

const requestHeader = (req: VercelRequest, name: string) => {
  const normalized = name.toLowerCase()
  const entry = Object.entries(req.headers).find(([key]) => key.toLowerCase() === normalized)
  return headerValue(entry?.[1]).trim()
}

const configuredOrigins = () => new Set(
  (process.env.CONVEX_AUTH_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      try {
        return new URL(origin).origin
      } catch {
        return ''
      }
    })
    .filter(Boolean),
)

const approvedOrigin = (raw: string, allowedOrigins: Set<string>) => {
  if (!raw) return false
  try {
    const url = new URL(raw)
    return !url.username
      && !url.password
      && url.pathname === '/'
      && !url.search
      && !url.hash
      && allowedOrigins.has(url.origin)
  } catch {
    return false
  }
}

const bodySize = (body: unknown) => {
  if (typeof body === 'string') return Buffer.byteLength(body, 'utf8')
  if (Buffer.isBuffer(body)) return body.byteLength
  try {
    return Buffer.byteLength(JSON.stringify(body ?? {}), 'utf8')
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
  options: SpeakerOpsHandlerOptions = {},
) {
  setApiSecurityHeaders(res)
  res.setHeader?.('Referrer-Policy', 'no-referrer')
  res.setHeader?.('X-Frame-Options', 'DENY')
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST')
    return methodNotAllowed(res)
  }

  const contentType = requestHeader(req, 'content-type').toLowerCase()
  if (!/^application\/json(?:\s*;|$)/.test(contentType)) {
    return res.status(415).json({ error: 'The Speaker Ops request must be JSON.' })
  }

  const contentLength = requestHeader(req, 'content-length')
  const announcedLength = contentLength ? Number(contentLength) : 0
  if (
    (contentLength && (!Number.isInteger(announcedLength) || announcedLength < 0))
    || announcedLength > MAX_REQUEST_BYTES
    || bodySize(req.body) > MAX_REQUEST_BYTES
  ) {
    return res.status(413).json({ error: 'The Speaker Ops request is too large.' })
  }

  const origin = requestHeader(req, 'origin')
  const fetchSite = requestHeader(req, 'sec-fetch-site').toLowerCase()
  const allowedOrigins = options.allowedOrigins ?? configuredOrigins()
  if (
    !approvedOrigin(origin, allowedOrigins)
    || (fetchSite && !allowedFetchSites.has(fetchSite))
  ) {
    return res.status(403).json({ error: 'This Speaker Ops request came from an unapproved origin.' })
  }

  const result = await (options.handleRequest ?? handleSpeakerOpsRequest)(req.body, requestIp(req))
  return res.status(result.status).json(result.body)
}
