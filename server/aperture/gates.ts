/**
 * Risk gates — pure evaluators. No database, no network, no clock.
 *
 * Everything I/O-shaped (loading the account, summing today's orders, reading the
 * fact ledger, reading the wall clock) happens in the caller and arrives here as
 * data. That is what makes the ceilings testable, and it is why these functions
 * return a *result set* rather than throwing: the caller persists the whole
 * evaluation as `gateSnapshot`, so a blocked order records which ceiling stopped
 * it and what the observed value was — not just "rejected".
 *
 * Two rules run through all of it:
 *
 *   1. Unknown fails closed. A null ADV, a null equity, an unresolvable notional
 *      or an unknown market session does not "pass by default". The honesty
 *      contract says a field the source does not state stays null; the gate says
 *      you cannot size a position against a null.
 *
 *   2. Sells are exposure-reducing. Concentration, run-gross and daily-new gates
 *      do not apply to a sell. Liquidity, narrative, session and acknowledgement
 *      gates still do — you can be just as wrong on the way out.
 */
import {
  CURRENT_MANDATE,
  HOLDING_PERIODS,
  PAPER_ACKNOWLEDGEMENT,
  checkNarrative,
  isHoldingPeriod,
  type HoldingPeriod,
  type Mandate,
} from "./mandate";
import type { MarketSession, SessionState } from "./marketSession";

// ── Result shape ──────────────────────────────────────────────────────────────

export interface GateResult {
  key: string;
  passed: boolean;
  detail: string;
  /** The measured value, in whatever unit the gate works in. */
  observed?: number | null;
  /** The ceiling (or floor) it was measured against. */
  ceiling?: number | null;
}

export interface GateEvaluation {
  passed: boolean;
  mandateVersion: string;
  evaluatedAt: number;
  results: GateResult[];
  /** `detail` of every failed gate, in evaluation order. */
  failures: string[];
  /** Things worth recording that are not failures. */
  notes: string[];
}

class GateCollector {
  readonly results: GateResult[] = [];
  readonly notes: string[] = [];

  add(key: string, passed: boolean, detail: string, observed?: number | null, ceiling?: number | null) {
    this.results.push({ key, passed, detail, observed: observed ?? null, ceiling: ceiling ?? null });
  }

  note(n: string) {
    this.notes.push(n);
  }

  finish(mandateVersion: string, evaluatedAt: number): GateEvaluation {
    const failures = this.results.filter((r) => !r.passed).map((r) => r.detail);
    return {
      passed: failures.length === 0,
      mandateVersion,
      evaluatedAt,
      results: this.results,
      failures,
      notes: this.notes,
    };
  }
}

const pctOf = (cents: number, equityCents: number): number => (cents / equityCents) * 100;
const round2 = (n: number): number => Math.round(n * 100) / 100;

// ── Order gates ───────────────────────────────────────────────────────────────

export type NotionalBasis = "stated" | "derived_from_last_price" | "unknown";

export interface OrderGateInput {
  symbol: string;
  side: "buy" | "sell";
  orderType: "market" | "limit";
  timeInForce: "day" | "gtc";
  holdingPeriod: HoldingPeriod | string;
  reason?: string | null;
  invalidationCondition?: string | null;
  /** When the thesis for this trade expires. Required on every holding period. */
  catalystDeadlineAt?: number | null;
  entryPriceCents?: number | null;
  stopPriceCents?: number | null;
  slippageCents?: number | null;
  timeStopAt?: number | null;
  noTradeConditions?: string[] | null;
  paperAcknowledgement?: string | null;
  /**
   * The order's notional in cents as the gates will use it. `stated` when the
   * operator gave notionalCents; `derived_from_last_price` when it came from
   * qty × a priced fact; `unknown` when neither was available.
   */
  gatedNotionalCents: number | null;
  notionalBasis: NotionalBasis;
}

export interface OrderAccountState {
  /** Structural paper-only reinforcement — the adapter also asserts this. */
  isPaper: boolean;
  /** Account equity in cents. Null when the account has never synced. */
  equityCents: number | null;
  /** Market value already held in the order's symbol. */
  positionValueCents: number;
  /** Market value of the symbol's sector cluster, including positionValueCents. */
  clusterValueCents: number;
  /** For the audit line — e.g. "Semiconductors" or "unclassified". */
  clusterLabel: string;
  /** False when no sector fact exists; the cluster is then the single name. */
  sectorKnown: boolean;
  /** Buy notional already created today (ET day), across all runs. */
  newNotionalTodayCents: number;
  /** Buy notional already created for this run. */
  runGrossDeployedCents: number;
  /** 30-day average daily dollar volume, USD. Null when no fact states it. */
  advUsd: number | null;
}

export interface EvaluateOrderArgs {
  input: OrderGateInput;
  account: OrderAccountState;
  session: SessionState;
  mandate?: Mandate;
  now: number;
}

export function evaluateOrderGates(args: EvaluateOrderArgs): GateEvaluation {
  const { input, account, session, now } = args;
  const mandate = args.mandate ?? CURRENT_MANDATE;
  const g = new GateCollector();
  const isBuy = input.side === "buy";

  // ── Structural ──────────────────────────────────────────────────────────────
  g.add(
    "paper_account",
    account.isPaper === true,
    account.isPaper ? "account is a paper account" : "account is not flagged paper — there is no live-execution path",
  );

  const ack = (input.paperAcknowledgement ?? "").trim().toUpperCase();
  g.add(
    "paper_acknowledgement",
    ack === PAPER_ACKNOWLEDGEMENT,
    ack === PAPER_ACKNOWLEDGEMENT
      ? "operator acknowledged this is a paper order"
      : `paperAcknowledgement must be the literal "${PAPER_ACKNOWLEDGEMENT}"`,
  );

  // ── Narrative ───────────────────────────────────────────────────────────────
  const reason = checkNarrative(input.reason, "reason");
  g.add("reason", reason.ok, reason.ok ? "reason stated" : reason.reason!);

  const invalidation = checkNarrative(input.invalidationCondition, "invalidationCondition");
  g.add(
    "invalidation_condition",
    invalidation.ok,
    invalidation.ok ? "invalidation condition stated" : invalidation.reason!,
  );

  // ── Holding period + catalyst deadline ──────────────────────────────────────
  const hpValid = isHoldingPeriod(input.holdingPeriod);
  g.add(
    "holding_period",
    hpValid,
    hpValid
      ? `holding period: ${HOLDING_PERIODS[input.holdingPeriod as HoldingPeriod].label}`
      : `holdingPeriod must be one of ${Object.keys(HOLDING_PERIODS).join(", ")} (got "${input.holdingPeriod}")`,
  );

  const rule = hpValid ? HOLDING_PERIODS[input.holdingPeriod as HoldingPeriod] : null;
  const deadline = input.catalystDeadlineAt ?? null;
  if (deadline == null) {
    g.add("catalyst_deadline", false, "catalystDeadlineAt is required — a short-horizon trade with no expiry is a hold");
  } else if (deadline <= now) {
    g.add("catalyst_deadline", false, "catalystDeadlineAt is in the past", deadline, now);
  } else if (rule) {
    const days = (deadline - now) / 86_400_000;
    const ok = days <= rule.maxHorizonDays;
    g.add(
      "catalyst_deadline",
      ok,
      ok
        ? `catalyst is ${round2(days)}d out, inside the ${rule.maxHorizonDays}d ${rule.label.toLowerCase()} horizon`
        : `catalyst is ${round2(days)}d out — beyond the ${rule.maxHorizonDays}d horizon for ${rule.label.toLowerCase()}`,
      round2(days),
      rule.maxHorizonDays,
    );
  } else {
    g.add("catalyst_deadline", false, "catalyst horizon cannot be checked without a valid holding period");
  }

  // ── Market session ──────────────────────────────────────────────────────────
  const known = session.session !== "unknown";
  g.add("market_session_known", known, known ? `session: ${session.session} (${session.basis})` : `market session unknown — ${session.basis}`);

  if (known) {
    g.add(
      "market_open",
      session.session !== "closed",
      session.session === "closed" ? "market is closed — no order may be created" : `market session is ${session.session}`,
    );

    if (rule?.requiresRegularSession) {
      const ok = session.session === "regular";
      g.add(
        "intraday_requires_regular_session",
        ok,
        ok ? "intraday order placed during the regular session" : `an intraday order requires the regular session (current: ${session.session})`,
      );
    }

    if (session.session === "pre_market" || session.session === "after_hours") {
      const ok = input.orderType === "limit" && input.timeInForce === "day";
      g.add(
        "extended_hours_limit_only",
        ok,
        ok
          ? "extended-hours order is limit + day, as required"
          : `outside the regular session an order must be limit + day (got ${input.orderType} + ${input.timeInForce})`,
      );
    }

    // Signed off 2026-08-13: this blocks, it does not merely flag.
    if (rule?.mustBeFlatBySessionEnd && session.etMinutes != null) {
      const ok = session.etMinutes < mandate.intradayCutoffEtMinutes;
      g.add(
        "intraday_cutoff",
        ok,
        ok
          ? `${fmtEt(session.etMinutes)} ET is before the ${fmtEt(mandate.intradayCutoffEtMinutes)} ET intraday cutoff`
          : `no new intraday order after ${fmtEt(mandate.intradayCutoffEtMinutes)} ET (now ${fmtEt(session.etMinutes)} ET) — the position must be flat by the close`,
        session.etMinutes,
        mandate.intradayCutoffEtMinutes,
      );
    }
  }

  // ── Intraday play recipe ───────────────────────────────────────────────────
  // These are proposal-creation gates only. A time stop or invalidation never
  // closes a position automatically; it gives the human a documented review plan.
  if (input.holdingPeriod === "intraday") {
    const entry = input.entryPriceCents ?? null;
    const stop = input.stopPriceCents ?? null;
    const slippage = input.slippageCents ?? null;
    const validEntry = entry != null && entry > 0;
    const validStop = stop != null && stop > 0 && stop !== entry;
    const validSlippage = slippage != null && slippage >= 0;
    g.add("play_entry", validEntry, validEntry ? "play entry is stated" : "intraday play requires a positive entry price");
    g.add("play_stop", validStop, validStop ? "play stop is stated" : "intraday play requires a stop different from entry");
    g.add("play_slippage", validSlippage, validSlippage ? "slippage allowance is stated" : "intraday play requires a slippage allowance");
    const timeStop = input.timeStopAt ?? null;
    const deadlineForStop = input.catalystDeadlineAt ?? null;
    const validTimeStop = timeStop != null && timeStop > now && (deadlineForStop == null || timeStop <= deadlineForStop);
    g.add("play_time_stop", validTimeStop, validTimeStop ? "human close-review time is inside the catalyst window" : "intraday play requires a future time stop inside the catalyst window");
    const noTradeConditions = (input.noTradeConditions ?? []).map((condition) => condition.trim()).filter(Boolean);
    g.add("play_no_trade_condition", noTradeConditions.length > 0, noTradeConditions.length ? "no-trade condition is stated" : "intraday play requires at least one no-trade condition");
  }

  // ── Notional ────────────────────────────────────────────────────────────────
  const notional = input.gatedNotionalCents;
  const notionalKnown = notional != null && notional > 0 && input.notionalBasis !== "unknown";
  g.add(
    "notional_resolvable",
    notionalKnown,
    notionalKnown
      ? `order notional $${dollars(notional!)} (${input.notionalBasis})`
      : "order notional could not be established — no notionalCents given and no priced fact to derive it from",
    notional,
  );
  if (input.notionalBasis === "derived_from_last_price") {
    g.note("order notional derived from the last priced fact, not stated by the operator — the ceiling was checked against a modeled figure");
  }

  const equity = account.equityCents;
  const equityKnown = equity != null && equity > 0;
  g.add(
    "equity_known",
    equityKnown,
    equityKnown ? `account equity $${dollars(equity!)}` : "account equity is unknown — sync the account before sizing against it",
    equity,
  );

  if (notionalKnown && equityKnown) {
    const n = notional!;
    const e = equity!;

    const pctCeiling = (mandate.maxOrderNotionalPctOfEquity / 100) * e;
    const ceiling = Math.min(pctCeiling, mandate.maxOrderNotionalCents);
    const ok = n <= ceiling;
    g.add(
      "order_notional_ceiling",
      ok,
      ok
        ? `order $${dollars(n)} is within the $${dollars(ceiling)} single-order ceiling`
        : `order $${dollars(n)} exceeds the single-order ceiling of $${dollars(ceiling)} (${mandate.maxOrderNotionalPctOfEquity}% of equity, capped at $${dollars(mandate.maxOrderNotionalCents)})`,
      n,
      ceiling,
    );

    if (isBuy) {
      const postPosition = account.positionValueCents + n;
      const posPct = pctOf(postPosition, e);
      const posOk = posPct <= mandate.maxPositionPctOfEquity;
      g.add(
        "position_concentration",
        posOk,
        posOk
          ? `${input.symbol} would be ${round2(posPct)}% of equity, within ${mandate.maxPositionPctOfEquity}%`
          : `${input.symbol} would be ${round2(posPct)}% of equity, over the ${mandate.maxPositionPctOfEquity}% single-name cap`,
        round2(posPct),
        mandate.maxPositionPctOfEquity,
      );

      const postCluster = account.clusterValueCents + n;
      const cluPct = pctOf(postCluster, e);
      const cluOk = cluPct <= mandate.maxClusterPctOfEquity;
      g.add(
        "cluster_concentration",
        cluOk,
        cluOk
          ? `cluster "${account.clusterLabel}" would be ${round2(cluPct)}% of equity, within ${mandate.maxClusterPctOfEquity}%`
          : `cluster "${account.clusterLabel}" would be ${round2(cluPct)}% of equity, over the ${mandate.maxClusterPctOfEquity}% cap`,
        round2(cluPct),
        mandate.maxClusterPctOfEquity,
      );
      if (!account.sectorKnown) {
        // Not a failure: no sector fact exists, so the name is its own cluster.
        // Blocking here would stop every trade in an unclassified name; pretending
        // the cluster is empty would be worse. The treatment is recorded instead.
        g.note(`no sector fact for ${input.symbol} — treated as a single-name cluster, so the cluster gate equals the position gate`);
      }

      const postRun = account.runGrossDeployedCents + n;
      const runPct = pctOf(postRun, e);
      const runOk = runPct <= mandate.maxRunGrossDeployedPctOfEquity;
      g.add(
        "run_gross_deployed",
        runOk,
        runOk
          ? `run would have deployed ${round2(runPct)}% of equity, within ${mandate.maxRunGrossDeployedPctOfEquity}%`
          : `run would have deployed ${round2(runPct)}% of equity, over the ${mandate.maxRunGrossDeployedPctOfEquity}% per-run ceiling`,
        round2(runPct),
        mandate.maxRunGrossDeployedPctOfEquity,
      );

      const postDay = account.newNotionalTodayCents + n;
      const dayPct = pctOf(postDay, e);
      const dayOk = dayPct <= mandate.maxDailyNewNotionalPctOfEquity;
      g.add(
        "daily_new_notional",
        dayOk,
        dayOk
          ? `new notional today would be ${round2(dayPct)}% of equity, within ${mandate.maxDailyNewNotionalPctOfEquity}%`
          : `new notional today would be ${round2(dayPct)}% of equity, over the ${mandate.maxDailyNewNotionalPctOfEquity}% daily ceiling`,
        round2(dayPct),
        mandate.maxDailyNewNotionalPctOfEquity,
      );
    } else {
      g.note("sell order — concentration, per-run and daily-new ceilings do not apply to exposure reduction");
    }
  }

  // ── Liquidity ───────────────────────────────────────────────────────────────
  if (account.advUsd == null) {
    g.add(
      "liquidity_adv_floor",
      false,
      `no 30-day ADV fact for ${input.symbol} — an unknown liquidity is not a passing liquidity`,
      null,
      mandate.minAdvUsd30d,
    );
  } else {
    const ok = account.advUsd >= mandate.minAdvUsd30d;
    g.add(
      "liquidity_adv_floor",
      ok,
      ok
        ? `ADV $${Math.round(account.advUsd).toLocaleString("en-US")} clears the $${mandate.minAdvUsd30d.toLocaleString("en-US")} floor`
        : `ADV $${Math.round(account.advUsd).toLocaleString("en-US")} is below the $${mandate.minAdvUsd30d.toLocaleString("en-US")} floor`,
      account.advUsd,
      mandate.minAdvUsd30d,
    );

    if (notionalKnown) {
      const participation = (notional! / 100 / account.advUsd) * 100;
      const pOk = participation <= mandate.maxOrderPctOfAdv;
      g.add(
        "liquidity_participation",
        pOk,
        pOk
          ? `order is ${round2(participation)}% of ADV, within ${mandate.maxOrderPctOfAdv}%`
          : `order is ${round2(participation)}% of ADV, over the ${mandate.maxOrderPctOfAdv}% participation cap`,
        round2(participation),
        mandate.maxOrderPctOfAdv,
      );
    }
  }

  return g.finish(mandate.version, now);
}

// ── Run preset gates ──────────────────────────────────────────────────────────

export interface RunPresetInput {
  holdingPeriod: HoldingPeriod | string;
  /** The run's own ADV floor in USD. May tighten the mandate, never loosen it. */
  liquidityFloorAdvUsd: number;
  catalystDeadlineAt: number;
  /** The run's single-name cap, 0..100. May tighten the mandate, never loosen it. */
  maxSingleNamePct: number;
  invalidationRule: string;
  deployableCapitalCents: number;
}

export interface RunPresetContext {
  /** False for an analysis-only run with no linked account. */
  accountLinked: boolean;
  equityCents: number | null;
}

export function evaluateRunPreset(
  input: RunPresetInput,
  ctx: RunPresetContext,
  mandate: Mandate = CURRENT_MANDATE,
  now: number = 0,
): GateEvaluation {
  const g = new GateCollector();

  const hpValid = isHoldingPeriod(input.holdingPeriod);
  g.add(
    "holding_period",
    hpValid,
    hpValid
      ? `holding period: ${HOLDING_PERIODS[input.holdingPeriod as HoldingPeriod].label}`
      : `holdingPeriod must be one of ${Object.keys(HOLDING_PERIODS).join(", ")} (got "${input.holdingPeriod}")`,
  );
  const rule = hpValid ? HOLDING_PERIODS[input.holdingPeriod as HoldingPeriod] : null;

  if (!(input.catalystDeadlineAt > now)) {
    g.add("catalyst_deadline", false, "catalystDeadlineAt must be in the future", input.catalystDeadlineAt, now);
  } else if (rule) {
    const days = (input.catalystDeadlineAt - now) / 86_400_000;
    const ok = days <= rule.maxHorizonDays;
    g.add(
      "catalyst_deadline",
      ok,
      ok
        ? `catalyst deadline is ${round2(days)}d out, inside the ${rule.maxHorizonDays}d horizon`
        : `catalyst deadline is ${round2(days)}d out — beyond the ${rule.maxHorizonDays}d horizon for ${rule.label.toLowerCase()}`,
      round2(days),
      rule.maxHorizonDays,
    );
  } else {
    g.add("catalyst_deadline", false, "catalyst horizon cannot be checked without a valid holding period");
  }

  const advOk = input.liquidityFloorAdvUsd >= mandate.minAdvUsd30d;
  g.add(
    "liquidity_floor",
    advOk,
    advOk
      ? `run ADV floor $${input.liquidityFloorAdvUsd.toLocaleString("en-US")} is at or above the mandate floor`
      : `run ADV floor $${input.liquidityFloorAdvUsd.toLocaleString("en-US")} is below the mandate floor of $${mandate.minAdvUsd30d.toLocaleString("en-US")} — a run may tighten a ceiling, never loosen it`,
    input.liquidityFloorAdvUsd,
    mandate.minAdvUsd30d,
  );

  const concOk = input.maxSingleNamePct > 0 && input.maxSingleNamePct <= mandate.maxPositionPctOfEquity;
  g.add(
    "concentration_cap",
    concOk,
    concOk
      ? `run single-name cap ${input.maxSingleNamePct}% is within the mandate's ${mandate.maxPositionPctOfEquity}%`
      : `run single-name cap must be >0 and ≤ the mandate's ${mandate.maxPositionPctOfEquity}% (got ${input.maxSingleNamePct}%)`,
    input.maxSingleNamePct,
    mandate.maxPositionPctOfEquity,
  );

  const inv = checkNarrative(input.invalidationRule, "invalidationRule");
  g.add("invalidation_rule", inv.ok, inv.ok ? "invalidation rule stated" : inv.reason!);

  if (!ctx.accountLinked) {
    g.note("no account linked — this run is analysis-only; the gross-deployed ceiling is checked again per order");
  } else if (ctx.equityCents == null || ctx.equityCents <= 0) {
    g.add("deployable_capital", false, "account equity is unknown — sync the account before starting a run against it", ctx.equityCents);
  } else {
    const pct = pctOf(input.deployableCapitalCents, ctx.equityCents);
    const ok = pct <= mandate.maxRunGrossDeployedPctOfEquity;
    g.add(
      "deployable_capital",
      ok,
      ok
        ? `deployable capital is ${round2(pct)}% of equity, within ${mandate.maxRunGrossDeployedPctOfEquity}%`
        : `deployable capital is ${round2(pct)}% of equity, over the ${mandate.maxRunGrossDeployedPctOfEquity}% per-run ceiling`,
      round2(pct),
      mandate.maxRunGrossDeployedPctOfEquity,
    );
  }

  return g.finish(mandate.version, now);
}

// ── Formatting ────────────────────────────────────────────────────────────────

function dollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtEt(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Convenience for callers that only need the headline. */
export function gateFailureMessage(evaluation: GateEvaluation): string {
  return evaluation.failures.join("; ");
}

export type { MarketSession };
