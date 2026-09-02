/**
 * The play constructor — turns a researched candidate into a complete recipe.
 *
 * WHY THIS EXISTS
 *
 * Until now the system produced a research lead and asked the operator to build
 * the play: the card said "Paper amount: not set" and "step 2: state entry,
 * stop, slippage, time window and no-trade conditions." That is a homework
 * assignment wearing a play's clothes. The reference output this product is
 * measured against fills every one of those fields itself, in about two hundred
 * words, and that completeness is what makes it usable by someone who is not the
 * person who wrote the thesis.
 *
 * Every number below is derivable from data already in hand: observed minute
 * bars (session VWAP, opening range), the mandate's planned-loss budget, and the
 * operator's own sizing formula — qty = budget / (stop distance + slippage).
 *
 * WHAT KEEPS IT HONEST
 *
 * 1. Every level carries a `basis` naming the observation it came from, and a
 *    `modeled: true` flag. These are LEVELS DERIVED FROM A DELAYED TAPE, not
 *    instructions. Nothing here is a recommendation to trade, and the UI must
 *    render them as modeled — the whole point of computing them is to give the
 *    operator something concrete to confirm, not something to obey.
 *
 * 2. Three constants below are assumptions, not observations: the entry buffer,
 *    the slippage model, and the R multiples. They are named, exported and
 *    stated on the output so they can be argued with. An assumption that cannot
 *    be seen is indistinguishable from an invention.
 *
 * 3. Anything that cannot be computed stays null and lands in
 *    `unavailableReasons`. A play with no measurable stop is not a play with a
 *    zero stop. If the planned-loss budget will not buy a single share at the
 *    required stop distance, the constructor says so rather than rounding up to
 *    one share and quietly breaching the ceiling.
 *
 * 4. The constructor NEVER decides. It produces a proposal that must still pass
 *    every gate in gates.ts, be reviewed by a human, acknowledged with the
 *    literal PAPER, and approved separately. It writes nothing.
 *
 * PURE — no database, no network, no clock.
 */
import { CURRENT_MANDATE, type HoldingPeriod, type Mandate } from "./mandate";
import { singleOrderCeilingCents } from "./gates";
import type { MinuteBar, OpeningRange, SessionVwap, TapeFeed, VwapHoldCheck } from "./intraday";
import { describeTape } from "./intraday";
import { buildOpeningRangeTradingOntology, type TradingOntology } from "../../shared/tradingOntology";

// ── Stated assumptions ────────────────────────────────────────────────────────

/**
 * How far beyond the trigger level the entry sits, in basis points of price.
 * A breakout entered exactly at the range high is filled by every false break;
 * this buffer is a judgement, not a measurement, and it is stated as one.
 */
export const ENTRY_BUFFER_BPS = 6; // 0.06%

/**
 * Slippage allowance as a share of the session's average one-minute bar range.
 * Paper fills execute at the quote, so this is the only place execution cost
 * appears at all — see PAPER_SLIPPAGE_ASSUMPTION in scorecard.ts.
 */
export const SLIPPAGE_SHARE_OF_BAR_RANGE = 0.25;
export const MIN_SLIPPAGE_CENTS = 1;

/** Partial and final targets, as multiples of the risked distance. */
export const TARGET_R_MULTIPLES = [1.5, 2.5];

/** Intraday positions are reviewed for exit here, well before the 15:55 cutoff. */
export const INTRADAY_TIME_STOP_ET_MINUTES = 15 * 60 + 30;

/** An opening range wider than this is a skip, not a setup. */
export const MAX_OPENING_RANGE_PCT = 4;

/** A price already this far beyond the entry has gapped away from the plan. */
export const MAX_GAP_BEYOND_ENTRY_PCT = 1;

// ── Shapes ────────────────────────────────────────────────────────────────────

export type PlaySide = "long" | "short";

export interface PlayLevel {
  priceCents: number;
  /** Always true here. These are derived levels, never quoted instructions. */
  modeled: true;
  /** The observation the level came from, and any assumption applied to it. */
  basis: string;
}

export interface PlayTarget extends PlayLevel {
  rMultiple: number;
}

export type PlayReadiness =
  | "constructed"
  | "needs_tape"
  | "needs_equity"
  | "needs_range"
  | "budget_too_small"
  | "expired";

export interface ConstructedPlay {
  symbol: string;
  side: PlaySide;
  holdingPeriod: HoldingPeriod;
  /** The market opportunity, execution choice, horizon, catalyst, and signals are separate objects. */
  taxonomy: TradingOntology;
  readiness: PlayReadiness;

  entry: PlayLevel | null;
  stop: PlayLevel | null;
  slippage: PlayLevel | null;
  targets: PlayTarget[];

  /** The mandate's per-play planned-loss budget at this equity. */
  budgetCents: number | null;
  qty: number | null;
  notionalCents: number | null;
  plannedLossCents: number | null;
  plannedLossPctOfEquity: number | null;
  /** True when the single-order notional ceiling cut the size below the budget. */
  sizeLimitedByNotionalCeiling: boolean;

  timeStopAt: number | null;
  noTradeConditions: string[];

  /** From checkVwapHold — confirmed / rejected / unknown, with its own basis. */
  trigger: VwapHoldCheck | null;

  /** One line naming the feed and its measured lag. Renders under the figures. */
  tapeBasis: string;
  feed: TapeFeed;
  /** Every field that could not be computed, and why. */
  unavailableReasons: string[];
  /** The judgements applied, so they can be argued with rather than assumed. */
  assumptions: string[];
}

export interface ConstructPlayInput {
  symbol: string;
  side?: PlaySide;
  holdingPeriod: HoldingPeriod;
  instrumentPreference?: "shares" | "options" | "either" | null;
  bars: MinuteBar[];
  vwap: SessionVwap;
  range: OpeningRange;
  trigger?: VwapHoldCheck | null;
  equityCents: number | null;
  /** ET midnight for the session, used to place the time stop. */
  sessionDayStartMs: number | null;
  catalystDeadlineAt?: number | null;
  advUsd?: number | null;
  mandate?: Mandate;
  queueAtOpen?: {
    referencePriceCents: number;
    referenceAsOf: number;
    referenceExpiresAt: number | null;
    sourceName: string;
    maxNotionalCents: number;
    maxPlannedLossCents: number;
    slippageCents: number;
    timeStopAt: number;
  } | null;
  now: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const cents = (price: number): number => Math.round(price * 100);
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Median one-minute bar range, in cents. The basis for the slippage model. */
function medianBarRangeCents(bars: MinuteBar[]): number | null {
  const ranges = bars
    .filter((b) => b.v > 0 && Number.isFinite(b.h) && Number.isFinite(b.l) && b.h >= b.l)
    .map((b) => cents(b.h - b.l))
    .sort((a, b) => a - b);
  if (!ranges.length) return null;
  const mid = Math.floor(ranges.length / 2);
  return ranges.length % 2 ? ranges[mid]! : Math.round((ranges[mid - 1]! + ranges[mid]!) / 2);
}

const lastPriceCents = (bars: MinuteBar[]): number | null => {
  const withVolume = bars.filter((b) => b.v > 0 && b.c > 0).sort((a, b) => a.t - b.t);
  return withVolume.length ? cents(withVolume[withVolume.length - 1]!.c) : null;
};

function constructQueueAtOpenPlay(input: ConstructPlayInput, queue: NonNullable<ConstructPlayInput["queueAtOpen"]>): ConstructedPlay {
  const side: PlaySide = input.side ?? "long";
  const mandate = input.mandate ?? CURRENT_MANDATE;
  const unavailable: string[] = [];
  const assumptions: string[] = [];
  const noTradeConditions: string[] = [];
  const sourceName = queue.sourceName.trim() || "verified market-data source";
  const referenceIsFresh = queue.referencePriceCents > 0
    && queue.referenceAsOf > 0
    && (queue.referenceExpiresAt == null || queue.referenceExpiresAt > input.now);
  const taxonomy: TradingOntology = {
    marketPlay: {
      family: "unclassified",
      specificPlay: "operator_bounded_opening_limit",
      status: referenceIsFresh ? "candidate" : "unclassified",
      basis: "The operator chose a bounded queue-at-open workflow. No opening-range or VWAP setup is inferred before the session exists.",
    },
    execution: {
      direction: side,
      strategy: side === "long" ? "buy_shares" : "short_shares",
      instrument: "equity",
    },
    horizon: {
      key: "day_trade",
      label: "Day trade · queued for next regular session",
      sourceHoldingPeriod: input.holdingPeriod,
      basis: "The LIMIT/DAY order may queue while closed and the human review time keeps the play inside one regular session.",
    },
    catalyst: input.catalystDeadlineAt == null
      ? { status: "not_specified", label: "No catalyst deadline recorded", deadlineAt: null, subtype: "not_classified" }
      : input.catalystDeadlineAt <= input.now
        ? { status: "expired", label: "Decision window expired", deadlineAt: input.catalystDeadlineAt, subtype: "not_classified" }
        : { status: "time_bound", label: "Same-session decision window", deadlineAt: input.catalystDeadlineAt, subtype: "not_classified" },
    signals: [
      {
        key: "price_limit",
        label: "Verified price cap",
        status: referenceIsFresh ? "confirmed" : "unavailable",
        basis: referenceIsFresh
          ? `${sourceName} reference from ${new Date(queue.referenceAsOf).toISOString()} caps the queued buy; it is not a forecast.`
          : "No fresh verified price reference is available, so no queued limit may be constructed.",
      },
      {
        key: "regular_session_queue",
        label: "Regular-session queue",
        status: "confirmed",
        basis: "LIMIT/DAY is eligible to rest for the next regular session and cannot execute overnight.",
      },
    ],
  };
  const base: ConstructedPlay = {
    symbol: input.symbol,
    side,
    holdingPeriod: input.holdingPeriod,
    taxonomy,
    readiness: "needs_tape",
    entry: null,
    stop: null,
    slippage: null,
    targets: [],
    budgetCents: null,
    qty: null,
    notionalCents: null,
    plannedLossCents: null,
    plannedLossPctOfEquity: null,
    sizeLimitedByNotionalCeiling: false,
    timeStopAt: queue.timeStopAt,
    noTradeConditions,
    trigger: null,
    tapeBasis: referenceIsFresh
      ? `${sourceName} verified reference ${(queue.referencePriceCents / 100).toFixed(2)} as of ${new Date(queue.referenceAsOf).toISOString()}`
      : "Verified price reference unavailable",
    feed: sourceName.toLowerCase().includes("sip") ? "sip" : "unknown",
    unavailableReasons: unavailable,
    assumptions,
  };

  if (!referenceIsFresh) {
    unavailable.push("the queue-at-open instruction has no fresh verified price reference, so a bounded LIMIT/DAY ticket cannot be prepared");
    return base;
  }
  if (input.equityCents == null || input.equityCents <= 0) {
    unavailable.push("account equity is unknown, so the queue cannot be checked against the single-order and planned-loss ceilings");
    return { ...base, readiness: "needs_equity" };
  }
  if (input.catalystDeadlineAt != null && input.catalystDeadlineAt <= input.now) {
    unavailable.push("the same-session decision window has expired, so this queue cannot be prepared");
    return { ...base, readiness: "expired" };
  }

  const systemRiskBudget = Math.floor((mandate.maxPlannedRiskPctPerPlay / 100) * input.equityCents);
  const budgetCents = Math.min(queue.maxPlannedLossCents, systemRiskBudget);
  const orderCeilingCents = singleOrderCeilingCents(input.equityCents, mandate);
  const maxNotionalCents = Math.min(queue.maxNotionalCents, orderCeilingCents);
  const qty = Math.floor(maxNotionalCents / queue.referencePriceCents);
  if (qty < 1) {
    unavailable.push(`the $${(maxNotionalCents / 100).toFixed(2)} notional ceiling cannot buy one share at the verified $${(queue.referencePriceCents / 100).toFixed(2)} limit`);
    return { ...base, readiness: "budget_too_small", budgetCents };
  }

  const riskPerShareCents = Math.floor(budgetCents / qty);
  if (riskPerShareCents <= queue.slippageCents) {
    unavailable.push("the planned-loss ceiling cannot cover one share plus the declared slippage allowance");
    return { ...base, readiness: "budget_too_small", budgetCents };
  }
  const stopDistanceCents = riskPerShareCents - queue.slippageCents;
  const stopPriceCents = side === "long"
    ? queue.referencePriceCents - stopDistanceCents
    : queue.referencePriceCents + stopDistanceCents;
  if (stopPriceCents <= 0) {
    unavailable.push("the derived protective stop is not a valid positive price");
    return { ...base, readiness: "budget_too_small", budgetCents };
  }

  const plannedLossCents = qty * (stopDistanceCents + queue.slippageCents);
  const notionalCents = qty * queue.referencePriceCents;
  const targets = TARGET_R_MULTIPLES.map((rMultiple) => ({
    priceCents: side === "long"
      ? queue.referencePriceCents + Math.round(riskPerShareCents * rMultiple)
      : queue.referencePriceCents - Math.round(riskPerShareCents * rMultiple),
    modeled: true as const,
    rMultiple,
    basis: `${rMultiple}R arithmetic from the declared maximum loss; not a probability or price forecast`,
  }));
  assumptions.push(
    `limit equals the latest fresh verified ${sourceName} reference; a higher open does not chase`,
    `protective stop uses the operator's $${(budgetCents / 100).toFixed(2)} maximum planned loss across ${qty} share${qty === 1 ? "" : "s"}, including ${queue.slippageCents}c/share slippage`,
    "the protective stop is a human-reviewed risk boundary; the entry submission does not claim an automatic exit order",
  );
  noTradeConditions.push(
    `Cancel before the open if the paper account, market calendar, ${input.symbol} tradability or liquidity, or the verified price basis becomes missing or stale.`,
    `Do not chase: if ${input.symbol} opens above the $${(queue.referencePriceCents / 100).toFixed(2)} limit, allow the DAY order to remain unfilled or cancel it.`,
    `Exit or reassess by ${new Date(queue.timeStopAt).toISOString()}; this is a same-session paper play, not an overnight position.`,
  );
  if (input.advUsd == null) {
    noTradeConditions.push("No fresh 30-day ADV fact exists; the liquidity gate must refuse this order.");
  } else if (input.advUsd < mandate.minAdvUsd30d) {
    noTradeConditions.push(`30-day ADV $${Math.round(input.advUsd).toLocaleString("en-US")} is below the $${mandate.minAdvUsd30d.toLocaleString("en-US")} floor; the liquidity gate must refuse this order.`);
  }

  return {
    ...base,
    readiness: "constructed",
    entry: {
      priceCents: queue.referencePriceCents,
      modeled: true,
      basis: `LIMIT cap set at the verified ${sourceName} reference from ${new Date(queue.referenceAsOf).toISOString()}; a higher opening price does not fill`,
    },
    stop: {
      priceCents: stopPriceCents,
      modeled: true,
      basis: `maximum-loss boundary: ${(stopDistanceCents / 100).toFixed(2)} per share from entry, plus ${queue.slippageCents}c/share slippage`,
    },
    slippage: {
      priceCents: queue.slippageCents,
      modeled: true,
      basis: "fixed queue-at-open slippage assumption",
    },
    targets,
    budgetCents,
    qty,
    notionalCents,
    plannedLossCents,
    plannedLossPctOfEquity: round2((plannedLossCents / input.equityCents) * 100),
    sizeLimitedByNotionalCeiling: maxNotionalCents === orderCeilingCents && orderCeilingCents < queue.maxNotionalCents,
    assumptions,
    noTradeConditions,
  };
}

// ── The constructor ───────────────────────────────────────────────────────────

export function constructPlay(input: ConstructPlayInput): ConstructedPlay {
  if (input.queueAtOpen) return constructQueueAtOpenPlay(input, input.queueAtOpen);
  const side: PlaySide = input.side ?? "long";
  const mandate = input.mandate ?? CURRENT_MANDATE;
  const long = side === "long";
  const unavailable: string[] = [];
  const assumptions: string[] = [];
  const noTrade: string[] = [];
  const taxonomy = buildOpeningRangeTradingOntology({
    side,
    holdingPeriod: input.holdingPeriod,
    instrumentPreference: input.instrumentPreference,
    openingRange: {
      complete: input.range.complete,
      minutes: input.range.minutes ?? null,
      unavailableReason: input.range.unavailableReason,
    },
    vwapHold: input.trigger ?? null,
    catalystDeadlineAt: input.catalystDeadlineAt ?? null,
    now: input.now,
  });

  const base: ConstructedPlay = {
    symbol: input.symbol,
    side,
    holdingPeriod: input.holdingPeriod,
    taxonomy,
    readiness: "needs_tape",
    entry: null,
    stop: null,
    slippage: null,
    targets: [],
    budgetCents: null,
    qty: null,
    notionalCents: null,
    plannedLossCents: null,
    plannedLossPctOfEquity: null,
    sizeLimitedByNotionalCeiling: false,
    timeStopAt: null,
    noTradeConditions: noTrade,
    trigger: input.trigger ?? null,
    tapeBasis: describeTape({ feed: input.vwap.feed, asOf: input.vwap.asOf, lagMs: input.vwap.lagMs }),
    feed: input.vwap.feed,
    unavailableReasons: unavailable,
    assumptions,
  };

  // ── The tape has to exist before anything can be derived from it ───────────
  if (!input.bars.length) {
    unavailable.push("no minute bars for this session — no level can be derived without an observed tape");
    return base;
  }

  // ── Entry: the opening-range break, plus a stated buffer ───────────────────
  if (input.range.high == null || input.range.low == null) {
    unavailable.push(
      input.range.unavailableReason ?? "the opening range could not be measured, so there is no trigger level to break",
    );
    return { ...base, readiness: "needs_range" };
  }
  if (!input.range.complete) {
    // Deliberately not fatal: the levels are still real, but the range they came
    // from is still forming and the operator must know that.
    unavailable.push(`opening range is still forming — ${input.range.unavailableReason ?? "window not closed"}`);
  }

  const rangeHighCents = cents(input.range.high);
  const rangeLowCents = cents(input.range.low);
  const triggerLevel = long ? rangeHighCents : rangeLowCents;
  const bufferCents = Math.max(1, Math.round((triggerLevel * ENTRY_BUFFER_BPS) / 10_000));
  const entryCents = long ? triggerLevel + bufferCents : triggerLevel - bufferCents;
  assumptions.push(
    `entry sits ${ENTRY_BUFFER_BPS} bps (${bufferCents}c) beyond the ${input.range.minutes}-minute opening-range ${long ? "high" : "low"} — a judgement about false breaks, not a measurement`,
  );

  const entry: PlayLevel = {
    priceCents: entryCents,
    modeled: true,
    basis: `${input.range.minutes}-minute opening-range ${long ? "high" : "low"} ${long ? rangeHighCents / 100 : rangeLowCents / 100} plus a ${ENTRY_BUFFER_BPS} bps buffer, from ${input.range.feed.toUpperCase()} bars`,
  };

  // ── Stop: the protective side of VWAP or the range, whichever is further ───
  const vwapCents = input.vwap.vwap != null ? cents(input.vwap.vwap) : null;
  const stopCandidates: Array<{ price: number; from: string }> = [
    { price: long ? rangeLowCents : rangeHighCents, from: `opening-range ${long ? "low" : "high"}` },
  ];
  if (vwapCents != null) stopCandidates.push({ price: vwapCents, from: "session VWAP" });
  else unavailable.push(input.vwap.unavailableReason ?? "session VWAP is unavailable, so the stop rests on the opening range alone");

  // The stop that gives the position the most room is the one that is hardest
  // to hit by noise. Sizing then shrinks the position to fit the loss budget —
  // which is the mandate doing its job, not a reason to tighten the stop.
  const chosen = long
    ? stopCandidates.reduce((a, b) => (b.price < a.price ? b : a))
    : stopCandidates.reduce((a, b) => (b.price > a.price ? b : a));
  const stopCents = long ? chosen.price - bufferCents : chosen.price + bufferCents;

  const stop: PlayLevel = {
    priceCents: stopCents,
    modeled: true,
    basis: `${chosen.from} ${chosen.price / 100} with a ${bufferCents}c buffer — the wider of the protective levels`,
  };

  // ── Slippage: modeled from the observed bar range ──────────────────────────
  const medianRange = medianBarRangeCents(input.bars);
  const slippageCents = medianRange == null
    ? MIN_SLIPPAGE_CENTS
    : Math.max(MIN_SLIPPAGE_CENTS, Math.round(medianRange * SLIPPAGE_SHARE_OF_BAR_RANGE));
  if (medianRange == null) {
    unavailable.push(`no usable bar ranges to model slippage — the ${MIN_SLIPPAGE_CENTS}c floor was applied instead`);
  } else {
    assumptions.push(
      `slippage allowance is ${Math.round(SLIPPAGE_SHARE_OF_BAR_RANGE * 100)}% of the median ${medianRange}c one-minute bar range`,
    );
  }
  const slippage: PlayLevel = {
    priceCents: slippageCents,
    modeled: true,
    basis: medianRange == null
      ? `floor of ${MIN_SLIPPAGE_CENTS}c — no bar range was measurable`
      : `${Math.round(SLIPPAGE_SHARE_OF_BAR_RANGE * 100)}% of the median ${medianRange}c bar range on ${input.vwap.feed.toUpperCase()} bars`,
  };

  const riskPerShareCents = Math.abs(entryCents - stopCents) + slippageCents;

  // ── Targets: R multiples off the risked distance ───────────────────────────
  const targets: PlayTarget[] = TARGET_R_MULTIPLES.map((r) => ({
    priceCents: long
      ? Math.round(entryCents + riskPerShareCents * r)
      : Math.round(entryCents - riskPerShareCents * r),
    modeled: true,
    rMultiple: r,
    basis: `${r}R on a ${riskPerShareCents}c risked distance — an arithmetic projection, not a price forecast`,
  }));
  assumptions.push(`targets are ${TARGET_R_MULTIPLES.join("R and ")}R projections of the risked distance; no source states a price objective`);

  // ── Size: the operator's own formula, against the mandate's budget ─────────
  const equity = input.equityCents;
  let budgetCents: number | null = null;
  let qty: number | null = null;
  let notionalCents: number | null = null;
  let plannedLossCents: number | null = null;
  let plannedLossPct: number | null = null;
  let limitedByCeiling = false;
  let readiness: PlayReadiness = "constructed";

  if (equity == null || equity <= 0) {
    unavailable.push("account equity is unknown, so the planned-loss budget and share count cannot be computed");
    readiness = "needs_equity";
  } else {
    budgetCents = Math.floor((mandate.maxPlannedRiskPctPerPlay / 100) * equity);
    const rawQty = Math.floor(budgetCents / riskPerShareCents);

    if (rawQty < 1) {
      unavailable.push(
        `the ${mandate.maxPlannedRiskPctPerPlay}% planned-loss budget ($${(budgetCents / 100).toFixed(2)}) will not buy one share at a ${riskPerShareCents}c risked distance — this setup cannot be sized inside the mandate`,
      );
      readiness = "budget_too_small";
    } else {
      // The notional ceiling can bind before the loss budget does on a
      // high-priced name with a tight stop.
      const ceiling = singleOrderCeilingCents(equity, mandate);
      const maxQtyByNotional = Math.floor(ceiling / entryCents);
      qty = Math.min(rawQty, Math.max(0, maxQtyByNotional));
      limitedByCeiling = qty < rawQty;
      if (qty < 1) {
        unavailable.push(`the $${(ceiling / 100).toFixed(0)} single-order ceiling will not buy one share at ${entryCents / 100}`);
        qty = null;
        readiness = "budget_too_small";
      } else {
        notionalCents = qty * entryCents;
        plannedLossCents = qty * riskPerShareCents;
        plannedLossPct = round2((plannedLossCents / equity) * 100);
        if (limitedByCeiling) {
          assumptions.push(`size was cut from ${rawQty} to ${qty} shares by the single-order notional ceiling, not by the loss budget`);
        }
      }
    }
  }

  // ── Time stop ─────────────────────────────────────────────────────────────
  let timeStopAt: number | null = null;
  if (input.holdingPeriod === "intraday") {
    if (input.sessionDayStartMs == null) {
      unavailable.push("the ET session day could not be established, so no intraday time stop was set");
    } else {
      const sessionStop = input.sessionDayStartMs + INTRADAY_TIME_STOP_ET_MINUTES * 60_000;
      timeStopAt = input.catalystDeadlineAt != null
        ? Math.min(sessionStop, input.catalystDeadlineAt)
        : sessionStop;
      assumptions.push("intraday review time is 15:30 ET — a documented review point, not an automatic exit");
    }
  } else if (input.catalystDeadlineAt != null) {
    timeStopAt = input.catalystDeadlineAt;
  } else {
    unavailable.push("no catalyst deadline was given, so no review time could be set");
  }

  if (input.catalystDeadlineAt != null && input.catalystDeadlineAt <= input.now) {
    unavailable.push("the catalyst deadline has passed, so this historical recipe cannot be prepared as a new paper proposal");
    readiness = "expired";
  }

  // ── No-trade conditions, generated from what would actually fail ──────────
  noTrade.push(
    `Skip if ${input.symbol} opens more than ${MAX_GAP_BEYOND_ENTRY_PCT}% beyond ${(entryCents / 100).toFixed(2)} — the plan is a break, not a chase.`,
  );
  if (input.range.widthPct != null && input.range.widthPct > MAX_OPENING_RANGE_PCT) {
    noTrade.push(
      `Opening range is ${round2(input.range.widthPct)}% wide, over the ${MAX_OPENING_RANGE_PCT}% limit — treat this as no setup rather than a wide stop.`,
    );
  }
  if (input.advUsd != null && input.advUsd < mandate.minAdvUsd30d) {
    noTrade.push(
      `30-day ADV $${Math.round(input.advUsd).toLocaleString("en-US")} is below the $${mandate.minAdvUsd30d.toLocaleString("en-US")} floor — the order gate will refuse this.`,
    );
  } else if (input.advUsd == null) {
    noTrade.push("No 30-day ADV fact exists for this name; the liquidity gate will refuse the order until one does.");
  }
  if (input.trigger && input.trigger.state !== "confirmed") {
    noTrade.push(
      input.trigger.state === "unknown"
        ? `Do not enter until the VWAP hold is confirmed on a real-time terminal — ${input.trigger.basis}`
        : `The VWAP hold condition is not met: ${input.trigger.basis}`,
    );
  }

  const last = lastPriceCents(input.bars);
  if (last != null) {
    const beyond = long ? last - entryCents : entryCents - last;
    if (beyond > 0 && (beyond / entryCents) * 100 > MAX_GAP_BEYOND_ENTRY_PCT) {
      noTrade.push(
        `Last observed print ${(last / 100).toFixed(2)} is already more than ${MAX_GAP_BEYOND_ENTRY_PCT}% beyond the entry — the move left without this plan.`,
      );
    }
  }

  return {
    ...base,
    readiness,
    entry,
    stop,
    slippage,
    targets,
    budgetCents,
    qty,
    notionalCents,
    plannedLossCents,
    plannedLossPctOfEquity: plannedLossPct,
    sizeLimitedByNotionalCeiling: limitedByCeiling,
    timeStopAt,
    noTradeConditions: noTrade,
    unavailableReasons: unavailable,
    assumptions,
  };
}

/**
 * The one-paragraph statement that must accompany a constructed play wherever it
 * is rendered. These are levels derived from an observed tape under stated
 * assumptions — not advice, not an instruction, and not a claim about what the
 * price will do.
 */
export const CONSTRUCTED_PLAY_DISCLOSURE =
  "Levels are modeled from observed minute bars under the assumptions listed with them, not quoted from a source and not a recommendation. " +
  "Confirm every level against a real-time terminal before acting. This is a paper research proposal: it creates no order, and a human must review, acknowledge and approve it separately.";

export const QUEUE_AT_OPEN_PLAY_DISCLOSURE =
  "The queued limit is capped by a fresh verified market-data fact; the stop, slippage, and targets are modeled risk controls, not forecasts. " +
  "A higher open does not fill the LIMIT/DAY order. This paper research proposal creates no order until a human prepares, approves, and submits it separately.";
