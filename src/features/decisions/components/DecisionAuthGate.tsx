import { useState, type PropsWithChildren } from "react"
import { useLocation } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useDecisionData } from "../decisionDataContext"
import { rememberLeadershipReturnTo } from "../authReturnPath"
import { LeadershipAuthScreen } from "./LeadershipAuthScreen"

export function DecisionAuthGate({ children }: PropsWithChildren) {
  const { adapter, snapshot } = useDecisionData()
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()

  if (snapshot.auth.status === "signed-in") return children

  if (snapshot.auth.status === "loading") {
    return (
      <LeadershipAuthScreen
        loading
        preview={adapter.mode === "demo"}
        title="Loading…"
      />
    )
  }

  const isSchedulingLink = location.pathname === "/schedule" || location.pathname.startsWith("/s/")
  const isWorkspaceSignIn = location.pathname === "/workspace"
    || location.pathname === "/calendar"
    || location.pathname === "/projects"
    || location.pathname === "/people"
    || location.pathname === "/leadership/speakers"
    || location.pathname === "/speaker-ops"
    || location.pathname === "/decisions"
    || location.pathname.startsWith("/decisions/")
    || location.pathname === "/results"
    || location.pathname === "/scheduling"
    || location.pathname.startsWith("/scheduling/")

  const signIn = async () => {
    setSubmitting(true)
    setError(undefined)
    try {
      rememberLeadershipReturnTo(`${location.pathname}${location.search}`)
      await adapter.signIn()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Secure sign-in could not be opened.")
    } finally {
      setSubmitting(false)
    }
  }

  const switchAccount = async () => {
    setSubmitting(true)
    setError(undefined)
    try {
      // Complete provider sign-out first. The next screen starts an ordinary
      // Logto sign-in, which avoids relying on unsupported account prompts.
      await adapter.signOut()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This account could not be signed out.")
    } finally {
      setSubmitting(false)
    }
  }

  const title = isWorkspaceSignIn
    ? "Sign in"
    : isSchedulingLink
      ? "A scheduling poll is waiting"
      : "A question is waiting"

  return (
    <LeadershipAuthScreen
      preview={adapter.mode === "demo"}
      title={title}
    >
      {snapshot.auth.status === "misconfigured" ? (
        <div className="dc-auth-denied">
          <Alert variant="destructive">
            <AlertTitle>Sign-in could not be verified</AlertTitle>
            <AlertDescription>{snapshot.auth.message}</AlertDescription>
          </Alert>
          <Button variant="outline" disabled={submitting} onClick={() => void signIn()}>
            {submitting ? <Spinner data-icon="inline-start" /> : null}
            Try again
          </Button>
        </div>
      ) : snapshot.auth.status === "access-denied" ? (
        <div className="dc-auth-denied">
          <Alert variant="destructive">
            <AlertTitle>This account is not approved</AlertTitle>
            <AlertDescription>{snapshot.auth.message}</AlertDescription>
          </Alert>
          <Button variant="outline" disabled={submitting} onClick={() => void switchAccount()}>
            {submitting ? <Spinner data-icon="inline-start" /> : null}
            Use another account
          </Button>
        </div>
      ) : (
        <div className="dc-auth-form">
          <Button
            type="button"
            size="lg"
            className="dc-auth-action"
            disabled={submitting}
            onClick={() => void signIn()}
          >
            {submitting ? <Spinner data-icon="inline-start" /> : null}
            Sign in
          </Button>
        </div>
      )}

      {error && <p className="dc-inline-error" role="alert">{error}</p>}
    </LeadershipAuthScreen>
  )
}
