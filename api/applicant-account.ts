import type { VercelRequest, VercelResponse } from './types.ts'
import {
  validateApplicantAccountPayload,
} from '../src/lib/applicantAccount.ts'
import type { ApplicantAccount } from '../src/lib/applicantAccount.ts'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import {
  methodNotAllowed,
  requestIp,
  setApiSecurityHeaders,
} from '../server/apiUtils.ts'
import {
  localAdminFallbackEnabled,
  localSuperAdminAuthResponse,
  superAdminAccount,
  superAdminPasswordAccount,
  verifyLocalSuperAdminSession,
} from '../server/adminSessions.ts'
import { postRawJsonWithTimeout } from '../server/googleScript.ts'
import {
  logRecruitingError,
  sendRecruitingErrorResponse,
  safeRecruitingSubmissionMetadata,
} from '../server/recruitingErrors.ts'

const INVALID_AUTH_ERROR = 'Invalid email or password.'
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const AUTH_RATE_LIMIT_MAX_FAILURES = 8

type AuthAttemptBucket = {
  count: number
  resetAt: number
}

const authAttemptBuckets = new Map<string, AuthAttemptBucket>()

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
  const uniqname = email.replace(/@.*$/, '')
  const fallbackName = payload.name || uniqname

  return {
    firstName: payload.given_name || fallbackName.split(' ')[0] || uniqname,
    lastName: payload.family_name || fallbackName.split(' ').slice(1).join(' ') || 'Member',
    uniqname,
    email,
  }
}

const authAttemptKey = (req: VercelRequest, email: string) => `${requestIp(req)}:${email}`

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
    return methodNotAllowed(res)
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
  let googleStoredSession: Awaited<ReturnType<ReturnType<typeof createLocalRecruitingStore>['upsertAccount']>> | null = null
  const signInRateLimitKey = result.data.action === 'signIn'
    ? authAttemptKey(req, result.data.email)
    : ''

  if (signInRateLimitKey && isRateLimited(signInRateLimitKey)) {
    return res.status(429).json({
      error: 'Too many sign-in attempts. Please wait a few minutes and try again.',
    })
  }

  if (result.data.action === 'session' && verifyLocalSuperAdminSession(result.data.sessionToken)) {
    return res.status(200).json({
      success: true,
      account: superAdminAccount,
      application: null,
    })
  }

  if (result.data.action === 'session') {
    try {
      const restored = await createLocalRecruitingStore().restoreSession(result.data.sessionToken)
      if (restored) {
        return res.status(200).json({
          success: true,
          account: restored.account,
          sessionToken: restored.sessionToken,
          application: restored.application,
        })
      }
    } catch (error) {
      logRecruitingError('applicant_session_restore_failed', error)
      if (!process.env.GOOGLE_SCRIPT_URL) {
        return sendRecruitingErrorResponse(res, error, 'Session storage is temporarily unavailable.')
      }
    }
  }

  if (result.data.action === 'logout') {
    try {
      await createLocalRecruitingStore().deleteSession(result.data.sessionToken)
      return res.status(200).json({ success: true })
    } catch (error) {
      logRecruitingError('applicant_logout_failed', error)
      return sendRecruitingErrorResponse(res, error, 'Could not sign out right now.')
    }
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

      // Google is the only provider that may elevate an officer to their roster role
      // (effectiveRoleForAccount refuses to elevate a password account that merely matches
      // an officer's email). Record the verified identity in the store so the portal — which
      // reads sessions from the store, never from Apps Script — can resolve that role later.
      try {
        googleStoredSession = await createLocalRecruitingStore().upsertAccount({
          ...account,
          verifiedVia: 'google',
        })
      } catch (error) {
        logRecruitingError('applicant_google_store_upsert_failed', error, safeRecruitingSubmissionMetadata({
          email: account.email,
        }))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google sign-in failed.'
      return res.status(401).json({ error: message })
    }
  }

  if (result.data.action === 'signIn') {
    try {
      const adminAccount = superAdminPasswordAccount(result.data.email, result.data.password, INVALID_AUTH_ERROR)
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

  if (result.data.action === 'create') {
    try {
      const stored = await createLocalRecruitingStore().upsertAccount(result.data.account, result.data.password)
      return res.status(200).json({
        success: true,
        accountCreated: true,
        account: stored.account,
        sessionToken: stored.sessionToken,
        application: stored.application,
      })
    } catch (error) {
      logRecruitingError('applicant_account_create_failed', error, safeRecruitingSubmissionMetadata({
        email: result.data.account.email,
      }))
      return sendRecruitingErrorResponse(res, error, 'Could not create that account right now.')
    }
  }

  if (result.data.action === 'signIn' && !fallbackToLocalAdmin) {
    try {
      const stored = await createLocalRecruitingStore().signIn(result.data.email, result.data.password)
      if (stored) {
        if (signInRateLimitKey) clearAuthFailures(signInRateLimitKey)
        return res.status(200).json({
          success: true,
          account: stored.account,
          sessionToken: stored.sessionToken,
          application: stored.application,
        })
      }
    } catch (error) {
      logRecruitingError('applicant_account_signin_failed', error, safeRecruitingSubmissionMetadata({
        email: result.data.email,
      }))
      if (!process.env.GOOGLE_SCRIPT_URL) {
        return sendRecruitingErrorResponse(res, error, 'Could not sign in right now.')
      }
    }
  }

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL
  if (fallbackToLocalAdmin && localAdminFallbackEnabled()) {
    if (signInRateLimitKey) clearAuthFailures(signInRateLimitKey)
    return res.status(200).json(localSuperAdminAuthResponse())
  }

  if (result.data.action === 'session' && !scriptUrl) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' })
  }

  // Google sign-in no longer depends on Apps Script being configured: the store already
  // holds the verified account, so hand back its session directly. When Apps Script IS
  // configured we still forward below, to keep the legacy sheet in sync.
  if (googleStoredSession && !scriptUrl) {
    return res.status(200).json({
      success: true,
      account: googleStoredSession.account,
      sessionToken: googleStoredSession.sessionToken,
      application: googleStoredSession.application,
    })
  }

  if (!scriptUrl) {
    return res.status(500).json({ error: 'Form backend not configured' })
  }

  try {
    const { response, payload } = await postRawJsonWithTimeout(scriptUrl, scriptPayload)

    if (!response.ok || payload?.success === false) {
      if (fallbackToLocalAdmin && localAdminFallbackEnabled()) {
        if (signInRateLimitKey) clearAuthFailures(signInRateLimitKey)
        return res.status(200).json(localSuperAdminAuthResponse())
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
            error: payload?.error || 'Check your email to finish setting up your account before signing in.',
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

    // The portal resolves sessions from the store only, so a Google sign-in returns the
    // store session even when Apps Script answered — otherwise the officer signs in and is
    // then 401'd by /api/portal.
    if (googleStoredSession) {
      return res.status(200).json({
        success: true,
        account: googleStoredSession.account,
        sessionToken: googleStoredSession.sessionToken,
        application: googleStoredSession.application || payload?.application || null,
      })
    }

    return res.status(200).json({
      success: true,
      account: payload?.account || (fallbackToLocalAdmin ? superAdminAccount : 'account' in result.data ? result.data.account : null),
      sessionToken: payload?.sessionToken || '',
      application: payload?.application || null,
      magicLinkSent: Boolean(payload?.magicLinkSent),
    })
  } catch {
    if (fallbackToLocalAdmin && localAdminFallbackEnabled()) {
      if (signInRateLimitKey) clearAuthFailures(signInRateLimitKey)
      return res.status(200).json(localSuperAdminAuthResponse())
    }

    if (result.data.action === 'signIn' && signInRateLimitKey) {
      recordAuthFailure(signInRateLimitKey)
    }

    return res.status(500).json({ error: 'Failed to update applicant account' })
  }
}
