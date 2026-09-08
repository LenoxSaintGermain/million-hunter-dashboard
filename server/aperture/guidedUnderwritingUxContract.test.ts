import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("guided underwriting and returning check-in UX contracts", () => {
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
    const feasibility = runway.indexOf("Target feasibility · before underwriting");
    const action = runway.indexOf('id="mission-primary-action"');

    expect(feasibility).toBeGreaterThan(-1);
    expect(action).toBeGreaterThan(feasibility);
    expect(runway).toContain("Target excluded from risk sizing");
    expect(runway).toContain("Allocated to this mission · not total account value");
    expect(runway).toContain("Your horizon determines which catalysts and review dates matter.");
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
  });
});
