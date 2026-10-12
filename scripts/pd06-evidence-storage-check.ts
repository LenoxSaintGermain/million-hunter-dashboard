/** Real SQL, synthetic fixtures, zero provider calls. Fixed local UAT only.
 * Requires compatible 0073. Appends uniquely identified fixtures; no deletes,
 * rollback migrations, or budget resets. Existing SEC receipts are preserved.
 */
import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { deals } from "../drizzle/schema";
import { openEvidenceUatDatabase } from "./sec-evidence-local-db";
import { createDealEvidenceRepository } from "../server/dealEvidenceRepository";
import { createDealEvidenceService } from "../server/dealEvidenceService";
import { createEvidenceRepository } from "../server/evidenceRepository";
import { evidencePayloadHash } from "../server/evidenceService";
import { DEAL_EVIDENCE_PROMPT_VERSION } from "../shared/dealEvidence";
import type { SecSubmissionsResult } from "../shared/secEvidence";
import { inspectPd06Schema, readMetadata } from "./pd06-evidence-schema.mjs";

const { pool, db } = openEvidenceUatDatabase();
const owner = randomInt(100_000_000, 900_000_000);
const foreign = owner + 1;
const dealId = owner;
const repo = createDealEvidenceRepository(async () => db);
const other = createDealEvidenceRepository(async () => db);
const evidence = createEvidenceRepository(async () => db);
const quoteId = (snapshot: { citations: { id: string; fact: string }[] }) => [{ citationId: snapshot.citations[0].id, quote: snapshot.citations[0].fact }];
let engineCalls = 0;
const service = createDealEvidenceService({ repository: repo, evidence,
  resolveModels: async mode => mode === "ic" ? ["synthetic-a", "synthetic-b", "synthetic-c"] : ["synthetic-a"],
  engine: async (mode, snapshot, models) => {
    engineCalls++;
    const citations = quoteId(snapshot);
    return mode === "red_team" ? { killProbability: 0.5, redFlags: [], summary: "Synthetic storage fixture, not a decision.", citations }
      : { scores: models.map(model => ({ model, score: 0.5, rationale: "Synthetic storage fixture.", citations })),
        consensusScore: 0.5, divergenceScore: 0, divergenceFlag: false, summary: "Synthetic IC fixture." };
  },
});
async function appendReceipt(message: string) {
  const retrievedAt = new Date();
  const payload: SecSubmissionsResult = { status: "empty", sourceUrl: "https://data.sec.gov/submissions/CIK0000000123.json",
    retrievedAt: retrievedAt.toISOString(), company: { cik: "0000000123", name: "Illustrative PD06 storage issuer" },
    filings: [], failureCode: null, message };
  return evidence.append({ ownerId: owner, subjectKey: "sec:CIK0000000123", requestId: randomUUID(), provider: "sec-submissions",
    schemaVersion: 1, sourceUrl: payload.sourceUrl, status: "empty", payload, payloadHash: evidencePayloadHash(payload),
    retrievedAt, expiresAt: new Date(retrievedAt.getTime() + 86400000), failureCode: null, message });
}
try {
  const [[identity]] = await pool.query("SELECT DATABASE() AS name");
  assert.equal((identity as { name: string }).name, "signal_evidence_uat");
  assert.equal(inspectPd06Schema(await readMetadata(pool)).compatible, true, "Apply the frozen 0073 schema first.");
  const [prior] = await pool.query("SELECT * FROM public_evidence_receipts ORDER BY id");
  const preserved = new Map((prior as { id: string }[]).map(row => [row.id, JSON.stringify(row)]));
  const [tables] = await pool.query("SHOW TABLES LIKE 'deals'");
  if (!(tables as unknown[]).length) {
    // Minimal projection fixture, not a production deals migration. All selected
    // columns must exist for the actual repository SELECT; only ownership/name
    // fields are populated. Never replace an existing deals table.
    const columns = Object.values(getTableColumns(deals)).map(column =>
      `\`${column.name}\` ${column.getSQLType()} ${column.name === "id" ? "PRIMARY KEY" : "NULL"}`);
    await pool.query(`CREATE TABLE deals (${columns.join(",")}) ENGINE=InnoDB`);
  }
  await pool.query("INSERT INTO deals (id,owner_user_id,name,isArchived,stage,is_synthetic) VALUES (?,?,?,false,'new',true),(?,?,?,true,'new',true),(?,NULL,?,false,'new',true)",
    [dealId, owner, "Synthetic PD06 storage test", dealId + 1, owner, "Synthetic archived test", dealId + 2, "Synthetic unowned test"]);
  assert.equal((await repo.getDeal(owner, dealId))?.id, dealId);
  assert.equal(await repo.getDeal(foreign, dealId), null);
  assert.equal(await repo.getDeal(owner, dealId + 1), null);
  assert.equal(await repo.getDeal(owner, dealId + 2), null);
  const receipt = await appendReceipt("Synthetic first version");
  const attachInput = { dealId, receiptId: receipt.id, requestId: randomUUID(), confirmedCik: "0000000123", relation: "same_legal_entity" as const, confirmed: true as const };
  await assert.rejects(service.attach(foreign, attachInput), { code: "NOT_FOUND" });
  const attachments = await Promise.all(Array.from({ length: 4 }, () => service.attach(owner, attachInput)));
  const attachment = attachments[0];
  assert.equal(new Set(attachments.map(row => row.id)).size, 1);
  assert.equal(await other.getAttachment(foreign, dealId, attachment.id), null);
  assert.deepEqual(await other.listAttachments(foreign, dealId), []);
  const input = { dealId, requestId: randomUUID(), attachmentIds: [attachment.id] };
  const first = await service.runRedTeam(owner, input);
  assert.equal(first.status, "complete");
  assert.equal(first.inputSnapshot.promptVersion, DEAL_EVIDENCE_PROMPT_VERSION);
  assert.deepEqual(await other.getRun(owner, dealId, first.id), first);
  assert.equal((await service.runRedTeam(owner, input)).id, first.id);
  assert.equal(engineCalls, 1);
  assert.equal(await other.getRun(foreign, dealId, first.id), null);
  assert.equal(await other.findRequest(foreign, input.requestId), null);
  assert.deepEqual(await other.listRuns(foreign, dealId), []);
  await assert.rejects(service.getRun(foreign, { dealId, id: first.id }), { code: "NOT_FOUND" });
  await assert.rejects(service.runIC(owner, input), { code: "CONFLICT" });
  const claimsInput = { ownerId: owner, dealId, requestId: randomUUID(), requestHash: "a".repeat(64), mode: "red_team" as const, models: first.models, inputSnapshot: first.inputSnapshot };
  const claims = await Promise.all(Array.from({ length: 4 }, (_, i) => (i % 2 ? repo : other).start(claimsInput)));
  assert.equal(claims.filter(c => c.claimed).length, 1);
  assert.equal(new Set(claims.map(c => c.run.id)).size, 1);
  await assert.rejects(repo.start({ ...claimsInput, requestHash: "b".repeat(64) }), { code: "CONFLICT" });
  const failed = await repo.finish({ id: claims[0].run.id, ownerId: owner, dealId, status: "failed", output: null,
    failureCode: "PROVIDER_UNAVAILABLE", message: "Synthetic failure", completedAt: new Date() });
  assert.equal((await other.getRun(owner, dealId, failed.id))?.output, null);
  assert.deepEqual(await repo.finish({ id: failed.id, ownerId: owner, dealId, status: "complete", output: first.output,
    failureCode: null, message: null, completedAt: new Date() }), failed, "First completion must remain immutable");
  const ic = await service.runIC(owner, { ...input, requestId: randomUUID() });
  assert.equal(ic.status, "complete"); assert.equal(ic.models.length, 3);
  assert.deepEqual(await other.getRun(owner, dealId, ic.id), ic);
  const failingService = createDealEvidenceService({ repository: repo, evidence, resolveModels: async () => ["synthetic-a"],
    engine: async () => { throw new Error("Synthetic offline provider"); } });
  const failure = await failingService.runRedTeam(owner, { ...input, requestId: randomUUID() });
  assert.equal(failure.status, "failed"); assert.equal(failure.failureCode, "PROVIDER_UNAVAILABLE"); assert.equal(failure.output, null);
  assert.deepEqual(await other.getRun(owner, dealId, failure.id), failure);
  const newer = await appendReceipt("Synthetic newer version");
  const newAttachment = await service.attach(owner, { ...attachInput, requestId: randomUUID(), receiptId: newer.id });
  await assert.rejects(service.attach(owner, { ...attachInput, receiptId: newer.id }), { code: "CONFLICT" });
  const newRun = await service.runRedTeam(owner, { ...input, requestId: randomUUID(), attachmentIds: [newAttachment.id] });
  assert.equal(newRun.inputSnapshot.evidence[0].receiptId, newer.id);
  assert.deepEqual(await other.getRun(owner, dealId, first.id), first);
  const [after] = await pool.query("SELECT * FROM public_evidence_receipts ORDER BY id");
  const current = new Map((after as { id: string }[]).map(row => [row.id, JSON.stringify(row)]));
  for (const [id, value] of preserved) assert.equal(current.get(id), value, "Pre-existing SEC receipt changed");
  console.log(JSON.stringify({ ok: true, owner, dealId, synthetic: true, engineCalls,
    checks: "SQL deal/receipt/attachment/run isolation, concurrent claims, replay/conflict, RT+IC JSON readback, prompt version, persisted failures, immutable completion/history, prior SEC receipts unchanged",
    cleanup: "None; synthetic fixtures retained. No provider calls or budget resets." }));
} finally { await pool.end(); }
