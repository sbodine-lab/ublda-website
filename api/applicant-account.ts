import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { ApplicantAccount } from '../src/lib/applicantAccount.ts'
import { validateApplicantAccountPayload } from '../src/lib/applicantAccount.ts'

const baseUrlForRequest = (req: VercelRequest) => {
  const origin = req.headers.origin
  if (typeof origin === 'string' && origin.startsWith('http')) {
    return origin
  }

  const host = req.headers.host
  if (typeof host === 'string' && host) {
    return `https://${host}`
  }

  return ''
}

type GoogleTokenInfo = {
  aud?: string
  email?: string
  email_verified?: string | boolean
  given_name?: string
  family_name?: string
  name?: string
  picture?: string
}

const verifyGoogleCredential = async (credential: string): Promise<ApplicantAccount> => {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`)
  const payload = await response.json().catch(() => null) as GoogleTokenInfo | null

  if (!response.ok || !payload?.email) {
    throw new Error('Google sign-in could not be verified.')
  }

  const configuredAudience = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID
  if (configuredAudience && payload.aud !== configuredAudience) {
    throw new Error('Google sign-in was issued for the wrong client.')
  }

  if (payload.email_verified === false || payload.email_verified === 'false') {
    throw new Error('Google account email is not verified.')
  }

  const email = payload.email.toLowerCase()
  if (!email.endsWith('@umich.edu')) {
    throw new Error('Use your UMich Google account to continue.')
  }

  const uniqname = email.replace(/@.*$/, '')
  const fallbackName = payload.name || uniqname

  return {
    firstName: payload.given_name || fallbackName.split(' ')[0] || uniqname,
    lastName: payload.family_name || fallbackName.split(' ').slice(1).join(' ') || 'Member',
    uniqname,
    email,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const result = validateApplicantAccountPayload(req.body ?? {})
  if (!result.success) {
    return res.status(400).json({
      error: result.errors[0] || 'Please check the account form and try again.',
      errors: result.errors,
    })
  }

  let scriptPayload: Record<string, unknown> = {
    formType: 'applicantAccount',
    ...result.data,
    origin: baseUrlForRequest(req),
  }

  if (result.data.action === 'googleSignIn') {
    try {
      const account = await verifyGoogleCredential(result.data.credential)
      scriptPayload = {
        formType: 'applicantAccount',
        action: 'googleSignIn',
        account,
        origin: baseUrlForRequest(req),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google sign-in failed.'
      return res.status(401).json({ error: message })
    }
  }

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL
  if (!scriptUrl) {
    return res.status(500).json({ error: 'Form backend not configured' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scriptPayload),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok || payload?.success === false) {
      return res.status(response.ok ? 400 : 500).json({
        error: payload?.error || 'Failed to update applicant account',
      })
    }

    return res.status(200).json({
      success: true,
      account: payload?.account || ('account' in result.data ? result.data.account : null),
      sessionToken: payload?.sessionToken || '',
      application: payload?.application || null,
      magicLinkSent: Boolean(payload?.magicLinkSent),
    })
  } catch {
    return res.status(500).json({ error: 'Failed to update applicant account' })
  } finally {
    clearTimeout(timeout)
  }
}
