import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { APPLICANT_SESSION_STORAGE_KEY, AUTH_SESSION_CHANGED_EVENT } from '../lib/applicantAccount'
import type { ApplicantAccount, ApplicantApplicationSummary, GoogleProfile } from '../lib/applicantAccount'
import {
  canPublish as canPublishEmail,
  effectiveRoleForAccount,
  scopesForEmail,
} from '../lib/dashboardAccess'
import type { AdminScope, DashboardRole } from '../lib/dashboardAccess'
import { buildMemberProfile } from '../lib/memberData'
import type { MemberProfile } from '../lib/memberData'

type AuthStatus = 'loading' | 'signed-out' | 'signed-in'

type AuthContextValue = {
  status: AuthStatus
  account: ApplicantAccount | null
  application: ApplicantApplicationSummary | null
  member: MemberProfile | null
  sessionToken: string
  /**
   * A RENDERING HINT, never an authorization decision (spec §4.2). It decides
   * which sidebar items exist and which route a sign-in lands on. Every write is
   * re-checked server-side against the session, so a tampered client value buys
   * a 403, not access.
   */
  role: DashboardRole
  isAdmin: boolean
  isSuperAdmin: boolean
  /** `super-admin` satisfies every scope, matching `requireScope` on the server. */
  hasScope: (scope: AdminScope) => boolean
  canPublish: boolean
  signInWithGoogle: (credential: string, profile?: GoogleProfile) => Promise<void>
  signInWithPassword: (payload: { email: string; password: string }) => Promise<void>
  createAccount: (payload: { firstName: string; lastName: string; email: string; password: string }) => Promise<'signed-in' | 'verification-sent'>
  requestSignInLink: (email: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const toPortalAccount = (payload: Record<string, unknown> | null) => {
  const account = payload?.account && typeof payload.account === 'object'
    ? payload.account as ApplicantAccount
    : null
  const application = payload?.application && typeof payload.application === 'object'
    ? payload.application as ApplicantApplicationSummary
    : null
  const sessionToken = typeof payload?.sessionToken === 'string' ? payload.sessionToken : ''
  const accountCreated = Boolean(payload?.accountCreated)
  const magicLinkSent = Boolean(payload?.magicLinkSent)

  return { account, application, sessionToken, accountCreated, magicLinkSent }
}

const notifySessionChanged = () => {
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT))
}

export function MemberAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [account, setAccount] = useState<ApplicantAccount | null>(null)
  const [application, setApplication] = useState<ApplicantApplicationSummary | null>(null)
  const [sessionToken, setSessionToken] = useState('')

  const applySession = useCallback((
    nextAccount: ApplicantAccount,
    nextApplication: ApplicantApplicationSummary | null,
    nextToken = '',
    shouldNotify = false,
  ) => {
    setAccount(nextAccount)
    setApplication(nextApplication)
    setStatus('signed-in')

    if (nextToken) {
      setSessionToken(nextToken)
      window.localStorage.setItem(APPLICANT_SESSION_STORAGE_KEY, nextToken)
      if (shouldNotify) notifySessionChanged()
    }
  }, [])

  const signOut = useCallback(() => {
    const tokenToRevoke = sessionToken || window.localStorage.getItem(APPLICANT_SESSION_STORAGE_KEY) || ''
    if (tokenToRevoke.length >= 24 && tokenToRevoke !== 'local-preview-session-token') {
      void fetch('/api/applicant-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout', sessionToken: tokenToRevoke }),
      }).catch(() => undefined)
    }

    window.localStorage.removeItem(APPLICANT_SESSION_STORAGE_KEY)
    setAccount(null)
    setApplication(null)
    setSessionToken('')
    setStatus('signed-out')
    notifySessionChanged()
  }, [sessionToken])

  const restoreStoredSession = useCallback(async () => {
    const url = new URL(window.location.href)
    const urlToken = url.searchParams.get('session') || ''
    let storedToken = window.localStorage.getItem(APPLICANT_SESSION_STORAGE_KEY) || ''

    if (urlToken.length >= 24) {
      storedToken = urlToken
      window.localStorage.setItem(APPLICANT_SESSION_STORAGE_KEY, urlToken)
      url.searchParams.delete('session')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }

    if (!storedToken) {
      setStatus('signed-out')
      return
    }

    if (import.meta.env.DEV && storedToken === 'local-preview-session-token') {
      applySession({
        firstName: 'Sam',
        lastName: 'Bodine',
        uniqname: 'sbodine',
        email: 'sbodine@umich.edu',
        // DEV ONLY. This branch is the local preview session, which the store
        // already treats as the super admin; without the verified marker the
        // preview lands on the member face and the admin shell is unreachable
        // locally. Production never reaches this line — `restoreSession` hard
        // rejects the preview token and a test pins that.
        verifiedVia: 'google',
      }, null, storedToken)
      return
    }

    try {
      const response = await fetch('/api/applicant-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'session', sessionToken: storedToken }),
      })
      const result = await response.json().catch(() => null) as Record<string, unknown> | null
      const restored = toPortalAccount(result)

      if (!response.ok || !restored.account) {
        throw new Error('Session expired')
      }

      applySession(restored.account, restored.application, storedToken)
    } catch {
      signOut()
    }
  }, [applySession, signOut])

  useEffect(() => {
    void restoreStoredSession()
  }, [restoreStoredSession])

  useEffect(() => {
    const handleSessionChange = () => {
      void restoreStoredSession()
    }

    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, handleSessionChange)
    window.addEventListener('storage', handleSessionChange)

    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleSessionChange)
      window.removeEventListener('storage', handleSessionChange)
    }
  }, [restoreStoredSession])

  const postAccountAction = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch('/api/applicant-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null

    if (!response.ok) {
      throw new Error(typeof result?.error === 'string' ? result.error : 'Could not sign in.')
    }

    return toPortalAccount(result)
  }, [])

  const signInWithGoogle = useCallback(async (credential: string, profile?: GoogleProfile) => {
    if (import.meta.env.DEV && credential === 'local-preview-google-credential-token' && profile?.email) {
      const previewAccount: ApplicantAccount = {
        firstName: profile.firstName || 'Preview',
        lastName: profile.lastName || 'Member',
        uniqname: profile.email.replace(/@.*$/, ''),
        email: profile.email.toLowerCase(),
        // DEV ONLY, and honest: this branch *is* the simulated Google path.
        verifiedVia: 'google',
      }
      applySession(previewAccount, null, 'local-preview-session-token', true)
      return
    }

    const result = await postAccountAction({ action: 'googleSignIn', credential, profile })

    if (!result.account || !result.sessionToken) {
      throw new Error('Google sign-in did not return a member session.')
    }

    applySession(result.account, result.application, result.sessionToken, true)
  }, [applySession, postAccountAction])

  const signInWithPassword = useCallback(async (payload: { email: string; password: string }) => {
    const result = await postAccountAction({ action: 'signIn', ...payload })

    if (!result.account || !result.sessionToken) {
      throw new Error('Sign-in did not return a member session.')
    }

    applySession(result.account, result.application, result.sessionToken, true)
  }, [applySession, postAccountAction])

  const createAccount = useCallback(async (payload: { firstName: string; lastName: string; email: string; password: string }) => {
    const result = await postAccountAction({ action: 'create', ...payload })

    if (result.account && result.sessionToken) {
      applySession(result.account, result.application, result.sessionToken, true)
      return 'signed-in'
    }

    if (result.accountCreated || result.magicLinkSent) {
      return 'verification-sent'
    }

    throw new Error('Account creation did not return a verification link.')
  }, [applySession, postAccountAction])

  const requestSignInLink = useCallback(async (email: string) => {
    await postAccountAction({ action: 'requestMagicLink', email })
  }, [postAccountAction])

  const member = useMemo(() => account ? buildMemberProfile(account, application) : null, [account, application])

  /**
   * Elevation follows `effectiveRoleForAccount`, the same rule the store uses:
   * an explicitly granted role wins, otherwise only a Google-verified identity
   * gets the roster's role. Anyone can self-register an officer's address on the
   * public form, so a matching email string alone is worth nothing.
   */
  const role = useMemo<DashboardRole>(() => {
    if (!account) return 'member'
    return effectiveRoleForAccount({
      email: account.email,
      role: account.role,
      verifiedVia: account.verifiedVia,
    })
  }, [account])

  const isAdmin = role === 'exec' || role === 'super-admin'
  const isSuperAdmin = role === 'super-admin'

  const scopes = useMemo<AdminScope[]>(() => {
    if (!account || !isAdmin) return []
    // A console-granted scope set is the truth when it exists; the static roster
    // is the fallback so a fresh Google sign-in is not scopeless.
    const granted = account.adminScopes
    return granted && granted.length > 0 ? granted : scopesForEmail(account.email)
  }, [account, isAdmin])

  const hasScope = useCallback(
    (scope: AdminScope) => isSuperAdmin || scopes.includes(scope),
    [isSuperAdmin, scopes],
  )

  const canPublish = Boolean(account && isAdmin && canPublishEmail(account.email))

  const value = useMemo<AuthContextValue>(() => ({
    status,
    account,
    application,
    member,
    sessionToken,
    role,
    isAdmin,
    isSuperAdmin,
    hasScope,
    canPublish,
    signInWithGoogle,
    signInWithPassword,
    createAccount,
    requestSignInLink,
    signOut,
  }), [account, application, canPublish, createAccount, hasScope, isAdmin, isSuperAdmin, member, requestSignInLink, role, sessionToken, signInWithGoogle, signInWithPassword, signOut, status])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// The provider and hook live together so auth state stays easy to reason about in this small Vite app.
// eslint-disable-next-line react-refresh/only-export-components
export const useMemberAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useMemberAuth must be used inside MemberAuthProvider')
  }

  return context
}
