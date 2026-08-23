import type { VercelRequest, VercelResponse } from '../server/types.ts'
import {
  acceptsHoneypot,
  bodyRecord,
  methodNotAllowed,
  setApiSecurityHeaders,
} from '../server/apiUtils.ts'
import { getCraftNightState, handleCraftNightAction } from '../server/craftNightService.ts'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  try {
    if (req.method === 'GET') {
      const result = await getCraftNightState()
      return res.status(result.status).json(result.body)
    }

    if (req.method !== 'POST') {
      return methodNotAllowed(res)
    }

    if (acceptsHoneypot(req.body)) {
      return res.status(200).json({ success: true })
    }

    const result = await handleCraftNightAction(bodyRecord(req.body))
    return res.status(result.status).json(result.body)
  } catch (error) {
    console.error('Craft night API failed', error)
    return res.status(500).json({ error: 'Something went wrong — try again in a minute.' })
  }
}
