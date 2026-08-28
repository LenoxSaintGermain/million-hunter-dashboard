import { describe, expect, it } from "vitest";
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
});
