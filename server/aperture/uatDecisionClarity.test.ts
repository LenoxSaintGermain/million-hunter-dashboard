import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TodayAttentionBriefing } from "../../client/src/components/aperture/TodayAttentionBriefing";
import { CapitalCockpitRail } from "../../client/src/components/aperture/CapitalCockpitRail";
import { MissionResultWorkspace } from "../../client/src/components/aperture/MissionResultWorkspace";
import { deriveApertureAttention, type ApertureAttentionInput } from "../../shared/apertureAttention";

/**
 * Narrow-viewport decision prominence, reviewed against the deployed
 * `uat-7dc389ef` revision on 2026-09-10. Three observed problems:
 *  1. repeated account/paper chrome pushes the decision down;
 *  2. a utilization number sits beside "blocked" without reconciling them;
 *  3. the no-trade receipt restates itself.
 * These assert presentation only. No claim is verified or relabelled here.
 */

const mocks = vi.hoisted(() => ({
  account: { data: undefined as any, isLoading: false, error: null as any, refetch: vi.fn() },
  cockpit: vi.fn(),
  mutate: vi.fn(),
}));
vi.mock("@/lib/trpc", () => ({ trpc: { aperture: {
  account: { list: { useQuery: () => mocks.account } },
  cockpit: { useQuery: mocks.cockpit },
  cockpitPreference: { get: { useQuery: () => ({ data: null }) }, set: { useMutation: () => ({ mutate: vi.fn() }) } },
  desk: { markSeen: { useMutation: () => ({ mutate: mocks.mutate }) } },
} } }));

const now = Date.UTC(2026, 8, 10, 14);
function attention(overrides: Partial<ApertureAttentionInput> = {}) {
  return deriveApertureAttention({
    now, mission: { decisionRunId: 1, revisionId: 2, state: "complete", title: "Illustrative test mission", updatedAt: now },
    underwriting: null, evidenceTasks: [], orders: [], activePlays: [], pendingReviews: [], monitoringFindings: [],
    checks: { state: "complete", asOf: now, monitoring: "on_demand" }, ...overrides,
  }, null);
}
const today = () => renderToStaticMarkup(createElement(TodayAttentionBriefing, {
  attention: attention(), accountLabel: "Alpaca Paper — AI Thesis", modeLabel: "Paper",
  loading: false, failed: null, onOpen: vi.fn(), onRetry: vi.fn(), onNewMission: vi.fn(),
}));

describe("Today briefing header does not stack repeated account chrome above the decision", () => {
  beforeAll(() => vi.stubGlobal("React", React));
  afterAll(() => vi.unstubAllGlobals());

  it("states the mode and the account on one line instead of two stacked blocks", () => {
    const $ = load(today());
    const header = $("[aria-labelledby='today-briefing-title'] > header");
    expect(header).toHaveLength(1);
    // Before: an eyebrow paragraph AND a separate account paragraph.
    expect(header.find("p")).toHaveLength(1);
    const line = header.find("p").text();
    expect(line).toContain("Paper");
    expect(line).toContain("Alpaca Paper — AI Thesis");
  });

  it("keeps exactly one page heading and never drops the account identity", () => {
    const $ = load(today());
    expect($("h1")).toHaveLength(1);
    expect($("h1").attr("id")).toBe("today-briefing-title");
    expect($.text()).toContain("Alpaca Paper — AI Thesis");
  });
});

describe("A blocking constraint reconciles its utilization number with its blocked state", () => {
  beforeAll(() => vi.stubGlobal("React", React));
  afterAll(() => vi.unstubAllGlobals());
  beforeEach(() => {
    mocks.account.data = [{ id: 77, isPaper: true, brokerId: "alpaca_paper" }];
    mocks.account.isLoading = false; mocks.account.error = null;
  });

  const critical = {
    account: { id: 77, label: "Alpaca Paper — AI Thesis", isPaper: true, equityValueCents: 10_000_00, cashCents: 1_000_00, stalenessMs: 60_000, lastSyncedAt: now, syncError: null, unavailableReason: null },
    activeThesis: { id: 1, name: "PW" },
    session: { session: "regular", nextBoundary: { label: "Regular session closes", at: now + 3_600_000 }, msToNextBoundary: 3_600_000, halfDay: false, unavailableReason: null },
    mandate: { version: "v1", maxOrderNotionalCents: 5_000_00, maxPlannedRiskPctPerPlay: 2, maxDailyPlannedRiskPct: 5 },
    headroom: { lines: [{ key: "concentration_notional", label: "Concentration", subject: "NVDA", usedCents: 9_900_00, ceilingCents: 10_000_00, remainingCents: 100_00, usedPct: 99, ceilingPct: 100, basis: "measured", reason: null }] },
  };

  it("explains, beside the percentage, that the block applies to new exposure only", () => {
    mocks.cockpit.mockReturnValue({ data: critical, isLoading: false, error: null });
    const html = renderToStaticMarkup(createElement(CapitalCockpitRail));
    expect(html).toContain("99% used");
    expect(html).toContain("New exposure that relies on NVDA is blocked");
    expect(html).toContain("existing positions are unchanged");
    // The number and the state must be tied together, not merely adjacent.
    expect(html).toMatch(/NVDA uses 99% of its ceiling/);
  });

  it("does not hide that reconciliation behind the collapsed state", () => {
    // SSR cannot reach the expanded branch (its state is applied in an effect),
    // so this guards the source condition directly, as other contracts here do.
    const source = readFileSync("client/src/components/aperture/CapitalCockpitRail.tsx", "utf8");
    expect(source).not.toMatch(/severity === "critical" && !expanded/);
  });
});

describe("The no-trade receipt states its consequence once", () => {
  beforeAll(() => vi.stubGlobal("React", React));
  afterAll(() => vi.unstubAllGlobals());

  const result: any = {
    asOf: now, noTrade: { explanation: "No measured risk capacity remains inside the current portfolio and mission limits.", reopenCondition: "Reduce existing open risk or revise the mandate before re-underwriting.", reviewAt: null },
    plays: [], tacticalTheses: [], selectedPlayId: null,
    market: { asOf: now, regime: "unknown", marketSession: "regular", confidence: 0, indexTrend: {}, catalysts: [] },
    feasibility: { riskBudgetCents: 0, maxOpenRiskCents: 0, lossLimitCents: 0, requiredReturnPct: 0, classification: "unknown" },
    portfolioRisk: { beforeCents: 0, remainingHeadroomCents: 0 },
    objective: { deployableCapitalCents: 800_000, holdingPeriods: ["swing"], instrumentPreference: "either", maxPlannedLossCents: 50_000, targetProfitCents: null, targetPeriod: null },
  };
  const mission = () => renderToStaticMarkup(createElement(MissionResultWorkspace, {
    result, accountLabel: "Alpaca Paper — AI Thesis", accountAsOf: now, thesisLabel: "PW",
    revisionLabel: "mission v6", selectedPlayId: null, busy: false, riskDetails: null,
    onEdit: vi.fn(), onValidate: vi.fn(),
  }));

  it("keeps both substantive claims while dropping the restated sentence", () => {
    const text = load(mission()).text();
    expect(text).toContain("No new trade");
    expect(text).toContain("No paper ticket created");
    expect(text).toContain("existing positions unchanged");
    expect(text).not.toContain("No paper ticket has been created. Existing positions are unchanged.");
  });

  it("puts the mission result heading above its account line rather than below it", () => {
    const $ = load(mission());
    const header = $("[aria-label='Completed mission'] > header");
    expect(header.find("p")).toHaveLength(1);
    expect(header.children().first().is("div")).toBe(true);
    expect($.text()).toContain("Alpaca Paper — AI Thesis");
  });
});
