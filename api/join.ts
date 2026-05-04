import type { VercelRequest, VercelResponse } from '@vercel/node'

const uniqnamePattern = /^[a-z0-9._-]{2,32}$/

const setApiSecurityHeaders = (res: VercelResponse) => {
  res.setHeader?.('Cache-Control', 'no-store, max-age=0')
  res.setHeader?.('Pragma', 'no-cache')
  res.setHeader?.('X-Content-Type-Options', 'nosniff')
}

const getString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key]
  return typeof value === 'string' ? value.trim() : ''
}

const normalizeUniqname = (emailOrUniqname: string) => (
  emailOrUniqname.trim().toLowerCase().replace(/@umich\.edu$/i, '').replace(/@.*$/, '')
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {}
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
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, uniqname, year, college: major }),
    })

    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to submit' })
    }

    return res.status(200).json({ success: true })
  } catch {
    return res.status(500).json({ error: 'Failed to submit' })
  }
}
