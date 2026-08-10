import { useMemo, useState } from "react"
import { ArrowRight, CalendarClock, CircleCheck, Plus, Search, Users } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useDecisionData } from "../decisionDataContext"
import { ballotTypeLabels, formatDateTime } from "../format"
import { calculateDecisionResults } from "../results"
import type { DecisionStatus } from "../types"
import { DecisionStatusBadge } from "../components/DecisionStatusBadge"

type Filter = "active" | DecisionStatus | "all"

const filters: Array<{ id: Filter; label: string }> = [
  { id: "active", label: "Active" },
  { id: "draft", label: "Drafts" },
  { id: "closed", label: "Closed" },
  { id: "finalized", label: "Finalized" },
  { id: "all", label: "All" },
]

export function DecisionsPage() {
  const { snapshot, responseFor } = useDecisionData()
  const [filter, setFilter] = useState<Filter>("active")
  const [query, setQuery] = useState("")
  const viewer = snapshot.auth.status === "signed-in" ? snapshot.auth.viewer : undefined

  const decisions = useMemo(() => snapshot.decisions
    .filter((decision) => {
      if (filter === "active") return decision.status === "open"
      if (filter === "all") return true
      return decision.status === filter
    })
    .filter((decision) => `${decision.title} ${decision.overview}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [filter, query, snapshot.decisions])

  const awaitingCount = snapshot.decisions.filter((decision) => (
    decision.status === "open"
    && viewer
    && (decision.isEligible ?? decision.electorateMemberIds.includes(viewer.memberId))
    && !responseFor(decision.id, viewer.memberId)
  )).length

  return (
    <div className="dc-page dc-decisions-page">
      <header className="dc-page-heading dc-page-heading-actions">
        <div>
          <p className="dc-eyebrow">Board workspace</p>
          <h1>Decisions</h1>
          <p>{awaitingCount === 0 ? "You are caught up." : `${awaitingCount} ${awaitingCount === 1 ? "decision needs" : "decisions need"} your response.`}</p>
        </div>
        <Button asChild className="dc-touch dc-desktop-create-button">
          <Link to="/decisions/new"><Plus /> New decision</Link>
        </Button>
      </header>

      <section className="dc-list-toolbar" aria-label="Decision filters">
        <div className="dc-filter-row" role="group" aria-label="Status">
          {filters.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant="ghost"
              className={cn("dc-filter-button dc-touch", filter === item.id && "dc-filter-button-active")}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <label className="dc-search-field">
          <span className="sr-only">Search decisions</span>
          <Search aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search decisions" />
        </label>
      </section>

      {decisions.length === 0 ? (
        <section className="dc-empty-state">
          <CircleCheck aria-hidden="true" />
          <h2>No decisions here</h2>
          <p>Try another filter, or create a decision when the board needs input.</p>
          <Button asChild className="dc-touch"><Link to="/decisions/new">Create a decision</Link></Button>
        </section>
      ) : (
        <div className="dc-decision-list">
          {decisions.map((decision) => {
            const results = calculateDecisionResults(decision, snapshot.responses)
            const response = viewer ? responseFor(decision.id, viewer.memberId) : undefined
            const canRespond = Boolean(
              viewer
              && decision.status === "open"
              && (decision.isEligible ?? decision.electorateMemberIds.includes(viewer.memberId)),
            )
            const primaryHref = decision.status === "draft" || decision.status === "open"
              ? `/d/${decision.slug}`
              : `/decisions/${decision.slug}/results`

            return (
              <article className="dc-decision-row" key={decision.id}>
                <div className="dc-decision-row-main">
                  <div className="dc-decision-title-line">
                    <DecisionStatusBadge status={decision.status} />
                    {canRespond && (
                      <span className={cn("dc-response-state", response && "dc-response-state-done")}>
                        {response ? <><CircleCheck /> Responded</> : "Needs your response"}
                      </span>
                    )}
                  </div>
                  <h2><Link to={primaryHref}>{decision.title}</Link></h2>
                  <p>{decision.overview}</p>
                  <div className="dc-decision-meta">
                    <span><Users /> {results.responseCount} of {results.eligibleCount} responses</span>
                    <span><CalendarClock /> {decision.deadline ? `Due ${formatDateTime(decision.deadline, decision.timezone)}` : "No deadline"}</span>
                    <span>{ballotTypeLabels[decision.ballotType]}</span>
                  </div>
                </div>
                <div className="dc-decision-row-side">
                  <div className="dc-participation-summary" aria-label={`${results.turnoutPercentage}% participation`}>
                    <span>Participation</span><b>{results.turnoutPercentage}%</b>
                  </div>
                  <Progress value={results.turnoutPercentage} />
                  <Button variant="outline" className="dc-touch" asChild>
                    <Link to={primaryHref}>
                      {decision.status === "open" ? (response ? "Review response" : "Respond") : decision.status === "draft" ? "Preview" : "View results"}
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
