import { ArrowRight, Plus } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useDecisionData } from "@/features/decisions/decisionDataContext"
import { LeadershipPage } from "@/features/leadership/components/LeadershipPage"
import { useAvailabilityData } from "../availabilityDataContext"
import { dateLabel } from "../format"
import type { AvailabilityPollSummary } from "../types"

function pollStatus(poll: AvailabilityPollSummary) {
  if (poll.status === "finalized") return { label: "Finalized", modifier: " av-scheduling-status--finalized" }
  if (!poll.hasResponded && !poll.canManage) return { label: "Response needed", modifier: " av-scheduling-status--needed" }
  return { label: poll.hasResponded ? "Responded" : "Open", modifier: "" }
}

export function SchedulingDashboardPage() {
  const { snapshot } = useAvailabilityData()
  const { snapshot: decisionSnapshot } = useDecisionData()
  const viewer = decisionSnapshot.auth.status === "signed-in" ? decisionSnapshot.auth.viewer : undefined

  return (
    <LeadershipPage
      className="av-dashboard-page"
      action={viewer?.role === "admin" ? (
        <Button asChild className="ws-primary-action">
          <Link to="/scheduling/new"><Plus data-icon="inline-start" /> New poll</Link>
        </Button>
      ) : null}
    >
      <section className="av-scheduling-index" aria-labelledby="scheduling-polls-title">
        <header className="av-scheduling-index__header">
          <h2 id="scheduling-polls-title">Scheduling polls</h2>
        </header>

        <div className="av-scheduling-list">
          {snapshot.loading ? <p className="av-scheduling-message">Loading…</p> : null}

          {!snapshot.loading ? (
            <>
              {snapshot.polls.map((poll) => {
                const status = pollStatus(poll)

                return (
                  <article className="av-scheduling-row" key={poll.id}>
                    <h3>{poll.title}</h3>
                    <p>
                      {poll.responseCount} of {poll.eligibleCount} responded
                      {poll.deadline ? <> · Due {dateLabel(poll.deadline.slice(0, 10))}</> : null}
                    </p>
                    <span className={`av-scheduling-status${status.modifier}`}>{status.label}</span>
                    <Button variant="link" size="sm" className="av-scheduling-row__action" asChild>
                      <Link to={poll.hasResponded || poll.canManage ? `/scheduling/${poll.slug}/results` : `/s/${poll.slug}`}>
                        {poll.hasResponded || poll.canManage ? "View results" : "Reply"} <ArrowRight data-icon="inline-end" />
                      </Link>
                    </Button>
                  </article>
                )
              })}
              {!snapshot.polls.length ? <p className="av-scheduling-message">No scheduling polls yet.</p> : null}
            </>
          ) : null}
        </div>
      </section>
    </LeadershipPage>
  )
}
