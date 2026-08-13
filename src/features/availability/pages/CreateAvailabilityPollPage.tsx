import { Plus, X } from "lucide-react"
import { useMemo, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel, FieldTitle } from "@/components/ui/field"
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
import { LeadershipPage, LeadershipSurface } from "@/features/leadership/components/LeadershipPage"
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

          <div className="sched-form-row">
            <Field>
              <FieldLabel htmlFor="poll-length">Length</FieldLabel>
              <Select value={String(duration)} onValueChange={(value) => setDuration(Number(value))}>
                <SelectTrigger id="poll-length" aria-label="Length"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {durations.map((value) => (
                      <SelectItem value={String(value)} key={value}>{value} minutes</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
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
                    {dateLabel(dateKey)} <X data-icon="inline-end" />
                  </Button>
                ))}
              </div>
            ) : null}
            <div className="sched-add-date">
              <Input
                type="date"
                value={newDate}
                onChange={(event) => setNewDate(event.target.value)}
                aria-label="Add a date"
              />
              <Button type="button" variant="outline" onClick={addDate} disabled={!newDate || dates.length >= 14}>
                <Plus data-icon="inline-start" /> Add date
              </Button>
            </div>
          </Field>

          <Field aria-labelledby="poll-window-title">
            <FieldTitle id="poll-window-title">Time window</FieldTitle>
            <div className="sched-time-window">
              <Input
                type="time"
                step="900"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                aria-label="Earliest time"
              />
              <span aria-hidden="true">–</span>
              <Input
                type="time"
                step="900"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                aria-label="Latest time"
              />
            </div>
            <p className="sched-meta">{timezoneLabel(timezone)}</p>
          </Field>

          <Field aria-labelledby="poll-who-title">
            <FieldTitle id="poll-who-title">Who responds</FieldTitle>
            <p className="sched-static">All {activeMembers.length} members</p>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel htmlFor="poll-results">Show results to members</FieldLabel>
            <Switch id="poll-results" checked={showResults} onCheckedChange={setShowResults} />
          </Field>

          {error ? <p className="sched-error" role="alert">{error}</p> : null}

          <div className="sched-form-actions">
            <Button type="submit" disabled={submitting || !title.trim() || dates.length === 0}>
              {submitting ? <Spinner data-icon="inline-start" /> : null}
              Create poll
            </Button>
          </div>
        </form>
      </LeadershipSurface>
    </LeadershipPage>
  )
}
