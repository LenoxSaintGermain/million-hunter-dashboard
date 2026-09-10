import { and, desc, eq, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { apertureDecisionRuns, apertureDecisionRevisions, portfolioAccounts, thesisCompilations } from "../../drizzle/schema";
import { apertureUnderwritingJobs } from "../../drizzle/apertureUnderwritingJobSchema";
import { apertureStrategyDiscoveries } from "../../drizzle/apertureStrategyDiscoverySchema";
import { readAcceptedObjectiveValues, prepareObjectiveMission } from "./objectiveMission";
import { claimUnderwritingJob, readUnderwritingJob } from "./underwritingJobs";
import { mayPublishUnderwriting, underwritingJobStatus } from "../../shared/underwritingJob";
import { DISCOVERY_MAX_ATTEMPTS, type StrategyDiscoveryRequest } from "../../shared/strategyDiscoveryJob";
import { parsePersistedJson } from "../../shared/persistedJson";
import { parseStrategyDiscovery, STRATEGY_DISCOVERY_LIMITS, type StrategyDiscoveryContext, type StrategyDiscoveryResult } from "./strategyDiscovery";
import type { CapitalObjective } from "../../shared/playUnderwriting";
import { missionDraftFingerprint, type MissionDraftValues } from "../../shared/apertureMissionDraft";
import type { getDb } from "../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type ReceiptDb = Pick<Db, "select">;
const positiveId = z.number().int().positive().safe();
export const discoveryIdentityInput = z.object({ decisionRunId: positiveId, decisionRevisionId: positiveId }).strict();
export const discoveryRunInput = discoveryIdentityInput.extend({ retryJobId: positiveId.optional() }).strict();
export const discoveryResumeInput = z.object({ requestId: z.string().uuid() }).strict();
type Identity = z.infer<typeof discoveryIdentityInput>;
export type DiscoveryProvider = (request: StrategyDiscoveryRequest) => Promise<{ payload: unknown; context: StrategyDiscoveryContext }>;
// Native MySQL JSON may reorder object keys; hashes must not depend on that order.
function canonical(value: any): any {
  return Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
}
const same = (left: unknown, right: unknown) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
function blocked(message: string): never { throw new TRPCError({ code: "PRECONDITION_FAILED", message }); }

export function objectiveDiscoveryEnabled() {
  return process.env.CAPITAL_OBJECTIVE_MISSIONS_ENABLED === "true" && process.env.CAPITAL_STRATEGY_DISCOVERY_ENABLED === "true";
}

async function readMission(db: ReceiptDb, userId: number, input: Identity) {
  const [head] = await db.select().from(apertureDecisionRuns).where(and(eq(apertureDecisionRuns.id, input.decisionRunId), eq(apertureDecisionRuns.userId, userId))).limit(1);
  const [revision] = head ? await db.select().from(apertureDecisionRevisions).where(and(eq(apertureDecisionRevisions.id, input.decisionRevisionId), eq(apertureDecisionRevisions.decisionRunId, head.id))).limit(1) : [];
  if (!head || !revision) throw new TRPCError({ code: "NOT_FOUND", message: "This Mission revision is unavailable to this operator." });
  const values = await readAcceptedObjectiveValues(db, userId, head, revision);
  const [account] = await db.select().from(portfolioAccounts).where(and(eq(portfolioAccounts.id, head.accountId), eq(portfolioAccounts.userId, userId), eq(portfolioAccounts.isPaper, true))).limit(1);
  if (!account) blocked("The named paper account is unavailable. No new discovery was started.");
  return { head, revision, values, account };
}

async function requestFromValues(db: ReceiptDb, userId: number, values: MissionDraftValues, missionHash: string): Promise<StrategyDiscoveryRequest> {
  const context = values.strategyContext!;
  const symbols = Array.from(new Set(context.requestedSymbols.map(symbol => symbol.trim().toUpperCase())));
  if (symbols.some(symbol => !/^[A-Z]{1,5}(\.[A-Z])?$/.test(symbol))) blocked("Review the requested US security symbols. No discovery was started.");
  let scopeContext = "";
  if (values.canonicalThesisId != null) {
    const [anchor] = await db.select().from(thesisCompilations).where(and(eq(thesisCompilations.id, values.canonicalThesisId), eq(thesisCompilations.userId, userId))).limit(1);
    if (!anchor) blocked("The selected thesis context is unavailable. No active thesis was substituted.");
    scopeContext = `\nSelected thesis context (operator belief, not a verified fact): ${anchor.thesisText}`;
  }
  if (!symbols.length && context.searchScope !== "broader_permitted_universe") blocked("Name the securities to research for this thesis scope. No broad search was substituted.");
  if (values.mission.trim().length + scopeContext.length > 8_000) blocked("The combined Mission and thesis context exceeds the 8,000-character research limit. Shorten the reviewed context first.");
  return { schemaVersion: 1, requestId: context.requestId, missionHash,
    searchScope: context.searchScope, universePolicy: symbols.length ? "declared_symbols" : "cited_us_security_leads",
    permittedUniverse: symbols, mission: values.mission.trim() + scopeContext,
    holdingPeriods: values.holdingPeriods, instrumentPreference: values.instrument };
}

/** Read-only prerequisites, invoked inside objective acceptance's draft lock. */
export async function validateObjectiveDiscoveryDraft(db: ReceiptDb, userId: number, values: MissionDraftValues): Promise<void> {
  prepareObjectiveMission(values);
  await requestFromValues(db, userId, values, createHash("sha256").update(missionDraftFingerprint(values)).digest("hex"));
}

export function assessObjectiveDiscovery(payload: unknown, manifest: unknown, request: StrategyDiscoveryRequest): StrategyDiscoveryResult {
  const parsed = parseStrategyDiscovery(payload, manifest);
  const context = parsed.context;
  const reasons: string[] = [];
  if (context && (context.requestId !== request.requestId || context.searchScope !== request.searchScope
    || context.universePolicy !== request.universePolicy || !same(context.permittedUniverse, request.permittedUniverse))) reasons.push("authorized_scope_mismatch");
  if (parsed.hypotheses.some(hypothesis => hypothesis.disposition === "research_lead" && !request.holdingPeriods.includes(hypothesis.horizon))) reasons.push("accepted_horizon_mismatch");
  if (!reasons.length) return parsed;
  return { ...parsed, status: "unavailable", coverageGaps: [...parsed.coverageGaps, ...reasons],
    hypotheses: parsed.hypotheses.map(hypothesis => ({ ...hypothesis, disposition: "unavailable", reasons: [...hypothesis.reasons, ...reasons] })),
    issues: [...parsed.issues, ...reasons.map(code => ({ path: "request", code }))],
    rejectedHypotheses: parsed.hypotheses.map((hypothesis, index) => ({ id: hypothesis.id, index, reasons: [...hypothesis.reasons, ...reasons] })) };
}

function decodeReceipt(row: typeof apertureStrategyDiscoveries.$inferSelect) {
  const request = parsePersistedJson(row.request) as StrategyDiscoveryRequest;
  const payload = parsePersistedJson<{ raw: unknown }>(row.payload);
  const manifest = parsePersistedJson<{ raw: unknown }>(row.manifest);
  const result = parsePersistedJson<StrategyDiscoveryResult>(row.result);
  const identity = { userId: row.userId, decisionRunId: row.decisionRunId, decisionRevisionId: row.decisionRevisionId,
    jobId: row.jobId, attempt: row.attempt, attemptToken: row.attemptToken, createdAt: row.createdAt };
  if (hash({ ...identity, request, payload, manifest, result }) !== row.recordHash) blocked("The saved discovery receipt is inconsistent. Reconcile its record; no new analysis was started.");
  // Recompute decisions from retained inputs, not a mutable/forged summary.
  const checked = assessObjectiveDiscovery(payload.raw, manifest.raw, request);
  if (!same(checked, result)) blocked("The recorded discovery decisions do not match their evidence. No eligibility is asserted.");
  return { id: row.id, jobId: row.jobId, attempt: row.attempt, request, result: checked, createdAt: row.createdAt };
}

/** Status reads do not start/retry jobs or mark findings seen, reviewed or resolved. */
export async function readObjectiveDiscovery(db: ReceiptDb, userId: number, raw: Identity) {
  const input = discoveryIdentityInput.parse(raw);
  const mission = await readMission(db, userId, input);
  const job = await readUnderwritingJob(db, userId, input.decisionRunId, input.decisionRevisionId);
  if (job && !job.request?.discovery) blocked("This Mission's analysis kind needs reconciliation. No new work was started.");
  const rows = await db.select().from(apertureStrategyDiscoveries).where(and(
    eq(apertureStrategyDiscoveries.userId, userId), eq(apertureStrategyDiscoveries.decisionRunId, input.decisionRunId),
    eq(apertureStrategyDiscoveries.decisionRevisionId, input.decisionRevisionId))).orderBy(desc(apertureStrategyDiscoveries.id));
  const records = rows.map(row => {
    const receipt = decodeReceipt(row);
    if (!job || row.jobId !== job.id || receipt.request.missionHash !== mission.revision.missionHash
      || row.attempt > job.attempt || (row.attempt === job.attempt && row.attemptToken !== job.attemptToken)
      || receipt.request.requestId !== mission.head.clientRequestId || !same(receipt.request, job.request?.discovery)) blocked("The discovery and Mission identities differ. Reconcile the exact saved record.");
    return receipt;
  });
  const successful = records.find(record => record.result.status !== "unavailable") ?? null;
  const latest = records.length ? records[0] : null;
  if (job?.state === "complete" && (!latest || latest.attempt !== job.attempt || latest.result.status === "unavailable")) blocked("The completed discovery has no matching result. Reconcile this job; do not start a duplicate.");
  const jobStatus = underwritingJobStatus(job, Date.now());
  const attemptLimitReached = !!job && job.attempt >= DISCOVERY_MAX_ATTEMPTS && jobStatus.canRetry;
  const sourceContext = parsePersistedJson(mission.revision.contextSnapshot);
  if (!sourceContext) blocked("The accepted Mission context is unavailable. Reconcile the original receipt.");
  return { ...input, acceptedValues: mission.values, sourceDraftVersion: sourceContext.sourceDraftVersion as number,
    account: { id: mission.account.id, label: mission.account.label, isPaper: true as const, asOf: mission.account.lastSyncedAt },
    job: { ...jobStatus, canRetry: jobStatus.canRetry && !attemptLimitReached,
      ...(attemptLimitReached ? { message: "Three attempts did not finish. Review the saved failure and authorize a new Mission revision before further discovery." } : {}) }, receipt: successful ?? latest,
    latestAttempt: latest, history: records.map(record => ({ id: record.id, attempt: record.attempt, createdAt: record.createdAt, status: record.result.status })),
    usingPreviousResult: successful != null && latest?.id !== successful.id,
    mutations: { analysisStarted: false as boolean, allocationCreated: false as const, orderCreated: false as const } };
}

/** Reconcile a disconnected acceptance by its original owner/request identity.
 * A new draft on another device is not evidence that the previous request failed.
 * This lookup never accepts a Mission, retries a job or changes review state. */
export async function resumeObjectiveDiscovery(db: Db, userId: number, raw: z.infer<typeof discoveryResumeInput>) {
  const input = discoveryResumeInput.parse(raw);
  const [head] = await db.select().from(apertureDecisionRuns).where(and(
    eq(apertureDecisionRuns.userId, userId), eq(apertureDecisionRuns.clientRequestId, input.requestId),
  )).limit(1);
  if (!head) return null;
  if (head.contextKind !== "objective") blocked("This request belongs to another Mission kind. Reconcile the original request; do not replace it.");
  const [revision] = await db.select().from(apertureDecisionRevisions).where(and(
    eq(apertureDecisionRevisions.decisionRunId, head.id), eq(apertureDecisionRevisions.version, 1),
  )).limit(1);
  if (!revision) blocked("The accepted request has no original Mission revision. Reconcile its saved record before retrying.");
  return readObjectiveDiscovery(db, userId, { decisionRunId: head.id, decisionRevisionId: revision.id });
}

/** One deliberate action, existing job/lease authority, immutable per-attempt output. */
export async function executeObjectiveDiscovery(db: Db, userId: number, raw: z.infer<typeof discoveryRunInput>, provider?: DiscoveryProvider) {
  if (!objectiveDiscoveryEnabled()) blocked("Objective discovery is not enabled in this release. The saved Mission is unchanged.");
  if (!provider && process.env.ISOLATED_UAT_MODE === "true") blocked("This isolated UAT runtime requires an explicit deterministic discovery fixture. No provider was called.");
  const input = discoveryRunInput.parse(raw);
  const identity = { decisionRunId: input.decisionRunId, decisionRevisionId: input.decisionRevisionId };
  const mission = await readMission(db, userId, input);
  if (mission.head.currentRevisionId !== input.decisionRevisionId || mission.head.researchRunId != null) blocked("Review the current pre-research Mission before discovery.");
  const discovery = await requestFromValues(db, userId, mission.values, mission.revision.missionHash);
  const accepted = prepareObjectiveMission(mission.values);
  const objective: CapitalObjective = { deployableCapitalCents: accepted.deployableCapitalCents, maxPlannedLossCents: accepted.maxPlannedLossCents,
    targetProfitCents: accepted.targetProfitCents, targetPeriod: accepted.targetPeriod, holdingPeriods: mission.values.holdingPeriods, instrumentPreference: mission.values.instrument };
  const request = { objective, requestedPlayCount: 3 as const, appendRevision: false, discovery };
  const requestKey = hash({ kind: "strategy_discovery_v1", decisionRevisionId: input.decisionRevisionId, missionHash: mission.revision.missionHash });
  const prior = await readUnderwritingJob(db, userId, input.decisionRunId, input.decisionRevisionId);
  if (prior && (prior.requestKey !== requestKey || !same(prior.request, request))) blocked("The saved discovery assumptions differ. Review an explicit Mission revision before new analysis.");
  if (input.retryJobId != null && prior?.id !== input.retryJobId) blocked("Resume the exact saved discovery job. No duplicate job was created.");
  if (prior?.state === "complete") return readObjectiveDiscovery(db, userId, identity);
  if (prior && prior.attempt >= DISCOVERY_MAX_ATTEMPTS) blocked("Discovery reached its three-attempt limit. Review the source failure and Mission before authorizing a new revision.");
  const claim = await claimUnderwritingJob(db, { userId, ...input, request, requestKey, maxAttempts: DISCOVERY_MAX_ATTEMPTS });
  if (claim.reused) return readObjectiveDiscovery(db, userId, identity);
  try {
    // Do not pass persistence-only keys into the strict provider input contract.
    const produce: DiscoveryProvider = provider ?? (async saved => {
      const { discoverObjectiveMission } = await import("./strategyDiscoveryProvider");
      const { requestId, searchScope, universePolicy, permittedUniverse, mission, holdingPeriods, instrumentPreference } = saved;
      return discoverObjectiveMission({ requestId, searchScope, universePolicy, permittedUniverse, mission, holdingPeriods, instrumentPreference });
    });
    const produced = await produce(discovery);
    // Parser owns transport size limits; never store an unbounded raw response.
    const bound = (value: unknown) => {
      const serialized = JSON.stringify(value);
      return typeof serialized === "string" && Buffer.byteLength(serialized) <= STRATEGY_DISCOVERY_LIMITS.contentBytes ? JSON.parse(serialized) : null;
    };
    // Preserve classifier JSON bytes inside a wrapper. Native MySQL JSON may
    // reorder object keys; it must not change the parser's original content hash.
    const boundedPayload = bound(produced.payload);
    const payload = { raw: boundedPayload == null || typeof boundedPayload === "string" ? boundedPayload : JSON.stringify(boundedPayload) };
    const manifest = { raw: bound(produced.context) };
    const parsed = assessObjectiveDiscovery(payload.raw, manifest.raw, discovery);
    await db.transaction(async tx => {
      const [head] = await tx.select().from(apertureDecisionRuns).where(and(eq(apertureDecisionRuns.id, input.decisionRunId), eq(apertureDecisionRuns.userId, userId),
        eq(apertureDecisionRuns.currentRevisionId, input.decisionRevisionId), isNull(apertureDecisionRuns.researchRunId))).for("update").limit(1);
      const [job] = await tx.select().from(apertureUnderwritingJobs).where(and(eq(apertureUnderwritingJobs.id, claim.job.id), eq(apertureUnderwritingJobs.userId, userId))).for("update").limit(1);
      if (!head || !job || !mayPublishUnderwriting(job, claim.job.attemptToken, Date.now())) throw new TRPCError({ code: "CONFLICT", message: "This discovery attempt no longer owns the Mission. Reconcile the saved job before retrying." });
      await readMission(tx, userId, identity);
      const result = parsed;
      const record = { userId, ...identity, jobId: job.id, attempt: job.attempt, attemptToken: job.attemptToken,
        request: discovery, payload, manifest, result, createdAt: Date.now() };
      await tx.insert(apertureStrategyDiscoveries).values({ ...record, recordHash: hash(record) });
      const failed = result.status === "unavailable";
      await tx.update(apertureUnderwritingJobs).set({ state: failed ? "failed" : "complete", milestone: failed ? "failed" : "complete",
        failure: failed ? "Discovery evidence or classification was unavailable. The attempted receipt is preserved; review it before explicitly retrying." : null,
        updatedAt: Date.now() }).where(eq(apertureUnderwritingJobs.id, job.id));
    });
    const receipt = await readObjectiveDiscovery(db, userId, identity);
    return { ...receipt, mutations: { ...receipt.mutations, analysisStarted: true } };
  } catch (error) {
    try {
      await db.update(apertureUnderwritingJobs).set({ state: "failed", milestone: "failed",
        failure: "Discovery could not finish. Your Mission and prior receipt remain saved; inspect this job before retrying.",
        updatedAt: Date.now() }).where(and(eq(apertureUnderwritingJobs.id, claim.job.id), eq(apertureUnderwritingJobs.attemptToken, claim.job.attemptToken), eq(apertureUnderwritingJobs.state, "running")));
    } catch {
      // Storage may be down too. Leave the fenced job unresolved; never leak a
      // database message or claim that recording failure succeeded.
      throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Discovery and its status update could not finish. Reconcile the saved job when storage recovers; do not start another request." });
    }
    throw error instanceof TRPCError ? error : new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Discovery could not finish. Inspect the saved job before retrying." });
  }
}
