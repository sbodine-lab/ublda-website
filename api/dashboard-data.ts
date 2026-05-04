import type { VercelRequest, VercelResponse } from '@vercel/node'

const getSessionToken = (body: unknown) => {
  if (!body || typeof body !== 'object') return ''
  const token = (body as Record<string, unknown>).sessionToken
  return typeof token === 'string' ? token.trim() : ''
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sessionToken = getSessionToken(req.body)
  if (sessionToken.length < 24) {
    return res.status(401).json({ error: 'A valid member session is required.' })
  }

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL
  if (!scriptUrl) {
    return res.status(500).json({ error: 'Dashboard backend not configured' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formType: 'applicantAccount',
        action: 'dashboardData',
        sessionToken,
      }),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok || payload?.success === false) {
      return res.status(response.ok ? 401 : 500).json({
        error: payload?.error || 'Could not load dashboard data',
      })
    }

    return res.status(200).json({
      success: true,
      account: payload?.account || null,
      role: payload?.role || 'member',
      dashboardData: payload?.dashboardData || {},
    })
  } catch {
    return res.status(500).json({ error: 'Could not load dashboard data' })
  } finally {
    clearTimeout(timeout)
  }
}
