import type { AdminScope, DashboardRole } from './dashboardAccess.ts'

export const APPLICANT_SESSION_STORAGE_KEY = 'ubldaApplicantSessionToken'
export const AUTH_SESSION_CHANGED_EVENT = 'ublda-auth-session-changed'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

const normalizeEmail = (value: unknown) => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
)

const emailToDisplayUniqname = (email: string) => {
  const localPart = email.replace(/@.*$/, '').toLowerCase().replace(/[^a-z0-9._-]+/g, '')
  return localPart || 'member'
}

const normalizeAccountIdentity = (body: Record<string, unknown>, errors: string[]) => {
  const submittedEmail = normalizeEmail(getString(body, 'email'))
  const submittedUniqname = normalizeEmail(getString(body, 'uniqname'))
  const identity = submittedEmail || submittedUniqname
  const email = identity.includes('@') ? identity : identity ? `${identity}@umich.edu` : ''

  if (!email || !emailPattern.test(email)) {
    errors.push('A valid email address is required.')
  }

  const uniqname = email ? emailToDisplayUniqname(email) : ''
  return { email, uniqname }
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

  const { email, uniqname } = normalizeAccountIdentity(body, errors)

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
