/**
 * Quick Hit / Micro-Cap Symphony Domain Layer
 * Inspired by Composer by SoFi rule-based modular architecture.
 *
 * Supports event-driven short-term plays, micro-caps (< $5.00, < $1B mkt cap),
 * dollar-based budget sizing, pre-flight backtest modeling, and 1-sentence hypothesis parsing.
 */

// ── Rule Block Definitions ──────────────────────────────────────────────────

export type TriggerType =
  | "volume_breakout"
  | "earnings_reaction"
  | "sec_catalyst"
  | "ma_crossover"
  | "headline_sentiment";

export interface TriggerRule {
  type: TriggerType;
  label: string;
  description: string;
  params: {
    volumeSpikePct?: number; // e.g. 300% of 30-day average
    lookbackDays?: number; // e.g. 30
    earningsSurprisePct?: number; // e.g. 15%
    maPeriodShort?: number; // e.g. 20
    maPeriodLong?: number; // e.g. 50
    catalystSource?: "sec_8k" | "fda_phase" | "contract_award" | "sentiment_spike";
    headlineKeyword?: string;
  };
}

export interface FilterRule {
  maxPriceCents: number; // e.g. 500 ($5.00 penny/micro-cap ceiling)
  maxMarketCapUsd: number; // e.g. 1_000_000_000 ($1B) or 500_000_000 ($500M)
  minDailyVolume: number; // e.g. 500_000 shares/day liquidity floor
  maxSpreadPct: number; // e.g. 2.0% or 3.0% maximum allowable bid-ask spread
}

export interface ActionRule {
  budgetUsd: number; // User-defined dollar cap: e.g. 25, 50, 100
  stopLossPct: number; // e.g. 8.0% or 9.5%
  takeProfitPct: number; // e.g. 20.0% or 25.0%
  trailingStop: boolean;
  orderType: "limit"; // Sub-$5 names strictly mandate hard limit orders
}

export interface SymphonyRecipe {
  id: string;
  name: string;
  tagline: string;
  trigger: TriggerRule;
  filter: FilterRule;
  action: ActionRule;
}

// ── Pre-Flight Backtest Results ─────────────────────────────────────────────

export interface PreFlightBacktestResult {
  winRatePct: number; // e.g. 71.4%
  maxDrawdownPct: number; // e.g. -6.8%
  profitFactor: number; // e.g. 2.45
  sampleOccurrences: number; // e.g. 28 historical catalyst instances
  avgHoldingDays: number; // e.g. 3.2 days
  expectedReturnPerDollar: number; // e.g. $1.28
  basis: "historical_simulation" | "cached_fixture";
}

// ── Quick Hit Play Item ─────────────────────────────────────────────────────

export interface QuickHitPlay {
  id: string;
  symbol: string;
  companyName: string;
  currentPriceCents: number;
  bidPriceCents: number;
  askPriceCents: number;
  spreadPct: number;
  marketCapUsd: number;
  dailyVolume: number;
  catalyst: {
    badge: "EVENT" | "MICRO";
    headline: string;
    summary: string;
    source: string;
    occurredAt: number;
  };
  bracket: {
    limitPriceCents: number;
    stopLossPriceCents: number;
    takeProfitPriceCents: number;
    stopLossPct: number;
    takeProfitPct: number;
    rewardToRiskRatio: number; // e.g. 2.25:1
  };
  sizing: {
    budgetUsd: number;
    shares: number;
    committedCents: number;
    uncommittedCents: number;
    isFractional: boolean;
  };
  backtest: PreFlightBacktestResult;
  oneSentenceHypothesis: string;
}

// ── 1-Sentence Hypothesis Parser ────────────────────────────────────────────

export interface ParsedHypothesis {
  valid: boolean;
  catalyst: string;
  symbol: string;
  targetPriceCents: number | null;
  stopPriceCents: number | null;
  error?: string;
}

/**
 * Parses streamlined 1-sentence hypothesis:
 * "[Catalyst] causes [Ticker] to move towards [Target Price] before [Invalidation Price]."
 * e.g.: "Clean energy fleet contract causes PLUG to move towards $2.40 before $1.85."
 */
export function parseOneSentenceHypothesis(input: string): ParsedHypothesis {
  const clean = input.trim();
  if (!clean) {
    return { valid: false, catalyst: "", symbol: "", targetPriceCents: null, stopPriceCents: null, error: "Hypothesis cannot be empty." };
  }

  // Regex pattern matching: "<catalyst> causes <ticker> to move towards $<target> before $<stop>"
  const match = clean.match(/^(.+?)\s+causes\s+([A-Za-z]{1,5})\s+to\s+move\s+towards\s+\$?([0-9]+(?:\.[0-9]+)?)\s+before\s+\$?([0-9]+(?:\.[0-9]+)?)\.?$/i);
  
  if (!match) {
    return {
      valid: false,
      catalyst: "",
      symbol: "",
      targetPriceCents: null,
      stopPriceCents: null,
      error: "Follow format: '[Catalyst] causes [TICKER] to move towards $[Target] before $[Stop].'",
    };
  }

  const [, catalyst, symbol, targetStr, stopStr] = match;
  const targetPrice = parseFloat(targetStr);
  const stopPrice = parseFloat(stopStr);

  if (isNaN(targetPrice) || targetPrice <= 0 || isNaN(stopPrice) || stopPrice <= 0) {
    return {
      valid: false,
      catalyst,
      symbol: symbol.toUpperCase(),
      targetPriceCents: null,
      stopPriceCents: null,
      error: "Target and stop prices must be valid positive dollar numbers.",
    };
  }

  return {
    valid: true,
    catalyst: catalyst.trim(),
    symbol: symbol.toUpperCase(),
    targetPriceCents: Math.round(targetPrice * 100),
    stopPriceCents: Math.round(stopPrice * 100),
  };
}

// ── Budget-Modeled Sizing ───────────────────────────────────────────────────

export interface BudgetSizingInput {
  budgetUsd: number;
  limitPriceCents: number;
  allowFractional?: boolean;
}

export interface BudgetSizingResult {
  shares: number;
  committedCents: number;
  uncommittedCents: number;
  maxCapitalAtRiskCents: number;
  stopDistanceCents: number;
}

/**
 * Calculates share allocation from a user dollar budget (e.g. $25, $50, $100).
 * Because penny stocks (< $5.00) mandate limit orders, Alpaca requires whole shares
 * on limit tickets. Whole shares are snapped downward to strictly respect the dollar budget cap.
 */
export function calculateBudgetSizing(
  input: BudgetSizingInput & { stopPriceCents?: number }
): BudgetSizingResult {
  const { budgetUsd, limitPriceCents, allowFractional = false } = input;
  const totalBudgetCents = Math.round(budgetUsd * 100);

  if (limitPriceCents <= 0) {
    return { shares: 0, committedCents: 0, uncommittedCents: totalBudgetCents, maxCapitalAtRiskCents: 0, stopDistanceCents: 0 };
  }

  let shares: number;
  if (allowFractional && limitPriceCents >= 500) {
    shares = parseFloat((totalBudgetCents / limitPriceCents).toFixed(4));
  } else {
    shares = Math.floor(totalBudgetCents / limitPriceCents);
  }

  const committedCents = Math.round(shares * limitPriceCents);
  const uncommittedCents = Math.max(0, totalBudgetCents - committedCents);

  const stopDistanceCents = input.stopPriceCents && input.stopPriceCents < limitPriceCents
    ? limitPriceCents - input.stopPriceCents
    : Math.round(limitPriceCents * 0.08); // default 8% stop

  const maxCapitalAtRiskCents = Math.round(shares * stopDistanceCents);

  return {
    shares,
    committedCents,
    uncommittedCents,
    maxCapitalAtRiskCents,
    stopDistanceCents,
  };
}

// ── Default Symphony Recipes & Templates ───────────────────────────────────

export const DEFAULT_SYMPHONY_RECIPES: SymphonyRecipe[] = [
  {
    id: "volume_breakout_runner",
    name: "Volume Surge Momentum",
    tagline: "Explosive volume breakout (>300% 30d avg) on micro-cap equities",
    trigger: {
      type: "volume_breakout",
      label: "Volume > 300% 30d Avg",
      description: "Intraday session volume exceeds 300% of the 30-day daily average with positive price expansion.",
      params: { volumeSpikePct: 300, lookbackDays: 30 },
    },
    filter: {
      maxPriceCents: 500, // < $5.00
      maxMarketCapUsd: 500_000_000, // < $500M
      minDailyVolume: 500_000, // > 500k shares
      maxSpreadPct: 2.0, // <= 2% spread
    },
    action: {
      budgetUsd: 50,
      stopLossPct: 8.5,
      takeProfitPct: 22.0,
      trailingStop: true,
      orderType: "limit",
    },
  },
  {
    id: "sec_contract_catalyst",
    name: "SEC 8-K Contract Award",
    tagline: "Event-driven catalyst play on newly disclosed material commercial contracts",
    trigger: {
      type: "sec_catalyst",
      label: "SEC 8-K Material Contract",
      description: "Material definitive agreement or commercial contract award filed within the last 24 hours.",
      params: { catalystSource: "contract_award" },
    },
    filter: {
      maxPriceCents: 450,
      maxMarketCapUsd: 750_000_000,
      minDailyVolume: 750_000,
      maxSpreadPct: 2.5,
    },
    action: {
      budgetUsd: 50,
      stopLossPct: 9.0,
      takeProfitPct: 24.5,
      trailingStop: true,
      orderType: "limit",
    },
  },
  {
    id: "biotech_phase_readout",
    name: "Biotech Trial Readout",
    tagline: "Positive clinical phase milestone announcement with defined risk bounds",
    trigger: {
      type: "headline_sentiment",
      label: "FDA / Phase Trial Beat",
      description: "Verified Phase 1/2 clinical endpoint success or FDA orphan drug designation.",
      params: { catalystSource: "fda_phase" },
    },
    filter: {
      maxPriceCents: 380,
      maxMarketCapUsd: 400_000_000,
      minDailyVolume: 600_000,
      maxSpreadPct: 2.5,
    },
    action: {
      budgetUsd: 25,
      stopLossPct: 10.0,
      takeProfitPct: 28.0,
      trailingStop: true,
      orderType: "limit",
    },
  },
];
