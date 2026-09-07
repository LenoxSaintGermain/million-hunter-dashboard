import type { CapitalThesis } from "../../drizzle/schema";
import type { Cockpit } from "./cockpit";
import { collectMarketFacts } from "./providers/index";
import { CURRENT_MANDATE } from "./mandate";
import { buildMarketRegimeSnapshot } from "./marketRegime";
import {
  underwritePlayCandidates,
  type CapitalObjective,
  type CandidateSeed,
  type PlayUnderwritingResult,
} from "../../shared/playUnderwriting";

const truthyUrl = (value: string | null | undefined): value is string => Boolean(value && /^https?:\/\//i.test(value));

function illustrativeUatUnderwriting(input: {
  objective: CapitalObjective;
  cockpit: Cockpit;
  requestedPlayCount: 1 | 2 | 3;
  aggregateOpenRiskCents?: number | null;
  now: number;
}) {
  const illustrativeMetric = {
    value: null,
    direction: "unknown" as const,
    asOf: input.now,
    source: "Illustrative UAT fixture - not current market data",
    freshness: "fresh" as const,
  };
  const perPlay = input.cockpit.headroom.lines.find((line) => line.key === "planned_risk_per_play");
  const daily = input.cockpit.headroom.lines.find((line) => line.key === "daily_planned_risk");
  return underwritePlayCandidates({
    objective: input.objective,
    now: input.now,
    requestedPlayCount: input.requestedPlayCount,
    market: {
      asOf: input.now,
      marketSession: "illustrative_uat",
      indexTrend: { spy: illustrativeMetric, qqq: illustrativeMetric, iwm: illustrativeMetric },
      volatility: { regime: "unknown", value: null },
      breadth: { state: "unknown" },
      keyThemes: [],
      catalysts: [],
      regime: "unknown",
      confidence: 0,
    },
    candidates: [{
      symbol: "UATQ",
      title: "Illustrative qualified-play handoff",
      direction: "conditional",
      evidence: ["Illustrative fixture evidence; a human must confirm the named catalyst before a paper proposal."],
      sourceUrls: ["illustrative-uat-fixture://qualified-play"],
      lastPrice: null,
      lastPriceAsOf: null,
      catalyst: null,
      catalystAt: null,
      confirmationDescription: "Confirm the named catalyst evidence is still current.",
      invalidationDescription: "Invalidate if the catalyst evidence, paper-only boundary, or modeled risk cap is not confirmed.",
      liquidityScore: 50,
      portfolioFitScore: 75,
      correlationPenalty: 0,
    }],
    risk: {
      normalPlayRiskPct: CURRENT_MANDATE.maxPlannedRiskPctPerPlay,
      highConvictionRiskPct: CURRENT_MANDATE.maxHighConvictionRiskPctPerPlay,
      maxAggregateOpenRiskPct: CURRENT_MANDATE.maxAggregateOpenRiskPct,
      weeklyLossLimitPct: CURRENT_MANDATE.maxWeeklyPlannedRiskPct,
      eventRiskAllocationPct: CURRENT_MANDATE.maxEventRiskPct,
      perPlayHeadroomCents: perPlay?.ceilingCents ?? null,
      aggregateOpenRiskBeforeCents: input.aggregateOpenRiskCents ?? daily?.usedCents ?? 0,
      weeklyLossUsedCents: daily?.usedCents ?? 0,
    },
  });
}

export async function underwriteCapitalMission(input: {
  projection: CapitalThesis;
  objective: CapitalObjective;
  cockpit: Cockpit;
  requestedPlayCount: 1 | 2 | 3;
  aggregateOpenRiskCents?: number | null;
  illustrativeUatFixture?: boolean;
  now?: number;
}): Promise<{ result: PlayUnderwritingResult; providerAvailability: Record<string, boolean> }> {
  const now = input.now ?? Date.now();
  if (input.illustrativeUatFixture) {
    return {
      result: illustrativeUatUnderwriting({ ...input, now }),
      providerAvailability: { illustrative_uat_fixture: true, provider_network_invoked: false },
    };
  }
  const market = await buildMarketRegimeSnapshot({ now });
  const symbols = Array.from(new Set((input.projection.graph?.researchSymbols ?? []).map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))).slice(0, 6);
  const collected = await Promise.all(symbols.map((symbol) => collectMarketFacts(symbol, { now, timeoutMs: 10_000 }, { persist: true })));
  const largestPosition = input.cockpit.headroom.lines.find((line) => line.key === "position")?.subject ?? null;
  const candidates: CandidateSeed[] = collected.map((row) => {
    const verified = row.facts.filter((fact) => fact.basis === "verified" && truthyUrl(fact.sourceUrl));
    const price = verified.filter((fact) => fact.factKey === "last_price").sort((a, b) => (b.asOf ?? 0) - (a.asOf ?? 0))[0];
    const adv = row.facts.find((fact) => fact.factKey === "adv_usd_30d" && fact.valueNum != null);
    const evidence = verified.slice(0, 4).map((fact) => {
      const value = fact.valueNum ?? fact.valueText;
      return `${fact.factKey.replaceAll("_", " ")}: ${value ?? "recorded"} (${fact.sourceName ?? fact.providerId})`;
    });
    const sourceUrls = Array.from(new Set(verified.map((fact) => fact.sourceUrl).filter(truthyUrl)));
    return {
      symbol: row.symbol,
      title: input.projection.graph?.beliefs?.[0]?.trim() || input.projection.name?.trim() || "Canonical thesis expression",
      direction: "conditional",
      evidence,
      sourceUrls,
      lastPrice: price?.valueNum ?? null,
      lastPriceAsOf: price?.asOf ?? null,
      catalyst: null,
      catalystAt: null,
      confirmationDescription: input.projection.graph?.seek?.[0]?.trim() || null,
      invalidationDescription: input.projection.graph?.invalidationConditions?.[0]?.trim() || null,
      liquidityScore: adv?.valueNum == null ? 35 : adv.valueNum >= CURRENT_MANDATE.minAdvUsd30d ? 85 : 30,
      portfolioFitScore: largestPosition === row.symbol ? 35 : 75,
      correlationPenalty: largestPosition === row.symbol ? 70 : 10,
    };
  });
  const perPlay = input.cockpit.headroom.lines.find((line) => line.key === "planned_risk_per_play");
  const daily = input.cockpit.headroom.lines.find((line) => line.key === "daily_planned_risk");
  const result = underwritePlayCandidates({
    objective: input.objective,
    market: market.snapshot,
    candidates,
    requestedPlayCount: input.requestedPlayCount,
    now,
    risk: {
      normalPlayRiskPct: CURRENT_MANDATE.maxPlannedRiskPctPerPlay,
      highConvictionRiskPct: CURRENT_MANDATE.maxHighConvictionRiskPctPerPlay,
      maxAggregateOpenRiskPct: CURRENT_MANDATE.maxAggregateOpenRiskPct,
      weeklyLossLimitPct: CURRENT_MANDATE.maxWeeklyPlannedRiskPct,
      eventRiskAllocationPct: CURRENT_MANDATE.maxEventRiskPct,
      perPlayHeadroomCents: perPlay?.ceilingCents ?? null,
      // The existing cockpit has authoritative ET-day risk. Weekly aggregation
      // is intentionally not inferred; the objective records the configured
      // weekly stop and the result warns through its binding constraint.
      aggregateOpenRiskBeforeCents: input.aggregateOpenRiskCents ?? daily?.usedCents ?? 0,
      weeklyLossUsedCents: daily?.usedCents ?? 0,
    },
  });
  const ran = new Set(collected.flatMap((row) => row.ranProviders));
  const skipped = collected.flatMap((row) => row.skippedProviders.map((item) => item.id));
  return {
    result,
    providerAvailability: {
      ...market.providerAvailability,
      ...Object.fromEntries(Array.from(new Set([...Array.from(ran), ...skipped])).map((id) => [id, ran.has(id)])),
    },
  };
}
