import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { users, portfolioAccounts, capitalTheses, apertureRuns, apertureCandidates, brokerOrders,
  apertureExecutionEvidence, apertureCapitalEvents, apertureCapitalClaims } from "../../drizzle/schema";
import { requireIsolatedIntegrationDatabase } from "../../scripts/isolated-integration-identity.mjs";
import type { OrderExecutionReceipt } from "./brokers/orderExecutions";
requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;
const NOW = Date.UTC(2026, 8, 10, 15), external = "illustrative-paper";
const brokerOrderId = "00000000-0000-4000-8000-000000000001";
const receipt = (): OrderExecutionReceipt => ({ provider: "alpaca_paper", externalAccountId: external, brokerOrderId,
  observedAt: NOW, coverage: "complete_order_execution_query", feesVerified: false,
  costBasisVerified: false, proceedsAvailabilityVerified: false,
  executions: [{ id: "illustrative::fill", activity_type: "FILL", order_id: brokerOrderId, symbol: "TEST", side: "sell",
    type: "fill", qty: "1", cum_qty: "1", leaves_qty: "0", price: "118", transaction_time: "2026-09-10T14:00:00Z" }] });

describe("persisted execution evidence — isolated paper lifecycle", () => {
  let db: Db, service: typeof import("./executionEvidence"), userId: number, thesisId: number;
  let selection: { accountId: number; runId: number; candidateId: number; orderId: number };
  let before: unknown;
  const network = vi.fn(() => { throw new Error("Live provider forbidden in this fixture"); });
  const stableRows = async () => ({
    orders: await db.select().from(brokerOrders).where(eq(brokerOrders.userId, userId)),
    accounts: await db.select().from(portfolioAccounts).where(eq(portfolioAccounts.userId, userId)),
    events: await db.select().from(apertureCapitalEvents).where(eq(apertureCapitalEvents.userId, userId)),
    claims: await db.select().from(apertureCapitalClaims).where(eq(apertureCapitalClaims.userId, userId)),
  });
  const rows = () => db.select().from(apertureExecutionEvidence).where(eq(apertureExecutionEvidence.userId, userId));
  const refresh = (provider = vi.fn(async () => receipt()), requestId = randomUUID()) =>
    service.refreshExecutionEvidence(db, userId, { ...selection, requestId }, provider);
  beforeAll(async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW); vi.stubGlobal("fetch", network);
    db = (await (await import("../db")).getDb())!; service = await import("./executionEvidence");
  });
  beforeEach(async () => {
    network.mockClear();
    const [user] = await db.insert(users).values({ openId: `uat_execution_${randomUUID()}`, name: "Illustrative execution owner", role: "capital_operator" }); userId = Number(user.insertId);
    const [account] = await db.insert(portfolioAccounts).values({ userId, label: "Illustrative paper", brokerId: "alpaca_paper",
      externalAccountId: external, isPaper: true, createdAt: NOW - 1000, updatedAt: NOW - 1000 });
    const accountId = Number(account.insertId);
    const [thesis] = await db.insert(capitalTheses).values({ userId, name: "Illustrative source", rawText: "Not real market evidence", status: "review", createdAt: NOW - 1000, updatedAt: NOW - 1000 }); thesisId = Number(thesis.insertId);
    const [run] = await db.insert(apertureRuns).values({ userId, accountId, thesisId, deployableCapitalCents: 100_000, status: "completed", createdAt: NOW - 1000 });
    const runId = Number(run.insertId);
    const [candidate] = await db.insert(apertureCandidates).values({ runId, symbol: "TEST", role: "core", createdAt: NOW - 1000 });
    const candidateId = Number(candidate.insertId);
    const [order] = await db.insert(brokerOrders).values({ userId, accountId, runId, candidateId, symbol: "TEST", side: "sell", intent: "close",
      status: "filled", brokerOrderId, qty: 1, filledQty: 1, filledAvgPriceCents: 11_800, createdAt: NOW - 1000, updatedAt: NOW - 500 });
    selection = { accountId, runId, candidateId, orderId: Number(order.insertId) }; before = await stableRows();
  });
  afterEach(async () => {
    try { expect(network).not.toHaveBeenCalled(); expect(await stableRows()).toEqual(before); }
    finally {
      await db.delete(apertureExecutionEvidence).where(eq(apertureExecutionEvidence.userId, userId));
      await db.delete(brokerOrders).where(eq(brokerOrders.userId, userId));
      await db.delete(apertureCandidates).where(eq(apertureCandidates.runId, selection.runId));
      await db.delete(apertureRuns).where(eq(apertureRuns.userId, userId));
      await db.delete(capitalTheses).where(eq(capitalTheses.id, thesisId));
      await db.delete(portfolioAccounts).where(eq(portfolioAccounts.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
    }
  });
  afterAll(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it("ordinary reads neither ingest nor fabricate an empty successful receipt", async () => {
    expect(await service.readExecutionEvidence(db, userId, selection)).toMatchObject({ latest: null, lastSuccessful: null, reconciliation: { state: "not_measured", grossProceedsUsd: null }, gainsVerified: false, availableCapitalCents: null });
    expect(await rows()).toEqual([]);
  });
  it("lists exact owned closing sources without returning profit or changing records", async () => {
    const list = await service.listExecutionSources(db, userId, {});
    expect(list.sources).toHaveLength(1); expect(list.sources[0]).toMatchObject(selection);
    expect(list.gainsVerified).toBe(false); expect(list.nextCursor).toBeNull();
    expect(await service.listExecutionSources(db, userId + 999_999, {})).toEqual({ sources: [], nextCursor: null, gainsVerified: false });
    expect(await rows()).toEqual([]);
  });
  it("paginates closing orders without overlap and excludes opening orders", async () => {
    const [original] = await db.select().from(brokerOrders).where(eq(brokerOrders.id, selection.orderId));
    const { id: _id, ...values } = original;
    await db.insert(brokerOrders).values(Array.from({ length: 51 }, () => ({ ...values, brokerOrderId: randomUUID() })));
    await db.insert(brokerOrders).values({ ...values, brokerOrderId: randomUUID(), intent: "open", side: "buy" });
    before = await stableRows();
    const page1 = await service.listExecutionSources(db, userId, {});
    const page2 = await service.listExecutionSources(db, userId, { beforeId: page1.nextCursor! });
    expect(page1.sources).toHaveLength(50); expect(page2.sources).toHaveLength(2); expect(page2.nextCursor).toBeNull();
    expect(new Set([...page1.sources, ...page2.sources].map(row => row.orderId)).size).toBe(52);
    expect(await rows()).toEqual([]);
  });
  it("persists an exact execution receipt and retries without additional provider work", async () => {
    const provider = vi.fn(async () => receipt()), requestId = randomUUID();
    const first = await refresh(provider, requestId);
    expect(first.lastSuccessful?.receipt).toEqual(receipt());
    expect(first.reconciliation).toMatchObject({ state: "matched", grossProceedsUsd: "118", filledQuantity: "1", orderFullyFilled: true });
    const saved = await rows();
    expect(saved).toHaveLength(1); expect(saved[0].recordHash).toMatch(/^[a-f0-9]{64}$/);
    expect(await refresh(provider, requestId)).toEqual(first);
    expect(provider).toHaveBeenCalledTimes(1); expect(await rows()).toEqual(saved);
    expect(first.gainsVerified).toBe(false); expect(first.availableCapitalCents).toBeNull();
  });
  it("preserves last successful evidence after an explicit later refresh fails", async () => {
    const first = await refresh();
    const second = await refresh(vi.fn(async () => { throw new Error("sensitive-provider-detail"); }));
    expect(second.latest?.state).toBe("failed");
    expect(second.lastSuccessful).toEqual(first.lastSuccessful);
    expect(JSON.stringify(second)).not.toContain("sensitive-provider-detail");
    expect(await rows()).toHaveLength(2);
  });
  it("a concurrent repeated request observes pending instead of dispatching twice", async () => {
    let release!: (value: OrderExecutionReceipt) => void, started!: () => void;
    const start = new Promise<void>(resolve => { started = resolve; });
    const hold = new Promise<OrderExecutionReceipt>(resolve => { release = resolve; });
    const provider = vi.fn(async () => { started(); return hold; }), requestId = randomUUID();
    const pending = refresh(provider, requestId); await start;
    try {
      expect((await refresh(provider, requestId)).latest?.state).toBe("pending");
      await expect(refresh(provider, randomUUID())).rejects.toThrow("unconfirmed");
      expect(provider).toHaveBeenCalledTimes(1);
    } finally { release(receipt()); }
    expect((await pending).latest?.state).toBe("complete"); expect(await rows()).toHaveLength(1);
  });
  it("discard cannot change completed evidence, another owner, or an unknown request", async () => {
    const requestId = randomUUID(); await refresh(undefined, requestId);
    const prior = await rows();
    await service.abandonExecutionEvidence(db, userId, { ...selection, requestId });
    expect(await rows()).toEqual(prior);
    await expect(service.abandonExecutionEvidence(db, userId + 999_999, { ...selection, requestId })).rejects.toThrow();
    await expect(service.abandonExecutionEvidence(db, userId, { ...selection, requestId: randomUUID() })).rejects.toThrow("not found");
    expect(await rows()).toEqual(prior);
  });
  it.each(["accountId", "runId", "candidateId", "orderId"] as const)("rejects mismatched %s before provider work", async key => {
    const provider = vi.fn(async () => receipt());
    await expect(service.refreshExecutionEvidence(db, userId, { ...selection, [key]: 999_999_999, requestId: randomUUID() }, provider)).rejects.toThrow();
    expect(provider).not.toHaveBeenCalled(); expect(await rows()).toEqual([]);
  });
  it("explicitly abandons an exact pending refresh, fences its late reply, and permits a new attempt", async () => {
    let release!: (value: OrderExecutionReceipt) => void, started!: () => void;
    const start = new Promise<void>(resolve => { started = resolve; });
    const hold = new Promise<OrderExecutionReceipt>(resolve => { release = resolve; });
    const requestId = randomUUID();
    const pending = refresh(vi.fn(async () => { started(); return hold; }), requestId);
    // Attach the rejection handler immediately: the late worker must not win.
    const outcome = pending.catch(error => error);
    await start;
    try {
      const abandoned = await service.abandonExecutionEvidence(db, userId, { ...selection, requestId });
      expect(abandoned.latest?.state).toBe("failed");
      expect(abandoned.latest?.failureCode).toBe("execution_abandoned");
      expect(await service.abandonExecutionEvidence(db, userId, { ...selection, requestId })).toEqual(abandoned);
      expect((await refresh()).latest?.state).toBe("complete");
    } finally { release(receipt()); }
    expect(await outcome).toBeInstanceOf(Error);
    const saved = await rows(); expect(saved).toHaveLength(2);
    expect(saved.find(row => row.requestId === requestId)?.failureCode).toBe("execution_abandoned");
    expect((await service.readExecutionEvidence(db, userId, selection)).gainsVerified).toBe(false);
  });
  it("another owner cannot read or refresh the source", async () => {
    const provider = vi.fn(async () => receipt());
    await expect(service.readExecutionEvidence(db, userId + 999_999, selection)).rejects.toThrow();
    await expect(service.refreshExecutionEvidence(db, userId + 999_999, { ...selection, requestId: randomUUID() }, provider)).rejects.toThrow();
    expect(provider).not.toHaveBeenCalled(); expect(await rows()).toEqual([]);
  });
  it("does not persist provider claims of verified fees or wrong account", async () => {
    const result = await refresh(vi.fn(async () => ({ ...receipt(), feesVerified: true } as unknown as OrderExecutionReceipt)));
    expect(result.latest?.state).toBe("failed"); expect(result.lastSuccessful).toBeNull();
    const other = await refresh(vi.fn(async () => ({ ...receipt(), externalAccountId: "other" })));
    expect(other.latest?.state).toBe("failed"); expect(other.lastSuccessful).toBeNull();
  });
  it("detects altered receipt content rather than presenting it as trusted", async () => {
    await refresh(); const [saved] = await rows();
    await db.update(apertureExecutionEvidence).set({ receipt: { ...receipt(), executions: [] } }).where(eq(apertureExecutionEvidence.id, saved.id));
    await expect(service.readExecutionEvidence(db, userId, selection)).rejects.toThrow("integrity");
  });
});
