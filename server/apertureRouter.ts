/**
 * Aperture router — tRPC namespace `aperture`.
 *
 * Every procedure is adminProcedure: this is a single-operator internal tool.
 * No autonomous execution. Paper only. The guardrails are structural, not
 * just a warning banner.
 *
 * Persistent banner requirement: every Aperture surface must show
 * "Internal research tool — not investment advice. Modeled figures labeled as
 * such." This is enforced in the client, not here, but it is documented here
 * so the contract is visible in the server code too.
 */
import { z } from "zod";
import { eq, and, inArray, gte, lt, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  capitalTheses,
  portfolioAccounts,
  positions,
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
  apertureSetAside,
  thesisCompilations,
  users,
} from "../drizzle/schema";
import { adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { compileThesis, flattenExposureTree } from "./aperture/thesisGraph";
import { discoverUniverse, thesisSummary } from "./aperture/universe";
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
import { missingIntradayRecipeMessage } from "../shared/intradayRecipeGuard";
import { fetchIntradayBars } from "./aperture/providers/marketData";
import { checkVwapHold, openingRange, sessionVwap } from "./aperture/intraday";
import { REGULAR_OPEN, etClock, nextRegularSessionOpen, startOfEtDay } from "./aperture/marketSession";
import { constructPlay, CONSTRUCTED_PLAY_DISCLOSURE } from "./aperture/playConstructor";
import { canonicalCapitalValues, needsCanonicalPromotion } from "./aperture/canonicalThesisLink";
import { buildTrustCalibration, calculatePaperPlayOutcome } from "../shared/playOutcomeLedger";
import { buildPortfolioImpactTrend, type PortfolioImpactTrendRow } from "../shared/portfolioImpactTrend";
import { evaluateIntradayPaperOutcome } from "./aperture/playOutcomeEvaluator";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { COOKIE_NAME } from "../shared/const";
import { parse as parseCookie } from "cookie";
import { DAILY_OUTCOME_REFRESH_CRON, DAILY_OUTCOME_REFRESH_PATH, refreshLiveSlateOutcomes } from "./aperture/dailyOutcomeRefresh";
import { ONE_TIME_GLP1_RESEARCH_PATH, oneTimeResearchCron } from "./aperture/oneTimeGlp1Research";
import { PAPER_ACCOUNT_SYNC_CRON, PAPER_ACCOUNT_SYNC_PATH } from "./aperture/paperAccountSyncScheduled";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function requireThesis(db: Awaited<ReturnType<typeof getDb>>, thesisId: number, userId: number) {
  const rows = await db!.select().from(capitalTheses)
    .where(and(eq(capitalTheses.id, thesisId), eq(capitalTheses.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Thesis not found" });
  return rows[0];
}

async function requireAccount(db: Awaited<ReturnType<typeof getDb>>, accountId: number, userId: number) {
  const rows = await db!.select().from(portfolioAccounts)
    .where(and(eq(portfolioAccounts.id, accountId), eq(portfolioAccounts.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
  return rows[0];
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
  const requiredChecks = Array.isArray(candidate.verifyFields) ? candidate.verifyFields : [];
  if (!requiredChecks.length) return null;
  const reviews = await db!.select().from(apertureEvidenceReviews).where(and(
    eq(apertureEvidenceReviews.userId, userId),
    eq(apertureEvidenceReviews.runId, runId),
    eq(apertureEvidenceReviews.candidateId, candidateId),
  ));
  const readiness = getEvidenceReviewReadiness(requiredChecks, reviews);
  if (!readiness.unreviewedChecks.length) return null;
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
  symbol: z.string(),
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
    list: adminProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      return db!.select().from(capitalTheses)
        .where(eq(capitalTheses.userId, ctx.user.id))
        .orderBy(desc(capitalTheses.updatedAt));
    }),

    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        return requireThesis(db, input.id, ctx.user.id);
      }),

    create: adminProcedure
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
    promoteCanonical: adminProcedure
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
    update: adminProcedure
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

    compile: adminProcedure
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

    activate: adminProcedure
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

    delete: adminProcedure
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
    list: adminProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      return db!.select().from(portfolioAccounts)
        .where(eq(portfolioAccounts.userId, ctx.user.id))
        .orderBy(desc(portfolioAccounts.updatedAt));
    }),

    create: adminProcedure
      .input(z.object({
        label: z.string().max(120),
        brokerId: z.enum(["manual", "alpaca_paper", "robinhood_mcp"]).default("manual"),
        isPaper: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const now = Date.now();
        const [result] = await db!.insert(portfolioAccounts).values({
          userId: ctx.user.id,
          label: input.label,
          brokerId: input.brokerId,
          isPaper: input.isPaper,
          createdAt: now,
          updatedAt: now,
        });
        return { id: (result as any).insertId as number };
      }),

    sync: adminProcedure
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

        const now = Date.now();
        await db!.update(portfolioAccounts).set({
          cashCents: acctData.cashCents,
          buyingPowerCents: acctData.buyingPowerCents,
          equityValueCents: acctData.equityValueCents,
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

    configureSyncSchedule: adminProcedure
      .input(z.object({ id: z.number(), enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const account = await requireAccount(db, input.id, ctx.user.id);
        if (!account.isPaper || account.brokerId !== "alpaca_paper") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Scheduled freshness is available only for configured Alpaca Paper accounts." });
        }
        const rawCookie = typeof ctx.req.headers.cookie === "string" ? ctx.req.headers.cookie : "";
        const sessionToken = parseCookie(rawCookie)[COOKIE_NAME] ?? "";
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

    getPositions: adminProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        await requireAccount(db, input.accountId, ctx.user.id);
        return db!.select().from(positions)
          .where(eq(positions.accountId, input.accountId))
          .orderBy(desc(positions.marketValueCents));
      }),

    importCsv: adminProcedure
      .input(z.object({
        accountId: z.number(),
        rows: z.array(z.object({
          symbol: z.string(),
          qty: z.number(),
          avgCostCents: z.number().optional(),
          marketValueCents: z.number().optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        await requireAccount(db, input.accountId, ctx.user.id);
        const now = Date.now();
        await db!.delete(positions).where(eq(positions.accountId, input.accountId));
        if (input.rows.length) {
          await db!.insert(positions).values(input.rows.map((r) => ({
            accountId: input.accountId,
            symbol: normSymbol(r.symbol),
            assetType: "equity" as const,
            qty: r.qty,
            avgCostCents: r.avgCostCents ?? null,
            marketValueCents: r.marketValueCents ?? null,
            priceAsOf: now,
            priceSource: "csv_import",
            createdAt: now,
            updatedAt: now,
          })));
        }
        return { imported: input.rows.length };
      }),
  }),

  // ── Broker availability ────────────────────────────────────────────────────

  brokers: adminProcedure.query(() => {
    return listBrokers().map((b) => ({
      id: b.id,
      label: b.label,
      available: b.available(),
      unavailableReason: b.unavailableReason?.() ?? null,
      capabilities: b.capabilities,
    }));
  }),

  // ── Provider availability ──────────────────────────────────────────────────

  providers: adminProcedure.query(() => describeAvailability()),

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
  cockpit: adminProcedure
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
    get: adminProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const [user] = await db!.select({ expanded: users.cockpitRailExpanded, acknowledgedSignature: users.cockpitRailAcknowledgedSignature })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);
      return { expanded: user?.expanded === true, acknowledgedSignature: user?.acknowledgedSignature ?? null };
    }),
    set: adminProcedure.input(z.object({ expanded: z.boolean() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await db!.update(users).set({ cockpitRailExpanded: input.expanded }).where(eq(users.id, ctx.user.id));
      return { expanded: input.expanded };
    }),
    acknowledge: adminProcedure.input(z.object({ signature: z.string().min(1).max(255) })).mutation(async ({ ctx, input }) => {
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
    list: adminProcedure.query(async ({ ctx }) => {
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
        .map(({ candidate, run, thesisName }) => ({ candidate, run, thesisName }));
    }),

    get: adminProcedure
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
        return { ...row, paperContext: account ? { account, positions: paperPositions } : null };
      }),
  }),

  // ── Run lifecycle ──────────────────────────────────────────────────────────

  macro: router({
    /** Refresh the shared macro ledger on operator request. It never trades or changes a thesis. */
    refresh: adminProcedure.mutation(async () => {
      const result = await collectMacroFacts();
      return {
        factsWritten: result.facts.length,
        providers: result.ranProviders,
        errors: result.errors,
      };
    }),
  }),

  run: router({
    list: adminProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const rows = await db!.select({ run: apertureRuns, thesisName: capitalTheses.name }).from(apertureRuns)
        .leftJoin(capitalTheses, eq(apertureRuns.thesisId, capitalTheses.id))
        .where(eq(apertureRuns.userId, ctx.user.id))
        .orderBy(desc(apertureRuns.createdAt))
        .limit(20);
      return rows.map(({ run, thesisName }) => ({ ...run, thesisName }));
    }),

    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        const [run] = await db!.select().from(apertureRuns)
          .where(and(eq(apertureRuns.id, input.id), eq(apertureRuns.userId, ctx.user.id)))
          .limit(1);
        if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
        const candidates = await db!.select().from(apertureCandidates)
          .where(eq(apertureCandidates.runId, input.id))
          .orderBy(desc(apertureCandidates.compositeScore));
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
      review: adminProcedure
        .input(z.object({
          runId: z.number(),
          candidateId: z.number(),
          checkLabel: z.string().min(2).max(255),
          status: z.enum(["reviewed", "needs_follow_up"]),
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
    retry: adminProcedure
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
    followUp: adminProcedure
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
    start: adminProcedure
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

  generateMemo: adminProcedure
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
    list: adminProcedure.query(async ({ ctx }) => {
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
        plays: rows.map(({ candidate, run, thesisName, thesisRawText }) => ({
        candidate,
        run,
        thesisName,
        thesisRawText,
        reviews: reviewsByCandidate.get(candidate.id) ?? [],
        decision: decisionByCandidate.get(candidate.id) ?? null,
        evidenceSummary: Array.isArray(candidate.verifyFields) && candidate.verifyFields.length
          ? `${candidate.verifyFields.length} decision-critical evidence check${candidate.verifyFields.length === 1 ? " remains" : "s remain"}.`
          : "No decision-critical evidence field was generated; current market conditions still require human confirmation.",
        })),
      };
    }),

    trigger: adminProcedure
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

    construct: adminProcedure
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

        const accounts = await db!.select().from(portfolioAccounts).where(eq(portfolioAccounts.userId, ctx.user.id));
        const account = row.run.accountId
          ? accounts.find((item) => item.id === row.run.accountId) ?? null
          : accounts.find((item) => item.isPaper && item.brokerId === "alpaca_paper")
            ?? accounts.find((item) => item.isPaper)
            ?? null;
        const now = Date.now();
        const sessionDayStartMs = startOfEtDay(now);
        const tape = sessionDayStartMs == null
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
        const play = constructPlay({
          symbol: row.candidate.symbol,
          side,
          holdingPeriod: row.run.holdingPeriod as any,
          bars: tape.bars,
          vwap,
          range,
          trigger,
          equityCents: account?.equityValueCents ?? null,
          sessionDayStartMs,
          catalystDeadlineAt: row.run.catalystDeadlineAt,
          advUsd,
          now,
        });
        const sideAssumption = row.candidate.playSide == null
          ? "direction was not modelled on this legacy candidate; this recipe assumes a long setup until an operator records otherwise"
          : null;
        return {
          play: {
            ...play,
            assumptions: sideAssumption ? [sideAssumption, ...play.assumptions] : play.assumptions,
            unavailableReasons: tape.unavailableReason ? [tape.unavailableReason, ...play.unavailableReasons] : play.unavailableReasons,
          },
          disclosure: CONSTRUCTED_PLAY_DISCLOSURE,
        };
      }),

    decide: adminProcedure
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
        return { ok: true };
      }),
  }),

  // ── Paper-play replay ledger ───────────────────────────────────────────────
  // Reconstructing a past run is explicitly marked historical. It is useful for
  // a postmortem, but cannot be represented as a live recommendation capture.
  ledger: router({
    list: adminProcedure.query(async ({ ctx }) => {
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

    portfolioImpactTrend: adminProcedure.query(async ({ ctx }) => {
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

    dailyRefreshSchedule: adminProcedure.query(async ({ ctx }) => {
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

    configureDailyRefresh: adminProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const [profile] = await db!.select({ taskUid: users.dailyOutcomeRefreshTaskUid })
          .from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const rawCookie = typeof ctx.req.headers.cookie === "string" ? ctx.req.headers.cookie : "";
        const sessionToken = parseCookie(rawCookie)[COOKIE_NAME] ?? "";
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

    oneTimeResearchSchedule: adminProcedure.query(async ({ ctx }) => {
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

    configureOneTimeGlp1Research: adminProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const [profile] = await db!.select({
          taskUid: users.oneTimeResearchTaskUid,
          activeCapitalThesisId: users.activeCapitalThesisId,
        }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const rawCookie = typeof ctx.req.headers.cookie === "string" ? ctx.req.headers.cookie : "";
        const sessionToken = parseCookie(rawCookie)[COOKIE_NAME] ?? "";
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

    availableCohorts: adminProcedure.query(async ({ ctx }) => {
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

    captureCurrentWindow: adminProcedure
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
        if (!rows.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "There are no active, non-expired Capital plays for this thesis to capture in this window." });
        }
        const accounts = await db!.select().from(portfolioAccounts).where(eq(portfolioAccounts.userId, ctx.user.id));
        const account = accounts.find((item) => item.isPaper && item.brokerId === "alpaca_paper") ?? accounts.find((item) => item.isPaper) ?? null;
        const held = account ? await db!.select().from(positions).where(eq(positions.accountId, account.id)) : [];
        const candidateIds = rows.map(({ candidate }) => candidate.id);
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

        const items = await Promise.all(rows.map(async ({ candidate, run }) => {
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

    recordSlateDecision: adminProcedure
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

    refreshLiveOutcomes: adminProcedure
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

    reconstructRecentRun: adminProcedure
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
    list: adminProcedure
      .input(z.object({ runId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        return db!.select().from(brokerOrders)
          .where(and(eq(brokerOrders.runId, input.runId), eq(brokerOrders.userId, ctx.user.id)))
          .orderBy(desc(brokerOrders.createdAt));
      }),

    create: adminProcedure
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

        // A candidate-originated proposal cannot skip the operator's recorded review
        // of the evidence questions that can change the decision. Manual paper orders
        // remain possible for operational uses without a research-candidate link.
        const evidenceBlock = await evidenceReviewBlock(db, ctx.user.id, input.runId, input.candidateId);
        if (evidenceBlock) throw new TRPCError({ code: "PRECONDITION_FAILED", message: evidenceBlock });

        try {
          const orderId = await createOrder({
            ...input,
            userId: ctx.user.id,
            portfolioRules: {
              maxSingleNamePct: run.maxSingleNamePct ?? null,
              minAvgDailyVolumeUsd: run.liquidityFloorAdvUsd ?? null,
            },
          });
          return { orderId };
        } catch (e: any) {
          if (e instanceof OrderGateError) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: e.message,
              cause: e,
            });
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
    preflight: adminProcedure
      .input(orderPreflightInput)
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        await requireAccount(db, input.accountId, ctx.user.id);

        const [run] = await db!.select().from(apertureRuns)
          .where(and(eq(apertureRuns.id, input.runId), eq(apertureRuns.userId, ctx.user.id)))
          .limit(1);
        if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });

        const evidenceBlock = await evidenceReviewBlock(db, ctx.user.id, input.runId, input.candidateId);

        // Everything create's own zod would refuse, as messages rather than a
        // 400 — a half-typed ticket must still get an answer about the mandate.
        const parsed = orderCreateInput.safeParse(input);
        const schemaErrors = parsed.success
          ? []
          : parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`);

        const { evaluation, gatedNotionalCents, notionalBasis, session } = await preflightOrder({
          ...input,
          userId: ctx.user.id,
          portfolioRules: {
            maxSingleNamePct: run.maxSingleNamePct ?? null,
            minAvgDailyVolumeUsd: run.liquidityFloorAdvUsd ?? null,
          },
        });

        const recipeGap = missingIntradayRecipeMessage(input);
        const blocking = [...evaluation.failures, ...schemaErrors, ...(recipeGap ? [recipeGap] : []), ...(evidenceBlock ? [evidenceBlock] : [])];
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

    approve: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return approveOrder(input.orderId, ctx.user.id);
      }),

    reject: adminProcedure
      .input(z.object({ orderId: z.number(), reason: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        await rejectOrder(input.orderId, ctx.user.id, input.reason);
        return { ok: true };
      }),

    submit: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return submitBrokerOrder(input.orderId, ctx.user.id);
      }),

    mirrorFills: adminProcedure
      .mutation(async ({ ctx }) => {
        const updated = await mirrorFills(ctx.user.id);
        return { updated };
      }),
  }),

  // ── Monitoring ─────────────────────────────────────────────────────────────

  monitor: router({
    run: adminProcedure
      .input(z.object({
        runId: z.number(),
        candidateId: z.number(),
        symbol: z.string(),
        thesisSummary: z.string(),
        checkTypes: z.array(z.enum(["catalyst", "thesis_invalidation", "earnings", "macro"])).optional(),
      }))
      .mutation(async ({ input }) => {
        return runMonitoringChecks(
          input.runId,
          input.candidateId,
          input.symbol,
          input.thesisSummary,
          input.checkTypes,
        );
      }),

    list: adminProcedure
      .input(z.object({ runId: z.number() }))
      .query(async ({ input }) => getMonitoringChecks(input.runId)),

    flagged: adminProcedure
      .input(z.object({ runId: z.number() }))
      .query(async ({ input }) => getFlaggedChecks(input.runId)),
  }),

  // ── Aperture Alpha ─────────────────────────────────────────────────────────

  alpha: router({
    compute: adminProcedure
      .input(z.object({ runId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return computeAlpha(input.runId, ctx.user.id);
      }),

    get: adminProcedure
      .input(z.object({ runId: z.number() }))
      .query(async ({ input }) => getAlpha(input.runId)),
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
    const graph = withPresetRules(thesis.graph as any, input);
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
    const universe = await discoverUniverse(nodeRows, summary, known);
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
      holdingPeriod: input.holdingPeriod != null && ["intraday", "overnight", "swing", "catalyst_window"].includes(input.holdingPeriod)
        ? input.holdingPeriod as "intraday" | "overnight" | "swing" | "catalyst_window"
        : null,
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
