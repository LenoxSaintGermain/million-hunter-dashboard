/**
 * Scheduled sourcing.
 *
 * From the Wingate call: "no automation yet — needs a cron job (daily/weekly)
 * with dedup so it doesn't re-read unchanged listings."
 *
 * Design decisions worth knowing:
 *  - DISABLED BY DEFAULT. A job that spends tokens must never start itself; a
 *    human turns each schedule on.
 *  - Runs in-process on a 5-minute tick rather than an OS cron, so it deploys
 *    with the app and needs no host configuration.
 *  - Every run is recorded — scheduled or manual, success or failure. An
 *    unattended job that quietly returns nothing for a fortnight is worse than
 *    one that fails loudly.
 *  - Dedup already lives in the sourcing engine (name+city against the existing
 *    pipeline), so re-reading an unchanged listing costs a search but never
 *    creates a duplicate row.
 */
import { getDb } from "./db";

const TICK_MS = 5 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;
let running = false;

export interface RunRecord {
  scheduleId: number | null;
  assetClass: string;
  trigger: "schedule" | "manual";
  createdCount: number;
  researchedCount: number;
  markets: string[];
  message: string | null;
  error: string | null;
  ranAt: number;
  durationMs: number;
}

export async function recordSourcingRun(r: RunRecord): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const { sourcingRuns } = await import("../drizzle/schema");
    await db.insert(sourcingRuns).values({
      scheduleId: r.scheduleId,
      assetClass: r.assetClass,
      trigger: r.trigger,
      createdCount: r.createdCount,
      researchedCount: r.researchedCount,
      markets: r.markets as any,
      message: r.message,
      error: r.error,
      ranAt: r.ranAt,
      durationMs: r.durationMs,
    });
  } catch {
    // Never let bookkeeping break the actual run.
  }
}

/** Next UTC timestamp at `hourUtc` that is strictly in the future. */
export function computeNextRun(cadence: string, hourUtc: number, from = Date.now()): number {
  const d = new Date(from);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hourUtc, 0, 0, 0));
  const stepDays = cadence === "weekly" ? 7 : 1;
  while (next.getTime() <= from) next.setUTCDate(next.getUTCDate() + stepDays);
  return next.getTime();
}

/** Run one schedule now, whatever its next_run_at says. */
export async function runScheduleNow(scheduleId: number): Promise<RunRecord> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { sourcingSchedules } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const [row]: any[] = await db.select().from(sourcingSchedules).where(eq(sourcingSchedules.id, scheduleId)).limit(1);
  if (!row) throw new Error("Schedule not found");
  return executeSchedule(row, "manual");
}

async function executeSchedule(row: any, trigger: "schedule" | "manual"): Promise<RunRecord> {
  const started = Date.now();
  const base = {
    scheduleId: Number(row.id),
    assetClass: String(row.assetClass),
    trigger,
    ranAt: started,
  };

  let record: RunRecord;
  try {
    const { runSourcing } = await import("./sourcing");
    const r = await runSourcing({
      assetClass: String(row.assetClass),
      nationwide: !!row.nationwide,
      limit: Number(row.limitPerRun ?? 10),
      marketsPerRun: Number(row.marketsPerRun ?? 5),
    });
    record = {
      ...base,
      createdCount: r.created,
      researchedCount: r.researched,
      markets: r.searchedMarkets,
      message: r.message,
      error: null,
      durationMs: Date.now() - started,
    };
  } catch (e: any) {
    record = {
      ...base,
      createdCount: 0, researchedCount: 0, markets: [],
      message: null, error: String(e?.message ?? e),
      durationMs: Date.now() - started,
    };
  }

  await recordSourcingRun(record);

  // Stamp the schedule so the UI can show what happened without a join.
  try {
    const db = await getDb();
    if (db) {
      const { sourcingSchedules } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(sourcingSchedules).set({
        lastRunAt: started,
        lastRunCreated: record.createdCount,
        lastRunMessage: record.error ? `Failed: ${record.error}` : record.message,
        nextRunAt: computeNextRun(String(row.cadence ?? "daily"), Number(row.hourUtc ?? 9)),
        updatedAt: Date.now(),
      }).where(eq(sourcingSchedules.id, Number(row.id)));
    }
  } catch { /* bookkeeping only */ }

  return record;
}

/** One tick: run every enabled schedule that is due. */
export async function tick(): Promise<number> {
  if (running) return 0;         // never overlap — sourcing calls are slow
  running = true;
  try {
    const db = await getDb();
    if (!db) return 0;
    const { sourcingSchedules } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const rows: any[] = await db.select().from(sourcingSchedules).where(eq(sourcingSchedules.enabled, true));
    const now = Date.now();
    const due = rows.filter((r) => r.nextRunAt == null || Number(r.nextRunAt) <= now);
    for (const r of due) await executeSchedule(r, "schedule");
    return due.length;
  } catch {
    return 0;
  } finally {
    running = false;
  }
}

export function startScheduler(): void {
  if (timer) return;
  // Nothing runs unless a schedule is explicitly enabled, so starting the timer
  // is inert until someone opts in.
  timer = setInterval(() => { void tick(); }, TICK_MS);
  if (typeof timer.unref === "function") timer.unref();
  console.log("[scheduler] sourcing scheduler armed (5-min tick; all schedules disabled by default)");
}

export function stopScheduler(): void {
  if (timer) { clearInterval(timer); timer = null; }
}
