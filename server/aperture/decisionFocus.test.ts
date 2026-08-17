import { describe, expect, it } from "vitest";
import { buildDecisionFocus, decisionPriority } from "../../shared/decisionFocus";

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
});
