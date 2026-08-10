import { internalMutation } from "./lib/server";
import { writeAuditEvent } from "./lib/audit";

export const autoCloseDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const open = await ctx.db
      .query("decisions")
      .withIndex("by_status_and_deadline", (q) =>
        q.eq("status", "open").lte("deadlineAt", now),
      )
      .collect();
    let closed = 0;
    for (const decision of open) {
      if (!decision.autoClose || decision.deadlineAt === undefined || decision.deadlineAt > now) {
        continue;
      }
      await ctx.db.patch("decisions", decision._id, {
        status: "closed",
        closedAt: now,
        closeReason: "Automatically closed at the configured deadline.",
        updatedAt: now,
      });
      await writeAuditEvent(ctx, {
        actorType: "system",
        action: "decision.auto_closed",
        entityType: "decision",
        entityId: decision._id,
      });
      closed += 1;
    }
    return { closed };
  },
});
