import type { VercelRequest, VercelResponse } from '../server/types.ts'
import { methodNotAllowed, setApiSecurityHeaders } from '../server/apiUtils.ts'
import { getLocalWeather } from '../server/weatherService.ts'

const requestHeaders = (req: VercelRequest) => {
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    const firstValue = Array.isArray(value) ? value[0] : value
    if (firstValue) headers.set(name, firstValue)
  }
  return headers
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)
  res.setHeader?.('Cache-Control', 'private, max-age=600')

  if (req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET')
    return methodNotAllowed(res)
  }

  try {
    return res.status(200).json(await getLocalWeather(requestHeaders(req)))
  } catch (error) {
    console.error('Local weather unavailable', error)
    return res.status(503).json({ error: 'Local weather is temporarily unavailable.' })
  }
}
