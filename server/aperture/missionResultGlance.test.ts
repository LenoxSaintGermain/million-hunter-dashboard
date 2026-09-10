import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PlayUnderwritingBrief } from "../../client/src/components/aperture/PlayUnderwritingBrief";
import { MissionReviewFeasibility } from "../../client/src/components/aperture/DecisionRunway";
import { MissionResultWorkspace } from "../../client/src/components/aperture/MissionResultWorkspace";
import { underwritePlayCandidates, type MarketRegimeSnapshot } from "../../shared/playUnderwriting";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
const now = Date.UTC(2026, 8, 9, 18);
const metric = { direction: "unknown", value: null, asOf: null, freshness: "unknown", source: "Illustrative fixture" };
const market = { asOf: now, marketSession: "closed", indexTrend: { spy: metric, qqq: metric, iwm: metric }, keyThemes: [], catalysts: [], regime: "unknown", confidence: 0 } as MarketRegimeSnapshot;
const result = underwritePlayCandidates({ now, market, candidates: [], objective: {
  deployableCapitalCents: 800_000, targetProfitCents: null, targetPeriod: null,
  maxPlannedLossCents: 50_000, holdingPeriods: ["swing"], instrumentPreference: "either",
}, risk: { normalPlayRiskPct: .75, highConvictionRiskPct: 1.25, maxAggregateOpenRiskPct: 3,
  weeklyLossLimitPct: 4, eventRiskAllocationPct: 1.5, perPlayHeadroomCents: 74_246,
  aggregateOpenRiskBeforeCents: 162_000, weeklyLossUsedCents: 0 } });

describe("completed Mission glance", () => {
  it("never labels a no-new-trade receipt as zero total portfolio risk", () => {
    const source = readFileSync("client/src/components/aperture/DecisionRunway.tsx", "utf8");
    expect(source).not.toContain("$0 at risk");
    expect(source).toContain("$0 new allocation. Existing positions are unchanged.");
    expect(source).not.toContain("Math.round(receipt.deployableCapitalCents / 100)");
    expect(source).not.toContain("Math.round(receipt.maxPlannedLossCents / 100)");
  });
  it("renders the saved outcome without setup or suggestions and keeps identity, inspection, and editing accessible", () => {
    const onEdit = vi.fn(); const onValidate = vi.fn();
    const $ = load(renderToStaticMarkup(React.createElement(MissionResultWorkspace, {
      result, accountLabel: "Illustrative Paper", accountAsOf: now, thesisLabel: "Illustrative PW", revisionLabel: "v3",
      selectedPlayId: null, busy: false, onEdit, onValidate,
      riskDetails: React.createElement("details", {}, React.createElement("summary", {}, "Inspect effective constraint")),
    })));
    expect($("[aria-label='Completed mission']")).toHaveLength(1);
    expect($("#mission-underwriting-result [aria-label='No new trade']")).toHaveLength(1);
    expect($("#mission-underwriting-result").index()).toBeLessThan($("[aria-label='Saved mission summary']").index());
    expect($("input,select,textarea")).toHaveLength(0);
    expect($("button").text()).toBe("Edit mission");
    expect($.text()).not.toContain("Suggested missions");
    expect($.text()).not.toContain("Confirm the mission before analysis");
    expect($.text()).toContain("Illustrative Paper · Paper");
    expect($.text()).toContain("$8,000 allocated");
    expect($.text()).toContain("$0 effective at analysis");
    expect($.text()).toContain("not a current eligibility check");
    expect($("time").attr("datetime")).toBe(new Date(now).toISOString());
    expect(onEdit).not.toHaveBeenCalled(); expect(onValidate).not.toHaveBeenCalled();
  });
  it("states the no-trade reason once, without empty playbook headings or an order mutation", () => {
    const validate = vi.fn();
    const $ = load(renderToStaticMarkup(React.createElement(PlayUnderwritingBrief, { result, selectedPlayId: null, busy: false, onValidate: validate })));
    $("details").remove();
    const text = $.text();
    expect(text.split(result.noTrade!.explanation)).toHaveLength(2);
    expect(text).not.toContain("Best plays—or sit out");
    expect(text).not.toContain("Mission synthesis");
    expect(text).toContain("No new trade");
    expect(text).toContain("Existing positions are unchanged");
    expect(text).toContain(result.noTrade!.reopenCondition);
    expect(validate).not.toHaveBeenCalled();
  });

  it("keeps the entered limit, effective allowance and binding reason in the glance without an absent-target lecture", () => {
    const inspect = vi.fn();
    const $ = load(renderToStaticMarkup(React.createElement(MissionReviewFeasibility, { feasibility: result.feasibility,
      enteredLossCents: 50_000, normalPolicyPct: .75, remainingHeadroomCents: 0, onInspect: inspect })));
    $("details").remove();
    const text = $.text();
    expect(text).toContain("You entered $500");
    expect(text).toContain("$0");
    expect(text).toContain("Existing open risk");
    expect(text).not.toContain("No profit target requested");
    expect(text).not.toContain("Target excluded from risk sizing");
    expect(inspect).not.toHaveBeenCalled();
  });
});
