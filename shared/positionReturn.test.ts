import { describe, it, expect } from "vitest";
import {
  computePositionReturn, formatReturnAmount, formatReturnPercent, formatMarkProvenance,
  deskOrderReturn, MARK_FRESHNESS_MS, type PositionMark,
} from "./positionReturn";

const NOW = Date.UTC(2026, 8, 11, 14, 30);

const mark = (over: Partial<PositionMark> = {}): PositionMark => ({
  qty: 100,
  avgCostCents: 5_000,
  lastPriceCents: 5_250,
  marketValueCents: 525_000,
  priceAsOf: NOW - 60_000,
  priceSource: "alpaca_paper",
  ...over,
});

describe("computePositionReturn", () => {
  it("measures a long share position from the broker mark", () => {
    const result = computePositionReturn(mark(), NOW);
    expect(result.measured).toBe(true);
    if (!result.measured) return;
    expect(result.costBasisCents).toBe(500_000);
    expect(result.pnlCents).toBe(25_000);
    expect(result.returnPct).toBeCloseTo(5, 6);
    expect(result.stale).toBe(false);
  });

  it("measures an option position without assuming a 100-share multiplier", () => {
    // 2 contracts, entry $2.58, now $3.05. Alpaca reports avg_entry_price and
    // current_price per share; market_value already carries the multiplier.
    const result = computePositionReturn(mark({
      qty: 2, avgCostCents: 258, lastPriceCents: 305, marketValueCents: 61_000,
    }), NOW);
    expect(result.measured).toBe(true);
    if (!result.measured) return;
    expect(result.costBasisCents).toBe(51_600);
    expect(result.pnlCents).toBe(9_400);
    expect(result.returnPct).toBeCloseTo(18.217, 2);
  });

  it("stays correct for a contract whose multiplier is not 100", () => {
    // An adjusted contract deliverable of 130 shares. Multiplying by 100 would
    // understate cost basis by 30%; deriving it from market value does not.
    const result = computePositionReturn(mark({
      qty: 1, avgCostCents: 400, lastPriceCents: 500, marketValueCents: 65_000,
    }), NOW);
    expect(result.measured).toBe(true);
    if (!result.measured) return;
    expect(result.costBasisCents).toBe(52_000);
    expect(result.pnlCents).toBe(13_000);
  });

  it("reports a loss on a long position that moved against the entry", () => {
    const result = computePositionReturn(mark({ lastPriceCents: 4_500, marketValueCents: 450_000 }), NOW);
    expect(result.measured).toBe(true);
    if (!result.measured) return;
    expect(result.pnlCents).toBe(-50_000);
    expect(result.returnPct).toBeCloseTo(-10, 6);
  });

  it("reports a gain on a short position whose price fell", () => {
    const result = computePositionReturn(mark({
      qty: -100, avgCostCents: 5_000, lastPriceCents: 4_500, marketValueCents: -450_000,
    }), NOW);
    expect(result.measured).toBe(true);
    if (!result.measured) return;
    expect(result.costBasisCents).toBe(-500_000);
    expect(result.pnlCents).toBe(50_000);
    expect(result.returnPct).toBeCloseTo(10, 6);
  });

  it("marks a figure older than the freshness window as stale rather than hiding it", () => {
    const result = computePositionReturn(mark({ priceAsOf: NOW - MARK_FRESHNESS_MS - 1 }), NOW);
    expect(result.measured).toBe(true);
    if (!result.measured) return;
    expect(result.stale).toBe(true);
    expect(result.pnlCents).toBe(25_000);
    expect(formatMarkProvenance(result)).toMatch(/^Stale mark /);
  });

  it("refuses when there is no position row at all", () => {
    const result = computePositionReturn(null, NOW);
    expect(result).toEqual({ measured: false, reason: "No open position is recorded at the broker for this play." });
  });

  it("refuses a price that carries no timestamp", () => {
    const result = computePositionReturn(mark({ priceAsOf: null }), NOW);
    expect(result.measured).toBe(false);
    if (result.measured) return;
    expect(result.reason).toContain("no timestamp or source");
  });

  it("refuses a price that carries no source", () => {
    const result = computePositionReturn(mark({ priceSource: "  " }), NOW);
    expect(result.measured).toBe(false);
    if (result.measured) return;
    expect(result.reason).toContain("no timestamp or source");
  });

  it("refuses when the broker reported no current price", () => {
    const result = computePositionReturn(mark({ lastPriceCents: null }), NOW);
    expect(result.measured).toBe(false);
    if (result.measured) return;
    expect(result.reason).toContain("no mark can be taken");
  });

  it("refuses a zero current price instead of dividing by it", () => {
    const result = computePositionReturn(mark({ lastPriceCents: 0 }), NOW);
    expect(result.measured).toBe(false);
  });

  it("refuses when no entry cost is recorded", () => {
    const result = computePositionReturn(mark({ avgCostCents: null }), NOW);
    expect(result.measured).toBe(false);
    if (result.measured) return;
    expect(result.reason).toContain("No entry cost");
  });

  it("refuses when the broker did not report a market value", () => {
    const result = computePositionReturn(mark({ marketValueCents: null }), NOW);
    expect(result.measured).toBe(false);
    if (result.measured) return;
    expect(result.reason).toContain("market value");
  });

  it("refuses a flat position rather than calling it a zero return", () => {
    const result = computePositionReturn(mark({ qty: 0 }), NOW);
    expect(result.measured).toBe(false);
    if (result.measured) return;
    expect(result.reason).toContain("no remaining quantity");
  });

  it("refuses non-finite inputs", () => {
    expect(computePositionReturn(mark({ lastPriceCents: Number.NaN }), NOW).measured).toBe(false);
    expect(computePositionReturn(mark({ marketValueCents: Number.POSITIVE_INFINITY }), NOW).measured).toBe(false);
  });

  it("never reports a zero-cost position as an infinite return", () => {
    const result = computePositionReturn(mark({ avgCostCents: 0 }), NOW);
    expect(result.measured).toBe(true);
    if (!result.measured) return;
    expect(result.costBasisCents).toBe(0);
    expect(result.returnPct).toBeNull();
    expect(formatReturnPercent(result)).toBeNull();
  });
});

describe("deskOrderReturn", () => {
  it("marks a filled order against its broker position", () => {
    const result = deskOrderReturn({ status: "filled", latestMark: mark() }, NOW);
    expect(result.measured).toBe(true);
  });

  it("does not call an unfilled order flat", () => {
    for (const status of ["pending_approval", "approved", "submitted"]) {
      const result = deskOrderReturn({ status, latestMark: mark() }, NOW);
      expect(result.measured).toBe(false);
      if (result.measured) return;
      expect(result.reason).toContain("No fill is recorded");
    }
  });

  it("separates an unavailable marks source from an absent position", () => {
    const unavailable = deskOrderReturn({ status: "filled", latestMark: null, markSourceUnavailable: true }, NOW);
    const absent = deskOrderReturn({ status: "filled", latestMark: null }, NOW);
    expect(unavailable.measured).toBe(false);
    expect(absent.measured).toBe(false);
    if (unavailable.measured || absent.measured) return;
    expect(unavailable.reason).toContain("unavailable");
    expect(absent.reason).toContain("No open position is recorded");
    expect(unavailable.reason).not.toBe(absent.reason);
  });
});

describe("formatting", () => {
  it("signs a gain and a loss distinctly", () => {
    const gain = computePositionReturn(mark(), NOW);
    const loss = computePositionReturn(mark({ lastPriceCents: 4_500, marketValueCents: 450_000 }), NOW);
    if (!gain.measured || !loss.measured) throw new Error("expected measured returns");
    expect(formatReturnAmount(gain)).toBe("+$250.00");
    expect(formatReturnPercent(gain)).toBe("+5.0%");
    expect(formatReturnAmount(loss)).toBe("−$500.00");
    expect(formatReturnPercent(loss)).toBe("−10.0%");
  });

  it("states the mark time and source on every measured figure", () => {
    const result = computePositionReturn(mark(), NOW);
    if (!result.measured) throw new Error("expected a measured return");
    const provenance = formatMarkProvenance(result);
    expect(provenance).toContain("alpaca_paper");
    expect(provenance).toMatch(/^Mark /);
  });
});
