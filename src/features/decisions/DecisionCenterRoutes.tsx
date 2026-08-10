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
import { ClubCalendarPage } from "@/features/workspace/pages/ClubCalendarPage"
import { PeoplePage } from "@/features/workspace/pages/PeoplePage"
import { ProjectsPage } from "@/features/workspace/pages/ProjectsPage"
import { WorkspaceOverviewPage } from "@/features/workspace/pages/WorkspaceOverviewPage"
import "@/features/availability/availability.css"
import "./decision-center.css"
import "@/features/workspace/workspace.css"

function PrivateWorkspace() {
  return <DecisionAuthGate><DecisionWorkspaceLayout /></DecisionAuthGate>
}

export function DecisionCenterRoutes() {
  return (
    <Routes>
      <Route path="/decision" element={<DecisionBallotPage />} />
      <Route path="/d/:slug" element={<DecisionBallotPage />} />
      <Route path="/schedule" element={<DecisionAuthGate><AvailabilityPollPage /></DecisionAuthGate>} />
      <Route path="/s/:slug" element={<DecisionAuthGate><AvailabilityPollPage /></DecisionAuthGate>} />
      <Route path="/s/:slug/results" element={<DecisionAuthGate><AvailabilityResultsPage /></DecisionAuthGate>} />
      <Route element={<PrivateWorkspace />}>
        <Route path="/workspace" element={<WorkspaceOverviewPage />} />
        <Route path="/decisions" element={<DecisionsPage />} />
        <Route path="/decisions/new" element={<CreateDecisionPage />} />
        <Route path="/results" element={<DecisionResultsPage />} />
        <Route path="/decisions/settings" element={<DecisionMembersPage />} />
        <Route path="/decisions/integrations" element={<DecisionIntegrationsPage />} />
        <Route path="/decisions/:slug/results" element={<DecisionResultsPage />} />
        <Route path="/scheduling" element={<SchedulingDashboardPage />} />
        <Route path="/scheduling/new" element={<CreateAvailabilityPollPage />} />
        <Route path="/scheduling/:slug/results" element={<AvailabilityResultsPage workspace />} />
        <Route path="/calendar" element={<ClubCalendarPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/people" element={<PeoplePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/workspace" replace />} />
    </Routes>
  )
}
