import { useRef, useState, type FormEvent } from "react"
import { CalendarDays, CalendarPlus, MapPin } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDecisionData } from "@/features/decisions/decisionDataContext"
import { LeadershipPage, LeadershipSection, LeadershipSurface } from "@/features/leadership/components/LeadershipPage"
import { useWorkspaceData } from "../workspaceDataContext"
import {
  eventStatusLabels,
  eventTypeLabels,
  formatEventDate,
  formatEventTime,
  todayDateInput,
} from "../format"
import type { ClubEventType } from "../types"

const NO_OWNER = "unassigned"
const NO_PROJECT = "none"

const eventTypes = Object.keys(eventTypeLabels) as ClubEventType[]

export function ClubCalendarPage() {
  const adapter = useWorkspaceData()
  const { events, people, projects } = adapter.getSnapshot()
  const { snapshot } = useDecisionData()
  const isAdmin = snapshot.auth.status === "signed-in" && snapshot.auth.viewer.role === "admin"

  const [open, setOpen] = useState(false)
  // The trigger lives in the topbar portal, not inside <Dialog>, so Radix has
  // no triggerRef to restore focus to on close and would drop it to <body>.
  const addEventTriggerRef = useRef<HTMLButtonElement>(null)
  const [eventType, setEventType] = useState<ClubEventType>("meeting")
  const [ownerId, setOwnerId] = useState(NO_OWNER)
  const [projectId, setProjectId] = useState(NO_PROJECT)

  const upcoming = events
    .filter((event) => event.status !== "cancelled")
    .sort((a, b) => a.startAt.localeCompare(b.startAt))

  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() + index)
    return date
  })

  function openDialog(next: boolean) {
    setOpen(next)
    if (!next) return
    setEventType("meeting")
    setOwnerId(NO_OWNER)
    setProjectId(NO_PROJECT)
  }

  async function submit(submitted: FormEvent<HTMLFormElement>) {
    submitted.preventDefault()
    const form = new FormData(submitted.currentTarget)
    const endValue = String(form.get("endAt") ?? "")

    try {
      await adapter.createEvent({
        title: String(form.get("title") ?? ""),
        type: eventType,
        startAt: new Date(String(form.get("startAt"))).toISOString(),
        endAt: endValue ? new Date(endValue).toISOString() : undefined,
        timezone: "America/Detroit",
        location: String(form.get("location") ?? "") || undefined,
        ownerMemberId: ownerId === NO_OWNER ? undefined : ownerId,
        projectId: projectId === NO_PROJECT ? undefined : projectId,
        status: "confirmed",
      })
      toast.success("Event added")
      setOpen(false)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Event could not be added")
    }
  }

  const addEventAction = isAdmin ? (
    <Button ref={addEventTriggerRef} onClick={() => openDialog(true)}>
      <CalendarPlus data-icon="inline-start" /> Add event
    </Button>
  ) : null

  return (
    <LeadershipPage action={addEventAction}>
      <LeadershipSurface className="leadership-calendar-surface" flush>
        <div className="ws-date-strip">
          {days.map((date) => (
            <div className="ws-date" key={date.toISOString()}>
              <span>{date.toLocaleDateString("en-US", { weekday: "short" })}</span>
              <strong>{date.getDate()}</strong>
              <small>{date.toLocaleDateString("en-US", { month: "short" })}</small>
            </div>
          ))}
        </div>
      </LeadershipSurface>

      <LeadershipSection title="Agenda" flush>
        {upcoming.length ? (
          upcoming.map((event) => (
            <article className="ws-calendar-row" key={event.id}>
              <time dateTime={event.startAt}>
                <strong>{formatEventDate(event, { weekday: "short" })}</strong>
                <span>{formatEventTime(event)}</span>
              </time>
              <span className="ws-calendar-accent" aria-hidden="true" />
              <div>
                <strong>{event.title}</strong>
                {event.location ? (
                  <small><MapPin aria-hidden="true" /> {event.location}</small>
                ) : null}
              </div>
              <span className={`ws-status ws-status-${event.status}`}>
                {eventStatusLabels[event.status]}
              </span>
            </article>
          ))
        ) : (
          <Empty className="ws-empty">
            <EmptyHeader>
              <EmptyMedia variant="icon"><CalendarDays /></EmptyMedia>
              <EmptyTitle>Nothing on the calendar</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </LeadershipSection>

      <Dialog open={open} onOpenChange={openDialog}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            addEventTriggerRef.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>Add event</DialogTitle>
          </DialogHeader>

          <form onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="event-title">Title</FieldLabel>
                <Input id="event-title" name="title" required autoFocus />
              </Field>

              <div className="ws-form-grid">
                <Field>
                  <FieldLabel htmlFor="event-type">Type</FieldLabel>
                  <Select
                    value={eventType}
                    onValueChange={(value) => setEventType(value as ClubEventType)}
                  >
                    <SelectTrigger id="event-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {eventTypes.map((value) => (
                        <SelectItem value={value} key={value}>{eventTypeLabels[value]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="event-location">Location</FieldLabel>
                  <Input id="event-location" name="location" />
                </Field>
              </div>

              <div className="ws-form-grid">
                <Field>
                  <FieldLabel htmlFor="event-start">Starts</FieldLabel>
                  <Input
                    id="event-start"
                    name="startAt"
                    type="datetime-local"
                    defaultValue={todayDateInput()}
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="event-end">Ends</FieldLabel>
                  <Input id="event-end" name="endAt" type="datetime-local" />
                </Field>
              </div>

              <div className="ws-form-grid">
                <Field>
                  <FieldLabel htmlFor="event-owner">Owner</FieldLabel>
                  <Select value={ownerId} onValueChange={setOwnerId}>
                    <SelectTrigger id="event-owner" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_OWNER}>Unassigned</SelectItem>
                      {people.map((person) => (
                        <SelectItem value={person.memberId} key={person.memberId}>
                          {person.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="event-project">Project</FieldLabel>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger id="event-project" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROJECT}>None</SelectItem>
                      {projects.map((project) => (
                        <SelectItem value={project.id} key={project.id}>{project.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FieldGroup>

            <DialogFooter>
              <Button type="submit">Add event</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </LeadershipPage>
  )
}
