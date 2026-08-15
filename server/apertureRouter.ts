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
import { eq, and, inArray } from "drizzle-orm";
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
} from "../drizzle/schema";
import { adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { compileThesis, flattenExposureTree } from "./aperture/thesisGraph";
import { discoverUniverse, thesisSummary } from "./aperture/universe";
import { collectSecurityFacts, describeAvailability, availabilityMap } from "./aperture/providers/index";
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
import { createOrder, approveOrder, rejectOrder, submitOrder as submitBrokerOrder, mirrorFills, OrderGateError } from "./aperture/orderFlow";
import { evaluateRunPreset } from "./aperture/gates";
import { CURRENT_MANDATE, HOLDING_PERIOD_KEYS, MIN_NARRATIVE_CHARS, PAPER_ACKNOWLEDGEMENT } from "./aperture/mandate";
import { runMonitoringChecks, getMonitoringChecks, getFlaggedChecks } from "./aperture/monitor";
import { computeAlpha, getAlpha } from "./aperture/alpha";
import { brokerOrders, monitoringChecks } from "../drizzle/schema";
import { desc } from "drizzle-orm";
import { buildCapitalDecisionBrief } from "./aperture/decisionBrief";

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
        const [result] = await db!.insert(capitalTheses).values({
          userId: ctx.user.id,
          name: input.name ?? null,
          rawText: input.rawText,
          status: "compiling",
          createdAt: now,
          updatedAt: now,
        });
        return { id: (result as any).insertId as number };
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

        const [acctData, posData] = await Promise.all([
          broker.getAccount(),
          broker.getPositions(),
        ]);

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
        return row;
      }),
  }),

  // ── Run lifecycle ──────────────────────────────────────────────────────────

  run: router({
    list: adminProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      return db!.select().from(apertureRuns)
        .where(eq(apertureRuns.userId, ctx.user.id))
        .orderBy(desc(apertureRuns.createdAt))
        .limit(20);
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
        const strategies = await db!.select().from(apertureStrategies)
          .where(eq(apertureStrategies.runId, input.id));
        const coverage = await db!.select().from(exposureCoverage)
          .where(eq(exposureCoverage.runId, input.id));
        const thesis = await requireThesis(db, run.thesisId, ctx.user.id);
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
        return { run, candidates, strategies, coverage, coverageDetail, thesisNodes, brief };
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
        const thesis = await requireThesis(db, input.thesisId, ctx.user.id);
        if (!thesis.graph) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Thesis must be compiled before running" });
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
      // This schema checks PRESENCE, not policy. The ceilings are enforced in
      // orderFlow.createOrder — the only layer that can see the account, the
      // positions and the fact ledger at once, and the layer every non-router
      // caller also goes through. Duplicating the numbers here would give two
      // places to change them and one of them would drift.
      .input(z.object({
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
        holdingPeriod: z.enum(HOLDING_PERIOD_KEYS as [string, ...string[]]),
        catalystDeadlineAt: z.number(),
        paperAcknowledgement: z.literal(PAPER_ACKNOWLEDGEMENT),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        await requireAccount(db, input.accountId, ctx.user.id);

        // A run's own preset tightens the mandate for orders placed under it.
        const [run] = await db!.select().from(apertureRuns)
          .where(and(eq(apertureRuns.id, input.runId), eq(apertureRuns.userId, ctx.user.id)))
          .limit(1);
        if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });

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
    await setStatus("researching", {
      universeCount: universe.discovered.length,
      droppedNote: universe.droppedNote,
    });

    // ── 4. Research swarm ──────────────────────────────────────────────────
    const symbols = universe.discovered.map((d) => d.symbol);
    await runResearchSwarm(symbols, { concurrency: 4 });

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
      discovered: universe.discovered,
      factsBySymbol,
      holdings,
      cashCents: holdingRows.reduce((s, p) => s + (p.marketValueCents ?? 0), 0),
      deployableCapitalCents: input.deployableCapitalCents,
      intendedTrades: input.intendedTrades,
      hurdleRateBps: input.hurdleRateBps,
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
