import { createHash } from "node:crypto";
import { z } from "zod";
import { capitalEvidenceBindingSchema, capitalEvidenceFindingSchema, capitalEvidenceScopeSchema,
  type CapitalEvidenceBinding, type CapitalEvidenceScope, type CapitalEvidenceView } from "../../shared/capitalEvidenceContext";
import { dealEvidenceSnapshotSchema, SEC_ANALYSIS_LIMITATION } from "../../shared/dealEvidence";
import { immutableReceiptBindingIssue } from "./decisionReceiptBinding";

/** Canonical JSON hashing. Non-JSON values are rejected, never silently discarded. */
export function capitalEvidenceHash(value: unknown): string {
  function stable(item: unknown): string {
    if (item === null || typeof item === "string" || typeof item === "boolean") return JSON.stringify(item);
    if (typeof item === "number" && Number.isFinite(item)) return JSON.stringify(item);
    if (Array.isArray(item)) return `[${item.map(stable).join(",")}]`;
    if (item && typeof item === "object" && Object.getPrototypeOf(item) === Object.prototype) {
      return `{${Object.keys(item).sort().map(key => `${JSON.stringify(key)}:${stable((item as Record<string, unknown>)[key])}`).join(",")}}`;
    }
    throw new Error("Invalid evidence hash input");
  }
  return createHash("sha256").update(stable(value)).digest("hex");
}

/** These records must be loaded by an authenticated server repository, never by client input. */
export type CapitalEvidenceRecords = {
  decision: { id: number; userId: number; contextKind: string; canonicalThesisId: number | null;
    capitalThesisId: number | null; accountId: number; researchRunId: number | null;
    currentRevisionId: number | null; lifecycle: string };
  revision: { id: number; decisionRunId: number; createdByUserId: number; createdAt: number;
    contextSnapshot: unknown; gateSnapshot: unknown };
  research: { id: number; userId: number; thesisId: number; accountId: number | null };
  candidate: { id: number; runId: number; symbol: string };
  thesis: { id: number; userId: number; sourceCompilationId: number | null; status: string; graph: unknown };
  canonical: { id: number; userId: number; templateUsed: string | null; status: string };
  account: { id: number; userId: number };
  security: { id: number; symbol: string; cik: string | null; assetType: string };
  deal: { id: number; ownerUserId: number | null; isArchived: boolean | null };
  analysis: { id: string; ownerId: number; dealId: number; status: string; completedAt: Date | null;
    inputSnapshot: unknown };
  /** Adapter must validate these against the exact saved output, not derive them from arbitrary prose. */
  findings: unknown;
};

const invalid = () => { throw new Error("Capital evidence context could not be verified"); };
export class CapitalEvidenceReadError extends Error {
  constructor(public code: "evidence_context_not_bound") { super(code); }
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}

/** Shared by a future explicit revision writer and the read bridge. No persistence or providers. */
export function validateCapitalEvidenceBinding(ownerId: number, scope: CapitalEvidenceScope,
  rows: CapitalEvidenceRecords, rawBinding: unknown, now: number): CapitalEvidenceBinding {
  z.number().int().positive().safe().parse(ownerId);
  z.number().int().nonnegative().max(8_640_000_000_000_000).parse(now);
  capitalEvidenceScopeSchema.parse(scope);
  const b = capitalEvidenceBindingSchema.parse(rawBinding);
  const { decision: d, revision: r, research, candidate, thesis, canonical, account, security, deal, analysis } = rows;
  z.number().int().nonnegative().max(8_640_000_000_000_000).parse(r.createdAt);
  if ([d.userId, r.createdByUserId, research.userId, thesis.userId, canonical.userId, account.userId,
    deal.ownerUserId, analysis.ownerId, b.ownerId, b.confirmedByUserId].some(id => id !== ownerId)) invalid();
  if (d.contextKind !== "thesis" || d.lifecycle === "closed" || d.currentRevisionId !== r.id
    || scope.decisionRunId !== d.id || scope.revisionId !== r.id || r.decisionRunId !== d.id
    || scope.candidateId !== candidate.id || b.decisionRunId !== d.id || b.candidateId !== candidate.id) invalid();
  if (b.researchRunId !== research.id || d.researchRunId !== research.id || candidate.runId !== research.id
    || b.capitalThesisId !== thesis.id || d.capitalThesisId !== thesis.id || research.thesisId !== thesis.id
    || b.canonicalThesisId !== canonical.id || d.canonicalThesisId !== canonical.id || thesis.sourceCompilationId !== canonical.id
    || canonical.templateUsed !== "capital_trade" || thesis.status === "archived" || canonical.status === "archived"
    || b.accountId !== account.id || d.accountId !== account.id || research.accountId !== account.id) invalid();
  if (b.securityId !== security.id || security.assetType !== "equity" || b.symbol !== security.symbol
    || candidate.symbol !== security.symbol || b.cik !== security.cik || b.dealId !== deal.id
    || deal.isArchived !== false || analysis.dealId !== deal.id || b.analysisRunId !== analysis.id) invalid();
  if (b.confirmedAt > r.createdAt || r.createdAt > now || analysis.status !== "complete"
    || !analysis.completedAt || !Number.isFinite(analysis.completedAt.getTime())
    || analysis.completedAt.getTime() > b.confirmedAt) invalid();
  if (immutableReceiptBindingIssue({ requestedOwnerId: ownerId,
    run: { ownerId: d.userId, contextKind: "thesis", canonicalThesisId: d.canonicalThesisId,
      capitalThesisId: d.capitalThesisId, accountId: d.accountId },
    contextSnapshot: r.contextSnapshot, gateSnapshot: r.gateSnapshot })) invalid();
  const snapshot = dealEvidenceSnapshotSchema.parse(analysis.inputSnapshot);
  if (snapshot.evidence.some(e => Date.parse(e.retrievedAt) > analysis.completedAt!.getTime()
    || Date.parse(e.expiresAt) < Date.parse(e.retrievedAt))) invalid();
  if (snapshot.deal.id !== deal.id || snapshot.evidence.some(e => e.cik !== b.cik)
    || capitalEvidenceHash(analysis.inputSnapshot) !== b.analysisSnapshotHash
    || capitalEvidenceHash(thesis.graph) !== b.thesisSnapshotHash) invalid();
  if (new Set(b.criterionBindings.map(item => item.findingId)).size !== b.criterionBindings.length) invalid();
  const graph = record(thesis.graph);
  for (const item of b.criterionBindings) {
    const values = graph[item.field];
    if (!Array.isArray(values) || typeof values[item.index] !== "string" || !values[item.index].trim()) invalid();
  }
  return b;
}

/** A read result, not an attention-table write or a review acknowledgement. */
export function projectCapitalEvidenceContext(ownerId: number, scope: CapitalEvidenceScope,
  rows: CapitalEvidenceRecords | null, now: number): CapitalEvidenceView {
  capitalEvidenceScopeSchema.parse(scope);
  const empty = (reason: string): CapitalEvidenceView => ({ status: "unavailable", reason, scope,
    authority: "research_only", findings: [], attention: [], source: null });
  if (!rows) return empty("context_unavailable");
  try {
    const context = record(rows.revision.contextSnapshot);
    if (!context.evidenceContext) return empty("evidence_context_not_bound");
    const b = validateCapitalEvidenceBinding(ownerId, scope, rows, context.evidenceContext, now);
    const snapshot = dealEvidenceSnapshotSchema.parse(rows.analysis.inputSnapshot);
    const savedFindings = z.array(capitalEvidenceFindingSchema).max(12).parse(rows.findings);
    if (!savedFindings.length) return empty("finding_projection_unavailable");
    const findings = b.criterionBindings.map(target => {
      const matches = savedFindings.filter(item => item.id === target.findingId);
      if (matches.length !== 1) return invalid();
      return { ...matches[0], criterion: (record(rows.thesis.graph)[target.field] as string[])[target.index] };
    });
    if (new Set(findings.map(f => f.id)).size !== findings.length) return empty("invalid_finding_identity");
    const catalog = new Map(snapshot.citations.map(c => [c.id, c]));
    if (findings.some(f => new Set(f.citationIds).size !== f.citationIds.length || f.citationIds.some(id => !catalog.has(id)))) return empty("unbound_finding_citation");
    const expiredNow = snapshot.evidence.some(e => Date.parse(e.expiresAt) <= now);
    const staleAtRun = snapshot.evidence.some(e => e.staleAtRun);
    const projected = findings.map(f => ({ ...f, analysisRunId: b.analysisRunId,
      receiptIds: Array.from(new Set(f.citationIds.map(id => catalog.get(id)!.receiptId))),
      citations: f.citationIds.map(id => catalog.get(id)!),
      expiredNow, staleAtRun, nextAction: "review_research_basis" as const }));
    // One review task per exact context and evidence run, not one task per model or citation.
    return { status: expiredNow || staleAtRun ? "needs_reassessment" : "ready", reason: expiredNow ? "receipt_expired" : staleAtRun ? "stale_at_run" : null,
      scope, authority: "research_only", findings: projected,
      attention: projected.length || expiredNow || staleAtRun ? [{
        key: `capital-evidence:${ownerId}:${scope.decisionRunId}:${scope.revisionId}:${scope.candidateId}:${b.analysisRunId}`,
        kind: "evidence_context_review", title: expiredNow || staleAtRun ? "Reassess the saved research basis" : "Review the evidence-backed research hypotheses",
        findingIds: projected.map(f => f.id), href: `/aperture/run/${b.researchRunId}?candidate=${scope.candidateId}&view=evidence`, resolution: "not_recorded",
      }] : [], source: { analysisRunId: b.analysisRunId, completedAt: rows.analysis.completedAt!.getTime(), limitation: SEC_ANALYSIS_LIMITATION } };
  } catch { return empty("binding_or_source_invalid"); }
}

/** No default store: registering a fabricated or client-controlled record loader is forbidden. */
export function createCapitalEvidenceConsumer(deps: {
  load: (ownerId: number, scope: CapitalEvidenceScope) => Promise<CapitalEvidenceRecords | null>;
  now?: () => number;
}) {
  return async function readCapitalEvidenceContext(ownerId: number, input: unknown): Promise<CapitalEvidenceView> {
    const scope = capitalEvidenceScopeSchema.parse(input);
    z.number().int().positive().safe().parse(ownerId);
    try { return projectCapitalEvidenceContext(ownerId, scope, await deps.load(ownerId, scope), (deps.now ?? Date.now)()); }
    catch (error) { return { status: "unavailable", reason: error instanceof CapitalEvidenceReadError ? error.code : "context_read_failed", scope, authority: "research_only", findings: [], attention: [], source: null }; }
  };
}
