import type { VercelRequest, VercelResponse } from './types.ts'
import {
  bodyRecord,
  getString,
  methodNotAllowed,
  setApiSecurityHeaders,
} from '../server/apiUtils.ts'
import { postJsonWithTimeout } from '../server/googleScript.ts'

const uniqnamePattern = /^[a-z0-9._-]{2,32}$/

const normalizeUniqname = (emailOrUniqname: string) => (
  emailOrUniqname.trim().toLowerCase().replace(/@umich\.edu$/i, '').replace(/@.*$/, '')
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  if (req.method !== 'POST') {
    return methodNotAllowed(res)
  }

  const body = bodyRecord(req.body)
  const firstName = getString(body, 'firstName')
  const lastName = getString(body, 'lastName')
  const email = getString(body, 'email')
  const major = getString(body, 'major')
  const year = getString(body, 'year')

  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  if (email.includes('@') && !email.toLowerCase().endsWith('@umich.edu')) {
    return res.status(400).json({ error: 'Use a valid UMich uniqname or email.' })
  }

  const uniqname = normalizeUniqname(email)
  if (!uniqname || !uniqnamePattern.test(uniqname)) {
    return res.status(400).json({ error: 'Use a valid UMich uniqname or email.' })
  }

  if (firstName.length > 80 || lastName.length > 80 || major.length > 120 || year.length > 80) {
    return res.status(400).json({ error: 'One or more fields is too long.' })
  }

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL
  if (!scriptUrl) {
    return res.status(500).json({ error: 'Form backend not configured' })
  }

  try {
    await postJsonWithTimeout(scriptUrl, {
      formType: 'generalMember',
      firstName,
      lastName,
      uniqname,
      year,
      college: major,
    }, 'Failed to submit')
    return res.status(200).json({ success: true })
  } catch {
    return res.status(500).json({ error: 'Failed to submit' })
  }
}
