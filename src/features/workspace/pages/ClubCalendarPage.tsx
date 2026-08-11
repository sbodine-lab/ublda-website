import { useState, type FormEvent } from "react"
import { CalendarDays, CalendarPlus, MapPin } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDecisionData } from "@/features/decisions/decisionDataContext"
import { LeadershipPage, LeadershipSection, LeadershipSurface } from "@/features/leadership/components/LeadershipPage"
import { useWorkspaceData } from "../workspaceDataContext"
import { formatEventDate, formatEventTime, todayDateInput } from "../format"
import type { ClubEventType } from "../types"

export function ClubCalendarPage() {
  const adapter = useWorkspaceData()
  const { events, people, projects } = adapter.getSnapshot()
  const { snapshot: decisions } = useDecisionData()
  const isAdmin = decisions.auth.status === "signed-in" && decisions.auth.viewer.role === "admin"
  const [open, setOpen] = useState(false)
  const [eventType, setEventType] = useState<ClubEventType>("meeting")
  const upcoming = events.filter((event) => event.status !== "cancelled").sort((a, b) => a.startAt.localeCompare(b.startAt))
  const weeks = Array.from({ length: 14 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() + index)
    return date
  })

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const startAt = new Date(String(form.get("startAt"))).toISOString()
    const endValue = String(form.get("endAt") ?? "")
    try {
      await adapter.createEvent({
        title: String(form.get("title") ?? ""), type: eventType, startAt,
        endAt: endValue ? new Date(endValue).toISOString() : undefined,
        timezone: "America/Detroit", location: String(form.get("location") ?? "") || undefined,
        ownerMemberId: String(form.get("ownerMemberId") ?? "") || undefined,
        projectId: String(form.get("projectId") ?? "") || undefined,
        status: "confirmed", notes: undefined,
      })
      toast.success("event added")
      setOpen(false)
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "event could not be added") }
  }

  const addEventDialog = isAdmin ? (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="ws-primary-action"><CalendarPlus data-icon="inline-start" /> add event</Button></DialogTrigger>
      <DialogContent className="ws-dialog">
        <DialogHeader><DialogTitle>add event</DialogTitle></DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field><FieldLabel htmlFor="event-title">title</FieldLabel><Input id="event-title" name="title" required autoFocus /></Field>
            <div className="ws-form-grid"><Field><FieldLabel>type</FieldLabel><Select value={eventType} onValueChange={(value) => setEventType(value as ClubEventType)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["meeting", "event", "deadline", "project"].map((value) => <SelectItem value={value} key={value}>{value}</SelectItem>)}</SelectContent></Select></Field><Field><FieldLabel htmlFor="event-location">location</FieldLabel><Input id="event-location" name="location" /></Field></div>
            <div className="ws-form-grid"><Field><FieldLabel htmlFor="event-start">starts</FieldLabel><Input id="event-start" name="startAt" type="datetime-local" defaultValue={todayDateInput()} required /></Field><Field><FieldLabel htmlFor="event-end">ends</FieldLabel><Input id="event-end" name="endAt" type="datetime-local" /></Field></div>
            <div className="ws-form-grid"><Field><FieldLabel htmlFor="event-owner">owner</FieldLabel><select id="event-owner" name="ownerMemberId" className="ws-native-select"><option value="">unassigned</option>{people.map((person) => <option value={person.memberId} key={person.memberId}>{person.displayName}</option>)}</select></Field><Field><FieldLabel htmlFor="event-project">project</FieldLabel><select id="event-project" name="projectId" className="ws-native-select"><option value="">none</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></Field></div>
          </FieldGroup>
          <DialogFooter className="ws-dialog-footer"><Button type="submit">add event</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  ) : null

  return (
    <LeadershipPage action={addEventDialog}>
      <LeadershipSurface className="leadership-calendar-surface" flush>
        <div className="ws-date-strip" aria-label="next 14 days">{weeks.map((date) => <div className="ws-date" key={date.toISOString()}><span>{date.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase()}</span><strong>{date.getDate()}</strong><small>{date.toLocaleDateString("en-US", { month: "short" }).toLowerCase()}</small></div>)}</div>
      </LeadershipSurface>
      <LeadershipSection className="ws-calendar-agenda" title="agenda" flush>
        {upcoming.length ? upcoming.map((event) => <article className="ws-calendar-row" key={event.id}><time dateTime={event.startAt}><strong>{formatEventDate(event, { weekday: "short" })}</strong><span>{formatEventTime(event)}</span></time><span className="ws-calendar-accent" /><div><strong>{event.title}</strong>{event.location && <small><MapPin /> {event.location}</small>}</div><span className={`ws-status ws-status-${event.status}`}>{event.status}</span></article>) : <Empty className="ws-empty ws-calendar-empty"><EmptyHeader><EmptyMedia variant="icon"><CalendarDays /></EmptyMedia><EmptyTitle>nothing on the calendar</EmptyTitle><EmptyDescription>Upcoming meetings, deadlines, and events will appear here.</EmptyDescription></EmptyHeader></Empty>}
      </LeadershipSection>
    </LeadershipPage>
  )
}
