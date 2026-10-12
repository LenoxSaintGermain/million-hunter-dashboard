import { and, eq, desc } from "drizzle-orm";
import { dealEvidenceAnalysisRequests } from "../../drizzle/dealEvidenceSchema";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { apertureDecisionRuns, apertureDecisionRevisions, apertureRuns, apertureCandidates,
  capitalTheses, thesisCompilations, portfolioAccounts, securities, deals } from "../../drizzle/schema";
import { getDb } from "../db";
import { createDealEvidenceRepository, type DealEvidenceRun } from "../dealEvidenceRepository";
import { parsePersistedJson } from "../../shared/persistedJson";
import { capitalEvidenceBindingSchema, capitalEvidenceScopeSchema, type CapitalEvidenceScope } from "../../shared/capitalEvidenceContext";
import { CapitalEvidenceReadError, capitalEvidenceHash, validateCapitalEvidenceBinding, projectCapitalEvidenceContext, createCapitalEvidenceConsumer, type CapitalEvidenceRecords } from "./capitalEvidenceContext";
import { projectDealEvidenceRun } from "../../shared/dealEvidenceProjection";
import { appendDecisionRevision } from "./decisionRevisionWriter";
import { revisionJsonForInsert } from "./decisionReceiptBinding";

/** Preserves uncertainty; never promotes model interpretation to a verified fact. */
export function capitalFindingsFromSavedRun(run: DealEvidenceRun) {
  const projection = projectDealEvidenceRun(run, new Date());
  if (projection.state !== "ready") throw new Error("Finding-level source analysis unavailable");
  return projection.insights.map(insight => ({ id: insight.key, criterion: insight.criterion,
    statement: insight.interpretation, classification: insight.kind, rationale: insight.rationale,
    uncertainty: insight.uncertainty, citationIds: insight.citations.map(citation => citation.id) }));
}

/** SELECT-only loader. The adapter receives the exact validated saved run, not user prose. */
type ReaderDeps = {
  /** Confirmation transaction only: validate current locked rows, never an RR snapshot. */
  lockReads?: boolean;
  findingsFromSavedRun?: (run: DealEvidenceRun) => unknown;
  database?: typeof getDb;
  evidenceRepository?: Pick<ReturnType<typeof createDealEvidenceRepository>, "getRun">;
  now?: () => number;
};
export function createCapitalEvidenceRecordLoader(deps: ReaderDeps = {}) {
  const database = deps.database ?? getDb;
  const evidence = deps.evidenceRepository ?? createDealEvidenceRepository(database);
  async function currentRead<T>(query: PromiseLike<T> & { for: (strength: "update") => PromiseLike<T> }): Promise<T> {
    return await (deps.lockReads ? query.for("update") : query);
  }
  async function load(ownerId: number, scope: CapitalEvidenceScope, proposedBinding?: unknown): Promise<CapitalEvidenceRecords | null> {
    capitalEvidenceScopeSchema.parse(scope);
    const db = await database();
    if (!db) throw new Error("Capital evidence storage unavailable");
    const [decision] = await currentRead(db.select().from(apertureDecisionRuns).where(and(
      eq(apertureDecisionRuns.id, scope.decisionRunId), eq(apertureDecisionRuns.userId, ownerId))).limit(1));
    if (!decision || decision.currentRevisionId !== scope.revisionId) return null;
    const [revisionRow] = await currentRead(db.select().from(apertureDecisionRevisions).where(and(
      eq(apertureDecisionRevisions.id, scope.revisionId), eq(apertureDecisionRevisions.decisionRunId, decision.id),
      eq(apertureDecisionRevisions.createdByUserId, ownerId))).limit(1));
    if (!revisionRow) return null;
    const revision = { ...revisionRow, contextSnapshot: parsePersistedJson(revisionRow.contextSnapshot), gateSnapshot: parsePersistedJson(revisionRow.gateSnapshot) };
    if (proposedBinding) {
      revision.contextSnapshot = { ...revision.contextSnapshot, evidenceContext: proposedBinding };
      revision.createdAt = (deps.now ?? Date.now)();
    }
    const context = revision.contextSnapshot;
    if (!context || !context.evidenceContext) throw new CapitalEvidenceReadError("evidence_context_not_bound");
    const b = capitalEvidenceBindingSchema.parse(context.evidenceContext);
    if (b.ownerId !== ownerId || b.decisionRunId !== decision.id || b.candidateId !== scope.candidateId) return null;
    const [research] = await currentRead(db.select().from(apertureRuns).where(and(eq(apertureRuns.id, b.researchRunId), eq(apertureRuns.userId, ownerId))).limit(1));
    const [candidate] = await currentRead(db.select().from(apertureCandidates).where(and(eq(apertureCandidates.id, b.candidateId), eq(apertureCandidates.runId, b.researchRunId))).limit(1));
    const [thesis] = await currentRead(db.select().from(capitalTheses).where(and(eq(capitalTheses.id, b.capitalThesisId), eq(capitalTheses.userId, ownerId))).limit(1));
    const [canonical] = await currentRead(db.select().from(thesisCompilations).where(and(eq(thesisCompilations.id, b.canonicalThesisId), eq(thesisCompilations.userId, ownerId))).limit(1));
    const [account] = await currentRead(db.select().from(portfolioAccounts).where(and(eq(portfolioAccounts.id, b.accountId), eq(portfolioAccounts.userId, ownerId))).limit(1));
    // Explicit stored security ID only; never locate one by guessed name or ticker.
    const [security] = await currentRead(db.select().from(securities).where(eq(securities.id, b.securityId)).limit(1));
    const [deal] = await currentRead(db.select().from(deals).where(and(eq(deals.id, b.dealId), eq(deals.ownerUserId, ownerId))).limit(1));
    const analysis = await evidence.getRun(ownerId, b.dealId, b.analysisRunId);
    if (!research || !candidate || !thesis || !canonical || !account || !security || !deal || !analysis) return null;
    // Do not return a stale head if an explicit revision was accepted during this read.
    const [head] = await currentRead(db.select().from(apertureDecisionRuns).where(and(eq(apertureDecisionRuns.id, decision.id), eq(apertureDecisionRuns.userId, ownerId))).limit(1));
    if (!head || head.currentRevisionId !== scope.revisionId || head.lifecycle === "closed") return null;
    return { decision: head, revision, research, candidate, thesis: { ...thesis, graph: parsePersistedJson(thesis.graph) },
      canonical, account, security, deal, analysis, findings: (deps.findingsFromSavedRun ?? capitalFindingsFromSavedRun)(analysis) };
  }
  return load;
}

export function createCapitalEvidenceReader(deps: ReaderDeps = {}) {
  return createCapitalEvidenceConsumer({ load: createCapitalEvidenceRecordLoader(deps), now: deps.now });
}

const positiveId = z.number().int().positive().safe();
export const capitalEvidenceChoicesInput = capitalEvidenceScopeSchema.extend({
  dealId: positiveId, analysisRunId: z.string().uuid(), securityId: positiveId,
}).strict();
const confirmationBinding = capitalEvidenceBindingSchema.omit({ ownerId: true, confirmedByUserId: true, confirmedAt: true });
export const capitalEvidenceConfirmationInput = capitalEvidenceScopeSchema.extend({
  expectedLockVersion: z.number().int().nonnegative(), binding: confirmationBinding,
  confirmed: z.literal(true), requestId: z.string().uuid(),
}).strict();
type Confirmation = z.infer<typeof capitalEvidenceConfirmationInput>;
const unavailable = () => new TRPCError({ code: "PRECONDITION_FAILED", message: "The exact evidence context is unavailable or changed. Reload the choices before confirming." });

/** Used only after locked identity/source validation. Old approvals are not carried into a new basis. */
export function capitalEvidenceRevisionValues(current: typeof apertureDecisionRevisions.$inferSelect,
  binding: z.infer<typeof capitalEvidenceBindingSchema>, request: { requestId: string; requestHash: string }) {
  const { id: _id, decisionRunId: _run, version: _version, previousRevisionId: _previous, createdAt: _at, createdByUserId: _by, ...copy } = current;
  const json = revisionJsonForInsert(current);
  const previousRequest = json.contextSnapshot?.evidenceBindingRequest as Record<string, unknown> | undefined;
  if (previousRequest?.requestId === request.requestId) throw new TRPCError({ code: "CONFLICT", message: "This request ID already belongs to a recorded binding. Use a new confirmation request." });
  const branch: "cash" | "conditional" | "research" = current.effectiveBranch === "cash" ? "cash" : current.effectiveBranch === "conditional" ? "conditional" : "research";
  return { values: { ...copy, ...json, operatorChoice: branch, effectiveBranch: branch, selectedCandidateId: null,
    plannedRiskCents: 0, rankingSnapshot: null,
    contextSnapshot: { ...json.contextSnapshot, evidenceContext: binding, evidenceBindingRequest: request },
    gateSnapshot: { ...json.gateSnapshot, riskAuthorityState: "pending_verification", sourceAvailabilityVerified: false,
      humanApprovalRequired: true, paperOnly: true, permittedRiskCents: null },
  }, lifecycle: branch === "research" ? "researching" as const : branch,
    pending: { branch, reviewAt: current.reviewAt, reopenCondition: current.reopenCondition, namedGateKey: current.namedGateKey } };
}

export function createCapitalEvidenceBindingService(deps: { database?: typeof getDb; now?: () => number } = {}) {
  const database = deps.database ?? getDb;
  const clock = deps.now ?? Date.now;
  async function securityChoices(ownerId: number, raw: CapitalEvidenceScope) {
    const scope = capitalEvidenceScopeSchema.parse(raw); positiveId.parse(ownerId);
    const db = await database(); if (!db) throw unavailable();
    const [head] = await db.select().from(apertureDecisionRuns).where(and(eq(apertureDecisionRuns.id, scope.decisionRunId), eq(apertureDecisionRuns.userId, ownerId))).limit(1);
    if (!head || head.lifecycle === "closed" || head.contextKind !== "thesis" || head.currentRevisionId !== scope.revisionId || !head.researchRunId) throw unavailable();
    const [research] = await db.select().from(apertureRuns).where(and(eq(apertureRuns.id, head.researchRunId), eq(apertureRuns.userId, ownerId))).limit(1);
    const [candidate] = await db.select().from(apertureCandidates).where(and(eq(apertureCandidates.id, scope.candidateId), eq(apertureCandidates.runId, head.researchRunId))).limit(1);
    if (!research || !candidate || research.thesisId !== head.capitalThesisId || research.accountId !== head.accountId) throw unavailable();
    // Symbol narrows suggestions only. No selection, binding or authority is inferred.
    const suggestions = await db.select({ id: securities.id, symbol: securities.symbol, assetType: securities.assetType, cik: securities.cik })
      .from(securities).where(eq(securities.symbol, candidate.symbol)).limit(10);
    const [current] = await db.select().from(apertureDecisionRuns).where(and(eq(apertureDecisionRuns.id, head.id), eq(apertureDecisionRuns.userId, ownerId))).limit(1);
    if (!current || current.lifecycle === "closed" || current.currentRevisionId !== scope.revisionId || current.lockVersion !== head.lockVersion) throw unavailable();
    return { choices: suggestions, requiresExplicitSelection: true as const,
      limitation: "Symbol-matched suggestions only. Select the exact issuer and confirm its identity; this list does not bind evidence or establish eligibility." };
  }
  async function options(ownerId: number, raw: CapitalEvidenceScope) {
    const scope = capitalEvidenceScopeSchema.parse(raw); positiveId.parse(ownerId);
    const db = await database(); if (!db) throw unavailable();
    const [head] = await db.select().from(apertureDecisionRuns).where(and(eq(apertureDecisionRuns.id, scope.decisionRunId), eq(apertureDecisionRuns.userId, ownerId))).limit(1);
    if (!head || head.lifecycle === "closed" || head.currentRevisionId !== scope.revisionId || !head.researchRunId) throw unavailable();
    const [candidate] = await db.select().from(apertureCandidates).where(and(eq(apertureCandidates.id, scope.candidateId), eq(apertureCandidates.runId, head.researchRunId))).limit(1);
    if (!candidate) throw unavailable();
    const recent = await db.select({ dealId: deals.id, dealName: deals.name, analysisRunId: dealEvidenceAnalysisRequests.id, mode: dealEvidenceAnalysisRequests.mode, startedAt: dealEvidenceAnalysisRequests.startedAt })
      .from(dealEvidenceAnalysisRequests).innerJoin(deals, eq(deals.id, dealEvidenceAnalysisRequests.dealId))
      .where(and(eq(dealEvidenceAnalysisRequests.ownerId, ownerId), eq(deals.ownerUserId, ownerId), eq(deals.isArchived, false)))
      .orderBy(desc(dealEvidenceAnalysisRequests.startedAt), desc(dealEvidenceAnalysisRequests.id)).limit(21);
    const existing = await createCapitalEvidenceReader({ database, now: clock })(ownerId, scope);
    let security: { securityId: number; symbol: string; cik: string } | null = null;
    if (existing.status !== "unavailable") {
      const records = await createCapitalEvidenceRecordLoader({ database, now: clock })(ownerId, scope);
      if (records) security = { securityId: records.security.id, symbol: records.security.symbol, cik: records.security.cik! };
    }
    return { candidate: { candidateId: candidate.id, symbol: candidate.symbol }, security,
      securitySelectionRequired: security === null, runs: recent.slice(0, 20), hasMore: recent.length > 20,
      limitation: "Recent saved attempts, not prequalified findings. Choices validates the exact selected run. A candidate symbol is not a security identity binding." };
  }
  async function choices(ownerId: number, raw: z.input<typeof capitalEvidenceChoicesInput>) {
    const input = capitalEvidenceChoicesInput.parse(raw); positiveId.parse(ownerId);
    const scope = { decisionRunId: input.decisionRunId, revisionId: input.revisionId, candidateId: input.candidateId };
    const db = await database(); if (!db) throw unavailable();
    const [head] = await db.select().from(apertureDecisionRuns).where(and(eq(apertureDecisionRuns.id, input.decisionRunId), eq(apertureDecisionRuns.userId, ownerId))).limit(1);
    if (!head || head.currentRevisionId !== input.revisionId || !head.capitalThesisId || !head.canonicalThesisId || !head.researchRunId) throw unavailable();
    const [thesis] = await db.select().from(capitalTheses).where(and(eq(capitalTheses.id, head.capitalThesisId), eq(capitalTheses.userId, ownerId))).limit(1);
    const [security] = await db.select().from(securities).where(eq(securities.id, input.securityId)).limit(1);
    const [account] = await db.select().from(portfolioAccounts).where(and(eq(portfolioAccounts.id, head.accountId), eq(portfolioAccounts.userId, ownerId))).limit(1);
    if (!thesis || !security || !account?.isPaper) throw unavailable();
    const analysis = await createDealEvidenceRepository(database).getRun(ownerId, input.dealId, input.analysisRunId);
    if (!analysis) throw unavailable();
    const findings = capitalFindingsFromSavedRun(analysis);
    const graph = parsePersistedJson(thesis.graph);
    const fields = ["beliefs", "seek", "avoid", "evidenceRequirements", "invalidationConditions"] as const;
    const criteria = fields.flatMap(field => (graph?.[field] ?? []).map((text, index) => ({ field, index, text })))
      .filter(item => typeof item.text === "string" && item.text.trim() && item.index <= 1023);
    if (!findings.length || !criteria.length) throw unavailable();
    const now = clock();
    const binding = capitalEvidenceBindingSchema.parse({ version: 1, kind: "sec_metadata_research", ownerId,
      decisionRunId: head.id, researchRunId: head.researchRunId, candidateId: input.candidateId,
      canonicalThesisId: head.canonicalThesisId, capitalThesisId: head.capitalThesisId, accountId: head.accountId,
      securityId: security.id, cik: security.cik, symbol: security.symbol, dealId: input.dealId, analysisRunId: analysis.id,
      analysisSnapshotHash: capitalEvidenceHash(analysis.inputSnapshot), thesisSnapshotHash: capitalEvidenceHash(graph),
      // Structural validation witness only. No pairing is returned as an accepted/default choice or persisted.
      criterionBindings: [{ findingId: findings[0].id, field: criteria[0].field, index: criteria[0].index }],
      confirmedByUserId: ownerId, confirmedAt: now, identityBasis: "operator_confirmed_security_cik_not_independently_verified", relation: "same_legal_entity" });
    const rows = await createCapitalEvidenceRecordLoader({ database, now: () => now })(ownerId, scope, binding);
    if (!rows) throw unavailable();
    validateCapitalEvidenceBinding(ownerId, scope, rows, binding, now);
    const { ownerId: _owner, confirmedByUserId: _confirmer, confirmedAt: _time, criterionBindings: _witness, ...echo } = binding;
    return { expectedLockVersion: head.lockVersion, binding: echo, findings, criteria,
      issuer: { securityId: security.id, symbol: security.symbol, cik: binding.cik } };
  }

  async function confirmBinding(ownerId: number, raw: z.input<typeof capitalEvidenceConfirmationInput>) {
    const input: Confirmation = capitalEvidenceConfirmationInput.parse(raw); positiveId.parse(ownerId);
    const db = await database(); if (!db) throw unavailable();
    const { requestId: _requestId, ...confirmedRequest } = input;
    const requestHash = capitalEvidenceHash(confirmedRequest);
    return confirmPrepared(db, ownerId, input, requestHash);
  }
  async function confirmPrepared(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, ownerId: number, input: Confirmation, requestHash: string) {
    // Replay is deliberately current-head only; later revisions must be reviewed, never reactivated.
    const [head] = await db.select().from(apertureDecisionRuns).where(and(eq(apertureDecisionRuns.id, input.decisionRunId), eq(apertureDecisionRuns.userId, ownerId))).limit(1);
    if (!head || head.lifecycle === "closed") throw unavailable();
    if (head.currentRevisionId !== input.revisionId) {
      const [saved] = await db.select().from(apertureDecisionRevisions).where(and(eq(apertureDecisionRevisions.id, head.currentRevisionId ?? 0), eq(apertureDecisionRevisions.decisionRunId, head.id))).limit(1);
      const receipt = saved ? parsePersistedJson(saved.contextSnapshot)?.evidenceBindingRequest as Record<string, unknown> | undefined : undefined;
      if (saved?.previousRevisionId === input.revisionId && receipt?.requestId === input.requestId && receipt?.requestHash === requestHash) return { decisionRunId: head.id, revisionId: saved.id, created: false };
      throw new TRPCError({ code: "CONFLICT", message: "The current revision changed. Reload evidence binding choices." });
    }
    const now = clock();
    const result = await appendDecisionRevision(db, { ownerId, decisionRunId: input.decisionRunId,
      expectedRevisionId: input.revisionId, expectedLockVersion: input.expectedLockVersion, now,
      build: async (tx, locked, current) => {
        const txDatabase = async () => tx as unknown as NonNullable<Awaited<ReturnType<typeof getDb>>>;
        const binding = capitalEvidenceBindingSchema.parse({ ...input.binding, ownerId, confirmedByUserId: ownerId, confirmedAt: now });
        // Validate full current rows returned by locking reads, not a pre-lock RR snapshot.
        const scope = { decisionRunId: input.decisionRunId, revisionId: input.revisionId, candidateId: input.candidateId };
        const rows = await createCapitalEvidenceRecordLoader({ database: txDatabase, now: () => now, lockReads: true })(ownerId, scope, binding);
        if (!rows) throw unavailable();
        const [account] = await tx.select().from(portfolioAccounts).where(and(eq(portfolioAccounts.id, locked.accountId), eq(portfolioAccounts.userId, ownerId))).for("update").limit(1);
        if (!account?.isPaper) throw unavailable();
        validateCapitalEvidenceBinding(ownerId, scope, rows, binding, now);
        if (projectCapitalEvidenceContext(ownerId, scope, rows, now).status === "unavailable") throw unavailable();
        return capitalEvidenceRevisionValues(current, binding, { requestId: input.requestId, requestHash });
      } });
    return { ...result, created: true };
  }
  return { options, securityChoices, choices, confirmBinding };
}
