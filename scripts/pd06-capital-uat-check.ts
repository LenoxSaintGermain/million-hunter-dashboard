/** Exercises real loopback tRPC + isolated SQL. Separate fixture so the browser
 * manifest remains unbound. No providers, orders, deletes or global resets. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { apertureDecisionRevisions } from "../drizzle/schema";
import { parsePersistedJson } from "../shared/persistedJson";
import { openEvidenceUatDatabase } from "./sec-evidence-local-db";
import { prepareCapitalUatFixture } from "./pd06-capital-uat-fixture";
import { createDealEvidenceRepository } from "../server/dealEvidenceRepository";

const connection = openEvidenceUatDatabase();
const base = "http://127.0.0.1:3150/api/trpc/success/";
async function call(path: string, input: unknown, mutation = false) {
  const encoded = JSON.stringify({ json: input });
  const response = await fetch(base + path + (mutation ? "" : "?input=" + encodeURIComponent(encoded)), mutation
    ? { method: "POST", headers: { "content-type": "application/json" }, body: encoded } : {});
  const body = await response.json();
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result.data.json;
}
try {
  const fixture = await prepareCapitalUatFixture(connection);
  const runs = await createDealEvidenceRepository(async () => connection.db).listRuns(fixture.ownerId, fixture.ownerId);
  const analysis = runs.find(run => run.status === "complete" && run.output?.outputVersion === 2);
  assert.ok(analysis, "Save a controlled successful v2 run in the success DealDetail first.");
  const scope = { decisionRunId: fixture.decisionRunId, revisionId: fixture.revisionId, candidateId: fixture.candidateId };
  const unbound = await call("aperture.capitalEvidence.context", scope);
  assert.equal(unbound.reason, "evidence_context_not_bound");
  const choices = await call("aperture.capitalEvidence.choices", { ...scope, dealId: analysis.dealId, analysisRunId: analysis.id, securityId: fixture.securityId });
  assert.ok(choices.findings.length); assert.ok(choices.criteria.length);
  assert.equal(choices.binding.criterionBindings, undefined, "Choices must not silently select a pairing");
  // Explicit test selection, not a UI default or an automatically seeded binding.
  const criterion = choices.criteria.find((item: { field: string }) => item.field === "evidenceRequirements");
  assert.ok(criterion);
  const input = { ...scope, expectedLockVersion: choices.expectedLockVersion, requestId: randomUUID(), confirmed: true,
    binding: { ...choices.binding, criterionBindings: [{ findingId: choices.findings[0].id, field: criterion.field, index: criterion.index }] } };
  const saved = await call("aperture.capitalEvidence.confirmBinding", input, true);
  assert.notEqual(saved.revisionId, scope.revisionId);
  const replay = await call("aperture.capitalEvidence.confirmBinding", input, true);
  assert.equal(replay.revisionId, saved.revisionId); assert.equal(replay.created, false);
  const context = await call("aperture.capitalEvidence.context", { ...scope, revisionId: saved.revisionId });
  assert.ok(["ready", "needs_reassessment"].includes(context.status));
  assert.equal(context.authority, "research_only"); assert.equal(context.findings.length, 1);
  const board = await call("aperture.run.get", { id: fixture.runId });
  assert.equal(board.decisionAuthority.revisionId, saved.revisionId);
  const [prior] = await connection.db.select().from(apertureDecisionRevisions).where(eq(apertureDecisionRevisions.id, scope.revisionId));
  assert.equal(parsePersistedJson(prior.contextSnapshot)?.evidenceContext, undefined);
  console.log(JSON.stringify({ ok: true, synthetic: true, fixture, newRevisionId: saved.revisionId,
    checks: "unbound read, explicit choices, explicit criterion selection, bind, immutable prior revision, replay, read context, current-head CandidateBoard adapter" }));
} finally { await connection.pool.end(); }
