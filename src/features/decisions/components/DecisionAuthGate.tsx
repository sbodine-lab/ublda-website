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
          <span>UBLDA</span>
        </a>
        <h1 id="decision-sign-in-title">{isWorkspaceSignIn ? "admin sign in" : isSchedulingLink ? "a scheduling poll is waiting" : "a decision is waiting"}</h1>

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
            <form className="dc-auth-form" onSubmit={signIn}>
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
                    autoFocus
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
              </FieldGroup>
            </form>
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
