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
import { dayParts, minutesLabel, timezoneLabel } from "../format"
import type { AvailabilityPollDetail } from "../types"

type SaveState = "idle" | "saving" | "saved" | "error"

export function AvailabilityPollPage() {
  const { slug } = useParams()
  const { snapshot, pollBySlug } = useAvailabilityData()
  const poll = pollBySlug(slug)

  if (snapshot.loading) {
    return <main id="main-content" className="av-public-page"><p className="av-loading">opening poll…</p></main>
  }
  if (!poll) {
    return (
      <main id="main-content" className="av-public-page av-not-found">
        <h1>poll not found</h1>
        <Button asChild variant="outline"><Link to="/scheduling">back to scheduling</Link></Button>
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

  return (
    <main id="main-content" className="av-public-page">
      <header className="av-public-topbar">
        <Button variant="ghost" size="icon" asChild aria-label="back to scheduling">
          <Link to="/scheduling"><ChevronLeft /></Link>
        </Button>
        <Link to="/scheduling" className="av-logo-lockup" aria-label="Scheduling">
          <img src="/logo.png" alt="" />
        </Link>
      </header>

      <article className="av-poll-document">
        <header className="av-poll-heading">
          <h1>{poll.title}</h1>
          {poll.note ? <p>{poll.note}</p> : null}
          <span className="av-timezone">{timezoneLabel(poll.timezone)}</span>
        </header>

        {poll.status === "finalized" && poll.finalizedDateKey && poll.finalizedStartMinutes !== undefined ? (
          <section className="av-final-time">
            <Check />
            <p>{poll.finalizedDateKey} · {minutesLabel(poll.finalizedStartMinutes)}</p>
          </section>
        ) : (
          <>
            <div
              className="av-grid"
              style={{ "--av-date-count": poll.dateKeys.length } as React.CSSProperties}
              onPointerDown={startDrag}
              onPointerMove={continueDrag}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
              role="grid"
              aria-label="choose every time you are available"
            >
              <span className="av-grid-corner" />
              {poll.dateKeys.map((dateKey) => {
                const parts = dayParts(dateKey)
                return <span className="av-date-heading" key={dateKey}><small>{parts.day}</small><strong>{parts.date}</strong></span>
              })}
              {minutes.flatMap((minute) => [
                <span className="av-time-label" key={`time-${minute}`}>{minute % 30 === 0 ? minutesLabel(minute) : ""}</span>,
                ...poll.dateKeys.map((dateKey) => {
                  const key = `${dateKey}@${minute}`
                  const active = selected.has(key)
                  return (
                    <button
                      type="button"
                      className="av-slot"
                      data-availability-key={key}
                      data-selected={active || undefined}
                      aria-pressed={active}
                      aria-label={`${dateKey}, ${minutesLabel(minute)}`}
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
              <span className="av-time-label av-time-boundary">{minutesLabel(poll.endMinutes)}</span>
              {poll.dateKeys.map((dateKey) => <span className="av-slot-boundary" key={`${dateKey}-boundary`} />)}
            </div>

            <div className="av-save-state" data-save-state={saveState} role="status" aria-live="polite">
              {saveState === "saving" ? "saving…" : saveState === "error" ? "try again" : saveState === "saved" ? <><Check /> saved</> : "drag across every time that works"}
            </div>
          </>
        )}

        {(poll.hasResponded && poll.resultsVisibility === "after-submit") || poll.canManage ? (
          <div className="av-poll-action">
            <Button
              className="av-liquid-button"
              variant="outline"
              onClick={() => navigate(`/s/${poll.slug}/results`)}
            >
              see best times
            </Button>
          </div>
        ) : null}
      </article>
    </main>
  )
}
