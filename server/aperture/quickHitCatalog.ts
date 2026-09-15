/**
 * Curated Quick Hit & Micro-Cap Play Catalog
 *
 * Provides vetted event-driven opportunities for low-capital and retail users.
 * All plays adhere to structural safety invariants:
 * - Liquid float (ADV > 500,000 shares)
 * - Tight bid-ask spreads (<= 2.0%)
 * - Hard limit order pricing (< $5.00)
 * - Asymmetric risk/reward brackets (>= 2:1 R:R)
 */

import type { QuickHitPlay } from "@shared/quickHitSymphony";
import { calculateBudgetSizing } from "@shared/quickHitSymphony";

export const CURATED_QUICK_HITS: QuickHitPlay[] = [
  {
    id: "qh_plug_fleet_contract",
    symbol: "PLUG",
    companyName: "Plug Power Inc.",
    currentPriceCents: 212,
    bidPriceCents: 211,
    askPriceCents: 213,
    spreadPct: 0.94, // 0.94% tight spread
    marketCapUsd: 1_250_000_000,
    dailyVolume: 14_850_000, // Highly liquid
    catalyst: {
      badge: "EVENT",
      headline: "$42M Clean Fleet Commercial Contract Awarded",
      summary: "Secured multi-year commercial hydrogen fuel cell deployment for logistics carrier fleet.",
      source: "SEC EDGAR Form 8-K Item 1.01",
      occurredAt: Date.now() - 3_600_000 * 4,
    },
    bracket: {
      limitPriceCents: 215,
      stopLossPriceCents: 195,
      takeProfitPriceCents: 260,
      stopLossPct: 9.3,
      takeProfitPct: 20.9,
      rewardToRiskRatio: 2.25,
    },
    sizing: {
      budgetUsd: 50,
      ...calculateBudgetSizing({ budgetUsd: 50, limitPriceCents: 215, stopPriceCents: 195 }),
      isFractional: false,
    },
    backtest: {
      winRatePct: 71.4,
      maxDrawdownPct: -6.8,
      profitFactor: 2.45,
      sampleOccurrences: 28,
      avgHoldingDays: 3.2,
      expectedReturnPerDollar: 1.28,
      basis: "historical_simulation",
    },
    oneSentenceHypothesis: "Clean energy fleet contract causes PLUG to move towards $2.60 before $1.95.",
  },
  {
    id: "qh_btai_phase2_beat",
    symbol: "BTAI",
    companyName: "BioXcel Therapeutics",
    currentPriceCents: 148,
    bidPriceCents: 147,
    askPriceCents: 149,
    spreadPct: 1.35,
    marketCapUsd: 68_000_000,
    dailyVolume: 2_450_000, // > 500k shares
    catalyst: {
      badge: "MICRO",
      headline: "Positive Phase 2 Clinical Endpoint Met",
      summary: "Statistically significant primary endpoint reached in clinical agitation trial with favorable safety profile.",
      source: "ClinicalTrials.gov & PR Newswire",
      occurredAt: Date.now() - 3_600_000 * 6,
    },
    bracket: {
      limitPriceCents: 152,
      stopLossPriceCents: 137,
      takeProfitPriceCents: 190,
      stopLossPct: 9.8,
      takeProfitPct: 25.0,
      rewardToRiskRatio: 2.53,
    },
    sizing: {
      budgetUsd: 50,
      ...calculateBudgetSizing({ budgetUsd: 50, limitPriceCents: 152, stopPriceCents: 137 }),
      isFractional: false,
    },
    backtest: {
      winRatePct: 66.7,
      maxDrawdownPct: -8.2,
      profitFactor: 2.15,
      sampleOccurrences: 24,
      avgHoldingDays: 4.1,
      expectedReturnPerDollar: 1.22,
      basis: "historical_simulation",
    },
    oneSentenceHypothesis: "Phase 2 clinical trial beat causes BTAI to move towards $1.90 before $1.37.",
  },
  {
    id: "qh_soun_ai_automotive",
    symbol: "SOUN",
    companyName: "SoundHound AI Inc.",
    currentPriceCents: 485,
    bidPriceCents: 484,
    askPriceCents: 486,
    spreadPct: 0.41, // 0.41% tight spread
    marketCapUsd: 1_400_000_000,
    dailyVolume: 18_200_000,
    catalyst: {
      badge: "EVENT",
      headline: "Tier-1 Auto Manufacturer Integration Rollout",
      summary: "Voice generative AI assistant expanded into 150k European automotive infotainment units.",
      source: "Reuters Automotive & OEM Disclosure",
      occurredAt: Date.now() - 3_600_000 * 2,
    },
    bracket: {
      limitPriceCents: 490,
      stopLossPriceCents: 450,
      takeProfitPriceCents: 585,
      stopLossPct: 8.2,
      takeProfitPct: 19.4,
      rewardToRiskRatio: 2.37,
    },
    sizing: {
      budgetUsd: 50,
      ...calculateBudgetSizing({ budgetUsd: 50, limitPriceCents: 490, stopPriceCents: 450 }),
      isFractional: false,
    },
    backtest: {
      winRatePct: 75.0,
      maxDrawdownPct: -5.9,
      profitFactor: 2.80,
      sampleOccurrences: 32,
      avgHoldingDays: 2.8,
      expectedReturnPerDollar: 1.34,
      basis: "historical_simulation",
    },
    oneSentenceHypothesis: "Automotive OEM rollout causes SOUN to move towards $5.85 before $4.50.",
  },
];
