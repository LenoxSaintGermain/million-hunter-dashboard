import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const mocks = vi.hoisted(() => ({
  existing: { id: 7, ownerUserId: 20, assignedUserId: 30 },
  where: vi.fn(), set: vi.fn(), values: vi.fn(),
}));
vi.mock("./db", async importOriginal => {
  const original = await importOriginal<typeof import("./db")>();
  return { ...original, getDb: async () => ({
    select: () => ({ from: () => ({ where: (condition: unknown) => {
      mocks.where(condition);
      return {
        orderBy: async () => [],
        limit: async () => [mocks.existing],
        then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve(resolve([])),
      };
    } }) }),
    update: () => ({ set: (value: unknown) => {
      mocks.set(value); return { where: async () => [] };
    } }),
    insert: () => ({ values: async (value: unknown) => {
      mocks.values(value); return [{ insertId: 8 }];
    } }),
  }), getCommercialAssets: async () => [] };
});
import { appRouter } from "./routers";
const caller = (id = 10, role = "user") => appRouter.createCaller({ user: { id, role } } as any);

beforeEach(() => vi.clearAllMocks());
describe("new account boundaries", () => {
  it("denies actual root-router private reads and mutations for another account", async () => {
    const other = caller();
    const calls = [
      () => other.deals.list(), () => other.deals.getById({ id: 7 }),
      () => other.deals.delete({ id: 7 }), () => other.deals.bulkDelete({ all: true, confirm: true }),
      () => other.signals.getByDealId({ dealId: 7 }), () => other.memos.list(),
      () => other.outreach.list(), () => other.dashboard.stats(), () => other.activity.list(),
      () => other.memos.generate({ dealId: 7 }),
    ];
    for (const call of calls) await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.where).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.values).not.toHaveBeenCalled();
  });
  it("rejects anonymous deal list and detail before reading data", async () => {
    const anonymous = appRouter.createCaller({ user: null } as any);
    await expect(anonymous.deals.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.deals.getById({ id: 7 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("scopes property criteria list by owner or assignment", async () => {
    await caller().thesisVariant.list();
    const query = new MySqlDialect().sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(query.sql).toContain("owner_user_id");
    expect(query.sql).toContain("assigned_user_id");
    expect(query.params.filter(p => p === 10)).toHaveLength(2);
  });
  it("blocks cross-catalog property previews pending scoped asset ownership", async () => {
    await expect(caller().thesisVariant.match({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().thesisVariant.preview({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("keeps public search fixture-only", async () => {
    const result = await appRouter.createCaller({ user: null } as any).publicDeals.search({});
    expect(result).toBeDefined();
    expect(mocks.where).not.toHaveBeenCalled();
  });
  it.each([10, 30])("prevents non-owner %s from editing or deleting even with ordinary user role", async id => {
    await expect(caller(id).thesisVariant.save({ id: 7, name: "Changed" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(id).thesisVariant.remove({ id: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("lets the owner edit without granting reassignment or primary privileges", async () => {
    await caller(20).thesisVariant.save({ id: 7, name: "Owned", assignedUserId: 99, isPrimary: true });
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ name: "Owned" }));
    expect(mocks.set.mock.calls[0][0]).not.toHaveProperty("assignedUserId");
    expect(mocks.set.mock.calls[0][0]).not.toHaveProperty("isPrimary");
  });
  it("creates criteria owned and assigned to the caller", async () => {
    await caller().thesisVariant.save({ name: "New", assignedUserId: 99, isPrimary: true });
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ ownerUserId: 10, assignedUserId: 10, isPrimary: false }));
  });
  it("preserves explicit admin management", async () => {
    await caller(1, "admin").thesisVariant.save({ id: 7, name: "Managed", assignedUserId: 99, isPrimary: true });
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ assignedUserId: 99, isPrimary: true }));
  });
});
