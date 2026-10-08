/**
 * Issue #3 (UI half): Today's guided queue and the shared attention item must
 * not invite "Send Order" for an approved order whose submit-time gates fail,
 * must name the failed gate, and must render one card per order.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deriveApertureAttention, type AttentionOrder } from "../../shared/apertureAttention";
import { describeSubmitBlocker, type OrderSubmitReadiness } from "../../shared/orderSubmitReadiness";
import { GuidedDecisionQueue } from "../../client/src/components/aperture/GuidedDecisionQueue";

const now = 1_800_000_000_000;
const stale: OrderSubmitReadiness = { state: "blocked", checkedAt: now, blockers: [
  describeSubmitBlocker("position_concentration", "NVDA would be 10.6% of equity, over the 10% single-name cap"),
  describeSubmitBlocker("execution_account_freshness", "Refresh the execution paper account within 15 minutes of proposal, approval, and submission"),
] };
const ready: OrderSubmitReadiness = { state: "ready", checkedAt: now, blockers: [] };
const order = (overrides: Partial<AttentionOrder> = {}): AttentionOrder => ({
  id: 9, runId: 4, candidateId: 2, symbol: "NVDA", instrumentType: "shares", status: "approved",
  qty: 5, filledQty: null, brokerOrderId: null, dispatchError: null, updatedAt: now, ...overrides,
} as AttentionOrder);
const attention = (orders: AttentionOrder[]) => deriveApertureAttention({
  now, mission: null, underwriting: null, evidenceTasks: [], orders, activePlays: [], pendingReviews: [], monitoringFindings: [],
  checks: { state: "complete", asOf: now, monitoring: "on_demand" },
}, null);
const items = (briefing: ReturnType<typeof attention>) => [briefing.primary, ...briefing.otherCritical, ...briefing.otherAttention].filter(Boolean);

beforeEach(() => { vi.stubGlobal("React", React); });

describe("approved order attention item", () => {
  it("blocked by the exposure ceiling and a stale snapshot: no Send, names the gate and the fix", () => {
    const [item] = items(attention([order({ submitReadiness: stale })]));
    expect(item!.actionLabel).toBe("Review blocker");
    expect(item!.actionLabel).not.toMatch(/send/i);
    expect(item!.title).toContain("Over the single-name exposure ceiling");
    expect(item!.reason).toContain("trim the existing position");
    expect(item!.reason).toContain("1 more check also failed");
    expect(item!.submitState).toBe("blocked");
    expect(item!.submitBlockers!.map((blocker) => blocker.key)).toEqual(["position_concentration", "execution_account_freshness"]);
  });

  it("without a server verdict, fails closed", () => {
    const [item] = items(attention([order()]));
    expect(item!.submitState).toBe("unverified");
    expect(item!.actionLabel).not.toMatch(/send/i);
  });

  it("only a passing verdict offers the send path, with the reviewed copy", () => {
    const [item] = items(attention([order({ submitReadiness: ready })]));
    expect(item!.submitState).toBe("ready");
    expect(item!.actionLabel).toBe("Review checks and send");
    expect(item!.title).toBe("Submit NVDA to the named paper broker");
  });
});

describe("Guided decision queue", () => {
  const render = (briefing: ReturnType<typeof attention>) => renderToStaticMarkup(React.createElement(GuidedDecisionQueue, { attention: briefing, onOpen: () => {} }));

  it("never renders an enabled Send Order for a blocked order", () => {
    // Two approved orders: the first is the primary decision card on Today and
    // is not repeated; the second appears exactly once, with its blocker.
    const html = render(attention([order({ submitReadiness: stale }), order({ id: 10, symbol: "AMD", submitReadiness: stale, updatedAt: now - 1 })]));
    expect(html).not.toContain("Send Order");
    expect(html).toContain("Review blocker");
    expect(html).toContain("Over the single-name exposure ceiling");
    expect(html.match(/order: Over the single-name exposure ceiling/g)).toHaveLength(1);
    expect(html).not.toContain("All Clear");
  });

  it("does not invent a symbol and does not claim all clear when the only decision is the primary card", () => {
    const html = render(attention([order({ symbol: "MSFT", submitReadiness: stale })]));
    expect(html).toBe("");
    expect(html).not.toContain("NVDA");
  });

  it("shows the all-clear only when nothing needs a decision", () => {
    expect(render(attention([]))).toContain("All Clear");
  });
});
