import assert from "node:assert/strict"
import { test } from "node:test"
import { createLiveWorkspaceAdapter } from "../src/features/workspace/liveAdapter.ts"
import { mapClubWorkspace, type BackendClubWorkspaceSnapshot } from "../src/features/workspace/liveContracts.ts"

const backendSnapshot = (): BackendClubWorkspaceSnapshot => ({
  events: [{ eventId: "event-a", title: "board meeting", type: "meeting", startAt: Date.parse("2026-08-12T21:00:00.000Z"), endAt: null, timezone: "America/Detroit", location: null, ownerMemberId: "member-a", projectId: null, status: "confirmed", notes: null }],
  projects: [{ projectId: "project-a", name: "fall speaker series", lane: "community-career", ownerMemberId: "member-a", status: "active", dueDate: "2026-09-11", summary: null, position: 0 }],
  tasks: [{ taskId: "task-a", projectId: "project-a", title: "confirm the first speaker", ownerMemberId: "member-a", status: "working", dueDate: "2026-08-17", priority: "high", completionSignal: "date is on the calendar", position: 0 }],
  people: [{ memberId: "member-a", displayName: "Preview Member", avatarUrl: null, workspaceRole: "admin", clubRole: "president", team: "executive", schoolYear: null, major: null, linkedinUrl: null, isLeadership: true }],
})

test("workspace contract maps live Convex rows without exposing identity aliases", () => {
  const mapped = mapClubWorkspace(backendSnapshot())
  assert.equal(mapped.events[0]?.startAt, "2026-08-12T21:00:00.000Z")
  assert.equal(mapped.projects[0]?.lane, "community-career")
  assert.equal(mapped.tasks[0]?.completionSignal, "date is on the calendar")
  assert.deepEqual(mapped.people[0], {
    memberId: "member-a",
    displayName: "Preview Member",
    avatarUrl: undefined,
    workspaceRole: "admin",
    clubRole: "president",
    team: "executive",
    schoolYear: undefined,
    major: undefined,
    linkedinUrl: undefined,
    isLeadership: true,
  })
  assert.equal(JSON.stringify(mapped).includes("email"), false)
})

test("mutable workspace adapter publishes snapshots and delegates status updates", async () => {
  const adapter = createLiveWorkspaceAdapter()
  let notified = 0
  adapter.subscribe(() => { notified += 1 })
  const mapped = mapClubWorkspace(backendSnapshot())
  adapter.replaceSnapshot(mapped)
  assert.equal(adapter.getSnapshot(), mapped)
  assert.equal(notified, 1)

  let status = ""
  adapter.replaceOperations({
    async createEvent() { return "event-a" },
    async createProject() { return "project-a" },
    async createTask() { return "task-a" },
    async updateTaskStatus(_taskId, next) { status = next },
    async updateProfile() {},
  })
  await adapter.updateTaskStatus("task-a", "done")
  assert.equal(status, "done")
})
