/**
 * Risk gates — the mandate, exercised.
 *
 * These are the P0 tests: an order must not be creatable without a reason, an
 * invalidation condition, a market-hours state and a Paper acknowledgement, and
 * must not be creatable over a notional, concentration or liquidity ceiling. A
 * run must not start without the five preset fields.
 *
 * Everything here is pure — no database, no clock, no network.
 */
import { describe, it, expect } from "vitest";
import { evaluateOrderGates, evaluateRunPreset, type OrderAccountState, type OrderGateInput } from "./gates";
import { marketSession, type SessionState } from "./marketSession";
import { CURRENT_MANDATE, MANDATE_V1, effectiveMandate, PAPER_ACKNOWLEDGEMENT } from "./mandate";

const NOW = Date.parse("2026-06-10T14:30:00Z"); // Wed 10:30 ET, regular session
const DAY = 86_400_000;
const REGULAR = marketSession(NOW);

/** $100,000 equity — the live paper account, rounded. */
const EQUITY = 10_000_000;

const order = (over: Partial<OrderGateInput> = {}): OrderGateInput => ({
  symbol: "NVDA",
  side: "buy",
  orderType: "market",
  timeInForce: "day",
  holdingPeriod: "swing",
  reason: "Adds inference exposure ahead of the Q3 datacenter print",
  invalidationCondition: "Exit if the datacenter segment guide comes in below consensus",
  catalystDeadlineAt: NOW + 5 * DAY,
  paperAcknowledgement: PAPER_ACKNOWLEDGEMENT,
  gatedNotionalCents: 300_000, // $3,000
  notionalBasis: "stated",
  ...over,
});

const account = (over: Partial<OrderAccountState> = {}): OrderAccountState => ({
  isPaper: true,
  equityCents: EQUITY,
  positionValueCents: 0,
  clusterValueCents: 0,
  clusterLabel: "Semiconductors",
  sectorKnown: true,
  newNotionalTodayCents: 0,
  runGrossDeployedCents: 0,
  advUsd: 500_000_000,
  ...over,
});

const evalOrder = (
  o: Partial<OrderGateInput> = {},
  a: Partial<OrderAccountState> = {},
  session: SessionState = REGULAR,
  now: number = NOW,
) => evaluateOrderGates({ input: order(o), account: account(a), session, mandate: CURRENT_MANDATE, now });

const gate = (ev: ReturnType<typeof evalOrder>, key: string) => ev.results.find((r) => r.key === key);

// ── Baseline ──────────────────────────────────────────────────────────────────

describe("evaluateOrderGates — a fully specified order", () => {
  it("passes", () => {
    const ev = evalOrder();
    expect(ev.failures).toEqual([]);
    expect(ev.passed).toBe(true);
  });

  it("stamps the mandate version so the row records what it was checked against", () => {
    expect(evalOrder().mandateVersion).toBe(MANDATE_V1.version);
  });

  it("records every gate, passed or failed — the snapshot is the audit trail", () => {
    const keys = evalOrder().results.map((r) => r.key);
    for (const k of [
      "paper_account", "paper_acknowledgement", "reason", "invalidation_condition",
      "holding_period", "catalyst_deadline", "market_session_known", "market_open",
      "notional_resolvable", "equity_known", "order_notional_ceiling",
      "position_concentration", "cluster_concentration", "run_gross_deployed",
      "daily_new_notional", "liquidity_adv_floor", "liquidity_participation",
    ]) {
      expect(keys).toContain(k);
    }
  });
});

// ── Required narrative ────────────────────────────────────────────────────────

describe("reason and invalidation condition", () => {
  it("blocks an order with no reason", () => {
    const ev = evalOrder({ reason: "" });
    expect(ev.passed).toBe(false);
    expect(gate(ev, "reason")!.passed).toBe(false);
  });

  it("blocks an order with no invalidation condition", () => {
    const ev = evalOrder({ invalidationCondition: null });
    expect(gate(ev, "invalidation_condition")!.passed).toBe(false);
  });

  it("rejects boilerplate that would otherwise satisfy a presence check", () => {
    for (const junk of ["n/a", "N/A", "see memo", "tbd", "test"]) {
      const ev = evalOrder({ reason: junk });
      expect(gate(ev, "reason")!.passed).toBe(false);
      expect(gate(ev, "reason")!.detail).toContain("boilerplate");
    }
  });

  it("rejects a reason that is too short to say anything", () => {
    const ev = evalOrder({ reason: "looks good" });
    expect(gate(ev, "reason")!.passed).toBe(false);
  });
});

// ── Paper acknowledgement ─────────────────────────────────────────────────────

describe("paper acknowledgement", () => {
  it("blocks when the acknowledgement is missing", () => {
    expect(gate(evalOrder({ paperAcknowledgement: null }), "paper_acknowledgement")!.passed).toBe(false);
  });

  it("blocks when it is not the literal", () => {
    expect(gate(evalOrder({ paperAcknowledgement: "yes" }), "paper_acknowledgement")!.passed).toBe(false);
  });

  it("accepts the literal case-insensitively", () => {
    expect(gate(evalOrder({ paperAcknowledgement: "paper" }), "paper_acknowledgement")!.passed).toBe(true);
  });

  it("blocks an account that is not flagged paper — there is no live path", () => {
    const ev = evalOrder({}, { isPaper: false });
    expect(gate(ev, "paper_account")!.passed).toBe(false);
    expect(ev.passed).toBe(false);
  });
});

// ── Holding period and catalyst deadline ──────────────────────────────────────

describe("holding period and catalyst deadline", () => {
  it("blocks an unrecognised holding period", () => {
    expect(gate(evalOrder({ holdingPeriod: "forever" }), "holding_period")!.passed).toBe(false);
  });

  it("blocks a missing holding period", () => {
    expect(gate(evalOrder({ holdingPeriod: "" }), "holding_period")!.passed).toBe(false);
  });

  it("blocks a missing catalyst deadline", () => {
    const ev = evalOrder({ catalystDeadlineAt: null });
    expect(gate(ev, "catalyst_deadline")!.passed).toBe(false);
    expect(gate(ev, "catalyst_deadline")!.detail).toContain("required");
  });

  it("blocks a catalyst deadline already in the past", () => {
    expect(gate(evalOrder({ catalystDeadlineAt: NOW - DAY }), "catalyst_deadline")!.passed).toBe(false);
  });

  it("blocks a deadline beyond the horizon of its holding period", () => {
    const ev = evalOrder({ holdingPeriod: "overnight", catalystDeadlineAt: NOW + 9 * DAY });
    expect(gate(ev, "catalyst_deadline")!.passed).toBe(false);
  });

  it("accepts a 25-day deadline for a catalyst window but not for a swing", () => {
    const far = NOW + 25 * DAY;
    expect(gate(evalOrder({ holdingPeriod: "catalyst_window", catalystDeadlineAt: far }), "catalyst_deadline")!.passed).toBe(true);
    expect(gate(evalOrder({ holdingPeriod: "swing", catalystDeadlineAt: far }), "catalyst_deadline")!.passed).toBe(false);
  });
});

// ── Market hours ──────────────────────────────────────────────────────────────

describe("market hours", () => {
  const at = (iso: string) => marketSession(Date.parse(iso));

  it("blocks when the market is closed", () => {
    const closed = at("2026-06-13T14:30:00Z"); // Saturday
    const ev = evalOrder({}, {}, closed, Date.parse("2026-06-13T14:30:00Z"));
    expect(gate(ev, "market_open")!.passed).toBe(false);
  });

  it("blocks when the session is unknown rather than assuming it is open", () => {
    const unknown = at("2029-06-13T14:30:00Z");
    const ev = evalOrder({}, {}, unknown, Date.parse("2029-06-13T14:30:00Z"));
    expect(gate(ev, "market_session_known")!.passed).toBe(false);
    expect(ev.passed).toBe(false);
  });

  it("requires the regular session for an intraday order", () => {
    const pre = at("2026-06-10T12:00:00Z"); // 08:00 ET
    const now = Date.parse("2026-06-10T12:00:00Z");
    const ev = evalOrder(
      { holdingPeriod: "intraday", catalystDeadlineAt: now + 6 * 3_600_000, orderType: "limit" },
      {}, pre, now,
    );
    expect(gate(ev, "intraday_requires_regular_session")!.passed).toBe(false);
  });

  it("allows a limit + day order in the pre-market", () => {
    const pre = at("2026-06-10T12:00:00Z");
    const now = Date.parse("2026-06-10T12:00:00Z");
    const ev = evalOrder({ orderType: "limit", timeInForce: "day", catalystDeadlineAt: now + 5 * DAY }, {}, pre, now);
    expect(gate(ev, "extended_hours_limit_only")!.passed).toBe(true);
    expect(ev.passed).toBe(true);
  });

  it("blocks a market order outside the regular session", () => {
    const after = at("2026-06-10T21:00:00Z"); // 17:00 ET
    const now = Date.parse("2026-06-10T21:00:00Z");
    const ev = evalOrder({ orderType: "market", catalystDeadlineAt: now + 5 * DAY }, {}, after, now);
    expect(gate(ev, "extended_hours_limit_only")!.passed).toBe(false);
  });

  it("blocks a new intraday order after the 15:55 ET cutoff", () => {
    const late = at("2026-06-10T19:56:00Z"); // 15:56 ET
    const now = Date.parse("2026-06-10T19:56:00Z");
    const ev = evalOrder({ holdingPeriod: "intraday", catalystDeadlineAt: now + 3_600_000 }, {}, late, now);
    expect(gate(ev, "intraday_cutoff")!.passed).toBe(false);
    expect(ev.passed).toBe(false);
  });

  it("allows an intraday order at 15:54 ET", () => {
    const ok = at("2026-06-10T19:54:00Z");
    const now = Date.parse("2026-06-10T19:54:00Z");
    const ev = evalOrder({ holdingPeriod: "intraday", catalystDeadlineAt: now + 3_600_000 }, {}, ok, now);
    expect(gate(ev, "intraday_cutoff")!.passed).toBe(true);
    expect(ev.passed).toBe(true);
  });

  it("does not apply the intraday cutoff to a swing order", () => {
    const late = at("2026-06-10T19:56:00Z");
    const now = Date.parse("2026-06-10T19:56:00Z");
    const ev = evalOrder({ catalystDeadlineAt: now + 5 * DAY }, {}, late, now);
    expect(gate(ev, "intraday_cutoff")).toBeUndefined();
    expect(ev.passed).toBe(true);
  });
});

// ── Notional and concentration ────────────────────────────────────────────────

describe("notional and concentration ceilings", () => {
  it("blocks an order whose notional cannot be established", () => {
    const ev = evalOrder({ gatedNotionalCents: null, notionalBasis: "unknown" });
    expect(gate(ev, "notional_resolvable")!.passed).toBe(false);
    expect(ev.passed).toBe(false);
  });

  it("blocks when account equity is unknown — a ceiling needs a denominator", () => {
    const ev = evalOrder({}, { equityCents: null });
    expect(gate(ev, "equity_known")!.passed).toBe(false);
    expect(gate(ev, "order_notional_ceiling")).toBeUndefined();
  });

  it("blocks a single order over 5% of equity", () => {
    const ev = evalOrder({ gatedNotionalCents: 600_000 }); // $6,000 of $100k
    expect(gate(ev, "order_notional_ceiling")!.passed).toBe(false);
  });

  it("allows an order exactly at the 5% ceiling", () => {
    expect(gate(evalOrder({ gatedNotionalCents: 500_000 }), "order_notional_ceiling")!.passed).toBe(true);
  });

  it("applies the $10,000 absolute cap when 5% of equity would be larger", () => {
    const ev = evaluateOrderGates({
      input: order({ gatedNotionalCents: 1_200_000 }), // $12,000
      account: account({ equityCents: 100_000_000, advUsd: 5_000_000_000 }), // $1M equity
      session: REGULAR,
      now: NOW,
    });
    expect(gate(ev, "order_notional_ceiling")!.passed).toBe(false);
    expect(gate(ev, "order_notional_ceiling")!.ceiling).toBe(MANDATE_V1.maxOrderNotionalCents);
  });

  it("blocks when the post-fill position would breach the 10% single-name cap", () => {
    const ev = evalOrder({ gatedNotionalCents: 400_000 }, { positionValueCents: 700_000 });
    expect(gate(ev, "position_concentration")!.passed).toBe(false);
  });

  it("blocks when the post-fill cluster would breach the 25% cap", () => {
    const ev = evalOrder({ gatedNotionalCents: 400_000 }, { clusterValueCents: 2_300_000 });
    expect(gate(ev, "cluster_concentration")!.passed).toBe(false);
  });

  it("treats an unclassified name as its own cluster and says so", () => {
    const ev = evalOrder({}, { sectorKnown: false, clusterValueCents: 0, clusterLabel: "NVDA (unclassified)" });
    expect(gate(ev, "cluster_concentration")!.passed).toBe(true);
    expect(ev.notes.join(" ")).toContain("single-name cluster");
  });

  it("blocks when the run would exceed 40% gross deployed", () => {
    const ev = evalOrder({}, { runGrossDeployedCents: 3_900_000 });
    expect(gate(ev, "run_gross_deployed")!.passed).toBe(false);
  });

  it("blocks when the day would exceed 20% new notional", () => {
    const ev = evalOrder({}, { newNotionalTodayCents: 1_900_000 });
    expect(gate(ev, "daily_new_notional")!.passed).toBe(false);
  });

  it("records a derived notional as modeled rather than passing it off as stated", () => {
    const ev = evalOrder({ notionalBasis: "derived_from_last_price" });
    expect(ev.passed).toBe(true);
    expect(ev.notes.join(" ")).toContain("derived from the last priced fact");
  });
});

// ── Sells ─────────────────────────────────────────────────────────────────────

describe("sell orders", () => {
  it("skips the exposure-increasing ceilings", () => {
    const ev = evalOrder(
      { side: "sell" },
      { positionValueCents: 5_000_000, clusterValueCents: 5_000_000, runGrossDeployedCents: 3_900_000 },
    );
    expect(gate(ev, "position_concentration")).toBeUndefined();
    expect(gate(ev, "run_gross_deployed")).toBeUndefined();
    expect(ev.passed).toBe(true);
  });

  it("still requires a reason, an invalidation condition and liquidity", () => {
    const ev = evalOrder({ side: "sell", reason: "n/a" }, { advUsd: null });
    expect(gate(ev, "reason")!.passed).toBe(false);
    expect(gate(ev, "liquidity_adv_floor")!.passed).toBe(false);
  });
});

// ── Liquidity ─────────────────────────────────────────────────────────────────

describe("liquidity", () => {
  it("fails closed when no ADV fact exists — unknown is not a pass", () => {
    const ev = evalOrder({}, { advUsd: null });
    expect(gate(ev, "liquidity_adv_floor")!.passed).toBe(false);
    expect(gate(ev, "liquidity_adv_floor")!.detail).toContain("unknown liquidity is not a passing liquidity");
    expect(ev.passed).toBe(false);
  });

  it("blocks a name below the $20M ADV floor", () => {
    expect(gate(evalOrder({}, { advUsd: 4_000_000 }), "liquidity_adv_floor")!.passed).toBe(false);
  });

  it("blocks an order that is more than 0.5% of ADV", () => {
    // $3,000 order against $400,000 ADV = 0.75%
    const ev = evalOrder({}, { advUsd: 40_000_000 });
    expect(gate(ev, "liquidity_adv_floor")!.passed).toBe(true);
    const tight = evalOrder({ gatedNotionalCents: 30_000_000 }, { advUsd: 40_000_000 });
    expect(gate(tight, "liquidity_participation")!.passed).toBe(false);
  });
});

// ── Thesis rules may tighten, never loosen ────────────────────────────────────

describe("effectiveMandate", () => {
  it("takes the thesis's stricter single-name cap", () => {
    const m = effectiveMandate(MANDATE_V1, { maxSingleNamePct: 4 });
    expect(m.maxPositionPctOfEquity).toBe(4);
  });

  it("ignores a thesis rule that tries to loosen the cap", () => {
    const m = effectiveMandate(MANDATE_V1, { maxSingleNamePct: 30 });
    expect(m.maxPositionPctOfEquity).toBe(MANDATE_V1.maxPositionPctOfEquity);
  });

  it("raises the ADV floor when the thesis demands more liquidity, never lowers it", () => {
    expect(effectiveMandate(MANDATE_V1, { minAvgDailyVolumeUsd: 50_000_000 }).minAdvUsd30d).toBe(50_000_000);
    expect(effectiveMandate(MANDATE_V1, { minAvgDailyVolumeUsd: 1_000_000 }).minAdvUsd30d).toBe(MANDATE_V1.minAdvUsd30d);
  });

  it("derives the gross-deployed ceiling from a larger cash reserve", () => {
    expect(effectiveMandate(MANDATE_V1, { reservePct: 80 }).maxRunGrossDeployedPctOfEquity).toBe(20);
    expect(effectiveMandate(MANDATE_V1, { reservePct: 10 }).maxRunGrossDeployedPctOfEquity).toBe(40);
  });

  it("parses the compiler's string-typed rules", () => {
    expect(effectiveMandate(MANDATE_V1, { maxSingleNamePct: "3" as any }).maxPositionPctOfEquity).toBe(3);
    expect(effectiveMandate(MANDATE_V1, { minAvgDailyVolumeUsd: "$75,000,000" as any }).minAdvUsd30d).toBe(75_000_000);
  });

  it("ignores unparseable values instead of silently zeroing a ceiling", () => {
    const m = effectiveMandate(MANDATE_V1, { maxSingleNamePct: "moderate" as any });
    expect(m.maxPositionPctOfEquity).toBe(MANDATE_V1.maxPositionPctOfEquity);
  });

  it("is applied end to end: a 4% thesis cap blocks a 5% position", () => {
    const ev = evaluateOrderGates({
      input: order({ gatedNotionalCents: 500_000 }),
      account: account(),
      session: REGULAR,
      mandate: effectiveMandate(MANDATE_V1, { maxSingleNamePct: 4 }),
      now: NOW,
    });
    expect(gate(ev, "position_concentration")!.passed).toBe(false);
  });
});

// ── Run preset ────────────────────────────────────────────────────────────────

const preset = (over: Partial<Parameters<typeof evaluateRunPreset>[0]> = {}) => ({
  holdingPeriod: "swing",
  liquidityFloorAdvUsd: 25_000_000,
  catalystDeadlineAt: NOW + 10 * DAY,
  maxSingleNamePct: 8,
  invalidationRule: "Abandon the run if the sector breadth thrust reverses for two sessions",
  deployableCapitalCents: 3_000_000, // 30% of $100k
  ...over,
});

const evalPreset = (
  o: Partial<Parameters<typeof evaluateRunPreset>[0]> = {},
  ctx = { accountLinked: true, equityCents: EQUITY },
) => evaluateRunPreset(preset(o), ctx, CURRENT_MANDATE, NOW);

const presetGate = (ev: ReturnType<typeof evalPreset>, key: string) => ev.results.find((r) => r.key === key);

describe("evaluateRunPreset", () => {
  it("passes a fully specified short-horizon run", () => {
    const ev = evalPreset();
    expect(ev.failures).toEqual([]);
    expect(ev.mandateVersion).toBe(MANDATE_V1.version);
  });

  it("blocks a run with no valid holding period", () => {
    expect(presetGate(evalPreset({ holdingPeriod: "" }), "holding_period")!.passed).toBe(false);
  });

  it("blocks a catalyst deadline in the past", () => {
    expect(presetGate(evalPreset({ catalystDeadlineAt: NOW - DAY }), "catalyst_deadline")!.passed).toBe(false);
  });

  it("blocks a catalyst deadline beyond the holding period's horizon", () => {
    const ev = evalPreset({ holdingPeriod: "intraday", catalystDeadlineAt: NOW + 5 * DAY });
    expect(presetGate(ev, "catalyst_deadline")!.passed).toBe(false);
  });

  it("blocks a liquidity floor looser than the mandate's", () => {
    const ev = evalPreset({ liquidityFloorAdvUsd: 5_000_000 });
    expect(presetGate(ev, "liquidity_floor")!.passed).toBe(false);
    expect(presetGate(ev, "liquidity_floor")!.detail).toContain("never loosen");
  });

  it("allows a liquidity floor tighter than the mandate's", () => {
    expect(presetGate(evalPreset({ liquidityFloorAdvUsd: 80_000_000 }), "liquidity_floor")!.passed).toBe(true);
  });

  it("blocks a concentration cap looser than the mandate's", () => {
    expect(presetGate(evalPreset({ maxSingleNamePct: 25 }), "concentration_cap")!.passed).toBe(false);
  });

  it("blocks a zero or negative concentration cap", () => {
    expect(presetGate(evalPreset({ maxSingleNamePct: 0 }), "concentration_cap")!.passed).toBe(false);
  });

  it("blocks a missing or boilerplate invalidation rule", () => {
    expect(presetGate(evalPreset({ invalidationRule: "" }), "invalidation_rule")!.passed).toBe(false);
    expect(presetGate(evalPreset({ invalidationRule: "tbd" }), "invalidation_rule")!.passed).toBe(false);
  });

  it("blocks deployable capital over the 40% per-run ceiling", () => {
    const ev = evalPreset({ deployableCapitalCents: 5_000_000 });
    expect(presetGate(ev, "deployable_capital")!.passed).toBe(false);
  });

  it("blocks a run against an account whose equity has never synced", () => {
    const ev = evalPreset({}, { accountLinked: true, equityCents: null });
    expect(presetGate(ev, "deployable_capital")!.passed).toBe(false);
  });

  it("allows an analysis-only run with no account, and records why the ceiling was skipped", () => {
    const ev = evalPreset({}, { accountLinked: false, equityCents: null });
    expect(ev.passed).toBe(true);
    expect(ev.notes.join(" ")).toContain("analysis-only");
  });
});
