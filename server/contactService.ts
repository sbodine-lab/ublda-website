import { createHash } from 'node:crypto'
import { bodyRecord } from './apiUtils.ts'

export const CONTACT_RECIPIENTS = {
  to: ['alexfors@umich.edu'],
  cc: ['cooperry@umich.edu', 'atchiang@umich.edu', 'sbodine@umich.edu'],
}
const attempts = new Map<string, { count: number; until: number }>()
const failure = 'Your message could not be sent. Please try again or email alexfors@umich.edu.'

type Options = {
  apiKey?: string
  from?: string
  fetcher?: typeof fetch
  now?: number
}
export async function sendContactInquiry(body: unknown, ip: string, options: Options = {}) {
  const data = bodyRecord(body)
  if (typeof data.website === 'string' && data.website.trim()) {
    return { status: 200, body: { success: true } }
  }
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''
  const organization = typeof data.organization === 'string' ? data.organization.trim() : ''
  const message = typeof data.message === 'string' ? data.message.trim() : ''
  if (!name || !message || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    return { status: 400, body: { error: 'Please enter your name, a valid email address, and a message.' } }
  }
  if (name.length > 120 || email.length > 254 || organization.length > 160 || message.length > 4000 || /[\r\n]/.test(name + organization)) {
    return { status: 400, body: { error: 'One or more fields is too long or contains invalid characters.' } }
  }
  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY
  const from = options.from ?? process.env.CONTACT_FROM_EMAIL
  if (!apiKey || !from) return { status: 503, body: { error: failure } }

  // A bounded, per-instance burst guard complements the form's honeypot.
  const now = options.now ?? Date.now()
  for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key)
  const ipKey = createHash('sha256').update(ip).digest('hex')
  const previous = attempts.get(ipKey)
  if ((previous?.count ?? 0) >= 5 || attempts.size >= 10000) {
    return { status: 429, body: { error: 'Please wait a few minutes before sending another message.' } }
  }
  attempts.set(ipKey, { count: (previous?.count ?? 0) + 1, until: previous?.until ?? now + 10 * 60_000 })
  const text = `New inquiry from the UBLDA Consulting contact form\n\nName: ${name}\nOrganization: ${organization || 'Not provided'}\nEmail: ${email}\n\nMessage:\n${message}\n\nReply to this email to respond to the sender.`
  // Exact retries reuse the provider's 24-hour deduplication window.
  const idempotencyKey = createHash('sha256').update(JSON.stringify({ name, email, organization, message })).digest('hex')
  try {
    const response = await (options.fetcher ?? fetch)('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `consulting-${idempotencyKey}` },
      body: JSON.stringify({ from, ...CONTACT_RECIPIENTS, reply_to: email, subject: `UBLDA Consulting inquiry — ${name}`, text }),
      signal: AbortSignal.timeout(12000),
    })
    const result = await response.json() as { id?: string }
    if (!response.ok || typeof result.id !== 'string' || !result.id) return { status: 502, body: { error: failure } }
    return { status: 200, body: { success: true } }
  } catch {
    return { status: 502, body: { error: failure } }
  }
}
