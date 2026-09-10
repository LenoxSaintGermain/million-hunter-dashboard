import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { apertureDecisionRevisions, apertureDecisionRuns, apertureMissionDraftRevisions, apertureMissionDrafts,
  apertureRuns, apertureCandidates, brokerOrders, portfolioAccounts, thesisCompilations } from "../../drizzle/schema";
import { missionDraftFingerprint, missionDraftValuesSchema, type MissionDraftValues } from "../../shared/apertureMissionDraft";
import { CURRENT_MANDATE, MIN_NARRATIVE_CHARS } from "./mandate";
import type { getDb } from "../db";
import { parsePersistedJson } from "../../shared/persistedJson";
import { immutableReceiptBindingIssue } from "./decisionReceiptBinding";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export const acceptObjectiveMissionInput = z.object({ expectedVersion: z.number().int().positive().safe(), requestId: z.string().uuid() }).strict();
function invalid(message: string): never { throw new TRPCError({ code: "PRECONDITION_FAILED", message }); }
function conflict(): never { throw new TRPCError({ code: "CONFLICT", message: "The saved objective changed. Review the current draft; no new Mission was created." }); }

/** Decimal input, not a market price or inferred account allocation. */
export function parseDeclaredCents(raw: string): number {
  const text = raw.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) invalid("Enter a dollar amount with at most two decimal places.");
  const [whole, fraction = ""] = text.replaceAll(",", "").split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) invalid("The declared amount exceeds the supported range.");
  return Number(cents);
}

/** A planning request only. No permission, availability or tactical thesis is inferred. */
export function prepareObjectiveMission(raw: MissionDraftValues) {
  const values = missionDraftValuesSchema.parse(raw);
  const strategy = values.strategyContext;
  if (!strategy) invalid("Choose an explicit capital objective before accepting this Mission.");
  if (values.branch !== "research") invalid("Use the separate hold or retain-capital receipt for that disposition.");
  if (values.baseDecisionRunId != null) invalid("Review changes through the exact accepted Mission revision; do not create another Mission.");
  if (!values.accountId) invalid("Choose the named paper account.");
  if (values.mission.trim().length < MIN_NARRATIVE_CHARS) invalid("Describe the capital question before accepting this Mission.");
  if (strategy.searchScope !== "broader_permitted_universe" && values.canonicalThesisId == null) invalid("Choose a saved thesis for this search scope, or explicitly choose a broader search.");
  if (!values.holdingPeriods.length || !values.holdingPeriods.includes(values.holdingPeriod)) invalid("Confirm the primary horizon within the selected horizons.");
  const capital = parseDeclaredCents(values.capital), maxLoss = parseDeclaredCents(values.maxLoss);
  if (capital <= 0 || maxLoss <= 0 || maxLoss > capital) invalid("Enter positive declared capital and a planned-loss limit no greater than that capital.");
  const target = values.targetProfit.trim() ? parseDeclaredCents(values.targetProfit) : null;
  if (target === 0) invalid("Leave the optional target empty, or enter a positive target.");
  if (strategy.intent === "deploy_excess_capital" && !strategy.declarationId) invalid("Retain the explicit capital declaration identity before accepting this objective.");
  if (strategy.intent === "redeploy_realized_gains" && !strategy.sourceOrder) invalid("Choose the exact source order before planning a gains redeployment.");
  const reserve = strategy.profitReserve.trim() ? parseDeclaredCents(strategy.profitReserve) : null;
  return {
    values, strategy, canonicalThesisId: values.canonicalThesisId, accountId: values.accountId,
    missionText: values.mission.trim(), deployableCapitalCents: capital, maxPlannedLossCents: maxLoss,
    targetProfitCents: target, targetPeriod: target == null ? null : values.targetPeriod,
    profitReserveCents: reserve, invalidationRule: null,
    sourceBasis: strategy.intent === "deploy_excess_capital" ? "operator_declared" as const : "hypothetical_only" as const,
    availableCapitalCents: null, permittedRiskCents: null,
  };
}

/** Verify against the immutable source version, never today's mutable draft.
 * Reused for exact reads, retries and a draft's claimed baseline. */
export async function readAcceptedObjectiveValues(db: Pick<Db, "select">, userId: number,
  head: typeof apertureDecisionRuns.$inferSelect, revision: typeof apertureDecisionRevisions.$inferSelect) {
  const context = parsePersistedJson(revision.contextSnapshot);
  if (!context || head.contextKind !== "objective" || revision.decisionRunId !== head.id || revision.createdByUserId !== userId
    || immutableReceiptBindingIssue({ requestedOwnerId: userId, run: { ...head, ownerId: head.userId },
      contextSnapshot: context, gateSnapshot: parsePersistedJson(revision.gateSnapshot) })) invalid("The accepted objective receipt is inconsistent. Reconcile its saved record; no new Mission was created.");
  const [original] = await db.select().from(apertureMissionDraftRevisions).where(and(
    eq(apertureMissionDraftRevisions.draftId, context.sourceDraftId as number), eq(apertureMissionDraftRevisions.userId, userId),
    eq(apertureMissionDraftRevisions.version, context.sourceDraftVersion as number))).limit(1);
  if (!original || original.completedAt != null) invalid("The original accepted draft version is unavailable. No receipt was reconstructed.");
  const values = missionDraftValuesSchema.parse(context.acceptedDraft);
  const originalValues = missionDraftValuesSchema.parse(parsePersistedJson(original.values));
  const fingerprint = missionDraftFingerprint(values);
  if (fingerprint !== missionDraftFingerprint(originalValues)
    || createHash("sha256").update(fingerprint).digest("hex") !== revision.missionHash) invalid("The accepted objective no longer matches its original draft. Reconcile the immutable record.");
  const expected = prepareObjectiveMission(values);
  if (revision.missionText !== expected.missionText || revision.deployableCapitalCents !== expected.deployableCapitalCents
    || revision.maxPlannedLossCents !== expected.maxPlannedLossCents || revision.targetProfitCents !== expected.targetProfitCents
    || revision.targetPeriod !== expected.targetPeriod || revision.desiredEndingValueCents !== null
    || revision.instrumentPreference !== values.instrument || revision.includeHeldResearch !== values.includeHeld
    || revision.objective !== values.objective || revision.holdingPeriod !== values.holdingPeriod
    || JSON.stringify(parsePersistedJson(revision.holdingPeriods)) !== JSON.stringify(values.holdingPeriods)
    || revision.invalidationRule !== null || context.profitReserveCents !== expected.profitReserveCents
    || revision.effectiveBranch !== "research" || revision.operatorChoice !== "research" || revision.plannedRiskCents !== 0) {
    invalid("The accepted objective calculations differ from its saved assumptions. No current eligibility is asserted.");
  }
  return values;
}

/** Atomic acceptance in the existing Mission/revision store. Deliberately no jobs,
 * projections, allocations, research, providers, approvals or order operations. */
export async function acceptObjectiveMission(db: Db, userId: number, raw: z.infer<typeof acceptObjectiveMissionInput>, now = Date.now(),
  validateBeforeCompletion?: (db: Pick<Db, "select">, values: MissionDraftValues) => Promise<void>) {
  const input = acceptObjectiveMissionInput.parse(raw);
  return db.transaction(async tx => {
    // Every draft writer updates this owner/version row. Lock before reading its
    // inputs or accepting a request so a concurrent autosave cannot be swallowed.
    const [draftRow] = await tx.select().from(apertureMissionDrafts).where(eq(apertureMissionDrafts.userId, userId)).for("update").limit(1);
    const [existing] = await tx.select().from(apertureDecisionRuns).where(and(eq(apertureDecisionRuns.userId, userId), eq(apertureDecisionRuns.clientRequestId, input.requestId))).limit(1);
    if (existing) {
      const [first] = await tx.select().from(apertureDecisionRevisions).where(and(eq(apertureDecisionRevisions.decisionRunId, existing.id), eq(apertureDecisionRevisions.version, 1))).limit(1);
      const context = first ? parsePersistedJson(first.contextSnapshot) : null;
      if (existing.contextKind !== "objective" || !first || context?.requestId !== input.requestId || context?.sourceDraftVersion !== input.expectedVersion) conflict();
      await readAcceptedObjectiveValues(tx, userId, existing, first);
      return { decisionRunId: existing.id, revisionId: first.id, created: false as const, status: "accepted" as const };
    }
    if (!draftRow) conflict();
    const draft = { ...draftRow, values: missionDraftValuesSchema.parse(parsePersistedJson(draftRow.values)) };
    if (draft.completedAt != null || draft.version !== input.expectedVersion || draft.values.strategyContext?.requestId !== input.requestId) conflict();
    const accepted = prepareObjectiveMission(draft.values);
    const [account] = await tx.select().from(portfolioAccounts).where(and(eq(portfolioAccounts.id, accepted.accountId), eq(portfolioAccounts.userId, userId), eq(portfolioAccounts.isPaper, true))).for("update").limit(1);
    if (!account) invalid("The selected paper account is unavailable to this operator. The draft is unchanged.");
    if (accepted.canonicalThesisId != null) {
      const [canonical] = await tx.select({ id: thesisCompilations.id }).from(thesisCompilations).where(and(eq(thesisCompilations.id, accepted.canonicalThesisId), eq(thesisCompilations.userId, userId))).limit(1);
      if (!canonical) invalid("The chosen thesis is unavailable to this operator. No active thesis was substituted.");
    }
    const source = accepted.strategy.sourceOrder;
    if (source) {
      const [owned] = await tx.select({ id: brokerOrders.id }).from(brokerOrders)
        .innerJoin(apertureRuns, eq(apertureRuns.id, brokerOrders.runId))
        .innerJoin(apertureCandidates, and(eq(apertureCandidates.id, brokerOrders.candidateId), eq(apertureCandidates.runId, brokerOrders.runId)))
        .where(and(eq(brokerOrders.userId, userId), eq(apertureRuns.userId, userId), eq(brokerOrders.accountId, accepted.accountId),
          eq(brokerOrders.id, source.orderId), eq(brokerOrders.runId, source.runId), eq(brokerOrders.candidateId, source.candidateId))).limit(1);
      if (!owned) invalid("The exact source order is unavailable in this account and play. No proceeds were verified.");
    }
    // The caller's read-only analysis prerequisites run under the same draft
    // lock. A correctable research input must not consume/complete the draft.
    await validateBeforeCompletion?.(tx, accepted.values);
    const contextSnapshot = {
      contextKind: "objective", requestId: input.requestId, canonicalThesisId: null, capitalThesisId: null,
      selectedCanonicalThesisId: accepted.canonicalThesisId, accountId: account.id,
      sourceDraftId: draft.id, sourceDraftVersion: draft.version, acceptedDraft: accepted.values,
      sourceBasis: accepted.sourceBasis, availableCapitalCents: null, profitReserveCents: accepted.profitReserveCents,
      accountLabel: account.label, accountLastSyncedAt: account.lastSyncedAt,
    };
    const [headResult] = await tx.insert(apertureDecisionRuns).values({ userId, contextKind: "objective", clientRequestId: input.requestId,
      canonicalThesisId: null, capitalThesisId: null, accountId: account.id, lifecycle: "mission", createdAt: now, updatedAt: now });
    const decisionRunId = Number(headResult.insertId);
    const [revisionResult] = await tx.insert(apertureDecisionRevisions).values({
      decisionRunId, version: 1, missionText: accepted.missionText,
      missionHash: createHash("sha256").update(missionDraftFingerprint(accepted.values)).digest("hex"),
      missionSource: "inline", objective: accepted.values.objective, instrumentPreference: accepted.values.instrument,
      includeHeldResearch: accepted.values.includeHeld, deployableCapitalCents: accepted.deployableCapitalCents,
      maxPlannedLossCents: accepted.maxPlannedLossCents, targetProfitCents: accepted.targetProfitCents,
      targetPeriod: accepted.targetPeriod, desiredEndingValueCents: null, holdingPeriod: accepted.values.holdingPeriod,
      holdingPeriods: accepted.values.holdingPeriods, invalidationRule: null, operatorChoice: "research", effectiveBranch: "research",
      plannedRiskCents: 0, contextSnapshot,
      gateSnapshot: { mandateVersion: CURRENT_MANDATE.version, paperOnly: true, humanApprovalRequired: true,
        riskAuthorityState: "pending_verification", permittedRiskCents: null, sourceAvailabilityVerified: false },
      createdByUserId: userId, createdAt: now,
    });
    const revisionId = Number(revisionResult.insertId);
    await tx.update(apertureDecisionRuns).set({ currentRevisionId: revisionId }).where(eq(apertureDecisionRuns.id, decisionRunId));
    // The completed draft remains readable, preserving both the original inputs
    // and their exact receipt. A subsequent draft is a distinct operator action.
    const completedValues = { ...accepted.values, baseDecisionRunId: decisionRunId, baseDecisionRevisionId: revisionId };
    const result = await tx.update(apertureMissionDrafts).set({ values: completedValues, completedAt: now, updatedAt: now, version: draft.version + 1 })
      .where(and(eq(apertureMissionDrafts.id, draft.id), eq(apertureMissionDrafts.userId, userId), eq(apertureMissionDrafts.version, draft.version)));
    if (!result[0].affectedRows) conflict();
    await tx.insert(apertureMissionDraftRevisions).values({ draftId: draft.id, userId, version: draft.version + 1, values: completedValues, completedAt: now, createdAt: now });
    return { decisionRunId, revisionId, created: true as const, status: "accepted" as const };
  });
}
