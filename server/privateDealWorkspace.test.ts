import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { deals } from "../drizzle/schema";
const mocked = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { getDb: mocked.getDb, coerceRows: actual.coerceRows };
});
import * as workspace from "./privateDealWorkspace";

const principal = { ownerUserId: 1 };
const dialect = new MySqlDialect();
let queries: any[], responses: any[], db: any;
beforeEach(() => {
  queries = []; responses = [];
  const builder = (kind: string) => {
    const q: any = { kind };
    queries.push(q);
    for (const method of ["from", "where", "limit", "offset", "orderBy", "innerJoin", "set", "values"]) {
      q[method] = vi.fn((...args: any[]) => { q[`${method}Args`] = args; return q; });
    }
    q.then = (resolve: any, reject: any) => {
      const result = responses.shift();
      return (result instanceof Error ? Promise.reject(result) : Promise.resolve(result ?? [])).then(resolve, reject);
    };
    return q;
  };
  db = { select: vi.fn(() => builder("select")), insert: vi.fn(() => builder("insert")), update: vi.fn(() => builder("update")) };
  mocked.getDb.mockReset().mockResolvedValue(db);
});
function scoped(q: any, dealId?: number) {
  const compiled = dialect.sqlToQuery(q.whereArgs[0]);
  expect(compiled.sql).toContain('`deals`.`owner_user_id` = ?');
  expect(compiled.params).toEqual(dealId === undefined ? [1, false] : [1, false, dealId]);
}

describe("private deal workspace boundary", () => {
  it("deduplicates only within the active owner's catalog", async () => {
    expect(await workspace.findPrivateDealByNameSource(principal, "Target", "manual")).toBeUndefined();
    const compiled = dialect.sqlToQuery(queries[0].whereArgs[0]);
    expect(compiled.sql).toContain('`deals`.`owner_user_id` = ?');
    expect(compiled.params).toEqual([1, false, "Target", "manual"]);
  });
  it("scopes lists before pagination, without an administrator exemption", async () => {
    responses.push([{ id: 7 }]);
    expect(await workspace.listPrivateDeals({ ...principal, role: "admin" } as any, { limit: 3, offset: 2 })).toEqual([{ id: 7 }]);
    scoped(queries[0]); expect(queries[0].limitArgs).toEqual([3]); expect(queries[0].offsetArgs).toEqual([2]);
  });
  it("rejects missing/foreign parents identically before reading any children", async () => {
    for (const read of [workspace.getPrivateDeal, workspace.listPrivateDealSignals, workspace.listPrivateDealMemos, workspace.listPrivateDealOutreach]) {
      const before = queries.length;
      await expect(read(principal, 99)).rejects.toMatchObject({ code: "NOT_FOUND", message: "Deal not found." });
      expect(queries.length).toBe(before + 1); scoped(queries.at(-1), 99);
    }
  });
  it.each([workspace.listPrivateDealSignals, workspace.listPrivateDealMemos, workspace.listPrivateDealOutreach])("authorizes parent and repeats ownership in child join", async read => {
    responses.push([{ id: 7 }], [{ id: 22 }]);
    expect(await read(principal, 7)).toEqual([{ id: 22 }]);
    scoped(queries[0], 7); scoped(queries[1], 7);
    expect(queries[1].innerJoinArgs[0]).toBe(deals);
  });
  it("creates with plain insert and server-controlled ownership/state", async () => {
    responses.push([{ insertId: 7 }]);
    expect(await workspace.createPrivateDeal(principal, { name: " Private target " })).toEqual({ id: 7 });
    expect(queries).toHaveLength(1);
    expect(queries[0].valuesArgs[0]).toMatchObject({ name: "Private target", ownerUserId: 1, stage: "new", source: "manual", isArchived: false });
    expect(queries[0].onDuplicateKeyUpdate).toBeUndefined();
  });
  it("rejects owner/id injection before database access", async () => {
    await expect(workspace.createPrivateDeal(principal, { name: "Target", ownerUserId: 2 } as any)).rejects.toThrow();
    expect(mocked.getDb).not.toHaveBeenCalled();
  });
  it("sanitizes wrapped duplicate-key failure without looking up another owner's row", async () => {
    responses.push(Object.assign(new Error("SQL includes private name"), { cause: { code: "ER_DUP_ENTRY", errno: 1062 } }));
    await expect(workspace.createPrivateDeal(principal, { name: "Target" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.select).not.toHaveBeenCalled(); expect(db.update).not.toHaveBeenCalled();
  });
  it("scopes stage mutation as well as both surrounding reads", async () => {
    responses.push([{ id: 7 }], [{ affectedRows: 1 }], [{ id: 7, stage: "passed" }]);
    expect(await workspace.updatePrivateDealStage(principal, 7, "passed")).toMatchObject({ stage: "passed" });
    queries.forEach(q => scoped(q, 7));
  });
  it("does not mutate a foreign parent", async () => {
    await expect(workspace.updatePrivateDealStage(principal, 7, "passed")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.update).not.toHaveBeenCalled();
  });
  it("soft archives with owner predicate; failed/raced update is not success", async () => {
    responses.push([{ id: 7 }], [{ affectedRows: 0 }]);
    await expect(workspace.archivePrivateDeal(principal, 7)).rejects.toMatchObject({ code: "NOT_FOUND" });
    scoped(queries[1], 7); expect(queries[1].setArgs[0].isArchived).toBe(true);
  });
  it("filters aggregate and activity reads through owned nonarchived deals", async () => {
    responses.push([{ total: "2", highPriority: "1", avgScore: "0.5", totalPipelineValue: "50" }]);
    expect(await workspace.getPrivateDealStats(principal)).toEqual({ total: 2, highPriority: 1, avgScore: 0.5, totalPipelineValue: 50 });
    responses.push([{ totalSent: "1", responded: "0", scheduled: "0" }]);
    expect(await workspace.getPrivateOutreachStats(principal)).toEqual({ totalSent: 1, responded: 0, scheduled: 0 });
    await workspace.listPrivateDealActivity(principal);
    queries.forEach(q => scoped(q));
    expect(queries[1].innerJoinArgs[0]).toBe(deals); expect(queries[2].innerJoinArgs[0]).toBe(deals);
  });
  it("fails closed when DB is unavailable", async () => {
    mocked.getDb.mockResolvedValue(null);
    await expect(workspace.listPrivateDeals(principal)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("rejects invalid owner and pagination before DB access", async () => {
    await expect(workspace.listPrivateDeals({ ownerUserId: 0 })).rejects.toThrow();
    await expect(workspace.listPrivateDeals(principal, { limit: 101 })).rejects.toThrow();
    expect(mocked.getDb).not.toHaveBeenCalled();
  });
  it.each([workspace.listPrivateDealMemos, workspace.listPrivateDealOutreach])("scopes capped owner-wide related collections without an unscoped parent fetch", async read => {
    await read(principal);
    expect(queries).toHaveLength(1); scoped(queries[0]);
    expect(queries[0].innerJoinArgs[0]).toBe(deals);
    expect(queries[0].limitArgs).toEqual([100]);
  });
  it("guards outreach ids through owner join and hides missing/foreign records", async () => {
    await expect(workspace.getPrivateOutreach(principal, 55)).rejects.toMatchObject({ code: "NOT_FOUND", message: "Outreach not found." });
    const compiled = dialect.sqlToQuery(queries[0].whereArgs[0]);
    expect(compiled.sql).toContain('`deals`.`owner_user_id` = ?');
    expect(compiled.sql).toContain('`outreach`.`id` = ?');
    expect(compiled.params).toEqual([1, false, 55]);
    responses.push([{ id: 55, dealId: 7 }]);
    expect(await workspace.getPrivateOutreach(principal, 55)).toEqual({ id: 55, dealId: 7 });
  });
  it("rejects overlong names instead of truncating into global uniqueness collisions", async () => {
    await expect(workspace.createPrivateDeal(principal, { name: "x".repeat(256) })).rejects.toThrow();
    expect(mocked.getDb).not.toHaveBeenCalled();
  });
  it("updates outreach atomically using its owned-parent subquery", async () => {
    responses.push([{ affectedRows: 1 }]);
    expect(await workspace.updatePrivateOutreachStatus(principal, 55, "replied", "")).toEqual({ success: true });
    expect(db.select).not.toHaveBeenCalled();
    const compiled = dialect.sqlToQuery(queries[0].whereArgs[0]);
    expect(compiled.sql).toContain('`outreach`.`id` = ?');
    expect(compiled.sql).toContain('`outreach`.`dealId` in (select `deals`.`id` from `deals` where');
    expect(compiled.sql).toContain('`deals`.`owner_user_id` = ?');
    expect(compiled.params).toEqual([55, 1, false]);
    expect(queries[0].setArgs[0]).toMatchObject({ status: "replied", notes: "" });
  });
  it("preserves omitted outreach notes", async () => {
    responses.push([{ affectedRows: 1 }]);
    await workspace.updatePrivateOutreachStatus(principal, 55, "sent");
    expect(queries[0].setArgs[0]).not.toHaveProperty("notes");
  });
  it("rejects absent or foreign outreach after zero affected rows", async () => {
    responses.push([{ affectedRows: 0 }], []);
    await expect(workspace.updatePrivateOutreachStatus(principal, 55, "sent")).rejects.toMatchObject({ code: "NOT_FOUND", message: "Outreach not found." });
    expect(queries).toHaveLength(2);
    expect(dialect.sqlToQuery(queries[1].whereArgs[0]).params).toEqual([1, false, 55]);
  });
  it("updates score with owner/id/archive conditions in the write", async () => {
    responses.push([{ affectedRows: 1 }]);
    expect(await workspace.updatePrivateDealScore(principal, 7, 0.75, 2)).toEqual({ success: true });
    scoped(queries[0], 7);
    expect(queries[0].setArgs[0]).toMatchObject({ score: 0.75, redFlagCount: 2 });
    expect(db.select).not.toHaveBeenCalled();
  });
  it("hides missing/foreign deal on score write and permits owned no-change repeats", async () => {
    responses.push([{ affectedRows: 0 }], []);
    await expect(workspace.updatePrivateDealScore(principal, 7, 0.75, 2)).rejects.toMatchObject({ code: "NOT_FOUND" });
    responses.push([{ affectedRows: 0 }], [{ id: 7 }]);
    expect(await workspace.updatePrivateDealScore(principal, 7, 0.75, 2)).toEqual({ success: true });
    queries.forEach(q => scoped(q, 7));
  });
  it("validates new mutation inputs before DB access", async () => {
    await expect(workspace.updatePrivateDealScore(principal, 7, NaN, 2)).rejects.toThrow();
    await expect(workspace.updatePrivateDealScore(principal, 7, 0.5, -1)).rejects.toThrow();
    await expect(workspace.updatePrivateOutreachStatus(principal, 55, "invalid" as any)).rejects.toThrow();
    expect(mocked.getDb).not.toHaveBeenCalled();
  });
  it("normalizes numeric strings using the existing DB coercion on deal and signal reads", async () => {
    responses.push([{ id: 7, revenue: "12345", score: "0.8" }]);
    expect(await workspace.listPrivateDeals(principal)).toEqual([{ id: 7, revenue: 12345, score: 0.8 }]);
    responses.push([{ id: 7, cashFlow: "2500" }]);
    expect(await workspace.getPrivateDeal(principal, 7)).toEqual({ id: 7, cashFlow: 2500 });
    responses.push([{ id: 7 }], [{ id: 4, dscr: "1.5", ownerDistressScore: "0.2" }]);
    expect(await workspace.listPrivateDealSignals(principal, 7)).toEqual([{ id: 4, dscr: 1.5, ownerDistressScore: 0.2 }]);
  });
  it("preserves legacy contact timestamps even for non-contact statuses", async () => {
    responses.push([{ affectedRows: 1 }]);
    await workspace.updatePrivateOutreachStatus(principal, 55, "pending");
    expect(queries[0].setArgs[0].lastContactedAt).toBeInstanceOf(Date);
    expect(queries[0].setArgs[0].updatedAt).toBeInstanceOf(Date);
  });
});
