/**
 * THESIS ENGINE — STRATEGIST Agent Router
 * Spec: TSL-SCI-PROD-001-A1 · Section 12
 *
 * Compiles free-text investment theses into executable pipeline configurations
 * using Claude structured output. Saves compilations to thesis_compilations table.
 */
import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./db";
import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { logActivity } from "./db";
import { apertureCandidates, aperturePlayDecisions, aperturePlaySlateItems, apertureRuns, apertureSetAside, capitalTheses, thesisCompilations, thesisShares, users } from "../drizzle/schema";
import { compileThesis } from "./aperture/thesisGraph";
import { projectionValues } from "./thesisBridge";
import { canUseCanonicalThesis } from "./thesisAccess";
import { GEMINI_FAST } from "../shared/models";
import { normalizeCanonicalThesisRead } from "../shared/thesisReadContract";
import { isCapitalThesisEligible } from "../shared/capitalThesisEligibility";

function isQualifiedPlayIsolatedUat(ctx: { req: { header(name: string): string | undefined } }) {
  return process.env.NODE_ENV === "development"
    && process.env.ISOLATED_UAT_MODE === "true"
    && process.env.DATABASE_URL?.includes("127.0.0.1:3307/capital_aperture_uat_9c18799")
    && ctx.req.header("x-isolated-uat-identity") === "jim"
    && ctx.req.header("x-isolated-uat-case") === "qualified-play";
}

function illustrativeUatGraph(thesisText: string, name: string | null) {
  return {
    beliefs: [thesisText], seek: [], avoid: [], horizons: ["Unknown — operator has not specified a horizon."], sectors: [], exclusions: [],
    portfolioRules: {}, behavior: {}, exposureTree: [],
    confidenceNotes: ["Illustrative UAT compilation — not current market data. No provider, market-data, or broker path was invoked."],
    suggestedName: name ?? "Capital / Trade Thesis",
  };
}

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

WORKED EXAMPLE 4 — Wingate Historic Building Thesis:
Input: "Historic commercial buildings built before 1945, max 4 stories, stabilized and leased-up, historic register eligible, higher-and-better-use potential, Midwest to Southeast, NOI $150K-$800K, cap rate 6%+"
compiledFilters: { geographies: ["IL","IN","OH","KY","TN","NC","SC","GA"], exclusions: ["renovation plays","ground-up development","structural rehab required","PE-owned"] }
scoringWeights: [{ dimension: "Historic Register Eligibility", weight: 25, isCustom: true }, { dimension: "Stabilized/Leased-Up Status", weight: 20, isCustom: true }, { dimension: "Higher-and-Better-Use Potential", weight: 20, isCustom: true }, { dimension: "Building Age & Authenticity", weight: 15, isCustom: true }, { dimension: "Geography Fit (Midwest-SE)", weight: 10, isCustom: true }, { dimension: "Cap Rate & NOI Quality", weight: 10, isCustom: true }]
evidenceRequirements: ["Year built pre-1945 confirmed", "Max 4 stories verified", "Building 50+ years old", "Occupancy 85%+ (stabilized)", "Historic register listing or eligibility confirmed", "Air rights or adjacent lot space identified for higher-and-better-use", "No active renovation or structural work required"]
autoDisqualifiers: ["Year built post-1945", "Requires structural rehabilitation", "Occupancy below 70%", "No historic register eligibility", "5+ stories", "Active renovation in progress"]
confidenceNotes: ["'Stabilized' means 85%+ occupied with no renovation needed", "Historic register eligibility requires NPS Part 1 determination or state equivalent", "Air rights availability requires zoning verification", "Higher-and-better-use potential assessed via FAR analysis"]
estimatedTargetsMin: 85, estimatedTargetsMax: 200, estimatedCostMin: 800, estimatedCostMax: 1500
suggestedName: "Wingate Historic Stabilized"

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
        // Historic Building Thesis fields (Wingate preset)
        yearBuiltMax: { type: "string" as const, description: "Max year built as integer string e.g. '1945'" },
        maxStories: { type: "string" as const, description: "Max number of stories as integer string e.g. '4'" },
        minOccupancyRate: { type: "string" as const, description: "Min occupancy as decimal string e.g. '0.85'" },
        requireHistoricRegister: { type: "string" as const, description: "'true' or 'false'" },
        requireStabilized: { type: "string" as const, description: "'true' or 'false'" },
        requireHigherAndBetterUse: { type: "string" as const, description: "'true' or 'false'" },
        capRateMin: { type: "string" as const, description: "Min cap rate as decimal string e.g. '0.06'" },
        noiMin: { type: "string" as const, description: "Min NOI in USD as integer string e.g. '150000'" },
        noiMax: { type: "string" as const, description: "Max NOI in USD as integer string e.g. '800000'" },
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
            model: GEMINI_FAST,
            messages: [
              { role: "system", content: STRATEGIST_SYSTEM_PROMPT },
              { role: "user", content: `Compile this investment thesis into a JSON object with these exact keys: compiledFilters (object with revenueMin, revenueMax, geographies, businessAgeMin, headcountMin, headcountMax, exclusions), scoringWeights (array of {dimension, weight, isCustom}), evidenceRequirements (array), autoDisqualifiers (array), confidenceNotes (array), estimatedTargetsMin, estimatedTargetsMax, estimatedCostMin, estimatedCostMax, suggestedName.\n\nIMPORTANT: All numeric values MUST be plain integers with NO decimal points (e.g. 2000000 not 2000000.0).\n\nThesis: ${input.thesisText}` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "thesis_compilation",
                strict: true,
                schema: COMPILATION_SCHEMA,
              },
            },
            max_tokens: 4096,
          }),
          signal: AbortSignal.timeout(60000),
        });
        if (!forgeRes.ok) {
          const errText = await forgeRes.text();
          throw new Error(`Forge API error ${forgeRes.status}: ${errText.slice(0, 200)}`);
        }
        const forgeJson = await forgeRes.json() as any;
        let rawContent = forgeJson.choices?.[0]?.message?.content;
        const finishReason = forgeJson.choices?.[0]?.finish_reason;
        // If truncated (finish_reason=length), retry without json_schema constraint
        if (!rawContent || finishReason === "length") {
          const retryRes = await fetch(forgeUrl, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${ENV.forgeApiKey}` },
            body: JSON.stringify({
              model: GEMINI_FAST,
              messages: [
                { role: "system", content: "You are STRATEGIST, a deal thesis compiler. Return ONLY a JSON object, no markdown, no explanation." },
                { role: "user", content: `Compile this investment thesis into a JSON object with EXACTLY these keys:\n- compiledFilters: {revenueMin, revenueMax, geographies (state abbrevs array), businessAgeMin, headcountMin, headcountMax, exclusions (array)}\n- scoringWeights: array of {dimension, weight (integer 1-100), isCustom (bool)}, weights sum to 100\n- evidenceRequirements: string array\n- autoDisqualifiers: string array\n- confidenceNotes: string array\n- estimatedTargetsMin, estimatedTargetsMax (integers)\n- estimatedCostMin, estimatedCostMax (integers, USD thousands)\n- suggestedName (3-6 words)\n\nAll numbers as plain integers. Return ONLY the JSON object.\n\nThesis: ${input.thesisText}` },
              ],
              max_tokens: 4096,
            }),
            signal: AbortSignal.timeout(60000),
          });
          if (!retryRes.ok) throw new Error(`Retry Forge error ${retryRes.status}`);
          const retryJson = await retryRes.json() as any;
          rawContent = retryJson.choices?.[0]?.message?.content;
          if (!rawContent) throw new Error(`Empty response on retry — finish_reason: ${retryJson.choices?.[0]?.finish_reason}`);
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

  /** List personal and explicitly shared canonical theses for the current user. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const [profile] = await db.select({ activeCapitalThesisId: users.activeCapitalThesisId })
      .from(users).where(eq(users.id, ctx.user.id)).limit(1);
    const rows = await db.execute(sql`
      SELECT tc.*, CASE WHEN tc.user_id = ${ctx.user.id} THEN 'owner' ELSE 'shared' END AS access,
        owner.name AS owner_name, ts.permission AS share_permission
        ,(SELECT MAX(ar.catalyst_deadline_at)
          FROM capital_theses cp
          INNER JOIN aperture_runs ar ON ar.thesis_id = cp.id AND ar.user_id = ${ctx.user.id}
          WHERE cp.source_compilation_id = tc.id AND cp.user_id = ${ctx.user.id}) AS latest_catalyst_deadline_at
      FROM thesis_compilations tc
      LEFT JOIN thesis_shares ts ON ts.compilation_id = tc.id AND ts.user_id = ${ctx.user.id}
      LEFT JOIN users owner ON owner.id = tc.user_id
      WHERE tc.user_id = ${ctx.user.id} OR ts.user_id = ${ctx.user.id}
      ORDER BY tc.created_at DESC LIMIT 50
    `) as any;
    const rawRows = rows[0] as any[];
    return rawRows.map((row: any) => {
      const normalized = normalizeCanonicalThesisRead({
        confidenceNotes: row.confidence_notes,
        compiledFilters: row.compiled_filters,
        scoringWeights: row.scoring_weights,
        evidenceRequirements: row.evidence_requirements,
        autoDisqualifiers: row.auto_disqualifiers,
      });
      return {
      id: row.id,
      userId: row.user_id,
      access: row.access ?? "owner",
      ownerName: row.owner_name ?? null,
      sharePermission: row.share_permission ?? null,
      thesisText: row.thesis_text,
      templateUsed: row.template_used,
      name: row.name,
      status: row.status,
      scanJobId: row.scan_job_id ?? null,
      ...normalized,
      estimatedTargetsMin: row.estimated_targets_min,
      estimatedTargetsMax: row.estimated_targets_max,
      estimatedCostMin: row.estimated_cost_min,
      estimatedCostMax: row.estimated_cost_max,
      latestCatalystDeadlineAt: row.latest_catalyst_deadline_at == null ? null : Number(row.latest_catalyst_deadline_at),
      isActiveCapital: isCapitalThesisEligible({ templateUsed: row.template_used })
        && profile?.activeCapitalThesisId === row.id,
      createdAt: row.created_at,
      };
    });
  }),

  /** The canonical Capital / Trade thesis this profile has chosen for its daily Decision Center. */
  activeCapital: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { thesis: null };
    const [profile] = await db.select({ activeCapitalThesisId: users.activeCapitalThesisId })
      .from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!profile?.activeCapitalThesisId) return { thesis: null };
    const [thesis] = await db.select({
      id: thesisCompilations.id,
      name: thesisCompilations.name,
      templateUsed: thesisCompilations.templateUsed,
      status: thesisCompilations.status,
    }).from(thesisCompilations).where(eq(thesisCompilations.id, profile.activeCapitalThesisId)).limit(1);
    return { thesis: thesis && isCapitalThesisEligible(thesis) ? thesis : null };
  }),

  /** Assign the profile's daily Capital context. This never transfers, shares, or edits the thesis. */
  setActiveCapital: protectedProcedure
    .input(z.object({ compilationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [source] = await db.select().from(thesisCompilations).where(eq(thesisCompilations.id, input.compilationId)).limit(1);
      if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Saved thesis not found" });
      const ownsSource = source.userId === ctx.user.id;
      const [sharedAccess] = ownsSource ? [undefined] : await db.select().from(thesisShares)
        .where(and(eq(thesisShares.compilationId, input.compilationId), eq(thesisShares.userId, ctx.user.id), eq(thesisShares.permission, "use"))).limit(1);
      if (!canUseCanonicalThesis({ ownerUserId: source.userId, requesterUserId: ctx.user.id, sharedPermission: sharedAccess?.permission })) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You do not have use access to this thesis" });
      }
      if (!isCapitalThesisEligible(source)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only a Capital / Trade thesis can be the Capital Decision Center context" });
      }
      await db.update(users).set({ activeCapitalThesisId: input.compilationId }).where(eq(users.id, ctx.user.id));
      return { activeCapitalThesisId: input.compilationId, name: source.name ?? "Capital / Trade thesis" };
    }),

  /** Current user’s own Capital runs and candidates for an authorized canonical thesis. Never exposes another owner’s paper history. */
  playRecipes: protectedProcedure
    .input(z.object({ compilationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { workspace: "capital_aperture" as const, runs: [] };
      const [source] = await db.select().from(thesisCompilations).where(eq(thesisCompilations.id, input.compilationId)).limit(1);
      if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Saved thesis not found" });
      const ownsSource = source.userId === ctx.user.id;
      const [sharedAccess] = ownsSource ? [undefined] : await db.select().from(thesisShares)
        .where(and(eq(thesisShares.compilationId, input.compilationId), eq(thesisShares.userId, ctx.user.id), eq(thesisShares.permission, "use"))).limit(1);
      if (!canUseCanonicalThesis({ ownerUserId: source.userId, requesterUserId: ctx.user.id, sharedPermission: sharedAccess?.permission })) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You do not have use access to this thesis" });
      }
      const projections = await db.select({ id: capitalTheses.id }).from(capitalTheses)
        .where(and(eq(capitalTheses.sourceCompilationId, input.compilationId), eq(capitalTheses.userId, ctx.user.id)));
      if (!projections.length) return { workspace: "capital_aperture" as const, runs: [] };
      const thesisIds = projections.map((projection) => projection.id);
      const runs = await db.select({
        id: apertureRuns.id,
        catalystDeadlineAt: apertureRuns.catalystDeadlineAt,
        holdingPeriod: apertureRuns.holdingPeriod,
        status: apertureRuns.status,
        createdAt: apertureRuns.createdAt,
      }).from(apertureRuns).where(and(eq(apertureRuns.userId, ctx.user.id), inArray(apertureRuns.thesisId, thesisIds)))
        .orderBy(desc(apertureRuns.createdAt)).limit(6);
      if (!runs.length) return { workspace: "capital_aperture" as const, runs: [] };
      const runIds = runs.map((run) => run.id);
      const candidates = await db.select({
        id: apertureCandidates.id,
        runId: apertureCandidates.runId,
        symbol: apertureCandidates.symbol,
        role: apertureCandidates.role,
        compositeScore: apertureCandidates.compositeScore,
        confidenceScore: apertureCandidates.confidenceScore,
      }).from(apertureCandidates).where(inArray(apertureCandidates.runId, runIds));
      const candidateIds = candidates.map((candidate) => candidate.id);
      const [decisions, outcomes, setAside] = await Promise.all([
        candidateIds.length
          ? db.select({ candidateId: aperturePlayDecisions.candidateId, decision: aperturePlayDecisions.decision, reason: aperturePlayDecisions.reason, updatedAt: aperturePlayDecisions.updatedAt })
            .from(aperturePlayDecisions)
            .where(and(eq(aperturePlayDecisions.userId, ctx.user.id), inArray(aperturePlayDecisions.candidateId, candidateIds)))
          : [],
        candidateIds.length
          ? db.select({ sourceCandidateId: aperturePlaySlateItems.sourceCandidateId, outcomeStatus: aperturePlaySlateItems.outcomeStatus, outcomeResult: aperturePlaySlateItems.outcomeResult, outcomeBasis: aperturePlaySlateItems.outcomeBasis, outcomeExplanation: aperturePlaySlateItems.outcomeExplanation, updatedAt: aperturePlaySlateItems.updatedAt })
            .from(aperturePlaySlateItems)
            .where(inArray(aperturePlaySlateItems.sourceCandidateId, candidateIds))
            .orderBy(desc(aperturePlaySlateItems.updatedAt))
          : [],
        db.select({ id: apertureSetAside.id, runId: apertureSetAside.runId, symbol: apertureSetAside.symbol, reason: apertureSetAside.reason })
          .from(apertureSetAside)
          .where(inArray(apertureSetAside.runId, runIds)),
      ]);
      const decisionByCandidate = new Map(decisions.map((decision) => [decision.candidateId, decision]));
      const latestOutcomeByCandidate = new Map<number, typeof outcomes[number]>();
      for (const outcome of outcomes) if (!latestOutcomeByCandidate.has(outcome.sourceCandidateId)) latestOutcomeByCandidate.set(outcome.sourceCandidateId, outcome);
      return {
        workspace: "capital_aperture" as const,
        runs: runs.map((run) => ({
          ...run,
          candidates: candidates.filter((candidate) => candidate.runId === run.id).map((candidate) => ({
            ...candidate,
            decision: decisionByCandidate.get(candidate.id) ?? null,
            outcome: latestOutcomeByCandidate.get(candidate.id) ?? null,
          })),
          setAside: setAside.filter((record) => record.runId === run.id),
        })),
      };
    }),

  /** Create a canonical thesis for a capital/trade workflow without forcing acquisition filters. */
  createCapital: adminProcedure
    .input(z.object({ thesisText: z.string().min(20).max(4000), name: z.string().min(1).max(120).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [result] = await db.insert(thesisCompilations).values({
        userId: ctx.user.id,
        thesisText: input.thesisText,
        name: input.name ?? "Capital / Trade Thesis",
        templateUsed: "capital_trade",
        compiledFilters: {},
        scoringWeights: [],
        evidenceRequirements: [],
        autoDisqualifiers: [],
        confidenceNotes: ["Capital / Trade scope: use the linked Aperture graph for securities analysis."],
        status: "review",
      });
      const compilationId = Number((result as any).insertId);
      await db.update(users).set({ activeCapitalThesisId: compilationId }).where(eq(users.id, ctx.user.id));
      return { compilationId };
    }),

  /** Operator-owned thesis sharing. A share grants visibility/use, never edit or delete rights. */
  shareCandidates: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select({ id: users.id, name: users.name, email: users.email, role: users.role })
      .from(users).where(sql`${users.id} != ${ctx.user.id}`).orderBy(users.name);
  }),

  shares: protectedProcedure
    .input(z.object({ compilationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const [owner] = await db.select({ userId: thesisCompilations.userId }).from(thesisCompilations)
        .where(eq(thesisCompilations.id, input.compilationId)).limit(1);
      if (!owner || owner.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return db.select({ userId: thesisShares.userId, permission: thesisShares.permission, name: users.name, email: users.email })
        .from(thesisShares).innerJoin(users, eq(users.id, thesisShares.userId))
        .where(eq(thesisShares.compilationId, input.compilationId));
    }),

  share: adminProcedure
    .input(z.object({ compilationId: z.number(), userId: z.number(), permission: z.enum(["view", "use"]).default("use") }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [owner] = await db.select({ userId: thesisCompilations.userId }).from(thesisCompilations)
        .where(eq(thesisCompilations.id, input.compilationId)).limit(1);
      if (!owner || owner.userId !== ctx.user.id || input.userId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await db.execute(sql`INSERT INTO thesis_shares (compilation_id, user_id, shared_by_user_id, permission, created_at)
        VALUES (${input.compilationId}, ${input.userId}, ${ctx.user.id}, ${input.permission}, ${Date.now()})
        ON DUPLICATE KEY UPDATE permission = VALUES(permission), shared_by_user_id = VALUES(shared_by_user_id)`);
      return { success: true };
    }),

  unshare: adminProcedure
    .input(z.object({ compilationId: z.number(), userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [owner] = await db.select({ userId: thesisCompilations.userId }).from(thesisCompilations)
        .where(eq(thesisCompilations.id, input.compilationId)).limit(1);
      if (!owner || owner.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await db.delete(thesisShares).where(and(eq(thesisShares.compilationId, input.compilationId), eq(thesisShares.userId, input.userId)));
      return { success: true };
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

  /** Rename a saved thesis compilation */
  rename: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).max(120) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.execute(
        sql`UPDATE thesis_compilations SET name = ${input.name} WHERE id = ${input.id} AND user_id = ${ctx.user.id}`
      );
      return { success: true, name: input.name };
    }),

  /**
   * Compiles a liquid-securities projection from the canonical main-app thesis.
   * This is a bridge, not a copy: repeat calls update the same linked Aperture
   * record so the user never has to re-enter their thesis in a second tool.
   */
  useInAperture: adminProcedure
    .input(z.object({ compilationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [source] = await db.select().from(thesisCompilations)
        .where(eq(thesisCompilations.id, input.compilationId)).limit(1);
      if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Saved thesis not found" });

      const ownsSource = source.userId === ctx.user.id;
      const [sharedAccess] = ownsSource ? [undefined] : await db.select().from(thesisShares)
        .where(and(eq(thesisShares.compilationId, input.compilationId), eq(thesisShares.userId, ctx.user.id), eq(thesisShares.permission, "use"))).limit(1);
      if (!canUseCanonicalThesis({ ownerUserId: source.userId, requesterUserId: ctx.user.id, sharedPermission: sharedAccess?.permission })) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You do not have use access to this thesis" });
      }

      const [existing] = await db.select().from(capitalTheses)
        .where(and(eq(capitalTheses.sourceCompilationId, source.id), eq(capitalTheses.userId, ctx.user.id)))
        .limit(1);

      let graph;
      if (isQualifiedPlayIsolatedUat(ctx)) {
        graph = illustrativeUatGraph(source.thesisText, source.name);
      } else {
        try {
          graph = await compileThesis(source.thesisText);
        } catch (error: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Capital projection failed: ${error?.message ?? "unknown compiler error"}` });
        }
      }

      const now = Date.now();
      const values = projectionValues({ id: source.id, name: source.name, thesisText: source.thesisText }, graph, existing?.isPrimary ?? false, now);
      let apertureThesisId: number;

      if (existing) {
        await db.update(capitalTheses).set(values).where(eq(capitalTheses.id, existing.id));
        apertureThesisId = existing.id;
      } else {
        const [result] = await db.insert(capitalTheses).values({
          userId: ctx.user.id,
          ...values,
          isPrimary: false,
          createdAt: now,
        });
        apertureThesisId = (result as any).insertId as number;
      }

      return { apertureThesisId, sourceCompilationId: source.id, graph, linked: Boolean(existing) };
    }),
});
