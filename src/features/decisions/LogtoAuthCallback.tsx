import { useHandleSignInCallback } from "@logto/react"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Spinner } from "@/components/ui/spinner"

export function LogtoAuthCallback() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, error } = useHandleSignInCallback()

  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate("/workspace", { replace: true })
  }, [isAuthenticated, isLoading, navigate])

  return (
    <main id="main-content" className="dc-auth-page">
      <section className="dc-auth-panel" aria-live="polite">
        <a href="/" aria-label="UBLDA home" className="dc-logo-lockup dc-auth-logo">
          <img src="/logo.png" alt="" />
        </a>
        {error ? (
          <>
            <h1>Sign-in could not be completed</h1>
            <p className="dc-inline-error" role="alert">Return to the workspace and try again.</p>
          </>
        ) : (
          <>
            <Spinner />
            <h1>Opening the leadership workspace</h1>
          </>
        )}
      </section>
    </main>
  )
}
