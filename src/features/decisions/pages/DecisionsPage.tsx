import { useMemo, useState } from "react"
import { ArrowRight, CalendarClock, CircleCheck, Plus, Users } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useDecisionData } from "../decisionDataContext"
import { formatDateTime } from "../format"
import { calculateDecisionResults } from "../results"
import { DecisionStatusBadge } from "../components/DecisionStatusBadge"

type Filter = "open" | "draft" | "closed" | "all"

const filters: Array<{ id: Filter; label: string }> = [
  { id: "open", label: "Open" },
  { id: "draft", label: "Drafts" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
]

export function DecisionsPage() {
  const { snapshot, responseFor } = useDecisionData()
  const [filter, setFilter] = useState<Filter>("open")
  const viewer = snapshot.auth.status === "signed-in" ? snapshot.auth.viewer : undefined

  const decisions = useMemo(() => snapshot.decisions
    .filter((decision) => {
      if (filter === "all") return true
      if (filter === "closed") return decision.status === "closed" || decision.status === "finalized"
      return decision.status === filter
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [filter, snapshot.decisions])

  return (
    <div className="dc-page dc-decisions-page">
      <header className="dc-page-heading dc-page-heading-actions">
        <h1>Decisions</h1>
        <Button asChild className="dc-touch dc-desktop-create-button">
          <Link to="/decisions/new"><Plus /> New</Link>
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
      </section>

      {decisions.length === 0 ? (
        <section className="dc-empty-state">
          <CircleCheck aria-hidden="true" />
          <h2>No decisions here</h2>
          <Button asChild className="dc-touch"><Link to="/decisions/new">Create one</Link></Button>
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
                  <div className="dc-decision-meta">
                    <span><Users /> {results.responseCount} of {results.eligibleCount} responses</span>
                    {decision.deadline && <span><CalendarClock /> {formatDateTime(decision.deadline, decision.timezone)}</span>}
                  </div>
                </div>
                <div className="dc-decision-row-side">
                  <Button variant="outline" className="dc-touch" asChild>
                    <Link to={primaryHref}>
                      {decision.status === "open" ? (response ? "View" : "Respond") : decision.status === "draft" ? "Preview" : "Results"}
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
