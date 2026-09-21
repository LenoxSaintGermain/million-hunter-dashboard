import { describe, expect, it } from "vitest";
import { sumOpenOrderRisk } from "./openOrderRisk";
const entry = { accountId: 1, symbol: "RWM", instrumentType: "direct_equity", side: "buy", intent: "open", status: "filled", filledQty: 1, plannedRiskCents: null };
const exit = { ...entry, side: "sell", intent: "close" };
describe("closed exposure does not consume new-mission risk", () => {
  it("excludes a fully matched filled close without inventing entry risk", () => {
    expect(sumOpenOrderRisk([entry, exit])).toEqual({ ok: true, totalCents: 0 });
  });
  it("keeps unknown open and partially closed risk fail-closed", () => {
    expect(sumOpenOrderRisk([entry]).ok).toBe(false);
    expect(sumOpenOrderRisk([entry, { ...exit, filledQty: 0.5 }]).ok).toBe(false);
  });
  it("does not treat submitted exits as fills", () => {
    expect(sumOpenOrderRisk([entry, { ...exit, status: "submitted", filledQty: null }]).ok).toBe(false);
  });
  it("keeps new pending opening risk and separates accounts and symbols", () => {
    expect(sumOpenOrderRisk([entry, exit, { ...entry, status: "approved", filledQty: null, plannedRiskCents: 500 }])).toEqual({ ok: true, totalCents: 500 });
    expect(sumOpenOrderRisk([entry, { ...exit, accountId: 2 }]).ok).toBe(false);
    expect(sumOpenOrderRisk([entry, { ...exit, symbol: "PSX" }]).ok).toBe(false);
  });
  it("rejects over-closes and missing fill quantities", () => {
    expect(sumOpenOrderRisk([entry, { ...exit, filledQty: 2 }]).ok).toBe(false);
    expect(sumOpenOrderRisk([entry, { ...exit, filledQty: null }]).ok).toBe(false);
  });
});
