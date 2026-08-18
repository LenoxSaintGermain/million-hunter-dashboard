/**
 * Intraday tape structure — VWAP, opening range, and the trigger check.
 *
 * The tests that matter most are the ones asserting `unknown`: on the feed we
 * have today, "cannot be confirmed" is the correct answer far more often than
 * yes or no, and a system that collapses that into a boolean is lying about
 * what it knows.
 */
import { describe, it, expect } from "vitest";
import {
  sessionVwap, openingRange, checkVwapHold, describeTape, STALE_LAG_MS,
  type MinuteBar,
} from "./intraday";

const OPEN = Date.parse("2026-08-18T13:30:00Z"); // 09:30 ET
const MIN = 60_000;

/** A bar `n` minutes after the open. */
const bar = (n: number, over: Partial<MinuteBar> = {}): MinuteBar => ({
  t: OPEN + n * MIN,
  o: 100, h: 100.5, l: 99.5, c: 100, v: 1_000,
  ...over,
});

// ── Session VWAP ──────────────────────────────────────────────────────────────

describe("sessionVwap", () => {
  it("is the volume-weighted mean of the bars' own vw", () => {
    const v = sessionVwap(
      [bar(0, { vw: 100, v: 1_000 }), bar(1, { vw: 110, v: 3_000 })],
      { feed: "sip", now: OPEN + 2 * MIN },
    );
    // (100*1000 + 110*3000) / 4000 = 107.5
    expect(v.vwap).toBeCloseTo(107.5, 6);
    expect(v.cumulativeVolume).toBe(4_000);
    expect(v.priceBasis).toBe("provider_vw");
  });

  it("weights by volume, not by bar count", () => {
    const heavyLow = sessionVwap(
      [bar(0, { vw: 100, v: 100_000 }), bar(1, { vw: 200, v: 1_000 })],
      { feed: "sip", now: OPEN + 2 * MIN },
    );
    expect(heavyLow.vwap!).toBeLessThan(105);
  });

  it("falls back to the typical price when a bar carries no vw, and says so", () => {
    const v = sessionVwap([bar(0, { h: 102, l: 99, c: 100.5, vw: null })], { feed: "sip", now: OPEN + MIN });
    expect(v.vwap).toBeCloseTo((102 + 99 + 100.5) / 3, 6);
    expect(v.priceBasis).toBe("typical_price");
  });

  it("reports a mixed basis rather than implying every bar was priced the same way", () => {
    const v = sessionVwap([bar(0, { vw: 100 }), bar(1, { vw: null })], { feed: "sip", now: OPEN + 2 * MIN });
    expect(v.priceBasis).toBe("mixed");
  });

  it("skips zero-volume minutes instead of treating them as prints", () => {
    const withGap = sessionVwap(
      [bar(0, { vw: 100, v: 1_000 }), bar(1, { vw: 500, v: 0 })],
      { feed: "sip", now: OPEN + 2 * MIN },
    );
    expect(withGap.vwap).toBe(100);
    expect(withGap.barCount).toBe(1);
  });

  it("returns null with a reason when nothing traded — not zero", () => {
    const v = sessionVwap([bar(0, { v: 0 })], { feed: "sip", now: OPEN + MIN });
    expect(v.vwap).toBeNull();
    expect(v.unavailableReason).toContain("no trade printed");
  });

  it("returns null with a reason when no bars came back at all", () => {
    const v = sessionVwap([], { feed: "sip", now: OPEN });
    expect(v.vwap).toBeNull();
    expect(v.unavailableReason).toContain("no bars");
  });

  it("carries the feed and the measured lag on every result", () => {
    const v = sessionVwap([bar(0, { vw: 100 })], { feed: "iex", now: OPEN + 15 * MIN });
    expect(v.feed).toBe("iex");
    expect(v.asOf).toBe(OPEN);
    expect(v.lagMs).toBe(15 * MIN);
  });
});

// ── Opening range ─────────────────────────────────────────────────────────────

describe("openingRange", () => {
  const thirty = { sessionOpenAt: OPEN, minutes: 30, feed: "sip" as const };

  it("takes the high and low of the window", () => {
    const r = openingRange(
      [bar(0, { h: 101, l: 99 }), bar(1, { h: 103, l: 100 }), bar(2, { h: 102, l: 98 })],
      { ...thirty, now: OPEN + 40 * MIN },
    );
    expect(r.high).toBe(103);
    expect(r.low).toBe(98);
  });

  it("ignores bars outside the window", () => {
    const r = openingRange(
      [bar(0, { h: 101, l: 99 }), bar(45, { h: 200, l: 50 })],
      { ...thirty, now: OPEN + 60 * MIN },
    );
    expect(r.high).toBe(101);
    expect(r.low).toBe(99);
  });

  it("gives the width as a percentage — the 'opening range wider than 4%' skip", () => {
    const r = openingRange([bar(0, { h: 104, l: 100 })], { ...thirty, now: OPEN + 40 * MIN });
    expect(r.widthPct).toBeCloseTo(4, 6);
    expect(r.widthCents).toBe(400);
  });

  it("is NOT complete while the window is still filling", () => {
    const r = openingRange(
      [bar(0), bar(1), bar(2)],
      { ...thirty, now: OPEN + 3 * MIN },
    );
    expect(r.complete).toBe(false);
    expect(r.unavailableReason).toContain("still forming");
  });

  it("is complete once observed bars reach the end of the window", () => {
    const bars = Array.from({ length: 30 }, (_, i) => bar(i));
    const r = openingRange(bars, { ...thirty, now: OPEN + 31 * MIN });
    expect(r.complete).toBe(true);
    expect(r.unavailableReason).toBeNull();
  });

  it("is not complete on a delayed feed even after the wall clock passes the window", () => {
    // 10:15 ET wall clock, but a 15-minute-delayed tape has only shown us
    // through 10:00 — the 30-minute range is not knowable yet.
    const bars = Array.from({ length: 15 }, (_, i) => bar(i));
    const r = openingRange(bars, { ...thirty, now: OPEN + 45 * MIN });
    expect(r.complete).toBe(false);
    expect(r.lagMs).toBe(31 * MIN);
  });

  it("says the session has not opened rather than returning an empty range", () => {
    const r = openingRange([], { ...thirty, now: OPEN - 10 * MIN });
    expect(r.unavailableReason).toContain("not opened yet");
    expect(r.high).toBeNull();
  });
});

// ── VWAP hold ─────────────────────────────────────────────────────────────────

describe("checkVwapHold", () => {
  /** 20 bars closing above a VWAP of 100, on a live consolidated tape. */
  const above = Array.from({ length: 20 }, (_, i) => bar(i, { vw: 100, c: 101, v: 1_000 }));
  const liveNow = (bars: MinuteBar[]) => bars[bars.length - 1]!.t + 30_000;

  it("confirms a hold on a live consolidated tape", () => {
    const now = liveNow(above);
    const v = sessionVwap(above, { feed: "sip", now });
    const c = checkVwapHold(above, v, { side: "above", minutesRequired: 15, now });
    expect(c.state).toBe("confirmed");
    expect(c.minutesHeld).toBe(20);
    expect(c.needsOperatorConfirmation).toBe(false);
  });

  it("rejects when the hold is too short", () => {
    const bars = Array.from({ length: 20 }, (_, i) =>
      bar(i, { vw: 100, c: i < 17 ? 99 : 101, v: 1_000 }));
    const now = liveNow(bars);
    const v = sessionVwap(bars, { feed: "sip", now });
    const c = checkVwapHold(bars, v, { side: "above", minutesRequired: 15, now });
    expect(c.state).toBe("rejected");
    expect(c.minutesHeld).toBe(3);
  });

  it("counts only the CURRENT run, not the best run of the session", () => {
    // Ten minutes above, one dip, then three above. The answer is 3, not 13.
    const bars = [
      ...Array.from({ length: 10 }, (_, i) => bar(i, { vw: 100, c: 101 })),
      bar(10, { vw: 100, c: 98 }),
      ...Array.from({ length: 3 }, (_, i) => bar(11 + i, { vw: 100, c: 101 })),
    ];
    const now = liveNow(bars);
    const v = sessionVwap(bars, { feed: "sip", now });
    expect(checkVwapHold(bars, v, { side: "above", minutesRequired: 15, now }).minutesHeld).toBe(3);
  });

  it("answers UNKNOWN on a 15-minute-delayed tape, however good the setup looks", () => {
    const now = above[above.length - 1]!.t + 15 * MIN;
    const v = sessionVwap(above, { feed: "sip", now });
    const c = checkVwapHold(above, v, { side: "above", minutesRequired: 15, now });
    expect(c.state).toBe("unknown");
    expect(c.needsOperatorConfirmation).toBe(true);
    expect(c.basis).toContain("confirm on a real-time terminal");
    // The measurement it could make is still reported — it just does not decide.
    expect(c.minutesHeld).toBe(20);
  });

  it("answers UNKNOWN on the IEX feed even when it is real-time", () => {
    const now = liveNow(above);
    const v = sessionVwap(above, { feed: "iex", now });
    const c = checkVwapHold(above, v, { side: "above", minutesRequired: 15, now });
    expect(c.state).toBe("unknown");
    expect(c.basis).toContain("not the VWAP the market is trading against");
  });

  it("answers UNKNOWN when there is no VWAP at all — never rejected by default", () => {
    const v = sessionVwap([], { feed: "sip", now: OPEN });
    const c = checkVwapHold([], v, { side: "above", minutesRequired: 15, now: OPEN });
    expect(c.state).toBe("unknown");
    expect(c.needsOperatorConfirmation).toBe(true);
  });

  it("handles the short side symmetrically", () => {
    const below = Array.from({ length: 20 }, (_, i) => bar(i, { vw: 100, c: 99 }));
    const now = liveNow(below);
    const v = sessionVwap(below, { feed: "sip", now });
    expect(checkVwapHold(below, v, { side: "below", minutesRequired: 15, now }).state).toBe("confirmed");
    expect(checkVwapHold(below, v, { side: "above", minutesRequired: 15, now }).state).toBe("rejected");
  });

  it("treats anything past the staleness threshold as unconfirmable", () => {
    const now = above[above.length - 1]!.t + STALE_LAG_MS + 1;
    const v = sessionVwap(above, { feed: "sip", now });
    expect(checkVwapHold(above, v, { side: "above", minutesRequired: 15, now }).state).toBe("unknown");
  });
});

// ── The label ─────────────────────────────────────────────────────────────────

describe("describeTape", () => {
  it("names the feed and the measured lag", () => {
    const s = describeTape({ feed: "sip", asOf: OPEN, lagMs: 15 * MIN });
    expect(s).toContain("SIP consolidated");
    expect(s).toContain("15 min behind");
  });

  it("says plainly that IEX is a fraction of the tape", () => {
    expect(describeTape({ feed: "iex", asOf: OPEN, lagMs: 30_000 }))
      .toContain("fraction of consolidated volume");
  });

  it("does not invent a lag it cannot measure", () => {
    expect(describeTape({ feed: "sip", asOf: null, lagMs: null }))
      .toContain("no bar timestamp available");
  });
});
