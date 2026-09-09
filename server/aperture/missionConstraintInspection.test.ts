import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { calculateTargetFeasibility } from "../../shared/playUnderwriting";
import { MissionReviewFeasibility, MissionRiskInspection } from "../../client/src/components/aperture/DecisionRunway";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
const asOf = Date.UTC(2026, 8, 9, 14);
const feasibility = calculateTargetFeasibility({
  deployableCapitalCents: 800_000, maxPlannedLossCents: 50_000,
  targetProfitCents: null, targetPeriod: null, holdingPeriods: ["swing"], instrumentPreference: "either",
}, {
  normalPlayRiskPct: 0.75, highConvictionRiskPct: 1.25, maxAggregateOpenRiskPct: 3,
  weeklyLossLimitPct: 4, eventRiskAllocationPct: 1.5, perPlayHeadroomCents: 74_246,
  aggregateOpenRiskBeforeCents: 30_000, weeklyLossUsedCents: 0,
});
const inspection = {
  accountId: 42, accountLabel: "Illustrative Alpaca Paper", accountAsOf: asOf,
  calculationAsOf: asOf, calculationBasis: "Current mission preview",
  loading: false, failed: false, feasibility, headroomAsOf: asOf,
  risk: { normalPlayRiskPct: 0.75, highConvictionRiskPct: 1.25, maxAggregateOpenRiskPct: 3,
    weeklyLossLimitPct: 4, eventRiskAllocationPct: 1.5, perPlayHeadroomCents: 74_246,
    aggregateOpenRiskBeforeCents: 30_000, weeklyLossUsedCents: 0 },
  lines: [{ key: "position", label: "Largest single name", subject: "NVDA", usedCents: 1_030_000,
    ceilingCents: 1_000_000, remainingCents: 0, usedPct: 103, ceilingPct: 10,
    basis: "market_value", reason: null }],
};
function render(overrides: Record<string, unknown> = {}) {
  const refresh = vi.fn();
  const props = { feasibility, enteredLossCents: 50_000, normalPolicyPct: 0.75, policyVersion: "v2",
    accountCeilingCents: 74_246, openRiskCents: 30_000, remainingHeadroomCents: 0,
    inspection, onInspect: refresh, ...overrides };
  const html = renderToStaticMarkup(React.createElement(MissionReviewFeasibility, props));
  return { $: load(html), html, refresh };
}

describe("UAT-06 effective constraint inspection", () => {
  it("opens an adjacent native disclosure instead of a tuning or navigation callback", () => {
    const { $, refresh } = render();
    const disclosure = $('details[data-risk-inspection]');
    expect(disclosure).toHaveLength(1);
    expect(disclosure.attr("open")).toBeUndefined();
    expect(disclosure.find("summary").text()).toContain("Inspect effective constraint");
    expect(disclosure.find("summary").attr("class")).toContain("min-h-11");
    expect(disclosure.find("input,select,textarea")).toHaveLength(0);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows the exact account, declared capital, binding aggregate math and named portfolio exposure", () => {
    const { $, html } = render();
    const text = $('details[data-risk-inspection]').text();
    expect(text).toContain("Illustrative Alpaca Paper");
    expect(text).toContain("Account #42");
    expect(text).toContain("$8,000");
    expect(text).toContain("$500");
    expect(text).toContain("0.75% × $8,000 = $60");
    expect(text).toContain("$240 − $300 = $0");
    expect(text).toContain("$742.46");
    expect(text).toContain("Largest single name · NVDA");
    expect(text).toContain("$10,300");
    expect(text).toContain("$10,000");
    expect(text).toContain("not additional mission capital");
    expect(text).toContain("Current mission preview");
    expect($('details time[datetime="2026-09-09T14:00:00.000Z"]').length).toBeGreaterThan(0);
    expect(html).toContain("Your entered loss limit has not been changed");
  });

  it.each(["loading", "failed"])("keeps %s uncertainty and recovery next to the cached calculation", state => {
    const { $, refresh } = render({ inspection: { ...inspection, [state]: true } });
    expect($('[role="status"]').text()).toContain(state === "loading" ? "Refreshing constraints" : "Constraint refresh failed");
    expect($('[role="status"]').parents("details")).toHaveLength(0);
    expect($('[role="status"]').text()).toContain("Recorded values");
    expect($('details button').text()).toContain("Refresh constraints");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not replace missing limits with zero or imply that current limits are confirmed", () => {
    const { $ } = render({ feasibility: null, accountCeilingCents: null, openRiskCents: null,
      remainingHeadroomCents: null, inspection: { ...inspection, feasibility: null, risk: null, accountAsOf: null, lines: [], failed: true } });
    const text = $('details[data-risk-inspection]').text();
    expect(text).toContain("Not measured");
    expect(text).not.toContain("= $0");
    expect(text).toContain("Refresh constraints");
  });

  it("wires Account and Review to the same read-only inspection context, never Tune this run", () => {
    const source = readFileSync("client/src/components/aperture/DecisionRunway.tsx", "utf8");
    const callers = source.match(/<MissionReviewFeasibility\b[^>]*(?:=>[^>]*)?\/>/g) ?? [];
    expect(callers).toHaveLength(2);
    for (const caller of callers) {
      expect(caller).toContain("inspection={riskInspection}");
      expect(caller).toContain("onInspect={refreshRiskInspection}");
      expect(caller).not.toContain("setShowTune");
      expect(caller).not.toContain("openDiagnostic");
    }
  });

  it("labels a stale account snapshot without claiming that a status refresh syncs the broker", () => {
    const { $ } = render({ inspection: { ...inspection, accountAsOf: asOf - 86_400_000 } });
    expect($("details").text()).toContain("Account snapshot was stale at calculation time");
    expect($("details").text()).toContain("reads saved account data");
  });

  it.each([
    { label: "available", loading: false, accountId: 42, refreshes: 1 },
    { label: "in-flight", loading: true, accountId: 42, refreshes: 0 },
    { label: "no account", loading: false, accountId: null, refreshes: 0 },
  ])("refresh callback is guarded for $label and inspection itself invokes no operation", ({ loading, accountId, refreshes }) => {
    const refresh = vi.fn();
    const context = { ...inspection, loading, accountId };
    const before = JSON.stringify(context);
    const root = MissionRiskInspection({ context, enteredLossCents: 50_000, policyVersion: "v2", onRefresh: refresh });
    const elements = (node: React.ReactNode): React.ReactElement<any>[] => {
      if (!React.isValidElement<any>(node)) return [];
      return [node, ...React.Children.toArray(node.props.children).flatMap(elements)];
    };
    const summary = elements(root).find(node => node.type === "summary")!;
    expect(summary.props.onClick).toBeUndefined(); // Native disclosure never runs a mutation callback.
    expect(refresh).not.toHaveBeenCalled();
    const button = elements(root).find(node => node.props.children === "Refresh constraints")!;
    button.props.onClick(); // Exercise the real component event handler, not a copied predicate.
    expect(refresh).toHaveBeenCalledTimes(refreshes);
    expect(JSON.stringify(context)).toBe(before);
  });
});
