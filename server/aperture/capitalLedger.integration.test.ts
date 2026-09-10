import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import http from "node:http";
import https from "node:https";
import { users, portfolioAccounts, capitalTheses, apertureRuns, apertureCandidates, brokerOrders, monitoringChecks } from "../../drizzle/schema";
import { apertureCapitalEvents as events, apertureCapitalClaims as claims } from "../../drizzle/apertureCapitalLedgerSchema";
import { capitalLedgerReceiptSchema } from "../../shared/capitalStrategy";
import { claimCapital, readCapitalLedger, recordCapitalEvent, transitionCapitalClaim, paperOrderAllocationId, reconcilePaperOrderClaim } from "./capitalLedger";
import { requireIsolatedIntegrationDatabase } from "../../scripts/isolated-integration-identity.mjs";

// Main must export the new schema and add this file to the approved integration
// lane. This file never provisions, migrates, or seeds any existing database.
requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;
const NOW = Date.UTC(2026, 8, 9, 19);
function latch() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

describe("capital ledger — actual disposable database transactions", () => {
  let db: Db;
  let ownerIds: number[] = [], runIds: number[] = [];
  let fixtures: Array<{ userId: number; accountId: number; liveAccountId: number }> = [];
  let baseline: unknown;
  const network = vi.fn(() => { throw new Error("Provider/broker calls forbidden in ledger integration tests"); });
  const eventInput = (f = fixtures[0]) => ({ accountId: f.accountId, sourceId: "source:declaration-1", sourceKey: "declaration:1", capitalEventId: "declaration:1", sourceKind: "operator_declared_excess", currency: "USD", amountCents: 120_000 });
  const target = (f = fixtures[0]) => ({ accountId: f.accountId, capitalEventId: "declaration:1" });
  const claimInput = (allocationId = "allocation:1", amountCents = 80_000) => ({ ...target(), allocationId, amountCents });
  const record = (input = eventInput(), f = fixtures[0]) => db.transaction(tx => recordCapitalEvent(tx, f.userId, input));
  const read = (f = fixtures[0]) => db.transaction(tx => readCapitalLedger(tx, f.userId, target(f)));
  const reserve = (input = claimInput(), f = fixtures[0]) => db.transaction(tx => claimCapital(tx, f.userId, input));
  const move = (expectedState: string, nextState: string, allocationId = "allocation:1") => db.transaction(tx => transitionCapitalClaim(tx, fixtures[0].userId, { ...target(), allocationId, expectedState, nextState }));
  const ledgerRows = async () => ({
    events: await db.select().from(events).where(inArray(events.userId, ownerIds)).orderBy(events.id),
    claims: await db.select().from(claims).where(inArray(claims.userId, ownerIds)).orderBy(claims.id),
  });
  const unaffected = async () => ({
    orders: await db.select().from(brokerOrders).where(inArray(brokerOrders.userId, ownerIds)).orderBy(brokerOrders.id),
    checks: await db.select().from(monitoringChecks).where(inArray(monitoringChecks.runId, runIds)).orderBy(monitoringChecks.id),
    accounts: await db.select().from(portfolioAccounts).where(inArray(portfolioAccounts.userId, ownerIds)).orderBy(portfolioAccounts.id),
    runs: await db.select().from(apertureRuns).where(inArray(apertureRuns.userId, ownerIds)).orderBy(apertureRuns.id),
  });

  beforeAll(async () => {
    requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    vi.stubGlobal("fetch", network);
    vi.spyOn(http, "request").mockImplementation(network); vi.spyOn(http, "get").mockImplementation(network);
    vi.spyOn(https, "request").mockImplementation(network); vi.spyOn(https, "get").mockImplementation(network);
    const { getDb } = await import("../db");
    db = (await getDb())!;
    if (!db) throw new Error("Disposable DB unavailable; no fallback target permitted");
    // Fails visibly if main has not integrated the schema; no CREATE fallback.
    await db.select().from(events).limit(0);
    await db.select().from(claims).limit(0);
  });
  beforeEach(async () => {
    ownerIds = []; runIds = []; fixtures = []; baseline = null; network.mockClear();
    for (let i = 0; i < 2; i++) {
      const openId = `uat_ledger_${randomUUID()}`;
      expect(users.openId.getSQLType()).toBe("varchar(64)");
      expect(openId.length).toBeLessThanOrEqual(64);
      const [owner] = await db.insert(users).values({ openId, name: "Illustrative ledger owner", role: "capital_operator" });
      const userId = Number(owner.insertId); ownerIds.push(userId);
      const [account] = await db.insert(portfolioAccounts).values({ userId, label: "Illustrative named paper account", brokerId: "manual", isPaper: true, cashCents: 500_000, equityValueCents: 1_000_000, createdAt: NOW, updatedAt: NOW });
      const [live] = await db.insert(portfolioAccounts).values({ userId, label: "Illustrative unsupported live sentinel", brokerId: "manual", isPaper: false, createdAt: NOW, updatedAt: NOW });
      const accountId = Number(account.insertId);
      fixtures.push({ userId, accountId, liveAccountId: Number(live.insertId) });
      const [thesis] = await db.insert(capitalTheses).values({ userId, name: "Illustrative sentinel thesis", rawText: "Illustrative sentinel only, never a market recommendation", status: "review", createdAt: NOW, updatedAt: NOW });
      const [run] = await db.insert(apertureRuns).values({ userId, accountId, thesisId: Number(thesis.insertId), deployableCapitalCents: 50_000, status: "completed", createdAt: NOW });
      const runId = Number(run.insertId); runIds.push(runId);
      const [candidate] = await db.insert(apertureCandidates).values({ runId, symbol: "PWR", role: "core", createdAt: NOW });
      const candidateId = Number(candidate.insertId);
      await db.insert(brokerOrders).values({ userId, accountId, runId, candidateId, symbol: "PWR", side: "buy", intent: "open", status: "pending_approval", qty: 1, reason: "Illustrative unchanged sentinel; not a broker instruction", createdAt: NOW, updatedAt: NOW });
      await db.insert(monitoringChecks).values({ runId, candidateId, symbol: "PWR", checkType: "catalyst", flagged: true, finding: "Illustrative unresolved sentinel", checkedAt: NOW, createdAt: NOW });
    }
    baseline = await unaffected();
  });
  afterEach(async () => {
    if (!db || !ownerIds.length) return;
    try {
      expect(network).not.toHaveBeenCalled();
      if (baseline) expect(await unaffected()).toEqual(baseline);
    } finally {
      await db.transaction(async tx => {
        await tx.delete(claims).where(inArray(claims.userId, ownerIds));
        await tx.delete(events).where(inArray(events.userId, ownerIds));
        if (runIds.length) await tx.delete(monitoringChecks).where(inArray(monitoringChecks.runId, runIds));
        await tx.delete(brokerOrders).where(inArray(brokerOrders.userId, ownerIds));
        if (runIds.length) await tx.delete(apertureCandidates).where(inArray(apertureCandidates.runId, runIds));
        await tx.delete(apertureRuns).where(inArray(apertureRuns.userId, ownerIds));
        await tx.delete(capitalTheses).where(inArray(capitalTheses.userId, ownerIds));
        await tx.delete(portfolioAccounts).where(inArray(portfolioAccounts.userId, ownerIds));
        await tx.delete(users).where(inArray(users.id, ownerIds));
      });
    }
  });
  afterAll(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("reloads persisted event/claims and distinguishes checked-empty from missing without read mutations", async () => {
    expect(await read()).toEqual({ status: "missing", event: null, receipt: null });
    const event = await record();
    const beforeRead = await ledgerRows();
    const empty = await read();
    expect(empty.event).toEqual(event.event);
    expect(empty.receipt).toMatchObject({ status: "complete", sourceId: eventInput().sourceId, accountId: String(fixtures[0].accountId), allocationClaims: [], observedCapitalEventIds: [target().capitalEventId], asOf: NOW });
    expect(await ledgerRows()).toEqual(beforeRead);
    await reserve(claimInput("allocation:1", 120_000));
    const reloaded = await read();
    expect(capitalLedgerReceiptSchema.safeParse(reloaded.receipt).success).toBe(true);
    expect(reloaded.receipt?.allocationClaims).toEqual([{ allocationId: "allocation:1", capitalEventId: target().capitalEventId, amountCents: 120_000, state: "pending" }]);
    expect((await ledgerRows()).events).toEqual(beforeRead.events);
  });

  it("deduplicates concurrent same-source registration and rejects alias/amount conflicts", async () => {
    const results = await Promise.all([record(), record(), record()]);
    expect(results.filter(result => !result.duplicate)).toHaveLength(1);
    expect(new Set(results.map(result => result.event.id)).size).toBe(1);
    const conflicting = await Promise.allSettled([
      record({ ...eventInput(), sourceId: "source:alias", capitalEventId: "alias:event" }),
      record({ ...eventInput(), amountCents: 240_000 }),
    ]);
    for (const result of conflicting) {
      expect(result.status).toBe("rejected");
      expect((result as PromiseRejectedResult).reason).toMatchObject({ code: "SOURCE_CONFLICT" });
    }
    expect((await ledgerRows()).events).toHaveLength(1);
  });

  it("serializes competing claims on separate real connections so the second cannot overclaim", async () => {
    await record();
    const held = latch(), release = latch(), secondStarted = latch();
    const connections: number[] = [];
    const first = db.transaction(async tx => {
      const [rows] = await tx.execute(sql`SELECT CONNECTION_ID() AS connectionId`);
      connections.push(Number((rows as any)[0].connectionId));
      const result = await claimCapital(tx, fixtures[0].userId, claimInput("allocation:first", 80_000));
      held.resolve();
      await release.promise;
      return result;
    });
    // Rejecting setup cannot strand the barrier or keep another transaction open.
    const heldOrFailure = Promise.race([held.promise, first.then(() => undefined)]);
    await heldOrFailure;
    const second = db.transaction(async tx => {
      const [rows] = await tx.execute(sql`SELECT CONNECTION_ID() AS connectionId`);
      connections.push(Number((rows as any)[0].connectionId));
      secondStarted.resolve();
      return claimCapital(tx, fixtures[0].userId, claimInput("allocation:second", 80_000));
    });
    try { await Promise.race([secondStarted.promise, second.then(() => undefined)]).catch(() => undefined); }
    finally { release.resolve(); }
    const outcomes = await Promise.allSettled([first, second]);
    expect(new Set(connections).size).toBe(2);
    expect(outcomes[0].status).toBe("fulfilled");
    expect(outcomes[1]).toMatchObject({ status: "rejected", reason: { code: "CAPACITY_EXCEEDED" } });
    expect((await read()).receipt?.allocationClaims).toHaveLength(1);
    await reserve(claimInput("allocation:remainder", 40_000));
    expect((await read()).receipt?.allocationClaims.reduce((sum, row) => sum + row.amountCents, 0)).toBe(120_000);
  });

  it("deduplicates concurrent allocation retries and rejects changed amount/event reuse", async () => {
    await record();
    const results = await Promise.all([reserve(), reserve(), reserve()]);
    expect(results.filter(result => !result.duplicate)).toHaveLength(1);
    expect(new Set(results.map(result => result.claim.id)).size).toBe(1);
    await expect(reserve(claimInput("allocation:1", 1))).rejects.toMatchObject({ code: "CLAIM_CONFLICT" });
    await record({ ...eventInput(), sourceId: "source:2", sourceKey: "declaration:2", capitalEventId: "declaration:2" });
    await expect(reserve({ ...claimInput(), capitalEventId: "declaration:2" })).rejects.toMatchObject({ code: "CLAIM_CONFLICT" });
    expect((await ledgerRows()).claims).toHaveLength(1);
  });

  it("rolls back event/claim writes with the caller transaction and frees no phantom capacity", async () => {
    await expect(db.transaction(async tx => {
      await recordCapitalEvent(tx, fixtures[0].userId, eventInput());
      await claimCapital(tx, fixtures[0].userId, claimInput());
      throw new Error("Illustrative caller rollback");
    })).rejects.toThrow("Illustrative caller rollback");
    expect(await ledgerRows()).toEqual({ events: [], claims: [] });
    await record();
    await expect(db.transaction(async tx => {
      await claimCapital(tx, fixtures[0].userId, claimInput("rolled-back", 120_000));
      throw new Error("Illustrative proposal transaction failed");
    })).rejects.toThrow("Illustrative proposal transaction failed");
    expect((await read()).receipt?.allocationClaims).toEqual([]);
    await reserve(claimInput("retry-after-rollback", 120_000));
  });

  it("enforces owner/account scope and never changes unrelated orders/checks/balances", async () => {
    await record(); await reserve();
    const before = await ledgerRows();
    for (const fn of [readCapitalLedger, claimCapital, transitionCapitalClaim]) {
      const input = fn === readCapitalLedger ? target() : fn === claimCapital ? claimInput() : { ...target(), allocationId: "allocation:1", expectedState: "pending", nextState: "released" };
      await expect(db.transaction(async tx => { await fn(tx, fixtures[1].userId, input); })).rejects.toMatchObject({ code: "ACCOUNT_UNAVAILABLE" });
    }
    await expect(record(eventInput(), fixtures[1])).rejects.toMatchObject({ code: "ACCOUNT_UNAVAILABLE" });
    await expect(record({ ...eventInput(), accountId: fixtures[0].liveAccountId })).rejects.toMatchObject({ code: "ACCOUNT_UNAVAILABLE" });
    expect(await read(fixtures[1])).toEqual({ status: "missing", event: null, receipt: null });
    expect(await ledgerRows()).toEqual(before);
    // Same origin text for a different owner is a distinct authorized namespace.
    await record(eventInput(fixtures[1]), fixtures[1]);
    expect((await ledgerRows()).events).toHaveLength(2);
  });

  it("unknown source proof permits only a ledger-coverage receipt, never a funds claim", async () => {
    const saved = await record({ ...eventInput(), sourceKind: "realized_gains", amountCents: 120_000 });
    expect(saved.event.proofBasis).toBe("unknown");
    await expect(reserve()).rejects.toMatchObject({ code: "SOURCE_PROOF_MISSING" });
    expect((await read()).receipt?.allocationClaims).toEqual([]);
    await expect(record({ ...eventInput(), proofBasis: "verified" } as any)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect((await ledgerRows()).events[0]).toEqual(saved.event);
  });

  it("releases only explicitly, counts consumed amounts, and does not revive an old request", async () => {
    await record(); await reserve();
    const committed = await move("pending", "committed");
    expect((await move("pending", "committed")).duplicate).toBe(true);
    await move("committed", "consumed");
    await expect(move("consumed", "released")).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(reserve(claimInput("too-much", 40_001))).rejects.toMatchObject({ code: "CAPACITY_EXCEEDED" });
    await reserve(claimInput("remaining", 40_000));
    await move("pending", "released", "remaining");
    expect((await reserve(claimInput("remaining", 40_000))).claim.state).toBe("released");
    await reserve(claimInput("replacement", 40_000));
    const receipt = (await read()).receipt!;
    expect(receipt.allocationClaims.find(row => row.allocationId === committed.claim.allocationId)?.state).toBe("consumed");
    expect(receipt.allocationClaims.filter(row => row.state !== "released").reduce((sum, row) => sum + row.amountCents, 0)).toBe(120_000);
  });

  it.each(["submitted", "filled"] as const)("stale operator rejection preserves a competing %s order in the real database", async status => {
    const before = await unaffected();
    const order = before.orders.find(row => row.userId === fixtures[0].userId)!;
    const target = requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
    const mysql = await import("mysql2/promise");
    const connection = await mysql.createConnection(target.toString());
    const database = await import("../db");
    let injected = false;
    const proxied = new Proxy(db, { get(object, key) {
      if (key === "update") return (table: Parameters<Db["update"]>[0]) => ({ set: (values: any) => ({ where: async (predicate: any) => {
        if (table !== brokerOrders || injected) throw new Error("Unexpected rejection write");
        injected = true;
        // Separate connection commits after rejectOrder's SELECT and before its
        // UPDATE. This is deterministic interleaving, not a broker submission.
        await connection.execute("UPDATE broker_orders SET status = ? WHERE id = ? AND user_id = ?", [status, order.id, order.userId]);
        return db.update(table).set(values).where(predicate);
      } }) });
      const member = Reflect.get(object, key);
      return typeof member === "function" ? member.bind(object) : member;
    }});
    const read = vi.spyOn(database, "getDb").mockResolvedValue(proxied);
    try {
      const { rejectOrder } = await import("./orderFlow");
      await expect(rejectOrder(order.id, order.userId, "Illustrative stale rejection")).rejects.toThrow(/changed/);
      expect(injected).toBe(true);
      baseline = { ...before, orders: before.orders.map(row => row.id === order.id ? { ...row, status } : row) };
      expect(await unaffected()).toEqual(baseline);
      expect(await ledgerRows()).toEqual({ events: [], claims: [] });
    } finally { read.mockRestore(); await connection.end(); }
  });

  it.each([false, true])("persists partial fills without overwriting a competing poll (race=%s)", async race => {
    const initial = await unaffected();
    const order = initial.orders.find(row => row.userId === fixtures[0].userId)!;
    await db.update(brokerOrders).set({ status: "submitted", brokerOrderId: "illustrative-partial-order",
      filledQty: 0, filledAvgPriceCents: null }).where(eq(brokerOrders.id, order.id));
    const before = await unaffected();
    const brokers = await import("./brokers/index");
    const getOrder = vi.fn(async () => {
      if (race) await db.update(brokerOrders).set({ filledQty: 0.75, filledAvgPriceCents: 1000 }).where(eq(brokerOrders.id, order.id));
      return { status: "pending", brokerOrderId: "illustrative-partial-order", filledQty: 0.5, filledAvgPriceCents: 1000 };
    });
    const broker = vi.spyOn(brokers, "brokerFor").mockReturnValue({ available: () => true, getOrder } as any);
    try {
      const { mirrorFills } = await import("./orderFlow");
      expect(await mirrorFills(order.userId)).toBe(race ? 0 : 1);
      baseline = { ...before, orders: before.orders.map(row => row.id === order.id
        ? { ...row, filledQty: race ? 0.75 : 0.5, filledAvgPriceCents: 1000, updatedAt: NOW } : row) };
      expect(await unaffected()).toEqual(baseline);
      if (!race) expect(await mirrorFills(order.userId)).toBe(0);
      expect(await unaffected()).toEqual(baseline);
      expect(await ledgerRows()).toEqual({ events: [], claims: [] });
      expect(getOrder).toHaveBeenCalledTimes(race ? 1 : 2);
    } finally { broker.mockRestore(); }
  });

  it.each([
    { label: "awaiting approval", order: { status: "pending_approval" }, state: "pending", uncertain: false },
    { label: "approved not sent", order: { status: "approved" }, state: "pending", uncertain: false },
    { label: "local rejection", order: { status: "rejected" }, state: "released", uncertain: false },
    { label: "dispatch response lost", order: { status: "submitted", clientOrderId: "illustrative-client", dispatchError: "Illustrative timeout" }, state: "committed", uncertain: true },
    { label: "accepted unfilled", order: { status: "submitted", brokerOrderId: "illustrative-broker", filledQty: 0 }, state: "committed", uncertain: false },
    { label: "partial in motion", order: { status: "submitted", brokerOrderId: "illustrative-broker", filledQty: 0.5 }, state: "committed", uncertain: false },
    { label: "filled", order: { status: "filled", brokerOrderId: "illustrative-broker", filledQty: 1 }, state: "consumed", uncertain: false },
    { label: "cancelled partial", order: { status: "cancelled", brokerOrderId: "illustrative-broker", filledQty: 0.5 }, state: "consumed", uncertain: false },
    { label: "broker zero-fill rejection", order: { status: "rejected", brokerOrderId: "illustrative-broker", filledQty: 0 }, state: "released", uncertain: false },
    { label: "terminal fill unknown", order: { status: "rejected", brokerOrderId: "illustrative-broker", filledQty: null }, state: "committed", uncertain: true },
    { label: "terminal transport ambiguity", order: { status: "rejected", brokerOrderId: "illustrative-broker", filledQty: 0, dispatchError: "Illustrative uncertainty" }, state: "committed", uncertain: true },
  ])("reconciles $label without creating orders or recycling consumed money", async scenario => {
    const order = (await unaffected()).orders.find(row => row.userId === fixtures[0].userId)!;
    await record();
    await reserve(claimInput(paperOrderAllocationId(order.id)));
    await db.update(brokerOrders).set(scenario.order as any).where(eq(brokerOrders.id, order.id));
    baseline = await unaffected(); // Only the explicit fixture transition above.
    const result = await db.transaction(tx => reconcilePaperOrderClaim(tx, order.userId, order.id));
    expect(result).toMatchObject({ status: "bound", state: scenario.state, needsReconciliation: scenario.uncertain });
    const after = await ledgerRows();
    expect(after.claims).toHaveLength(1);
    expect(after.claims[0]).toMatchObject({ amountCents: 80_000, state: scenario.state });
    expect(await db.transaction(tx => reconcilePaperOrderClaim(tx, order.userId, order.id))).toMatchObject({ changed: false, state: scenario.state });
    expect(await ledgerRows()).toEqual(after);
    expect(await unaffected()).toEqual(baseline);
  });

  it("keeps unbound legacy orders unbound and refuses foreign ownership", async () => {
    const order = (await unaffected()).orders.find(row => row.userId === fixtures[0].userId)!;
    expect(await db.transaction(tx => reconcilePaperOrderClaim(tx, order.userId, order.id))).toEqual({ status: "not_bound" });
    await expect(db.transaction(tx => reconcilePaperOrderClaim(tx, fixtures[1].userId, order.id))).rejects.toMatchObject({ code: "CLAIM_CONFLICT" });
    expect(await ledgerRows()).toEqual({ events: [], claims: [] });
  });

  it.each(["consumed", "released"] as const)("does not silently recycle a %s claim when later evidence conflicts", async state => {
    const order = (await unaffected()).orders.find(row => row.userId === fixtures[0].userId)!;
    await record(); await reserve(claimInput(paperOrderAllocationId(order.id)));
    await db.update(brokerOrders).set(state === "consumed"
      ? { status: "filled", brokerOrderId: "illustrative-broker", filledQty: 1 }
      : { status: "rejected" }).where(eq(brokerOrders.id, order.id));
    await db.transaction(tx => reconcilePaperOrderClaim(tx, order.userId, order.id));
    const ledger = await ledgerRows();
    await db.update(brokerOrders).set(state === "consumed"
      ? { status: "cancelled", filledQty: 0 }
      : { status: "filled", brokerOrderId: "illustrative-late-fill", filledQty: 1 }).where(eq(brokerOrders.id, order.id));
    baseline = await unaffected();
    const reconcile = () => db.transaction(tx => reconcilePaperOrderClaim(tx, order.userId, order.id));
    if (state === "consumed") expect(await reconcile()).toMatchObject({ state: "consumed", changed: false, needsReconciliation: true });
    else await expect(reconcile()).rejects.toMatchObject({ code: "LEDGER_INTEGRITY" });
    expect(await ledgerRows()).toEqual(ledger);
  });

  it("rolls back order and allocation transitions together when the caller fails", async () => {
    const order = (await unaffected()).orders.find(row => row.userId === fixtures[0].userId)!;
    await record(); await reserve(claimInput(paperOrderAllocationId(order.id)));
    const ledger = await ledgerRows();
    await expect(db.transaction(async tx => {
      await readCapitalLedger(tx, order.userId, target());
      await tx.update(brokerOrders).set({ status: "filled", brokerOrderId: "illustrative-broker", filledQty: 1 }).where(eq(brokerOrders.id, order.id));
      expect(await reconcilePaperOrderClaim(tx, order.userId, order.id)).toMatchObject({ state: "consumed" });
      throw new Error("Illustrative final-write failure");
    })).rejects.toThrow("Illustrative final-write failure");
    expect(await ledgerRows()).toEqual(ledger);
    expect(await unaffected()).toEqual(baseline);
  });

  it("rolls back an uncommitted claim when the caller fails after reading its receipt", async () => {
    await record();
    const before = await ledgerRows();
    await expect(db.transaction(async tx => {
      await claimCapital(tx, fixtures[0].userId, claimInput());
      const pending = await readCapitalLedger(tx, fixtures[0].userId, target());
      expect(pending.receipt?.allocationClaims).toEqual([{
        allocationId: claimInput().allocationId, capitalEventId: target().capitalEventId,
        amountCents: claimInput().amountCents, state: "pending",
      }]);
      // This is caller failure, not SELECT failure. An in-transaction receipt
      // must not be published as durable before the enclosing commit succeeds.
      throw new Error("Illustrative caller failure after ledger read");
    })).rejects.toThrow("Illustrative caller failure after ledger read");
    expect(await ledgerRows()).toEqual(before);
    expect((await read()).receipt?.allocationClaims).toEqual([]);
  });

});
