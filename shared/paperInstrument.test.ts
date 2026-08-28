import { describe, expect, it } from "vitest";
import { buildOccOptionSymbol, optionPremiumAtRiskCents, parseOccOptionSymbol, validatePaperInstrument } from "./paperInstrument";

describe("paper option contract identity", () => {
  it("builds and parses a standard OCC contract symbol", () => {
    const symbol = buildOccOptionSymbol({ underlyingSymbol: "AAPL", expirationDate: "2027-01-15", optionType: "call", strikePriceCents: 25000 });
    expect(symbol).toBe("AAPL270115C00250000");
    expect(parseOccOptionSymbol(symbol!)).toMatchObject({ instrumentType: "long_call", underlyingSymbol: "AAPL", expirationDate: "2027-01-15", strikePriceCents: 25000, contractMultiplier: 100 });
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
