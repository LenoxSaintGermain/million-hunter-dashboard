/**
 * Quieting a handled item, without touching any record.
 *
 * Nothing in this workspace could ever leave the desk: reviews are immutable
 * and there is no clear, delete or archive anywhere in the router. Work
 * accumulated until the desk was unreadable.
 *
 * A dismissal is a VIEW preference. It resolves nothing, acknowledges nothing
 * and writes no workflow record — Updated, Seen, Acknowledged and Resolved stay
 * separate, as the attention model requires. It is bound to the item's exact
 * fingerprint, so a dismissed item returns the moment its state changes. An
 * operator can quiet what they have handled; they cannot quiet a new risk.
 */

export type AttentionDismissal = { key: string; fingerprint: string; dismissedAt: number };
export type DismissableItem = { key: string };

export const DISMISSAL_STORAGE_KEY = "aperture.today.dismissed";
/** Bound so a stale store cannot grow without limit on a shared device. */
export const MAX_DISMISSALS = 200;

export function isDismissed(
  item: DismissableItem,
  fingerprint: string | undefined,
  dismissals: AttentionDismissal[],
): boolean {
  if (!fingerprint) return false; // an unfingerprinted item cannot be matched safely
  return dismissals.some((entry) => entry.key === item.key && entry.fingerprint === fingerprint);
}

export function partitionDismissed<T extends DismissableItem>(
  items: T[],
  fingerprints: Map<string, string>,
  dismissals: AttentionDismissal[],
): { visible: T[]; dismissed: T[] } {
  const visible: T[] = [];
  const dismissed: T[] = [];
  for (const item of items) {
    (isDismissed(item, fingerprints.get(item.key), dismissals) ? dismissed : visible).push(item);
  }
  return { visible, dismissed };
}

export function recordDismissal(
  dismissals: AttentionDismissal[],
  entry: AttentionDismissal,
): AttentionDismissal[] {
  const withoutKey = dismissals.filter((existing) => existing.key !== entry.key);
  return [entry, ...withoutKey].slice(0, MAX_DISMISSALS);
}

export function restoreDismissal(dismissals: AttentionDismissal[], key: string): AttentionDismissal[] {
  return dismissals.filter((entry) => entry.key !== key);
}

/** Storage is untrusted: a hand-edited or corrupt value must not break Today. */
export function parseDismissals(raw: string | null): AttentionDismissal[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is AttentionDismissal =>
      !!entry && typeof entry.key === "string" && typeof entry.fingerprint === "string"
      && typeof entry.dismissedAt === "number" && Number.isFinite(entry.dismissedAt));
  } catch {
    return [];
  }
}
