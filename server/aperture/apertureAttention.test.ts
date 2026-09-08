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

  it("represents partial fills with filled and remaining quantities", () => {
    const result = deriveApertureAttention(base({
      mission: { decisionRunId: 42, revisionId: 7, state: "complete", title: "MGM", updatedAt: now - 8_000 },
      orders: [{ id: 9, runId: 88, candidateId: 3, symbol: "MGM", status: "submitted", qty: 3, filledQty: 1, dispatchError: null, updatedAt: now - 1_000 }],
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
    expect(result.primary?.reason).toContain("challenges");
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
});
