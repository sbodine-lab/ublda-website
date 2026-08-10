export const AVAILABILITY_SLOT_MINUTES = 15;

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
