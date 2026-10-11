/** Destructive ONLY to newly-created synthetic tables in the fixed disposable
 * local UAT database. Refuses to run if any feature table already exists.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { openEvidenceUatDatabase } from "./sec-evidence-local-db";
import { createEvidenceRepository } from "../server/evidenceRepository";
import { createEvidenceService } from "../server/evidenceService";
import type { SecSubmissionsResult } from "../shared/secEvidence";

const { pool, db } = openEvidenceUatDatabase();
const repo = createEvidenceRepository(async () => db);
const fixture: SecSubmissionsResult = {
  status: "empty", sourceUrl: "https://data.sec.gov/submissions/CIK0000000123.json",
  retrievedAt: "2026-10-11T12:00:00.000Z", company: { cik: "0000000123", name: "Illustrative storage test" },
  filings: [], failureCode: null, message: "Synthetic storage test only.",
};
const service = createEvidenceService({ repository: repo, enabled: () => true, fetch: async () => fixture });
async function sqlFile(file: string) {
  const source = await fs.readFile(new URL(file, import.meta.url), "utf8");
  for (const statement of source.split(";").map(s => s.trim()).filter(Boolean)) await pool.query(statement);
}
try {
  const [existing] = await pool.query("SHOW TABLES LIKE 'public_evidence_%'");
  assert.equal((existing as unknown[]).length, 0, "Refusing to replace existing UAT evidence tables.");
  await sqlFile("../drizzle/0072_public_evidence_receipts.sql");
  const claimRequest = randomUUID();
  const claims = await Promise.all(Array.from({ length: 8 }, () => repo.claimCapture(1001, claimRequest, "sec:CIK0000000123")));
  assert.equal(claims.filter(claim => claim.status === "claimed").length, 1);
  assert.equal(claims.filter(claim => claim.status === "pending").length, 7);
  assert.equal(new Set(claims.map(claim => claim.startedAt.getTime())).size, 1);
  assert.equal((await repo.claimCapture(1002, claimRequest, "sec:CIK0000000123")).status, "claimed");
  await assert.rejects(() => repo.claimCapture(1001, claimRequest, "sec:CIK0000000456"), { code: "CONFLICT" });
  assert.equal((await repo.claimCapture(1001, claimRequest, "sec:CIK0000000123")).status, "pending");
  const input = { cik: "123", requestId: randomUUID() };
  const captured = await service.capture(1001, input);
  assert.equal((await service.get(1001, { id: captured.id })).payload.company?.name, fixture.company?.name);
  assert.deepEqual(await service.list(1002, { cik: "123" }), []);
  await assert.rejects(() => service.get(1002, { id: captured.id }), { code: "NOT_FOUND" });
  assert.equal((await service.capture(1001, input)).id, captured.id);
  const { id: _id, recordedAt: _recordedAt, ...appendInput } = captured;
  const concurrentInput = { ...appendInput, requestId: randomUUID() };
  const duplicates = await Promise.all(Array.from({ length: 8 }, () => repo.append(concurrentInput)));
  assert.equal(new Set(duplicates.map(row => row.id)).size, 1);
  await assert.rejects(() => repo.append({ ...concurrentInput, subjectKey: "sec:CIK0000000456", sourceUrl: "https://data.sec.gov/submissions/CIK0000000456.json" }), { code: "CONFLICT" });
  const revision = await repo.append({ ...appendInput, requestId: randomUUID(), payload: { ...fixture, message: "Second synthetic revision" } });
  assert.notEqual(revision.id, captured.id);
  assert.equal((await repo.get(1001, captured.id))?.payload.message, fixture.message);
  const failure = await repo.append({ ...appendInput, requestId: randomUUID(), status: "unavailable", retrievedAt: null, expiresAt: null,
    failureCode: "TIMEOUT", message: "Synthetic timeout", payload: { ...fixture, status: "unavailable", retrievedAt: null, company: null, failureCode: "TIMEOUT" } });
  assert.equal((await repo.get(1001, failure.id))?.retrievedAt, null);
  // Expire test budgets explicitly in this disposable DB; do not wait for windows.
  await pool.query("UPDATE public_evidence_budgets SET window_start=0, second_start=0");
  const reservations = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => repo.reserveSecBudget(2000 + i)));
  assert.equal(reservations.filter(r => r.status === "fulfilled").length, 1, "Shared global second budget must serialize instances.");
  await pool.query("UPDATE public_evidence_budgets SET second_start=0");
  // Seed an exhausted owner minute budget using the actual current database window.
  await pool.query("INSERT INTO public_evidence_budgets (budget_key,window_start,request_count,second_start,second_count) VALUES ('sec-submissions:owner:3001',FLOOR(UNIX_TIMESTAMP()/60)*60,6,0,1)");
  await assert.rejects(() => repo.reserveSecBudget(3001), { code: "RATE_LIMITED" });
  await pool.query("UPDATE public_evidence_budgets SET window_start=0, second_start=0");
  await repo.reserveSecBudget(3001);
  // Cooldown is durable and monotonic across repository instances, and the SEC
  // index uses this same global row without manufacturing an owner-zero budget.
  const otherRepo = createEvidenceRepository(async () => db);
  const until = new Date(Date.now() + 60_000);
  await repo.setSecCooldown(until);
  await otherRepo.setSecCooldown(new Date(until.getTime() - 30_000));
  const [cooldownRows] = await pool.query("SELECT cooldown_until FROM public_evidence_budgets WHERE budget_key='sec-submissions:global'");
  assert.equal(Number((cooldownRows as { cooldown_until: number }[])[0].cooldown_until), until.getTime());
  await assert.rejects(() => otherRepo.reserveSecProviderBudget(), { code: "RATE_LIMITED" });
  await assert.rejects(() => otherRepo.reserveSecBudget(4001), { code: "RATE_LIMITED" });
  await pool.query("UPDATE public_evidence_budgets SET cooldown_until=0, window_start=0, second_start=0");
  await otherRepo.reserveSecProviderBudget();
  const [ownerZero] = await pool.query("SELECT * FROM public_evidence_budgets WHERE budget_key='sec-submissions:owner:0'");
  assert.equal((ownerZero as unknown[]).length, 0);
  await sqlFile("../drizzle/rollback/0072_public_evidence_receipts.down.sql");
  const [removed] = await pool.query("SHOW TABLES LIKE 'public_evidence_%'");
  assert.equal((removed as unknown[]).length, 0);
  await sqlFile("../drizzle/0072_public_evidence_receipts.sql");
  assert.deepEqual(await repo.list(1001, "sec:CIK0000000123"), []);
  console.log("PASS: isolated migration, durable readback, owner isolation, concurrent idempotency, durable single-winner claims, revision retention, null failure timestamps, distributed budget, monotonic cooldown, provider-only reservation, rollback and reapply. Synthetic rows removed by tested rollback; empty UAT schema ready.");
} finally { await pool.end(); }
