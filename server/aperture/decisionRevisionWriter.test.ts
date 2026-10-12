import { describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { appendDecisionRevision } from "./decisionRevisionWriter";

function database(options: { dispatch?: boolean; missingHead?: boolean; missingRevision?: boolean; closed?: boolean; failUpdate?: boolean } = {}) {
  const writes: Array<{ table: string; kind: string; values: any }> = [];
  const head = { id: 10, userId: 1, currentRevisionId: 11, lockVersion: 4, lifecycle: options.closed ? "closed" : "researching" };
  const revision = { id: 11, decisionRunId: 10, version: 2 };
  const locks: string[] = [];
  const tx = {
    select: () => ({ from: (table: any) => {
      const name = getTableName(table);
      const query: any = { where: () => query, for: () => { locks.push(name); return query; },
        limit: async () => name === "aperture_decision_runs" ? options.missingHead ? [] : [head]
          : name === "broker_orders" ? options.dispatch ? [{ id: 9 }] : []
          : options.missingRevision ? [] : [revision] };
      return query;
    } }),
    insert: (table: any) => ({ values: async (values: any) => { writes.push({ table: getTableName(table), kind: "insert", values }); return [{ insertId: 12 }]; } }),
    update: (table: any) => ({ set: (values: any) => ({ where: async () => {
      writes.push({ table: getTableName(table), kind: "update", values });
      return [{ affectedRows: options.failUpdate && getTableName(table) === "aperture_decision_runs" ? 0 : 1 }];
    } }) }),
  };
  const db = { transaction: async (body: any) => { try { return await body(tx); } catch (error) { writes.length = 0; throw error; } } };
  return { db, writes, locks };
}
const request = { ownerId: 1, decisionRunId: 10, expectedRevisionId: 11, expectedLockVersion: 4, now: 1000 };
const build = async () => ({ values: { missionText: "Preserve this mission", missionHash: "a", holdingPeriod: "intraday" as const,
  deployableCapitalCents: 100, maxPlannedLossCents: 10 }, lifecycle: "researching" as const,
  pending: { branch: "research" as const, reviewAt: null, reopenCondition: null, namedGateKey: null } });

describe("shared normal decision revision writer", () => {
  it("locks the head/dispatch, appends history, advances head and supersedes pending reviews", async () => {
    const { db, writes, locks } = database();
    expect(await appendDecisionRevision(db as any, { ...request, build })).toEqual({ decisionRunId: 10, revisionId: 12 });
    expect(locks).toEqual(["aperture_decision_runs", "broker_orders"]);
    expect(writes[0]).toMatchObject({ table: "aperture_decision_revisions", kind: "insert",
      values: { decisionRunId: 10, version: 3, previousRevisionId: 11, createdByUserId: 1, createdAt: 1000 } });
    expect(writes[1]).toMatchObject({ table: "aperture_decision_runs", values: { currentRevisionId: 12, lockVersion: 5 } });
    expect(writes[2]).toMatchObject({ table: "aperture_pending_outcomes", values: { status: "cancelled" } });
    expect(writes.some(w => w.table === "broker_orders")).toBe(false);
  });
  it.each([{ dispatch: true }, { missingHead: true }, { closed: true }, { missingRevision: true }, { failUpdate: true }])("rolls back blocked/conflicting writes: %j", async options => {
    const { db, writes } = database(options);
    await expect(appendDecisionRevision(db as any, { ...request, build })).rejects.toThrow();
    expect(writes).toEqual([]);
  });
  it("does not insert when binding validation fails", async () => {
    const { db, writes } = database();
    await expect(appendDecisionRevision(db as any, { ...request, build: vi.fn().mockRejectedValue(new Error("binding invalid")) })).rejects.toThrow("binding invalid");
    expect(writes).toEqual([]);
  });
  it("retains the normal conditional gate review semantics", async () => {
    const { db, writes } = database();
    await appendDecisionRevision(db as any, { ...request, build: async () => ({ ...await build(), lifecycle: "conditional",
      pending: { branch: "conditional", reviewAt: 2000, reopenCondition: "Confirm the evidence", namedGateKey: "evidence" } }) });
    expect(writes[3]).toMatchObject({ table: "aperture_pending_outcomes", kind: "insert", values: { revisionId: 12, kind: "gate_review", status: "pending", dueAt: 2000 } });
  });
});
