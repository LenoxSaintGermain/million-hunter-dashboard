import { afterEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { getTableName } from "drizzle-orm";

const dependencies = vi.hoisted(() => ({ getDb: vi.fn(), brokerFor: vi.fn(() => { throw new Error("Broker access forbidden"); }) }));
vi.mock("../db", () => ({ getDb: dependencies.getDb }));
vi.mock("./brokers/index", () => ({ brokerFor: dependencies.brokerFor }));
import { rejectOrder } from "./orderFlow";

/** Exercises the real rejection function with a deterministic competing write
 * between its SELECT and UPDATE. Predicates are compiled by Drizzle, not inferred
 * from reassuring copy. Separate DB tests remain necessary for server locking. */
function fixture(status: string, competingStatus?: string) {
  const row = { id: 41, userId: 7, status, rejectionReason: null as string | null, updatedAt: 1 };
  const predicates: unknown[][] = [];
  const parameters = (predicate: any) => new MySqlDialect().sqlToQuery(predicate).params;
  const db = {
    select: () => ({ from: () => ({ where: (predicate: any) => ({ limit: async () => {
      const [id, userId] = parameters(predicate);
      return id === row.id && userId === row.userId ? [{ ...row }] : [];
    } }) }) }),
    update: (table: any) => ({ set: (values: any) => ({ where: async (predicate: any) => {
      expect(getTableName(table)).toBe("broker_orders");
      if (competingStatus) row.status = competingStatus;
      const params = parameters(predicate);
      predicates.push(params);
      const matches = params[0] === row.id && (params.length < 2 || params[1] === row.userId)
        && (params.length < 3 || params[2] === row.status);
      if (matches) Object.assign(row, values);
      return [{ affectedRows: matches ? 1 : 0 }];
    } }) }),
  };
  dependencies.getDb.mockResolvedValue(db);
  return { row, predicates };
}
afterEach(() => {
  expect(dependencies.brokerFor).not.toHaveBeenCalled();
  vi.clearAllMocks();
});

describe("operator rejection concurrency", () => {
  it.each(["pending_approval", "approved"])("rejects an unchanged %s proposal", async status => {
    const f = fixture(status);
    await rejectOrder(41, 7, "Illustrative operator decision");
    expect(f.row).toMatchObject({ status: "rejected", rejectionReason: "Illustrative operator decision" });
  });
  it.each(["submitted", "filled", "rejected", "cancelled", "approved"])("does not overwrite a competing %s transition", async next => {
    const f = fixture("pending_approval", next);
    await expect(rejectOrder(41, 7, "Stale rejection")).rejects.toThrow(/changed/);
    expect(f.row).toEqual({ id: 41, userId: 7, status: next, rejectionReason: null, updatedAt: 1 });
    expect(f.predicates).toEqual([[41, 7, "pending_approval"]]);
  });
  it("does not let an approved proposal overwrite dispatch", async () => {
    const f = fixture("approved", "submitted");
    await expect(rejectOrder(41, 7)).rejects.toThrow(/changed/);
    expect(f.row.status).toBe("submitted");
  });
  it("rejects another owner without a write", async () => {
    const f = fixture("approved");
    await expect(rejectOrder(41, 8)).rejects.toThrow("order not found");
    expect(f.predicates).toEqual([]);
    expect(f.row.status).toBe("approved");
  });
});
