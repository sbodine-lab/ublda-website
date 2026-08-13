import type {
  ClubEvent,
  ClubEventStatus,
  ClubEventType,
  ProjectLane,
  ProjectStatus,
  TaskStatus,
} from "./types"

export const programAreaLabels: Record<ProjectLane, string> = {
  "community-career": "Community + career",
  advisory: "Accessibility advisory",
  catalyst: "Catalyst finance lab",
  operations: "Operations",
}

export const projectStatusLabels: Record<ProjectStatus, string> = {
  planned: "Planned",
  active: "Active",
  blocked: "Blocked",
  complete: "Complete",
}

export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "To do",
  working: "Working",
  blocked: "Blocked",
  done: "Done",
}

export const eventTypeLabels: Record<ClubEventType, string> = {
  meeting: "Meeting",
  event: "Event",
  deadline: "Deadline",
  project: "Project",
}

export const eventStatusLabels: Record<ClubEventStatus, string> = {
  tentative: "Tentative",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
}

export function formatEventDate(event: ClubEvent, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: event.timezone,
    month: "short",
    day: "numeric",
    ...options,
  }).format(new Date(event.startAt))
}

export function formatEventTime(event: ClubEvent) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: event.timezone,
    hour: "numeric",
    minute: "2-digit",
  })
  const start = formatter.format(new Date(event.startAt))
  if (!event.endAt) return start
  return `${start} – ${formatter.format(new Date(event.endAt))}`
}

export function formatDueDate(value?: string) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`))
}

export function todayDateInput(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
