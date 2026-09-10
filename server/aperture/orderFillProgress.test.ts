import { afterEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
const dependencies = vi.hoisted(() => ({ getDb: vi.fn(), brokerFor: vi.fn() }));
vi.mock("../db", () => ({ getDb: dependencies.getDb }));
vi.mock("./brokers/index", () => ({ brokerFor: dependencies.brokerFor }));
import { mirrorFills } from "./orderFlow";

/** Real mirroring loop, isolated DB/broker adapters. No broker dispatch method. */
function fixture(result: Record<string, unknown>, recordedQty = 0, competingFill = false) {
  const order = { id: 41, userId: 7, accountId: 11, runId: 22, status: "submitted", qty: 10,
    brokerOrderId: "illustrative-order", clientOrderId: "illustrative-client", dispatchError: null,
    filledQty: recordedQty, filledAvgPriceCents: recordedQty ? 1000 : null, filledAt: null, updatedAt: 1 };
  const updates: Record<string, unknown>[] = [];
  const db = {
    select: () => ({ from: (table: any) => ({ where: () => {
      const rows = getTableName(table) === "broker_orders" ? [{ ...order }]
        : getTableName(table) === "portfolio_accounts" ? [{ id: 11, userId: 7, isPaper: true, brokerId: "manual" }]
        : (() => { throw new Error("Unexpected mirror read"); })();
      return { then: (resolve: any) => Promise.resolve(rows).then(resolve), limit: async () => rows };
    } }) }),
    update: (table: any) => ({ set: (values: Record<string, unknown>) => ({ where: async () => {
      expect(getTableName(table)).toBe("broker_orders");
      if (competingFill) { order.status = "filled"; order.filledQty = 10; return [{ affectedRows: 0 }]; }
      updates.push(values); Object.assign(order, values); return [{ affectedRows: 1 }];
    } }) }),
  };
  const getOrder = vi.fn(async () => ({ brokerOrderId: "illustrative-order", status: "pending",
    filledQty: null, filledAvgPriceCents: null, ...result }));
  dependencies.getDb.mockResolvedValue(db);
  dependencies.brokerFor.mockReturnValue({ available: () => true, getOrder });
  return { order, updates, getOrder };
}
afterEach(() => vi.clearAllMocks());

describe("accepted order partial-fill progress", () => {
  it("does not count a stale update after another poll wins", async () => {
    const f = fixture({ filledQty: 2, filledAvgPriceCents: 1010 }, 0, true);
    expect(await mirrorFills(7)).toBe(0);
    expect(f.order).toMatchObject({ status: "filled", filledQty: 10 });
    expect(f.updates).toEqual([]);
  });
  it.each([[0, 2], [2, 4]])("records fill progress from %i to %i without a status change", async (before, after) => {
    const f = fixture({ filledQty: after, filledAvgPriceCents: 1010 }, before);
    expect(await mirrorFills(7)).toBe(1);
    expect(f.order).toMatchObject({ status: "submitted", filledQty: after, filledAvgPriceCents: 1010, filledAt: null });
    expect(f.updates).toHaveLength(1);
    expect(f.getOrder).toHaveBeenCalledWith("illustrative-order");
  });
  it("records an updated aggregate fill price at the same filled quantity", async () => {
    const f = fixture({ filledQty: 2, filledAvgPriceCents: 1015 }, 2);
    expect(await mirrorFills(7)).toBe(1);
    expect(f.order.filledAvgPriceCents).toBe(1015);
  });
  it("does not rewrite an unchanged partial fill", async () => {
    const f = fixture({ filledQty: 2, filledAvgPriceCents: 1000 }, 2);
    expect(await mirrorFills(7)).toBe(0);
    expect(f.updates).toEqual([]);
  });
  it("missing fill fields do not erase the last recorded fill", async () => {
    const f = fixture({}, 2);
    expect(await mirrorFills(7)).toBe(0);
    expect(f.order).toMatchObject({ filledQty: 2, filledAvgPriceCents: 1000 });
    expect(f.updates).toEqual([]);
  });
});
