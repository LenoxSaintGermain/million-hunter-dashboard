/**
 * Aperture Alpha — the honest product metric.
 *
 * Measures:
 *   - Human opportunity set vs system opportunity set, and the operator's filter
 *   - Delta in return (human-intended P&L vs system-added P&L)
 *   - Baseline and benchmark — WHAT the comparison is against, as fields
 *   - Sample size and what claim it can carry (process vs edge)
 *   - Horizon: when the run started, when it ended, how long that was
 *   - Max drawdown, HHI before/after, capital utilization
 *
 * All figures come from real paper fills (broker_orders.status = 'filled') and
 * position_snapshots. Nothing is asserted. If there are no fills, the metric
 * basis is 'modeled' and the P&L figures are null.
 *
 * The arithmetic lives in scorecard.ts and is unit-tested; this file is the I/O
 * around it. This is the product's claim to value — it must be honest or it is
 * worthless.
 */
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import {
  apertureAlpha, apertureRuns, apertureCandidates, brokerOrders, positionSnapshots,
  type ApertureAlpha, type InsertApertureAlpha,
} from "../../drizzle/schema";
import { buildScorecard } from "./scorecard";

// ── Compute or refresh alpha for a run ───────────────────────────────────────

/**
 * Loads the rows and hands them to buildScorecard. All arithmetic lives in
 * scorecard.ts so it can be tested without a database — this function is I/O.
 */
export async function computeAlpha(runId: number, userId: number): Promise<ApertureAlpha> {
  const db = await getDb();
  if (!db) throw new Error("database unavailable");

  const now = Date.now();

  const runRows = await db.select().from(apertureRuns).where(and(
    eq(apertureRuns.id, runId),
    eq(apertureRuns.userId, userId),
  )).limit(1);
  const run = runRows[0];
  if (!run) throw new Error("run not found");

  const candidates = await db.select().from(apertureCandidates)
    .where(eq(apertureCandidates.runId, runId));

  // Every order, not just the filled ones: the declined system candidates are
  // what makes the operator's filter visible instead of invisible.
  const orders = await db.select().from(brokerOrders)
    .where(and(eq(brokerOrders.runId, runId), eq(brokerOrders.userId, userId)));

  const snapshots = await db.select().from(positionSnapshots)
    .where(eq(positionSnapshots.runId, runId));

  const metrics = buildScorecard({
    run: {
      deployableCapitalCents: run.deployableCapitalCents,
      intendedTrades: (run.intendedTrades as Array<{ symbol: string; dollarsCents: number }>) ?? [],
      holdingPeriod: (run.holdingPeriod as any) ?? null,
      createdAt: run.createdAt,
      startedAt: run.startedAt ?? null,
      completedAt: run.completedAt ?? null,
      catalystDeadlineAt: run.catalystDeadlineAt ?? null,
    },
    candidateSymbols: candidates.map((c) => c.symbol),
    orders: orders.map((o) => ({
      symbol: o.symbol,
      side: o.side,
      status: o.status,
      filledQty: o.filledQty,
      filledAvgPriceCents: o.filledAvgPriceCents,
      notionalCents: o.notionalCents,
      gatedNotionalCents: o.gatedNotionalCents,
      filledAt: o.filledAt,
    })),
    snapshots: snapshots.map((s) => ({
      symbol: s.symbol,
      marketValueCents: s.marketValueCents,
      unrealizedPnlCents: s.unrealizedPnlCents,
      priceBasis: s.priceBasis,
      snapshotAt: s.snapshotAt,
    })),
    // No priced history covers a run horizon yet, so the benchmark is declared
    // unknown rather than approximated. Pass a BenchmarkQuote here the day a
    // provider can state one.
    benchmark: null,
    now,
  });

  const payload: Partial<InsertApertureAlpha> = {
    runId,
    userId,
    humanOpportunitySetCount: metrics.humanOpportunitySetCount,
    systemAddedCount: metrics.systemAddedCount,
    systemFilledCount: metrics.systemFilledCount,
    systemSurfacedCount: metrics.systemSurfacedCount,
    systemDeclinedCount: metrics.systemDeclinedCount,
    selectionBiasNote: metrics.selectionBiasNote,
    humanPnlCents: metrics.humanPnlCents,
    systemPnlCents: metrics.systemPnlCents,
    baselineKind: metrics.baselineKind,
    baselinePnlCents: metrics.baselinePnlCents,
    baselineNote: metrics.baselineNote,
    benchmarkSymbol: metrics.benchmarkSymbol,
    benchmarkReturnBps: metrics.benchmarkReturnBps,
    benchmarkBasis: metrics.benchmarkBasis,
    benchmarkNote: metrics.benchmarkNote,
    maxDrawdownBps: metrics.maxDrawdownBps,
    hhiBefore: metrics.hhiBefore,
    hhiAfter: metrics.hhiAfter,
    capitalUtilizationPct: metrics.capitalUtilizationPct,
    filledOrderCount: metrics.filledOrderCount,
    closedTradeCount: metrics.closedTradeCount,
    sampleSufficiency: metrics.sampleSufficiency,
    sampleNote: metrics.sampleNote,
    horizonStartAt: metrics.horizonStartAt,
    horizonEndAt: metrics.horizonEndAt,
    horizonDays: metrics.horizonDays,
    holdingPeriod: metrics.holdingPeriod,
    slippageAssumption: metrics.slippageAssumption,
    metricBasis: metrics.metricBasis,
    lastComputedAt: now,
    updatedAt: now,
  };

  const existing = await db.select().from(apertureAlpha)
    .where(eq(apertureAlpha.runId, runId)).limit(1);

  if (existing[0]) {
    if (existing[0].userId !== userId) throw new Error("alpha ownership mismatch");
    await db.update(apertureAlpha).set(payload).where(and(
      eq(apertureAlpha.runId, runId),
      eq(apertureAlpha.userId, userId),
    ));
  } else {
    await db.insert(apertureAlpha).values({ ...payload, createdAt: now } as InsertApertureAlpha);
  }

  const rows = await db.select().from(apertureAlpha).where(and(
    eq(apertureAlpha.runId, runId),
    eq(apertureAlpha.userId, userId),
  )).limit(1);
  return rows[0]!;
}

// ── Get alpha for a run (no recompute) ────────────────────────────────────────

export async function getAlpha(runId: number, userId: number): Promise<ApertureAlpha | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(apertureAlpha).where(and(
    eq(apertureAlpha.runId, runId),
    eq(apertureAlpha.userId, userId),
  )).limit(1);
  return rows[0] ?? null;
}
