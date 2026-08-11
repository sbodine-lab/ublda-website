import { useState, type PropsWithChildren } from "react"
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

  const signIn = async () => {
    setSubmitting(true)
    setError(undefined)
    try {
      await adapter.signIn()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Secure sign-in could not be opened.")
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
          <div className="dc-auth-form">
            <p className="dc-auth-guidance">Continue to the secure leadership sign-in.</p>
            <Button
              type="button"
              size="lg"
              className="dc-auth-action dc-touch"
              disabled={submitting || snapshot.auth.status === "loading"}
              onClick={() => void signIn()}
            >
              {submitting || snapshot.auth.status === "loading" ? <Spinner data-icon="inline-start" /> : null}
              continue to sign in
            </Button>
          </div>
        )}

        {error && <p className="dc-inline-error" role="alert">{error}</p>}

      </section>
    </main>
  )
}
