import { describe, expect, it } from "vitest";
import { normalizeCapitalThesisDetails } from "./capitalThesisStructure";
import { manualThesisProjection } from "./manualThesisProjection";

describe("manualThesisProjection", () => {
  it("preserves operator text while leaving every inferred field empty", () => {
    const graph = manualThesisProjection("  Rates may support duration only after confirmation.  ", "Rates Confirmation");
    expect(graph.beliefs).toEqual(["Rates may support duration only after confirmation."]);
    expect(graph.suggestedName).toBe("Rates Confirmation");
    expect(graph.exposureTree).toEqual([]);
    expect(graph.portfolioRules).toEqual({});
    expect(graph.horizons).toEqual([]);
    expect(graph.confidenceNotes[0]).toContain("compiler was unavailable");
  });

  it("carries explicit typed operator structure without presenting it as model inference", () => {
    const details = normalizeCapitalThesisDetails({
      belief: "NFL demand may support sportsbook engagement.",
      evidence: "Verify the ruling and company exposure.",
      seeks: "Compare DKNG expressions.",
      avoids: "No uncovered options.",
      horizon: "Eight to sixteen weeks.",
      holdingPeriod: "position",
      invalidation: "Invalidate if the mechanism cannot be verified.",
      risk: "Maximum premium at risk is $250.",
      symbols: ["DKNG"],
      instrument: "options",
    });
    const graph = manualThesisProjection(
      "Football demand and sports prediction-market regulation create a testable tension.",
      "Football Regulatory Split",
      details,
    );

    expect(graph.researchSymbols).toEqual(["DKNG"]);
    expect(graph.horizons).toEqual(["Eight to sixteen weeks."]);
    expect(graph.evidenceRequirements).toEqual(["Verify the ruling and company exposure."]);
    expect(graph.invalidationConditions).toEqual(["Invalidate if the mechanism cannot be verified."]);
    expect(graph.instrumentPreference).toBe("options");
    expect(graph.confidenceNotes.join(" ")).toMatch(/operator-declared/i);
  });
});
