/**
 * US equity market session — a PURE function, no network, no broker call.
 *
 * Alpaca has a /clock endpoint, but order creation is not the place for a network
 * round trip, and a gate that can fail because an API was slow is not a gate.
 * So the session is computed from a maintained calendar and recorded on the order
 * along with HOW it was determined — `sessionBasis` — rather than asserted.
 *
 * The honesty contract applies to time the same way it applies to money: past the
 * calendar's horizon this returns "unknown", and an unknown session fails the gate
 * closed. It does not guess that a date is probably a trading day.
 *
 * MAINTENANCE: extend HOLIDAYS / HALF_DAYS and CALENDAR_HORIZON each year. When
 * the horizon lapses, every order is blocked with a legible reason — deliberately
 * loud, because the alternative is silently trading on an assumed calendar.
 */

export type MarketSession = "regular" | "pre_market" | "after_hours" | "closed" | "unknown";

export interface SessionState {
  session: MarketSession;
  /** How the session was determined — stored alongside it, never inferred later. */
  basis: string;
  /** YYYY-MM-DD in America/New_York, or null when the clock could not be read. */
  dateEt: string | null;
  /** Minutes past ET midnight, or null. */
  etMinutes: number | null;
  /** True on an early-close day (13:00 ET). */
  halfDay: boolean;
}

/** Full closures. Source: NYSE/Nasdaq published holiday calendars. */
const HOLIDAYS = new Set<string>([
  // 2026
  "2026-01-01", // New Year's Day
  "2026-01-19", // MLK Jr. Day
  "2026-02-16", // Washington's Birthday
  "2026-04-03", // Good Friday
  "2026-05-25", // Memorial Day
  "2026-06-19", // Juneteenth
  "2026-07-03", // Independence Day (observed — Jul 4 falls Saturday)
  "2026-09-07", // Labor Day
  "2026-11-26", // Thanksgiving
  "2026-12-25", // Christmas
  // 2027
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-03-26", // Good Friday
  "2027-05-31",
  "2027-06-18", // Juneteenth (observed — Jun 19 falls Saturday)
  "2027-07-05", // Independence Day (observed — Jul 4 falls Sunday)
  "2027-09-06",
  "2027-11-25",
  "2027-12-24", // Christmas (observed — Dec 25 falls Saturday)
]);

/** 13:00 ET close. */
const HALF_DAYS = new Set<string>([
  "2026-11-27", // day after Thanksgiving
  "2026-12-24", // Christmas Eve
  "2027-11-26", // day after Thanksgiving
]);

/** Inclusive bounds of the maintained calendar. */
export const CALENDAR_HORIZON = { from: "2026-01-01", to: "2027-12-31" };
export const CALENDAR_BASIS = `maintained US equity calendar ${CALENDAR_HORIZON.from}..${CALENDAR_HORIZON.to}`;

// Exported so anything computing session boundaries (the cockpit rail's
// countdown, for one) reads the same numbers this file decides on, rather than
// mirroring them and drifting.
export const PRE_MARKET_OPEN = 4 * 60; // 04:00 ET
export const REGULAR_OPEN = 9 * 60 + 30; // 09:30 ET
export const FULL_CLOSE = 16 * 60; // 16:00 ET
export const HALF_CLOSE = 13 * 60; // 13:00 ET
export const EXTENDED_MINUTES_AFTER_CLOSE = 4 * 60; // after-hours runs 4h past the close

const FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

interface EtClock {
  dateEt: string;
  etMinutes: number;
  weekday: string;
}

/** Reads the ET wall clock for an epoch-ms instant. Exported for tests. */
export function etClock(nowMs: number): EtClock | null {
  if (!Number.isFinite(nowMs)) return null;
  const parts = FMT.formatToParts(new Date(nowMs));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const year = get("year"), month = get("month"), day = get("day");
  const hour = Number(get("hour")), minute = Number(get("minute"));
  if (!year || !month || !day || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return {
    dateEt: `${year}-${month}-${day}`,
    // hourCycle h23 gives 00..23; a stray 24 (midnight in some ICU builds) folds to 0.
    etMinutes: (hour % 24) * 60 + minute,
    weekday: get("weekday"),
  };
}

export function isHalfDay(dateEt: string): boolean {
  return HALF_DAYS.has(dateEt);
}

export function isMarketHoliday(dateEt: string): boolean {
  return HOLIDAYS.has(dateEt);
}

/** The regular-session close for a date, in minutes past ET midnight. */
export function closeMinutesFor(dateEt: string): number {
  return isHalfDay(dateEt) ? HALF_CLOSE : FULL_CLOSE;
}

export function marketSession(nowMs: number): SessionState {
  const clock = etClock(nowMs);
  if (!clock) {
    return { session: "unknown", basis: "clock unreadable", dateEt: null, etMinutes: null, halfDay: false };
  }
  const { dateEt, etMinutes, weekday } = clock;

  if (dateEt < CALENDAR_HORIZON.from || dateEt > CALENDAR_HORIZON.to) {
    return {
      session: "unknown",
      basis: `${dateEt} is outside the maintained calendar (${CALENDAR_HORIZON.from}..${CALENDAR_HORIZON.to}) — extend server/aperture/marketSession.ts`,
      dateEt,
      etMinutes,
      halfDay: false,
    };
  }

  const halfDay = isHalfDay(dateEt);

  if (weekday === "Sat" || weekday === "Sun") {
    return { session: "closed", basis: `${CALENDAR_BASIS} — weekend`, dateEt, etMinutes, halfDay: false };
  }
  if (isMarketHoliday(dateEt)) {
    return { session: "closed", basis: `${CALENDAR_BASIS} — market holiday`, dateEt, etMinutes, halfDay: false };
  }

  const close = halfDay ? HALF_CLOSE : FULL_CLOSE;
  const basis = `${CALENDAR_BASIS}${halfDay ? " — early close 13:00 ET" : ""}`;

  let session: MarketSession;
  if (etMinutes < PRE_MARKET_OPEN) session = "closed";
  else if (etMinutes < REGULAR_OPEN) session = "pre_market";
  else if (etMinutes < close) session = "regular";
  else if (etMinutes < close + EXTENDED_MINUTES_AFTER_CLOSE) session = "after_hours";
  else session = "closed";

  return { session, basis, dateEt, etMinutes, halfDay };
}

/** Epoch ms of ET midnight for the day containing `nowMs`. Used for daily ceilings. */
export function startOfEtDay(nowMs: number): number | null {
  const clock = etClock(nowMs);
  if (!clock) return null;
  return nowMs - clock.etMinutes * 60_000 - (nowMs % 60_000);
}
