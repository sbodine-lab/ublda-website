import { useMemo, useState } from "react"
import { ArrowRight, CalendarClock, CircleCheck, Plus, Users } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
        <div><p className="dc-eyebrow">decision center</p><h1>questions</h1></div>
        <Button asChild className="dc-touch dc-desktop-create-button">
          <Link to="/decisions/new"><Plus data-icon="inline-start" /> new question</Link>
        </Button>
      </header>

      <Tabs className="dc-list-toolbar" value={filter} onValueChange={(value) => setFilter(value as Filter)}>
        <TabsList variant="line" aria-label="Decision status">
          {filters.map((item) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {decisions.length === 0 ? (
        <Empty className="dc-empty-state">
          <EmptyHeader>
            <EmptyMedia variant="icon"><CircleCheck /></EmptyMedia>
            <EmptyTitle>No decisions here</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild className="dc-touch"><Link to="/decisions/new">Create one</Link></Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="dc-decision-list">
          <div className="dc-question-table-head" aria-hidden="true">
            <span>Question</span>
            <span>Status</span>
            <span>Responses</span>
            <span>Deadline</span>
            <span />
          </div>
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
                <div className="dc-question-cell">
                  <h2><Link to={primaryHref}>{decision.title}</Link></h2>
                  <span className="dc-question-updated">Updated {formatDateTime(decision.updatedAt, decision.timezone)}</span>
                </div>
                <div className="dc-question-status-stack">
                  <DecisionStatusBadge status={decision.status} />
                  {canRespond && (
                    <span className={cn("dc-response-state", response && "dc-response-state-done")}>
                      {response ? <><CircleCheck /> Responded</> : "Needs your response"}
                    </span>
                  )}
                </div>
                <div className="dc-question-meta-cell">
                  <Users />
                  <span>{results.responseCount} of {results.eligibleCount} responses</span>
                </div>
                <div className="dc-question-meta-cell">
                  <CalendarClock />
                  <span>{decision.deadline ? formatDateTime(decision.deadline, decision.timezone) : "No deadline"}</span>
                </div>
                <div className="dc-decision-row-side">
                  <Button variant="outline" className="dc-touch" asChild>
                    <Link to={primaryHref}>
                      {decision.status === "open" ? (response ? "View" : "Respond") : decision.status === "draft" ? "Preview" : "Results"}
                      <ArrowRight data-icon="inline-end" />
                    </Link>
                  </Button>
                </div>
                <div className="dc-decision-row-mobile-summary">
                  <div className="dc-decision-title-line">
                    <DecisionStatusBadge status={decision.status} />
                    {canRespond && (
                      <span className={cn("dc-response-state", response && "dc-response-state-done")}>
                        {response ? <><CircleCheck /> Responded</> : "Needs your response"}
                      </span>
                    )}
                  </div>
                  <div className="dc-decision-meta">
                    <span><Users /> {results.responseCount} of {results.eligibleCount} responses</span>
                    {decision.deadline && <span><CalendarClock /> {formatDateTime(decision.deadline, decision.timezone)}</span>}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
