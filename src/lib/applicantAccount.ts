import { normalizeUniqname } from './application.ts'
import type { AdminScope, DashboardRole } from './dashboardAccess.ts'

export const APPLICANT_SESSION_STORAGE_KEY = 'ubldaApplicantSessionToken'
export const AUTH_SESSION_CHANGED_EVENT = 'ublda-auth-session-changed'

const UMICH_EMAIL_DOMAIN = '@umich.edu'
const uniqnamePattern = /^[a-z0-9._-]{2,32}$/

export type ApplicantAccount = {
  firstName: string
  lastName: string
  uniqname: string
  email: string
  role?: DashboardRole
  adminTitle?: string
  adminScopes?: AdminScope[]
}

export type GoogleProfile = {
  email: string
  firstName: string
  lastName: string
  name?: string
  picture?: string
}

export type ApplicantApplicationSummary = {
  status: string
  interviewSlot: string
  resumeUrl: string
  updatedAt: string
  submissionCount: number
}

export type ApplicantAccountRequest =
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

const getString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key]
  return typeof value === 'string' ? value.trim() : ''
}

const validatePassword = (password: string, errors: string[]) => {
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters.')
  }

  if (password.length > 128) {
    errors.push('Password must be 128 characters or fewer.')
  }
}

export const validateApplicantAccountPayload = (payload: unknown): ValidationResult => {
  if (!payload || typeof payload !== 'object') {
    return { success: false, data: null, errors: ['Request was empty.'] }
  }

  const body = payload as Record<string, unknown>
  const action = getString(body, 'action')
  const errors: string[] = []

  if (action === 'session') {
    const sessionToken = getString(body, 'sessionToken')
    if (sessionToken.length < 24) {
      errors.push('A valid applicant session is required.')
    }

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

    if (credential.length < 20) {
      errors.push('A valid Google sign-in credential is required.')
    }

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

  if (action !== 'create') {
    errors.push('Applicant account action is invalid.')
  }

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
