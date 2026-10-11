/** Non-destructive local admission check. No fetch, DDL, reset, or cleanup deletes.
 * Consumes ten real admission slots; retains its unique owner budget row.
 * DATABASE_URL= NODE_ENV=development pnpm exec tsx scripts/sec-evidence-admission-check.ts
 */
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { createEvidenceRepository } from "../server/evidenceRepository";
import { openEvidenceUatDatabase } from "./sec-evidence-local-db";

const { pool, db } = openEvidenceUatDatabase();
const repo = createEvidenceRepository(async () => db);
try {
  const [identity] = await pool.query<RowDataPacket[]>("SELECT DATABASE() AS db, VERSION() AS version");
  assert.equal(identity[0].db, "signal_evidence_uat");
  const [before] = await pool.query<RowDataPacket[]>("SELECT * FROM public_evidence_receipts");
  const ownerId = randomInt(1_500_000_000, 2_000_000_000);
  const ownerKey = `sec-capture-attempt:owner:${ownerId}`;
  const [used] = await pool.query<RowDataPacket[]>(`SELECT owner_id FROM public_evidence_receipts WHERE owner_id = ?
    UNION ALL SELECT owner_id FROM public_evidence_capture_claims WHERE owner_id = ?
    UNION ALL SELECT 1 FROM public_evidence_budgets WHERE budget_key IN (?, ?)`,
    [ownerId, ownerId, ownerKey, `sec-submissions:owner:${ownerId}`]);
  assert.equal(used.length, 0, "Owner collision: rerun without changing existing rows.");
  const [clock] = await pool.query<RowDataPacket[]>(`SELECT FLOOR(UNIX_TIMESTAMP()/60)*60 AS minute,
    MOD(FLOOR(UNIX_TIMESTAMP()),60) AS second`);
  assert.ok(Number(clock[0].second) < 45, "Too near minute rollover; rerun in the next minute. No quota consumed.");
  const [global] = await pool.query<RowDataPacket[]>(`SELECT window_start, request_count FROM public_evidence_budgets
    WHERE budget_key = 'sec-capture-attempt:global'`);
  const currentCount = global[0] && Number(global[0].window_start) >= Number(clock[0].minute)
    ? Number(global[0].request_count) : 0;
  assert.ok(currentCount <= 49, "Insufficient global headroom; no quota consumed. Rerun later.");
  for (let i = 0; i < 10; i++) await repo.reserveCaptureAttempt(ownerId);
  await assert.rejects(repo.reserveCaptureAttempt(ownerId), error =>
    error instanceof Error && "code" in error && error.code === "RATE_LIMITED"
    && error.message === "Owner capture admission budget exceeded.");
  const [owner] = await pool.query<RowDataPacket[]>("SELECT * FROM public_evidence_budgets WHERE budget_key = ?", [ownerKey]);
  assert.equal(Number(owner[0].request_count), 10);
  assert.equal(Number(owner[0].window_start), Number(clock[0].minute), "Minute rolled over: result is inconclusive.");
  const [claims] = await pool.query<RowDataPacket[]>("SELECT * FROM public_evidence_capture_claims WHERE owner_id = ?", [ownerId]);
  const [receipts] = await pool.query<RowDataPacket[]>("SELECT * FROM public_evidence_receipts WHERE owner_id = ?", [ownerId]);
  assert.equal(claims.length, 0);
  assert.equal(receipts.length, 0);
  const [after] = await pool.query<RowDataPacket[]>("SELECT * FROM public_evidence_receipts");
  for (const receipt of before) assert.deepEqual(after.find(row => row.id === receipt.id), receipt, "Existing receipt changed.");
  console.log(JSON.stringify({ status: "PASS", database: identity[0].db, version: identity[0].version,
    ownerId, accepted: 10, eleventh: "owner RATE_LIMITED", persistedOwnerCount: 10,
    claims: 0, receipts: 0, existingReceiptsRetained: before.length,
    globalCountBefore: currentCount, globalConcurrencyTest: "not run; browser budget preserved",
    cleanup: "none; ten admission slots and unique owner budget row retained" }));
} finally {
  await pool.end();
}
