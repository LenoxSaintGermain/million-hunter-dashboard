import { describe, expect, it } from "vitest";
import { fredProvider } from "./providers/fred";
import { statusOf } from "./providers/types";

describe.skipIf(process.env.RUN_FRED_INTEGRATION !== "1")("FRED macro-data connection (external integration)", () => {
  it("authenticates with the configured key and returns a verified macro observation", async () => {
    expect(statusOf(fredProvider).available).toBe(true);

    const facts = await fredProvider.fetchMacroFacts({ now: Date.now(), timeoutMs: 15_000 });
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.some((fact) => fact.providerId === "fred" && fact.basis === "verified" && fact.valueNum != null)).toBe(true);
  }, 60_000);
});
