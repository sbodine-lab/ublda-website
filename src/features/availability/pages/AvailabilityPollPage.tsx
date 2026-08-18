import { Check, ChevronLeft } from "lucide-react"
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAvailabilityData } from "../availabilityDataContext"
import { candidateLabel, dateLabel, dayParts, durationLabel, minutesLabel, timezoneLabel } from "../format"
import type { AvailabilityPollDetail } from "../types"

type SaveState = "idle" | "saving" | "saved" | "error"

function PublicTopbar({ title, backTo }: { title: string; backTo: string }) {
  return (
    <header className="sched-public-topbar">
      <Button variant="ghost" size="icon-sm" asChild aria-label="Back to scheduling">
        <Link to={backTo}><ChevronLeft /></Link>
      </Button>
      <h1>{title}</h1>
    </header>
  )
}

export function AvailabilityPollPage() {
  const { slug } = useParams()
  const { snapshot, pollBySlug } = useAvailabilityData()
  const poll = pollBySlug(slug)

  if (snapshot.loading) {
    return (
      <main id="main-content" className="sched-root sched-public">
        <PublicTopbar title="Loading…" backTo="/scheduling" />
      </main>
    )
  }

  if (!poll) {
    return (
      <main id="main-content" className="sched-root sched-public">
        <PublicTopbar title="Poll not found" backTo="/scheduling" />
        <div className="sched-public-body">
          <Button variant="outline" size="sm" asChild><Link to="/scheduling">Back to scheduling</Link></Button>
        </div>
      </main>
    )
  }

  return <AvailabilityPollContent key={poll.id} poll={poll} />
}

function AvailabilityPollContent({ poll }: { poll: AvailabilityPollDetail }) {
  const navigate = useNavigate()
  const { adapter } = useAvailabilityData()
  const [selected, setSelected] = useState<Set<string>>(() => new Set(poll?.mySlotKeys ?? []))
  const [saveState, setSaveState] = useState<SaveState>(poll?.hasResponded ? "saved" : "idle")
  const selectedRef = useRef(selected)
  const saveQueueRef = useRef(Promise.resolve())
  const saveSequenceRef = useRef(0)
  const dragRef = useRef({ active: false, add: true, pointerId: -1, clientX: 0, clientY: 0 })

  const minutes = useMemo(() => poll ? Array.from(
    { length: Math.ceil((poll.endMinutes - poll.startMinutes) / poll.slotMinutes) },
    (_, index) => poll.startMinutes + index * poll.slotMinutes,
  ) : [], [poll])

  const persist = useCallback((keys: string[]) => {
    if (!poll) return
    const sequence = ++saveSequenceRef.current
    setSaveState("saving")
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => adapter.saveResponse(poll.id, keys))
      .then(() => {
        if (saveSequenceRef.current === sequence) setSaveState("saved")
      })
      .catch(() => {
        if (saveSequenceRef.current === sequence) setSaveState("error")
      })
  }, [adapter, poll])

  const applySlot = useCallback((key: string, add: boolean) => {
    const next = new Set(selectedRef.current)
    if (add) next.add(key)
    else next.delete(key)
    selectedRef.current = next
    setSelected(next)
  }, [])

  const keyAtPoint = (clientX: number, clientY: number) => {
    const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-availability-key]")
    return element?.dataset.availabilityKey
  }

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!poll || poll.status !== "open" || !poll.isEligible) return
    const key = keyAtPoint(event.clientX, event.clientY)
    if (!key) return
    event.preventDefault()
    dragRef.current = {
      active: true,
      add: !selectedRef.current.has(key),
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    applySlot(key, dragRef.current.add)
  }

  const continueDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) return
    const { clientX, clientY } = dragRef.current
    const distance = Math.max(Math.abs(event.clientX - clientX), Math.abs(event.clientY - clientY))
    const steps = Math.max(1, Math.ceil(distance / 8))
    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps
      const key = keyAtPoint(
        clientX + (event.clientX - clientX) * progress,
        clientY + (event.clientY - clientY) * progress,
      )
      if (key) applySlot(key, dragRef.current.add)
    }
    dragRef.current.clientX = event.clientX
    dragRef.current.clientY = event.clientY
  }

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) return
    dragRef.current.active = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    persist([...selectedRef.current])
  }

  const saveMessage = saveState === "saving"
    ? "Saving…"
    : saveState === "error"
      ? "Try again"
      : saveState === "saved"
        ? "Saved"
        : "Drag across the times that work"

  const canSeeResults = (poll.hasResponded && poll.resultsVisibility === "after-submit") || poll.canManage

  return (
    <main id="main-content" className="sched-root sched-public">
      <PublicTopbar title={poll.title} backTo="/scheduling" />

      <article className="sched-public-body">
        {poll.note ? <p className="sched-note">{poll.note}</p> : null}
        <p className="sched-meta">{durationLabel(poll.durationMinutes)} · {timezoneLabel(poll.timezone)}</p>

        {poll.status === "finalized" && poll.finalizedDateKey && poll.finalizedStartMinutes !== undefined ? (
          <p className="sched-final">
            <Check aria-hidden="true" />
            {candidateLabel(poll.finalizedDateKey, poll.finalizedStartMinutes, poll.finalizedStartMinutes + poll.durationMinutes)}
          </p>
        ) : (
          <>
            <div
              className="sched-grid"
              style={{ "--sched-dates": poll.dateKeys.length } as React.CSSProperties}
              onPointerDown={startDrag}
              onPointerMove={continueDrag}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
              role="group"
              aria-label="Times you are available"
            >
              <span className="sched-grid__corner" />
              {poll.dateKeys.map((dateKey) => {
                const parts = dayParts(dateKey)
                return (
                  <span className="sched-grid__date" key={dateKey}>
                    <small>{parts.day}</small><strong>{parts.date}</strong>
                  </span>
                )
              })}
              {minutes.flatMap((minute) => [
                <span className="sched-grid__time" key={`time-${minute}`}>
                  {minute % 30 === 0 ? minutesLabel(minute) : ""}
                </span>,
                ...poll.dateKeys.map((dateKey) => {
                  const key = `${dateKey}@${minute}`
                  const active = selected.has(key)
                  return (
                    <button
                      type="button"
                      className="sched-slot"
                      data-availability-key={key}
                      data-selected={active || undefined}
                      aria-pressed={active}
                      aria-label={`${dateLabel(dateKey)}, ${minutesLabel(minute)}`}
                      key={key}
                      onClick={(event) => {
                        if (event.detail !== 0) return
                        applySlot(key, !active)
                        persist([...selectedRef.current])
                      }}
                    >
                      {active && minute % 30 === 0 ? <Check aria-hidden="true" /> : null}
                    </button>
                  )
                }),
              ])}
              <span className="sched-grid__time sched-grid__time--edge">{minutesLabel(poll.endMinutes)}</span>
              {poll.dateKeys.map((dateKey) => <span className="sched-grid__edge" key={`${dateKey}-boundary`} />)}
            </div>

            <p className="sched-save" role="status" aria-live="polite">
              {saveState === "saved" ? <Check aria-hidden="true" /> : null}
              {saveMessage}
            </p>
          </>
        )}

        {canSeeResults ? (
          <div className="sched-actions">
            <Button variant="outline" onClick={() => navigate(`/s/${poll.slug}/results`)}>
              See best times
            </Button>
          </div>
        ) : null}
      </article>
    </main>
  )
}
