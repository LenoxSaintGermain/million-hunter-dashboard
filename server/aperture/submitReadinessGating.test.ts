/**
 * Issue #3: an approved paper order must not be sendable while a submit-time
 * gate fails (stale broker snapshot, single-name exposure ceiling, ...).
 *
 * Two halves, both against the real orderFlow orchestration with an in-memory
 * DB and a stub broker (no network, no brokerage, no real order):
 *   1. `submitOrder` refuses and never reaches the broker's submit endpoint.
 *   2. `submitReadiness` (what the UI renders) reports the same gate, by key,
 *      and never says "ready" when submit would refuse.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";

const deps = vi.hoisted(() => ({ getDb: vi.fn(), brokerFor: vi.fn(), gateResults: [] as Array<{ key: string; passed: boolean; detail: string }> }));
vi.mock("../db", () => ({ getDb: deps.getDb }));
vi.mock("./brokers/index", () => ({ brokerFor: deps.brokerFor }));
vi.mock("./facts", () => ({ getFacts: async () => [], freshestPerKey: (x: unknown) => x, normSymbol: (x: string) => x.toUpperCase() }));
vi.mock("./decisionRunway", async (original) => ({ ...await original<typeof import("./decisionRunway")>(), authorizeDecisionAction: async () => null, queuePaperOutcome: vi.fn() }));
vi.mock("./gates", async (original) => ({ ...await original<typeof import("./gates")>(),
  evaluateOrderGates: () => ({
    passed: deps.gateResults.every((result) => result.passed),
    mandateVersion: "test",
    evaluatedAt: 0,
    results: deps.gateResults,
    failures: deps.gateResults.filter((result) => !result.passed).map((result) => result.detail),
    notes: [],
  }),
}));
import { OrderGateError, submitOrder, submitReadiness } from "./orderFlow";
import { canSendApprovedOrder } from "../../shared/orderSubmitReadiness";

const now = Date.UTC(2026, 9, 7, 15);
const TEN_HOURS = 10 * 60 * 60_000;

function fixture({ lastSyncedAt }: { lastSyncedAt: number }) {
  const order: Record<string, any> = { id: 51, userId: 7, accountId: 11, runId: 22, candidateId: null,
    status: "approved", symbol: "NVDA", instrumentType: "shares", side: "buy", intent: "open",
    qty: 5, limitPriceCents: 18000, orderType: "limit", timeInForce: "day", filledQty: null,
    filledAvgPriceCents: null, brokerOrderId: null, clientOrderId: null, dispatchError: null, reason: "Illustrative fixture" };
  const writes: unknown[] = [];
  const db: any = {
    select: () => ({ from: (table: any) => ({ where: () => {
      const name = getTableName(table);
      const rows = name === "broker_orders" ? [{ ...order }] : name === "portfolio_accounts"
        ? [{ id: 11, userId: 7, isPaper: true, brokerId: "manual", label: "Illustrative paper", externalAccountId: "paper-fixture", lastSyncedAt, equityValueCents: 10_000_000 }]
        : name === "aperture_runs" ? [{ id: 22 }] : [];
      return { limit: async () => rows, then: (resolve: any) => Promise.resolve(rows).then(resolve) };
    } }) }),
    transaction: async (fn: any) => fn(db),
    update: () => ({ set: (values: any) => ({ where: async () => { writes.push(values); Object.assign(order, values); return [{ affectedRows: 1 }]; } }) }),
    insert: () => ({ values: async () => [{ insertId: 1 }] }),
  };
  const brokerSubmit = vi.fn(async () => ({ status: "pending", brokerOrderId: "should-never-happen" }));
  deps.getDb.mockResolvedValue(db);
  deps.brokerFor.mockReturnValue({ available: () => true, capabilities: { paperTrading: true, serverSideExecution: true }, submitOrder: brokerSubmit });
  return { order, writes, brokerSubmit };
}

afterEach(() => { vi.clearAllMocks(); deps.gateResults = []; });

describe("issue #3: submit is refused and Send is off when a gate fails", () => {
  it("stale broker snapshot: submit refuses, broker never called, readiness names the gate", async () => {
    const f = fixture({ lastSyncedAt: now - TEN_HOURS });
    const readiness = await submitReadiness(f.order as any, 7, now);
    expect(readiness.state).toBe("blocked");
    expect(readiness.blockers.map((blocker) => blocker.key)).toContain("execution_account_freshness");
    expect(readiness.blockers.find((blocker) => blocker.key === "execution_account_freshness")?.title).toBe("Broker snapshot is stale");
    expect(canSendApprovedOrder(readiness)).toBe(false);
    // The readiness check is read-only: no row was written.
    expect(f.writes).toEqual([]);

    await expect(submitOrder(51, 7, "SUBMIT PAPER", now)).rejects.toBeInstanceOf(OrderGateError);
    expect(f.brokerSubmit).not.toHaveBeenCalled();
    expect(f.order.status).toBe("approved");
  });

  it("over the single-name exposure ceiling: submit refuses, broker never called, readiness names the gate", async () => {
    deps.gateResults = [{ key: "position_concentration", passed: false, detail: "NVDA would be 10.6% of equity, over the 10% single-name cap" }];
    const f = fixture({ lastSyncedAt: now - 60_000 });
    const readiness = await submitReadiness(f.order as any, 7, now);
    expect(readiness.state).toBe("blocked");
    expect(readiness.blockers.map((blocker) => blocker.key)).toEqual(["position_concentration"]);
    expect(readiness.blockers[0].title).toBe("Over the single-name exposure ceiling");
    expect(readiness.blockers[0].detail).toContain("over the 10% single-name cap");
    expect(canSendApprovedOrder(readiness)).toBe(false);

    await expect(submitOrder(51, 7, "SUBMIT PAPER", now)).rejects.toThrow(/single-name cap/);
    expect(f.brokerSubmit).not.toHaveBeenCalled();
    expect(f.order.status).toBe("approved");
  });

  it("reports ready only when every submit-time gate passes", async () => {
    deps.gateResults = [{ key: "position_concentration", passed: true, detail: "within cap" }];
    const f = fixture({ lastSyncedAt: now - 60_000 });
    const readiness = await submitReadiness(f.order as any, 7, now);
    expect(readiness).toMatchObject({ state: "ready", blockers: [] });
    expect(canSendApprovedOrder(readiness)).toBe(true);
    expect(f.brokerSubmit).not.toHaveBeenCalled();
  });

  it("fails closed when the evaluation cannot run", async () => {
    const f = fixture({ lastSyncedAt: now - 60_000 });
    deps.getDb.mockResolvedValue(null);
    const readiness = await submitReadiness(f.order as any, 7, now);
    expect(readiness.state).toBe("unverified");
    expect(canSendApprovedOrder(readiness)).toBe(false);
  });

  it("never treats a non-approved order as sendable", async () => {
    const f = fixture({ lastSyncedAt: now - 60_000 });
    const readiness = await submitReadiness({ ...f.order, status: "pending_approval" } as any, 7, now);
    expect(readiness.state).toBe("blocked");
  });
});
