import { Toaster } from "@/components/ui/sonner"
import { useEffect } from "react"
import { DecisionCenterRoutes } from "./DecisionCenterRoutes"
import { DecisionDataProvider } from "./DecisionDataProvider"
import { createUnavailableLiveDecisionAdapter, demoDecisionAdapter } from "./demoAdapter"
import { LiveDecisionCenter } from "./LiveDecisionCenter"
import {
  AvailabilityDataProvider,
  createUnavailableAvailabilityAdapter,
  demoAvailabilityAdapter,
} from "@/features/availability"
import {
  WorkspaceDataProvider,
  createUnavailableWorkspaceAdapter,
  demoWorkspaceAdapter,
} from "@/features/workspace"

function DecisionDocumentMeta() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = "UBLDA Leadership Workspace"
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    const robots = existing ?? document.createElement("meta")
    const previousContent = existing?.content
    if (!existing) {
      robots.name = "robots"
      robots.dataset.decisionCenter = "true"
      document.head.append(robots)
    }
    robots.content = "noindex,nofollow,noarchive"
    return () => {
      document.title = previousTitle
      if (robots.dataset.decisionCenter === "true") robots.remove()
      else if (previousContent !== undefined) robots.content = previousContent
    }
  }, [])
  return null
}

export function DecisionCenterEntry() {
  const mode = import.meta.env.VITE_DECISION_CENTER_MODE
  const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim()
  const logtoAppId = import.meta.env.VITE_LOGTO_APP_ID?.trim()
  const logtoEndpoint = import.meta.env.VITE_LOGTO_ENDPOINT?.trim()
  const demoMode = mode === "demo" || (
    import.meta.env.DEV
    && mode !== "live"
    && (!convexUrl || !logtoAppId || !logtoEndpoint)
  )

  let content
  if (demoMode) {
    content = (
      <WorkspaceDataProvider adapter={demoWorkspaceAdapter}>
        <AvailabilityDataProvider adapter={demoAvailabilityAdapter}>
          <DecisionDataProvider adapter={demoDecisionAdapter}>
            <DecisionCenterRoutes />
          </DecisionDataProvider>
        </AvailabilityDataProvider>
      </WorkspaceDataProvider>
    )
  } else if (!convexUrl || !logtoAppId || !logtoEndpoint) {
    const adapter = createUnavailableLiveDecisionAdapter(
      "Add VITE_CONVEX_URL, VITE_LOGTO_APP_ID, and VITE_LOGTO_ENDPOINT, or explicitly select local demo mode.",
    )
    const availabilityAdapter = createUnavailableAvailabilityAdapter(
      "Add VITE_CONVEX_URL, VITE_LOGTO_APP_ID, and VITE_LOGTO_ENDPOINT, or explicitly select local demo mode.",
    )
    const workspaceAdapter = createUnavailableWorkspaceAdapter(
      "Add VITE_CONVEX_URL, VITE_LOGTO_APP_ID, and VITE_LOGTO_ENDPOINT, or explicitly select local demo mode.",
    )
    content = (
      <WorkspaceDataProvider adapter={workspaceAdapter}>
        <AvailabilityDataProvider adapter={availabilityAdapter}>
          <DecisionDataProvider adapter={adapter}>
            <DecisionCenterRoutes />
          </DecisionDataProvider>
        </AvailabilityDataProvider>
      </WorkspaceDataProvider>
    )
  } else {
    content = (
      <LiveDecisionCenter
        convexUrl={convexUrl}
        logtoAppId={logtoAppId}
        logtoEndpoint={logtoEndpoint}
      />
    )
  }

  return (
    <>
      <DecisionDocumentMeta />
      {content}
      <Toaster position="top-center" />
    </>
  )
}
