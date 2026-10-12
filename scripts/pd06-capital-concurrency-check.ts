/** Real MariaDB REPEATABLE READ regression; no product hooks or mocked SQL.
 * Pauses the writer immediately after its first nonlocking revision read, then
 * commits a mutable-source change on another connection before validation.
 * New synthetic rows only. Browser fixtures and existing receipts stay intact.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { openEvidenceUatDatabase } from "./sec-evidence-local-db";
import { prepareCapitalUatFixture } from "./pd06-capital-uat-fixture";
import { createDealEvidenceRepository } from "../server/dealEvidenceRepository";
import { createCapitalEvidenceBindingService } from "../server/aperture/capitalEvidenceRepository";
import { aperturePendingOutcomes } from "../drizzle/schema";

const local = openEvidenceUatDatabase();
const evidence = createDealEvidenceRepository(async () => local.db);
try {
  const source = (await evidence.listRuns(987653100, 987653100)).find(row => row.status === "complete" && row.output?.outputVersion === 2);
  assert.ok(source, "Requires a saved synthetic v2 success analysis from the local harness.");
  for (const change of ["thesis", "archive"] as const) {
    const fixture = await prepareCapitalUatFixture(local);
    const dealId = fixture.runId;
    await local.pool.execute("INSERT INTO deals (id,owner_user_id,name,isArchived,stage,is_synthetic) VALUES (?,?,?,false,'new',true)",
      [dealId, fixture.ownerId, `Synthetic concurrency ${change}`]);
    const snapshot = structuredClone(source.inputSnapshot);
    snapshot.deal.id = dealId; snapshot.deal.name = `Synthetic concurrency ${change}`;
    const claim = await evidence.start({ ownerId: fixture.ownerId, dealId, requestId: randomUUID(), requestHash: "c".repeat(64),
      mode: source.mode, models: source.models, inputSnapshot: snapshot });
    const analysis = await evidence.finish({ id: claim.run.id, ownerId: fixture.ownerId, dealId, status: "complete", output: source.output,
      failureCode: null, message: null, completedAt: new Date() });
    const now = Date.now();
    await local.db.insert(aperturePendingOutcomes).values({ userId: fixture.ownerId, decisionRunId: fixture.decisionRunId,
      revisionId: fixture.revisionId, kind: "gate_review", status: "pending", dueAt: now + 60000,
      reviewBasis: "Synthetic unchanged pending sentinel", createdAt: now, updatedAt: now });
    const scope = { decisionRunId: fixture.decisionRunId, revisionId: fixture.revisionId, candidateId: fixture.candidateId };
    const service = createCapitalEvidenceBindingService({ database: async () => local.db });
    const choices = await service.choices(fixture.ownerId, { ...scope, securityId: fixture.securityId, dealId, analysisRunId: analysis.id });
    const criterion = choices.criteria.find(item => item.field === "evidenceRequirements")!;
    const input = { ...scope, expectedLockVersion: choices.expectedLockVersion, requestId: randomUUID(), confirmed: true as const,
      binding: { ...choices.binding, criterionBindings: [{ findingId: choices.findings[0].id, field: criterion.field, index: criterion.index }] } };
    const state = async () => {
      const [head] = await local.pool.execute("SELECT * FROM aperture_decision_runs WHERE id=?", [fixture.decisionRunId]);
      const [revisions] = await local.pool.execute("SELECT * FROM aperture_decision_revisions WHERE decision_run_id=? ORDER BY id", [fixture.decisionRunId]);
      const [pending] = await local.pool.execute("SELECT * FROM aperture_pending_outcomes WHERE decision_run_id=? ORDER BY id", [fixture.decisionRunId]);
      return JSON.stringify({ head, revisions, pending });
    };
    const before = await state();
    const connection = await local.pool.getConnection();
    let paused = false;
    try {
      await connection.query("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await connection.query("SET SESSION innodb_lock_wait_timeout=5");
      const [[isolation]] = await connection.query<any[]>("SELECT @@tx_isolation AS isolationLevel");
      assert.equal(isolation.isolationLevel, "REPEATABLE-READ");
      const proxy = new Proxy(connection, { get(target, key) {
        if (key === "query") return async (...args: any[]) => {
          const result = await (target.query as any)(...args);
          const sql = typeof args[0] === "string" ? args[0] : args[0]?.sql ?? "";
          if (!paused && /^select /i.test(sql) && /from `aperture_decision_revisions`/i.test(sql) && !/for update/i.test(sql)) {
            paused = true;
            // The snapshot-establishing SELECT has completed. Hold its response
            // while another connection commits; no sleep/timing assumptions.
            if (change === "thesis") await local.pool.execute("UPDATE capital_theses SET graph=? WHERE id=? AND user_id=?",
              [JSON.stringify({ beliefs: ["Synthetic concurrently changed thesis"] }), fixture.runId, fixture.ownerId]);
            else await local.pool.execute("UPDATE deals SET isArchived=true WHERE id=? AND owner_user_id=?", [dealId, fixture.ownerId]);
          }
          return result;
        };
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      } });
      const writerDb = drizzle(proxy);
      const writer = createCapitalEvidenceBindingService({ database: async () => writerDb });
      await assert.rejects(writer.confirmBinding(fixture.ownerId, input), error => {
        // The internal validator may reject before the public router translates
        // its error; do not accept lock timeouts or unrelated driver failures.
        assert.ok((error as { code?: string }).code === "PRECONDITION_FAILED"
          || (error as Error).message === "Capital evidence context could not be verified", `Unexpected rejection: ${(error as Error).message}`);
        return true;
      }, `Concurrent ${change} must not be accepted from an old snapshot`);
      assert.equal(paused, true, "Controlled transaction pause was not reached");
      assert.equal(await state(), before, "Head, revision history, or pending outcomes changed despite rejection");
      console.log(JSON.stringify({ ok: true, change, fixture, isolation: "REPEATABLE-READ", pausedAfterRevisionRead: true, persistedDecisionStateUnchanged: true }));
    } finally { connection.release(); }
  }
} finally { await local.pool.end(); }
