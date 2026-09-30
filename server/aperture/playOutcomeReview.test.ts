import { describe, expect, it, vi } from "vitest";
import { createPlayOutcomeRouter, type PlayOutcomeRepository, type PlayOutcomeEvidence } from "./playOutcomeReview";
import type { TrpcContext } from "../_core/context";

const evidence: PlayOutcomeEvidence = {
  reviewId: 4, userId: 7, runId: 780001, decisionRunId: 8, revisionId: 9, orderId: 12,
  candidateId: 630001, accountId: 3,
  dueAt: 100, reviewBasis: "Review at the declared horizon.",
  orders: [{ id: 12, symbol: "RWM", side: "sell", intent: "close", status: "filled", filledQty: 10,
    filledAvgPriceCents: 2000, filledAt: 90, updatedAt: 90 }],
};
function fixture() {
  let row = { evidence: structuredClone(evidence), status: "due", result: null as Record<string, unknown> | null };
  let tail = Promise.resolve();
  const write = vi.fn(async (_user: number, _id: number, result: Record<string, unknown>) => { row.status = "resolved"; row.result = structuredClone(result); });
  const repo: PlayOutcomeRepository = {
    list: async (user, runId) => user === 7 && runId === 780001 ? [structuredClone(row)] : [],
    read: async (user, runId, id) => user === 7 && runId === 780001 && id === 4 ? structuredClone(row) : null,
    resolve: write,
    transaction: async action => { const prior = tail; let release!: () => void; tail = new Promise<void>(r => { release = r; }); await prior; try { return await action(repo); } finally { release(); } },
  };
  const router = createPlayOutcomeRouter(repo, () => 200);
  const caller = (id = 7, role = "capital_operator") => router.createCaller({ user: { id, role } } as TrpcContext);
  const input = async () => ({ runId: 780001, reviewId: 4, evidenceVersion: (await caller().list({ runId: 780001 }))[0].evidenceVersion,
    note: "Reviewed the recorded exit; performance remains unmeasured.", confirm: true as const });
  return { row, write, caller, input };
}

describe("scheduled play outcome review", () => {
  it("reads without resolving; explicitly records immutable evidence, not P&L", async () => {
    const f = fixture(); const input = await f.input(); expect(f.write).not.toHaveBeenCalled();
    const saved = await f.caller().record(input);
    expect(saved).toMatchObject({ reviewId: 4, recordedByUserId: 7, recordedAt: 200, note: input.note, evidence, pnl: null });
    expect(f.row.status).toBe("resolved");
    f.row.evidence.orders[0].filledAvgPriceCents = 9000;
    expect((f.row.result!.evidence as PlayOutcomeEvidence).orders[0].filledAvgPriceCents).toBe(2000);
  });
  it("denies wrong owner/run/review, missing confirmation and short notes", async () => {
    const f = fixture(); const input = await f.input();
    for (const [caller, arg] of [[f.caller(8), input], [f.caller(), { ...input, runId: 1 }], [f.caller(), { ...input, reviewId: 1 }]] as const)
      await expect(caller.record(arg)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(f.caller().record({ ...input, confirm: false } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(f.caller().record({ ...input, note: "ok" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(f.write).not.toHaveBeenCalled();
  });
  it("rejects changed evidence, not-yet-due, cancelled, and unfilled reviews", async () => {
    const f = fixture(); const input = await f.input();
    f.row.evidence.orders[0].updatedAt++;
    await expect(f.caller().record(input)).rejects.toMatchObject({ code: "CONFLICT" });
    f.row.evidence.dueAt = 300;
    await expect(f.caller().record(await f.input())).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    f.row.evidence.dueAt = 100; f.row.status = "cancelled";
    await expect(f.caller().record(await f.input())).rejects.toMatchObject({ code: "CONFLICT" });
    f.row.status = "due"; f.row.evidence.orders[0].status = "submitted";
    await expect(f.caller().record(await f.input())).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(f.write).not.toHaveBeenCalled();
  });
  it("serializes duplicate saves without overwriting the first receipt", async () => {
    const f = fixture(); const input = await f.input();
    const results = await Promise.allSettled([f.caller().record(input), f.caller().record(input)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(f.write).toHaveBeenCalledTimes(1);
    await expect(f.caller().record({ ...input, note: "A replacement review is forbidden." })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("rejects unauthorized roles and client-invented outcome fields", async () => {
    const f = fixture(); const input = await f.input();
    await expect(f.caller(7, "user").record(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(f.caller().record({ ...input, pnl: 10000 } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(f.write).not.toHaveBeenCalled();
  });
  it("does not report success or dismiss the review when storage fails", async () => {
    const f = fixture(); f.write.mockRejectedValueOnce(new Error("Storage unavailable"));
    await expect(f.caller().record(await f.input())).rejects.toThrow("Storage unavailable");
    expect(f.row.status).toBe("due"); expect(f.row.result).toBeNull();
  });
});
