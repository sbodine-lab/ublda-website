import { Navigate, Route, Routes } from "react-router-dom"
import { DecisionAuthGate } from "./components/DecisionAuthGate"
import { DecisionWorkspaceLayout } from "./components/DecisionWorkspaceLayout"
import { CreateDecisionPage } from "./pages/CreateDecisionPage"
import { DecisionBallotPage } from "./pages/DecisionBallotPage"
import { DecisionIntegrationsPage } from "./pages/DecisionIntegrationsPage"
import { DecisionMembersPage } from "./pages/DecisionMembersPage"
import { DecisionResultsPage } from "./pages/DecisionResultsPage"
import { DecisionsPage } from "./pages/DecisionsPage"
import "./decision-center.css"

function PrivateWorkspace() {
  return <DecisionAuthGate><DecisionWorkspaceLayout /></DecisionAuthGate>
}

export function DecisionCenterRoutes() {
  return (
    <Routes>
      <Route path="/decision" element={<DecisionBallotPage />} />
      <Route path="/d/:slug" element={<DecisionBallotPage />} />
      <Route element={<PrivateWorkspace />}>
        <Route path="/decisions" element={<DecisionsPage />} />
        <Route path="/decisions/new" element={<CreateDecisionPage />} />
        <Route path="/results" element={<DecisionResultsPage />} />
        <Route path="/decisions/settings" element={<DecisionMembersPage />} />
        <Route path="/decisions/integrations" element={<DecisionIntegrationsPage />} />
        <Route path="/decisions/:slug/results" element={<DecisionResultsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/decisions" replace />} />
    </Routes>
  )
}
