import { describe, expect, it } from "vitest";
import { buildCapitalThesisCompilationFields, normalizeCapitalThesisDetails } from "../../shared/capitalThesisStructure";
import { manualThesisProjection } from "../../shared/manualThesisProjection";

describe("Capital thesis structured authoring", () => {
  it("persists typed fields and carries them through an honest compiler fallback", () => {
    const details = normalizeCapitalThesisDetails({
      belief: "NFL demand may support licensed sportsbook engagement.",
      evidence: "Verify the ruling, company exposure, and next earnings date.",
      seeks: "Compare bullish and bearish DKNG expressions.",
      avoids: "No uncovered or multi-leg options.",
      horizon: "Eight to sixteen weeks.",
      holdingPeriod: "position",
      invalidation: "Invalidate if the mechanism cannot be verified.",
      risk: "Maximum premium at risk is $250.",
      symbols: "dkng, DKNG",
      instrument: "options",
    });
    const fields = buildCapitalThesisCompilationFields(details);
    const graph = manualThesisProjection("Football and regulation thesis.", "Football Regulatory Split", details);

    expect(details.researchSymbols).toEqual(["DKNG"]);
    expect(fields.compiledFilters).toMatchObject({ holdingPeriod: "position", instrumentPreference: "options", researchSymbols: ["DKNG"] });
    expect(fields.evidenceRequirements).toEqual([details.evidence]);
    expect(fields.autoDisqualifiers).toEqual([details.invalidation]);
    expect(graph).toMatchObject({
      researchSymbols: ["DKNG"],
      horizons: ["Eight to sixteen weeks."],
      evidenceRequirements: [details.evidence],
      invalidationConditions: [details.invalidation],
      instrumentPreference: "options",
    });
    expect(graph.confidenceNotes.join(" ")).toMatch(/operator-declared/i);
  });
});
