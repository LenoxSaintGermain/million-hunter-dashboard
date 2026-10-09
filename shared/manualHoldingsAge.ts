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
