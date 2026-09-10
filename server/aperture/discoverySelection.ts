import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { apertureDecisionRuns, apertureDecisionRevisions, capitalTheses, portfolioAccounts, brokerOrders, apertureRuns, apertureCandidates, apertureCapitalClaims } from "../../drizzle/schema";
import { apertureDiscoverySelections } from "../../drizzle/apertureDiscoverySelectionSchema";
import { apertureStrategyDiscoveries } from "../../drizzle/apertureStrategyDiscoverySchema";
import { parsePersistedJson } from "../../shared/persistedJson";
import type { getDb } from "../db";
import { CURRENT_MANDATE } from "./mandate";
import { objectiveDiscoveryEnabled, readObjectiveDiscovery } from "./strategyDiscoveryWorkflow";
import { prepareDiscoveryResearchContext } from "./discoveryResearchContext";
import { prepareObjectiveMission, declaredObjectiveCapitalEvent } from "./objectiveMission";
import { recordCapitalEvent, readCapitalLedger, claimCapital, paperOrderAllocationId, type CapitalLedgerTransaction } from "./capitalLedger";
import { deriveCapitalEnvelope } from "../../shared/capitalStrategy";
import { immutableReceiptBindingIssue } from "./decisionReceiptBinding";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type ReadDb = Pick<Db, "select">;
type Decision = typeof apertureDecisionRuns.$inferSelect;
type Revision = typeof apertureDecisionRevisions.$inferSelect;
type Selection = typeof apertureDiscoverySelections.$inferSelect;
const id = z.number().int().positive().safe();
export const discoverySelectionInput = z.object({
  decisionRunId: id, decisionRevisionId: id, discoveryReceiptId: id,
  hypothesisId: z.string().trim().min(1).max(160),
}).strict();
const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
const same = (left: unknown, right: unknown) => hash(left) === hash(right);
function blocked(message = "The selected discovery context needs reconciliation. No new research, allocation or order was created."): never {
  throw new TRPCError({ code: "PRECONDITION_FAILED", message });
}
function selectionPayload(row: Omit<Selection, "id" | "recordHash">) {
  return { ...row, context: parsePersistedJson(row.context) };
}
function receipt(row: Selection, created: boolean) {
  return { selectionId: row.id, decisionRunId: row.researchDecisionRunId, decisionRevisionId: row.researchRevisionId,
    sourceDecisionRunId: row.sourceDecisionRunId, sourceRevisionId: row.sourceRevisionId,
    discoveryReceiptId: row.discoveryReceiptId, hypothesisId: row.hypothesisId, created };
}
function revisionPayload(revision: Pick<Revision, "missionText" | "deployableCapitalCents" | "maxPlannedLossCents" | "targetProfitCents" | "targetPeriod" | "holdingPeriod" | "holdingPeriods" | "instrumentPreference" | "includeHeldResearch" | "objective" | "invalidationRule" | "reviewAt" | "contextSnapshot">) {
  return { missionText: revision.missionText, deployableCapitalCents: revision.deployableCapitalCents,
    maxPlannedLossCents: revision.maxPlannedLossCents, targetProfitCents: revision.targetProfitCents,
    targetPeriod: revision.targetPeriod, holdingPeriod: revision.holdingPeriod,
    holdingPeriods: parsePersistedJson(revision.holdingPeriods), instrumentPreference: revision.instrumentPreference,
    includeHeldResearch: revision.includeHeldResearch, objective: revision.objective,
    invalidationRule: revision.invalidationRule, reviewAt: revision.reviewAt,
    context: parsePersistedJson(revision.contextSnapshot) };
}

/** A real source-bound tactical context is distinct from a canonical thesis.
 * Reads verify its immutable source and projection, never repair or promote it. */
export async function readDiscoveryResearchBinding(db: ReadDb, userId: number, head: Decision,
  revision: Revision, now = Date.now(), forAdvancement = false) {
  if (head.userId !== userId || head.contextKind !== "discovery" || head.canonicalThesisId !== null
    || head.capitalThesisId == null || revision.decisionRunId !== head.id || revision.createdByUserId !== userId) blocked();
  const [selection] = await db.select().from(apertureDiscoverySelections).where(and(
    eq(apertureDiscoverySelections.userId, userId), eq(apertureDiscoverySelections.researchDecisionRunId, head.id),
  )).limit(1);
  if (!selection || selection.capitalThesisId !== head.capitalThesisId) blocked();
  const { id: _id, recordHash, ...fields } = selection;
  if (hash(selectionPayload(fields)) !== recordHash) blocked();
  const [[first], [projection], [account], [rawSource]] = await Promise.all([
    db.select().from(apertureDecisionRevisions).where(and(eq(apertureDecisionRevisions.id, selection.researchRevisionId), eq(apertureDecisionRevisions.decisionRunId, head.id))).limit(1),
    db.select().from(capitalTheses).where(and(eq(capitalTheses.id, selection.capitalThesisId), eq(capitalTheses.userId, userId))).limit(1),
    db.select().from(portfolioAccounts).where(and(eq(portfolioAccounts.id, head.accountId), eq(portfolioAccounts.userId, userId), eq(portfolioAccounts.isPaper, true))).limit(1),
    db.select().from(apertureStrategyDiscoveries).where(and(eq(apertureStrategyDiscoveries.id, selection.discoveryReceiptId), eq(apertureStrategyDiscoveries.userId, userId))).limit(1),
  ]);
  if (!first || !projection || !account || !rawSource || rawSource.recordHash !== selection.sourceRecordHash
    || rawSource.decisionRunId !== selection.sourceDecisionRunId || rawSource.decisionRevisionId !== selection.sourceRevisionId
    || projection.sourceCompilationId !== null || projection.isPrimary || first.version !== 1 || first.previousRevisionId !== null
    || first.createdByUserId !== userId || first.createdAt !== selection.createdAt || head.clientRequestId !== null) blocked();
  const source = await readObjectiveDiscovery(db, userId, {
    decisionRunId: selection.sourceDecisionRunId, decisionRevisionId: selection.sourceRevisionId,
  });
  // Source receipts are append-only. A later unavailable attempt cannot promote
  // this one; reading the retained evidence still verifies its original bytes.
  const sourceRecord = source.receipt?.id === rawSource.id ? source.receipt
    : source.latestAttempt?.id === rawSource.id ? source.latestAttempt : null;
  if (!sourceRecord || sourceRecord.result.status === "unavailable" || source.acceptedValues.accountId !== account.id) blocked();
  const prepared = prepareDiscoveryResearchContext({ values: source.acceptedValues, result: sourceRecord.result,
    hypothesisId: selection.hypothesisId, now: selection.createdAt });
  if (forAdvancement) prepareDiscoveryResearchContext({ values: source.acceptedValues, result: sourceRecord.result,
    hypothesisId: selection.hypothesisId, now });
  if (!same(parsePersistedJson(selection.context), prepared)
    || projection.name !== prepared.title || projection.rawText !== prepared.rawText
    || !same(parsePersistedJson(projection.graph), prepared.graph)
    || !same(parsePersistedJson(projection.confidenceNotes), prepared.confidenceNotes)) blocked();
  const context = parsePersistedJson(first.contextSnapshot);
  if (immutableReceiptBindingIssue({ requestedOwnerId: userId, run: { ...head, ownerId: head.userId },
    contextSnapshot: context, gateSnapshot: parsePersistedJson(first.gateSnapshot) })) blocked();
  if (!context || context.contextKind !== "discovery" || context.canonicalThesisId !== null
    || context.capitalThesisId !== projection.id || context.accountId !== account.id
    || context.sourceDecisionRunId !== selection.sourceDecisionRunId || context.sourceRevisionId !== selection.sourceRevisionId
    || context.discoveryReceiptId !== selection.discoveryReceiptId || context.hypothesisId !== selection.hypothesisId
    || context.sourceRecordHash !== rawSource.recordHash || context.projectionHash !== hash(prepared)
    || context.selectedAt !== selection.createdAt || context.availableCapitalCents !== null
    || hash(revisionPayload(first)) !== first.missionHash) blocked();
  const declared = prepareObjectiveMission(source.acceptedValues);
  if (context.capitalSourceEventId !== (declaredObjectiveCapitalEvent(declared)?.capitalEventId ?? null)) blocked();
  if (first.missionText !== declared.missionText || first.deployableCapitalCents !== declared.deployableCapitalCents
    || first.maxPlannedLossCents !== declared.maxPlannedLossCents || first.targetProfitCents !== declared.targetProfitCents
    || first.targetPeriod !== declared.targetPeriod || first.instrumentPreference !== declared.values.instrument
    || first.invalidationRule !== prepared.invalidationRule || first.holdingPeriod !== prepared.horizon
    || !same(parsePersistedJson(first.holdingPeriods), declared.values.holdingPeriods)
    || first.reviewAt !== prepared.reviewAt || first.effectiveBranch !== "research" || first.plannedRiskCents !== 0
    || first.desiredEndingValueCents !== null || first.includeHeldResearch !== declared.values.includeHeld
    || first.objective !== declared.values.objective) blocked();
  // A later workflow disposition can copy the source context, never rewrite it.
  if (!same(parsePersistedJson(revision.contextSnapshot), context)
    || revision.invalidationRule !== first.invalidationRule || revision.missionText !== first.missionText) blocked();
  if (revision.id !== first.id) {
    let cursor = revision, remaining = revision.version;
    while (cursor.id !== first.id && remaining-- > 0) {
      if (cursor.previousRevisionId == null) blocked();
      const [previous] = await db.select().from(apertureDecisionRevisions).where(and(eq(apertureDecisionRevisions.id, cursor.previousRevisionId), eq(apertureDecisionRevisions.decisionRunId, head.id))).limit(1);
      if (!previous || previous.version !== cursor.version - 1 || !same(parsePersistedJson(previous.contextSnapshot), context)) blocked();
      cursor = previous;
    }
    if (cursor.id !== first.id) blocked();
  }
  return { selection, projection: { ...projection, graph: prepared.graph, confidenceNotes: prepared.confidenceNotes }, source, symbol: prepared.symbol };
}

/** Source-bound planning envelope, NOT order authority. The caller owns the
 * transaction; the ledger locks its account/event/claims without writing.
 * Never reconstruct a missing event, infer cash from equity, or upgrade gains.
 * Proposal integration must re-read/claim in its transaction, not trust a
 * previously returned envelope as an allocation or risk authorization. */
export async function readDiscoveryDeclaredEnvelope(tx: CapitalLedgerTransaction, userId: number,
  input: { decisionRunId: number; decisionRevisionId: number; ownOrderId?: number }) {
  if (typeof tx.rollback !== "function" || !id.safeParse(userId).success
    || !id.safeParse(input.decisionRunId).success || !id.safeParse(input.decisionRevisionId).success) blocked();
  const [head] = await tx.select().from(apertureDecisionRuns).where(and(
    eq(apertureDecisionRuns.id, input.decisionRunId), eq(apertureDecisionRuns.userId, userId),
  )).limit(1);
  if (!head || head.currentRevisionId !== input.decisionRevisionId) blocked();
  const [revision] = await tx.select().from(apertureDecisionRevisions).where(and(
    eq(apertureDecisionRevisions.id, input.decisionRevisionId), eq(apertureDecisionRevisions.decisionRunId, head.id),
  )).limit(1);
  if (!revision) blocked();
  const binding = await readDiscoveryResearchBinding(tx, userId, head, revision, Date.now(), true);
  const accepted = prepareObjectiveMission(binding.source.acceptedValues);
  const declaration = declaredObjectiveCapitalEvent(accepted);
  if (!declaration) blocked("This source needs independently reconciled proceeds. No verified capital envelope is available.");
  // Until source revisions have their own reviewed receipt, a child must not
  // silently replace its accepted capital or risk assumptions.
  if (revision.deployableCapitalCents !== accepted.deployableCapitalCents
    || revision.maxPlannedLossCents !== accepted.maxPlannedLossCents
    || revision.instrumentPreference !== accepted.values.instrument
    || revision.targetProfitCents !== accepted.targetProfitCents
    || revision.targetPeriod !== accepted.targetPeriod) blocked();
  const ledger = await readCapitalLedger(tx, userId, {
    accountId: declaration.accountId, capitalEventId: declaration.capitalEventId,
  });
  if (ledger.status !== "complete") blocked("The recorded capital declaration is unavailable. Reconcile its source record; no capital was recreated.");
  const event = ledger.event;
  if (event.sourceId !== declaration.sourceId || event.sourceKey !== declaration.sourceKey
    || event.sourceKind !== "operator_declared_excess" || event.proofBasis !== "operator_declared"
    || event.amountCents !== declaration.amountCents || event.currency !== declaration.currency) blocked();
  let receipt = ledger.receipt;
  // Revalidation may exclude only this proposal's existing pending earmark.
  // This is an in-memory comparison view, never a release or new cash receipt.
  if (input.ownOrderId !== undefined) {
    if (!id.safeParse(input.ownOrderId).success) blocked();
    const [order] = await tx.select().from(brokerOrders).where(and(eq(brokerOrders.id, input.ownOrderId),
      eq(brokerOrders.userId, userId))).for("update").limit(1);
    const own = receipt.allocationClaims.find(claim => claim.allocationId === paperOrderAllocationId(input.ownOrderId!));
    if (!order || !own || own.state !== "pending" || own.capitalEventId !== event.capitalEventId
      || own.amountCents !== order.gatedNotionalCents || !id.safeParse(order.gatedNotionalCents).success
      || order.accountId !== head.accountId || order.decisionRunId !== head.id
      || order.decisionRevisionId !== revision.id || order.runId !== head.researchRunId
      || !["pending_approval", "approved"].includes(order.status) || order.intent !== "open" || order.side !== "buy"
      || order.clientOrderId != null || order.brokerOrderId != null || order.submittedAt != null
      || order.submitConfirmedAt != null || order.dispatchError || order.filledAt != null
      || (order.filledQty != null && order.filledQty !== 0) || order.paperAckAt == null
      || (order.instrumentType === "shares" ? order.symbol : order.underlyingSymbol) !== binding.symbol
      || !z.object({ passed: z.literal(true) }).safeParse(parsePersistedJson(order.gateSnapshot)).success) {
      blocked("The proposal's capital reservation cannot be verified. Reconcile the exact proposal before continuing.");
    }
    receipt = { ...receipt, allocationClaims: receipt.allocationClaims.filter(claim => claim.allocationId !== own.allocationId) };
  }
  return deriveCapitalEnvelope({ source: {
    id: event.sourceId, kind: "operator_declared_excess", amountCents: event.amountCents!,
    declarationId: event.capitalEventId,
    account: { id: String(event.accountId), name: event.accountLabel, mode: "paper" },
  }, ledgerReceipt: receipt }, receipt.asOf);
}

/** Attach the exact server-persisted proposal to its declared pool in the SAME
 * transaction as insertion. Never accepts an amount, source or proof from UI.
 * This is not permission to create an order; the existing gate evaluation and
 * explicit human proposal action remain prerequisites. No standalone router. */
export async function reserveDiscoveryProposalCapital(tx: CapitalLedgerTransaction, userId: number, orderId: number) {
  if (typeof tx.rollback !== "function" || !id.safeParse(userId).success || !id.safeParse(orderId).success) blocked();
  const [initial] = await tx.select().from(brokerOrders).where(and(eq(brokerOrders.id, orderId), eq(brokerOrders.userId, userId))).limit(1);
  if (!initial || initial.decisionRunId == null || initial.decisionRevisionId == null) blocked();
  const identity = { decisionRunId: initial.decisionRunId, decisionRevisionId: initial.decisionRevisionId };
  const envelope = await readDiscoveryDeclaredEnvelope(tx, userId, identity);
  // The envelope read owns the account/ledger locks before head/order locks.
  const [head] = await tx.select().from(apertureDecisionRuns).where(and(eq(apertureDecisionRuns.id, identity.decisionRunId), eq(apertureDecisionRuns.userId, userId))).for("update").limit(1);
  if (!head || head.currentRevisionId !== identity.decisionRevisionId || head.researchRunId !== initial.runId || head.accountId !== initial.accountId) blocked();
  const [order] = await tx.select().from(brokerOrders).where(and(eq(brokerOrders.id, orderId), eq(brokerOrders.userId, userId))).for("update").limit(1);
  if (!order || order.accountId !== initial.accountId || order.runId !== initial.runId
    || order.decisionRunId !== identity.decisionRunId || order.decisionRevisionId !== identity.decisionRevisionId
    || order.status !== "pending_approval" || order.intent !== "open" || order.side !== "buy"
    || order.brokerOrderId != null || order.clientOrderId != null || order.submittedAt != null || order.submitConfirmedAt != null
    || order.approvedAt != null || order.approvalConfirmedAt != null || order.dispatchError
    || order.filledAt != null || (order.filledQty != null && order.filledQty !== 0)
    || order.paperAckAt == null || order.candidateId == null
    || !z.number().int().positive().safe().safeParse(order.gatedNotionalCents).success
    || !z.object({ passed: z.literal(true) }).safeParse(parsePersistedJson(order.gateSnapshot)).success) blocked();
  const [research] = await tx.select().from(apertureRuns).where(and(eq(apertureRuns.id, order.runId), eq(apertureRuns.userId, userId), eq(apertureRuns.accountId, head.accountId))).limit(1);
  const [candidate] = await tx.select().from(apertureCandidates).where(and(eq(apertureCandidates.id, order.candidateId), eq(apertureCandidates.runId, order.runId))).limit(1);
  if (!research || research.thesisId !== head.capitalThesisId || !candidate
    || candidate.symbol !== (order.instrumentType === "shares" ? order.symbol : order.underlyingSymbol)) blocked();
  const [revision] = await tx.select().from(apertureDecisionRevisions).where(and(eq(apertureDecisionRevisions.id, identity.decisionRevisionId), eq(apertureDecisionRevisions.decisionRunId, head.id))).limit(1);
  if (!revision) blocked();
  const selected = await readDiscoveryResearchBinding(tx, userId, head, revision, Date.now(), true);
  if (candidate.symbol !== selected.symbol) blocked();
  const capitalEventId = parsePersistedJson(revision?.contextSnapshot)?.capitalSourceEventId;
  if (typeof capitalEventId !== "string" || !capitalEventId.trim()) blocked();
  const allocationId = paperOrderAllocationId(orderId);
  const [existing] = await tx.select().from(apertureCapitalClaims).where(and(eq(apertureCapitalClaims.userId, userId), eq(apertureCapitalClaims.allocationId, allocationId))).for("update").limit(1);
  if (existing ? existing.state !== "pending" : envelope.status !== "operator_declared" || envelope.deployableCents < order.gatedNotionalCents!) {
    blocked("This capital envelope is already reserved or cannot cover the proposal. No additional allocation was recorded.");
  }
  return claimCapital(tx, userId, { accountId: head.accountId, capitalEventId, allocationId, amountCents: order.gatedNotionalCents! });
}

/** Deliberate selection only. Source owner lock serializes double clicks; a
 * transaction records the tactical projection, child Mission and lineage. */
export async function selectDiscoveryForResearch(db: Db, userId: number,
  raw: z.infer<typeof discoverySelectionInput>, now = Date.now()) {
  if (!objectiveDiscoveryEnabled()) blocked("Objective discovery is not enabled. The saved findings remain unchanged.");
  const input = discoverySelectionInput.parse(raw);
  return db.transaction(async tx => {
    const [parent] = await tx.select().from(apertureDecisionRuns).where(and(eq(apertureDecisionRuns.id, input.decisionRunId), eq(apertureDecisionRuns.userId, userId))).for("update").limit(1);
    if (!parent || parent.contextKind !== "objective") blocked();
    const [existing] = await tx.select().from(apertureDiscoverySelections).where(and(
      eq(apertureDiscoverySelections.userId, userId), eq(apertureDiscoverySelections.discoveryReceiptId, input.discoveryReceiptId),
      eq(apertureDiscoverySelections.hypothesisId, input.hypothesisId),
    )).limit(1);
    if (existing) {
      if (existing.sourceDecisionRunId !== parent.id || existing.sourceRevisionId !== input.decisionRevisionId) blocked();
      const [head] = await tx.select().from(apertureDecisionRuns).where(eq(apertureDecisionRuns.id, existing.researchDecisionRunId)).limit(1);
      const [revision] = await tx.select().from(apertureDecisionRevisions).where(eq(apertureDecisionRevisions.id, existing.researchRevisionId)).limit(1);
      if (!head || !revision) blocked();
      await readDiscoveryResearchBinding(tx, userId, head, revision, now);
      return receipt(existing, false);
    }
    if (parent.currentRevisionId !== input.decisionRevisionId || parent.researchRunId !== null || parent.lifecycle !== "mission") blocked("Review the current objective and its discovery result before selecting a lead.");
    const source = await readObjectiveDiscovery(tx, userId, { decisionRunId: input.decisionRunId, decisionRevisionId: input.decisionRevisionId });
    if (source.job.state !== "complete" || source.usingPreviousResult || source.receipt?.id !== input.discoveryReceiptId
      || source.latestAttempt?.id !== input.discoveryReceiptId) blocked("The selected research result is not the current completed attempt. Reconcile its saved status first.");
    const prepared = prepareDiscoveryResearchContext({ values: source.acceptedValues, result: source.receipt.result, hypothesisId: input.hypothesisId, now });
    const accepted = prepareObjectiveMission(source.acceptedValues);
    const [rawSource] = await tx.select().from(apertureStrategyDiscoveries).where(and(eq(apertureStrategyDiscoveries.id, input.discoveryReceiptId), eq(apertureStrategyDiscoveries.userId, userId))).limit(1);
    if (!rawSource) blocked();
    // One owned declaration, shared across hypotheses and retries. Registration
    // is atomic with selection; it neither reserves money nor verifies cash.
    const capitalSource = declaredObjectiveCapitalEvent(accepted);
    if (capitalSource) await recordCapitalEvent(tx, userId, capitalSource);
    const [projectionResult] = await tx.insert(capitalTheses).values({ userId, name: prepared.title, rawText: prepared.rawText,
      sourceCompilationId: null, graph: prepared.graph, confidenceNotes: prepared.confidenceNotes,
      status: "review", isPrimary: false, createdAt: now, updatedAt: now });
    const projectionId = Number(projectionResult.insertId);
    const [headResult] = await tx.insert(apertureDecisionRuns).values({ userId, contextKind: "discovery", canonicalThesisId: null,
      capitalThesisId: projectionId, accountId: parent.accountId, lifecycle: "mission", createdAt: now, updatedAt: now });
    const childId = Number(headResult.insertId);
    const contextSnapshot = { contextKind: "discovery", canonicalThesisId: null, capitalThesisId: projectionId, accountId: parent.accountId,
      sourceDecisionRunId: parent.id, sourceRevisionId: input.decisionRevisionId, discoveryReceiptId: input.discoveryReceiptId,
      hypothesisId: input.hypothesisId, sourceRecordHash: rawSource.recordHash, projectionHash: hash(prepared), selectedAt: now,
      availableCapitalCents: null, sourceBasis: accepted.sourceBasis,
      capitalSourceEventId: capitalSource?.capitalEventId ?? null };
    const revision = { decisionRunId: childId, version: 1, missionText: accepted.missionText, missionHash: "",
      missionSource: "inline" as const, objective: accepted.values.objective, instrumentPreference: accepted.values.instrument,
      includeHeldResearch: accepted.values.includeHeld, deployableCapitalCents: accepted.deployableCapitalCents,
      maxPlannedLossCents: accepted.maxPlannedLossCents, targetProfitCents: accepted.targetProfitCents, targetPeriod: accepted.targetPeriod,
      holdingPeriod: prepared.horizon, holdingPeriods: accepted.values.holdingPeriods, invalidationRule: prepared.invalidationRule,
      reviewAt: prepared.reviewAt, operatorChoice: "research" as const, effectiveBranch: "research" as const, plannedRiskCents: 0,
      contextSnapshot, gateSnapshot: { mandateVersion: CURRENT_MANDATE.version, paperOnly: true, humanApprovalRequired: true,
        riskAuthorityState: "pending_verification", permittedRiskCents: null, sourceAvailabilityVerified: false },
      createdByUserId: userId, createdAt: now };
    revision.missionHash = hash(revisionPayload(revision));
    const [revisionResult] = await tx.insert(apertureDecisionRevisions).values(revision);
    const childRevisionId = Number(revisionResult.insertId);
    await tx.update(apertureDecisionRuns).set({ currentRevisionId: childRevisionId }).where(eq(apertureDecisionRuns.id, childId));
    const record = { userId, sourceDecisionRunId: parent.id, sourceRevisionId: input.decisionRevisionId, discoveryReceiptId: input.discoveryReceiptId,
      hypothesisId: input.hypothesisId, researchDecisionRunId: childId, researchRevisionId: childRevisionId, capitalThesisId: projectionId,
      sourceRecordHash: rawSource.recordHash, context: prepared, createdAt: now };
    const [inserted] = await tx.insert(apertureDiscoverySelections).values({ ...record, recordHash: hash(record) });
    return receipt({ ...record, id: Number(inserted.insertId), recordHash: hash(record) }, true);
  });
}

export async function readDiscoverySelections(db: ReadDb, userId: number, input: { decisionRunId: number; decisionRevisionId: number }) {
  await readObjectiveDiscovery(db, userId, input);
  const rows = await db.select().from(apertureDiscoverySelections).where(and(
    eq(apertureDiscoverySelections.userId, userId), eq(apertureDiscoverySelections.sourceDecisionRunId, input.decisionRunId),
    eq(apertureDiscoverySelections.sourceRevisionId, input.decisionRevisionId),
  )).orderBy(desc(apertureDiscoverySelections.createdAt));
  return Promise.all(rows.map(async row => {
    const [head] = await db.select().from(apertureDecisionRuns).where(eq(apertureDecisionRuns.id, row.researchDecisionRunId)).limit(1);
    if (!head?.currentRevisionId) blocked();
    const [revision] = await db.select().from(apertureDecisionRevisions).where(eq(apertureDecisionRevisions.id, head.currentRevisionId)).limit(1);
    if (!revision) blocked();
    await readDiscoveryResearchBinding(db, userId, head, revision);
    return { ...receipt(row, false), decisionRevisionId: revision.id };
  }));
}

export async function assertNotDiscoveryProjection(db: ReadDb, userId: number, capitalThesisId: number) {
  const [selection] = await db.select({ id: apertureDiscoverySelections.id }).from(apertureDiscoverySelections).where(and(
    eq(apertureDiscoverySelections.userId, userId), eq(apertureDiscoverySelections.capitalThesisId, capitalThesisId),
  )).limit(1);
  if (selection) blocked("This is an immutable tactical research context, not a legacy canonical thesis. Return to its selected discovery record to review it.");
}
