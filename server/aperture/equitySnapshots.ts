import { accountEquitySnapshots } from "../../drizzle/schema";
import type { getDb } from "../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export const EQUITY_SNAPSHOT_BUCKET_MS = 5 * 60_000;

export interface EquitySnapshotInput {
  accountId: number;
  userId: number;
  practiceBookId?: number | null;
  equityCents: number | null | undefined;
  cashCents?: number | null;
  source: string;
  takenAt: number;
}

export function equitySnapshotBucket(takenAt: number): number {
  return Math.floor(takenAt / EQUITY_SNAPSHOT_BUCKET_MS) * EQUITY_SNAPSHOT_BUCKET_MS;
}

/**
 * Saves one account-value point per sync. Unknown equity is not saved, so the chart
 * shows a gap instead of a made-up value. A second write in the same 5-minute bucket
 * keeps the first row. Never throws: a failed snapshot must not fail a sync.
 */
export async function recordEquitySnapshot(db: Db, input: EquitySnapshotInput): Promise<boolean> {
  if (input.equityCents == null || !Number.isFinite(input.equityCents)) return false;
  try {
    await db.insert(accountEquitySnapshots).values({
      accountId: input.accountId,
      userId: input.userId,
      practiceBookId: input.practiceBookId ?? null,
      equityCents: Math.round(input.equityCents),
      cashCents: input.cashCents == null ? null : Math.round(input.cashCents),
      source: input.source,
      takenAt: input.takenAt,
      bucketTs: equitySnapshotBucket(input.takenAt),
    }).onDuplicateKeyUpdate({ set: { accountId: input.accountId } });
    return true;
  } catch (error) {
    console.warn("[equity-snapshot] not saved:", error instanceof Error ? error.message : error);
    return false;
  }
}
