import { describe, expect, it } from "vitest";
import { freezeSpreadSnapshot } from "./weeklyIncomeSnapshot";
import { screenUnderlying, type ChainRow } from "./weeklyIncomeScreen";
import { weeklyIncomeDefaults } from "../../shared/strategyTemplates/weeklyIncome";

// Example data: hypothetical XYZ chain.
const NOW = Date.parse("2026-10-12T15:00:00Z");
const put = (strike: number, bid: number, ask: number, delta: number): ChainRow => {
  const symbol = `XYZ261016P${String(strike * 1000).padStart(8, "0")}`;
  return {
    contract: { symbol, underlyingSymbol: "XYZ", expirationDate: "2026-10-16", type: "put", strikePriceCents: Math.round(strike * 100), multiplier: 100, tradable: true, status: "active", openInterest: 900, openInterestAsOf: null, asOf: NOW },
    market: { symbol, bidPriceCents: Math.round(bid * 100), askPriceCents: Math.round(ask * 100), bidSize: 1, askSize: 1, quoteAt: NOW - 3000, lastTradePriceCents: null, lastTradeSize: null, lastTradeAt: null, dailyVolume: 100, impliedVolatility: 0.3, delta, feed: "opra", asOf: NOW },
  };
};

describe("Weekly Income frozen structure snapshot (#86)", () => {
  it("captures legs, credit, max loss and parameter hash, and cannot be edited later", () => {
    const [candidate] = screenUnderlying({ symbol: "XYZ", priceCents: 10_000, advUsd: 5e8 }, [{ date: "2026-10-16", dte: 4, events: { eligible: true, earningsWindow: null, nextEarnings: null, exclusions: [] }, rows: [put(95, 0.95, 1.05, -0.2), put(92.5, 0.57, 0.63, -0.12)] }], {
      params: weeklyIncomeDefaults(), now: NOW, regularSession: true, equityCents: 10_000_000, expirationLabel: () => "Fri", timeExitLabel: () => "Thu",
    }).candidates;
    const snap = freezeSpreadSnapshot(candidate, { parameterSetId: "capital_weekly_income", parameterHash: "sha256:fixture", capturedAt: NOW, earnings: "after window (operator record)", bindingCap: "max_loss_per_position_pct 0.75%" });
    expect(snap.legs.map((l) => [l.occSymbol, l.positionIntent, l.quoteAt])).toEqual([["XYZ261016P00095000", "sell_to_open", NOW - 3000], ["XYZ261016P00092500", "buy_to_open", NOW - 3000]]);
    expect(snap).toMatchObject({ creditCents: 40, widthCents: 250, contracts: 3, maxLossTotalCents: 66_000, gapStressLossCents: 66_000, parameterHash: "sha256:fixture", snapshotBasis: "live_capture" });
    expect(Object.isFrozen(snap) && Object.isFrozen(snap.legs) && Object.isFrozen(snap.legs[0])).toBe(true);
    expect(() => { (snap as any).creditCents = 1; }).toThrow();
  });
});
