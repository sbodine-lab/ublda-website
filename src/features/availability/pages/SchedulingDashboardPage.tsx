import { CalendarClock, Plus } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useDecisionData } from "@/features/decisions/decisionDataContext"
import { LeadershipPage, LeadershipSurface } from "@/features/leadership/components/LeadershipPage"
import { useAvailabilityData } from "../availabilityDataContext"
import { dateLabel, zonedDateKey } from "../format"
import type { AvailabilityPollSummary } from "../types"

type StatusTone = "open" | "responded" | "closed"

function pollStatus(poll: AvailabilityPollSummary): { label: string; tone: StatusTone } {
  if (poll.status === "finalized") return { label: "Finalized", tone: "closed" }
  if (poll.hasResponded) return { label: "Responded", tone: "responded" }
  if (!poll.canManage) return { label: "Response needed", tone: "open" }
  return { label: "Open", tone: "open" }
}

export function SchedulingDashboardPage() {
  const { snapshot } = useAvailabilityData()
  const { snapshot: decisionSnapshot } = useDecisionData()
  const viewer = decisionSnapshot.auth.status === "signed-in" ? decisionSnapshot.auth.viewer : undefined
  const isAdmin = viewer?.role === "admin"

  return (
    <LeadershipPage
      className="sched-root"
      action={isAdmin ? (
        <Button asChild>
          <Link to="/scheduling/new"><Plus data-icon="inline-start" /> New poll</Link>
        </Button>
      ) : null}
    >
      {snapshot.loading ? (
        <LeadershipSurface contentClassName="sched-skeleton">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </LeadershipSurface>
      ) : snapshot.polls.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><CalendarClock /></EmptyMedia>
            <EmptyTitle>No polls yet</EmptyTitle>
          </EmptyHeader>
          {isAdmin ? (
            <EmptyContent>
              <Button variant="outline" size="sm" asChild><Link to="/scheduling/new">New poll</Link></Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <LeadershipSurface flush>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Poll</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responses</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="sched-table__action"><span className="sched-sr">Open</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.polls.map((poll) => {
                const status = pollStatus(poll)
                const href = poll.hasResponded || poll.canManage
                  ? `/scheduling/${poll.slug}/results`
                  : `/s/${poll.slug}`

                return (
                  <TableRow key={poll.id}>
                    <TableCell className="sched-table__title">
                      <Link to={href}>{poll.title}</Link>
                    </TableCell>
                    <TableCell>
                      <span className="sched-chip" data-tone={status.tone}>{status.label}</span>
                    </TableCell>
                    <TableCell className="sched-table__num">
                      {poll.responseCount} of {poll.eligibleCount}
                    </TableCell>
                    <TableCell className="sched-table__due">
                      {poll.deadline ? dateLabel(zonedDateKey(poll.deadline, poll.timezone)) : "—"}
                    </TableCell>
                    <TableCell className="sched-table__action">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={href}>{poll.hasResponded || poll.canManage ? "Results" : "Reply"}</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </LeadershipSurface>
      )}
    </LeadershipPage>
  )
}
