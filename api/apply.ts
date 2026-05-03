import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  buildApplicationSubmission,
  validateApplicationPayload,
} from '../src/lib/application.ts'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body ?? {}

  if (typeof body.website === 'string' && body.website.trim()) {
    return res.status(200).json({ success: true })
  }

  const result = validateApplicationPayload(body)
  if (!result.success) {
    return res.status(400).json({
      error: result.errors[0] || 'Please check the form and try again.',
      errors: result.errors,
    })
  }

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL
  if (!scriptUrl) {
    return res.status(500).json({ error: 'Form backend not configured' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const submission = buildApplicationSubmission(result.data, req.headers['user-agent'] || '')
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok || payload?.success === false) {
      return res.status(response.ok ? 400 : 500).json({
        error: payload?.error || 'Failed to submit',
      })
    }

    return res.status(200).json({
      success: true,
      status: submission.status,
      calendarEventCreated: Boolean(payload?.calendarEventCreated),
    })
  } catch {
    return res.status(500).json({ error: 'Failed to submit' })
  } finally {
    clearTimeout(timeout)
  }
}
