import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import { createMonitoringReviewRouter, type MonitoringReviewRepository } from "./monitoringReviewReceipt";
import { mergeAttentionBaseline, type ApertureAttentionBaseline } from "../../shared/apertureAttention";
import { monitoringFindingVersion } from "../../shared/monitoringFinding";

const check = { id: 1, runId: 360001, candidateId: 240003, checkType: "catalyst", checkedAt: 1_788_974_000_000, flagged: true, finding: "Illustrative unresolved catalyst", citations: ["https://example.org/fixture"] };
const input = { runId: check.runId, candidateId: check.candidateId, orderId: 12, findingId: 1, findingVersion: monitoringFindingVersion(check), requestId: "00000000-0000-4000-8000-000000000001", decision: "needs_fresh_evidence" as const, note: "Review fresh catalyst evidence before deciding." };
function fixture() {
  let snapshot: ApertureAttentionBaseline | null = { capturedAt: 10, items: [{ key: "unrelated", fingerprint: "abc", seenAt: 10 }] };
  let tail = Promise.resolve();
  const write = vi.fn(async (_user: number, next: ApertureAttentionBaseline) => { snapshot = structuredClone(next); });
  const repo: MonitoringReviewRepository = {
    readOwnedFinding: vi.fn(async (user, scope) => user === 7 && scope.orderId === 12 && scope.runId === check.runId && scope.candidateId === check.candidateId && scope.findingId === check.id ? check : null),
    readBaseline: vi.fn(async () => snapshot), writeBaseline: write,
    transaction: async (_user, action) => { const prior = tail; let release!: () => void; tail = new Promise<void>(r => { release = r; }); await prior; try { return await action(repo); } finally { release(); } },
  };
  const router = createMonitoringReviewRouter(repo);
  const caller = (id = 7, role = "capital_operator") => router.createCaller({ user: { id, role } } as TrpcContext);
  return { repo, caller, write, snapshot: () => snapshot! };
}

describe("explicit monitoring review receipts", () => {
  it("reads do not record a review, change Seen, resolve flags, or touch another finding", async () => {
    const f = fixture(); const before = structuredClone(f.snapshot());
    expect(await f.caller().list(input)).toEqual({ receipts: [] });
    expect(f.write).not.toHaveBeenCalled();
    expect(f.snapshot()).toEqual(before); expect(check.flagged).toBe(true);
  });
  it("records only the selected operator/order/finding/version, keeping Seen and resolution separate", async () => {
    const f = fixture(); const before = structuredClone(f.snapshot());
    const saved = await f.caller().record(input);
    expect(saved.receipt).toMatchObject({ userId: 7, orderId: 12, findingId: 1, findingVersion: input.findingVersion, decision: "needs_fresh_evidence", resolved: false });
    expect(f.snapshot().items).toEqual(before.items); expect(f.snapshot().capturedAt).toBe(10);
    expect((await f.caller().list(input)).receipts).toEqual([saved.receipt]);
    expect(check.flagged).toBe(true);
  });
  it("deduplicates concurrent submissions and retries without overwriting a later review", async () => {
    const f = fixture();
    const [a, b] = await Promise.all([f.caller().record(input), f.caller().record(input)]);
    expect(a.receipt).toEqual(b.receipt); expect(f.write).toHaveBeenCalledTimes(1);
    await f.caller().record({ ...input, requestId: "00000000-0000-4000-8000-000000000002", decision: "reviewed_unresolved", note: "I reviewed this concern; it remains open." });
    const retried = await f.caller().record(input);
    expect(retried.receipt).toEqual(a.receipt); expect(f.snapshot().monitoringReviews).toHaveLength(2);
  });
  it("fails closed for another user, another expression, a wrong revision, or a reused request with different intent", async () => {
    const f = fixture();
    await expect(f.caller(8).record(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(f.caller().record({ ...input, orderId: 13 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(f.caller().record({ ...input, candidateId: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(f.caller().record({ ...input, findingVersion: "v1-12345678" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.write).not.toHaveBeenCalled();
    await f.caller().record(input);
    await expect(f.caller().record({ ...input, note: "A different review message." })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.write).toHaveBeenCalledTimes(1);
  });
  it("records a close and derives `resolved` from the decision, never from the client", async () => {
    const f = fixture();
    const closed = await f.caller().record({ ...input, decision: "resolved", note: "Dealt with; the catalyst was confirmed." });
    expect(closed.receipt).toMatchObject({ decision: "resolved", resolved: true });
    // A client cannot assert resolution under a decision that does not close.
    const open = await f.caller().record({ ...input, requestId: "00000000-0000-4000-8000-000000000003",
      decision: "reviewed_unresolved", note: "Read it; still open for now.", resolved: true } as any);
    expect(open.receipt.resolved).toBe(false);
    // Closing records a receipt and nothing else: no source check is mutated.
    expect(check.flagged).toBe(true);
  });

  it("still requires a written reason to close", async () => {
    const f = fixture();
    await expect(f.caller().record({ ...input, decision: "resolved", note: "ok" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(f.write).not.toHaveBeenCalled();
  });

  it("preserves receipts through a concurrent Seen merge and rejects client-injected acknowledgments", async () => {
    const f = fixture(); const saved = await f.caller().record(input);
    const seen = { capturedAt: 20, items: [{ key: "visible", fingerprint: "v2" }], monitoringReviews: [{ ...saved.receipt, userId: 99 }] };
    expect(mergeAttentionBaseline(f.snapshot(), seen).monitoringReviews).toEqual([saved.receipt]);
    expect(mergeAttentionBaseline(null, seen).monitoringReviews).toBeUndefined();
  });
  it("enforces operator access and a deliberate review decision", async () => {
    const f = fixture();
    await expect(f.caller(7, "investor").record(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Superseded deliberately. This line asserted that "resolved" was rejected —
    // it was the test that locked in the missing verb. Closing a finding is now
    // a real decision; an unknown one is still refused.
    await expect(f.caller().record({ ...input, decision: "acknowledged" as any })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(f.caller().record({ ...input, note: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(f.write).not.toHaveBeenCalled();
  });
});
