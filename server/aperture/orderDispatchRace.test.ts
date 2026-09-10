import { afterEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const deps = vi.hoisted(() => ({ getDb: vi.fn(), brokerFor: vi.fn(), claimTransaction: vi.fn() }));
vi.mock("../db", () => ({ getDb: deps.getDb }));
vi.mock("./brokers/index", () => ({ brokerFor: deps.brokerFor }));
vi.mock("./capitalLedger", () => ({ withPaperOrderClaimTransaction: deps.claimTransaction }));
vi.mock("./facts", () => ({ getFacts: async () => [], freshestPerKey: (x: unknown) => x, normSymbol: (x: string) => x.toUpperCase() }));
vi.mock("./decisionRunway", () => ({ authorizeDecisionAction: async () => null, queuePaperOutcome: vi.fn() }));
vi.mock("./gates", async original => ({ ...await original<typeof import("./gates")>(),
  evaluateOrderGates: () => ({ passed: true, results: [], failures: [] }),
}));
import { approveOrder, submitOrder } from "./orderFlow";

// Real submit orchestration; gate arithmetic is separately covered. No network,
// no actual brokerage, and no assertion that this fixture is trade-eligible.
function fixture(late: "accepted" | "timeout", progress: "filled" | "partial" | "none" = "filled") {
  const now = Date.UTC(2026, 8, 10, 15);
  const order: Record<string, any> = { id: 41, userId: 7, accountId: 11, runId: 22,
    status: "approved", symbol: "DATA", instrumentType: "shares", side: "buy", intent: "open",
    qty: 1, limitPriceCents: 1000, orderType: "limit", timeInForce: "day", filledQty: null,
    filledAvgPriceCents: null, brokerOrderId: null, clientOrderId: null, dispatchError: null };
  let snapshotWrites = 0;
  let inTransaction = false;
  const boundaries: string[] = [];
  const db: any = {
    select: () => ({ from: (table: any) => ({ where: () => {
      const name = getTableName(table);
      const rows = name === "broker_orders" ? [{ ...order }] : name === "portfolio_accounts"
        ? [{ id: 11, userId: 7, isPaper: true, brokerId: "manual", label: "Illustrative paper", lastSyncedAt: now, equityValueCents: 1000000 }]
        : name === "aperture_runs" ? [{ id: 22 }] : [];
      return { limit: async () => rows, then: (resolve: any) => Promise.resolve(rows).then(resolve) };
    } }) }),
    transaction: async (fn: any) => fn(db),
    update: () => ({ set: (values: any) => ({ where: async (predicate: any) => {
      const query = new MySqlDialect().sqlToQuery(predicate);
      // Match status predicates using the real compiled query; id-only writes
      // intentionally reproduce the original overwrite.
      const statusIndex = query.sql.split("?").findIndex(part => /`status` = $/.test(part));
      if (statusIndex >= 0 && query.params[statusIndex] !== order.status) return [{ affectedRows: 0 }];
      for (const [column, key] of [["broker_order_id", "brokerOrderId"], ["filled_qty", "filledQty"], ["filled_avg_price_cents", "filledAvgPriceCents"]]) {
        if (query.sql.includes(`\`${column}\` is null`) && order[key] != null) return [{ affectedRows: 0 }];
      }
      Object.assign(order, values); return [{ affectedRows: 1 }];
    } }) }),
    insert: () => ({ values: async () => { snapshotWrites++; return [{ insertId: 1 }]; } }),
  };
  const submit = vi.fn(async () => {
    expect(inTransaction).toBe(false);
    // A separate broker reconciliation wins while dispatch response is in flight.
    if (progress !== "none") Object.assign(order, { status: progress === "filled" ? "filled" : "submitted",
      brokerOrderId: "illustrative-broker", filledQty: progress === "filled" ? 1 : 0.5,
      filledAvgPriceCents: 1000, filledAt: progress === "filled" ? now : null, dispatchError: null });
    if (late === "timeout") throw new Error("Illustrative lost response");
    return { status: "pending", brokerOrderId: "illustrative-broker", filledQty: null };
  });
  deps.getDb.mockResolvedValue(db);
  deps.claimTransaction.mockImplementation(async (_db, userId, orderId, operation) => {
    expect([userId, orderId]).toEqual([7, 41]);
    inTransaction = true;
    try { const result = await operation(db); boundaries.push(order.status); return result; }
    finally { inTransaction = false; }
  });
  deps.brokerFor.mockReturnValue({ available: () => true, capabilities: { paperTrading: true, serverSideExecution: true }, submitOrder: submit });
  return { order, now, submit, boundaries, snapshots: () => snapshotWrites };
}
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
describe("late dispatch response", () => {
  it("approval stays separate from dispatch and reconciles its reservation", async () => {
    vi.stubEnv("CAPITAL_OBJECTIVE_MISSIONS_ENABLED", "true");
    vi.stubEnv("CAPITAL_STRATEGY_DISCOVERY_ENABLED", "true");
    const f = fixture("accepted", "none"); f.order.status = "pending_approval";
    await approveOrder(41, 7, "APPROVE PAPER", f.now);
    expect(f.boundaries).toEqual(["approved"]);
    expect(f.submit).not.toHaveBeenCalled();
  });
  it.each(["accepted", "timeout"] as const)("reconciles dispatch lease and %s response outside broker call", async late => {
    vi.stubEnv("CAPITAL_OBJECTIVE_MISSIONS_ENABLED", "true");
    vi.stubEnv("CAPITAL_STRATEGY_DISCOVERY_ENABLED", "true");
    const f = fixture(late, "none");
    if (late === "timeout") await expect(submitOrder(41, 7, "SUBMIT PAPER", f.now)).rejects.toThrow(/do not resubmit/);
    else await submitOrder(41, 7, "SUBMIT PAPER", f.now);
    expect(f.boundaries).toEqual(["submitted", "submitted"]);
    await expect(submitOrder(41, 7, "SUBMIT PAPER", f.now)).rejects.toThrow(/must be approved/);
    expect(f.submit).toHaveBeenCalledTimes(1);
  });
  it.each(["", "PAPER", "APPROVE PAPER"])("does not dispatch with confirmation %s", async confirmation => {
    const f = fixture("accepted", "none");
    const before = { ...f.order };
    await expect(submitOrder(41, 7, confirmation, f.now)).rejects.toThrow(/Type SUBMIT PAPER/);
    expect(f.submit).not.toHaveBeenCalled(); expect(f.order).toEqual(before);
  });
  it.each(["accepted", "timeout"] as const)("does not erase reconciled fill after %s", async late => {
    const f = fixture(late);
    if (late === "timeout") await expect(submitOrder(41, 7, "SUBMIT PAPER", f.now)).rejects.toThrow();
    else await submitOrder(41, 7, "SUBMIT PAPER", f.now);
    expect(f.order).toMatchObject({ status: "filled", filledQty: 1, filledAvgPriceCents: 1000, dispatchError: null });
    expect(f.submit).toHaveBeenCalledTimes(1);
    expect(f.snapshots()).toBe(0);
  });
  it.each(["accepted", "timeout"] as const)("does not erase partial fill after %s", async late => {
    const f = fixture(late, "partial");
    if (late === "timeout") await expect(submitOrder(41, 7, "SUBMIT PAPER", f.now)).rejects.toThrow();
    else await submitOrder(41, 7, "SUBMIT PAPER", f.now);
    expect(f.order).toMatchObject({ status: "submitted", filledQty: 0.5, filledAvgPriceCents: 1000, dispatchError: null });
    expect(f.submit).toHaveBeenCalledTimes(1);
  });
  it.each(["accepted", "timeout"] as const)("records uncontested %s without replaying dispatch", async late => {
    const f = fixture(late, "none");
    if (late === "timeout") await expect(submitOrder(41, 7, "SUBMIT PAPER", f.now)).rejects.toThrow(/do not resubmit/);
    else await submitOrder(41, 7, "SUBMIT PAPER", f.now);
    expect(f.order.status).toBe("submitted");
    expect(f.order.dispatchError).toBe(late === "timeout" ? "Illustrative lost response" : null);
    expect(f.order.brokerOrderId).toBe(late === "timeout" ? null : "illustrative-broker");
    expect(f.submit).toHaveBeenCalledTimes(1);
  });
});
