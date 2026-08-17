import { describe, expect, it } from "vitest";
import { buildDecisionPath } from "@shared/decisionPath";

describe("buildDecisionPath", () => {
  it("prioritizes a saved fact-traced memo over secondary navigation", () => {
    expect(buildDecisionPath({ symbol: "LLY", memoStatus: "ok", decisionCriticalChecks: 2 })).toMatchObject({
      stage: "read_memo",
      label: "Read LLY decision record",
    });
  });

  it("isolates decision-critical checks from supporting research", () => {
    expect(buildDecisionPath({ symbol: "WMT", memoStatus: "pending", decisionCriticalChecks: 2 })).toMatchObject({
      stage: "resolve_checks",
      label: "Resolve 2 decisive checks",
    });
  });

  it("only points to paper readiness after evidence is clear", () => {
    expect(buildDecisionPath({ symbol: "CSCO", memoStatus: "pending", decisionCriticalChecks: 0 })).toMatchObject({
      stage: "prepare_paper_review",
    });
  });
});
