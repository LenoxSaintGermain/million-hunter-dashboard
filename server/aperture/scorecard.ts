/**
 * Pilot scorecard — the metric math, pure.
 *
 * alpha.ts loads the rows; this file turns them into numbers. Split so the
 * arithmetic that the pilot's whole claim rests on can be tested without a
 * database, and so the four fields the scorecard was missing — baseline,
 * benchmark, sample size, horizon — are computed in one readable place.
 *
 * Three things this file refuses to do, each because the pilot is worthless if
 * it does them:
 *
 *   1. Report a comparison without naming what it is against. "System P&L was
 *      +$400" means nothing. Baseline and benchmark are fields, not prose, and a
 *      benchmark with no priced history stays null with basis "unknown".
 *
 *   2. Let a sample size imply an edge. Thirty trades can validate a decision
 *      PROCESS — did the aperture widen, was the evidence real, were the
 *      guardrails held. It cannot validate an edge. `sampleSufficiency` says
 *      which claim the data can carry, and the scorecard renders that word.
 *
 *   3. Present paper fills as if they were market fills. Alpaca paper fills near
 *      the quote: no slippage, no partials, no queue position. At short horizons
 *      slippage IS the edge, so the assumption travels with the figures the same
 *      way a modeled economics number carries its basis.
 *
 * Selection bias is recorded rather than corrected: the operator approves system
 * candidates before they fill, so "system P&L" is really human-filtered system
 * P&L. The pre-approval set is counted so the filter is visible.
 */
import type { HoldingPeriod } from "./mandate";

// ── Sample-size taxonomy ──────────────────────────────────────────────────────

/** Below this, the run can speak to process only. */
export const INDICATIVE_SAMPLE_FLOOR = 30;
/** Below this, no claim about edge is supportable. Hundreds is the honest bar. */
export const EDGE_SAMPLE_FLOOR = 100;

export type SampleSufficiency = "process_only" | "indicative" | "edge_capable";

export function sampleSufficiencyFor(closedTrades: number): SampleSufficiency {
  if (closedTrades >= EDGE_SAMPLE_FLOOR) return "edge_capable";
  if (closedTrades >= INDICATIVE_SAMPLE_FLOOR) return "indicative";
  return "process_only";
}

export function sufficiencyNote(closedTrades: number): string {
  const s = sampleSufficiencyFor(closedTrades);
  if (s === "edge_capable") {
    return `${closedTrades} closed trades — at or above the ${EDGE_SAMPLE_FLOOR}-trade floor where an edge claim becomes arguable.`;
  }
  if (s === "indicative") {
    return `${closedTrades} closed trades — indicative of process, not of edge. An edge claim needs ${EDGE_SAMPLE_FLOOR}+.`;
  }
  return `${closedTrades} closed trades — this validates the decision process (aperture width, evidence quality, guardrail adherence). It cannot measure an edge; that needs ${EDGE_SAMPLE_FLOOR}+ closed trades.`;
}

/** Declared, not assumed away. Travels with every P&L figure the pilot reports. */
export const PAPER_SLIPPAGE_ASSUMPTION =
  "Paper fills execute at or near the quote: no slippage, no partial fills, no queue position. " +
  "At short holding periods slippage is a material share of the return, so P&L here is an upper bound on what the same decisions would have earned live.";

// ── Baseline ──────────────────────────────────────────────────────────────────

/**
 * What the system is being compared against.
 *   human_intended — the operator named trades; that plan is the baseline
 *   cash_only      — no intended trades, so the baseline is holding cash (0)
 */
export type BaselineKind = "human_intended" | "cash_only";

// ── Inputs ────────────────────────────────────────────────────────────────────

export interface ScorecardRun {
  deployableCapitalCents: number;
  intendedTrades: Array<{ symbol: string; dollarsCents: number }>;
  holdingPeriod: HoldingPeriod | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  catalystDeadlineAt: number | null;
}

export interface ScorecardOrder {
  symbol: string;
  side: "buy" | "sell";
  status: string;
  filledQty: number | null;
  filledAvgPriceCents: number | null;
  notionalCents: number | null;
  gatedNotionalCents: number | null;
  filledAt: number | null;
}

export interface ScorecardSnapshot {
  symbol: string;
  marketValueCents: number | null;
  unrealizedPnlCents: number | null;
  priceBasis: string | null;
  snapshotAt: number;
}

/** Supplied only when a source actually states it. Never fabricated downstream. */
export interface BenchmarkQuote {
  symbol: string;
  returnBps: number;
  basis: "verified" | "modeled";
}

export interface ScorecardInput {
  run: ScorecardRun;
  candidateSymbols: string[];
  orders: ScorecardOrder[];
  snapshots: ScorecardSnapshot[];
  /** Null when no priced history covers the horizon — the field stays unknown. */
  benchmark: BenchmarkQuote | null;
  now: number;
}

export interface ScorecardMetrics {
  // Aperture width
  humanOpportunitySetCount: number;
  systemAddedCount: number;
  systemFilledCount: number;
  /** Every system candidate that reached an order, approved or not. */
  systemSurfacedCount: number;
  /** System candidates the operator declined — the filter, made visible. */
  systemDeclinedCount: number;
  selectionBiasNote: string;

  // Return
  humanPnlCents: number | null;
  systemPnlCents: number | null;
  baselineKind: BaselineKind;
  baselinePnlCents: number | null;
  baselineNote: string;
  benchmarkSymbol: string | null;
  benchmarkReturnBps: number | null;
  benchmarkBasis: "verified" | "modeled" | "unknown";
  benchmarkNote: string;

  // Risk / shape
  maxDrawdownBps: number;
  hhiBefore: number;
  hhiAfter: number;
  capitalUtilizationPct: number | null;

  // Sample
  filledOrderCount: number;
  closedTradeCount: number;
  sampleSufficiency: SampleSufficiency;
  sampleNote: string;

  // Horizon
  horizonStartAt: number;
  horizonEndAt: number;
  horizonDays: number;
  holdingPeriod: HoldingPeriod | null;

  metricBasis: "verified" | "modeled" | "mixed";
  slippageAssumption: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function computeHhi(allocations: Array<{ valueCents: number }>): number {
  const total = allocations.reduce((s, a) => s + a.valueCents, 0);
  if (total === 0) return 0;
  return allocations.reduce((s, a) => {
    const share = a.valueCents / total;
    return s + share * share;
  }, 0);
}

export function computeMaxDrawdownBps(
  snapshots: Array<{ marketValueCents: number | null; snapshotAt: number }>,
): number {
  const sorted = snapshots
    .filter((s) => s.marketValueCents != null)
    .sort((a, b) => a.snapshotAt - b.snapshotAt);
  if (sorted.length < 2) return 0;

  let peak = sorted[0].marketValueCents!;
  let maxDrawdown = 0;
  for (const s of sorted) {
    const val = s.marketValueCents!;
    if (val > peak) peak = val;
    const drawdown = peak > 0 ? (peak - val) / peak : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  return Math.round(maxDrawdown * 10_000);
}

const filledValue = (o: ScorecardOrder): number =>
  o.filledQty != null && o.filledAvgPriceCents != null
    ? Math.round(o.filledQty * o.filledAvgPriceCents)
    : o.gatedNotionalCents ?? o.notionalCents ?? 0;

const norm = (s: string) => s.trim().toUpperCase();

// ── The scorecard ─────────────────────────────────────────────────────────────

export function buildScorecard(input: ScorecardInput): ScorecardMetrics {
  const { run, orders, snapshots, benchmark, now } = input;

  const humanSymbols = new Set(run.intendedTrades.map((t) => norm(t.symbol)));
  const systemSymbols = new Set(
    input.candidateSymbols.map(norm).filter((s) => !humanSymbols.has(s)),
  );

  const filled = orders.filter((o) => o.status === "filled");
  const systemOrders = orders.filter((o) => systemSymbols.has(norm(o.symbol)));

  // ── Aperture width, with the operator's filter left visible ────────────────
  const systemFilledCount = filled.filter((o) => systemSymbols.has(norm(o.symbol))).length;
  const systemSurfacedCount = systemOrders.length;
  const systemDeclinedCount = systemOrders.filter(
    (o) => o.status === "rejected" || o.status === "cancelled",
  ).length;

  const selectionBiasNote =
    systemSurfacedCount === 0
      ? "No system candidate reached an order, so system P&L reflects no decisions yet."
      : `System P&L is human-filtered: the operator approved ${systemFilledCount} of ${systemSurfacedCount} system candidates that reached an order and declined ${systemDeclinedCount}. The declined set has no P&L and is not counted against the system.`;

  // ── Return ─────────────────────────────────────────────────────────────────
  let humanPnlCents: number | null = null;
  let systemPnlCents: number | null = null;
  let metricBasis: "verified" | "modeled" | "mixed" = "modeled";

  if (filled.length > 0) {
    const latestBySymbol = new Map<string, ScorecardSnapshot>();
    for (const s of snapshots) {
      const key = norm(s.symbol);
      const existing = latestBySymbol.get(key);
      if (!existing || s.snapshotAt > existing.snapshotAt) latestBySymbol.set(key, s);
    }

    let humanPnl = 0, systemPnl = 0, hasVerified = false, hasModeled = false;
    for (const [symbol, snap] of Array.from(latestBySymbol.entries())) {
      const pnl = snap.unrealizedPnlCents ?? 0;
      if (snap.priceBasis === "verified") hasVerified = true;
      else hasModeled = true;
      if (humanSymbols.has(symbol)) humanPnl += pnl;
      else systemPnl += pnl;
    }
    humanPnlCents = humanPnl;
    systemPnlCents = systemPnl;
    metricBasis = hasVerified && hasModeled ? "mixed" : hasVerified ? "verified" : "modeled";
  }

  const baselineKind: BaselineKind = humanSymbols.size > 0 ? "human_intended" : "cash_only";
  const baselinePnlCents = baselineKind === "cash_only" ? 0 : humanPnlCents;
  const baselineNote =
    baselineKind === "cash_only"
      ? "No intended trades were named, so the baseline is holding cash: 0. Anything the system earned is measured against doing nothing."
      : `Baseline is the operator's own plan — ${humanSymbols.size} intended name${humanSymbols.size === 1 ? "" : "s"}, scored on the same evidence as everything the system found.`;

  const benchmarkSymbol = benchmark?.symbol ?? null;
  const benchmarkReturnBps = benchmark?.returnBps ?? null;
  const benchmarkBasis = benchmark?.basis ?? "unknown";
  const benchmarkNote = benchmark
    ? `${benchmark.symbol} returned ${(benchmark.returnBps / 100).toFixed(2)}% over the same window (${benchmark.basis}).`
    : "No priced history covers this run's horizon, so no market benchmark is stated. An uncomputed benchmark is left null rather than approximated.";

  // ── Risk / shape ───────────────────────────────────────────────────────────
  const maxDrawdownBps = computeMaxDrawdownBps(snapshots);
  const hhiBefore = computeHhi(run.intendedTrades.map((t) => ({ valueCents: t.dollarsCents })));

  const filledBySymbol = new Map<string, number>();
  for (const o of filled) {
    const key = norm(o.symbol);
    filledBySymbol.set(key, (filledBySymbol.get(key) ?? 0) + filledValue(o));
  }
  const hhiAfter = computeHhi(Array.from(filledBySymbol.values()).map((v) => ({ valueCents: v })));

  const deployedCents = Array.from(filledBySymbol.values()).reduce((s, v) => s + v, 0);
  const capitalUtilizationPct =
    run.deployableCapitalCents > 0 ? deployedCents / run.deployableCapitalCents : null;

  // ── Sample ─────────────────────────────────────────────────────────────────
  // A closed trade is an exit: one filled sell. Positions still open are not
  // counted, because an open position has not yet been right or wrong.
  const closedTradeCount = filled.filter((o) => o.side === "sell").length;
  const sampleSufficiency = sampleSufficiencyFor(closedTradeCount);

  // ── Horizon ────────────────────────────────────────────────────────────────
  const horizonStartAt = run.startedAt ?? run.createdAt;
  const lastFillAt = filled.reduce<number | null>(
    (max, o) => (o.filledAt != null && (max == null || o.filledAt > max) ? o.filledAt : max),
    null,
  );
  const horizonEndAt = run.completedAt ?? lastFillAt ?? now;
  const horizonDays = Math.max(0, (horizonEndAt - horizonStartAt) / 86_400_000);

  return {
    humanOpportunitySetCount: humanSymbols.size,
    systemAddedCount: systemSymbols.size,
    systemFilledCount,
    systemSurfacedCount,
    systemDeclinedCount,
    selectionBiasNote,

    humanPnlCents,
    systemPnlCents,
    baselineKind,
    baselinePnlCents,
    baselineNote,
    benchmarkSymbol,
    benchmarkReturnBps,
    benchmarkBasis,
    benchmarkNote,

    maxDrawdownBps,
    hhiBefore,
    hhiAfter,
    capitalUtilizationPct,

    filledOrderCount: filled.length,
    closedTradeCount,
    sampleSufficiency,
    sampleNote: sufficiencyNote(closedTradeCount),

    horizonStartAt,
    horizonEndAt,
    horizonDays: Math.round(horizonDays * 100) / 100,
    holdingPeriod: run.holdingPeriod,

    metricBasis,
    slippageAssumption: PAPER_SLIPPAGE_ASSUMPTION,
  };
}
