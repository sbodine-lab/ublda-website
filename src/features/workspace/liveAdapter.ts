import type {
  ClubWorkspaceAdapter,
  ClubWorkspaceSnapshot,
  CreateClubEventInput,
  CreateProjectInput,
  CreateProjectTaskInput,
  TaskStatus,
  UpdateDirectoryProfileInput,
} from "./types"

type Operations = Pick<ClubWorkspaceAdapter,
  "createEvent" | "createProject" | "createTask" | "updateTaskStatus" | "updateProfile"
>

export interface MutableLiveWorkspaceAdapter extends ClubWorkspaceAdapter {
  replaceSnapshot(snapshot: ClubWorkspaceSnapshot): void
  replaceOperations(operations: Operations): void
}

const unavailable = async (): Promise<never> => {
  throw new Error("The workspace data service is not ready.")
}

export function createLiveWorkspaceAdapter(): MutableLiveWorkspaceAdapter {
  let snapshot: ClubWorkspaceSnapshot = { events: [], projects: [], tasks: [], people: [], loading: true }
  let operations: Operations = {
    createEvent: unavailable,
    createProject: unavailable,
    createTask: unavailable,
    updateTaskStatus: unavailable,
    updateProfile: unavailable,
  }
  const listeners = new Set<() => void>()
  return {
    mode: "live",
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
    replaceSnapshot(next) {
      snapshot = next
      listeners.forEach((listener) => listener())
    },
    replaceOperations(next) {
      operations = next
    },
    createEvent(input: CreateClubEventInput) { return operations.createEvent(input) },
    createProject(input: CreateProjectInput) { return operations.createProject(input) },
    createTask(input: CreateProjectTaskInput) { return operations.createTask(input) },
    updateTaskStatus(taskId: string, status: TaskStatus) { return operations.updateTaskStatus(taskId, status) },
    updateProfile(input: UpdateDirectoryProfileInput) { return operations.updateProfile(input) },
  }
}

export function createUnavailableWorkspaceAdapter(message: string): ClubWorkspaceAdapter {
  const snapshot: ClubWorkspaceSnapshot = { events: [], projects: [], tasks: [], people: [], loading: false, error: message }
  return {
    mode: "live",
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
    createEvent: unavailable,
    createProject: unavailable,
    createTask: unavailable,
    updateTaskStatus: unavailable,
    updateProfile: unavailable,
  }
}
