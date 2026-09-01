/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentApi from "../agentApi.js";
import type * as agentKeys from "../agentKeys.js";
import type * as applications from "../applications.js";
import type * as availability from "../availability.js";
import type * as ballots from "../ballots.js";
import type * as clubWorkspace from "../clubWorkspace.js";
import type * as crons from "../crons.js";
import type * as decisions from "../decisions.js";
import type * as http from "../http.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_availability from "../lib/availability.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_decisionService from "../lib/decisionService.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_identityPolicy from "../lib/identityPolicy.js";
import type * as lib_publicIds from "../lib/publicIds.js";
import type * as lib_server from "../lib/server.js";
import type * as lib_tally from "../lib/tally.js";
import type * as lib_timezones from "../lib/timezones.js";
import type * as lib_types from "../lib/types.js";
import type * as lib_updatePolicy from "../lib/updatePolicy.js";
import type * as lib_validators from "../lib/validators.js";
import type * as maintenance from "../maintenance.js";
import type * as members from "../members.js";
import type * as results from "../results.js";
import type * as viewer from "../viewer.js";
import type * as workspace from "../workspace.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentApi: typeof agentApi;
  agentKeys: typeof agentKeys;
  applications: typeof applications;
  availability: typeof availability;
  ballots: typeof ballots;
  clubWorkspace: typeof clubWorkspace;
  crons: typeof crons;
  decisions: typeof decisions;
  http: typeof http;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/availability": typeof lib_availability;
  "lib/crypto": typeof lib_crypto;
  "lib/decisionService": typeof lib_decisionService;
  "lib/errors": typeof lib_errors;
  "lib/identityPolicy": typeof lib_identityPolicy;
  "lib/publicIds": typeof lib_publicIds;
  "lib/server": typeof lib_server;
  "lib/tally": typeof lib_tally;
  "lib/timezones": typeof lib_timezones;
  "lib/types": typeof lib_types;
  "lib/updatePolicy": typeof lib_updatePolicy;
  "lib/validators": typeof lib_validators;
  maintenance: typeof maintenance;
  members: typeof members;
  results: typeof results;
  viewer: typeof viewer;
  workspace: typeof workspace;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
