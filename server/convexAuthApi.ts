import type { VercelRequest, VercelResponse } from './types.ts'
import { bodyRecord, getString, headerValue, setApiSecurityHeaders } from './apiUtils.ts'
import {
  AuthBridgeTokenError,
  authBridgeConfig,
  exchangeLogtoIdToken,
  type AuthBridgeConfig,
} from './convexAuthBridge.ts'

const rejectedTokenErrorCodes = new Set([
  'ERR_JOSE_ALG_NOT_ALLOWED',
  'ERR_JOSE_NOT_SUPPORTED',
  'ERR_JWS_INVALID',
  'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  'ERR_JWT_CLAIM_VALIDATION_FAILED',
  'ERR_JWT_EXPIRED',
  'ERR_JWT_INVALID',
  'ERR_JWKS_NO_MATCHING_KEY',
])

export const authBridgeExchangeFailureStatus = (error: unknown): 401 | 503 => {
  if (error instanceof AuthBridgeTokenError) return 401
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string' && rejectedTokenErrorCodes.has(code)) return 401
  }
  return 503
}

const MAX_ID_TOKEN_LENGTH = 24_000
const MAX_REQUEST_BYTES = 32 * 1_024
const allowedFetchSites = new Set(['same-origin', 'same-site'])

type ConvexAuthHandlerOptions = {
  config?: AuthBridgeConfig
  exchange?: typeof exchangeLogtoIdToken
}

const requestHeader = (req: VercelRequest, name: string) => {
  const normalized = name.toLowerCase()
  const entry = Object.entries(req.headers).find(([key]) => key.toLowerCase() === normalized)
  return headerValue(entry?.[1]).trim()
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

const setAuthApiSecurityHeaders = (res: VercelResponse) => {
  setApiSecurityHeaders(res)
  res.setHeader?.('Referrer-Policy', 'no-referrer')
  res.setHeader?.('X-Frame-Options', 'DENY')
}

const approvedRequestOrigin = (req: VercelRequest, config: AuthBridgeConfig) => {
  const raw = requestHeader(req, 'origin')
  if (!raw) return false
  try {
    const url = new URL(raw)
    return !url.username
      && !url.password
      && url.pathname === '/'
      && !url.search
      && !url.hash
      && config.allowedOrigins.has(url.origin)
  } catch {
    return false
  }
}

export async function convexAuthHandler(
  req: VercelRequest,
  res: VercelResponse,
  options: ConvexAuthHandlerOptions = {},
) {
  let config: AuthBridgeConfig
  try {
    config = options.config ?? authBridgeConfig()
  } catch (error) {
    // Configuration may contain signing material. Never echo parser/import
    // messages derived from environment values into provider logs.
    console.error('convex_auth_configuration_error', error instanceof Error ? error.name : 'UnknownError')
    setAuthApiSecurityHeaders(res)
    return res.status(503).json({ error: 'Leadership authentication is not configured.' })
  }

  if (req.method === 'GET') {
    res.setHeader?.('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
    res.setHeader?.('X-Content-Type-Options', 'nosniff')
    return res.status(200).json(config.publicJwks)
  }

  setAuthApiSecurityHeaders(res)
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const contentType = requestHeader(req, 'content-type').toLowerCase()
  if (!/^application\/json(?:\s*;|$)/.test(contentType)) {
    return res.status(415).json({ error: 'The authentication request must be JSON.' })
  }

  const contentLength = requestHeader(req, 'content-length')
  const announcedLength = contentLength ? Number(contentLength) : 0
  if (
    (contentLength && (!Number.isInteger(announcedLength) || announcedLength < 0))
    || announcedLength > MAX_REQUEST_BYTES
    || bodySize(req.body) > MAX_REQUEST_BYTES
  ) {
    return res.status(413).json({ error: 'The authentication request is too large.' })
  }

  const fetchSite = requestHeader(req, 'sec-fetch-site').toLowerCase()
  if (
    !approvedRequestOrigin(req, config)
    || (fetchSite && !allowedFetchSites.has(fetchSite))
  ) {
    return res.status(403).json({ error: 'This sign-in request came from an unapproved origin.' })
  }

  const idToken = getString(bodyRecord(req.body), 'idToken', { stripMarkup: false })
  if (!idToken || idToken.length > MAX_ID_TOKEN_LENGTH) {
    return res.status(400).json({ error: 'A valid Logto identity token is required.' })
  }

  try {
    return res.status(200).json(await (options.exchange ?? exchangeLogtoIdToken)(idToken, config))
  } catch (error) {
    // Keep provider details and all token material out of both logs and the
    // response. The error class is enough to distinguish operational failures.
    console.error('convex_auth_exchange_failed', error instanceof Error ? error.name : 'UnknownError')
    const status = authBridgeExchangeFailureStatus(error)
    return res.status(status).json({
      error: status === 401
        ? 'The leadership sign-in session could not be verified.'
        : 'Leadership authentication is temporarily unavailable.',
    })
  }
}
