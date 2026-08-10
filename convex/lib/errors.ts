import { ConvexError } from "convex/values";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "IDENTITY_NOT_APPROVED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "DECISION_CLOSED"
  | "POLL_CLOSED"
  | "RATE_LIMITED"
  | "IDEMPOTENCY_CONFLICT";

export function fail(code: ErrorCode, message: string): never {
  throw new ConvexError({ code, message });
}

export function assert(
  condition: unknown,
  code: ErrorCode,
  message: string,
): asserts condition {
  if (!condition) fail(code, message);
}
