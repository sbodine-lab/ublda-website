export const AVAILABILITY_SLOT_MINUTES = 15;
/** Shortest event a poll can schedule: one slot. */
export const MIN_AVAILABILITY_DURATION_MINUTES = AVAILABILITY_SLOT_MINUTES;
/** Longest event a poll can schedule. Socials run 1–3 hours; 12 hours leaves
    room for a retreat or a full-day workshop without letting a typo through. */
export const MAX_AVAILABILITY_DURATION_MINUTES = 12 * 60;
/** A poll window may span a whole day. */
export const MAX_AVAILABILITY_WINDOW_MINUTES = 24 * 60;

export interface AvailabilityShape {
  dateKeys: string[];
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  slotMinutes?: number;
}

export interface AvailabilityResponseShape {
  memberId: string;
  availableSlotKeys: string[];
}

export interface AvailabilityCandidate {
  dateKey: string;
  startMinutes: number;
  endMinutes: number;
  availableCount: number;
  availableMemberIds: string[];
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function validDateKey(value: string): boolean {
  if (!DATE_KEY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Returns a human-readable problem with the poll's time shape, or null when the
 * shape is valid. Shared by the mutation and the tests so the rules live once.
 */
export function availabilityTimeShapeError(input: {
  durationMinutes: number;
  startMinutes: number;
  endMinutes: number;
}): string | null {
  const { durationMinutes, startMinutes, endMinutes } = input;
  const slot = AVAILABILITY_SLOT_MINUTES;
  if (
    !Number.isInteger(durationMinutes)
    || durationMinutes < MIN_AVAILABILITY_DURATION_MINUTES
    || durationMinutes > MAX_AVAILABILITY_DURATION_MINUTES
    || durationMinutes % slot !== 0
  ) {
    return `Event length must be between ${MIN_AVAILABILITY_DURATION_MINUTES} minutes and ${MAX_AVAILABILITY_DURATION_MINUTES / 60} hours, in ${slot}-minute steps.`;
  }
  if (
    !Number.isInteger(startMinutes)
    || !Number.isInteger(endMinutes)
    || startMinutes < 0
    || endMinutes > 24 * 60
    || startMinutes % slot !== 0
    || endMinutes % slot !== 0
  ) {
    return `Start and end times must be on ${slot}-minute marks.`;
  }
  if (endMinutes <= startMinutes) {
    return "The latest time must be after the earliest time.";
  }
  if (endMinutes - startMinutes > MAX_AVAILABILITY_WINDOW_MINUTES) {
    return `The time window can be at most ${MAX_AVAILABILITY_WINDOW_MINUTES / 60} hours.`;
  }
  if (endMinutes - startMinutes < durationMinutes) {
    return "The time window must be at least as long as the event.";
  }
  return null;
}

/** Number of slot cells a poll exposes across all of its dates. */
export function availabilitySlotCapacity(shape: AvailabilityShape): number {
  const slotMinutes = shape.slotMinutes ?? AVAILABILITY_SLOT_MINUTES;
  const perDay = Math.max(0, Math.ceil((shape.endMinutes - shape.startMinutes) / slotMinutes));
  return shape.dateKeys.length * perDay;
}

export function slotKey(dateKey: string, minutes: number): string {
  return `${dateKey}@${minutes}`;
}

export function parseSlotKey(value: string): { dateKey: string; minutes: number } | null {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})@(\d{1,4})$/);
  if (!match || !validDateKey(match[1])) return null;
  const minutes = Number(match[2]);
  if (!Number.isInteger(minutes)) return null;
  return { dateKey: match[1], minutes };
}

export function normalizeAvailabilitySlots(
  shape: AvailabilityShape,
  values: string[],
): string[] {
  const slotMinutes = shape.slotMinutes ?? AVAILABILITY_SLOT_MINUTES;
  const dates = new Set(shape.dateKeys);
  const normalized = new Set<string>();
  for (const value of values) {
    const parsed = parseSlotKey(value);
    if (
      !parsed
      || !dates.has(parsed.dateKey)
      || parsed.minutes < shape.startMinutes
      || parsed.minutes >= shape.endMinutes
      || parsed.minutes % slotMinutes !== 0
    ) continue;
    normalized.add(slotKey(parsed.dateKey, parsed.minutes));
  }
  return [...normalized].sort((a, b) => {
    const [dateA, minuteA] = a.split("@");
    const [dateB, minuteB] = b.split("@");
    return dateA.localeCompare(dateB) || Number(minuteA) - Number(minuteB);
  });
}

export function availabilityResults(
  shape: AvailabilityShape,
  responses: AvailabilityResponseShape[],
): {
  responseCount: number;
  cellCounts: Record<string, number>;
  candidates: AvailabilityCandidate[];
} {
  const slotMinutes = shape.slotMinutes ?? AVAILABILITY_SLOT_MINUTES;
  const normalizedResponses = responses.map((response) => ({
    memberId: response.memberId,
    slots: new Set(normalizeAvailabilitySlots(shape, response.availableSlotKeys)),
  }));
  const cellCounts: Record<string, number> = {};
  for (const dateKey of shape.dateKeys) {
    for (let minute = shape.startMinutes; minute < shape.endMinutes; minute += slotMinutes) {
      const key = slotKey(dateKey, minute);
      cellCounts[key] = normalizedResponses.filter((response) => response.slots.has(key)).length;
    }
  }

  const candidates: AvailabilityCandidate[] = [];
  for (const dateKey of shape.dateKeys) {
    for (
      let startMinutes = shape.startMinutes;
      startMinutes + shape.durationMinutes <= shape.endMinutes;
      startMinutes += slotMinutes
    ) {
      const required: string[] = [];
      for (
        let minute = startMinutes;
        minute < startMinutes + shape.durationMinutes;
        minute += slotMinutes
      ) {
        required.push(slotKey(dateKey, minute));
      }
      const availableMemberIds = normalizedResponses
        .filter((response) => required.every((key) => response.slots.has(key)))
        .map((response) => response.memberId);
      candidates.push({
        dateKey,
        startMinutes,
        endMinutes: startMinutes + shape.durationMinutes,
        availableCount: availableMemberIds.length,
        availableMemberIds,
      });
    }
  }
  candidates.sort((a, b) =>
    b.availableCount - a.availableCount
    || a.dateKey.localeCompare(b.dateKey)
    || a.startMinutes - b.startMinutes,
  );
  return { responseCount: responses.length, cellCounts, candidates };
}
