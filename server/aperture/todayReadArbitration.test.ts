import { describe, expect, it } from "vitest";
import { arbitrateTodayRead, deriveApertureAttention, type ApertureAttentionInput } from "../../shared/apertureAttention";

const now = Date.UTC(2026, 8, 9, 14);
const input: ApertureAttentionInput = {
  now, mission: { decisionRunId: 1, revisionId: 2, state: "complete", title: "Illustrative mission", updatedAt: now },
  underwriting: null, evidenceTasks: [], orders: [], activePlays: [], pendingReviews: [], monitoringFindings: [],
  checks: { state: "complete", asOf: now, monitoring: "on_demand" },
};

describe("Today read-state arbitration", () => {
  for (const snapshot of ["loading", "empty", "partial", "failed", "stale", "complete"] as const) {
    it.each([false, true])(`${snapshot} snapshot while transport refreshing=%s never loses dispatch or mutates records`, refreshing => {
      const briefing = deriveApertureAttention({ ...input, checks: { ...input.checks, state: snapshot }, orders: [
        { id: 8, runId: 3, candidateId: 9, symbol: "TEST", status: "submitted", qty: 2, filledQty: 1, brokerOrderId: null, updatedAt: now },
      ] }, null);
      const before = JSON.stringify(briefing);
      const result = arbitrateTodayRead({ briefing, refreshing, failed: true });
      expect(result.state).toBe(refreshing ? "refreshing" : "failed");
      expect(result.quiet).toBe(false);
      expect(result.canRecordSeen).toBe(false);
      expect(result.layout?.primary?.kind).toBe("dispatch_unresolved");
      expect(result.layout?.primary?.href).toBe("/aperture/run/3/execute?candidate=9");
      expect(result.layout?.otherCritical.some(item => item.kind === "status_unavailable")).toBe(false);
      expect(JSON.stringify(briefing)).toBe(before);
    });
  }

  it("suppresses absence-based setup while preserving actual saved draft recovery", () => {
    const empty = deriveApertureAttention({ ...input, mission: null }, null);
    expect(arbitrateTodayRead({ briefing: empty, refreshing: true, failed: false }).layout?.primary).toBeNull();
    const draft = deriveApertureAttention({ ...input, mission: null, draft: { section: 2, updatedAt: now } }, null);
    expect(arbitrateTodayRead({ briefing: draft, refreshing: true, failed: false }).layout?.primary?.actionLabel).toBe("Resume mission setup");
  });

  it("preserves scoped records when only research fails, without a global all-clear", () => {
    const briefing = deriveApertureAttention(input, null);
    const result = arbitrateTodayRead({ briefing, refreshing: false, failed: true, failedSources: ["research"] });
    expect(result.state).toBe("partial");
    expect(result.quiet).toBe(false);
    expect(result.canRecordSeen).toBe(true);
  });

  it("keeps a reading-position primary and a new critical issue visible", () => {
    const briefing = deriveApertureAttention({ ...input, draft: { section: 2, updatedAt: now }, orders: [
      { id: 8, runId: 3, candidateId: 9, symbol: "TEST", status: "submitted", qty: 2, filledQty: 0, brokerOrderId: null, updatedAt: now },
    ] }, null);
    const result = arbitrateTodayRead({ briefing, refreshing: false, failed: false, primaryKey: "mission:draft" });
    expect(result.layout?.primary?.key).toBe("mission:draft");
    expect(result.layout?.otherCritical.map(item => item.kind)).toContain("dispatch_unresolved");
  });
});
