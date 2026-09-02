/**
 * Market session — pure calendar logic, no broker call.
 *
 * Times are constructed as UTC instants and asserted in ET, so the tests also
 * cover the DST offset (EST −5 in January, EDT −4 in June).
 */
import { describe, it, expect } from "vitest";
import {
  marketSession, etClock, startOfEtDay, nextRegularSessionOpen, isHalfDay, isMarketHoliday, closeMinutesFor,
  CALENDAR_HORIZON,
} from "./marketSession";

const utc = (iso: string) => Date.parse(iso);

describe("etClock", () => {
  it("reads ET during standard time (UTC−5)", () => {
    const c = etClock(utc("2026-01-14T15:30:00Z"))!;
    expect(c.dateEt).toBe("2026-01-14");
    expect(c.etMinutes).toBe(10 * 60 + 30);
  });

  it("reads ET during daylight time (UTC−4)", () => {
    const c = etClock(utc("2026-06-10T15:30:00Z"))!;
    expect(c.dateEt).toBe("2026-06-10");
    expect(c.etMinutes).toBe(11 * 60 + 30);
  });

  it("rolls back to the previous ET date before UTC midnight", () => {
    const c = etClock(utc("2026-06-11T02:00:00Z"))!;
    expect(c.dateEt).toBe("2026-06-10");
    expect(c.etMinutes).toBe(22 * 60);
  });
});

describe("marketSession", () => {
  it("is regular at 10:30 ET on a normal Wednesday", () => {
    const s = marketSession(utc("2026-06-10T14:30:00Z"));
    expect(s.session).toBe("regular");
    expect(s.dateEt).toBe("2026-06-10");
  });

  it("is pre_market at 08:00 ET", () => {
    expect(marketSession(utc("2026-06-10T12:00:00Z")).session).toBe("pre_market");
  });

  it("is closed at 03:00 ET, before the pre-market opens", () => {
    expect(marketSession(utc("2026-06-10T07:00:00Z")).session).toBe("closed");
  });

  it("is after_hours at 17:00 ET", () => {
    expect(marketSession(utc("2026-06-10T21:00:00Z")).session).toBe("after_hours");
  });

  it("is closed at 20:30 ET, after the extended session", () => {
    expect(marketSession(utc("2026-06-11T00:30:00Z")).session).toBe("closed");
  });

  it("flips to regular exactly at 09:30 ET and closed-side at 16:00 ET", () => {
    expect(marketSession(utc("2026-06-10T13:29:00Z")).session).toBe("pre_market");
    expect(marketSession(utc("2026-06-10T13:30:00Z")).session).toBe("regular");
    expect(marketSession(utc("2026-06-10T19:59:00Z")).session).toBe("regular");
    expect(marketSession(utc("2026-06-10T20:00:00Z")).session).toBe("after_hours");
  });

  it("is closed on a Saturday", () => {
    const s = marketSession(utc("2026-06-13T14:30:00Z"));
    expect(s.session).toBe("closed");
    expect(s.basis).toContain("weekend");
  });

  it("is closed on a market holiday during regular hours", () => {
    const s = marketSession(utc("2026-11-26T15:00:00Z")); // Thanksgiving
    expect(s.session).toBe("closed");
    expect(s.basis).toContain("holiday");
  });

  it("closes at 13:00 ET on a half day", () => {
    const before = marketSession(utc("2026-11-27T17:30:00Z")); // 12:30 ET
    const after = marketSession(utc("2026-11-27T18:30:00Z")); // 13:30 ET
    expect(before.session).toBe("regular");
    expect(before.halfDay).toBe(true);
    expect(after.session).toBe("after_hours");
    expect(after.basis).toContain("early close");
  });

  it("returns unknown — not a guess — past the maintained calendar", () => {
    const s = marketSession(utc("2029-06-13T14:30:00Z"));
    expect(s.session).toBe("unknown");
    expect(s.basis).toContain("outside the maintained calendar");
  });

  it("returns unknown before the calendar starts", () => {
    expect(marketSession(utc("2025-06-10T14:30:00Z")).session).toBe("unknown");
    expect(CALENDAR_HORIZON.from).toBe("2026-01-01");
  });

  it("returns unknown for an unreadable clock rather than defaulting open", () => {
    expect(marketSession(NaN).session).toBe("unknown");
  });
});

describe("calendar helpers", () => {
  it("knows the 2027 observed holidays", () => {
    expect(isMarketHoliday("2027-07-05")).toBe(true); // Jul 4 falls Sunday
    expect(isMarketHoliday("2027-07-04")).toBe(false);
  });

  it("reports the half-day close as 13:00", () => {
    expect(closeMinutesFor("2026-12-24")).toBe(13 * 60);
    expect(closeMinutesFor("2026-12-23")).toBe(16 * 60);
    expect(isHalfDay("2026-12-24")).toBe(true);
  });
});

describe("startOfEtDay", () => {
  it("returns ET midnight for the instant's ET date", () => {
    const start = startOfEtDay(utc("2026-06-10T14:30:00Z"))!;
    const c = etClock(start)!;
    expect(c.dateEt).toBe("2026-06-10");
    expect(c.etMinutes).toBe(0);
  });

  it("uses the ET date, not the UTC date, late in the evening", () => {
    const start = startOfEtDay(utc("2026-06-11T02:00:00Z"))!;
    expect(etClock(start)!.dateEt).toBe("2026-06-10");
  });
});

describe("nextRegularSessionOpen", () => {
  it("returns today's open when called before the pre-market on a trading day", () => {
    const next = nextRegularSessionOpen(utc("2026-06-10T04:15:00Z"))!; // Wednesday 00:15 ET
    expect(etClock(next)).toMatchObject({ dateEt: "2026-06-10", etMinutes: 9 * 60 + 30 });
  });

  it("moves a Friday defer to Monday's 09:30 ET regular open", () => {
    const next = nextRegularSessionOpen(utc("2026-06-12T20:30:00Z"))!; // Friday 16:30 ET
    expect(etClock(next)).toMatchObject({ dateEt: "2026-06-15", etMinutes: 9 * 60 + 30 });
  });

  it("skips a market holiday when finding the next regular session", () => {
    const next = nextRegularSessionOpen(utc("2026-11-25T22:00:00Z"))!; // Eve of Thanksgiving
    expect(etClock(next)).toMatchObject({ dateEt: "2026-11-27", etMinutes: 9 * 60 + 30 });
  });
});
