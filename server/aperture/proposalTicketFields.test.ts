import { describe, expect, it } from "vitest";
import { dollarsToCents } from "../../shared/proposalTicketFields";

describe("proposal ticket currency boundary", () => {
  it("does not turn an unavailable modeled price into a zero-cent price", () => {
    expect(dollarsToCents("")).toBeNull();
    expect(dollarsToCents("   ")).toBeNull();
    expect(dollarsToCents("0")).toBeNull();
    expect(dollarsToCents("0.00")).toBeNull();
  });

  it("allows zero only for explicitly non-negative fields such as slippage", () => {
    expect(dollarsToCents("0", { allowZero: true })).toBe(0);
    expect(dollarsToCents("42.19")).toBe(4219);
    expect(dollarsToCents("not a number")).toBeNull();
  });
});
