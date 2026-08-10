export const DEFAULT_DECISION_TIME_ZONE = "America/Detroit";
export const MAX_DECISION_TIME_ZONE_LENGTH = 80;

/**
 * Normalize and validate a canonical IANA time-zone identifier.
 *
 * Intl accepts a number of legacy aliases and case variants. Requiring the
 * resolved identifier to exactly match the trimmed input ensures persisted
 * values are canonical and safe to pass back into browser Intl APIs.
 */
export function canonicalDecisionTimeZone(
  input: string | undefined,
): string | null {
  const candidate = (input ?? DEFAULT_DECISION_TIME_ZONE).trim();
  if (!candidate || candidate.length > MAX_DECISION_TIME_ZONE_LENGTH) {
    return null;
  }
  try {
    const resolved = new Intl.DateTimeFormat("en-US", {
      timeZone: candidate,
    }).resolvedOptions().timeZone;
    return resolved === candidate ? candidate : null;
  } catch {
    return null;
  }
}
