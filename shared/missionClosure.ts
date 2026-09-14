/**
 * Closing out a mission — the operator's way to say "I am done with this."
 *
 * An operator could not clear a research run, close a mission, or empty the
 * desk: no mutation existed for any of it, so finished work accumulated
 * permanently and every list grew forever.
 *
 * Closing is a recorded decision, not a delete. Receipts, evidence and orders
 * stay readable; what changes is that the mission stops asking for attention and
 * its scheduled reviews stop coming due.
 *
 * Two things closing deliberately does NOT do, because conflating them would be
 * dangerous in a trading surface:
 *   - It does not cancel a live ticket. A ticket a human has approved or sent is
 *     resolved through the order flow, with its own written reason.
 *   - It does not close a position. A filled position is exited by an order, and
 *     a mission's paperwork has no bearing on exposure that exists.
 *
 * PURE. No clock, no database, no formatting beyond the sentences that carry a
 * refusal's meaning.
 */

export interface ClosureOrder {
  id: number;
  symbol: string;
  status: string;
}

export interface ClosureReview {
  id: number;
  status: string;
}

export type ClosureBlocker = {
  kind: "live_ticket";
  orderIds: number[];
  message: string;
};

export interface MissionClosureAssessment {
  canClose: boolean;
  blockers: ClosureBlocker[];
  /** Scheduled reviews this closure would cancel. */
  reviewsToCancel: number[];
  /** Filled positions that will still exist afterwards. Never a blocker. */
  openPositionSymbols: string[];
  /** Always populated — the sentence the confirmation renders. */
  consequence: string;
}

/** A ticket a human has moved but the market has not finished with. */
const LIVE_TICKET_STATUSES = new Set(["pending_approval", "approved", "submitted"]);
const CANCELLABLE_REVIEW_STATUSES = new Set(["pending", "due"]);

export function assessMissionClosure(input: {
  orders: readonly ClosureOrder[];
  reviews: readonly ClosureReview[];
}): MissionClosureAssessment {
  const live = input.orders.filter((order) => LIVE_TICKET_STATUSES.has(order.status));
  const filled = input.orders.filter((order) => order.status === "filled");
  const reviewsToCancel = input.reviews
    .filter((review) => CANCELLABLE_REVIEW_STATUSES.has(review.status))
    .map((review) => review.id);

  const blockers: ClosureBlocker[] = live.length
    ? [{
      kind: "live_ticket",
      orderIds: live.map((order) => order.id),
      message: `${live.length} ticket${live.length === 1 ? "" : "s"} on this mission ${live.length === 1 ? "is" : "are"} still live (${live.map((order) => order.symbol).join(", ")}). Resolve ${live.length === 1 ? "it" : "them"} in the order flow first — closing a mission never cancels a ticket.`,
    }]
    : [];

  const parts: string[] = [];
  if (blockers.length) {
    parts.push("This mission cannot be closed yet.");
  } else {
    parts.push("Closing records your decision and stops this mission asking for attention.");
    parts.push(reviewsToCancel.length
      ? `${reviewsToCancel.length} scheduled review${reviewsToCancel.length === 1 ? "" : "s"} will be cancelled.`
      : "No scheduled review is waiting on it.");
    parts.push("Its research, evidence and receipts stay readable.");
  }
  if (filled.length) {
    parts.push(`${filled.length} filled position${filled.length === 1 ? "" : "s"} (${filled.map((order) => order.symbol).join(", ")}) ${filled.length === 1 ? "remains" : "remain"} open. Closing the mission does not exit ${filled.length === 1 ? "it" : "them"}.`);
  }

  return {
    canClose: blockers.length === 0,
    blockers,
    reviewsToCancel,
    openPositionSymbols: filled.map((order) => order.symbol),
    consequence: parts.join(" "),
  };
}
