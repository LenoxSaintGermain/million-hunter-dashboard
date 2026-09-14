import { describe, expect, it } from "vitest";
import { candidateAffordability } from "./candidateAffordability";
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
