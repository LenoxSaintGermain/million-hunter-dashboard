import { describe, expect, it } from "vitest";
import { buildProgressiveEvidenceGate } from "@shared/evidenceGate";

describe("progressive Capital Aperture evidence gate", () => {
  it("keeps research navigation open while isolating decision-critical checks", () => {
    const priority = { id: 1, symbol: "LLY", confidenceScore: 0.7, memoStatus: "ok", verifyFields: ["valuation", "catalyst"] };
    const gate = buildProgressiveEvidenceGate(priority, [priority, { id: 2, symbol: "MCD", confidenceScore: 0.5, memoStatus: "pending", verifyFields: ["price", "sales", "margin"] }]);
    expect(gate).toMatchObject({ researchReady: true, paperOrderEligible: false, decisionCriticalCheckCount: 2, researchFollowUpCheckCount: 3 });
  });

  it("only opens paper-order eligibility after priority evidence and memo conditions are met", () => {
    const priority = { id: 1, symbol: "LLY", confidenceScore: 0.72, memoStatus: "ok", verifyFields: [] };
    expect(buildProgressiveEvidenceGate(priority, [priority]).paperOrderEligible).toBe(true);
  });
});
