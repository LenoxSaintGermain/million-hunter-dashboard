import { describe, expect, it } from "vitest";
import {
  deriveApertureAttention,
  type ApertureAttentionInput,
} from "../../shared/apertureAttention";

const now = Date.UTC(2026, 8, 8, 14, 42);

function base(overrides: Partial<ApertureAttentionInput> = {}): ApertureAttentionInput {
  return {
    now,
    mission: null,
    underwriting: null,
    evidenceTasks: [],
    orders: [],
    activePlays: [],
    pendingReviews: [],
    monitoringFindings: [],
    checks: { state: "complete", asOf: now - 60_000, monitoring: "on_demand" },
    ...overrides,
  };
}

describe("Capital Aperture attention briefing", () => {
  it("shows the saved gate condition without implying it was evaluated", () => {
    const review = { id: 12, kind: "gate_review" as const, dueAt: now - 1, updatedAt: now - 100,
      title: "Portfolio-gap deployment", href: "/aperture/decision/12/revision/4",
      reviewBasis: "Recheck single-name headroom after the account snapshot refresh." };
    const result = deriveApertureAttention(base({ pendingReviews: [review] }), null);
    expect(result.primary?.reason).toBe(`Check now: ${review.reviewBasis}`);
    expect(result.primary?.consequence).toContain("not proof");
    expect(deriveApertureAttention(base({ pendingReviews: [{ ...review, reviewBasis: "" }] }), null).primary?.reason)
      .toBe("Review is due, but its condition is not recorded. Inspect the saved decision before reassessing.");
  });
  const savedMission = { decisionRunId: 42, revisionId: 7, state: "complete" as const, title: "MRVL", updatedAt: now - 8_000 };

  it("keeps an accepted objective visible without advertising unsupported analysis or inventing a thesis", () => {
    const result = deriveApertureAttention(base({
      mission: { ...savedMission, title: "Compare my excess capital" },
      underwriting: { decisionRunId: 42, revisionId: 7, state: "not_started", updatedAt: now,
        unavailableReason: "Discovery-to-research validation is not available in this release." },
    }), null);
    expect(result.entryState).toBe("resume");
    expect(result.quiet).toBe(false);
    expect(result.primary).toMatchObject({ title: "Compare my excess capital", actionLabel: "Review saved objective",
      href: "/aperture/decision/42/revision/7" });
    expect(result.primary?.consequence).toContain("No research, allocation or order");
  });

  it.each(["loading", "empty", "stale", "partial", "failed"] as const)("never presents %s status as quiet or setup absence", (state) => {
    const result = deriveApertureAttention(base({ mission: savedMission, checks: { state, asOf: null, monitoring: "on_demand" } }), null);
    expect(result.quiet).toBe(false);
    expect(result.quietMessage).toBeNull();
    expect(result.primary?.kind).toBe("status_unavailable");
    expect(result.scopeNote).not.toContain("Checks last completed");
  });

  it.each([
    ["not_started", "Underwrite my mission"],
    ["running", "View discovery progress"],
    ["failed", "Review analysis status"],
    ["complete", "Review research findings"],
  ] as const)("uses the exact objective route for %s discovery without treating hypotheses as qualified plays", (state, actionLabel) => {
    const input = base({ mission: savedMission, underwriting: { workKind: "discovery", decisionRunId: 42,
      revisionId: 7, state, updatedAt: now } });
    const before = structuredClone(input);
    const result = deriveApertureAttention(input, null);
    expect(result.quiet).toBe(false);
    expect(result.primary).toMatchObject({ actionLabel, href: "/aperture/decision/42/revision/7" });
    expect(result.primary?.consequence).toContain("Existing positions are unchanged");
    expect(result.primary?.reason).not.toContain("conditional playbook");
    expect(result.primary?.reason).not.toContain("no analysis has started");
    expect(input).toEqual(before);
  });

  it("does not assert a verified quiet session without a successful status timestamp", () => {
    const result = deriveApertureAttention(base({ mission: savedMission, checks: { state: "complete", asOf: null, monitoring: "on_demand" } }), null);
    expect(result.quiet).toBe(false);
    expect(result.scopeNote).not.toContain("Checks last completed");
  });

  it("promotes a completed playbook awaiting choice, even after it was seen", () => {
    const input = base({ mission: savedMission, underwriting: { decisionRunId: 42, revisionId: 7, state: "complete", outcome: "plays", updatedAt: now } });
    const first = deriveApertureAttention(input, null);
    const seen = deriveApertureAttention(input, first.baseline);
    expect(seen.quiet).toBe(false);
    expect(seen.primary?.kind).toBe("underwriting_complete");
    expect(seen.primary?.actionLabel).toBe("Review underwriting result");
  });

  it("does not resume a closed mission or its old not-started underwriting", () => {
    const result = deriveApertureAttention(base({
      mission: { ...savedMission, lifecycle: "closed" },
      underwriting: { decisionRunId: 42, revisionId: 7, state: "not_started", updatedAt: now },
    }), null);
    expect(result.entryState).toBe("start");
    expect(result.primary?.actionLabel).toBe("Start Capital Mission");
    expect(result.changed.some(item => item.key === "underwriting:42")).toBe(false);
  });

  it("resumes a persisted draft on a new device without fabricating mission identities", () => {
    const result = deriveApertureAttention(base({ draft: { updatedAt: now, section: 2 } }), null);
    expect(result.entryState).toBe("resume");
    expect(result.primary).toMatchObject({ key: "mission:draft", title: "Resume Account & risk", href: "/aperture/mission" });
    expect(result.primary?.href).not.toContain("undefined");
    expect(result.primary?.consequence).toContain("No underwriting or order");
  });

  it("keeps active dispatch ahead of a persisted draft while retaining its resume task", () => {
    const result = deriveApertureAttention(base({ draft: { updatedAt: now, section: 1 }, orders: [{ id: 9, runId: 88, candidateId: 3, symbol: "MGM", status: "submitted", qty: 1, filledQty: 0, dispatchError: "timeout", updatedAt: now - 1_000 }] }), null);
    expect(result.entryState).toBe("check_in");
    expect(result.primary?.kind).toBe("dispatch_unresolved");
    expect(result.otherAttention.some(item => item.key === "mission:draft")).toBe(true);
  });

  it("starts at the missing mission and names what the action does not do", () => {
    const result = deriveApertureAttention(base(), null);

    expect(result.entryState).toBe("start");
    expect(result.primary).toMatchObject({
      kind: "incomplete_mission",
      actionLabel: "Start Capital Mission",
      href: "/aperture/mission",
    });
    expect(result.primary?.consequence).toContain("No order");
    expect(result.changeHeading).toBe("Current status");
  });

  it("resumes the exact persisted underwriting job instead of restarting setup", () => {
    const result = deriveApertureAttention(base({
      mission: {
        decisionRunId: 42,
        revisionId: 7,
        state: "complete",
        title: "MRVL AI infrastructure",
        updatedAt: now - 5_000,
      },
      underwriting: {
        decisionRunId: 42,
        revisionId: 7,
        state: "running",
        updatedAt: now - 4_000,
      },
    }), null);

    expect(result.entryState).toBe("resume");
    expect(result.primary).toMatchObject({
      kind: "underwriting_underway",
      actionLabel: "View underwriting progress",
      href: "/aperture/decision/42/revision/7/underwrite",
    });
  });

  it("prioritizes unresolved dispatch above routine review and never calls it broker accepted", () => {
    const result = deriveApertureAttention(base({
      mission: { decisionRunId: 42, revisionId: 7, state: "complete", title: "MGM", updatedAt: now - 8_000 },
      orders: [
        { id: 9, runId: 88, candidateId: 3, symbol: "MGM", status: "submitted", qty: 1, filledQty: 0, dispatchError: "timeout", updatedAt: now - 1_000 },
        { id: 10, runId: 89, candidateId: 4, symbol: "NU", status: "pending_approval", qty: 1, filledQty: 0, dispatchError: null, updatedAt: now - 2_000 },
      ],
      pendingReviews: [{ id: 6, kind: "play_outcome", dueAt: now - 1, updatedAt: now - 3_000, title: "IWM review", href: "/aperture/run/90" }],
    }), null);

    expect(result.entryState).toBe("check_in");
    expect(result.primary).toMatchObject({ kind: "dispatch_unresolved", actionLabel: "Reconcile dispatch" });
    expect(result.primary?.stateLabel).toBe("Dispatch unresolved");
    expect(result.primary?.stateLabel).not.toContain("accepted");
    expect(result.otherCritical.map((item) => item.kind)).toContain("ready_for_paper_review");
  });

  it.each([undefined, null, "", "   "])("elevates submitted orders with broker ID %s even without a dispatch error", (brokerOrderId) => {
    const data = base({
      orders: [{ id: 9, runId: 88, candidateId: 3, symbol: "MGM", status: "submitted", qty: 1, filledQty: 0, brokerOrderId, dispatchError: "", updatedAt: now }],
    });
    const first = deriveApertureAttention(data, null);
    const seen = deriveApertureAttention(data, first.baseline);
    expect(seen.primary).toMatchObject({ key: "order:9:dispatch", kind: "dispatch_unresolved", critical: true, actionLabel: "Reconcile dispatch", href: "/aperture/run/88/execute?candidate=3" });
    expect(seen.primary?.reason).toContain("broker order ID");
    expect(seen.primary?.consequence).toContain("Do not submit a duplicate");
    expect(seen.quiet).toBe(false);
    expect(seen.inMotion).toEqual([]);
  });

  it("keeps recorded partial-fill quantities visible in the unresolved-dispatch task", () => {
    const result = deriveApertureAttention(base({ orders: [{ id: 9, runId: 88, candidateId: 3, symbol: "MGM", status: "submitted", qty: 3, filledQty: 1, brokerOrderId: null, dispatchError: null, updatedAt: now }] }), null);
    expect(result.primary?.kind).toBe("dispatch_unresolved");
    expect(result.primary?.reason).toContain("1 filled · 2 remaining");
  });

  it("represents partial fills with filled and remaining quantities", () => {
    const result = deriveApertureAttention(base({
      mission: { decisionRunId: 42, revisionId: 7, state: "complete", title: "MGM", updatedAt: now - 8_000 },
      orders: [{ id: 9, runId: 88, candidateId: 3, symbol: "MGM", status: "submitted", qty: 3, filledQty: 1, brokerOrderId: "paper-9", dispatchError: null, updatedAt: now - 1_000 }],
    }), null);

    expect(result.inMotion[0]).toMatchObject({ stateLabel: "Partially filled" });
    expect(result.inMotion[0]?.detail).toContain("1 filled");
    expect(result.inMotion[0]?.detail).toContain("2 remaining");
  });

  it("does not turn failed or partial reads into a false all-clear", () => {
    const failed = deriveApertureAttention(base({ checks: { state: "failed", asOf: null, monitoring: "on_demand", error: "orders unavailable" } }), null);
    const partial = deriveApertureAttention(base({ checks: { state: "partial", asOf: now, monitoring: "on_demand", error: "option quotes unavailable" } }), null);

    expect(failed.quiet).toBe(false);
    expect(failed.primary?.kind).toBe("status_unavailable");
    expect(partial.scopeNote).toContain("partially available");
    expect(partial.quietMessage).toBeNull();
  });

  it("compares material fingerprints, not routine timestamp churn", () => {
    const first = deriveApertureAttention(base({
      mission: { decisionRunId: 42, revisionId: 7, state: "complete", title: "MGM", updatedAt: now - 8_000 },
      activePlays: [{ id: 4, symbol: "MGM", state: "waiting_for_trigger", detail: "Entry condition not met", href: "/aperture/run/88", updatedAt: now - 5_000 }],
    }), null);
    const second = deriveApertureAttention(base({
      mission: { decisionRunId: 42, revisionId: 7, state: "complete", title: "MGM", updatedAt: now - 2_000 },
      activePlays: [{ id: 4, symbol: "MGM", state: "waiting_for_trigger", detail: "Entry condition not met", href: "/aperture/run/88", updatedAt: now - 1_000 }],
    }), first.baseline);

    expect(second.changeHeading).toBe("Changed since your last review");
    expect(second.changed).toHaveLength(0);
  });

  it("keeps invalidation evidence visible regardless of page filters", () => {
    const result = deriveApertureAttention(base({
      mission: { decisionRunId: 42, revisionId: 7, state: "complete", title: "Portfolio", updatedAt: now - 8_000 },
      monitoringFindings: [{ id: 15, orderId: 9, runId: 88, candidateId: 3, symbol: "WBD", kind: "invalidation", finding: "New evidence challenges the catalyst.", checkedAt: now - 100 }],
      orders: [{ id: 10, runId: 89, candidateId: 4, symbol: "MRVL", status: "pending_approval", qty: 1, filledQty: 0, dispatchError: null, updatedAt: now - 2_000 }],
    }), null);

    expect(result.primary).toMatchObject({ kind: "invalidation_evidence", symbol: "WBD" });
    expect(result.primary?.reason).toContain("needs verification");
    expect(result.primary?.evidence?.finding).toBe("New evidence challenges the catalyst.");
    expect(result.primary?.evidence?.citations).toEqual([]); // An uncited flag is not verified analysis.
  });

  it("does not force active work back into setup when a mission preference is missing", () => {
    const result = deriveApertureAttention(base({
      mission: null,
      activePlays: [{
        id: 44,
        symbol: "MRVL",
        state: "waiting_for_trigger",
        detail: "Entry condition not met",
        href: "/aperture/plays",
        updatedAt: now,
      }],
    }), null);

    expect(result.entryState).toBe("check_in");
    expect(result.primary).toBeNull();
    expect(result.inMotion[0]?.symbol).toBe("MRVL");
  });

  it("shows a completed no-trade underwriting receipt without manufacturing urgency", () => {
    const result = deriveApertureAttention(base({
      mission: { decisionRunId: 42, revisionId: 7, state: "complete", title: "MRVL", updatedAt: now - 8_000 },
      underwriting: {
        decisionRunId: 42,
        revisionId: 7,
        state: "complete",
        outcome: "no_trade",
        resultSummary: "No play clears the current portfolio headroom.",
        reopenCondition: "Reassess after open risk falls.",
        updatedAt: now - 1_000,
      },
    }), null);

    expect(result.primary).toBeNull();
    expect(result.quiet).toBe(true);
    expect(result.changed[0]).toMatchObject({
      kind: "underwriting_complete",
      actionLabel: "Review no-trade result",
      href: "/aperture/decision/42/revision/7/underwrite",
    });
  });

  it("keeps unresolved dispatch primary while retaining a completed underwriting update", () => {
    const result = deriveApertureAttention(base({
      mission: { decisionRunId: 42, revisionId: 7, state: "complete", title: "Portfolio", updatedAt: now - 8_000 },
      underwriting: {
        decisionRunId: 42,
        revisionId: 7,
        state: "complete",
        outcome: "no_trade",
        updatedAt: now - 2_000,
      },
      orders: [{ id: 9, runId: 88, candidateId: 3, symbol: "MGM", status: "submitted", qty: 1, filledQty: 0, dispatchError: "timeout", updatedAt: now - 1_000 }],
    }), null);

    expect(result.primary?.kind).toBe("dispatch_unresolved");
    expect(result.changed.some((item) => "kind" in item && item.kind === "underwriting_complete")).toBe(true);
  });
});
