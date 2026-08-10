/**
 * Aperture Alpha — the honest product metric.
 *
 * Measures:
 *   - Human opportunity set vs system opportunity set
 *   - Candidates the system added that the human approved and filled
 *   - Delta in return (human-intended P&L vs system-added P&L)
 *   - Max drawdown of the full aperture portfolio
 *   - HHI concentration before vs after system additions
 *   - Capital utilization: deployed / deployable
 *
 * All figures come from real paper fills (broker_orders.status = 'filled') and
 * position_snapshots. Nothing is asserted. If there are no fills, the metric
 * basis is 'modeled' and the P&L figures are null.
 *
 * This is the product's claim to value — it must be honest or it is worthless.
 */
import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  apertureAlpha, apertureRuns, apertureCandidates, brokerOrders, positionSnapshots,
  type ApertureAlpha, type InsertApertureAlpha,
} from "../../drizzle/schema";

// ── HHI helper ────────────────────────────────────────────────────────────────

function computeHhi(allocations: Array<{ valueCents: number }>): number {
  const total = allocations.reduce((s, a) => s + a.valueCents, 0);
  if (total === 0) return 0;
  return allocations.reduce((s, a) => {
    const share = a.valueCents / total;
    return s + share * share;
  }, 0);
}

// ── Max drawdown ──────────────────────────────────────────────────────────────

function computeMaxDrawdownBps(snapshots: Array<{ marketValueCents: number | null; snapshotAt: number }>): number {
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
  return Math.round(maxDrawdown * 10_000); // basis points
}

// ── Compute or refresh alpha for a run ───────────────────────────────────────

export async function computeAlpha(runId: number, userId: number): Promise<ApertureAlpha> {
  const db = await getDb();
  if (!db) throw new Error("database unavailable");

  const now = Date.now();

  // ── 1. Load the run ────────────────────────────────────────────────────────
  const runRows = await db.select().from(apertureRuns).where(eq(apertureRuns.id, runId)).limit(1);
  const run = runRows[0];
  if (!run) throw new Error("run not found");

  // ── 2. Load candidates ─────────────────────────────────────────────────────
  const candidates = await db.select().from(apertureCandidates)
    .where(eq(apertureCandidates.runId, runId));

  // ── 3. Human opportunity set = intended trades from the run ────────────────
  const intendedTrades = (run.intendedTrades as Array<{ symbol: string; dollarsCents: number }>) ?? [];
  const humanSymbols = new Set(intendedTrades.map((t) => t.symbol.toUpperCase()));
  const humanOpportunitySetCount = humanSymbols.size;

  // ── 4. System added = candidates whose symbol was NOT in the human set ─────
  const systemAddedSymbols = candidates
    .filter((c) => !humanSymbols.has(c.symbol))
    .map((c) => c.symbol);
  const systemAddedCount = systemAddedSymbols.length;

  // ── 5. Load filled orders ──────────────────────────────────────────────────
  const filledOrders = await db.select().from(brokerOrders)
    .where(and(eq(brokerOrders.runId, runId), eq(brokerOrders.status, "filled")));

  const systemFilledCount = filledOrders.filter((o) =>
    systemAddedSymbols.includes(o.symbol)
  ).length;

  // ── 6. P&L from position snapshots ────────────────────────────────────────
  const allSnapshots = await db.select().from(positionSnapshots)
    .where(eq(positionSnapshots.runId, runId));

  let humanPnlCents: number | null = null;
  let systemPnlCents: number | null = null;
  let metricBasis: "verified" | "modeled" | "mixed" = "modeled";

  if (filledOrders.length > 0) {
    // Group snapshots by symbol, take the latest per symbol
    const latestBySymbol = new Map<string, typeof allSnapshots[0]>();
    for (const s of allSnapshots) {
      const existing = latestBySymbol.get(s.symbol);
      if (!existing || s.snapshotAt > existing.snapshotAt) {
        latestBySymbol.set(s.symbol, s);
      }
    }

    let humanPnl = 0;
    let systemPnl = 0;
    let hasVerified = false;
    let hasModeled = false;

    for (const [symbol, snap] of Array.from(latestBySymbol.entries())) {
      const pnl = snap.unrealizedPnlCents ?? 0;
      if (snap.priceBasis === "verified") hasVerified = true;
      else hasModeled = true;
      if (humanSymbols.has(symbol)) {
        humanPnl += pnl;
      } else {
        systemPnl += pnl;
      }
    }

    humanPnlCents = humanPnl;
    systemPnlCents = systemPnl;
    metricBasis = hasVerified && hasModeled ? "mixed" : hasVerified ? "verified" : "modeled";
  }

  // ── 7. Max drawdown ────────────────────────────────────────────────────────
  const maxDrawdownBps = computeMaxDrawdownBps(allSnapshots.map((s) => ({
    marketValueCents: s.marketValueCents,
    snapshotAt: s.snapshotAt,
  })));

  // ── 8. HHI concentration ───────────────────────────────────────────────────
  // Before: human intended trades
  const hhiBefore = computeHhi(intendedTrades.map((t) => ({ valueCents: t.dollarsCents })));

  // After: all filled orders (human + system)
  const filledBySymbol = new Map<string, number>();
  for (const o of filledOrders) {
    const val = o.filledQty && o.filledAvgPriceCents
      ? Math.round(o.filledQty * o.filledAvgPriceCents)
      : o.notionalCents ?? 0;
    filledBySymbol.set(o.symbol, (filledBySymbol.get(o.symbol) ?? 0) + val);
  }
  const hhiAfter = computeHhi(Array.from(filledBySymbol.values()).map((v) => ({ valueCents: v })));

  // ── 9. Capital utilization ─────────────────────────────────────────────────
  const deployedCents = Array.from(filledBySymbol.values()).reduce((s, v) => s + v, 0);
  const capitalUtilizationPct = run.deployableCapitalCents > 0
    ? deployedCents / run.deployableCapitalCents
    : null;

  // ── 10. Upsert aperture_alpha ──────────────────────────────────────────────
  const existing = await db.select().from(apertureAlpha)
    .where(eq(apertureAlpha.runId, runId)).limit(1);

  const payload: Partial<InsertApertureAlpha> = {
    runId,
    userId,
    humanOpportunitySetCount,
    systemAddedCount,
    systemFilledCount,
    humanPnlCents,
    systemPnlCents,
    maxDrawdownBps,
    hhiBefore,
    hhiAfter,
    capitalUtilizationPct,
    metricBasis,
    lastComputedAt: now,
    updatedAt: now,
  };

  if (existing[0]) {
    await db.update(apertureAlpha).set(payload).where(eq(apertureAlpha.runId, runId));
  } else {
    await db.insert(apertureAlpha).values({ ...payload, createdAt: now } as InsertApertureAlpha);
  }

  const rows = await db.select().from(apertureAlpha).where(eq(apertureAlpha.runId, runId)).limit(1);
  return rows[0]!;
}

// ── Get alpha for a run (no recompute) ────────────────────────────────────────

export async function getAlpha(runId: number): Promise<ApertureAlpha | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(apertureAlpha).where(eq(apertureAlpha.runId, runId)).limit(1);
  return rows[0] ?? null;
}
