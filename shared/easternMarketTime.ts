const EASTERN_TIME_ZONE = "America/New_York";

type EtParts = { year: number; month: number; day: number; hour: number; minute: number };

function etPartsAt(epochMs: number): EtParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(epochMs));
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  return { year: read("year"), month: read("month"), day: read("day"), hour: read("hour"), minute: read("minute") };
}

function pad(value: number) { return value.toString().padStart(2, "0"); }

export function easternDateKeyFromEpoch(epochMs: number): string {
  const part = etPartsAt(epochMs);
  return `${part.year}-${pad(part.month)}-${pad(part.day)}`;
}

export function easternDateTimeInputFromEpoch(epochMs: number): string {
  const part = etPartsAt(epochMs);
  return `${part.year}-${pad(part.month)}-${pad(part.day)}T${pad(part.hour)}:${pad(part.minute)}`;
}

/**
 * Converts a datetime-local string that the Capital UI explicitly labels as ET
 * into its absolute UTC epoch. It never delegates to Date.parse(), because that
 * would silently treat the value as the browser host timezone.
 */
export function easternDateTimeInputToEpoch(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw] = match;
  const target = {
    year: Number(yearRaw), month: Number(monthRaw), day: Number(dayRaw), hour: Number(hourRaw), minute: Number(minuteRaw),
  };
  if (target.month < 1 || target.month > 12 || target.day < 1 || target.day > 31 || target.hour > 23 || target.minute > 59) return null;
  const targetAsUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute);
  let candidate = targetAsUtc;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const observed = etPartsAt(candidate);
    const observedAsUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute);
    const delta = targetAsUtc - observedAsUtc;
    if (delta === 0) return candidate;
    candidate += delta;
  }
  // A non-existent local time during the DST spring-forward transition cannot
  // be represented honestly, so force the operator to choose another instant.
  const final = etPartsAt(candidate);
  return final.year === target.year && final.month === target.month && final.day === target.day && final.hour === target.hour && final.minute === target.minute
    ? candidate
    : null;
}

export function addDaysToEasternDate(dateInput: string, days: number): string {
  const [date] = dateInput.split("T");
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
