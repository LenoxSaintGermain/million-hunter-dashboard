import { describe, expect, it } from "vitest";
import { resolveEffectiveRiskCeilingPct, resolveEffectiveRiskLimit } from "../../shared/effectiveRiskLimit";

describe("effective mission risk limit", () => {
  it("keeps the account mandate controlling when the operator asks for more", () => {
    expect(resolveEffectiveRiskLimit(200_000, 74_255)).toEqual({
      effectiveLimitCents: 74_255,
      controllingLimit: "account_mandate",
    });
  });

  it("lets the operator tighten the account mandate", () => {
    expect(resolveEffectiveRiskLimit(50_000, 74_255)).toEqual({
      effectiveLimitCents: 50_000,
      controllingLimit: "operator",
    });
  });

  it("withholds an effective limit when either input is unknown", () => {
    expect(resolveEffectiveRiskLimit(null, 74_255)).toEqual({
      effectiveLimitCents: null,
      controllingLimit: "unknown",
    });
    expect(resolveEffectiveRiskLimit(50_000, null)).toEqual({
      effectiveLimitCents: null,
      controllingLimit: "unknown",
    });
  });
});

describe("mission limit enforcement", () => {
  it("translates a lower absolute mission limit into a tighter gate percentage", () => {
    expect(resolveEffectiveRiskCeilingPct(0.75, 10_000_000, 50_000)).toBe(0.5);
  });

  it("never lets the mission loosen the account percentage", () => {
    expect(resolveEffectiveRiskCeilingPct(0.75, 10_000_000, 200_000)).toBe(0.75);
  });

  it("retains the account percentage when mission authority is unavailable", () => {
    expect(resolveEffectiveRiskCeilingPct(0.75, 10_000_000, null)).toBe(0.75);
  });
});
