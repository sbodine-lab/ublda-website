import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Reveal from '../components/Reveal'
import { useMemberAuth } from '../hooks/useMemberAuth'
import './SignIn.css'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export default function SignIn() {
  const navigate = useNavigate()
  const { status, signInWithGoogle, signInWithPassword, createAccount } = useMemberAuth()
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const [manualMode, setManualMode] = useState<'signin' | 'create'>('signin')
  const [manualForm, setManualForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) {
      return
    }

    const renderGoogleButton = () => {
      if (!window.google || !googleButtonRef.current) {
        return
      }

      googleButtonRef.current.innerHTML = ''
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (!response.credential) {
            setError('Google did not return a sign-in credential.')
            return
          }

          try {
            await signInWithGoogle(response.credential)
            navigate('/dashboard')
          } catch (caughtError) {
            const message = caughtError instanceof Error ? caughtError.message : ''
            setError(message || 'Google sign-in failed.')
          }
        },
      })
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: Math.min(360, googleButtonRef.current.offsetWidth || 360),
        text: 'continue_with',
        shape: 'rectangular',
      })
    }

    if (window.google) {
      renderGoogleButton()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = renderGoogleButton
    document.head.appendChild(script)
  }, [navigate, signInWithGoogle])

  if (status === 'signed-in') {
    return <Navigate to="/dashboard" replace />
  }

  const handlePreviewGoogle = async () => {
    setSubmitting(true)
    setError('')
    setNotice('')

    try {
      await signInWithGoogle('local-preview-google-credential-token', {
        email: 'sbodine@umich.edu',
        firstName: 'Sam',
        lastName: 'Bodine',
        name: 'Sam Bodine',
      })
      navigate('/dashboard')
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : ''
      setError(message || 'Preview Google sign-in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleManualSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setNotice('')

    try {
      if (manualMode === 'signin') {
        await signInWithPassword({
          email: manualForm.email,
          password: manualForm.password,
        })
        navigate('/dashboard')
        return
      }

      if (manualForm.password !== manualForm.confirmPassword) {
        throw new Error('Passwords do not match.')
      }

      if (manualMode === 'create') {
        const result = await createAccount(manualForm)
        if (result === 'signed-in') {
          navigate('/dashboard')
          return
        }

        setManualMode('signin')
        setManualForm((current) => ({
          ...current,
          password: '',
          confirmPassword: '',
        }))
        setNotice('Account created. You can sign in with that email and password anytime.')
        return
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : ''
      setError(message || 'Could not continue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main id="main-content" className="signin-page">
      <section className="signin-page__hero">
        <div className="container signin-page__grid">
          <Reveal>
            <div className="signin-page__copy">
              <p className="section__label">Member Homebase</p>
              <h1>Sign in to your UBLDA dashboard.</h1>
              <div className="signin-page__proof" aria-label="Dashboard features">
                <span>Member status</span>
                <span>Leadership interviews</span>
                <span>UBLDA + BLDA directory</span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="signin-card">
              <div>
                <h2>Continue to UBLDA</h2>
                <p>Sign in or create an account with any email and password.</p>
              </div>

              <div className="signin-card__tabs" role="tablist" aria-label="Sign-in method">
                <button
                  type="button"
                  className={manualMode === 'signin' ? 'signin-card__tab signin-card__tab--active' : 'signin-card__tab'}
                  onClick={() => {
                    setManualMode('signin')
                    setError('')
                    setNotice('')
                  }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className={manualMode === 'create' ? 'signin-card__tab signin-card__tab--active' : 'signin-card__tab'}
                  onClick={() => {
                    setManualMode('create')
                    setError('')
                    setNotice('')
                  }}
                >
                  Create account
                </button>
              </div>

              <form className="signin-card__form" onSubmit={handleManualSubmit}>
                {manualMode === 'create' && (
                  <div className="signin-card__row">
                    <label>
                      <span>First name</span>
                      <input
                        type="text"
                        value={manualForm.firstName}
                        onChange={(event) => setManualForm((current) => ({ ...current, firstName: event.target.value }))}
                        autoComplete="given-name"
                        maxLength={80}
                        required
                      />
                    </label>
                    <label>
                      <span>Last name</span>
                      <input
                        type="text"
                        value={manualForm.lastName}
                        onChange={(event) => setManualForm((current) => ({ ...current, lastName: event.target.value }))}
                        autoComplete="family-name"
                        maxLength={80}
                        required
                      />
                    </label>
                  </div>
                )}

                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    value={manualForm.email}
                    onChange={(event) => setManualForm((current) => ({ ...current, email: event.target.value.trim().toLowerCase() }))}
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={160}
                    placeholder="you@example.com"
                    required
                  />
                </label>

                <label>
                  <span>Password</span>
                  <input
                    type="password"
                    value={manualForm.password}
                    onChange={(event) => setManualForm((current) => ({ ...current, password: event.target.value }))}
                    autoComplete={manualMode === 'signin' ? 'current-password' : 'new-password'}
                    minLength={8}
                    maxLength={128}
                    required
                  />
                </label>

                {manualMode === 'create' && (
                  <label>
                    <span>Confirm password</span>
                    <input
                      type="password"
                      value={manualForm.confirmPassword}
                      onChange={(event) => setManualForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required
                    />
                  </label>
                )}

                {error && <p className="signin-card__error" role="alert">{error}</p>}
                {notice && <p className="signin-card__notice" role="status">{notice}</p>}

                <button type="submit" className="btn btn--primary btn--lg signin-card__submit" disabled={submitting}>
                  {submitting ? 'Working...' : manualMode === 'signin' ? 'Sign in' : 'Create member account'}
                </button>
              </form>

              <div className="signin-card__divider">
                <span>or</span>
              </div>

              {googleClientId ? (
                <div className="signin-card__google" ref={googleButtonRef} aria-label="Continue with Google" />
              ) : import.meta.env.DEV ? (
                <button
                  type="button"
                  className="signin-card__google-preview"
                  onClick={handlePreviewGoogle}
                  disabled={submitting}
                >
                  <span aria-hidden="true">G</span>
                  Continue with Google
                </button>
              ) : (
                <p className="signin-card__notice" role="status">Google sign-in is not configured yet.</p>
              )}

              <Link to="/portal" className="signin-card__portal-link">
                Going straight to leadership interviews?
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  )
}
