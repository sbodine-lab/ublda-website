import type { VercelRequest, VercelResponse } from '../server/types.ts'
import { setApiSecurityHeaders, singleValue } from '../server/apiUtils.ts'
import recruitingExportRoute from '../server/routes/recruitingExportRoute.ts'
import recruitingHealthRoute from '../server/routes/recruitingHealthRoute.ts'
import resumeRoute from '../server/routes/resumeRoute.ts'

/**
 * One function, three recruiting-admin endpoints. The Hobby plan caps a
 * deployment at 12 Serverless Functions and `api/` was at 14, so these three
 * fold together behind the same `?recruitingPath=` dispatch `api/housing.ts`
 * already uses. The public URLs are unchanged — `vercel.json` rewrites
 * `/api/resume`, `/api/recruiting-export` and `/api/recruiting-health` here and
 * Vercel merges the caller's own query string in.
 */
const ROUTES: Record<string, (req: VercelRequest, res: VercelResponse) => unknown> = {
  '/recruiting-export': recruitingExportRoute,
  '/recruiting-health': recruitingHealthRoute,
  '/resume': resumeRoute,
}

const requestPath = (req: VercelRequest) => {
  const rewrittenPath = singleValue(req.query?.recruitingPath)
  if (rewrittenPath) return rewrittenPath

  const url = new URL(req.url || '/api/recruiting', 'http://localhost')
  return url.pathname.replace(/^\/api/, '')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const route = ROUTES[requestPath(req)]

  if (!route) {
    setApiSecurityHeaders(res)
    return res.status(404).json({ error: 'Unknown recruiting endpoint.' })
  }

  // Each route sets its own security headers, same as when they were top-level.
  return route(req, res)
}
