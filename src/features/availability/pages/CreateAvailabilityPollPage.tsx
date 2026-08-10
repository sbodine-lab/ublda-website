import { Check, Plus, X } from "lucide-react"
import { useMemo, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
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
import { useDecisionData } from "@/features/decisions/decisionDataContext"
import { useAvailabilityData } from "../availabilityDataContext"
import {
  dateLabel,
  nextWeekdays,
  parseTimeInput,
  timeInputValue,
  timezoneLabel,
  zonedDateTimeToIso,
} from "../format"

const durations = [30, 45, 60, 90]

export function CreateAvailabilityPollPage() {
  const navigate = useNavigate()
  const { snapshot: decisionSnapshot } = useDecisionData()
  const { adapter } = useAvailabilityData()
  const viewer = decisionSnapshot.auth.status === "signed-in" ? decisionSnapshot.auth.viewer : undefined
  const activeMembers = decisionSnapshot.members.filter((member) => member.active)
  const [title, setTitle] = useState("")
  const [duration, setDuration] = useState(45)
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

  if (viewer?.role !== "admin") {
    return <div className="dc-page av-create-denied"><h1>admin access required</h1></div>
  }

  const addDate = () => {
    if (!newDate || dates.includes(newDate) || dates.length >= 14) return
    setDates((current) => [...current, newDate].sort())
    setNewDate("")
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(undefined)
    try {
      const created = await adapter.createPoll({
        title: title.trim(),
        durationMinutes: duration,
        dateKeys: sortedDates,
        startMinutes: parseTimeInput(startTime),
        endMinutes: parseTimeInput(endTime),
        timezone,
        electorateMemberIds: activeMembers.map((member) => member.id),
        deadline: deadline ? zonedDateTimeToIso(deadline, timezone) : undefined,
        resultsVisibility: showResults ? "after-submit" : "admins-only",
      })
      const href = `${window.location.origin}/s/${created.slug}`
      try {
        await navigator.clipboard.writeText(href)
        toast("poll created · link copied")
      } catch {
        toast("poll created")
      }
      navigate(`/s/${created.slug}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "the poll could not be created.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="dc-page av-create-page">
      <header className="av-create-header">
        <h1>new scheduling poll</h1>
        <Button variant="ghost" size="icon" asChild aria-label="close">
          <Link to="/scheduling"><X /></Link>
        </Button>
      </header>

      <form onSubmit={submit} className="av-create-form">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="availability-title">what are we scheduling?</FieldLabel>
            <Input id="availability-title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} autoFocus />
          </Field>

          <Field>
            <FieldLabel>how long?</FieldLabel>
            <Select value={String(duration)} onValueChange={(value) => setDuration(Number(value))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>{durations.map((value) => <SelectItem value={String(value)} key={value}>{value} minutes</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>possible dates</FieldLabel>
            <div className="av-date-chips">
              {sortedDates.map((dateKey) => (
                <Button type="button" variant="outline" size="sm" key={dateKey} onClick={() => setDates((current) => current.filter((value) => value !== dateKey))}>
                  {dateLabel(dateKey).toLowerCase()} <X data-icon="inline-end" />
                </Button>
              ))}
            </div>
            <div className="av-add-date">
              <Input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} aria-label="add possible date" />
              <Button type="button" variant="ghost" onClick={addDate} disabled={!newDate || dates.length >= 14}><Plus data-icon="inline-start" /> add date</Button>
            </div>
          </Field>

          <Field>
            <FieldLabel>time window</FieldLabel>
            <div className="av-time-inputs">
              <Input type="time" step="900" value={startTime} onChange={(event) => setStartTime(event.target.value)} aria-label="earliest time" />
              <span>—</span>
              <Input type="time" step="900" value={endTime} onChange={(event) => setEndTime(event.target.value)} aria-label="latest time" />
            </div>
          </Field>

          <Field>
            <FieldLabel>who should respond?</FieldLabel>
            <div className="av-readonly-value">all {activeMembers.length} members</div>
          </Field>

          <Field>
            <FieldLabel htmlFor="availability-deadline">reply by</FieldLabel>
            <Input id="availability-deadline" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          </Field>

          <div className="av-readonly-value av-timezone-value">{timezoneLabel(timezone)}</div>

          <Field orientation="horizontal" className="av-switch-field">
            <FieldLabel htmlFor="availability-results">let people see results</FieldLabel>
            <Switch id="availability-results" checked={showResults} onCheckedChange={setShowResults} />
          </Field>
        </FieldGroup>

        {error ? <p className="dc-inline-error" role="alert">{error}</p> : null}

        <Button type="submit" variant="outline" className="av-liquid-button" disabled={submitting || !title.trim() || dates.length === 0}>
          {submitting ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
          create & copy link
        </Button>
      </form>
    </div>
  )
}
