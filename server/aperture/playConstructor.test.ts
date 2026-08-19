/**
 * The play constructor — every number, and every refusal to produce one.
 *
 * The sizing tests are the load-bearing ones: this is the component that turns
 * a stop distance into a share count, and a wrong share count is a real loss on
 * a real account the day this stops being paper.
 */
import { describe, it, expect } from "vitest";
import {
  constructPlay, ENTRY_BUFFER_BPS, MIN_SLIPPAGE_CENTS, TARGET_R_MULTIPLES,
  MAX_OPENING_RANGE_PCT, CONSTRUCTED_PLAY_DISCLOSURE,
  type ConstructPlayInput,
} from "./playConstructor";
import { sessionVwap, openingRange, checkVwapHold, type MinuteBar } from "./intraday";
import { CURRENT_MANDATE } from "./mandate";

const OPEN = Date.parse("2026-08-18T13:30:00Z"); // 09:30 ET
const MIN = 60_000;
const DAY_START = Date.parse("2026-08-18T04:00:00Z"); // ET midnight
const EQUITY = 10_000_000; // $100,000

const bar = (n: number, over: Partial<MinuteBar> = {}): MinuteBar => ({
  t: OPEN + n * MIN,
  o: 100, h: 100.5, l: 99.5, c: 100, v: 5_000, vw: 100,
  ...over,
});

/** A 30-minute opening range of 99.50–100.50 on a live consolidated tape. */
const session = (bars: MinuteBar[] = Array.from({ length: 35 }, (_, i) => bar(i))) => {
  const now = bars[bars.length - 1]!.t + 30_000;
  const vwap = sessionVwap(bars, { feed: "sip", now });
  const range = openingRange(bars, { sessionOpenAt: OPEN, minutes: 30, feed: "sip", now });
  return { bars, vwap, range, now };
};

const input = (over: Partial<ConstructPlayInput> = {}): ConstructPlayInput => {
  const s = session();
  return {
    symbol: "XHB",
    holdingPeriod: "intraday",
    bars: s.bars,
    vwap: s.vwap,
    range: s.range,
    equityCents: EQUITY,
    sessionDayStartMs: DAY_START,
    catalystDeadlineAt: OPEN + 6 * 3_600_000,
    advUsd: 500_000_000,
    now: s.now,
    ...over,
  };
};

// ── Levels ────────────────────────────────────────────────────────────────────

describe("levels", () => {
  it("puts the long entry a stated buffer above the opening-range high", () => {
    const play = constructPlay(input());
    // range high 100.50 → 10050c, buffer = 6bps of 10050 ≈ 6c
    expect(play.entry!.priceCents).toBe(10_056);
    expect(play.entry!.modeled).toBe(true);
    expect(play.entry!.basis).toContain("opening-range high");
  });

  it("mirrors the entry below the range low for a short", () => {
    const play = constructPlay(input({ side: "short" }));
    expect(play.entry!.priceCents).toBe(9_944);
    expect(play.entry!.basis).toContain("opening-range low");
  });

  it("takes the wider of VWAP and the range low as the long stop", () => {
    // VWAP is 100.00, range low 99.50 — the range low gives more room.
    const play = constructPlay(input());
    expect(play.stop!.priceCents).toBeLessThan(9_950);
    expect(play.stop!.basis).toContain("opening-range low");
  });

  it("uses VWAP when it is the wider protective level", () => {
    // Push VWAP below the range low by trading heavily at a lower price.
    const bars = [
      ...Array.from({ length: 30 }, (_, i) => bar(i)),
      bar(30, { h: 99.6, l: 99.5, c: 99.5, vw: 95, v: 900_000 }),
    ];
    const s = session(bars);
    const play = constructPlay(input({ bars: s.bars, vwap: s.vwap, range: s.range, now: s.now }));
    expect(play.stop!.basis).toContain("session VWAP");
  });

  it("names every level modeled, with the observation it came from", () => {
    const play = constructPlay(input());
    for (const level of [play.entry!, play.stop!, play.slippage!, ...play.targets]) {
      expect(level.modeled).toBe(true);
      expect(level.basis.length).toBeGreaterThan(10);
    }
  });

  it("projects targets as R multiples and says they are not forecasts", () => {
    const play = constructPlay(input());
    expect(play.targets.map((t) => t.rMultiple)).toEqual(TARGET_R_MULTIPLES);
    const risk = Math.abs(play.entry!.priceCents - play.stop!.priceCents) + play.slippage!.priceCents;
    expect(play.targets[0]!.priceCents).toBe(Math.round(play.entry!.priceCents + risk * 1.5));
    expect(play.targets[0]!.basis).toContain("not a price forecast");
  });

  it("models slippage from the observed bar range", () => {
    // Median bar range is 100c; 25% of that is 25c.
    expect(constructPlay(input()).slippage!.priceCents).toBe(25);
  });

  it("falls back to the slippage floor and says so when no range is measurable", () => {
    const bars = Array.from({ length: 35 }, (_, i) => bar(i, { h: 100, l: 100 }));
    const s = session(bars);
    const play = constructPlay(input({ bars: s.bars, vwap: s.vwap, range: s.range, now: s.now }));
    expect(play.slippage!.priceCents).toBe(MIN_SLIPPAGE_CENTS);
  });
});

// ── Sizing — the operator's own formula ───────────────────────────────────────

describe("sizing", () => {
  it("sizes from the planned-loss budget, capped by the notional ceiling", () => {
    const play = constructPlay(input());
    // budget = 0.75% of $100k = $750 = 75,000c
    expect(play.budgetCents).toBe(75_000);
    const risk = Math.abs(play.entry!.priceCents - play.stop!.priceCents) + play.slippage!.priceCents;
    const byBudget = Math.floor(75_000 / risk);
    const byCeiling = Math.floor(500_000 / play.entry!.priceCents); // 5% of equity
    // On a $100 name with a $1.12 risked distance the ORDER ceiling binds first,
    // not the loss budget — which is worth knowing: the two axes trade places
    // depending on price and stop width.
    expect(play.qty).toBe(Math.min(byBudget, byCeiling));
    expect(play.plannedLossCents).toBe(play.qty! * risk);
  });

  it("lets the loss budget bind once the stop is wide relative to price", () => {
    // Worth stating plainly, because it is not obvious: at $100k equity the 5%
    // single-order ceiling ($5,000) is tighter than the 0.75% loss budget ($750)
    // for any stop narrower than roughly 15% of price. The loss budget only
    // becomes the binding constraint on genuinely wide stops — which is the
    // correct behaviour, but it means the notional ceiling is what usually sizes
    // a play, and the planned-loss axis mostly binds on the DAILY and CORRELATED
    // totals rather than on a single order.
    const wide = Array.from({ length: 35 }, (_, i) =>
      bar(i, { o: 100, h: 100.5, l: 80, c: 100, vw: 100 }));
    const s = session(wide);
    const play = constructPlay(input({ bars: s.bars, vwap: s.vwap, range: s.range, now: s.now }));
    const risk = Math.abs(play.entry!.priceCents - play.stop!.priceCents) + play.slippage!.priceCents;
    expect(play.qty).toBe(Math.floor(75_000 / risk));
    expect(play.sizeLimitedByNotionalCeiling).toBe(false);
  });

  it("keeps the planned loss inside the per-play ceiling", () => {
    const play = constructPlay(input());
    expect(play.plannedLossPctOfEquity!).toBeLessThanOrEqual(CURRENT_MANDATE.maxPlannedRiskPctPerPlay);
  });

  it("shrinks the position when the stop is wider, rather than tightening the stop", () => {
    const wide = Array.from({ length: 35 }, (_, i) => bar(i, { h: 105, l: 95, c: 100 }));
    const s = session(wide);
    const play = constructPlay(input({ bars: s.bars, vwap: s.vwap, range: s.range, now: s.now }));
    expect(play.qty!).toBeLessThan(constructPlay(input()).qty!);
    expect(play.plannedLossPctOfEquity!).toBeLessThanOrEqual(CURRENT_MANDATE.maxPlannedRiskPctPerPlay);
  });

  it("refuses to round up to one share when the budget will not cover it", () => {
    // A $10 account cannot afford one share at any real stop distance.
    const play = constructPlay(input({ equityCents: 1_000 }));
    expect(play.qty).toBeNull();
    expect(play.readiness).toBe("budget_too_small");
    expect(play.unavailableReasons.join(" ")).toContain("will not buy one share");
  });

  it("lets the single-order notional ceiling bind before the loss budget, and says which bound", () => {
    // Tight stop on a high-priced name: the loss budget allows a big position,
    // the $10,000 order ceiling does not.
    const tight = Array.from({ length: 35 }, (_, i) => bar(i, { o: 1_000, h: 1_000.2, l: 999.9, c: 1_000, vw: 1_000 }));
    const s = session(tight);
    const play = constructPlay(input({ bars: s.bars, vwap: s.vwap, range: s.range, now: s.now }));
    expect(play.sizeLimitedByNotionalCeiling).toBe(true);
    expect(play.notionalCents!).toBeLessThanOrEqual(CURRENT_MANDATE.maxOrderNotionalCents);
    expect(play.assumptions.join(" ")).toContain("single-order notional ceiling");
  });

  it("computes no size at all when equity is unknown — never a default", () => {
    const play = constructPlay(input({ equityCents: null }));
    expect(play.qty).toBeNull();
    expect(play.budgetCents).toBeNull();
    expect(play.plannedLossCents).toBeNull();
    expect(play.readiness).toBe("needs_equity");
    expect(play.unavailableReasons.join(" ")).toContain("equity is unknown");
  });
});

// ── Refusals ──────────────────────────────────────────────────────────────────

describe("what it refuses to construct", () => {
  it("produces nothing from an empty tape", () => {
    const play = constructPlay(input({ bars: [] }));
    expect(play.readiness).toBe("needs_tape");
    expect(play.entry).toBeNull();
    expect(play.unavailableReasons.join(" ")).toContain("no minute bars");
  });

  it("produces no levels when the opening range could not be measured", () => {
    const s = session();
    const empty = openingRange([], { sessionOpenAt: OPEN, minutes: 30, feed: "sip", now: s.now });
    const play = constructPlay(input({ range: empty }));
    expect(play.readiness).toBe("needs_range");
    expect(play.entry).toBeNull();
  });

  it("still constructs on an incomplete range but says the range is forming", () => {
    const bars = Array.from({ length: 10 }, (_, i) => bar(i));
    const s = session(bars);
    const play = constructPlay(input({ bars: s.bars, vwap: s.vwap, range: s.range, now: s.now }));
    expect(play.entry).not.toBeNull();
    expect(play.unavailableReasons.join(" ")).toContain("still forming");
  });
});

// ── No-trade conditions ───────────────────────────────────────────────────────

describe("no-trade conditions", () => {
  it("always states the gap rule against the computed entry", () => {
    expect(constructPlay(input()).noTradeConditions[0]).toContain("beyond");
  });

  it("calls an over-wide opening range no setup", () => {
    const wide = Array.from({ length: 35 }, (_, i) => bar(i, { h: 110, l: 100, c: 105 }));
    const s = session(wide);
    const play = constructPlay(input({ bars: s.bars, vwap: s.vwap, range: s.range, now: s.now }));
    expect(play.noTradeConditions.join(" ")).toContain(`over the ${MAX_OPENING_RANGE_PCT}% limit`);
  });

  it("warns that a missing ADV fact will be refused by the liquidity gate", () => {
    expect(constructPlay(input({ advUsd: null })).noTradeConditions.join(" ")).toContain("liquidity gate will refuse");
  });

  it("warns when ADV is below the mandate floor", () => {
    expect(constructPlay(input({ advUsd: 1_000_000 })).noTradeConditions.join(" ")).toContain("below the");
  });

  it("carries an unconfirmed VWAP hold through as a do-not-enter", () => {
    // Price holds above VWAP for the full window, but the tape is 20 minutes
    // old — the hold cannot be confirmed, so the play must not invite entry.
    const holding = Array.from({ length: 35 }, (_, i) => bar(i, { c: 101, vw: 100 }));
    const staleNow = holding[holding.length - 1]!.t + 20 * MIN;
    const vwap = sessionVwap(holding, { feed: "sip", now: staleNow });
    const hold = checkVwapHold(holding, vwap, { side: "above", minutesRequired: 15, now: staleNow });
    expect(hold.state).toBe("unknown");
    const range = openingRange(holding, { sessionOpenAt: OPEN, minutes: 30, feed: "sip", now: staleNow });
    const play = constructPlay(input({ bars: holding, vwap, range, trigger: hold, now: staleNow }));
    expect(play.noTradeConditions.join(" ")).toContain("real-time terminal");
  });

  it("flags a price that has already left the plan behind", () => {
    const bars = [...Array.from({ length: 35 }, (_, i) => bar(i)), bar(35, { c: 120, h: 120, l: 119 })];
    const s = session(bars);
    const play = constructPlay(input({ bars: s.bars, vwap: s.vwap, range: s.range, now: s.now }));
    expect(play.noTradeConditions.join(" ")).toContain("left without this plan");
  });
});

// ── Time stop ─────────────────────────────────────────────────────────────────

describe("time stop", () => {
  it("sets an intraday review at 15:30 ET", () => {
    const play = constructPlay(input({ catalystDeadlineAt: null }));
    expect(play.timeStopAt).toBe(DAY_START + (15 * 60 + 30) * MIN);
    expect(play.assumptions.join(" ")).toContain("not an automatic exit");
  });

  it("uses the catalyst deadline when it comes first", () => {
    const early = DAY_START + 12 * 60 * MIN;
    expect(constructPlay(input({ catalystDeadlineAt: early })).timeStopAt).toBe(early);
  });

  it("says so when no review time could be set", () => {
    const play = constructPlay(input({ holdingPeriod: "swing", catalystDeadlineAt: null }));
    expect(play.timeStopAt).toBeNull();
    expect(play.unavailableReasons.join(" ")).toContain("no review time");
  });
});

// ── The honesty surface ───────────────────────────────────────────────────────

describe("honesty", () => {
  it("states the tape and its lag on every play", () => {
    expect(constructPlay(input()).tapeBasis).toContain("SIP consolidated");
  });

  it("lists its judgements as assumptions rather than burying them", () => {
    const play = constructPlay(input());
    expect(play.assumptions.join(" ")).toContain(`${ENTRY_BUFFER_BPS} bps`);
    expect(play.assumptions.join(" ")).toContain("slippage allowance");
    expect(play.assumptions.join(" ")).toContain("no source states a price objective");
  });

  it("carries a disclosure that says these are not instructions", () => {
    expect(CONSTRUCTED_PLAY_DISCLOSURE).toContain("not a recommendation");
    expect(CONSTRUCTED_PLAY_DISCLOSURE).toContain("creates no order");
  });
});
