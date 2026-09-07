import type { Fact } from "./facts";
import { collectMarketFacts, type CollectResult } from "./providers/index";
import { marketSession } from "./marketSession";
import type { MarketRegimeSnapshot, RegimeMetric } from "../../shared/playUnderwriting";

export type MarketFactCollector = (symbol: string, now: number) => Promise<CollectResult>;

const defaultCollector: MarketFactCollector = (symbol, now) => collectMarketFacts(symbol, { now, timeoutMs: 10_000 }, { persist: true });

function freshest(facts: Fact[], key: string): Fact | null {
  return facts.filter((fact) => fact.factKey === key).sort((a, b) => (b.asOf ?? 0) - (a.asOf ?? 0))[0] ?? null;
}

function metric(result: CollectResult, now: number): RegimeMetric {
  const price = freshest(result.facts, "last_price");
  const trend = freshest(result.facts, "return_20d");
  const trendValue = trend?.valueNum ?? null;
  const asOf = price?.asOf ?? null;
  const ttlMs = price?.ttlMs ?? null;
  const fresh = price?.basis === "verified" && asOf != null && ttlMs != null && now - asOf <= ttlMs;
  const trendFresh = trend != null
    && trendValue != null
    && trend.asOf != null
    && trend.ttlMs != null
    && now - trend.asOf <= trend.ttlMs;
  return {
    value: price?.basis === "verified" ? price.valueNum ?? null : null,
    direction: !trendFresh ? "unknown"
      : trendValue! > 0.02 ? "up"
        : trendValue! < -0.02 ? "down" : "flat",
    asOf,
    source: price?.sourceName ?? price?.providerId ?? (result.ranProviders.join(", ") || "unavailable"),
    freshness: fresh ? "fresh" : asOf == null ? "unknown" : "stale",
  };
}

export async function buildMarketRegimeSnapshot(input: { now?: number; collect?: MarketFactCollector }): Promise<{
  snapshot: MarketRegimeSnapshot;
  providerAvailability: Record<string, boolean>;
}> {
  const now = input.now ?? Date.now();
  const collect = input.collect ?? defaultCollector;
  const [spy, qqq, iwm] = await Promise.all(["SPY", "QQQ", "IWM"].map((symbol) => collect(symbol, now)));
  const allFacts = [...spy.facts, ...qqq.facts, ...iwm.facts];
  const volatilities = allFacts.filter((fact) => fact.factKey === "volatility_30d"
    && fact.valueNum != null
    && fact.asOf != null
    && fact.ttlMs != null
    && now - fact.asOf <= fact.ttlMs).map((fact) => fact.valueNum!);
  const volatilityValue = volatilities.length ? volatilities.reduce((sum, value) => sum + value, 0) / volatilities.length : null;
  const volatilityRegime = volatilityValue == null ? "unknown" as const
    : volatilityValue >= 0.55 ? "extreme" as const
      : volatilityValue >= 0.35 ? "elevated" as const
        : volatilityValue <= 0.18 ? "compressed" as const : "normal" as const;
  const metrics = { spy: metric(spy, now), qqq: metric(qqq, now), iwm: metric(iwm, now) };
  const allFresh = Object.values(metrics).every((item) => item.freshness === "fresh");
  const directions = Object.values(metrics).map((item) => item.direction);
  const upCount = directions.filter((direction) => direction === "up").length;
  const downCount = directions.filter((direction) => direction === "down").length;
  const breadth = !allFresh || directions.includes("unknown") ? "unknown" as const
    : upCount === 3 ? "broad" as const
      : downCount >= 2 ? "deteriorating" as const : "narrow" as const;
  const regime: MarketRegimeSnapshot["regime"] = !allFresh || directions.includes("unknown") ? "unknown"
    : volatilityRegime === "extreme" || volatilityRegime === "elevated" ? "transition"
      : upCount === 3 ? "risk_on"
        : downCount === 3 ? "risk_off"
          : upCount >= 2 || downCount >= 2 ? "trend" : "chop";
  const providers = new Set([...spy.ranProviders, ...qqq.ranProviders, ...iwm.ranProviders]);
  const skipped = [...spy.skippedProviders, ...qqq.skippedProviders, ...iwm.skippedProviders].map((item) => item.id);
  return {
    snapshot: {
      asOf: now,
      marketSession: marketSession(now).session,
      indexTrend: metrics,
      volatility: { regime: volatilityRegime, value: volatilityValue },
      breadth: { state: breadth },
      keyThemes: [],
      catalysts: [],
      regime,
      confidence: allFresh ? (directions.includes("unknown") ? 35 : 70) : 0,
    },
    providerAvailability: Object.fromEntries(Array.from(new Set([...Array.from(providers), ...skipped])).map((id) => [id, providers.has(id)])),
  };
}
