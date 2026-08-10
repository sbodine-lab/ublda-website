import type { VercelRequest, VercelResponse } from '../server/types.ts'
import { methodNotAllowed, requestIp, setApiSecurityHeaders } from '../server/apiUtils.ts'
import { handleSpeakerOpsRequest } from '../server/speakerOpsService.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)
  if (req.method !== 'POST') return methodNotAllowed(res)
  const result = await handleSpeakerOpsRequest(req.body, requestIp(req))
  return res.status(result.status).json(result.body)
}
