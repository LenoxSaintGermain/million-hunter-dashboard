import { describe, expect, it } from "vitest";
import { attentionContextLabel, attentionDisclosure, canShowQuietBriefing, deriveApertureAttention, displayedAttentionBaseline, mergeAttentionBaseline, type ApertureAttentionInput } from "../../shared/apertureAttention";

const now = Date.UTC(2026, 8, 9, 14);
function input(overrides: Partial<ApertureAttentionInput> = {}): ApertureAttentionInput {
  return {
    now, mission: { decisionRunId: 1, revisionId: 2, state: "complete", title: "Test fixture", updatedAt: now }, underwriting: null,
    evidenceTasks: [], orders: [], activePlays: [], pendingReviews: [], monitoringFindings: [],
    checks: { state: "complete", asOf: now, monitoring: "on_demand" }, ...overrides,
  };
}

describe("Today disclosure and availability", () => {
  it("does not mark a collapsed no-trade result or a below-fold play as seen", () => {
    const briefing = deriveApertureAttention(input({
      underwriting: { decisionRunId: 1, revisionId: 2, state: "complete", outcome: "no_trade", updatedAt: now },
      orders: [{ id: 9, runId: 10, candidateId: 11, symbol: "MGM", status: "approved", qty: 1, filledQty: 0, dispatchError: null, updatedAt: now }],
      activePlays: [{ id: 4, symbol: "NU", state: "watching", detail: "Waiting", href: "/aperture/plays?play=4", updatedAt: now }],
    }), null);
    const primaryVersion = briefing.baseline.items.find(item => item.key === briefing.primary?.key)!;
    const onlyActuallyVisible = new Map([[primaryVersion.key, primaryVersion.fingerprint]]);
    const receipt = displayedAttentionBaseline(briefing, onlyActuallyVisible);
    expect(receipt.snapshot.items).toEqual([primaryVersion]);
    expect(receipt.snapshot.items.some(item => item.key.includes("complete"))).toBe(false);
    expect(receipt.snapshot.items.some(item => item.key === "play:4")).toBe(false);
    const resultVersion = briefing.baseline.items.find(item => item.key.includes("complete"))!;
    onlyActuallyVisible.set(resultVersion.key, resultVersion.fingerprint);
    expect(displayedAttentionBaseline(briefing, onlyActuallyVisible).snapshot.items).toHaveLength(2);
    expect(briefing.changed).toHaveLength(3); // Seeing does not change the captured comparison.
  });

  it("requires the current displayed version, not an observation of an older version", () => {
    const briefing = deriveApertureAttention(input({ draft: { section: 2, updatedAt: now } }), null);
    expect(displayedAttentionBaseline(briefing, new Map([["mission:draft", "old-version"]])).snapshot.items).toEqual([]);
  });

  it("merges only seen items and refuses to regress a newer per-item baseline", () => {
    const prior = { capturedAt: 200, items: [{ key: "one", fingerprint: "new", seenAt: 200 }, { key: "other", fingerprint: "retained", seenAt: 100 }] };
    const merged = mergeAttentionBaseline(prior, { capturedAt: 150, items: [{ key: "one", fingerprint: "old" }, { key: "third", fingerprint: "visible" }] });
    expect(merged).toEqual({ capturedAt: 200, items: [{ key: "one", fingerprint: "new", seenAt: 200 }, { key: "other", fingerprint: "retained", seenAt: 100 }, { key: "third", fingerprint: "visible", seenAt: 150 }] });
    expect(prior.items).toHaveLength(2);
  });

  it("does not duplicate primary, pending, or motion items under Current status", () => {
    const briefing = deriveApertureAttention(input({ draft: { section: 1, updatedAt: now }, activePlays: [{ id: 4, symbol: "NU", state: "watching", detail: "Waiting", href: "/aperture/plays?play=4", updatedAt: now }] }), null);
    const sections = attentionDisclosure(briefing);
    expect(sections.primary?.key).toBe("mission:draft");
    expect(sections.inMotion).toHaveLength(1);
    expect(sections.changed).toEqual([]);
  });

  it("preserves the current primary button while surfacing new urgent work outside filters", () => {
    const briefing = deriveApertureAttention(input({
      draft: { section: 2, updatedAt: now },
      monitoringFindings: [{ id: 1, orderId: 9, runId: 10, candidateId: 11, symbol: "WBD", kind: "invalidation", finding: "Recorded catalyst challenged", checkedAt: now }],
    }), null);
    expect(briefing.primary?.kind).toBe("invalidation_evidence");
    const displayed = attentionDisclosure(briefing, "mission:draft");
    expect(displayed.primary?.href).toBe("/aperture/mission");
    expect(displayed.otherCritical[0]).toMatchObject({ symbol: "WBD", kind: "invalidation_evidence" });
    expect(displayed.changed).toEqual([]);
  });

  it("keeps a receipt-less submission critical when another task is pinned, even after Seen", () => {
    const data = input({
      draft: { section: 2, updatedAt: now },
      orders: [{ id: 9, runId: 10, candidateId: 11, symbol: "MGM", status: "submitted", qty: 1, filledQty: 0, brokerOrderId: null, dispatchError: "", updatedAt: now }],
    });
    const first = deriveApertureAttention(data, null);
    const seen = deriveApertureAttention(data, first.baseline);
    const displayed = attentionDisclosure(seen, "mission:draft");
    expect(displayed.otherCritical[0]).toMatchObject({ key: "order:9:dispatch", actionLabel: "Reconcile dispatch" });
    expect(displayed.inMotion).toEqual([]);
    expect(canShowQuietBriefing(seen, false, null)).toBe(false);
  });

  it("keeps non-critical unresolved tasks available after all versions were seen", () => {
    const data = input({ draft: { section: 1, updatedAt: now }, evidenceTasks: [{ runId: 4, candidateId: 5, symbol: "NU", remaining: 1, updatedAt: now }] });
    const first = deriveApertureAttention(data, null);
    const next = attentionDisclosure(deriveApertureAttention(data, first.baseline));
    expect(next.changed).toEqual([]);
    expect(next.otherAttention.map(item => item.key)).toContain("mission:draft");
  });

  it.each(["loading", "empty", "stale", "partial", "failed"] as const)("withholds quiet presentation for %s reads", state => {
    const briefing = deriveApertureAttention(input({ checks: { state, asOf: now, monitoring: "on_demand" } }), null);
    expect(canShowQuietBriefing(briefing, false, null)).toBe(false);
  });

  it("withholds cached all-clear during refresh or failure, preserving the record", () => {
    const briefing = deriveApertureAttention(input(), null);
    expect(canShowQuietBriefing(briefing, false, null)).toBe(true);
    expect(canShowQuietBriefing(briefing, true, null)).toBe(false);
    expect(canShowQuietBriefing(briefing, false, "Failed refresh")).toBe(false);
    expect(briefing.quiet).toBe(true); // Presentation is not a persisted state mutation.
  });

  it("separates context loading, absent, failed, and retained values", () => {
    const context = { value: null, loading: true, failed: false, subject: "paper account", emptyLabel: "No account selected" };
    expect(attentionContextLabel(context)).toBe("Loading paper account…");
    expect(attentionContextLabel({ ...context, loading: false, failed: true })).toContain("unavailable");
    expect(attentionContextLabel({ ...context, loading: false })).toBe("No account selected");
    expect(attentionContextLabel({ ...context, loading: false, failed: true, value: "Alpaca Paper" })).toContain("last known value");
  });

  it("uses real monitoring provenance rather than borrowing the status read time", () => {
    const briefing = deriveApertureAttention(input({ checks: { state: "complete", asOf: now, monitoringAsOf: now - 3_600_000, monitoring: "on_demand" } }), null);
    expect(briefing.scopeNote).toContain("Status snapshot as of");
    expect(briefing.scopeNote).toContain("Last recorded monitoring check:");
    expect(briefing.scopeNote).toContain("9:00 AM");
    expect(briefing.scopeNote).toContain("10:00 AM");
    expect(briefing.nextCheckpoint?.title).not.toBe("Run updated checks");
  });

  it("uses the exact no-trade reopening condition, not a generic empty Play Desk", () => {
    const result = deriveApertureAttention(input({ underwriting: { decisionRunId: 1, revisionId: 2, state: "complete", outcome: "no_trade", updatedAt: now, reopenCondition: "Reassess when portfolio headroom is restored." } }), null);
    expect(result.nextCheckpoint).toMatchObject({ at: null, href: "/aperture/decision/1/revision/2/underwrite" });
    expect(result.nextCheckpoint?.detail).toContain("Reassess when portfolio headroom is restored");
    expect(result.nextCheckpoint?.title).not.toBe("Review monitoring");
  });

  it.each([undefined, null, "", "  "])("does not invent a checkpoint for a no-trade result with condition %s", reopenCondition => {
    const result = deriveApertureAttention(input({ underwriting: { decisionRunId: 1, revisionId: 2, state: "complete", outcome: "no_trade", updatedAt: now, reopenCondition } }), null);
    expect(result.nextCheckpoint).toBeNull();
  });

  it("does not invent a monitoring checkpoint without reviews or work in motion", () => {
    expect(deriveApertureAttention(input(), null).nextCheckpoint).toBeNull();
  });

  it("deduplicates identical findings from repeated checks without hiding material changes", () => {
    const finding = { id: 1, orderId: 9, runId: 10, candidateId: 11, symbol: "WBD", kind: "invalidation" as const, finding: "Catalyst challenged", checkedAt: now };
    const first = deriveApertureAttention(input({ monitoringFindings: [finding] }), null);
    const repeat = deriveApertureAttention(input({ monitoringFindings: [finding, { ...finding, id: 2, checkedAt: now + 1000 }] }), first.baseline);
    expect(repeat.otherCritical).toEqual([]);
    expect(repeat.changed).toEqual([]);
    expect(repeat.primary?.kind).toBe("invalidation_evidence");
  });
});
