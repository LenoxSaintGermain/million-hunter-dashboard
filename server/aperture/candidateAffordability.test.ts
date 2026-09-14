import { describe, expect, it } from "vitest";
import { candidateAffordability } from "./candidateAffordability";
import { orderByActionability, runAffordabilitySummary } from "../../shared/candidateAffordability";
import { CURRENT_MANDATE } from "./mandate";
import { singleOrderCeilingCents } from "./gates";

const now = Date.parse("2026-09-14T15:00:00Z");
const input = {
  equityCents: 200_000, capitalCents: 40_000, instrumentPreference: "shares",
  accountAsOf: now - 60_000, now,
  price: { basis: "verified", valueNum: 399.64, asOf: now - 120_000, expiresAt: now + 60_000, sourceName: "Illustrative quote", unit: "usd" },
};
describe("saved candidate affordability", () => {
  it("surfaces the same $100 ceiling as the paper order gate before evidence completion", () => {
    const result = candidateAffordability(input);
    expect(result.state).toBe("above_limit");
    expect(result.ceilingCents).toBe(singleOrderCeilingCents(input.equityCents, CURRENT_MANDATE));
    expect(result.ceilingCents).toBe(10_000);
    expect(result.referencePriceCents).toBe(39_964);
  });
  it("uses a tighter research budget without increasing any risk allowance", () => {
    expect(candidateAffordability({ ...input, capitalCents: 500 }).ceilingCents).toBe(500);
    expect(candidateAffordability({ ...input, capitalCents: 900_000 }).ceilingCents).toBe(10_000);
  });
  it.each([
    { ...input.price, expiresAt: now }, { ...input.price, asOf: now + 1 },
    { ...input.price, basis: "modeled" }, { ...input.price, unit: "cents" },
    { ...input.price, valueNum: NaN }, { ...input.price, valueNum: 0 },
    { ...input.price, asOf: null }, { ...input.price, sourceName: null },
  ])("does not show an exact usable price from invalid or stale input", (price) => {
    const result = candidateAffordability({ ...input, price });
    expect(result.state).toBe("unknown");
    expect(result.referencePriceCents).toBeNull();
  });
  it("does not pretend an underlying price sizes an option", () => {
    const result = candidateAffordability({ ...input, instrumentPreference: "options" });
    expect(result.state).toBe("options_required");
    expect(result.referencePriceCents).toBeNull();
  });
  it("does not infer an account from missing equity or make zero capital usable", () => {
    expect(candidateAffordability({ ...input, equityCents: null }).state).toBe("unknown");
    expect(candidateAffordability({ ...input, capitalCents: 0 }).state).toBe("above_limit");
  });
  it("a price inside the limit is a reference comparison, not qualification", () => {
    expect(candidateAffordability({ ...input, price: { ...input.price, valueNum: 50 } }).state).toBe("within_reference");
  });
});

describe("what would admit one share", () => {
  it("names the declared capital that the 5% policy would need for this price", () => {
    // The fresh-operator dead end: $2,000 declared gives a $100 ceiling, and
    // every candidate in their own thesis was priced far above it. The app said
    // only "compare another candidate", which led nowhere.
    const result = candidateAffordability(input);
    expect(result.state).toBe("above_limit");
    expect(result.requiredEquityCents).toBe(Math.ceil(39_964 * (100 / CURRENT_MANDATE.maxOrderNotionalPctOfEquity)));
    expect(result.requiredEquityCents).toBe(799_280); // $7,992.80 for a $399.64 share
    expect(result.requiredCapitalCents).toBeNull();
  });

  it("names the research budget instead when that is the binding input", () => {
    // Policy would allow $10,000; the mission only declared $200.
    const result = candidateAffordability({ ...input, equityCents: 20_000_000, capitalCents: 20_000 });
    expect(result.state).toBe("above_limit");
    expect(result.requiredCapitalCents).toBe(39_964);
    expect(result.requiredEquityCents).toBeNull();
  });

  it("says nothing about raising anything when the price already fits", () => {
    const result = candidateAffordability({ ...input, equityCents: 2_000_000, capitalCents: 1_000_000 });
    expect(result.state).toBe("within_reference");
    expect(result.requiredEquityCents).toBeNull();
    expect(result.requiredCapitalCents).toBeNull();
  });

  it("stays silent when the price itself was never measured", () => {
    const result = candidateAffordability({ ...input, price: null });
    expect(result.state).toBe("unknown");
    expect(result.requiredEquityCents).toBeNull();
    expect(result.requiredCapitalCents).toBeNull();
  });
});

describe("a run with no affordable candidate says so once", () => {
  const blocked = (requiredEquityCents: number | null) => ({
    affordability: {
      state: "above_limit" as const, referencePriceCents: 39_964, ceilingCents: 10_000,
      asOf: now, sourceName: "Illustrative quote", accountAsOf: now,
      requiredEquityCents, requiredCapitalCents: null,
    },
  });
  const fits = { affordability: { ...blocked(null).affordability, state: "within_reference" as const } };

  it("names the cheapest way in when every candidate is above the ceiling", () => {
    const summary = runAffordabilitySummary([blocked(799_280), blocked(528_140), blocked(999_000)]);
    expect(summary).toEqual({ blocked: 3, cheapestRequiredEquityCents: 528_140, ceilingCents: 10_000, sharesOnly: false });
  });

  it("stays quiet when even one candidate is affordable", () => {
    expect(runAffordabilitySummary([blocked(799_280), fits])).toBeNull();
  });

  it("stays quiet when any price was never measured, so it cannot prove a dead end", () => {
    expect(runAffordabilitySummary([blocked(799_280), { affordability: null }])).toBeNull();
    expect(runAffordabilitySummary([blocked(799_280), {}])).toBeNull();
  });

  it("stays quiet on an empty run", () => {
    expect(runAffordabilitySummary([])).toBeNull();
  });

  it("reports the block without a figure rather than inventing one", () => {
    const summary = runAffordabilitySummary([blocked(null)]);
    expect(summary).toMatchObject({ blocked: 1, cheapestRequiredEquityCents: null });
  });
});

describe("actionable names first, without calling them better research", () => {
  const at = (state: "within_reference" | "above_limit" | "unknown" | "options_required", symbol: string) => ({
    symbol,
    affordability: {
      state, referencePriceCents: 39_964, ceilingCents: 10_000, asOf: now,
      sourceName: "Illustrative quote", accountAsOf: now,
      requiredEquityCents: null, requiredCapitalCents: null,
    },
  });

  it("lifts affordable names above blocked ones", () => {
    const result = orderByActionability([at("above_limit", "PSX"), at("within_reference", "F"), at("above_limit", "VLO")]);
    expect(result.ordered.map((c) => c.symbol)).toEqual(["F", "PSX", "VLO"]);
    expect(result).toMatchObject({ actionable: 1, blocked: 2, unmeasured: 0, reordered: true });
  });

  it("preserves the incoming research order inside each group", () => {
    // Research-fit order is a judgement about evidence and must survive intact.
    const result = orderByActionability([
      at("within_reference", "F"), at("above_limit", "PSX"),
      at("within_reference", "T"), at("above_limit", "VLO"),
    ]);
    expect(result.ordered.map((c) => c.symbol)).toEqual(["F", "T", "PSX", "VLO"]);
  });

  it("keeps an unmeasured name above a proven-blocked one, never below", () => {
    // Unknown is not proven unaffordable, so it must not be buried with the blocked.
    const result = orderByActionability([at("above_limit", "PSX"), at("unknown", "MPC"), at("options_required", "XOM")]);
    expect(result.ordered.map((c) => c.symbol)).toEqual(["MPC", "XOM", "PSX"]);
    expect(result.unmeasured).toBe(2);
  });

  it("reports no reordering when the order already holds", () => {
    const result = orderByActionability([at("within_reference", "F"), at("above_limit", "PSX")]);
    expect(result.reordered).toBe(false);
  });

  it("leaves a run with no affordability data exactly as it came", () => {
    const input = [{ symbol: "PSX" }, { symbol: "VLO" }];
    const result = orderByActionability(input);
    expect(result.ordered.map((c) => c.symbol)).toEqual(["PSX", "VLO"]);
    expect(result).toMatchObject({ actionable: 0, blocked: 0, unmeasured: 2, reordered: false });
  });
});

describe("what the run actually compared", () => {
  const blockedCandidate = {
    affordability: {
      state: "above_limit" as const, referencePriceCents: 39_964, ceilingCents: 10_000,
      asOf: now, sourceName: "Illustrative quote", accountAsOf: now,
      requiredEquityCents: 799_280, requiredCapitalCents: null,
    },
  };

  it("flags a whole-share-only run, because the instrument preference is the operator's to change", () => {
    expect(runAffordabilitySummary([blockedCandidate], "shares")?.sharesOnly).toBe(true);
  });

  it("does not flag it when options were already in scope", () => {
    for (const preference of ["options", "either", null, undefined]) {
      expect(runAffordabilitySummary([blockedCandidate], preference)?.sharesOnly).toBe(false);
    }
  });
});
