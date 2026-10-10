import { describe, expect, it } from "vitest";
import {
  computeHeadline, computePlanOutcomes, findSeriesGaps, startOfEtWeek, summarizeClosedPlays, totalUnrealizedCents, walkFilledOrders,
  type PerfOrder, type PerfPosition,
} from "./accountPerformance";

let id = 0;
const order = (o: Partial<PerfOrder> & Pick<PerfOrder, "symbol" | "side">): PerfOrder => ({
  id: ++id, filledQty: 1, filledAvgPriceCents: 100, entryPriceCents: null, stopPriceCents: null, plannedRiskCents: null,
  multiplier: 1, thesisName: null, filledAt: 1_000 + id, ...o,
});
const RATE = "Rate-cut beneficiaries";
const GRID = "Grid equipment backlog";

// The five closed plays and three open plays from the approved mockup, in cents.
function mockupOrders(): PerfOrder[] {
  const round = (symbol: string, thesis: string, qty: number, entry: number, stop: number, planned: number, exit: number) => [
    order({ symbol, side: "buy", filledQty: qty, filledAvgPriceCents: entry, entryPriceCents: entry, stopPriceCents: stop, plannedRiskCents: planned, thesisName: thesis }),
    order({ symbol, side: "sell", filledQty: qty, filledAvgPriceCents: exit, thesisName: thesis }),
  ];
  return [
    ...round("D", RATE, 40, 10_000, 9_800, 8_000, 10_410),     // +164, 2.05R
    ...round("E", RATE, 50, 10_000, 9_800, 10_000, 9_800),     // -100, -1.0R
    ...round("F", GRID, 30, 10_000, 9_800, 6_000, 10_700),     // +210, 3.5R
    ...round("G", GRID, 25, 10_000, 9_700, 7_500, 9_672),      // -82 (filled past the stop), -1.09R
    ...round("H", RATE, 25, 10_000, 9_800, 5_000, 10_748),     // +187, 3.74R
  ];
}

describe("closed plays", () => {
  const walk = walkFilledOrders(mockupOrders());
  const stats = summarizeClosedPlays(walk.closedPlays);

  it("matches the mockup headline numbers", () => {
    expect(stats.closed).toBe(5);
    expect(stats.wins).toBe(3);
    expect(stats.winRate).toBeCloseTo(0.6);
    expect(stats.avgWinCents).toBe(18_700);
    expect(stats.avgLossCents).toBe(9_100);
    expect(stats.avgR).toBeCloseTo(1.44, 2);
    expect(stats.best?.symbol).toBe("F");
    expect(stats.worst?.symbol).toBe("E");
    expect(walk.realizedCents).toBe(16_400 - 10_000 + 21_000 - 8_200 + 18_700);
  });

  it("splits by thesis", () => {
    const rate = stats.byThesis.find((t) => t.thesis === RATE)!;
    const grid = stats.byThesis.find((t) => t.thesis === GRID)!;
    expect([rate.plays, rate.pnlCents, rate.wins]).toEqual([3, 25_100, 2]);
    expect([grid.plays, grid.pnlCents, grid.wins]).toEqual([2, 12_800, 1]);
    expect(rate.avgR).toBeCloseTo(1.6, 1);
    expect(grid.avgR).toBeCloseTo(1.2, 1);
  });

  it("says too few plays to tell skill from luck", () => {
    expect(stats.sample).toBe("process_only");
  });

  it("gives no R when no planned loss was recorded", () => {
    const w = walkFilledOrders([
      order({ symbol: "X", side: "buy", filledQty: 10, filledAvgPriceCents: 100 }),
      order({ symbol: "X", side: "sell", filledQty: 10, filledAvgPriceCents: 120 }),
    ]);
    expect(w.closedPlays[0]).toMatchObject({ resultCents: 200, r: null, thesis: "No thesis recorded" });
  });

  it("uses average cost across two buys and keeps a partial sell open", () => {
    const w = walkFilledOrders([
      order({ symbol: "Y", side: "buy", filledQty: 10, filledAvgPriceCents: 100, stopPriceCents: 90, entryPriceCents: 100, plannedRiskCents: 100 }),
      order({ symbol: "Y", side: "buy", filledQty: 10, filledAvgPriceCents: 120, stopPriceCents: 95, entryPriceCents: 120, plannedRiskCents: 250 }),
      order({ symbol: "Y", side: "sell", filledQty: 10, filledAvgPriceCents: 130 }),
    ]);
    expect(w.realizedCents).toBe(200); // (130 - 110) * 10
    expect(w.closedPlays).toHaveLength(0);
    expect(w.openContexts.get("Y")).toMatchObject({ entryCents: 110, stopCents: 95, plannedLossCents: 350 });
  });

  it("flags sells with no known buy instead of inventing a cost", () => {
    const w = walkFilledOrders([order({ symbol: "Z", side: "sell", filledQty: 5, filledAvgPriceCents: 100 })]);
    expect(w.unattributedSells).toBe(1);
    expect(w.realizedCents).toBe(0);
  });

  it("starts a fresh play after a flat close", () => {
    const w = walkFilledOrders([
      order({ symbol: "R", side: "buy", filledQty: 1, filledAvgPriceCents: 100 }),
      order({ symbol: "R", side: "sell", filledQty: 1, filledAvgPriceCents: 110 }),
      order({ symbol: "R", side: "buy", filledQty: 1, filledAvgPriceCents: 100, thesisName: GRID }),
    ]);
    expect(w.closedPlays).toHaveLength(1);
    expect(w.openContexts.get("R")?.thesis).toBe(GRID);
  });
});

describe("plan outcomes", () => {
  const open = (symbol: string, qty: number, entry: number, stop: number, planned: number, thesis: string) => [
    order({ symbol, side: "buy", filledQty: qty, filledAvgPriceCents: entry, entryPriceCents: entry, stopPriceCents: stop, plannedRiskCents: planned, thesisName: thesis }),
  ];
  const contexts = walkFilledOrders([
    ...open("A", 40, 5_000, 4_800, 8_000, RATE),
    ...open("B", 25, 12_000, 11_600, 10_000, GRID),
    ...open("C", 60, 3_000, 2_900, 6_000, RATE),
  ]).openContexts;
  const pos = (symbol: string, qty: number, avg: number, last: number): PerfPosition => ({ symbol, qty, multiplier: 1, avgCostCents: avg, lastPriceCents: last, marketValueCents: qty * last });
  const holdings = [pos("A", 40, 5_000, 5_140), pos("B", 25, 12_000, 12_480), pos("C", 60, 3_000, 3_095), { symbol: "J", qty: 10, multiplier: 1, avgCostCents: 4_000, lastPriceCents: 4_000, marketValueCents: 40_000 }];
  const outcomes = computePlanOutcomes(holdings, contexts);

  it("reproduces the mockup per-play rows (target is 2.5x the risked distance)", () => {
    const a = outcomes.plays.find((p) => p.symbol === "A")!;
    expect(a).toMatchObject({ targetCents: 5_500, unrealizedCents: 5_600, atStopFromHereCents: -13_600, atTargetFromHereCents: 14_400, plannedLossCents: 8_000 });
    expect(a.rNow).toBeCloseTo(0.7, 2);
    const b = outcomes.plays.find((p) => p.symbol === "B")!;
    expect([b.atStopFromHereCents, b.atTargetFromHereCents]).toEqual([-22_000, 13_000]);
    const c = outcomes.plays.find((p) => p.symbol === "C")!;
    expect([c.atStopFromHereCents, c.atTargetFromHereCents]).toEqual([-11_700, 9_300]);
  });

  it("sums the account totals over counted plays and names the one left out", () => {
    expect(outcomes.countedCount).toBe(3);
    expect(outcomes.atStopFromHereCents).toBe(-47_300);
    expect(outcomes.atTargetFromHereCents).toBe(36_700);
    expect(outcomes.plannedLossCents).toBe(24_000);
    expect(outcomes.unrealizedCents).toBe(23_300);
    expect(outcomes.uncountedSymbols).toEqual(["J"]);
    expect(outcomes.plays.find((p) => p.symbol === "J")?.uncountedReason).toBe("No plan levels saved");
  });

  it("does not count a play whose stop is at or above entry, or an unpriced holding", () => {
    const ctx = walkFilledOrders(open("K", 10, 1_000, 1_000, 0, GRID)).openContexts;
    const r = computePlanOutcomes([pos("K", 10, 1_000, 1_050)], ctx);
    expect(r.countedCount).toBe(0);
    expect(r.atStopFromHereCents).toBeNull();
    const unpriced = computePlanOutcomes([{ ...pos("A", 40, 5_000, 0), lastPriceCents: null }], contexts);
    expect(unpriced.plays[0].uncountedReason).toBe("No price from the last sync");
  });

  it("total unrealized is null when any holding is unpriced", () => {
    expect(totalUnrealizedCents(holdings)).toBe(5_600 + 12_000 + 5_700);
    expect(totalUnrealizedCents([...holdings, { symbol: "Q", qty: 1, multiplier: 1, avgCostCents: 1, lastPriceCents: null, marketValueCents: null }])).toBeNull();
  });
});

describe("headline windows (ET)", () => {
  // Fri 2026-10-09 15:42 ET = 19:42 UTC (EDT).
  const now = Date.UTC(2026, 9, 9, 19, 42);
  const at = (d: number, h: number, m = 0) => Date.UTC(2026, 9, d, h, m);

  it("starts the week Monday 00:00 ET", () => {
    expect(startOfEtWeek(now)).toBe(Date.UTC(2026, 9, 5, 4, 0));
  });

  it("measures today, this week and since start from saved syncs", () => {
    const points = [
      { takenAt: at(2, 15), equityCents: 10_020_000 },   // before the week
      { takenAt: at(5, 14), equityCents: 10_020_000 },   // Monday's first sync
      { takenAt: at(9, 13, 35), equityCents: 10_055_400 }, // today's first sync
      { takenAt: at(9, 19, 42), equityCents: 10_061_200 },
    ];
    const h = computeHeadline({ points, now, startingCashCents: 10_000_000, startingAt: at(1, 12) });
    expect(h.equityCents).toBe(10_061_200);
    expect(h.today.deltaCents).toBe(5_800);
    expect(h.thisWeek.deltaCents).toBe(41_200);
    expect(h.sinceStart).toMatchObject({ deltaCents: 61_200, startingCents: 10_000_000 });
  });

  it("reports Not measured (null) instead of zero when there is only one sync to compare", () => {
    const h = computeHeadline({ points: [{ takenAt: at(9, 19, 42), equityCents: 10_061_200 }], now, startingCashCents: null, startingAt: null });
    expect(h.equityCents).toBe(10_061_200);
    expect(h.today.deltaCents).toBeNull();
    expect(h.thisWeek.deltaCents).toBeNull();
    expect(h.sinceStart.deltaCents).toBeNull();
    expect(computeHeadline({ points: [], now, startingCashCents: null, startingAt: null }).equityCents).toBeNull();
  });
});

describe("series gaps", () => {
  const d = (m: number, day: number, h = 15) => ({ takenAt: Date.UTC(2026, m - 1, day, h), equityCents: 1 });

  it("marks missing market days but not weekends", () => {
    expect(findSeriesGaps([d(9, 29), d(10, 2)])).toEqual([{ fromDateEt: "2026-09-30", toDateEt: "2026-10-01" }]);
    expect(findSeriesGaps([d(10, 2), d(10, 5)])).toEqual([]); // Fri -> Mon
    expect(findSeriesGaps([d(10, 8), d(10, 9)])).toEqual([]);
  });

  it("does not call a holiday a gap", () => {
    // Columbus day is not a US equity holiday; Thanksgiving 2026-11-26 is.
    expect(findSeriesGaps([d(11, 25), d(11, 27)])).toEqual([]);
  });
});
