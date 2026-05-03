import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Reveal from '../components/Reveal'
import { useMemberAuth } from '../hooks/useMemberAuth'
import { normalizeUniqname } from '../lib/application'
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
  const { status, signInWithGoogle, createAccount, requestSignInLink } = useMemberAuth()
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const [manualMode, setManualMode] = useState<'create' | 'link'>('create')
  const [manualForm, setManualForm] = useState({
    firstName: '',
    lastName: '',
    uniqname: '',
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
        email: 'preview.member@umich.edu',
        firstName: 'Preview',
        lastName: 'Member',
        name: 'Preview Member',
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
      if (manualMode === 'create') {
        await createAccount(manualForm)
        navigate('/dashboard')
        return
      }

      await requestSignInLink(manualForm.uniqname)
      setNotice('Check your UMich inbox for a secure sign-in link.')
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
              <h1>Sign in once. Keep your UBLDA life in one place.</h1>
              <p>
                Use a UMich Google account for the fastest path into the dashboard,
                interview signup, opportunities board, calendar, news, and member directory.
              </p>
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
                <p>Low-friction access for members, applicants, and future resources.</p>
              </div>

              {googleClientId ? (
                <div className="signin-card__google" ref={googleButtonRef} aria-label="Continue with Google" />
              ) : (
                <button
                  type="button"
                  className="signin-card__google-preview"
                  onClick={handlePreviewGoogle}
                  disabled={submitting}
                >
                  <span aria-hidden="true">G</span>
                  Continue with Google
                </button>
              )}

              <div className="signin-card__divider">
                <span>or use uniqname</span>
              </div>

              <div className="signin-card__tabs" role="tablist" aria-label="Sign-in method">
                <button
                  type="button"
                  className={manualMode === 'create' ? 'signin-card__tab signin-card__tab--active' : 'signin-card__tab'}
                  onClick={() => {
                    setManualMode('create')
                    setError('')
                    setNotice('')
                  }}
                >
                  First time
                </button>
                <button
                  type="button"
                  className={manualMode === 'link' ? 'signin-card__tab signin-card__tab--active' : 'signin-card__tab'}
                  onClick={() => {
                    setManualMode('link')
                    setError('')
                    setNotice('')
                  }}
                >
                  Email link
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
                        required
                      />
                    </label>
                  </div>
                )}

                <label>
                  <span>UMich uniqname</span>
                  <div className="signin-card__email">
                    <input
                      type="text"
                      value={manualForm.uniqname}
                      onChange={(event) => setManualForm((current) => ({ ...current, uniqname: normalizeUniqname(event.target.value) }))}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      required
                    />
                    <small>@umich.edu</small>
                  </div>
                </label>

                {error && <p className="signin-card__error" role="alert">{error}</p>}
                {notice && <p className="signin-card__notice" role="status">{notice}</p>}

                <button type="submit" className="btn btn--primary btn--lg signin-card__submit" disabled={submitting}>
                  {submitting ? 'Working...' : manualMode === 'create' ? 'Create member account' : 'Send secure link'}
                </button>
              </form>

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
