import { Navigate, Route, Routes } from "react-router-dom"
import { DecisionAuthGate } from "./components/DecisionAuthGate"
import { DecisionWorkspaceLayout } from "./components/DecisionWorkspaceLayout"
import { CreateDecisionPage } from "./pages/CreateDecisionPage"
import { DecisionBallotPage } from "./pages/DecisionBallotPage"
import { DecisionIntegrationsPage } from "./pages/DecisionIntegrationsPage"
import { DecisionMembersPage } from "./pages/DecisionMembersPage"
import { DecisionResultsPage } from "./pages/DecisionResultsPage"
import { DecisionsPage } from "./pages/DecisionsPage"
import { AvailabilityPollPage } from "@/features/availability/pages/AvailabilityPollPage"
import { AvailabilityResultsPage } from "@/features/availability/pages/AvailabilityResultsPage"
import { CreateAvailabilityPollPage } from "@/features/availability/pages/CreateAvailabilityPollPage"
import { SchedulingDashboardPage } from "@/features/availability/pages/SchedulingDashboardPage"
import { CraftNightAdminPage } from "@/features/craftnight/CraftNightAdminPage"
import { ClubCalendarPage } from "@/features/workspace/pages/ClubCalendarPage"
import { PeoplePage } from "@/features/workspace/pages/PeoplePage"
import { ProjectsPage } from "@/features/workspace/pages/ProjectsPage"
import { WorkspaceOverviewPage } from "@/features/workspace/pages/WorkspaceOverviewPage"
import { SpeakerOpsEntry } from "@/features/speakers/SpeakerOpsEntry"
import { OperationsEntry } from "@/features/operations/OperationsEntry"
import { LogtoAuthCallback } from "./LogtoAuthCallback"
import "@/features/availability/availability.css"
import "./decision-center.css"
import "@/features/workspace/workspace.css"
import "@/styles/leadership-workspace.css"

function PrivateWorkspace() {
  return <DecisionAuthGate><DecisionWorkspaceLayout /></DecisionAuthGate>
}

export function DecisionCenterRoutes({ logtoCallback = false }: { logtoCallback?: boolean }) {
  return (
    <Routes>
      <Route
        path="/auth/callback"
        element={logtoCallback ? <LogtoAuthCallback /> : <Navigate to="/workspace" replace />}
      />
      <Route path="/decision" element={<DecisionBallotPage />} />
      <Route path="/d/:slug" element={<DecisionBallotPage />} />
      <Route path="/schedule" element={<DecisionAuthGate><AvailabilityPollPage /></DecisionAuthGate>} />
      <Route path="/s/:slug" element={<DecisionAuthGate><AvailabilityPollPage /></DecisionAuthGate>} />
      <Route path="/s/:slug/results" element={<DecisionAuthGate><AvailabilityResultsPage /></DecisionAuthGate>} />
      <Route path="/signin" element={<Navigate to="/workspace" replace />} />
      <Route path="/dashboard" element={<Navigate to="/workspace" replace />} />
      <Route path="/members" element={<Navigate to="/workspace" replace />} />
      <Route element={<PrivateWorkspace />}>
        <Route path="/workspace" element={<WorkspaceOverviewPage />} />
        <Route path="/decisions" element={<DecisionsPage />} />
        <Route path="/decisions/new" element={<CreateDecisionPage />} />
        <Route path="/results" element={<DecisionResultsPage />} />
        <Route path="/decisions/settings" element={<DecisionMembersPage />} />
        <Route path="/decisions/integrations" element={<DecisionIntegrationsPage />} />
        <Route path="/decisions/:slug/results" element={<DecisionResultsPage />} />
        <Route path="/scheduling" element={<SchedulingDashboardPage />} />
        <Route path="/scheduling/craft-night" element={<CraftNightAdminPage />} />
        <Route path="/scheduling/new" element={<CreateAvailabilityPollPage />} />
        <Route path="/scheduling/:slug/results" element={<AvailabilityResultsPage workspace />} />
        <Route path="/calendar" element={<ClubCalendarPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/leadership/speakers" element={<SpeakerOpsEntry />} />
        <Route path="/operations" element={<OperationsEntry />} />
        <Route path="/speaker-ops" element={<Navigate to="/leadership/speakers" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/workspace" replace />} />
    </Routes>
  )
}
