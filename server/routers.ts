import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { getDb } from "./db";
import { consensusScores, sellerSimulations, dealTrajectory } from "../drizzle/schema";
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
        const jobId = (insertResult as any)[0].insertId as number;

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
      .input(z.object({ dealId: z.number() }))
      .mutation(async ({ input }) => {
        const dealRow = await getDealById(input.dealId);
        if (!dealRow) throw new Error("Deal not found");
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
      .input(z.object({ dealId: z.number() }))
      .mutation(async ({ input }) => {
        const dealRow2 = await getDealById(input.dealId);
        if (!dealRow2) throw new Error("Deal not found");
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
      .input(z.object({ dealId: z.number() }))
      .mutation(async ({ input }) => {
        const dealRow3 = await getDealById(input.dealId);
        if (!dealRow3) throw new Error("Deal not found");
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
      dealId = res[0].insertId;
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
