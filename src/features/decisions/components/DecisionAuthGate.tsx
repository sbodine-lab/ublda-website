import { useState, type PropsWithChildren } from "react"
import { ArrowUpRight, ShieldCheck } from "lucide-react"
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
      setError(caught instanceof Error ? caught.message : "sign-in could not be started.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main id="main-content" className="dc-auth-page">
      {adapter.mode === "demo" && <span className="dc-preview-pill dc-auth-preview-pill">local preview</span>}

      <section className="dc-auth-panel" aria-labelledby="decision-sign-in-title">
        <a href="/" aria-label="UBLDA home" className="dc-logo-lockup dc-auth-logo">
          <img src="/logo.png" alt="" />
          <span>UBLDA</span>
        </a>
        <h1 id="decision-sign-in-title">a decision is waiting.</h1>

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
          <Button className="dc-google-button dc-auth-action dc-touch" size="lg" onClick={signIn} disabled={submitting || snapshot.auth.status === "loading"}>
            {submitting || snapshot.auth.status === "loading" ? <Spinner /> : <ShieldCheck aria-hidden="true" />}
            continue to sign in
          </Button>
        )}

        {error && <p className="dc-inline-error" role="alert">{error}</p>}

        <Button variant="outline" size="lg" className="dc-open-browser-button dc-auth-action dc-touch" asChild>
          <a href={openHref} target="_blank" rel="noreferrer">
            open in your browser <ArrowUpRight aria-hidden="true" />
          </a>
        </Button>
      </section>
    </main>
  )
}
