import { describe, expect, it } from "vitest";
import { buildCapitalDecisionBrief } from "./decisionBrief";

describe("buildCapitalDecisionBrief", () => {
  it("turns a candidate set into an evidence-first horizon-aware next decision", () => {
    const brief = buildCapitalDecisionBrief({
      graph: {
        beliefs: ["Data-center power bottlenecks matter."],
        seek: ["Grid equipment"],
        avoid: ["Illiquid names"],
        horizons: ["5–20 trading days"],
      },
      run: { deployableCapitalCents: 2_500_000, hurdleRateBps: 800, intendedTrades: [{ symbol: "NVDA" }] },
      candidates: [
        { id: 1, symbol: "CORE", role: "core", compositeScore: 82, confidenceScore: 0.72, verifyFields: ["price"], memoStatus: "pending" },
        { id: 2, symbol: "ALT", role: "alternative_expression", compositeScore: 91, confidenceScore: 0.3, verifyFields: [], memoStatus: "pending" },
      ],
      strategies: [{ id: 7, kind: "risk_balanced", label: "Risk-balanced research posture", rationale: "Retain reserve", allocations: [], cashRetainedCents: 400_000, portfolioImpact: null }],
      coverage: [{ nodePath: "AI / Power", symbol: "NVDA", source: "holding" }],
      thesisNodePaths: ["AI / Power", "AI / Cooling"],
    });

    expect(brief.horizon.label).toBe("5–20 trading days");
    expect(brief.priorityCandidate?.symbol).toBe("CORE");
    expect(brief.nextDecision.stage).toBe("validate_evidence");
    expect(brief.portfolioContext.uncoveredNodes).toEqual(["AI / Cooling"]);
    expect(brief.recommendedResearchPosture?.strategyId).toBe(7);
  });

  it("does not fabricate a horizon when the thesis does not specify one", () => {
    const brief = buildCapitalDecisionBrief({
      graph: {},
      run: { deployableCapitalCents: 100_000, hurdleRateBps: null, intendedTrades: [] },
      candidates: [],
      strategies: [],
      coverage: [],
      thesisNodePaths: [],
    });

    expect(brief.horizon.specified).toBe(false);
    expect(brief.nextDecision.stage).toBe("set_horizon");
  });
});
