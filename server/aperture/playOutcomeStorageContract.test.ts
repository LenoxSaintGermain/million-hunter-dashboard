import { beforeEach, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
const f = vi.hoisted(() => ({ queries: [] as Array<{ sql: string; params: unknown[] }>, transactions: 0 }));
vi.mock("../db", async () => {
  const { drizzle } = await import("drizzle-orm/mysql-proxy");
  const db = drizzle(async (sql, params) => { f.queries.push({ sql, params }); return { rows: [] }; });
  // No database connection; real Drizzle query compilation with an empty store.
  db.transaction = async action => { f.transactions++; return action(db as any); };
  return { getDb: async () => db };
});
import { playOutcomeRouter } from "./playOutcomeReview";
const caller = () => playOutcomeRouter.createCaller({ user: { id: 7, role: "capital_operator" } } as TrpcContext);
beforeEach(() => { f.queries = []; f.transactions = 0; });
it("compiles owner, revision, order, run and paper-account bindings for the read-only list", async () => {
  expect(await caller().list({ runId: 780001 })).toEqual([]);
  expect(f.queries).toHaveLength(1);
  const { sql, params } = f.queries[0];
  for (const table of ["aperture_pending_outcomes", "aperture_decision_runs", "broker_orders", "aperture_runs", "portfolio_accounts"])
    expect(sql).toContain(`\`${table}\`.\`user_id\` = ?`);
  expect(sql).toContain("`broker_orders`.`decision_revision_id` = `aperture_pending_outcomes`.`revision_id`");
  expect(sql).toContain("`broker_orders`.`run_id` = `aperture_decision_runs`.`research_run_id`");
  expect(sql).toContain("`aperture_decision_revisions`.`decision_run_id` = `aperture_decision_runs`.`id`");
  expect(sql).toContain("`portfolio_accounts`.`is_paper` = ?");
  expect(params).toContain(780001); expect(params).toContain("play_outcome");
  expect(f.transactions).toBe(0);
});
it("locks the exact owned review before evaluating a write; missing binding causes no update", async () => {
  await expect(caller().record({ runId: 780001, reviewId: 4, evidenceVersion: "a".repeat(64), note: "Explicit review of saved evidence.", confirm: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(f.transactions).toBe(1); expect(f.queries).toHaveLength(1);
  expect(f.queries[0].sql).toContain("for update");
  expect(f.queries[0].sql).toContain("`aperture_pending_outcomes`.`id` = ?");
  expect(f.queries[0].params).toContain(4);
  expect(f.queries.some(q => /^(update|insert|delete)/i.test(q.sql))).toBe(false);
});
