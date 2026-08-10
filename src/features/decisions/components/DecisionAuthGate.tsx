import { useState, type PropsWithChildren } from "react"
import { ArrowUpRight, ShieldCheck } from "lucide-react"
import { useLocation } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useDecisionData } from "../decisionDataContext"

export function DecisionAuthGate({ children }: PropsWithChildren) {
  const { adapter, snapshot } = useDecisionData()
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()

  if (snapshot.auth.status === "signed-in") return children

  const openHref = typeof window === "undefined" ? "/decisions" : window.location.href
  const isWorkspaceSignIn = location.pathname === "/decisions" || location.pathname.startsWith("/decisions/") || location.pathname === "/results"

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
      {adapter.mode === "demo" && <Badge variant="outline" className="dc-auth-preview-pill">local preview</Badge>}

      <section className="dc-auth-panel" aria-labelledby="decision-sign-in-title">
        <a href="/" aria-label="UBLDA home" className="dc-logo-lockup dc-auth-logo">
          <img src="/logo.png" alt="" />
          <span>UBLDA</span>
        </a>
        <h1 id="decision-sign-in-title">{isWorkspaceSignIn ? "admin sign in" : "a decision is waiting"}</h1>

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
          <Button className="dc-auth-action dc-touch" size="lg" onClick={signIn} disabled={submitting || snapshot.auth.status === "loading"}>
            {submitting || snapshot.auth.status === "loading" ? <Spinner data-icon="inline-start" /> : <ShieldCheck data-icon="inline-start" aria-hidden="true" />}
            {isWorkspaceSignIn ? "sign in" : "continue to sign in"}
          </Button>
        )}

        {error && <p className="dc-inline-error" role="alert">{error}</p>}

        <Button variant="outline" size="lg" className="dc-auth-action dc-auth-secondary-action dc-touch" asChild>
          <a href={openHref} target="_blank" rel="noreferrer">
            open in your browser <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
          </a>
        </Button>
      </section>
    </main>
  )
}
