/**
 * Keeps every screen on the same broker snapshot (Refs #120). The scheduled
 * paper-account sync updates the stored snapshot between page views; when
 * any screen reads a newer snapshot, the derived reads (cockpit, desk,
 * positions) are invalidated so Today and Portfolio agree without a reload.
 * Pure comparison: nothing here syncs or writes broker data.
 */
export type SnapshotRow = { id: number; lastSyncedAt?: number | null };

export function snapshotStamps(accounts: readonly SnapshotRow[] | null | undefined): Map<number, number | null> {
  return new Map((accounts ?? []).map((account) => [account.id, account.lastSyncedAt ?? null]));
}

/** Accounts whose snapshot is newer than the last one this tab saw. First sight of an account is not a change. */
export function newerSnapshotAccountIds(previous: ReadonlyMap<number, number | null>, next: ReadonlyMap<number, number | null>): number[] {
  const changed: number[] = [];
  next.forEach((stamp, id) => {
    if (!previous.has(id)) return;
    const before = previous.get(id) ?? null;
    if (stamp != null && (before == null || stamp > before)) changed.push(id);
  });
  return changed;
}
