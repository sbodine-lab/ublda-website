import { Plus, X } from "lucide-react"
import { useMemo, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useDecisionData } from "@/features/decisions/decisionDataContext"
import { LeadershipPage, LeadershipSurface } from "@/features/leadership/components/LeadershipPage"
import { useAvailabilityData } from "../availabilityDataContext"
import {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  SLOT_MINUTES,
  dateLabel,
  durationLabel,
  nextWeekdays,
  parseTimeInput,
  snapToSlot,
  timeInputValue,
  timeShapeError,
  timezoneLabel,
  zonedDateTimeToIso,
} from "../format"

/* Short meetings through long socials. Anything else goes through Custom. */
const durationPresets = [30, 45, 60, 90, 120, 150, 180, 240, 300, 360]
const CUSTOM = "custom"

export function CreateAvailabilityPollPage() {
  const navigate = useNavigate()
  const { snapshot: decisionSnapshot } = useDecisionData()
  const { adapter } = useAvailabilityData()
  const viewer = decisionSnapshot.auth.status === "signed-in" ? decisionSnapshot.auth.viewer : undefined
  const activeMembers = decisionSnapshot.members.filter((member) => member.active)
  const [title, setTitle] = useState("")
  const [note, setNote] = useState("")
  const [durationChoice, setDurationChoice] = useState<string>("60")
  const [customDuration, setCustomDuration] = useState("120")
  const [dates, setDates] = useState(() => nextWeekdays(4))
  const [newDate, setNewDate] = useState("")
  const [startTime, setStartTime] = useState(timeInputValue(17 * 60))
  const [endTime, setEndTime] = useState(timeInputValue(21 * 60))
  const [deadline, setDeadline] = useState("")
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Detroit")
  const [showResults, setShowResults] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  const sortedDates = useMemo(() => [...dates].sort(), [dates])

  const duration = durationChoice === CUSTOM ? Number(customDuration) : Number(durationChoice)
  const startMinutes = parseTimeInput(startTime)
  const endMinutes = parseTimeInput(endTime)
  const shapeProblem = timeShapeError({ durationMinutes: duration, startMinutes, endMinutes })
  const windowMinutes = Number.isFinite(endMinutes - startMinutes) ? endMinutes - startMinutes : 0
  const optionCount = shapeProblem ? 0 : Math.floor((windowMinutes - duration) / SLOT_MINUTES) + 1

  if (viewer?.role !== "admin") {
    return (
      <LeadershipPage className="sched-root">
        <Alert>
          <AlertTitle>Admin access required</AlertTitle>
          <AlertDescription>Only admins can create polls.</AlertDescription>
        </Alert>
        <div className="sched-actions">
          <Button variant="outline" size="sm" asChild><Link to="/scheduling">Back to scheduling</Link></Button>
        </div>
      </LeadershipPage>
    )
  }

  const addDate = () => {
    if (!newDate || dates.includes(newDate) || dates.length >= 14) return
    setDates((current) => [...current, newDate].sort())
    setNewDate("")
  }

  // Browsers accept any minute in a time input; the poll grid runs on 15s.
  const snapTime = (value: string, set: (next: string) => void) => {
    if (!value) return
    const minutes = parseTimeInput(value)
    if (!Number.isFinite(minutes)) return
    const snapped = snapToSlot(minutes)
    if (snapped !== minutes) set(timeInputValue(snapped))
  }

  const snapCustomDuration = () => {
    const minutes = Number(customDuration)
    if (!Number.isFinite(minutes)) return
    const snapped = Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, snapToSlot(minutes)))
    setCustomDuration(String(snapped))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (shapeProblem) {
      setError(shapeProblem)
      return
    }
    setSubmitting(true)
    setError(undefined)
    try {
      const created = await adapter.createPoll({
        title: title.trim(),
        note: note.trim() || undefined,
        durationMinutes: duration,
        dateKeys: sortedDates,
        startMinutes,
        endMinutes,
        timezone,
        electorateMemberIds: activeMembers.map((member) => member.id),
        deadline: deadline ? zonedDateTimeToIso(deadline, timezone) : undefined,
        resultsVisibility: showResults ? "after-submit" : "admins-only",
      })
      const href = `${window.location.origin}/s/${created.slug}`
      try {
        await navigator.clipboard.writeText(href)
        toast("Poll created · link copied")
      } catch {
        toast("Poll created")
      }
      navigate(`/s/${created.slug}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The poll could not be created.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <LeadershipPage className="sched-root">
      <LeadershipSurface>
        <form onSubmit={submit} className="sched-form">
          <Field>
            <FieldLabel htmlFor="poll-title">What are we scheduling</FieldLabel>
            <Input
              id="poll-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={160}
              autoFocus
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="poll-note">Context <span className="sched-optional">(optional)</span></FieldLabel>
            <Textarea
              id="poll-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Where, what to bring, anything people should know."
            />
          </Field>

          <div className="sched-form-row">
            <Field>
              <FieldLabel htmlFor="poll-length">Length</FieldLabel>
              <Select value={durationChoice} onValueChange={setDurationChoice}>
                <SelectTrigger id="poll-length" aria-label="Length"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {durationPresets.map((value) => (
                      <SelectItem value={String(value)} key={value}>{durationLabel(value)}</SelectItem>
                    ))}
                    <SelectItem value={CUSTOM}>Custom…</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {durationChoice === CUSTOM ? (
                <div className="sched-custom-length">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={MIN_DURATION_MINUTES}
                    max={MAX_DURATION_MINUTES}
                    step={SLOT_MINUTES}
                    value={customDuration}
                    onChange={(event) => setCustomDuration(event.target.value)}
                    onBlur={snapCustomDuration}
                    aria-label="Custom length in minutes"
                  />
                  <span className="sched-meta">
                    minutes{Number.isFinite(duration) && duration > 0 ? ` · ${durationLabel(duration)}` : ""}
                  </span>
                </div>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="poll-deadline">Reply by</FieldLabel>
              <Input
                id="poll-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </Field>
          </div>

          <Field aria-labelledby="poll-dates-title">
            <FieldTitle id="poll-dates-title">Possible dates</FieldTitle>
            {sortedDates.length ? (
              <div className="sched-chips">
                {sortedDates.map((dateKey) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    key={dateKey}
                    aria-label={`Remove ${dateLabel(dateKey)}`}
                    onClick={() => setDates((current) => current.filter((value) => value !== dateKey))}
                  >
                    {dateLabel(dateKey, { weekday: "short", month: "short", day: "numeric" })} <X data-icon="inline-end" />
                  </Button>
                ))}
              </div>
            ) : null}
            <div className="sched-add-date">
              <Input
                type="date"
                value={newDate}
                onChange={(event) => setNewDate(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    addDate()
                  }
                }}
                aria-label="Add a date"
              />
              <Button type="button" variant="outline" onClick={addDate} disabled={!newDate || dates.length >= 14}>
                <Plus data-icon="inline-start" /> Add date
              </Button>
            </div>
            {dates.length >= 14 ? <FieldDescription>Polls can hold up to 14 dates.</FieldDescription> : null}
          </Field>

          <Field aria-labelledby="poll-window-title">
            <FieldTitle id="poll-window-title">Time window</FieldTitle>
            <div className="sched-time-window">
              <Input
                type="time"
                step={SLOT_MINUTES * 60}
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                onBlur={(event) => snapTime(event.target.value, setStartTime)}
                aria-label="Earliest time"
                aria-invalid={Boolean(shapeProblem) || undefined}
              />
              <span aria-hidden="true">–</span>
              <Input
                type="time"
                step={SLOT_MINUTES * 60}
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                onBlur={(event) => snapTime(event.target.value, setEndTime)}
                aria-label="Latest time"
                aria-invalid={Boolean(shapeProblem) || undefined}
              />
            </div>
            {shapeProblem ? (
              <p className="sched-error" role="alert">{shapeProblem}</p>
            ) : (
              <p className="sched-meta">
                {timezoneLabel(timezone)} · {durationLabel(duration)} event, {optionCount} possible start
                {optionCount === 1 ? "" : "s"} per day
              </p>
            )}
          </Field>

          <Field aria-labelledby="poll-who-title">
            <FieldTitle id="poll-who-title">Who responds</FieldTitle>
            <p className="sched-static">All {activeMembers.length} members</p>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel htmlFor="poll-results">Show results to members</FieldLabel>
            <Switch id="poll-results" checked={showResults} onCheckedChange={setShowResults} />
          </Field>

          {error && error !== shapeProblem ? <p className="sched-error" role="alert">{error}</p> : null}

          <div className="sched-form-actions">
            <Button
              type="submit"
              disabled={submitting || !title.trim() || dates.length === 0 || Boolean(shapeProblem)}
            >
              {submitting ? <Spinner data-icon="inline-start" /> : null}
              Create poll
            </Button>
          </div>
        </form>
      </LeadershipSurface>
    </LeadershipPage>
  )
}
