import { Check, Copy } from "lucide-react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { LeadershipSection } from "@/features/leadership/components/LeadershipPage"
import { useAvailabilityData } from "../availabilityDataContext"
import { candidateLabel, dateLabel, minutesLabel } from "../format"
import type { AvailabilityPollDetail } from "../types"

function shareHref(slug: string) {
  return `${window.location.origin}/s/${slug}`
}

/* Inside the shell the container is the shared Card. The public results route
   renders outside the shell, where those styles are not in scope, so it uses
   the same geometry restated in availability.css. */
function ResultsSection({
  action,
  children,
  embedded,
  title,
}: {
  action?: ReactNode
  children: ReactNode
  embedded: boolean
  title: string
}) {
  if (embedded) {
    return <LeadershipSection title={title} action={action}>{children}</LeadershipSection>
  }

  return (
    <section className="sched-card">
      <header className="sched-card__header">
        <h2>{title}</h2>
        {action}
      </header>
      <div className="sched-card__body">{children}</div>
    </section>
  )
}

export function AvailabilityResultsPanel({
  poll,
  embedded = false,
}: {
  poll: AvailabilityPollDetail
  embedded?: boolean
}) {
  const { adapter } = useAvailabilityData()
  const results = poll.results
  const top = results?.candidates.slice(0, 3) ?? []

  if (!results) {
    return (
      <ResultsSection embedded={embedded} title="Best times">
        <p className="sched-empty-line">Results unlock after you reply</p>
      </ResultsSection>
    )
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareHref(poll.slug))
      toast("Link copied")
    } catch {
      toast.error("Link could not be copied")
    }
  }

  const chooseTopTime = async () => {
    if (!top[0]) return
    try {
      await adapter.finalizePoll(poll.id, top[0].dateKey, top[0].startMinutes)
      toast("Time chosen")
    } catch {
      toast.error("Time could not be chosen")
    }
  }

  const chosenLabel = poll.finalizedDateKey && poll.finalizedStartMinutes !== undefined
    ? candidateLabel(
        poll.finalizedDateKey,
        poll.finalizedStartMinutes,
        poll.finalizedStartMinutes + poll.durationMinutes,
      )
    : undefined

  const minutes = Array.from(
    { length: Math.ceil((poll.endMinutes - poll.startMinutes) / poll.slotMinutes) },
    (_, index) => poll.startMinutes + index * poll.slotMinutes,
  )

  return (
    <>
      <ResultsSection
        embedded={embedded}
        title="Best times"
        action={(
          <Button variant="outline" size="sm" onClick={() => void copyLink()}>
            <Copy data-icon="inline-start" /> Copy link
          </Button>
        )}
      >
        <div className="sched-summary">
          <span>{results.responseCount} of {results.eligibleCount} responded</span>
          {poll.canManage && results.missing?.length ? (
            <span>Missing: {results.missing.map((member) => member.displayName).join(", ")}</span>
          ) : null}
        </div>

        {chosenLabel ? (
          <p className="sched-chosen"><Check aria-hidden="true" /> Chosen · {chosenLabel}</p>
        ) : null}

        {top.length ? (
          <ol className="sched-best">
            {top.map((candidate, index) => (
              <li className="sched-best__row" key={`${candidate.dateKey}-${candidate.startMinutes}`}>
                <span className="sched-best__rank">{index + 1}</span>
                <span>{candidateLabel(candidate.dateKey, candidate.startMinutes, candidate.endMinutes)}</span>
                <span className="sched-best__count">{candidate.availableCount} of {results.eligibleCount}</span>
                <Progress
                  value={results.eligibleCount ? candidate.availableCount / results.eligibleCount * 100 : 0}
                  aria-label={`${candidate.availableCount} of ${results.eligibleCount} available`}
                />
              </li>
            ))}
          </ol>
        ) : (
          <p className="sched-empty-line">No complete times yet</p>
        )}

        {poll.canManage && top[0] ? (
          <div className="sched-results-actions">
            <Button size="sm" disabled={poll.status === "finalized"} onClick={() => void chooseTopTime()}>
              <Check data-icon="inline-start" /> {poll.status === "finalized" ? "Chosen" : "Choose time"}
            </Button>
          </div>
        ) : null}
      </ResultsSection>

      <ResultsSection embedded={embedded} title="Availability">
        <div className="sched-heat-wrap">
          <table className="sched-heat">
            <caption className="sched-sr">Members available at each time</caption>
            <thead>
              <tr>
                <th scope="col"><span className="sched-sr">Time</span></th>
                {poll.dateKeys.map((dateKey) => (
                  <th scope="col" key={dateKey}>
                    {dateLabel(dateKey, { weekday: "short", month: "short", day: "numeric" })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {minutes.map((minute) => (
                <tr key={minute}>
                  <th scope="row">
                    {minute % 30 === 0
                      ? minutesLabel(minute)
                      : <span className="sched-sr">{minutesLabel(minute)}</span>}
                  </th>
                  {poll.dateKeys.map((dateKey) => {
                    const count = results.cellCounts[`${dateKey}@${minute}`] ?? 0
                    const strength = results.eligibleCount ? count / results.eligibleCount : 0
                    return (
                      <td
                        key={dateKey}
                        style={{ "--sched-strength": strength } as React.CSSProperties}
                        title={`${count} of ${results.eligibleCount} available`}
                      >
                        <span className="sched-sr">{count} of {results.eligibleCount}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ResultsSection>
    </>
  )
}
