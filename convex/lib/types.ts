import type { DocumentByName } from "convex/server";
import type { GenericId } from "convex/values";
import type { DataModel } from "./server";

export type TableName = keyof DataModel;
export type Doc<Name extends TableName> = DocumentByName<DataModel, Name>;
export type Id<Name extends string> = GenericId<Name>;

export const AGENT_SCOPES = [
  "decisions:read",
  "decisions:write",
  "decisions:publish",
  "decisions:manage",
  "results:read",
] as const;

export type AgentScope = (typeof AGENT_SCOPES)[number];
export type ResponseType =
  | "yes_no_other"
  | "single_choice"
  | "ranked_choice"
  | "input_only";
export type DecisionStatus = "draft" | "open" | "closed" | "finalized";
