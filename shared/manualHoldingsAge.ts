/**
 * Age of a manual (CSV-imported) holdings record (Refs #116). Manual
 * accounts never refresh on their own, so the card says how old the numbers
 * are and points at the CSV import. Display only.
 */
export const MANUAL_HOLDINGS_STALE_MS = 7 * 86_400_000;

export function manualHoldingsAge(lastUpdatedAt: number | null | undefined, now: number): { text: string; stale: boolean } {
  if (lastUpdatedAt == null || !Number.isFinite(lastUpdatedAt)) return { text: "No holdings imported yet", stale: true };
  const age = Math.max(0, now - lastUpdatedAt);
  const days = Math.floor(age / 86_400_000);
  const asOf = new Date(lastUpdatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: new Date(lastUpdatedAt).getFullYear() === new Date(now).getFullYear() ? undefined : "numeric" });
  const ageText = days === 0 ? "updated today" : `${days} ${days === 1 ? "day" : "days"} old`;
  return { text: `Holdings as of ${asOf} · ${ageText}`, stale: age > MANUAL_HOLDINGS_STALE_MS };
}

/**
 * The real age of manual holdings (#116 retest): older imports left the
 * account's lastSyncedAt empty, but every saved holding carries its own
 * price/update time. Use the newest real timestamp; null only when there is
 * none at all.
 */
export function manualHoldingsTimestamp(
  lastSyncedAt: number | null | undefined,
  holdings: readonly { priceAsOf?: number | null; updatedAt?: number | null }[] | null | undefined,
): number | null {
  const stamps = [lastSyncedAt, ...(holdings ?? []).map((holding) => holding.priceAsOf ?? holding.updatedAt)]
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  return stamps.length ? Math.max(...stamps) : null;
}

/** Copy when there is no timestamp: saved holdings without a time are not "none imported". */
export function manualHoldingsAgeLine(stamp: number | null, holdingCount: number, now: number): { text: string; stale: boolean } {
  if (stamp == null) return holdingCount > 0
    ? { text: `${holdingCount} saved holding${holdingCount === 1 ? "" : "s"} · import date not recorded`, stale: true }
    : { text: "No holdings imported yet", stale: true };
  return manualHoldingsAge(stamp, now);
}
