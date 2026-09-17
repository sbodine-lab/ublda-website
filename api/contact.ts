import type { VercelRequest, VercelResponse } from '../server/types.ts'
import { headerValue, methodNotAllowed, requestIp, setApiSecurityHeaders } from '../server/apiUtils.ts'
import { sendContactInquiry } from '../server/contactService.ts'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)
  if (req.method !== 'POST') return methodNotAllowed(res)
  const origin = headerValue(req.headers.origin)
  if (origin !== 'https://ublda.org' && origin !== 'https://www.ublda.org') {
    return res.status(403).json({ error: 'Please use the contact form at ublda.org/consulting/contact.' })
  }
  if (!headerValue(req.headers['content-type']).toLowerCase().startsWith('application/json')) {
    return res.status(415).json({ error: 'Please submit the contact form as JSON.' })
  }
  const result = await sendContactInquiry(req.body, requestIp(req))
  if (result.status === 429) res.setHeader?.('Retry-After', '600')
  return res.status(result.status).json(result.body)
}
