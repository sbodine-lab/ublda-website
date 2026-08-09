import type { VercelRequest, VercelResponse } from './types.ts'
import { setApiSecurityHeaders, singleValue } from '../server/apiUtils.ts'
import { housingApiPayloadForRoute } from '../server/housingApi.ts'
import type { QueryValue } from '../server/housingApi.ts'

const requestPath = (req: VercelRequest) => {
  const rewrittenPath = singleValue(req.query?.housingPath)
  if (rewrittenPath) return rewrittenPath

  const url = new URL(req.url || '/api/housing', 'http://localhost')
  return url.pathname
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  const payload = housingApiPayloadForRoute(req.method, requestPath(req), {
    query: req.query as Record<string, QueryValue>,
    body: req.body,
    headers: req.headers,
  })

  return res.status(payload.status).json(payload)
}
