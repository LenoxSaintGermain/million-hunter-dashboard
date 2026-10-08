import { describe, expect, it } from "vitest";
import { evaluateLeg, rankCandidates, screenUnderlying, weeklyExpirationsInRange, widthForPrice, type ChainRow, type ScreenContext, type ScreenExpiration } from "./weeklyIncomeScreen";
import { weeklyIncomeDefaults } from "../../shared/strategyTemplates/weeklyIncome";
import { passesWeeklyIncomeLanguage } from "../../shared/weeklyIncome/copy";
import { isMarketHoliday } from "./marketSession";

// Example data only: XYZ is hypothetical and every quote below is a fixture, not market data.
const NOW = Date.parse("2026-10-12T15:00:00Z");
const params = weeklyIncomeDefaults();
const ctx = (over: Partial<ScreenContext> = {}): ScreenContext => ({
  params, now: NOW, regularSession: true, equityCents: null,
  expirationLabel: (d) => `Fri ${d}`, timeExitLabel: () => "Thu 3:30 PM ET", ...over,
});
const eligibleEvents = { eligible: true, earningsWindow: { from: "2026-10-12", to: "2026-10-19" }, nextEarnings: null, exclusions: [] };

function put(strike: number, bid: number, ask: number, over: { delta?: number | null; oi?: number | null; volume?: number; feed?: "opra" | "indicative"; ageS?: number; iv?: number; expiration?: string } = {}): ChainRow {
  const expiration = over.expiration ?? "2026-10-16";
  const symbol = `XYZ${expiration.slice(2).replace(/-/g, "")}P${String(Math.round(strike * 1000)).padStart(8, "0")}`;
  return {
    contract: { symbol, underlyingSymbol: "XYZ", expirationDate: expiration, type: "put", strikePriceCents: Math.round(strike * 100), multiplier: 100, tradable: true, status: "active", openInterest: over.oi === undefined ? 1000 : over.oi, openInterestAsOf: "2026-10-09", asOf: NOW },
    market: { symbol, bidPriceCents: Math.round(bid * 100), askPriceCents: Math.round(ask * 100), bidSize: 10, askSize: 10, quoteAt: NOW - (over.ageS ?? 5) * 1000, lastTradePriceCents: null, lastTradeSize: null, lastTradeAt: null, dailyVolume: over.volume ?? 200, impliedVolatility: over.iv ?? 0.3, delta: over.delta === undefined ? -0.2 : over.delta, gamma: null, theta: null, vega: null, feed: over.feed ?? "opra", asOf: NOW },
  };
}
const exp = (rows: ChainRow[], over: Partial<ScreenExpiration> = {}): ScreenExpiration => ({ date: "2026-10-16", dte: 4, rows, events: eligibleEvents, ...over });
const xyz = { symbol: "XYZ", priceCents: 10_000, advUsd: 500_000_000 };
// $100 stock → $2.50 width. Sold 95 put mid $1.00, floor 92.5 put mid $0.60 → $0.40 credit = 16% of width.
const goodPair = () => [put(95, 0.95, 1.05), put(92.5, 0.57, 0.63, { delta: -0.12 })];

describe("Weekly Income screen (#84)", () => {
  it("builds a candidate with dollar max loss and a plain explainer", () => {
    const result = screenUnderlying(xyz, [exp(goodPair())], ctx());
    expect(result.candidates).toHaveLength(1);
    const c = result.candidates[0];
    expect(c).toMatchObject({ widthCents: 250, creditCents: 40, creditPctOfWidth: 16, maxLossPerContractCents: 22_000, contracts: null, entryEligible: true });
    expect(c.sizing).toContain("Not measured: account equity");
    expect(c.guided?.isExample).toBe(false);
    expect(c.guided?.maxLoss).toContain("$220");
    for (const text of [c.guided!.summary, c.guided!.whatCanGoWrong, c.guided!.plan]) expect(passesWeeklyIncomeLanguage(text)).toBe(true);
  });

  it("delta boundaries: 0.15 and 0.30 pass, 0.149 and 0.301 fail; missing delta is Not measured", () => {
    const check = (delta: number | null) => evaluateLeg(put(95, 0.95, 1.05, { delta }), "short", ctx());
    expect(check(-0.15).pass).toBe(true);
    expect(check(-0.30).pass).toBe(true);
    expect(check(-0.149).pass).toBe(false);
    expect(check(-0.301).pass).toBe(false);
    const missing = check(null);
    expect(missing.pass).toBe(false);
    expect(missing.checks.find((c) => c.name === "delta")?.detail).toBe("Not measured: delta");
  });

  it("open interest boundary: 499 fails, 500 passes; unknown is Not measured", () => {
    expect(evaluateLeg(put(95, 0.95, 1.05, { oi: 499 }), "short", ctx()).pass).toBe(false);
    expect(evaluateLeg(put(95, 0.95, 1.05, { oi: 500 }), "short", ctx()).pass).toBe(true);
    expect(evaluateLeg(put(95, 0.95, 1.05, { oi: null }), "short", ctx()).checks.find((c) => c.name === "open_interest")?.detail).toBe("Not measured: open interest");
  });

  it("bid/ask boundary: 10.0% of mid passes, 10.1% fails", () => {
    expect(evaluateLeg(put(95, 9.5, 10.5), "short", ctx()).pass).toBe(true);
    expect(evaluateLeg(put(95, 9.5, 10.51), "short", ctx()).pass).toBe(false);
  });

  it("indicative quotes are never eligible; stale quotes fail during the session only", () => {
    const indicative = evaluateLeg(put(95, 0.95, 1.05, { feed: "indicative" }), "short", ctx());
    expect(indicative.pass).toBe(false);
    expect(indicative.checks.find((c) => c.name === "feed")?.detail).toMatch(/Indicative/);
    expect(evaluateLeg(put(95, 0.95, 1.05, { ageS: 61 }), "short", ctx()).pass).toBe(false);
    expect(evaluateLeg(put(95, 0.95, 1.05, { ageS: 60 }), "short", ctx()).pass).toBe(true);
    const closed = screenUnderlying(xyz, [exp([put(95, 0.95, 1.05, { ageS: 50_000 }), put(92.5, 0.57, 0.63, { ageS: 50_000 })])], ctx({ regularSession: false }));
    expect(closed.candidates[0]).toMatchObject({ entryEligible: false });
    expect(closed.candidates[0].previewReason).toMatch(/Market closed/);
  });

  it("DTE boundaries: 3 and 11 are outside, 4 and 10 inside", () => {
    expect(weeklyExpirationsInRange("2026-10-12", 4, 10, isMarketHoliday).map((e) => e.dte)).toEqual([4]);
    expect(weeklyExpirationsInRange("2026-10-06", 4, 10, isMarketHoliday).map((e) => e.dte)).toEqual([10]);
    expect(weeklyExpirationsInRange("2026-10-13", 4, 10, isMarketHoliday).map((e) => e.dte)).toEqual([10]);
    expect(weeklyExpirationsInRange("2026-10-07", 4, 10, isMarketHoliday).map((e) => e.dte)).toEqual([9]);
    expect(screenUnderlying(xyz, [exp(goodPair(), { dte: 3 })], ctx()).candidates).toHaveLength(0);
    expect(screenUnderlying(xyz, [exp(goodPair(), { dte: 11 })], ctx()).candidates).toHaveLength(0);
    expect(screenUnderlying(xyz, [exp(goodPair(), { dte: 10 })], ctx()).candidates).toHaveLength(1);
  });

  it("uses Thursday when Friday is a market holiday", () => {
    // 2026-04-03 is Good Friday.
    expect(weeklyExpirationsInRange("2026-03-30", 3, 7, isMarketHoliday)).toEqual([{ date: "2026-04-02", dte: 3 }]);
  });

  it("credit boundaries: 14.9% and 40.1% of width fail, 15% and 40% pass", () => {
    const tiered = { ...params, spread_width_tiers: { under50: 1, from50to150: 2.5, above150: 10 } };
    const big = { symbol: "XYZ", priceCents: 20_000, advUsd: 500_000_000 };
    const withCredit = (creditCents: number) => {
      const shortMid = (100 + creditCents) / 100;
      const rows = [put(190, shortMid * 0.96, shortMid * 1.04), put(180, 0.96, 1.04, { delta: -0.1 })];
      return screenUnderlying(big, [exp(rows)], ctx({ params: tiered })).candidates.length;
    };
    expect(widthForPrice(20_000, tiered.spread_width_tiers)).toBe(1000);
    expect(withCredit(149)).toBe(0);
    expect(withCredit(150)).toBe(1);
    expect(withCredit(400)).toBe(1);
    expect(withCredit(401)).toBe(0);
  });

  it("sizes from measured equity and skips when one contract exceeds the cap", () => {
    const sized = screenUnderlying(xyz, [exp(goodPair())], ctx({ equityCents: 10_000_000 }));
    expect(sized.candidates[0]).toMatchObject({ contracts: 3, maxLossTotalCents: 66_000, pctOfEquity: 0.66 });
    const tooSmall = screenUnderlying(xyz, [exp(goodPair())], ctx({ equityCents: 2_000_000 }));
    expect(tooSmall.candidates).toHaveLength(0);
    expect(tooSmall.skipped[0].plain).toMatch(/One contract would exceed/);
  });

  it("skips the underlying on event exclusions, low price, unmeasured volume, and missing floor put", () => {
    const excluded = screenUnderlying(xyz, [exp(goodPair(), { events: { ...eligibleEvents, eligible: false, exclusions: [{ code: "earnings_unknown", detail: "Earnings date unknown", plain: "We don't know when XYZ reports, so it's skipped." }] } })], ctx());
    expect(excluded.candidates).toHaveLength(0);
    expect(excluded.skipped[0].plain).toMatch(/don't know when XYZ reports/);
    expect(screenUnderlying({ ...xyz, priceCents: 1_500 }, [exp(goodPair())], ctx()).skipped[0].detail).toMatch(/< \$20/);
    expect(screenUnderlying({ ...xyz, advUsd: null }, [exp(goodPair())], ctx()).skipped[0].detail).toMatch(/Not measured/);
    const noFloor = screenUnderlying(xyz, [exp([put(95, 0.95, 1.05)])], ctx());
    expect(noFloor.skipped[0].detail).toMatch(/no floor put/);
    for (const s of [...excluded.skipped, ...noFloor.skipped]) expect(passesWeeklyIncomeLanguage(s.plain)).toBe(true);
  });

  it("ranks by credit ÷ max loss and caps the list", () => {
    const a = screenUnderlying(xyz, [exp(goodPair())], ctx()).candidates[0];
    const richer = { ...a, underlying: "ABC", creditToMaxLoss: a.creditToMaxLoss + 0.1 };
    expect(rankCandidates([a, richer], 10).map((c) => c.underlying)).toEqual(["ABC", "XYZ"]);
    expect(rankCandidates([a, richer], 1)).toHaveLength(1);
  });
});
