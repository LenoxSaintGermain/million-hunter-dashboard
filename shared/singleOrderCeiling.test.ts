/**
 * Telling an operator what their declared capital buys, before they research.
 *
 * The case this exists for: $2,000 declared, a 5% single-name policy, a $100
 * ceiling, and a refiner universe priced $264–$398. Every candidate was
 * unreachable and nothing said so until the evidence stage.
 */
import { describe, it, expect } from "vitest";
import { buildSingleOrderCeilingPreview, describeSingleOrderCeiling } from "./singleOrderCeiling";

const input = {
  policyCeilingCents: 10_000,        // 5% of $2,000
  policyPctOfEquity: 5,
  equityCents: 200_000,              // $2,000 declared paper account
  declaredCapitalCents: 40_000,      // $400 mission capital
};

describe("which limit binds", () => {
  it("names account policy when it is the lower allowance", () => {
    const preview = buildSingleOrderCeilingPreview(input);
    expect(preview.ceilingCents).toBe(10_000);
    expect(preview.binding).toBe("account_policy");
  });

  it("names declared capital when the operator asked for less than policy allows", () => {
    const preview = buildSingleOrderCeilingPreview({ ...input, declaredCapitalCents: 5_000 });
    expect(preview.ceilingCents).toBe(5_000);
    expect(preview.binding).toBe("declared_capital");
  });

  it("does not have to pick when they are the same", () => {
    expect(buildSingleOrderCeilingPreview({ ...input, declaredCapitalCents: 10_000 }).binding).toBe("equal");
  });

  it("never rounds the ceiling up past either input", () => {
    const preview = buildSingleOrderCeilingPreview({ ...input, policyCeilingCents: 10_000.9 });
    expect(preview.ceilingCents).toBe(10_000);
  });
});

describe("refusals", () => {
  it("states nothing before capital has been declared", () => {
    for (const declaredCapitalCents of [null, 0, -1]) {
      const preview = buildSingleOrderCeilingPreview({ ...input, declaredCapitalCents });
      expect(preview.ceilingCents).toBeNull();
      expect(preview.unavailableReason).toContain("No capital has been declared");
    }
  });

  it("asks for a sync rather than guessing an allowance from no equity", () => {
    const preview = buildSingleOrderCeilingPreview({ ...input, policyCeilingCents: null, equityCents: null });
    expect(preview.ceilingCents).toBeNull();
    expect(preview.unavailableReason).toContain("Sync the account");
  });

  it("refuses non-finite inputs rather than producing a number from them", () => {
    expect(buildSingleOrderCeilingPreview({ ...input, declaredCapitalCents: Number.NaN }).ceilingCents).toBeNull();
    expect(buildSingleOrderCeilingPreview({ ...input, policyCeilingCents: Number.POSITIVE_INFINITY }).ceilingCents).toBeNull();
  });
});

describe("what it says", () => {
  it("leads with the consequence, then the cause", () => {
    const text = describeSingleOrderCeiling(buildSingleOrderCeilingPreview(input));
    expect(text).toContain("caps a single order at $100.00");
    expect(text).toContain("cannot be taken as a whole share");
    expect(text).toContain("5% of $2,000.00 equity = $100.00 per order");
  });

  it("does not blame policy when the operator's own figure is the limit", () => {
    const text = describeSingleOrderCeiling(buildSingleOrderCeilingPreview({ ...input, declaredCapitalCents: 5_000 }));
    expect(text).toContain("Your declared capital is the binding limit here");
    expect(text).not.toContain("Account policy is the binding limit");
  });

  it("never tells the operator to deploy more", () => {
    for (const declaredCapitalCents of [5_000, 40_000, 900_000]) {
      const text = describeSingleOrderCeiling(buildSingleOrderCeilingPreview({ ...input, declaredCapitalCents }));
      expect(text).not.toMatch(/should|recommend|increase your|you need to|consider/i);
    }
  });

  it("passes the refusal through rather than inventing a ceiling", () => {
    const text = describeSingleOrderCeiling(buildSingleOrderCeilingPreview({ ...input, declaredCapitalCents: null }));
    expect(text).toContain("No capital has been declared");
    expect(text).not.toContain("caps a single order");
  });
});
