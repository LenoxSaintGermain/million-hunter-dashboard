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
  getLatestScanJob, createScanJob,
} from "./db";
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

    trigger: protectedProcedure
      .input(z.object({
        sources: z.array(z.string()).optional(),
        minCashFlow: z.number().optional(),
        maxMultiple: z.number().optional(),
      }).optional())
      .mutation(async ({ input }) => {
        const sources = input?.sources ?? ["bizbuysell","dealstream","flippa","quietlight","empireflippers"];
        await createScanJob({ status: "pending", sources, startedAt: new Date() });
        await logActivity({ type: "scan_completed", title: `Market scan triggered across ${sources.length} platforms` });
        return { success: true, message: "Scan job queued. Results will appear in the dashboard." };
      }),
  }),
});

export type AppRouter = typeof appRouter;
