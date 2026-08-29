import { describe, expect, it } from "vitest";
import { evaluateThesisResearchReadiness } from "./thesisResearchReadiness";
import type { ThesisGraph } from "./thesisGraph";

const graph = (overrides: Partial<ThesisGraph> = {}): ThesisGraph => ({
  beliefs: ["Football demand and prediction-market regulation create a testable tension."],
  seek: ["Compare the evidence for DKNG."],
  avoid: ["No uncovered options."],
  horizons: ["Eight to sixteen weeks."],
  sectors: [],
  exclusions: [],
  portfolioRules: {},
  behavior: {},
  exposureTree: [],
  researchSymbols: ["DKNG"],
  evidenceRequirements: ["Verify the ruling and company exposure."],
  invalidationConditions: ["Invalidate if the mechanism cannot be verified."],
  instrumentPreference: "options",
  confidenceNotes: [],
  suggestedName: "Football Regulatory Split",
  ...overrides,
});

describe("Capital thesis research readiness", () => {
  it("blocks a manual draft with no searchable universe before a run can be created", () => {
    const result = evaluateThesisResearchReadiness(graph({ researchSymbols: [], exposureTree: [] }), {
      holdingPeriod: "position",
      instrumentPreference: "options",
      invalidationRule: "Invalidate if the mechanism cannot be verified.",
    });

    expect(result.ready).toBe(false);
    expect(result.missing).toContain("search universe");
  });

  it("accepts an operator-structured options thesis with an explicit symbol", () => {
    expect(evaluateThesisResearchReadiness(graph(), {
      holdingPeriod: "position",
      instrumentPreference: "options",
      invalidationRule: "Invalidate if the mechanism cannot be verified.",
    })).toMatchObject({ ready: true, declaredSymbols: ["DKNG"] });
  });

  it("fails closed when a run silently changes an options thesis into shares", () => {
    const result = evaluateThesisResearchReadiness(graph(), {
      holdingPeriod: "position",
      instrumentPreference: "shares",
      invalidationRule: "Invalidate if the mechanism cannot be verified.",
    });

    expect(result.ready).toBe(false);
    expect(result.incompatibilities.join(" ")).toMatch(/options.*shares/i);
  });
});
