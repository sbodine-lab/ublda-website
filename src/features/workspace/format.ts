import type { ClubEvent, ProjectLane, ProjectStatus, TaskStatus } from "./types"

export const programAreaLabels: Record<ProjectLane, string> = {
  "community-career": "Community + career",
  advisory: "Accessibility advisory",
  catalyst: "Catalyst finance lab",
  operations: "Operations",
}

export const projectStatusLabels: Record<ProjectStatus, string> = {
  planned: "planned",
  active: "active",
  blocked: "blocked",
  complete: "complete",
}

export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "to do",
  working: "working",
  blocked: "blocked",
  done: "done",
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
  const start = formatter.format(new Date(event.startAt)).toLowerCase()
  if (!event.endAt) return start
  return `${start} – ${formatter.format(new Date(event.endAt)).toLowerCase()}`
}

export function formatDueDate(value?: string) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00.000Z`))
    .toLowerCase()
}

export function todayDateInput(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
