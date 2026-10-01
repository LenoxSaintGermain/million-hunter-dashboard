import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const mocks = vi.hoisted(() => ({
  existing: { id: 7, ownerUserId: 20, assignedUserId: 30 },
  where: vi.fn(), set: vi.fn(), values: vi.fn(),
}));
const workspace = vi.hoisted(() => ({
  list: vi.fn(async () => []), create: vi.fn(async () => ({ id: 9 })),
  deny: vi.fn(async () => { throw Object.assign(new Error("Deal not found"), { code: "NOT_FOUND" }); }),
}));
vi.mock("./privateDealWorkspace", () => ({
  listPrivateDeals: workspace.list,
  createPrivateDeal: workspace.create,
  getPrivateDeal: workspace.deny,
  listPrivateDealSignals: workspace.deny,
  listPrivateDealMemos: workspace.list,
  listPrivateDealOutreach: workspace.list,
  listPrivateDealActivity: workspace.list,
  getPrivateDealStats: workspace.list,
  getPrivateOutreachStats: workspace.list,
  archivePrivateDeal: workspace.deny,
  updatePrivateDealStage: workspace.deny,
  getPrivateOutreach: workspace.deny,
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
  it("keeps unaudited destructive operations closed", async () => {
    const other = caller();
    const calls = [
      () => other.deals.bulkDelete({ all: true, confirm: true }),
    ];
    for (const call of calls) await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.where).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.values).not.toHaveBeenCalled();
  });
  it("routes private collections through the authenticated owner, including admins", async () => {
    for (const [id, role] of [[10, "user"], [1, "admin"]] as const) {
      await caller(id, role).deals.list();
      expect(workspace.list).toHaveBeenLastCalledWith({ ownerUserId: id }, {});
      await caller(id, role).memos.list();
      expect(workspace.list).toHaveBeenLastCalledWith({ ownerUserId: id });
    }
  });
  it("passes server identity to creation, never a client owner", async () => {
    await caller().deals.create({ name: "Private target", ownerUserId: 1 } as any);
    expect(workspace.create).toHaveBeenCalledWith({ ownerUserId: 10 }, { name: "Private target" });
  });
  it("checks ownership before detail, archive, scoring or generation", async () => {
    for (const call of [
      () => caller().deals.getById({ id: 7 }),
      () => caller().deals.delete({ id: 7 }),
      () => caller().deals.score({ id: 7 }),
      () => caller().signals.analyze({ dealId: 7 }),
      () => caller().memos.generate({ dealId: 7 }),
    ]) await expect(call()).rejects.toThrow("Deal not found");
    expect(workspace.deny).toHaveBeenCalledWith({ ownerUserId: 10 }, 7);
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
