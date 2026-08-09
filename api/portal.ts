import type { VercelRequest, VercelResponse } from '../server/types.ts'
import { setApiSecurityHeaders } from '../server/apiUtils.ts'
import { handlePortalRequest } from '../server/portalApi.ts'

/**
 * The only new file under api/. Every line of logic lives in server/portalApi.ts, which the
 * Vite dev middleware imports too — so dev and production execute the same function, and
 * that function is type-checked even though api/*.ts is not.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  const result = await handlePortalRequest({ method: req.method, body: req.body })
  return res.status(result.status).json(result.body)
}
