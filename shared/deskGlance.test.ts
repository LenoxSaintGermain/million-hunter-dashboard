import { describe, it, expect } from "vitest";
import { buildDeskGlance, ACCOUNT_FRESHNESS_MS, type GlanceOrder, type GlanceAccount } from "./deskGlance";

const NOW = Date.UTC(2026, 8, 11, 19, 40);

const mark = (over: Record<string, unknown> = {}) => ({
  qty: 2, avgCostCents: 258, lastPriceCents: 305, marketValueCents: 61_000,
  priceAsOf: NOW - 60_000, priceSource: "alpaca_paper", ...over,
});

const order = (over: Partial<GlanceOrder> = {}): GlanceOrder => ({
  status: "filled", instrumentType: "long_call", plannedRiskCents: 42_000,
  qty: 2, filledQty: 2, latestMark: mark(), ...over,
});

const account = (over: Partial<GlanceAccount> = {}): GlanceAccount => ({
  label: "Alpaca Paper", cashCents: 500_000, buyingPowerCents: 1_200_000,
  lastSyncedAt: NOW - 60_000, syncSource: "alpaca_paper", ...over,
});

describe("at risk", () => {
  it("sums only orders that still commit capital", () => {
    const glance = buildDeskGlance([
      order({ plannedRiskCents: 42_000 }),
      order({ status: "submitted", plannedRiskCents: 9_600 }),
      order({ status: "rejected", plannedRiskCents: 100_000 }),
      order({ status: "cancelled", plannedRiskCents: 100_000 }),
    ], account(), NOW);
    expect(glance.atRisk.cents).toBe(51_600);
    expect(glance.atRisk.counted).toBe(2);
  });

  it("counts an order with no recorded risk instead of treating it as zero", () => {
    const glance = buildDeskGlance([
      order({ plannedRiskCents: 42_000 }),
      order({ status: "approved", plannedRiskCents: null }),
    ], account(), NOW);
    expect(glance.atRisk.cents).toBe(42_000);
    expect(glance.atRisk.counted).toBe(1);
    expect(glance.atRisk.uncounted).toBe(1);
  });

  it("names what the total actually measures for each instrument mix", () => {
    const options = buildDeskGlance([order({ instrumentType: "long_put" })], account(), NOW);
    const shares = buildDeskGlance([order({ instrumentType: "shares" })], account(), NOW);
    const mixed = buildDeskGlance([order({ instrumentType: "long_call" }), order({ instrumentType: "shares" })], account(), NOW);
    expect(options.atRisk.label).toBe("Premium at risk");
    expect(shares.atRisk.label).toBe("Planned loss at modeled stops");
    expect(mixed.atRisk.label).toBe("Premium at risk and planned loss at modeled stops");
  });
});

describe("unrealized", () => {
  it("sums the positions it could mark", () => {
    const glance = buildDeskGlance([order(), order()], account(), NOW);
    expect(glance.unrealized.measured).toBe(true);
    expect(glance.unrealized.pnlCents).toBe(18_800); // 2 x +$94.00
    expect(glance.unrealized.marked).toBe(2);
    expect(glance.unrealized.caveat).toBeNull();
  });

  it("says how many positions are missing rather than quietly dropping them", () => {
    const glance = buildDeskGlance([order(), order({ latestMark: null })], account(), NOW);
    expect(glance.unrealized.pnlCents).toBe(9_400);
    expect(glance.unrealized.marked).toBe(1);
    expect(glance.unrealized.openPositions).toBe(2);
    expect(glance.unrealized.caveat).toContain("1 of 2 open positions could not be marked");
  });

  it("reports no figure at all when nothing could be marked, with the reason", () => {
    const glance = buildDeskGlance([order({ latestMark: null })], account(), NOW);
    expect(glance.unrealized.measured).toBe(false);
    expect(glance.unrealized.pnlCents).toBeNull();
    expect(glance.unrealized.caveat).toContain("No open position is recorded");
  });

  it("does not count an unfilled order as a flat position", () => {
    const glance = buildDeskGlance([order({ status: "submitted" })], account(), NOW);
    expect(glance.unrealized.openPositions).toBe(0);
    expect(glance.unrealized.pnlCents).toBeNull();
    expect(glance.unrealized.caveat).toBe("No position has a recorded fill yet.");
  });

  it("carries the oldest mark as the total's as-of, and flags stale ones", () => {
    const fresh = order();
    const old = order({ latestMark: mark({ priceAsOf: NOW - ACCOUNT_FRESHNESS_MS - 60_000 }) });
    const glance = buildDeskGlance([fresh, old], account(), NOW);
    expect(glance.unrealized.marked).toBe(2);
    expect(glance.unrealized.stale).toBe(1);
    expect(glance.unrealized.asOf).toBe(NOW - ACCOUNT_FRESHNESS_MS - 60_000);
    expect(glance.unrealized.caveat).toContain("older than the 15-minute freshness window");
  });

  it("nets a loss against a gain rather than showing the gross", () => {
    const loser = order({ latestMark: mark({ lastPriceCents: 200, marketValueCents: 40_000 }) });
    const glance = buildDeskGlance([order(), loser], account(), NOW);
    // +$94.00 against −$116.00: basis (40_000/200)*258 = 51_600, value 40_000.
    expect(glance.unrealized.pnlCents).toBe(9_400 - 11_600);
    expect(glance.unrealized.pnlCents).toBeLessThan(0);
  });
});

describe("deployable", () => {
  it("prefers buying power, the number that actually limits a new order", () => {
    const glance = buildDeskGlance([], account(), NOW);
    expect(glance.deployable.cents).toBe(1_200_000);
    expect(glance.deployable.source).toBe("alpaca_paper");
    expect(glance.deployable.stale).toBe(false);
  });

  it("falls back to cash when the broker reported no buying power", () => {
    expect(buildDeskGlance([], account({ buyingPowerCents: null }), NOW).deployable.cents).toBe(500_000);
  });

  it("refuses a balance that carries no sync timestamp or source", () => {
    for (const over of [{ lastSyncedAt: null }, { syncSource: null }]) {
      const glance = buildDeskGlance([], account(over), NOW);
      expect(glance.deployable.cents).toBeNull();
      expect(glance.deployable.unavailableReason).toContain("synced balance");
    }
  });

  it("refuses when no account is connected", () => {
    const glance = buildDeskGlance([], null, NOW);
    expect(glance.deployable.cents).toBeNull();
    expect(glance.deployable.unavailableReason).toContain("No paper account is connected");
  });

  it("states a balance the broker did not report rather than showing zero", () => {
    const glance = buildDeskGlance([], account({ buyingPowerCents: null, cashCents: null }), NOW);
    expect(glance.deployable.cents).toBeNull();
    expect(glance.deployable.unavailableReason).toContain("did not report buying power or cash");
  });

  it("shows a stale balance and labels it rather than hiding it", () => {
    const glance = buildDeskGlance([], account({ lastSyncedAt: NOW - ACCOUNT_FRESHNESS_MS - 1 }), NOW);
    expect(glance.deployable.cents).toBe(1_200_000);
    expect(glance.deployable.stale).toBe(true);
    expect(glance.deployable.unavailableReason).toBeNull();
  });
});

describe("in motion", () => {
  it("separates orders awaiting a fill from open positions", () => {
    const glance = buildDeskGlance([
      order(), order(), order({ status: "submitted" }), order({ status: "approved" }),
      order({ status: "rejected" }),
    ], account(), NOW);
    expect(glance.inMotion).toEqual({ liveOrders: 4, awaitingFill: 2, openPositions: 2 });
  });

  it("returns zeroed counts and stated reasons on an empty desk", () => {
    const glance = buildDeskGlance([], account(), NOW);
    expect(glance.inMotion).toEqual({ liveOrders: 0, awaitingFill: 0, openPositions: 0 });
    expect(glance.atRisk.cents).toBe(0);
    expect(glance.unrealized.measured).toBe(false);
    expect(glance.unrealized.caveat).toBe("No position has a recorded fill yet.");
  });
});
