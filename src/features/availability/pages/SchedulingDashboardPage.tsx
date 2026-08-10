import { ArrowRight, Plus } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useDecisionData } from "@/features/decisions/decisionDataContext"
import { useAvailabilityData } from "../availabilityDataContext"
import { dateLabel } from "../format"
import { AvailabilityResultsPanel } from "../components/AvailabilityResultsPanel"

export function SchedulingDashboardPage() {
  const { snapshot } = useAvailabilityData()
  const { snapshot: decisionSnapshot } = useDecisionData()
  const viewer = decisionSnapshot.auth.status === "signed-in" ? decisionSnapshot.auth.viewer : undefined

  return (
    <div className="av-dashboard">
      <section className="av-poll-list-pane">
        <header className="av-list-heading">
          <h1>scheduling</h1>
          {viewer?.role === "admin" ? <Button asChild size="sm"><Link to="/scheduling/new"><Plus data-icon="inline-start" /> new poll</Link></Button> : null}
        </header>
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
          {!snapshot.polls.length && !snapshot.loading ? <p className="av-empty-list">no scheduling polls yet</p> : null}
        </div>
      </section>

      <section className="av-dashboard-detail">
        {snapshot.activePoll ? (
          <>
            <header className="av-detail-heading">
              <h1>{snapshot.activePoll.title}</h1>
              {snapshot.activePoll.note ? <p>{snapshot.activePoll.note}</p> : null}
            </header>
            <AvailabilityResultsPanel poll={snapshot.activePoll} />
          </>
        ) : snapshot.loading ? <p>loading…</p> : <p>choose a poll</p>}
      </section>
    </div>
  )
}
