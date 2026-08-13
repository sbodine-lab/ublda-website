import assert from "node:assert/strict"
import test from "node:test"
import { mergeWorkspaceDirectory, workspaceDirectory } from "../src/features/workspace/directoryData.ts"

test("workspace directory mirrors the deduplicated membership roster", () => {
  assert.equal(workspaceDirectory.length, 66)
  assert.equal(new Set(workspaceDirectory.map((person) => person.memberId)).size, 66)
  assert.equal(workspaceDirectory.filter((person) => person.isLeadership).length, 9)
  assert.equal(workspaceDirectory.find((person) => person.displayName === "Sam Bodine")?.clubRole, "Co-President")
  assert.equal(workspaceDirectory.find((person) => person.displayName === "Andrew Sackett")?.clubRole, "VP Events and Programming")
  assert.equal(workspaceDirectory.some((person) => /preview|lead$/i.test(person.displayName)), false)
})

test("workspace directory keeps the full roster while preferring live profiles", () => {
  const merged = mergeWorkspaceDirectory([
    {
      memberId: "live-sam",
      displayName: "Sam Bodine",
      workspaceRole: "admin",
      clubRole: "Co-President",
      team: "Executive board",
      schoolYear: "2028",
      major: "Live program",
      isLeadership: true,
    },
    {
      memberId: "live-new-member",
      displayName: "New Member",
      workspaceRole: "member",
      clubRole: "Member",
      team: "General membership",
      isLeadership: false,
    },
  ])

  assert.equal(merged.length, 67)
  assert.equal(merged.find((person) => person.displayName === "Sam Bodine")?.memberId, "live-sam")
  assert.equal(merged.find((person) => person.displayName === "Sam Bodine")?.major, "Live program")
  assert.equal(merged.some((person) => person.displayName === "New Member"), true)
})
