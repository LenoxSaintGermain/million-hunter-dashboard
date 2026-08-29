import { describe, expect, it } from "vitest";
import {
  buildDecisionFocus,
  decisionPriority,
  describeCandidateRecommendation,
  rankResearchCandidates,
} from "../../shared/decisionFocus";

describe("portfolio-aware decision focus", () => {
  const lly = { symbol: "LLY", role: "remainder", compositeScore: 33, confidenceScore: 0.5, verifyFields: ["C: Price / earnings", "C: Price / sales"] };

  it("does not turn incomplete research into a return prediction", () => {
    const focus = buildDecisionFocus(lly, [{ symbol: "NVDA" }]);
    expect(focus.verdict).toBe("not_ready");
    expect(focus.returnOutlook).toMatch(/cannot establish/i);
    expect(focus.portfolioEffect).toMatch(/not held/i);
  });

  it("moves unresolved human checks above a lower-priority research lead", () => {
    expect(decisionPriority(lly)).toBeGreaterThan(decisionPriority({ ...lly, verifyFields: [], confidenceScore: 0.9, compositeScore: 80, role: "core" }));
  });

  it("keeps the candidate sequence aligned with the brief's research-fit order", () => {
    const ranked = rankResearchCandidates([
      { symbol: "DKNG", role: "remainder", compositeScore: 31, confidenceScore: 0.5, verifyFields: [] },
      { symbol: "MGM", role: "remainder", compositeScore: 34, confidenceScore: 0.5, verifyFields: [] },
      { symbol: "CZR", role: "remainder", compositeScore: 34, confidenceScore: 0.5, verifyFields: [] },
      { symbol: "BYD", role: "remainder", compositeScore: 32, confidenceScore: 0.5, verifyFields: [] },
    ]);

    expect(ranked.map((candidate) => candidate.symbol)).toEqual(["MGM", "CZR", "BYD", "DKNG"]);
  });

  it("describes a selected comparison candidate without calling it the brief lead", () => {
    const description = describeCandidateRecommendation({
      focusSymbol: "DKNG",
      leadSymbol: "MGM",
      alreadyHeld: false,
    });

    expect(description).toContain("DKNG is selected for comparison");
    expect(description).toContain("MGM remains the brief lead");
    expect(description).not.toContain("strongest current research lead");
  });
});
