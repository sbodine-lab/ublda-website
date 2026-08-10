import { useState, type PropsWithChildren } from "react"
import { ArrowUpRight, LockKeyhole, ShieldCheck } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useDecisionData } from "../decisionDataContext"

export function DecisionAuthGate({ children }: PropsWithChildren) {
  const { adapter, snapshot } = useDecisionData()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()

  if (snapshot.auth.status === "signed-in") return children

  const openHref = typeof window === "undefined" ? "/decisions" : window.location.href

  const signIn = async () => {
    setSubmitting(true)
    setError(undefined)
    try {
      await adapter.signIn()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in could not be started.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main id="main-content" className="dc-auth-page">
      <div className="dc-auth-header">
        <a href="/" aria-label="UBLDA home" className="dc-logo-lockup">
          <img src="/logo.png" alt="" />
          <span>UBLDA</span>
        </a>
        {adapter.mode === "demo" && <span className="dc-preview-pill">Local preview</span>}
      </div>

      <section className="dc-auth-panel" aria-labelledby="decision-sign-in-title">
        <div className="dc-auth-icon" aria-hidden="true"><LockKeyhole /></div>
        <p className="dc-eyebrow">Decision Center</p>
        <h1 id="decision-sign-in-title">A private UBLDA decision is waiting.</h1>
        <p className="dc-auth-copy">
          Sign in with an approved account to see the question and respond. Decision details stay hidden until your identity is verified.
        </p>

        {snapshot.auth.status === "misconfigured" ? (
          <Alert variant="destructive">
            <AlertTitle>Sign-in is not configured</AlertTitle>
            <AlertDescription>{snapshot.auth.message}</AlertDescription>
          </Alert>
        ) : snapshot.auth.status === "access-denied" ? (
          <div className="dc-auth-denied">
            <Alert variant="destructive">
              <AlertTitle>This account is not approved</AlertTitle>
              <AlertDescription>{snapshot.auth.message}</AlertDescription>
            </Alert>
            <Button variant="outline" className="dc-touch" onClick={() => void adapter.signOut()}>
              Try another account
            </Button>
          </div>
        ) : (
          <Button className="dc-google-button dc-touch" size="lg" onClick={signIn} disabled={submitting || snapshot.auth.status === "loading"}>
            {submitting || snapshot.auth.status === "loading" ? <Spinner /> : <ShieldCheck aria-hidden="true" />}
            Continue to sign in
          </Button>
        )}

        {error && <p className="dc-inline-error" role="alert">{error}</p>}

        <div className="dc-embedded-help">
          <p>Opening this from Messages and sign-in is stuck?</p>
          <Button variant="outline" className="dc-touch" asChild>
            <a href={openHref} target="_blank" rel="noreferrer">
              Open in your browser <ArrowUpRight />
            </a>
          </Button>
        </div>

        <p className="dc-privacy-note">
          Access is tied to your board roster identity. UBLDA does not publish individual responses to other voters by default.
        </p>
      </section>
    </main>
  )
}
