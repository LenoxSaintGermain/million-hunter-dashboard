import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const providers = vi.hoisted(() => ({ collect: vi.fn(), regime: vi.fn() }));
vi.mock("./providers/index", () => ({ collectMarketFacts: providers.collect }));
vi.mock("./marketRegime", () => ({ buildMarketRegimeSnapshot: providers.regime }));

import { underwritePlayCandidates, type CandidateSeed, type CapitalObjective, type MarketRegimeSnapshot } from "../../shared/playUnderwriting";
import { regularSessionCloseAt } from "./marketSession";
import { underwriteCapitalMission } from "./underwriter";
import { TradePlayCard } from "../../client/src/components/aperture/TradePlayCard";
import { PlayUnderwritingBrief } from "../../client/src/components/aperture/PlayUnderwritingBrief";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

// Wed 2026-10-07 11:00 ET (regular session).
const now = Date.UTC(2026, 9, 7, 15);
const fresh = (value: number) => ({ value, direction: "up" as const, asOf: now, source: "Illustrative fixture", freshness: "fresh" as const });
const market: MarketRegimeSnapshot = { asOf: now, marketSession: "regular", indexTrend: { spy: fresh(1), qqq: fresh(1), iwm: fresh(0) },
  keyThemes: [], catalysts: [], regime: "risk_on", confidence: 70 };
const objective: CapitalObjective = { deployableCapitalCents: 5_000_000, targetProfitCents: null, targetPeriod: null, maxPlannedLossCents: 25_000,
  maxPortfolioOpenRiskCents: null, weeklyLossLimitCents: null, eventRiskLimitCents: null, holdingPeriods: ["intraday"], instrumentPreference: "shares" };
const risk = { normalPlayRiskPct: 0.75, highConvictionRiskPct: 1.25, maxAggregateOpenRiskPct: 3, weeklyLossLimitPct: 4,
  eventRiskAllocationPct: 1.5, perPlayHeadroomCents: 1_000_000, aggregateOpenRiskBeforeCents: 0, weeklyLossUsedCents: 0 };
const belief = "Liquid US stocks 15%+ below their 52-week high produce tradeable intraday trend days, confirmed on a 5-minute close.";
const seed = (symbol: string, lastPrice: number): CandidateSeed => ({ symbol, title: belief, direction: "conditional", universe: "thesis_examples",
  expiresAt: Date.UTC(2026, 9, 7, 20), evidence: ["last price: recorded (Illustrative)"], sourceUrls: ["https://example.com/illustrative"],
  lastPrice, lastPriceAsOf: now, liquidityScore: 85, portfolioFitScore: 75, correlationPenalty: 10 });
const examples = () => underwritePlayCandidates({ objective, market, risk, now, candidates: [seed("AAA", 100), seed("BBB", 50), seed("CCC", 20)] });

describe("issue #21: the thesis-example universe is not presented as a screen", () => {
  it("marks thesis-example plays, keeps their tied score visible only as data, and labels template levels", () => {
    const result = examples();
    expect(result.plays).toHaveLength(3);
    // Documents the bug: identical facts give identical scores. The UI must not present them as a ranking.
    expect(new Set(result.plays.map(play => play.scoring.overall)).size).toBe(1);
    for (const play of result.plays) {
      expect(play.universe).toBe("thesis_examples");
      expect(play.levelsBasis).toBe("fixed_percent_template");
      expect(play.playClass).toBe("unclassified");
      expect(play.warnings[0]).toContain("Example ticker from the thesis text, not screened");
      expect(play.warnings.join(" ")).toContain("fixed 2% / 2-4-6% template");
      expect(play.killAt).toBe(Date.UTC(2026, 9, 7, 20));
    }
  });

  it("fixes the broken thesis sentence and carries the horizon expiry", () => {
    const thesis = examples().tacticalTheses[0];
    expect(thesis.statement).not.toContain(". is only actionable");
    expect(thesis.statement).toContain("confirmed on a 5-minute close is only actionable");
    expect(thesis.expiresAt).toBe(Date.UTC(2026, 9, 7, 20));
  });

  it("expires intraday ideas at the regular-session close", () => {
    expect(regularSessionCloseAt(now)).toBe(Date.UTC(2026, 9, 7, 20));
    expect(regularSessionCloseAt(Date.UTC(2026, 9, 7, 21))).toBe(Date.UTC(2026, 9, 8, 20)); // after close → next session
    expect(regularSessionCloseAt(Date.UTC(2026, 9, 10, 15))).toBe(Date.UTC(2026, 9, 12, 20)); // Saturday → Monday
    expect(regularSessionCloseAt(Date.UTC(2026, 10, 27, 15))).toBe(Date.UTC(2026, 10, 27, 18)); // half day, 13:00 ET
  });

  it("tags the Mission universe as thesis examples and sets the intraday expiry", async () => {
    providers.regime.mockResolvedValue({ snapshot: market, providerAvailability: {} });
    providers.collect.mockImplementation(async (symbol: string) => ({ symbol, facts: [
      { factKey: "last_price", valueNum: 100, basis: "verified", sourceUrl: "https://example.com/illustrative", sourceName: "Illustrative", providerId: "fixture", asOf: now },
    ], ranProviders: [], skippedProviders: [] }));
    const cockpit = { headroom: { lines: [] } } as any;
    const { result } = await underwriteCapitalMission({ now, objective, cockpit, requestedPlayCount: 3,
      projection: { name: "Illustrative", graph: { researchSymbols: ["aaa", "BBB"], beliefs: [belief], seek: ["Long above session high; short below session low."], invalidationConditions: [] } } as any });
    expect(result.plays.map(play => play.universe)).toEqual(["thesis_examples", "thesis_examples"]);
    expect(result.plays.every(play => play.killAt === Date.UTC(2026, 9, 7, 20))).toBe(true);
  });
});

describe("issue #21: candidate cards and result header", () => {
  it("shows example tickers without a score, setup class or direction that wasn't measured", () => {
    const result = examples();
    const $ = load(renderToStaticMarkup(React.createElement(TradePlayCard, { rank: 1, play: result.plays[0], thesis: result.tacticalTheses[0],
      portfolioRiskBeforeCents: 0, maxOpenRiskCents: 100_000, selected: false, busy: false, onValidate: vi.fn() })));
    const text = $.text();
    expect(text).toContain("Example 1 · from thesis, not screened");
    expect(text).not.toMatch(/score \d+/);
    expect(text).toContain("setup not classified");
    expect(text).not.toContain("pullback");
    expect(text).toContain("direction not determined");
    expect(text).toContain("Illustrative only: 1R / 2R / 3R targets at a fixed 2% stop");
    expect(text).not.toContain("Scenario:");
  });

  it("labels the result as example tickers from the thesis, not a ranked screen", () => {
    const $ = load(renderToStaticMarkup(React.createElement(PlayUnderwritingBrief, { result: examples(), selectedPlayId: null, busy: false, onValidate: vi.fn() })));
    expect($("[aria-label='Example tickers from thesis, not screened']")).toHaveLength(1);
    expect($("h3").first().text()).toBe("3 example tickers from your thesis");
    expect($.text()).not.toContain("ranks first");
    expect($.text()).toContain("None is ranked first");
  });

  it("does not call a tied score a ranking even for a screened universe", () => {
    const result = examples();
    const screened = { ...result, plays: result.plays.map(({ universe: _u, ...play }) => play) };
    const $ = load(renderToStaticMarkup(React.createElement(PlayUnderwritingBrief, { result: screened, selectedPlayId: null, busy: false, onValidate: vi.fn() })));
    expect($.text()).toContain("Scores are tied, so the order does not rank these ideas.");
    expect($("[aria-label='Example tickers from thesis, not screened']")).toHaveLength(0);
  });
});
