import { describe, expect, it } from "vitest";
import { isCapitalThesisEligible } from "../shared/capitalThesisEligibility";

describe("isCapitalThesisEligible", () => {
  it("accepts a canonical Capital / Trade thesis", () => {
    expect(isCapitalThesisEligible({ templateUsed: "capital_trade", isActiveCapital: false })).toBe(true);
  });

  it("rejects a stale active pointer to a non-Capital thesis", () => {
    expect(isCapitalThesisEligible({ templateUsed: "stage1_recovery", isActiveCapital: true })).toBe(false);
  });
});
