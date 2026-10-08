import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { missionCapacityBreakdown, missionCapacityLines } from "../../shared/missionCapacity";
import { underwritePlayCandidates, type MarketRegimeSnapshot, type TargetFeasibility } from "../../shared/playUnderwriting";
import { MissionResultWorkspace } from "../../client/src/components/aperture/MissionResultWorkspace";
import { TargetFeasibilityCard } from "../../client/src/components/aperture/TargetFeasibilityCard";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

// The #20 shape: $249 effective at analysis, $2.82 left after the top play.
const saved = (overrides: { maxPlannedLossCents?: number; riskBudgetCents?: number } = {}) => ({
  objective: { maxPlannedLossCents: overrides.maxPlannedLossCents ?? 50_000 },
  feasibility: { riskBudgetCents: overrides.riskBudgetCents ?? 24_900, maxOpenRiskCents: 60_000, aggregateOpenRiskBeforeCents: 35_100, aggregatePolicyPct: 3 },
  plays: [{ sizing: { plannedRiskCents: 24_618 } }],
  portfolioRisk: { beforeCents: 35_100, hypotheticalAfterCents: 59_718, bindingConstraint: "risk_policy_or_portfolio_headroom", remainingHeadroomCents: 282 },
}) as unknown as Parameters<typeof missionCapacityBreakdown>[0];

describe("one Mission capacity number", () => {
  it("leads with the effective allowance and explains $2.82 as what is left after the top play", () => {
    const breakdown = missionCapacityBreakdown(saved());
    expect(breakdown.roomCents).toBe(24_900);
    expect(breakdown.parts.map(part => [part.label, part.cents, part.binding])).toEqual([
      ["Mission planned-loss limit", 50_000, false],
      ["Account open-risk room", 24_900, true],
    ]);
    const lines = missionCapacityLines(breakdown);
    // Saved before #19 (no ceiling status): its ceiling used declared capital, and says so.
    expect(lines[1]).toBe("Sets it · Account open-risk room: $249 (3% of declared capital = $600 ceiling − $351 already at risk; saved before the ceiling moved to account equity)");
    expect(lines[2]).toContain("After the top play ($246.18 planned loss), $2.82 of account room is left.");
    expect(lines[2]).toContain("alternatives, not all fundable together");
  });

  it("names the per-play/weekly limits when neither stored limit sets the number, and the mission limit when it does", () => {
    const policy = missionCapacityBreakdown(saved({ riskBudgetCents: 6_000 }));
    expect(policy.parts.at(-1)).toEqual({ label: "Per-play policy, weekly and event limits", cents: 6_000, detail: null, binding: true });
    expect(policy.parts.filter(part => part.binding)).toHaveLength(1);
    const mission = missionCapacityBreakdown(saved({ maxPlannedLossCents: 5_000, riskBudgetCents: 5_000 }));
    expect(mission.parts[0].binding).toBe(true);
    expect(mission.parts).toHaveLength(2);
  });

  it("shows one capacity figure on the saved result, with the breakdown readable without hover", () => {
    const now = Date.UTC(2026, 8, 9, 18);
    const metric = { direction: "unknown", value: null, asOf: null, freshness: "unknown", source: "Illustrative fixture" };
    const market = { asOf: now, marketSession: "closed", indexTrend: { spy: metric, qqq: metric, iwm: metric }, keyThemes: [], catalysts: [], regime: "unknown", confidence: 0 } as MarketRegimeSnapshot;
    const result = underwritePlayCandidates({ now, market, candidates: [], objective: {
      deployableCapitalCents: 800_000, targetProfitCents: null, targetPeriod: null,
      maxPlannedLossCents: 50_000, holdingPeriods: ["swing"], instrumentPreference: "either",
    }, risk: { normalPlayRiskPct: .75, highConvictionRiskPct: 1.25, maxAggregateOpenRiskPct: 3,
      weeklyLossLimitPct: 4, eventRiskAllocationPct: 1.5, perPlayHeadroomCents: 74_246,
      aggregateOpenRiskBeforeCents: 18_000, accountEquityCents: 800_000, weeklyLossUsedCents: 0 } });
    const $ = load(renderToStaticMarkup(React.createElement(MissionResultWorkspace, {
      result, accountLabel: "Illustrative Paper", accountAsOf: now, thesisLabel: "PW", revisionLabel: "v3",
      selectedPlayId: null, busy: false, onEdit: () => {}, onValidate: () => {}, riskDetails: null,
    })));
    const facts = $("[aria-label='Saved analysis boundaries']");
    expect(facts.text()).not.toContain("Portfolio risk headroom");
    const cell = facts.find("dt").filter((_, el) => $(el).text() === "Room for new planned loss").parent();
    expect(cell.find("dd").text()).toBe("$60");
    expect(cell.find("small").text()).toContain("candidates share it");
    expect(cell.find("#mission-capacity-breakdown").text()).toContain("Sets it · Account open-risk room: $60 (3% of $8,000 account equity = $240 ceiling − $180 already at risk)");
    expect($("[aria-label='How the room for new planned loss is set'] li").first().text()).toBe("Mission planned-loss limit: $500");
    expect($("button").text()).toBe("Edit mission");
  });

  it("labels the post-play remainder as such and never shows the aggregate ceiling as remaining", () => {
    const feasibility = { capitalBaseCents: 800_000, targetProfitCents: null, targetPeriod: null, requiredReturnPct: null, classification: "not_requested", targetPressure: 0,
      riskBudgetCents: 24_900, normalPlayRiskCents: 24_900, highConvictionRiskCents: 24_900, maxOpenRiskCents: 60_000, lossLimitCents: 32_000, assessment: "", mayInfluenceSizing: false } as TargetFeasibility;
    const played = load(renderToStaticMarkup(<TargetFeasibilityCard feasibility={feasibility} remainingHeadroomCents={282} operatorMaxLossCents={50_000} />));
    expect(played.text()).toContain("Account room left after the top play$3");
    const unknown = load(renderToStaticMarkup(<TargetFeasibilityCard feasibility={feasibility} remainingHeadroomCents={null} operatorMaxLossCents={50_000} />));
    expect(unknown.text()).toContain("Account room left after the top playNot measured");
    expect(unknown.text()).not.toContain("top play$600");
  });
});
