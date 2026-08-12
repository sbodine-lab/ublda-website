import type { VercelRequest, VercelResponse } from '../server/types.ts'
import {
  methodNotAllowed,
  setApiSecurityHeaders,
} from '../server/apiUtils.ts'

/**
 * Legacy recruiting dashboards accepted local-store and Apps Script sessions.
 * Leadership administration now lives exclusively in the Logto + Convex
 * workspace, so this endpoint rejects even previously issued sessions.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  if (req.method !== 'POST') {
    return methodNotAllowed(res)
  }

  return res.status(410).json({
    success: false,
    error: 'Legacy dashboard authentication is retired. Sign in through the leadership workspace.',
  })
}
