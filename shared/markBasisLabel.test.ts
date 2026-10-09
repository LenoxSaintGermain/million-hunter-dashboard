import { describe, expect, it } from "vitest";
import { markBasisLabel } from "./markBasisLabel";

describe("markBasisLabel (#115)", () => {
  it("never shows $0 for a missing option mark and keeps cents with units", () => {
    expect(markBasisLabel({ lastPriceCents: 0, avgCostCents: 420, isOption: true })).toBe("Mark Not measured · Basis $4.20/sh ($420.00/contract)");
    expect(markBasisLabel({ lastPriceCents: null, avgCostCents: 420, isOption: true })).toBe("Mark Not measured · Basis $4.20/sh ($420.00/contract)");
  });
  it("shows a real option mark per share and per contract", () => {
    expect(markBasisLabel({ lastPriceCents: 85, avgCostCents: 420, isOption: true })).toBe("Mark $0.85/sh ($85.00/contract) · Basis $4.20/sh ($420.00/contract)");
  });
  it("shows share prices with cents", () => {
    expect(markBasisLabel({ lastPriceCents: 12345, avgCostCents: 12000, isOption: false })).toBe("Mark $123.45 · Basis $120.00");
  });
});
