/**
 * RIPPLE EFFECT SCANNER
 * Two-track anchor-development signal detection system.
 *
 * Track 1 — RIPPLE-SCOUT (token-free):
 *   Runs 8 surgical Perplexity/news search queries against permit databases,
 *   press release wires, state EDC sites, and workforce signals.
 *   Keyword-filters results. Scores confidence. No LLM until threshold met.
 *
 * Track 2 — RIPPLE-ANALYST (Gemini Flash, ~600 tokens per hit):
 *   On operator escalation, runs infrastructure gap analysis against the
 *   anchor development location and generates 2-3 ranked Main Street plays
 *   with capital stack sketches.
 */

import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import { TRPCError } from "@trpc/server";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawHit {
  title: string;
  snippet: string;
  url: string;
  sourceType: "press_release" | "permit" | "edc" | "workforce" | "utility";
  queryTemplate: string;
}

interface ScoredSignal extends RawHit {
  confidenceScore: number; // 0-1
  location: string;
  projectName: string;
  estimatedScale: string; // e.g. "50+ acres", "$500M construction"
  anchorType: string; // data_center | logistics | manufacturing | energy | government
}

interface GapAnalysis {
  evChargersWithin10mi: number | null;
  foodOptionsWithin5mi: number | null;
  lodgingCapacity: "low" | "medium" | "high" | null;
  housingVacancyRate: string | null;
  estimatedWorkers: number | null;
  gaps: string[];
  plays: Array<{
    rank: number;
    title: string;
    description: string;
    capitalStackSketch: string;
    urgency: "immediate" | "6_months" | "12_months";
    estimatedInvestment: string;
    estimatedCashFlow: string;
  }>;
  analystNote: string;
}

// ─── QUERY TEMPLATES ──────────────────────────────────────────────────────────

const QUERY_TEMPLATES = [
  {
    id: "press_release_bigco",
    template: (geo: string) =>
      `"data center" OR "distribution center" OR "logistics hub" "${geo}" announcement 2025 OR 2026 site:businesswire.com OR prnewswire.com OR globenewswire.com`,
    sourceType: "press_release" as const,
    keywords: ["data center", "distribution", "logistics", "warehouse", "manufacturing", "megasite"],
    minScore: 0.6,
  },
  {
    id: "edc_announcement",
    template: (geo: string) =>
      `"${geo}" "economic development" "megasite" OR "shovel ready" OR "announced" OR "breaking ground" 2025 OR 2026`,
    sourceType: "edc" as const,
    keywords: ["megasite", "shovel ready", "breaking ground", "announced", "jobs", "facility"],
    minScore: 0.55,
  },
  {
    id: "industrial_permit",
    template: (geo: string) =>
      `"${geo}" "building permit" "data center" OR "logistics" OR "substation" OR "industrial" 2025 OR 2026`,
    sourceType: "permit" as const,
    keywords: ["permit", "construction", "industrial", "commercial", "acres", "megawatt"],
    minScore: 0.5,
  },
  {
    id: "workforce_signal",
    template: (geo: string) =>
      `"${geo}" "hiring" "construction" OR "operations" "data center" OR "logistics" OR "manufacturing" 2026`,
    sourceType: "workforce" as const,
    keywords: ["hiring", "jobs", "workers", "employees", "construction", "operations"],
    minScore: 0.45,
  },
  {
    id: "utility_expansion",
    template: (geo: string) =>
      `"${geo}" "transmission line" OR "substation" OR "power grid" OR "electric utility" expansion 2025 OR 2026`,
    sourceType: "utility" as const,
    keywords: ["substation", "transmission", "megawatt", "power", "grid", "utility"],
    minScore: 0.5,
  },
  {
    id: "manufacturing_plant",
    template: (geo: string) =>
      `"${geo}" "manufacturing plant" OR "production facility" OR "factory" announced OR "breaking ground" 2025 OR 2026`,
    sourceType: "press_release" as const,
    keywords: ["manufacturing", "plant", "factory", "production", "facility", "announced"],
    minScore: 0.55,
  },
  {
    id: "cold_storage_logistics",
    template: (geo: string) =>
      `"${geo}" "cold storage" OR "fulfillment center" OR "last mile" OR "intermodal" 2025 OR 2026`,
    sourceType: "permit" as const,
    keywords: ["cold storage", "fulfillment", "last mile", "intermodal", "logistics"],
    minScore: 0.5,
  },
  {
    id: "government_facility",
    template: (geo: string) =>
      `"${geo}" "federal facility" OR "military base" OR "government campus" OR "VA hospital" expansion 2025 OR 2026`,
    sourceType: "edc" as const,
    keywords: ["federal", "military", "government", "campus", "expansion", "facility"],
    minScore: 0.5,
  },
];

// ─── ANCHOR TYPE KEYWORDS ─────────────────────────────────────────────────────

const ANCHOR_KEYWORDS: Record<string, string[]> = {
  data_center: ["data center", "server farm", "cloud campus", "hyperscale", "megawatt"],
  logistics: ["distribution center", "fulfillment center", "logistics hub", "warehouse", "last mile", "cold storage"],
  manufacturing: ["manufacturing plant", "factory", "production facility", "assembly plant", "semiconductor fab"],
  energy: ["substation", "solar farm", "battery storage", "transmission line", "power plant", "wind farm"],
  government: ["military base", "federal facility", "government campus", "VA hospital", "DOD"],
};

// ─── RIPPLE-SCOUT ─────────────────────────────────────────────────────────────

async function runSearchQuery(query: string): Promise<Array<{ title: string; snippet: string; url: string }>> {
  const sonarKey = ENV.sonarApiKey;
  if (!sonarKey) return [];

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sonarKey}`,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "You are a research assistant. Search for the query and return the top 5 most relevant results as a JSON array with fields: title, snippet (2-3 sentences), url. Return ONLY valid JSON array, no explanation.",
          },
          { role: "user", content: query },
        ],
        max_tokens: 1024,
        return_citations: true,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    // Try to parse JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const results = JSON.parse(jsonMatch[0]);
    return Array.isArray(results) ? results.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function scoreHit(hit: { title: string; snippet: string }, keywords: string[]): number {
  const text = `${hit.title} ${hit.snippet}`.toLowerCase();
  const matchCount = keywords.filter((kw) => text.includes(kw.toLowerCase())).length;
  const baseScore = matchCount / keywords.length;

  // Boost for scale indicators
  const scaleBoosts = ["million", "billion", "acres", "megawatt", "mw", "sq ft", "workers", "jobs", "employees"];
  const scaleHits = scaleBoosts.filter((s) => text.includes(s)).length;
  const scaleBoost = Math.min(scaleHits * 0.05, 0.2);

  return Math.min(baseScore + scaleBoost, 1.0);
}

function detectAnchorType(text: string): string {
  const lower = text.toLowerCase();
  for (const [type, keywords] of Object.entries(ANCHOR_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return type;
  }
  return "industrial";
}

function extractLocation(text: string, geography: string): string {
  // Try to find city, state pattern
  const cityStateMatch = text.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*([A-Z]{2})/);
  if (cityStateMatch) return cityStateMatch[0];
  return geography;
}

function extractScale(text: string): string {
  const patterns = [
    /(\d+[\d,]*)\s*(?:acres?|acre)/i,
    /(\d+[\d,]*)\s*(?:MW|megawatt)/i,
    /\$(\d+[\d,]*(?:\.\d+)?)\s*(?:million|billion)/i,
    /(\d+[\d,]*)\s*(?:sq\.?\s*ft|square feet)/i,
    /(\d+[\d,]*)\s*(?:jobs?|workers?|employees?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return "Large-scale development";
}

// ─── RIPPLE-ANALYST ───────────────────────────────────────────────────────────

async function runGapAnalysis(signal: ScoredSignal): Promise<GapAnalysis> {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  const prompt = `You are RIPPLE-ANALYST, a Main Street investment intelligence agent. Analyze this anchor development and identify infrastructure gaps and investment plays.

ANCHOR DEVELOPMENT:
- Project: ${signal.projectName}
- Location: ${signal.location}
- Type: ${signal.anchorType}
- Scale: ${signal.estimatedScale}
- Source: ${signal.snippet}

Your task:
1. Estimate the infrastructure gaps this development will create (EV charging, food options, lodging, housing)
2. Identify the top 2-3 Main Street business acquisition or startup plays
3. For each play, provide a capital stack sketch (SBA 7(a), 504, seller note, etc.)

Return a JSON object with this exact structure:
{
  "evChargersWithin10mi": <estimated number or null>,
  "foodOptionsWithin5mi": <estimated number or null>,
  "lodgingCapacity": "low" | "medium" | "high",
  "housingVacancyRate": "<estimated rate or null>",
  "estimatedWorkers": <number or null>,
  "gaps": ["gap 1", "gap 2", "gap 3"],
  "plays": [
    {
      "rank": 1,
      "title": "<play name>",
      "description": "<2-3 sentence description of the opportunity>",
      "capitalStackSketch": "<e.g. SBA 7(a) 75% + Seller Note 15% + Equity 10%>",
      "urgency": "immediate" | "6_months" | "12_months",
      "estimatedInvestment": "<e.g. $250K-$500K>",
      "estimatedCashFlow": "<e.g. $80K-$120K/yr>"
    }
  ],
  "analystNote": "<1-2 sentence strategic framing of why this is a high-conviction window>"
}

Be specific and realistic. Focus on businesses that can be acquired or started with $100K-$2M. No explanation outside the JSON.`;

  try {
    const res = await fetch(`${forgeUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${forgeKey}` },
      body: JSON.stringify({
        model: "gemini-3.1-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error(`Analyst HTTP ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = typeof content === "string" ? JSON.parse(content) : content;

    return {
      evChargersWithin10mi: parsed.evChargersWithin10mi ?? null,
      foodOptionsWithin5mi: parsed.foodOptionsWithin5mi ?? null,
      lodgingCapacity: parsed.lodgingCapacity ?? null,
      housingVacancyRate: parsed.housingVacancyRate ?? null,
      estimatedWorkers: parsed.estimatedWorkers ?? null,
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      plays: Array.isArray(parsed.plays) ? parsed.plays : [],
      analystNote: parsed.analystNote ?? "",
    };
  } catch {
    return {
      evChargersWithin10mi: null,
      foodOptionsWithin5mi: null,
      lodgingCapacity: null,
      housingVacancyRate: null,
      estimatedWorkers: null,
      gaps: ["Analysis unavailable — escalate manually"],
      plays: [],
      analystNote: "Gap analysis failed. Review source article directly.",
    };
  }
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

async function ensureTable(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ripple_signals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      query_template VARCHAR(64) NOT NULL,
      source_type VARCHAR(32) NOT NULL,
      project_name VARCHAR(512) NOT NULL,
      location VARCHAR(256) NOT NULL,
      anchor_type VARCHAR(64) NOT NULL,
      estimated_scale VARCHAR(256),
      raw_title TEXT,
      snippet TEXT,
      source_url TEXT,
      confidence_score FLOAT NOT NULL DEFAULT 0,
      status ENUM('new', 'escalated', 'analyzed', 'dismissed') NOT NULL DEFAULT 'new',
      gap_analysis JSON,
      created_at BIGINT NOT NULL,
      analyzed_at BIGINT
    )
  `);
}

async function persistSignal(signal: ScoredSignal): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.execute(
      sql`INSERT INTO ripple_signals
          (query_template, source_type, project_name, location, anchor_type, estimated_scale,
           raw_title, snippet, source_url, confidence_score, status, created_at)
          VALUES (
            ${signal.queryTemplate},
            ${signal.sourceType},
            ${signal.projectName.slice(0, 512)},
            ${signal.location.slice(0, 256)},
            ${signal.anchorType},
            ${signal.estimatedScale.slice(0, 256)},
            ${signal.title.slice(0, 1000)},
            ${signal.snippet.slice(0, 2000)},
            ${signal.url.slice(0, 1024)},
            ${signal.confidenceScore},
            'new',
            ${Date.now()}
          )`
    ) as any;
    return result[0]?.insertId ?? result?.insertId ?? null;
  } catch {
    return null;
  }
}

// ─── tRPC Router ──────────────────────────────────────────────────────────────

export const rippleRouter = router({
  /**
   * RIPPLE-SCOUT: Run surgical search queries for a geography.
   * No LLM — pure keyword scoring. Returns signals above threshold.
   * Token cost: ~0 (Perplexity search only, no generation).
   */
  scan: protectedProcedure
    .input(
      z.object({
        geography: z.string().min(2).max(128),
        minConfidence: z.number().min(0).max(1).default(0.4),
      })
    )
    .mutation(async ({ input }) => {
      await ensureTable();
      const { geography, minConfidence } = input;
      const signals: ScoredSignal[] = [];

      // Run all query templates in parallel (no LLM, just search)
      const searchResults = await Promise.allSettled(
        QUERY_TEMPLATES.map(async (template) => {
          const query = template.template(geography);
          const hits = await runSearchQuery(query);
          return { template, hits };
        })
      );

      for (const result of searchResults) {
        if (result.status !== "fulfilled") continue;
        const { template, hits } = result.value;

        for (const hit of hits) {
          const score = scoreHit(hit, template.keywords);
          if (score < minConfidence) continue;

          const text = `${hit.title} ${hit.snippet}`;
          const signal: ScoredSignal = {
            title: hit.title || "Untitled",
            snippet: hit.snippet || "",
            url: hit.url || "",
            sourceType: template.sourceType,
            queryTemplate: template.id,
            confidenceScore: score,
            location: extractLocation(text, geography),
            projectName: hit.title?.slice(0, 80) || "Unknown Project",
            estimatedScale: extractScale(text),
            anchorType: detectAnchorType(text),
          };

          await persistSignal(signal);
          signals.push(signal);
        }
      }

      // Deduplicate by similar title
      const seen = new Set<string>();
      const unique = signals.filter((s) => {
        const key = s.projectName.toLowerCase().slice(0, 40);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return {
        signalsFound: unique.length,
        geography,
        message: `RippleEffect scan complete: ${unique.length} signals detected above ${Math.round(minConfidence * 100)}% confidence threshold.`,
      };
    }),

  /**
   * RIPPLE-ANALYST: Escalate a signal to full gap analysis.
   * Calls Gemini Flash with structured prompt (~600 tokens).
   * Returns infrastructure gaps + 2-3 ranked Main Street plays.
   */
  escalate: protectedProcedure
    .input(z.object({ signalId: z.number() }))
    .mutation(async ({ input }) => {
      await ensureTable();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rows = await db.execute(
        sql`SELECT * FROM ripple_signals WHERE id = ${input.signalId} LIMIT 1`
      ) as any;
      const row = (rows[0] as any[])?.[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Signal not found" });

      const signal: ScoredSignal = {
        title: row.raw_title || "",
        snippet: row.snippet || "",
        url: row.source_url || "",
        sourceType: row.source_type,
        queryTemplate: row.query_template,
        confidenceScore: row.confidence_score,
        location: row.location,
        projectName: row.project_name,
        estimatedScale: row.estimated_scale || "Unknown scale",
        anchorType: row.anchor_type,
      };

      const gapAnalysis = await runGapAnalysis(signal);

      await db.execute(
        sql`UPDATE ripple_signals
            SET status = 'analyzed', gap_analysis = ${JSON.stringify(gapAnalysis)}, analyzed_at = ${Date.now()}
            WHERE id = ${input.signalId}`
      );

      return { signalId: input.signalId, gapAnalysis };
    }),

  /**
   * List all ripple signals with optional filters.
   */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["new", "escalated", "analyzed", "dismissed", "all"]).default("all"),
        anchorType: z.string().optional(),
        minConfidence: z.number().min(0).max(1).default(0),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      await ensureTable();
      const db = await getDb();
      if (!db) return [];

      const clauses: string[] = [];
      if (input.status !== "all") clauses.push(`status = '${input.status}'`);
      if (input.anchorType) clauses.push(`anchor_type = '${input.anchorType.replace(/'/g, "''")}'`);
      if (input.minConfidence > 0) clauses.push(`confidence_score >= ${input.minConfidence}`);

      const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
      const query = `SELECT * FROM ripple_signals ${where} ORDER BY confidence_score DESC, created_at DESC LIMIT ${input.limit}`;

      const rows = await db.execute(sql.raw(query)) as any;
      const results = (rows[0] as any[]) || [];

      return results.map((r: any) => ({
        ...r,
        confidenceScore: Number(r.confidence_score),
        gapAnalysis: r.gap_analysis
          ? typeof r.gap_analysis === "string"
            ? JSON.parse(r.gap_analysis)
            : r.gap_analysis
          : null,
        createdAt: Number(r.created_at),
        analyzedAt: r.analyzed_at ? Number(r.analyzed_at) : null,
      }));
    }),

  /**
   * Dismiss a signal (mark as noise).
   */
  dismiss: protectedProcedure
    .input(z.object({ signalId: z.number() }))
    .mutation(async ({ input }) => {
      await ensureTable();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.execute(
        sql`UPDATE ripple_signals SET status = 'dismissed' WHERE id = ${input.signalId}`
      );
      return { success: true };
    }),

  /**
   * Get a single signal with full gap analysis.
   */
  getById: protectedProcedure
    .input(z.object({ signalId: z.number() }))
    .query(async ({ input }) => {
      await ensureTable();
      const db = await getDb();
      if (!db) return null;
      const rows = await db.execute(
        sql`SELECT * FROM ripple_signals WHERE id = ${input.signalId} LIMIT 1`
      ) as any;
      const row = (rows[0] as any[])?.[0];
      if (!row) return null;
      return {
        ...row,
        confidenceScore: Number(row.confidence_score),
        gapAnalysis: row.gap_analysis
          ? typeof row.gap_analysis === "string"
            ? JSON.parse(row.gap_analysis)
            : row.gap_analysis
          : null,
        createdAt: Number(row.created_at),
        analyzedAt: row.analyzed_at ? Number(row.analyzed_at) : null,
      };
    }),
});
