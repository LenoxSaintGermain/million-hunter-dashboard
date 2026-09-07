import { describe, expect, it } from "vitest";
import {
  calculateLongOptionOutcome,
  calculateShareOutcome,
  calculateTargetFeasibility,
  rankPlay,
  underwritePlayCandidates,
  type CapitalObjective,
  type MarketRegimeSnapshot,
} from "../../shared/playUnderwriting";

const objective = (overrides: Partial<CapitalObjective> = {}): CapitalObjective => ({
  deployableCapitalCents: 2_500_000,
  targetProfitCents: 600_000,
  targetPeriod: "week",
  maxPlannedLossCents: 25_000,
  maxPortfolioOpenRiskCents: null,
  weeklyLossLimitCents: null,
  eventRiskLimitCents: null,
  holdingPeriods: ["swing"],
  instrumentPreference: "either",
  ...overrides,
});

const risk = {
  normalPlayRiskPct: 0.75,
  highConvictionRiskPct: 1.25,
  maxAggregateOpenRiskPct: 3,
  weeklyLossLimitPct: 4,
  eventRiskAllocationPct: 1.5,
  perPlayHeadroomCents: 1_000_000,
  aggregateOpenRiskBeforeCents: 0,
  weeklyLossUsedCents: 0,
};

describe("target feasibility", () => {
  it.each([
    [2_500_000, 24],
    [5_000_000, 12],
    [10_000_000, 6],
    [20_000_000, 3],
    [30_000_000, 2],
  ])("calculates the required return for a $%s cent capital base", (capitalBaseCents, expected) => {
    const result = calculateTargetFeasibility(objective({ deployableCapitalCents: capitalBaseCents }), risk);
    expect(result.requiredReturnPct).toBe(expected);
  });

  it("never lets a harder target increase permitted risk", () => {
    const low = calculateTargetFeasibility(objective({ targetProfitCents: 100_000 }), risk);
    const high = calculateTargetFeasibility(objective({ targetProfitCents: 2_000_000 }), risk);
    expect(high.requiredReturnPct).toBeGreaterThan(low.requiredReturnPct!);
    expect(high.riskBudgetCents).toBe(low.riskBudgetCents);
    expect(high.highConvictionRiskCents).toBe(low.highConvictionRiskCents);
    expect(high.mayInfluenceSizing).toBe(false);
  });

  it("uses the tightest measured loss authority", () => {
    const result = calculateTargetFeasibility(objective({ maxPlannedLossCents: 50_000 }), {
      ...risk,
      perPlayHeadroomCents: 12_000,
    });
    expect(result.riskBudgetCents).toBe(12_000);
  });

  it("enforces aggregate, weekly, and event-risk ceilings", () => {
    const result = calculateTargetFeasibility(objective({
      deployableCapitalCents: 5_000_000,
      maxPlannedLossCents: 100_000,
      maxPortfolioOpenRiskCents: 60_000,
      weeklyLossLimitCents: 50_000,
      eventRiskLimitCents: 20_000,
    }), {
      ...risk,
      aggregateOpenRiskBeforeCents: 10_000,
      weeklyLossUsedCents: 5_000,
    });
    expect(result.maxOpenRiskCents).toBe(60_000);
    expect(result.lossLimitCents).toBe(50_000);
    expect(result.riskBudgetCents).toBe(20_000);
  });
});

describe("outcome math", () => {
  it("calculates share stop loss and R multiples", () => {
    expect(calculateShareOutcome({ quantity: 100, entryPrice: 50, stopPrice: 48, targetPrices: [53, 56] })).toEqual({
      maxLossCents: 20_000,
      targetOutcomesCents: [30_000, 60_000],
      rMultiples: [1.5, 3],
    });
  });

  it.each(["long_call", "long_put"] as const)("caps %s loss at premium paid", (kind) => {
    expect(calculateLongOptionOutcome({ kind, contracts: 2, premiumPerShare: 4.2, targetPremiumsPerShare: [6.3] })).toEqual({
      maxLossCents: 84_000,
      targetOutcomesCents: [42_000],
      rMultiples: [0.5],
      expectedValueCents: null,
    });
  });

  it("does not produce EV without supported probabilities", () => {
    const result = calculateLongOptionOutcome({ kind: "long_call", contracts: 1, premiumPerShare: 4, targetPremiumsPerShare: [8] });
    expect(result.expectedValueCents).toBeNull();
  });
});

describe("deterministic play ranking", () => {
  it("applies the persisted component weights and correlation penalty", () => {
    expect(rankPlay({ conviction: 80, asymmetry: 90, catalyst: 70, timing: 60, liquidity: 80, portfolioFit: 90, evidenceQuality: 80, correlationPenalty: 20 })).toBe(77);
  });
});

describe("underwriting refusal", () => {
  const market: MarketRegimeSnapshot = {
    asOf: Date.UTC(2026, 8, 7, 14),
    marketSession: "regular",
    indexTrend: {
      spy: { value: 1, direction: "up", asOf: Date.UTC(2026, 8, 7, 14), source: "fixture", freshness: "fresh" },
      qqq: { value: 1, direction: "up", asOf: Date.UTC(2026, 8, 7, 14), source: "fixture", freshness: "fresh" },
      iwm: { value: 0, direction: "flat", asOf: Date.UTC(2026, 8, 7, 14), source: "fixture", freshness: "fresh" },
    },
    keyThemes: [], catalysts: [], regime: "risk_on", confidence: 75,
  };

  it("returns NO_TRADE when portfolio risk capacity is exhausted", () => {
    const result = underwritePlayCandidates({
      objective: objective(), market, now: market.asOf,
      risk: { ...risk, aggregateOpenRiskBeforeCents: 75_000 },
      candidates: [{ symbol: "MRVL", title: "AI infrastructure", direction: "bullish", evidence: [], sourceUrls: [], liquidityScore: 80, portfolioFitScore: 70 }],
    });
    expect(result.plays).toEqual([]);
    expect(result.noTrade?.reason).toBe("portfolio_headroom_exhausted");
  });

  it("does not present a current entry from stale market data", () => {
    const stale = structuredClone(market);
    stale.indexTrend.spy.freshness = "stale";
    const result = underwritePlayCandidates({
      objective: objective(), market: stale, now: market.asOf,
      risk,
      candidates: [{ symbol: "MRVL", title: "AI infrastructure", direction: "bullish", evidence: [], sourceUrls: [], liquidityScore: 80, portfolioFitScore: 70 }],
    });
    expect(result.plays).toEqual([]);
    expect(result.noTrade?.reason).toBe("market_data_stale");
  });

  it("keeps unsupported option structures out of executable play status", () => {
    const result = underwritePlayCandidates({
      objective: objective({ instrumentPreference: "options" }), market, now: market.asOf,
      risk,
      candidates: [{ symbol: "MRVL", title: "AI infrastructure", direction: "bullish", evidence: ["Verified revenue acceleration"], sourceUrls: ["https://example.com/source"], lastPrice: 220, lastPriceAsOf: market.asOf, liquidityScore: 80, portfolioFitScore: 70 }],
    });
    expect(result.plays[0]?.instrument.kind).toBe("long_call");
    expect(result.plays[0]?.status).toBe("research_required");
    expect(result.plays[0]?.outcome.basis).toBe("insufficient_data");
  });

  it("returns no more than three ranked plays", () => {
    const result = underwritePlayCandidates({
      objective: objective({ instrumentPreference: "shares" }), market, now: market.asOf, risk,
      requestedPlayCount: 3,
      candidates: ["MRVL", "NU", "COHR", "MU"].map((symbol, index) => ({
        symbol,
        title: `${symbol} fixture thesis`,
        direction: "conditional" as const,
        evidence: ["Verified fixture fact"],
        sourceUrls: [`https://example.com/${symbol.toLowerCase()}`],
        lastPrice: 100 + index,
        lastPriceAsOf: market.asOf,
        liquidityScore: 80 - index,
        portfolioFitScore: 75,
      })),
    });
    expect(result.plays).toHaveLength(3);
    expect(result.plays.map((play) => play.scoring.overall)).toEqual([...result.plays.map((play) => play.scoring.overall)].sort((a, b) => b - a));
  });

  it("waits for a trigger instead of predicting direction during a sourced event window", () => {
    const eventMarket = structuredClone(market);
    eventMarket.regime = "event_compression";
    eventMarket.catalysts = [{ label: "Macro release", occursAt: market.asOf + 24 * 60 * 60 * 1_000, relevance: "high", sourceUrls: ["https://example.com/calendar"] }];
    const result = underwritePlayCandidates({
      objective: objective({ instrumentPreference: "shares" }), market: eventMarket, now: market.asOf, risk,
      candidates: [{ symbol: "MRVL", title: "AI infrastructure", direction: "conditional", evidence: ["Verified filing"], sourceUrls: ["https://example.com/filing"], lastPrice: 220, lastPriceAsOf: market.asOf, liquidityScore: 80, portfolioFitScore: 70 }],
    });
    expect(result.plays[0]?.status).toBe("waiting_for_trigger");
    expect(result.plays[0]?.trigger.status).toBe("unknown");
  });
});
