import { STALE_ACCOUNT_MS } from "./cockpitRailSummary";

/**
 * How old a saved broker snapshot is, in words. Display only: nothing here
 * schedules or triggers a sync. A snapshot that was never synced is stale.
 */
export function snapshotAge(ageMs: number | null | undefined): { text: string; stale: boolean } {
  if (ageMs == null || !Number.isFinite(ageMs)) return { text: "never synced", stale: true };
  const age = Math.max(0, ageMs);
  const stale = age > STALE_ACCOUNT_MS;
  if (age < 60_000) return { text: "synced just now", stale };
  if (age < 3_600_000) return { text: `synced ${Math.floor(age / 60_000)}m ago`, stale };
  if (age < 48 * 3_600_000) return { text: `synced ${Math.floor(age / 3_600_000)}h ago`, stale };
  return { text: `synced ${Math.floor(age / 86_400_000)}d ago`, stale };
}

export function snapshotAgeAt(lastSyncedAt: number | null | undefined, now: number) {
  return snapshotAge(lastSyncedAt == null ? null : now - lastSyncedAt);
}

/** "synced 11h ago · stale" — the age label shown next to a Sync now action. */
export function snapshotAgeLabel(ageMs: number | null | undefined): string {
  const age = snapshotAge(ageMs);
  return age.stale && age.text !== "never synced" ? `${age.text} · stale` : age.text;
}

/**
 * Whether the read-only broker sync (aperture.account.sync) can be offered for
 * an account. Manual records are updated by CSV, as on the Accounts page.
 */
export function snapshotSyncAvailability(account: { accountId: number | null | undefined; brokerId: string | null | undefined }): { canSync: true; accountId: number; reason: null } | { canSync: false; accountId: null; reason: string | null } {
  if (account.accountId == null) return { canSync: false, accountId: null, reason: null };
  if (account.brokerId === "manual") return { canSync: false, accountId: null, reason: "Manual record · update by CSV in Portfolio" };
  if (!account.brokerId) return { canSync: false, accountId: null, reason: null };
  return { canSync: true, accountId: account.accountId, reason: null };
}
