import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_EQUITY_NOT_MEASURED,
  calculateTargetFeasibility,
  measuredAccountEquityCents,
  underwritePlayCandidates,
  type CapitalObjective,
  type MarketRegimeSnapshot,
  type UnderwritingRiskPolicy,
} from "../../shared/playUnderwriting";
import { missionCapacityBreakdown, missionCapacityLines } from "../../shared/missionCapacity";
import { STALE_ACCOUNT_MS } from "../../shared/cockpitRailSummary";
import { MissionResultWorkspace } from "../../client/src/components/aperture/MissionResultWorkspace";
import { TargetFeasibilityCard } from "../../client/src/components/aperture/TargetFeasibilityCard";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

// #19: the 3% account-wide planned-loss ceiling is a share of measured account
// equity. Declared mission capital may size a play but never raises the ceiling.
const objective = (deployableCapitalCents: number): CapitalObjective => ({
  deployableCapitalCents, targetProfitCents: null, targetPeriod: null,
  maxPlannedLossCents: 1_000_000, maxPortfolioOpenRiskCents: null, weeklyLossLimitCents: null, eventRiskLimitCents: null,
  holdingPeriods: ["swing"], instrumentPreference: "either",
});
const risk = (accountEquityCents: number | null, aggregateOpenRiskBeforeCents = 18_000): UnderwritingRiskPolicy => ({
  normalPlayRiskPct: 0.75, highConvictionRiskPct: 1.25, maxAggregateOpenRiskPct: 3,
  weeklyLossLimitPct: 4, eventRiskAllocationPct: 1.5, perPlayHeadroomCents: 10_000_000,
  aggregateOpenRiskBeforeCents, accountEquityCents, weeklyLossUsedCents: 0,
});
const now = Date.UTC(2026, 9, 8, 15);
const metric = { direction: "unknown", value: null, asOf: null, freshness: "unknown", source: "Illustrative fixture" };
const market = { asOf: now, marketSession: "closed", indexTrend: { spy: metric, qqq: metric, iwm: metric }, keyThemes: [], catalysts: [], regime: "unknown", confidence: 0 } as MarketRegimeSnapshot;

describe("account-wide ceiling is 3% of account equity (#19)", () => {
  it("a bigger declared capital does not increase account-wide headroom", () => {
    const small = calculateTargetFeasibility(objective(800_000), risk(1_000_000));
    const large = calculateTargetFeasibility(objective(50_000_000), risk(1_000_000));
    expect(large.maxOpenRiskCents).toBe(small.maxOpenRiskCents);
    expect(large.maxOpenRiskCents).toBe(30_000);
    // With $180 already at risk, only $120 of account room remains however much capital is declared.
    expect(large.riskBudgetCents).toBe(12_000);
    // Per-play sizing may still follow declared capital (0.75% of $8,000 = $60), but never above the account room.
    expect(small.riskBudgetCents).toBe(6_000);
    expect(calculateTargetFeasibility(objective(5_000_000), risk(1_000_000)).riskBudgetCents).toBe(large.riskBudgetCents);
    expect(missionCapacityBreakdown(underwritePlayCandidates({ now, market, candidates: [], objective: objective(50_000_000), risk: risk(1_000_000) })).parts[1].cents).toBe(12_000);
  });

  it("account equity drives the ceiling", () => {
    const lower = calculateTargetFeasibility(objective(2_500_000), risk(400_000, 0));
    const higher = calculateTargetFeasibility(objective(2_500_000), risk(4_000_000, 0));
    expect(lower).toMatchObject({ maxOpenRiskCents: 12_000, accountEquityCents: 400_000, aggregateCeilingStatus: "measured" });
    expect(higher).toMatchObject({ maxOpenRiskCents: 120_000, accountEquityCents: 4_000_000, aggregateCeilingStatus: "measured" });
    // An operator portfolio cap can still only tighten it.
    expect(calculateTargetFeasibility({ ...objective(2_500_000), maxPortfolioOpenRiskCents: 50_000 }, risk(4_000_000, 0)).maxOpenRiskCents).toBe(50_000);
  });

  it("names the equity basis in the room breakdown and the result header", () => {
    const result = underwritePlayCandidates({ now, market, candidates: [], objective: { ...objective(5_000_000), maxPlannedLossCents: 50_000 }, risk: risk(800_000) });
    expect(missionCapacityLines(missionCapacityBreakdown(result))[1]).toBe("Sets it · Account open-risk room: $60 (3% of $8,000 account equity = $240 ceiling − $180 already at risk)");
    const $ = load(renderToStaticMarkup(React.createElement(MissionResultWorkspace, {
      result, accountLabel: "Illustrative Paper", accountAsOf: now, thesisLabel: "PW", revisionLabel: "v3",
      selectedPlayId: null, busy: false, onEdit: () => {}, onValidate: () => {}, riskDetails: null,
    })));
    const cell = $("[aria-label='Saved analysis boundaries'] dt").filter((_, el) => $(el).text() === "Room for new planned loss").parent();
    expect(cell.find("dd").text()).toBe("$60");
    expect(cell.find("small").text()).toContain("the account ceiling is 3% of account equity");
  });

  it("missing or stale equity means the ceiling is not measured and blocks, with no fallback to declared capital", () => {
    const feasibility = calculateTargetFeasibility(objective(5_000_000), risk(null, 0));
    expect(feasibility).toMatchObject({ aggregateCeilingStatus: "not_measured", accountEquityCents: null, maxOpenRiskCents: 0, riskBudgetCents: 0 });
    expect(feasibility.clarification).toBe(ACCOUNT_EQUITY_NOT_MEASURED);

    const result = underwritePlayCandidates({ now, market, candidates: [], objective: objective(5_000_000), risk: risk(null, 0) });
    expect(result.plays).toHaveLength(0);
    expect(result.noTrade?.reason).toBe("other");
    expect(result.noTrade?.explanation).toContain("not measured");
    expect(result.portfolioRisk.remainingHeadroomCents).toBeNull();

    const capacity = missionCapacityBreakdown(result);
    expect(capacity).toMatchObject({ roomCents: null, notMeasured: true, afterTopPlay: null });
    expect(missionCapacityLines(capacity)[1]).toContain("Blocks it · Account open-risk room: Not measured");

    const $ = load(renderToStaticMarkup(React.createElement(MissionResultWorkspace, {
      result, accountLabel: "Illustrative Paper", accountAsOf: now, thesisLabel: "PW", revisionLabel: "v3",
      selectedPlayId: null, busy: false, onEdit: () => {}, onValidate: () => {}, riskDetails: null,
    })));
    const cell = $("[aria-label='Saved analysis boundaries'] dt").filter((_, el) => $(el).text() === "Room for new planned loss").parent();
    expect(cell.find("dd").text()).toBe("Not measured");
    expect(cell.find("small").text()).toContain("Blocked: account equity not measured");

    const card = load(renderToStaticMarkup(<TargetFeasibilityCard feasibility={feasibility} remainingHeadroomCents={null} operatorMaxLossCents={1_000_000} />)).text();
    expect(card).toContain("Not measured aggregate (3% of account equity)");
    expect(card).toContain("Account risk ceiling not measured · blocked");
    expect(card).not.toContain("$1,500");
  });

  it("only a positive equity from a snapshot under 4 hours old is measured", () => {
    expect(measuredAccountEquityCents({ equityValueCents: 800_000, stalenessMs: 60_000 }, STALE_ACCOUNT_MS)).toBe(800_000);
    expect(measuredAccountEquityCents({ equityValueCents: 800_000, stalenessMs: STALE_ACCOUNT_MS + 1 }, STALE_ACCOUNT_MS)).toBeNull();
    expect(measuredAccountEquityCents({ equityValueCents: 800_000, stalenessMs: null }, STALE_ACCOUNT_MS)).toBeNull();
    expect(measuredAccountEquityCents({ equityValueCents: null, stalenessMs: 0 }, STALE_ACCOUNT_MS)).toBeNull();
    expect(measuredAccountEquityCents({ equityValueCents: 0, stalenessMs: 0 }, STALE_ACCOUNT_MS)).toBeNull();
  });

  it("every server risk policy reads measured equity, and the preview reports not-measured as its own constraint", () => {
    const router = readFileSync("server/apertureRouter.ts", "utf8");
    const underwriter = readFileSync("server/aperture/underwriter.ts", "utf8");
    expect(router).toContain("accountEquityCents: measuredAccountEquityCents(cockpit.account, STALE_ACCOUNT_MS)");
    expect(router).toContain('"account_equity_not_measured" as const');
    expect(underwriter.match(/accountEquityCents: measuredAccountEquityCents\(input\.cockpit\.account, STALE_ACCOUNT_MS\)/g)).toHaveLength(2);
    expect(readFileSync("client/src/components/aperture/ObjectiveMissionFlow.tsx", "utf8")).toContain("account_equity_not_measured:");
    expect(readFileSync("client/src/components/aperture/DecisionRunway.tsx", "utf8")).toContain('previewFeasibility?.aggregateCeilingStatus === "not_measured"');
  });
});
