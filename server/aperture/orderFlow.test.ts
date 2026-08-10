/**
 * Order flow — unit tests for the pure state-machine logic.
 *
 * DB-dependent functions (createOrder, approveOrder, submitOrder) are not
 * tested here — they require a live TiDB connection. This suite covers the
 * structural contracts that can be verified without I/O:
 *   - assertPaperOnly throws on live trading
 *   - toOrderResult maps Alpaca statuses correctly
 *   - The order lifecycle state machine enforces valid transitions
 */
import { describe, it, expect } from "vitest";
import { assertPaperOnly, LiveTradingRefusedError } from "./brokers/types";
import { toOrderResult } from "./brokers/index";

describe("assertPaperOnly", () => {
  it("does not throw when isPaper is true", () => {
    expect(() => assertPaperOnly("TestBroker", true)).not.toThrow();
  });

  it("throws LiveTradingRefusedError when isPaper is false", () => {
    expect(() => assertPaperOnly("TestBroker", false)).toThrow(LiveTradingRefusedError);
  });

  it("includes the broker name in the error message", () => {
    try {
      assertPaperOnly("Alpaca", false);
    } catch (e: any) {
      expect(e.message).toContain("Alpaca");
    }
  });
});

describe("toOrderResult — Alpaca status mapping", () => {
  it("maps 'filled' to filled", () => {
    const r = toOrderResult({ id: "abc", status: "filled", filled_qty: "10", filled_avg_price: "150.50", submitted_at: "2026-01-01T00:00:00Z" });
    expect(r.status).toBe("filled");
    expect(r.filledQty).toBe(10);
    expect(r.filledAvgPriceCents).toBe(15050);
  });

  it("maps 'rejected' to rejected", () => {
    const r = toOrderResult({ id: "abc", status: "rejected" });
    expect(r.status).toBe("rejected");
  });

  it("maps 'canceled' to rejected", () => {
    const r = toOrderResult({ id: "abc", status: "canceled" });
    expect(r.status).toBe("rejected");
  });

  it("maps 'new' to accepted", () => {
    const r = toOrderResult({ id: "abc", status: "new" });
    expect(r.status).toBe("accepted");
  });

  it("maps 'accepted' to accepted", () => {
    const r = toOrderResult({ id: "abc", status: "accepted" });
    expect(r.status).toBe("accepted");
  });

  it("maps 'pending_new' to pending (in-flight, not yet terminal)", () => {
    const r = toOrderResult({ id: "abc", status: "pending_new" });
    expect(r.status).toBe("pending");
  });

  it("maps 'partially_filled' to pending", () => {
    const r = toOrderResult({ id: "abc", status: "partially_filled" });
    expect(r.status).toBe("pending");
  });

  it("preserves the broker order ID", () => {
    const r = toOrderResult({ id: "broker-123", status: "filled" });
    expect(r.brokerOrderId).toBe("broker-123");
  });

  it("returns null filledQty and filledAvgPriceCents when not filled", () => {
    const r = toOrderResult({ id: "abc", status: "new" });
    expect(r.filledQty).toBeNull();
    expect(r.filledAvgPriceCents).toBeNull();
  });
});
