import { describe, expect, it } from "vitest";
import { canonicalCapitalValues, needsCanonicalPromotion } from "./canonicalThesisLink";

describe("canonical Capital thesis link", () => {
  it("creates a review-stage canonical Capital / Trade source before an Aperture projection", () => {
    expect(canonicalCapitalValues({ userId: 7, name: "Catalyst reaction", rawText: "Research a confirmed catalyst reaction with strict risk controls." })).toMatchObject({
      userId: 7,
      name: "Catalyst reaction",
      templateUsed: "capital_trade",
      status: "review",
      thesisText: "Research a confirmed catalyst reaction with strict risk controls.",
    });
  });

  it("identifies only unlinked legacy projections for canonical promotion", () => {
    expect(needsCanonicalPromotion(null)).toBe(true);
    expect(needsCanonicalPromotion(undefined)).toBe(true);
    expect(needsCanonicalPromotion(42)).toBe(false);
  });
});
