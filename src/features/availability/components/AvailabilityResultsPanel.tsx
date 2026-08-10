import { Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useAvailabilityData } from "../availabilityDataContext"
import { candidateLabel, dateLabel, minutesLabel } from "../format"
import type { AvailabilityPollDetail } from "../types"

function shareHref(slug: string) {
  return `${window.location.origin}/s/${slug}`
}

export function AvailabilityResultsPanel({ poll }: { poll: AvailabilityPollDetail }) {
  const { adapter } = useAvailabilityData()
  const results = poll.results
  const top = results?.candidates.slice(0, 3) ?? []

  if (!results) {
    return (
      <section className="av-results-locked">
        <h2>results unlock after you reply</h2>
      </section>
    )
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareHref(poll.slug))
      toast("link copied")
    } catch {
      toast.error("link could not be copied")
    }
  }

  const chooseTopTime = async () => {
    if (!top[0]) return
    try {
      await adapter.finalizePoll(poll.id, top[0].dateKey, top[0].startMinutes)
      toast("time chosen")
    } catch {
      toast.error("time could not be chosen")
    }
  }

  const chosenLabel = poll.finalizedDateKey && poll.finalizedStartMinutes !== undefined
    ? candidateLabel(
        poll.finalizedDateKey,
        poll.finalizedStartMinutes,
        poll.finalizedStartMinutes + poll.durationMinutes,
      )
    : undefined

  return (
    <section className="av-results-panel" aria-labelledby="best-times-title">
      <div className="av-results-heading">
        <h2 id="best-times-title">best times</h2>
        <div className="av-results-summary">
          <span>{results.responseCount} of {results.eligibleCount} responded</span>
          {poll.canManage && results.missing?.length ? (
            <span>missing: {results.missing.map((member) => member.displayName.toLowerCase()).join(", ")}</span>
          ) : null}
        </div>
      </div>

      {chosenLabel ? <div className="av-chosen-time"><Check /> chosen · {chosenLabel}</div> : null}

      <ol className="av-best-times">
        {top.length ? top.map((candidate, index) => (
          <li key={`${candidate.dateKey}-${candidate.startMinutes}`} className={index === 0 ? "av-best-time av-best-time-top" : "av-best-time"}>
            <span className="av-best-rank">{index + 1}</span>
            <span className="av-best-label">{candidateLabel(candidate.dateKey, candidate.startMinutes, candidate.endMinutes)}</span>
            <strong>{candidate.availableCount} of {results.eligibleCount}</strong>
            <Progress value={results.eligibleCount ? candidate.availableCount / results.eligibleCount * 100 : 0} aria-label={`${candidate.availableCount} of ${results.eligibleCount} available`} />
          </li>
        )) : <li className="av-no-times">no complete times yet</li>}
      </ol>

      <div className="av-results-actions">
        <Button variant="outline" size="sm" onClick={() => void copyLink()}>
          <Copy data-icon="inline-start" /> copy link
        </Button>
        {poll.canManage && top[0] ? (
          <Button size="sm" disabled={poll.status === "finalized"} onClick={() => void chooseTopTime()}>
            <Check data-icon="inline-start" /> {poll.status === "finalized" ? "chosen" : "choose time"}
          </Button>
        ) : null}
      </div>

      <div className="av-heatmap-wrap">
        <div
          className="av-heatmap"
          style={{ "--av-columns": poll.dateKeys.length } as React.CSSProperties}
          role="table"
          aria-label="aggregate availability"
        >
          <span />
          {poll.dateKeys.map((dateKey) => <strong key={dateKey}>{dateLabel(dateKey, { weekday: "short", month: "short", day: "numeric" }).toLowerCase()}</strong>)}
          {Array.from(
            { length: Math.ceil((poll.endMinutes - poll.startMinutes) / poll.slotMinutes) },
            (_, index) => poll.startMinutes + index * poll.slotMinutes,
          ).flatMap((minute) => [
            <span className="av-heatmap-time" key={`label-${minute}`}>{minute % 30 === 0 ? minutesLabel(minute) : ""}</span>,
            ...poll.dateKeys.map((dateKey) => {
              const count = results.cellCounts[`${dateKey}@${minute}`] ?? 0
              const strength = results.eligibleCount ? count / results.eligibleCount : 0
              return (
                <span
                  className="av-heatmap-cell"
                  key={`${dateKey}-${minute}`}
                  style={{ "--av-strength": strength } as React.CSSProperties}
                  title={`${count} of ${results.eligibleCount} available`}
                  role="cell"
                  aria-label={`${dateLabel(dateKey)}, ${minutesLabel(minute)}: ${count} of ${results.eligibleCount} available`}
                />
              )
            }),
          ])}
        </div>
      </div>
    </section>
  )
}
