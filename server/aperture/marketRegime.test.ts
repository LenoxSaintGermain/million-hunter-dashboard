import { describe, expect, it } from "vitest";
import { buildMarketRegimeSnapshot } from "./marketRegime";
import type { CollectResult } from "./providers";

const now = Date.UTC(2026, 8, 7, 14);

function result(symbol: string, trend: number, asOf = now): CollectResult {
  return {
    symbol,
    ranProviders: ["fixture"],
    skippedProviders: [],
    errors: [],
    facts: [
      { factKey: "last_price", valueNum: 100, unit: "usd", basis: "verified", providerId: "fixture", sourceName: "Deterministic fixture", sourceUrl: `https://example.com/${symbol}`, asOf, ttlMs: 86_400_000 },
      { factKey: "return_20d", valueNum: trend, unit: "ratio", basis: "modeled", assumption: "fixture 20-session return", providerId: "fixture", sourceName: "Deterministic fixture", sourceUrl: `https://example.com/${symbol}`, asOf, ttlMs: 86_400_000 },
      { factKey: "volatility_30d", valueNum: 0.24, unit: "ratio", basis: "modeled", assumption: "fixture volatility", providerId: "fixture", sourceName: "Deterministic fixture", sourceUrl: `https://example.com/${symbol}`, asOf, ttlMs: 86_400_000 },
    ],
  };
}

describe("market regime snapshot", () => {
  it("classifies a broad provider-backed advance without an LLM", async () => {
    const snapshot = await buildMarketRegimeSnapshot({
      now,
      collect: async (symbol) => result(symbol, 0.08),
    });
    expect(snapshot.snapshot.regime).toBe("risk_on");
    expect(snapshot.snapshot.breadth?.state).toBe("broad");
    expect(snapshot.snapshot.indexTrend.spy).toMatchObject({ direction: "up", freshness: "fresh", asOf: now, source: "Deterministic fixture" });
  });

  it("fails freshness closed when one index reference is stale", async () => {
    const snapshot = await buildMarketRegimeSnapshot({
      now,
      collect: async (symbol) => result(symbol, -0.08, symbol === "IWM" ? now - 172_800_000 : now),
    });
    expect(snapshot.snapshot.regime).toBe("unknown");
    expect(snapshot.snapshot.confidence).toBe(0);
    expect(snapshot.snapshot.indexTrend.iwm.freshness).toBe("stale");
  });
});
