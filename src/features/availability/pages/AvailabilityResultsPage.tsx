import { CalendarClock, ChevronLeft } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { LeadershipPage } from "@/features/leadership/components/LeadershipPage"
import { useAvailabilityData } from "../availabilityDataContext"
import { AvailabilityResultsPanel } from "../components/AvailabilityResultsPanel"

function NotFound() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon"><CalendarClock /></EmptyMedia>
        <EmptyTitle>Results not found</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="sm" asChild><Link to="/scheduling">Back to scheduling</Link></Button>
      </EmptyContent>
    </Empty>
  )
}

export function AvailabilityResultsPage({ workspace = false }: { workspace?: boolean }) {
  const { slug } = useParams()
  const { snapshot, pollBySlug } = useAvailabilityData()
  const poll = pollBySlug(slug)

  if (workspace) {
    if (snapshot.loading) {
      return (
        <LeadershipPage className="sched-root">
          <p className="sched-empty-line">Loading…</p>
        </LeadershipPage>
      )
    }

    if (!poll) {
      return <LeadershipPage className="sched-root"><NotFound /></LeadershipPage>
    }

    return (
      <LeadershipPage className="sched-root" title={poll.title}>
        {poll.note ? <p className="sched-note">{poll.note}</p> : null}
        <AvailabilityResultsPanel poll={poll} embedded />
      </LeadershipPage>
    )
  }

  return (
    <main id="main-content" className="sched-root sched-public">
      <header className="sched-public-topbar">
        <Button variant="ghost" size="icon-sm" asChild aria-label="Back to poll">
          <Link to={poll ? `/s/${poll.slug}` : "/scheduling"}><ChevronLeft /></Link>
        </Button>
        <h1>{snapshot.loading ? "Loading…" : poll?.title ?? "Results not found"}</h1>
      </header>
      <div className="sched-public-body">
        {snapshot.loading ? null : poll ? (
          <>
            {poll.note ? <p className="sched-note">{poll.note}</p> : null}
            <AvailabilityResultsPanel poll={poll} />
          </>
        ) : <NotFound />}
      </div>
    </main>
  )
}
