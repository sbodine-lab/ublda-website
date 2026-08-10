import {
  actionGeneric,
  httpActionGeneric,
  internalActionGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
  mutationGeneric,
  queryGeneric,
  type ActionBuilder,
  type DataModelFromSchemaDefinition,
  type GenericActionCtx,
  type GenericMutationCtx,
  type GenericQueryCtx,
  type MutationBuilder,
  type QueryBuilder,
} from "convex/server";
import schema from "../schema";

export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
export type QueryCtx = GenericQueryCtx<DataModel>;
export type MutationCtx = GenericMutationCtx<DataModel>;
export type ActionCtx = GenericActionCtx<DataModel>;

// These are the same builders that Convex codegen emits, typed from schema.ts.
// Keeping this tiny shim means the repository can be type-checked before anyone
// connects it to a hosted Convex project. `npx convex dev` may later generate the
// conventional `_generated` folder without changing the domain code.
export const query = queryGeneric as QueryBuilder<DataModel, "public">;
export const mutation = mutationGeneric as MutationBuilder<DataModel, "public">;
export const action = actionGeneric as ActionBuilder<DataModel, "public">;
export const internalQuery = internalQueryGeneric as QueryBuilder<
  DataModel,
  "internal"
>;
export const internalMutation = internalMutationGeneric as MutationBuilder<
  DataModel,
  "internal"
>;
export const internalAction = internalActionGeneric as ActionBuilder<
  DataModel,
  "internal"
>;
export const httpAction = httpActionGeneric;
