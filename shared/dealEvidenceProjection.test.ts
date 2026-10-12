import { describe, expect, it } from "vitest";
import { DEAL_EVIDENCE_FINDINGS_PROMPT_VERSION, DEAL_EVIDENCE_PROMPT_VERSION, SEC_ANALYSIS_LIMITATION } from "./dealEvidence";
import { projectDealEvidenceRun, selectDealEvidenceProjection, type DealEvidenceProjectionRun } from "./dealEvidenceProjection";

function fixture() {
  const id = "10000000-0000-4000-8000-000000000001";
  const sourceUrl = "https://data.sec.gov/submissions/CIK0000000001.json";
  const receiptId = "20000000-0000-4000-8000-000000000001";
  const citations = [{ citationId: "E1", quote: "Illustrative issuer metadata, not financial verification." }];
  const finding = { id: "I1", kind: "hypothesis", interpretation: "Financial diligence remains unresolved.", rationale: "This metadata does not report verified financials.", uncertainty: "Actual financial condition is unknown.", criterion: "financial_verification", action: "inspect_documents", citations };
  const snapshot = { schemaVersion: 1, promptVersion: DEAL_EVIDENCE_FINDINGS_PROMPT_VERSION, limitation: SEC_ANALYSIS_LIMITATION,
    deal: { id: 1, name: "Illustrative deal", description: null, industry: null, location: null, revenue: null, cashFlow: null, askingPrice: null, multiple: null, employees: null, yearEstablished: null },
    evidence: [{ attachmentId: id, receiptId, payloadHash: "a".repeat(64), cik: "0000000001", issuerName: "Illustrative issuer", sourceUrl, retrievedAt: "2026-10-11T10:00:00.000Z", expiresAt: "2026-10-12T10:00:00.000Z", staleAtRun: false, relation: "same_legal_entity", identityBasis: "owner_confirmed_not_independently_verified", status: "empty", totalFilings: 0, includedFilings: 0 }],
    citations: [{ id: "E1", receiptId, payloadHash: "a".repeat(64), sourceUrl, fact: citations[0].quote }], gaps: ["Financial diligence missing."] };
  const output = { outputVersion: 2, insights: [finding], killProbability: 0.4, summary: "A hypothesis, not an approval.", redFlags: ["Unverified financial condition."], citations };
  const run: DealEvidenceProjectionRun = { id, ownerId: 1, dealId: 1, mode: "red_team", startedAt: new Date("2026-10-11T11:00:00Z"), completedAt: new Date("2026-10-11T11:01:00Z"), status: "complete", inputSnapshot: snapshot, models: ["synthetic-reviewer"], output, failureCode: null, message: null };
  const now = new Date("2026-10-12T10:00:00Z");
  return { run, snapshot, output, finding, now, citations };
}

describe("validated acquisition finding projection", () => {
  it("projects exact finding-level facts and contextual inspection without mutation", () => {
    const h = fixture(); const before = JSON.stringify(h.run);
    const result = projectDealEvidenceRun(h.run, h.now);
    expect(result.state).toBe("ready");
    expect(result.insights[0]).toMatchObject({ model: "synthetic-reviewer", criterion: "financial_verification", citations: [{ id: "E1", payloadHash: "a".repeat(64), quote: h.citations[0].quote }], action: { type: "inspect_documents", dealId: 1, runId: h.run.id, receiptIds: [h.snapshot.evidence[0].receiptId] } });
    expect(JSON.stringify(h.run)).toBe(before);
  });
  it("separates saved at-run freshness from current expiry at the exact boundary", () => {
    const h = fixture();
    expect(projectDealEvidenceRun(h.run, new Date(h.now.getTime() - 1)).freshness[0]).toMatchObject({ staleAtRun: false, expiredNow: false });
    expect(projectDealEvidenceRun(h.run, h.now).freshness[0]).toMatchObject({ staleAtRun: false, expiredNow: true });
  });
  it("does not invent finding mappings or actions for legacy text", () => {
    const h = fixture(); h.snapshot.promptVersion = DEAL_EVIDENCE_PROMPT_VERSION as any;
    delete (h.output as any).outputVersion; delete (h.output as any).insights;
    const result = projectDealEvidenceRun(h.run, h.now);
    expect(result.state).toBe("legacy"); expect(result.insights).toEqual([]); expect(result.output).toEqual(h.output);
  });
  it.each(["pending", "failed"] as const)("never falls back from latest %s to older success", status => {
    const h = fixture(); const newer = { ...h.run, id: "10000000-0000-4000-8000-000000000002", startedAt: new Date("2026-10-11T12:00:00Z"), completedAt: status === "pending" ? null : new Date("2026-10-11T12:01:00Z"), status, output: null, failureCode: status === "failed" ? "INVALID_OUTPUT" : null, message: status === "failed" ? "Could not validate output." : null };
    const result = selectDealEvidenceProjection([h.run, newer], { ownerId: 1, dealId: 1, mode: "red_team", now: h.now });
    expect(result.state).toBe(status); expect(result.runId).toBe(newer.id); expect(result.insights).toEqual([]); expect(result.output).toBeNull();
  });
  it("scopes owner, deal and mode before selecting, not before authorizing", () => {
    const h = fixture(); const foreign = { ...h.run, ownerId: 2, startedAt: h.now };
    expect(selectDealEvidenceProjection([foreign, { ...foreign, ownerId: 1, dealId: 2 }, { ...foreign, ownerId: 1, mode: "ic" }], { ownerId: 1, dealId: 1, mode: "red_team", now: h.now }).state).toBe("empty");
  });
  it.each(["action", "criterion", "citation", "quote", "duplicate", "oversized", "url", "missing", "wrongVersion", "wrongReceipt", "date", "wrongDeal", "model"])("fails closed on %s", problem => {
    const h = fixture();
    if (problem === "action") h.finding.action = "approve_order";
    if (problem === "criterion") h.finding.criterion = "capital_clearance";
    if (problem === "citation") h.finding.citations = [{ citationId: "E2", quote: h.citations[0].quote }];
    if (problem === "quote") h.finding.citations = [{ citationId: "E1", quote: "Invented fact" }];
    if (problem === "duplicate") h.output.insights.push(h.finding);
    if (problem === "oversized") h.finding.interpretation = "x".repeat(601);
    if (problem === "url") h.finding.rationale = "Inspect https://evil.example";
    if (problem === "missing") delete (h.output as any).insights;
    if (problem === "wrongVersion") h.snapshot.promptVersion = DEAL_EVIDENCE_PROMPT_VERSION as any;
    if (problem === "wrongReceipt") h.snapshot.citations[0].payloadHash = "b".repeat(64);
    if (problem === "date") h.snapshot.evidence[0].expiresAt = "unknown";
    if (problem === "wrongDeal") h.snapshot.deal.id = 2;
    if (problem === "model") h.run.models = [];
    const result = projectDealEvidenceRun(h.run, h.now);
    expect(result.state).toBe("invalid"); expect(result.insights).toEqual([]); expect(result.output).toBeNull();
  });
  it("retains reviewer provenance and avoids collisions between IC finding IDs", () => {
    const h = fixture(); h.run.mode = "ic"; h.run.models = ["a", "b", "c"];
    h.run.output = { outputVersion: 2, scores: h.run.models.map(model => ({ model, score: 0.4, rationale: "Unverified hypothesis", citations: h.citations, insights: [h.finding] })), consensusScore: 0.4, divergenceScore: 0, divergenceFlag: false, summary: "Hypotheses only." };
    const result = projectDealEvidenceRun(h.run, h.now);
    expect(result.state).toBe("ready"); expect(result.insights.map(item => item.model)).toEqual(h.run.models); expect(new Set(result.insights.map(item => item.key)).size).toBe(3);
  });
  it("rejects a finding citing another catalog fact only in its prose", () => {
    const h = fixture(); h.snapshot.citations.push({ ...h.snapshot.citations[0], id: "E1F1", fact: "Another metadata fact." });
    h.finding.rationale = "Based on E1F1.";
    expect(projectDealEvidenceRun(h.run, h.now).state).toBe("invalid");
  });
  it("allows financing inspection only for the financing criterion", () => {
    const h = fixture(); h.finding.action = "inspect_financing";
    expect(projectDealEvidenceRun(h.run, h.now).state).toBe("invalid");
    h.finding.criterion = "financing";
    expect(projectDealEvidenceRun(h.run, h.now).insights[0].action.type).toBe("inspect_financing");
  });
  it("rejects malformed scope, clock, and contradictory completed state", () => {
    const h = fixture(); const scope = { ownerId: 0, dealId: 1, mode: "red_team" as const, now: h.now };
    expect(selectDealEvidenceProjection([], scope).state).toBe("invalid");
    expect(projectDealEvidenceRun(h.run, new Date(NaN)).state).toBe("invalid");
    expect(projectDealEvidenceRun({ ...h.run, failureCode: "PROVIDER_UNAVAILABLE" }, h.now).state).toBe("invalid");
  });
  it("does not skip malformed latest runs, and uses ID to break timestamp ties", () => {
    const h = fixture(); const bad = { ...h.run, id: "10000000-0000-4000-8000-000000000002", output: {} };
    const scope = { ownerId: 1, dealId: 1, mode: "red_team" as const, now: h.now };
    expect(selectDealEvidenceProjection([h.run, bad], scope)).toMatchObject({ state: "invalid", runId: bad.id });
    expect(selectDealEvidenceProjection([h.run, { ...bad, startedAt: new Date(NaN) }], scope).state).toBe("invalid");
  });
});
