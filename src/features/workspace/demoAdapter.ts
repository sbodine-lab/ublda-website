import type {
  ClubEvent,
  ClubProject,
  ClubWorkspaceAdapter,
  ClubWorkspaceSnapshot,
  CreateClubEventInput,
  CreateProjectInput,
  CreateProjectTaskInput,
  DirectoryProfile,
  ProjectTask,
  TaskStatus,
  UpdateDirectoryProfileInput,
} from "./types"
import { workspaceDirectory } from "./directoryData"

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
let people: DirectoryProfile[] = workspaceDirectory.map((person) => ({ ...person }))

let events: ClubEvent[] = [
  { id: "event-board", title: "weekly e-board", type: "meeting", startAt: "2026-08-12T21:00:00.000Z", endAt: "2026-08-12T22:00:00.000Z", timezone: "America/Detroit", location: "michigan union", ownerMemberId: "member-operations", status: "confirmed" },
  { id: "event-speaker", title: "speaker pipeline check-in", type: "project", startAt: "2026-08-14T19:00:00.000Z", endAt: "2026-08-14T19:30:00.000Z", timezone: "America/Detroit", ownerMemberId: "member-events", projectId: "project-speakers", status: "confirmed" },
  { id: "event-kickoff", title: "fall kickoff", type: "event", startAt: "2026-08-18T22:00:00.000Z", endAt: "2026-08-19T00:00:00.000Z", timezone: "America/Detroit", location: "tbd", ownerMemberId: "member-community", status: "tentative" },
]

let projects: ClubProject[] = [
  { id: "project-servicenow", name: "accessibility advisory pilot", lane: "advisory", ownerMemberId: "member-partnerships", status: "active", dueDate: "2026-09-04", summary: "turn discovery into a scoped pilot", position: 0 },
  { id: "project-speakers", name: "fall speaker series", lane: "community-career", ownerMemberId: "member-events", status: "active", dueDate: "2026-09-11", summary: "confirm the first two fall speakers", position: 1 },
  { id: "project-members", name: "member onboarding", lane: "operations", ownerMemberId: "member-membership", status: "planned", dueDate: "2026-09-08", summary: "make the first month repeatable", position: 2 },
]

let tasks: ProjectTask[] = [
  { id: "task-scope", projectId: "project-servicenow", title: "write the one-page pilot scope", ownerMemberId: "member-preview-admin", status: "working", dueDate: "2026-08-15", priority: "high", completionSignal: "scope is ready for board review", position: 0 },
  { id: "task-speaker", projectId: "project-speakers", title: "confirm first speaker date", ownerMemberId: "member-events", status: "todo", dueDate: "2026-08-17", priority: "high", completionSignal: "date appears on the master calendar", position: 0 },
  { id: "task-intake", projectId: "project-members", title: "finish member intake checklist", ownerMemberId: "member-membership", status: "todo", dueDate: "2026-08-22", priority: "medium", position: 0 },
]

let snapshot: ClubWorkspaceSnapshot = { events, projects, tasks, people, loading: false }
const listeners = new Set<() => void>()
const emit = () => {
  snapshot = { events: [...events], projects: [...projects], tasks: [...tasks], people: [...people], loading: false }
  listeners.forEach((listener) => listener())
}

export const demoWorkspaceAdapter: ClubWorkspaceAdapter = {
  mode: "demo",
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
  getSnapshot: () => snapshot,
  async createEvent(input: CreateClubEventInput) { const id = uid("event"); events = [...events, { ...input, id }]; emit(); return id },
  async createProject(input: CreateProjectInput) { const id = uid("project"); projects = [...projects, { ...input, id, position: projects.length }]; emit(); return id },
  async createTask(input: CreateProjectTaskInput) { const id = uid("task"); tasks = [...tasks, { ...input, id, position: tasks.filter((task) => task.projectId === input.projectId).length }]; emit(); return id },
  async updateTaskStatus(taskId: string, status: TaskStatus) { tasks = tasks.map((task) => task.id === taskId ? { ...task, status } : task); emit() },
  async updateProfile(input: UpdateDirectoryProfileInput) { people = people.map((person) => person.memberId === input.memberId ? { ...person, ...input } : person); emit() },
}
