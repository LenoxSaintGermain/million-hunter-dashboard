/**
 * Aperture router — tRPC namespace `aperture`.
 *
 * Every procedure is capitalOperatorProcedure: this is a single-operator internal tool.
 * No autonomous execution. Paper only. The guardrails are structural, not
 * just a warning banner.
 *
 * Persistent banner requirement: every Aperture surface must show
 * "Internal research tool — not investment advice. Modeled figures labeled as
 * such." This is enforced in the client, not here, but it is documented here
 * so the contract is visible in the server code too.
 */
import { z } from "zod";
import { eq, and, or, inArray, gte, lt, sql, asc, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "./db";
import {
  capitalTheses,
  portfolioAccounts,
  positions,
  apertureActivePlayContexts,
  apertureRuns,
  apertureCandidates,
  apertureStrategies,
  exposureNodes,
  exposureCoverage,
  securityFacts,
  apertureEvidenceReviews,
  aperturePlayDecisions,
  aperturePlaySlates,
  aperturePlaySlateItems,
  apertureRunwayStates,
  apertureDecisionRuns,
  apertureDecisionRevisions,
  aperturePendingOutcomes,
  apertureSetAside,
  disclosurePlans,
  disclosurePlanRevisions,
  disclosureFilings,
  disclosureRetrievals,
  disclosureTransactions,
  disclosureMatches,
  disclosureEntityAliases,
  thesisCompilations,
  users,
} from "../drizzle/schema";
import { capitalOperatorProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { applyCanonicalDeclarations, compileThesis, flattenExposureTree, resolveRunGraph, validateGraphForPersistence, type ThesisGraph } from "./aperture/thesisGraph";
import { discoverUniverse, operatorDeclaredUniverse, thesisSummary } from "./aperture/universe";
import { collectSecurityFacts, collectMacroFacts, describeAvailability, availabilityMap, MACRO_SYMBOL } from "./aperture/providers/index";
import { getFacts, freshestPerKey } from "./aperture/facts";
import { runResearchSwarm } from "./aperture/researchSwarm";
import { scoreThesisFit, assignRole } from "./aperture/score";
import { buildStrategies } from "./aperture/strategies";
import { snapshot } from "./aperture/portfolioMath";
import { assembleRun } from "./aperture/run";
import { generateMemo } from "./aperture/memo";
import { belongsInMemoLibrary } from "./aperture/memoLibrary";
import { brokerFor, listBrokers } from "./aperture/brokers/index";
import { normSymbol } from "./aperture/facts";
import { createOrder, approveOrder, rejectOrder, submitOrder as submitBrokerOrder, mirrorFills, preflightOrder, OrderGateError } from "./aperture/orderFlow";
import { evaluateRunPreset } from "./aperture/gates";
import { buildCockpit } from "./aperture/cockpit";
import { CURRENT_MANDATE, HOLDING_PERIOD_KEYS, MIN_NARRATIVE_CHARS, PAPER_ACKNOWLEDGEMENT } from "./aperture/mandate";
import { runMonitoringChecks, getMonitoringChecks, getFlaggedChecks } from "./aperture/monitor";
import { computeAlpha, getAlpha } from "./aperture/alpha";
import { brokerOrders, monitoringChecks } from "../drizzle/schema";
import { desc } from "drizzle-orm";
import { buildCapitalDecisionBrief } from "./aperture/decisionBrief";
import { ensureThesisReady } from "./aperture/thesisReadiness";
import { buildBriefResearchPlan, isRunStale, nextFollowUpOffset } from "./aperture/runRecovery";
import { getEvidenceReviewReadiness } from "../shared/evidenceReview";
import { normalizeJsonRecord, normalizeStringList } from "../shared/stringList";
import { missingIntradayRecipeMessage } from "../shared/intradayRecipeGuard";
import { fetchIntradayBars } from "./aperture/providers/marketData";
import { checkVwapHold, openingRange, sessionVwap } from "./aperture/intraday";
import { REGULAR_OPEN, etClock, marketSession, nextRegularSessionOpen, startOfEtDay } from "./aperture/marketSession";
import { constructPlay, CONSTRUCTED_PLAY_DISCLOSURE, QUEUE_AT_OPEN_PLAY_DISCLOSURE } from "./aperture/playConstructor";
import { requestsQueueAtOpen } from "./aperture/queueAtOpen";
import { canonicalCapitalValues, needsCanonicalPromotion } from "./aperture/canonicalThesisLink";
import { normalizeCapitalThesisRead } from "../shared/thesisReadContract";
import { buildTrustCalibration, calculatePaperPlayOutcome } from "../shared/playOutcomeLedger";
import { buildPortfolioImpactTrend, type PortfolioImpactTrendRow } from "../shared/portfolioImpactTrend";
import { evaluateIntradayPaperOutcome } from "./aperture/playOutcomeEvaluator";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { readSessionCookie } from "./_core/sessionCookie";
import { DAILY_OUTCOME_REFRESH_CRON, DAILY_OUTCOME_REFRESH_PATH, refreshLiveSlateOutcomes } from "./aperture/dailyOutcomeRefresh";
import { ONE_TIME_GLP1_RESEARCH_PATH, oneTimeResearchCron } from "./aperture/oneTimeGlp1Research";
import { PAPER_ACCOUNT_SYNC_CRON, PAPER_ACCOUNT_SYNC_PATH } from "./aperture/paperAccountSyncScheduled";
import { validatePaperInstrument } from "../shared/paperInstrument";
import { compileDisclosureIntent, evaluateDisclosureTransaction, tightenControls, type DisclosureControls } from "../shared/disclosure";
import { DisclosureDocumentStore, housePtrFixtureDocument } from "./aperture/disclosureRail";
import {
  decisionReceiptPendingOutcome,
  DecisionRunwayBlockedError,
  outcomeReviewAt,
  rankMissionLibrary,
} from "./aperture/decisionRunway";
import { immutableReceiptBindingIssue } from "./aperture/decisionReceiptBinding";
import { resolveCapitalMissionDefaults } from "../shared/capitalMissionDefaults";
import { evaluateThesisResearchReadiness } from "./aperture/thesisResearchReadiness";
import { detailsFromCanonicalRecord } from "../shared/capitalThesisStructure";
import { classifyDeskCandidate, summarizeDeskCandidates } from "../shared/playDeskState";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function requireThesis(db: Awaited<ReturnType<typeof getDb>>, thesisId: number, userId: number) {
  const rows = await db!.select().from(capitalTheses)
    .where(and(eq(capitalTheses.id, thesisId), eq(capitalTheses.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Thesis not found" });
  return normalizeCapitalThesisRead(rows[0]);
}

async function requireAccount(db: Awaited<ReturnType<typeof getDb>>, accountId: number, userId: number) {
  const rows = await db!.select().from(portfolioAccounts)
    .where(and(eq(portfolioAccounts.id, accountId), eq(portfolioAccounts.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
  return rows[0];
}

function receiptBindingUnavailable(): never {
  throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Decision binding unavailable" });
}

async function syncCapturedPlayDecision(input: {
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  userId: number;
  runId: number;
  candidateId: number;
  decision: "selected" | "skipped" | "deferred";
  reason: string;
  decidedAt?: number;
}) {
  const decidedAt = input.decidedAt ?? Date.now();
  const captured = await input.db.select({
    itemId: aperturePlaySlateItems.id,
    slateId: aperturePlaySlates.id,
  }).from(aperturePlaySlateItems)
    .innerJoin(aperturePlaySlates, eq(aperturePlaySlateItems.slateId, aperturePlaySlates.id))
    .where(and(
      eq(aperturePlaySlates.userId, input.userId),
      eq(aperturePlaySlates.snapshotBasis, "live_capture"),
      eq(aperturePlaySlateItems.sourceRunId, input.runId),
      eq(aperturePlaySlateItems.sourceCandidateId, input.candidateId),
    ))
    .orderBy(desc(aperturePlaySlates.capturedAt))
    .limit(1);
  if (!captured.length) return { updatedItems: 0, updatedSlates: 0 };

  const capturedDecision = captured[0];
  await input.db.update(aperturePlaySlateItems).set({
    operatorDecision: input.decision,
    operatorReason: input.reason,
    decidedAt,
    updatedAt: decidedAt,
  }).where(eq(aperturePlaySlateItems.id, capturedDecision.itemId));

  if (input.decision === "selected") {
    await input.db.update(aperturePlaySlates).set({
      operatorDecision: "selected",
      operatorReason: input.reason,
      decidedAt,
      updatedAt: decidedAt,
    }).where(eq(aperturePlaySlates.id, capturedDecision.slateId));
  }
  return { updatedItems: 1, updatedSlates: input.decision === "selected" ? 1 : 0 };
}

function snapshotRecord(value: unknown): Record<string, unknown> | null {
  let candidate: unknown = value;
  // Older rows arrived from MariaDB as a JSON string containing JSON text. Decode
  // at most twice; any other representation remains unavailable rather than guessed.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) return candidate as Record<string, unknown>;
    if (typeof candidate !== "string") return null;
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  return candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate as Record<string, unknown> : null;
}

function isExactIsolatedUatRuntime() {
  if (process.env.NODE_ENV !== "development" || process.env.ISOLATED_UAT_MODE !== "true") return false;
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return url.protocol === "mysql:"
      && url.hostname === "127.0.0.1"
      && url.port === "3307"
      && url.pathname === "/capital_aperture_uat_9c18799"
      && url.username === "uat_app";
  } catch {
    return false;
  }
}

async function readImmutableDecisionReceipt(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  decisionRun: typeof apertureDecisionRuns.$inferSelect,
  revision: typeof apertureDecisionRevisions.$inferSelect,
) {
  const context = snapshotRecord(revision.contextSnapshot);
  const gateSnapshot = snapshotRecord(revision.gateSnapshot);
  if (!context || !gateSnapshot) receiptBindingUnavailable();
  if (immutableReceiptBindingIssue({
    requestedOwnerId: userId,
    run: {
      ownerId: decisionRun.userId,
      canonicalThesisId: decisionRun.canonicalThesisId,
      capitalThesisId: decisionRun.capitalThesisId,
      accountId: decisionRun.accountId,
    },
    contextSnapshot: context,
    gateSnapshot,
  })) receiptBindingUnavailable();

  const [[canonical], [projection], [account]] = await Promise.all([
    db.select({ id: thesisCompilations.id, name: thesisCompilations.name }).from(thesisCompilations).where(eq(thesisCompilations.id, decisionRun.canonicalThesisId)).limit(1),
    db.select({ id: capitalTheses.id, name: capitalTheses.name, sourceCompilationId: capitalTheses.sourceCompilationId }).from(capitalTheses).where(and(eq(capitalTheses.id, decisionRun.capitalThesisId), eq(capitalTheses.userId, userId))).limit(1),
    db.select({ id: portfolioAccounts.id, label: portfolioAccounts.label, isPaper: portfolioAccounts.isPaper }).from(portfolioAccounts).where(and(eq(portfolioAccounts.id, decisionRun.accountId), eq(portfolioAccounts.userId, userId))).limit(1),
  ]);
  if (!canonical || !projection || projection.sourceCompilationId !== canonical.id || !account?.isPaper) receiptBindingUnavailable();
  const [cashOutcome] = revision.effectiveBranch === "cash"
    ? await db.select({
      status: aperturePendingOutcomes.status,
      result: aperturePendingOutcomes.result,
      resolvedAt: aperturePendingOutcomes.resolvedAt,
    }).from(aperturePendingOutcomes).where(and(
      eq(aperturePendingOutcomes.userId, userId),
      eq(aperturePendingOutcomes.decisionRunId, decisionRun.id),
      eq(aperturePendingOutcomes.revisionId, revision.id),
      eq(aperturePendingOutcomes.kind, "play_outcome"),
    )).orderBy(desc(aperturePendingOutcomes.updatedAt)).limit(1)
    : [undefined];
  return {
    ...revision,
    id: decisionRun.id,
    decisionRunId: decisionRun.id,
    decisionRevisionId: revision.id,
    branch: revision.effectiveBranch,
    runId: decisionRun.researchRunId,
    accountId: decisionRun.accountId,
    canonicalThesisId: decisionRun.canonicalThesisId,
    capitalThesisId: decisionRun.capitalThesisId,
    lifecycle: decisionRun.lifecycle,
    cashOutcome: cashOutcome?.status === "resolved" ? cashOutcome : null,
    authority: "authoritative" as const,
    binding: {
      ownerId: decisionRun.userId,
      canonicalThesisId: canonical.id,
      canonicalThesisName: canonical.name ?? "Unnamed thesis",
      capitalThesisId: projection.id,
      capitalThesisName: projection.name ?? "Unnamed Capital thesis",
      accountId: account.id,
      accountLabel: account.label,
      mandateVersion: gateSnapshot.mandateVersion as string,
      decisionVersion: revision.version,
    },
  };
}

/**
 * Cron-safe research-only counterpart to `run.start`. It reads an owner-authorized
 * projected thesis and paper account, applies the same run mandate, then starts
 * the existing research worker. It cannot reach proposal or broker-order code.
 */
export async function startScheduledCapitalResearch(input: {
  userId: number;
  canonicalThesisId: number;
  targetAt: number;
}): Promise<{ runId: number }> {
  const db = await getDb();
  const [thesis] = await db!.select().from(capitalTheses).where(and(
    eq(capitalTheses.userId, input.userId),
    eq(capitalTheses.sourceCompilationId, input.canonicalThesisId),
  )).limit(1);
  if (!thesis) throw new Error("The scheduled canonical thesis is no longer available in Capital Aperture.");
  if (!thesis.graph) throw new Error("The scheduled thesis needs a prepared Capital graph before its post-open research brief can run.");
  const [account] = await db!.select().from(portfolioAccounts).where(and(
    eq(portfolioAccounts.userId, input.userId),
    eq(portfolioAccounts.isPaper, true),
  )).limit(1);
  if (!account) throw new Error("A paper account is required before scheduled Capital research can apply a portfolio boundary.");
  const dayStart = startOfEtDay(input.targetAt);
  if (dayStart == null) throw new Error("The scheduled Eastern-market session could not be determined.");
  const runInput = {
    thesisId: thesis.id,
    accountId: account.id,
    deployableCapitalCents: 2_000_000,
    intendedTrades: [] as Array<{ symbol: string; dollarsCents: number; note?: string }>,
    holdingPeriod: "intraday",
    instrumentPreference: "shares" as const,
    liquidityFloorAdvUsd: 50_000_000,
    catalystDeadlineAt: dayStart + (15 * 60 + 55) * 60_000,
    maxSingleNamePct: 5,
    invalidationRule: "Invalidate if the GLP-1 demand catalyst does not occur by the stated deadline, or its disclosed result contradicts the thesis.",
  };
  const preset = evaluateRunPreset(runInput, {
    accountLinked: true,
    equityCents: account.equityValueCents ?? null,
  }, CURRENT_MANDATE, input.targetAt);
  if (!preset.passed) throw new Error(`Scheduled research preset rejected by the mandate: ${preset.failures.join("; ")}`);
  const [result] = await db!.insert(apertureRuns).values({
    userId: input.userId,
    thesisId: thesis.id,
    accountId: account.id,
    deployableCapitalCents: runInput.deployableCapitalCents,
    intendedTrades: runInput.intendedTrades,
    hurdleRateBps: null,
    holdingPeriod: runInput.holdingPeriod as any,
    instrumentPreference: runInput.instrumentPreference,
    catalystDeadlineAt: runInput.catalystDeadlineAt,
    liquidityFloorAdvUsd: runInput.liquidityFloorAdvUsd,
    maxSingleNamePct: runInput.maxSingleNamePct,
    invalidationRule: runInput.invalidationRule,
    mandateVersion: preset.mandateVersion,
    status: "queued",
    createdAt: input.targetAt,
  });
  const runId = (result as any).insertId as number;
  executeRun(runId, input.userId, thesis, runInput).catch((error) => {
    console.error(`[aperture] scheduled research run ${runId} failed:`, error?.message ?? error);
  });
  return { runId };
}

/**
 * The non-gate precondition on a candidate-originated order: the operator must
 * have recorded a review of every decision-critical evidence check. Returns the
 * blocking message, or null when nothing blocks.
 *
 * Shared by `order.create` (which throws it) and `order.preflight` (which
 * reports it). Preflight would otherwise be able to say "clear" about an order
 * create refuses for a reason that is not a gate.
 */
async function evidenceReviewBlock(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: number,
  runId: number,
  candidateId: number | null | undefined,
): Promise<string | null> {
  if (candidateId == null) return null;
  const [candidate] = await db!.select().from(apertureCandidates)
    .where(and(eq(apertureCandidates.id, candidateId), eq(apertureCandidates.runId, runId)))
    .limit(1);
  if (!candidate) throw new TRPCError({ code: "NOT_FOUND", message: "Candidate not found in this research brief" });
  const requiredChecks = normalizeStringList(candidate.verifyFields);
  if (!requiredChecks.length) return null;
  const reviews = await db!.select().from(apertureEvidenceReviews).where(and(
    eq(apertureEvidenceReviews.userId, userId),
    eq(apertureEvidenceReviews.runId, runId),
    eq(apertureEvidenceReviews.candidateId, candidateId),
  ));
  const readiness = getEvidenceReviewReadiness(requiredChecks, reviews);
  if (readiness.paperStageDeclined) {
    return `Paper stage declined because ${readiness.negativeChecks.length} required evidence check${readiness.negativeChecks.length === 1 ? " was" : "s were"} recorded as not confirmed. Start a new research decision before preparing another proposal.`;
  }
  if (readiness.paperProposalReady) return null;
  const n = readiness.unreviewedChecks.length;
  return `Record your review of ${n} evidence check${n === 1 ? "" : "s"} before preparing this paper proposal`;
}

// ── Order input schemas ───────────────────────────────────────────────────────

/**
 * This schema checks PRESENCE, not policy. The ceilings are enforced in
 * orderFlow.createOrder — the only layer that can see the account, the positions
 * and the fact ledger at once, and the layer every non-router caller also goes
 * through. Duplicating the numbers here would give two places to change them and
 * one of them would drift.
 */
const orderCreateInput = z.object({
  runId: z.number(),
  candidateId: z.number().optional(),
  accountId: z.number(),
  portfolioContextAccountId: z.number().optional(),
  symbol: z.string(),
  instrumentType: z.enum(["shares", "long_call", "long_put"]).default("shares"),
  underlyingSymbol: z.string().max(24).optional(),
  optionExpirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  optionStrikePriceCents: z.number().int().positive().optional(),
  contractMultiplier: z.number().int().positive().optional(),
  side: z.enum(["buy", "sell"]),
  qty: z.number().optional(),
  notionalCents: z.number().optional(),
  orderType: z.enum(["market", "limit"]).default("market"),
  limitPriceCents: z.number().optional(),
  timeInForce: z.enum(["day", "gtc"]).default("day"),
  reason: z.string().min(MIN_NARRATIVE_CHARS),
  invalidationCondition: z.string().min(MIN_NARRATIVE_CHARS),
  invalidationPriceCents: z.number().optional(),
  entryPriceCents: z.number().optional(),
  stopPriceCents: z.number().optional(),
  slippageCents: z.number().min(0).optional(),
  timeStopAt: z.number().optional(),
  noTradeConditions: z.array(z.string().min(2).max(300)).max(8).optional(),
  holdingPeriod: z.enum(HOLDING_PERIOD_KEYS as [string, ...string[]]),
  catalystDeadlineAt: z.number(),
  paperAcknowledgement: z.literal(PAPER_ACKNOWLEDGEMENT),
});

/**
 * The same fields, with the required-narrative and acknowledgement constraints
 * relaxed. A ticket being typed is incomplete by definition, and a preflight
 * that answers a half-written ticket with a zod validation error tells the
 * operator nothing about the mandate. The gates answer instead — which is the
 * same division of labour the create path already uses ("presence, not policy").
 *
 * Relaxing this here cannot let anything through: preflight re-parses the input
 * against `orderCreateInput` and reports every schema error as blocking, so
 * `wouldPass` is false for exactly the inputs create would refuse.
 */
const orderPreflightInput = orderCreateInput.extend({
  reason: z.string().max(4000).optional(),
  invalidationCondition: z.string().max(4000).optional(),
  holdingPeriod: z.enum(HOLDING_PERIOD_KEYS as [string, ...string[]]).optional(),
  catalystDeadlineAt: z.number().optional(),
  paperAcknowledgement: z.string().max(64).optional(),
});

// ── Router ────────────────────────────────────────────────────────────────────

export const apertureRouter = router({

  // ── Thesis management ──────────────────────────────────────────────────────

  thesis: router({
    list: capitalOperatorProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const rows = await db!.select().from(capitalTheses)
        .where(eq(capitalTheses.userId, ctx.user.id))
        .orderBy(desc(capitalTheses.updatedAt));
      const sourceIds = rows
        .map((row) => row.sourceCompilationId)
        .filter((id): id is number => typeof id === "number");
      const canonicalSources = sourceIds.length
        ? await db!.select({ id: thesisCompilations.id, compiledFilters: thesisCompilations.compiledFilters })
          .from(thesisCompilations)
          .where(and(eq(thesisCompilations.userId, ctx.user.id), inArray(thesisCompilations.id, sourceIds)))
        : [];
      const canonicalById = new Map(canonicalSources.map((source) => [source.id, source]));
      return rows.map((row) => {
        const normalized = normalizeCapitalThesisRead(row);
        const compiledFilters = row.sourceCompilationId == null
          ? null
          : canonicalById.get(row.sourceCompilationId)?.compiledFilters;
        return {
          ...normalized,
          missionDefaults: resolveCapitalMissionDefaults(
            normalized.rawText,
            compiledFilters && typeof compiledFilters === "object"
              ? compiledFilters as Record<string, unknown>
              : null,
          ),
        };
      });
    }),

    get: capitalOperatorProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        return requireThesis(db, input.id, ctx.user.id);
      }),

    create: capitalOperatorProcedure
      .input(z.object({
        name: z.string().max(160).optional(),
        rawText: z.string().min(10).max(8000),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const now = Date.now();
        const [canonical] = await db!.insert(thesisCompilations).values(canonicalCapitalValues({
          userId: ctx.user.id,
          name: input.name,
          rawText: input.rawText,
        }));
        const [result] = await db!.insert(capitalTheses).values({
          userId: ctx.user.id,
          name: input.name ?? null,
          rawText: input.rawText,
          sourceCompilationId: Number((canonical as any).insertId),
          status: "compiling",
          createdAt: now,
          updatedAt: now,
        });
        return { id: (result as any).insertId as number };
      }),

    /** One-time repair for legacy Capital-only theses created before the canonical-first workflow. */
    promoteCanonical: capitalOperatorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const thesis = await requireThesis(db, input.id, ctx.user.id);
        if (!needsCanonicalPromotion(thesis.sourceCompilationId)) {
          return { compilationId: thesis.sourceCompilationId, linked: true };
        }
        const [canonical] = await db!.insert(thesisCompilations).values(canonicalCapitalValues({
          userId: ctx.user.id,
          name: thesis.name,
          rawText: thesis.rawText,
        }));
        const compilationId = Number((canonical as any).insertId);
        await db!.update(capitalTheses)
          .set({ sourceCompilationId: compilationId, updatedAt: Date.now() })
          .where(and(eq(capitalTheses.id, thesis.id), eq(capitalTheses.userId, ctx.user.id)));
        return { compilationId, linked: false };
      }),

    /** Legacy only: canonical-linked theses are edited in the main Thesis Engine. */
    update: capitalOperatorProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().max(160).optional(),
        rawText: z.string().min(10).max(8000),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const thesis = await requireThesis(db, input.id, ctx.user.id);
        if (thesis.sourceCompilationId) {
          throw new TRPCError({ code: "CONFLICT", message: "This linked thesis is managed in the main Thesis Engine." });
        }
        await db!.update(capitalTheses)
          .set({ name: input.name ?? null, rawText: input.rawText, graph: null, confidenceNotes: [], status: "review", updatedAt: Date.now() })
          .where(eq(capitalTheses.id, input.id));
        return { ok: true };
      }),

    compile: capitalOperatorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const thesis = await requireThesis(db, input.id, ctx.user.id);

        await db!.update(capitalTheses)
          .set({ status: "compiling", updatedAt: Date.now() })
          .where(eq(capitalTheses.id, input.id));

        let graph: any;
        let confidenceNotes: string[] = [];
        try {
          const compiled = await compileThesis(thesis.rawText);
          graph = compiled;
          confidenceNotes = compiled.confidenceNotes ?? [];
        } catch (e: any) {
          await db!.update(capitalTheses)
            .set({ status: "review", updatedAt: Date.now() })
            .where(eq(capitalTheses.id, input.id));
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Thesis compilation failed: ${e?.message ?? e}` });
        }

        await db!.update(capitalTheses)
          .set({ graph, confidenceNotes, status: "review", updatedAt: Date.now() })
          .where(eq(capitalTheses.id, input.id));

        return { graph, confidenceNotes };
      }),

    activate: capitalOperatorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        await requireThesis(db, input.id, ctx.user.id);
        // Deactivate all others first
        await db!.update(capitalTheses)
          .set({ isPrimary: false, updatedAt: Date.now() })
          .where(eq(capitalTheses.userId, ctx.user.id));
        await db!.update(capitalTheses)
          .set({ isPrimary: true, status: "active", updatedAt: Date.now() })
          .where(eq(capitalTheses.id, input.id));
        return { ok: true };
      }),

    delete: capitalOperatorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        await requireThesis(db, input.id, ctx.user.id);
        await db!.delete(capitalTheses).where(eq(capitalTheses.id, input.id));
        return { ok: true };
      }),
  }),

  // ── Portfolio accounts ─────────────────────────────────────────────────────

  account: router({
    list: capitalOperatorProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      return db!.select().from(portfolioAccounts)
        .where(eq(portfolioAccounts.userId, ctx.user.id))
        .orderBy(desc(portfolioAccounts.updatedAt));
    }),

    create: capitalOperatorProcedure
      .input(z.object({
        label: z.string().max(120),
        brokerId: z.enum(["manual", "alpaca_paper", "robinhood_mcp"]).default("manual"),
        isPaper: z.boolean().default(true),
        startingCashCents: z.number().int().nonnegative().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const now = Date.now();
        const [result] = await db!.insert(portfolioAccounts).values({
          userId: ctx.user.id,
          label: input.label,
          brokerId: input.brokerId,
          isPaper: input.isPaper,
          cashCents: input.startingCashCents ?? null,
          buyingPowerCents: input.startingCashCents ?? null,
          equityValueCents: input.startingCashCents ?? null,
          createdAt: now,
          updatedAt: now,
        });
        return { id: (result as any).insertId as number };
      }),

    sync: capitalOperatorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const account = await requireAccount(db, input.id, ctx.user.id);
        const broker = brokerFor(account.brokerId, account.id);

        if (!broker.available()) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: broker.unavailableReason() ?? `Broker ${account.brokerId} is not configured`,
          });
        }

        let acctData: Awaited<ReturnType<typeof broker.getAccount>>;
        let posData: Awaited<ReturnType<typeof broker.getPositions>>;
        try {
          [acctData, posData] = await Promise.all([
            broker.getAccount(),
            broker.getPositions(),
          ]);
        } catch (error) {
          const now = Date.now();
          const detail = error instanceof Error ? error.message : "Broker account read failed";
          await db!.update(portfolioAccounts).set({
            syncError: detail,
            updatedAt: now,
          }).where(eq(portfolioAccounts.id, input.id));
          throw new TRPCError({ code: "BAD_GATEWAY", message: detail });
        }

        if (account.brokerId === "alpaca_paper") {
          if (!acctData.externalAccountId) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Alpaca Paper did not return an external account identity. The destination remains unbound." });
          }
          if (account.externalAccountId && account.externalAccountId !== acctData.externalAccountId) {
            throw new TRPCError({ code: "CONFLICT", message: "The configured Alpaca Paper credentials resolve to a different account. No destination binding was changed." });
          }
          const bound = await db!.select({ id: portfolioAccounts.id, userId: portfolioAccounts.userId })
            .from(portfolioAccounts).where(and(
              eq(portfolioAccounts.brokerId, "alpaca_paper"),
              eq(portfolioAccounts.externalAccountId, acctData.externalAccountId),
            ));
          if (bound.some((row) => row.id !== account.id)) {
            throw new TRPCError({ code: "CONFLICT", message: "This external Alpaca Paper account is already bound to another Signal Hunter account. Submission remains blocked." });
          }
        }

        const now = Date.now();
        await db!.update(portfolioAccounts).set({
          externalAccountId: acctData.externalAccountId,
          cashCents: acctData.cashCents,
          buyingPowerCents: acctData.buyingPowerCents,
          equityValueCents: acctData.equityValueCents,
          optionsApprovedLevel: acctData.optionsApprovedLevel,
          optionsTradingLevel: acctData.optionsTradingLevel,
          optionsBuyingPowerCents: acctData.optionsBuyingPowerCents,
          lastSyncedAt: now,
          syncSource: broker.id,
          syncError: null,
          updatedAt: now,
        }).where(eq(portfolioAccounts.id, input.id));

        // Replace positions
        await db!.delete(positions).where(eq(positions.accountId, input.id));
        if (posData.length) {
          await db!.insert(positions).values(posData.map((p) => ({
            accountId: input.id,
            symbol: p.symbol,
            assetType: p.assetType as any,
            qty: p.qty,
            avgCostCents: p.avgCostCents ?? null,
            lastPriceCents: p.lastPriceCents ?? null,
            marketValueCents: p.marketValueCents ?? null,
            priceAsOf: now,
            priceSource: broker.id,
            createdAt: now,
            updatedAt: now,
          })));
        }

        return { synced: posData.length, cashCents: acctData.cashCents };
      }),

    configureSyncSchedule: capitalOperatorProcedure
      .input(z.object({ id: z.number(), enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const account = await requireAccount(db, input.id, ctx.user.id);
        if (!account.isPaper || account.brokerId !== "alpaca_paper") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Scheduled freshness is available only for configured Alpaca Paper accounts." });
        }
        const rawCookie = typeof ctx.req.headers.cookie === "string" ? ctx.req.headers.cookie : "";
        const sessionToken = readSessionCookie(rawCookie) ?? "";
        if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Your session could not be verified for the paper-account sync schedule." });

        let taskUid = account.syncScheduleTaskUid ?? null;
        let nextExecutionAt: string | null | undefined;
        if (!taskUid) {
          if (!input.enabled) {
            await db!.update(portfolioAccounts).set({ syncScheduleEnabled: false }).where(eq(portfolioAccounts.id, account.id));
            return { enabled: false, configured: false, nextExecutionAt: null };
          }
          const created = await createHeartbeatJob({
            name: `capital-paper-account-sync-${account.id}`,
            cron: PAPER_ACCOUNT_SYNC_CRON,
            path: PAPER_ACCOUNT_SYNC_PATH,
            payload: {},
            description: "Refreshes a named Alpaca Paper account during an active US market session. Reads account and position context only; never creates broker orders.",
          }, sessionToken);
          taskUid = created.taskUid;
          nextExecutionAt = created.nextExecutionAt;
        } else {
          const updated = await updateHeartbeatJob(taskUid, { enable: input.enabled }, sessionToken);
          nextExecutionAt = updated.nextExecutionAt;
        }
        await db!.update(portfolioAccounts).set({
          syncScheduleTaskUid: taskUid,
          syncScheduleEnabled: input.enabled,
        }).where(eq(portfolioAccounts.id, account.id));
        return { enabled: input.enabled, configured: true, nextExecutionAt: nextExecutionAt ?? null };
      }),

    getPositions: capitalOperatorProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        await requireAccount(db, input.accountId, ctx.user.id);
        return db!.select().from(positions)
          .where(eq(positions.accountId, input.accountId))
          .orderBy(desc(positions.marketValueCents));
      }),

    importCsv: capitalOperatorProcedure
      .input(z.object({
        accountId: z.number(),
        mode: z.enum(["merge", "replace"]).default("replace"),
        rows: z.array(z.object({
          symbol: z.string(),
          qty: z.number(),
          assetType: z.enum(["equity", "etf", "option", "crypto", "cash"]).default("equity"),
          avgCostCents: z.number().optional(),
          marketValueCents: z.number().optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        await requireAccount(db, input.accountId, ctx.user.id);
        const now = Date.now();
        const normalized = input.rows.map((row) => ({ ...row, symbol: normSymbol(row.symbol) }));
        const symbols = normalized.map((row) => row.symbol);
        if (new Set(symbols).size !== symbols.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Each ticker can appear only once in an import. Combine duplicate rows before continuing." });
        }
        await db!.transaction(async (tx) => {
          if (input.mode === "replace") {
            await tx.delete(positions).where(eq(positions.accountId, input.accountId));
          } else if (symbols.length) {
            await tx.delete(positions).where(and(
              eq(positions.accountId, input.accountId),
              inArray(positions.symbol, symbols),
            ));
          }
          if (normalized.length) {
            await tx.insert(positions).values(normalized.map((r) => ({
              accountId: input.accountId,
              symbol: r.symbol,
              assetType: r.assetType,
              qty: r.qty,
              avgCostCents: r.avgCostCents ?? null,
              marketValueCents: r.marketValueCents ?? null,
              priceAsOf: now,
              priceSource: "csv_import",
              createdAt: now,
              updatedAt: now,
            })));
          }
          await tx.update(portfolioAccounts).set({
            lastSyncedAt: now,
            syncSource: `csv_${input.mode}`,
            syncError: null,
            updatedAt: now,
          }).where(eq(portfolioAccounts.id, input.accountId));
        });
        return { imported: normalized.length, mode: input.mode };
      }),

    listActivePlays: capitalOperatorProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        await requireAccount(db, input.accountId, ctx.user.id);
        return db!.select().from(apertureActivePlayContexts)
          .where(and(
            eq(apertureActivePlayContexts.userId, ctx.user.id),
            eq(apertureActivePlayContexts.accountId, input.accountId),
          ))
          .orderBy(desc(apertureActivePlayContexts.updatedAt));
      }),

    upsertActivePlay: capitalOperatorProcedure
      .input(z.object({
        accountId: z.number(),
        symbol: z.string().min(1).max(24),
        instrumentType: z.enum(["shares", "long_call", "long_put"]).default("shares"),
        underlyingSymbol: z.string().max(24).optional(),
        optionExpirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        optionStrikePriceCents: z.number().int().positive().optional(),
        contractMultiplier: z.literal(100).optional(),
        side: z.enum(["long", "short"]).default("long"),
        status: z.enum(["watching", "active", "closed"]).default("active"),
        thesisNote: z.string().min(10).max(4000),
        horizon: z.string().max(120).optional(),
        entryPriceCents: z.number().int().positive().optional(),
        stopPriceCents: z.number().int().positive().optional(),
        targetPriceCents: z.number().int().positive().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        await requireAccount(db, input.accountId, ctx.user.id);
        const now = Date.now();
        const symbol = normSymbol(input.symbol);
        const instrument = validatePaperInstrument({
          instrumentType: input.instrumentType,
          symbol,
          underlyingSymbol: input.underlyingSymbol,
          optionExpirationDate: input.optionExpirationDate,
          optionStrikePriceCents: input.optionStrikePriceCents,
          contractMultiplier: input.contractMultiplier,
          qty: input.instrumentType === "shares" ? undefined : 1,
        }, now);
        if (instrument.failures.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: instrument.failures.join(" ") });
        if (input.instrumentType !== "shares" && input.side !== "long") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only long call and long put contexts are supported." });
        await db!.insert(apertureActivePlayContexts).values({
          userId: ctx.user.id,
          accountId: input.accountId,
          symbol,
          instrumentType: input.instrumentType,
          underlyingSymbol: instrument.optionTerms?.underlyingSymbol ?? null,
          optionExpirationDate: instrument.optionTerms?.expirationDate ?? null,
          optionStrikePriceCents: instrument.optionTerms?.strikePriceCents ?? null,
          contractMultiplier: instrument.optionTerms?.contractMultiplier ?? null,
          side: input.side,
          status: input.status,
          thesisNote: input.thesisNote.trim(),
          horizon: input.horizon?.trim() || null,
          entryPriceCents: input.entryPriceCents ?? null,
          stopPriceCents: input.stopPriceCents ?? null,
          targetPriceCents: input.targetPriceCents ?? null,
          source: "manual",
          asOf: now,
          createdAt: now,
          updatedAt: now,
        }).onDuplicateKeyUpdate({ set: {
          side: input.side,
          instrumentType: input.instrumentType,
          underlyingSymbol: instrument.optionTerms?.underlyingSymbol ?? null,
          optionExpirationDate: instrument.optionTerms?.expirationDate ?? null,
          optionStrikePriceCents: instrument.optionTerms?.strikePriceCents ?? null,
          contractMultiplier: instrument.optionTerms?.contractMultiplier ?? null,
          status: input.status,
          thesisNote: input.thesisNote.trim(),
          horizon: input.horizon?.trim() || null,
          entryPriceCents: input.entryPriceCents ?? null,
          stopPriceCents: input.stopPriceCents ?? null,
          targetPriceCents: input.targetPriceCents ?? null,
          source: "manual",
          asOf: now,
          updatedAt: now,
        } });
        return { symbol, status: input.status };
      }),

    removeActivePlay: capitalOperatorProcedure
      .input(z.object({ accountId: z.number(), id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        await requireAccount(db, input.accountId, ctx.user.id);
        await db!.delete(apertureActivePlayContexts).where(and(
          eq(apertureActivePlayContexts.id, input.id),
          eq(apertureActivePlayContexts.userId, ctx.user.id),
          eq(apertureActivePlayContexts.accountId, input.accountId),
        ));
        return { removed: true };
      }),
  }),

  // ── Broker availability ────────────────────────────────────────────────────

  brokers: capitalOperatorProcedure.query(() => {
    return listBrokers().map((b) => ({
      id: b.id,
      label: b.label,
      available: b.available(),
      unavailableReason: b.unavailableReason?.() ?? null,
      capabilities: b.capabilities,
    }));
  }),

  // ── Provider availability ──────────────────────────────────────────────────

  providers: capitalOperatorProcedure.query(() => describeAvailability()),

  /**
   * The operator cockpit — market session, account, mandate headroom and run
   * preset in ONE round trip, for a rail that stays on screen.
   *
   * Reads only what is already persisted: no provider call, no broker call, no
   * model call. That keeps it cheap enough to poll and means it cannot fail
   * because an upstream was slow — a rail that can go blank is a rail the
   * operator learns to ignore.
   *
   * Both inputs are optional. With no accountId the run's own account is used;
   * with neither, the session and mandate still render and every account-derived
   * figure is null with a stated reason rather than a zero.
   */
  cockpit: capitalOperatorProcedure
    .input(z.object({
      accountId: z.number().optional(),
      runId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return buildCockpit({
        userId: ctx.user.id,
        accountId: input?.accountId ?? null,
        runId: input?.runId ?? null,
      });
    }),

  cockpitPreference: router({
    get: capitalOperatorProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const [user] = await db!.select({ expanded: users.cockpitRailExpanded, acknowledgedSignature: users.cockpitRailAcknowledgedSignature })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);
      return { expanded: user?.expanded === true, acknowledgedSignature: user?.acknowledgedSignature ?? null };
    }),
    set: capitalOperatorProcedure.input(z.object({ expanded: z.boolean() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await db!.update(users).set({ cockpitRailExpanded: input.expanded }).where(eq(users.id, ctx.user.id));
      return { expanded: input.expanded };
    }),
    acknowledge: capitalOperatorProcedure.input(z.object({ signature: z.string().min(1).max(255) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await db!.update(users).set({ cockpitRailAcknowledgedSignature: input.signature, cockpitRailExpanded: false }).where(eq(users.id, ctx.user.id));
      return { acknowledgedSignature: input.signature };
    }),
  }),

  // ── Memo library ───────────────────────────────────────────────────────────
  // Memos live on their originating candidate rows so they retain the precise
  // score, role, fact ledger, and thesis context that produced them. This is the
  // cross-run index that makes that durable record discoverable to an operator.
  memo: router({
    list: capitalOperatorProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const rows = await db!.select({
        candidate: apertureCandidates,
        run: apertureRuns,
        thesisName: capitalTheses.name,
      })
        .from(apertureCandidates)
        .innerJoin(apertureRuns, eq(apertureCandidates.runId, apertureRuns.id))
        .leftJoin(capitalTheses, eq(apertureRuns.thesisId, capitalTheses.id))
        .where(eq(apertureRuns.userId, ctx.user.id))
        .orderBy(desc(apertureRuns.createdAt), desc(apertureCandidates.id));

      return rows
        .filter(({ candidate }) => belongsInMemoLibrary(candidate.memoStatus))
        .map(({ candidate, run, thesisName }) => ({
          candidate: {
            ...candidate,
            memo: normalizeJsonRecord(candidate.memo),
            verifyFields: normalizeStringList(candidate.verifyFields),
            citations: normalizeStringList(candidate.citations),
          },
          run,
          thesisName,
        }));
    }),

    get: capitalOperatorProcedure
      .input(z.object({ candidateId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        const [row] = await db!.select({
          candidate: apertureCandidates,
          run: apertureRuns,
          thesisName: capitalTheses.name,
        })
          .from(apertureCandidates)
          .innerJoin(apertureRuns, eq(apertureCandidates.runId, apertureRuns.id))
          .leftJoin(capitalTheses, eq(apertureRuns.thesisId, capitalTheses.id))
          .where(and(eq(apertureCandidates.id, input.candidateId), eq(apertureRuns.userId, ctx.user.id)))
          .limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Memo candidate not found" });
        const [account] = row.run.accountId
          ? await db!.select().from(portfolioAccounts)
            .where(and(eq(portfolioAccounts.id, row.run.accountId), eq(portfolioAccounts.userId, ctx.user.id)))
            .limit(1)
          : [];
        const paperPositions = account
          ? await db!.select({ symbol: positions.symbol, marketValueCents: positions.marketValueCents, priceAsOf: positions.priceAsOf })
            .from(positions).where(eq(positions.accountId, account.id))
          : [];
        return {
          ...row,
          candidate: {
            ...row.candidate,
            memo: normalizeJsonRecord(row.candidate.memo),
            verifyFields: normalizeStringList(row.candidate.verifyFields),
            citations: normalizeStringList(row.candidate.citations),
          },
          paperContext: account ? { account, positions: paperPositions } : null,
        };
      }),
  }),

  // ── Run lifecycle ──────────────────────────────────────────────────────────

  macro: router({
    /** Refresh the shared macro ledger on operator request. It never trades or changes a thesis. */
    refresh: capitalOperatorProcedure.mutation(async () => {
      const result = await collectMacroFacts();
      return {
        factsWritten: result.facts.length,
        providers: result.ranProviders,
        errors: result.errors,
      };
    }),
  }),

  // ── Decision Runway ──────────────────────────────────────────────────────
  // Durable operator context only. A cash branch cannot be attached to a run
  // and is separately checked when a paper-order proposal is attempted.
  runway: router({
    latest: capitalOperatorProcedure.input(z.object({
      decisionRunId: z.number().positive().optional(),
      revisionId: z.number().positive().optional(),
    }).optional()).query(async ({ ctx, input }) => {
      const db = await getDb();
      if ((input?.decisionRunId == null) !== (input?.revisionId == null)) receiptBindingUnavailable();
      const [decisionRun] = input?.decisionRunId != null
        ? await db!.select().from(apertureDecisionRuns).where(and(
          eq(apertureDecisionRuns.id, input.decisionRunId),
          eq(apertureDecisionRuns.userId, ctx.user.id),
        )).limit(1)
        : await db!.select().from(apertureDecisionRuns)
          .where(eq(apertureDecisionRuns.userId, ctx.user.id))
          .orderBy(desc(apertureDecisionRuns.updatedAt))
          .limit(1);
      if (input?.decisionRunId != null && !decisionRun) receiptBindingUnavailable();
      const revisionId = input?.revisionId ?? decisionRun?.currentRevisionId ?? null;
      const [revision] = decisionRun == null || revisionId == null ? [undefined] : await db!.select().from(apertureDecisionRevisions)
        .where(and(
          eq(apertureDecisionRevisions.id, revisionId),
          eq(apertureDecisionRevisions.decisionRunId, decisionRun.id),
        )).limit(1);
      if (input?.revisionId != null && !revision) receiptBindingUnavailable();
      const [legacy] = decisionRun ? [undefined] : await db!.select().from(apertureRunwayStates)
        .where(eq(apertureRunwayStates.userId, ctx.user.id))
        .orderBy(desc(apertureRunwayStates.updatedAt)).limit(1);
      const [profile] = await db!.select({ activeCapitalThesisId: users.activeCapitalThesisId })
        .from(users).where(eq(users.id, ctx.user.id)).limit(1);
      return {
        latest: revision && decisionRun ? await readImmutableDecisionReceipt(db!, ctx.user.id, decisionRun, revision)
          : legacy ? { ...legacy, authority: "legacy" as const } : null,
        activeCanonicalThesisId: profile?.activeCapitalThesisId ?? null,
      };
    }),
    pending: capitalOperatorProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      return db!.select({
        id: aperturePendingOutcomes.id,
        kind: aperturePendingOutcomes.kind,
        status: aperturePendingOutcomes.status,
        dueAt: aperturePendingOutcomes.dueAt,
        gateKey: aperturePendingOutcomes.gateKey,
        gateLabel: apertureDecisionRevisions.namedGateLabel,
        reviewBasis: aperturePendingOutcomes.reviewBasis,
        decisionRunId: apertureDecisionRuns.id,
        revisionId: apertureDecisionRevisions.id,
        revisionVersion: apertureDecisionRevisions.version,
        branch: apertureDecisionRevisions.effectiveBranch,
        thesisName: thesisCompilations.name,
        orderId: aperturePendingOutcomes.orderId,
        orderRunId: brokerOrders.runId,
        orderCandidateId: brokerOrders.candidateId,
        orderSymbol: brokerOrders.symbol,
        orderStatus: brokerOrders.status,
      }).from(aperturePendingOutcomes)
        .innerJoin(apertureDecisionRuns, eq(aperturePendingOutcomes.decisionRunId, apertureDecisionRuns.id))
        .innerJoin(apertureDecisionRevisions, and(
          eq(aperturePendingOutcomes.revisionId, apertureDecisionRevisions.id),
          eq(aperturePendingOutcomes.decisionRunId, apertureDecisionRevisions.decisionRunId),
        ))
        .innerJoin(thesisCompilations, eq(apertureDecisionRuns.canonicalThesisId, thesisCompilations.id))
        .leftJoin(brokerOrders, and(
          eq(aperturePendingOutcomes.orderId, brokerOrders.id),
          eq(brokerOrders.userId, ctx.user.id),
        ))
        .where(and(
          eq(aperturePendingOutcomes.userId, ctx.user.id),
          eq(apertureDecisionRuns.userId, ctx.user.id),
          inArray(aperturePendingOutcomes.status, ["pending", "due"]),
        ))
        .orderBy(asc(aperturePendingOutcomes.dueAt));
    }),
    resolveCashOutcome: capitalOperatorProcedure
      .input(z.object({
        pendingOutcomeId: z.number().positive(),
        outcome: z.enum(["cash_remained_correct", "cash_too_early", "cash_too_conservative", "inconclusive"]),
        note: z.string().trim().min(10).max(2_000),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const now = Date.now();
        return db!.transaction(async (tx) => {
          const [row] = await tx.select({
            pending: aperturePendingOutcomes,
            branch: apertureDecisionRevisions.effectiveBranch,
            currentRevisionId: apertureDecisionRuns.currentRevisionId,
          }).from(aperturePendingOutcomes)
            .innerJoin(apertureDecisionRuns, eq(aperturePendingOutcomes.decisionRunId, apertureDecisionRuns.id))
            .innerJoin(apertureDecisionRevisions, and(
              eq(aperturePendingOutcomes.revisionId, apertureDecisionRevisions.id),
              eq(aperturePendingOutcomes.decisionRunId, apertureDecisionRevisions.decisionRunId),
            ))
            .where(and(
              eq(aperturePendingOutcomes.id, input.pendingOutcomeId),
              eq(aperturePendingOutcomes.userId, ctx.user.id),
              eq(apertureDecisionRuns.userId, ctx.user.id),
            )).for("update").limit(1);
          if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "The cash look-back is unavailable." });
          if (row.pending.kind !== "play_outcome" || row.branch !== "cash") {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only a bound cash outcome can be resolved here." });
          }
          if (!(["pending", "due"] as string[]).includes(row.pending.status)) {
            throw new TRPCError({ code: "CONFLICT", message: "This cash look-back is already closed or superseded." });
          }
          if (now < row.pending.dueAt) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The declared cash look-back has not arrived yet." });
          }
          await tx.update(aperturePendingOutcomes).set({
            status: "resolved",
            result: {
              decision: "cash",
              outcome: input.outcome,
              note: input.note,
              recordedByUserId: ctx.user.id,
              recordedAt: now,
            },
            resolvedAt: now,
            updatedAt: now,
          }).where(and(
            eq(aperturePendingOutcomes.id, row.pending.id),
            inArray(aperturePendingOutcomes.status, ["pending", "due"]),
          ));
          if (row.currentRevisionId === row.pending.revisionId) {
            await tx.update(apertureDecisionRuns).set({ lifecycle: "closed", closedAt: now, updatedAt: now })
              .where(and(
                eq(apertureDecisionRuns.id, row.pending.decisionRunId),
                eq(apertureDecisionRuns.userId, ctx.user.id),
                eq(apertureDecisionRuns.currentRevisionId, row.pending.revisionId),
              ));
          }
          return { resolved: true, decisionRunId: row.pending.decisionRunId, revisionId: row.pending.revisionId };
        });
      }),
    library: capitalOperatorProcedure
      .input(z.object({
        canonicalThesisId: z.number().nullable().optional(),
        capitalThesisId: z.number().nullable().optional(),
        accountId: z.number().nullable().optional(),
        deployableCapitalCents: z.number().positive().default(500_000),
        holdingPeriod: z.enum(HOLDING_PERIOD_KEYS as [string, ...string[]]).default("intraday"),
        objective: z.enum(["best_qualified_play", "deploy_today", "verify_catalyst", "portfolio_gap", "preserve_optionality"]).default("best_qualified_play"),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        const [profile] = await db!.select({ activeCapitalThesisId: users.activeCapitalThesisId })
          .from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const canonicalThesisId = input.canonicalThesisId ?? profile?.activeCapitalThesisId ?? null;
        const [projection] = input.capitalThesisId != null
          ? await db!.select().from(capitalTheses).where(and(eq(capitalTheses.id, input.capitalThesisId), eq(capitalTheses.userId, ctx.user.id))).limit(1)
          : canonicalThesisId == null ? [undefined] : await db!.select().from(capitalTheses).where(and(eq(capitalTheses.userId, ctx.user.id), eq(capitalTheses.sourceCompilationId, canonicalThesisId))).limit(1);
        const [canonical] = canonicalThesisId == null ? [undefined] : await db!.select({ name: thesisCompilations.name })
          .from(thesisCompilations).where(and(eq(thesisCompilations.id, canonicalThesisId), eq(thesisCompilations.userId, ctx.user.id))).limit(1);
        const [account] = input.accountId != null
          ? await db!.select().from(portfolioAccounts).where(and(eq(portfolioAccounts.id, input.accountId), eq(portfolioAccounts.userId, ctx.user.id), eq(portfolioAccounts.isPaper, true))).limit(1)
          : await db!.select().from(portfolioAccounts).where(and(eq(portfolioAccounts.userId, ctx.user.id), eq(portfolioAccounts.isPaper, true))).limit(1);
        const held = account ? await db!.select().from(positions).where(eq(positions.accountId, account.id)) : [];
        const largestPositionCents = held.reduce((largest, row) => Math.max(largest, row.marketValueCents ?? 0), 0);
        const allowedSingleNameCents = account?.equityValueCents
          ? account.equityValueCents * CURRENT_MANDATE.maxPositionPctOfEquity / 100
          : null;
        const concentrationUtilizationPct = allowedSingleNameCents && allowedSingleNameCents > 0
          ? largestPositionCents / allowedSingleNameCents * 100
          : null;
        return rankMissionLibrary({
          thesisName: canonical?.name ?? projection?.name ?? "my active thesis",
          deployableCapitalCents: input.deployableCapitalCents,
          holdingPeriod: input.holdingPeriod as any,
          objective: input.objective,
          concentrationUtilizationPct,
          accountFreshnessMinutes: account?.lastSyncedAt ? Math.max(0, (Date.now() - account.lastSyncedAt) / 60_000) : null,
          // A mission is not labeled catalyst-ready unless a verified catalyst
          // record is actually attached. This initial corrective build has no
          // such binding, so the option remains visible but conditional.
          hasVerifiedCatalyst: false,
        });
      }),
    begin: capitalOperatorProcedure
      .input(z.object({
        missionText: z.string().trim().min(MIN_NARRATIVE_CHARS).max(12_000),
        canonicalThesisId: z.number(),
        capitalThesisId: z.number(),
        accountId: z.number(),
        /** Append to an exact active Decision Run instead of opening a new one. */
        decisionRunId: z.number().nullable().optional(),
        branch: z.enum(["research", "conditional", "cash"]).default("research"),
        missionSource: z.enum(["assigned", "inline", "library", "edited"]).default("assigned"),
        objective: z.enum(["best_qualified_play", "deploy_today", "verify_catalyst", "portfolio_gap", "preserve_optionality"]).default("best_qualified_play"),
        instrumentPreference: z.enum(["shares", "options", "either"]).default("either"),
        includeHeldResearch: z.boolean().default(false),
        deployableCapitalCents: z.number().positive(),
        desiredEndingValueCents: z.number().positive().nullable().optional(),
        maxPlannedLossCents: z.number().positive(),
        holdingPeriod: z.enum(HOLDING_PERIOD_KEYS as [string, ...string[]]),
        invalidationRule: z.string().trim().min(MIN_NARRATIVE_CHARS).max(2_000),
        reason: z.string().trim().max(1_000).nullable().optional(),
        blocker: z.string().trim().max(1_000).nullable().optional(),
        reopenCondition: z.string().trim().max(1_000).nullable().optional(),
        reviewAt: z.number().nullable().optional(),
        namedGateKey: z.string().trim().max(96).nullable().optional(),
        namedGateLabel: z.string().trim().max(240).nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const now = Date.now();
        const [projection] = await db!.select().from(capitalTheses).where(and(
          eq(capitalTheses.id, input.capitalThesisId),
          eq(capitalTheses.userId, ctx.user.id),
          eq(capitalTheses.sourceCompilationId, input.canonicalThesisId),
        )).limit(1);
        if (!projection) throw new TRPCError({ code: "FORBIDDEN", message: "The assigned thesis and Capital projection do not match." });
        const account = await requireAccount(db, input.accountId, ctx.user.id);
        if (!account.isPaper) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Decision Runway requires a paper account." });
        if (input.branch !== "research" && (!input.reason || !input.blocker || !input.reopenCondition)) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cash and conditional decisions require a reason, blocker, and reopening condition." });
        }
        if (input.branch === "conditional" && (!input.namedGateKey || !input.namedGateLabel || !input.reviewAt)) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A conditional decision requires a named gate and review time." });
        }
        if (input.branch === "cash" && !input.reviewAt) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A cash decision requires an outcome look-back time." });
        }
        const systemLossCeiling = account.equityValueCents == null
          ? input.maxPlannedLossCents
          : Math.floor(account.equityValueCents * CURRENT_MANDATE.maxPlannedRiskPctPerPlay / 100);
        const maxPlannedLossCents = Math.min(input.maxPlannedLossCents, systemLossCeiling);
        const missionHash = createHash("sha256").update(JSON.stringify({
          missionText: input.missionText,
          canonicalThesisId: input.canonicalThesisId,
          capitalThesisId: input.capitalThesisId,
          accountId: input.accountId,
          branch: input.branch,
          objective: input.objective,
          instrumentPreference: input.instrumentPreference,
          deployableCapitalCents: input.deployableCapitalCents,
          desiredEndingValueCents: input.desiredEndingValueCents ?? null,
          maxPlannedLossCents,
          holdingPeriod: input.holdingPeriod,
        })).digest("hex");
        const revisionValues = {
          missionText: input.missionText,
          missionHash,
          missionSource: input.missionSource,
          objective: input.objective,
          instrumentPreference: input.instrumentPreference,
          includeHeldResearch: input.includeHeldResearch,
          deployableCapitalCents: input.deployableCapitalCents,
          desiredEndingValueCents: input.desiredEndingValueCents ?? null,
          maxPlannedLossCents,
          holdingPeriod: input.holdingPeriod as any,
          invalidationRule: input.invalidationRule,
          operatorChoice: input.branch,
          effectiveBranch: input.branch,
          plannedRiskCents: 0,
          reason: input.reason ?? null,
          blocker: input.blocker ?? null,
          reopenCondition: input.reopenCondition ?? null,
          reviewAt: input.reviewAt ?? null,
          namedGateKey: input.namedGateKey ?? null,
          namedGateLabel: input.namedGateLabel ?? null,
          contextSnapshot: {
            canonicalThesisId: input.canonicalThesisId,
            capitalThesisId: input.capitalThesisId,
            accountId: input.accountId,
            accountLastSyncedAt: account.lastSyncedAt,
          },
          gateSnapshot: {
            mandateVersion: CURRENT_MANDATE.version,
            paperOnly: true,
            humanApprovalRequired: true,
            maxPlannedLossCents,
          },
          createdByUserId: ctx.user.id,
          createdAt: now,
        };
        if (input.decisionRunId != null) {
          const [head] = await db!.select().from(apertureDecisionRuns).where(and(
            eq(apertureDecisionRuns.id, input.decisionRunId),
            eq(apertureDecisionRuns.userId, ctx.user.id),
            eq(apertureDecisionRuns.canonicalThesisId, input.canonicalThesisId),
            eq(apertureDecisionRuns.capitalThesisId, input.capitalThesisId),
            eq(apertureDecisionRuns.accountId, input.accountId),
          )).limit(1);
          if (!head?.currentRevisionId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The Decision Run binding changed. Open the current mission before recording a new outcome." });
          const expectedRevisionId = head.currentRevisionId;
          const appended = await db!.transaction(async (tx) => {
            const [lockedHead] = await tx.select().from(apertureDecisionRuns).where(and(
              eq(apertureDecisionRuns.id, head.id),
              eq(apertureDecisionRuns.currentRevisionId, expectedRevisionId),
              eq(apertureDecisionRuns.lockVersion, head.lockVersion),
            )).for("update").limit(1);
            if (!lockedHead?.currentRevisionId) throw new TRPCError({ code: "CONFLICT", message: "The Decision Run changed while this revision was being recorded." });
            const [inFlightDispatch] = await tx.select({ id: brokerOrders.id }).from(brokerOrders).where(and(
              eq(brokerOrders.userId, ctx.user.id),
              eq(brokerOrders.decisionRunId, lockedHead.id),
              eq(brokerOrders.status, "submitted"),
              isNull(brokerOrders.brokerOrderId),
            )).for("update").limit(1);
            if (inFlightDispatch) {
              throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message: "A paper order dispatch is still resolving for this Decision Run. Record a new disposition after the broker response is persisted.",
              });
            }
            const [current] = await tx.select().from(apertureDecisionRevisions).where(and(
              eq(apertureDecisionRevisions.id, lockedHead.currentRevisionId),
              eq(apertureDecisionRevisions.decisionRunId, lockedHead.id),
            )).limit(1);
            if (!current) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The current Decision Run revision is unavailable." });
            const [revisionResult] = await tx.insert(apertureDecisionRevisions).values({
              decisionRunId: lockedHead.id,
              version: current.version + 1,
              previousRevisionId: current.id,
              ...revisionValues,
            });
            const revisionId = Number((revisionResult as any).insertId);
            const update = await tx.update(apertureDecisionRuns).set({
              currentRevisionId: revisionId,
              lifecycle: input.branch === "cash" ? "cash" : input.branch === "conditional" ? "conditional" : head.lifecycle,
              lockVersion: lockedHead.lockVersion + 1,
              updatedAt: now,
            }).where(and(
              eq(apertureDecisionRuns.id, lockedHead.id),
              eq(apertureDecisionRuns.currentRevisionId, current.id),
              eq(apertureDecisionRuns.lockVersion, lockedHead.lockVersion),
            ));
            if (!update[0].affectedRows) throw new TRPCError({ code: "CONFLICT", message: "The Decision Run changed while this revision was being recorded." });
            await tx.update(aperturePendingOutcomes).set({
              status: "cancelled",
              updatedAt: now,
            }).where(and(
              eq(aperturePendingOutcomes.userId, ctx.user.id),
              eq(aperturePendingOutcomes.decisionRunId, lockedHead.id),
              eq(aperturePendingOutcomes.revisionId, current.id),
              inArray(aperturePendingOutcomes.status, ["pending", "due"]),
            ));
            const pendingOutcome = decisionReceiptPendingOutcome({
              branch: input.branch,
              reviewAt: input.reviewAt ?? null,
              reopenCondition: input.reopenCondition ?? null,
              namedGateKey: input.namedGateKey ?? null,
            });
            if (pendingOutcome) {
              await tx.insert(aperturePendingOutcomes).values({
                userId: ctx.user.id,
                decisionRunId: lockedHead.id,
                revisionId,
                kind: pendingOutcome.kind,
                status: "pending",
                dueAt: pendingOutcome.dueAt,
                gateKey: pendingOutcome.gateKey,
                reviewBasis: pendingOutcome.reviewBasis,
                createdAt: now,
                updatedAt: now,
              });
            }
            return { decisionRunId: lockedHead.id, revisionId };
          });
          return { ...appended, created: false, branch: input.branch, maxPlannedLossCents };
        }
        const receipt = await db!.transaction(async (tx) => {
          const [runResult] = await tx.insert(apertureDecisionRuns).values({
            userId: ctx.user.id,
            canonicalThesisId: input.canonicalThesisId,
            capitalThesisId: input.capitalThesisId,
            accountId: input.accountId,
            lifecycle: input.branch === "cash" ? "cash" : input.branch === "conditional" ? "conditional" : "mission",
            lockVersion: 0,
            createdAt: now,
            updatedAt: now,
          });
          const decisionRunId = Number((runResult as any).insertId);
          const [revisionResult] = await tx.insert(apertureDecisionRevisions).values({
            decisionRunId,
            version: 1,
            ...revisionValues,
          });
          const revisionId = Number((revisionResult as any).insertId);
          await tx.update(apertureDecisionRuns).set({ currentRevisionId: revisionId })
            .where(eq(apertureDecisionRuns.id, decisionRunId));
          const pendingOutcome = decisionReceiptPendingOutcome({
            branch: input.branch,
            reviewAt: input.reviewAt ?? null,
            reopenCondition: input.reopenCondition ?? null,
            namedGateKey: input.namedGateKey ?? null,
          });
          if (pendingOutcome) {
            await tx.insert(aperturePendingOutcomes).values({
              userId: ctx.user.id,
              decisionRunId,
              revisionId,
              kind: pendingOutcome.kind,
              status: "pending",
              dueAt: pendingOutcome.dueAt,
              gateKey: pendingOutcome.gateKey,
              reviewBasis: pendingOutcome.reviewBasis,
              createdAt: now,
              updatedAt: now,
            });
          }
          return { decisionRunId, revisionId };
        });
        return { ...receipt, created: true, branch: input.branch, maxPlannedLossCents };
      }),
    startResearch: capitalOperatorProcedure
      .input(z.object({ decisionRunId: z.number(), revisionId: z.number(), uatCase: z.literal("qualified-play").optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const isolatedUatResearchBlocked = isExactIsolatedUatRuntime();
        const qualifiedPlayFixture = isolatedUatResearchBlocked
          && input.uatCase === "qualified-play"
          && ["uat_jim_9c18799", "uat_ch_capital_9c18799"].includes(ctx.user.openId);
        if (input.uatCase && !qualifiedPlayFixture) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The qualified-play fixture is available only to approved owner identities in the exact isolated development UAT environment." });
        }
        if (qualifiedPlayFixture) {
          const [decisionRun] = await db!.select().from(apertureDecisionRuns).where(and(
            eq(apertureDecisionRuns.id, input.decisionRunId), eq(apertureDecisionRuns.userId, ctx.user.id),
          )).limit(1);
          if (!decisionRun || decisionRun.currentRevisionId !== input.revisionId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Open the current operator-owned mission revision before compiling the illustrative UAT fixture." });
          if (decisionRun.researchRunId != null) return { status: "started" as const, runId: decisionRun.researchRunId, decisionRunId: decisionRun.id, revisionId: input.revisionId, fixture: "qualified-play" as const };
          const [revision] = await db!.select().from(apertureDecisionRevisions).where(and(eq(apertureDecisionRevisions.id, input.revisionId), eq(apertureDecisionRevisions.decisionRunId, decisionRun.id))).limit(1);
          if (!revision || revision.effectiveBranch !== "research") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cash and conditional branches cannot compile the illustrative fixture." });
          const thesis = await requireThesis(db, decisionRun.capitalThesisId, ctx.user.id);
          const account = await requireAccount(db, decisionRun.accountId, ctx.user.id);
          if (!account.isPaper) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The illustrative fixture requires an operator-owned paper account." });
          const now = Date.now();
          const deadline = now + 2 * 60 * 60 * 1000;
          const marker = "ILLUSTRATIVE_UAT_QUALIFIED_PLAY_ZERO_NETWORK_NOT_CURRENT_MARKET_DATA";
          let created: number;
          try {
            created = await db!.transaction(async (tx) => {
            const [runResult] = await tx.insert(apertureRuns).values({ userId: ctx.user.id, thesisId: thesis.id, accountId: account.id, deployableCapitalCents: revision.deployableCapitalCents, intendedTrades: [], holdingPeriod: "intraday", instrumentPreference: revision.instrumentPreference, catalystDeadlineAt: deadline, liquidityFloorAdvUsd: CURRENT_MANDATE.minAdvUsd30d, maxSingleNamePct: CURRENT_MANDATE.maxPositionPctOfEquity, invalidationRule: "Illustrative UAT fixture invalidates if the named catalyst evidence, paper-only boundary, or modeled risk cap is not confirmed by a human.", mandateVersion: CURRENT_MANDATE.version, status: "completed", universeCount: 2, candidateCount: 2, droppedNote: marker, providerAvailability: { illustrative_uat_fixture: true, provider_network_invoked: false }, startedAt: now, completedAt: now, createdAt: now });
            const runId = Number((runResult as any).insertId);
            await tx.insert(apertureCandidates).values([
              { runId, symbol: "UATQ", playSide: "long", role: "core", compositeScore: 91, confidenceScore: 0.74, rankScore: 0.91, dimensions: { thesisFit: "modeled", evidenceFreshness: "unknown", liquidity: "illustrative" }, verifyFields: ["Confirm the named catalyst evidence is still current before any paper proposal."], exposureNodeIds: [], memo: { basis: "Illustrative UAT fixture — not current market data.", whyRanked: "Highest modeled thesis fit within the operator’s declared paper-risk cap; no return is promised." }, memoStatus: "ok", citations: ["illustrative-uat-fixture://qualified-play"], suggestedSizeLowCents: 240000, suggestedSizeHighCents: 300000, createdAt: now },
              { runId, symbol: "UATC", playSide: "long", role: "alternative_expression", compositeScore: 72, confidenceScore: 0.52, rankScore: 0.72, dimensions: { thesisFit: "modeled", evidenceFreshness: "unknown", liquidity: "illustrative" }, verifyFields: ["Confirm this alternative’s catalyst and liquidity before it can replace the lead."], exposureNodeIds: [], memo: { basis: "Illustrative UAT fixture — not current market data.", whyRanked: "Conditional alternative: lower modeled thesis fit and incomplete evidence." }, memoStatus: "ok", citations: ["illustrative-uat-fixture://conditional-alternative"], suggestedSizeLowCents: null, suggestedSizeHighCents: null, createdAt: now },
            ]);
            const [slateResult] = await tx.insert(aperturePlaySlates).values({ userId: ctx.user.id, canonicalThesisId: decisionRun.canonicalThesisId, accountId: account.id, sessionDateEt: new Date(now).toISOString().slice(0, 10), windowKey: `illustrative_qualified_play_${decisionRun.id}`, snapshotBasis: "historical_reconstruction", status: "captured", operatorDecision: "not_recorded", portfolioSnapshot: { label: "Illustrative UAT fixture — not current market data", equityCents: account.equityValueCents ?? null, measured: false }, contextSnapshot: { label: "Illustrative UAT fixture — not current market data", providerNetworkCalls: 0, brokerOrdersCreated: 0 }, capturedAt: now, createdAt: now, updatedAt: now });
            const slateId = Number((slateResult as any).insertId);
            const candidates = await tx.select().from(apertureCandidates).where(eq(apertureCandidates.runId, runId)).orderBy(desc(apertureCandidates.rankScore));
            await tx.insert(aperturePlaySlateItems).values(candidates.map((candidate, index) => ({ slateId, sourceRunId: runId, sourceCandidateId: candidate.id, symbol: candidate.symbol, conditionKey: index === 0 ? "illustrative-qualified-lead" : "illustrative-conditional-alternative", recommendationSnapshot: { label: "Illustrative UAT fixture — not current market data", rank: index + 1, thesisFit: "modeled", evidenceFreshness: "unknown", riskCapCents: revision.maxPlannedLossCents }, outcomeStatus: "unavailable" as const, outcomeResult: "unresolved" as const, triggerObservation: "not_observed" as const, exitObservation: "not_observed" as const, outcomeBasis: "unknown" as const, outcomeExplanation: "Illustrative UAT fixture. No price, outcome, or current-market claim exists.", createdAt: now, updatedAt: now })));
            const update = await tx.update(apertureDecisionRuns).set({ researchRunId: runId, lifecycle: "researching", lockVersion: decisionRun.lockVersion + 1, updatedAt: now }).where(and(eq(apertureDecisionRuns.id, decisionRun.id), eq(apertureDecisionRuns.currentRevisionId, revision.id), eq(apertureDecisionRuns.lockVersion, decisionRun.lockVersion)));
            if (!update[0].affectedRows) throw new TRPCError({ code: "CONFLICT", message: "The operator’s mission changed before the fixture could be bound." });
              return runId;
            });
          } catch (error) {
            console.warn("[aperture] isolated illustrative fixture write did not complete", error instanceof Error ? error.message : error);
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Illustrative UAT Play Slate could not be recorded. No provider, proposal, or broker action occurred. Reload and retry the isolated fixture." });
          }
          return { status: "started" as const, runId: created, decisionRunId: decisionRun.id, revisionId: revision.id, fixture: "qualified-play" as const };
        }
        if (isolatedUatResearchBlocked) {
          const [decisionRun] = await db!.select().from(apertureDecisionRuns).where(and(
            eq(apertureDecisionRuns.id, input.decisionRunId),
            eq(apertureDecisionRuns.userId, ctx.user.id),
          )).limit(1);
          if (!decisionRun) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Decision binding unavailable" });
          if (decisionRun.currentRevisionId !== input.revisionId) {
            const [replayed] = await db!.select().from(apertureDecisionRevisions).where(and(
              eq(apertureDecisionRevisions.decisionRunId, decisionRun.id),
              eq(apertureDecisionRevisions.previousRevisionId, input.revisionId),
              eq(apertureDecisionRevisions.namedGateKey, "research-provider-unavailable"),
            )).limit(1);
            if (replayed) return { status: "blocked" as const, decisionRunId: decisionRun.id, revisionId: replayed.id, message: "Research provider unavailable in this environment" };
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Open the current mission revision before starting research." });
          }
          const [current] = await db!.select().from(apertureDecisionRevisions).where(and(
            eq(apertureDecisionRevisions.id, input.revisionId),
            eq(apertureDecisionRevisions.decisionRunId, decisionRun.id),
          )).limit(1);
          if (!current || current.effectiveBranch !== "research") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cash and conditional branches cannot start research." });
          const now = Date.now();
          const result = await db!.transaction(async (tx) => {
            const [locked] = await tx.select().from(apertureDecisionRuns).where(and(
              eq(apertureDecisionRuns.id, decisionRun.id),
              eq(apertureDecisionRuns.userId, ctx.user.id),
              eq(apertureDecisionRuns.currentRevisionId, current.id),
              eq(apertureDecisionRuns.lockVersion, decisionRun.lockVersion),
            )).for("update").limit(1);
            if (!locked) throw new TRPCError({ code: "CONFLICT", message: "The Decision Run changed while research availability was checked." });
            const { id: _id, decisionRunId: _runId, version: _version, previousRevisionId: _previousRevisionId, createdAt: _createdAt, ...copy } = current;
            const reviewAt = now + 60 * 60 * 1000;
            const [inserted] = await tx.insert(apertureDecisionRevisions).values({
              ...copy,
              decisionRunId: locked.id,
              version: current.version + 1,
              previousRevisionId: current.id,
              operatorChoice: "conditional",
              effectiveBranch: "conditional",
              reason: "Research provider unavailable in this environment.",
              blocker: "Provider-backed research dispatch is disabled in this isolated UAT environment.",
              reopenCondition: "Enable an approved research provider, then record a new decision revision before research begins.",
              reviewAt,
              namedGateKey: "research-provider-unavailable",
              namedGateLabel: "Research provider unavailable",
              createdAt: now,
            });
            const revisionId = Number((inserted as any).insertId);
            const updated = await tx.update(apertureDecisionRuns).set({
              currentRevisionId: revisionId,
              lifecycle: "conditional",
              lockVersion: locked.lockVersion + 1,
              updatedAt: now,
            }).where(and(
              eq(apertureDecisionRuns.id, locked.id),
              eq(apertureDecisionRuns.currentRevisionId, current.id),
              eq(apertureDecisionRuns.lockVersion, locked.lockVersion),
            ));
            if (!updated[0].affectedRows) throw new TRPCError({ code: "CONFLICT", message: "The Decision Run changed while the fail-closed receipt was being written." });
            await tx.insert(aperturePendingOutcomes).values({
              userId: ctx.user.id,
              decisionRunId: locked.id,
              revisionId,
              kind: "gate_review",
              status: "pending",
              dueAt: reviewAt,
              gateKey: "research-provider-unavailable",
              reviewBasis: "Enable an approved research provider, then record a new decision revision before research begins.",
              createdAt: now,
              updatedAt: now,
            });
            return { revisionId };
          });
          return { status: "blocked" as const, decisionRunId: decisionRun.id, revisionId: result.revisionId, message: "Research provider unavailable in this environment" };
        }
        const [decisionRun] = await db!.select().from(apertureDecisionRuns).where(and(
          eq(apertureDecisionRuns.id, input.decisionRunId),
          eq(apertureDecisionRuns.userId, ctx.user.id),
        )).limit(1);
        if (!decisionRun || decisionRun.currentRevisionId !== input.revisionId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Open the current mission revision before starting research." });
        if (decisionRun.researchRunId != null) throw new TRPCError({ code: "CONFLICT", message: "This mission already has an exact research run." });
        const [revision] = await db!.select().from(apertureDecisionRevisions).where(and(
          eq(apertureDecisionRevisions.id, input.revisionId),
          eq(apertureDecisionRevisions.decisionRunId, decisionRun.id),
        )).limit(1);
        if (!revision || revision.effectiveBranch !== "research") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cash and conditional branches cannot start research." });
        let thesis = await requireThesis(db, decisionRun.capitalThesisId, ctx.user.id);
        if (!thesis.graph) {
          thesis = await ensureThesisReady(thesis, {
            compile: compileThesis,
            persist: async ({ graph, confidenceNotes }) => {
              await db!.update(capitalTheses).set({ graph, confidenceNotes, status: "review", updatedAt: Date.now() }).where(eq(capitalTheses.id, thesis.id));
            },
          });
        }
        const account = await requireAccount(db, decisionRun.accountId, ctx.user.id);
        if (!account.isPaper) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Decision Runway can only research against a paper account." });
        const now = Date.now();
        const catalystDeadlineAt = outcomeReviewAt(revision.holdingPeriod, revision.reviewAt, now);
        if (catalystDeadlineAt == null) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Catalyst-window research requires a declared review or look-back time. Return to Capital Mission and set it before starting research.",
          });
        }
        const runInput = {
          thesisId: thesis.id,
          accountId: account.id,
          deployableCapitalCents: revision.deployableCapitalCents,
          intendedTrades: [] as Array<{ symbol: string; dollarsCents: number; note?: string }>,
          holdingPeriod: revision.holdingPeriod,
          instrumentPreference: revision.instrumentPreference,
          liquidityFloorAdvUsd: CURRENT_MANDATE.minAdvUsd30d,
          catalystDeadlineAt,
          maxSingleNamePct: CURRENT_MANDATE.maxPositionPctOfEquity,
          invalidationRule: revision.invalidationRule,
        };
        const readiness = evaluateThesisResearchReadiness(thesis.graph as ThesisGraph, {
          holdingPeriod: revision.holdingPeriod,
          instrumentPreference: revision.instrumentPreference,
          invalidationRule: revision.invalidationRule,
        });
        if (!readiness.ready) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Complete the thesis structure before research: ${[...readiness.missing, ...readiness.incompatibilities].join("; ")}. No run was created.`,
          });
        }
        const preset = evaluateRunPreset(runInput, { accountLinked: true, equityCents: account.equityValueCents ?? null }, CURRENT_MANDATE, now);
        if (!preset.passed) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `run preset rejected by the mandate: ${preset.failures.join("; ")}` });
        const runId = await db!.transaction(async (tx) => {
          const [runResult] = await tx.insert(apertureRuns).values({
            userId: ctx.user.id,
            thesisId: thesis.id,
            accountId: account.id,
            deployableCapitalCents: revision.deployableCapitalCents,
            intendedTrades: [],
            holdingPeriod: revision.holdingPeriod,
            instrumentPreference: revision.instrumentPreference,
            catalystDeadlineAt,
            liquidityFloorAdvUsd: CURRENT_MANDATE.minAdvUsd30d,
            maxSingleNamePct: CURRENT_MANDATE.maxPositionPctOfEquity,
            invalidationRule: revision.invalidationRule,
            mandateVersion: preset.mandateVersion,
            status: "queued",
            createdAt: now,
          });
          const exactRunId = Number((runResult as any).insertId);
          const update = await tx.update(apertureDecisionRuns).set({
            researchRunId: exactRunId,
            lifecycle: "researching",
            lockVersion: decisionRun.lockVersion + 1,
            updatedAt: now,
          }).where(and(
            eq(apertureDecisionRuns.id, decisionRun.id),
            eq(apertureDecisionRuns.currentRevisionId, revision.id),
            eq(apertureDecisionRuns.lockVersion, decisionRun.lockVersion),
          ));
          if (!update[0].affectedRows) throw new TRPCError({ code: "CONFLICT", message: "This mission changed before research could be bound. Review the current revision." });
          return exactRunId;
        });
        executeRun(runId, ctx.user.id, thesis, runInput).catch((error) => console.error(`[aperture] Decision Runway research ${runId} failed:`, error?.message ?? error));
        return { status: "started" as const, runId, decisionRunId: decisionRun.id, revisionId: revision.id };
      }),
    attachRun: capitalOperatorProcedure.input(z.object({ stateId: z.number(), runId: z.number() })).mutation(() => {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Arbitrary run attachment is retired. Start research from the exact Decision Run revision." });
    }),
    setBranch: capitalOperatorProcedure.input(z.object({ stateId: z.number(), branch: z.enum(["research", "eligible", "conditional", "cash"]), reason: z.string().nullable().optional() })).mutation(() => {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Decision history is immutable. Record a new mission revision instead of rewriting a branch." });
    }),
  }),

  // ── Disclosure Intelligence Rail (WP-DIR1) ─────────────────────────────────
  // This namespace is evidence and paper-stage preparation only. It never calls
  // a broker adapter and never creates, approves, or submits an order.
  disclosure: router({
    compileIntent: capitalOperatorProcedure
      .input(z.object({ rawIntent: z.string().min(20).max(12_000) }))
      .mutation(({ input }) => compileDisclosureIntent(input.rawIntent)),

    plan: router({
      list: capitalOperatorProcedure.query(async ({ ctx }) => {
        const db = await getDb();
        return db!.select().from(disclosurePlans)
          .where(eq(disclosurePlans.userId, ctx.user.id))
          .orderBy(desc(disclosurePlans.updatedAt));
      }),

      createRevision: capitalOperatorProcedure
        .input(z.object({
          planId: z.number().optional(),
          rawIntent: z.string().min(20).max(12_000),
          controls: z.object({
            maximumLagDays: z.number().int().positive().optional(),
            minimumDisclosedRangeFloorUsd: z.number().int().positive().optional(),
            maximumObservationsPerPlanDay: z.number().int().positive().optional(),
            allowedAssetTypes: z.array(z.enum(["equity", "etf"])).optional(),
          }).optional(),
          operatorResolutions: z.array(z.string().min(1).max(500)).default([]),
        }))
        .mutation(async ({ ctx, input }) => {
          const db = await getDb();
          const now = Date.now();
          const compiled = compileDisclosureIntent(input.rawIntent);
          const controls = tightenControls(input.controls as Partial<DisclosureControls> ?? {});
          const finalCompiled = { ...compiled, controls, unresolved: compiled.unresolved.filter((note) => !input.operatorResolutions.includes(note)) };
          let planId = input.planId;
          if (planId) {
            const [owned] = await db!.select().from(disclosurePlans)
              .where(and(eq(disclosurePlans.id, planId), eq(disclosurePlans.userId, ctx.user.id))).limit(1);
            if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Disclosure plan not found" });
          } else {
            const inserted = await db!.insert(disclosurePlans).values({ userId: ctx.user.id, status: "draft", createdAt: now, updatedAt: now });
            planId = Number(inserted[0].insertId);
          }
          const [latest] = await db!.select({ revisionNumber: disclosurePlanRevisions.revisionNumber }).from(disclosurePlanRevisions)
            .where(eq(disclosurePlanRevisions.planId, planId)).orderBy(desc(disclosurePlanRevisions.revisionNumber)).limit(1);
          const contentHash = createHash("sha256").update(JSON.stringify({ rawIntent: input.rawIntent, finalCompiled, operatorResolutions: input.operatorResolutions })).digest("hex");
          const revisionNumber = (latest?.revisionNumber ?? 0) + 1;
          const inserted = await db!.insert(disclosurePlanRevisions).values({
            planId, revisionNumber, rawIntent: input.rawIntent, compiledPlan: finalCompiled, compilerRole: "deterministic_wp_dir1_compiler",
            promptVersion: "wp-dir1-v1", confidenceNotes: finalCompiled.confidenceNotes, operatorResolutions: input.operatorResolutions,
            contentHash, compiledAt: now, createdAt: now,
          });
          const revisionId = Number(inserted[0].insertId);
          await db!.update(disclosurePlans).set({ currentRevisionId: revisionId, status: "review", updatedAt: now })
            .where(eq(disclosurePlans.id, planId));
          return { planId, revisionId, revisionNumber, compiledPlan: finalCompiled };
        }),

      approveRevision: capitalOperatorProcedure
        .input(z.object({ planId: z.number(), revisionId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const db = await getDb();
          const [plan] = await db!.select().from(disclosurePlans)
            .where(and(eq(disclosurePlans.id, input.planId), eq(disclosurePlans.userId, ctx.user.id))).limit(1);
          const [revision] = await db!.select().from(disclosurePlanRevisions)
            .where(and(eq(disclosurePlanRevisions.id, input.revisionId), eq(disclosurePlanRevisions.planId, input.planId))).limit(1);
          if (!plan || !revision) throw new TRPCError({ code: "NOT_FOUND", message: "Plan revision not found" });
          const compiled = revision.compiledPlan as { unresolved?: string[] };
          if (compiled.unresolved?.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Resolve every plan ambiguity before monitoring may begin" });
          const now = Date.now();
          await db!.update(disclosurePlans).set({ status: "monitoring", currentRevisionId: revision.id, approvedAt: now, updatedAt: now }).where(eq(disclosurePlans.id, plan.id));
          return { approved: true, planId: plan.id, revisionId: revision.id };
        }),

      pause: capitalOperatorProcedure.input(z.object({ planId: z.number() })).mutation(async ({ ctx, input }) => {
        const db = await getDb(); const now = Date.now();
        await db!.update(disclosurePlans).set({ status: "paused", pausedAt: now, updatedAt: now })
          .where(and(eq(disclosurePlans.id, input.planId), eq(disclosurePlans.userId, ctx.user.id)));
        return { paused: true };
      }),
    }),

    replayOfficialFixture: capitalOperatorProcedure
      .input(z.object({ planId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const [plan] = await db!.select().from(disclosurePlans)
          .where(and(eq(disclosurePlans.id, input.planId), eq(disclosurePlans.userId, ctx.user.id))).limit(1);
        if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Disclosure plan not found" });
        if (plan.status !== "monitoring") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Monitoring requires explicit approval of an immutable revision" });
        const [revision] = await db!.select().from(disclosurePlanRevisions).where(eq(disclosurePlanRevisions.id, plan.currentRevisionId!)).limit(1);
        if (!revision) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Active revision unavailable" });
        const document = housePtrFixtureDocument(); const stored = await new DisclosureDocumentStore().put(document.bytes); const now = Date.now();
        const [existing] = await db!.select().from(disclosureFilings).where(and(eq(disclosureFilings.source, document.source), eq(disclosureFilings.stableSourceDocumentId, document.stableSourceDocumentId), eq(disclosureFilings.contentHash, stored.contentHash))).limit(1);
        let filingId = existing?.id;
        const sourceVersions = await db!.select().from(disclosureFilings).where(and(eq(disclosureFilings.source, document.source), eq(disclosureFilings.stableSourceDocumentId, document.stableSourceDocumentId))).orderBy(desc(disclosureFilings.id));
        if (!filingId) {
          const inserted = await db!.insert(disclosureFilings).values({
            source: document.source, stableSourceDocumentId: document.stableSourceDocumentId, canonicalUrl: document.canonicalUrl,
            filerId: document.filer.id, filerName: document.filer.name, chamber: document.filer.chamber, filedAt: document.filedAt,
            firstObservedAt: document.retrievedAt, retrievedAt: document.retrievedAt, storageKey: stored.storageKey, contentHash: stored.contentHash,
            mediaType: document.mediaType, byteSize: stored.byteSize, parserVersion: document.parserVersion,
            supersedesFilingId: sourceVersions[0]?.id ?? null, createdAt: now,
          }); filingId = Number(inserted[0].insertId);
        }
        await db!.insert(disclosureRetrievals).values({ filingId, source: document.source, stableSourceDocumentId: document.stableSourceDocumentId, retrievedAt: document.retrievedAt, observedHash: stored.contentHash, result: stored.repeated ? "repeat" : sourceVersions.length ? "source_changed" : "stored", transportMetadata: { fixture: true }, createdAt: now });
        const compiled = revision.compiledPlan as { controls: DisclosureControls };
        const observations = [] as Array<{ transactionId: number; state: string; reasons: string[] }>;
        for (const transaction of document.transactions) {
          let [row] = await db!.select().from(disclosureTransactions).where(and(eq(disclosureTransactions.filingId, filingId), eq(disclosureTransactions.sourceRowIdentity, transaction.sourceRowIdentity))).limit(1);
          if (!row) {
            const evaluated = evaluateDisclosureTransaction(transaction, compiled.controls, now);
            const inserted = await db!.insert(disclosureTransactions).values({ filingId, sourceRowIdentity: transaction.sourceRowIdentity, ownerAsStated: transaction.ownerAsStated, rawAssetName: transaction.rawAssetName, transactionType: transaction.transactionType, transactionDate: transaction.transactionDate, amountMinUsd: transaction.amountMinUsd, amountMaxUsd: transaction.amountMaxUsd, resolutionGrade: transaction.resolutionGrade, resolutionBasis: ["Official House fixture replay; no ticker is inferred."], publicationBasis: transaction.publicationAt ? "source_timestamp" : "first_observed", eligibleFrom: evaluated.eligibleFrom, disclosureLagDays: evaluated.disclosureLagDays, createdAt: now });
            row = { id: Number(inserted[0].insertId) } as typeof row;
          }
          const evaluated = evaluateDisclosureTransaction(transaction, compiled.controls, now);
          const [match] = await db!.select().from(disclosureMatches).where(and(eq(disclosureMatches.planRevisionId, revision.id), eq(disclosureMatches.transactionId, row.id))).limit(1);
          if (!match) await db!.insert(disclosureMatches).values({ planRevisionId: revision.id, transactionId: row.id, gateSnapshot: evaluated, disclosureMandateVersion: "DISCLOSURE_MANDATE_V1", effectiveControls: evaluated.effectiveControls, state: evaluated.state, reasons: evaluated.reasons, createdAt: now, updatedAt: now });
          observations.push({ transactionId: row.id, state: evaluated.state, reasons: evaluated.reasons });
        }
        return { filingId, contentHash: stored.contentHash, storageKey: stored.storageKey, repeated: stored.repeated, observations };
      }),

    match: router({
      list: capitalOperatorProcedure.input(z.object({ planId: z.number() })).query(async ({ ctx, input }) => {
        const db = await getDb();
        const [plan] = await db!.select().from(disclosurePlans).where(and(eq(disclosurePlans.id, input.planId), eq(disclosurePlans.userId, ctx.user.id))).limit(1);
        if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Disclosure plan not found" });
        return db!.select({ match: disclosureMatches, transaction: disclosureTransactions, filing: disclosureFilings }).from(disclosureMatches)
          .innerJoin(disclosureTransactions, eq(disclosureMatches.transactionId, disclosureTransactions.id))
          .innerJoin(disclosureFilings, eq(disclosureTransactions.filingId, disclosureFilings.id))
          .where(eq(disclosureMatches.planRevisionId, plan.currentRevisionId!)).orderBy(asc(disclosureMatches.createdAt));
      }),
      promoteEvidence: capitalOperatorProcedure.input(z.object({ matchId: z.number(), note: z.string().min(1).max(2_000) })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const [match] = await db!.select({ match: disclosureMatches, plan: disclosurePlans, transaction: disclosureTransactions, filing: disclosureFilings }).from(disclosureMatches)
          .innerJoin(disclosurePlanRevisions, eq(disclosureMatches.planRevisionId, disclosurePlanRevisions.id))
          .innerJoin(disclosurePlans, eq(disclosurePlanRevisions.planId, disclosurePlans.id))
          .innerJoin(disclosureTransactions, eq(disclosureMatches.transactionId, disclosureTransactions.id))
          .innerJoin(disclosureFilings, eq(disclosureTransactions.filingId, disclosureFilings.id))
          .where(and(eq(disclosureMatches.id, input.matchId), eq(disclosurePlans.userId, ctx.user.id))).limit(1);
        if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Disclosure observation not found" });
        if (match.match.state !== "reviewable") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only a reviewable observation can be promoted as cited research evidence" });
        await db!.update(disclosureMatches).set({ state: "promoted", reviewedByUserId: ctx.user.id, reviewedAt: Date.now(), reviewNote: input.note, updatedAt: Date.now() }).where(eq(disclosureMatches.id, match.match.id));
        return { promoted: true, citedEvidence: { sourceUrl: match.filing.canonicalUrl, filingId: match.filing.stableSourceDocumentId, rawAssetName: match.transaction.rawAssetName, amountRange: { minUsd: match.transaction.amountMinUsd, maxUsd: match.transaction.amountMaxUsd }, eligibleFrom: match.transaction.eligibleFrom, nextRequiredStep: "Existing paper recipe readiness and preflight remain separate; no broker order was created." } };
      }),
    }),
  }),

  // ── Cross-run operator desk ─────────────────────────────────────────────
  // Read-only lifecycle summary. This intentionally composes existing durable
  // records; it does not create proposals, orders, monitoring rows, or outcomes.
  desk: router({
    summary: capitalOperatorProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const orderRows = await db!.select({
        id: brokerOrders.id,
        runId: brokerOrders.runId,
        candidateId: brokerOrders.candidateId,
        accountId: brokerOrders.accountId,
        accountLabel: portfolioAccounts.label,
        thesisName: capitalTheses.name,
        symbol: brokerOrders.symbol,
        instrumentType: brokerOrders.instrumentType,
        underlyingSymbol: brokerOrders.underlyingSymbol,
        optionExpirationDate: brokerOrders.optionExpirationDate,
        optionStrikePriceCents: brokerOrders.optionStrikePriceCents,
        side: brokerOrders.side,
        intent: brokerOrders.intent,
        qty: brokerOrders.qty,
        filledQty: brokerOrders.filledQty,
        notionalCents: brokerOrders.notionalCents,
        plannedRiskCents: brokerOrders.plannedRiskCents,
        status: brokerOrders.status,
        brokerOrderId: brokerOrders.brokerOrderId,
        dispatchError: brokerOrders.dispatchError,
        timeStopAt: brokerOrders.timeStopAt,
        createdAt: brokerOrders.createdAt,
        updatedAt: brokerOrders.updatedAt,
      }).from(brokerOrders)
        .innerJoin(apertureRuns, eq(brokerOrders.runId, apertureRuns.id))
        .leftJoin(capitalTheses, eq(apertureRuns.thesisId, capitalTheses.id))
        .innerJoin(portfolioAccounts, eq(brokerOrders.accountId, portfolioAccounts.id))
        .where(and(
          eq(brokerOrders.userId, ctx.user.id),
          eq(portfolioAccounts.userId, ctx.user.id),
          eq(apertureRuns.userId, ctx.user.id),
          eq(capitalTheses.userId, ctx.user.id),
          or(
            inArray(brokerOrders.status, ["pending_approval", "approved", "submitted"]),
            eq(brokerOrders.status, "filled"),
          ),
        ))
        .orderBy(desc(brokerOrders.updatedAt));

      const exposureKey = (order: typeof orderRows[number]) => [
        order.accountId,
        order.symbol,
        order.instrumentType,
        order.underlyingSymbol ?? "",
        order.optionExpirationDate ?? "",
        order.optionStrikePriceCents ?? "",
      ].join(":");
      const filledExposure = new Map<string, { netQty: number; latestOpenId: number | null; latestOpenAt: number }>();
      for (const order of orderRows) {
        if (order.status !== "filled" || (order.intent !== "open" && order.intent !== "close")) continue;
        const key = exposureKey(order);
        const state = filledExposure.get(key) ?? { netQty: 0, latestOpenId: null, latestOpenAt: -1 };
        const filledQty = Math.abs(order.filledQty ?? order.qty ?? 1);
        state.netQty += order.intent === "close" ? -filledQty : filledQty;
        if (order.intent === "open" && order.updatedAt >= state.latestOpenAt) {
          state.latestOpenId = order.id;
          state.latestOpenAt = order.updatedAt;
        }
        filledExposure.set(key, state);
      }
      const orders = orderRows.filter((order) => {
        if (order.status !== "filled") return true;
        if (order.intent !== "open") return false;
        const state = filledExposure.get(exposureKey(order));
        return Boolean(state && state.netQty > 0 && state.latestOpenId === order.id);
      });

      const activePlays = await db!.select({
        id: apertureActivePlayContexts.id,
        accountId: apertureActivePlayContexts.accountId,
        accountLabel: portfolioAccounts.label,
        symbol: apertureActivePlayContexts.symbol,
        instrumentType: apertureActivePlayContexts.instrumentType,
        status: apertureActivePlayContexts.status,
        thesisNote: apertureActivePlayContexts.thesisNote,
        horizon: apertureActivePlayContexts.horizon,
        asOf: apertureActivePlayContexts.asOf,
        updatedAt: apertureActivePlayContexts.updatedAt,
      }).from(apertureActivePlayContexts)
        .innerJoin(portfolioAccounts, eq(apertureActivePlayContexts.accountId, portfolioAccounts.id))
        .where(and(
          eq(apertureActivePlayContexts.userId, ctx.user.id),
          eq(portfolioAccounts.userId, ctx.user.id),
          inArray(apertureActivePlayContexts.status, ["watching", "active"]),
        ))
        .orderBy(desc(apertureActivePlayContexts.updatedAt))
        .limit(200);

      return { orders, activePlays };
    }),
  }),

  run: router({
    list: capitalOperatorProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const rows = await db!.select({ run: apertureRuns, thesisName: capitalTheses.name }).from(apertureRuns)
        .leftJoin(capitalTheses, and(
          eq(apertureRuns.thesisId, capitalTheses.id),
          eq(capitalTheses.userId, ctx.user.id),
        ))
        .where(eq(apertureRuns.userId, ctx.user.id))
        .orderBy(desc(apertureRuns.createdAt));
      const runIds = rows.map(({ run }) => run.id);
      if (!runIds.length) return [];
      const candidateRows = await db!.select().from(apertureCandidates)
        .where(inArray(apertureCandidates.runId, runIds))
        .orderBy(desc(apertureCandidates.compositeScore), desc(apertureCandidates.id));
      const leadByRun = new Map<number, typeof candidateRows[number]>();
      for (const candidate of candidateRows) {
        if (!leadByRun.has(candidate.runId)) leadByRun.set(candidate.runId, candidate);
      }
      const candidateIds = candidateRows.map((candidate) => candidate.id);
      const reviews = candidateIds.length ? await db!.select().from(apertureEvidenceReviews).where(and(
        eq(apertureEvidenceReviews.userId, ctx.user.id),
        inArray(apertureEvidenceReviews.candidateId, candidateIds),
      )) : [];
      const skippedDecisions = candidateIds.length ? await db!.select({ candidateId: aperturePlayDecisions.candidateId }).from(aperturePlayDecisions).where(and(
        eq(aperturePlayDecisions.userId, ctx.user.id),
        inArray(aperturePlayDecisions.candidateId, candidateIds),
        eq(aperturePlayDecisions.decision, "skipped"),
      )) : [];
      const skippedCandidateIds = new Set(skippedDecisions.map((decision) => decision.candidateId));
      const activeOrderRows = candidateIds.length ? await db!.select({
        candidateId: brokerOrders.candidateId,
        status: brokerOrders.status,
        intent: brokerOrders.intent,
        qty: brokerOrders.qty,
        filledQty: brokerOrders.filledQty,
      }).from(brokerOrders).where(and(
        eq(brokerOrders.userId, ctx.user.id),
        inArray(brokerOrders.runId, runIds),
        inArray(brokerOrders.status, ["pending_approval", "approved", "submitted", "filled"]),
      )) : [];
      const activeCandidateIds = new Set<number>();
      const filledQtyByCandidate = new Map<number, number>();
      for (const order of activeOrderRows) {
        if (order.candidateId == null) continue;
        if (order.status !== "filled") {
          activeCandidateIds.add(order.candidateId);
          continue;
        }
        const quantity = Math.abs(order.filledQty ?? order.qty ?? 1);
        filledQtyByCandidate.set(order.candidateId, (filledQtyByCandidate.get(order.candidateId) ?? 0) + (order.intent === "close" ? -quantity : quantity));
      }
      filledQtyByCandidate.forEach((netQty, candidateId) => {
        if (netQty > 0) activeCandidateIds.add(candidateId);
      });
      const candidatesByRun = new Map<number, typeof candidateRows>();
      for (const candidate of candidateRows) candidatesByRun.set(candidate.runId, [...(candidatesByRun.get(candidate.runId) ?? []), candidate]);
      const reviewsByCandidate = new Map<number, typeof reviews>();
      for (const review of reviews) reviewsByCandidate.set(review.candidateId, [...(reviewsByCandidate.get(review.candidateId) ?? []), review]);
      return rows.map(({ run, thesisName }) => {
        const lead = leadByRun.get(run.id);
        const readiness = lead ? getEvidenceReviewReadiness(
          normalizeStringList(lead.verifyFields),
          reviewsByCandidate.get(lead.id) ?? [],
        ) : null;
        const candidateStates = summarizeDeskCandidates((candidatesByRun.get(run.id) ?? []).map((candidate) => {
          const candidateReadiness = getEvidenceReviewReadiness(
            normalizeStringList(candidate.verifyFields),
            reviewsByCandidate.get(candidate.id) ?? [],
          );
          return classifyDeskCandidate({
            id: candidate.id,
            symbol: candidate.symbol,
            hasActiveOrder: activeCandidateIds.has(candidate.id),
            catalystDeadlineAt: run.catalystDeadlineAt,
            paperStageDeclined: candidateReadiness.paperStageDeclined || skippedCandidateIds.has(candidate.id),
            unreviewedChecks: candidateReadiness.unreviewedChecks.length,
            runFailed: run.status === "failed",
          });
        }));
        return {
          ...run,
          thesisName,
          paperStageDeclined: readiness?.paperStageDeclined === true,
          candidateStates,
          actionableCandidateId: candidateStates.actionableCandidateId,
          actionableSymbol: candidateStates.actionableSymbol,
        };
      });
    }),

    get: capitalOperatorProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        const [run] = await db!.select().from(apertureRuns)
          .where(and(eq(apertureRuns.id, input.id), eq(apertureRuns.userId, ctx.user.id)))
          .limit(1);
        if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
        const candidateRows = await db!.select().from(apertureCandidates)
          .where(eq(apertureCandidates.runId, input.id))
          .orderBy(desc(apertureCandidates.compositeScore));
        const candidates = candidateRows.map((candidate) => ({
          ...candidate,
          memo: normalizeJsonRecord(candidate.memo),
          verifyFields: normalizeStringList(candidate.verifyFields),
          citations: normalizeStringList(candidate.citations),
        }));
        const evidenceReviews = await db!.select().from(apertureEvidenceReviews)
          .where(and(eq(apertureEvidenceReviews.runId, input.id), eq(apertureEvidenceReviews.userId, ctx.user.id)));
        const strategies = await db!.select().from(apertureStrategies)
          .where(eq(apertureStrategies.runId, input.id));
        const coverage = await db!.select().from(exposureCoverage)
          .where(eq(exposureCoverage.runId, input.id));
        const setAside = await db!.select().from(apertureSetAside)
          .where(eq(apertureSetAside.runId, input.id));
        const macroFacts = await getFacts(MACRO_SYMBOL);
        const thesis = await requireThesis(db, run.thesisId, ctx.user.id);
        const [paperAccount] = run.accountId
          ? await db!.select().from(portfolioAccounts)
            .where(and(eq(portfolioAccounts.id, run.accountId), eq(portfolioAccounts.userId, ctx.user.id)))
            .limit(1)
          : [];
        const paperPositions = paperAccount
          ? await db!.select({ symbol: positions.symbol, marketValueCents: positions.marketValueCents, priceAsOf: positions.priceAsOf })
            .from(positions).where(eq(positions.accountId, paperAccount.id))
          : [];
        const coverageNodeIds = coverage.map((item) => item.nodeId);
        const coverageNodes = coverageNodeIds.length
          ? await db!.select().from(exposureNodes).where(inArray(exposureNodes.id, coverageNodeIds))
          : [];
        const nodePathById = new Map(coverageNodes.map((node) => [node.id, node.path || node.label]));
        const thesisNodes = flattenExposureTree((thesis.graph as any)?.exposureTree ?? [])
          .map((node) => ({ label: node.label, path: node.path || node.label, depth: node.depth }));
        const coverageDetail = coverage.map((item) => ({
          nodePath: nodePathById.get(item.nodeId) ?? `unmapped:${item.nodeId}`,
          symbol: item.symbol,
          source: item.source,
        }));
        const brief = buildCapitalDecisionBrief({
          graph: thesis.graph,
          run,
          candidates,
          strategies,
          coverage: coverageDetail,
          thesisNodePaths: thesisNodes.map((node) => node.path),
        });
        return {
          run,
          stale: isRunStale(run),
          candidates,
          strategies,
          coverage,
          coverageDetail,
          setAside,
          // An empty list on a run that finished before migration 0037 means
          // "never recorded", not "nothing was set aside". The client must not
          // render silence as a clean sweep.
          setAsideNote: setAside.length === 0 && run.status === "completed"
            ? "No set-aside record for this brief. Briefs completed before the set-aside list was persisted carry none — this is an absence of record, not evidence that nothing was rejected."
            : null,
          thesisNodes,
          macroFacts,
          brief,
          evidenceReviews,
          thesisContext: { id: thesis.id, name: thesis.name, rawText: thesis.rawText },
          paperContext: paperAccount ? { account: paperAccount, positions: paperPositions } : null,
        };
      }),

    evidence: router({
      review: capitalOperatorProcedure
        .input(z.object({
          runId: z.number(),
          candidateId: z.number(),
          checkLabel: z.string().min(2).max(255),
          status: z.enum(["confirmed", "not_confirmed", "not_applicable", "needs_follow_up"]),
          note: z.string().max(1_000).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const db = await getDb();
          const [candidate] = await db!.select().from(apertureCandidates)
            .where(and(eq(apertureCandidates.id, input.candidateId), eq(apertureCandidates.runId, input.runId)))
            .limit(1);
          if (!candidate) throw new TRPCError({ code: "NOT_FOUND", message: "Evidence item not found in this research brief" });
          const now = Date.now();
          const existing = await db!.select().from(apertureEvidenceReviews).where(and(
            eq(apertureEvidenceReviews.userId, ctx.user.id),
            eq(apertureEvidenceReviews.runId, input.runId),
            eq(apertureEvidenceReviews.candidateId, input.candidateId),
            eq(apertureEvidenceReviews.checkLabel, input.checkLabel),
          )).limit(1);
          if (existing[0]) {
            await db!.update(apertureEvidenceReviews).set({ status: input.status, note: input.note ?? null, reviewedAt: now })
              .where(eq(apertureEvidenceReviews.id, existing[0].id));
          } else {
            await db!.insert(apertureEvidenceReviews).values({ userId: ctx.user.id, runId: input.runId, candidateId: input.candidateId, checkLabel: input.checkLabel, status: input.status, note: input.note ?? null, reviewedAt: now, createdAt: now });
          }
          return { ok: true };
        }),
    }),

    /**
     * Process restarts can interrupt the detached executor. Preserve the original
     * record as an explicit interruption and restart the identical paper research
     * inputs in a new, traceable run. No order is created or submitted.
     */
    retry: capitalOperatorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const [run] = await db!.select().from(apertureRuns)
          .where(and(eq(apertureRuns.id, input.id), eq(apertureRuns.userId, ctx.user.id)))
          .limit(1);
        if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
        if (!isRunStale(run)) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This brief is still active or already finished; refresh status before restarting it." });
        }

        const thesis = await requireThesis(db, run.thesisId, ctx.user.id);
        if (!thesis.graph) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This brief's thesis needs to be prepared before research can restart." });
        }

        const now = Date.now();
        await db!.update(apertureRuns).set({
          status: "failed",
          error: "Research was interrupted before completion. Restarted as a new linked brief.",
          completedAt: now,
        }).where(eq(apertureRuns.id, run.id));

        const [result] = await db!.insert(apertureRuns).values({
          userId: ctx.user.id,
          thesisId: run.thesisId,
          accountId: run.accountId,
          deployableCapitalCents: run.deployableCapitalCents,
          intendedTrades: run.intendedTrades ?? [],
          hurdleRateBps: run.hurdleRateBps,
          holdingPeriod: run.holdingPeriod,
          instrumentPreference: run.instrumentPreference,
          catalystDeadlineAt: run.catalystDeadlineAt,
          liquidityFloorAdvUsd: run.liquidityFloorAdvUsd,
          maxSingleNamePct: run.maxSingleNamePct,
          invalidationRule: run.invalidationRule,
          mandateVersion: run.mandateVersion,
          status: "queued",
          createdAt: now,
        });
        const retryRunId = (result as any).insertId as number;
        const retryInput = {
          thesisId: run.thesisId,
          accountId: run.accountId ?? undefined,
          deployableCapitalCents: run.deployableCapitalCents,
          intendedTrades: (run.intendedTrades ?? []) as Array<{ symbol: string; dollarsCents: number; note?: string }> ,
          hurdleRateBps: run.hurdleRateBps ?? undefined,
          holdingPeriod: run.holdingPeriod ?? undefined,
          instrumentPreference: run.instrumentPreference ?? undefined,
          liquidityFloorAdvUsd: run.liquidityFloorAdvUsd ?? undefined,
          catalystDeadlineAt: run.catalystDeadlineAt ?? undefined,
          maxSingleNamePct: run.maxSingleNamePct ?? undefined,
          invalidationRule: run.invalidationRule ?? undefined,
        };
        executeRun(retryRunId, ctx.user.id, thesis, retryInput).catch((error) => {
          console.error(`[aperture] retry run ${retryRunId} failed:`, error?.message ?? error);
        });
        return { runId: retryRunId };
      }),

    /** Advance only to the next deferred evidence batch. Never creates an order. */
    followUp: capitalOperatorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const [run] = await db!.select().from(apertureRuns)
          .where(and(eq(apertureRuns.id, input.id), eq(apertureRuns.userId, ctx.user.id))).limit(1);
        if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
        if (run.status !== "completed" || !/deferred/i.test(run.droppedNote ?? "")) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This completed brief has no deferred research batch to continue." });
        }
        const thesis = await requireThesis(db, run.thesisId, ctx.user.id);
        if (!thesis.graph) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This thesis needs to be prepared before follow-up research can run." });
        const offset = nextFollowUpOffset(run);
        const now = Date.now();
        const [result] = await db!.insert(apertureRuns).values({
          userId: ctx.user.id, thesisId: run.thesisId, accountId: run.accountId,
          deployableCapitalCents: run.deployableCapitalCents, intendedTrades: run.intendedTrades ?? [],
          hurdleRateBps: run.hurdleRateBps, holdingPeriod: run.holdingPeriod,
          instrumentPreference: run.instrumentPreference,
          liquidityFloorAdvUsd: run.liquidityFloorAdvUsd, catalystDeadlineAt: run.catalystDeadlineAt,
          maxSingleNamePct: run.maxSingleNamePct, invalidationRule: run.invalidationRule,
          mandateVersion: run.mandateVersion, status: "queued", createdAt: now,
          droppedNote: `Follow-up research from run #${run.id}; research offset ${offset}.`,
        });
        const followUpRunId = (result as any).insertId as number;
        executeRun(followUpRunId, ctx.user.id, thesis, {
          thesisId: run.thesisId, accountId: run.accountId ?? undefined,
          deployableCapitalCents: run.deployableCapitalCents, intendedTrades: (run.intendedTrades ?? []) as Array<{ symbol: string; dollarsCents: number; note?: string }>,
          hurdleRateBps: run.hurdleRateBps ?? undefined, holdingPeriod: run.holdingPeriod ?? undefined,
          instrumentPreference: run.instrumentPreference ?? undefined,
          liquidityFloorAdvUsd: run.liquidityFloorAdvUsd ?? undefined, catalystDeadlineAt: run.catalystDeadlineAt ?? undefined,
          maxSingleNamePct: run.maxSingleNamePct ?? undefined, invalidationRule: run.invalidationRule ?? undefined,
          researchOffset: offset, followUpFromRunId: run.id,
        }).catch((error) => console.error(`[aperture] follow-up run ${followUpRunId} failed:`, error?.message ?? error));
        return { runId: followUpRunId, offset };
      }),

    /**
     * Short-Horizon Paper Run. The five preset fields are required because they
     * ARE the mandate — a run that does not state its holding period, liquidity
     * floor, catalyst deadline, concentration cap and invalidation rule has no
     * standard to be judged against, and every order under it would inherit that
     * silence. Presence is checked here; the values are checked against
     * MANDATE_V1 by evaluateRunPreset, which is where "may tighten, never
     * loosen" is enforced.
     */
    start: capitalOperatorProcedure
      .input(z.object({
        thesisId: z.number(),
        accountId: z.number().optional(),
        deployableCapitalCents: z.number().min(1),
        intendedTrades: z.array(z.object({
          symbol: z.string(),
          dollarsCents: z.number(),
          note: z.string().optional(),
        })).default([]),
        hurdleRateBps: z.number().optional(),
        holdingPeriod: z.enum(HOLDING_PERIOD_KEYS as [string, ...string[]]),
        instrumentPreference: z.enum(["shares", "options", "either"]).default("either"),
        liquidityFloorAdvUsd: z.number().positive(),
        catalystDeadlineAt: z.number(),
        maxSingleNamePct: z.number().positive(),
        invalidationRule: z.string().min(MIN_NARRATIVE_CHARS),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        let thesis = await requireThesis(db, input.thesisId, ctx.user.id);
        // A graph is an implementation detail, not an operator task. Prepare a
        // saved thesis at the moment it is needed, then persist the result so the
        // next brief is immediate. The operator's job is to state a belief, not
        // to understand compilation or a second internal workflow.
        if (!thesis.graph) {
          try {
            thesis = await ensureThesisReady(thesis, {
              compile: compileThesis,
              persist: async ({ graph, confidenceNotes }) => {
                await db!.update(capitalTheses)
                  .set({ graph, confidenceNotes, status: "review", updatedAt: Date.now() })
                  .where(eq(capitalTheses.id, thesis.id));
              },
            });
          } catch (error: any) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: `This saved thesis needs a little more detail before Aperture can frame a brief: ${error?.message ?? "add the belief, time horizon, and what you want to learn."}`,
            });
          }
        }

        const readiness = evaluateThesisResearchReadiness(thesis.graph as ThesisGraph, {
          holdingPeriod: input.holdingPeriod as any,
          instrumentPreference: input.instrumentPreference,
          invalidationRule: input.invalidationRule,
        });
        if (!readiness.ready) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Complete the thesis structure before research: ${[...readiness.missing, ...readiness.incompatibilities].join("; ")}. No run was created.`,
          });
        }

        const now = Date.now();
        const account = input.accountId
          ? await requireAccount(db, input.accountId, ctx.user.id)
          : null;

        const preset = evaluateRunPreset(
          {
            holdingPeriod: input.holdingPeriod,
            liquidityFloorAdvUsd: input.liquidityFloorAdvUsd,
            catalystDeadlineAt: input.catalystDeadlineAt,
            maxSingleNamePct: input.maxSingleNamePct,
            invalidationRule: input.invalidationRule,
            deployableCapitalCents: input.deployableCapitalCents,
          },
          { accountLinked: account != null, equityCents: account?.equityValueCents ?? null },
          CURRENT_MANDATE,
          now,
        );
        if (!preset.passed) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `run preset rejected by the mandate: ${preset.failures.join("; ")}`,
          });
        }

        const [result] = await db!.insert(apertureRuns).values({
          userId: ctx.user.id,
          thesisId: input.thesisId,
          accountId: input.accountId ?? null,
          deployableCapitalCents: input.deployableCapitalCents,
          intendedTrades: input.intendedTrades,
          hurdleRateBps: input.hurdleRateBps ?? null,
          holdingPeriod: input.holdingPeriod as any,
          instrumentPreference: input.instrumentPreference,
          catalystDeadlineAt: input.catalystDeadlineAt,
          liquidityFloorAdvUsd: Math.round(input.liquidityFloorAdvUsd),
          maxSingleNamePct: input.maxSingleNamePct,
          invalidationRule: input.invalidationRule,
          mandateVersion: preset.mandateVersion,
          status: "queued",
          createdAt: now,
        });
        const runId = (result as any).insertId as number;

        // Run async — do not await. The client polls status.
        executeRun(runId, ctx.user.id, thesis, input).catch((e) => {
          console.error(`[aperture] run ${runId} failed:`, e?.message ?? e);
        });

        return { runId };
      }),
  }),

  // ── Candidate memo generation ──────────────────────────────────────────────

  generateMemo: capitalOperatorProcedure
    .input(z.object({
      runId: z.number(),
      candidateId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [run] = await db!.select().from(apertureRuns)
        .where(and(eq(apertureRuns.id, input.runId), eq(apertureRuns.userId, ctx.user.id)))
        .limit(1);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });

      const [candidate] = await db!.select().from(apertureCandidates)
        .where(and(eq(apertureCandidates.id, input.candidateId), eq(apertureCandidates.runId, input.runId)))
        .limit(1);
      if (!candidate) throw new TRPCError({ code: "NOT_FOUND", message: "Candidate not found" });

      const thesis = await requireThesis(db, run.thesisId, ctx.user.id);
      if (!thesis.graph) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Thesis has no compiled graph" });

      const allFacts = await getFacts(candidate.symbol);
      const facts = freshestPerKey(allFacts);

      // Holdings for context
      const holdingSymbols = input.runId && run.accountId
        ? (await db!.select({ symbol: positions.symbol }).from(positions)
            .where(eq(positions.accountId, run.accountId))).map((p) => p.symbol)
        : [];

      const memoResult = await generateMemo(candidate.symbol, facts, thesis.graph as any, holdingSymbols, { retryOnReject: true });

      await db!.update(apertureCandidates).set({
        memo: memoResult.memo,
        memoStatus: memoResult.status,
        memoRejectReason: memoResult.rejectReason ?? null,
        citations: memoResult.citations,
      }).where(eq(apertureCandidates.id, input.candidateId));

    return memoResult;
    }),

  // ── Daily trader plays ─────────────────────────────────────────────────────
  // This is a read model over completed short-horizon runs. It starts no
  // research, alters no thesis, and never reaches the broker adapter.
  play: router({
    list: capitalOperatorProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const now = Date.now();
      const [profile] = await db!.select({ activeCapitalThesisId: users.activeCapitalThesisId })
        .from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const activeCapitalThesisId = profile?.activeCapitalThesisId ?? null;
      const [activeCanonicalThesis] = activeCapitalThesisId == null ? [undefined] : await db!.select({
        id: thesisCompilations.id,
        name: thesisCompilations.name,
      }).from(thesisCompilations).where(eq(thesisCompilations.id, activeCapitalThesisId)).limit(1);
      const activeProjectionRows = activeCapitalThesisId == null ? [] : await db!.select({ id: capitalTheses.id })
        .from(capitalTheses).where(and(eq(capitalTheses.userId, ctx.user.id), eq(capitalTheses.sourceCompilationId, activeCapitalThesisId)));
      const activeProjectionIds = activeProjectionRows.map((row) => row.id);
      const activeRunFilter = activeCapitalThesisId == null ? undefined : activeProjectionIds.length ? inArray(apertureRuns.thesisId, activeProjectionIds) : sql`0 = 1`;
      const rows = await db!.select({ candidate: apertureCandidates, run: apertureRuns, thesisName: capitalTheses.name, thesisRawText: capitalTheses.rawText })
        .from(apertureCandidates)
        .innerJoin(apertureRuns, eq(apertureCandidates.runId, apertureRuns.id))
        .leftJoin(capitalTheses, eq(apertureRuns.thesisId, capitalTheses.id))
        .where(and(
          eq(apertureRuns.userId, ctx.user.id),
          eq(apertureRuns.status, "completed"),
          inArray(apertureRuns.holdingPeriod, ["intraday", "catalyst_window"]),
          gte(apertureRuns.catalystDeadlineAt, now),
          ...(activeRunFilter ? [activeRunFilter] : []),
        ))
        .orderBy(apertureRuns.catalystDeadlineAt, desc(apertureRuns.createdAt))
        .limit(40);
      const expiredRows = await db!.select({ id: apertureCandidates.id })
        .from(apertureCandidates)
        .innerJoin(apertureRuns, eq(apertureCandidates.runId, apertureRuns.id))
        .where(and(
          eq(apertureRuns.userId, ctx.user.id),
          eq(apertureRuns.status, "completed"),
          inArray(apertureRuns.holdingPeriod, ["intraday", "catalyst_window"]),
          lt(apertureRuns.catalystDeadlineAt, now),
          ...(activeRunFilter ? [activeRunFilter] : []),
        ));
      const candidateIds = rows.map(({ candidate }) => candidate.id);
      const reviews = candidateIds.length
        ? await db!.select().from(apertureEvidenceReviews).where(and(eq(apertureEvidenceReviews.userId, ctx.user.id), inArray(apertureEvidenceReviews.candidateId, candidateIds)))
        : [];
      const decisions = candidateIds.length
        ? await db!.select().from(aperturePlayDecisions).where(and(eq(aperturePlayDecisions.userId, ctx.user.id), inArray(aperturePlayDecisions.candidateId, candidateIds)))
        : [];
      const activeOrderRows = candidateIds.length
        ? await db!.select({
            candidateId: brokerOrders.candidateId,
            status: brokerOrders.status,
            intent: brokerOrders.intent,
            qty: brokerOrders.qty,
            filledQty: brokerOrders.filledQty,
          }).from(brokerOrders).where(and(
            eq(brokerOrders.userId, ctx.user.id),
            inArray(brokerOrders.candidateId, candidateIds),
            inArray(brokerOrders.status, ["pending_approval", "approved", "submitted", "filled"]),
          ))
        : [];
      const inMotionCandidateIds = new Set<number>();
      const filledQtyByCandidate = new Map<number, number>();
      for (const order of activeOrderRows) {
        if (order.candidateId == null) continue;
        if (order.status !== "filled") {
          inMotionCandidateIds.add(order.candidateId);
          continue;
        }
        const quantity = Math.abs(order.filledQty ?? order.qty ?? 1);
        filledQtyByCandidate.set(
          order.candidateId,
          (filledQtyByCandidate.get(order.candidateId) ?? 0) + (order.intent === "close" ? -quantity : quantity),
        );
      }
      filledQtyByCandidate.forEach((netQty, candidateId) => {
        if (netQty > 0) inMotionCandidateIds.add(candidateId);
      });
      const researchRunIds = Array.from(new Set(rows.map(({ run }) => run.id)));
      const decisionRuns = researchRunIds.length
        ? await db!.select().from(apertureDecisionRuns).where(and(
            eq(apertureDecisionRuns.userId, ctx.user.id),
            inArray(apertureDecisionRuns.researchRunId, researchRunIds),
          ))
        : [];
      const revisionIds = decisionRuns.flatMap((run) => run.currentRevisionId == null ? [] : [run.currentRevisionId]);
      const decisionRevisions = revisionIds.length
        ? await db!.select().from(apertureDecisionRevisions).where(inArray(apertureDecisionRevisions.id, revisionIds))
        : [];
      const revisionById = new Map(decisionRevisions.map((revision) => [revision.id, revision]));
      const decisionByResearchRun = new Map(decisionRuns.map((decisionRun) => [decisionRun.researchRunId, {
        run: decisionRun,
        revision: decisionRun.currentRevisionId == null ? null : revisionById.get(decisionRun.currentRevisionId) ?? null,
      }]));
      const reviewsByCandidate = new Map<number, typeof reviews>();
      for (const review of reviews) reviewsByCandidate.set(review.candidateId, [...(reviewsByCandidate.get(review.candidateId) ?? []), review]);
      // Skip retires the current play. Defer is a next-regular-session pause;
      // legacy null-resume defers are deliberately resurfaced rather than hidden
      // forever by a rule that did not exist when they were recorded.
      const decisionByCandidate = new Map(decisions
        .filter((decision) => decision.decision === "skipped" || (decision.resumeAt != null && decision.resumeAt > now))
        .map((decision) => [decision.candidateId, decision]));
      return {
        activeCanonicalThesisId: activeCapitalThesisId,
        activeCanonicalThesis: activeCanonicalThesis ?? null,
        expiredPlayCount: expiredRows.length,
        inMotionPlayCount: inMotionCandidateIds.size,
        plays: rows.filter(({ candidate }) => !inMotionCandidateIds.has(candidate.id)).map(({ candidate, run, thesisName, thesisRawText }) => {
          const authority = decisionByResearchRun.get(run.id);
          const revision = authority?.revision ?? null;
          return {
            candidate,
            run,
            thesisName,
            thesisRawText,
            reviews: reviewsByCandidate.get(candidate.id) ?? [],
            decision: decisionByCandidate.get(candidate.id) ?? null,
            decisionAuthority: authority && revision ? "authoritative" as const : "unbound" as const,
            decisionBranch: revision?.effectiveBranch ?? null,
            decisionReason: revision?.reason ?? null,
            decisionBlocker: revision?.blocker ?? null,
            decisionReopenCondition: revision?.reopenCondition ?? null,
            evidenceSummary: normalizeStringList(candidate.verifyFields).length
              ? `${normalizeStringList(candidate.verifyFields).length} decision-critical evidence check${normalizeStringList(candidate.verifyFields).length === 1 ? " remains" : "s remain"}.`
              : "No decision-critical evidence field was generated; current market conditions still require human confirmation.",
          };
        }),
      };
    }),

    trigger: capitalOperatorProcedure
      .input(z.object({ runId: z.number(), candidateId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        const [row] = await db!.select({ candidate: apertureCandidates, run: apertureRuns })
          .from(apertureCandidates)
          .innerJoin(apertureRuns, eq(apertureCandidates.runId, apertureRuns.id))
          .where(and(
            eq(apertureCandidates.id, input.candidateId),
            eq(apertureCandidates.runId, input.runId),
            eq(apertureRuns.userId, ctx.user.id),
          )).limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Play not found in your research history" });
        if (row.run.holdingPeriod !== "intraday") {
          return { applicable: false, state: "not_applicable" as const, basis: "VWAP hold is only evaluated for intraday plays.", vwap: null, openingRange: null };
        }
        const now = Date.now();
        const dayStart = startOfEtDay(now);
        if (dayStart == null) {
          return { applicable: true, state: "unknown" as const, basis: "The ET session day could not be determined, so no intraday trigger can be measured.", vwap: null, openingRange: null };
        }
        const tape = await fetchIntradayBars(row.candidate.symbol, { startMs: dayStart, timeoutMs: 4_000, maxPages: 1 });
        const vwap = sessionVwap(tape.bars, { feed: tape.feed, now });
        const range = openingRange(tape.bars, { sessionOpenAt: dayStart + REGULAR_OPEN * 60_000, minutes: 30, feed: tape.feed, now });
        const playSide = row.candidate.playSide ?? "long";
        const triggerSide = playSide === "long" ? "above" : "below";
        const sideBasis = row.candidate.playSide
          ? `candidate direction is explicitly modelled as ${playSide}`
          : "candidate direction is not modelled; long is an explicit recipe assumption until a direction is recorded";
        const hold = checkVwapHold(tape.bars, vwap, { side: triggerSide, minutesRequired: 15, now });
        return {
          applicable: true,
          state: hold.state,
          basis: `${tape.unavailableReason ?? hold.basis} · ${sideBasis}`,
          playSide,
          sideBasis,
          triggerSide,
          vwap: { value: hold.vwap, lastPrice: hold.lastPrice, feed: hold.feed, lagMs: hold.lagMs, needsOperatorConfirmation: hold.needsOperatorConfirmation },
          openingRange: { high: range.high, low: range.low, widthPct: range.widthPct, complete: range.complete, feed: range.feed, lagMs: range.lagMs, unavailableReason: range.unavailableReason },
        };
      }),

    construct: capitalOperatorProcedure
      .input(z.object({ runId: z.number(), candidateId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        const [row] = await db!.select({ candidate: apertureCandidates, run: apertureRuns })
          .from(apertureCandidates)
          .innerJoin(apertureRuns, eq(apertureCandidates.runId, apertureRuns.id))
          .where(and(
            eq(apertureCandidates.id, input.candidateId),
            eq(apertureCandidates.runId, input.runId),
            eq(apertureRuns.userId, ctx.user.id),
          )).limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Play not found in your research history" });

        const illustrativeFixtureRecipe = isExactIsolatedUatRuntime()
          && ctx.user.openId === "uat_jim_9c18799"
          && row.run.droppedNote === "ILLUSTRATIVE_UAT_QUALIFIED_PLAY_ZERO_NETWORK_NOT_CURRENT_MARKET_DATA";
        if (illustrativeFixtureRecipe) {
          const isLead = row.candidate.symbol === "UATQ";
          return {
            play: {
              symbol: row.candidate.symbol, side: "long" as const, holdingPeriod: "intraday" as const,
              taxonomy: { marketPlay: { specificPlay: isLead ? "illustrative catalyst review" : "conditional alternative review", basis: "Illustrative UAT fixture — not current market data." }, execution: { direction: "long", strategy: "human-reviewed paper plan", instrument: "shares" }, horizon: { label: "Same-session human review", basis: "Modeled UAT horizon; no current market claim." }, signals: [{ label: "Named catalyst evidence", status: "unknown" }] },
              readiness: "constructed" as const,
              entry: { priceCents: isLead ? 2500 : 1800, modeled: true as const, basis: "Modeled illustrative level; not a quote or current market price." },
              stop: { priceCents: isLead ? 2425 : 1746, modeled: true as const, basis: "Modeled risk boundary for UAT review only." },
              slippage: { priceCents: 2, modeled: true as const, basis: "Illustrative slippage assumption." },
              targets: [{ priceCents: isLead ? 2615 : 1890, modeled: true as const, rMultiple: 1.5, basis: "Modeled R-multiple illustration; not a return promise." }],
              budgetCents: 15000, qty: isLead ? 55 : 45, notionalCents: isLead ? 137500 : 81000, plannedLossCents: isLead ? 4235 : 2520, plannedLossPctOfEquity: isLead ? 0.042 : 0.025, sizeLimitedByNotionalCeiling: false, timeStopAt: null,
              noTradeConditions: ["Do not take this illustrative recipe unless the named catalyst evidence is independently confirmed.", "No current quote, tape, or provider fact was requested or supplied."],
              trigger: { state: "unknown", basis: "Illustrative UAT fixture — live trigger observation intentionally unavailable.", vwap: null, lastPrice: null, feed: "unknown", lagMs: null, needsOperatorConfirmation: true },
              tapeBasis: "Illustrative UAT fixture — not current market data; zero network provider calls.", feed: "unknown" as const,
              unavailableReasons: ["Current tape and live pricing are intentionally unavailable in this isolated fixture."],
              assumptions: ["Named values are modeled for a UAT review path only.", "No return, fill, or current-price outcome is represented."],
            },
            disclosure: "Illustrative UAT fixture — not current market data. This paper-review surface cannot create, approve, or submit an order.",
          };
        }

        const accounts = await db!.select().from(portfolioAccounts).where(eq(portfolioAccounts.userId, ctx.user.id));
        const account = row.run.accountId
          ? accounts.find((item) => item.id === row.run.accountId) ?? null
          : accounts.find((item) => item.isPaper && item.brokerId === "alpaca_paper")
            ?? accounts.find((item) => item.isPaper)
            ?? null;
        const now = Date.now();
        const [decisionAuthority] = await db!.select({ revision: apertureDecisionRevisions })
          .from(apertureDecisionRuns)
          .innerJoin(apertureDecisionRevisions, and(
            eq(apertureDecisionRevisions.id, apertureDecisionRuns.currentRevisionId),
            eq(apertureDecisionRevisions.decisionRunId, apertureDecisionRuns.id),
          ))
          .where(and(
            eq(apertureDecisionRuns.userId, ctx.user.id),
            eq(apertureDecisionRuns.researchRunId, row.run.id),
          )).limit(1);
        const queueAtOpenRequested = requestsQueueAtOpen(decisionAuthority?.revision);
        const sessionDayStartMs = startOfEtDay(now);
        const tape = queueAtOpenRequested || sessionDayStartMs == null
          ? { bars: [], feed: "unknown" as const, unavailableReason: "the ET session day could not be determined, so no minute tape was requested" }
          : await fetchIntradayBars(row.candidate.symbol, { startMs: sessionDayStartMs, timeoutMs: 4_000, maxPages: 1 });
        const vwap = sessionVwap(tape.bars, { feed: tape.feed, now });
        const range = openingRange(tape.bars, {
          sessionOpenAt: (sessionDayStartMs ?? now) + REGULAR_OPEN * 60_000,
          minutes: 30,
          feed: tape.feed,
          now,
        });
        const side = row.candidate.playSide ?? "long";
        const trigger = checkVwapHold(tape.bars, vwap, { side: side === "long" ? "above" : "below", minutesRequired: 15, now });
        const facts = await getFacts(row.candidate.symbol, now);
        const advUsd = facts.find((fact) => fact.factKey === "adv_usd_30d" && fact.valueNum != null)?.valueNum ?? null;
        const lastPriceFact = facts.find((fact) => fact.factKey === "last_price" && fact.basis === "verified" && fact.valueNum != null) ?? null;
        const queueAtOpen = queueAtOpenRequested && decisionAuthority?.revision && lastPriceFact?.valueNum != null
          ? {
            referencePriceCents: Math.round(lastPriceFact.valueNum * 100),
            referenceAsOf: lastPriceFact.asOf ?? lastPriceFact.fetchedAt,
            referenceExpiresAt: lastPriceFact.expiresAt,
            sourceName: lastPriceFact.sourceName ?? lastPriceFact.providerId,
            maxNotionalCents: decisionAuthority.revision.deployableCapitalCents,
            maxPlannedLossCents: decisionAuthority.revision.maxPlannedLossCents,
            slippageCents: 3,
            timeStopAt: decisionAuthority.revision.reviewAt ?? row.run.catalystDeadlineAt ?? now,
          }
          : queueAtOpenRequested
            ? {
              referencePriceCents: 0,
              referenceAsOf: 0,
              referenceExpiresAt: null,
              sourceName: "verified market-data source",
              maxNotionalCents: decisionAuthority?.revision.deployableCapitalCents ?? row.run.deployableCapitalCents,
              maxPlannedLossCents: decisionAuthority?.revision.maxPlannedLossCents ?? 0,
              slippageCents: 3,
              timeStopAt: decisionAuthority?.revision.reviewAt ?? row.run.catalystDeadlineAt ?? now,
            }
            : null;
        const play = constructPlay({
          symbol: row.candidate.symbol,
          side,
          holdingPeriod: row.run.holdingPeriod as any,
          instrumentPreference: row.run.instrumentPreference,
          bars: tape.bars,
          vwap,
          range,
          trigger,
          equityCents: account?.equityValueCents ?? null,
          sessionDayStartMs,
          catalystDeadlineAt: row.run.catalystDeadlineAt,
          advUsd,
          queueAtOpen,
          now,
        });
        const sideAssumption = row.candidate.playSide == null
          ? "direction was not modelled on this legacy candidate; this recipe assumes a long setup until an operator records otherwise"
          : null;
        return {
          play: {
            ...play,
            assumptions: sideAssumption ? [sideAssumption, ...play.assumptions] : play.assumptions,
            unavailableReasons: !queueAtOpenRequested && tape.unavailableReason ? [tape.unavailableReason, ...play.unavailableReasons] : play.unavailableReasons,
          },
          disclosure: queueAtOpenRequested ? QUEUE_AT_OPEN_PLAY_DISCLOSURE : CONSTRUCTED_PLAY_DISCLOSURE,
        };
      }),

    decide: capitalOperatorProcedure
      .input(z.object({ runId: z.number(), candidateId: z.number(), decision: z.enum(["skipped", "deferred"]), reason: z.string().trim().min(3).max(1_000) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const [row] = await db!.select({ candidate: apertureCandidates })
          .from(apertureCandidates)
          .innerJoin(apertureRuns, eq(apertureCandidates.runId, apertureRuns.id))
          .where(and(eq(apertureCandidates.id, input.candidateId), eq(apertureCandidates.runId, input.runId), eq(apertureRuns.userId, ctx.user.id)))
          .limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Play not found in your research history" });
        const now = Date.now();
        const [existing] = await db!.select().from(aperturePlayDecisions).where(and(
          eq(aperturePlayDecisions.userId, ctx.user.id),
          eq(aperturePlayDecisions.runId, input.runId),
          eq(aperturePlayDecisions.candidateId, input.candidateId),
        )).limit(1);
        const resumeAt = input.decision === "deferred" ? nextRegularSessionOpen(now) : null;
        if (input.decision === "deferred" && resumeAt == null) throw new TRPCError({ code: "BAD_REQUEST", message: "The next regular session cannot be determined; defer was not recorded." });
        if (existing) {
          await db!.update(aperturePlayDecisions).set({ decision: input.decision, reason: input.reason, resumeAt, updatedAt: now })
            .where(eq(aperturePlayDecisions.id, existing.id));
        } else {
          await db!.insert(aperturePlayDecisions).values({ userId: ctx.user.id, ...input, resumeAt, createdAt: now, updatedAt: now });
        }
        const ledger = await syncCapturedPlayDecision({
          db: db!,
          userId: ctx.user.id,
          runId: input.runId,
          candidateId: input.candidateId,
          decision: input.decision,
          reason: input.reason,
          decidedAt: now,
        });
        return { ok: true, ledger };
      }),
  }),

  // ── Paper-play replay ledger ───────────────────────────────────────────────
  // Reconstructing a past run is explicitly marked historical. It is useful for
  // a postmortem, but cannot be represented as a live recommendation capture.
  ledger: router({
    list: capitalOperatorProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const slates = await db!.select().from(aperturePlaySlates)
        .where(eq(aperturePlaySlates.userId, ctx.user.id))
        .orderBy(desc(aperturePlaySlates.capturedAt));
      if (!slates.length) return [];
      const items = await db!.select().from(aperturePlaySlateItems)
        .where(inArray(aperturePlaySlateItems.slateId, slates.map((slate) => slate.id)))
        .orderBy(aperturePlaySlateItems.id);
      const itemsBySlate = new Map<number, typeof items>();
      for (const item of items) itemsBySlate.set(item.slateId, [...(itemsBySlate.get(item.slateId) ?? []), item]);
      const slateById = new Map(slates.map((slate) => [slate.id, slate]));
      const trustCalibration = buildTrustCalibration(items
        .filter((item) => slateById.get(item.slateId)?.snapshotBasis === "live_capture")
        .map((item) => ({
          conditionKey: item.conditionKey,
          result: item.outcomeResult,
          basis: item.outcomeBasis,
          countsTowardTrust: item.outcomeStatus === "resolved" && item.outcomeBasis === "verified",
        })));
      return slates.map((slate) => {
        const slateItems = itemsBySlate.get(slate.id) ?? [];
        const unresolved = slateItems.filter((item) => item.outcomeResult === "unresolved");
        const preOpenRecipeGap = unresolved.length > 0 && unresolved.every((item) =>
          item.outcomeExplanation?.includes("session has not opened yet") || item.outcomeExplanation?.includes("no minute bars for this session"),
        );
        return {
          ...slate,
          items: slateItems,
          trustCalibration,
          postmortemFinding: preOpenRecipeGap
            ? "This cohort completed before the regular session produced an opening range. It tests thesis generation, not an executable day-trade recipe; capture a named post-open decision window before measuring play quality."
            : null,
        };
      });
    }),

    portfolioImpactTrend: capitalOperatorProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const slates = await db!.select().from(aperturePlaySlates)
        .where(eq(aperturePlaySlates.userId, ctx.user.id));
      if (!slates.length) return buildPortfolioImpactTrend([]);
      const items = await db!.select().from(aperturePlaySlateItems)
        .where(inArray(aperturePlaySlateItems.slateId, slates.map((slate) => slate.id)));
      const slateById = new Map(slates.map((slate) => [slate.id, slate]));
      const rows: PortfolioImpactTrendRow[] = items.flatMap((item) => {
        const slate = slateById.get(item.slateId);
        if (!slate) return [];
        const snapshot = item.recommendationSnapshot as { play?: unknown } | null;
        const sourcePlay = snapshot?.play as Record<string, unknown> | undefined;
        const side: "long" | "short" | null = sourcePlay?.side === "short" ? "short" : sourcePlay?.side === "long" ? "long" : null;
        const numberOrNull = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
        const play = side
          ? {
              side,
              qty: numberOrNull(sourcePlay?.qty),
              notionalCents: numberOrNull(sourcePlay?.notionalCents),
              plannedLossCents: numberOrNull(sourcePlay?.plannedLossCents),
            }
          : null;
        return [{
          slateId: slate.id,
          snapshotBasis: slate.snapshotBasis,
          slateStatus: slate.status,
          itemDecision: item.operatorDecision,
          outcomeStatus: item.outcomeStatus,
          outcomeResult: item.outcomeResult,
          outcomeBasis: item.outcomeBasis,
          entryPriceCents: item.entryPriceCents,
          settlementPriceCents: item.settlementPriceCents,
          play,
        }];
      });
      return buildPortfolioImpactTrend(rows);
    }),

    dailyRefreshSchedule: capitalOperatorProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const [profile] = await db!.select({
        enabled: users.dailyOutcomeRefreshEnabled,
        taskUid: users.dailyOutcomeRefreshTaskUid,
        lastRunAt: users.dailyOutcomeRefreshLastRunAt,
        lastResult: users.dailyOutcomeRefreshLastResult,
      }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      return {
        enabled: profile?.enabled === true,
        configured: Boolean(profile?.taskUid),
        lastRunAt: profile?.lastRunAt ?? null,
        lastResult: profile?.lastResult ?? null,
        cadence: "Daily after the US regular-session close; only live paper captures are eligible.",
      };
    }),

    configureDailyRefresh: capitalOperatorProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const [profile] = await db!.select({ taskUid: users.dailyOutcomeRefreshTaskUid })
          .from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const rawCookie = typeof ctx.req.headers.cookie === "string" ? ctx.req.headers.cookie : "";
        const sessionToken = readSessionCookie(rawCookie) ?? "";
        if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Your session could not be verified for the daily refresh schedule." });
        let taskUid = profile?.taskUid ?? null;
        let nextExecutionAt: string | null | undefined;
        if (!taskUid) {
          if (!input.enabled) {
            await db!.update(users).set({ dailyOutcomeRefreshEnabled: false }).where(eq(users.id, ctx.user.id));
            return { enabled: false, configured: false, nextExecutionAt: null };
          }
          const created = await createHeartbeatJob({
            name: `capital-daily-outcome-refresh-${ctx.user.id}`,
            cron: DAILY_OUTCOME_REFRESH_CRON,
            path: DAILY_OUTCOME_REFRESH_PATH,
            payload: {},
            description: "Refreshes due live Capital paper-play outcome records after their source session. Never creates broker orders.",
          }, sessionToken);
          taskUid = created.taskUid;
          nextExecutionAt = created.nextExecutionAt;
        } else {
          const updated = await updateHeartbeatJob(taskUid, { enable: input.enabled }, sessionToken);
          nextExecutionAt = updated.nextExecutionAt;
        }
        await db!.update(users).set({
          dailyOutcomeRefreshTaskUid: taskUid,
          dailyOutcomeRefreshEnabled: input.enabled,
        }).where(eq(users.id, ctx.user.id));
        return { enabled: input.enabled, configured: true, nextExecutionAt: nextExecutionAt ?? null };
      }),

    oneTimeResearchSchedule: capitalOperatorProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const [profile] = await db!.select({
        enabled: users.oneTimeResearchEnabled,
        taskUid: users.oneTimeResearchTaskUid,
        status: users.oneTimeResearchStatus,
        targetAt: users.oneTimeResearchTargetAt,
        canonicalThesisId: users.oneTimeResearchThesisId,
        runId: users.oneTimeResearchRunId,
        lastResult: users.oneTimeResearchLastResult,
      }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      return {
        enabled: profile?.enabled === true,
        configured: Boolean(profile?.taskUid),
        status: profile?.status ?? null,
        targetAt: profile?.targetAt ?? null,
        canonicalThesisId: profile?.canonicalThesisId ?? null,
        runId: profile?.runId ?? null,
        lastResult: profile?.lastResult ?? null,
        scope: "One paper-only post-open research brief. It cannot record a posture, create a proposal, or submit an order.",
      };
    }),

    configureOneTimeGlp1Research: capitalOperatorProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const [profile] = await db!.select({
          taskUid: users.oneTimeResearchTaskUid,
          activeCapitalThesisId: users.activeCapitalThesisId,
        }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const rawCookie = typeof ctx.req.headers.cookie === "string" ? ctx.req.headers.cookie : "";
        const sessionToken = readSessionCookie(rawCookie) ?? "";
        if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Your session could not be verified for the scheduled GLP-1 brief." });
        if (!input.enabled) {
          if (profile?.taskUid) await updateHeartbeatJob(profile.taskUid, { enable: false }, sessionToken);
          await db!.update(users).set({
            oneTimeResearchEnabled: false,
            oneTimeResearchStatus: "paused",
            oneTimeResearchLastResult: "Scheduled GLP-1 research is paused. No research brief was created.",
          }).where(eq(users.id, ctx.user.id));
          return { enabled: false, configured: Boolean(profile?.taskUid), targetAt: null };
        }
        if (!profile?.activeCapitalThesisId) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Choose the GLP-1 canonical thesis in the Decision Center before scheduling its research brief." });
        }
        const [projection] = await db!.select({ id: capitalTheses.id }).from(capitalTheses).where(and(
          eq(capitalTheses.userId, ctx.user.id),
          eq(capitalTheses.sourceCompilationId, profile.activeCapitalThesisId),
        )).limit(1);
        if (!projection) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The active canonical thesis is not available in Capital Aperture." });
        const nextOpen = nextRegularSessionOpen(Date.now());
        if (nextOpen == null) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The next regular market session is outside the maintained calendar, so research was not scheduled." });
        const targetAt = nextOpen + 30 * 60_000;
        const cron = oneTimeResearchCron(targetAt);
        let taskUid = profile.taskUid ?? null;
        let nextExecutionAt: string | null | undefined;
        if (!taskUid) {
          const created = await createHeartbeatJob({
            name: `capital-one-time-glp1-research-${ctx.user.id}-${targetAt}`,
            cron,
            path: ONE_TIME_GLP1_RESEARCH_PATH,
            payload: {},
            description: "One post-open GLP-1 Capital research brief. Research only; never records a posture, proposal, or broker order.",
          }, sessionToken);
          taskUid = created.taskUid;
          nextExecutionAt = created.nextExecutionAt;
        } else {
          const updated = await updateHeartbeatJob(taskUid, { cron, enable: true }, sessionToken);
          nextExecutionAt = updated.nextExecutionAt;
        }
        await db!.update(users).set({
          oneTimeResearchTaskUid: taskUid,
          oneTimeResearchEnabled: true,
          oneTimeResearchStatus: "queued",
          oneTimeResearchTargetAt: targetAt,
          oneTimeResearchThesisId: profile.activeCapitalThesisId,
          oneTimeResearchRunId: null,
          oneTimeResearchLastResult: "Queued for the first measurable post-open window. The resulting opportunity set will require a human paper-posture decision.",
        }).where(eq(users.id, ctx.user.id));
        return { enabled: true, configured: true, targetAt, nextExecutionAt: nextExecutionAt ?? null };
      }),

    availableCohorts: capitalOperatorProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const rows = await db!.select({ run: apertureRuns, thesisName: capitalTheses.name, canonicalThesisId: capitalTheses.sourceCompilationId })
        .from(apertureRuns)
        .leftJoin(capitalTheses, eq(apertureRuns.thesisId, capitalTheses.id))
        .where(and(
          eq(apertureRuns.userId, ctx.user.id),
          eq(apertureRuns.status, "completed"),
          inArray(apertureRuns.holdingPeriod, ["intraday", "catalyst_window"]),
        ))
        .orderBy(desc(apertureRuns.completedAt), desc(apertureRuns.createdAt))
        .limit(12);
      return rows.map(({ run, thesisName, canonicalThesisId }) => ({
        id: run.id,
        holdingPeriod: run.holdingPeriod,
        candidateCount: run.candidateCount,
        completedAt: run.completedAt,
        createdAt: run.createdAt,
        catalystDeadlineAt: run.catalystDeadlineAt,
        thesisName: thesisName ?? "Capital thesis",
        canonicalThesisId,
      }));
    }),

    captureCurrentWindow: capitalOperatorProcedure
      .input(z.object({ windowKey: z.string().trim().min(2).max(64) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const now = Date.now();
        const sessionStartAt = startOfEtDay(now);
        const sessionDateEt = etClock(now)?.dateEt;
        if (sessionStartAt == null || sessionDateEt == null) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "The current ET session cannot be determined, so no live slate was captured." });
        }
        const [profile] = await db!.select({ activeCapitalThesisId: users.activeCapitalThesisId })
          .from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const canonicalThesisId = profile?.activeCapitalThesisId ?? null;
        if (canonicalThesisId == null) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an active Capital thesis before capturing a decision window." });
        }
        const projectionRows = await db!.select({ id: capitalTheses.id, name: capitalTheses.name })
          .from(capitalTheses).where(and(eq(capitalTheses.userId, ctx.user.id), eq(capitalTheses.sourceCompilationId, canonicalThesisId)));
        if (!projectionRows.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "The active canonical thesis has no Capital projection yet, so no daily slate can be captured." });
        }
        const [existing] = await db!.select().from(aperturePlaySlates).where(and(
          eq(aperturePlaySlates.userId, ctx.user.id),
          eq(aperturePlaySlates.canonicalThesisId, canonicalThesisId),
          eq(aperturePlaySlates.sessionDateEt, sessionDateEt),
          eq(aperturePlaySlates.windowKey, input.windowKey),
        )).limit(1);
        if (existing) return { slateId: existing.id, created: false };

        const projectionIds = projectionRows.map((projection) => projection.id);
        const rows = await db!.select({ candidate: apertureCandidates, run: apertureRuns })
          .from(apertureCandidates)
          .innerJoin(apertureRuns, eq(apertureCandidates.runId, apertureRuns.id))
          .where(and(
            eq(apertureRuns.userId, ctx.user.id),
            eq(apertureRuns.status, "completed"),
            inArray(apertureRuns.thesisId, projectionIds),
            inArray(apertureRuns.holdingPeriod, ["intraday", "catalyst_window"]),
            gte(apertureRuns.catalystDeadlineAt, now),
          ))
          .orderBy(apertureRuns.catalystDeadlineAt, desc(apertureRuns.createdAt))
          .limit(40);
        const sessionRows = rows.filter(({ run }) => etClock(run.catalystDeadlineAt ?? 0)?.dateEt === sessionDateEt);
        if (!sessionRows.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "There are no Capital plays whose declared decision window falls in today's ET session. Future catalyst plays remain visible but cannot capture today's tape." });
        }
        const accounts = await db!.select().from(portfolioAccounts).where(eq(portfolioAccounts.userId, ctx.user.id));
        const account = accounts.find((item) => item.isPaper && item.brokerId === "alpaca_paper") ?? accounts.find((item) => item.isPaper) ?? null;
        const held = account ? await db!.select().from(positions).where(eq(positions.accountId, account.id)) : [];
        const candidateIds = sessionRows.map(({ candidate }) => candidate.id);
        const reviews = await db!.select().from(apertureEvidenceReviews).where(and(
          eq(apertureEvidenceReviews.userId, ctx.user.id),
          inArray(apertureEvidenceReviews.candidateId, candidateIds),
        ));
        const decisions = await db!.select().from(aperturePlayDecisions).where(and(
          eq(aperturePlayDecisions.userId, ctx.user.id),
          inArray(aperturePlayDecisions.candidateId, candidateIds),
        ));
        const reviewsByCandidate = new Map<number, typeof reviews>();
        for (const review of reviews) reviewsByCandidate.set(review.candidateId, [...(reviewsByCandidate.get(review.candidateId) ?? []), review]);
        const decisionByCandidate = new Map(decisions.map((decision) => [decision.candidateId, decision]));

        const items = await Promise.all(sessionRows.map(async ({ candidate, run }) => {
          const tape = await fetchIntradayBars(candidate.symbol, { startMs: sessionStartAt, timeoutMs: 5_000, maxPages: 2 });
          const vwap = sessionVwap(tape.bars, { feed: tape.feed, now });
          const range = openingRange(tape.bars, { sessionOpenAt: sessionStartAt + REGULAR_OPEN * 60_000, minutes: 30, feed: tape.feed, now });
          const side = candidate.playSide ?? "long";
          const trigger = checkVwapHold(tape.bars, vwap, { side: side === "long" ? "above" : "below", minutesRequired: 15, now });
          const facts = await getFacts(candidate.symbol, now);
          const advUsd = facts.find((fact) => fact.factKey === "adv_usd_30d" && fact.valueNum != null)?.valueNum ?? null;
          const play = constructPlay({
            symbol: candidate.symbol,
            side,
            holdingPeriod: run.holdingPeriod as any,
            instrumentPreference: run.instrumentPreference,
            bars: tape.bars,
            vwap,
            range,
            trigger,
            equityCents: account?.equityValueCents ?? null,
            sessionDayStartMs: sessionStartAt,
            catalystDeadlineAt: run.catalystDeadlineAt,
            advUsd,
            now,
          });
          const priorDecision = decisionByCandidate.get(candidate.id) ?? null;
          const operatorDecision: "not_recorded" | "skipped" | "deferred" = priorDecision?.decision === "skipped"
            ? "skipped"
            : priorDecision?.decision === "deferred"
              ? "deferred"
              : "not_recorded";
          return {
            sourceRunId: run.id,
            sourceCandidateId: candidate.id,
            symbol: candidate.symbol,
            conditionKey: `${run.holdingPeriod}:${side}:${trigger.state}:${tape.feed}`,
            recommendationSnapshot: {
              version: 1,
              snapshotBasis: "live_capture",
              capturedAt: now,
              candidate,
              run: { id: run.id, holdingPeriod: run.holdingPeriod, catalystDeadlineAt: run.catalystDeadlineAt, mandateVersion: run.mandateVersion },
              play,
              evidenceReviews: reviewsByCandidate.get(candidate.id) ?? [],
              recordedDecision: priorDecision,
              tape: { feed: tape.feed, unavailableReason: tape.unavailableReason, barCount: tape.bars.length },
            },
            operatorDecision,
            operatorReason: priorDecision?.reason ?? null,
            decidedAt: priorDecision?.updatedAt ?? null,
            outcomeStatus: "pending" as const,
            outcomeResult: "unresolved" as const,
            triggerObservation: "not_observed" as const,
            exitObservation: "not_observed" as const,
            outcomeBasis: "unknown" as const,
            createdAt: now,
            updatedAt: now,
          };
        }));
        const [created] = await db!.insert(aperturePlaySlates).values({
          userId: ctx.user.id,
          canonicalThesisId,
          accountId: account?.id ?? null,
          sessionDateEt,
          windowKey: input.windowKey,
          snapshotBasis: "live_capture",
          status: "awaiting_outcome",
          portfolioSnapshot: {
            account: account ? { id: account.id, label: account.label, equityValueCents: account.equityValueCents, lastSyncedAt: account.lastSyncedAt } : null,
            positions: held.map((position) => ({ symbol: position.symbol, qty: position.qty, marketValueCents: position.marketValueCents, priceAsOf: position.priceAsOf })),
          },
          contextSnapshot: {
            canonicalThesisId,
            capitalThesisName: projectionRows[0]!.name,
            windowKey: input.windowKey,
            captureMode: "live_capture",
            paperOnly: true,
            disclosure: CONSTRUCTED_PLAY_DISCLOSURE,
          },
          capturedAt: now,
          createdAt: now,
          updatedAt: now,
        });
        const slateId = (created as any).insertId as number;
        await db!.insert(aperturePlaySlateItems).values(items.map((item) => ({ ...item, slateId })));
        return { slateId, created: true };
      }),

    recordSlateDecision: capitalOperatorProcedure
      .input(z.object({
        slateId: z.number(),
        decision: z.enum(["cash", "selected"]),
        itemId: z.number().optional(),
        reason: z.string().trim().max(1_000).default("No additional note recorded."),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const [slate] = await db!.select().from(aperturePlaySlates).where(and(
          eq(aperturePlaySlates.id, input.slateId),
          eq(aperturePlaySlates.userId, ctx.user.id),
        )).limit(1);
        if (!slate) throw new TRPCError({ code: "NOT_FOUND", message: "Paper-play slate not found" });
        if (slate.snapshotBasis !== "live_capture") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Historical reconstructions are read-only. Only a live-captured slate can record a contemporaneous operator choice." });
        }
        if (input.decision === "selected" && input.itemId == null) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a captured play before recording a selected posture." });
        }
        if (input.itemId != null) {
          const [item] = await db!.select().from(aperturePlaySlateItems).where(and(
            eq(aperturePlaySlateItems.id, input.itemId),
            eq(aperturePlaySlateItems.slateId, slate.id),
          )).limit(1);
          if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Captured play not found in this paper slate" });
        }
        const now = Date.now();
        await db!.update(aperturePlaySlates).set({
          operatorDecision: input.decision,
          operatorReason: input.reason,
          decidedAt: now,
          updatedAt: now,
        }).where(eq(aperturePlaySlates.id, slate.id));
        if (input.decision === "selected" && input.itemId != null) {
          await db!.update(aperturePlaySlateItems).set({
            operatorDecision: "selected",
            operatorReason: input.reason,
            decidedAt: now,
            updatedAt: now,
          }).where(eq(aperturePlaySlateItems.id, input.itemId));
        }
        return { ok: true };
      }),

    refreshLiveOutcomes: capitalOperatorProcedure
      .input(z.object({ slateId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const [slate] = await db!.select().from(aperturePlaySlates).where(and(
          eq(aperturePlaySlates.id, input.slateId),
          eq(aperturePlaySlates.userId, ctx.user.id),
        )).limit(1);
        if (!slate) throw new TRPCError({ code: "NOT_FOUND", message: "Paper-play slate not found" });
        if (slate.snapshotBasis !== "live_capture") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Historical reconstructions are already fixed postmortems. Only live-captured slates can refresh observed outcomes." });
        }
        return refreshLiveSlateOutcomes(db!, slate);
      }),

    reconstructRecentRun: capitalOperatorProcedure
      .input(z.object({ runId: z.number(), windowKey: z.string().trim().min(2).max(64).default("historical_postmortem") }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const [row] = await db!.select({ run: apertureRuns, thesis: capitalTheses })
          .from(apertureRuns)
          .innerJoin(capitalTheses, eq(apertureRuns.thesisId, capitalTheses.id))
          .where(and(eq(apertureRuns.id, input.runId), eq(apertureRuns.userId, ctx.user.id), eq(apertureRuns.status, "completed")))
          .limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Completed research cohort not found" });
        if (row.run.holdingPeriod !== "intraday") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This proof-of-concept reconstructs intraday cohorts only; a longer catalyst window needs its stated exit horizon before it can be evaluated." });
        }
        const sessionStartAt = startOfEtDay(row.run.createdAt);
        const sessionDateEt = etClock(row.run.createdAt)?.dateEt;
        if (sessionStartAt == null || sessionDateEt == null) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "The original ET trading session cannot be determined, so the postmortem was not reconstructed." });
        }
        const now = Date.now();
        const existingSlates = await db!.select().from(aperturePlaySlates).where(and(
          eq(aperturePlaySlates.userId, ctx.user.id),
          eq(aperturePlaySlates.sessionDateEt, sessionDateEt),
          eq(aperturePlaySlates.windowKey, input.windowKey),
        ));
        const existing = existingSlates.find((slate) => slate.canonicalThesisId === row.thesis.sourceCompilationId);
        if (existing) return { slateId: existing.id, created: false };

        const accounts = await db!.select().from(portfolioAccounts).where(eq(portfolioAccounts.userId, ctx.user.id));
        const account = row.run.accountId
          ? accounts.find((item) => item.id === row.run.accountId) ?? null
          : accounts.find((item) => item.isPaper && item.brokerId === "alpaca_paper") ?? accounts.find((item) => item.isPaper) ?? null;
        const held = account
          ? await db!.select().from(positions).where(eq(positions.accountId, account.id))
          : [];
        const candidates = await db!.select().from(apertureCandidates).where(eq(apertureCandidates.runId, row.run.id));
        if (!candidates.length) throw new TRPCError({ code: "BAD_REQUEST", message: "This completed research cohort has no candidate rows to reconstruct." });
        const candidateIds = candidates.map((candidate) => candidate.id);
        const reviews = await db!.select().from(apertureEvidenceReviews).where(and(
          eq(apertureEvidenceReviews.userId, ctx.user.id),
          inArray(apertureEvidenceReviews.candidateId, candidateIds),
        ));
        const decisions = await db!.select().from(aperturePlayDecisions).where(and(
          eq(aperturePlayDecisions.userId, ctx.user.id),
          inArray(aperturePlayDecisions.candidateId, candidateIds),
        ));
        const reviewsByCandidate = new Map<number, typeof reviews>();
        for (const review of reviews) reviewsByCandidate.set(review.candidateId, [...(reviewsByCandidate.get(review.candidateId) ?? []), review]);
        const decisionByCandidate = new Map(decisions.map((decision) => [decision.candidateId, decision]));
        const constructionAt = row.run.completedAt ?? row.run.createdAt;

        const capturedItems = await Promise.all(candidates.map(async (candidate) => {
          const tape = await fetchIntradayBars(candidate.symbol, { startMs: sessionStartAt, timeoutMs: 8_000, maxPages: 6 });
          // A provider can return later bars despite a historical start request.
          // Keep the historical reconstruction inside its recorded session so a
          // current print cannot validate an old play.
          const sessionEndAt = sessionStartAt + 24 * 60 * 60_000;
          const sourceSessionBars = tape.bars.filter((bar) => bar.t >= sessionStartAt && bar.t < sessionEndAt);
          const decisionTimeBars = sourceSessionBars.filter((bar) => bar.t <= constructionAt);
          const sourceWindowReason = sourceSessionBars.length
            ? null
            : "The provider returned no minute bars within the original captured ET session; this outcome remains unavailable.";
          const vwap = sessionVwap(decisionTimeBars, { feed: tape.feed, now: constructionAt });
          const range = openingRange(decisionTimeBars, { sessionOpenAt: sessionStartAt + REGULAR_OPEN * 60_000, minutes: 30, feed: tape.feed, now: constructionAt });
          const side = candidate.playSide ?? "long";
          const trigger = checkVwapHold(decisionTimeBars, vwap, { side: side === "long" ? "above" : "below", minutesRequired: 15, now: constructionAt });
          const play = constructPlay({
            symbol: candidate.symbol,
            side,
            holdingPeriod: "intraday",
            instrumentPreference: "shares",
            bars: decisionTimeBars,
            vwap,
            range,
            trigger,
            equityCents: null,
            sessionDayStartMs: sessionStartAt,
            catalystDeadlineAt: row.run.catalystDeadlineAt,
            advUsd: null,
            now: constructionAt,
          });
          const evaluation = evaluateIntradayPaperOutcome({
            side,
            entryPriceCents: play.entry?.priceCents ?? null,
            stopPriceCents: play.stop?.priceCents ?? null,
            timeStopAt: play.timeStopAt,
          }, sourceSessionBars, now);
          const observationBasis = sourceSessionBars.length && decisionTimeBars.length && !tape.unavailableReason
            ? "verified" as const
            : "unknown" as const;
          const recipeUnavailableReason = play.unavailableReasons[0] ?? null;
          const outcome = calculatePaperPlayOutcome({
            side,
            entryPriceCents: play.entry?.priceCents ?? null,
            stopPriceCents: play.stop?.priceCents ?? null,
            slippageCents: play.slippage?.priceCents ?? null,
            plannedRiskCents: play.plannedLossCents,
            notionalCents: play.notionalCents,
            timeStopAt: play.timeStopAt,
            noTradeConditions: play.noTradeConditions,
          }, {
            ...evaluation,
            basis: observationBasis,
            providerId: sourceSessionBars.length ? "alpaca" : null,
            sourceUrl: sourceSessionBars.length ? `https://app.alpaca.markets/trade/${encodeURIComponent(candidate.symbol)}` : null,
            observedAt: sourceSessionBars.length ? sourceSessionBars[sourceSessionBars.length - 1]!.t : null,
            unavailableReason: recipeUnavailableReason ?? evaluation.unavailableReason ?? sourceWindowReason ?? tape.unavailableReason,
          });
          const decision = decisionByCandidate.get(candidate.id) ?? null;
          const operatorDecision: "not_recorded" | "skipped" | "deferred" = decision?.decision === "skipped"
            ? "skipped"
            : decision?.decision === "deferred"
              ? "deferred"
              : "not_recorded";
          return {
            sourceRunId: row.run.id,
            sourceCandidateId: candidate.id,
            symbol: candidate.symbol,
            conditionKey: `${row.run.holdingPeriod}:${side}:${trigger.state}:${tape.feed}`,
            recommendationSnapshot: {
              version: 1,
              snapshotBasis: "historical_reconstruction",
              reconstructedFrom: { runCompletedAt: constructionAt, sessionStartAt },
              candidate,
              run: {
                id: row.run.id,
                holdingPeriod: row.run.holdingPeriod,
                catalystDeadlineAt: row.run.catalystDeadlineAt,
                invalidationRule: row.run.invalidationRule,
                mandateVersion: row.run.mandateVersion,
              },
              play,
              evidenceReviews: reviewsByCandidate.get(candidate.id) ?? [],
              recordedDecision: decision,
              tape: { feed: tape.feed, unavailableReason: tape.unavailableReason ?? sourceWindowReason, decisionTimeBarCount: decisionTimeBars.length, sourceSessionBarCount: sourceSessionBars.length, returnedBarCount: tape.bars.length },
            },
            operatorDecision,
            operatorReason: decision?.reason ?? null,
            decidedAt: decision?.updatedAt ?? null,
            outcomeStatus: outcome.status,
            outcomeResult: outcome.result,
            triggerObservation: evaluation.trigger,
            exitObservation: evaluation.exit,
            entryPriceCents: outcome.entryPriceCents,
            settlementPriceCents: outcome.settlementPriceCents,
            returnBps: outcome.returnBps,
            rMultiple: outcome.rMultiple,
            outcomeBasis: outcome.basis,
            outcomeProviderId: sourceSessionBars.length ? "alpaca" : null,
            outcomeSourceUrl: sourceSessionBars.length ? `https://app.alpaca.markets/trade/${encodeURIComponent(candidate.symbol)}` : null,
            observedAt: sourceSessionBars.length ? sourceSessionBars[sourceSessionBars.length - 1]!.t : null,
            outcomeExplanation: outcome.explanation,
            computedAt: now,
            createdAt: now,
            updatedAt: now,
          };
        }));

        const [created] = await db!.insert(aperturePlaySlates).values({
          userId: ctx.user.id,
          canonicalThesisId: row.thesis.sourceCompilationId,
          accountId: account?.id ?? null,
          sessionDateEt,
          windowKey: input.windowKey,
          snapshotBasis: "historical_reconstruction",
          status: "complete",
          portfolioSnapshot: {
            reconstructedAt: now,
            account: account ? { id: account.id, label: account.label, equityValueCents: account.equityValueCents, lastSyncedAt: account.lastSyncedAt } : null,
            positions: held.map((position) => ({ symbol: position.symbol, qty: position.qty, marketValueCents: position.marketValueCents, priceAsOf: position.priceAsOf })),
            warning: "This portfolio context is current-account context, not a contemporaneous historical account snapshot.",
          },
          contextSnapshot: {
            canonicalThesisId: row.thesis.sourceCompilationId,
            capitalThesisName: row.thesis.name,
            runId: row.run.id,
            snapshotBasis: "historical_reconstruction",
            warning: "This slate was reconstructed after the fact from a completed run and source bars. It is not a live-captured recommendation record.",
          },
          capturedAt: constructionAt,
          createdAt: now,
          updatedAt: now,
        });
        const slateId = (created as any).insertId as number;
        await db!.insert(aperturePlaySlateItems).values(capturedItems.map((item) => ({ ...item, slateId })));
        return { slateId, created: true };
      }),
  }),

  // ── Order management ──────────────────────────────────────────────────────

  order: router({
    list: capitalOperatorProcedure
      .input(z.object({ runId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        const rows = await db!.select().from(brokerOrders)
          .where(and(eq(brokerOrders.runId, input.runId), eq(brokerOrders.userId, ctx.user.id)))
          .orderBy(desc(brokerOrders.createdAt));
        const accountIds = Array.from(new Set(rows.flatMap((row) => [row.accountId, row.portfolioContextAccountId].filter((id): id is number => id != null))));
        const accounts = accountIds.length
          ? await db!.select().from(portfolioAccounts).where(and(eq(portfolioAccounts.userId, ctx.user.id), inArray(portfolioAccounts.id, accountIds)))
          : [];
        const byId = new Map(accounts.map((account) => [account.id, account]));
        return rows.map((row) => ({
          ...row,
          destinationAccount: byId.get(row.accountId) ?? null,
          portfolioContextAccount: row.portfolioContextAccountId ? byId.get(row.portfolioContextAccountId) ?? null : byId.get(row.accountId) ?? null,
        }));
      }),

    optionChain: capitalOperatorProcedure
      .input(z.object({
        accountId: z.number(),
        underlyingSymbol: z.string().trim().min(1).max(12),
        expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        type: z.enum(["call", "put"]),
        targetPriceCents: z.number().int().positive().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        const account = await requireAccount(db, input.accountId, ctx.user.id);
        const broker = brokerFor(account.brokerId, account.id);
        if (!broker.available() || !broker.getOptionChain) {
          return { items: [], unavailableReason: broker.unavailableReason() ?? `${broker.label} does not provide an option chain.` };
        }
        const target = input.targetPriceCents;
        try {
          const chain = await broker.getOptionChain({
            underlyingSymbol: normSymbol(input.underlyingSymbol),
            expirationDate: input.expirationDate,
            type: input.type,
            strikePriceGteCents: target == null ? undefined : Math.max(1, Math.round(target * 0.8)),
            strikePriceLteCents: target == null ? undefined : Math.round(target * 1.2),
            limit: 40,
          });
          const now = Date.now();
          const maxQuoteAgeMs = marketSession(now).session === "regular" ? 5 * 60_000 : 8 * 60 * 60_000;
          const items = chain.map(({ contract, market }) => {
            const midpointCents = market ? Math.round((market.bidPriceCents + market.askPriceCents) / 2) : null;
            const spreadPct = market && midpointCents && midpointCents > 0
              ? ((market.askPriceCents - market.bidPriceCents) / midpointCents) * 100
              : null;
            const quoteAgeMs = market ? now - market.quoteAt : null;
            const quoteReady = Boolean(market
              && quoteAgeMs != null && quoteAgeMs >= 0 && quoteAgeMs <= maxQuoteAgeMs
              && market.bidPriceCents > 0 && market.askPriceCents >= market.bidPriceCents
              && market.dailyVolume > 0
              && contract.openInterest != null && contract.openInterest > 0
              && market.impliedVolatility > 0
              && spreadPct != null && spreadPct <= 35);
            return { contract, market, midpointCents, spreadPct, quoteAgeMs, quoteReady };
          }).sort((a, b) => {
            if (a.quoteReady !== b.quoteReady) return a.quoteReady ? -1 : 1;
            const aDistance = target == null ? a.contract.strikePriceCents : Math.abs(a.contract.strikePriceCents - target);
            const bDistance = target == null ? b.contract.strikePriceCents : Math.abs(b.contract.strikePriceCents - target);
            return aDistance !== bDistance ? aDistance - bDistance : (b.contract.openInterest ?? 0) - (a.contract.openInterest ?? 0);
          }).slice(0, 8);
          return {
            items,
            unavailableReason: items.length ? null : `No active ${input.expirationDate} ${input.type} contracts were returned for ${normSymbol(input.underlyingSymbol)}.`,
          };
        } catch (error) {
          return { items: [], unavailableReason: error instanceof Error ? error.message : "The option chain is temporarily unavailable." };
        }
      }),

    create: capitalOperatorProcedure
      .input(orderCreateInput)
      .mutation(async ({ ctx, input }) => {
        const recipeGap = missingIntradayRecipeMessage(input);
        if (recipeGap) throw new TRPCError({ code: "PRECONDITION_FAILED", message: recipeGap });
        const db = await getDb();
        await requireAccount(db, input.accountId, ctx.user.id);

        // A run's own preset tightens the mandate for orders placed under it.
        const [run] = await db!.select().from(apertureRuns)
          .where(and(eq(apertureRuns.id, input.runId), eq(apertureRuns.userId, ctx.user.id)))
          .limit(1);
        if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
        if (run.droppedNote === "ILLUSTRATIVE_UAT_QUALIFIED_PLAY_ZERO_NETWORK_NOT_CURRENT_MARKET_DATA") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Illustrative UAT fixtures may be reviewed but can never create a paper-order proposal." });
        }

        // A candidate-originated proposal cannot skip the operator's recorded review
        // of the evidence questions that can change the decision. Manual paper orders
        // remain possible for operational uses without a research-candidate link.
        const evidenceBlock = await evidenceReviewBlock(db, ctx.user.id, input.runId, input.candidateId);
        if (evidenceBlock) throw new TRPCError({ code: "PRECONDITION_FAILED", message: evidenceBlock });

        try {
          return await createOrder({
            ...input,
            userId: ctx.user.id,
            portfolioRules: {
              maxSingleNamePct: run.maxSingleNamePct ?? null,
              minAvgDailyVolumeUsd: run.liquidityFloorAdvUsd ?? null,
            },
          });
        } catch (e: any) {
          if (e instanceof OrderGateError) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: e.message,
              cause: e,
            });
          }
          if (e instanceof DecisionRunwayBlockedError) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: e.message, cause: e });
          }
          throw e;
        }
      }),

    /**
     * Evaluate the gates for an order that has NOT been created.
     *
     * Writes no row, touches no broker, changes no state — it is a query, not a
     * mutation, and that is enforced by the procedure type as well as by the
     * code path. It exists so the order ticket can show the mandate live as the
     * operator types, instead of after they submit and get refused.
     *
     * It reuses `preflightOrder`, which is literally the evaluation half of
     * `createOrder` (server/aperture/orderFlow.ts → `evaluateOrder`). The three
     * non-gate preconditions create also applies — the run's tightening rules,
     * the evidence-review requirement, and the create input schema — are
     * evaluated here too and folded into `blocking`, so `wouldPass` is true only
     * where create would actually go through.
     */
    preflight: capitalOperatorProcedure
      .input(orderPreflightInput)
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        await requireAccount(db, input.accountId, ctx.user.id);

        const [run] = await db!.select().from(apertureRuns)
          .where(and(eq(apertureRuns.id, input.runId), eq(apertureRuns.userId, ctx.user.id)))
          .limit(1);
        if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
        const illustrativeFixture = run.droppedNote === "ILLUSTRATIVE_UAT_QUALIFIED_PLAY_ZERO_NETWORK_NOT_CURRENT_MARKET_DATA";

        const evidenceBlock = await evidenceReviewBlock(db, ctx.user.id, input.runId, input.candidateId);

        // Everything create's own zod would refuse, as messages rather than a
        // 400 — a half-typed ticket must still get an answer about the mandate.
        const parsed = orderCreateInput.safeParse(input);
        const schemaErrors = parsed.success
          ? []
          : parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`);

        let preflight;
        try {
          preflight = await preflightOrder({
            ...input,
            userId: ctx.user.id,
            portfolioRules: {
              maxSingleNamePct: run.maxSingleNamePct ?? null,
              minAvgDailyVolumeUsd: run.liquidityFloorAdvUsd ?? null,
            },
          });
        } catch (error) {
          if (error instanceof DecisionRunwayBlockedError) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: error.message, cause: error });
          }
          throw error;
        }
        const { evaluation, gatedNotionalCents, notionalBasis, session } = preflight;

        const recipeGap = missingIntradayRecipeMessage(input);
        const fixtureBlock = illustrativeFixture ? ["Illustrative UAT fixtures may be reviewed but can never create a paper-order proposal."] : [];
        const blocking = [...fixtureBlock, ...evaluation.failures, ...schemaErrors, ...(recipeGap ? [recipeGap] : []), ...(evidenceBlock ? [evidenceBlock] : [])];
        return {
          wouldPass: blocking.length === 0,
          blocking,
          evaluation,
          schemaErrors,
          evidenceBlock,
          gatedNotionalCents,
          notionalBasis,
          marketSession: session.session,
          sessionBasis: session.basis,
        };
      }),

    approve: capitalOperatorProcedure
      .input(z.object({ orderId: z.number(), paperConfirmation: z.literal("APPROVE PAPER") }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await approveOrder(input.orderId, ctx.user.id, input.paperConfirmation);
        } catch (error) {
          if (error instanceof OrderGateError || error instanceof DecisionRunwayBlockedError) throw new TRPCError({ code: "PRECONDITION_FAILED", message: error.message, cause: error });
          throw error;
        }
      }),

    reject: capitalOperatorProcedure
      .input(z.object({ orderId: z.number(), reason: z.string().trim().min(10).max(1_000) }))
      .mutation(async ({ ctx, input }) => {
        await rejectOrder(input.orderId, ctx.user.id, input.reason);
        const db = await getDb();
        const [order] = await db!.select().from(brokerOrders).where(and(
          eq(brokerOrders.id, input.orderId),
          eq(brokerOrders.userId, ctx.user.id),
        )).limit(1);
        const ledger = order?.candidateId == null ? null : await syncCapturedPlayDecision({
          db: db!,
          userId: ctx.user.id,
          runId: order.runId,
          candidateId: order.candidateId,
          decision: "skipped",
          reason: input.reason?.trim() || "Paper proposal rejected by the operator.",
        });
        return { ok: true, ledger };
      }),

    submit: capitalOperatorProcedure
      .input(z.object({ orderId: z.number(), paperConfirmation: z.literal("SUBMIT PAPER") }))
      .mutation(async ({ ctx, input }) => {
        let submitted;
        try {
          submitted = await submitBrokerOrder(input.orderId, ctx.user.id, input.paperConfirmation);
        } catch (error) {
          if (error instanceof OrderGateError || error instanceof DecisionRunwayBlockedError) throw new TRPCError({ code: "PRECONDITION_FAILED", message: error.message, cause: error });
          throw error;
        }
        if (submitted.candidateId != null) {
          const db = await getDb();
          await syncCapturedPlayDecision({
            db: db!,
            userId: ctx.user.id,
            runId: submitted.runId,
            candidateId: submitted.candidateId,
            decision: "selected",
            reason: `Submitted ${submitted.symbol} to the named paper broker for the captured outcome comparison.`,
          });
        }
        return submitted;
      }),

    mirrorFills: capitalOperatorProcedure
      .mutation(async ({ ctx }) => {
        const updated = await mirrorFills(ctx.user.id);
        return { updated };
      }),
  }),

  // ── Monitoring ─────────────────────────────────────────────────────────────

  monitor: router({
    run: capitalOperatorProcedure
      .input(z.object({
        runId: z.number(),
        candidateId: z.number(),
        symbol: z.string(),
        thesisSummary: z.string(),
        checkTypes: z.array(z.enum(["catalyst", "thesis_invalidation", "earnings", "macro"])).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const [owned] = await db!.select({ runId: apertureRuns.id, candidateId: apertureCandidates.id, symbol: apertureCandidates.symbol })
          .from(apertureRuns)
          .innerJoin(apertureCandidates, and(
            eq(apertureCandidates.id, input.candidateId),
            eq(apertureCandidates.runId, apertureRuns.id),
          ))
          .where(and(
            eq(apertureRuns.id, input.runId),
            eq(apertureRuns.userId, ctx.user.id),
          )).limit(1);
        if (!owned || normSymbol(input.symbol) !== owned.symbol) {
          throw new TRPCError({ code: "NOT_FOUND", message: "The monitored candidate is not part of this operator-owned run." });
        }
        const filledOrders = await db!.select({
          intent: brokerOrders.intent,
          filledQty: brokerOrders.filledQty,
        }).from(brokerOrders).where(and(
          eq(brokerOrders.userId, ctx.user.id),
          eq(brokerOrders.runId, input.runId),
          eq(brokerOrders.candidateId, input.candidateId),
          eq(brokerOrders.status, "filled"),
        ));
        const netFilledQty = filledOrders.reduce((total, order) => {
          const quantity = Math.max(0, order.filledQty ?? 0);
          if (order.intent === "open") return total + quantity;
          if (order.intent === "close") return total - quantity;
          return total;
        }, 0);
        if (netFilledQty <= 0) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No open filled paper exposure exists for this candidate. Monitoring begins only after a verified fill." });
        }
        return runMonitoringChecks(
          input.runId,
          input.candidateId,
          input.symbol,
          input.thesisSummary,
          input.checkTypes,
        );
      }),

    list: capitalOperatorProcedure
      .input(z.object({ runId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        const [run] = await db!.select({ id: apertureRuns.id }).from(apertureRuns)
          .where(and(eq(apertureRuns.id, input.runId), eq(apertureRuns.userId, ctx.user.id))).limit(1);
        if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
        return getMonitoringChecks(input.runId);
      }),

    flagged: capitalOperatorProcedure
      .input(z.object({ runId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        const [run] = await db!.select({ id: apertureRuns.id }).from(apertureRuns)
          .where(and(eq(apertureRuns.id, input.runId), eq(apertureRuns.userId, ctx.user.id))).limit(1);
        if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
        return getFlaggedChecks(input.runId);
      }),
  }),

  // ── Aperture Alpha ─────────────────────────────────────────────────────────

  alpha: router({
    compute: capitalOperatorProcedure
      .input(z.object({ runId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return computeAlpha(input.runId, ctx.user.id);
      }),

    get: capitalOperatorProcedure
      .input(z.object({ runId: z.number() }))
      .query(async ({ ctx, input }) => getAlpha(input.runId, ctx.user.id)),
  }),
});

// ── Background run executor ───────────────────────────────────────────────────

/** Tightening-only merge of the run preset into the thesis's portfolio rules. */
function withPresetRules(
  graph: any,
  input: { maxSingleNamePct?: number; liquidityFloorAdvUsd?: number },
): any {
  if (!graph) return graph;
  const rules = { ...(graph.portfolioRules ?? {}) };
  const existingSingle = Number(rules.maxSingleNamePct);
  const existingAdv = Number(rules.minAvgDailyVolumeUsd);

  if (input.maxSingleNamePct != null) {
    rules.maxSingleNamePct = Number.isFinite(existingSingle)
      ? Math.min(existingSingle, input.maxSingleNamePct)
      : input.maxSingleNamePct;
  }
  if (input.liquidityFloorAdvUsd != null) {
    rules.minAvgDailyVolumeUsd = Number.isFinite(existingAdv)
      ? Math.max(existingAdv, input.liquidityFloorAdvUsd)
      : input.liquidityFloorAdvUsd;
  }
  return { ...graph, portfolioRules: rules };
}

async function executeRun(
  runId: number,
  userId: number,
  thesis: any,
  input: {
    thesisId: number;
    accountId?: number;
    deployableCapitalCents: number;
    intendedTrades: Array<{ symbol: string; dollarsCents: number; note?: string }>;
    hurdleRateBps?: number;
    holdingPeriod?: string;
    instrumentPreference?: "shares" | "options" | "either";
    liquidityFloorAdvUsd?: number;
    catalystDeadlineAt?: number;
    maxSingleNamePct?: number;
    invalidationRule?: string;
    researchOffset?: number;
    followUpFromRunId?: number;
  },
) {
  const db = await getDb();
  const setStatus = (status: string, extra: Record<string, any> = {}) =>
    db!.update(apertureRuns).set({ status: status as any, ...extra }).where(eq(apertureRuns.id, runId));

  try {
    await setStatus("compiling", { startedAt: Date.now() });
    // The run preset tightens the thesis's own portfolio rules for this run, so
    // the concentration cap and liquidity floor reach strategy construction
    // instead of sitting inert on the row. Tightening only — a preset can never
    // widen what the thesis allows.
    const resolved = await resolveRunGraph(thesis.graph as ThesisGraph, thesis.rawText);
    let baseGraph = resolved.graph;
    let canonicalDeclarationsApplied = false;
    if (thesis.sourceCompilationId) {
      const [canonical] = await db!.select().from(thesisCompilations)
        .where(eq(thesisCompilations.id, thesis.sourceCompilationId)).limit(1);
      if (canonical) {
        baseGraph = applyCanonicalDeclarations(baseGraph, detailsFromCanonicalRecord(canonical));
        canonicalDeclarationsApplied = true;
      }
    }
    baseGraph = validateGraphForPersistence(baseGraph);
    if (resolved.recovered || canonicalDeclarationsApplied) {
      await db!.update(capitalTheses)
        .set({
          graph: baseGraph,
          confidenceNotes: baseGraph.confidenceNotes ?? [],
          updatedAt: Date.now(),
        })
        .where(and(eq(capitalTheses.id, input.thesisId), eq(capitalTheses.userId, userId)));
      console.warn(`[aperture] Reconciled thesis projection with canonical declarations for thesis ${input.thesisId} before run ${runId}.`);
    }
    const graph = validateGraphForPersistence(withPresetRules(baseGraph, input));
    const nodeRows = flattenExposureTree(graph.exposureTree ?? []);

    // ── 1. Persist exposure nodes ──────────────────────────────────────────
    const nodeIdByLabel = new Map<string, number>();
    for (const node of nodeRows) {
      const [r] = await db!.insert(exposureNodes).values({
        thesisId: input.thesisId,
        parentId: null,
        label: node.label,
        depth: node.depth,
        path: node.path,
        createdAt: Date.now(),
      });
      nodeIdByLabel.set(node.label, (r as any).insertId);
    }

    // ── 2. Load holdings ───────────────────────────────────────────────────
    await setStatus("discovering");
    const holdingRows = input.accountId
      ? await db!.select().from(positions).where(eq(positions.accountId, input.accountId))
      : [];
    const holdings = holdingRows.map((p) => ({
      symbol: p.symbol,
      valueCents: p.marketValueCents ?? 0,
      sector: null,
      advUsd: null,
    }));
    const known = new Set([
      ...holdings.map((h) => normSymbol(h.symbol)),
      ...input.intendedTrades.map((t) => normSymbol(t.symbol)),
    ]);

    // ── 3. Universe discovery ──────────────────────────────────────────────
    const summary = thesisSummary(graph.beliefs ?? [], graph.seek ?? []);
    const universe = operatorDeclaredUniverse(graph.researchSymbols)
      ?? await discoverUniverse(nodeRows, summary, known);
    const offset = Math.max(0, input.researchOffset ?? 0);
    const researchPlan = buildBriefResearchPlan(universe.discovered.slice(offset), input.holdingPeriod);
    const researchDroppedNote = [
      input.followUpFromRunId ? `Follow-up research from run #${input.followUpFromRunId}; research offset ${offset}.` : null,
      universe.droppedNote,
      researchPlan.deferredCount > 0 ? `${researchPlan.deferredCount} symbols deferred to a follow-up brief` : null,
    ].filter(Boolean).join(" · ") || null;
    await setStatus("researching", {
      universeCount: researchPlan.items.length,
      droppedNote: researchDroppedNote,
    });

    // ── 4. Research swarm ──────────────────────────────────────────────────
    const symbols = researchPlan.items.map((d) => d.symbol);
    // Macro facts are sourced once per run against the __MACRO__ ledger symbol.
    // They inform the operator's regime context, but are never silently blended
    // into a per-security score without an explicit thesis-level rule.
    await collectMacroFacts();
    await runResearchSwarm(symbols, { concurrency: 4, passes: researchPlan.passes ? [...researchPlan.passes] : undefined });

    // ── 5. Load facts and assemble ─────────────────────────────────────────
    await setStatus("scoring");
    const allFactRows = await getFacts(symbols);
    const factsBySymbol = new Map<string, typeof allFactRows>();
    for (const f of allFactRows) {
      if (!factsBySymbol.has(f.symbol)) factsBySymbol.set(f.symbol, []);
      factsBySymbol.get(f.symbol)!.push(f);
    }

    await setStatus("constructing");
    const assembled = assembleRun({
      graph,
      discovered: researchPlan.items,
      factsBySymbol,
      holdings,
      cashCents: holdingRows.reduce((s, p) => s + (p.marketValueCents ?? 0), 0),
      deployableCapitalCents: input.deployableCapitalCents,
      intendedTrades: input.intendedTrades,
      hurdleRateBps: input.hurdleRateBps,
      holdingPeriod: input.holdingPeriod != null && ["intraday", "overnight", "swing", "catalyst_window", "position"].includes(input.holdingPeriod)
        ? input.holdingPeriod as "intraday" | "overnight" | "swing" | "catalyst_window" | "position"
        : null,
      instrumentPreference: input.instrumentPreference ?? graph.instrumentPreference,
    });

    // ── 6. Persist candidates ──────────────────────────────────────────────
    const providerAvailability = availabilityMap();
    const now = Date.now();
    for (const c of assembled.candidates) {
      const nodeIds = c.nodePaths
        .map((p) => nodeIdByLabel.get(p))
        .filter((id): id is number => id != null);
      await db!.insert(apertureCandidates).values({
        runId,
        symbol: c.symbol,
        role: c.role,
        compositeScore: c.score.compositeScore,
        confidenceScore: c.score.confidenceScore,
        rankScore: c.score.rankScore,
        dimensions: c.score.dimensions,
        verifyFields: c.score.verifyFields,
        exposureNodeIds: nodeIds,
        memoStatus: "pending",
        citations: c.citations,
        createdAt: now,
      });
    }

    // ── 7. Persist strategies ──────────────────────────────────────────────
    for (const s of assembled.strategies) {
      await db!.insert(apertureStrategies).values({
        runId,
        kind: s.kind,
        label: s.label,
        rationale: s.rationale ?? null,
        allocations: s.allocations,
        cashRetainedCents: s.cashRetainedCents,
        portfolioImpact: s.impact ?? null,
        opportunityCost: null,
        createdAt: now,
      });
    }

    // ── 8. Persist exposure coverage ───────────────────────────────────────
    for (const cov of assembled.exposureCoverage) {
      const nodeId = nodeIdByLabel.get(cov.nodePath);
      if (!nodeId) continue;
      await db!.insert(exposureCoverage).values({
        runId,
        nodeId,
        symbol: cov.symbol,
        weightPct: null,
        source: cov.source,
      });
    }

    // ── 9. Persist the set-aside list ──────────────────────────────────────
    // Every symbol a hard stop dropped, and the rule that dropped it. Before
    // migration 0037 this array was computed and then discarded, leaving only
    // the coarse dropped_note — so the brief could say what it found but not
    // what it rejected, which is the half that makes it diligence rather than a
    // screen. Persisted after coverage so a failure here cannot cost the run its
    // candidates.
    for (const aside of assembled.setAside) {
      await db!.insert(apertureSetAside).values({
        runId,
        symbol: aside.symbol,
        reason: aside.reason,
        createdAt: now,
      });
    }

    await setStatus("completed", {
      candidateCount: assembled.candidates.length,
      providerAvailability,
      completedAt: Date.now(),
    });
  } catch (e: any) {
    await db!.update(apertureRuns).set({
      status: "failed",
      error: String(e?.message ?? e),
      completedAt: Date.now(),
    }).where(eq(apertureRuns.id, runId));
    throw e;
  }
}
