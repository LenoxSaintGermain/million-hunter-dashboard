/**
 * Closing a mission — and the two things it must never be mistaken for.
 *
 * The operator had no way to clear a research run, close a mission, or empty
 * the desk. Adding one is only safe if it refuses the cases where "done with
 * this" would silently mean "abandoned a live ticket" or "closed a position".
 */
import { describe, it, expect } from "vitest";
import { assessMissionClosure, type ClosureOrder, type ClosureReview } from "./missionClosure";

const order = (over: Partial<ClosureOrder> = {}): ClosureOrder =>
  ({ id: 1, symbol: "PSX", status: "rejected", ...over });
const review = (over: Partial<ClosureReview> = {}): ClosureReview =>
  ({ id: 10, status: "pending", ...over });

describe("what closes cleanly", () => {
  it("closes a mission whose work is finished", () => {
    const result = assessMissionClosure({ orders: [order({ status: "rejected" })], reviews: [] });
    expect(result.canClose).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.consequence).toContain("stops this mission asking for attention");
    expect(result.consequence).toContain("stay readable");
  });

  it("closes a mission that never produced a ticket at all", () => {
    expect(assessMissionClosure({ orders: [], reviews: [] }).canClose).toBe(true);
  });

  it("names the scheduled reviews it will cancel", () => {
    const result = assessMissionClosure({
      orders: [], reviews: [review({ id: 10, status: "pending" }), review({ id: 11, status: "due" })],
    });
    expect(result.reviewsToCancel).toEqual([10, 11]);
    expect(result.consequence).toContain("2 scheduled reviews will be cancelled");
  });

  it("leaves reviews that are already finished alone", () => {
    const result = assessMissionClosure({
      orders: [], reviews: [review({ id: 10, status: "completed" }), review({ id: 11, status: "cancelled" })],
    });
    expect(result.reviewsToCancel).toEqual([]);
    expect(result.consequence).toContain("No scheduled review is waiting on it");
  });
});

describe("closing is not cancelling a ticket", () => {
  it.each(["pending_approval", "approved", "submitted"])("refuses while a %s ticket is live", (status) => {
    const result = assessMissionClosure({ orders: [order({ id: 7, symbol: "VLO", status })], reviews: [] });
    expect(result.canClose).toBe(false);
    expect(result.blockers[0]).toMatchObject({ kind: "live_ticket", orderIds: [7] });
    expect(result.blockers[0]!.message).toContain("VLO");
    expect(result.blockers[0]!.message).toContain("closing a mission never cancels a ticket");
  });

  it("lists every live ticket rather than only the first", () => {
    const result = assessMissionClosure({
      orders: [order({ id: 7, symbol: "VLO", status: "approved" }), order({ id: 8, symbol: "PSX", status: "submitted" })],
      reviews: [],
    });
    expect(result.blockers[0]!.orderIds).toEqual([7, 8]);
    expect(result.blockers[0]!.message).toContain("2 tickets");
    expect(result.blockers[0]!.message).toContain("VLO, PSX");
  });

  it("does not promise to cancel reviews on a mission it is refusing to close", () => {
    const result = assessMissionClosure({
      orders: [order({ status: "approved" })], reviews: [review()],
    });
    expect(result.canClose).toBe(false);
    expect(result.consequence).toContain("cannot be closed yet");
    expect(result.consequence).not.toContain("will be cancelled");
  });
});

describe("closing is not closing a position", () => {
  it("allows the close but says the exposure survives it", () => {
    const result = assessMissionClosure({
      orders: [order({ id: 3, symbol: "MGM", status: "filled" })], reviews: [],
    });
    expect(result.canClose).toBe(true);
    expect(result.openPositionSymbols).toEqual(["MGM"]);
    expect(result.consequence).toContain("1 filled position (MGM) remains open");
    expect(result.consequence).toContain("does not exit it");
  });

  it("counts several open positions without turning them into a blocker", () => {
    const result = assessMissionClosure({
      orders: [order({ id: 3, symbol: "MGM", status: "filled" }), order({ id: 4, symbol: "DKNG", status: "filled" })],
      reviews: [],
    });
    expect(result.canClose).toBe(true);
    expect(result.consequence).toContain("2 filled positions (MGM, DKNG) remain open");
  });

  it("still refuses when a live ticket sits beside an open position", () => {
    const result = assessMissionClosure({
      orders: [order({ id: 3, symbol: "MGM", status: "filled" }), order({ id: 4, symbol: "PSX", status: "submitted" })],
      reviews: [],
    });
    expect(result.canClose).toBe(false);
    // The surviving exposure is still worth stating alongside the refusal.
    expect(result.consequence).toContain("MGM");
  });
});
