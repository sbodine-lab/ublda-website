import { useState, type FormEvent, type PropsWithChildren } from "react"
import { ArrowUpRight } from "lucide-react"
import { useLocation } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useDecisionData } from "../decisionDataContext"

export function DecisionAuthGate({ children }: PropsWithChildren) {
  const { adapter, snapshot } = useDecisionData()
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [needsVerification, setNeedsVerification] = useState(false)

  if (snapshot.auth.status === "signed-in") return children

  const openHref = typeof window === "undefined" ? "/decisions" : window.location.href
  const isSchedulingLink = location.pathname === "/schedule" || location.pathname.startsWith("/s/")
  const isWorkspaceSignIn = location.pathname === "/workspace"
    || location.pathname === "/calendar"
    || location.pathname === "/projects"
    || location.pathname === "/people"
    || location.pathname === "/decisions"
    || location.pathname.startsWith("/decisions/")
    || location.pathname === "/results"
    || location.pathname === "/scheduling"
    || location.pathname.startsWith("/scheduling/")

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(undefined)
    try {
      const result = await adapter.signIn({ email, password })
      setNeedsVerification(result.status === "needs-verification")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "sign-in could not be completed.")
    } finally {
      setPassword("")
      setSubmitting(false)
    }
  }

  const signInWithGoogle = async () => {
    setSubmitting(true)
    setError(undefined)
    try {
      await adapter.signInWithGoogle()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google sign-in could not be started.")
      setSubmitting(false)
    }
  }

  const signInWithEmailCode = async () => {
    setSubmitting(true)
    setError(undefined)
    try {
      await adapter.signInWithEmailCode(email)
      setNeedsVerification(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A sign-in code could not be sent.")
    } finally {
      setSubmitting(false)
    }
  }

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(undefined)
    try {
      await adapter.verifySignInCode(verificationCode)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "sign-in could not be completed.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main id="main-content" className="dc-auth-page">
      {adapter.mode === "demo" && <Badge variant="outline" className="dc-auth-preview-pill">local preview</Badge>}

      <section className="dc-auth-panel" aria-labelledby="decision-sign-in-title">
        <a href="/" aria-label="UBLDA home" className="dc-logo-lockup dc-auth-logo">
          <img src="/logo.png" alt="" />
        </a>
        <h1 id="decision-sign-in-title">{isWorkspaceSignIn ? "Leadership sign in" : isSchedulingLink ? "A scheduling poll is waiting" : "A question is waiting"}</h1>

        {snapshot.auth.status === "misconfigured" ? (
          <Alert variant="destructive">
            <AlertTitle>sign-in is not configured</AlertTitle>
            <AlertDescription>{snapshot.auth.message}</AlertDescription>
          </Alert>
        ) : snapshot.auth.status === "access-denied" ? (
          <div className="dc-auth-denied">
            <Alert variant="destructive">
              <AlertTitle>this account is not approved</AlertTitle>
              <AlertDescription>{snapshot.auth.message}</AlertDescription>
            </Alert>
            <Button variant="outline" className="dc-touch" onClick={() => void adapter.signOut()}>
              try another account
            </Button>
          </div>
        ) : (
          needsVerification ? (
            <form className="dc-auth-form" onSubmit={verify}>
              <p className="dc-auth-code-sent">Check your email for a one-time sign-in code.</p>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="decision-verification-code">verification code</FieldLabel>
                  <Input
                    id="decision-verification-code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    required
                    autoFocus
                  />
                </Field>
                <Button type="submit" size="lg" className="dc-touch" disabled={submitting || !verificationCode.trim()}>
                  {submitting && <Spinner data-icon="inline-start" />}
                  verify
                </Button>
              </FieldGroup>
            </form>
          ) : (
            <div className="dc-auth-form">
              <p className="dc-auth-guidance">Use your U-M Google account, a one-time email code, or your Leadership Workspace password.</p>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="dc-auth-google dc-touch"
                disabled={submitting || snapshot.auth.status === "loading"}
                onClick={() => void signInWithGoogle()}
              >
                {submitting || snapshot.auth.status === "loading" ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <svg viewBox="0 0 18 18" role="img" aria-label="Google" data-icon="inline-start">
                    <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.877 2.684-6.614Z" />
                    <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.909-2.258c-.806.54-1.836.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.333A8.998 8.998 0 0 0 9 18Z" />
                    <path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.681 9c0-.592.102-1.167.282-1.706V4.961H.956A8.997 8.997 0 0 0 0 9c0 1.452.347 2.827.956 4.039l3.007-2.333Z" />
                    <path fill="#EA4335" d="M9 3.58c1.322 0 2.507.454 3.441 1.345l2.581-2.581C13.464.892 11.43 0 9 0A8.998 8.998 0 0 0 .956 4.961l3.007 2.333C4.672 5.165 6.656 3.58 9 3.58Z" />
                  </svg>
                )}
                continue with google
              </Button>

              <div className="dc-auth-divider" aria-hidden="true"><span>or</span></div>

              <form onSubmit={signIn}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="decision-email">email</FieldLabel>
                    <Input
                      id="decision-email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="decision-password">password</FieldLabel>
                    <Input
                      id="decision-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </Field>
                  <Button type="submit" size="lg" className="dc-touch" disabled={submitting || snapshot.auth.status === "loading" || !email.trim() || !password}>
                    {submitting || snapshot.auth.status === "loading" ? <Spinner data-icon="inline-start" /> : null}
                    sign in
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="dc-touch"
                    disabled={submitting || snapshot.auth.status === "loading" || !email.trim()}
                    onClick={() => void signInWithEmailCode()}
                  >
                    {submitting || snapshot.auth.status === "loading" ? <Spinner data-icon="inline-start" /> : null}
                    email me a sign-in code
                  </Button>
                </FieldGroup>
              </form>
            </div>
          )
        )}

        {error && <p className="dc-inline-error" role="alert">{error}</p>}

        <Button variant="outline" size="lg" className="dc-auth-secondary-action dc-touch" asChild>
          <a href={openHref} target="_blank" rel="noreferrer">
            open in your browser <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
          </a>
        </Button>
      </section>
    </main>
  )
}
