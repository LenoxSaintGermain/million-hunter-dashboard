/**
 * Insurance Prospector Router
 *
 * Converts acquisition deal pipeline into commercial insurance prospect list.
 * Each qualified deal is scored as a prospective insurance client — surfacing
 * premium potential, policy fit, and a pre-call brief for agents (NY Life, etc.)
 *
 * Policy types scored:
 *   - Key Man / Key Person Life Insurance
 *   - Business Interruption Insurance
 *   - Commercial Property Insurance
 *   - General Liability
 *   - Workers' Compensation
 *   - Buy-Sell Agreement (funded by life insurance)
 *   - Group Benefits (health, dental, vision)
 *   - Commercial Auto
 *   - Errors & Omissions / Professional Liability
 */
import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { getDb } from "./db";
import { insuranceProspects, deals, signals } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PolicyFitItem {
  policy: string;
  relevance: "high" | "medium" | "low";
  estimatedPremium?: number; // annual, in cents
  rationale: string;
}

interface ProspectScoreResult {
  prospectScore: number;
  estimatedPremiumLow: number;
  estimatedPremiumHigh: number;
  riskProfile: "low" | "moderate" | "elevated" | "high";
  policyFit: PolicyFitItem[];
  briefText: string;
}

// ─── AI Scoring Engine ────────────────────────────────────────────────────────
async function scoreProspectWithAI(deal: {
  id: number;
  name: string;
  industry: string | null;
  location: string | null;
  revenue: number | null;
  cashFlow: number | null;
  employees: number | null;
  yearEstablished: number | null;
  description: string | null;
}, signal?: {
  ownerDistressScore: number | null;
  killProbability: number | null;
  redFlags: unknown;
  sbaEligible: boolean | null;
} | null): Promise<ProspectScoreResult> {

  const businessAge = deal.yearEstablished ? new Date().getFullYear() - deal.yearEstablished : null;
  const revenueM = deal.revenue ? (deal.revenue / 100 / 1_000_000).toFixed(2) : "unknown";
  const cashFlowK = deal.cashFlow ? (deal.cashFlow / 100 / 1_000).toFixed(0) : "unknown";
  const employees = deal.employees ?? "unknown";

  const prompt = `You are a senior commercial insurance underwriter and business development specialist at a major life insurance company (NY Life / Northwestern Mutual tier).

A business acquisition platform has identified the following business as a potential acquisition target. Your job is to assess this business as a COMMERCIAL INSURANCE PROSPECT — not as an acquisition target.

BUSINESS PROFILE:
- Name: ${deal.name}
- Industry: ${deal.industry ?? "Unknown"}
- Location: ${deal.location ?? "Unknown"}
- Annual Revenue: $${revenueM}M
- Annual Cash Flow: $${cashFlowK}K
- Employees: ${employees}
- Business Age: ${businessAge ? `${businessAge} years` : "Unknown"}
- Description: ${deal.description ?? "Not available"}
${signal ? `
RISK SIGNALS (from acquisition analysis):
- Owner Distress Score: ${signal.ownerDistressScore ?? "N/A"} (0=stable, 1=distressed)
- Kill Probability: ${signal.killProbability ?? "N/A"} (acquisition risk, also signals business vulnerability)
- SBA Eligible: ${signal.sbaEligible ?? "Unknown"}
- Red Flags: ${JSON.stringify(signal.redFlags ?? [])}
` : ""}

TASK: Score this business as a commercial insurance prospect. Return a JSON object with:

{
  "prospectScore": <0.0-1.0, composite score: premium potential 40% + policy complexity 30% + relationship potential 30%>,
  "estimatedPremiumLow": <annual total premium low estimate in DOLLARS (integer)>,
  "estimatedPremiumHigh": <annual total premium high estimate in DOLLARS (integer)>,
  "riskProfile": <"low" | "moderate" | "elevated" | "high">,
  "policyFit": [
    {
      "policy": <policy name>,
      "relevance": <"high" | "medium" | "low">,
      "estimatedPremium": <annual premium in DOLLARS (integer) or null>,
      "rationale": <1-2 sentence explanation of why this policy fits this specific business>
    }
  ],
  "briefText": <3-4 paragraph pre-call brief for an insurance agent. Include: (1) why this business needs insurance NOW, (2) the owner's likely pain points, (3) the top 2-3 policy recommendations with specific dollar context, (4) the opening line for the cold call. Tone: professional, direct, not salesy. This is for a sophisticated agent.>
}

POLICY TYPES TO CONSIDER (include only relevant ones, ranked by relevance):
- Key Man / Key Person Life Insurance (critical if owner-dependent)
- Buy-Sell Agreement (funded by life insurance — critical for businesses with partners or succession planning)
- Business Interruption Insurance (revenue protection)
- Commercial Property Insurance (if physical assets)
- General Liability
- Workers' Compensation (based on employee count and industry risk)
- Group Benefits / Group Life (health, dental, vision — if 10+ employees)
- Commercial Auto (if logistics, delivery, field services)
- Errors & Omissions / Professional Liability (if services business)
- Umbrella / Excess Liability (if elevated risk profile)

SCORING GUIDANCE:
- High-value prospects: $2M+ revenue, 20+ employees, owner-dependent operations, physical assets, field workers
- Key Man is almost always relevant for SME acquisitions (the owner IS the business)
- Buy-Sell is highly relevant if the business has multiple owners or is family-owned
- Workers' Comp premiums scale with employee count and industry risk class
- Group Benefits become relevant at 10+ employees (ACA compliance + retention tool)

Return ONLY valid JSON, no markdown, no explanation.`;

  const response = await invokeLLM({
    messages: [
      { role: "system" as const, content: "You are a commercial insurance underwriting AI. Return only valid JSON." },
      { role: "user" as const, content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "insurance_prospect_score",
        strict: true,
        schema: {
          type: "object",
          properties: {
            prospectScore: { type: "number" },
            estimatedPremiumLow: { type: "number" },
            estimatedPremiumHigh: { type: "number" },
            riskProfile: { type: "string", enum: ["low", "moderate", "elevated", "high"] },
            policyFit: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  policy: { type: "string" },
                  relevance: { type: "string", enum: ["high", "medium", "low"] },
                  estimatedPremium: { type: ["number", "null"] },
                  rationale: { type: "string" },
                },
                required: ["policy", "relevance", "rationale"],
                additionalProperties: false,
              },
            },
            briefText: { type: "string" },
          },
          required: ["prospectScore", "estimatedPremiumLow", "estimatedPremiumHigh", "riskProfile", "policyFit", "briefText"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response from LLM");

  const contentStr = typeof content === "string" ? content : JSON.stringify(content);
  const parsed = JSON.parse(contentStr) as ProspectScoreResult;

  // Convert dollar amounts to cents for storage
  return {
    ...parsed,
    estimatedPremiumLow: Math.round(parsed.estimatedPremiumLow * 100),
    estimatedPremiumHigh: Math.round(parsed.estimatedPremiumHigh * 100),
    policyFit: parsed.policyFit.map((p) => ({
      ...p,
      estimatedPremium: p.estimatedPremium ? Math.round(p.estimatedPremium * 100) : undefined,
    })),
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const insuranceRouter = router({
  /**
   * Score a single deal as an insurance prospect.
   * Generates AI analysis and persists to insurance_prospects table.
   * Cache-first: returns existing record if already scored (unless force=true).
   */
  scoreProspect: protectedProcedure
    .input(z.object({
      dealId: z.number(),
      force: z.boolean().optional().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Cache-first: return existing if already scored
      if (!input.force) {
        const existing = await db
          .select()
          .from(insuranceProspects)
          .where(eq(insuranceProspects.dealId, input.dealId))
          .limit(1);
        if (existing.length > 0) return existing[0];
      }

      // Fetch deal + signals
      const dealRows = await db.select().from(deals).where(eq(deals.id, input.dealId)).limit(1);
      if (!dealRows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
      const deal = dealRows[0];

      const signalRows = await db.select().from(signals).where(eq(signals.dealId, input.dealId)).limit(1);
      const signal = signalRows[0] ?? null;

      // Run AI scoring
      const scored = await scoreProspectWithAI(deal, signal);

      // Upsert into insurance_prospects
      await db.execute(
        sql`INSERT INTO insurance_prospects (deal_id, prospect_score, estimated_premium_low, estimated_premium_high, risk_profile, policy_fit, brief_text, status, generated_by_user_id, scored_at, updated_at)
            VALUES (${input.dealId}, ${scored.prospectScore}, ${scored.estimatedPremiumLow}, ${scored.estimatedPremiumHigh}, ${scored.riskProfile}, ${JSON.stringify(scored.policyFit)}, ${scored.briefText}, 'briefed', ${ctx.user.id}, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
              prospect_score = VALUES(prospect_score),
              estimated_premium_low = VALUES(estimated_premium_low),
              estimated_premium_high = VALUES(estimated_premium_high),
              risk_profile = VALUES(risk_profile),
              policy_fit = VALUES(policy_fit),
              brief_text = VALUES(brief_text),
              status = 'briefed',
              generated_by_user_id = VALUES(generated_by_user_id),
              updated_at = NOW()`
      );

      // Return the saved record
      const saved = await db
        .select()
        .from(insuranceProspects)
        .where(eq(insuranceProspects.dealId, input.dealId))
        .limit(1);
      return saved[0];
    }),

  /**
   * List all insurance prospects with deal context.
   * Supports filtering by status, risk profile, and minimum score.
   */
  listProspects: protectedProcedure
    .input(z.object({
      status: z.enum(["new", "briefed", "contacted", "quoted", "closed", "passed"]).optional(),
      riskProfile: z.enum(["low", "moderate", "elevated", "high"]).optional(),
      minScore: z.number().min(0).max(1).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db.execute(
        sql`SELECT ip.*, d.name as deal_name, d.industry, d.location, d.revenue, d.cash_flow, d.employees, d.year_established, d.stage as deal_stage
            FROM insurance_prospects ip
            JOIN deals d ON ip.deal_id = d.id
            WHERE 1=1
            ${input?.status ? sql`AND ip.status = ${input.status}` : sql``}
            ${input?.riskProfile ? sql`AND ip.risk_profile = ${input.riskProfile}` : sql``}
            ${input?.minScore !== undefined ? sql`AND ip.prospect_score >= ${input.minScore}` : sql``}
            ORDER BY ip.prospect_score DESC, ip.scored_at DESC
            LIMIT 100`
      ) as unknown as { rows: Record<string, unknown>[] };

      return (rows.rows ?? []) as Array<Record<string, unknown>>;
    }),

  /**
   * Update prospect status in the insurance pipeline.
   */
  updateStatus: protectedProcedure
    .input(z.object({
      dealId: z.number(),
      status: z.enum(["new", "briefed", "contacted", "quoted", "closed", "passed"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db
        .update(insuranceProspects)
        .set({ status: input.status })
        .where(eq(insuranceProspects.dealId, input.dealId));

      return { success: true };
    }),

  /**
   * Get a single prospect record by dealId.
   */
  getByDealId: protectedProcedure
    .input(z.object({ dealId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const rows = await db
        .select()
        .from(insuranceProspects)
        .where(eq(insuranceProspects.dealId, input.dealId))
        .limit(1);

      return rows[0] ?? null;
    }),

  /**
   * Batch score all qualified+ deals that don't yet have a prospect record.
   * Useful for onboarding a new insurance user — scores the entire pipeline.
   */
  batchScore: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Find qualified+ deals without a prospect record
      const unscored = await db.execute(
        sql`SELECT d.id FROM deals d
            LEFT JOIN insurance_prospects ip ON d.id = ip.deal_id
            WHERE ip.id IS NULL
            AND d.stage IN ('qualified', 'high_priority', 'in_diligence', 'loi_sent', 'under_contract')
            AND d.is_archived = 0
            ORDER BY d.score DESC
            LIMIT 20`
      ) as unknown as { rows: Array<{ id: number }> };

      const dealIds = (unscored.rows ?? []).map((r) => r.id);
      let scored = 0;
      const errors: string[] = [];

      for (const dealId of dealIds) {
        try {
          const dealRows = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
          if (!dealRows.length) continue;
          const deal = dealRows[0];
          const signalRows = await db.select().from(signals).where(eq(signals.dealId, dealId)).limit(1);
          const signal = signalRows[0] ?? null;

          const result = await scoreProspectWithAI(deal, signal);

          await db.execute(
            sql`INSERT INTO insurance_prospects (deal_id, prospect_score, estimated_premium_low, estimated_premium_high, risk_profile, policy_fit, brief_text, status, generated_by_user_id, scored_at, updated_at)
                VALUES (${dealId}, ${result.prospectScore}, ${result.estimatedPremiumLow}, ${result.estimatedPremiumHigh}, ${result.riskProfile}, ${JSON.stringify(result.policyFit)}, ${result.briefText}, 'briefed', ${ctx.user.id}, NOW(), NOW())
                ON DUPLICATE KEY UPDATE updated_at = NOW()`
          );
          scored++;
        } catch (e) {
          errors.push(`Deal ${dealId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      return { scored, errors, total: dealIds.length };
    }),
});
