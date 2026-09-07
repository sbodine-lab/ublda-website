import type { VercelRequest, VercelResponse } from '../server/types.ts'
import {
  acceptsHoneypot,
  bodyRecord,
  methodNotAllowed,
  setApiSecurityHeaders,
} from '../server/apiUtils.ts'
import { getBbaMtcShiftState, handleBbaMtcShiftAction } from '../server/bbaMtcShiftService.ts'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  try {
    if (req.method === 'GET') {
      const result = await getBbaMtcShiftState()
      return res.status(result.status).json(result.body)
    }
    if (req.method !== 'POST') return methodNotAllowed(res)
    if (acceptsHoneypot(req.body)) return res.status(200).json({ success: true })

    const result = await handleBbaMtcShiftAction(bodyRecord(req.body))
    return res.status(result.status).json(result.body)
  } catch (error) {
    console.error('BBA MTC shift signup API failed', error)
    return res.status(500).json({ error: 'Something went wrong. Try again in a minute.' })
  }
}
