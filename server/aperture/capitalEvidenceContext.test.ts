import { describe, expect, it, vi } from "vitest";
import { capitalEvidenceBindingSchema, capitalEvidenceScopeSchema } from "../../shared/capitalEvidenceContext";
import { DEAL_EVIDENCE_PROMPT_VERSION, SEC_ANALYSIS_LIMITATION } from "../../shared/dealEvidence";
import { capitalEvidenceHash, createCapitalEvidenceConsumer, projectCapitalEvidenceContext,
  validateCapitalEvidenceBinding, type CapitalEvidenceRecords } from "./capitalEvidenceContext";

const now = Date.parse("2026-10-12T12:00:00Z");
const scope = { decisionRunId: 10, revisionId: 11, candidateId: 12 };
const uuid = "11111111-1111-4111-8111-111111111111";
function fixture(): CapitalEvidenceRecords {
  const snapshot = { schemaVersion: 1, promptVersion: DEAL_EVIDENCE_PROMPT_VERSION, limitation: SEC_ANALYSIS_LIMITATION,
    deal: { id: 20, name: "Illustrative issuer", description: null, industry: null, location: null,
      revenue: null, cashFlow: null, askingPrice: null, multiple: null, employees: null, yearEstablished: null },
    evidence: [{ attachmentId: uuid, receiptId: uuid, payloadHash: "a".repeat(64), cik: "0000000001", issuerName: "Illustrative issuer",
      sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json", retrievedAt: new Date(now - 10000).toISOString(),
      expiresAt: new Date(now + 10000).toISOString(), staleAtRun: false, relation: "same_legal_entity",
      identityBasis: "owner_confirmed_not_independently_verified", status: "ok", totalFilings: 1, includedFilings: 1 }],
    citations: [{ id: "E1", receiptId: uuid, payloadHash: "a".repeat(64), sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json", fact: "Illustrative SEC metadata only." }], gaps: [] };
  const binding = { version: 1, kind: "sec_metadata_research", ownerId: 1, decisionRunId: 10, researchRunId: 13,
    candidateId: 12, canonicalThesisId: 14, capitalThesisId: 15, accountId: 16, securityId: 17,
    cik: "0000000001", symbol: "TEST", dealId: 20, analysisRunId: uuid,
    analysisSnapshotHash: capitalEvidenceHash(snapshot), thesisSnapshotHash: capitalEvidenceHash({ beliefs: ["Illustrative belief"] }),
    criterionBindings: [{ findingId: "f1", field: "beliefs", index: 0 }],
    confirmedByUserId: 1, confirmedAt: now - 1000,
    identityBasis: "operator_confirmed_security_cik_not_independently_verified", relation: "same_legal_entity" };
  return {
    decision: { id: 10, userId: 1, contextKind: "thesis", canonicalThesisId: 14, capitalThesisId: 15,
      accountId: 16, researchRunId: 13, currentRevisionId: 11, lifecycle: "researching" },
    revision: { id: 11, decisionRunId: 10, createdByUserId: 1, createdAt: now,
      contextSnapshot: { contextKind: "thesis", canonicalThesisId: 14, capitalThesisId: 15, accountId: 16, evidenceContext: binding },
      gateSnapshot: { mandateVersion: "illustrative-v1" } },
    research: { id: 13, userId: 1, thesisId: 15, accountId: 16 },
    candidate: { id: 12, runId: 13, symbol: "TEST" },
    thesis: { id: 15, userId: 1, sourceCompilationId: 14, status: "active", graph: { beliefs: ["Illustrative belief"] } },
    canonical: { id: 14, userId: 1, templateUsed: "capital_trade", status: "active" },
    account: { id: 16, userId: 1 }, security: { id: 17, symbol: "TEST", cik: "0000000001", assetType: "equity" },
    deal: { id: 20, ownerUserId: 1, isArchived: false },
    analysis: { id: uuid, ownerId: 1, dealId: 20, status: "complete", completedAt: new Date(now - 2000), inputSnapshot: snapshot },
    findings: [{ id: "f1", criterion: "filing review", statement: "Review the underlying filing before interpreting its significance.", classification: "hypothesis", citationIds: ["E1"] }],
  };
}
function binding(rows: CapitalEvidenceRecords) { return (rows.revision.contextSnapshot as any).evidenceContext; }
function repin(rows: CapitalEvidenceRecords) { binding(rows).analysisSnapshotHash = capitalEvidenceHash(rows.analysis.inputSnapshot); }

describe("Capital evidence context, read-only", () => {
  it("validates exact owned context and returns research-only findings without mutating inputs", () => {
    const rows = fixture(), before = structuredClone(rows);
    const result = projectCapitalEvidenceContext(1, scope, rows, now);
    expect(result.status).toBe("ready");
    expect(result.authority).toBe("research_only");
    expect(result.findings[0]).toMatchObject({ classification: "hypothesis", receiptIds: [uuid], nextAction: "review_research_basis" });
    expect(result.attention).toHaveLength(1);
    expect(result.attention[0].resolution).toBe("not_recorded");
    expect(rows).toEqual(before);
    expect(result).not.toHaveProperty("rankScore");
    expect(result).not.toHaveProperty("paperOrderEligible");
  });
  it.each([
    ["decision owner", (r: CapitalEvidenceRecords) => { r.decision.userId = 2; }],
    ["revision owner", (r: CapitalEvidenceRecords) => { r.revision.createdByUserId = 2; }],
    ["research owner", (r: CapitalEvidenceRecords) => { r.research.userId = 2; }],
    ["thesis owner", (r: CapitalEvidenceRecords) => { r.thesis.userId = 2; }],
    ["canonical owner", (r: CapitalEvidenceRecords) => { r.canonical.userId = 2; }],
    ["account owner", (r: CapitalEvidenceRecords) => { r.account.userId = 2; }],
    ["deal owner", (r: CapitalEvidenceRecords) => { r.deal.ownerUserId = 2; }],
    ["analysis owner", (r: CapitalEvidenceRecords) => { r.analysis.ownerId = 2; }],
    ["candidate run", (r: CapitalEvidenceRecords) => { r.candidate.runId = 99; }],
    ["candidate symbol", (r: CapitalEvidenceRecords) => { r.candidate.symbol = "OTHER"; }],
    ["security cik", (r: CapitalEvidenceRecords) => { r.security.cik = "0000000002"; }],
    ["security identity", (r: CapitalEvidenceRecords) => { r.security.id = 99; }],
    ["ETF", (r: CapitalEvidenceRecords) => { r.security.assetType = "etf"; }],
    ["options", (r: CapitalEvidenceRecords) => { r.security.assetType = "option"; }],
    ["revision", (r: CapitalEvidenceRecords) => { r.decision.currentRevisionId = 99; }],
    ["closed", (r: CapitalEvidenceRecords) => { r.decision.lifecycle = "closed"; }],
    ["objective", (r: CapitalEvidenceRecords) => { r.decision.contextKind = "objective"; }],
    ["acquisition", (r: CapitalEvidenceRecords) => { r.canonical.templateUsed = "acquisition"; }],
    ["thesis link", (r: CapitalEvidenceRecords) => { r.thesis.sourceCompilationId = 99; }],
    ["archived thesis", (r: CapitalEvidenceRecords) => { r.thesis.status = "archived"; }],
    ["archived deal", (r: CapitalEvidenceRecords) => { r.deal.isArchived = true; }],
    ["changed thesis", (r: CapitalEvidenceRecords) => { r.thesis.graph = { beliefs: ["Changed"] }; }],
    ["failed run", (r: CapitalEvidenceRecords) => { r.analysis.status = "failed"; }],
    ["pending run", (r: CapitalEvidenceRecords) => { r.analysis.status = "pending"; }],
    ["future confirmation", (r: CapitalEvidenceRecords) => { binding(r).confirmedAt = now + 1; }],
    ["future revision", (r: CapitalEvidenceRecords) => { r.revision.createdAt = now + 1; }],
    ["bad snapshot hash", (r: CapitalEvidenceRecords) => { binding(r).analysisSnapshotHash = "b".repeat(64); }],
    ["missing mandate", (r: CapitalEvidenceRecords) => { r.revision.gateSnapshot = {}; }],
    ["context account", (r: CapitalEvidenceRecords) => { (r.revision.contextSnapshot as any).accountId = 99; }],
  ] as const)("fails closed for %s", (_, mutate) => {
    const rows = fixture(); mutate(rows);
    expect(projectCapitalEvidenceContext(1, scope, rows, now)).toMatchObject({ status: "unavailable", findings: [], attention: [], source: null });
  });
  it("rejects mismatched receipt CIK even if the hash is correctly repinned", () => {
    const rows = fixture(); (rows.analysis.inputSnapshot as any).evidence[0].cik = "0000000002"; repin(rows);
    expect(projectCapitalEvidenceContext(1, scope, rows, now).status).toBe("unavailable");
  });
  it("does not infer a binding for a legacy record", () => {
    const rows = fixture(); delete (rows.revision.contextSnapshot as any).evidenceContext;
    expect(projectCapitalEvidenceContext(1, scope, rows, now).reason).toBe("evidence_context_not_bound");
  });
  it("separates current expiry from freshness at analysis time", () => {
    const rows = fixture(); (rows.analysis.inputSnapshot as any).evidence[0].expiresAt = new Date(now).toISOString(); repin(rows);
    expect(projectCapitalEvidenceContext(1, scope, rows, now)).toMatchObject({ status: "needs_reassessment", findings: [{ expiredNow: true, staleAtRun: false }] });
  });
  it("deduplicates attention across repeated reads and multiple findings", () => {
    const rows = fixture(); (rows.findings as any[]).push({ ...(rows.findings as any[])[0], id: "f2" });
    binding(rows).criterionBindings.push({ findingId: "f2", field: "beliefs", index: 0 });
    const result = projectCapitalEvidenceContext(1, scope, rows, now);
    expect(result.attention).toHaveLength(1);
    expect(result.attention[0].findingIds).toEqual(["f1", "f2"]);
    expect(projectCapitalEvidenceContext(1, scope, rows, now).attention).toEqual(result.attention);
  });
  it("rejects duplicate finding IDs and unknown source citations", () => {
    const rows = fixture(); (rows.findings as any[]).push((rows.findings as any[])[0]);
    expect(projectCapitalEvidenceContext(1, scope, rows, now).status).toBe("unavailable");
    rows.findings = [{ ...(rows.findings as any[])[0], citationIds: ["E3"] }];
    expect(projectCapitalEvidenceContext(1, scope, rows, now).reason).toBe("unbound_finding_citation");
  });
  it("does not project legacy prose or a verified-fact claim as a hypothesis", () => {
    const rows = fixture(); rows.findings = ["Legacy summary"];
    expect(projectCapitalEvidenceContext(1, scope, rows, now).status).toBe("unavailable");
    rows.findings = [{ id: "a", criterion: "a", statement: "a", classification: "verified", citationIds: ["E1"] }];
    expect(projectCapitalEvidenceContext(1, scope, rows, now).status).toBe("unavailable");
  });
  it("fails visibly on storage failure and never substitutes a result", async () => {
    const load = vi.fn().mockRejectedValue(new Error("secret storage details"));
    const read = createCapitalEvidenceConsumer({ load });
    const result = await read(1, scope);
    expect(result.reason).toBe("context_read_failed");
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(1, scope);
  });
  it("rejects injected client binding and malformed IDs", async () => {
    expect(capitalEvidenceScopeSchema.safeParse({ ...scope, evidenceContext: binding(fixture()) }).success).toBe(false);
    const load = vi.fn(); const read = createCapitalEvidenceConsumer({ load });
    await expect(read(0, scope)).rejects.toThrow(); expect(load).not.toHaveBeenCalled();
  });
  it("requires an explicitly pinned, existing thesis criterion", () => {
    const rows = fixture(); binding(rows).criterionBindings[0].index = 99;
    expect(projectCapitalEvidenceContext(1, scope, rows, now).status).toBe("unavailable");
    binding(rows).criterionBindings[0].index = 0;
    expect(projectCapitalEvidenceContext(1, scope, rows, now).findings[0].criterion).toBe("Illustrative belief");
  });
  it("rejects parent/competitor attestation and supports canonical hash ordering", () => {
    expect(capitalEvidenceBindingSchema.safeParse({ ...binding(fixture()), relation: "competitor" }).success).toBe(false);
    expect(capitalEvidenceHash({ a: 1, b: 2 })).toBe(capitalEvidenceHash({ b: 2, a: 1 }));
    expect(() => capitalEvidenceHash({ a: undefined })).toThrow();
    expect(() => validateCapitalEvidenceBinding(2, scope, fixture(), binding(fixture()), now)).toThrow();
  });
});
