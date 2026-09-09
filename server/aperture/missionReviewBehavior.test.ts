import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { calculateTargetFeasibility, type CapitalObjective, type UnderwritingRiskPolicy } from "../../shared/playUnderwriting";
import { MissionHorizonSummary, MissionReviewFeasibility, missionEffectiveRiskSummary } from "../../client/src/components/aperture/DecisionRunway";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
const objective: CapitalObjective = {
  deployableCapitalCents: 2_500_000, targetProfitCents: 600_000, targetPeriod: "week",
  maxPlannedLossCents: 25_000, holdingPeriods: ["swing"], instrumentPreference: "shares",
};
const policy: UnderwritingRiskPolicy = {
  normalPlayRiskPct: 0.75, highConvictionRiskPct: 1.25, maxAggregateOpenRiskPct: 3,
  weeklyLossLimitPct: 4, eventRiskAllocationPct: 1.5, perPlayHeadroomCents: 74_200,
  aggregateOpenRiskBeforeCents: 0, weeklyLossUsedCents: 0,
};

describe("final Mission review decision context", () => {
  it("uses only authoritative feasibility in compact risk summaries during preview transitions", () => {
    const feasibility = calculateTargetFeasibility(objective, policy);
    expect(missionEffectiveRiskSummary(feasibility)).toBe("$187.50 effective risk");
    // A new objective query has no feasibility yet. Neither the account's
    // $750 ceiling nor the operator's $250 input is a substitute.
    expect(missionEffectiveRiskSummary(null)).toBe("Checking effective risk…");
    expect(missionEffectiveRiskSummary({ ...feasibility, riskBudgetCents: 0 })).toBe("$0 effective risk");
    expect(missionEffectiveRiskSummary(feasibility)).toBe("$187.50 effective risk");
  });

  it("exposes a persisted primary/scope mismatch without repairing it during display", () => {
    const underwriting: ["intraday"] = ["intraday"];
    const repair = vi.fn();
    const html = renderToStaticMarkup(React.createElement(MissionHorizonSummary, {
      primary: "swing", underwriting, onUsePrimary: repair,
    }));
    expect(html).toContain("Primary horizon");
    expect(html).toContain("This week");
    expect(html).toContain("Underwriting horizons");
    expect(html).toContain("Today / by close");
    expect(html).toContain('role="alert"');
    expect(html).toContain("The recorded horizons disagree");
    expect(html).toContain("Use primary horizon only");
    expect(html).toContain("Previous receipts and jobs remain unchanged");
    expect(repair).not.toHaveBeenCalled();
    expect(underwriting).toEqual(["intraday"]);
  });

  it("lists all underwriting horizons without a repair action when the primary is included", () => {
    const html = renderToStaticMarkup(React.createElement(MissionHorizonSummary, {
      primary: "swing", underwriting: ["swing", "intraday"], onUsePrimary: vi.fn(),
    }));
    expect(html).toContain("This week, Today / by close");
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Use primary horizon only");
  });

  it("renders the required 24% return and exact 187.50 constraint beside its inspect action", () => {
    const html = renderToStaticMarkup(React.createElement(MissionReviewFeasibility, {
      feasibility: calculateTargetFeasibility(objective, policy), enteredLossCents: 25_000,
      normalPolicyPct: 0.75, remainingHeadroomCents: 75_000, onInspect: vi.fn(),
    }));
    expect(html).toContain("24% per week required · extreme");
    expect(html).toContain("$6,000 target ÷ $25,000 declared mission capital");
    expect(html).toContain("You entered $250");
    expect(html).toContain("$187.50");
    expect(html).not.toContain("$188");
    expect(html).toContain("0.75% of your $25,000 declared capital ($187.50)");
    expect(html).toContain("Inspect effective constraint");
    expect(html).toContain("never increases allowed risk");
    expect(html).toContain("Effective normal-play risk");
    expect(html).not.toContain("Effective maximum loss");
  });

  it("does not substitute a stale/default risk or target when feasibility is missing", () => {
    const html = renderToStaticMarkup(React.createElement(MissionReviewFeasibility, {
      feasibility: null, enteredLossCents: 25_000, normalPolicyPct: 0.75,
      remainingHeadroomCents: null, onInspect: vi.fn(),
    }));
    expect(html).toContain("not verified yet");
    expect(html).not.toContain("$187.50");
    expect(html).not.toContain("24%");
    expect(html).toContain("Inspect account &amp; risk");
  });
});
