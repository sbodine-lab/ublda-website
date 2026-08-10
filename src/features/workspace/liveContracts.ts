import type { ClubWorkspaceSnapshot } from "./types"

export interface BackendClubWorkspaceSnapshot {
  events: Array<{ eventId: string; title: string; type: "meeting" | "event" | "deadline" | "project"; startAt: number; endAt: number | null; timezone: string; location: string | null; ownerMemberId: string | null; projectId: string | null; status: "tentative" | "confirmed" | "cancelled"; notes: string | null }>
  projects: Array<{ projectId: string; name: string; lane: "community-career" | "advisory" | "catalyst" | "operations"; ownerMemberId: string | null; status: "planned" | "active" | "blocked" | "complete"; dueDate: string | null; summary: string | null; position: number }>
  tasks: Array<{ taskId: string; projectId: string; title: string; ownerMemberId: string | null; status: "todo" | "working" | "blocked" | "done"; dueDate: string | null; priority: "low" | "medium" | "high"; completionSignal: string | null; position: number }>
  people: Array<{ memberId: string; displayName: string; avatarUrl: string | null; workspaceRole: "admin" | "member"; clubRole: string; team: string; schoolYear: string | null; major: string | null; linkedinUrl: string | null; isLeadership: boolean }>
}

export function mapClubWorkspace(input: BackendClubWorkspaceSnapshot): ClubWorkspaceSnapshot {
  return {
    events: input.events.map((event) => ({ id: event.eventId, title: event.title, type: event.type, startAt: new Date(event.startAt).toISOString(), endAt: event.endAt === null ? undefined : new Date(event.endAt).toISOString(), timezone: event.timezone, location: event.location ?? undefined, ownerMemberId: event.ownerMemberId ?? undefined, projectId: event.projectId ?? undefined, status: event.status, notes: event.notes ?? undefined })),
    projects: input.projects.map((project) => ({ id: project.projectId, name: project.name, lane: project.lane, ownerMemberId: project.ownerMemberId ?? undefined, status: project.status, dueDate: project.dueDate ?? undefined, summary: project.summary ?? undefined, position: project.position })),
    tasks: input.tasks.map((task) => ({ id: task.taskId, projectId: task.projectId, title: task.title, ownerMemberId: task.ownerMemberId ?? undefined, status: task.status, dueDate: task.dueDate ?? undefined, priority: task.priority, completionSignal: task.completionSignal ?? undefined, position: task.position })),
    people: input.people.map((person) => ({ memberId: person.memberId, displayName: person.displayName, avatarUrl: person.avatarUrl ?? undefined, workspaceRole: person.workspaceRole, clubRole: person.clubRole, team: person.team, schoolYear: person.schoolYear ?? undefined, major: person.major ?? undefined, linkedinUrl: person.linkedinUrl ?? undefined, isLeadership: person.isLeadership })),
    loading: false,
  }
}
