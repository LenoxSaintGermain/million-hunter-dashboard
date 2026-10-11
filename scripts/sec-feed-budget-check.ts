/** Fixed-local integration check: no fetch, DDL, deletes, or counter resets.
 * Retains the test caller row; exhausts Frankfurter's current minute quota.
 * DATABASE_URL= NODE_ENV=development pnpm exec tsx scripts/sec-feed-budget-check.ts
 */
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { RowDataPacket } from "mysql2";
import { createEvidenceRepository } from "../server/evidenceRepository";
import { openEvidenceUatDatabase } from "./sec-evidence-local-db";

const { pool, db } = openEvidenceUatDatabase();
const repo = createEvidenceRepository(async () => db);
const rateLimited = (error: unknown) => error instanceof Error && "code" in error && error.code === "RATE_LIMITED";
async function clock() {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT FLOOR(UNIX_TIMESTAMP()/60)*60 AS minute, MOD(FLOOR(UNIX_TIMESTAMP()),60) AS second");
  return { minute: Number(rows[0].minute), second: Number(rows[0].second) };
}
try {
  const [identity] = await pool.query<RowDataPacket[]>("SELECT DATABASE() AS db, VERSION() AS version");
  assert.equal(identity[0].db, "signal_evidence_uat");
  let time = await clock();
  if (time.second >= 40) {
    console.log("Waiting for a fresh DB minute; no counters reset.");
    await delay((61 - time.second) * 1000);
    time = await clock();
  }
  const [receiptsBefore] = await pool.query<RowDataPacket[]>("SELECT * FROM public_evidence_receipts ORDER BY id");
  const [claimsBefore] = await pool.query<RowDataPacket[]>("SELECT * FROM public_evidence_capture_claims ORDER BY owner_id, request_id");
  const ownerId = randomInt(1_500_000_000, 2_000_000_000);
  const callerKey = `public-feed:caller:${ownerId}`;
  const [used] = await pool.query<RowDataPacket[]>(`SELECT owner_id FROM public_evidence_receipts WHERE owner_id = ?
    UNION ALL SELECT owner_id FROM public_evidence_capture_claims WHERE owner_id = ?
    UNION ALL SELECT 1 FROM public_evidence_budgets WHERE budget_key IN (?, ?, ?)`,
    [ownerId, ownerId, callerKey, `sec-capture-attempt:owner:${ownerId}`, `sec-submissions:owner:${ownerId}`]);
  assert.equal(used.length, 0, "Test owner collision; rerun without changing existing rows.");
  const providerKey = "public-feed:provider:frankfurter";
  const [providerBefore] = await pool.query<RowDataPacket[]>("SELECT * FROM public_evidence_budgets WHERE budget_key = ?", [providerKey]);
  assert.ok(!providerBefore[0] || Number(providerBefore[0].window_start) <= time.minute, "Future quota window; abort.");
  const priorCount = providerBefore[0] && Number(providerBefore[0].window_start) === time.minute ? Number(providerBefore[0].request_count) : 0;
  assert.ok(Number.isInteger(priorCount) && priorCount >= 0 && priorCount < 60, "No provider headroom; rerun next minute.");
  for (let i = 0; i < 30; i++) await repo.reserveFeedCaller(ownerId);
  await assert.rejects(repo.reserveFeedCaller(ownerId), rateLimited);
  // Competing transactions use the real pool: exactly the remaining slots win.
  const outcomes = await Promise.allSettled(Array.from({ length: 61 - priorCount }, () => repo.reserveFeedProvider("frankfurter")));
  assert.equal(outcomes.filter(outcome => outcome.status === "fulfilled").length, 60 - priorCount);
  const rejected = outcomes.filter(outcome => outcome.status === "rejected");
  assert.equal(rejected.length, 1);
  assert.ok(rateLimited(rejected[0].reason));
  const [counts] = await pool.query<RowDataPacket[]>("SELECT * FROM public_evidence_budgets WHERE budget_key IN (?, ?)", [callerKey, providerKey]);
  for (const [key, expected] of [[callerKey, 30], [providerKey, 60]] as const) {
    const row = counts.find(row => row.budget_key === key);
    assert.equal(Number(row?.request_count), expected);
    assert.equal(Number(row?.window_start), time.minute, "Window rollover makes check inconclusive.");
  }
  assert.equal((await clock()).minute, time.minute, "Window rollover makes check inconclusive.");
  const [receiptsAfter] = await pool.query<RowDataPacket[]>("SELECT * FROM public_evidence_receipts ORDER BY id");
  const [claimsAfter] = await pool.query<RowDataPacket[]>("SELECT * FROM public_evidence_capture_claims ORDER BY owner_id, request_id");
  assert.deepEqual(receiptsAfter, receiptsBefore);
  assert.deepEqual(claimsAfter, claimsBefore);
  console.log(JSON.stringify({ status: "PASS", database: identity[0].db, version: identity[0].version,
    ownerId, callerAccepted: 30, caller31: "RATE_LIMITED", provider: "frankfurter", providerPriorCount: priorCount,
    providerConcurrentAccepted: 60 - priorCount, provider61: "RATE_LIMITED", persistedCallerCount: 30,
    persistedProviderCount: 60, receiptsUnchanged: receiptsBefore.length, claimsUnchanged: claimsBefore.length,
    providerWindowClearsAt: new Date((time.minute + 60) * 1000).toISOString(), cleanup: "none; counters retained" }));
} finally {
  await pool.end();
}
