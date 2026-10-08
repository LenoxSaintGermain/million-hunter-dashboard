import type { ApertureAttentionItem } from "./apertureAttention";

/**
 * Overdue checkpoint and outcome reviews, folded into one quiet nudge with one
 * next action (the oldest review). A human checkpoint: nothing here checks,
 * orders or exits automatically. Pure; the attention derivation is unchanged.
 */
export type OverdueReviewNudge = {
  count: number;
  /** The oldest overdue review; its action is the one next action. */
  next: ApertureAttentionItem;
  items: ApertureAttentionItem[];
  title: string;
  summary: string;
  actionLabel: string;
};

export const isOverdueReview = (item: ApertureAttentionItem | null | undefined): item is ApertureAttentionItem => item?.kind === "review_due";

function shortDate(at: number) {
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function overdueReviewNudge(items: ReadonlyArray<ApertureAttentionItem | null | undefined>): OverdueReviewNudge | null {
  const seen = new Set<string>();
  const reviews = items.filter(isOverdueReview).filter(item => !seen.has(item.key) && (seen.add(item.key), true))
    .sort((left, right) => (left.deadlineAt ?? Infinity) - (right.deadlineAt ?? Infinity) || left.key.localeCompare(right.key));
  if (!reviews.length) return null;
  const [next, ...rest] = reviews;
  const since = next.deadlineAt != null ? ` · due ${shortDate(next.deadlineAt)}` : "";
  const then = rest.length ? ` Then ${rest.length} more: ${rest.slice(0, 3).map(item => item.title).join(", ")}${rest.length > 3 ? ", …" : ""}.` : "";
  return {
    count: reviews.length,
    next,
    items: reviews,
    title: reviews.length === 1 ? "Review overdue" : `Reviews overdue · ${reviews.length}`,
    summary: `${reviews.length > 1 ? "Oldest: " : ""}${next.title}${since}.${then}`,
    actionLabel: next.actionLabel,
  };
}

type Layout = { primary: ApertureAttentionItem | null; otherCritical: ApertureAttentionItem[]; otherAttention: ApertureAttentionItem[] };

/**
 * Removes overdue reviews from the ranked decision lists and returns them as
 * one nudge. The remaining order is preserved: the first remaining task leads.
 */
export function foldOverdueReviews<T extends Layout>(layout: T | null): { layout: T | null; overdue: OverdueReviewNudge | null } {
  if (!layout) return { layout, overdue: null };
  const tasks = [layout.primary, ...layout.otherCritical, ...layout.otherAttention];
  const overdue = overdueReviewNudge(tasks);
  if (!overdue) return { layout, overdue: null };
  const remaining = tasks.filter((task): task is ApertureAttentionItem => task != null && !isOverdueReview(task));
  const [primary = null, ...rest] = remaining;
  return {
    layout: { ...layout, primary, otherCritical: rest.filter(task => task.critical), otherAttention: rest.filter(task => !task.critical) },
    overdue,
  };
}
