import {
  httpRouter,
  makeFunctionReference,
  type GenericActionCtx,
} from "convex/server";
import { ConvexError, type GenericId } from "convex/values";
import { httpAction, type DataModel } from "./lib/server";
import type { AgentScope } from "./lib/types";
import {
  sha256Hex,
  stableJson,
  timingSafeSecretEqual,
  tokenPrefix,
  validGatewaySecret,
} from "./lib/crypto";
import {
  canonicalDecisionTimeZone,
  DEFAULT_DECISION_TIME_ZONE,
  MAX_DECISION_TIME_ZONE_LENGTH,
} from "./lib/timezones";

type Principal = {
  tokenId: GenericId<"agentKeys">;
  memberId: GenericId<"members">;
  scopes: AgentScope[];
  clientName: string;
  expiresAt?: number;
};

type DbPrincipal = Pick<Principal, "tokenId" | "memberId" | "scopes">;
type HttpCtx = GenericActionCtx<DataModel>;
type JsonRecord = Record<string, unknown>;

const authorizeReference = makeFunctionReference<
  "mutation",
  {
    prefix: string;
    secretHash: string;
    requiredScopes: AgentScope[];
    consumeRateLimit: boolean;
    requestId?: string;
  },
  Principal
>("agentKeys:authorizeInternal");

const createDraftReference = makeFunctionReference<"mutation", JsonRecord, unknown>(
  "agentApi:createDraftInternal",
);
const publishReference = makeFunctionReference<"mutation", JsonRecord, unknown>(
  "agentApi:publishInternal",
);
const closeReference = makeFunctionReference<"mutation", JsonRecord, unknown>(
  "agentApi:closeInternal",
);
const listReference = makeFunctionReference<"query", JsonRecord, unknown>(
  "agentApi:listInternal",
);
const getReference = makeFunctionReference<"query", JsonRecord, unknown>(
  "agentApi:getInternal",
);
const responseStatusReference = makeFunctionReference<"query", JsonRecord, unknown>(
  "agentApi:responseStatusInternal",
);
const aggregateResultsReference = makeFunctionReference<"query", JsonRecord, unknown>(
  "agentApi:aggregateResultsInternal",
);
const recordReadReference = makeFunctionReference<"mutation", JsonRecord, null>(
  "agentApi:recordReadInternal",
);

function responseHeaders(requestId: string): Headers {
  return new Headers({
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json; charset=utf-8",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-Request-Id": requestId,
  });
}

function json(
  requestId: string,
  body: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  const headers = responseHeaders(requestId);
  for (const [key, value] of Object.entries(extraHeaders ?? {})) {
    headers.set(key, value);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function safeRequestId(request: Request): string {
  const proposed = request.headers.get("x-request-id")?.trim() ?? "";
  return /^[A-Za-z0-9._:-]{8,100}$/.test(proposed)
    ? proposed
    : crypto.randomUUID();
}

function bearerToken(request: Request): string {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() ?? "";
  if (!token || token.length > 512) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "A valid agent token is required." });
  }
  return token;
}

async function requireGatewaySecret(request: Request): Promise<void> {
  const expected = process.env.DECISION_AGENT_GATEWAY_SECRET;
  if (!validGatewaySecret(expected)) {
    throw new ConvexError({
      code: "SERVICE_MISCONFIGURED",
      message: "Decision gateway authentication is not configured.",
    });
  }
  const provided = request.headers.get("x-ublda-gateway-secret");
  if (
    !validGatewaySecret(provided) ||
    !(await timingSafeSecretEqual(provided, expected))
  ) {
    throw new ConvexError({
      code: "GATEWAY_UNAUTHENTICATED",
      message: "Decision gateway authentication failed.",
    });
  }
}

function dbPrincipal(principal: Principal): DbPrincipal {
  return {
    tokenId: principal.tokenId,
    memberId: principal.memberId,
    scopes: principal.scopes,
  };
}

async function authorizeRequest(
  ctx: HttpCtx,
  request: Request,
  requestId: string,
  requiredScopes: AgentScope[],
  consumeRateLimit: boolean,
): Promise<Principal> {
  const token = bearerToken(request);
  const prefix = tokenPrefix(token);
  if (!prefix) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Invalid or revoked agent token." });
  }
  return await ctx.runMutation(authorizeReference, {
    prefix,
    secretHash: await sha256Hex(token),
    requiredScopes,
    consumeRateLimit,
    requestId,
  });
}

async function bodyRecord(request: Request): Promise<JsonRecord> {
  const announcedLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(announcedLength) && announcedLength > 65_536) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "Request body is too large." });
  }
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "Request body must be valid JSON." });
  }
  if (new TextEncoder().encode(raw).byteLength > 65_536) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "Request body is too large." });
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "Request body must be valid JSON." });
  }
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "Request body must be a JSON object." });
  }
  return value as JsonRecord;
}

function stringField(
  body: JsonRecord,
  key: string,
  options: { required?: boolean; max?: number } = {},
): string | undefined {
  const value = body[key];
  if (value === undefined || value === null || value === "") {
    if (options.required) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: `${key} is required.` });
    }
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: `${key} must be text.` });
  }
  const cleaned = value.trim();
  if (options.required && !cleaned) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: `${key} is required.` });
  }
  if (cleaned.length > (options.max ?? 12_000)) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: `${key} is too long.` });
  }
  return cleaned || undefined;
}

function decisionId(body: JsonRecord): GenericId<"decisions"> {
  const value = stringField(body, "decisionId", { required: true, max: 200 });
  return value as GenericId<"decisions">;
}

function idempotencyKey(request: Request, required: boolean): string | undefined {
  const value = request.headers.get("idempotency-key")?.trim();
  if (!value) {
    if (required) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Idempotency-Key is required." });
    }
    return undefined;
  }
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(value)) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "Idempotency-Key is invalid." });
  }
  return value;
}

function createDraftInput(body: JsonRecord): JsonRecord {
  const title = stringField(body, "title", { required: true, max: 180 })!;
  const overview = stringField(body, "overview", { required: true, max: 12_000 })!;
  const responseType = stringField(body, "responseType", { required: true, max: 40 });
  if (![
    "yes_no_other",
    "single_choice",
    "ranked_choice",
    "input_only",
  ].includes(responseType!)) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "responseType is invalid." });
  }

  let options: JsonRecord[] | undefined;
  if (body.options !== undefined) {
    if (!Array.isArray(body.options) || body.options.length > 25) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "options must be an array of 25 or fewer items." });
    }
    options = body.options.map((raw, index) => {
      if (!raw || Array.isArray(raw) || typeof raw !== "object") {
        throw new ConvexError({ code: "VALIDATION_ERROR", message: `Option ${index + 1} is invalid.` });
      }
      const option = raw as JsonRecord;
      return {
        label: stringField(option, "label", { required: true, max: 160 })!,
        description: stringField(option, "description", { max: 1_000 }),
        isOther: option.isOther === true,
      };
    });
  }

  let electorateMemberIds: GenericId<"members">[] | undefined;
  if (body.eligibleMemberIds !== undefined) {
    if (!Array.isArray(body.eligibleMemberIds) || body.eligibleMemberIds.length > 100) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "eligibleMemberIds is invalid." });
    }
    electorateMemberIds = body.eligibleMemberIds.map((memberId) => {
      if (typeof memberId !== "string" || !memberId.trim()) {
        throw new ConvexError({ code: "VALIDATION_ERROR", message: "eligibleMemberIds contains an invalid ID." });
      }
      return memberId.trim() as GenericId<"members">;
    });
  }

  let deadlineAt: number | undefined;
  const deadline = stringField(body, "deadline", { max: 80 });
  if (deadline) {
    if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(deadline)) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "deadline must include Z or an explicit UTC offset.",
      });
    }
    deadlineAt = Date.parse(deadline);
    if (Number.isNaN(deadlineAt)) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "deadline must be ISO 8601." });
    }
  }
  const minimumTurnout = body.minimumTurnout;
  if (
    minimumTurnout !== undefined &&
    (!Number.isInteger(minimumTurnout) || (minimumTurnout as number) < 1)
  ) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "minimumTurnout must be a positive whole number." });
  }
  const approvalThreshold = body.approvalThreshold;
  if (
    approvalThreshold !== undefined &&
    (typeof approvalThreshold !== "number" || approvalThreshold <= 0 || approvalThreshold > 1)
  ) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "approvalThreshold must be greater than 0 and no more than 1." });
  }
  const visibility = body.resultsVisibility ?? "after_response";
  const resultsVisibility = visibility === "after_response" ? "after_submit" : visibility;
  if (!["after_submit", "after_close", "admins_only"].includes(String(resultsVisibility))) {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "resultsVisibility is invalid." });
  }
  if (body.autoClose !== undefined && typeof body.autoClose !== "boolean") {
    throw new ConvexError({ code: "VALIDATION_ERROR", message: "autoClose must be true or false." });
  }
  const suppliedTimeZone = stringField(body, "timeZone", {
    required: body.timeZone !== undefined,
    max: MAX_DECISION_TIME_ZONE_LENGTH,
  });
  const timezone = canonicalDecisionTimeZone(
    suppliedTimeZone ?? DEFAULT_DECISION_TIME_ZONE,
  );
  if (!timezone) {
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message: "timeZone must be a canonical IANA identifier such as America/Detroit.",
    });
  }

  return {
    title,
    summary: overview.slice(0, 500),
    context: overview,
    contextItems: [],
    responseType,
    options,
    electorateMemberIds,
    deadlineAt,
    timezone,
    autoClose: body.autoClose === true,
    allowResponseEdits: true,
    minimumTurnout: minimumTurnout as number | undefined,
    outcomeRule: approvalThreshold === undefined ? "advisory" : "approval_threshold",
    approvalThresholdPercent:
      approvalThreshold === undefined ? undefined : approvalThreshold * 100,
    approvalOptionKey: approvalThreshold === undefined ? undefined : "yes",
    tieBreakRule: "manual",
    resultsVisibility,
    responsePrivacy: "admins_can_view_individual",
  };
}

function errorPayload(error: unknown): { code: string; message: string; status: number } {
  const data =
    error instanceof ConvexError && error.data && typeof error.data === "object"
      ? (error.data as { code?: unknown; message?: unknown })
      : null;
  const code = typeof data?.code === "string" ? data.code : "INTERNAL_ERROR";
  const message =
    typeof data?.message === "string"
      ? data.message
      : "The decision service could not complete that request.";
  const statusByCode: Record<string, number> = {
    UNAUTHENTICATED: 401,
    IDENTITY_NOT_APPROVED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    IDEMPOTENCY_CONFLICT: 409,
    VALIDATION_ERROR: 400,
    DECISION_CLOSED: 409,
    RATE_LIMITED: 429,
    GATEWAY_UNAUTHENTICATED: 401,
    SERVICE_MISCONFIGURED: 503,
  };
  return { code, message, status: statusByCode[code] ?? 500 };
}

function route(
  handler: (ctx: HttpCtx, request: Request, requestId: string) => Promise<unknown>,
) {
  return httpAction(async (ctx, request) => {
    const requestId = safeRequestId(request);
    try {
      // This shared server-to-server gate runs before body handling, PAT
      // hashing, prefix lookup, or any database access on every agent route.
      await requireGatewaySecret(request);
      return json(
        requestId,
        await handler(ctx as unknown as HttpCtx, request, requestId),
      );
    } catch (error) {
      const normalized = errorPayload(error);
      return json(
        requestId,
        { error: { code: normalized.code, message: normalized.message, requestId } },
        normalized.status,
        normalized.status === 429 ? { "Retry-After": "60" } : undefined,
      );
    }
  });
}

const http = httpRouter();

http.route({
  path: "/decision-agent/authorize",
  method: "POST",
  handler: route(async (ctx, request, requestId) => {
    await bodyRecord(request);
    const principal = await authorizeRequest(ctx, request, requestId, [], false);
    return { authorized: true, principal };
  }),
});

http.route({
  path: "/decision-agent/create-draft",
  method: "POST",
  handler: route(async (ctx, request, requestId) => {
    const body = await bodyRecord(request);
    const input = createDraftInput(body);
    const key = idempotencyKey(request, true);
    const principal = await authorizeRequest(
      ctx,
      request,
      requestId,
      ["decisions:write"],
      true,
    );
    return await ctx.runMutation(createDraftReference, {
      principal: dbPrincipal(principal),
      input,
      idempotencyKey: key,
      requestHash: await sha256Hex(stableJson(input)),
      requestId,
    });
  }),
});

http.route({
  path: "/decision-agent/publish",
  method: "POST",
  handler: route(async (ctx, request, requestId) => {
    const body = await bodyRecord(request);
    const id = decisionId(body);
    const key = idempotencyKey(request, true);
    const principal = await authorizeRequest(
      ctx,
      request,
      requestId,
      ["decisions:publish"],
      true,
    );
    const hashInput = { decisionId: id };
    return await ctx.runMutation(publishReference, {
      principal: dbPrincipal(principal),
      decisionId: id,
      idempotencyKey: key,
      requestHash: await sha256Hex(stableJson(hashInput)),
      requestId,
    });
  }),
});

http.route({
  path: "/decision-agent/list",
  method: "POST",
  handler: route(async (ctx, request, requestId) => {
    const body = await bodyRecord(request);
    const status = stringField(body, "status", { max: 20 });
    if (status && !["draft", "open", "closed", "finalized"].includes(status)) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "status is invalid." });
    }
    const rawLimit = body.limit ?? 25;
    if (!Number.isInteger(rawLimit) || (rawLimit as number) < 1 || (rawLimit as number) > 100) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "limit must be a whole number from 1 to 100." });
    }
    const cursor = stringField(body, "cursor", { max: 500 });
    const principal = await authorizeRequest(
      ctx,
      request,
      requestId,
      ["decisions:read"],
      true,
    );
    const result = await ctx.runQuery(listReference, {
      principal: dbPrincipal(principal),
      status,
      limit: rawLimit as number,
      cursor,
    });
    await ctx.runMutation(recordReadReference, {
      principal: dbPrincipal(principal),
      operation: "list",
      entityId: "workspace",
      requestId,
      requiredScope: "decisions:read",
    });
    return result;
  }),
});

http.route({
  path: "/decision-agent/get",
  method: "POST",
  handler: route(async (ctx, request, requestId) => {
    const body = await bodyRecord(request);
    const id = decisionId(body);
    const principal = await authorizeRequest(
      ctx,
      request,
      requestId,
      ["decisions:read"],
      true,
    );
    const result = await ctx.runQuery(getReference, {
      principal: dbPrincipal(principal),
      decisionId: id,
    });
    await ctx.runMutation(recordReadReference, {
      principal: dbPrincipal(principal),
      operation: "get",
      entityId: id,
      requestId,
      requiredScope: "decisions:read",
    });
    return result;
  }),
});

http.route({
  path: "/decision-agent/response-status",
  method: "POST",
  handler: route(async (ctx, request, requestId) => {
    const body = await bodyRecord(request);
    const id = decisionId(body);
    const principal = await authorizeRequest(
      ctx,
      request,
      requestId,
      ["decisions:manage"],
      true,
    );
    const result = await ctx.runQuery(responseStatusReference, {
      principal: dbPrincipal(principal),
      decisionId: id,
    });
    await ctx.runMutation(recordReadReference, {
      principal: dbPrincipal(principal),
      operation: "response_status",
      entityId: id,
      requestId,
      requiredScope: "decisions:manage",
    });
    return result;
  }),
});

http.route({
  path: "/decision-agent/aggregate-results",
  method: "POST",
  handler: route(async (ctx, request, requestId) => {
    const body = await bodyRecord(request);
    const id = decisionId(body);
    const principal = await authorizeRequest(
      ctx,
      request,
      requestId,
      ["results:read"],
      true,
    );
    const result = await ctx.runQuery(aggregateResultsReference, {
      principal: dbPrincipal(principal),
      decisionId: id,
    });
    await ctx.runMutation(recordReadReference, {
      principal: dbPrincipal(principal),
      operation: "aggregate_results",
      entityId: id,
      requestId,
      requiredScope: "results:read",
    });
    return result;
  }),
});

http.route({
  path: "/decision-agent/close",
  method: "POST",
  handler: route(async (ctx, request, requestId) => {
    const body = await bodyRecord(request);
    const id = decisionId(body);
    const note = stringField(body, "note", { max: 2_000 });
    const key = idempotencyKey(request, false);
    const principal = await authorizeRequest(
      ctx,
      request,
      requestId,
      ["decisions:manage"],
      true,
    );
    const hashInput = { decisionId: id, note };
    return await ctx.runMutation(closeReference, {
      principal: dbPrincipal(principal),
      decisionId: id,
      reason: note,
      idempotencyKey: key,
      requestHash: await sha256Hex(stableJson(hashInput)),
      requestId,
    });
  }),
});

export default http;
