import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { getDb } from "./db";
import { consensusScores, sellerSimulations, dealTrajectory, deals } from "../drizzle/schema";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, operatorProcedure,
  protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getDeals, getDealById, createDeal, updateDealStage, updateDealScore, getDealStats,
  getSignalByDealId, upsertSignal,
  getMemos, getMemoByDealId, createMemo,
  getOutreach, getOutreachByDealId, createOutreach, updateOutreachStatus, getOutreachStats,
  getActivityLog, logActivity,
  getLatestScanJob, createScanJob, updateScanJob,
  getModelConfig, getAllModelConfigs, upsertModelConfig,
  getDealIdByNameSource,
} from "./db";
import { MODEL_CATALOG, DEFAULT_MODULE_MODELS, GEMINI_STRONG, GEMINI_FAST, VALID_GEMINI_IDS, toValidGeminiId, type AnalysisModule } from "../shared/models";
import {
  analyzeOwnerPsychology, runDigitalAudit, runRedTeamAnalysis,
  buildCapitalStack, generateInvestmentMemo, scoreDeal,
} from "./gemini";
import { enrichDealWithOZTAD } from "./ozTadEnrichment";
import { poeChat, POE_MODELS } from "./poe";
import { thesisRouter } from "./thesisRouter";
import { tideRouter } from "./tideRouter";
import { insuranceRouter } from "./insuranceRouter";
import { inviteRouter } from "./inviteRouter";
import { stackRouter } from "./stackRouter";
import { rippleRouter } from "./rippleRouter";
import { agentRouter } from "./routers/agentRouter";
import { rolePermissionsRouter } from "./rolePermissionsRouter";
import { researchRouter } from "./routers/research";
import { apertureRouter } from "./apertureRouter";

export const appRouter = router({
  system: systemRouter,
  agent: agentRouter,
  aperture: apertureRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  user: router({
    // Returns onboarding status for the current user
    onboardingStatus: protectedProcedure.query(async ({ ctx }) => {
      const db = await (await import("./db")).getDb();
      if (!db) return { completed: false };
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [row] = await db.select({ onboardingCompleted: users.onboardingCompleted })
        .from(users)
        .where(eq(users.openId, ctx.user.openId))
        .limit(1);
      return { completed: row?.onboardingCompleted ?? false };
    }),

    // Marks onboarding as complete for the current user
    markOnboardingComplete: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await (await import("./db")).getDb();
      if (!db) return { success: false };
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(users)
        .set({ onboardingCompleted: true })
        .where(eq(users.openId, ctx.user.openId));
      return { success: true };
    }),

    // Resets onboarding so the user sees the lobby again on next visit
    resetOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await (await import("./db")).getDb();
      if (!db) return { success: false };
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(users)
        .set({ onboardingCompleted: false })
        .where(eq(users.openId, ctx.user.openId));
      return { success: true };
    }),
    // Returns the current user's full profile including hunting params
    getProfile: protectedProcedure.query(async ({ ctx }) => {
      const db = await (await import("./db")).getDb();
      if (!db) return null;
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [row] = await db.select().from(users).where(eq(users.openId, ctx.user.openId)).limit(1);
      return row ?? null;
    }),
    // Saves the user's agentic hunting parameters (free-text command)
    saveHuntingParams: protectedProcedure
      .input(z.object({ params: z.string().max(2000) }))
      .mutation(async ({ input, ctx }) => {
        const db = await (await import("./db")).getDb();
        if (!db) return { success: false };
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(users)
          .set({ huntingParams: input.params, updatedAt: new Date() })
          .where(eq(users.openId, ctx.user.openId));
        return { success: true };
      }),
  }),

  dashboard: router({
    stats: publicProcedure.query(async () => {
      const [dealStats, outreachStats, recentActivity, latestScan] = await Promise.all([
        getDealStats(), getOutreachStats(), getActivityLog(8), getLatestScanJob(),
      ]);
      return { dealStats, outreachStats, recentActivity, latestScan };
    }),
    macroPosture: publicProcedure.query(async () => {
      const { getMacroSignals } = await import('./db');
      const signals = await getMacroSignals(20);
      const now = Date.now();
      // Filter to active (non-archived, non-expired) signals only
      const active = signals.filter((s: any) => {
        if (s.archived) return false;
        if (s.expiresAt && s.expiresAt < now) return false;
        return true;
      });
      const tailwinds = active.filter((s: any) => s.direction !== 'headwind');
      const headwinds = active.filter((s: any) => s.direction === 'headwind');
      // Weighted confidence sum
      const tailwindScore = tailwinds.reduce((sum: number, s: any) => sum + (s.confidenceScore ?? 0.5), 0);
      const headwindScore = headwinds.reduce((sum: number, s: any) => sum + (s.confidenceScore ?? 0.5), 0);
      // Posture: AGGRESSIVE if tailwinds dominate, DEFENSIVE if headwinds dominate, ACTIVE otherwise
      let posture: 'AGGRESSIVE' | 'ACTIVE' | 'DEFENSIVE' | 'MONITORING' = 'MONITORING';
      if (active.length === 0) posture = 'MONITORING';
      else if (headwindScore > tailwindScore * 1.5) posture = 'DEFENSIVE';
      else if (tailwindScore > headwindScore * 1.5 && tailwinds.length >= 2) posture = 'AGGRESSIVE';
      else if (active.length > 0) posture = 'ACTIVE';
      // Top 2 signals for TIDE ticker (highest confidence, prioritize tailwinds)
      const sorted = [...active].sort((a: any, b: any) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0));
      const topSignals = sorted.slice(0, 2).map((s: any) => ({
        id: s.id,
        title: s.title,
        signalType: s.signalType,
        direction: (s.direction as string) ?? 'tailwind',
        confidenceScore: s.confidenceScore ?? 0.5,
        roryPitch: s.roryPitch,
      }));
      return {
        posture,
        tailwindCount: tailwinds.length,
        headwindCount: headwinds.length,
        totalActive: active.length,
        topSignals,
      };
    }),
  }),

  deals: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }).optional())
      .query(async ({ input }) => getDeals(input ?? {})),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const deal = await getDealById(input.id);
        if (!deal) return null;
        const [signal, memo, contacts] = await Promise.all([
          getSignalByDealId(input.id),
          getMemoByDealId(input.id),
          getOutreachByDealId(input.id),
        ]);
        return { deal, signal, memo, contacts };
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        source: z.string().optional(),
        description: z.string().optional(),
        industry: z.string().optional(),
        location: z.string().optional(),
        askingPrice: z.number().optional(),
        revenue: z.number().optional(),
        cashFlow: z.number().optional(),
        ebitda: z.number().optional(),
        multiple: z.number().optional(),
        employees: z.number().optional(),
        yearEstablished: z.number().optional(),
        listingUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await createDeal({ ...input, stage: "new" });
        await logActivity({ type: "deal_added", title: `New deal added: ${input.name}`, detail: input.location });
        return { success: true };
      }),

    updateStage: protectedProcedure
      .input(z.object({
        id: z.number(),
        stage: z.enum(["new","scanning","qualified","high_priority","in_diligence","loi_sent","under_contract","closed","passed"]),
      }))
      .mutation(async ({ input }) => {
        await updateDealStage(input.id, input.stage);
        const deal = await getDealById(input.id);
        await logActivity({ dealId: input.id, type: "stage_changed", title: `${deal?.name ?? "Deal"} moved to ${input.stage.replace(/_/g, " ")}` });
        return { success: true };
      }),

    score: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const deal = await getDealById(input.id);
        if (!deal) throw new Error("Deal not found");
        const { score, redFlagCount } = await scoreDeal(deal);
        await updateDealScore(input.id, score, redFlagCount);
        await logActivity({ dealId: input.id, type: "deal_scored", title: `${deal.name} scored: ${score.toFixed(3)}` });
        return { score, redFlagCount };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { deals: dealsTable } = await import("../drizzle/schema");
        await db.delete(dealsTable).where(eq(dealsTable.id, input.id));
        await logActivity({ type: "deal_added", title: `Deal #${input.id} deleted by operator` });
        return { success: true };
      }),
    // Bulk-clear deals: purge synthetic Market Scan rows, specific ids, or all.
    bulkDelete: protectedProcedure
      .input(z.object({ ids: z.array(z.number().int()).optional(), all: z.boolean().optional(), syntheticOnly: z.boolean().optional(), confirm: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        if (input.all && !input.confirm) throw new TRPCError({ code: "BAD_REQUEST", message: "Deleting all deals requires confirm:true" });
        const { bulkDeleteDeals } = await import("./db");
        const n = await bulkDeleteDeals({ ids: input.ids, all: input.all, syntheticOnly: input.syntheticOnly });
        return { deleted: n };
      }),

    velocity: publicProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return [];
        // Get deals created in the last 8 weeks, grouped by ISO week
        const rows = await db.execute(
          sql`SELECT
            YEARWEEK(createdAt, 1) AS yw,
            MIN(createdAt) AS week_start,
            COUNT(*) AS cnt
          FROM deals
          WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 8 WEEK)
          GROUP BY yw
          ORDER BY yw ASC`
        );
        // db.execute returns [rows, fields] tuple — extract the rows array
        const rowsArr = Array.isArray((rows as any)[0]) ? (rows as any)[0] : (rows as any);
        const data = (rowsArr as any[]).map((r: any) => {
          // week_start may be a MySQL Date object or a BigInt/number — handle all cases
          let weekStartMs: number;
          if (r.week_start instanceof Date) {
            weekStartMs = r.week_start.getTime();
          } else if (typeof r.week_start === 'bigint') {
            weekStartMs = Number(r.week_start);
          } else if (typeof r.week_start === 'string') {
            weekStartMs = new Date(r.week_start).getTime();
          } else {
            weekStartMs = Number(r.week_start);
          }
          const weekLabel = !isNaN(weekStartMs) && weekStartMs > 0
            ? new Date(weekStartMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : `Wk ${String(r.yw).slice(-2)}`; // fallback: "Wk 17"
          return {
            week: weekLabel,
            count: Number(r.cnt) || 0,
          };
        });
        return data;
      }),
  }),
  publicDeals: router({
    // Sanitized, limited deal search for unauthenticated visitors.
    // Returns only name, industry, location, and a blurred score — no financials.
    search: publicProcedure
      .input(z.object({ q: z.string().optional(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { results: [], total: 0 };
        const limit = Math.min(input.limit ?? 6, 12);
        const q = (input.q ?? "").trim();
        const rows = await db.execute(
          q
            ? sql`SELECT id, name, industry, location, stage, score FROM deals
                  WHERE (name LIKE ${`%${q}%`} OR industry LIKE ${`%${q}%`} OR location LIKE ${`%${q}%`})
                  AND is_archived = 0
                  ORDER BY score DESC LIMIT ${limit}`
            : sql`SELECT id, name, industry, location, stage, score FROM deals
                  WHERE is_archived = 0
                  ORDER BY score DESC LIMIT ${limit}`
        );
        const rowsArr = Array.isArray((rows as any)[0]) ? (rows as any)[0] : (rows as any);
        // Sanitize: blur exact score (round to 1 decimal), strip financials
        const results = (rowsArr as any[]).map((r: any) => ({
          id: Number(r.id),
          name: String(r.name ?? ""),
          industry: String(r.industry ?? "Service Business"),
          location: String(r.location ?? "Southeast US"),
          stage: String(r.stage ?? "new"),
          scoreBlurred: r.score != null ? Math.round(Number(r.score) * 10) / 10 : null,
        }));
        // Count total
        const countRow = await db.execute(sql`SELECT COUNT(*) as cnt FROM deals WHERE is_archived = 0`);
        const countArr = Array.isArray((countRow as any)[0]) ? (countRow as any)[0] : (countRow as any);
        const total = Number((countArr as any[])[0]?.cnt ?? 0);
        return { results, total };
      }),
  }),

  publicAccess: router({
    // Captures an inbound access request from the landing page.
    // Saves to DB and pings the owner via notifyOwner.
    requestAccess: publicProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        email: z.string().email().max(255),
        dealThesis: z.string().max(2000).optional(),
        capitalAccess: z.string().max(100).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { accessRequests } = await import("../drizzle/schema");
        await db.insert(accessRequests).values({
          name: input.name,
          email: input.email,
          dealThesis: input.dealThesis ?? null,
          capitalAccess: input.capitalAccess ?? null,
          status: "pending",
        });
        try {
          const { notifyOwner } = await import("./_core/notification");
          await notifyOwner({
            title: `New Access Request — ${input.name}`,
            content: `Name: ${input.name}\nEmail: ${input.email}\nCapital Access: ${input.capitalAccess ?? "Not specified"}\n\nDeal Thesis:\n${input.dealThesis ?? "Not provided"}`,
          });
        } catch {}
        return { success: true };
      }),
  }),

  demo: router({
    // Returns the active demo scenario for public consumption
    getActive: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.execute(
        sql`SELECT * FROM demo_scenarios WHERE is_active = 1 ORDER BY snapshot_at DESC LIMIT 1`
      );
      const rowsArr = Array.isArray((rows as any)[0]) ? (rows as any)[0] : (rows as any);
      const row = (rowsArr as any[])[0];
      if (!row) return null;
      return {
        id: Number(row.id),
        thesisTitle: String(row.thesis_title ?? ""),
        thesisSummary: row.thesis_summary ? String(row.thesis_summary) : null,
        businessName: String(row.business_name ?? ""),
        industry: row.industry ? String(row.industry) : null,
        location: row.location ? String(row.location) : null,
        revenue: row.revenue ? Number(row.revenue) : null,
        cashFlow: row.cash_flow ? Number(row.cash_flow) : null,
        askingPrice: row.asking_price ? Number(row.asking_price) : null,
        multiple: row.multiple ? Number(row.multiple) : null,
        employees: row.employees ? Number(row.employees) : null,
        yearEstablished: row.year_established ? Number(row.year_established) : null,
        score: row.score ? Number(row.score) : null,
        scoreBreakdown: row.score_breakdown ? (typeof row.score_breakdown === 'string' ? JSON.parse(row.score_breakdown) : row.score_breakdown) : null,
        signals: row.signals ? (typeof row.signals === 'string' ? JSON.parse(row.signals) : row.signals) : null,
        icSummary: row.ic_summary ? String(row.ic_summary) : null,
        investmentThesis: row.investment_thesis ? String(row.investment_thesis) : null,
        keyRisks: row.key_risks ? (typeof row.key_risks === 'string' ? JSON.parse(row.key_risks) : row.key_risks) : null,
        catalysts: row.catalysts ? (typeof row.catalysts === 'string' ? JSON.parse(row.catalysts) : row.catalysts) : null,
        snapshotAt: row.snapshot_at ? new Date(row.snapshot_at) : new Date(),
        dataSourcesUsed: row.data_sources_used ? (typeof row.data_sources_used === 'string' ? JSON.parse(row.data_sources_used) : row.data_sources_used) : null,
      };
    }),

    // Operator-only: regenerate the demo scenario with fresh AI analysis
    refresh: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { invokeLLM } = await import('./_core/llm');

      // Generate fresh scenario via LLM
      const result = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `You are a business acquisition analyst. Generate a realistic, detailed demo scenario for a small-to-medium business acquisition opportunity. Use real market dynamics, real industry data, and realistic financials. This will be shown publicly as a live thesis example.`,
          },
          {
            role: 'user',
            content: `Generate a fresh acquisition thesis scenario for a business in the Southeast US (Atlanta, Charlotte, Nashville, or Dallas area). Pick a high-cash-flow service business (commercial cleaning, HVAC, pest control, logistics, or similar). Make the data realistic and current as of ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}. Return JSON matching this exact schema: { thesisTitle, thesisSummary, businessName, industry, location, revenue, cashFlow, askingPrice, multiple, employees, yearEstablished, score (0-1 float), scoreBreakdown: { financialHealth, marketPosition, operationalRisk, growthPotential, sbaEligibility, ownerDependency } (each 0-1), signals: [{ type: 'tailwind'|'headwind'|'neutral', title, summary, source, relevanceScore }] (5-7 signals), icSummary (2-3 paragraph IC committee summary), investmentThesis (1 paragraph), keyRisks (array of 3-5 strings), catalysts (array of 3-5 strings), dataSourcesUsed (array of source names) }`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      let parsed: any;
      try {
        const content = result?.choices?.[0]?.message?.content ?? '{}';
        parsed = typeof content === 'string' ? JSON.parse(content) : content;
      } catch {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to parse LLM response' });
      }

      // Deactivate old scenarios
      await db.execute(sql`UPDATE demo_scenarios SET is_active = 0`);

      // Insert new scenario
      await db.execute(
        sql`INSERT INTO demo_scenarios (
          thesis_title, thesis_summary, business_name, industry, location,
          revenue, cash_flow, asking_price, multiple, employees, year_established,
          score, score_breakdown, signals, ic_summary, investment_thesis,
          key_risks, catalysts, data_sources_used, snapshot_at, is_active
        ) VALUES (
          ${parsed.thesisTitle ?? 'Atlanta Service Business Acquisition Thesis'},
          ${parsed.thesisSummary ?? null},
          ${parsed.businessName ?? 'Southeast Service Co.'},
          ${parsed.industry ?? 'Commercial Services'},
          ${parsed.location ?? 'Atlanta, GA'},
          ${parsed.revenue ?? null},
          ${parsed.cashFlow ?? null},
          ${parsed.askingPrice ?? null},
          ${parsed.multiple ?? null},
          ${parsed.employees ?? null},
          ${parsed.yearEstablished ?? null},
          ${parsed.score ?? null},
          ${JSON.stringify(parsed.scoreBreakdown ?? null)},
          ${JSON.stringify(parsed.signals ?? [])},
          ${parsed.icSummary ?? null},
          ${parsed.investmentThesis ?? null},
          ${JSON.stringify(parsed.keyRisks ?? [])},
          ${JSON.stringify(parsed.catalysts ?? [])},
          ${JSON.stringify(parsed.dataSourcesUsed ?? [])},
          NOW(),
          1
        )`
      );

      return { success: true, refreshedAt: new Date() };
    }),
  }),

  signals: router({
    getByDealId: publicProcedure
      .input(z.object({ dealId: z.number() }))
      .query(async ({ input }) => getSignalByDealId(input.dealId)),

    analyze: protectedProcedure
      .input(z.object({
        dealId: z.number(),
        modules: z.array(z.enum(["psychology","digital","redteam","capital"])).optional(),
        force: z.boolean().optional(), // force=true bypasses cache and re-generates
      }))
      .mutation(async ({ input }) => {
        const deal = await getDealById(input.dealId);
        if (!deal) throw new Error("Deal not found");

        // Cache-first: if signal exists and force is not set, return cached result
        if (!input.force) {
          const cached = await getSignalByDealId(input.dealId);
          if (cached) {
            return { success: true, cached: true, psychology: null, digital: null, redteam: null, capital: null };
          }
        }

        const modules = input.modules ?? ["psychology","digital","redteam","capital"];
        const [psychology, digital, redteam, capital] = await Promise.all([
          modules.includes("psychology") ? analyzeOwnerPsychology(deal) : Promise.resolve(null),
          modules.includes("digital") ? runDigitalAudit(deal) : Promise.resolve(null),
          modules.includes("redteam") ? runRedTeamAnalysis(deal) : Promise.resolve(null),
          modules.includes("capital") ? buildCapitalStack(deal) : Promise.resolve(null),
        ]);
        const signalData = {
          dealId: input.dealId,
          ...(psychology && {
            ownerDistressScore: psychology.distressScore,
            ownerRetirementSignal: psychology.retirementSignal,
            ownerNegotiationStyle: psychology.negotiationStyle,
            ownerProfileSummary: psychology.profileSummary,
          }),
          ...(digital && {
            techDebtScore: digital.techDebtScore,
            digitalGrowthTrend: digital.growthTrend,
            seoAuthorityScore: digital.seoAuthorityScore,
            reviewSentimentScore: digital.reviewSentimentScore,
            digitalAuditSummary: digital.auditSummary,
          }),
          ...(redteam && {
            killProbability: redteam.killProbability,
            redFlags: redteam.redFlags,
            redTeamSummary: redteam.summary,
          }),
          ...(capital && {
            sbaEligible: capital.sbaEligible,
            recommendedSbaAmount: capital.sbaAmount,
            recommendedSellerNote: capital.sellerNote,
            recommendedEquity: capital.equity,
            dscr: capital.dscr,
            cashOnCashReturn: capital.cashOnCashReturn,
            capitalStackSummary: capital.summary,
          }),
          modelVersions: { psychology: "claude-opus-4", digital: "claude-opus-4", redteam: GEMINI_STRONG, capital: GEMINI_FAST },
        };
        await upsertSignal(signalData);
        await logActivity({
          dealId: input.dealId,
          type: redteam && redteam.killProbability > 0.7 ? "red_flag_detected" : "signal_analyzed",
          title: redteam && redteam.killProbability > 0.7
            ? `Red flags detected for ${deal.name}`
            : `Third Signal analysis complete for ${deal.name}`,
          detail: redteam?.redFlags?.join(", "),
        });
        return { success: true, psychology, digital, redteam, capital };
      }),
  }),

  memos: router({
    list: publicProcedure.query(async () => getMemos()),

    getByDealId: publicProcedure
      .input(z.object({ dealId: z.number() }))
      .query(async ({ input }) => getMemoByDealId(input.dealId)),

    generate: protectedProcedure
      .input(z.object({ dealId: z.number(), force: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const deal = await getDealById(input.dealId);
        if (!deal) throw new Error("Deal not found");

        // Cache-first: return existing memo unless force=true.
        // A previous bug persisted failed generations as memos ("Generation
        // failed" content) — treat those as absent so regeneration self-heals.
        if (!input.force) {
          const existingMemo = await getMemoByDealId(input.dealId);
          const isPoisoned =
            existingMemo?.content?.includes("Memo generation failed") ||
            existingMemo?.executiveSummary === "Generation failed.";
          if (existingMemo && !isPoisoned) {
            return { success: true, cached: true, memo: existingMemo };
          }
        }

        const signal = await getSignalByDealId(input.dealId);
        const memo = await generateInvestmentMemo(deal, {
          ownerProfile: signal?.ownerProfileSummary ?? undefined,
          digitalAudit: signal?.digitalAuditSummary ?? undefined,
          redTeam: signal?.redTeamSummary ?? undefined,
          capitalStack: signal?.capitalStackSummary ?? undefined,
        });
        const existingMemo = await getMemoByDealId(input.dealId);
        await createMemo({
          dealId: input.dealId,
          title: memo.title,
          content: memo.content,
          executiveSummary: memo.executiveSummary,
          investmentThesis: memo.investmentThesis,
          riskFactors: memo.riskFactors,
          aiOptimizationOpportunities: memo.aiOptimizationOpportunities,
          generatedBy: GEMINI_STRONG,
          version: (existingMemo?.version ?? 0) + 1,
        });
        await logActivity({ dealId: input.dealId, type: "memo_generated", title: `Investment memo generated for ${deal.name}` });
        return { success: true, memo };
      }),
  }),

  outreach: router({
    list: publicProcedure.query(async () => getOutreach()),

    getByDealId: publicProcedure
      .input(z.object({ dealId: z.number() }))
      .query(async ({ input }) => getOutreachByDealId(input.dealId)),

    create: protectedProcedure
      .input(z.object({
        dealId: z.number(),
        contactName: z.string().optional(),
        contactRole: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
        channel: z.string().optional(),
        subject: z.string().optional(),
        body: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await createOutreach({ ...input, channel: (input.channel ?? "email") as "email"|"phone"|"linkedin"|"sms", status: "pending" });
        return { success: true };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending","sent","opened","replied","meeting_scheduled","no_response","not_interested","closed"]),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateOutreachStatus(input.id, input.status, input.notes);
        if (input.status === "sent") {
          await logActivity({ type: "outreach_sent", title: "Outreach email sent" });
        }
        return { success: true };
      }),
  }),

  activity: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => getActivityLog(input?.limit ?? 20)),
  }),

  scan: router({
    getLatest: publicProcedure.query(async () => getLatestScanJob()),

    // Poll a specific scan job for real-time progress
    getStatus: publicProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
        const db = await import("./db").then((m) => m.getDb());
        if (!db) return null;
        const { scanJobs } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const result = await db.select().from(scanJobs).where(eq(scanJobs.id, input.jobId)).limit(1);
        return result[0] ?? null;
      }),


    trigger: protectedProcedure
      .input(z.object({
        sources: z.array(z.string()).optional(),
        minCashFlow: z.number().optional(),
        maxMultiple: z.number().optional(),
        targetLocations: z.array(z.string()).optional(),
      }).optional())
      .mutation(async ({ input }) => {
        const sources = input?.sources ?? ["bizbuysell","dealstream","flippa","quietlight","empireflippers"];
        const minCashFlow = input?.minCashFlow ?? 500000;
        const maxMultiple = input?.maxMultiple ?? 6;
        const targetLocations = input?.targetLocations ?? [];

        // Create the scan job record immediately so the UI can poll it
        const insertResult = await createScanJob({
          status: "running",
          sources,
          startedAt: new Date(),
          currentPhase: "Initializing scan engine",
          phaseDetail: `Connecting to ${sources.length} marketplace${sources.length > 1 ? "s" : ""}`,
          progressPct: 2,
        });
        const jobId = (insertResult as any)[0].insertId as number;

        // Run the full pipeline asynchronously — don't await, return immediately
        runScanPipeline(jobId, sources, minCashFlow, maxMultiple, targetLocations).catch((err) => {
          console.error("[Scan] Pipeline failed:", err);
          updateScanJob(jobId, {
            status: "failed",
            errorMessage: err?.message ?? "Unknown error",
            completedAt: new Date(),
            currentPhase: "Failed",
            progressPct: 0,
          }).catch(() => {});
        });

        return { success: true, jobId, message: `Scanning ${sources.length} marketplace${sources.length > 1 ? "s" : ""}…` };
      }),
  }),

  models: router({
    // List all available models from the catalog
    catalog: publicProcedure.query(async () => MODEL_CATALOG),

    // Get current per-module config (merged with defaults)
    config: publicProcedure.query(async () => {
      const saved = await getAllModelConfigs();
      const defaults = DEFAULT_MODULE_MODELS;
      const result: Record<string, { modelId: string; enabled: boolean }> = {};
      for (const [module, defaultModel] of Object.entries(defaults)) {
        const saved_entry = saved.find((r) => r.module === module);
        result[module] = {
          modelId: saved_entry?.modelId ?? defaultModel,
          enabled: saved_entry?.enabled ?? true,
        };
      }
      return result;
    }),

    // Update a single module's model selection
    update: protectedProcedure
      .input(z.object({
        module: z.string(),
        modelId: z.string(),
        enabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await upsertModelConfig(
          input.module as AnalysisModule,
          input.modelId,
          input.enabled ?? true
        );
        await logActivity({
          type: "system",
          title: `AI model updated: ${input.module} → ${input.modelId}`,
        });
        return { success: true };
      }),

    // Reset all modules to defaults
    resetDefaults: protectedProcedure.mutation(async () => {
      for (const [module, modelId] of Object.entries(DEFAULT_MODULE_MODELS)) {
        await upsertModelConfig(module as AnalysisModule, modelId, true);
      }
      // Reset consensus models to defaults
      await upsertModelConfig("consensus_model_1" as AnalysisModule, GEMINI_STRONG, true);
      await upsertModelConfig("consensus_model_2" as AnalysisModule, GEMINI_FAST, true);
      await upsertModelConfig("consensus_model_3" as AnalysisModule, GEMINI_FAST, true);
      return { success: true };
    }),

    // Get/set the 3 models used for consensus scoring
    consensusConfig: publicProcedure.query(async () => {
      const saved = await getAllModelConfigs();
      const defaults = {
        consensus_model_1: GEMINI_STRONG,
        consensus_model_2: GEMINI_FAST,
        consensus_model_3: GEMINI_FAST,
      };
      const result: Record<string, string> = {};
      for (const [key, defaultModel] of Object.entries(defaults)) {
        const entry = saved.find((r) => r.module === key);
        // Coerce stale pre-policy IDs (e.g. gemini-2.5-pro) to the default so
        // the Settings UI never shows a model the key can't actually run.
        result[key] = toValidGeminiId(entry?.modelId, defaultModel);
      }
      return result;
    }),

    updateConsensus: protectedProcedure
      .input(z.object({
        model1: z.string().refine((m) => VALID_GEMINI_IDS.has(m), { message: "Model not valid on the production key" }),
        model2: z.string().refine((m) => VALID_GEMINI_IDS.has(m), { message: "Model not valid on the production key" }),
        model3: z.string().refine((m) => VALID_GEMINI_IDS.has(m), { message: "Model not valid on the production key" }),
      }))
      .mutation(async ({ input }) => {
        await upsertModelConfig("consensus_model_1" as AnalysisModule, input.model1, true);
        await upsertModelConfig("consensus_model_2" as AnalysisModule, input.model2, true);
        await upsertModelConfig("consensus_model_3" as AnalysisModule, input.model3, true);
        await logActivity({ type: "system", title: `Consensus models updated: ${input.model1} · ${input.model2} · ${input.model3}` });
        return { success: true };
      }),
  }),

  // ─── Freedom Map ─────────────────────────────────────────────────────────────
  freedomMap: router({
    list: publicProcedure.query(async () => {
      const db = await import("./db").then((m) => m.getDb());
      if (!db) return [];
      const { freedomGoals } = await import("../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      return db.select().from(freedomGoals).orderBy(desc(freedomGoals.createdAt)).limit(10);
    }),

    generate: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        targetMonthlyIncome: z.number(),
        currentIncome: z.number().optional(),
        investmentCapital: z.number().optional(),
        timelineYears: z.number().default(3),
        riskTolerance: z.enum(["conservative", "moderate", "aggressive"]).default("moderate"),
        location: z.string().optional(),
        situation: z.enum(["single", "married", "family"]).default("single"),
        age: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { invokeLLM } = await import("./_core/llm");
        const prompt = `You are a Mainstreet Investor AI advisor. Generate a personalized portfolio recipe to achieve the user's financial freedom goal.

User Profile:
- Target Monthly Income: $${input.targetMonthlyIncome.toLocaleString()}
- Current Income: $${(input.currentIncome ?? 0).toLocaleString()}
- Investment Capital: $${(input.investmentCapital ?? 0).toLocaleString()}
- Timeline: ${input.timelineYears} years
- Risk Tolerance: ${input.riskTolerance}
- Location: ${input.location ?? "Not specified"}
- Situation: ${input.situation}
- Age: ${input.age ?? "Not specified"}

Generate a JSON response with this exact structure:
{
  "recipe": [
    {
      "type": "sba_business" | "rental" | "flip" | "microloan" | "land_play" | "parking_arbitrage" | "tad_hold",
      "label": "Human-readable label",
      "description": "Why this fits the goal",
      "estimatedMonthlyIncome": number,
      "estimatedInvestment": number,
      "timelineMonths": number,
      "priority": 1-5
    }
  ],
  "totalProjectedMonthly": number,
  "totalInvestmentRequired": number,
  "milestones": [
    { "month": number, "title": "Milestone title", "monthlyIncome": number, "description": "What this unlocks" }
  ],
  "rationale": "2-3 sentence explanation of why this blend works for this profile",
  "agentMessage": "A warm, confident message from the AI advisor to the user about their path"
}`;

        let aiResult: any = null;
        try {
          const res = await invokeLLM({
            messages: [
              { role: "system", content: "You are a Mainstreet Investor AI. Always respond with valid JSON only." },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" } as any,
          });
          const content = (res as any).choices?.[0]?.message?.content ?? "{}";
          aiResult = JSON.parse(content);
        } catch (e) {
          // Fallback recipe
          aiResult = {
            recipe: [
              { type: "sba_business", label: "SBA-Backed Service Business", description: "Stable cash flow, SBA 7(a) financing", estimatedMonthlyIncome: Math.round(input.targetMonthlyIncome * 0.5), estimatedInvestment: Math.round((input.investmentCapital ?? 200000) * 0.6), timelineMonths: 6, priority: 1 },
              { type: "rental", label: "Cash-Flow Rental Property", description: "Passive income, appreciation upside", estimatedMonthlyIncome: Math.round(input.targetMonthlyIncome * 0.3), estimatedInvestment: Math.round((input.investmentCapital ?? 200000) * 0.3), timelineMonths: 3, priority: 2 },
              { type: "flip", label: "Strategic Fix & Flip", description: "Capital recycling to fund next acquisition", estimatedMonthlyIncome: Math.round(input.targetMonthlyIncome * 0.2), estimatedInvestment: Math.round((input.investmentCapital ?? 200000) * 0.1), timelineMonths: 4, priority: 3 },
            ],
            totalProjectedMonthly: input.targetMonthlyIncome,
            totalInvestmentRequired: input.investmentCapital ?? 200000,
            milestones: [
              { month: 3, title: "First Cash Flow", monthlyIncome: Math.round(input.targetMonthlyIncome * 0.2), description: "Rental income begins" },
              { month: 6, title: "Business Acquisition", monthlyIncome: Math.round(input.targetMonthlyIncome * 0.7), description: "SBA business closes" },
              { month: 12, title: "Freedom Threshold", monthlyIncome: input.targetMonthlyIncome, description: "Target income achieved" },
            ],
            rationale: `Based on your ${input.timelineYears}-year timeline and ${input.riskTolerance} risk profile, this blend maximizes cash flow while managing downside risk.`,
            agentMessage: `Here's your path to $${input.targetMonthlyIncome.toLocaleString()}/month. I've engineered a blend that fits your capital and timeline — let's execute.`,
          };
        }

        // Save to DB
        const db = await import("./db").then((m) => m.getDb());
        if (db) {
          const { freedomGoals } = await import("../drizzle/schema");
          const insertRes = await db.insert(freedomGoals).values({
            userId: ctx.user.openId,
            name: input.name ?? `Freedom Plan — $${input.targetMonthlyIncome.toLocaleString()}/mo`,
            targetMonthlyIncome: input.targetMonthlyIncome,
            currentIncome: input.currentIncome,
            investmentCapital: input.investmentCapital,
            timelineYears: input.timelineYears,
            riskTolerance: input.riskTolerance,
            location: input.location,
            situation: input.situation,
            age: input.age,
            aiRationale: aiResult.rationale,
          });
          const goalId = (insertRes as any)[0].insertId as number;

          // Save the blueprint
          const { strategyBlueprints } = await import("../drizzle/schema");
          await db.insert(strategyBlueprints).values({
            goalId,
            userId: ctx.user.openId,
            name: input.name ?? `Blueprint — $${input.targetMonthlyIncome.toLocaleString()}/mo`,
            recipe: aiResult.recipe,
            projectedMonthlyIncome: aiResult.totalProjectedMonthly,
            projectedTotalInvestment: aiResult.totalInvestmentRequired,
            aiRationale: aiResult.rationale,
          });

          await logActivity({ type: "system", title: `Freedom Map generated: $${input.targetMonthlyIncome.toLocaleString()}/mo target` });
          return { goalId, ...aiResult };
        }
        return aiResult;
      }),
  }),

  // ─── Strategy Blender ─────────────────────────────────────────────────────────
  strategyBlender: router({
    list: publicProcedure.query(async () => {
      const db = await import("./db").then((m) => m.getDb());
      if (!db) return [];
      const { strategyBlueprints } = await import("../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      return db.select().from(strategyBlueprints).orderBy(desc(strategyBlueprints.createdAt)).limit(20);
    }),

    analyze: protectedProcedure
      .input(z.object({
        recipe: z.array(z.object({
          type: z.string(),
          label: z.string(),
          investment: z.number(),
          expectedMonthly: z.number(),
          leverage: z.enum(["cash", "sba", "seller_note", "hard_money", "heloc"]).optional(),
        })),
        scenario: z.enum(["conservative", "base", "aggressive"]).default("base"),
      }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import("./_core/llm");
        const totalInvestment = input.recipe.reduce((s, r) => s + r.investment, 0);
        const totalMonthly = input.recipe.reduce((s, r) => s + r.expectedMonthly, 0);
        const scenarioMultipliers = { conservative: 0.75, base: 1.0, aggressive: 1.35 };
        const multiplier = scenarioMultipliers[input.scenario];

        const prompt = `Analyze this investment portfolio blend and provide capital stack engineering.

Portfolio:
${input.recipe.map((r) => `- ${r.label}: $${r.investment.toLocaleString()} investment, $${r.expectedMonthly.toLocaleString()}/mo expected, leverage: ${r.leverage ?? "cash"}`).join("\n")}

Scenario: ${input.scenario}
Total Investment: $${totalInvestment.toLocaleString()}
Expected Monthly: $${totalMonthly.toLocaleString()}

Return JSON:
{
  "capitalStack": {
    "sba7a": number,
    "sellerNote": number,
    "equity": number,
    "impactFund": number,
    "greenStack": number,
    "total": number
  },
  "dscr": number,
  "adjustedMonthly": number,
  "levers": [
    { "id": string, "title": string, "impact": string, "active": boolean, "savingsAmount": number }
  ],
  "projections": [
    { "year": number, "revenue": number, "cashFlow": number, "equity": number }
  ],
  "agentInsight": "Key insight about this blend"
}`;

        try {
          const res = await invokeLLM({
            messages: [
              { role: "system", content: "You are a capital stack engineer. Respond with valid JSON only." },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" } as any,
          });
          const content = (res as any).choices?.[0]?.message?.content ?? "{}";
          return JSON.parse(content);
        } catch {
          return {
            capitalStack: { sba7a: totalInvestment * 0.75, sellerNote: totalInvestment * 0.1, equity: totalInvestment * 0.15, impactFund: 0, greenStack: 0, total: totalInvestment },
            dscr: 1.35,
            adjustedMonthly: Math.round(totalMonthly * multiplier),
            levers: [
              { id: "sellerEarnOut", title: 'Seller "Performance-Earn-Out"', impact: "Reduces day-one cash by 20%", active: false, savingsAmount: Math.round(totalInvestment * 0.2) },
              { id: "impactFund", title: "Veteran/Minority Impact Fund", impact: "Replaces home-equity requirement", active: false, savingsAmount: Math.round(totalInvestment * 0.1) },
              { id: "greenStack", title: 'Energy-Efficiency "Green Stack"', impact: "Removes ≈$250k cap-ex", active: false, savingsAmount: 250000 },
            ],
            projections: [1, 2, 3, 4, 5].map((year) => ({
              year,
              revenue: Math.round(totalMonthly * 12 * Math.pow(1 + (multiplier - 1) * 0.3, year)),
              cashFlow: Math.round(totalMonthly * 12 * multiplier * Math.pow(1.05, year - 1)),
              equity: Math.round(totalInvestment * Math.pow(1.08, year)),
            })),
            agentInsight: `This ${input.scenario} blend projects $${Math.round(totalMonthly * multiplier).toLocaleString()}/mo across ${input.recipe.length} asset types.`,
          };
        }
      }),
  }),

  // ─── Opportunity Radar ────────────────────────────────────────────────────────
  opportunityRadar: router({
    list: publicProcedure.query(async () => {
      const db = await import("./db").then((m) => m.getDb());
      if (!db) return [];
      const { opportunityRadar } = await import("../drizzle/schema");
      const { desc, eq } = await import("drizzle-orm");
      const radarRows = await db.select().from(opportunityRadar).where(eq(opportunityRadar.isActive, true)).orderBy(desc(opportunityRadar.urgencyScore)).limit(30);
      return radarRows.map((r: any) => ({
        ...r,
        urgencyScore: r.urgencyScore != null ? Number(r.urgencyScore) : r.urgencyScore,
        estimatedROI: r.estimatedROI != null ? Number(r.estimatedROI) : r.estimatedROI,
        capitalRequired: r.capitalRequired != null ? Number(r.capitalRequired) : r.capitalRequired,
        estimatedHoldYears: r.estimatedHoldYears != null ? Number(r.estimatedHoldYears) : r.estimatedHoldYears,
      }));
    }),

    scan: protectedProcedure
      .input(z.object({
        location: z.string().optional(),
        signalTypes: z.array(z.string()).optional(),
        forceRefresh: z.boolean().optional().default(false),
      }))
      .mutation(async ({ input }) => {
        const location = input.location ?? "Atlanta, GA metro area";
        const { getRadarSignals } = await import("./deepResearch");

        // Run sonar-pro research — cached 24h, real citations
        const research = await getRadarSignals(location, input.forceRefresh ?? false);
        if (!research) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Research service unavailable" });

        // Parse the research content into structured signals using LLM
        const { invokeLLM } = await import("./_core/llm");
        let signals: any[] = [];
        try {
          const parseRes = await invokeLLM({
            messages: [
              {
                role: "system",
                content: "You are a structured data extractor. Extract investment signals from research text and return a valid JSON array only. No markdown, no explanation.",
              },
              {
                role: "user",
                content: `Extract 4-8 investment opportunity signals from this research about ${location}. Each signal must be grounded in the research content — do not invent data not present in the text.

Research:
${research.content.slice(0, 4000)}

Citations available: ${(research.citations as string[]).slice(0, 5).join(", ")}

Return JSON array:
[
  {
    "signalType": "permit_filed" | "tad_boundary" | "zoning_change" | "world_event" | "land_play" | "gas_station_hold" | "parking_arbitrage" | "lot_prep" | "microloan" | "historic_stabilized" | "market_shift",
    "title": "Specific, factual signal title",
    "location": "Specific area within ${location}",
    "description": "What was found and why it matters — cite the source",
    "urgencyScore": 0.0-1.0,
    "estimatedROI": 1.0-3.0,
    "estimatedHoldYears": 1-7,
    "capitalRequired": 50000-2000000,
    "aiAnalysis": "Strategic analysis grounded in the research findings",
    "sourceUrl": "one of the citation URLs if applicable"
  }
]`,
              },
            ],
          });
          const content = (parseRes as any).choices?.[0]?.message?.content ?? "[]";
          const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          signals = JSON.parse(cleaned);
        } catch {
          // If parsing fails, return a single signal summarizing the research
          signals = [{
            signalType: "market_shift",
            title: `Market Intelligence — ${location}`,
            location,
            description: research.content.slice(0, 300),
            urgencyScore: 0.6,
            estimatedROI: 1.5,
            estimatedHoldYears: 3,
            capitalRequired: 250000,
            aiAnalysis: "Research sourced from live data — see citations for details.",
            sourceUrl: (research.citations as string[])[0] ?? null,
          }];
        }

        // Save signals to DB with citation metadata
        const db = await import("./db").then((m) => m.getDb());
        if (db) {
          const { opportunityRadar: radarTable } = await import("../drizzle/schema");
          for (const signal of signals) {
            await db.insert(radarTable).values({
              signalType: signal.signalType,
              title: signal.title,
              location: signal.location ?? location,
              description: signal.description,
              urgencyScore: Math.min(1, Math.max(0, signal.urgencyScore ?? 0.5)),
              estimatedROI: signal.estimatedROI,
              estimatedHoldYears: signal.estimatedHoldYears,
              capitalRequired: signal.capitalRequired,
              aiAnalysis: signal.aiAnalysis,
            }).catch(() => {});
          }
          await logActivity({ type: "system", title: `Opportunity Radar scan: ${signals.length} sourced signals for ${location} (${(research.citations as string[]).length} citations)` });
        }

        return {
          signals,
          researchSummary: {
            model: research.model,
            citations: research.citations as string[],
            numSearchQueries: research.numSearchQueries,
            createdAt: research.createdAt,
            expiresAt: research.expiresAt,
          },
        };
      }),
  }),

  // ─── Investor Dossiers ────────────────────────────────────────────────────────
  investorDossier: router({
    list: publicProcedure.query(async () => {
      const db = await import("./db").then((m) => m.getDb());
      if (!db) return [];
      const { investorDossiers } = await import("../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      return db.select().from(investorDossiers).orderBy(desc(investorDossiers.createdAt)).limit(20);
    }),

    generate: protectedProcedure
      .input(z.object({
        dealId: z.number().optional(),
        blueprintId: z.number().optional(),
        title: z.string(),
        investorPersona: z.enum(["passive", "active", "institutional", "family_office", "syndicate"]).default("passive"),
        analysisMode: z.enum(["standard", "historic_building"]).default("standard"),
        dealContext: z.object({
          name: z.string(),
          industry: z.string().optional(),
          askingPrice: z.number().optional(),
          cashFlow: z.number().optional(),
          revenue: z.number().optional(),
          location: z.string().optional(),
          // Historic Building fields (Wingate preset)
          yearBuilt: z.number().optional(),
          isHistoric: z.boolean().optional(),
          historicRegisterEligible: z.boolean().optional(),
          isStabilized: z.boolean().optional(),
          occupancyRate: z.number().optional(),
          hasAirRights: z.boolean().optional(),
          capRate: z.number().optional(),
          noi: z.number().optional(),
          squareFootage: z.number().optional(),
          higherAndBetterUseNotes: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { invokeLLM } = await import("./_core/llm");
        const personaDescriptions = {
          passive: "a passive investor seeking cash flow with minimal involvement",
          active: "an active operator-investor who wants hands-on control",
          institutional: "an institutional investor focused on risk-adjusted returns and portfolio fit",
          family_office: "a family office seeking generational wealth and legacy assets",
          syndicate: "a syndicate lead evaluating deal structure and co-investor appeal",
        };
        const context = input.dealContext;
        const isHistoricMode = input.analysisMode === "historic_building";

        // Build historic building context block if in Wingate mode
        const historicBlock = isHistoricMode && context ? `

=== WINGATE HISTORIC BUILDING ANALYSIS MODE ===
Year Built: ${context.yearBuilt ?? 'Unknown'}
National Register Listed: ${context.isHistoric ? 'YES' : 'No'}
NR Eligible: ${context.historicRegisterEligible ? 'YES — qualifies for 20% federal Historic Tax Credit' : 'No'}
Stabilized/Leased-Up: ${context.isStabilized ? 'YES — cash flow on Day 1, no renovation risk' : 'No'}
Occupancy Rate: ${context.occupancyRate != null ? (context.occupancyRate * 100).toFixed(0) + '%' : 'Unknown'}
Cap Rate: ${context.capRate != null ? (context.capRate * 100).toFixed(2) + '%' : 'Unknown'}
NOI: ${context.noi ? '$' + context.noi.toLocaleString() + '/yr' : 'Unknown'}
Sq Ft: ${context.squareFootage ? context.squareFootage.toLocaleString() : 'Unknown'}
Air Rights Available: ${context.hasAirRights ? 'YES — vertical expansion optionality' : 'No'}
H&BU Notes: ${context.higherAndBetterUseNotes ?? 'None'}

WINGATE SCORING LENS: Focus on (1) Historic Tax Credit arbitrage — 20% federal + state credits, (2) Title risk — deed restrictions, easements, air rights encumbrances, (3) Lease stability — NNN vs gross, tenant mix, WALT, (4) NR status verification — SHPO determination letter, (5) Zoning overlay — historic district restrictions on modifications, (6) Phase I ESA — environmental risk for pre-1945 construction. Capital stack should feature HTC equity bridge + conventional debt. Recommend only if stabilized + NR eligible + cap rate ≥ 6%.` : '';

        const prompt = `You are a bespoke investment pitch AI specializing in ${isHistoricMode ? 'historic commercial real estate acquisitions (Wingate Thesis)' : 'business acquisitions'}. Generate a sophisticated investor dossier for ${personaDescriptions[input.investorPersona]}.

Deal: ${context?.name ?? input.title}
Industry: ${context?.industry ?? (isHistoricMode ? 'Historic Commercial Real Estate' : 'Business Acquisition')}
Asking Price: $${(context?.askingPrice ?? 0).toLocaleString()}
Annual Cash Flow: $${(context?.cashFlow ?? 0).toLocaleString()}
Revenue: $${(context?.revenue ?? 0).toLocaleString()}
Location: ${context?.location ?? "Southeast US"}${historicBlock}

Generate a JSON dossier:
{
  "thesis": "3-4 sentence investment thesis written specifically for this investor persona",
  "analystCommentary": "The Analyst perspective: data-driven, optimistic, focused on numbers",
  "skepticCommentary": "The Skeptic perspective: key risks and what to watch for",
  "visionaryCommentary": "The Visionary perspective: 5-year upside scenario and strategic optionality",
  "keyHighlights": ["highlight 1", "highlight 2", "highlight 3", "highlight 4"],
  "financialProjections": {
    "year1": { "revenue": number, "cashFlow": number, "roi": number },
    "year2": { "revenue": number, "cashFlow": number, "roi": number },
    "year3": { "revenue": number, "cashFlow": number, "roi": number }
  },
  "riskAssessment": [
    { "risk": "risk name", "severity": "low" | "medium" | "high", "mitigation": "mitigation strategy" }
  ],
  "capitalStack": {
    "sba7a": number,
    "sellerNote": number,
    "equity": number,
    "total": number
  },
  "recommendation": "STRONG_BUY" | "BUY" | "CONSIDER" | "PASS",
  "agentMessage": "A personal message from the AI to this specific investor type explaining why this deal fits their profile"
}`;

        let dossierData: any = null;
        try {
          const res = await invokeLLM({
            messages: [
              { role: "system", content: "You are a bespoke investment pitch AI. Respond with valid JSON only." },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" } as any,
          });
          const content = (res as any).choices?.[0]?.message?.content ?? "{}";
          dossierData = JSON.parse(content);
        } catch {
          dossierData = {
            thesis: `${context?.name ?? input.title} represents a compelling acquisition opportunity for ${personaDescriptions[input.investorPersona]}. The business demonstrates consistent cash flow with clear operational leverage points.`,
            analystCommentary: `At ${((context?.cashFlow ?? 0) / (context?.askingPrice ?? 1) * 100).toFixed(1)}% cash-on-cash yield, this deal outperforms the market average by 2-3x. The multiple is defensible given recurring revenue and low customer concentration.`,
            skepticCommentary: "Key risks include owner dependency and potential customer concentration. Conduct thorough due diligence on the top 5 customer relationships and the owner transition plan before proceeding.",
            visionaryCommentary: "With AI-driven operational efficiency, this business could expand margins by 8-12% within 18 months. The real play is using this as a platform acquisition — bolt on 2 competitors and create a regional champion.",
            keyHighlights: ["Consistent cash flow history", "SBA 7(a) eligible", "Motivated seller", "Clear AI automation opportunity"],
            financialProjections: {
              year1: { revenue: context?.revenue ?? 0, cashFlow: context?.cashFlow ?? 0, roi: 0.18 },
              year2: { revenue: Math.round((context?.revenue ?? 0) * 1.1), cashFlow: Math.round((context?.cashFlow ?? 0) * 1.15), roi: 0.22 },
              year3: { revenue: Math.round((context?.revenue ?? 0) * 1.2), cashFlow: Math.round((context?.cashFlow ?? 0) * 1.3), roi: 0.28 },
            },
            riskAssessment: [
              { risk: "Owner Dependency", severity: "high", mitigation: "Structured 12-month transition with earnout" },
              { risk: "Customer Concentration", severity: "medium", mitigation: "Diversify top 3 customers to <30% revenue" },
              { risk: "Market Competition", severity: "low", mitigation: "Defensible local market position" },
            ],
            capitalStack: { sba7a: Math.round((context?.askingPrice ?? 0) * 0.75), sellerNote: Math.round((context?.askingPrice ?? 0) * 0.1), equity: Math.round((context?.askingPrice ?? 0) * 0.15), total: context?.askingPrice ?? 0 },
            recommendation: "BUY",
            agentMessage: `I've reviewed this deal specifically through the lens of ${personaDescriptions[input.investorPersona]}. The numbers work, the structure is clean, and the timing is right. Here's what I'd focus on in diligence.`,
          };
        }

        // Save to DB
        const db = await import("./db").then((m) => m.getDb());
        if (db) {
          const { investorDossiers } = await import("../drizzle/schema");
          const insertRes = await db.insert(investorDossiers).values({
            dealId: input.dealId,
            blueprintId: input.blueprintId,
            userId: ctx.user.openId,
            title: input.title,
            investorPersona: input.investorPersona,
            thesis: dossierData.thesis,
            analystCommentary: dossierData.analystCommentary,
            skepticCommentary: dossierData.skepticCommentary,
            visionaryCommentary: dossierData.visionaryCommentary,
            financialProjections: dossierData.financialProjections,
            riskAssessment: dossierData.riskAssessment,
            capitalStack: dossierData.capitalStack,
            keyHighlights: dossierData.keyHighlights,
            recommendation: dossierData.recommendation as any,
          });
          const dossierId = (insertRes as any)[0].insertId as number;
          await logActivity({ type: "system", title: `Investor dossier generated: ${input.title}` });
          return { id: dossierId, ...dossierData };
        }
        return dossierData;
      }),
  }),

  // ─── ADK Agent Procedures ────────────────────────────────────────────────────
  agents: router({
    // Consensus scoring: 3 models in parallel, divergence flag (MiroFish)
    consensusScore: protectedProcedure
      .input(z.object({ dealId: z.number(), force: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const dealRow = await getDealById(input.dealId);
        if (!dealRow) throw new Error("Deal not found");

        // Cache-first: return existing consensus score unless force=true
        if (!input.force) {
          const dbCheck = await getDb();
          if (dbCheck) {
            const existing = await dbCheck.select().from(consensusScores)
              .where(eq(consensusScores.dealId, input.dealId))
              .orderBy(desc(consensusScores.createdAt)).limit(1);
            if (existing[0]) return { cached: true, ...existing[0] };
          }
        }

        const { runConsensusScoring } = await import("./agents/index");
        const result = await runConsensusScoring(dealRow);
        // Persist to consensus_scores table
        const dbConn = await getDb();
        if (dbConn) {
          await dbConn.insert(consensusScores).values({
            dealId: input.dealId,
            model1Name: result.scores[0]?.model,
            model1Score: result.scores[0]?.score,
            model1Rationale: result.scores[0]?.rationale,
            model2Name: result.scores[1]?.model,
            model2Score: result.scores[1]?.score,
            model2Rationale: result.scores[1]?.rationale,
            model3Name: result.scores[2]?.model,
            model3Score: result.scores[2]?.score,
            model3Rationale: result.scores[2]?.rationale,
            consensusScore: result.consensusScore,
            divergenceScore: result.divergenceScore,
            divergenceFlag: result.divergenceFlag,
            summary: result.summary,
          });
        }
        await logActivity({ type: "signal_analyzed", title: `Consensus scoring: ${dealRow.name} — ${result.divergenceFlag ? "⚠️ DIVERGENCE FLAG" : "Models agree"}` });
        return result;
      }),

    // Seller simulation: persona + negotiation scenarios (MiroFish)
    sellerSimulation: protectedProcedure
      .input(z.object({ dealId: z.number(), force: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const dealRow2 = await getDealById(input.dealId);
        if (!dealRow2) throw new Error("Deal not found");

        // Cache-first: return existing simulation unless force=true
        if (!input.force) {
          const dbCheck2 = await getDb();
          if (dbCheck2) {
            const existing2 = await dbCheck2.select().from(sellerSimulations)
              .where(eq(sellerSimulations.dealId, input.dealId))
              .orderBy(desc(sellerSimulations.createdAt)).limit(1);
            if (existing2[0]) return { cached: true, persona: existing2[0].personaJson, scenarios: existing2[0].scenariosJson };
          }
        }

        const { runSellerSimulation } = await import("./agents/index");
        const result = await runSellerSimulation(dealRow2);
        const dbConn2 = await getDb();
        if (dbConn2) {
          await dbConn2.insert(sellerSimulations).values({
            dealId: input.dealId,
            personaJson: result.persona as any,
            scenariosJson: result.scenarios as any,
          });
        }
        await logActivity({ type: "signal_analyzed", title: `Seller simulation: ${dealRow2.name} — ${result.persona.motivation} seller, urgency ${result.persona.urgencyLevel}/10` });
        return result;
      }),

    // Get seller simulation for a deal
    getSellerSimulation: publicProcedure
      .input(z.object({ dealId: z.number() }))
      .query(async ({ input }) => {
        const dbConn3 = await getDb();
        if (!dbConn3) return null;
        const rows = await dbConn3.select().from(sellerSimulations)
          .where(eq(sellerSimulations.dealId, input.dealId))
          .orderBy(desc(sellerSimulations.createdAt))
          .limit(1);
        return rows[0] ?? null;
      }),

    // Get consensus scores for a deal
    getConsensusScore: publicProcedure
      .input(z.object({ dealId: z.number() }))
      .query(async ({ input }) => {
        const dbConn4 = await getDb();
        if (!dbConn4) return null;
        const rows = await dbConn4.select().from(consensusScores)
          .where(eq(consensusScores.dealId, input.dealId))
          .orderBy(desc(consensusScores.createdAt))
          .limit(1);
        if (!rows[0]) return null;
        const r = rows[0];
        return {
          ...r,
          consensusScore: r.consensusScore != null ? Number(r.consensusScore) : r.consensusScore,
          divergenceScore: r.divergenceScore != null ? Number(r.divergenceScore) : r.divergenceScore,
        };
      }),

    // Get trajectory steps for a deal
    getTrajectory: publicProcedure
      .input(z.object({ dealId: z.number() }))
      .query(async ({ input }) => {
        const dbConn5 = await getDb();
        if (!dbConn5) return [];
        return dbConn5.select().from(dealTrajectory)
          .where(eq(dealTrajectory.dealId, input.dealId))
          .orderBy(dealTrajectory.createdAt);
      }),

    // Run full Third Signal pipeline with trajectory logging
    runPipeline: protectedProcedure
      .input(z.object({ dealId: z.number(), force: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const dealRow3 = await getDealById(input.dealId);
        if (!dealRow3) throw new Error("Deal not found");

        // Cache-first: if trajectory steps exist, return them without re-running
        if (!input.force) {
          const dbCheck3 = await getDb();
          if (dbCheck3) {
            const existingSteps = await dbCheck3.select().from(dealTrajectory)
              .where(eq(dealTrajectory.dealId, input.dealId))
              .orderBy(dealTrajectory.createdAt);
            if (existingSteps.length > 0) {
              return { cached: true, trajectorySteps: existingSteps, ownerPsychology: null, digitalAudit: null, redTeam: null, capitalStack: null };
            }
          }
        }

        const { runThirdSignalPipeline } = await import("./agents/index");
        const result = await runThirdSignalPipeline(dealRow3);
        await logActivity({ type: "signal_analyzed", title: `ADK pipeline complete: ${dealRow3.name} — ${result.trajectorySteps.length} agent steps` });
        return {
          ownerPsychology: result.ownerPsychology,
          digitalAudit: result.digitalAudit,
          redTeam: result.redTeam,
          capitalStack: result.capitalStack,
          trajectorySteps: result.trajectorySteps,
        };
      }),

    // ─── Deal Architect: generate all artifacts to move on a deal ────────────
    runDealArchitect: protectedProcedure
      .input(z.object({ dealId: z.number() }))
      .mutation(async ({ input }) => {
        const deal = await getDealById(input.dealId);
        if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
        const { invokeLLM } = await import("./_core/llm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const [result] = await db.execute<any>(
          sql`INSERT INTO agent_runs (deal_id, agent_type, status, input_context, created_at)
              VALUES (${input.dealId}, 'deal_architect', 'running', ${JSON.stringify({ dealId: deal.id, name: deal.name })}, ${Date.now()})`
        );
        const runId = (result as any).insertId;
        try {
          const systemPrompt = `You are the Deal Architect — an elite M&A advisor. Generate ALL artifacts a buyer needs to move decisively on a business acquisition.
Generate these 6 artifacts:
1. cold_outreach_email: Compelling personalized cold email to seller/broker
2. loi_draft: Letter of Intent outline with key terms
3. investment_thesis: 3-paragraph thesis (why this biz, value creation, exit optionality)
4. due_diligence_checklist: Top 15 DD items specific to this business type
5. seller_profile: Psychological profile of likely seller (motivations, fears, negotiation style)
6. negotiation_playbook: 5 key negotiation moves with specific language

Return JSON: { "artifacts": [{ "type": "...", "title": "...", "content": "...", "format": "markdown", "generatedAt": 0 }], "confidenceScore": 0.0 }`;
          const userPrompt = `Deal: ${deal.name} | ${deal.industry || "Unknown"} | ${deal.location || "Unknown"}
Revenue: $${((deal.revenue || 0) / 1e6).toFixed(2)}M | CF: $${((deal.cashFlow || 0) / 1e3).toFixed(0)}k | Ask: $${((deal.askingPrice || 0) / 1e6).toFixed(2)}M | ${deal.cashFlow ? ((deal.askingPrice || 0) / deal.cashFlow).toFixed(1) : "N/A"}x
AI Score: ${deal.score ? parseFloat(String(deal.score)).toFixed(3) : "unscored"} | Source: ${deal.source || "unknown"}
Description: ${deal.description || "No description provided"}
Generate all 6 artifacts. Be specific, actionable, and tailored to THIS deal.`;
          const response = await invokeLLM({
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            response_format: { type: "json_schema", json_schema: { name: "deal_architect_output", strict: true, schema: { type: "object", properties: { artifacts: { type: "array", items: { type: "object", properties: { type: { type: "string" }, title: { type: "string" }, content: { type: "string" }, format: { type: "string" }, generatedAt: { type: "number" } }, required: ["type", "title", "content", "format", "generatedAt"], additionalProperties: false } }, confidenceScore: { type: "number" } }, required: ["artifacts", "confidenceScore"], additionalProperties: false } } },
          });
          const raw = response.choices[0].message.content;
          const parsed = JSON.parse(raw as string);
          const artifacts = parsed.artifacts.map((a: any) => ({ ...a, generatedAt: Date.now() }));
          await db.execute(sql`UPDATE agent_runs SET status = 'complete', artifacts = ${JSON.stringify(artifacts)}, confidence_score = ${parsed.confidenceScore ?? 0.8}, raw_response = ${raw}, completed_at = ${Date.now()} WHERE id = ${runId}`);
          await logActivity({ type: "deal_scored", title: `Deal Architect: ${artifacts.length} artifacts for ${deal.name}`, dealId: input.dealId });
          return { runId, artifacts, confidenceScore: parsed.confidenceScore ?? 0.8 };
        } catch (e: any) {
          await db.execute(sql`UPDATE agent_runs SET status = 'failed', raw_response = ${e.message}, completed_at = ${Date.now()} WHERE id = ${runId}`);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Deal Architect failed: ${e.message}` });
        }
      }),

    // ─── Red Team: adversarial stress-tester ─────────────────────────────────
    runRedTeam: protectedProcedure
      .input(z.object({ dealId: z.number(), architectRunId: z.number().optional() }))
      .mutation(async ({ input }) => {
        const deal = await getDealById(input.dealId);
        if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
        const { invokeLLM } = await import("./_core/llm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        let architectArtifacts: any[] = [];
        if (input.architectRunId) {
          const [rows] = await db.execute<any[]>(sql`SELECT artifacts FROM agent_runs WHERE id = ${input.architectRunId}`);
          const runRows = Array.isArray(rows) ? rows : [];
          if (runRows.length > 0 && runRows[0].artifacts) {
            architectArtifacts = typeof runRows[0].artifacts === 'string' ? JSON.parse(runRows[0].artifacts) : runRows[0].artifacts;
          }
        }
        const [result] = await db.execute<any>(
          sql`INSERT INTO agent_runs (deal_id, agent_type, status, input_context, parent_run_id, created_at)
              VALUES (${input.dealId}, 'red_team', 'running', ${JSON.stringify({ dealId: deal.id, architectRunId: input.architectRunId })}, ${input.architectRunId ?? null}, ${Date.now()})`
        );
        const runId = (result as any).insertId;
        try {
          const systemPrompt = `You are the Red Team Agent — a ruthless adversarial analyst stress-testing acquisition decisions.
Find every reason this deal could fail. Think like: short-seller, skeptical LP, former employee, deal lawyer.
For each finding: category (financial|operational|legal|market|execution|personal_fit), severity (critical|high|medium|low), finding, evidence, recommendation, confidenceScore (0-1).
Return JSON: { "findings": [...], "overallRiskScore": 0.0, "dealKillers": ["..."], "redFlags": ["..."] }`;
          const userPrompt = `Deal: ${deal.name} | ${deal.industry} | ${deal.location}
Revenue: $${((deal.revenue || 0) / 1e6).toFixed(2)}M | CF: $${((deal.cashFlow || 0) / 1e3).toFixed(0)}k | Ask: $${((deal.askingPrice || 0) / 1e6).toFixed(2)}M | ${deal.cashFlow ? ((deal.askingPrice || 0) / deal.cashFlow).toFixed(1) : "N/A"}x
Description: ${deal.description || "No description"}
${architectArtifacts.length > 0 ? `Architect artifacts to stress-test: ${architectArtifacts.map((a: any) => `[${a.type}] ${a.title}`).join(', ')}` : ''}
Find every gap, risk, and blind spot.`;
          const response = await invokeLLM({
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            response_format: { type: "json_schema", json_schema: { name: "red_team_output", strict: true, schema: { type: "object", properties: { findings: { type: "array", items: { type: "object", properties: { category: { type: "string" }, severity: { type: "string" }, finding: { type: "string" }, evidence: { type: "string" }, recommendation: { type: "string" }, confidenceScore: { type: "number" } }, required: ["category", "severity", "finding", "evidence", "recommendation", "confidenceScore"], additionalProperties: false } }, overallRiskScore: { type: "number" }, dealKillers: { type: "array", items: { type: "string" } }, redFlags: { type: "array", items: { type: "string" } } }, required: ["findings", "overallRiskScore", "dealKillers", "redFlags"], additionalProperties: false } } },
          });
          const raw = response.choices[0].message.content;
          const parsed = JSON.parse(raw as string);
          await db.execute(sql`UPDATE agent_runs SET status = 'complete', findings = ${JSON.stringify(parsed.findings)}, confidence_score = ${parsed.overallRiskScore ?? 0.5}, raw_response = ${raw}, completed_at = ${Date.now()} WHERE id = ${runId}`);
          await logActivity({ type: "red_flag_detected", title: `Red Team: ${parsed.findings.length} risks on ${deal.name} (${parsed.dealKillers.length} deal-killers)`, dealId: input.dealId });
          return { runId, findings: parsed.findings, overallRiskScore: parsed.overallRiskScore, dealKillers: parsed.dealKillers, redFlags: parsed.redFlags };
        } catch (e: any) {
          await db.execute(sql`UPDATE agent_runs SET status = 'failed', raw_response = ${e.message}, completed_at = ${Date.now()} WHERE id = ${runId}`);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Red Team failed: ${e.message}` });
        }
      }),

    // ─── Remediation Agent: fills gaps, generates missing artifacts, go/no-go ─
    runRemediation: protectedProcedure
      .input(z.object({ dealId: z.number(), redTeamRunId: z.number() }))
      .mutation(async ({ input }) => {
        const deal = await getDealById(input.dealId);
        if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
        const { invokeLLM } = await import("./_core/llm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const [rows] = await db.execute<any[]>(sql`SELECT findings FROM agent_runs WHERE id = ${input.redTeamRunId}`);
        const runRows = Array.isArray(rows) ? rows : [];
        if (!runRows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Red team run not found" });
        const findings: any[] = runRows[0].findings ? (typeof runRows[0].findings === 'string' ? JSON.parse(runRows[0].findings) : runRows[0].findings) : [];
        const criticalAndHigh = findings.filter((f: any) => f.severity === 'critical' || f.severity === 'high');
        const [result] = await db.execute<any>(
          sql`INSERT INTO agent_runs (deal_id, agent_type, status, input_context, parent_run_id, created_at)
              VALUES (${input.dealId}, 'remediation', 'running', ${JSON.stringify({ dealId: deal.id, redTeamRunId: input.redTeamRunId, findingsCount: findings.length })}, ${input.redTeamRunId}, ${Date.now()})`
        );
        const runId = (result as any).insertId;
        try {
          const systemPrompt = `You are the Remediation Agent — a decisive deal strategist turning red team findings into action.
For each critical/high finding: produce a specific executable action AND a draft artifact where relevant.
Artifact types: cold_outreach_email | loi_draft | investment_thesis | due_diligence_checklist | seller_profile | negotiation_playbook | financing_model | risk_matrix
Return JSON: { "remediations": [{ "findingCategory": "...", "action": "...", "artifact": { "type": "...", "title": "...", "content": "...", "format": "markdown", "generatedAt": 0 } | null, "status": "complete" }], "executiveSummary": "...", "goNoGoRecommendation": "go" | "conditional_go" | "no_go", "confidenceScore": 0.0 }`;
          const userPrompt = `Deal: ${deal.name} (${deal.industry}, ${deal.location})
Revenue: $${((deal.revenue || 0) / 1e6).toFixed(2)}M | CF: $${((deal.cashFlow || 0) / 1e3).toFixed(0)}k | Ask: $${((deal.askingPrice || 0) / 1e6).toFixed(2)}M
Critical/High findings (${criticalAndHigh.length}):
${criticalAndHigh.map((f: any, i: number) => `${i+1}. [${f.severity.toUpperCase()}] ${f.category}: ${f.finding}\n   Rec: ${f.recommendation}`).join('\n\n')}
Produce concrete remediation plan. Give go/no-go recommendation.`;
          const response = await invokeLLM({
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            response_format: { type: "json_schema", json_schema: { name: "remediation_output", strict: true, schema: { type: "object", properties: { remediations: { type: "array", items: { type: "object", properties: { findingCategory: { type: "string" }, action: { type: "string" }, artifact: { anyOf: [{ type: "object", properties: { type: { type: "string" }, title: { type: "string" }, content: { type: "string" }, format: { type: "string" }, generatedAt: { type: "number" } }, required: ["type", "title", "content", "format", "generatedAt"], additionalProperties: false }, { type: "null" }] }, status: { type: "string" } }, required: ["findingCategory", "action", "artifact", "status"], additionalProperties: false } }, executiveSummary: { type: "string" }, goNoGoRecommendation: { type: "string" }, confidenceScore: { type: "number" } }, required: ["remediations", "executiveSummary", "goNoGoRecommendation", "confidenceScore"], additionalProperties: false } } },
          });
          const raw = response.choices[0].message.content;
          const parsed = JSON.parse(raw as string);
          await db.execute(sql`UPDATE agent_runs SET status = 'complete', remediations = ${JSON.stringify(parsed.remediations)}, confidence_score = ${parsed.confidenceScore ?? 0.75}, raw_response = ${raw}, completed_at = ${Date.now()} WHERE id = ${runId}`);
          await logActivity({ type: "signal_analyzed", title: `Remediation: ${parsed.goNoGoRecommendation.toUpperCase()} on ${deal.name} — ${parsed.remediations.length} actions`, dealId: input.dealId });
          return { runId, remediations: parsed.remediations, executiveSummary: parsed.executiveSummary, goNoGoRecommendation: parsed.goNoGoRecommendation, confidenceScore: parsed.confidenceScore };
        } catch (e: any) {
          await db.execute(sql`UPDATE agent_runs SET status = 'failed', raw_response = ${e.message}, completed_at = ${Date.now()} WHERE id = ${runId}`);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Remediation failed: ${e.message}` });
        }
      }),

    // ─── Get Agent Runs for a deal ────────────────────────────────────────────
    getRuns: protectedProcedure
      .input(z.object({ dealId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const [rows] = await db.execute<any[]>(
          sql`SELECT * FROM agent_runs WHERE deal_id = ${input.dealId} ORDER BY created_at DESC LIMIT 20`
        );
        const runs = Array.isArray(rows) ? rows : [];
        return runs.map((r: any) => ({
          id: r.id,
          dealId: r.deal_id,
          agentType: r.agent_type,
          status: r.status,
          confidenceScore: r.confidence_score,
          tokensUsed: r.tokens_used,
          parentRunId: r.parent_run_id,
          createdAt: r.created_at,
          completedAt: r.completed_at,
          artifacts: r.artifacts ? (typeof r.artifacts === 'string' ? JSON.parse(r.artifacts) : r.artifacts) : [],
          findings: r.findings ? (typeof r.findings === 'string' ? JSON.parse(r.findings) : r.findings) : [],
          remediations: r.remediations ? (typeof r.remediations === 'string' ? JSON.parse(r.remediations) : r.remediations) : [],
        }));
      }),
  }),

  // ─── Scout (Commercial Assets) ────────────────────────────────────────────
  scout: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).default(0) }).optional())
      .query(async ({ input }) => {
        const { getCommercialAssets } = await import("./db");
        return getCommercialAssets({ limit: input?.limit ?? 50, offset: input?.offset ?? 0 });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .query(async ({ input }) => {
        const { getCommercialAssetById } = await import("./db");
        const asset = await getCommercialAssetById(input.id);
        if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
        return asset;
      }),

    /** One asset with everything the full-page dossier renders — scorecard +
     *  economics — so /wingate/asset/:id doesn't have to score the whole pipeline. */
    getScoredById: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .query(async ({ input }) => {
        const { getCommercialAssetById } = await import("./db");
        const { scoreAssetByClass } = await import("./scoring");
        const { computeEconomicsByClass } = await import("./scoring/economicsByClass");
        const { evaluateAcrossTheses } = await import("./scoring/crossThesis");
        const { getAssetClass } = await import("../shared/assetClasses");
        const asset = await getCommercialAssetById(input.id);
        if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });

        // Every thesis this asset is measured against, so the dossier can say
        // "fails yours, fits theirs" rather than just archiving it.
        const db = await getDb();
        const { thesisVariants } = await import("../drizzle/schema");
        const { and } = await import("drizzle-orm");
        const cls = getAssetClass((asset as any).assetClass);
        const rows = db
          ? await db.select().from(thesisVariants).where(and(
              eq(thesisVariants.isActive, true),
              eq(thesisVariants.assetClass, cls.id),
            ))
          : [];
        const theses = [
          { id: null, name: `${cls.label} (default)`, assetClass: cls.id, overrides: {}, isPrimary: true },
          ...rows.map((r: any) => ({
            id: Number(r.id), name: String(r.name), clientLabel: r.clientLabel,
            assetClass: String(r.assetClass),
            overrides: (typeof r.overrides === "string" ? JSON.parse(r.overrides || "{}") : (r.overrides ?? {})),
            isPrimary: !!r.isPrimary, assignedUserId: r.assignedUserId ?? null,
          })),
        ];

        return {
          ...asset,
          historicScore: scoreAssetByClass(asset as any),
          economics: computeEconomicsByClass(asset as any),
          thesisFits: evaluateAcrossTheses(asset as any, theses as any),
        };
      }),

    create: operatorProcedure
      .input(z.object({
        name: z.string().min(1),
        address: z.string().min(1),
        city: z.string().min(1),
        state: z.string().min(1),
        zip: z.string().optional(),
        propertyType: z.enum(["office", "industrial", "retail", "mixed_use", "land", "warehouse", "flex"]).default("retail"),
        squareFootage: z.number().int().optional(),
        askingPrice: z.number().optional(),
        capRate: z.number().optional(),
        noi: z.number().optional(),
        leaseType: z.enum(["nnn", "gross", "modified_gross", "vacant"]).optional(),
        zoning: z.string().optional(),
        opportunityZone: z.boolean().default(false),
        ozTractId: z.string().optional(),
        tadDistrict: z.string().optional(),
        sourceUrl: z.string().optional(),
        // Historic Building Thesis fields (Wingate preset)
        yearBuilt: z.number().int().optional(),
        stories: z.number().int().optional(),
        isHistoric: z.boolean().default(false),
        historicRegisterEligible: z.boolean().default(false),
        isStabilized: z.boolean().default(false),
        occupancyRate: z.number().min(0).max(1).optional(),
        hasAirRights: z.boolean().default(false),
        lotSqFt: z.number().int().optional(),
        higherAndBetterUseNotes: z.string().optional(),
        // Adaptive framework: any asset class + its class-specific metadata.
        assetClass: z.string().optional(),
        classMetadata: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { createCommercialAsset } = await import("./db");
        const now = Date.now();
        const res = await createCommercialAsset({ ...input, source: "manual", createdAt: now, updatedAt: now }) as any;
        return { id: res[0].insertId, message: "Asset created" };
      }),

    updateStatus: operatorProcedure
      .input(z.object({ id: z.number().int(), status: z.enum(["new", "reviewing", "qualified", "rejected", "acquired"]) }))
      .mutation(async ({ input }) => {
        const { updateCommercialAssetStatus } = await import("./db");
        await updateCommercialAssetStatus(input.id, input.status);
        return { success: true };
      }),

    scoreAsset: operatorProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const { getCommercialAssetById, updateCommercialAssetAiScore } = await import("./db");
        const asset = await getCommercialAssetById(input.id);
        if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });

        const { invokeLLM } = await import("./_core/llm");
        // Build scoring context — include historic building fields if present
        const historicContext = (asset as any).isHistoric || (asset as any).yearBuilt ? `
Year Built: ${(asset as any).yearBuilt ?? 'Unknown'}
Stories: ${(asset as any).stories ?? 'Unknown'}
Is Historic: ${(asset as any).isHistoric ? 'YES' : 'No'}
Historic Register Eligible: ${(asset as any).historicRegisterEligible ? 'YES (qualifies for historic tax credits)' : 'No'}
Stabilized/Leased-Up: ${(asset as any).isStabilized ? 'YES' : 'No'}
Occupancy Rate: ${(asset as any).occupancyRate != null ? ((asset as any).occupancyRate * 100).toFixed(0) + '%' : 'Unknown'}
Air Rights Available: ${(asset as any).hasAirRights ? 'YES' : 'No'}
Lot Size: ${(asset as any).lotSqFt ? (asset as any).lotSqFt.toLocaleString() + ' sqft' : 'Unknown'}
Higher-and-Better-Use Notes: ${(asset as any).higherAndBetterUseNotes ?? 'None'}` : '';

        const prompt = `You are a commercial real estate investment analyst. Score this property on a 0.000–1.000 scale for acquisition potential.

Property: ${asset.name}
Address: ${asset.address}, ${asset.city}, ${asset.state}
Type: ${asset.propertyType}
Asking Price: ${asset.askingPrice ? '$' + asset.askingPrice.toLocaleString() : 'Unknown'}
Cap Rate: ${asset.capRate ? (asset.capRate * 100).toFixed(1) + '%' : 'Unknown'}
NOI: ${asset.noi ? '$' + asset.noi.toLocaleString() : 'Unknown'}
SqFt: ${asset.squareFootage ?? 'Unknown'}
Zoning: ${asset.zoning ?? 'Unknown'}
Lease Type: ${asset.leaseType ?? 'Unknown'}
Opportunity Zone: ${asset.opportunityZone ? 'YES — tax advantage' : 'No'}
TAD District: ${asset.tadDistrict ?? 'None'}${historicContext}

${(asset as any).isHistoric || (asset as any).historicRegisterEligible ? 'SCORING NOTE: For historic stabilized buildings, weight heavily: (1) Historic Register eligibility (tax credit arbitrage), (2) Stabilized/leased-up status (no renovation risk), (3) Higher-and-better-use potential (air rights or lot expansion), (4) Cap rate quality vs. market, (5) Geography fit (Midwest-Southeast corridor). A pre-1945 building that is stabilized, historic-register eligible, and has air rights or lot space should score 0.80+.\n' : ''}Return JSON: { "score": 0.000, "summary": "one sentence", "strengths": ["..."], "risks": ["..."] }`;

        const res = await invokeLLM({
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_schema", json_schema: { name: "asset_score", strict: true, schema: { type: "object", properties: { score: { type: "number" }, summary: { type: "string" }, strengths: { type: "array", items: { type: "string" } }, risks: { type: "array", items: { type: "string" } } }, required: ["score", "summary", "strengths", "risks"], additionalProperties: false } } },
        });

        const parsed = JSON.parse(res.choices[0].message.content as string);
        const score = Math.min(1, Math.max(0, parsed.score ?? 0.5));
        await updateCommercialAssetAiScore(input.id, score, parsed.summary);
        return { score, summary: parsed.summary, strengths: parsed.strengths, risks: parsed.risks };
      }),

    // Delete a commercial asset from Scout
    deleteAsset: operatorProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const { commercialAssets } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const existing = await db.select({ id: commercialAssets.id }).from(commercialAssets).where(eq(commercialAssets.id, input.id)).limit(1);
        if (!existing.length) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
        await db.delete(commercialAssets).where(eq(commercialAssets.id, input.id));
        return { success: true, deletedId: input.id };
      }),

    // ─── Historic A–G scoring: run the deterministic scorer + persist ─────────
    scoreHistoric: operatorProcedure
      .input(z.object({ id: z.number().int().optional(), all: z.boolean().optional(), compilationId: z.number().int().optional() }))
      .mutation(async ({ input }) => {
        const { getCommercialAssetById, getCommercialAssets, persistHistoricScore } = await import("./db");
        const { scoreAssetByClass } = await import("./scoring");
        let targets: any[] = [];
        if (input.id != null) {
          const a = await getCommercialAssetById(input.id);
          if (!a) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
          targets = [a];
        } else if (input.all) {
          targets = await getCommercialAssets({ limit: 1000 });
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Provide id or all" });
        }
        let scored = 0;
        for (const a of targets) {
          const s = scoreAssetByClass(a);
          await persistHistoricScore(a.id, s, input.compilationId);
          scored++;
        }
        return { scored };
      }),

    // ─── Search commercial_assets BY a compiled thesis, scored + ranked ───────
    search: protectedProcedure
      .input(z.object({ compilationId: z.number().int().optional(), persist: z.boolean().optional(), assetClass: z.string().optional() }))
      .query(async ({ input }) => {
        const { getCommercialAssets, persistHistoricScore } = await import("./db");
        const { scoreAssetByClass } = await import("./scoring");
        const { getDb } = await import("./db");
        const { thesisCompilations } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        const filters: any = { limit: 1000 };
        if (input.assetClass) filters.assetClass = input.assetClass;
        if (input.compilationId != null) {
          const db = await getDb();
          const rows = db ? await db.select().from(thesisCompilations).where(eq(thesisCompilations.id, input.compilationId)).limit(1) : [];
          const cf: any = rows[0]?.compiledFilters
            ? (typeof rows[0].compiledFilters === "string" ? JSON.parse(rows[0].compiledFilters as any) : rows[0].compiledFilters)
            : {};
          const num = (v: any) => (v == null || v === "" ? undefined : Number(v));
          const bool = (v: any) => v === true || v === "true";
          filters.yearBuiltMax = num(cf.yearBuiltMax);
          filters.maxStories = num(cf.maxStories);
          filters.minOccupancyRate = num(cf.minOccupancyRate);
          filters.requireHistoricRegister = bool(cf.requireHistoricRegister) || undefined;
          filters.requireStabilized = bool(cf.requireStabilized) || undefined;
          filters.capRateMin = num(cf.capRateMin);
          filters.noiMin = num(cf.noiMin);
          filters.noiMax = num(cf.noiMax);
          // geographies: keep only 2-letter state codes as a hard state filter.
          const geos: string[] = Array.isArray(cf.geographies) ? cf.geographies : [];
          const states = geos.map((g) => String(g).trim().toUpperCase()).filter((g) => /^[A-Z]{2}$/.test(g));
          if (states.length) filters.states = states;
        }

        const assets = await getCommercialAssets(filters);
        const scored = assets.map((a: any) => ({ asset: a, score: scoreAssetByClass(a) }));
        scored.sort((x, y) => y.score.rankScore - x.score.rankScore);

        if (input.persist && input.compilationId != null) {
          for (const s of scored) await persistHistoricScore(s.asset.id, s.score, input.compilationId);
        }
        // Deal economics (§9) — only meaningful for the historic thesis.
        const { computeEconomicsByClass } = await import("./scoring/economicsByClass");
        return {
          count: scored.length,
          results: scored.map((s) => ({
            ...s.asset,
            historicScore: s.score,
            economics: computeEconomicsByClass(s.asset),
          })),
        };
      }),

    // ─── Source REAL listings for ANY asset class via sonar-pro ───────────────
    // Adaptive: the research query is built from the class config, so a new
    // bespoke thesis can source its own real, cited inventory with no new code.
    researchAssets: operatorProcedure
      .input(z.object({
        assetClass: z.string().default("historic"),
        markets: z.array(z.string()).optional(),
        /** Search the whole country rather than only the thesis's declared
         *  markets. Anything found outside them is still stored — it is flagged
         *  as out-of-thesis geography rather than discarded. */
        nationwide: z.boolean().default(false),
        limit: z.number().int().min(1).max(24).default(6),
        marketsPerRun: z.number().int().min(1).max(10).default(5),
      }))
      .mutation(async ({ input }) => {
        // Shared with the nightly scheduler — see server/sourcing.ts.
        const { runSourcing } = await import("./sourcing");
        const { recordSourcingRun } = await import("./scheduler");
        const started = Date.now();
        try {
          const r = await runSourcing(input);
          await recordSourcingRun({
            scheduleId: null, assetClass: input.assetClass, trigger: "manual",
            createdCount: r.created, researchedCount: r.researched,
            markets: r.searchedMarkets, message: r.message, error: null,
            ranAt: started, durationMs: Date.now() - started,
          });
          return r;
        } catch (e: any) {
          await recordSourcingRun({
            scheduleId: null, assetClass: input.assetClass, trigger: "manual",
            createdCount: 0, researchedCount: 0, markets: [], message: null,
            error: String(e?.message ?? e), ranAt: started, durationMs: Date.now() - started,
          });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: String(e?.message ?? e) });
        }
      }),
    verifyListing: operatorProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const { getCommercialAssetById, getDb } = await import("./db");
        const asset: any = await getCommercialAssetById(input.id);
        if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
        const key = process.env.SONAR_API_KEY;
        if (!key) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "SONAR_API_KEY not configured" });

        const today = new Date().toISOString().slice(0, 10);
        const res = await fetch("https://api.perplexity.ai/v1/sonar", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "sonar-pro",
            messages: [
              { role: "system", content: "You verify whether a commercial property is currently available. Use only sourced facts. If you cannot confirm current status, say unknown. Output ONLY a JSON object." },
              { role: "user", content: `As of ${today}, what is the CURRENT status of this property?\n\nProperty: ${asset.name}\nAddress: ${asset.address}, ${asset.city}, ${asset.state}\nPreviously seen at: ${asset.sourceUrl || "unknown source"}\n\nReturn ONLY: {"status":"active|stale|withdrawn|sold|unknown","currentAskingPrice":number|null,"asOf":"YYYY-MM-DD or null","note":"1-2 sentences citing what the sources actually say — include any auction date that has already passed, withdrawal, or sale"}` },
            ],
          }),
        });
        if (!res.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Sonar API error ${res.status}` });
        const data: any = await res.json();
        const content: string = data.choices?.[0]?.message?.content ?? "";
        const citations: string[] = Array.isArray(data.citations) ? data.citations : [];
        const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
        let parsed: any = null;
        try { parsed = JSON.parse(cleaned); } catch {
          const a = cleaned.indexOf("{"), b = cleaned.lastIndexOf("}");
          if (a >= 0 && b > a) { try { parsed = JSON.parse(cleaned.slice(a, b + 1)); } catch { /* keep null */ } }
        }
        const allowed = ["active", "stale", "withdrawn", "sold", "unknown"];
        const status: string = allowed.includes(parsed?.status) ? parsed.status : "unknown";
        const note: string = String(parsed?.note ?? "Could not confirm current listing status from available sources.").slice(0, 1000);

        const db = await getDb();
        if (db) {
          const { commercialAssets } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const price = typeof parsed?.currentAskingPrice === "number" && parsed.currentAskingPrice > 0 ? parsed.currentAskingPrice : null;
          await db.update(commercialAssets).set({
            lastVerifiedAt: Date.now(),
            listingStatus: status,
            verificationNote: note,
            verificationSources: citations.slice(0, 6) as any,
            // Only correct the price when the check found a real one.
            ...(price ? { askingPrice: price } : {}),
            updatedAt: Date.now(),
          }).where(eq(commercialAssets.id, input.id));
        }
        return { status, note, citations: citations.slice(0, 6), currentAskingPrice: parsed?.currentAskingPrice ?? null, asOf: parsed?.asOf ?? null };
      }),

    /**
     * CSV ingest — the CoStar workaround.
     *
     * CoStar API access has cost and business-type hurdles, so the interim path
     * is: export from CoStar (or any broker platform), paste the CSV here, and
     * run it through the same scoring logic. Column names are matched loosely
     * because every platform names things differently.
     */
    importCsv: operatorProcedure
      .input(z.object({
        csv: z.string().min(10).max(2_000_000),
        assetClass: z.string().default("historic"),
        sourceLabel: z.string().max(80).default("csv-import"),
        dryRun: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const { parseAssetCsv } = await import("./csvImport");
        const { createCommercialAsset, getCommercialAssets } = await import("./db");
        const { scoreAssetByClass } = await import("./scoring");

        const { rows, errors, headerMap } = parseAssetCsv(input.csv, input.assetClass);

        // Dedupe on name+city, same rule the sonar sourcing uses.
        const existing = await getCommercialAssets({ limit: 2000, assetClass: input.assetClass });
        const seen = new Set(existing.map((a: any) => `${String(a.name).toLowerCase().trim()}|${String(a.city).toLowerCase().trim()}`));

        const fresh = rows.filter((r) => !seen.has(`${r.name.toLowerCase().trim()}|${String(r.city ?? "").toLowerCase().trim()}`));
        const duplicates = rows.length - fresh.length;

        // Preview scores so an operator sees what they're about to take on.
        const preview = fresh.slice(0, 8).map((r) => {
          const score = scoreAssetByClass({ ...r, assetClass: input.assetClass } as any);
          return { name: r.name, city: r.city, state: r.state, tier: score.assetTier, composite: score.compositeScore, rank: Math.round(score.rankScore) };
        });

        if (input.dryRun) {
          return { imported: 0, parsed: rows.length, duplicates, willImport: fresh.length, errors, headerMap, preview };
        }

        const now = Date.now();
        let imported = 0;
        for (const r of fresh) {
          try {
            await createCommercialAsset({
              ...r,
              assetClass: input.assetClass,
              source: input.sourceLabel,
              status: "new",
              createdAt: now,
              updatedAt: now,
            } as any);
            imported++;
          } catch { /* skip the row, keep the batch */ }
        }
        return { imported, parsed: rows.length, duplicates, willImport: fresh.length, errors, headerMap, preview };
      }),

    /** How big is the qualifying universe for a set of markets? */
    nrhpCount: operatorProcedure
      .input(z.object({
        states: z.array(z.string()).optional(),
        county: z.string().optional(),
        city: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const { countNrhp } = await import("./nrhp");
        const [buildings, districts] = await Promise.all([
          countNrhp({ ...input, resType: "building" }),
          countNrhp({ ...input, resType: "district" }),
        ]);
        return { buildings, districts };
      }),

    /**
     * Discovery from the National Register — the qualifying universe, not the
     * market. These buildings are not for sale; they are simply every structure
     * that meets the thesis's historic criterion, whether or not anyone is
     * selling. Preview then commit, like every other ingest path.
     */
    nrhpDiscover: operatorProcedure
      .input(z.object({
        states: z.array(z.string()).optional(),
        county: z.string().optional(),
        city: z.string().optional(),
        assetClass: z.string().default("historic"),
        /** Intersections and restricted locations can't be matched or mailed. */
        mailableOnly: z.boolean().default(true),
        /**
         * The Register has no use code, so a raw pull mixes houses, cemeteries
         * and monuments in with the buildings you could actually convert.
         * Defaults to the adaptive-reuse set — which deliberately KEEPS churches,
         * schools and theatres, since those are the classic conversion plays.
         */
        useCategories: z.array(z.enum([
          "commercial", "industrial", "institutional", "entertainment",
          "residential", "civic_monument", "funerary", "infrastructure",
          "agricultural", "unknown",
        ])).optional(),
        limit: z.number().int().min(1).max(200).default(50),
        dryRun: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const { searchNrhp, NRHP_SOURCE_URL } = await import("./nrhp");
        const { classifyUseFromName, ADAPTIVE_REUSE_CATEGORIES } = await import("../shared/propertyUse");
        const { createCommercialAsset, getCommercialAssets } = await import("./db");

        const raw = await searchNrhp({
          states: input.states, county: input.county, city: input.city,
          resType: "building", mailableOnly: input.mailableOnly, limit: input.limit,
        });

        const wanted = new Set(input.useCategories ?? ADAPTIVE_REUSE_CATEGORIES);
        const classified = raw.map((r) => ({ ...r, use: classifyUseFromName(r.name) }));
        const rows = classified.filter((r) => wanted.has(r.use.category as any));

        // Report what was set aside and why, rather than silently shrinking.
        const filteredOut: Record<string, number> = {};
        for (const r of classified) {
          if (!wanted.has(r.use.category as any)) {
            filteredOut[r.use.category] = (filteredOut[r.use.category] ?? 0) + 1;
          }
        }

        const existing = await getCommercialAssets({ limit: 2000 });
        const seenAddr = new Set(existing.map((a: any) =>
          `${String(a.address ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")}|${String(a.city ?? "").toLowerCase().trim()}`));
        const seenName = new Set(existing.map((a: any) => String(a.name ?? "").toLowerCase().trim()));

        const fresh = rows.filter((r) =>
          !seenAddr.has(`${String(r.address ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")}|${String(r.city ?? "").toLowerCase().trim()}`) &&
          !seenName.has(r.name.toLowerCase().trim()));

        const setAside = Object.values(filteredOut).reduce((a, b) => a + b, 0);
        const asideNote = setAside
          ? ` · ${setAside} set aside by use filter (${Object.entries(filteredOut).map(([k, n]) => `${n} ${k}`).join(", ")})`
          : "";

        if (input.dryRun) {
          return {
            imported: 0, found: rows.length, scanned: classified.length,
            duplicates: rows.length - fresh.length, filteredOut,
            candidates: fresh.slice(0, 40),
            message: `${rows.length} of ${classified.length} National Register buildings match the use filter · ${fresh.length} not yet in the pipeline${asideNote}`,
          };
        }

        const now = Date.now();
        let imported = 0;
        for (const r of fresh) {
          try {
            await createCommercialAsset({
              name: r.name,
              address: r.address ?? "Address not stated in the Register",
              city: r.city ?? "",
              state: r.state ?? "",
              propertyType: "mixed_use",
              assetClass: input.assetClass,
              source: "nrhp",
              sourceUrl: r.documentUrl ?? NRHP_SOURCE_URL,
              status: "new",
              // The Register IS the proof of listing — this is not an inference.
              isHistoric: true,
              historicRegisterEligible: true,
              historicInputs: {
                registerStatus: "listed",
                nrhpRefNumber: r.refNumber,
                nrhpListedYear: r.listedYear,
                contributingBuildings: r.contributingBuildings,
                isNationalHistoricLandmark: r.isNationalHistoricLandmark,
                // Heuristic from the building name — the Register has no use code.
                useCategory: r.use.category,
                useMatchedTerm: r.use.matchedTerm,
              },
              // Not for sale — it qualifies, that is all we are claiming.
              isOffMarket: true,
              verificationNote: `Listed on the National Register ${r.listedYear ?? ""} (ref ${r.refNumber}). Not currently for sale — sourced from the Register, not a listing.`.trim(),
              verificationSources: [r.documentUrl, NRHP_SOURCE_URL].filter(Boolean),
              lastVerifiedAt: now,
              listingStatus: "unknown",
              createdAt: now,
              updatedAt: now,
            } as any);
            imported++;
          } catch { /* skip the row, keep the batch */ }
        }

        return {
          imported, found: rows.length, scanned: classified.length,
          duplicates: rows.length - fresh.length, filteredOut,
          candidates: fresh.slice(0, 40),
          message: `Added ${imported} National Register buildings${asideNote}`,
        };
      }),

    /**
     * Enrich a known asset against the Register.
     *
     * This is the one enrichment that can VERIFY a critical field outright: an
     * NRHP reference number settles "NRHP / district status" as fact, which
     * lifts confidence and can unlock a tier. It also checks whether the asset
     * sits inside a historic district — a contributing structure qualifies for
     * the federal credit without being individually listed.
     */
    nrhpEnrich: operatorProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const { matchAddress, districtsContaining, NRHP_SOURCE_URL } = await import("./nrhp");
        const { getCommercialAssetById, getDb } = await import("./db");
        const { scoreAssetByClass } = await import("./scoring");

        const asset: any = await getCommercialAssetById(input.id);
        if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });

        const direct = await matchAddress(String(asset.address ?? ""), String(asset.city ?? ""), String(asset.state ?? ""));

        // If the building itself isn't listed, it may still sit in a district.
        let districts: any[] = [];
        const lat = direct?.lat ?? null, lng = direct?.lng ?? null;
        if (lat != null && lng != null) {
          try { districts = await districtsContaining(lat, lng); } catch { /* non-fatal */ }
        }

        if (!direct && !districts.length) {
          return { matched: false, reason: "No National Register record matches this address, and no district contains it." };
        }

        const prior = (typeof asset.historicInputs === "string"
          ? JSON.parse(asset.historicInputs || "{}")
          : (asset.historicInputs ?? {})) as Record<string, any>;

        const merged = {
          ...prior,
          registerStatus: direct ? "listed" : "contributing",
          nrhpRefNumber: direct?.refNumber ?? districts[0]?.refNumber,
          nrhpListedYear: direct?.listedYear ?? districts[0]?.listedYear,
          nrhpDistrictName: districts[0]?.name ?? undefined,
          contributingBuildings: direct?.contributingBuildings ?? undefined,
          isNationalHistoricLandmark: direct?.isNationalHistoricLandmark ?? undefined,
        };

        const priorSources: string[] = Array.isArray(asset.verificationSources) ? asset.verificationSources : [];
        const db = await getDb();
        if (db) {
          const { commercialAssets } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db.update(commercialAssets).set({
            isHistoric: true,
            historicRegisterEligible: true,
            historicInputs: merged as any,
            verificationSources: Array.from(new Set([
              ...priorSources, direct?.documentUrl, NRHP_SOURCE_URL,
            ].filter(Boolean))).slice(0, 12) as any,
            lastVerifiedAt: Date.now(),
            updatedAt: Date.now(),
          } as any).where(eq(commercialAssets.id, input.id));
        }

        const updated: any = await getCommercialAssetById(input.id);
        const score = scoreAssetByClass(updated);
        return {
          matched: true,
          directMatch: direct ? { name: direct.name, refNumber: direct.refNumber, listedYear: direct.listedYear } : null,
          districts: districts.map((d) => ({ name: d.name, refNumber: d.refNumber })),
          confidenceScore: score.confidenceScore,
          rankScore: Math.round(score.rankScore * 10) / 10,
          assetTier: score.assetTier,
          remainingFields: score.verifyFields,
        };
      }),

    /** Which counties have a direct-data adapter. */
    countyAdapters: operatorProcedure.query(async () => {
      const { listAdapters } = await import("./countyAdapters");
      return listAdapters();
    }),

    /**
     * Off-market discovery straight from a county's own data service.
     *
     * Where the web-search path guesses at what a portal contains, this runs a
     * query against the county's actual tables — so every figure is a database
     * value with a parcel ID behind it.
     */
    countyDiscover: operatorProcedure
      .input(z.object({
        city: z.string().min(2).max(80),
        state: z.string().length(2),
        assetClass: z.string().default("historic"),
        minLien: z.number().int().min(0).max(1_000_000).default(25_000),
        limit: z.number().int().min(1).max(60).default(20),
        dryRun: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const { adapterFor } = await import("./countyAdapters");
        const { computeMotivation } = await import("../shared/offMarket");
        const { createCommercialAsset, getCommercialAssets } = await import("./db");

        const adapter = adapterFor(input.city, input.state);
        if (!adapter) {
          return {
            adapter: null,
            imported: 0, found: 0, duplicates: 0, candidates: [],
            message: `No county adapter covers ${input.city}, ${input.state} yet. Direct county data has to be wired per county — the web-record search is the fallback for this market.`,
          };
        }

        const parcels = await adapter.discoverDistressed({
          city: input.city, minLien: input.minLien, limit: input.limit,
        });

        const existing = await getCommercialAssets({ limit: 2000 });
        const seen = new Set(existing.map((a: any) =>
          `${String(a.address ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")}|${String(a.city ?? "").toLowerCase().trim()}`));
        const fresh = parcels.filter((p) =>
          !seen.has(`${p.address.toLowerCase().replace(/[^a-z0-9]/g, "")}|${p.city.toLowerCase().trim()}`));

        const shaped = fresh.map((p) => ({ ...p, motivation: computeMotivation(p.signals) }));

        if (input.dryRun) {
          return {
            adapter: { id: adapter.id, label: adapter.label, coverageNote: adapter.coverageNote },
            imported: 0, found: parcels.length, duplicates: parcels.length - fresh.length,
            candidates: shaped,
            message: `${parcels.length} distressed commercial parcels from ${adapter.label}`,
          };
        }

        const now = Date.now();
        let imported = 0;
        for (const p of fresh) {
          try {
            await createCommercialAsset({
              name: p.useDescription ? `${p.address} (${p.useDescription})` : p.address,
              address: p.address,
              city: p.city,
              state: p.state,
              propertyType: "mixed_use",
              yearBuilt: p.yearBuilt ?? undefined,
              lotSqFt: p.lotSqFt ?? undefined,
              assetClass: input.assetClass,
              source: `county:${adapter.id}`,
              sourceUrl: p.sourceUrl,
              status: "new",
              isOffMarket: true,
              offMarketSignals: p.signals,
              motivationScore: computeMotivation(p.signals).score,
              verificationNote: p.signals.notes ?? null,
              verificationSources: [p.sourceUrl],
              lastVerifiedAt: now,
              listingStatus: "unknown",
              createdAt: now,
              updatedAt: now,
            } as any);
            imported++;
          } catch { /* skip the row, keep the batch */ }
        }

        return {
          adapter: { id: adapter.id, label: adapter.label, coverageNote: adapter.coverageNote },
          imported, found: parcels.length, duplicates: parcels.length - fresh.length,
          candidates: shaped,
          message: `Added ${imported} from ${adapter.label}`,
        };
      }),

    /**
     * Enrichment over discovery: take an asset we already hold — however it was
     * sourced — and fill in real county data for its address. This is the path
     * that works even where no bulk discovery is possible.
     */
    countyEnrich: operatorProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const { adapterFor } = await import("./countyAdapters");
        const { computeMotivation } = await import("../shared/offMarket");
        const { getCommercialAssetById, getDb } = await import("./db");

        const asset: any = await getCommercialAssetById(input.id);
        if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });

        const adapter = adapterFor(String(asset.city ?? ""), String(asset.state ?? ""));
        if (!adapter) {
          return { enriched: false, reason: `No county adapter covers ${asset.city}, ${asset.state} yet.`, adapter: null };
        }

        const parcel = await adapter.lookupByAddress(String(asset.address ?? ""), String(asset.city ?? ""), String(asset.state ?? ""));
        if (!parcel) {
          // "Not found" and "wrong county" look identical to the caller unless we
          // name the county we actually searched — Pennsylvania has 67 of them.
          return {
            enriched: false,
            reason: `No matching parcel in ${adapter.label} records for this address. If the property sits in a different county, that county needs its own adapter.`,
            adapter: adapter.label,
          };
        }

        // Merge onto whatever signals the asset already carries.
        const prior = (typeof asset.offMarketSignals === "string"
          ? JSON.parse(asset.offMarketSignals || "{}")
          : (asset.offMarketSignals ?? {})) as Record<string, any>;
        const merged = {
          ...prior,
          ...parcel.signals,
          sources: Array.from(new Set([...(prior.sources ?? []), ...(parcel.signals.sources ?? [])])),
          notes: [prior.notes, parcel.signals.notes].filter(Boolean).join(" · ").slice(0, 1500),
          citations: Array.from(new Set([...(prior.citations ?? []), ...(parcel.signals.citations ?? [])])),
        };
        const motivation = computeMotivation(merged);

        const db = await getDb();
        if (db) {
          const { commercialAssets } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db.update(commercialAssets).set({
            offMarketSignals: merged as any,
            motivationScore: motivation.score,
            lotSqFt: asset.lotSqFt ?? parcel.lotSqFt ?? null,
            lastVerifiedAt: Date.now(),
            updatedAt: Date.now(),
          } as any).where(eq(commercialAssets.id, input.id));
        }

        return {
          enriched: true,
          adapter: adapter.label,
          parcelId: parcel.parcelId,
          ownerName: parcel.ownerName,
          useDescription: parcel.useDescription,
          assessedValue: parcel.assessedValue,
          lastSaleDate: parcel.lastSaleDate,
          lastSalePrice: parcel.lastSalePrice,
          motivation,
        };
      }),

    /**
     * Off-market sourcing from public records — the CoStar differentiator.
     *
     * Two-step like the CSV import: preview returns candidates without writing,
     * so an operator sees the evidence before anything enters the pipeline.
     * These records are partial and sometimes stale, so nothing is auto-trusted.
     */
    sourceOffMarket: operatorProcedure
      .input(z.object({
        city: z.string().min(2).max(80),
        state: z.string().length(2),
        assetClass: z.string().default("historic"),
        sources: z.array(z.enum([
          "delinquent_tax", "vacant_registry", "land_bank", "code_enforcement",
          "foreclosure", "nrhp_nomination", "preservation_watch", "estate_probate",
        ])).optional(),
        perProbe: z.number().int().min(1).max(8).default(4),
        dryRun: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const { sourceOffMarket } = await import("./offMarketSourcing");
        const { createCommercialAsset, getCommercialAssets } = await import("./db");
        const { computeMotivation } = await import("../shared/offMarket");

        const started = Date.now();
        const run = await sourceOffMarket({
          city: input.city, state: input.state,
          sources: input.sources as any, perProbe: input.perProbe,
        });

        // Dedupe against the pipeline on address+city — off-market records key on
        // address, since these buildings often have no consistent name.
        const existing = await getCommercialAssets({ limit: 2000 });
        const seenAddr = new Set(existing.map((a: any) =>
          `${String(a.address ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")}|${String(a.city ?? "").toLowerCase().trim()}`));
        const fresh = run.candidates.filter((c) =>
          !seenAddr.has(`${c.address.toLowerCase().replace(/[^a-z0-9]/g, "")}|${c.city.toLowerCase().trim()}`));

        const shaped = fresh.map((c) => ({
          ...c,
          motivation: computeMotivation(c.signals),
        }));

        if (input.dryRun) {
          return {
            imported: 0,
            found: run.candidates.length,
            duplicates: run.candidates.length - fresh.length,
            discarded: run.discarded,
            perSource: run.perSource,
            citations: run.citations,
            candidates: shaped,
            durationMs: Date.now() - started,
          };
        }

        const now = Date.now();
        let imported = 0;
        for (const c of fresh) {
          try {
            await createCommercialAsset({
              name: c.name,
              address: c.address,
              city: c.city,
              state: c.state,
              propertyType: "mixed_use",
              yearBuilt: c.yearBuilt ?? undefined,
              squareFootage: c.squareFootage ?? undefined,
              assetClass: input.assetClass,
              source: "public-records",
              sourceUrl: c.signals.citations?.[0],
              status: "new",
              isOffMarket: true,
              offMarketSignals: c.signals,
              motivationScore: c.motivationScore,
              verificationNote: c.signals.notes ?? null,
              verificationSources: c.signals.citations ?? [],
              listingStatus: "unknown",
              createdAt: now,
              updatedAt: now,
            } as any);
            imported++;
          } catch { /* skip the row, keep the batch */ }
        }

        return {
          imported,
          found: run.candidates.length,
          duplicates: run.candidates.length - fresh.length,
          discarded: run.discarded,
          perSource: run.perSource,
          citations: run.citations,
          candidates: shaped,
          durationMs: Date.now() - started,
        };
      }),

    // ─── Verification queue ───────────────────────────────────────────────────
    // Confidence caps every tier, so unverified fields are the real work queue.
    // This pools them across the pipeline and ranks by how much rank each asset
    // would gain if its outstanding fields were confirmed.
    verificationQueue: operatorProcedure
      .input(z.object({ assetClass: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const { getCommercialAssets } = await import("./db");
        const { scoreAssetByClass } = await import("./scoring");
        const { getFieldSpec } = await import("./scoring/verificationFields");

        const filters: any = { limit: 1000 };
        if (input?.assetClass) filters.assetClass = input.assetClass;
        const assets = await getCommercialAssets(filters);

        const rows = assets.map((a: any) => {
          const score = scoreAssetByClass(a);
          // Rank if every outstanding field were confirmed (confidence → 1.0).
          const potentialRank = Math.round(score.compositeScore * 10) / 10;
          return {
            id: Number(a.id),
            name: String(a.name ?? ""),
            city: String(a.city ?? ""),
            state: String(a.state ?? ""),
            assetClass: a.assetClass ?? "historic",
            source: a.source ?? null,
            currentRank: Math.round(score.rankScore * 10) / 10,
            potentialRank,
            rankUpside: Math.round((potentialRank - score.rankScore) * 10) / 10,
            confidenceScore: score.confidenceScore,
            assetTier: score.assetTier,
            fields: score.verifyFields.map((k: string) => ({ key: k, short: getFieldSpec(k)?.short ?? k })),
          };
        }).filter((r) => r.fields.length > 0);

        rows.sort((x, y) => y.rankUpside - x.rankUpside);
        return {
          assets: rows,
          totalOpenFields: rows.reduce((n, r) => n + r.fields.length, 0),
          totalRankUpside: Math.round(rows.reduce((n, r) => n + r.rankUpside, 0) * 10) / 10,
        };
      }),

    // Research ONE field. Returns a proposal with citations; writes nothing —
    // an operator accepts it explicitly so nothing enters the record unreviewed.
    researchField: operatorProcedure
      .input(z.object({ id: z.number().int(), field: z.string() }))
      .mutation(async ({ input }) => {
        const { getCommercialAssetById } = await import("./db");
        const { getFieldSpec, fillPrompt } = await import("./scoring/verificationFields");
        const asset: any = await getCommercialAssetById(input.id);
        if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
        const spec = getFieldSpec(input.field);
        if (!spec) throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown field: ${input.field}` });
        const key = process.env.SONAR_API_KEY;
        if (!key) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "SONAR_API_KEY not configured" });

        const res = await fetch("https://api.perplexity.ai/v1/sonar", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "sonar-pro",
            messages: [
              { role: "system", content: "You are a property records researcher. Use only sourced facts from public records. Never guess. If you cannot confirm something, return null for that value and say why. Output ONLY a JSON object." },
              { role: "user", content: `${fillPrompt(spec, asset)}\n\nReturn ONLY: ${spec.schema}` },
            ],
          }),
        });
        if (!res.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Sonar API error ${res.status}` });
        const data: any = await res.json();
        const content: string = data.choices?.[0]?.message?.content ?? "";
        const citations: string[] = Array.isArray(data.citations) ? data.citations : [];
        const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
        let parsed: any = null;
        try { parsed = JSON.parse(cleaned); } catch {
          const i = cleaned.indexOf("{"), j = cleaned.lastIndexOf("}");
          if (i >= 0 && j > i) { try { parsed = JSON.parse(cleaned.slice(i, j + 1)); } catch { /* keep null */ } }
        }
        if (!parsed) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not parse the research result" });

        const patch = spec.apply(parsed);
        return {
          field: input.field,
          short: spec.short,
          parsed,
          summary: spec.summarize(parsed),
          note: String(parsed?.note ?? ""),
          citations: citations.slice(0, 6),
          /** false when the answer was inconclusive — nothing to accept. */
          applicable: !!patch,
        };
      }),

    // Accept a researched value: write it, stamp provenance, and rescore.
    acceptFieldValue: operatorProcedure
      .input(z.object({
        id: z.number().int(),
        field: z.string(),
        parsed: z.any(),
        citations: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { getCommercialAssetById, getDb } = await import("./db");
        const { getFieldSpec } = await import("./scoring/verificationFields");
        const { scoreAssetByClass } = await import("./scoring");
        const asset: any = await getCommercialAssetById(input.id);
        if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
        const spec = getFieldSpec(input.field);
        if (!spec) throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown field: ${input.field}` });
        const patch = spec.apply(input.parsed);
        if (!patch) throw new TRPCError({ code: "BAD_REQUEST", message: "That research result is not conclusive enough to accept" });

        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { commercialAssets } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        // Historic keeps its bespoke inputs column; every other class stores its
        // fields in class_metadata. Writing to the wrong blob would silently
        // never reach the scorer.
        const { getAssetClass } = await import("../shared/assetClasses");
        const isHistoric = getAssetClass(asset.assetClass).id === "historic";
        const blobKey = isHistoric ? "historicInputs" : "classMetadata";
        const raw = isHistoric ? asset.historicInputs : asset.classMetadata;
        const priorInputs = (typeof raw === "string" ? JSON.parse(raw || "{}") : (raw ?? {})) as Record<string, any>;
        const mergedInputs = { ...priorInputs, ...(patch.meta ?? {}) };
        const priorSources: string[] = Array.isArray(asset.verificationSources) ? asset.verificationSources : [];

        await db.update(commercialAssets).set({
          ...(patch.columns ?? {}),
          [blobKey]: mergedInputs as any,
          verificationSources: Array.from(new Set([...priorSources, ...(input.citations ?? [])])).slice(0, 12) as any,
          lastVerifiedAt: Date.now(),
          updatedAt: Date.now(),
        } as any).where(eq(commercialAssets.id, input.id));

        const updated: any = await getCommercialAssetById(input.id);
        const score = scoreAssetByClass(updated);
        return {
          confidenceScore: score.confidenceScore,
          rankScore: Math.round(score.rankScore * 10) / 10,
          assetTier: score.assetTier,
          remainingFields: score.verifyFields,
        };
      }),

    // ─── Bulk-clear: archive (soft) or delete (hard) many assets at once ──────
    bulkArchive: operatorProcedure
      .input(z.object({ ids: z.array(z.number().int()).optional(), all: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const { bulkArchiveCommercialAssets } = await import("./db");
        const n = await bulkArchiveCommercialAssets({ ids: input.ids, all: input.all });
        return { archived: n };
      }),

    bulkDelete: operatorProcedure
      .input(z.object({ ids: z.array(z.number().int()).optional(), all: z.boolean().optional(), confirm: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        if (input.all && !input.confirm) throw new TRPCError({ code: "BAD_REQUEST", message: "Deleting all assets requires confirm:true" });
        const { bulkDeleteCommercialAssets } = await import("./db");
        const n = await bulkDeleteCommercialAssets({ ids: input.ids, all: input.all });
        return { deleted: n };
      }),

    // Import a commercial asset from a listing URL (LoopNet, BizBuySell, CoStar, Crexi, etc.)
    importFromUrl: operatorProcedure
      .input(z.object({ url: z.string().url() }))
      .mutation(async ({ input }) => {
        const { scrapeListing } = await import("./listingScraper");
        const { createCommercialAsset, updateCommercialAssetAiScore } = await import("./db");
        const { invokeLLM } = await import("./_core/llm");

        // 1. Scrape the listing page (best-effort; falls back to URL-only mode)
        const scraped = await scrapeListing(input.url);

        // 2. Use Perplexity sonar-pro for live web search extraction
        //    sonar-pro searches the web in real-time, so even if the page is behind a login
        //    wall it can find the listing data from broker sites, public records, and news.
        const SONAR_API_URL = "https://api.perplexity.ai/chat/completions";
        const sonarKey = process.env.SONAR_API_KEY;
        if (!sonarKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "SONAR_API_KEY not configured" });

        const sonarQuery = `Research this commercial real estate listing and extract all available property data.

Listing URL: ${scraped.url}
Page title: ${scraped.title}
Scraped content: ${scraped.rawText.slice(0, 3000)}

Search the web for this listing and any related public records, broker databases, or news coverage.
Return a JSON object with ONLY the fields you can confidently source — omit fields you cannot verify.

Required JSON schema:
{
  "name": string,           // property/business name
  "address": string,        // street address
  "city": string,
  "state": string,          // 2-letter abbreviation
  "zip": string,
  "propertyType": one of ["office","industrial","retail","mixed_use","land","warehouse","flex"],
  "squareFootage": number,  // integer sq ft
  "askingPrice": number,    // in dollars (no commas)
  "capRate": number,        // as decimal e.g. 0.0623 for 6.23%
  "noi": number,            // annual NOI in dollars
  "leaseType": one of ["nnn","gross","modified_gross","vacant"],
  "zoning": string,
  "opportunityZone": boolean,
  "description": string,    // 2-3 sentence summary of the property
  "highlights": [string],   // key selling points (max 5)
  "yearBuilt": number,      // year building was constructed (integer)
  "stories": number,        // number of stories/floors (integer)
  "isHistoric": boolean,    // true if listed on or eligible for historic register
  "historicRegisterEligible": boolean, // true if qualifies for National/state/local historic register
  "isStabilized": boolean,  // true if building is fully leased-up (no renovation needed)
  "occupancyRate": number,  // occupancy as decimal e.g. 0.95 for 95%
  "hasAirRights": boolean,  // true if air rights are available above the building
  "lotSqFt": number,        // total lot size in square feet
  "higherAndBetterUseNotes": string // notes on development potential, air rights, or lot expansion
}

Return ONLY valid JSON. No markdown fences, no explanation.`;

        let extracted: any = {};
        let citations: string[] = [];
        try {
          const sonarRes = await fetch(SONAR_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sonarKey}`,
            },
            body: JSON.stringify({
              model: "sonar-pro",
              messages: [
                {
                  role: "system",
                  content: "You are a commercial real estate data specialist. Search the web for the listing and extract structured property data. Return only valid JSON matching the requested schema.",
                },
                { role: "user", content: sonarQuery },
              ],
            }),
          });

          if (!sonarRes.ok) {
            const errText = await sonarRes.text();
            console.warn(`[Scout] sonar-pro extraction failed (${sonarRes.status}): ${errText}`);
            // Fall back to static LLM extraction
            const { invokeLLM } = await import("./_core/llm");
            const fallbackRes = await invokeLLM({
              messages: [{ role: "user", content: sonarQuery }],
            });
            extracted = JSON.parse(fallbackRes.choices[0].message.content as string);
          } else {
            const sonarData = await sonarRes.json() as any;
            citations = sonarData.citations ?? [];
            const rawContent = sonarData.choices?.[0]?.message?.content ?? "{}";
            // Strip markdown fences if present
            const jsonStr = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
            extracted = JSON.parse(jsonStr);
          }
        } catch (extractErr) {
          console.warn("[Scout] Extraction parse failed, using title fallback:", extractErr);
          extracted = { name: scraped.title };
        }

        // 3. Normalize and validate extracted fields
        const VALID_PROPERTY_TYPES = ["office", "industrial", "retail", "mixed_use", "land", "warehouse", "flex"];
        const VALID_LEASE_TYPES = ["nnn", "gross", "modified_gross", "vacant"];

        const propertyType = VALID_PROPERTY_TYPES.includes(extracted.propertyType)
          ? extracted.propertyType
          : "retail";
        const leaseType = VALID_LEASE_TYPES.includes(extracted.leaseType)
          ? extracted.leaseType
          : undefined;

        // Normalize cap rate: if > 1, assume it was given as percentage (e.g. 6.23 → 0.0623)
        let capRate = extracted.capRate ? parseFloat(String(extracted.capRate)) : undefined;
        if (capRate && capRate > 1) capRate = capRate / 100;

        const now = Date.now();
        const assetData = {
          name: extracted.name || scraped.title,
          address: extracted.address || "",
          city: extracted.city || "",
          state: extracted.state || "",
          zip: extracted.zip || undefined,
          propertyType,
          squareFootage: extracted.squareFootage ? Math.round(extracted.squareFootage) : undefined,
          askingPrice: extracted.askingPrice ? parseFloat(String(extracted.askingPrice)) : undefined,
          capRate,
          noi: extracted.noi ? parseFloat(String(extracted.noi)) : undefined,
          leaseType,
          zoning: extracted.zoning || undefined,
          opportunityZone: extracted.opportunityZone ?? false,
          sourceUrl: input.url,
          source: "url_import" as const,
          createdAt: now,
          updatedAt: now,
          // Historic Building Thesis fields
          yearBuilt: extracted.yearBuilt ? Math.round(extracted.yearBuilt) : undefined,
          stories: extracted.stories ? Math.round(extracted.stories) : undefined,
          isHistoric: extracted.isHistoric ?? false,
          historicRegisterEligible: extracted.historicRegisterEligible ?? false,
          isStabilized: extracted.isStabilized ?? false,
          occupancyRate: extracted.occupancyRate ? Math.min(1, Math.max(0, parseFloat(String(extracted.occupancyRate)))) : undefined,
          hasAirRights: extracted.hasAirRights ?? false,
          lotSqFt: extracted.lotSqFt ? Math.round(extracted.lotSqFt) : undefined,
          higherAndBetterUseNotes: extracted.higherAndBetterUseNotes || undefined,
        };

        const res = await createCommercialAsset(assetData) as any;
        const assetId: number = res[0].insertId;

        // 4. Auto-score the newly created asset
        const historicScoreContext = assetData.isHistoric || assetData.yearBuilt ? `
Year Built: ${assetData.yearBuilt ?? 'Unknown'}
Stories: ${assetData.stories ?? 'Unknown'}
Is Historic: ${assetData.isHistoric ? 'YES' : 'No'}
Historic Register Eligible: ${assetData.historicRegisterEligible ? 'YES (qualifies for historic tax credits)' : 'No'}
Stabilized/Leased-Up: ${assetData.isStabilized ? 'YES' : 'No'}
Occupancy Rate: ${assetData.occupancyRate != null ? (assetData.occupancyRate * 100).toFixed(0) + '%' : 'Unknown'}
Air Rights Available: ${assetData.hasAirRights ? 'YES' : 'No'}
Lot Size: ${assetData.lotSqFt ? assetData.lotSqFt.toLocaleString() + ' sqft' : 'Unknown'}
Higher-and-Better-Use: ${assetData.higherAndBetterUseNotes ?? 'None'}` : '';

        const scorePrompt = `You are a commercial real estate investment analyst. Score this property on a 0.000–1.000 scale for acquisition potential.

Property: ${assetData.name}
Address: ${assetData.address}, ${assetData.city}, ${assetData.state}
Type: ${assetData.propertyType}
Asking Price: ${assetData.askingPrice ? '$' + assetData.askingPrice.toLocaleString() : 'Unknown'}
Cap Rate: ${assetData.capRate ? (assetData.capRate * 100).toFixed(2) + '%' : 'Unknown'}
NOI: ${assetData.noi ? '$' + assetData.noi.toLocaleString() : 'Unknown'}
SqFt: ${assetData.squareFootage ?? 'Unknown'}
Lease Type: ${assetData.leaseType ?? 'Unknown'}
Opportunity Zone: ${assetData.opportunityZone ? 'YES' : 'No'}
Description: ${extracted.description ?? 'N/A'}
Highlights: ${(extracted.highlights ?? []).join('; ')}${historicScoreContext}

${assetData.isHistoric || assetData.historicRegisterEligible ? 'SCORING NOTE: For historic stabilized buildings, weight heavily: (1) Historic Register eligibility (tax credit arbitrage), (2) Stabilized/leased-up status (no renovation risk), (3) Higher-and-better-use potential (air rights or lot expansion), (4) Cap rate quality, (5) Geography fit (Midwest-Southeast corridor). A pre-1945 building that is stabilized, historic-register eligible, and has air rights or lot space should score 0.80+.\n' : ''}Return JSON: { "score": 0.000, "summary": "one sentence", "strengths": ["..."], "risks": ["..."] }`;

        let score = 0.5;
        let summary = "AI scoring pending";
        try {
          const scoreRes = await invokeLLM({
            messages: [{ role: "user", content: scorePrompt }],
            response_format: { type: "json_schema", json_schema: { name: "asset_score", strict: true, schema: { type: "object", properties: { score: { type: "number" }, summary: { type: "string" }, strengths: { type: "array", items: { type: "string" } }, risks: { type: "array", items: { type: "string" } } }, required: ["score", "summary", "strengths", "risks"], additionalProperties: false } } },
          });
          const parsed = JSON.parse(scoreRes.choices[0].message.content as string);
          score = Math.min(1, Math.max(0, parsed.score ?? 0.5));
          summary = parsed.summary;
          await updateCommercialAssetAiScore(assetId, score, summary);
        } catch (scoreErr) {
          console.warn("[Scout] Auto-scoring failed after URL import:", scoreErr);
        }

        return {
          id: assetId,
          extracted,
          score,
          summary,
          citations,
          message: `Asset imported from ${new URL(input.url).hostname}`,
        };
      }),

    // Convert a qualified Scout asset into a Deal record and route to War Room
    convertToDeal: operatorProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const { getCommercialAssetById, createDeal, upsertSignal } = await import("./db");
        const { getAssetClass } = await import("../shared/assetClasses");
        const asset = await getCommercialAssetById(input.id);
        if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
        // A property must never be copied into the business `deals` model. The
        // business agents then judge a building on revenue/EBITDA and confidently
        // recommend archiving it. Property classes advance stage in place instead.
        const assetCls = getAssetClass((asset as any).assetClass);
        if (!assetCls.promotesToBusinessDeals) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${assetCls.label} assets stay in their own dossier — advance the stage instead of promoting to the business Deal Room.`,
          });
        }
        // Build a deal record pre-populated from the asset's financials
        const dealName = asset.name;
        const askingPrice = asset.askingPrice ?? 0;
        // HONESTY (prime directive 1): do NOT invent financials. Previously this
        // derived revenue = NOI x 1.3 and cashFlow = ask x 0.08 and stored them as
        // facts, so the deal page rendered fabricated REVENUE / CASH FLOW figures
        // nobody sourced. Real estate NOI is not business revenue. Carry across
        // only what the asset actually has; leave the rest null so the UI shows
        // an honest blank instead of a manufactured number.
        const estimatedRevenue = null;
        const estimatedCashFlow = asset.noi ?? null;
        const res = await createDeal({
          name: dealName,
          source: "scout",
          listingUrl: asset.sourceUrl ?? "",
          location: `${asset.city}, ${asset.state}`,
          industry: asset.propertyType,
          revenue: estimatedRevenue,
          cashFlow: estimatedCashFlow,
          askingPrice,
          stage: "new",
          opportunityZone: asset.opportunityZone ?? false,
          ozTractId: asset.ozTractId ?? null,
          tadDistrict: asset.tadDistrict ?? null,
        }) as any;
        const dealId = res[0]?.insertId;
        // ─── Scout → War Room Pre-fill ────────────────────────────────────────────────────
        // Seed the Third Signal tab with context from the Scout asset so the
        // analyst doesn't have to re-enter cap rate, OZ/TAD status, and address.
        if (dealId) {
          try {
            // Derive SBA eligibility seed: commercial RE deals under $5M asking are typically SBA 504 eligible
            const sbaEligibleSeed = askingPrice > 0 && askingPrice <= 10_000_000;
            // Rough DSCR estimate from NOI / estimated annual debt service (6% on 90% LTV, 25yr)
            let dscrSeed: number | undefined;
            if (asset.noi && askingPrice > 0) {
              const loanAmount = askingPrice * 0.9;
              const annualDebtService = loanAmount * (0.06 / (1 - Math.pow(1 + 0.06 / 12, -300))) * 12;
              dscrSeed = parseFloat((asset.noi / annualDebtService).toFixed(2));
            }
            // Build a context summary for the capital stack tab
            const contextParts: string[] = [];
            if (asset.capRate) contextParts.push(`Cap rate: ${(asset.capRate * 100).toFixed(2)}%`);
            if (asset.opportunityZone) contextParts.push("Located in Opportunity Zone");
            if (asset.tadDistrict) contextParts.push(`TAD District: ${asset.tadDistrict}`);
            if (asset.ozTractId) contextParts.push(`OZ Tract: ${asset.ozTractId}`);
            contextParts.push(`Property type: ${asset.propertyType}`);
            contextParts.push(`Location: ${asset.city}, ${asset.state}`);
            const capitalStackSummary = `[Scout Pre-fill] ${contextParts.join(" · ")}. Run capital stack analysis to generate full SBA/seller note/equity breakdown.`;
            await upsertSignal({
              dealId,
              sbaEligible: sbaEligibleSeed,
              ...(dscrSeed !== undefined && { dscr: dscrSeed }),
              capitalStackSummary,
              modelVersions: { source: "scout-prefill", version: "1.0" },
            });
          } catch (prefillErr) {
            // Pre-fill is best-effort — don't fail the conversion if it errors
            console.warn("[Scout] Pre-fill signal seed failed:", prefillErr);
          }
        }
        return { dealId, message: `Deal created from asset: ${dealName}`, prefilled: !!dealId };
      }),
  }),

  sentinel: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
      .query(async ({ input }) => {
        const { getMacroSignals } = await import("./db");
        return getMacroSignals(input?.limit ?? 20);
      }),

    seed: protectedProcedure
      .mutation(async () => {
        const { seedMacroSignals } = await import("./db");
        return seedMacroSignals();
      }),

    create: protectedProcedure
      .input(z.object({
        signalType: z.enum(["institutional", "government", "seasonal", "event", "macro_momentum"]),
        title: z.string().min(1).max(255),
        summary: z.string().min(1),
        roryPitch: z.string().optional(),
        impactedAssetClasses: z.array(z.string()).optional(),
        recommendedAction: z.string().optional(),
        confidenceScore: z.number().min(0).max(1).optional(),
        direction: z.enum(["tailwind", "headwind", "neutral"]).optional().default("tailwind"),
        sourceUrl: z.string().url().optional(),
        expiresAt: z.number().int().optional(),
      }))
      .mutation(async ({ input }) => {
        const { insertMacroSignal } = await import("./db");
        await insertMacroSignal({ ...input, createdAt: Date.now() });
        return { success: true };
      }),

    // AI Refresh: use Claude-Opus-4 via Poe to generate 3 real-time macro signals
    // Fetch REAL, source-cited market signals via Perplexity sonar-pro (live web
    // research), not LLM-generated guesses. Each signal carries a real source URL.
    aiRefresh: protectedProcedure
      .input(z.object({ thesis: z.enum(["historic", "smb"]).default("historic") }).optional())
      .mutation(async ({ input }) => {
        const { insertMacroSignal, getDb } = await import("./db");
        const key = process.env.SONAR_API_KEY;
        if (!key) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "SONAR_API_KEY not configured — live signals unavailable" });
        const today = new Date().toISOString().slice(0, 10);
        const focus = (input?.thesis ?? "historic") === "historic"
          ? "historic adaptive-reuse real estate acquisition in US Midwest & Southeast secondary markets — federal/state Historic Tax Credit and Opportunity Zone policy changes, adaptive-reuse incentives, downtown multifamily demand, distressed/vacant historic building supply, capital-market conditions for HTC deals"
          : "small-business acquisition (HVAC, plumbing, cleaning, logistics, home services) in the US Sun Belt — SBA lending changes, seller financing conditions, labor markets, sector consolidation";
        const res = await fetch("https://api.perplexity.ai/v1/sonar", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "sonar-pro",
            messages: [
              { role: "system", content: "You are a market intelligence analyst. Report only real, currently-sourced developments with citations. Never fabricate. Output ONLY a JSON array, no prose." },
              { role: "user", content: `As of ${today}, identify the 3 most important CURRENT market signals affecting ${focus}. Return ONLY a JSON array of exactly 3 objects, each: {"signalType":"institutional|government|seasonal|event|macro_momentum","title":"<=80 chars","summary":"2-3 sentences stating the concrete, recent, sourced fact","direction":"tailwind|headwind|neutral","recommendedAction":"1 sentence","confidenceScore":0.0-1.0}. No text outside the JSON array.` },
            ],
          }),
        });
        if (!res.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Sonar API error ${res.status}` });
        const data: any = await res.json();
        const content: string = data.choices?.[0]?.message?.content ?? "";
        const citations: string[] = Array.isArray(data.citations) ? data.citations : [];
        const match = content.match(/\[[\s\S]*\]/);
        let signals: any[] = [];
        try { signals = match ? JSON.parse(match[0]) : []; } catch { signals = []; }
        if (!signals.length) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Sonar returned no parseable signals — try again" });

        // Retire the previous batch so the board reflects the latest research.
        const _db = await getDb();
        if (_db) {
          const { macroSignals } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await _db.update(macroSignals).set({ archived: true }).where(eq(macroSignals.archived, false));
        }
        const validTypes = ["institutional", "government", "seasonal", "event", "macro_momentum"] as const;
        const validDir = ["tailwind", "headwind", "neutral"] as const;
        let inserted = 0;
        for (const sig of signals.slice(0, 3)) {
          await insertMacroSignal({
            signalType: (validTypes.includes(sig.signalType) ? sig.signalType : "macro_momentum") as typeof validTypes[number],
            title: String(sig.title ?? "").slice(0, 255),
            summary: String(sig.summary ?? ""),
            direction: (validDir.includes(sig.direction) ? sig.direction : "neutral") as typeof validDir[number],
            impactedAssetClasses: [],
            recommendedAction: sig.recommendedAction ? String(sig.recommendedAction) : undefined,
            confidenceScore: typeof sig.confidenceScore === "number" ? Math.min(1, Math.max(0, sig.confidenceScore)) : 0.7,
            sourceUrl: citations[0] ?? undefined,
            createdAt: Date.now(),
          });
          inserted++;
        }
        return { inserted, citations: citations.slice(0, 5), message: `${inserted} live signals via Perplexity sonar-pro` };
      }),
    // Archive a single signal manually
    archive: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { archiveSignalById } = await import("./db");
        await archiveSignalById(input.id);
        return { success: true };
      }),
    // Get only active (non-archived, non-expired) signals
    listActive: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
      .query(async ({ input }) => {
        const { getMacroSignalsActive } = await import("./db");
        return getMacroSignalsActive(input?.limit ?? 20);
      }),
    // Hard-delete a single macro signal
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { macroSignals } = await import("../drizzle/schema");
        await db.delete(macroSignals).where(eq(macroSignals.id, input.id));
        return { success: true };
      }),
    // Run auto-archive sweep (marks expired signals archived)
    autoArchive: protectedProcedure
      .mutation(async () => {
        const { archiveExpiredSignals } = await import("./db");
        const count = await archiveExpiredSignals();
        return { archived: count, message: `${count} expired signal(s) archived` };
      }),
  }),

  // ─── Deal Share Tokens ─────────────────────────────────────────────────────
  /**
   * Variant theses — the cross-client matching layer.
   * A building that fails the primary thesis is often a fit for a client with
   * different criteria; these procedures make that visible and assignable.
   */
  /**
   * Scheduled sourcing — daily/weekly automation, off until switched on.
   */
  sourcingSchedule: router({
    list: operatorProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { schedules: [], recentRuns: [] };
      const { sourcingSchedules, sourcingRuns } = await import("../drizzle/schema");
      const [schedules, recentRuns] = await Promise.all([
        db.select().from(sourcingSchedules).orderBy(desc(sourcingSchedules.createdAt)),
        db.select().from(sourcingRuns).orderBy(desc(sourcingRuns.ranAt)).limit(20),
      ]);
      return { schedules, recentRuns };
    }),

    save: operatorProcedure
      .input(z.object({
        id: z.number().int().optional(),
        name: z.string().min(1).max(120),
        assetClass: z.string().default("historic"),
        /** Defaults to false everywhere — automation is opt-in. */
        enabled: z.boolean().default(false),
        cadence: z.enum(["daily", "weekly"]).default("daily"),
        hourUtc: z.number().int().min(0).max(23).default(9),
        nationwide: z.boolean().default(false),
        marketsPerRun: z.number().int().min(1).max(10).default(5),
        limitPerRun: z.number().int().min(1).max(24).default(10),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { sourcingSchedules } = await import("../drizzle/schema");
        const { computeNextRun } = await import("./scheduler");
        const now = Date.now();
        const nextRunAt = input.enabled ? computeNextRun(input.cadence, input.hourUtc, now) : null;
        const values = {
          name: input.name, assetClass: input.assetClass, enabled: input.enabled,
          cadence: input.cadence, hourUtc: input.hourUtc, nationwide: input.nationwide,
          marketsPerRun: input.marketsPerRun, limitPerRun: input.limitPerRun,
          nextRunAt, updatedAt: now,
        };
        if (input.id) {
          await db.update(sourcingSchedules).set(values).where(eq(sourcingSchedules.id, input.id));
          return { id: input.id };
        }
        const res: any = await db.insert(sourcingSchedules).values({
          ...values, createdByUserId: ctx.user.id, createdAt: now,
        });
        return { id: res[0]?.insertId ?? null };
      }),

    setEnabled: operatorProcedure
      .input(z.object({ id: z.number().int(), enabled: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { sourcingSchedules } = await import("../drizzle/schema");
        const { computeNextRun } = await import("./scheduler");
        const [row]: any[] = await db.select().from(sourcingSchedules).where(eq(sourcingSchedules.id, input.id)).limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Schedule not found" });
        await db.update(sourcingSchedules).set({
          enabled: input.enabled,
          nextRunAt: input.enabled ? computeNextRun(String(row.cadence), Number(row.hourUtc)) : null,
          updatedAt: Date.now(),
        }).where(eq(sourcingSchedules.id, input.id));
        return { enabled: input.enabled };
      }),

    remove: operatorProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { sourcingSchedules } = await import("../drizzle/schema");
        await db.delete(sourcingSchedules).where(eq(sourcingSchedules.id, input.id));
        return { success: true } as const;
      }),

    /** Fire a schedule immediately — how you test one without waiting a day. */
    runNow: operatorProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const { runScheduleNow } = await import("./scheduler");
        return runScheduleNow(input.id);
      }),
  }),

  thesisVariant: router({
    list: protectedProcedure
      .input(z.object({ assetClass: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const { thesisVariants } = await import("../drizzle/schema");
        const { and } = await import("drizzle-orm");
        const conds = [eq(thesisVariants.isActive, true)];
        if (input?.assetClass) conds.push(eq(thesisVariants.assetClass, input.assetClass));
        return db.select().from(thesisVariants).where(and(...conds)).orderBy(desc(thesisVariants.isPrimary));
      }),

    save: protectedProcedure
      .input(z.object({
        id: z.number().int().optional(),
        name: z.string().min(1).max(120),
        description: z.string().max(2000).optional(),
        assetClass: z.string().default("historic"),
        clientLabel: z.string().max(160).optional(),
        assignedUserId: z.number().int().nullable().optional(),
        isPrimary: z.boolean().default(false),
        overrides: z.object({
          maxYearBuilt: z.number().int().optional(),
          minYearBuilt: z.number().int().nullable().optional(),
          maxStories: z.number().int().optional(),
          gateA: z.number().optional(),
          gateB: z.number().optional(),
          tier1MinComposite: z.number().optional(),
          tier2MinComposite: z.number().optional(),
          archiveBelowComposite: z.number().optional(),
          allowPriorHtc: z.boolean().optional(),
          requireTriplingPath: z.boolean().optional(),
        }).default({}),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { thesisVariants } = await import("../drizzle/schema");
        const now = Date.now();
        const isOperator = ctx.user.role === "admin" || ctx.user.role === "user";

        if (input.id) {
          // A client may edit only the theses they own; operators edit anything.
          const [existing] = await db.select().from(thesisVariants).where(eq(thesisVariants.id, input.id)).limit(1);
          if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Thesis not found" });
          if (!isOperator && (existing as any).ownerUserId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit theses you created" });
          }
          await db.update(thesisVariants).set({
            name: input.name, description: input.description ?? null,
            assetClass: input.assetClass, clientLabel: input.clientLabel ?? null,
            assignedUserId: input.assignedUserId ?? null,
            // Only operators may promote a thesis to primary or reassign it.
            ...(isOperator ? { isPrimary: input.isPrimary, assignedUserId: input.assignedUserId ?? null } : {}),
            overrides: input.overrides as any, updatedAt: now,
          }).where(eq(thesisVariants.id, input.id));
          return { id: input.id };
        }
        const res: any = await db.insert(thesisVariants).values({
          name: input.name, description: input.description ?? null,
          assetClass: input.assetClass, clientLabel: input.clientLabel ?? null,
          // A client's own thesis is assigned to them by default.
          assignedUserId: isOperator ? (input.assignedUserId ?? null) : ctx.user.id,
          ownerUserId: ctx.user.id,
          isPrimary: isOperator ? input.isPrimary : false, overrides: input.overrides as any,
          isActive: true, createdAt: now, updatedAt: now,
        });
        return { id: res[0]?.insertId ?? null };
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { thesisVariants } = await import("../drizzle/schema");
        const isOperator = ctx.user.role === "admin" || ctx.user.role === "user";
        const [existing] = await db.select().from(thesisVariants).where(eq(thesisVariants.id, input.id)).limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Thesis not found" });
        if (!isOperator && (existing as any).ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only remove theses you created" });
        }
        await db.update(thesisVariants).set({ isActive: false, updatedAt: Date.now() }).where(eq(thesisVariants.id, input.id));
        return { success: true } as const;
      }),

    /**
     * Dry-run a set of dials against the pipeline WITHOUT saving. Turning a knob
     * and immediately seeing "this would match 17 instead of 4" is the whole
     * point of putting the criteria in the user's hands.
     */
    preview: protectedProcedure
      .input(z.object({
        assetClass: z.string().default("historic"),
        overrides: z.record(z.string(), z.any()).default({}),
      }))
      .query(async ({ input }) => {
        const { getCommercialAssets } = await import("./db");
        const { evaluateAcrossTheses } = await import("./scoring/crossThesis");
        const assets = await getCommercialAssets({ limit: 1000, assetClass: input.assetClass });
        const theses = [{ id: -1, name: "preview", assetClass: input.assetClass, overrides: input.overrides as any, isPrimary: false }];
        let fits = 0;
        const reasons = new Map<string, number>();
        const sample: { name: string; city: string; state: string; tier: string; composite: number }[] = [];
        for (const a of assets as any[]) {
          const [v] = evaluateAcrossTheses(a, theses as any);
          if (!v) continue;
          if (v.fits) {
            fits++;
            if (sample.length < 6) sample.push({ name: a.name, city: a.city, state: a.state, tier: v.tier, composite: v.compositeScore });
          } else if (v.reason) {
            reasons.set(v.reason, (reasons.get(v.reason) ?? 0) + 1);
          }
        }
        return {
          total: assets.length,
          fits,
          sample,
          topReasons: Array.from(reasons.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([reason, n]) => ({ reason, n })),
        };
      }),

    /**
     * Score every asset in a class against every thesis. `mode` decides what
     * comes back:
     *   fits     — assets that pass the active thesis (the normal pipeline)
     *   variants — assets that FAIL the active thesis but fit another (cross-sell)
     *   all      — no thesis filter at all
     */
    match: protectedProcedure
      .input(z.object({
        assetClass: z.string().default("historic"),
        activeThesisId: z.number().int().nullable().default(null),
        mode: z.enum(["fits", "variants", "all"]).default("fits"),
      }))
      .query(async ({ input }) => {
        const { getCommercialAssets } = await import("./db");
        const { evaluateAcrossTheses, crossThesisSummary } = await import("./scoring/crossThesis");
        type ThesisDef = import("./scoring/crossThesis").ThesisDef;
        const { computeEconomicsByClass } = await import("./scoring/economicsByClass");
        const { scoreAssetByClass } = await import("./scoring");
        const { getAssetClass } = await import("../shared/assetClasses");

        const db = await getDb();
        const { thesisVariants } = await import("../drizzle/schema");
        const { and } = await import("drizzle-orm");
        const rows = db
          ? await db.select().from(thesisVariants).where(and(
              eq(thesisVariants.isActive, true),
              eq(thesisVariants.assetClass, input.assetClass),
            ))
          : [];

        const cls = getAssetClass(input.assetClass);
        // The class's own defaults are always thesis #0 so there is something to
        // compare against even before anyone defines a variant.
        const theses: ThesisDef[] = [
          { id: null, name: `${cls.label} (default)`, assetClass: cls.id, overrides: {}, isPrimary: true },
          ...rows.map((r: any) => ({
            id: Number(r.id),
            name: String(r.name),
            clientLabel: r.clientLabel,
            assetClass: String(r.assetClass),
            overrides: (typeof r.overrides === "string" ? JSON.parse(r.overrides || "{}") : (r.overrides ?? {})),
            isPrimary: !!r.isPrimary,
            assignedUserId: r.assignedUserId ?? null,
          })),
        ];

        const assets = await getCommercialAssets({ limit: 1000, assetClass: input.assetClass });
        const evaluated = assets.map((a: any) => {
          const fits = evaluateAcrossTheses(a, theses);
          const summary = crossThesisSummary(fits, input.activeThesisId);
          return {
            ...a,
            historicScore: scoreAssetByClass(a),
            economics: computeEconomicsByClass(a),
            thesisFits: fits,
            crossThesis: summary,
          };
        });

        const filtered =
          input.mode === "all" ? evaluated
          : input.mode === "variants" ? evaluated.filter((e: any) => e.crossThesis.isVariantMatch)
          : evaluated.filter((e: any) => e.crossThesis.activeFits);

        filtered.sort((x: any, y: any) => y.historicScore.rankScore - x.historicScore.rankScore);

        return {
          count: filtered.length,
          totals: {
            all: evaluated.length,
            fits: evaluated.filter((e: any) => e.crossThesis.activeFits).length,
            variantMatches: evaluated.filter((e: any) => e.crossThesis.isVariantMatch).length,
          },
          theses: theses.map((t) => ({ id: t.id, name: t.name, clientLabel: t.clientLabel ?? null })),
          results: filtered,
        };
      }),

    /** Hand a specific asset to a specific client. */
    assignAsset: operatorProcedure
      .input(z.object({ assetId: z.number().int(), userId: z.number().int().nullable(), note: z.string().max(1000).optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { commercialAssets } = await import("../drizzle/schema");
        await db.update(commercialAssets).set({
          assignedUserId: input.userId,
          assignmentNote: input.note ?? null,
          updatedAt: Date.now(),
        } as any).where(eq(commercialAssets.id, input.assetId));
        return { success: true } as const;
      }),

    /** What has been handed to me — used by the client pipeline. */
    myAssignments: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const { commercialAssets } = await import("../drizzle/schema");
      const { and } = await import("drizzle-orm");
      const { scoreAssetByClass } = await import("./scoring");
      const { computeEconomicsByClass } = await import("./scoring/economicsByClass");
      const { coerceRows } = await import("./db");
      const rows = await db.select().from(commercialAssets).where(and(
        eq(commercialAssets.assignedUserId, ctx.user.id),
        eq(commercialAssets.isArchived, false),
      ));
      return coerceRows(rows).map((a: any) => ({
        ...a,
        historicScore: scoreAssetByClass(a),
        economics: computeEconomicsByClass(a),
      }));
    }),

    /** Clients an operator can assign to. */
    assignableUsers: operatorProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const { users } = await import("../drizzle/schema");
      const { inArray } = await import("drizzle-orm");
      const rows = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role })
        .from(users).where(inArray(users.role, ["investor", "insurance"] as any));
      return rows;
    }),
  }),

  /** Link-sharing for a property dossier. The public payload is deliberately a
   *  HIGHLIGHT CARD, not the dossier: headline scores, gates, economics summary.
   *  Anything deeper requires signing in — the card's CTA routes registered users
   *  to the full dossier and everyone else to a request-access form. */
  assetShare: router({
    createToken: operatorProcedure
      .input(z.object({ assetId: z.number(), ttlDays: z.number().int().min(1).max(365).default(30) }))
      .mutation(async ({ input }) => {
        const { createAssetShareToken } = await import("./db");
        const token = await createAssetShareToken(input.assetId, input.ttlDays);
        return { token };
      }),

    getByToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input, ctx }) => {
        const { getAssetShareToken, incrementAssetShareTokenViewCount, getCommercialAssetById } = await import("./db");
        const { scoreAssetByClass } = await import("./scoring");
        const { computeEconomicsByClass } = await import("./scoring/economicsByClass");
        const { getAssetClass } = await import("../shared/assetClasses");

        const shareRow = await getAssetShareToken(input.token);
        if (!shareRow) throw new TRPCError({ code: "NOT_FOUND", message: "Share link not found" });
        if (shareRow.expiresAt && shareRow.expiresAt < Date.now()) {
          throw new TRPCError({ code: "FORBIDDEN", message: "This share link has expired" });
        }
        incrementAssetShareTokenViewCount(input.token).catch(() => {});

        const asset: any = await getCommercialAssetById(shareRow.assetId);
        if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });

        const score = scoreAssetByClass(asset);
        const cls = getAssetClass(asset.assetClass);
        const econ = computeEconomicsByClass(asset);

        // Highlight card only — no source URL, no owner/seller notes, no raw
        // asking price detail beyond the headline the operator chose to share.
        return {
          card: {
            id: Number(asset.id),
            name: String(asset.name ?? ""),
            city: String(asset.city ?? ""),
            state: String(asset.state ?? ""),
            className: cls.label,
            classShort: cls.shortLabel,
            yearBuilt: asset.yearBuilt ?? null,
            squareFootage: asset.squareFootage ?? null,
            askingPrice: asset.askingPrice == null ? null : Number(asset.askingPrice),
            tier: score.assetTier,
            marketTier: score.marketTier,
            rankScore: Math.round(score.rankScore),
            compositeScore: score.compositeScore,
            confidenceScore: score.confidenceScore,
            gates: [
              { key: "A", label: "Historic qualification", score: score.dimA, max: 20, pass: score.dimA >= 12 },
              { key: "B", label: "Development envelope", score: score.dimB, max: 20, pass: score.dimB >= 12 },
            ],
            economics: econ ? { headline: econ.headline, disclaimer: econ.disclaimer } : null,
            strengths: score.scorecard.strengths.slice(0, 3),
            risks: score.scorecard.risks.slice(0, 3),
            unverifiedCount: score.verifyFields.length,
          },
          // Drives the CTA: signed-in users go straight to the dossier, everyone
          // else gets the request-access form.
          viewer: { isAuthenticated: !!ctx.user },
          viewCount: shareRow.viewCount,
          expiresAt: shareRow.expiresAt,
        };
      }),
  }),

  dealShare: router({
    // Create a share token for a deal (30-day TTL by default)
    createToken: protectedProcedure
      .input(z.object({ dealId: z.number(), ttlDays: z.number().int().min(1).max(365).default(30) }))
      .mutation(async ({ input }) => {
        const { createDealShareToken } = await import("./db");
        const token = await createDealShareToken(input.dealId, input.ttlDays);
        return { token };
      }),
    // Public: get deal data by share token (increments view count)
    getByToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const { getDealShareToken, incrementShareTokenViewCount } = await import("./db");
        const shareRow = await getDealShareToken(input.token);
        if (!shareRow) throw new TRPCError({ code: "NOT_FOUND", message: "Share link not found" });
        if (shareRow.expiresAt && shareRow.expiresAt < Date.now()) {
          throw new TRPCError({ code: "FORBIDDEN", message: "This share link has expired" });
        }
        // Increment view count asynchronously (don't block response)
        incrementShareTokenViewCount(input.token).catch(() => {});
        const deal = await getDealById(shareRow.dealId);
        if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
        const [signal, memo] = await Promise.all([
          getSignalByDealId(shareRow.dealId),
          getMemoByDealId(shareRow.dealId),
        ]);
        return { deal, signal, memo, viewCount: shareRow.viewCount, expiresAt: shareRow.expiresAt };
      }),
  }),

  // ─── AI Co-Pilot ───────────────────────────────────────────────────────────
  copilot: router({
    chat: protectedProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })),
        // Optional context injection — pass dealId to give the agent deal-specific context
        dealId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        // Fetch live context to ground the agent
        const [allDeals, recentActivity] = await Promise.all([
          getDeals({ limit: 20 }),
          getActivityLog(10),
        ]);

        // Optional: fetch specific deal context if dealId provided
        let dealContext = "";
        if (input.dealId) {
          const deal = await getDealById(input.dealId);
          if (deal) {
            const [signal, memo] = await Promise.all([
              getSignalByDealId(input.dealId),
              getMemoByDealId(input.dealId),
            ]);
            dealContext= `\n\n## Active Deal Context\n**${deal.name}** (${deal.location ?? "Unknown location"})\n- Stage: ${deal.stage}\n- Revenue: $${(deal.revenue ?? 0).toLocaleString()}\n- Cash Flow: $${(deal.cashFlow ?? 0).toLocaleString()}\n- Asking: $${(deal.askingPrice ?? 0).toLocaleString()}\n- AI Score: ${deal.score ?? "Not scored"}\n- OZ: ${deal.opportunityZone ? "Yes" : "No"} | TAD: ${deal.tadDistrict ? "Yes" : "No"}\n${signal ? `- Signal: SBA ${signal.sbaEligible ? "Eligible" : "Not eligible"} | DSCR: ${signal.dscr ?? "\u2014"} | Kill prob: ${signal.killProbability ?? "\u2014"}` : ""}\n${memo ? `- Investment Memo: Exists` : ""}`;        }
        }

        // Pipeline summary for context
        const pipelineSummary = allDeals.slice(0, 10).map(d =>
          `- ${d.name} | ${d.location ?? "—"} | Score: ${d.score ?? "—"} | Stage: ${d.stage} | CF: $${((d.cashFlow ?? 0) / 1000).toFixed(0)}k`
        ).join("\n");

        const recentActivitySummary = recentActivity.slice(0, 5).map(a =>
          `- ${a.title}`
        ).join("\n");

        const systemPrompt = `You are Lenox's AI Co-Pilot — a highly intelligent, decisive strategic advisor embedded in Signal Hunter, his M&A acquisition command center.

Your persona: Think Donna Paulsen meets Olivia Pope. Highly competent, always two steps ahead, zero fluff. You challenge weak ideas, stress-test assumptions, and surface leverage points Lenox hasn't considered. You are NOT a yes-man.

## Lenox's Profile
- GenAI Product Strategist & AI Solutions Architect | Venture Operator
- Building a portfolio of ventures: Orbital (context-native creation), AfterHours (creator platform), Saint & Summer (children's IP)
- Planning 1-2 year relocation to Mexico with family
- Acquisition thesis: SBA 7(a) + Opportunity Zone arbitrage, targeting $500k+ cash flow businesses in Southeast/Sun Belt
- Target: $1M+ annual income from acquisitions within 18 months
- Bias toward speed and shipping. "Good enough today > perfect plan next week."

## Current Pipeline (Top 10)
${pipelineSummary}

## Recent Activity
${recentActivitySummary}${dealContext}

## Your Operating Doctrine
1. **Challenge everything** — stress-test ideas, flag weak assumptions early, provide contrarian insights
2. **High-signal output** — use tables and bullets to surface tradeoffs, risks, and leverage points
3. **Agentic bias** — if a task can be automated or turned into an SOP, propose it
4. **Context-aware** — filter all advice through Lenox's multi-venture reality and acquisition thesis
5. **Execution-focused** — optimize for speed and compound-value work

When analyzing deals, always consider: SBA eligibility, OZ/TAD status, DSCR, seller motivation, industry defensibility, and the "Third Signal" arbitrage angle.

Be concise. Be direct. Be right.`;

        // Build messages array for Poe — convert our format to OpenAI format
        const poeMsgs = [
          { role: "system" as const, content: systemPrompt },
          ...input.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        const client = new (await import("openai")).default({
          apiKey: process.env.Poe_api_key,
          baseURL: "https://api.poe.com/v1",
        });

        const response = await client.chat.completions.create({
          model: POE_MODELS.CLAUDE_OPUS,
          messages: poeMsgs,
          max_tokens: 2048,
          temperature: 0.4,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Co-Pilot returned empty response" });

        return { content, model: POE_MODELS.CLAUDE_OPUS };
      }),
  }),

  // ─── Off-Market Scout Agent ───────────────────────────────────────────────
  offMarket: router({
    /**
     * RETIRED. This generated invented businesses ("realistic business name…
     * use local flavor") and wrote them into commercial_assets as if sourced.
     * Off-market discovery now runs on real public records —
     * scout.sourceOffMarket, backed by server/offMarketSourcing.ts.
     */
    hunt: operatorProcedure
      .input(z.object({
        targetLocations: z.array(z.string()).min(1),
        industries: z.array(z.string()).optional(),
        minCashFlow: z.number().optional(),
        maxAskingPrice: z.number().optional(),
      }))
      .mutation(async () => {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Off-market hunting now uses real public records. Use Off-Market Discovery (/off-market) — it searches land bank inventories, delinquent tax rolls, vacant registries and code enforcement, and shows you the source document before anything is saved.",
        });
      }),
  }),



  investor: router({
    // Get investor DNA status (quiz completed? archetype?)
    getDnaStatus: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { quizCompleted: false, archetypeCode: null, archetypeLabel: null, assetClass: "historic" };
      const { investorDna } = await import("../drizzle/schema");
      const result = await db.select().from(investorDna).where(eq(investorDna.userId, ctx.user.id)).limit(1);
      if (!result[0]) return { quizCompleted: false, archetypeCode: null, archetypeLabel: null, assetClass: "historic" };
      return {
        quizCompleted: result[0].quizCompleted,
        archetypeCode: result[0].archetypeCode,
        archetypeLabel: result[0].archetypeLabel,
        timeHorizon: result[0].timeHorizon,
        riskTolerance: result[0].riskTolerance,
        liquidityNeed: result[0].liquidityNeed,
        esgConviction: result[0].esgConviction,
        sectorAffinity: result[0].sectorAffinity ?? [],
        assetClass: result[0].assetClass ?? "historic",
      };
    }),

    // Save investor DNA from onboarding quiz
    saveDna: protectedProcedure.input(z.object({
      timeHorizon: z.number().min(0).max(1),
      riskTolerance: z.number().min(0).max(1),
      liquidityNeed: z.number().min(0).max(1),
      esgConviction: z.number().min(0).max(1),
      sectorAffinity: z.array(z.string()),
      assetClass: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { investorDna } = await import("../drizzle/schema");

      // Compute archetype from strand scores
      let archetypeCode = "ANCHOR-1";
      let archetypeLabel = "Steady Anchor";
      if (input.riskTolerance > 0.7 && input.timeHorizon > 0.6) {
        archetypeCode = "ALPHA-7";
        archetypeLabel = "Alpha Hunter";
      } else if (input.esgConviction > 0.7) {
        archetypeCode = "IMPACT-4";
        archetypeLabel = "Impact Operator";
      } else if (input.liquidityNeed < 0.3 && input.timeHorizon > 0.7) {
        archetypeCode = "COMPOUNDER-9";
        archetypeLabel = "Long Compounder";
      } else if (input.riskTolerance > 0.5 && input.timeHorizon < 0.4) {
        archetypeCode = "SPRINT-3";
        archetypeLabel = "Sprint Trader";
      }

      const existing = await db.select({ id: investorDna.id }).from(investorDna).where(eq(investorDna.userId, ctx.user.id)).limit(1);
      if (existing[0]) {
        await db.update(investorDna).set({
          timeHorizon: input.timeHorizon,
          riskTolerance: input.riskTolerance,
          liquidityNeed: input.liquidityNeed,
          esgConviction: input.esgConviction,
          sectorAffinity: input.sectorAffinity,
          archetypeCode,
          archetypeLabel,
          ...(input.assetClass ? { assetClass: input.assetClass } : {}),
          quizCompleted: true,
        }).where(eq(investorDna.userId, ctx.user.id));
      } else {
        await db.insert(investorDna).values({
          userId: ctx.user.id,
          timeHorizon: input.timeHorizon,
          riskTolerance: input.riskTolerance,
          liquidityNeed: input.liquidityNeed,
          esgConviction: input.esgConviction,
          sectorAffinity: input.sectorAffinity,
          archetypeCode,
          archetypeLabel,
          assetClass: input.assetClass ?? "historic",
          quizCompleted: true,
        });
      }
      return { archetypeCode, archetypeLabel };
    }),

    // Get curated deals for investor
    getDeals: protectedProcedure.query(async () => {
      return getDeals({ limit: 50 });
    }),

    // Express interest in a deal
    /** Interest in a PROPERTY asset. Kept separate from expressInterest so a
     *  commercial_assets.id can never be written into investor_interest.deal_id. */
    expressAssetInterest: protectedProcedure.input(z.object({
      assetId: z.number(),
      allocationAmount: z.number().optional(),
      investorNote: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { investorInterest } = await import("../drizzle/schema");
      const { and } = await import("drizzle-orm");

      const existing = await db.select({ id: investorInterest.id }).from(investorInterest)
        .where(and(eq(investorInterest.userId, ctx.user.id), eq(investorInterest.assetId, input.assetId))).limit(1);

      if (existing[0]) {
        await db.update(investorInterest).set({
          allocationAmount: input.allocationAmount ?? null,
          investorNote: input.investorNote ?? null,
          status: "expressed",
        }).where(eq(investorInterest.id, existing[0].id));
      } else {
        await db.insert(investorInterest).values({
          userId: ctx.user.id,
          dealId: null,
          assetId: input.assetId,
          allocationAmount: input.allocationAmount ?? null,
          investorNote: input.investorNote ?? null,
          status: "expressed",
        });
      }

      try {
        const { getCommercialAssetById } = await import("./db");
        const asset: any = await getCommercialAssetById(input.assetId);
        const { notifyOwner } = await import("./_core/notification");
        await notifyOwner({
          title: `Client interest — ${asset?.name ?? `asset ${input.assetId}`}`,
          content: `${ctx.user.name ?? ctx.user.email ?? "A client"} flagged interest in ${asset?.name ?? "an asset"} (${asset?.city ?? "?"}, ${asset?.state ?? "?"}).\n\n${input.investorNote ?? ""}`,
        });
      } catch { /* notification is best-effort */ }

      return { success: true } as const;
    }),

    expressInterest: protectedProcedure.input(z.object({
      dealId: z.number(),
      allocationAmount: z.number().optional(),
      investorNote: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { investorInterest } = await import("../drizzle/schema");
      const { and } = await import("drizzle-orm");

      const existing = await db.select({ id: investorInterest.id }).from(investorInterest)
        .where(and(eq(investorInterest.userId, ctx.user.id), eq(investorInterest.dealId, input.dealId))).limit(1);

      if (existing[0]) {
        await db.update(investorInterest).set({
          allocationAmount: input.allocationAmount ?? null,
          investorNote: input.investorNote ?? null,
          status: "expressed",
        }).where(eq(investorInterest.id, existing[0].id));
      } else {
        await db.insert(investorInterest).values({
          userId: ctx.user.id,
          dealId: input.dealId,
          allocationAmount: input.allocationAmount ?? null,
          investorNote: input.investorNote ?? null,
          status: "expressed",
        });
      }

      try {
        const { notifyOwner } = await import("./_core/notification");
        await notifyOwner({
          title: "New Investor Interest",
          content: `Investor (user #${ctx.user.id}) expressed interest in deal #${input.dealId}${input.allocationAmount ? ` — $${input.allocationAmount.toLocaleString()} allocation` : ""}${input.investorNote ? `\n\nNote: ${input.investorNote}` : ""}`,
        });
      } catch {}

      return { success: true };
    }),

    // Get investor's expressed interests
    getMyInterests: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const { investorInterest } = await import("../drizzle/schema");
      return db.select().from(investorInterest).where(eq(investorInterest.userId, ctx.user.id))
        .orderBy(desc(investorInterest.createdAt));
    }),

    // Operator: get all investor interests
    getAllInterests: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return [];
      const { investorInterest } = await import("../drizzle/schema");
      const rows = await db
        .select({
          id: investorInterest.id,
          userId: investorInterest.userId,
          dealId: investorInterest.dealId,
          dealName: deals.name,
          allocationAmount: investorInterest.allocationAmount,
          investorNote: investorInterest.investorNote,
          status: investorInterest.status,
          operatorNote: investorInterest.operatorNote,
          createdAt: investorInterest.createdAt,
        })
        .from(investorInterest)
        .leftJoin(deals, eq(deals.id, investorInterest.dealId))
        .orderBy(desc(investorInterest.createdAt))
        .limit(100);
      return rows;
    }),

    // Operator: update interest status
    updateInterestStatus: protectedProcedure.input(z.object({
      interestId: z.number(),
      status: z.enum(["expressed", "operator_reviewing", "memo_shared", "committed", "passed"]),
      operatorNote: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { investorInterest } = await import("../drizzle/schema");
      await db.update(investorInterest).set({
        status: input.status,
        operatorNote: input.operatorNote ?? null,
      }).where(eq(investorInterest.id, input.interestId));
      return { success: true };
    }),
    }),

  // ─── Insurance Prospector ────────────────────────────────────────────────────
  insurance: insuranceRouter,
  invite: inviteRouter,
  stack: stackRouter,
  // ─── Admin — User Management ─────────────────────────────────────────────────
  admin: router({
    /** List all users (admin only) */
    listUsers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return [];
      const { users: usersTable } = await import("../drizzle/schema");
      const rows = await db
        .select({
          id: usersTable.id,
          openId: usersTable.openId,
          name: usersTable.name,
          email: usersTable.email,
          loginMethod: usersTable.loginMethod,
          role: usersTable.role,
          createdAt: usersTable.createdAt,
          updatedAt: usersTable.updatedAt,
          lastSignedIn: usersTable.lastSignedIn,
          onboardingCompleted: usersTable.onboardingCompleted,
        })
        .from(usersTable)
        .orderBy(desc(usersTable.createdAt))
        .limit(200);
      return rows;
    }),
    /** Update a user's role (admin only) */
    updateRole: protectedProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["user", "admin", "investor", "insurance"]),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { users: usersTable } = await import("../drizzle/schema");
        await db.update(usersTable)
          .set({ role: input.role, updatedAt: new Date() })
          .where(eq(usersTable.id, input.userId));
        return { success: true };
      }),
    /** Get platform stats (admin only) */
    platformStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return null;
      const { users: usersTable, deals: dealsTable } = await import("../drizzle/schema");
      // User counts by role
      const userRows = await db
        .select({ role: usersTable.role, count: sql<number>`COUNT(*)` })
        .from(usersTable)
        .groupBy(usersTable.role);
      // Deal counts by stage (non-archived)
      const dealRows = await db
        .select({ stage: dealsTable.stage, count: sql<number>`COUNT(*)` })
        .from(dealsTable)
        .where(eq(dealsTable.isArchived, false))
        .groupBy(dealsTable.stage);
      // Insurance prospect counts by status
      let prospectRows: { status: string; count: number }[] = [];
      try {
        const result = await db.execute(
          sql`SELECT status, COUNT(*) as count FROM insurance_prospects GROUP BY status`
        ) as any;
        const arr = Array.isArray(result[0]) ? result[0] : (result.rows ?? result);
        prospectRows = (arr as any[]).map((r: any) => ({ status: String(r.status ?? ""), count: Number(r.count ?? 0) }));
      } catch (_) { /* table may not exist yet */ }
      return { users: userRows, deals: dealRows, prospects: prospectRows };
    }),
    /** List access requests (admin only) */
    listAccessRequests: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return [];
      const { accessRequests } = await import("../drizzle/schema");
      return db.select().from(accessRequests).orderBy(desc(accessRequests.createdAt)).limit(100);
    }),
    /** Update access request status (admin only) */
    updateAccessRequestStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "approved", "rejected"]),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { accessRequests } = await import("../drizzle/schema");
        await db.update(accessRequests)
          .set({ status: input.status })
          .where(eq(accessRequests.id, input.id));
        return { success: true };
      }),
  }),
  // ─── Thesis Engine (STRATEGIST agent — Spec TSL-SCI-PROD-001-A1) ─────────────
  thesis: thesisRouter,
  tide: tideRouter,
  ripple: rippleRouter,
  research: researchRouter,
  rolePermissions: rolePermissionsRouter,
  // ─── LOI Generation (GEMINI 3.1 FLASH — Agentic Drafting) ────────────────────
  loi: router({
    generate: protectedProcedure
      .input(z.object({
        dealId: z.number(),
        purchasePrice: z.number(),
        earnOutYear1: z.number().optional(),
        earnOutYear2: z.number().optional(),
        exclusivityDays: z.number().default(60),
        contingencies: z.array(z.string()).default([]),
      }))
      .mutation(async ({ input }) => {
        const deal = await getDealById(input.dealId);
        if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
        const { invokeLLM } = await import("./_core/llm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        const systemPrompt = `You are The Architect — a senior M&A attorney drafting a Letter of Intent.
Generate a professional, legally-structured LOI with these sections:
1. Purchase Price and Payment
2. Earn-Out Structure (if applicable)
3. Exclusivity Period
4. Representations and Warranties (tailor based on owner psychology signals)
5. Key Employee Retention
6. Due Diligence Period
7. Closing Conditions

Return JSON: {
  "loiText": "full LOI markdown text",
  "repsAndWarrantiesNote": "behavioral insight note for the R&W section",
  "earnOutRationale": "strategic rationale for earn-out structure",
  "coAnalystContext": "Co-Analyst earn-out guidance paragraph",
  "agentLog": [{"time": "HH:MM AM", "action": "...", "type": "info|flag|action"}]
}`;

        const userPrompt = `Deal: ${deal.name} (${deal.industry ?? "Unknown"}, ${deal.location ?? "Unknown"})
Revenue: $${((deal.revenue || 0) / 1e6).toFixed(2)}M | Cash Flow: $${((deal.cashFlow || 0) / 1e3).toFixed(0)}k | Asking: $${((deal.askingPrice || 0) / 1e6).toFixed(2)}M
Purchase Price: $${(input.purchasePrice / 1e6).toFixed(2)}M
${input.earnOutYear1 ? `Earn-Out: $${(input.earnOutYear1 / 1e6).toFixed(1)}M Year 1 / $${((input.earnOutYear2 || 0) / 1e6).toFixed(1)}M Year 2` : "No earn-out"}
Exclusivity: ${input.exclusivityDays} days
Contingencies: ${input.contingencies.join(", ") || "Standard"}

Draft the LOI. For R&W, note that behavioral profiling indicates the owner may have legacy preservation motivations — tailor accordingly to reduce friction.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "loi_output",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  loiText: { type: "string" },
                  repsAndWarrantiesNote: { type: "string" },
                  earnOutRationale: { type: "string" },
                  coAnalystContext: { type: "string" },
                  agentLog: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        time: { type: "string" },
                        action: { type: "string" },
                        type: { type: "string" },
                      },
                      required: ["time", "action", "type"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["loiText", "repsAndWarrantiesNote", "earnOutRationale", "coAnalystContext", "agentLog"],
                additionalProperties: false,
              },
            },
          },
        });

        const raw = response.choices[0].message.content;
        const parsed = JSON.parse(raw as string);

        await logActivity({
          type: "signal_analyzed",
          title: `LOI Draft generated for ${deal.name} — $${(input.purchasePrice / 1e6).toFixed(2)}M`,
          dealId: input.dealId,
        });

        return {
          dealName: deal.name,
          purchasePrice: input.purchasePrice,
          earnOutYear1: input.earnOutYear1,
          earnOutYear2: input.earnOutYear2,
          exclusivityDays: input.exclusivityDays,
          contingencies: input.contingencies,
          loiText: parsed.loiText,
          repsAndWarrantiesNote: parsed.repsAndWarrantiesNote,
          earnOutRationale: parsed.earnOutRationale,
          coAnalystContext: parsed.coAnalystContext,
          agentLog: parsed.agentLog,
        };
      }),
  }),
});
export type AppRouter = typeof appRouter;

// ─── Async Scan Pipeline ──────────────────────────────────────────────────────
// Runs in the background after trigger() returns. Updates scan_jobs row with
// live phase/progress so the frontend can poll for real-time feedback.
async function runScanPipeline(
  jobId: number,
  sources: string[],
  minCashFlow: number,
  maxMultiple: number,
  targetLocations: string[] = [],
) {
  const phase = async (label: string, detail: string, pct: number) =>
    updateScanJob(jobId, { currentPhase: label, phaseDetail: detail, progressPct: pct });

  // ── Phase 1: LLM-generated marketplace listings (no hardcoded test data) ────
  await phase("Scanning marketplaces", `Fetching listings from ${sources.join(", ")}`, 10);
  await new Promise((r) => setTimeout(r, 1500));

  // Fetch REAL, currently-listed businesses for sale via Perplexity sonar-pro
  // (live web research with citations) — never fabricate listings or financials.
  const locationHint = targetLocations.length > 0
    ? `Focus on these markets: ${targetLocations.join(", ")}.`
    : "Focus on Southeast/Sun Belt US markets (Atlanta, Charlotte, Raleigh, Tampa, Nashville, Birmingham, Houston).";
  const sourceHint = sources.join(", ");

  let listings: Array<{ name: string; industry: string; location: string; revenue: number; cashFlow: number; askingPrice: number; multiple: number; employees: number; yearEstablished: number; source: string; listingUrl?: string }> = [];
  try {
    const key = process.env.SONAR_API_KEY;
    if (!key) throw new Error("SONAR_API_KEY not configured");
    const res = await fetch("https://api.perplexity.ai/v1/sonar", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: "You are a business-acquisition research analyst. Report ONLY real businesses currently listed for sale that you can find and cite. Never invent listings, names, or financials. If a figure is not stated in the source, use 0. Always include the real listing-page URL. Output ONLY a JSON array." },
          { role: "user", content: `Find up to ${4 + sources.length} REAL businesses currently for sale on ${sourceHint}. ${locationHint} Prefer recession-resistant service businesses (HVAC, commercial cleaning, plumbing, electrical, pest control, logistics, roofing) with cash flow around or above $${Math.round(minCashFlow / 1000)}k. For each real listing return an object: {"name","industry","location","revenue","cashFlow","askingPrice","multiple","employees","yearEstablished","source","listingUrl"}. Use 0 for any figure not stated in the source. "listingUrl" MUST be the real listing page. Return ONLY a JSON array — no prose.` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Sonar API error ${res.status}`);
    const data: any = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    const citations: string[] = Array.isArray(data.citations) ? data.citations : [];
    const match = content.match(/\[[\s\S]*\]/);
    const arr: any[] = match ? JSON.parse(match[0]) : [];
    listings = (Array.isArray(arr) ? arr : []).map((l: any, i: number) => ({
      name: String(l.name ?? "").slice(0, 200),
      industry: String(l.industry ?? "Service Business"),
      location: String(l.location ?? targetLocations[0] ?? ""),
      revenue: Number(l.revenue) || 0,
      cashFlow: Number(l.cashFlow) || 0,
      askingPrice: Number(l.askingPrice) || 0,
      multiple: Number(l.multiple) || 0,
      employees: Number(l.employees) || 0,
      yearEstablished: Number(l.yearEstablished) || 0,
      source: String(l.source ?? sources[0] ?? "market-research"),
      listingUrl: String(l.listingUrl ?? citations[i] ?? citations[0] ?? ""),
    })).filter((l) => l.name);
  } catch (e) {
    console.warn("[Scan] Sonar listing research failed, scan completes with 0 listings:", e);
    listings = [];
  }

  await phase("Extracting deal data", `Parsing ${listings.length} qualified listings`, 25);
  await updateScanJob(jobId, { listingsFound: listings.length });
  await new Promise((r) => setTimeout(r, 1000));

  // ── Phase 2: Filter by criteria ───────────────────────────────────────────
  await phase("Applying filters", `Min cash flow $${(minCashFlow / 1000).toFixed(0)}k · Max ${maxMultiple}x multiple`, 35);
  const qualified = listings.filter(
    (l) => l.cashFlow >= minCashFlow && l.multiple <= maxMultiple
  );
  await updateScanJob(jobId, { listingsQualified: qualified.length });
  await new Promise((r) => setTimeout(r, 800));

  // ── Phase 3: Score each deal ──────────────────────────────────────────────
  await phase("AI scoring", `Scoring ${qualified.length} deals with Gemini 3.1 Flash`, 45);
  let scored = 0;
  for (const listing of qualified) {
    // Upsert deal — ON DUPLICATE KEY UPDATE handles re-scan deduplication
    // getDealIdByNameSource checks if the deal already exists first
    let dealId: number;
    const existingId = await getDealIdByNameSource(listing.name, listing.source ?? null);
    if (existingId) {
      dealId = existingId;
    } else {
      // Market Scan now pulls REAL sonar-sourced listings with real listingUrls —
      // no longer synthetic.
      const res = await createDeal({ ...listing, stage: "new", isSynthetic: false }) as any;
      // ON DUPLICATE KEY UPDATE returns insertId=0 for updates — re-fetch if needed
      dealId = res[0].insertId || (await getDealIdByNameSource(listing.name, listing.source ?? null)) || 0;
    }

    // Score the deal
    try {
      const deal = await getDealById(dealId);
      if (deal) {
        const { score, redFlagCount } = await scoreDeal(deal);
        await updateDealScore(dealId, score, redFlagCount);
        const stage = score >= 0.75 ? "high_priority" : score >= 0.60 ? "qualified" : "new";
        await updateDealStage(dealId, stage);

        // OZ/TAD enrichment — runs async after scoring
        enrichDealWithOZTAD(deal.location, deal.askingPrice, deal.cashFlow)
          .then(async (enrichment) => {
            if (enrichment.opportunityZone || enrichment.tadDistrict || enrichment.eventProximityMiles) {
              const db = await getDb();
              if (!db) return;
              await db.execute(
                sql`UPDATE deals SET
                  opportunity_zone = ${enrichment.opportunityZone ? 1 : 0},
                  oz_tract_id = ${enrichment.ozTractId ?? null},
                  tad_district = ${enrichment.tadDistrict ?? null},
                  oz_potential_gain = ${enrichment.ozPotentialGain ?? null},
                  event_proximity_miles = ${enrichment.eventProximityMiles ?? null},
                  event_revenue_low = ${enrichment.eventRevenueLow ?? null},
                  event_revenue_high = ${enrichment.eventRevenueHigh ?? null}
                WHERE id = ${dealId}`
              );
              if (enrichment.opportunityZone) {
                await logActivity({
                  dealId,
                  type: "deal_scored",
                  title: `OZ Detected: ${deal.name}`,
                  detail: `Tract ${enrichment.ozTractId} · Est. tax-free gain $${((enrichment.ozPotentialGain ?? 0) / 1000).toFixed(0)}k`,
                });
              }
              if (enrichment.tadDistrict) {
                await logActivity({
                  dealId,
                  type: "deal_scored",
                  title: `TAD District: ${enrichment.tadDistrict}`,
                  detail: `${deal.name} is within the ${enrichment.tadDistrict}`,
                });
              }
            }
          })
          .catch((e) => console.warn(`[OZ/TAD] Enrichment failed for ${listing.name}:`, e));
      }
    } catch (e) {
      console.warn(`[Scan] Scoring failed for ${listing.name}:`, e);
    }

    scored++;
    await updateScanJob(jobId, {
      dealsScored: scored,
      progressPct: 45 + Math.round((scored / qualified.length) * 35),
      phaseDetail: `Scored ${scored}/${qualified.length}: ${listing.name}`,
    });
    await new Promise((r) => setTimeout(r, 400));
  }

  // ── Phase 4: Log and complete ─────────────────────────────────────────────
  await phase("Finalizing results", `${qualified.length} deals scored · ${qualified.filter((_, i) => i < scored).length} added to pipeline`, 92);
  await logActivity({
    type: "scan_completed",
    title: `Market scan complete: ${qualified.length} deals scored across ${sources.length} platforms`,
  });
  await new Promise((r) => setTimeout(r, 600));

  await updateScanJob(jobId, {
    status: "completed",
    currentPhase: "Scan complete",
    phaseDetail: `${qualified.length} deals scored · ${qualified.length} added to pipeline`,
    progressPct: 100,
    completedAt: new Date(),
  });
}
