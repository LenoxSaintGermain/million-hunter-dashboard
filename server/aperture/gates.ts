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
import {
  isOptionInstrument,
  optionPremiumAtRiskCents,
  validatePaperInstrument,
  type PaperInstrumentType,
} from "../../shared/paperInstrument";

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

// ── Shared ceiling arithmetic ─────────────────────────────────────────────────
//
// Every percent-of-equity ceiling in the mandate is measured the same way, and
// it is measured here ONCE. The order gates below call this, and so does the
// cockpit's headroom rail (server/aperture/cockpit.ts). That is deliberate: a
// top rail that says "$4,200 of room left" and a gate that then blocks the order
// would be worse than showing nothing, and the only way to guarantee they agree
// is for both to be the same function — not two readings of the same policy.

export interface PctCeilingMeasure {
  /** Cents already counted against the ceiling. */
  usedCents: number;
  /** Cents this order would add. Zero when asking "how much room is left". */
  addedCents: number;
  equityCents: number;
  ceilingPct: number;
  /** The ceiling expressed in cents at the given equity. */
  ceilingCents: number;
  /**
   * (used + added) as a percentage of equity — the figure the gate SHOWS.
   * Normally 2dp; when the exact value breaches a ceiling that 2dp would round
   * back inside, it carries more precision so the operator can see what bound.
   */
  pct: number;
  /** The unrounded percentage — the figure the gate DECIDES on. */
  exactPct: number;
  /** Cents that may still be added before the ceiling binds. Never negative. */
  remainingCents: number;
  ok: boolean;
}

export function measurePctCeiling(
  usedCents: number,
  addedCents: number,
  equityCents: number,
  ceilingPct: number,
): PctCeilingMeasure {
  const ceilingCents = (ceilingPct / 100) * equityCents;
  const exactPct = pctOf(usedCents + addedCents, equityCents);
  // Decide on the exact value. A ceiling that yields at the fourth decimal is a
  // ceiling that can be walked past 10 basis points at a time, and this is a
  // risk gate — it does not round in the operator's favour.
  const ok = exactPct <= ceilingPct;
  // Show 2dp normally. If the exact value breaches a ceiling that 2dp would
  // round back inside, show more precision instead: a gate that blocks on a
  // figure it does not display is a gate the operator cannot argue with.
  const rounded = round2(exactPct);
  const pct = !ok && rounded <= ceilingPct ? Math.round(exactPct * 10_000) / 10_000 : rounded;
  return {
    usedCents,
    addedCents,
    equityCents,
    ceilingPct,
    ceilingCents,
    pct,
    exactPct,
    remainingCents: Math.max(0, ceilingCents - usedCents),
    ok,
  };
}

/**
 * Planned loss for a play: what the stop actually puts at risk, not what the
 * order commits. The slippage allowance is included because a stop is a request,
 * not a guarantee — and on paper fills, which execute at the quote, the
 * allowance is the ONLY place execution cost is represented at all.
 *
 * Returns null when any input is missing. A planned loss that cannot be computed
 * is not zero risk.
 */
export function plannedRiskCentsFor(input: {
  instrumentType?: PaperInstrumentType | null;
  qty?: number | null;
  entryPriceCents?: number | null;
  stopPriceCents?: number | null;
  slippageCents?: number | null;
  contractMultiplier?: number | null;
}): number | null {
  if (isOptionInstrument(input.instrumentType)) return optionPremiumAtRiskCents(input);
  const { qty, entryPriceCents: entry, stopPriceCents: stop, slippageCents: slip } = input;
  if (qty == null || qty <= 0) return null;
  if (entry == null || entry <= 0) return null;
  if (stop == null || stop <= 0 || stop === entry) return null;
  if (slip == null || slip < 0) return null;
  return Math.round(qty * (Math.abs(entry - stop) + slip));
}

/** Holding periods where a stated planned loss is mandatory, not optional. */
const PLANNED_RISK_REQUIRED: ReadonlySet<string> = new Set(["intraday", "overnight"]);

// ── Order intent ──────────────────────────────────────────────────────────────
//
// `side` alone cannot say whether an order adds risk or removes it. A sell is a
// closing trade when it exits a long, and an OPENING trade when it establishes a
// short — and the two are opposites for every concentration ceiling in the
// mandate. Before this existed, every sell skipped the position, cluster,
// per-run and daily-new gates, which was correct for an exit and would have let
// a short entry past three ceilings unchecked.

export type OrderIntent = "open" | "close";

export interface ResolvedIntent {
  intent: OrderIntent;
  /** True when nothing stated it and the position was used to work it out. */
  inferred: boolean;
  /** What the resolution was based on — recorded on the gate. */
  basis: string;
  /** Set when a stated intent contradicts the account. */
  conflict: string | null;
}

/**
 * Resolve what an order actually does to exposure.
 *
 * The rule is fail-closed: anything that cannot be PROVEN to close an existing
 * position is treated as opening, so the exposure ceilings apply. An unproven
 * close is not a safe default — it is the one that skips three gates.
 *
 * `positionQty` is signed the way a broker reports it: positive long, negative
 * short, zero flat.
 */
export function resolveOrderIntent(args: {
  side: "buy" | "sell";
  statedIntent?: OrderIntent | null;
  positionQty: number;
  qty?: number | null;
}): ResolvedIntent {
  const { side, statedIntent, positionQty } = args;
  const flat = positionQty === 0;
  const long = positionQty > 0;
  const short = positionQty < 0;

  // What the position permits, regardless of what was stated.
  const couldClose = (side === "sell" && long) || (side === "buy" && short);
  const heldDescription = flat
    ? "no position is held"
    : `${Math.abs(positionQty)} ${long ? "long" : "short"} held`;

  if (statedIntent === "close") {
    if (!couldClose) {
      return {
        intent: "open",
        inferred: false,
        basis: `stated intent "close" but ${heldDescription} — treated as opening so the exposure ceilings apply`,
        conflict: `this order was marked closing, but there is no ${side === "sell" ? "long" : "short"} position for it to close`,
      };
    }
    // A sell larger than the long it closes flips into a short. The excess is
    // new exposure, so the whole order is gated as opening.
    if (args.qty != null && args.qty > Math.abs(positionQty)) {
      return {
        intent: "open",
        inferred: false,
        basis: `stated intent "close" but ${args.qty} exceeds the ${Math.abs(positionQty)} held — the excess opens new exposure, so the order is gated as opening`,
        conflict: null,
      };
    }
    return { intent: "close", inferred: false, basis: `closing against ${heldDescription}`, conflict: null };
  }

  if (statedIntent === "open") {
    return { intent: "open", inferred: false, basis: `stated intent "open" (${heldDescription})`, conflict: null };
  }

  // Nothing stated. Infer, and only ever infer "close" when it is provable.
  if (couldClose && (args.qty == null || args.qty <= Math.abs(positionQty))) {
    return {
      intent: "close",
      inferred: true,
      basis: `no intent stated; ${heldDescription}, so this ${side} reduces exposure`,
      conflict: null,
    };
  }
  return {
    intent: "open",
    inferred: true,
    basis: flat && side === "sell"
      ? "no intent stated and no long position is held — a sell with nothing to close opens a short, so the exposure ceilings apply"
      : `no intent stated; ${heldDescription}, so this ${side} adds exposure`,
    conflict: null,
  };
}

/**
 * The single-order ceiling: a percentage of equity and an absolute cap,
 * whichever binds first.
 */
export function singleOrderCeilingCents(equityCents: number, mandate: Mandate = CURRENT_MANDATE): number {
  return Math.min((mandate.maxOrderNotionalPctOfEquity / 100) * equityCents, mandate.maxOrderNotionalCents);
}

// ── Order gates ───────────────────────────────────────────────────────────────

export type NotionalBasis = "stated" | "derived_from_last_price" | "unknown";

export interface OrderGateInput {
  symbol: string;
  instrumentType?: PaperInstrumentType | null;
  underlyingSymbol?: string | null;
  optionExpirationDate?: string | null;
  optionStrikePriceCents?: number | null;
  contractMultiplier?: number | null;
  side: "buy" | "sell";
  /**
   * Whether this order opens exposure or closes it. When absent it is inferred
   * from the held position, and an unprovable close is treated as an open.
   */
  intent?: OrderIntent | null;
  orderType: "market" | "limit";
  timeInForce: "day" | "gtc";
  holdingPeriod: HoldingPeriod | string;
  reason?: string | null;
  invalidationCondition?: string | null;
  /** When the thesis for this trade expires. Required on every holding period. */
  catalystDeadlineAt?: number | null;
  /** Needed to turn the entry/stop distance into a planned loss. */
  qty?: number | null;
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
  /**
   * Signed quantity held in the order's symbol — positive long, negative short,
   * zero flat. This is what decides whether a sell closes or opens.
   */
  positionQty: number;
  /**
   * Market value already held in the order's symbol. May be negative for a
   * short; concentration is measured on the absolute exposure.
   */
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
  /** Planned loss already committed by live orders created this ET day. */
  plannedRiskTodayCents: number;
  /** Planned loss already committed by live orders in this symbol's cluster. */
  clusterPlannedRiskCents: number;
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
  const instrument = validatePaperInstrument({
    instrumentType: input.instrumentType,
    symbol: input.symbol,
    underlyingSymbol: input.underlyingSymbol,
    optionExpirationDate: input.optionExpirationDate,
    optionStrikePriceCents: input.optionStrikePriceCents,
    contractMultiplier: input.contractMultiplier,
    qty: input.qty,
    entryPriceCents: input.entryPriceCents,
    slippageCents: input.slippageCents,
  }, now);
  const isOption = isOptionInstrument(instrument.instrumentType);

  // What this order does to exposure — not what side it is. See resolveOrderIntent.
  const resolved = resolveOrderIntent({
    side: input.side,
    statedIntent: input.intent,
    positionQty: account.positionQty,
    qty: input.qty,
  });
  const isOpening = resolved.intent === "open";
  g.add(
    "order_intent",
    resolved.conflict == null,
    resolved.conflict ?? `${resolved.intent === "open" ? "opens" : "closes"} exposure — ${resolved.basis}`,
  );
  if (resolved.inferred) {
    g.note(`order intent was not stated and was inferred as "${resolved.intent}": ${resolved.basis}`);
  }

  // ── Structural ──────────────────────────────────────────────────────────────
  g.add(
    "paper_account",
    account.isPaper === true,
    account.isPaper ? "account is a paper account" : "account is not flagged paper — there is no live-execution path",
  );

  g.add(
    "instrument_identity",
    instrument.failures.length === 0,
    instrument.failures.length === 0
      ? isOption
        ? `${instrument.optionTerms!.underlyingSymbol} ${instrument.optionTerms!.expirationDate} $${(instrument.optionTerms!.strikePriceCents / 100).toFixed(2)} ${instrument.instrumentType === "long_call" ? "call" : "put"}; exact contract ${instrument.optionTerms!.contractSymbol}`
        : `${input.symbol} shares`
      : instrument.failures.join(" "),
  );
  if (isOption) {
    g.add("long_option_buy_only", input.side === "buy", input.side === "buy" ? "bounded long option opens with buy to open" : "Only buy-to-open long calls and long puts are supported; sell-to-open is blocked.");
    g.add("option_limit_day_only", input.orderType === "limit" && input.timeInForce === "day", input.orderType === "limit" && input.timeInForce === "day" ? "option order is limit + day" : "Long-option paper orders must use a limit price and day time-in-force.");
  }

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
  if (isOption && instrument.optionTerms) {
    const optionExpiryAt = Date.parse(`${instrument.optionTerms.expirationDate}T20:00:00Z`);
    const notZeroDte = optionExpiryAt - now > 24 * 60 * 60 * 1_000;
    g.add(
      "option_expiration_window",
      notZeroDte && deadline != null && optionExpiryAt >= deadline,
      !notZeroDte
        ? "Opening same-day or next-day expiration options is outside this bounded paper flow"
        : deadline == null || optionExpiryAt < deadline
          ? "Option expiration must be on or after the declared thesis review deadline"
          : `option expiration ${instrument.optionTerms.expirationDate} remains after the declared review deadline`,
    );
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
    if (!isOption) g.add("play_stop", validStop, validStop ? "play stop is stated" : "intraday share play requires a stop different from entry");
    g.add("play_slippage", validSlippage, validSlippage ? "slippage allowance is stated" : "intraday play requires a slippage allowance");
    const timeStop = input.timeStopAt ?? null;
    const deadlineForStop = input.catalystDeadlineAt ?? null;
    const validTimeStop = timeStop != null && timeStop > now && (deadlineForStop == null || timeStop <= deadlineForStop);
    g.add("play_time_stop", validTimeStop, validTimeStop ? "human close-review time is inside the catalyst window" : "intraday play requires a future time stop inside the catalyst window");
    const noTradeConditions = (input.noTradeConditions ?? []).map((condition) => condition.trim()).filter(Boolean);
    g.add("play_no_trade_condition", noTradeConditions.length > 0, noTradeConditions.length ? "no-trade condition is stated" : "intraday play requires at least one no-trade condition");
  }

  // Equity is the denominator for both sizing axes below.
  const equity = account.equityCents;
  const equityKnown = equity != null && equity > 0;

  // ── Planned loss ───────────────────────────────────────────────────────────
  // The second sizing axis. Notional caps what an order commits; this caps what
  // the stop puts at risk. Both must pass.
  const plannedRisk = plannedRiskCentsFor(input);
  const riskRequired = isOption || PLANNED_RISK_REQUIRED.has(String(input.holdingPeriod));

  if (plannedRisk == null) {
    if (riskRequired) {
      g.add(
        "planned_risk_stated",
        false,
        isOption
          ? "a long-option play must state whole contracts, limit premium and slippage so maximum premium loss can be measured"
          : `a ${String(input.holdingPeriod)} play must state qty, entry, stop and slippage so its planned loss can be measured — an unmeasurable loss is not a small one`,
      );
    } else {
      // Not a failure: a longer-horizon position may legitimately be held
      // without a hard stop. Recorded so nobody later reads the silence as zero.
      g.note(
        `planned loss is not measurable for this order (needs qty, entry, stop and slippage) — the notional ceilings are the only sizing constraint applied`,
      );
    }
  } else {
    g.add(
      "planned_risk_stated",
      true,
      isOption
        ? `maximum premium loss $${dollars(plannedRisk)} = contracts x 100 x (limit premium + slippage)`
        : `planned loss $${dollars(plannedRisk)} = qty x (|entry - stop| + slippage)`,
      plannedRisk,
    );

    if (equityKnown) {
      const e = equity!;

      const perPlay = measurePctCeiling(0, plannedRisk, e, mandate.maxPlannedRiskPctPerPlay);
      g.add(
        "planned_risk_per_play",
        perPlay.ok,
        perPlay.ok
          ? `planned loss is ${perPlay.pct}% of equity, within the ${mandate.maxPlannedRiskPctPerPlay}% per-play ceiling`
          : `planned loss is ${perPlay.pct}% of equity, over the ${mandate.maxPlannedRiskPctPerPlay}% per-play ceiling — widen the stop and the size must come down`,
        perPlay.pct,
        mandate.maxPlannedRiskPctPerPlay,
      );

      const daily = measurePctCeiling(account.plannedRiskTodayCents, plannedRisk, e, mandate.maxDailyPlannedRiskPct);
      g.add(
        "daily_planned_risk",
        daily.ok,
        daily.ok
          ? `planned loss across today's plays would be ${daily.pct}% of equity, within ${mandate.maxDailyPlannedRiskPct}%`
          : `planned loss across today's plays would be ${daily.pct}% of equity, over the ${mandate.maxDailyPlannedRiskPct}% daily ceiling`,
        daily.pct,
        mandate.maxDailyPlannedRiskPct,
      );

      // Several plays on one theme are one bet. This is the ceiling that stops
      // a housing ETF and a homebuilder from being counted as diversification.
      const correlated = measurePctCeiling(
        account.clusterPlannedRiskCents, plannedRisk, e, mandate.maxCorrelatedPlannedRiskPct,
      );
      g.add(
        "correlated_planned_risk",
        correlated.ok,
        correlated.ok
          ? `planned loss across "${account.clusterLabel}" would be ${correlated.pct}% of equity, within ${mandate.maxCorrelatedPlannedRiskPct}%`
          : `planned loss across "${account.clusterLabel}" would be ${correlated.pct}% of equity, over the ${mandate.maxCorrelatedPlannedRiskPct}% correlated ceiling — these plays are one bet, not two`,
        correlated.pct,
        mandate.maxCorrelatedPlannedRiskPct,
      );
      if (!account.sectorKnown) {
        g.note(`no sector fact for ${input.symbol} — the correlated planned-loss ceiling covers this name alone, so a genuine theme overlap would not be caught`);
      }
    }
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

  g.add(
    "equity_known",
    equityKnown,
    equityKnown ? `account equity $${dollars(equity!)}` : "account equity is unknown — sync the account before sizing against it",
    equity,
  );

  if (notionalKnown && equityKnown) {
    const n = notional!;
    const e = equity!;

    const ceiling = singleOrderCeilingCents(e, mandate);
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

    if (isOpening) {
      // Absolute exposure. A short's market value is negative at the broker, and
      // netting it against the order would make a growing short position read as
      // shrinking concentration — the opposite of the truth.
      const heldAbs = Math.abs(account.positionValueCents);
      const clusterAbs = Math.abs(account.clusterValueCents);

      const pos = measurePctCeiling(heldAbs, n, e, mandate.maxPositionPctOfEquity);
      g.add(
        "position_concentration",
        pos.ok,
        pos.ok
          ? `${input.symbol} would be ${pos.pct}% of equity, within ${mandate.maxPositionPctOfEquity}%`
          : `${input.symbol} would be ${pos.pct}% of equity, over the ${mandate.maxPositionPctOfEquity}% single-name cap`,
        pos.pct,
        mandate.maxPositionPctOfEquity,
      );

      const clu = measurePctCeiling(clusterAbs, n, e, mandate.maxClusterPctOfEquity);
      g.add(
        "cluster_concentration",
        clu.ok,
        clu.ok
          ? `cluster "${account.clusterLabel}" would be ${clu.pct}% of equity, within ${mandate.maxClusterPctOfEquity}%`
          : `cluster "${account.clusterLabel}" would be ${clu.pct}% of equity, over the ${mandate.maxClusterPctOfEquity}% cap`,
        clu.pct,
        mandate.maxClusterPctOfEquity,
      );
      if (!account.sectorKnown) {
        // Not a failure: no sector fact exists, so the name is its own cluster.
        // Blocking here would stop every trade in an unclassified name; pretending
        // the cluster is empty would be worse. The treatment is recorded instead.
        g.note(`no sector fact for ${input.symbol} — treated as a single-name cluster, so the cluster gate equals the position gate`);
      }

      const run = measurePctCeiling(account.runGrossDeployedCents, n, e, mandate.maxRunGrossDeployedPctOfEquity);
      g.add(
        "run_gross_deployed",
        run.ok,
        run.ok
          ? `run would have deployed ${run.pct}% of equity, within ${mandate.maxRunGrossDeployedPctOfEquity}%`
          : `run would have deployed ${run.pct}% of equity, over the ${mandate.maxRunGrossDeployedPctOfEquity}% per-run ceiling`,
        run.pct,
        mandate.maxRunGrossDeployedPctOfEquity,
      );

      const day = measurePctCeiling(account.newNotionalTodayCents, n, e, mandate.maxDailyNewNotionalPctOfEquity);
      g.add(
        "daily_new_notional",
        day.ok,
        day.ok
          ? `new notional today would be ${day.pct}% of equity, within ${mandate.maxDailyNewNotionalPctOfEquity}%`
          : `new notional today would be ${day.pct}% of equity, over the ${mandate.maxDailyNewNotionalPctOfEquity}% daily ceiling`,
        day.pct,
        mandate.maxDailyNewNotionalPctOfEquity,
      );
    } else {
      g.note(`closing order — concentration, per-run and daily-new ceilings do not apply to exposure reduction (${resolved.basis})`);
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
    const m = measurePctCeiling(input.deployableCapitalCents, 0, ctx.equityCents, mandate.maxRunGrossDeployedPctOfEquity);
    g.add(
      "deployable_capital",
      m.ok,
      m.ok
        ? `deployable capital is ${m.pct}% of equity, within ${mandate.maxRunGrossDeployedPctOfEquity}%`
        : `deployable capital is ${m.pct}% of equity, over the ${mandate.maxRunGrossDeployedPctOfEquity}% per-run ceiling`,
      m.pct,
      mandate.maxRunGrossDeployedPctOfEquity,
    );
  }

  return g.finish(mandate.version, now);
}

// ── Mandate headroom ──────────────────────────────────────────────────────────
//
// The same ceilings the order gates enforce, read as "how much room is left"
// instead of "does this order fit". It lives in this file, not in cockpit.ts,
// because it MUST use `measurePctCeiling` and `singleOrderCeilingCents` — the
// literal functions the gates call. Re-deriving 10%-of-equity in a display layer
// is how a rail ends up promising room that an order then cannot use.
//
// Unknown equity produces null figures and a reason, never a zero. A zero here
// would read as "no room left", which is a different and much more alarming
// statement than "we do not know your equity".

export type HeadroomKey =
  | "position"
  | "cluster"
  | "run_gross_deployed"
  | "daily_new_notional"
  | "single_order"
  | "daily_planned_risk"
  | "correlated_planned_risk"
  | "planned_risk_per_play";

export interface HeadroomLine {
  key: HeadroomKey;
  label: string;
  /** The name/cluster the figure is about, when the ceiling is per-subject. */
  subject: string | null;
  /** Cents already counted against this ceiling. Null when not measurable. */
  usedCents: number | null;
  ceilingCents: number | null;
  /** ceilingCents − usedCents, floored at zero. Null when not measurable. */
  remainingCents: number | null;
  usedPct: number | null;
  ceilingPct: number;
  /** Where `usedCents` came from — stated the same way a fact states its basis. */
  basis: string;
  /** Why the figures are null. Null when they are populated. */
  reason: string | null;
}

export interface HeadroomInput {
  /** Account equity in cents. Null when the account has never synced. */
  equityCents: number | null;
  /** The largest single holding — the position ceiling's binding constraint. */
  largestPositionSymbol: string | null;
  largestPositionValueCents: number | null;
  /** The largest sector cluster. Unclassified names are their own cluster. */
  largestClusterLabel: string | null;
  largestClusterValueCents: number | null;
  /** Buy notional already committed by the run in scope. Null when no run given. */
  runGrossDeployedCents: number | null;
  /** Buy notional already created in this ET day, across all runs. */
  newNotionalTodayCents: number | null;
  /** Planned loss committed by live orders created this ET day. */
  plannedRiskTodayCents: number | null;
  /** The largest planned-loss concentration in one correlated cluster. */
  largestClusterPlannedRiskLabel: string | null;
  largestClusterPlannedRiskCents: number | null;
}

export interface HeadroomRail {
  mandateVersion: string;
  equityCents: number | null;
  /** How equity was established, or why it is null. */
  equityBasis: string;
  lines: HeadroomLine[];
}

const EQUITY_UNKNOWN = "account equity is unknown — sync the account before any ceiling can be measured against it";

export function computeHeadroom(input: HeadroomInput, mandate: Mandate = CURRENT_MANDATE): HeadroomRail {
  const e = input.equityCents;
  const equityKnown = e != null && e > 0;

  const line = (
    key: HeadroomKey,
    label: string,
    subject: string | null,
    used: number | null,
    ceilingPct: number,
    basis: string,
    missingReason: string | null,
  ): HeadroomLine => {
    if (!equityKnown) {
      return {
        key, label, subject,
        usedCents: null, ceilingCents: null, remainingCents: null, usedPct: null,
        ceilingPct, basis, reason: EQUITY_UNKNOWN,
      };
    }
    if (used == null) {
      return {
        key, label, subject,
        usedCents: null,
        ceilingCents: (ceilingPct / 100) * e!,
        remainingCents: null,
        usedPct: null,
        ceilingPct,
        basis,
        reason: missingReason,
      };
    }
    const m = measurePctCeiling(used, 0, e!, ceilingPct);
    return {
      key, label, subject,
      usedCents: m.usedCents,
      ceilingCents: m.ceilingCents,
      remainingCents: m.remainingCents,
      usedPct: m.pct,
      ceilingPct,
      basis,
      reason: null,
    };
  };

  const lines: HeadroomLine[] = [
    line(
      "position",
      "Largest single name",
      input.largestPositionSymbol,
      input.largestPositionValueCents,
      mandate.maxPositionPctOfEquity,
      "market value of the largest held position",
      "no positions are held, so no single name is measured yet",
    ),
    line(
      "cluster",
      "Largest correlated cluster",
      input.largestClusterLabel,
      input.largestClusterValueCents,
      mandate.maxClusterPctOfEquity,
      "summed market value of held names sharing a sector fact; a name with no sector fact is its own cluster",
      "no positions are held, so no cluster is measured yet",
    ),
    line(
      "run_gross_deployed",
      "This run, gross deployed",
      null,
      input.runGrossDeployedCents,
      mandate.maxRunGrossDeployedPctOfEquity,
      "buy notional on this run's orders that are pending approval, approved, submitted or filled",
      "no run in scope — pass a runId to measure the per-run ceiling",
    ),
    line(
      "daily_new_notional",
      "New notional today (ET)",
      null,
      input.newNotionalTodayCents,
      mandate.maxDailyNewNotionalPctOfEquity,
      "buy notional created since ET midnight, across all runs",
      "today's order history could not be read",
    ),
    // ── The planned-loss axis ────────────────────────────────────────────────
    // Separate from everything above: notional is what the orders commit, this
    // is what their stops put at risk. An order inside every notional ceiling
    // can still breach these.
    line(
      "daily_planned_risk",
      "Planned loss today (ET)",
      null,
      input.plannedRiskTodayCents,
      mandate.maxDailyPlannedRiskPct,
      "qty x (|entry - stop| + slippage), summed over live orders created since ET midnight; orders with no stated stop contribute nothing",
      "today's order history could not be read",
    ),
    line(
      "correlated_planned_risk",
      "Planned loss, largest theme",
      input.largestClusterPlannedRiskLabel,
      input.largestClusterPlannedRiskCents,
      mandate.maxCorrelatedPlannedRiskPct,
      "planned loss summed over today's live orders sharing a sector fact — several plays on one theme are one bet",
      "no planned loss is committed in any cluster today",
    ),
  ];

  // Neither of the two ceilings below is a running total: nothing accumulates
  // against them. `usedCents` stays null rather than 0 so the client does not
  // render a consumption bar for a ceiling that is never consumed.
  lines.push({
    key: "planned_risk_per_play",
    label: "Planned loss, one play",
    subject: null,
    usedCents: null,
    ceilingCents: equityKnown ? (mandate.maxPlannedRiskPctPerPlay / 100) * e! : null,
    remainingCents: null,
    usedPct: null,
    ceilingPct: mandate.maxPlannedRiskPctPerPlay,
    basis: "per-play ceiling on qty x (|entry - stop| + slippage)",
    reason: equityKnown ? null : EQUITY_UNKNOWN,
  });


  lines.push({
    key: "single_order",
    label: "Single order",
    subject: null,
    usedCents: null,
    ceilingCents: equityKnown ? singleOrderCeilingCents(e!, mandate) : null,
    remainingCents: equityKnown ? singleOrderCeilingCents(e!, mandate) : null,
    usedPct: null,
    ceilingPct: mandate.maxOrderNotionalPctOfEquity,
    basis: `per-order ceiling — ${mandate.maxOrderNotionalPctOfEquity}% of equity or $${dollars(mandate.maxOrderNotionalCents)}, whichever binds first. Not a running total.`,
    reason: equityKnown ? null : EQUITY_UNKNOWN,
  });

  return {
    mandateVersion: mandate.version,
    equityCents: equityKnown ? e! : null,
    equityBasis: equityKnown
      ? "last synced account equity"
      : EQUITY_UNKNOWN,
    lines,
  };
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
