import { ArrowRight, CalendarClock, Plus } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useDecisionData } from "@/features/decisions/decisionDataContext"
import { LeadershipPage, LeadershipSurface } from "@/features/leadership/components/LeadershipPage"
import { useAvailabilityData } from "../availabilityDataContext"
import { dateLabel } from "../format"
import { AvailabilityResultsPanel } from "../components/AvailabilityResultsPanel"

export function SchedulingDashboardPage() {
  const { snapshot } = useAvailabilityData()
  const { snapshot: decisionSnapshot } = useDecisionData()
  const viewer = decisionSnapshot.auth.status === "signed-in" ? decisionSnapshot.auth.viewer : undefined

  return (
    <LeadershipPage
      className="av-dashboard-page"
      action={viewer?.role === "admin" ? <Button asChild className="ws-primary-action"><Link to="/scheduling/new"><Plus data-icon="inline-start" /> new poll</Link></Button> : null}
    >

      <LeadershipSurface className="leadership-scheduling-surface" flush>
        <div className="av-dashboard">
        <section className="av-poll-list-pane" aria-label="scheduling polls">
          <header className="av-list-heading"><h2>polls</h2><span>{snapshot.polls.length}</span></header>
          <div className="av-poll-list">
            {snapshot.polls.map((poll) => (
              <article className={snapshot.activePoll?.id === poll.id ? "av-poll-row av-poll-row-active" : "av-poll-row"} key={poll.id}>
                <h2>{poll.title}</h2>
                <p>{poll.responseCount} of {poll.eligibleCount} responded {poll.deadline ? <>· due {dateLabel(poll.deadline.slice(0, 10)).toLowerCase()}</> : null}</p>
                <Button variant="link" size="sm" asChild>
                  <Link to={poll.hasResponded || poll.canManage ? `/scheduling/${poll.slug}/results` : `/s/${poll.slug}`}>
                    {poll.hasResponded || poll.canManage ? "view results" : "reply"} <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              </article>
            ))}
            {!snapshot.polls.length && !snapshot.loading ? <Empty className="av-empty-list"><EmptyHeader><EmptyMedia variant="icon"><CalendarClock /></EmptyMedia><EmptyTitle>no scheduling polls</EmptyTitle></EmptyHeader></Empty> : null}
          </div>
        </section>

        <section className="av-dashboard-detail">
          {snapshot.activePoll ? (
            <>
              <header className="av-detail-heading">
                <h2>{snapshot.activePoll.title}</h2>
                {snapshot.activePoll.note ? <p>{snapshot.activePoll.note}</p> : null}
              </header>
              <AvailabilityResultsPanel poll={snapshot.activePoll} />
            </>
          ) : snapshot.loading ? <p className="av-dashboard-loading">loading…</p> : <Empty className="av-detail-empty"><EmptyHeader><EmptyMedia variant="icon"><CalendarClock /></EmptyMedia><EmptyTitle>choose a poll</EmptyTitle></EmptyHeader></Empty>}
        </section>
        </div>
      </LeadershipSurface>
    </LeadershipPage>
  )
}
