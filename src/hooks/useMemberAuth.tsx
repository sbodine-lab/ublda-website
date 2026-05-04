import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { APPLICANT_SESSION_STORAGE_KEY, AUTH_SESSION_CHANGED_EVENT } from '../lib/applicantAccount'
import type { ApplicantAccount, ApplicantApplicationSummary, GoogleProfile } from '../lib/applicantAccount'
import { buildMemberProfile } from '../lib/memberData'
import type { MemberProfile } from '../lib/memberData'

type AuthStatus = 'loading' | 'signed-out' | 'signed-in'

type AuthContextValue = {
  status: AuthStatus
  account: ApplicantAccount | null
  application: ApplicantApplicationSummary | null
  member: MemberProfile | null
  sessionToken: string
  signInWithGoogle: (credential: string, profile?: GoogleProfile) => Promise<void>
  signInWithPassword: (payload: { uniqname: string; password: string }) => Promise<void>
  createAccount: (payload: { firstName: string; lastName: string; uniqname: string; password: string }) => Promise<void>
  requestSignInLink: (uniqname: string) => Promise<void>
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

  return { account, application, sessionToken }
}

export function MemberAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [account, setAccount] = useState<ApplicantAccount | null>(null)
  const [application, setApplication] = useState<ApplicantApplicationSummary | null>(null)
  const [sessionToken, setSessionToken] = useState('')

  const applySession = useCallback((nextAccount: ApplicantAccount, nextApplication: ApplicantApplicationSummary | null, nextToken = '') => {
    setAccount(nextAccount)
    setApplication(nextApplication)
    setStatus('signed-in')

    if (nextToken) {
      setSessionToken(nextToken)
      window.localStorage.setItem(APPLICANT_SESSION_STORAGE_KEY, nextToken)
    }
  }, [])

  const signOut = useCallback(() => {
    window.localStorage.removeItem(APPLICANT_SESSION_STORAGE_KEY)
    setAccount(null)
    setApplication(null)
    setSessionToken('')
    setStatus('signed-out')
  }, [])

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
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleSessionChange)
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
    if (import.meta.env.DEV && credential === 'local-preview-google-credential-token' && profile?.email.endsWith('@umich.edu')) {
      const previewAccount: ApplicantAccount = {
        firstName: profile.firstName || 'Preview',
        lastName: profile.lastName || 'Member',
        uniqname: profile.email.replace(/@.*$/, ''),
        email: profile.email.toLowerCase(),
      }
      applySession(previewAccount, null, 'local-preview-session-token')
      return
    }

    const result = await postAccountAction({ action: 'googleSignIn', credential, profile })

    if (!result.account || !result.sessionToken) {
      throw new Error('Google sign-in did not return a member session.')
    }

    applySession(result.account, result.application, result.sessionToken)
  }, [applySession, postAccountAction])

  const signInWithPassword = useCallback(async (payload: { uniqname: string; password: string }) => {
    const result = await postAccountAction({ action: 'signIn', ...payload })

    if (!result.account || !result.sessionToken) {
      throw new Error('Sign-in did not return a member session.')
    }

    applySession(result.account, result.application, result.sessionToken)
  }, [applySession, postAccountAction])

  const createAccount = useCallback(async (payload: { firstName: string; lastName: string; uniqname: string; password: string }) => {
    const result = await postAccountAction({ action: 'create', ...payload })

    if (!result.account || !result.sessionToken) {
      throw new Error('Account creation did not return a member session.')
    }

    applySession(result.account, result.application, result.sessionToken)
  }, [applySession, postAccountAction])

  const requestSignInLink = useCallback(async (uniqname: string) => {
    await postAccountAction({ action: 'requestMagicLink', uniqname })
  }, [postAccountAction])

  const member = useMemo(() => account ? buildMemberProfile(account, application) : null, [account, application])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    account,
    application,
    member,
    sessionToken,
    signInWithGoogle,
    signInWithPassword,
    createAccount,
    requestSignInLink,
    signOut,
  }), [account, application, createAccount, member, requestSignInLink, sessionToken, signInWithGoogle, signInWithPassword, signOut, status])

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
