/**
 * THESIS ENGINE — STRATEGIST Agent Router
 * Spec: TSL-SCI-PROD-001-A1 · Section 12
 *
 * Compiles free-text investment theses into executable pipeline configurations
 * using Claude structured output. Saves compilations to thesis_compilations table.
 */
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { logActivity } from "./db";

// ── STRATEGIST System Prompt ──────────────────────────────────────────────────
const STRATEGIST_SYSTEM_PROMPT = `You are STRATEGIST, the thesis compiler for Signal Hunter — an AI-powered acquisition intelligence platform.

Your job: decompose a free-text investment thesis into a precise, executable pipeline configuration.

ARBITRAGE SCORE™ BASE DIMENSIONS (5):
1. Owner Transition Score — probability of motivated seller (retirement, burnout, succession)
2. Tech Debt Score — digital infrastructure gap = AI implementation leverage
3. Labor Substitutability Score — % of labor replaceable with AI/automation
4. Survival Resilience Score — recession durability (essential services, recurring revenue)
5. AI Implementation Cost Score — cost to modernize vs. value created

CUSTOM DIMENSION EXAMPLES (add up to 3 per thesis):
- Temporal Durability Score: product/service needed 40 years ago AND 40 years from now
- Skill Gap Score: management ceiling signals (flat revenue 3yr, no COO, mid-mgmt churn)
- Recurring Revenue Score: contract/subscription mix >60%
- Generational Transition Score: family business succession probability
- Sector Concentration Score: customer concentration in specific sector

GEOGRAPHY REFERENCE:
- Sunbelt = AL, AZ, FL, GA, NC, NV, SC, TN, TX
- Southeast = AL, FL, GA, MS, NC, SC, TN, VA
- Midwest = IL, IN, IA, KS, MI, MN, MO, NE, ND, OH, SD, WI
- Mountain West = CO, ID, MT, NV, UT, WY
- National = all 50 states (empty geographies array)

NAICS PROXY CATEGORIES (use plain English, not codes):
Commercial Cleaning, HVAC, Plumbing, Pest Control, Landscaping, Logistics/Delivery,
Specialty Manufacturing, Industrial Services, Healthcare Services, Business Services,
Food Distribution, Auto Services, Security Services, Staffing, IT Services

OUTPUT RULES:
- All scoring weights must sum to exactly 100
- Revenue values in USD integers (e.g. 20000000 for $20M) — NEVER use decimals or scientific notation for numbers
- Geographies as US state abbreviations (e.g. ["FL","GA","TX"])
- confidenceNotes must flag any ambiguous interpretation
- estimatedTargets and estimatedCost are rough ranges, not guarantees
- suggestedName should be 3-6 words, editorial style (e.g. "Hirsch Durability Play", "Silver Tsunami Southeast")

WORKED EXAMPLE 1 — Hirsch Durability Thesis:
Input: "Businesses where the product was needed 40 years ago and will be needed 40 years from now, $20-40M revenue, founder hitting management ceiling, Sunbelt"
compiledFilters: { revenueMin: 20000000, revenueMax: 40000000, geographies: ["AL","AZ","FL","GA","NC","NV","SC","TN","TX"], businessAgeMin: 20, headcountMin: 75, headcountMax: 250, exclusions: ["PE-owned","public","franchises","VC-backed"] }
scoringWeights: [{ dimension: "Temporal Durability", weight: 30, isCustom: true }, { dimension: "Skill Gap", weight: 25, isCustom: true }, { dimension: "Tech Debt", weight: 15, isCustom: false }, { dimension: "Owner Transition", weight: 15, isCustom: false }, { dimension: "Labor Substitutability", weight: 10, isCustom: false }, { dimension: "Survival Resilience", weight: 5, isCustom: false }]
evidenceRequirements: ["Product/service passes 40/40 durability test", "Founder still active in business", "Management ceiling signal present (flat revenue OR no COO/GM OR mid-level churn)", "No outside institutional capital"]
autoDisqualifiers: ["PE/VC board representation detected", "Founder under age 50", "Product category fails durability test"]
confidenceNotes: ["'Sunbelt' interpreted as 9 states — confirm or modify", "'Skill ceiling' is probabilistic (~25% false positive rate)", "40-year forward durability uses technology disruption proxies"]
estimatedTargetsMin: 340, estimatedTargetsMax: 510, estimatedCostMin: 2800, estimatedCostMax: 4200
suggestedName: "Hirsch Durability Play"

WORKED EXAMPLE 2 — Silver Tsunami:
Input: "Baby boomer business owners ready to retire, service businesses, Southeast, under $5M revenue"
compiledFilters: { revenueMin: 500000, revenueMax: 5000000, geographies: ["AL","FL","GA","MS","NC","SC","TN","VA"], businessAgeMin: 15, exclusions: ["PE-owned","franchises"] }
scoringWeights: [{ dimension: "Owner Transition", weight: 40, isCustom: false }, { dimension: "Survival Resilience", weight: 25, isCustom: false }, { dimension: "Tech Debt", weight: 20, isCustom: false }, { dimension: "Labor Substitutability", weight: 10, isCustom: false }, { dimension: "AI Implementation Cost", weight: 5, isCustom: false }]
evidenceRequirements: ["Owner age 60+ confirmed", "No succession plan visible", "Business age 15+ years", "No outside investors"]
autoDisqualifiers: ["Owner under 55", "Recent COO/GM hire detected", "PE involvement"]
confidenceNotes: ["'Ready to retire' is inferred from age + business age signals, not confirmed intent"]
estimatedTargetsMin: 800, estimatedTargetsMax: 1400, estimatedCostMin: 1200, estimatedCostMax: 2000
suggestedName: "Silver Tsunami Southeast"

WORKED EXAMPLE 3 — Recurring Revenue Specialist:
Input: "Service businesses with recurring contract revenue over 60%, $2-10M EBITDA, no PE"
compiledFilters: { revenueMin: 5000000, revenueMax: 30000000, exclusions: ["PE-owned","VC-backed","public"] }
scoringWeights: [{ dimension: "Recurring Revenue", weight: 35, isCustom: true }, { dimension: "Survival Resilience", weight: 25, isCustom: false }, { dimension: "Owner Transition", weight: 20, isCustom: false }, { dimension: "Tech Debt", weight: 15, isCustom: false }, { dimension: "AI Implementation Cost", weight: 5, isCustom: false }]
evidenceRequirements: ["Contract/subscription mix >60% confirmed", "No PE board members", "EBITDA $2M-$10M verified"]
autoDisqualifiers: ["PE/VC involvement", "Revenue <60% recurring", "EBITDA outside $2M-$10M range"]
confidenceNotes: ["Revenue range estimated from EBITDA $2-10M at typical 15-25% margins"]
estimatedTargetsMin: 200, estimatedTargetsMax: 400, estimatedCostMin: 1500, estimatedCostMax: 2500
suggestedName: "Recurring Revenue Specialist"

Return ONLY valid JSON matching the schema. No markdown, no explanation outside the JSON.`;

// ── JSON Schema for structured output ────────────────────────────────────────
// NOTE: All numeric fields use "string" type to avoid Gemini's structured-output
// bug where integer schema fields render as 32k-character decimal strings.
// The compile procedure parses them back to numbers after receiving the response.
const COMPILATION_SCHEMA = {
  type: "object" as const,
  properties: {
    compiledFilters: {
      type: "object" as const,
      properties: {
        revenueMin: { type: "string" as const, description: "USD integer as string e.g. '2000000'" },
        revenueMax: { type: "string" as const, description: "USD integer as string e.g. '5000000'" },
        geographies: { type: "array" as const, items: { type: "string" as const } },
        businessAgeMin: { type: "string" as const, description: "Years as integer string e.g. '10'" },
        headcountMin: { type: "string" as const, description: "Integer string e.g. '10'" },
        headcountMax: { type: "string" as const, description: "Integer string e.g. '100'" },
        exclusions: { type: "array" as const, items: { type: "string" as const } },
      },
      required: [] as string[],
      additionalProperties: false,
    },
    scoringWeights: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          dimension: { type: "string" as const },
          weight: { type: "string" as const, description: "Integer 1-100 as string, all weights sum to 100" },
          isCustom: { type: "boolean" as const },
        },
        required: ["dimension", "weight", "isCustom"],
        additionalProperties: false,
      },
    },
    evidenceRequirements: { type: "array" as const, items: { type: "string" as const } },
    autoDisqualifiers: { type: "array" as const, items: { type: "string" as const } },
    confidenceNotes: { type: "array" as const, items: { type: "string" as const } },
    estimatedTargetsMin: { type: "string" as const, description: "Integer as string" },
    estimatedTargetsMax: { type: "string" as const, description: "Integer as string" },
    estimatedCostMin: { type: "string" as const, description: "Integer as string" },
    estimatedCostMax: { type: "string" as const, description: "Integer as string" },
    suggestedName: { type: "string" as const },
  },
  required: [
    "compiledFilters", "scoringWeights", "evidenceRequirements",
    "autoDisqualifiers", "confidenceNotes",
    "estimatedTargetsMin", "estimatedTargetsMax",
    "estimatedCostMin", "estimatedCostMax",
    "suggestedName",
  ],
  additionalProperties: false,
};

// ── Router ────────────────────────────────────────────────────────────────────
export const thesisRouter = router({
  /**
   * Compile a free-text investment thesis into structured pipeline config.
   * Calls STRATEGIST (Claude) with JSON schema enforcement.
   */
  compile: protectedProcedure
    .input(z.object({
      thesisText: z.string().min(20).max(4000),
      templateUsed: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Insert placeholder row so we have an ID immediately
      const [insertResult] = await db.execute(
        sql`INSERT INTO thesis_compilations (user_id, thesis_text, template_used, status)
            VALUES (${ctx.user.id}, ${input.thesisText}, ${input.templateUsed ?? null}, 'compiling')`
      ) as any;
      const compilationId = insertResult.insertId as number;

      // Call STRATEGIST via Forge API (Gemini 3.1 Flash)
      // Schema uses string types for all numeric fields to avoid Gemini's
      // structured-output bug where integer fields render as 32k-char decimals.
      // We coerce strings back to numbers after parsing.
      const { ENV } = await import("./_core/env");
      const forgeUrl = ENV.forgeApiUrl
        ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
        : "https://forge.manus.ai/v1/chat/completions";

      let compiled: any;
      try {
        const forgeRes = await fetch(forgeUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${ENV.forgeApiKey}`,
          },
          body: JSON.stringify({
            model: "gemini-3.1-flash",
            messages: [
              { role: "system", content: STRATEGIST_SYSTEM_PROMPT },
              { role: "user", content: `Compile this investment thesis into a JSON object with these exact keys: compiledFilters (object with revenueMin, revenueMax, geographies, businessAgeMin, headcountMin, headcountMax, exclusions), scoringWeights (array of {dimension, weight, isCustom}), evidenceRequirements (array), autoDisqualifiers (array), confidenceNotes (array), estimatedTargetsMin, estimatedTargetsMax, estimatedCostMin, estimatedCostMax, suggestedName.\n\nIMPORTANT: All numeric values MUST be plain integers with NO decimal points (e.g. 2000000 not 2000000.0).\n\nThesis: ${input.thesisText}` },
            ],
            response_format: { type: "json_object" },
            max_tokens: 2048,
          }),
          signal: AbortSignal.timeout(55000),
        });
        if (!forgeRes.ok) {
          const errText = await forgeRes.text();
          throw new Error(`Forge API error ${forgeRes.status}: ${errText.slice(0, 200)}`);
        }
        const forgeJson = await forgeRes.json() as any;
        const rawContent = forgeJson.choices?.[0]?.message?.content;
        if (!rawContent) {
          throw new Error(`Empty response from STRATEGIST — finish_reason: ${forgeJson.choices?.[0]?.finish_reason}`);
        }
        // Strip markdown code fences if present
        const stripped = rawContent.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
        let raw: any;
        try {
          raw = JSON.parse(stripped);
        } catch {
          const match = stripped.match(/\{[\s\S]*\}/);
          if (!match) throw new Error("STRATEGIST returned non-JSON content");
          raw = JSON.parse(match[0]);
        }
        // Coerce string numeric fields back to numbers (workaround for Gemini integer schema bug)
        const toInt = (v: any) => v !== undefined && v !== null && v !== "" ? parseInt(String(v), 10) || 0 : undefined;
        compiled = {
          ...raw,
          compiledFilters: {
            ...raw.compiledFilters,
            revenueMin: toInt(raw.compiledFilters?.revenueMin),
            revenueMax: toInt(raw.compiledFilters?.revenueMax),
            businessAgeMin: toInt(raw.compiledFilters?.businessAgeMin),
            headcountMin: toInt(raw.compiledFilters?.headcountMin),
            headcountMax: toInt(raw.compiledFilters?.headcountMax),
          },
          scoringWeights: (raw.scoringWeights ?? []).map((w: any) => ({
            ...w,
            weight: parseInt(String(w.weight), 10) || 0,
          })),
          estimatedTargetsMin: toInt(raw.estimatedTargetsMin) ?? 0,
          estimatedTargetsMax: toInt(raw.estimatedTargetsMax) ?? 0,
          estimatedCostMin: toInt(raw.estimatedCostMin) ?? 0,
          estimatedCostMax: toInt(raw.estimatedCostMax) ?? 0,
        };
      } catch (e) {
        // Mark as review so the user can retry
        await db.execute(
          sql`UPDATE thesis_compilations SET status = 'review' WHERE id = ${compilationId}`
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "STRATEGIST compilation failed — please try again",
        });
      }

      // Persist the compiled output
      await db.execute(
        sql`UPDATE thesis_compilations SET
          compiled_filters    = ${JSON.stringify(compiled.compiledFilters)},
          scoring_weights     = ${JSON.stringify(compiled.scoringWeights)},
          evidence_requirements = ${JSON.stringify(compiled.evidenceRequirements)},
          auto_disqualifiers  = ${JSON.stringify(compiled.autoDisqualifiers)},
          confidence_notes    = ${JSON.stringify(compiled.confidenceNotes)},
          estimated_targets_min = ${compiled.estimatedTargetsMin},
          estimated_targets_max = ${compiled.estimatedTargetsMax},
          estimated_cost_min  = ${compiled.estimatedCostMin},
          estimated_cost_max  = ${compiled.estimatedCostMax},
          name                = ${compiled.suggestedName},
          status              = 'review'
        WHERE id = ${compilationId}`
      );

      await logActivity({
        type: "system",
        title: `Thesis compiled: ${compiled.suggestedName}`,
        detail: `STRATEGIST decomposed thesis into ${compiled.scoringWeights.length} scoring dimensions · ${compiled.estimatedTargetsMin}–${compiled.estimatedTargetsMax} estimated targets`,
      });

      return { compilationId, compiled, suggestedName: compiled.suggestedName };
    }),

  /** List saved thesis compilations for the current user */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.execute(
      sql`SELECT * FROM thesis_compilations WHERE user_id = ${ctx.user.id} ORDER BY created_at DESC LIMIT 20`
    ) as any;
    // TiDB returns JSON columns as already-parsed objects (not strings).
    // Guard: if value is already an object/array, use it directly; only JSON.parse strings.
    const parseCol = (v: any, fallback: any) => {
      if (v === null || v === undefined) return fallback;
      if (typeof v === 'string') {
        try { return JSON.parse(v); } catch { return fallback; }
      }
      return v; // already parsed by TiDB driver
    };
    return (rows[0] as any[]).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      thesisText: r.thesis_text,
      templateUsed: r.template_used,
      name: r.name,
      status: r.status,
      compiledFilters: parseCol(r.compiled_filters, {}),
      scoringWeights: parseCol(r.scoring_weights, []),
      evidenceRequirements: parseCol(r.evidence_requirements, []),
      autoDisqualifiers: parseCol(r.auto_disqualifiers, []),
      confidenceNotes: parseCol(r.confidence_notes, []),
      estimatedTargetsMin: r.estimated_targets_min,
      estimatedTargetsMax: r.estimated_targets_max,
      estimatedCostMin: r.estimated_cost_min,
      estimatedCostMax: r.estimated_cost_max,
      createdAt: r.created_at,
    }));
  }),

  /** Delete a saved thesis compilation */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.execute(
        sql`DELETE FROM thesis_compilations WHERE id = ${input.id} AND user_id = ${ctx.user.id}`
      );
      return { success: true };
    }),
});
