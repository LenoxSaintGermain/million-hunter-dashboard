import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("guided underwriting and returning check-in UX contracts", () => {
  it("hydrates an exact immutable receipt before rendering actionable inputs without loading another device's draft", () => {
    const runway = read("client/src/components/aperture/DecisionRunway.tsx");
    expect(runway).toContain("const persisted = receiptTarget ? null : draftQuery.data ?? null");
    expect(runway).toContain("hydratedDecisionRevisionId.current !== receiptTarget.revisionId");
    expect(runway).not.toContain("if (receiptTarget || draftInitialized || receiptLoading");
    expect(runway).toContain("setCapital(String(receipt.deployableCapitalCents / 100))");
    expect(runway).toContain("setMaxLoss(String(receipt.maxPlannedLossCents / 100))");
  });
  it("runs an authorized mission through to its usable result without another route or click", () => {
    const runway = read("client/src/components/aperture/DecisionRunway.tsx");
    const mission = read("client/src/pages/aperture/ApertureMission.tsx");
    const saveIndex = runway.indexOf("await saveMission.mutateAsync");
    const underwriteIndex = runway.indexOf("await runUnderwriting.mutateAsync", saveIndex);

    expect(saveIndex).toBeGreaterThan(-1);
    expect(underwriteIndex).toBeGreaterThan(saveIndex);
    expect(runway).toContain("Underwrite my mission");
    expect(runway).toContain("mission-underwriting-result");
    expect(mission).not.toContain("onOpenUnderwriting");
    expect(runway).not.toContain("Build today’s playbook");
  });

  it("shows feasibility, provenance, effective risk, and effect before the primary action", () => {
    const runway = read("client/src/components/aperture/DecisionRunway.tsx");
    const feasibility = runway.indexOf("Target feasibility ·");
    const action = runway.indexOf('id="mission-primary-action"');

    expect(feasibility).toBeGreaterThan(-1);
    expect(action).toBeGreaterThan(feasibility);
    expect(runway).toContain("never increases allowed risk");
    expect(runway).toContain("Allocated to this mission · not total account value");
    expect(runway).toContain("Your horizon determines which catalysts and review dates matter.");
    expect(runway).toContain("const explicitTargetProfitCents");
    expect(runway).toContain("const feasibilityHasExplicitTarget");
    expect(runway).toContain("desiredEndingValueCents: explicitTargetProfitCents == null ? null");
    expect(runway).toContain("trpc.aperture.underwriter.preview.useQuery");
    expect(runway).toContain("authoritativePreview.data?.feasibility");
    expect(runway).toContain("previewPortfolioRisk?.beforeCents");
    expect(runway).not.toContain("aggregateOpenRiskBeforeCents: 0");
  });

  it("keeps an absent target absent instead of reviving a legacy ending value", () => {
    const runway = read("client/src/components/aperture/DecisionRunway.tsx");
    const feasibility = read("client/src/components/aperture/TargetFeasibilityCard.tsx");

    expect(runway).toContain("const explicitTargetProfitCents");
    expect(runway).toContain("desiredEndingValueCents: explicitTargetProfitCents == null ? null");
    expect(runway).not.toContain("setTargetProfit(defaults.desiredEndingValueCents");
    expect(feasibility).toContain("const hasExplicitTarget");
    expect(feasibility).toContain("No profit target requested");
    expect(feasibility).toContain("{hasExplicitTarget ?");
  });

  it("distinguishes missing planned loss from exhausted portfolio headroom", () => {
    const runway = read("client/src/components/aperture/DecisionRunway.tsx");
    const feasibility = read("client/src/components/aperture/TargetFeasibilityCard.tsx");
    const brief = read("client/src/components/aperture/PlayUnderwritingBrief.tsx");

    expect(feasibility).toContain("feasibility.targetPeriod == null");
    expect(feasibility).toContain("portfolio_headroom_exhausted");
    expect(feasibility).toContain("Portfolio headroom exhausted");
    expect(feasibility).toContain("Your planned-loss limit is configured");
    expect(feasibility).toContain("No proposal capacity remains");
    expect(runway).toContain("Enter deployable capital in Account & risk.");
    expect(runway).toContain("Enter a planned-loss limit in Account & risk.");
    expect(brief).toContain("operatorMaxLossCents={result.objective.maxPlannedLossCents}");
  });

  it("makes a completed underwriting result the current mission state and prevents duplicate action", () => {
    const runway = read("client/src/components/aperture/DecisionRunway.tsx");
    const result = runway.indexOf("return <MissionResultWorkspace");
    const suggestions = runway.indexOf("Suggested missions");

    expect(runway).toContain("const underwritingMatchesInputs");
    expect(runway).toContain("const underwritingComplete");
    expect(runway).toContain("Underwriting complete · review result");
    expect(runway).toContain("!editingCompletedMission && !draftError && !missionContextError");
    expect(runway).toContain("No paper ticket has been created.");
    expect(result).toBeGreaterThan(-1);
    expect(suggestions).toBeGreaterThan(result);
    expect(runway).toContain("{!underwritingComplete && <footer");
    expect(runway).not.toContain('id="mission-underwriting-receipt"');
  });

  it("withholds the underwriting action while the persisted result is still loading", () => {
    const runway = read("client/src/components/aperture/DecisionRunway.tsx");

    expect(runway).toContain("const persistedUnderwritingLoading");
    expect(runway).toContain("currentDecisionRunId != null && currentUnderwriting.isLoading");
    expect(runway).toContain("underwritingResult.decisionRevisionId === currentDecisionRevisionId");
    expect(runway).toContain("Checking saved underwriting…");
    expect(runway).toContain("Checking saved result");
    expect(runway).toContain("persistedUnderwritingLoading || underwritingComplete");
  });

  it("makes the persisted completed result reachable from Today without inventing client lifecycle state", () => {
    const briefing = read("client/src/components/aperture/TodayAttentionBriefing.tsx");
    const attention = read("shared/apertureAttention.ts");

    expect(briefing).toContain("Review / revise mission");
    expect(briefing).not.toContain("aperture.underwriter.get.useQuery");
    expect(attention).toContain('kind: "underwriting_complete"');
    expect(attention).toContain("Review underwriting result");
    expect(attention).toContain("/aperture/decision/${input.underwriting.decisionRunId}/revision/${input.underwriting.revisionId}/underwrite");
  });

  it("puts conditional plays before supporting dashboards and labels risk honestly", () => {
    const brief = read("client/src/components/aperture/PlayUnderwritingBrief.tsx");
    const cards = brief.indexOf("Conditional playbook");
    const evidence = brief.indexOf("Evidence and calculations behind this result");
    const card = read("client/src/components/aperture/TradePlayCard.tsx");

    expect(cards).toBeGreaterThan(-1);
    expect(evidence).toBeGreaterThan(cards);
    expect(card).toContain("Planned loss at the modeled stop");
    expect(card).toContain("Scenario output withheld; fresh contract or market data is required.");
    expect(card).not.toContain("Max planned loss {money(play.sizing.maxLossCents)}");
  });

  it("keeps ordinary Today reads separate from deliberate analysis and lifecycle writes", () => {
    const daily = read("client/src/components/aperture/DailyPlayList.tsx");
    const briefing = read("client/src/components/aperture/TodayAttentionBriefing.tsx");

    expect(daily).toContain("<TodayAttentionBriefing");
    expect(daily).not.toContain("underwriter.run.useMutation");
    expect(briefing).toContain("desk.markSeen.useMutation");
    expect(briefing).toContain("An empty result is not treated as an all-clear");
    expect(briefing).not.toContain("underwriter.run.useMutation");
  });
});
