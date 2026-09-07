export type ProfitTargetPeriod = "session" | "week" | "month";
export type UnderwritingHoldingPeriod = "intraday" | "overnight" | "swing" | "catalyst_window" | "position";
export type InstrumentPreference = "shares" | "options" | "either";

export type CapitalObjective = {
  deployableCapitalCents: number;
  targetProfitCents: number | null;
  targetPeriod: ProfitTargetPeriod | null;
  maxPlannedLossCents: number;
  maxPortfolioOpenRiskCents?: number | null;
  weeklyLossLimitCents?: number | null;
  eventRiskLimitCents?: number | null;
  holdingPeriods: UnderwritingHoldingPeriod[];
  instrumentPreference: InstrumentPreference;
};

export type UnderwritingRiskPolicy = {
  normalPlayRiskPct: number;
  highConvictionRiskPct: number;
  maxAggregateOpenRiskPct: number;
  weeklyLossLimitPct: number;
  eventRiskAllocationPct: number;
  perPlayHeadroomCents: number | null;
  aggregateOpenRiskBeforeCents: number | null;
  weeklyLossUsedCents: number | null;
};

export type TargetFeasibility = {
  capitalBaseCents: number;
  targetProfitCents: number | null;
  targetPeriod: ProfitTargetPeriod | null;
  requiredReturnPct: number | null;
  classification: "not_requested" | "conservative" | "stretch" | "aggressive" | "extreme";
  targetPressure: number;
  riskBudgetCents: number;
  normalPlayRiskCents: number;
  highConvictionRiskCents: number;
  maxOpenRiskCents: number;
  lossLimitCents: number;
  assessment: string;
  mayInfluenceSizing: false;
};

export type RegimeMetric = {
  value: number | null;
  direction: "up" | "down" | "flat" | "mixed" | "unknown";
  asOf: number | null;
  source: string;
  freshness: "fresh" | "stale" | "unknown";
};

export type MarketRegimeSnapshot = {
  asOf: number;
  marketSession: string;
  indexTrend: { spy: RegimeMetric; qqq: RegimeMetric; iwm: RegimeMetric };
  rates?: { direction: "rising" | "falling" | "mixed" | "unknown"; confidence: number };
  volatility?: { regime: "compressed" | "normal" | "elevated" | "extreme" | "unknown"; value?: number | null };
  breadth?: { state: "broad" | "narrow" | "deteriorating" | "unknown" };
  keyThemes: Array<{ label: string; direction: "positive" | "negative" | "mixed"; evidence: string[] }>;
  catalysts: Array<{ label: string; occursAt: number | null; relevance: "low" | "medium" | "high"; sourceUrls: string[] }>;
  regime: "risk_on" | "risk_off" | "trend" | "chop" | "event_compression" | "transition" | "unknown";
  confidence: number;
};

export type TacticalMarketThesis = {
  id: string;
  direction: "bullish" | "bearish" | "neutral" | "conditional";
  title: string;
  statement: string;
  horizon: string;
  evidence: Array<{ fact: string; sourceUrl?: string | null; asOf?: number | null }>;
  catalyst: string | null;
  confirmation: string;
  invalidation: string;
  expiresAt: number | null;
  confidence: number;
};

export type PlayScores = {
  conviction: number;
  asymmetry: number;
  catalyst: number;
  timing: number;
  liquidity: number;
  portfolioFit: number;
  evidenceQuality: number;
  correlationPenalty: number;
  overall: number;
};

export type TradePlayBlueprint = {
  id: string;
  title: string;
  playClass: "momentum_continuation" | "pullback" | "event_volatility" | "catalyst_swing" | "mean_reversion" | "hedge" | "no_trade";
  tacticalThesisId: string;
  symbol: string;
  underlyingSymbol: string;
  instrument:
    | { kind: "shares" }
    | { kind: "long_call"; expiration?: string | null; strike?: number | null }
    | { kind: "long_put"; expiration?: string | null; strike?: number | null }
    | { kind: "debit_spread"; direction: "bull" | "bear"; expiration?: string | null; longStrike?: number | null; shortStrike?: number | null };
  horizon: UnderwritingHoldingPeriod;
  trigger: { description: string; status: "not_met" | "met" | "unknown" };
  entry?: { low?: number | null; high?: number | null; basis: "verified_market" | "modeled" | "not_measured" };
  invalidation: { description: string; price?: number | null };
  targets: Array<{ label: string; price?: number | null; rMultiple?: number | null }>;
  sizing: { deployableCapitalCents: number; proposedNotionalCents: number; plannedRiskCents: number; maxLossCents: number; percentCapitalAtRisk: number };
  outcome: {
    downsideCents: number;
    expectedLowCents: number | null;
    expectedBaseCents: number | null;
    expectedHighCents: number | null;
    maxTheoreticalProfitCents?: number | null;
    expectedR?: number | null;
    expectedValueCents?: number | null;
    basis: "market_derived" | "scenario_modeled" | "insufficient_data";
  };
  scoring: PlayScores;
  status: "proposed" | "waiting_for_trigger" | "research_required" | "eligible_for_research" | "invalidated" | "expired";
  killAt: number | null;
  warnings: string[];
  sourceUrls: string[];
};

export type NoTradeDecision = {
  reason: "target_requires_excessive_risk" | "no_confirmed_setup" | "portfolio_headroom_exhausted" | "market_data_stale" | "event_risk_too_high" | "insufficient_evidence" | "correlation_too_high" | "other";
  explanation: string;
  reopenCondition: string | null;
  reviewAt: number | null;
};

export type CandidateSeed = {
  symbol: string;
  title: string;
  direction: "bullish" | "bearish" | "neutral" | "conditional";
  evidence: string[];
  sourceUrls: string[];
  lastPrice?: number | null;
  lastPriceAsOf?: number | null;
  catalyst?: string | null;
  catalystAt?: number | null;
  confirmationDescription?: string | null;
  invalidationDescription?: string | null;
  liquidityScore: number;
  portfolioFitScore: number;
  correlationPenalty?: number;
};

export type PlayUnderwritingResult = {
  asOf: number;
  objective: CapitalObjective;
  feasibility: TargetFeasibility;
  market: MarketRegimeSnapshot;
  tacticalTheses: TacticalMarketThesis[];
  plays: TradePlayBlueprint[];
  noTrade: NoTradeDecision | null;
  portfolioRisk: { beforeCents: number; hypotheticalAfterCents: number; bindingConstraint: string | null; remainingHeadroomCents: number | null };
};

const clamp = (value: number, low = 0, high = 100) => Math.min(high, Math.max(low, value));
const cents = (dollars: number) => Math.round(dollars * 100);
const pctOf = (centsValue: number, pct: number) => Math.floor(centsValue * pct / 100);
const finiteLimits = (...values: Array<number | null | undefined>) => values.filter((value): value is number => value != null && Number.isFinite(value) && value >= 0);

export function calculateTargetFeasibility(objective: CapitalObjective, risk: UnderwritingRiskPolicy): TargetFeasibility {
  const requiredReturnPct = objective.targetProfitCents == null || objective.targetPeriod == null || objective.deployableCapitalCents <= 0
    ? null
    : Number(((objective.targetProfitCents / objective.deployableCapitalCents) * 100).toFixed(2));
  const classification: TargetFeasibility["classification"] = requiredReturnPct == null
    ? "not_requested"
    : requiredReturnPct <= 1 ? "conservative"
      : requiredReturnPct <= 3 ? "stretch"
        : requiredReturnPct <= 8 ? "aggressive" : "extreme";
  const aggregatePolicyCents = pctOf(objective.deployableCapitalCents, risk.maxAggregateOpenRiskPct);
  const maxOpenRiskCents = Math.min(...finiteLimits(objective.maxPortfolioOpenRiskCents, aggregatePolicyCents));
  const aggregateRemaining = Math.max(0, maxOpenRiskCents - Math.max(0, risk.aggregateOpenRiskBeforeCents ?? 0));
  const weeklyPolicyCents = pctOf(objective.deployableCapitalCents, risk.weeklyLossLimitPct);
  const lossLimitCents = Math.min(...finiteLimits(objective.weeklyLossLimitCents, weeklyPolicyCents));
  const weeklyRemaining = Math.max(0, lossLimitCents - Math.max(0, risk.weeklyLossUsedCents ?? 0));
  const eventLimit = objective.eventRiskLimitCents == null ? null : Math.min(
    objective.eventRiskLimitCents,
    pctOf(objective.deployableCapitalCents, risk.eventRiskAllocationPct),
  );
  const sharedRiskLimits = [
    objective.maxPlannedLossCents,
    risk.perPlayHeadroomCents,
    aggregateRemaining,
    weeklyRemaining,
    eventLimit,
  ];
  const normalPlayRiskCents = Math.min(...finiteLimits(
    ...sharedRiskLimits,
    pctOf(objective.deployableCapitalCents, risk.normalPlayRiskPct),
  ));
  const highConvictionRiskCents = Math.min(...finiteLimits(
    ...sharedRiskLimits,
    pctOf(objective.deployableCapitalCents, risk.highConvictionRiskPct),
  ));
  const riskBudgetCents = normalPlayRiskCents;
  const assessment = requiredReturnPct == null
    ? "No profit target was requested. Risk remains governed by the measured envelope."
    : `${requiredReturnPct}% ${objective.targetPeriod} return required; classified ${classification}. The target does not increase allowed risk.`;
  return {
    capitalBaseCents: objective.deployableCapitalCents,
    targetProfitCents: objective.targetProfitCents,
    targetPeriod: objective.targetPeriod,
    requiredReturnPct,
    classification,
    targetPressure: requiredReturnPct == null ? 0 : Number(clamp(requiredReturnPct / 12 * 100).toFixed(1)),
    riskBudgetCents,
    normalPlayRiskCents,
    highConvictionRiskCents,
    maxOpenRiskCents,
    lossLimitCents,
    assessment,
    mayInfluenceSizing: false,
  };
}

export function calculateShareOutcome(input: { quantity: number; entryPrice: number; stopPrice: number; targetPrices: number[] }) {
  const maxLossCents = cents(input.quantity * Math.abs(input.entryPrice - input.stopPrice));
  const targetOutcomesCents = input.targetPrices.map((price) => cents(input.quantity * (price - input.entryPrice)));
  return {
    maxLossCents,
    targetOutcomesCents,
    rMultiples: targetOutcomesCents.map((value) => maxLossCents === 0 ? null : Number((value / maxLossCents).toFixed(2))),
  };
}

export function calculateLongOptionOutcome(input: { kind: "long_call" | "long_put"; contracts: number; premiumPerShare: number; targetPremiumsPerShare: number[]; probabilities?: number[] }) {
  const maxLossCents = cents(input.contracts * 100 * input.premiumPerShare);
  const targetOutcomesCents = input.targetPremiumsPerShare.map((premium) => cents(input.contracts * 100 * (premium - input.premiumPerShare)));
  const probabilitiesValid = input.probabilities?.length === targetOutcomesCents.length
    && input.probabilities.every((value) => Number.isFinite(value) && value >= 0)
    && Math.abs(input.probabilities.reduce((sum, value) => sum + value, 0) - 1) < 0.0001;
  return {
    maxLossCents,
    targetOutcomesCents,
    rMultiples: targetOutcomesCents.map((value) => maxLossCents === 0 ? null : Number((value / maxLossCents).toFixed(2))),
    expectedValueCents: probabilitiesValid
      ? Math.round(targetOutcomesCents.reduce((sum, value, index) => sum + value * input.probabilities![index], 0))
      : null,
  };
}

export function rankPlay(scores: Omit<PlayScores, "overall">): number {
  return Math.round(clamp(
    scores.conviction * 0.20
    + scores.asymmetry * 0.20
    + scores.catalyst * 0.15
    + scores.timing * 0.10
    + scores.liquidity * 0.10
    + scores.portfolioFit * 0.15
    + scores.evidenceQuality * 0.10
    - scores.correlationPenalty * 0.15,
  ));
}

const marketIsFresh = (market: MarketRegimeSnapshot) => Object.values(market.indexTrend).every((metric) => metric.freshness === "fresh" && metric.asOf != null);

export function underwritePlayCandidates(input: {
  objective: CapitalObjective;
  market: MarketRegimeSnapshot;
  risk: UnderwritingRiskPolicy;
  candidates: CandidateSeed[];
  now: number;
  requestedPlayCount?: 1 | 2 | 3;
}): PlayUnderwritingResult {
  const feasibility = calculateTargetFeasibility(input.objective, input.risk);
  const beforeCents = Math.max(0, input.risk.aggregateOpenRiskBeforeCents ?? 0);
  const remaining = Math.max(0, feasibility.maxOpenRiskCents - beforeCents);
  const base = {
    asOf: input.now,
    objective: input.objective,
    feasibility,
    market: input.market,
    portfolioRisk: { beforeCents, hypotheticalAfterCents: beforeCents, bindingConstraint: null as string | null, remainingHeadroomCents: remaining },
  };
  const refuse = (reason: NoTradeDecision["reason"], explanation: string, reopenCondition: string | null): PlayUnderwritingResult => ({
    ...base,
    tacticalTheses: [],
    plays: [],
    noTrade: { reason, explanation, reopenCondition, reviewAt: null },
    portfolioRisk: { ...base.portfolioRisk, bindingConstraint: reason },
  });
  if (remaining <= 0 || feasibility.riskBudgetCents <= 0) {
    return refuse("portfolio_headroom_exhausted", "No measured risk capacity remains inside the current portfolio and mission limits.", "Reduce existing open risk or revise the mandate before re-underwriting.");
  }
  if (!marketIsFresh(input.market)) {
    return refuse("market_data_stale", "The market snapshot is stale or incomplete, so current triggers and entries are withheld.", "Refresh provider-backed SPY, QQQ, and IWM observations.");
  }
  const supported = input.candidates.filter((candidate) => candidate.evidence.length > 0 && candidate.sourceUrls.length > 0);
  if (!supported.length) {
    return refuse("insufficient_evidence", "No candidate has sourced evidence sufficient to form a tactical thesis.", "Add a current source and re-underwrite.");
  }

  const count = Math.min(input.requestedPlayCount ?? 3, 3);
  const eventWindow = input.market.catalysts.some((catalyst) => catalyst.relevance === "high" && catalyst.occursAt != null && catalyst.occursAt >= input.now && catalyst.occursAt - input.now <= 48 * 60 * 60 * 1_000);
  const tacticalTheses: TacticalMarketThesis[] = [];
  const plays = supported.slice(0, count).map((candidate, index): TradePlayBlueprint => {
    const thesisId = `thesis-${candidate.symbol.toLowerCase()}-${index + 1}`;
    const horizon = input.objective.holdingPeriods[0] ?? "swing";
    const priceFresh = candidate.lastPrice != null && candidate.lastPrice > 0 && candidate.lastPriceAsOf != null && input.now - candidate.lastPriceAsOf <= 24 * 60 * 60 * 1_000;
    const direction = candidate.direction === "bearish" ? "bearish" : candidate.direction === "neutral" ? "neutral" : "bullish";
    const exactOptionContractUnavailable = input.objective.instrumentPreference === "options"
      || (direction === "bearish" && input.objective.instrumentPreference === "either");
    const unsupportedShareDirection = direction === "bearish" && input.objective.instrumentPreference === "shares";
    const instrument: TradePlayBlueprint["instrument"] = exactOptionContractUnavailable
      ? direction === "bearish" ? { kind: "long_put", expiration: null, strike: null } : { kind: "long_call", expiration: null, strike: null }
      : { kind: "shares" };
    const entry = priceFresh ? candidate.lastPrice! : null;
    const stop = entry == null ? null : Number((direction === "bearish" ? entry * 1.02 : entry * 0.98).toFixed(2));
    const lowTarget = entry == null ? null : Number((direction === "bearish" ? entry * 0.98 : entry * 1.02).toFixed(2));
    const baseTarget = entry == null ? null : Number((direction === "bearish" ? entry * 0.96 : entry * 1.04).toFixed(2));
    const highTarget = entry == null ? null : Number((direction === "bearish" ? entry * 0.94 : entry * 1.06).toFixed(2));
    const riskPerShareCents = entry == null || stop == null ? 0 : cents(Math.abs(entry - stop));
    const quantity = riskPerShareCents <= 0 ? 0 : Math.floor(feasibility.riskBudgetCents / riskPerShareCents);
    const shareOutcome = !unsupportedShareDirection && entry != null && stop != null && lowTarget != null && baseTarget != null && highTarget != null && quantity > 0
      ? calculateShareOutcome({ quantity, entryPrice: entry, stopPrice: stop, targetPrices: [lowTarget, baseTarget, highTarget] }) : null;
    const plannedRiskCents = exactOptionContractUnavailable ? feasibility.riskBudgetCents : Math.min(feasibility.riskBudgetCents, shareOutcome?.maxLossCents ?? 0);
    const scoreInput = {
      conviction: Math.min(90, 55 + candidate.evidence.length * 8),
      asymmetry: shareOutcome?.rMultiples[2] == null ? 45 : clamp((shareOutcome.rMultiples[2] as number) * 25),
      catalyst: candidate.catalyst ? 80 : 45,
      timing: input.market.regime === "unknown" ? 35 : 70,
      liquidity: clamp(candidate.liquidityScore),
      portfolioFit: clamp(candidate.portfolioFitScore),
      evidenceQuality: clamp(50 + candidate.sourceUrls.length * 10),
      correlationPenalty: clamp(candidate.correlationPenalty ?? 0),
    };
    const scoring = { ...scoreInput, overall: rankPlay(scoreInput) };
    tacticalTheses.push({
      id: thesisId,
      direction: candidate.direction,
      title: candidate.title,
      statement: `${candidate.title} is only actionable if the modeled confirmation is supported by fresh research and market data.`,
      horizon,
      evidence: candidate.evidence.map((fact, evidenceIndex) => ({ fact, sourceUrl: candidate.sourceUrls[evidenceIndex] ?? candidate.sourceUrls[0] ?? null, asOf: candidate.lastPriceAsOf ?? input.market.asOf })),
      catalyst: candidate.catalyst ?? null,
      confirmation: candidate.confirmationDescription ?? (entry == null ? "Obtain a fresh underlying price and validate the setup." : `Confirm ${candidate.symbol} holds the modeled entry zone after evidence review.`),
      invalidation: candidate.invalidationDescription ?? (stop == null ? "Record a sourced invalidation before activation." : `${candidate.symbol} crosses the modeled invalidation level near ${stop}.`),
      expiresAt: candidate.catalystAt ?? null,
      confidence: scoring.conviction,
    });
    return {
      id: `play-${candidate.symbol.toLowerCase()}-${index + 1}`,
      title: `${candidate.symbol} · ${candidate.title}`,
      playClass: candidate.catalyst ? "catalyst_swing" : "pullback",
      tacticalThesisId: thesisId,
      symbol: candidate.symbol,
      underlyingSymbol: candidate.symbol,
      instrument,
      horizon,
      trigger: { description: candidate.confirmationDescription ?? (entry == null ? "Fresh market price and research confirmation required." : `Validate a hold near the modeled ${entry.toFixed(2)} reference.`), status: "unknown" },
      entry: { low: entry, high: entry, basis: entry == null ? "not_measured" : "modeled" },
      invalidation: { description: candidate.invalidationDescription ?? (stop == null ? "Not measured; research required." : "Modeled 2% adverse move from the provider-backed reference."), price: candidate.invalidationDescription ? null : stop },
      targets: [
        { label: "Low scenario", price: lowTarget, rMultiple: shareOutcome?.rMultiples[0] ?? null },
        { label: "Base scenario", price: baseTarget, rMultiple: shareOutcome?.rMultiples[1] ?? null },
        { label: "High scenario", price: highTarget, rMultiple: shareOutcome?.rMultiples[2] ?? null },
      ],
      sizing: {
        deployableCapitalCents: input.objective.deployableCapitalCents,
        proposedNotionalCents: exactOptionContractUnavailable || unsupportedShareDirection || entry == null ? 0 : cents(quantity * entry),
        plannedRiskCents,
        maxLossCents: plannedRiskCents,
        percentCapitalAtRisk: input.objective.deployableCapitalCents <= 0 ? 0 : Number((plannedRiskCents / input.objective.deployableCapitalCents * 100).toFixed(2)),
      },
      outcome: exactOptionContractUnavailable || !shareOutcome
        ? { downsideCents: -plannedRiskCents, expectedLowCents: null, expectedBaseCents: null, expectedHighCents: null, expectedR: null, expectedValueCents: null, basis: "insufficient_data" }
        : { downsideCents: -shareOutcome.maxLossCents, expectedLowCents: shareOutcome.targetOutcomesCents[0], expectedBaseCents: shareOutcome.targetOutcomesCents[1], expectedHighCents: shareOutcome.targetOutcomesCents[2], expectedR: shareOutcome.rMultiples[1], expectedValueCents: null, basis: "scenario_modeled" },
      scoring,
      status: exactOptionContractUnavailable || unsupportedShareDirection || !priceFresh ? "research_required" : eventWindow ? "waiting_for_trigger" : "eligible_for_research",
      killAt: candidate.catalystAt ?? null,
      warnings: exactOptionContractUnavailable
        ? ["Exact option contract, premium, Greeks, IV, and liquidity require a fresh option chain."]
        : unsupportedShareDirection
          ? ["A bearish share blueprint is research-only because the current order builder has no short-share execution path."]
          : ["Entry, stop, and targets are modeled scenarios; research must validate them before any ticket exists."],
      sourceUrls: candidate.sourceUrls,
    };
  }).sort((left, right) => right.scoring.overall - left.scoring.overall);

  const hypotheticalAfterCents = beforeCents + (plays[0]?.sizing.plannedRiskCents ?? 0);
  return {
    ...base,
    tacticalTheses,
    plays,
    noTrade: null,
    portfolioRisk: {
      beforeCents,
      hypotheticalAfterCents,
      bindingConstraint: feasibility.riskBudgetCents === input.objective.maxPlannedLossCents ? "mission_max_loss" : "risk_policy_or_portfolio_headroom",
      remainingHeadroomCents: Math.max(0, feasibility.maxOpenRiskCents - hypotheticalAfterCents),
    },
  };
}
