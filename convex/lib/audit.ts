import type { GenericId } from "convex/values";
import type { MutationCtx } from "./server";

export type AuditActor =
  | { actorType: "member"; actorMemberId: GenericId<"members"> }
  | {
      actorType: "agent";
      actorMemberId: GenericId<"members">;
      agentKeyId: GenericId<"agentKeys">;
    }
  | { actorType: "system" };

function safeDetails(details: Record<string, unknown> | undefined): string | undefined {
  if (!details) return undefined;
  const encoded = JSON.stringify(details);
  return encoded.length <= 4_000 ? encoded : JSON.stringify({ truncated: true });
}

export async function writeAuditEvent(
  ctx: MutationCtx,
  input: AuditActor & {
    action: string;
    entityType: string;
    entityId: string;
    requestId?: string;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await ctx.db.insert("auditEvents", {
    actorType: input.actorType,
    actorMemberId:
      "actorMemberId" in input ? input.actorMemberId : undefined,
    agentKeyId: "agentKeyId" in input ? input.agentKeyId : undefined,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    requestId: input.requestId,
    detailsJson: safeDetails(input.details),
    createdAt: Date.now(),
  });
}
