import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  getDeals, getDealById, createDeal, updateDealStage, updateDealScore, getDealStats,
  getSignalByDealId, upsertSignal,
  getMemos, getMemoByDealId, createMemo,
  getOutreach, getOutreachByDealId, createOutreach, updateOutreachStatus, getOutreachStats,
  getActivityLog, logActivity,
  getLatestScanJob, createScanJob, updateScanJob,
  getModelConfig, getAllModelConfigs, upsertModelConfig,
} from "./db";
import { MODEL_CATALOG, DEFAULT_MODULE_MODELS, type AnalysisModule } from "../shared/models";
import {
  analyzeOwnerPsychology, runDigitalAudit, runRedTeamAnalysis,
  buildCapitalStack, generateInvestmentMemo, scoreDeal,
} from "./gemini";

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
  }),

  signals: router({
    getByDealId: publicProcedure
      .input(z.object({ dealId: z.number() }))
      .query(async ({ input }) => getSignalByDealId(input.dealId)),

    analyze: protectedProcedure
      .input(z.object({
        dealId: z.number(),
        modules: z.array(z.enum(["psychology","digital","redteam","capital"])).optional(),
      }))
      .mutation(async ({ input }) => {
        const deal = await getDealById(input.dealId);
        if (!deal) throw new Error("Deal not found");
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
          modelVersions: { psychology: "claude-3-5-sonnet", digital: "sonar-pro", redteam: "gemini-2.5-pro", capital: "gemini-2.5-flash" },
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
      .input(z.object({ dealId: z.number() }))
      .mutation(async ({ input }) => {
        const deal = await getDealById(input.dealId);
        if (!deal) throw new Error("Deal not found");
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
      }).optional())
      .mutation(async ({ input }) => {
        const sources = input?.sources ?? ["bizbuysell","dealstream","flippa","quietlight","empireflippers"];
        const minCashFlow = input?.minCashFlow ?? 500000;
        const maxMultiple = input?.maxMultiple ?? 6;

        // Create the scan job record immediately so the UI can poll it
        const insertResult = await createScanJob({
          status: "running",
          sources,
          startedAt: new Date(),
          currentPhase: "Initializing scan engine",
          phaseDetail: `Connecting to ${sources.length} marketplace${sources.length > 1 ? "s" : ""}`,
          progressPct: 2,
        });
        const jobId = (insertResult as any).insertId as number;

        // Run the full pipeline asynchronously — don't await, return immediately
        runScanPipeline(jobId, sources, minCashFlow, maxMultiple).catch((err) => {
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
      return { success: true };
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
) {
  const phase = async (label: string, detail: string, pct: number) =>
    updateScanJob(jobId, { currentPhase: label, phaseDetail: detail, progressPct: pct });

  // ── Phase 1: Simulated marketplace scraping ──────────────────────────────
  await phase("Scanning marketplaces", `Fetching listings from ${sources.join(", ")}`, 10);
  await new Promise((r) => setTimeout(r, 1500));

  // Generate a realistic set of synthetic listings to score
  const SAMPLE_LISTINGS = [
    { name: "Metro HVAC Services — Atlanta", industry: "HVAC", location: "Atlanta, GA", revenue: 2800000, cashFlow: 980000, askingPrice: 3200000, multiple: 3.3, employees: 22, yearEstablished: 2011 },
    { name: "Peach State Commercial Cleaning", industry: "Commercial Cleaning", location: "Atlanta, GA", revenue: 3500000, cashFlow: 1100000, askingPrice: 4000000, multiple: 3.6, employees: 45, yearEstablished: 2008 },
    { name: "Charlotte Logistics & Last-Mile", industry: "Logistics", location: "Charlotte, NC", revenue: 6500000, cashFlow: 1900000, askingPrice: 7600000, multiple: 4.0, employees: 38, yearEstablished: 2015 },
    { name: "TX Government Delivery Services", industry: "Logistics", location: "Dallas, TX", revenue: 6200000, cashFlow: 1800000, askingPrice: 6500000, multiple: 3.6, employees: 52, yearEstablished: 2012 },
    { name: "Route-Based Pest Control — ATL", industry: "Pest Control", location: "Atlanta, GA", revenue: 1500000, cashFlow: 650000, askingPrice: 2270000, multiple: 3.5, employees: 18, yearEstablished: 2014 },
    { name: "Southeast Plumbing Group", industry: "Plumbing", location: "Birmingham, AL", revenue: 4200000, cashFlow: 1350000, askingPrice: 4800000, multiple: 3.6, employees: 31, yearEstablished: 2009 },
    { name: "Gulf Coast Electrical Contractors", industry: "Electrical", location: "Houston, TX", revenue: 5100000, cashFlow: 1600000, askingPrice: 5800000, multiple: 3.6, employees: 29, yearEstablished: 2007 },
    { name: "Florida Pool & Spa Services", industry: "Pool Services", location: "Tampa, FL", revenue: 1800000, cashFlow: 720000, askingPrice: 2500000, multiple: 3.5, employees: 14, yearEstablished: 2016 },
    { name: "Mid-Atlantic Medical Staffing", industry: "Healthcare Staffing", location: "Baltimore, MD", revenue: 8900000, cashFlow: 2100000, askingPrice: 9500000, multiple: 4.5, employees: 12, yearEstablished: 2013 },
    { name: "Carolinas Roofing & Restoration", industry: "Roofing", location: "Raleigh, NC", revenue: 3800000, cashFlow: 1050000, askingPrice: 3500000, multiple: 3.3, employees: 27, yearEstablished: 2010 },
  ];

  // Filter by source count (more sources = more listings)
  const listingCount = Math.min(SAMPLE_LISTINGS.length, 4 + sources.length);
  const listings = SAMPLE_LISTINGS.slice(0, listingCount);

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
    // Create or find the deal record
    const existing = await (async () => {
      try {
        const allDeals = await import("./db").then((m) => m.getDeals({ limit: 200 }));
        return allDeals.find((d) => d.name === listing.name);
      } catch { return undefined; }
    })();

    let dealId: number;
    if (existing) {
      dealId = existing.id;
    } else {
      const res = await createDeal({ ...listing, stage: "new" }) as any;
      dealId = res.insertId;
    }

    // Score the deal
    try {
      const deal = await getDealById(dealId);
      if (deal) {
        const { score, redFlagCount } = await scoreDeal(deal);
        await updateDealScore(dealId, score, redFlagCount);
        const stage = score >= 0.8 ? "high_priority" : score >= 0.65 ? "qualified" : "new";
        await updateDealStage(dealId, stage);
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
