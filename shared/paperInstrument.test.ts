import { describe, expect, it } from "vitest";
import { buildOccOptionSymbol, nextStandardMonthlyOptionExpiration, optionPremiumAtRiskCents, paperInstrumentDisplayLabel, parseOccOptionSymbol, validatePaperInstrument } from "./paperInstrument";

describe("paper option contract identity", () => {
  it("defaults tickets to the next standard monthly expiration", () => {
    expect(nextStandardMonthlyOptionExpiration(Date.parse("2026-09-01T16:00:00Z"))).toBe("2026-11-20");
    expect(nextStandardMonthlyOptionExpiration(Date.parse("2026-11-19T16:00:00Z"), 0)).toBe("2026-11-20");
    expect(nextStandardMonthlyOptionExpiration(Date.parse("2026-11-21T16:00:00Z"), 0)).toBe("2026-12-18");
  });

  it("builds and parses a standard OCC contract symbol", () => {
    const symbol = buildOccOptionSymbol({ underlyingSymbol: "AAPL", expirationDate: "2027-01-15", optionType: "call", strikePriceCents: 25000 });
    expect(symbol).toBe("AAPL270115C00250000");
    expect(parseOccOptionSymbol(symbol!)).toMatchObject({ instrumentType: "long_call", underlyingSymbol: "AAPL", expirationDate: "2027-01-15", strikePriceCents: 25000, contractMultiplier: 100 });
  });

  it("formats an OCC contract for instant operator scanning", () => {
    expect(paperInstrumentDisplayLabel({ instrumentType: "long_call", symbol: "MGM261120C00040000" })).toBe("MGM · $40 Call · Nov 20, 2026");
    expect(paperInstrumentDisplayLabel({ instrumentType: "long_put", symbol: "CSCO261120P00110000" })).toBe("CSCO · $110 Put · Nov 20, 2026");
  });

  it("refuses mismatched or stale declared terms", () => {
    const result = validatePaperInstrument({ instrumentType: "long_put", symbol: "AAPL270115C00250000", underlyingSymbol: "AAPL", optionExpirationDate: "2020-01-17", optionStrikePriceCents: 25000, contractMultiplier: 100, qty: 1 }, Date.parse("2026-08-28T14:00:00Z"));
    expect(result.failures).toContain("Contract symbol must match the declared terms (AAPL200117P00250000).");
    expect(result.failures).toContain("Option expiration must be in the future.");
  });
});

describe("long-option risk", () => {
  it("treats premium plus stated slippage as the maximum debit at risk", () => {
    expect(optionPremiumAtRiskCents({ instrumentType: "long_call", qty: 2, entryPriceCents: 510, slippageCents: 5, contractMultiplier: 100 })).toBe(103000);
  });

  it("does not accept fractional contracts", () => {
    expect(optionPremiumAtRiskCents({ instrumentType: "long_put", qty: 0.5, entryPriceCents: 104, slippageCents: 0, contractMultiplier: 100 })).toBeNull();
  });
});
