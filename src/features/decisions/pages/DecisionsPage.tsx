import { useMemo, useState } from "react"
import { CalendarClock, CircleAlert, CircleCheck, ListChecks, Plus, Users } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { LeadershipPage, LeadershipSurface } from "@/features/leadership/components/LeadershipPage"
import { useDecisionData } from "../decisionDataContext"
import { formatDateTime } from "../format"
import { calculateDecisionResults } from "../results"
import { DecisionStatusBadge } from "../components/DecisionStatusBadge"

type Filter = "open" | "draft" | "closed" | "all"

const filters: Array<{ id: Filter; label: string; empty: string }> = [
  { id: "open", label: "Open", empty: "No open questions" },
  { id: "draft", label: "Drafts", empty: "No drafts" },
  { id: "closed", label: "Closed", empty: "No closed questions" },
  { id: "all", label: "All", empty: "No questions yet" },
]

export function DecisionsPage() {
  const { snapshot, responseFor } = useDecisionData()
  const [filter, setFilter] = useState<Filter>("open")
  const viewer = snapshot.auth.status === "signed-in" ? snapshot.auth.viewer : undefined
  const active = filters.find((item) => item.id === filter) ?? filters[0]

  const decisions = useMemo(() => snapshot.decisions
    .filter((decision) => {
      if (filter === "all") return true
      if (filter === "closed") return decision.status === "closed" || decision.status === "finalized"
      return decision.status === filter
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [filter, snapshot.decisions])

  const body = decisions.length === 0 ? (
    <Empty className="dc-empty-state">
      <EmptyHeader>
        <EmptyMedia variant="icon"><ListChecks /></EmptyMedia>
        <EmptyTitle>{active.empty}</EmptyTitle>
      </EmptyHeader>
      {filter === "open" || filter === "all" ? (
        <EmptyContent>
          <Button variant="outline" size="sm" asChild>
            <Link to="/decisions/new">New question</Link>
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  ) : (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Question</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Responses</TableHead>
          <TableHead>Deadline</TableHead>
          <TableHead><span className="sr-only">Actions</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
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
            <TableRow key={decision.id}>
              <TableCell className="dc-question-cell">
                <Link className="dc-question-title" to={primaryHref}>{decision.title}</Link>
              </TableCell>
              <TableCell>
                <DecisionStatusBadge status={decision.status} />
              </TableCell>
              <TableCell className="dc-question-response-cell">
                <span className="dc-question-meta">
                  <Users aria-hidden="true" />
                  {results.responseCount} of {results.eligibleCount}
                </span>
                {canRespond ? (
                  <span className={cn("dc-response-state", response && "dc-response-state-done")}>
                    {response
                      ? <><CircleCheck aria-hidden="true" /> Responded</>
                      : <><CircleAlert aria-hidden="true" /> Response needed</>}
                  </span>
                ) : null}
              </TableCell>
              <TableCell>
                <span className="dc-question-meta">
                  <CalendarClock aria-hidden="true" />
                  {decision.deadline ? formatDateTime(decision.deadline, decision.timezone) : "No deadline"}
                </span>
              </TableCell>
              <TableCell className="dc-row-action">
                <Button variant="outline" size="sm" asChild>
                  <Link to={primaryHref}>
                    {decision.status === "open"
                      ? (response ? "View" : "Respond")
                      : decision.status === "draft" ? "Preview" : "Results"}
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )

  return (
    <LeadershipPage
      className="dc-page"
      action={(
        <Button asChild>
          <Link to="/decisions/new"><Plus data-icon="inline-start" /> New question</Link>
        </Button>
      )}
    >
      <LeadershipSurface className="leadership-decision-surface dc-flush-table" flush>
        <Tabs className="dc-questions-tabs" value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <div className="dc-list-toolbar">
            <TabsList variant="line" aria-label="Filter questions">
              {filters.map((item) => (
                <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>
              ))}
            </TabsList>
          </div>
          {filters.map((item) => (
            <TabsContent key={item.id} value={item.id}>
              {item.id === filter ? body : null}
            </TabsContent>
          ))}
        </Tabs>
      </LeadershipSurface>
    </LeadershipPage>
  )
}
