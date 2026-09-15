import { describe, it, expect } from "vitest";
import {
  evaluateOrderGates,
  ORDER_GATE_INTENT_APPLICABILITY,
  type EvaluateOrderInput,
  type OrderAccountState,
} from "./gates";
import { CURRENT_MANDATE } from "./mandate";
import { marketSession } from "./marketSession";

const MOCK_ACCOUNT: OrderAccountState = {
  isPaper: true,
  positionQty: 100,
  positionValueCents: 15_000_00,
  clusterValueCents: 15_000_00,
  clusterLabel: "Technology",
  sectorKnown: true,
  runGrossDeployedCents: 15_000_00,
  newNotionalTodayCents: 0,
  equityCents: 100_000_00, // $100k equity
  advUsd: 50_000_000, // $50M ADV
  plannedRiskTodayCents: 0,
  clusterPlannedRiskCents: 0,
};

const REGULAR_SESSION_MS = Date.parse("2026-08-12T14:30:00Z"); // 10:30 ET Wednesday

function baseOrderInput(overrides: Partial<EvaluateOrderInput> = {}): EvaluateOrderInput {
  return {
    symbol: "AAPL",
    instrumentType: "shares",
    side: "sell",
    orderType: "limit",
    timeInForce: "day",
    intent: "close",
    holdingPeriod: "intraday",
    reason: "Documented exit: taking target profit as predetermined by plan",
    paperAcknowledgement: "PAPER",
    qty: 100,
    gatedNotionalCents: 15_000_00, // $15k (exceeds default 10% single-order limit of $10k!)
    notionalBasis: "derived_from_last_price",
    ...overrides,
  };
}

describe("ORDER_GATE_INTENT_APPLICABILITY taxonomy", () => {
  it("classifies every evaluated gate across all open and close permutations", () => {
    // 1. Open shares order with all recipe fields
    const openEval = evaluateOrderGates({
      input: {
        symbol: "AAPL",
        instrumentType: "shares",
        side: "buy",
        orderType: "limit",
        timeInForce: "day",
        intent: "open",
        holdingPeriod: "intraday",
        reason: "Valid open thesis reason for entry",
        invalidationCondition: "Drop below support level of 145.00",
        catalystDeadlineAt: REGULAR_SESSION_MS + 2 * 3600_000,
        qty: 10,
        entryPriceCents: 150_00,
        stopPriceCents: 145_00,
        slippageCents: 10,
        timeStopAt: REGULAR_SESSION_MS + 3600_000,
        noTradeConditions: ["Spread > 0.05"],
        paperAcknowledgement: "PAPER",
        gatedNotionalCents: 1500_00,
        notionalBasis: "derived_from_last_price",
      },
      account: { ...MOCK_ACCOUNT, positionQty: 0 },
      session: marketSession(REGULAR_SESSION_MS),
      mandate: CURRENT_MANDATE,
      now: REGULAR_SESSION_MS,
    });

    // 2. Open option order
    const optionOpenEval = evaluateOrderGates({
      input: {
        symbol: "AAPL260918C00150000",
        instrumentType: "long_call",
        underlyingSymbol: "AAPL",
        optionExpirationDate: "2026-09-18",
        optionStrikePriceCents: 150_00,
        side: "buy",
        orderType: "limit",
        timeInForce: "day",
        intent: "open",
        holdingPeriod: "swing",
        reason: "Valid call open reason for thesis",
        invalidationCondition: "Underlying drops below 140",
        catalystDeadlineAt: REGULAR_SESSION_MS + 86400_000 * 2,
        qty: 1,
        entryPriceCents: 200,
        slippageCents: 10,
        paperAcknowledgement: "PAPER",
        gatedNotionalCents: 200_00,
        notionalBasis: "derived_from_last_price",
      },
      account: { ...MOCK_ACCOUNT, positionQty: 0 },
      session: marketSession(REGULAR_SESSION_MS),
      mandate: CURRENT_MANDATE,
      now: REGULAR_SESSION_MS,
    });

    // 3. Close shares order
    const closeEval = evaluateOrderGates({
      input: baseOrderInput(),
      account: MOCK_ACCOUNT,
      session: marketSession(REGULAR_SESSION_MS),
      mandate: CURRENT_MANDATE,
      now: REGULAR_SESSION_MS,
    });

    // 4. Close option order
    const optionCloseEval = evaluateOrderGates({
      input: {
        symbol: "AAPL260918C00150000",
        instrumentType: "long_call",
        underlyingSymbol: "AAPL",
        optionExpirationDate: "2026-09-18",
        optionStrikePriceCents: 150_00,
        side: "sell",
        orderType: "limit",
        timeInForce: "day",
        intent: "close",
        holdingPeriod: "swing",
        reason: "Closing out remaining option contracts",
        paperAcknowledgement: "PAPER",
        qty: 5,
        gatedNotionalCents: 1000_00,
        notionalBasis: "derived_from_last_price",
      },
      account: { ...MOCK_ACCOUNT, positionQty: 5 },
      session: marketSession(REGULAR_SESSION_MS),
      mandate: CURRENT_MANDATE,
      now: REGULAR_SESSION_MS,
    });

    const observedGateKeys = new Set<string>([
      ...openEval.results.map((r) => r.key),
      ...optionOpenEval.results.map((r) => r.key),
      ...closeEval.results.map((r) => r.key),
      ...optionCloseEval.results.map((r) => r.key),
    ]);

    for (const key of observedGateKeys) {
      expect(
        ORDER_GATE_INTENT_APPLICABILITY,
        `Gate key "${key}" must be declared in ORDER_GATE_INTENT_APPLICABILITY`,
      ).toHaveProperty(key);
    }
  });
});

describe("Intent-Aware Order Gates: Closing orders", () => {
  it("allows closing a full long position exceeding single-order ceiling without recipe or thesis gates", () => {
    // $15,000 notional on $100,000 equity breaches 10% ($10,000) ceiling if opening,
    // but MUST PASS when closing!
    const result = evaluateOrderGates({
      input: baseOrderInput({
        qty: 100,
        gatedNotionalCents: 15_000_00,
        invalidationCondition: undefined,
        catalystDeadlineAt: undefined,
        entryPriceCents: undefined,
        stopPriceCents: undefined,
        slippageCents: undefined,
      }),
      account: MOCK_ACCOUNT, // holds 100
      session: marketSession(REGULAR_SESSION_MS),
      mandate: CURRENT_MANDATE,
      now: REGULAR_SESSION_MS,
    });

    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);

    const gateKeys = result.results.map((r) => r.key);
    // Universal gates pass
    expect(gateKeys).toContain("order_intent");
    expect(gateKeys).toContain("paper_account");
    expect(gateKeys).toContain("instrument_identity");
    expect(gateKeys).toContain("paper_acknowledgement");
    expect(gateKeys).toContain("reason");
    expect(gateKeys).toContain("holding_period");
    expect(gateKeys).toContain("market_session_known");
    expect(gateKeys).toContain("market_open");
    expect(gateKeys).toContain("liquidity_adv_floor");

    // Open-only gates must NOT be evaluated as blocking gates
    expect(gateKeys).not.toContain("invalidation_condition");
    expect(gateKeys).not.toContain("catalyst_deadline");
    expect(gateKeys).not.toContain("play_entry");
    expect(gateKeys).not.toContain("play_stop");
    expect(gateKeys).not.toContain("play_slippage");
    expect(gateKeys).not.toContain("play_time_stop");
    expect(gateKeys).not.toContain("planned_risk_stated");
    expect(gateKeys).not.toContain("order_notional_ceiling");
    expect(gateKeys).not.toContain("position_concentration");

    // Notes explain why ceilings were skipped
    expect(result.notes.some((n) => n.includes("single-order ceiling applies to taking risk"))).toBe(true);
    expect(result.notes.some((n) => n.includes("invalidation condition applies to thesis entry"))).toBe(true);
  });

  it("allows closing a partial position (reducing exposure)", () => {
    const result = evaluateOrderGates({
      input: baseOrderInput({ qty: 40 }), // 40 out of 100
      account: MOCK_ACCOUNT,
      session: marketSession(REGULAR_SESSION_MS),
      mandate: CURRENT_MANDATE,
      now: REGULAR_SESSION_MS,
    });

    expect(result.passed).toBe(true);
  });

  it("allows closing long options via sell-to-close even near expiration", () => {
    const result = evaluateOrderGates({
      input: {
        symbol: "AAPL260812C00150000",
        instrumentType: "long_call",
        underlyingSymbol: "AAPL",
        optionExpirationDate: "2026-08-12", // Expiring today (0DTE)
        optionStrikePriceCents: 150_00,
        side: "sell",
        orderType: "limit",
        timeInForce: "day",
        intent: "close",
        holdingPeriod: "intraday",
        reason: "Taking profits on call position before expiration",
        paperAcknowledgement: "PAPER",
        qty: 5,
        gatedNotionalCents: 1000_00,
        notionalBasis: "derived_from_last_price",
      },
      account: { ...MOCK_ACCOUNT, positionQty: 5 },
      session: marketSession(REGULAR_SESSION_MS),
      mandate: CURRENT_MANDATE,
      now: REGULAR_SESSION_MS,
    });

    expect(result.passed).toBe(true);
    const gateKeys = result.results.map((r) => r.key);
    expect(gateKeys).toContain("long_option_sell_only");
    expect(gateKeys).not.toContain("long_option_buy_only");
    expect(gateKeys).not.toContain("option_expiration_window"); // 0DTE restriction skipped on close!
  });

  it("fails closed when stated intent is close but no position is held", () => {
    const result = evaluateOrderGates({
      input: baseOrderInput({
        qty: 100,
        invalidationCondition: undefined,
        catalystDeadlineAt: undefined,
      }),
      account: { ...MOCK_ACCOUNT, positionQty: 0 }, // FLAT!
      session: marketSession(REGULAR_SESSION_MS),
      mandate: CURRENT_MANDATE,
      now: REGULAR_SESSION_MS,
    });

    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes("there is no long position for it to close"))).toBe(true);
  });

  it("fails closed when closing sell qty exceeds held position", () => {
    const result = evaluateOrderGates({
      input: baseOrderInput({
        qty: 150, // exceeds 100 held
        invalidationCondition: undefined,
        catalystDeadlineAt: undefined,
      }),
      account: MOCK_ACCOUNT, // holds 100
      session: marketSession(REGULAR_SESSION_MS),
      mandate: CURRENT_MANDATE,
      now: REGULAR_SESSION_MS,
    });

    // Fails closed by treating the order as opening (which requires invalidation, catalyst, etc.)
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes("invalidationCondition"))).toBe(true);
  });
});
