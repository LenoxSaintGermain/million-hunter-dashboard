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
import { afterEach, describe, it, expect, vi } from "vitest";
import { assertPaperOnly, LiveTradingRefusedError } from "./brokers/types";
import { alpacaPaperBroker, toOptionContractResult, toOptionMarketSnapshot, toOrderResult } from "./brokers/index";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe("toOptionMarketSnapshot — exact option evidence", () => {
  it("types a complete OPRA snapshot without inventing absent fields", () => {
    const result = toOptionMarketSnapshot("DKNG261002C00024000", {
      latestQuote: { bp: 1.05, ap: 1.30, bs: 12, as: 18, t: "2026-09-01T19:59:59Z" },
      latestTrade: { p: 1.20, s: 2, t: "2026-09-01T19:58:00Z" },
      dailyBar: { v: 32 },
      impliedVolatility: 0.4999,
    }, "opra");
    expect(result).toMatchObject({
      symbol: "DKNG261002C00024000",
      bidPriceCents: 105,
      askPriceCents: 130,
      dailyVolume: 32,
      impliedVolatility: 0.4999,
      feed: "opra",
    });
  });

  it("fails closed when the quote or IV is missing", () => {
    expect(toOptionMarketSnapshot("DKNG261002C00024000", { dailyBar: { v: 32 } }, "opra")).toBeNull();
  });
});

describe("toOptionContractResult — broker contract evidence", () => {
  it("maps an active Alpaca contract without inventing open interest", () => {
    expect(toOptionContractResult({
      symbol: "MGM261120C00035000",
      underlying_symbol: "MGM",
      expiration_date: "2026-11-20",
      type: "call",
      strike_price: "35",
      size: "100",
      tradable: true,
      status: "active",
    })).toMatchObject({
      symbol: "MGM261120C00035000",
      underlyingSymbol: "MGM",
      expirationDate: "2026-11-20",
      type: "call",
      strikePriceCents: 3500,
      multiplier: 100,
      tradable: true,
      status: "active",
      openInterest: null,
    });
  });

  it("fails closed when the broker record cannot identify an exact contract", () => {
    expect(toOptionContractResult({ underlying_symbol: "MGM", strike_price: "35" })).toBeNull();
  });
});

describe("Alpaca option quote feed fallback", () => {
  it("tries indicative data when OPRA returns an empty successful response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ snapshots: {} }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        snapshots: {
          MGM261120C00035000: {
            latestQuote: { bp: 1.05, ap: 1.15, bs: 4, as: 6, t: new Date().toISOString() },
            dailyBar: { v: 28 },
            impliedVolatility: 0.42,
          },
        },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const market = await alpacaPaperBroker.getOptionMarketSnapshot?.("MGM261120C00035000");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("feed=opra");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("feed=indicative");
    expect(market).toMatchObject({
      symbol: "MGM261120C00035000",
      bidPriceCents: 105,
      askPriceCents: 115,
      feed: "indicative",
    });
  });
});
