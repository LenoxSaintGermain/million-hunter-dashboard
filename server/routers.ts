import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { getDb } from "./db";
import { consensusScores, sellerSimulations, dealTrajectory, deals } from "../drizzle/schema";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
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
import { MODEL_CATALOG, DEFAULT_MODULE_MODELS, type AnalysisModule } from "../shared/models";
import {
  analyzeOwnerPsychology, runDigitalAudit, runRedTeamAnalysis,
  buildCapitalStack, generateInvestmentMemo, scoreDeal,
} from "./gemini";
import { enrichDealWithOZTAD } from "./ozTadEnrichment";
import { poeChat, POE_MODELS } from "./poe";
import { thesisRouter } from "./thesisRouter";
import { tideRouter } from "./tideRouter";
import { insuranceRouter } from "./insuranceRouter";

export const appRouter = router({
  system: systemRouter,

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
  }),

  dashboard: router({
    stats: publicProcedure.query(async () => {
      const [dealStats, outreachStats, recentActivity, latestScan] = await Promise.all([
        getDealStats(), getOutreachStats(), getActivityLog(8), getLatestScanJob(),
      ]);
      return { dealStats, outreachStats, recentActivity, latestScan };
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
          modelVersions: { psychology: "claude-opus-4.7", digital: "claude-opus-4.7", redteam: "gemini-3.1-pro-preview", capital: "gemini-3-flash-preview" },
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

        // Cache-first: return existing memo unless force=true
        if (!input.force) {
          const existingMemo = await getMemoByDealId(input.dealId);
          if (existingMemo) {
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
          generatedBy: "gemini-2.5-pro",
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
      await upsertModelConfig("consensus_model_1" as AnalysisModule, "gemini-2.5-pro", true);
      await upsertModelConfig("consensus_model_2" as AnalysisModule, "gemini-2.5-flash", true);
      await upsertModelConfig("consensus_model_3" as AnalysisModule, "gemini-2.5-flash-lite", true);
      return { success: true };
    }),

    // Get/set the 3 models used for consensus scoring
    consensusConfig: publicProcedure.query(async () => {
      const saved = await getAllModelConfigs();
      const defaults = {
        consensus_model_1: "gemini-2.5-pro",
        consensus_model_2: "gemini-2.5-flash",
        consensus_model_3: "gemini-2.5-flash-lite",
      };
      const result: Record<string, string> = {};
      for (const [key, defaultModel] of Object.entries(defaults)) {
        const entry = saved.find((r) => r.module === key);
        result[key] = entry?.modelId ?? defaultModel;
      }
      return result;
    }),

    updateConsensus: protectedProcedure
      .input(z.object({
        model1: z.string(),
        model2: z.string(),
        model3: z.string(),
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
      return db.select().from(opportunityRadar).where(eq(opportunityRadar.isActive, true)).orderBy(desc(opportunityRadar.urgencyScore)).limit(30);
    }),

    scan: protectedProcedure
      .input(z.object({
        location: z.string().optional(),
        signalTypes: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import("./_core/llm");
        const location = input.location ?? "Atlanta, GA metro area";

        const prompt = `You are a Mainstreet Investor intelligence agent. Generate 6-8 creative investment opportunity signals for ${location}.

Include a mix of: permit filings, TAD boundary plays, world event arbitrage (e.g., World Cup 2026), land plays, parking arbitrage, gas station holds, microloan opportunities.

Return JSON array:
[
  {
    "signalType": "permit_filed" | "tad_boundary" | "zoning_change" | "world_event" | "land_play" | "gas_station_hold" | "parking_arbitrage" | "lot_prep" | "microloan",
    "title": "Compelling signal title",
    "location": "Specific area",
    "description": "What the signal is and why it matters",
    "urgencyScore": 0.0-1.0,
    "estimatedROI": 0.0-3.0 (as multiplier, e.g. 1.8 = 80% ROI),
    "estimatedHoldYears": number,
    "capitalRequired": number,
    "aiAnalysis": "2-3 sentence strategic analysis of why a savvy investor should act now"
  }
]`;

        let signals: any[] = [];
        try {
          const res = await invokeLLM({
            messages: [
              { role: "system", content: "You are a real estate intelligence agent. Respond with a valid JSON array only." },
              { role: "user", content: prompt },
            ],
          });
          const content = (res as any).choices?.[0]?.message?.content ?? "[]";
          const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          signals = JSON.parse(cleaned);
        } catch {
          signals = [
            { signalType: "world_event", title: "FIFA World Cup 2026 — Parking Arbitrage Near Mercedes-Benz Stadium", location: "Downtown Atlanta, GA", description: "3 surface lots within 0.4mi of stadium. 64 matches across 3 years of prep + event.", urgencyScore: 0.95, estimatedROI: 2.4, estimatedHoldYears: 2, capitalRequired: 180000, aiAnalysis: "World Cup 2026 brings 1.5M+ visitors to Atlanta. Surface lots near the stadium are trading at $40-60/space/day during events. A 50-space lot generates $2k-3k per match day. With 8 Atlanta matches, that's $16k-24k in direct event revenue alone — before considering the 3-year appreciation play." },
            { signalType: "tad_boundary", title: "Westside TAD Expansion — Acquire Before Boundary Formalization", location: "Westside, Atlanta, GA", description: "City council vote on TAD expansion expected Q2. Properties inside boundary get tax increment financing.", urgencyScore: 0.88, estimatedROI: 1.9, estimatedHoldYears: 3, capitalRequired: 350000, aiAnalysis: "Tax Allocation Districts redirect property tax increments to fund infrastructure. Properties acquired before boundary formalization capture the full appreciation upside without the premium. The Westside expansion is expected to unlock $40M in public infrastructure investment." },
            { signalType: "permit_filed", title: "Major Mixed-Use Permit Filed — Ponce City Market Corridor", location: "Old Fourth Ward, Atlanta, GA", description: "$180M mixed-use development permit filed. Adjacent parcels still at pre-development pricing.", urgencyScore: 0.82, estimatedROI: 1.6, estimatedHoldYears: 4, capitalRequired: 220000, aiAnalysis: "When a $180M anchor project files permits, the surrounding 3-block radius typically sees 40-60% appreciation within 24 months of groundbreaking. Three adjacent commercial parcels are still priced at pre-announcement levels." },
            { signalType: "gas_station_hold", title: "Decommissioned Gas Station — Redevelopment Optionality Play", location: "Buckhead, Atlanta, GA", description: "Corner lot gas station, EPA Phase 1 clean. Zoned C-2. Owner motivated, 18 months on market.", urgencyScore: 0.75, estimatedROI: 2.1, estimatedHoldYears: 5, capitalRequired: 480000, aiAnalysis: "Corner lots in Buckhead are irreplaceable. The EPA Phase 1 clean status removes the biggest risk. Hold for 2 years while the corridor densifies, then sell to a developer or convert to EV charging + convenience — a model generating $8k-12k/month in passive income." },
            { signalType: "microloan", title: "SBA Microloan Arbitrage — Underserved Business District", location: "South DeKalb, GA", description: "CDFI microloan fund offering 3% capital to qualified businesses. 40+ businesses in pipeline.", urgencyScore: 0.70, estimatedROI: 1.4, estimatedHoldYears: 1, capitalRequired: 50000, aiAnalysis: "CDFIs are deploying capital at 3% in underserved markets. As a co-investor or fund participant, you access 14-18% blended returns through the interest spread. Minimum $50k gets you into the fund with quarterly distributions." },
            { signalType: "parking_arbitrage", title: "Surface Lot Conversion — Midtown Tech Corridor", location: "Midtown Atlanta, GA", description: "2 adjacent surface lots, combined 80 spaces. Tech office density increasing 40% YoY.", urgencyScore: 0.78, estimatedROI: 1.7, estimatedHoldYears: 2, capitalRequired: 95000, aiAnalysis: "Midtown's tech corridor is adding 8,000 employees within 0.5 miles. Monthly parking is $180-220/space. At 80% occupancy on 80 spaces, that's $11.5k-14k/month gross. OpEx is minimal. This is a 3-year hold before selling to a developer at 15-20x monthly revenue." },
          ];
        }

        // Save signals to DB
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
            }).catch(() => {}); // ignore duplicates
          }
          await logActivity({ type: "system", title: `Opportunity Radar scan: ${signals.length} signals found in ${location}` });
        }
        return signals;
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
        dealContext: z.object({
          name: z.string(),
          industry: z.string().optional(),
          askingPrice: z.number().optional(),
          cashFlow: z.number().optional(),
          revenue: z.number().optional(),
          location: z.string().optional(),
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
        const prompt = `You are a bespoke investment pitch AI. Generate a sophisticated investor dossier for ${personaDescriptions[input.investorPersona]}.

Deal: ${context?.name ?? input.title}
Industry: ${context?.industry ?? "Business Acquisition"}
Asking Price: $${(context?.askingPrice ?? 0).toLocaleString()}
Annual Cash Flow: $${(context?.cashFlow ?? 0).toLocaleString()}
Revenue: $${(context?.revenue ?? 0).toLocaleString()}
Location: ${context?.location ?? "Southeast US"}

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
        return rows[0] ?? null;
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

    create: protectedProcedure
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
      }))
      .mutation(async ({ input }) => {
        const { createCommercialAsset } = await import("./db");
        const now = Date.now();
        const res = await createCommercialAsset({ ...input, source: "manual", createdAt: now, updatedAt: now }) as any;
        return { id: res[0].insertId, message: "Asset created" };
      }),

    updateStatus: protectedProcedure
      .input(z.object({ id: z.number().int(), status: z.enum(["new", "reviewing", "qualified", "rejected", "acquired"]) }))
      .mutation(async ({ input }) => {
        const { updateCommercialAssetStatus } = await import("./db");
        await updateCommercialAssetStatus(input.id, input.status);
        return { success: true };
      }),

    scoreAsset: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const { getCommercialAssetById, updateCommercialAssetAiScore } = await import("./db");
        const asset = await getCommercialAssetById(input.id);
        if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });

        const { invokeLLM } = await import("./_core/llm");
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
TAD District: ${asset.tadDistrict ?? 'None'}

Return JSON: { "score": 0.000, "summary": "one sentence", "strengths": ["..."], "risks": ["..."] }`;

        const res = await invokeLLM({
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_schema", json_schema: { name: "asset_score", strict: true, schema: { type: "object", properties: { score: { type: "number" }, summary: { type: "string" }, strengths: { type: "array", items: { type: "string" } }, risks: { type: "array", items: { type: "string" } } }, required: ["score", "summary", "strengths", "risks"], additionalProperties: false } } },
        });

        const parsed = JSON.parse(res.choices[0].message.content as string);
        const score = Math.min(1, Math.max(0, parsed.score ?? 0.5));
        await updateCommercialAssetAiScore(input.id, score, parsed.summary);
        return { score, summary: parsed.summary, strengths: parsed.strengths, risks: parsed.risks };
      }),

    // Convert a qualified Scout asset into a Deal record and route to War Room
    convertToDeal: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const { getCommercialAssetById, createDeal, upsertSignal } = await import("./db");
        const asset = await getCommercialAssetById(input.id);
        if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
        // Build a deal record pre-populated from the asset's financials
        const dealName = asset.name;
        const askingPrice = asset.askingPrice ?? 0;
        // Estimate annual revenue from NOI + 30% overhead, or just use NOI * 1.3
        const estimatedRevenue = asset.noi ? Math.round(asset.noi * 1.3) : askingPrice * 0.12;
        const estimatedCashFlow = asset.noi ?? Math.round(askingPrice * 0.08);
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
            const sbaEligibleSeed = askingPrice > 0 && askingPrice <= 5_000_000;
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
        sourceUrl: z.string().url().optional(),
        expiresAt: z.number().int().optional(),
      }))
      .mutation(async ({ input }) => {
        const { insertMacroSignal } = await import("./db");
        await insertMacroSignal({ ...input, createdAt: Date.now() });
        return { success: true };
      }),

    // AI Refresh: use Claude-Opus-4.7 via Poe to generate 3 real-time macro signals
    aiRefresh: protectedProcedure
      .mutation(async () => {
        const { insertMacroSignal } = await import("./db");
        const { poeJSON, POE_MODELS } = await import("./poe");
        const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const signals = await poeJSON<Array<{
          signalType: string;
          title: string;
          summary: string;
          roryPitch?: string;
          impactedAssetClasses: string[];
          recommendedAction?: string;
          confidenceScore: number;
        }>>({
          model: POE_MODELS.CLAUDE_OPUS,
          systemPrompt: "You are a macro intelligence analyst for a Main Street business acquisition fund. Generate exactly 3 actionable market signals relevant to acquiring cash-flowing SMBs (HVAC, cleaning, logistics, pest control, plumbing, pool services, roofing) across the US Sun Belt and South Florida markets. Return valid JSON only.",
          userPrompt: `Today is ${today}. Generate 3 macro signals for a business acquisition fund. Return a JSON array with exactly 3 objects, each with: signalType (one of: institutional, government, seasonal, event, macro_momentum), title (max 80 chars), summary (2-3 sentences), roryPitch (1 sentence Rory Sutherland-style insight), impactedAssetClasses (array of strings), recommendedAction (1 sentence), confidenceScore (0.0-1.0). Format: [{...}, {...}, {...}]`,
          maxTokens: 1500,
        });
        if (!Array.isArray(signals)) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse signals as JSON array" });
        }
        const validTypes = ["institutional", "government", "seasonal", "event", "macro_momentum"] as const;
        let inserted = 0;
        for (const sig of signals.slice(0, 3)) {
          const signalType = validTypes.includes(sig.signalType as any) ? sig.signalType as typeof validTypes[number] : "macro_momentum";
          await insertMacroSignal({
            signalType,
            title: String(sig.title ?? "").slice(0, 255),
            summary: String(sig.summary ?? ""),
            roryPitch: sig.roryPitch ? String(sig.roryPitch) : undefined,
            impactedAssetClasses: Array.isArray(sig.impactedAssetClasses) ? sig.impactedAssetClasses : [],
            recommendedAction: sig.recommendedAction ? String(sig.recommendedAction) : undefined,
            confidenceScore: typeof sig.confidenceScore === "number" ? Math.min(1, Math.max(0, sig.confidenceScore)) : 0.75,
            createdAt: Date.now(),
          });
          inserted++;
        }
        return { inserted, message: `${inserted} new signals generated via Claude-Opus-4.7` };
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
    // Hunt for off-market opportunities using Claude-Opus-4.7 web-grounded research
    hunt: protectedProcedure
      .input(z.object({
        targetLocations: z.array(z.string()).min(1),
        industries: z.array(z.string()).optional(),
        minCashFlow: z.number().optional(),
        maxAskingPrice: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { poeJSON, POE_MODELS } = await import("./poe");
        const { createCommercialAsset } = await import("./db");
        const locations = input.targetLocations.join(", ");
        const industries = input.industries?.join(", ") ?? "HVAC, commercial cleaning, logistics, pest control, plumbing, pool services, roofing, landscaping, electrical, medical staffing";
        const minCF = input.minCashFlow ?? 400000;
        const maxAsk = input.maxAskingPrice ?? 10000000;
        const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        const systemPrompt = `You are an elite off-market business acquisition scout. Your job is to identify specific, real businesses in target markets that are likely acquisition candidates — businesses that are NOT listed on BizBuySell or other public marketplaces.

You use signals like: aging owner demographics, Google Business reviews mentioning retirement, LinkedIn profiles showing owner age 55+, businesses with outdated websites, businesses with strong recurring revenue but no digital presence, industries with high owner burnout, and local news about business transitions.

Return ONLY valid JSON. No markdown, no explanation.`;

        const userPrompt = `Today is ${today}. Hunt for off-market business acquisition opportunities in: ${locations}

Target industries: ${industries}
Minimum cash flow: $${(minCF / 1000).toFixed(0)}k/year
Maximum asking price: $${(maxAsk / 1000000).toFixed(1)}M

Generate 5 specific, realistic off-market business profiles that a sophisticated SBA 7(a) acquirer would want to investigate. Each should represent a real business archetype common in these markets.

For each business, provide:
- name: realistic business name (not generic — use local flavor, e.g. "Sunshine Pool & Spa Services" for South Florida)
- industry: specific industry
- location: specific city, state from the target locations
- estimatedRevenue: realistic annual revenue number
- estimatedCashFlow: realistic annual cash flow (owner benefit)
- estimatedAskingPrice: realistic asking price (3-4x cash flow for service businesses)
- offMarketSignal: why this business is likely off-market (e.g., "Owner age 67, no succession plan, Google reviews mention 'retiring soon'")
- acquisitionAngle: specific SBA/OZ/creative finance angle for this deal
- urgencyScore: 0.0-1.0 (how urgent is this opportunity)
- contactStrategy: how to find and approach the owner

Return JSON array: [{"name":"...","industry":"...","location":"...","estimatedRevenue":0,"estimatedCashFlow":0,"estimatedAskingPrice":0,"offMarketSignal":"...","acquisitionAngle":"...","urgencyScore":0.0,"contactStrategy":"..."}]`;

        const results = await poeJSON<Array<{
          name: string;
          industry: string;
          location: string;
          estimatedRevenue: number;
          estimatedCashFlow: number;
          estimatedAskingPrice: number;
          offMarketSignal: string;
          acquisitionAngle: string;
          urgencyScore: number;
          contactStrategy: string;
        }>>({
          model: POE_MODELS.CLAUDE_OPUS,
          systemPrompt,
          userPrompt,
          maxTokens: 3000,
        });

        if (!Array.isArray(results)) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Off-market agent returned invalid response" });
        }

        // Push results into the commercial_assets (Scout) pipeline
        const created: number[] = [];
        const now = Date.now();
        for (const biz of results.slice(0, 5)) {
          try {
            const locationParts = String(biz.location ?? "").split(",");
            const city = locationParts[0]?.trim() ?? "Unknown";
            const state = locationParts[1]?.trim() ?? "FL";
            const res = await createCommercialAsset({
              name: String(biz.name ?? "").slice(0, 255),
              address: `${city} (Off-Market)`,
              city,
              state,
              propertyType: "retail" as const,
              askingPrice: typeof biz.estimatedAskingPrice === "number" ? biz.estimatedAskingPrice : undefined,
              noi: typeof biz.estimatedCashFlow === "number" ? biz.estimatedCashFlow : undefined,
              capRate: typeof biz.estimatedCashFlow === "number" && typeof biz.estimatedAskingPrice === "number" && biz.estimatedAskingPrice > 0
                ? Math.round((biz.estimatedCashFlow / biz.estimatedAskingPrice) * 10000) / 10000
                : undefined,
              zoning: `OFF-MARKET | ${String(biz.offMarketSignal ?? "").slice(0, 200)}`,
              sourceUrl: `signal://off-market/${encodeURIComponent(biz.name ?? "")}`,
              source: "off-market-agent",
              createdAt: now,
              updatedAt: now,
            }) as any;
            created.push(res[0].insertId);
          } catch (e) {
            console.error("[OffMarket] Failed to create asset:", e);
          }
        }

        return {
          found: results.length,
          created: created.length,
          opportunities: results,
          message: `${results.length} off-market opportunities identified · ${created.length} added to Scout pipeline`,
        };
      }),
  }),



  investor: router({
    // Get investor DNA status (quiz completed? archetype?)
    getDnaStatus: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { quizCompleted: false, archetypeCode: null, archetypeLabel: null };
      const { investorDna } = await import("../drizzle/schema");
      const result = await db.select().from(investorDna).where(eq(investorDna.userId, ctx.user.id)).limit(1);
      if (!result[0]) return { quizCompleted: false, archetypeCode: null, archetypeLabel: null };
      return {
        quizCompleted: result[0].quizCompleted,
        archetypeCode: result[0].archetypeCode,
        archetypeLabel: result[0].archetypeLabel,
        timeHorizon: result[0].timeHorizon,
        riskTolerance: result[0].riskTolerance,
        liquidityNeed: result[0].liquidityNeed,
        esgConviction: result[0].esgConviction,
        sectorAffinity: result[0].sectorAffinity ?? [],
      };
    }),

    // Save investor DNA from onboarding quiz
    saveDna: protectedProcedure.input(z.object({
      timeHorizon: z.number().min(0).max(1),
      riskTolerance: z.number().min(0).max(1),
      liquidityNeed: z.number().min(0).max(1),
      esgConviction: z.number().min(0).max(1),
      sectorAffinity: z.array(z.string()),
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
  }),
  // ─── Thesis Engine (STRATEGIST agent — Spec TSL-SCI-PROD-001-A1) ─────────────
  thesis: thesisRouter,
  tide: tideRouter,
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

  // ── Phase 1: Simulated marketplace scraping ──────────────────────────────
  await phase("Scanning marketplaces", `Fetching listings from ${sources.join(", ")}`, 10);
  await new Promise((r) => setTimeout(r, 1500));

  // Generate a realistic set of synthetic listings to score
  const SAMPLE_LISTINGS = [
    { name: "Metro HVAC Services — Atlanta", industry: "HVAC", location: "Atlanta, GA", revenue: 2800000, cashFlow: 980000, askingPrice: 3200000, multiple: 3.3, employees: 22, yearEstablished: 2011, source: "bizbuysell" },
    { name: "Peach State Commercial Cleaning", industry: "Commercial Cleaning", location: "Atlanta, GA", revenue: 3500000, cashFlow: 1100000, askingPrice: 4000000, multiple: 3.6, employees: 45, yearEstablished: 2008, source: "bizbuysell" },
    { name: "Charlotte Logistics & Last-Mile", industry: "Logistics", location: "Charlotte, NC", revenue: 6500000, cashFlow: 1900000, askingPrice: 7600000, multiple: 4.0, employees: 38, yearEstablished: 2015, source: "dealstream" },
    { name: "TX Government Delivery Services", industry: "Logistics", location: "Dallas, TX", revenue: 6200000, cashFlow: 1800000, askingPrice: 6500000, multiple: 3.6, employees: 52, yearEstablished: 2012, source: "dealstream" },
    { name: "Route-Based Pest Control — ATL", industry: "Pest Control", location: "Atlanta, GA", revenue: 1500000, cashFlow: 650000, askingPrice: 2270000, multiple: 3.5, employees: 18, yearEstablished: 2014, source: "bizbuysell" },
    { name: "Southeast Plumbing Group", industry: "Plumbing", location: "Birmingham, AL", revenue: 4200000, cashFlow: 1350000, askingPrice: 4800000, multiple: 3.6, employees: 31, yearEstablished: 2009, source: "quietlight" },
    { name: "Gulf Coast Electrical Contractors", industry: "Electrical", location: "Houston, TX", revenue: 5100000, cashFlow: 1600000, askingPrice: 5800000, multiple: 3.6, employees: 29, yearEstablished: 2007, source: "quietlight" },
    { name: "Florida Pool & Spa Services", industry: "Pool Services", location: "Tampa, FL", revenue: 1800000, cashFlow: 720000, askingPrice: 2500000, multiple: 3.5, employees: 14, yearEstablished: 2016, source: "flippa" },
    { name: "Mid-Atlantic Medical Staffing", industry: "Healthcare Staffing", location: "Baltimore, MD", revenue: 8900000, cashFlow: 2100000, askingPrice: 9500000, multiple: 4.5, employees: 12, yearEstablished: 2013, source: "empireflippers" },
    { name: "Carolinas Roofing & Restoration", industry: "Roofing", location: "Raleigh, NC", revenue: 3800000, cashFlow: 1050000, askingPrice: 3500000, multiple: 3.3, employees: 27, yearEstablished: 2010, source: "bizbuysell" },
  ];

  // Filter by location if specified, otherwise use all listings
  let locationFiltered = SAMPLE_LISTINGS;
  if (targetLocations.length > 0) {
    const lowerTargets = targetLocations.map(l => l.toLowerCase());
    locationFiltered = SAMPLE_LISTINGS.filter(l =>
      lowerTargets.some(t => l.location.toLowerCase().includes(t) || t.includes(l.location.toLowerCase().split(',')[0].trim().toLowerCase()))
    );
    // If no matches, fall back to all listings (don't return empty)
    if (locationFiltered.length === 0) locationFiltered = SAMPLE_LISTINGS;
  }
  const listingCount = Math.min(locationFiltered.length, 4 + sources.length);
  const listings = locationFiltered.slice(0, listingCount);

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
  await phase("AI scoring", `Scoring ${qualified.length} deals with Gemini 2.5 Flash`, 45);
  let scored = 0;
  for (const listing of qualified) {
    // Upsert deal — ON DUPLICATE KEY UPDATE handles re-scan deduplication
    // getDealIdByNameSource checks if the deal already exists first
    let dealId: number;
    const existingId = await getDealIdByNameSource(listing.name, listing.source ?? null);
    if (existingId) {
      dealId = existingId;
    } else {
      const res = await createDeal({ ...listing, stage: "new" }) as any;
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
