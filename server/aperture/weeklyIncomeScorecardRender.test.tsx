import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WeeklyIncomeScorecardView } from "../../client/src/components/aperture/weeklyIncome/WeeklyIncomeScorecardView";
import { buildWeeklyIncomeScorecard, type WiPositionRecord } from "../../shared/weeklyIncomeScorecard";
import { passesWeeklyIncomeLanguage } from "../../shared/weeklyIncome/copy";

// Example data: one hypothetical closed position.
const T = Date.parse("2026-10-12T04:00:00Z");
const position = (basis: WiPositionRecord["basis"]): WiPositionRecord => ({ id: "a", underlying: "XYZ", basis, openedAt: T, closedAt: T + 3_600_000, contracts: 1, openingCreditCents: 40, closingDebitCents: 20, markDebitCents: null, markAsOf: null, maxLossCents: 22_000, feesCents: 0, exitReason: "take_profit" });
const card = (basis: WiPositionRecord["basis"]) => buildWeeklyIncomeScorecard({ weekOf: "2026-10-12", weekStartMs: T, weekEndMs: T + 7_200_000, mondayEquityCents: 5_000_000, mondayEquityAsOf: T, positions: [position(basis)], skippedReasons: [], asOf: T + 7_200_000 }, basis);

describe("Weekly Income scorecard view (#86)", () => {
  beforeAll(() => { (globalThis as any).React = React; });
  afterAll(() => { delete (globalThis as any).React; });

  it("Quick Play: plain headline, sample limit, Main Street labels, clean language", () => {
    const $ = load(renderToStaticMarkup(<WeeklyIncomeScorecardView scorecard={card("paper_fill")} isGuided isExample />));
    expect($("[data-wi-scorecard-headline]").text()).toMatch(/^This week your practice account gained/);
    expect($("[data-wi-sample]").text()).toContain("process evidence");
    expect($("[data-wi-metric=net_kept] dt").text()).toBe("Kept after closing");
    expect($("[data-wi-counterfactual]")).toHaveLength(0);
    expect(passesWeeklyIncomeLanguage($.root().text())).toBe(true);
  });

  it("labels counterfactual scorecards 'Counterfactual, not a fill'", () => {
    const $ = load(renderToStaticMarkup(<WeeklyIncomeScorecardView scorecard={card("counterfactual")} isGuided={false} />));
    expect($("[data-wi-counterfactual]").text()).toBe("Counterfactual, not a fill");
    expect($("[data-wi-scorecard]").attr("data-basis")).toBe("counterfactual");
    expect($("[data-wi-metric=gross_premium]").text()).toContain("counterfactual · as of");
  });
});
