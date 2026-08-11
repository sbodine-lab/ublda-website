import { useHandleSignInCallback } from "@logto/react"
import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { LeadershipAuthScreen } from "./components/LeadershipAuthScreen"
import { takeLeadershipReturnTo } from "./authReturnPath"

export function LogtoAuthCallback() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, error } = useHandleSignInCallback()
  const redirectedRef = useRef(false)

  useEffect(() => {
    if (!isLoading && isAuthenticated && !redirectedRef.current) {
      redirectedRef.current = true
      navigate(takeLeadershipReturnTo(), { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  if (!error && (isLoading || isAuthenticated)) {
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
      <p className="dc-inline-error" role="alert">Return to the workspace and try again.</p>
    </LeadershipAuthScreen>
  )
}
