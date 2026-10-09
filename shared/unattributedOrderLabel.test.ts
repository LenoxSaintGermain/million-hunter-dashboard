import { describe, expect, it } from "vitest";
import { unattributedOrderLabel } from "./unattributedOrderLabel";

const base = { symbol: "CEG", side: "buy", status: "filled", clientOrderId: "mh-research-canvas-20260816-ceg", brokerOrderId: "b-1" };

describe("unattributedOrderLabel (#122)", () => {
  it("shows the dollar amount and fill for notional orders instead of '?'", () => {
    const line = unattributedOrderLabel({ ...base, qty: null, notional: 1000, filledQty: 4.21, filledAvgPrice: 237.53 });
    expect(line).toBe("CEG · buy $1,000 notional · filled 4.21 sh at $237.53 · filled · client id mh-research-canvas-20260816-ceg · b-1");
    expect(line).not.toContain("?");
  });
  it("shows share quantity when the broker reports it", () => {
    expect(unattributedOrderLabel({ ...base, qty: 3 })).toContain("buy 3 sh");
  });
  it("says plainly when nothing was reported", () => {
    const line = unattributedOrderLabel({ ...base, symbol: null, side: null, qty: null });
    expect(line).toContain("quantity not reported");
    expect(line).not.toContain("?");
  });
});
