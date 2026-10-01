import { beforeEach, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
const mocked = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => mocked);
import { createPrivateScanJob, getPrivateScanJob, getLatestPrivateScanJob, updatePrivateScanJob } from "./privateScanJobs";
let queries: any[], responses: any[];
beforeEach(() => {
  queries = []; responses = [];
  const build = (kind: string) => {
    const q: any = { kind };
    queries.push(q);
    for (const method of ["from", "where", "orderBy", "limit", "values", "set"]) q[method] = (value: any) => { q[`${method}Value`] = value; return q; };
    q.then = (resolve: any, reject: any) => Promise.resolve(responses.shift() ?? []).then(resolve, reject);
    return q;
  };
  mocked.getDb.mockReset().mockResolvedValue({ select: () => build("select"), insert: () => build("insert"), update: () => build("update") });
});
const sql = (n = 0) => new MySqlDialect().sqlToQuery(queries[n].whereValue);
it("scopes latest before ordering instead of reading the globally latest job", async () => {
  expect(await getLatestPrivateScanJob(20)).toBeNull();
  expect(sql().sql).toContain("owner_user_id"); expect(sql().params).toEqual([20]);
});
it("hides missing, unassigned and foreign jobs through the same predicate", async () => {
  await expect(getPrivateScanJob(20, 9)).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(sql().params).toEqual([20, 9]);
});
it("stores ownership in the initial insert with no disclosure window", async () => {
  responses.push([{ insertId: 9 }]);
  expect(await createPrivateScanJob(20, { sources: ["bizbuysell"] })).toEqual({ id: 9 });
  expect(queries[0].valuesValue).toEqual({ ownerUserId: 20, sources: ["bizbuysell"], status: "pending" });
});
it("rejects injected owners and ids before DB access", async () => {
  await expect(createPrivateScanJob(20, { sources: [], ownerUserId: 1 } as any)).rejects.toThrow();
  await expect(createPrivateScanJob(20, { sources: [], id: 9 } as any)).rejects.toThrow();
  expect(mocked.getDb).not.toHaveBeenCalled();
});
it("scopes the write itself", async () => {
  responses.push([{ affectedRows: 1 }]);
  await updatePrivateScanJob(20, 9, { status: "failed" });
  expect(sql().params).toEqual([20, 9]);
});
it("denies a foreign update when no rows change", async () => {
  responses.push([{ affectedRows: 0 }], []);
  await expect(updatePrivateScanJob(20, 9, { status: "completed" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(sql(1).params).toEqual([20, 9]);
});
it("cannot change ownership through a progress patch", async () => {
  await expect(updatePrivateScanJob(20, 9, { ownerUserId: 1 } as any)).rejects.toThrow();
  expect(mocked.getDb).not.toHaveBeenCalled();
});
it("fails closed on invalid principals and unavailable storage", async () => {
  await expect(getLatestPrivateScanJob(0)).rejects.toThrow();
  expect(mocked.getDb).not.toHaveBeenCalled();
  mocked.getDb.mockResolvedValue(null);
  await expect(getLatestPrivateScanJob(20)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
});
