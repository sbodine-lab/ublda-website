import type { VercelRequest, VercelResponse } from '../server/types.ts'
import {
  methodNotAllowed,
  setApiSecurityHeaders,
} from '../server/apiUtils.ts'

const RETIRED_ACCOUNT_ERROR = (
  'Applicant account authentication is retired. Public application and interview booking remain available.'
)

/**
 * The public site no longer has an applicant-account UI. Keeping the old
 * password, Google, magic-link, or session exchange reachable would preserve a
 * second identity plane beside Logto + Convex, so every former auth action now
 * fails closed. Existing candidate submissions and bookings are unaffected.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  if (req.method !== 'POST') {
    return methodNotAllowed(res)
  }

  return res.status(410).json({
    success: false,
    error: RETIRED_ACCOUNT_ERROR,
  })
}
