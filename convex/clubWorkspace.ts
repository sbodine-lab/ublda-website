import { v } from "convex/values";
import { mutation, query } from "./lib/server";
import { requireAdmin, requireMember } from "./lib/auth";
import { assert } from "./lib/errors";
import { writeAuditEvent } from "./lib/audit";
import { canonicalDecisionTimeZone } from "./lib/timezones";
import {
  clubEventStatus,
  clubEventType,
  projectLane,
  projectStatus,
  projectTaskPriority,
  projectTaskStatus,
} from "./schema";

const optionalId = <T extends string>(table: T) => v.optional(v.id(table));

function cleanRequired(value: string, max: number, label: string): string {
  const cleaned = value.trim().replace(/\s+/g, " ");
  assert(cleaned.length > 0, "VALIDATION_ERROR", `${label} is required.`);
  assert(cleaned.length <= max, "VALIDATION_ERROR", `${label} is too long.`);
  return cleaned;
}

function cleanOptional(value: string | undefined, max: number, label: string): string | undefined {
  if (value === undefined || !value.trim()) return undefined;
  return cleanRequired(value, max, label);
}

function cleanDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  assert(/^\d{4}-\d{2}-\d{2}$/.test(value), "VALIDATION_ERROR", "Due date must use YYYY-MM-DD.");
  return value;
}

async function activeMember(ctx: Parameters<typeof requireMember>[0], id: string | undefined) {
  if (!id) return;
  const member = await ctx.db.get("members", id as never);
  assert(member?.status === "active", "VALIDATION_ERROR", "Choose an active workspace member.");
}

export const snapshot = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);
    const [events, projects, tasks, members, profiles] = await Promise.all([
      ctx.db.query("clubEvents").withIndex("by_start").collect(),
      ctx.db.query("projects").collect(),
      ctx.db.query("projectTasks").collect(),
      ctx.db.query("members").withIndex("by_status", (q) => q.eq("status", "active")).collect(),
      ctx.db.query("directoryProfiles").collect(),
    ]);
    const profileByMember = new Map(profiles.map((profile) => [profile.memberId, profile]));
    return {
      events: events.map((event) => ({
        eventId: event._id,
        title: event.title,
        type: event.type,
        startAt: event.startAt,
        endAt: event.endAt ?? null,
        timezone: event.timezone,
        location: event.location ?? null,
        ownerMemberId: event.ownerMemberId ?? null,
        projectId: event.projectId ?? null,
        status: event.status,
        notes: event.notes ?? null,
      })),
      projects: projects.sort((a, b) => a.position - b.position).map((project) => ({
        projectId: project._id,
        name: project.name,
        lane: project.lane,
        ownerMemberId: project.ownerMemberId ?? null,
        status: project.status,
        dueDate: project.dueDate ?? null,
        summary: project.summary ?? null,
        position: project.position,
      })),
      tasks: tasks.sort((a, b) => a.position - b.position).map((task) => ({
        taskId: task._id,
        projectId: task.projectId,
        title: task.title,
        ownerMemberId: task.ownerMemberId ?? null,
        status: task.status,
        dueDate: task.dueDate ?? null,
        priority: task.priority,
        completionSignal: task.completionSignal ?? null,
        position: task.position,
      })),
      people: members.map((member) => {
        const profile = profileByMember.get(member._id);
        return {
          memberId: member._id,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl ?? null,
          workspaceRole: member.role,
          clubRole: profile?.clubRole ?? (member.role === "admin" ? "administrator" : "member"),
          team: profile?.team ?? "UBLDA",
          schoolYear: profile?.schoolYear ?? null,
          major: profile?.major ?? null,
          linkedinUrl: profile?.linkedinUrl ?? null,
          isLeadership: profile?.isLeadership ?? member.role === "admin",
        };
      }).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    };
  },
});

export const createEvent = mutation({
  args: {
    input: v.object({
      title: v.string(),
      type: clubEventType,
      startAt: v.number(),
      endAt: v.optional(v.number()),
      timezone: v.string(),
      location: v.optional(v.string()),
      ownerMemberId: optionalId("members"),
      projectId: optionalId("projects"),
      status: clubEventStatus,
      notes: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { input }) => {
    const actor = await requireMember(ctx);
    requireAdmin(actor);
    assert(Number.isFinite(input.startAt), "VALIDATION_ERROR", "Choose a valid start time.");
    assert(input.endAt === undefined || input.endAt > input.startAt, "VALIDATION_ERROR", "End time must be after start time.");
    await activeMember(ctx, input.ownerMemberId);
    if (input.projectId) assert(await ctx.db.get("projects", input.projectId), "VALIDATION_ERROR", "Project not found.");
    const timezone = canonicalDecisionTimeZone(input.timezone);
    assert(timezone, "VALIDATION_ERROR", "Choose a canonical IANA time zone.");
    const now = Date.now();
    const eventId = await ctx.db.insert("clubEvents", {
      title: cleanRequired(input.title, 120, "Title"),
      type: input.type,
      startAt: input.startAt,
      endAt: input.endAt,
      timezone,
      location: cleanOptional(input.location, 160, "Location"),
      ownerMemberId: input.ownerMemberId,
      projectId: input.projectId,
      status: input.status,
      notes: cleanOptional(input.notes, 1_000, "Notes"),
      createdByMemberId: actor._id,
      createdAt: now,
      updatedAt: now,
    });
    await writeAuditEvent(ctx, { actorType: "member", actorMemberId: actor._id, action: "club_event.created", entityType: "club_event", entityId: eventId });
    return eventId;
  },
});

export const createProject = mutation({
  args: { input: v.object({ name: v.string(), lane: projectLane, ownerMemberId: optionalId("members"), status: projectStatus, dueDate: v.optional(v.string()), summary: v.optional(v.string()) }) },
  handler: async (ctx, { input }) => {
    const actor = await requireMember(ctx);
    requireAdmin(actor);
    await activeMember(ctx, input.ownerMemberId);
    const projects = await ctx.db.query("projects").collect();
    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      name: cleanRequired(input.name, 120, "Project name"), lane: input.lane, ownerMemberId: input.ownerMemberId,
      status: input.status, dueDate: cleanDate(input.dueDate), summary: cleanOptional(input.summary, 500, "Summary"),
      position: projects.length, createdByMemberId: actor._id, createdAt: now, updatedAt: now,
    });
    await writeAuditEvent(ctx, { actorType: "member", actorMemberId: actor._id, action: "project.created", entityType: "project", entityId: projectId });
    return projectId;
  },
});

export const createTask = mutation({
  args: { input: v.object({ projectId: v.id("projects"), title: v.string(), ownerMemberId: optionalId("members"), status: projectTaskStatus, dueDate: v.optional(v.string()), priority: projectTaskPriority, completionSignal: v.optional(v.string()) }) },
  handler: async (ctx, { input }) => {
    const actor = await requireMember(ctx);
    requireAdmin(actor);
    assert(await ctx.db.get("projects", input.projectId), "VALIDATION_ERROR", "Project not found.");
    await activeMember(ctx, input.ownerMemberId);
    const existing = await ctx.db.query("projectTasks").withIndex("by_project_and_position", (q) => q.eq("projectId", input.projectId)).collect();
    const now = Date.now();
    const taskId = await ctx.db.insert("projectTasks", {
      projectId: input.projectId, title: cleanRequired(input.title, 160, "Task"), ownerMemberId: input.ownerMemberId,
      status: input.status, dueDate: cleanDate(input.dueDate), priority: input.priority,
      completionSignal: cleanOptional(input.completionSignal, 300, "Completion signal"), position: existing.length,
      createdByMemberId: actor._id, createdAt: now, updatedAt: now,
    });
    await writeAuditEvent(ctx, { actorType: "member", actorMemberId: actor._id, action: "project_task.created", entityType: "project_task", entityId: taskId });
    return taskId;
  },
});

export const updateTaskStatus = mutation({
  args: { taskId: v.id("projectTasks"), status: projectTaskStatus },
  handler: async (ctx, { taskId, status }) => {
    const actor = await requireMember(ctx);
    const task = await ctx.db.get("projectTasks", taskId);
    assert(task, "NOT_FOUND", "Task not found.");
    assert(actor.role === "admin" || task.ownerMemberId === actor._id, "FORBIDDEN", "Only an administrator or the task owner can update this task.");
    await ctx.db.patch("projectTasks", taskId, { status, updatedAt: Date.now() });
    await writeAuditEvent(ctx, { actorType: "member", actorMemberId: actor._id, action: "project_task.status_changed", entityType: "project_task", entityId: taskId, details: { status } });
  },
});

export const updateProfile = mutation({
  args: { input: v.object({ memberId: v.id("members"), clubRole: v.string(), team: v.string(), schoolYear: v.optional(v.string()), major: v.optional(v.string()), linkedinUrl: v.optional(v.string()), isLeadership: v.boolean() }) },
  handler: async (ctx, { input }) => {
    const actor = await requireMember(ctx);
    requireAdmin(actor);
    await activeMember(ctx, input.memberId);
    const now = Date.now();
    const value = {
      clubRole: cleanRequired(input.clubRole, 100, "Club role"), team: cleanRequired(input.team, 100, "Team"),
      schoolYear: cleanOptional(input.schoolYear, 80, "School year"), major: cleanOptional(input.major, 120, "Major"),
      linkedinUrl: cleanOptional(input.linkedinUrl, 300, "LinkedIn URL"), isLeadership: input.isLeadership,
      updatedByMemberId: actor._id, updatedAt: now,
    };
    const existing = await ctx.db.query("directoryProfiles").withIndex("by_member", (q) => q.eq("memberId", input.memberId)).unique();
    if (existing) await ctx.db.patch("directoryProfiles", existing._id, value);
    else await ctx.db.insert("directoryProfiles", { memberId: input.memberId, ...value, createdAt: now });
    await writeAuditEvent(ctx, { actorType: "member", actorMemberId: actor._id, action: "directory_profile.updated", entityType: "member", entityId: input.memberId });
  },
});
