import type { VercelRequest, VercelResponse } from './types.ts'
import { bodyRecord, getString, headerValue, setApiSecurityHeaders } from './apiUtils.ts'
import {
  authBridgeConfig,
  exchangeLogtoIdToken,
} from './convexAuthBridge.ts'

const MAX_ID_TOKEN_LENGTH = 24_000

export async function convexAuthHandler(req: VercelRequest, res: VercelResponse) {
  let config: ReturnType<typeof authBridgeConfig>
  try {
    config = authBridgeConfig()
  } catch (error) {
    console.error('convex_auth_configuration_error', error instanceof Error ? error.message : 'Unknown error')
    setApiSecurityHeaders(res)
    return res.status(503).json({ error: 'Leadership authentication is not configured.' })
  }

  if (req.method === 'GET') {
    res.setHeader?.('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
    res.setHeader?.('X-Content-Type-Options', 'nosniff')
    return res.status(200).json(config.publicJwks)
  }

  setApiSecurityHeaders(res)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const origin = headerValue(req.headers.origin).replace(/\/$/, '')
  if (origin && !config.allowedOrigins.has(origin)) {
    return res.status(403).json({ error: 'This sign-in request came from an unapproved origin.' })
  }

  const idToken = getString(bodyRecord(req.body), 'idToken', { stripMarkup: false })
  if (!idToken || idToken.length > MAX_ID_TOKEN_LENGTH) {
    return res.status(400).json({ error: 'A valid Logto identity token is required.' })
  }

  try {
    return res.status(200).json(await exchangeLogtoIdToken(idToken, config))
  } catch (error) {
    console.error('convex_auth_exchange_failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(401).json({ error: 'The leadership sign-in session could not be verified.' })
  }
}
