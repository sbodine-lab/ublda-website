import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, timingSafeEqual } from 'node:crypto'

type ApplicantAccount = {
  firstName: string
  lastName: string
  uniqname: string
  email: string
}

type GoogleProfile = {
  email: string
  firstName: string
  lastName: string
  name?: string
  picture?: string
}

type ApplicantAccountRequest =
  | {
      action: 'create'
      account: ApplicantAccount
      password: string
    }
  | {
      action: 'signIn'
      uniqname: string
      email: string
      password: string
    }
  | {
      action: 'requestMagicLink'
      uniqname: string
      email: string
    }
  | {
      action: 'session'
      sessionToken: string
    }
  | {
      action: 'googleSignIn'
      credential: string
      profile?: GoogleProfile
    }

type ValidationResult =
  | { success: true; data: ApplicantAccountRequest; errors: [] }
  | { success: false; data: null; errors: string[] }

const UMICH_EMAIL_DOMAIN = '@umich.edu'
const uniqnamePattern = /^[a-z0-9._-]{2,32}$/
const INVALID_AUTH_ERROR = 'Invalid uniqname or password.'
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const AUTH_RATE_LIMIT_MAX_FAILURES = 8

type AuthAttemptBucket = {
  count: number
  resetAt: number
}

const authAttemptBuckets = new Map<string, AuthAttemptBucket>()

const setApiSecurityHeaders = (res: VercelResponse) => {
  res.setHeader?.('Cache-Control', 'no-store, max-age=0')
  res.setHeader?.('Pragma', 'no-cache')
  res.setHeader?.('X-Content-Type-Options', 'nosniff')
}

const getString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key]
  return typeof value === 'string' ? value.trim() : ''
}

const normalizeUniqname = (value: unknown) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().toLowerCase().replace(/@.*$/, '')
}

const validatePassword = (password: string, errors: string[]) => {
  if (password.length < 8) errors.push('Password must be at least 8 characters.')
  if (password.length > 128) errors.push('Password must be 128 characters or fewer.')
}

const validateApplicantAccountPayload = (payload: unknown): ValidationResult => {
  if (!payload || typeof payload !== 'object') {
    return { success: false, data: null, errors: ['Request was empty.'] }
  }

  const body = payload as Record<string, unknown>
  const action = getString(body, 'action')
  const errors: string[] = []

  if (action === 'session') {
    const sessionToken = getString(body, 'sessionToken')
    if (sessionToken.length < 24) errors.push('A valid applicant session is required.')

    return errors.length
      ? { success: false, data: null, errors }
      : { success: true, data: { action, sessionToken }, errors: [] }
  }

  if (action === 'googleSignIn') {
    const credential = getString(body, 'credential')
    const profilePayload = body.profile && typeof body.profile === 'object'
      ? body.profile as Record<string, unknown>
      : null
    const profileEmail = profilePayload ? getString(profilePayload, 'email') : ''
    const profileFirstName = profilePayload ? getString(profilePayload, 'firstName') : ''
    const profileLastName = profilePayload ? getString(profilePayload, 'lastName') : ''
    const profileName = profilePayload ? getString(profilePayload, 'name') : ''
    const profilePicture = profilePayload ? getString(profilePayload, 'picture') : ''

    if (credential.length < 20) errors.push('A valid Google sign-in credential is required.')
    if (profileEmail && !profileEmail.toLowerCase().endsWith(UMICH_EMAIL_DOMAIN)) {
      errors.push('Use your UMich Google account to continue.')
    }

    return errors.length
      ? { success: false, data: null, errors }
      : {
          success: true,
          data: {
            action,
            credential,
            profile: profileEmail
              ? {
                  email: profileEmail.toLowerCase(),
                  firstName: profileFirstName,
                  lastName: profileLastName,
                  name: profileName,
                  picture: profilePicture,
                }
              : undefined,
          },
          errors: [],
        }
  }

  const uniqname = normalizeUniqname(getString(body, 'uniqname') || getString(body, 'email'))
  const email = `${uniqname}${UMICH_EMAIL_DOMAIN}`

  if (!uniqname || !uniqnamePattern.test(uniqname)) {
    errors.push('A valid UMich uniqname is required.')
  }

  if (action === 'requestMagicLink') {
    return errors.length
      ? { success: false, data: null, errors }
      : { success: true, data: { action, uniqname, email }, errors: [] }
  }

  const password = getString(body, 'password')

  if (action === 'signIn') {
    validatePassword(password, errors)

    return errors.length
      ? { success: false, data: null, errors }
      : { success: true, data: { action, uniqname, email, password }, errors: [] }
  }

  if (action !== 'create') errors.push('Applicant account action is invalid.')

  const firstName = getString(body, 'firstName')
  const lastName = getString(body, 'lastName')

  if (!firstName) errors.push('First name is required.')
  if (!lastName) errors.push('Last name is required.')
  validatePassword(password, errors)

  return errors.length
    ? { success: false, data: null, errors }
    : {
        success: true,
        data: {
          action: 'create',
          account: {
            firstName,
            lastName,
            uniqname,
            email,
          },
          password,
        },
        errors: [],
      }
}

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

const superAdminPassword = () => (
  process.env.UBLDA_SUPER_ADMIN_PASSWORD
  || process.env.SAM_BODINE_PASSWORD
  || ''
)

const localAdminFallbackEnabled = () => process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK === 'true'

const superAdminSessionSecret = () => superAdminPassword()

const signSessionPayload = (payload: string) => {
  const secret = superAdminSessionSecret()
  if (!secret) {
    throw new Error('Super-admin session secret is not configured.')
  }

  return createHmac('sha256', secret).update(payload).digest('base64url')
}

const createSuperAdminSessionToken = () => {
  const payload = Buffer.from(JSON.stringify({
    email: 'sbodine@umich.edu',
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
  })).toString('base64url')
  return `ublda_admin.${payload}.${signSessionPayload(payload)}`
}

const constantTimeEquals = (submitted: string, expected: string) => {
  const submittedBuffer = Buffer.from(submitted)
  const expectedBuffer = Buffer.from(expected)

  return submittedBuffer.length === expectedBuffer.length && timingSafeEqual(submittedBuffer, expectedBuffer)
}

const verifyLocalSuperAdminSession = (sessionToken: string) => {
  if (!localAdminFallbackEnabled() || !superAdminSessionSecret()) {
    return false
  }

  const [prefix, payload, signature] = sessionToken.split('.')
  if (prefix !== 'ublda_admin' || !payload || !signature) return false
  if (!constantTimeEquals(signature, signSessionPayload(payload))) return false

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { email?: string; exp?: number }
    return decoded.email === 'sbodine@umich.edu' && typeof decoded.exp === 'number' && decoded.exp > Date.now()
  } catch {
    return false
  }
}

const superAdminPasswordAccount = (uniqname: string, password: string): ApplicantAccount | null => {
  const normalizedUniqname = uniqname.toLowerCase().replace(/@.*$/, '')
  if (normalizedUniqname !== 'sbodine') {
    return null
  }

  const expectedPassword = superAdminPassword()
  if (!expectedPassword || !constantTimeEquals(password, expectedPassword)) {
    throw new Error(INVALID_AUTH_ERROR)
  }

  return {
    firstName: 'Sam',
    lastName: 'Bodine',
    uniqname: 'sbodine',
    email: 'sbodine@umich.edu',
  }
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

const superAdminAccountResponse = {
  firstName: 'Sam',
  lastName: 'Bodine',
  uniqname: 'sbodine',
  email: 'sbodine@umich.edu',
  role: 'super-admin',
  adminTitle: 'Super Admin',
  adminScopes: ['recruiting', 'members', 'events', 'sponsors', 'publishing', 'system'],
}

const localSuperAdminResponse = () => ({
  success: true,
  account: superAdminAccountResponse,
  sessionToken: createSuperAdminSessionToken(),
  application: null,
})

const requestIp = (req: VercelRequest) => {
  const forwardedFor = req.headers['x-forwarded-for']
  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0] || 'unknown'
  }

  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }

  return req.socket?.remoteAddress || 'unknown'
}

const authAttemptKey = (req: VercelRequest, uniqname: string) => `${requestIp(req)}:${uniqname}`

const pruneExpiredAuthBuckets = (now: number) => {
  if (authAttemptBuckets.size < 128) return

  authAttemptBuckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) {
      authAttemptBuckets.delete(key)
    }
  })
}

const isRateLimited = (key: string) => {
  const now = Date.now()
  pruneExpiredAuthBuckets(now)
  const bucket = authAttemptBuckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    authAttemptBuckets.delete(key)
    return false
  }

  return bucket.count >= AUTH_RATE_LIMIT_MAX_FAILURES
}

const recordAuthFailure = (key: string) => {
  const now = Date.now()
  const existing = authAttemptBuckets.get(key)

  if (!existing || existing.resetAt <= now) {
    authAttemptBuckets.set(key, { count: 1, resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS })
    return
  }

  authAttemptBuckets.set(key, {
    count: existing.count + 1,
    resetAt: existing.resetAt,
  })
}

const clearAuthFailures = (key: string) => {
  authAttemptBuckets.delete(key)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

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
  let fallbackToLocalAdmin = false
  const signInRateLimitKey = result.data.action === 'signIn'
    ? authAttemptKey(req, result.data.uniqname)
    : ''

  if (signInRateLimitKey && isRateLimited(signInRateLimitKey)) {
    return res.status(429).json({
      error: 'Too many sign-in attempts. Please wait a few minutes and try again.',
    })
  }

  if (result.data.action === 'session' && verifyLocalSuperAdminSession(result.data.sessionToken)) {
    return res.status(200).json({
      success: true,
      account: superAdminAccountResponse,
      application: null,
    })
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

  if (result.data.action === 'signIn') {
    try {
      const adminAccount = superAdminPasswordAccount(result.data.uniqname, result.data.password)
      fallbackToLocalAdmin = Boolean(adminAccount)
      scriptPayload = adminAccount
        ? {
            formType: 'applicantAccount',
            action: 'googleSignIn',
            account: adminAccount,
            origin: baseUrlForRequest(req),
          }
        : {
            formType: 'applicantAccount',
            action: 'signIn',
            uniqname: result.data.uniqname,
            email: result.data.email,
            password: result.data.password,
            origin: baseUrlForRequest(req),
          }
    } catch (error) {
      if (signInRateLimitKey) recordAuthFailure(signInRateLimitKey)
      const message = error instanceof Error ? error.message : INVALID_AUTH_ERROR
      return res.status(401).json({ error: message })
    }
  }

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL
  if (!scriptUrl) {
    if (fallbackToLocalAdmin && localAdminFallbackEnabled()) {
      if (signInRateLimitKey) clearAuthFailures(signInRateLimitKey)
      return res.status(200).json(localSuperAdminResponse())
    }

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
      if (fallbackToLocalAdmin && localAdminFallbackEnabled()) {
        if (signInRateLimitKey) clearAuthFailures(signInRateLimitKey)
        return res.status(200).json(localSuperAdminResponse())
      }

      if (result.data.action === 'requestMagicLink' && response.ok) {
        return res.status(200).json({
          success: true,
          magicLinkSent: Boolean(payload?.magicLinkSent),
        })
      }

      if (result.data.action === 'signIn') {
        if (payload?.code === 'EMAIL_VERIFICATION_REQUIRED') {
          return res.status(403).json({
            error: payload?.error || 'Check your UMich email to finish setting up your account before signing in.',
            code: 'EMAIL_VERIFICATION_REQUIRED',
          })
        }

        if (signInRateLimitKey) recordAuthFailure(signInRateLimitKey)
        return res.status(401).json({ error: INVALID_AUTH_ERROR })
      }

      return res.status(response.ok ? 400 : 500).json({
        error: payload?.error || 'Failed to update applicant account',
      })
    }

    if (signInRateLimitKey) clearAuthFailures(signInRateLimitKey)

    if (result.data.action === 'create') {
      return res.status(200).json({
        success: true,
        accountCreated: Boolean(payload?.accountCreated ?? true),
        magicLinkSent: Boolean(payload?.magicLinkSent ?? true),
      })
    }

    return res.status(200).json({
      success: true,
      account: payload?.account || (fallbackToLocalAdmin ? superAdminAccountResponse : 'account' in result.data ? result.data.account : null),
      sessionToken: payload?.sessionToken || '',
      application: payload?.application || null,
      magicLinkSent: Boolean(payload?.magicLinkSent),
    })
  } catch {
    if (fallbackToLocalAdmin && localAdminFallbackEnabled()) {
      if (signInRateLimitKey) clearAuthFailures(signInRateLimitKey)
      return res.status(200).json(localSuperAdminResponse())
    }

    if (result.data.action === 'signIn' && signInRateLimitKey) {
      recordAuthFailure(signInRateLimitKey)
    }

    return res.status(500).json({ error: 'Failed to update applicant account' })
  } finally {
    clearTimeout(timeout)
  }
}
