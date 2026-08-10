export type ClubEventType = "meeting" | "event" | "deadline" | "project"
export type ClubEventStatus = "tentative" | "confirmed" | "cancelled"
export type ProjectLane = "community-career" | "advisory" | "catalyst" | "operations"
export type ProjectStatus = "planned" | "active" | "blocked" | "complete"
export type TaskStatus = "todo" | "working" | "blocked" | "done"
export type TaskPriority = "low" | "medium" | "high"

export interface ClubEvent {
  id: string
  title: string
  type: ClubEventType
  startAt: string
  endAt?: string
  timezone: string
  location?: string
  ownerMemberId?: string
  projectId?: string
  status: ClubEventStatus
  notes?: string
}

export interface ClubProject {
  id: string
  name: string
  lane: ProjectLane
  ownerMemberId?: string
  status: ProjectStatus
  dueDate?: string
  summary?: string
  position: number
}

export interface ProjectTask {
  id: string
  projectId: string
  title: string
  ownerMemberId?: string
  status: TaskStatus
  dueDate?: string
  priority: TaskPriority
  completionSignal?: string
  position: number
}

export interface DirectoryProfile {
  memberId: string
  displayName: string
  avatarUrl?: string
  workspaceRole: "admin" | "member"
  clubRole: string
  team: string
  schoolYear?: string
  major?: string
  linkedinUrl?: string
  isLeadership: boolean
}

export interface ClubWorkspaceSnapshot {
  events: ClubEvent[]
  projects: ClubProject[]
  tasks: ProjectTask[]
  people: DirectoryProfile[]
  loading: boolean
  error?: string
}

export type CreateClubEventInput = Omit<ClubEvent, "id">
export type CreateProjectInput = Omit<ClubProject, "id" | "position">
export type CreateProjectTaskInput = Omit<ProjectTask, "id" | "position">
export type UpdateDirectoryProfileInput = Omit<DirectoryProfile, "displayName" | "avatarUrl" | "workspaceRole">

export interface ClubWorkspaceAdapter {
  readonly mode: "demo" | "live"
  subscribe(listener: () => void): () => void
  getSnapshot(): ClubWorkspaceSnapshot
  createEvent(input: CreateClubEventInput): Promise<string>
  createProject(input: CreateProjectInput): Promise<string>
  createTask(input: CreateProjectTaskInput): Promise<string>
  updateTaskStatus(taskId: string, status: TaskStatus): Promise<void>
  updateProfile(input: UpdateDirectoryProfileInput): Promise<void>
}
