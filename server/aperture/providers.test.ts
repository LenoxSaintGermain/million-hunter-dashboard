import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PROVIDERS, describeAvailability, availabilityMap, uncoveredCapabilities, providerById } from "./providers";
import { statusOf, unknownFact, num } from "./providers/types";
import { __marketDataInternals } from "./providers/marketData";
import { __edgarInternals } from "./providers/edgar";
import { assertFactWritable } from "./facts";
import { alpacaPaperBroker, robinhoodMcpBroker, listBrokers, brokerFor, assertPaperOnly, toOrderResult, LiveTradingRefusedError } from "./brokers";

const PAID_ENV = ["POLYGON_API_KEY", "FMP_API_KEY", "BENZINGA_API_KEY", "FRED_API_KEY", "ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of PAID_ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of PAID_ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("provider availability — gaps are named, never silent", () => {
  it("reports EDGAR available with no key at all", () => {
    expect(statusOf(providerById("edgar")!).available).toBe(true);
  });

  it("reports an unconfigured paid provider as unavailable, naming the missing var", () => {
    const s = statusOf(providerById("benzinga")!);
    expect(s.available).toBe(false);
    expect(s.reason).toMatch(/missing BENZINGA_API_KEY/);
    expect(s.missingEnv).toEqual(["BENZINGA_API_KEY"]);
  });

  it("flips to available once the key exists", () => {
    process.env.FMP_API_KEY = "test-key";
    expect(statusOf(providerById("fmp")!).available).toBe(true);
  });

  it("still lists unavailable providers rather than hiding them", () => {
    const all = describeAvailability();
    expect(all.map((s) => s.id).sort()).toEqual(PROVIDERS.map((p) => p.id).sort());
    expect(all.some((s) => !s.available)).toBe(true);
  });

  it("produces a compact map for persisting on a run", () => {
    const m = availabilityMap();
    expect(m.edgar).toBe(true);
    expect(m.polygon).toBe(false);
  });

  it("names which capabilities no configured provider can supply", () => {
    const gaps = uncoveredCapabilities();
    const keys = gaps.map((g) => g.factKey);
    expect(keys).toContain("analyst_rating_latest"); // Benzinga only
    expect(keys).toContain("last_price");            // Alpaca or Polygon, neither configured
    expect(keys).not.toContain("revenue_ttm");       // EDGAR is free and covers it
    expect(gaps.find((g) => g.factKey === "analyst_rating_latest")!.wouldComeFrom.join())
      .toMatch(/Benzinga/);
  });

  it("stops reporting a gap once any provider covering it is configured", () => {
    process.env.POLYGON_API_KEY = "test-key";
    expect(uncoveredCapabilities().map((g) => g.factKey)).not.toContain("last_price");
  });
});

describe("unknownFact — 'we looked and found nothing' is a real answer", () => {
  it("is writable and carries no value", () => {
    const f = unknownFact("pe_ratio", "fmp", "Financial Modeling Prep");
    expect(f.basis).toBe("unknown");
    expect(f.valueNum).toBeNull();
    expect(() => assertFactWritable("NVDA", f)).not.toThrow();
  });
});

describe("num — provider values coerce safely", () => {
  it("parses formatted numbers and rejects junk", () => {
    expect(num("$4,500,000")).toBe(4_500_000);
    expect(num("12.5%")).toBe(12.5);
    expect(num(null)).toBeNull();
    expect(num("")).toBeNull();
    expect(num("n/a")).toBeNull();
    expect(num(0)).toBe(0); // a real zero survives
  });
});

describe("market data derivations", () => {
  const bars = Array.from({ length: 30 }, (_, i) => ({ c: 100 + i, v: 1_000_000, t: i }));

  it("computes average daily DOLLAR volume, not share count", () => {
    const adv = __marketDataInternals.advUsd(bars)!;
    expect(adv).toBeCloseTo(114.5 * 1_000_000, -3);
  });

  it("returns null volatility from too few bars rather than a number", () => {
    expect(__marketDataInternals.volatility(bars.slice(0, 3))).toBeNull();
  });

  it("labels derived series as modeled and states the window", () => {
    const facts = __marketDataInternals.barsToFacts(bars, "alpaca", "Alpaca IEX", "https://x", 45, 0);
    const adv = facts.find((f) => f.factKey === "adv_usd_30d")!;
    expect(adv.basis).toBe("modeled");
    expect(adv.assumption).toMatch(/mean of close x volume/);
    for (const f of facts) expect(() => assertFactWritable("NVDA", f)).not.toThrow();
  });

  it("marks the raw close verified but everything derived modeled", () => {
    const facts = __marketDataInternals.barsToFacts(bars, "alpaca", "Alpaca IEX", "https://x", 45, 0);
    expect(facts.find((f) => f.factKey === "last_price")!.basis).toBe("verified");
    expect(facts.find((f) => f.factKey === "volatility_30d")!.basis).toBe("modeled");
  });

  it("emits unknowns rather than zeros when there are no bars", () => {
    const facts = __marketDataInternals.barsToFacts([], "alpaca", "Alpaca IEX", "https://x", 45, 0);
    expect(facts.every((f) => f.basis === "unknown")).toBe(true);
    expect(facts.every((f) => f.valueNum == null)).toBe(true);
  });
});

describe("EDGAR concept selection", () => {
  it("prefers the most recent annual 10-K datapoint", () => {
    const concept = {
      units: {
        USD: [
          { val: 100, end: "2023-12-31", fp: "FY", form: "10-K" },
          { val: 200, end: "2024-12-31", fp: "FY", form: "10-K" },
          { val: 50, end: "2025-03-31", fp: "Q1", form: "10-Q" },
        ],
      },
    };
    const hit = __edgarInternals.latestAnnual(concept, "USD")!;
    expect(hit.value).toBe(200);
    expect(hit.end).toBe("2024-12-31");
  });

  it("falls back to any datapoint when no annual filing exists", () => {
    const concept = { units: { USD: [{ val: 42, end: "2025-06-30", fp: "Q2", form: "10-Q" }] } };
    expect(__edgarInternals.latestAnnual(concept, "USD")!.value).toBe(42);
  });

  it("returns null for a missing concept instead of zero", () => {
    expect(__edgarInternals.latestAnnual(undefined, "USD")).toBeNull();
    expect(__edgarInternals.latestAnnual({ units: {} }, "USD")).toBeNull();
  });
});

describe("brokers — nothing in this build trades real money", () => {
  it("declares liveTrading false on every adapter", () => {
    for (const b of listBrokers()) expect(b.capabilities.liveTrading).toBe(false);
  });

  it("refuses a non-paper order at the shared gate", () => {
    expect(() => assertPaperOnly("Alpaca", false)).toThrow(LiveTradingRefusedError);
    expect(() => assertPaperOnly("Alpaca", false)).toThrow(/separate decision, not a config change/);
    expect(() => assertPaperOnly("Alpaca", true)).not.toThrow();
  });

  it("reports Alpaca unavailable without keys, naming both", () => {
    expect(alpacaPaperBroker.available()).toBe(false);
    expect(alpacaPaperBroker.unavailableReason()).toMatch(/ALPACA_API_KEY_ID/);
    expect(alpacaPaperBroker.unavailableReason()).toMatch(/ALPACA_API_SECRET_KEY/);
  });

  it("becomes available once both Alpaca keys exist", () => {
    process.env.ALPACA_API_KEY_ID = "k";
    process.env.ALPACA_API_SECRET_KEY = "s";
    expect(alpacaPaperBroker.available()).toBe(true);
    expect(alpacaPaperBroker.unavailableReason()).toBeNull();
  });

  // The constraint that reshaped the design.
  it("encodes why Robinhood cannot be a server-side rail", () => {
    expect(robinhoodMcpBroker.capabilities.serverSideExecution).toBe(false);
    expect(robinhoodMcpBroker.available()).toBe(false);
    const c = robinhoodMcpBroker.capabilities.constraints.join(" ");
    expect(c).toMatch(/no API key this server can hold/);
    expect(c).toMatch(/dedicated Agentic account/);
  });

  it("rejects any Robinhood call rather than pretending", async () => {
    await expect(robinhoodMcpBroker.getPositions()).rejects.toThrow(/user-connected MCP server/);
  });

  it("routes an unknown broker id to manual rather than throwing", () => {
    expect(brokerFor("something_else", 1).id).toBe("manual");
    expect(brokerFor("alpaca_paper", 1).id).toBe("alpaca_paper");
  });

  it("manual accounts can be read but never execute", async () => {
    const m = brokerFor("manual", 1);
    expect(m.capabilities.readPositions).toBe(true);
    await expect(m.submitOrder({ symbol: "X", side: "buy", qty: 1, type: "market", timeInForce: "day" }, { isPaper: true }))
      .rejects.toThrow(/cannot execute/);
    expect(await m.getOrders()).toEqual([]);
    expect(await m.getOrder("anything")).toBeNull();
  });
});

describe("Alpaca order status mapping", () => {
  // Verified against the live sandbox: a $1 notional SPY market order returns
  // pending_new on submit and filled on read-back a few seconds later.
  it("does not read an in-flight order as done", () => {
    expect(toOrderResult({ id: "x", status: "pending_new" }).status).toBe("pending");
    expect(toOrderResult({ id: "x", status: "partially_filled" }).status).toBe("pending");
  });

  it("maps accepted and new to accepted", () => {
    expect(toOrderResult({ id: "x", status: "accepted" }).status).toBe("accepted");
    expect(toOrderResult({ id: "x", status: "new" }).status).toBe("accepted");
  });

  it("maps every terminal failure to rejected", () => {
    for (const s of ["rejected", "canceled", "expired"]) {
      expect(toOrderResult({ id: "x", status: s }).status).toBe("rejected");
    }
  });

  it("converts the fill price to cents and keeps the raw payload", () => {
    const r = toOrderResult({ id: "abc", status: "filled", filled_qty: "0.001281808", filled_avg_price: "772.35" });
    expect(r.status).toBe("filled");
    expect(r.filledAvgPriceCents).toBe(77235);
    expect(r.filledQty).toBeCloseTo(0.001281808, 9);
    expect((r.raw as any).id).toBe("abc");
  });

  it("leaves an unfilled order's price null rather than zero", () => {
    const r = toOrderResult({ id: "x", status: "pending_new", filled_avg_price: null });
    expect(r.filledAvgPriceCents).toBeNull();
  });

  it("parses the broker's submitted_at rather than stamping now", () => {
    const r = toOrderResult({ id: "x", status: "filled", submitted_at: "2026-08-10T19:40:00Z" });
    expect(r.submittedAt).toBe(Date.parse("2026-08-10T19:40:00Z"));
  });
});
