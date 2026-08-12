import { useHandleSignInCallback } from "@logto/react"
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { LeadershipAuthScreen } from "./components/LeadershipAuthScreen"
import { takeLeadershipReturnTo } from "./authReturnPath"

const CALLBACK_TIMEOUT_MS = 15_000

export function LogtoAuthCallback() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, error } = useHandleSignInCallback()
  const redirectedRef = useRef(false)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!isLoading || error) return
    const timeout = window.setTimeout(() => setTimedOut(true), CALLBACK_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [error, isLoading])

  useEffect(() => {
    if (!isLoading && isAuthenticated && !redirectedRef.current) {
      redirectedRef.current = true
      navigate(takeLeadershipReturnTo(), { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  if (!error && !timedOut && (isLoading || isAuthenticated)) {
    return (
      <LeadershipAuthScreen
        loading
        title="Opening the leadership workspace"
        description="Finishing secure sign-in."
      />
    )
  }

  return (
    <LeadershipAuthScreen title="Sign-in could not be completed" live="assertive">
      <p className="dc-inline-error" role="alert">
        {timedOut ? "Sign-in took too long to finish. Return to the workspace and try again." : "Return to the workspace and try again."}
      </p>
      <Button type="button" className="dc-auth-action dc-touch" onClick={() => window.location.replace('/workspace')}>
        return to sign in
      </Button>
    </LeadershipAuthScreen>
  )
}
