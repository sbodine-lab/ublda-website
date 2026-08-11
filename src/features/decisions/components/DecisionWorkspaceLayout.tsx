import { Outlet } from "react-router-dom"
import { LeadershipShell } from "@/features/leadership/components/LeadershipShell"
import { useDecisionData } from "../decisionDataContext"

export function DecisionWorkspaceLayout() {
  const { adapter, snapshot } = useDecisionData()
  const viewer = snapshot.auth.status === "signed-in" ? snapshot.auth.viewer : undefined

  return (
    <LeadershipShell
      displayName={viewer?.displayName}
      role={viewer?.role}
      onSignOut={() => adapter.signOut()}
    >
      <Outlet />
    </LeadershipShell>
  )
}
