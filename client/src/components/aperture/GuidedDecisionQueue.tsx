import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Send, ShieldAlert, Sparkles, AlertCircle, RefreshCw, XCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ApertureAttentionBriefing, ApertureAttentionItem } from "@shared/apertureAttention";
import type { TodayExecutionData } from "./TodayExecutionSnapshot";
import { MicroTooltip } from "./MicroTooltip";
import { overdueReviewNudge } from "@shared/overdueReviewNudge";
import type { GuidedAccountCheck } from "@shared/guidedAllClear";

interface GuidedDecisionQueueProps {
  attention: ApertureAttentionBriefing | null;
  execution?: TodayExecutionData;
  onOpen: (href: string) => void;
  onRefresh?: () => void;
  className?: string;
  /**
   * Key of the decision the briefing actually shows as its lead card. It can
   * differ from attention.primary: overdue reviews are folded out of the lead,
   * so the next task (e.g. an approved order) is promoted. Null = no lead card.
   * Omitted = fall back to attention.primary.
   */
  leadKey?: string | null;
  /**
   * Whether the practice account is synced and inside every measured limit.
   * Without it (or when unverified) the queue never says "All clear".
   */
  accountCheck?: GuidedAccountCheck | null;
}

interface DecisionCardItem {
  id: string;
  type: "order_ready" | "order_blocked" | "gate_review" | "quote_stale" | "safe_all_clear" | "account_unverified";
  title: string;
  badge: string;
  badgeTone: "green" | "amber" | "blue" | "gray";
  summary: string;
  detail: string;
  primaryActionLabel: string;
  secondaryActionLabel?: string;
  href?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
}

export function GuidedDecisionQueue({
  attention,
  onOpen,
  onRefresh,
  className = "",
  leadKey,
  accountCheck,
}: GuidedDecisionQueueProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Synthesize bite-sized decision cards from the server's attention items
  const cards: DecisionCardItem[] = [];

  // 1. Approved orders. Driven only by the server's attention items, which carry
  // the submit-time gate verdict. One card per approved order, never a guessed
  // symbol, and never "Send Order" unless every final check passes right now.
  // The order that is already the lead decision card below is not repeated.
  const shownLeadKey = leadKey === undefined ? attention?.primary?.key : leadKey;
  const approvedItems = [attention?.primary, ...(attention?.otherCritical ?? []), ...(attention?.otherAttention ?? [])]
    .filter((item): item is ApertureAttentionItem => item?.kind === "approved_not_submitted")
    .filter((item) => item.key !== shownLeadKey);

  for (const item of approvedItems) {
    const symbol = item.symbol ?? "This order";
    const ready = item.submitState === "ready";
    const blocker = item.submitBlockers?.[0];
    cards.push({
      id: `order_${item.key}`,
      type: ready ? "order_ready" : "order_blocked",
      title: ready ? `${symbol} order: final checks pass` : `${symbol} order: ${blocker?.title ?? "final checks not verified"}`,
      badge: ready ? "Approved" : "Blocked",
      badgeTone: ready ? "green" : "amber",
      summary: ready
        ? "You approved this practice trade earlier. Review the final checks, then confirm to send it to the paper broker."
        : blocker?.remedy ?? "Refresh status. Send stays off until the final checks run and pass.",
      detail: ready
        ? "Checks rerun when you send. Nothing is sent until you confirm."
        : "Send stays off while a final check fails. No order was sent.",
      primaryActionLabel: item.actionLabel,
      href: item.href,
    });
  }

  // 2. Check for Gate Reviews / 30-Day Checkups
  // Every overdue checkpoint/outcome review folds into one quiet card whose one
  // next action is the oldest review.
  const overdueReviews = overdueReviewNudge([attention?.primary, ...(attention?.otherCritical ?? []), ...(attention?.otherAttention ?? [])]);

  if (overdueReviews) {
    cards.push({
      id: `gate_review_${overdueReviews.next.key}`,
      type: "gate_review",
      title: overdueReviews.title,
      badge: "Overdue",
      badgeTone: "gray",
      summary: overdueReviews.summary,
      detail: "A human checkpoint. Nothing checks, orders or exits automatically.",
      primaryActionLabel: overdueReviews.actionLabel,
      href: overdueReviews.next.href,
    });
  }

  // 3. Out-of-date saved status. The button only re-reads saved records; it
  // never fetches new market prices, so the copy must not say it does.
  const staleItem = attention?.otherAttention?.find(
    (item) => item.stateLabel?.toLowerCase().includes("stale")
  );

  if (staleItem) {
    cards.push({
      id: `stale_${staleItem.key}`,
      type: "quote_stale",
      title: "Some saved status is out of date",
      badge: "Out of date",
      badgeTone: "amber",
      summary: staleItem.reason || "Some of what's shown here is older than it should be. Check it again before you decide.",
      detail: "Reloading re-reads what's already saved. It doesn't fetch new market prices. For fresh account numbers, use Sync now on the account bar.",
      primaryActionLabel: "Reload saved status",
      onPrimary: onRefresh,
    });
  }

  // 4. Nothing needs a decision. It is only an all-clear when the account is
  // synced recently and every measured limit has room; otherwise say what is
  // unknown. A critical primary card shown elsewhere is never an all-clear.
  if (cards.length === 0 && !attention?.primary?.critical && !(attention?.otherCritical?.length)) {
    const verified = accountCheck?.verified === true;
    cards.push(verified ? {
      id: "all_clear",
      type: "safe_all_clear",
      title: "All clear: nothing needs you right now",
      badge: "All clear",
      badgeTone: "green",
      summary: accountCheck!.reason,
      detail: "Nothing checks, orders or exits automatically. You decide every step.",
      primaryActionLabel: "Explore a new idea",
      href: "/aperture/theses",
    } : {
      id: "unverified_quiet",
      type: "account_unverified",
      title: "Nothing needs a decision right now",
      badge: "Check account",
      badgeTone: "gray",
      summary: accountCheck?.reason ?? "We couldn't confirm your account is synced and inside its limits.",
      detail: "An empty list isn't an all-clear until your account is synced and your limits are measured.",
      primaryActionLabel: "Open Portfolio",
      href: "/aperture/accounts",
    });
  }

  if (cards.length === 0) return null;
  const activeCard = cards[currentIndex] || cards[0];

  return (
    <div
      aria-label="Guided Decision Queue"
      className={`rounded-xl border border-rule bg-surface p-4 sm:p-5 shadow-xs ${className}`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-rule">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Today's Action Queue (Guided)
          </span>
        </div>

        {cards.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              {currentIndex + 1} of {cards.length}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md"
                disabled={currentIndex === cards.length - 1}
                onClick={() => setCurrentIndex((prev) => Math.min(cards.length - 1, prev + 1))}
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Active Card Content */}
      <div className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-ink tracking-tight">{activeCard.title}</h3>
          <Badge
            variant="outline"
            className={`text-[11px] font-semibold uppercase tracking-wider ${
              activeCard.badgeTone === "green"
                ? "border-[var(--sh-emerald)] bg-[var(--sh-emerald-15)] text-[var(--sh-fg-1)]"
                : activeCard.badgeTone === "amber"
                ? "border-[var(--sh-signal)] bg-[var(--sh-burnt-amber-10)] text-[var(--sh-signal)]"
                : activeCard.badgeTone === "blue"
                ? "border-[var(--sh-fg-1)] bg-[var(--sh-surface-1)] text-[var(--sh-fg-1)]"
                : "border-[var(--sh-border-1)] bg-[var(--sh-surface-1)] text-[var(--sh-fg-2)]"
            }`}
          >
            {activeCard.badge}
          </Badge>
        </div>

        <p className="text-sm text-ink leading-relaxed font-medium">{activeCard.summary}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{activeCard.detail}</p>

        {/* Action Controls */}
        <div className="pt-2 flex flex-wrap items-center gap-2.5">
          <Button
            size="sm"
            onClick={() => {
              if (activeCard.onPrimary) {
                activeCard.onPrimary();
              } else if (activeCard.href) {
                onOpen(activeCard.href);
              }
            }}
            className="text-xs font-semibold bg-ink text-bone hover:bg-ink/90 min-h-9"
          >
            {activeCard.type === "order_ready" && <Send className="mr-1.5 h-3.5 w-3.5" />}
            {activeCard.type === "order_blocked" && <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />}
            {activeCard.type === "quote_stale" && <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            {activeCard.type === "safe_all_clear" && <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            {activeCard.primaryActionLabel}
          </Button>

          {activeCard.secondaryActionLabel && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (activeCard.onSecondary) {
                  activeCard.onSecondary();
                } else if (activeCard.href) {
                  onOpen(activeCard.href);
                }
              }}
              className="text-xs min-h-9 text-muted-foreground hover:text-ink"
            >
              {activeCard.secondaryActionLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
