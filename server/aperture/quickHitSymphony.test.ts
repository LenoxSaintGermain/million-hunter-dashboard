import { describe, it, expect } from "vitest";
import {
  parseOneSentenceHypothesis,
  calculateBudgetSizing,
  DEFAULT_SYMPHONY_RECIPES,
} from "../../shared/quickHitSymphony";
import { simulatePreFlightBacktest } from "./quickHitBacktest";
import { CURATED_QUICK_HITS } from "./quickHitCatalog";
import {
  evaluateOrderGates,
  type OrderGateInput,
  type OrderAccountState,
} from "./gates";
import { marketSession } from "./marketSession";
import { CURRENT_MANDATE, PAPER_ACKNOWLEDGEMENT } from "./mandate";

const NOW = Date.parse("2026-06-10T14:30:00Z");
const REGULAR = marketSession(NOW);
const EQUITY = 10_000_000;

const baseOrder = (over: Partial<OrderGateInput> = {}): OrderGateInput => ({
  symbol: "PENY",
  side: "buy",
  orderType: "limit",
  limitPriceCents: 215,
  timeInForce: "day",
  holdingPeriod: "intraday",
  reason: "Valid catalyst statement exceeding min narrative chars easily.",
  invalidationCondition: "Price below $1.95 stop level on negative volume.",
  catalystDeadlineAt: NOW + 86400000,
  paperAcknowledgement: PAPER_ACKNOWLEDGEMENT,
  gatedNotionalCents: 5000,
  notionalBasis: "stated",
  ...over,
});

const baseAccount = (over: Partial<OrderAccountState> = {}): OrderAccountState => ({
  isPaper: true,
  equityCents: EQUITY,
  positionValueCents: 0,
  clusterValueCents: 0,
  clusterLabel: "Clean Energy",
  positionQty: 0,
  sectorKnown: true,
  newNotionalTodayCents: 0,
  runGrossDeployedCents: 0,
  advUsd: 50_000_000,
  plannedRiskTodayCents: 0,
  clusterPlannedRiskCents: 0,
  ...over,
});

describe("Quick Hit & Symphony Lite - Domain Logic & Backtest", () => {
  describe("1-Sentence Hypothesis Parser", () => {
    it("parses valid standard 1-sentence hypothesis correctly", () => {
      const sentence = "Clean energy contract award causes PLUG to move towards $2.60 before $1.95.";
      const parsed = parseOneSentenceHypothesis(sentence);

      expect(parsed.valid).toBe(true);
      expect(parsed.catalyst).toBe("Clean energy contract award");
      expect(parsed.symbol).toBe("PLUG");
      expect(parsed.targetPriceCents).toBe(260);
      expect(parsed.stopPriceCents).toBe(195);
    });

    it("parses hypothesis without trailing period and case insensitively", () => {
      const sentence = "FDA phase 2 beat causes btai to move towards $3.60 before $2.60";
      const parsed = parseOneSentenceHypothesis(sentence);

      expect(parsed.valid).toBe(true);
      expect(parsed.symbol).toBe("BTAI");
      expect(parsed.targetPriceCents).toBe(360);
      expect(parsed.stopPriceCents).toBe(260);
    });

    it("fails gracefully on invalid format", () => {
      const parsed = parseOneSentenceHypothesis("I think this stock will go up.");
      expect(parsed.valid).toBe(false);
      expect(parsed.error).toContain("Follow format");
    });
  });

  describe("Dollar Budget Sizing", () => {
    it("snaps shares down to integer whole shares strictly respecting budget cap for sub-$5 names", () => {
      // Budget: $50.00, Limit price: $2.15
      // 5000 / 215 = 23.255 -> 23 shares
      // Committed: 23 * 215 = 4945 cents ($49.45)
      // Uncommitted: 55 cents ($0.55)
      const sizing = calculateBudgetSizing({
        budgetUsd: 50,
        limitPriceCents: 215,
        stopPriceCents: 195,
      });

      expect(sizing.shares).toBe(23);
      expect(sizing.committedCents).toBe(4945);
      expect(sizing.uncommittedCents).toBe(55);
      expect(sizing.committedCents).toBeLessThanOrEqual(5000);
      // Risk per share = 215 - 195 = 20 cents. Total risk = 23 * 20 = 460 cents ($4.60)
      expect(sizing.maxCapitalAtRiskCents).toBe(460);
    });

    it("correctly sizes a low $25 budget", () => {
      // Budget $25, Limit $1.45 (145 cents)
      // 2500 / 145 = 17.24 -> 17 shares
      // Committed: 17 * 145 = 2465 cents ($24.65)
      const sizing = calculateBudgetSizing({
        budgetUsd: 25,
        limitPriceCents: 145,
        stopPriceCents: 130,
      });

      expect(sizing.shares).toBe(17);
      expect(sizing.committedCents).toBe(2465);
      expect(sizing.uncommittedCents).toBe(35);
      expect(sizing.committedCents).toBeLessThanOrEqual(2500);
      expect(sizing.maxCapitalAtRiskCents).toBe(17 * 15);
    });

    it("returns 0 shares if budget is strictly below 1 share limit price", () => {
      const sizing = calculateBudgetSizing({
        budgetUsd: 2,
        limitPriceCents: 350, // $3.50 share
        stopPriceCents: 300,
      });

      expect(sizing.shares).toBe(0);
      expect(sizing.committedCents).toBe(0);
      expect(sizing.uncommittedCents).toBe(200);
    });
  });

  describe("Pre-Flight Backtest Engine", () => {
    it("simulates deterministic pre-flight backtest for all built-in recipes", () => {
      for (const recipe of DEFAULT_SYMPHONY_RECIPES) {
        const result = simulatePreFlightBacktest(recipe);
        expect(result.winRatePct).toBeGreaterThanOrEqual(40);
        expect(result.winRatePct).toBeLessThanOrEqual(95);
        expect(result.maxDrawdownPct).toBeLessThan(0);
        expect(result.profitFactor).toBeGreaterThan(1.0);
        expect(result.sampleOccurrences).toBeGreaterThanOrEqual(5);
        expect(result.expectedReturnPerDollar).toBeGreaterThan(1.0);
      }
    });
  });

  describe("Curated Quick Hit Catalog", () => {
    it("validates that all curated quick hits obey liquidity, spread, and sub-$5 limit criteria", () => {
      expect(CURATED_QUICK_HITS.length).toBeGreaterThanOrEqual(3);

      for (const item of CURATED_QUICK_HITS) {
        // Daily volume floor > 500k shares
        expect(item.dailyVolume).toBeGreaterThanOrEqual(500_000);
        // Max spread cap <= 2.0%
        expect(item.spreadPct).toBeLessThanOrEqual(2.0);
        // Bracket reward-to-risk >= 1.5:1
        expect(item.bracket.rewardToRiskRatio).toBeGreaterThanOrEqual(1.5);
        // Take profit must exceed limit price
        expect(item.bracket.takeProfitPriceCents).toBeGreaterThan(item.bracket.limitPriceCents);
        // Stop loss must be below limit price
        expect(item.bracket.stopLossPriceCents).toBeLessThan(item.bracket.limitPriceCents);
      }
    });
  });

  describe("Risk Gates: Penny Stock Hard Limit Orders & Spreads", () => {
    it("strictly blocks market orders on sub-$5 penny stocks", () => {
      const input = baseOrder({
        orderType: "market", // Market order on sub-$5 stock ($2.15)!
        limitPriceCents: undefined,
        entryPriceCents: 215, // sub-$5 price
      });

      const result = evaluateOrderGates({
        input,
        account: baseAccount(),
        session: REGULAR,
        mandate: CURRENT_MANDATE,
        now: NOW,
      });

      expect(result.passed).toBe(false);
      expect(result.results.some((r) => !r.passed && r.key === "penny_stock_limit_only")).toBe(true);
    });

    it("passes sub-$5 stock when using limit order", () => {
      const input = baseOrder({
        orderType: "limit",
        limitPriceCents: 215,
      });

      const result = evaluateOrderGates({
        input,
        account: baseAccount(),
        session: REGULAR,
        mandate: CURRENT_MANDATE,
        now: NOW,
      });

      expect(result.results.some((r) => !r.passed && r.key === "penny_stock_limit_only")).toBe(false);
    });

    it("blocks orders when bid-ask spread exceeds 3.0%", () => {
      const result = evaluateOrderGates({
        input: baseOrder(),
        account: baseAccount({
          spreadPct: 4.5, // 4.5% spread > 3.0% threshold
        }),
        session: REGULAR,
        mandate: CURRENT_MANDATE,
        now: NOW,
      });

      expect(result.passed).toBe(false);
      expect(result.results.some((r) => !r.passed && r.key === "max_spread_cap")).toBe(true);
    });

    it("blocks micro-caps when daily volume is below 500k shares floor", () => {
      const result = evaluateOrderGates({
        input: baseOrder({ limitPriceCents: 215 }),
        account: baseAccount({
          dailyVolumeShares: 120_000, // 120k < 500k floor
        }),
        session: REGULAR,
        mandate: CURRENT_MANDATE,
        now: NOW,
      });

      expect(result.passed).toBe(false);
      expect(result.results.some((r) => !r.passed && r.key === "micro_cap_min_volume")).toBe(true);
    });
  });
});
