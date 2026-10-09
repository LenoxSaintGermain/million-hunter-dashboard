import { describe, expect, it } from "vitest";
import { newerSnapshotAccountIds, snapshotStamps } from "./snapshotAgreement";

describe("snapshot agreement (#120)", () => {
  it("flags an account whose stored snapshot moved forward (e.g. the 15-minute scheduled sync)", () => {
    const before = snapshotStamps([{ id: 1, lastSyncedAt: 1_000 }, { id: 2, lastSyncedAt: 5 }]);
    const after = snapshotStamps([{ id: 1, lastSyncedAt: 901_000 }, { id: 2, lastSyncedAt: 5 }]);
    expect(newerSnapshotAccountIds(before, after)).toEqual([1]);
  });
  it("ignores first sight, unchanged and older stamps", () => {
    expect(newerSnapshotAccountIds(new Map(), snapshotStamps([{ id: 1, lastSyncedAt: 10 }]))).toEqual([]);
    expect(newerSnapshotAccountIds(snapshotStamps([{ id: 1, lastSyncedAt: 10 }]), snapshotStamps([{ id: 1, lastSyncedAt: 9 }]))).toEqual([]);
    expect(newerSnapshotAccountIds(snapshotStamps([{ id: 1, lastSyncedAt: 10 }]), snapshotStamps([{ id: 1, lastSyncedAt: null }]))).toEqual([]);
  });
});
