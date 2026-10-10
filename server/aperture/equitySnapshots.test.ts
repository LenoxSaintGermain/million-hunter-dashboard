import { describe, expect, it, vi } from "vitest";
import { EQUITY_SNAPSHOT_BUCKET_MS, equitySnapshotBucket, recordEquitySnapshot } from "./equitySnapshots";

function fakeDb(fail = false) {
  const values = vi.fn();
  const onDuplicateKeyUpdate = vi.fn(async () => { if (fail) throw new Error("db down"); });
  const insert = vi.fn(() => ({ values: (row: unknown) => { values(row); return { onDuplicateKeyUpdate }; } }));
  return { db: { insert } as never, values, onDuplicateKeyUpdate };
}

describe("equity snapshots", () => {
  it("buckets to five minutes", () => {
    const t = 1_700_000_123_456;
    expect(equitySnapshotBucket(t) % EQUITY_SNAPSHOT_BUCKET_MS).toBe(0);
    expect(equitySnapshotBucket(t + 1000)).toBe(equitySnapshotBucket(t));
  });

  it("saves the user's own row with the bucket key", async () => {
    const { db, values } = fakeDb();
    const ok = await recordEquitySnapshot(db, { accountId: 7, userId: 3, practiceBookId: 9, equityCents: 10_061_200.4, cashCents: 9_317_900, source: "alpaca_paper", takenAt: 1_700_000_123_456 });
    expect(ok).toBe(true);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ accountId: 7, userId: 3, practiceBookId: 9, equityCents: 10_061_200, bucketTs: equitySnapshotBucket(1_700_000_123_456) }));
  });

  it("is idempotent within a bucket by keeping the existing row", async () => {
    const { db, onDuplicateKeyUpdate } = fakeDb();
    await recordEquitySnapshot(db, { accountId: 1, userId: 1, equityCents: 5, source: "x", takenAt: 1 });
    expect(onDuplicateKeyUpdate).toHaveBeenCalledWith({ set: { accountId: 1 } });
  });

  it("saves nothing when equity is unknown, so the chart shows a gap", async () => {
    for (const equityCents of [null, undefined, Number.NaN]) {
      const { db, values } = fakeDb();
      expect(await recordEquitySnapshot(db, { accountId: 1, userId: 1, equityCents, source: "x", takenAt: 1 })).toBe(false);
      expect(values).not.toHaveBeenCalled();
    }
  });

  it("never throws into a sync", async () => {
    const { db } = fakeDb(true);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await recordEquitySnapshot(db, { accountId: 1, userId: 1, equityCents: 5, source: "x", takenAt: 1 })).toBe(false);
  });
});
