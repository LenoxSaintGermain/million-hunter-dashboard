import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WeeklyIncomeScreenResults, type WiScreenResult } from "../../client/src/components/aperture/weeklyIncome/WeeklyIncomeCandidates";
import { screenUnderlying, type ChainRow } from "./weeklyIncomeScreen";
import { weeklyIncomeDefaults } from "../../shared/strategyTemplates/weeklyIncome";
import { passesWeeklyIncomeLanguage } from "../../shared/weeklyIncome/copy";

// Example data only: hypothetical XYZ chain.
const NOW = Date.parse("2026-10-12T15:00:00Z");
const put = (strike: number, bid: number, ask: number, delta: number): ChainRow => {
  const symbol = `XYZ261016P${String(strike * 1000).padStart(8, "0")}`;
  return {
    contract: { symbol, underlyingSymbol: "XYZ", expirationDate: "2026-10-16", type: "put", strikePriceCents: Math.round(strike * 100), multiplier: 100, tradable: true, status: "active", openInterest: 1000, openInterestAsOf: null, asOf: NOW },
    market: { symbol, bidPriceCents: Math.round(bid * 100), askPriceCents: Math.round(ask * 100), bidSize: 1, askSize: 1, quoteAt: NOW, lastTradePriceCents: null, lastTradeSize: null, lastTradeAt: null, dailyVolume: 100, impliedVolatility: 0.3, delta, feed: "opra", asOf: NOW },
  };
};
const screened = screenUnderlying({ symbol: "XYZ", priceCents: 10_000, advUsd: 500_000_000 }, [{ date: "2026-10-16", dte: 4, events: { eligible: true, earningsWindow: null, nextEarnings: null, exclusions: [] }, rows: [put(95, 0.95, 1.05, -0.2), put(92.5, 0.57, 0.63, -0.12)] }], {
  params: weeklyIncomeDefaults(), now: NOW, regularSession: true, equityCents: 10_000_000, expirationLabel: () => "Fri Oct 16", timeExitLabel: () => "Thu Oct 15 15:30 ET",
});
const result: WiScreenResult = { asOf: NOW, session: "regular", refusal: null, candidates: screened.candidates, skipped: [] };

describe("Weekly Income screen results (#84)", () => {
  beforeAll(() => { (globalThis as any).React = React; });
  afterAll(() => { delete (globalThis as any).React; });

  it("Quick Play: plain explainer, dollar max loss, what can go wrong, research-only, clean language", () => {
    const $ = load(renderToStaticMarkup(<WeeklyIncomeScreenResults result={result} isGuided isExample />));
    expect($("[data-wi-candidate]")).toHaveLength(1);
    expect($("[data-example-data]").text()).toBe("Example data");
    expect($("[data-wi-max-loss]").text()).toContain("$660");
    expect($("[data-wi-what-can-go-wrong]").text()).toMatch(/What can go wrong: if XYZ drops below \$92\.50/);
    expect($.root().text()).toContain("research only, nothing is traded");
    expect(passesWeeklyIncomeLanguage($.root().text())).toBe(true);
    expect($("button")).toHaveLength(0);
  });

  it("Strategist: exact table, no example badge for measured numbers", () => {
    const $ = load(renderToStaticMarkup(<WeeklyIncomeScreenResults result={result} isGuided={false} />));
    expect($("[data-wi-pro-table] tbody tr")).toHaveLength(1);
    expect($("[data-example-data]")).toHaveLength(0);
    expect($("[data-wi-pro-table]").text()).toContain("$220");
  });

  it("refusal replaces results and shows the plain reason", () => {
    const refused: WiScreenResult = { ...result, candidates: [], refusal: { code: "opra_not_entitled", plain: "This account only sees delayed, indicative option prices.", detail: "OPRA not entitled" } };
    const $ = load(renderToStaticMarkup(<WeeklyIncomeScreenResults result={refused} isGuided />));
    expect($("[data-wi-refusal]").text()).toContain("delayed, indicative");
    expect($("[data-wi-candidate]")).toHaveLength(0);
    expect($("[data-wi-refusal]").text()).not.toContain("opra_not_entitled");
  });
});
