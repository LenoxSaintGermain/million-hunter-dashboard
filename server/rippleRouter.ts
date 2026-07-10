/**
 * RIPPLE EFFECT SCANNER
 * Two-track anchor-development signal detection system.
 *
 * Track 1 — RIPPLE-SCOUT (token-free):
 *   Runs 8 surgical Perplexity/news search queries against permit databases,
 *   press release wires, state EDC sites, and workforce signals.
 *   Keyword-filters results. Scores confidence. No LLM until threshold met.
 *   Results cached for 24h per location — zero token cost on repeat runs.
 *
 * Track 2 — RIPPLE-ANALYST (Gemini Flash, ~600 tokens per hit):
 *   On operator escalation, runs infrastructure gap analysis against the
 *   anchor development location and generates 2-3 ranked Main Street plays
 *   with capital stack sketches.
 *
 * Track 3 — RIPPLE-PIPELINE (async, on favorite):
 *   When a signal is favorited, queues a cross-tool enrichment job:
 *   Market Scan → TIDE check → IC Consensus on top business match.
 */

import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { sql, eq, and, gt } from "drizzle-orm";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import { TRPCError } from "@trpc/server";
import {
  rippleScanCache,
  rippleFavorites,
  ripplePipelineJobs,
  type InsertRippleScanCache,
  type InsertRippleFavorite,
  type InsertRipplePipelineJob,
} from "../drizzle/schema";
import crypto from "crypto";

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
  estimatedScale: string;
  anchorType: string;
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

const ANCHOR_KEYWORDS: Record<string, string[]> = {
  data_center: ["data center", "server farm", "cloud campus", "hyperscale", "megawatt"],
  logistics: ["distribution center", "fulfillment center", "logistics hub", "warehouse", "last mile", "cold storage"],
  manufacturing: ["manufacturing plant", "factory", "production facility", "assembly plant", "semiconductor fab"],
  energy: ["substation", "solar farm", "battery storage", "transmission line", "power plant", "wind farm"],
  government: ["military base", "federal facility", "government campus", "VA hospital", "DOD"],
};

// ─── CACHE HELPERS ────────────────────────────────────────────────────────────

function buildQueryHash(geography: string, minConfidence: number): string {
  return crypto
    .createHash("md5")
    .update(`${geography.toLowerCase().trim()}:${minConfidence}`)
    .digest("hex")
    .slice(0, 16);
}

async function getCachedScan(
  geography: string,
  minConfidence: number
): Promise<{ signals: ScoredSignal[]; cachedAt: number } | null> {
  const db = await getDb();
  if (!db) return null;
  const hash = buildQueryHash(geography, minConfidence);
  const now = Date.now();
  const rows = await db
    .select()
    .from(rippleScanCache)
    .where(
      and(
        eq(rippleScanCache.queryHash, hash),
        gt(rippleScanCache.expiresAt, now)
      )
    )
    .limit(1);
  if (!rows.length) return null;
  const row = rows[0];
  return {
    signals: (row.resultsJson as ScoredSignal[]) || [],
    cachedAt: Number(row.createdAt),
  };
}

async function saveScanCache(
  geography: string,
  minConfidence: number,
  signals: ScoredSignal[]
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const hash = buildQueryHash(geography, minConfidence);
  const now = Date.now();
  const TTL_24H = 24 * 60 * 60 * 1000;
  // Upsert: delete old then insert (MySQL doesn't support ON CONFLICT easily with Drizzle)
  await db.delete(rippleScanCache).where(eq(rippleScanCache.queryHash, hash));
  const data: InsertRippleScanCache = {
    location: geography,
    queryHash: hash,
    resultsJson: signals as any,
    signalCount: signals.length,
    createdAt: now,
    expiresAt: now + TTL_24H,
  };
  await db.insert(rippleScanCache).values(data);
}

// ─── RIPPLE-SCOUT ─────────────────────────────────────────────────────────────

async function runSearchQuery(query: string): Promise<Array<{ title: string; snippet: string; url: string }>> {
  const sonarKey = ENV.sonarApiKey;
  if (!sonarKey) return [];
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sonarKey}` },
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
  const scaleBoosts = ["million", "billion", "acres", "megawatt", "mw", "sq ft", "workers", "jobs", "employees"];
  const scaleHits = scaleBoosts.filter((s) => text.includes(s)).length;
  return Math.min(baseScore + Math.min(scaleHits * 0.05, 0.2), 1.0);
}

function detectAnchorType(text: string): string {
  const lower = text.toLowerCase();
  for (const [type, keywords] of Object.entries(ANCHOR_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return type;
  }
  return "industrial";
}

function extractLocation(text: string, geography: string): string {
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

async function runLiveSearch(geography: string, minConfidence: number): Promise<ScoredSignal[]> {
  const signals: ScoredSignal[] = [];
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
      signals.push({
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
      });
    }
  }
  // Deduplicate by similar title
  const seen = new Set<string>();
  return signals.filter((s) => {
    const key = s.projectName.toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

Return a JSON object:
{
  "evChargersWithin10mi": <number or null>,
  "foodOptionsWithin5mi": <number or null>,
  "lodgingCapacity": "low" | "medium" | "high",
  "housingVacancyRate": "<rate or null>",
  "estimatedWorkers": <number or null>,
  "gaps": ["gap 1", "gap 2", "gap 3"],
  "plays": [
    {
      "rank": 1,
      "title": "<play name>",
      "description": "<2-3 sentences>",
      "capitalStackSketch": "<e.g. SBA 7(a) 75% + Seller Note 15% + Equity 10%>",
      "urgency": "immediate" | "6_months" | "12_months",
      "estimatedInvestment": "<e.g. $250K-$500K>",
      "estimatedCashFlow": "<e.g. $80K-$120K/yr>"
    }
  ],
  "analystNote": "<1-2 sentence strategic framing>"
}

Focus on businesses acquirable or startable with $100K-$2M. No explanation outside JSON.`;

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
      evChargersWithin10mi: null, foodOptionsWithin5mi: null, lodgingCapacity: null,
      housingVacancyRate: null, estimatedWorkers: null,
      gaps: ["Analysis unavailable — escalate manually"], plays: [],
      analystNote: "Gap analysis failed. Review source article directly.",
    };
  }
}

// ─── LEGACY DB HELPERS (ripple_signals table) ─────────────────────────────────

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
            ${signal.queryTemplate}, ${signal.sourceType}, ${signal.projectName.slice(0, 512)},
            ${signal.location.slice(0, 256)}, ${signal.anchorType}, ${signal.estimatedScale.slice(0, 256)},
            ${signal.title.slice(0, 1000)}, ${signal.snippet.slice(0, 2000)}, ${signal.url.slice(0, 1024)},
            ${signal.confidenceScore}, 'new', ${Date.now()}
          )`
    ) as any;
    return result[0]?.insertId ?? result?.insertId ?? null;
  } catch {
    return null;
  }
}

// ─── PIPELINE RUNNER (async, no await in route) ───────────────────────────────

async function runEnrichmentPipeline(jobId: number, favorite: any): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const updateJob = async (data: Partial<{ status: any; currentStep: string; marketScanResults: any; tideSignals: any; icVerdict: any; errorMessage: string; completedAt: number }>) => {
    await db.update(ripplePipelineJobs).set(data as any).where(eq(ripplePipelineJobs.id, jobId));
  };

  try {
    await updateJob({ status: "running", currentStep: "market_scan" });

    // Step 1: Market Scan — find businesses in the geography matching gap play categories
    const signal = favorite.signalSnapshot as ScoredSignal;
    const location = favorite.location as string;
    const plays = (favorite.playsJson as any[]) || [];
    const categories = plays.map((p: any) => p.title).join(", ") || "cleaning, HVAC, logistics, pest control";

    const sonarKey = ENV.sonarApiKey;
    let marketScanResults: any[] = [];
    if (sonarKey) {
      try {
        const scanQuery = `businesses for sale "${location}" ${categories} site:bizbuysell.com OR site:loopnet.com OR site:businessbroker.net 2025 OR 2026`;
        const hits = await runSearchQuery(scanQuery);
        marketScanResults = hits.slice(0, 5).map((h, i) => ({
          rank: i + 1,
          name: h.title,
          snippet: h.snippet,
          url: h.url,
          location,
          relevance: "Matches gap play opportunity",
        }));
      } catch { /* continue */ }
    }

    await updateJob({ currentStep: "tide", marketScanResults });

    // Step 2: TIDE — check for federal capital flowing into geography
    let tideSignals: any[] = [];
    if (sonarKey) {
      try {
        const tideQuery = `"${location}" federal funding OR "USASpending" OR "CHIPS Act" OR "infrastructure bill" OR "economic development grant" 2025 OR 2026`;
        const tideHits = await runSearchQuery(tideQuery);
        tideSignals = tideHits.slice(0, 3).map((h) => ({
          title: h.title,
          snippet: h.snippet,
          url: h.url,
          signalType: "government",
          relevance: `Federal capital flowing into ${location}`,
        }));
      } catch { /* continue */ }
    }

    await updateJob({ currentStep: "ic", tideSignals });

    // Step 3: IC Consensus — quick verdict on best-fit acquisition target
    let icVerdict: any = null;
    if (marketScanResults.length > 0) {
      const forgeUrl = ENV.forgeApiUrl;
      const forgeKey = ENV.forgeApiKey;
      const topTarget = marketScanResults[0];
      const icPrompt = `You are an investment committee analyst. Given this RippleEffect anchor development and top acquisition target, provide a quick IC verdict.

ANCHOR: ${signal.projectName} in ${location} (${signal.anchorType})
GAP PLAYS: ${categories}
TOP TARGET: ${topTarget.name} — ${topTarget.snippet}

Return JSON: { "verdict": "approve" | "pass" | "review", "score": 0.0-1.0, "rationale": "2-3 sentences", "keyRisk": "main risk", "keyOpportunity": "main opportunity" }`;

      try {
        const res = await fetch(`${forgeUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${forgeKey}` },
          body: JSON.stringify({
            model: "gemini-3.1-flash",
            messages: [{ role: "user", content: icPrompt }],
            response_format: { type: "json_object" },
            max_tokens: 512,
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content || "{}";
          icVerdict = typeof content === "string" ? JSON.parse(content) : content;
        }
      } catch { /* continue */ }
    }

    await updateJob({ status: "done", currentStep: undefined, icVerdict, completedAt: Date.now() });

    // Notify owner
    try {
      const { notifyOwner } = await import("./_core/notification");
      await notifyOwner({
        title: `RippleEffect Pipeline Complete — ${location}`,
        content: `Pipeline for "${signal.projectName}" finished. Market scan: ${marketScanResults.length} targets. TIDE: ${tideSignals.length} signals. IC: ${icVerdict?.verdict ?? "n/a"}.`,
      });
    } catch { /* non-critical */ }

    // Update favorite pipeline status
    await db.update(rippleFavorites).set({ pipelineStatus: "done" }).where(eq(rippleFavorites.id, favorite.id));

  } catch (err: any) {
    await updateJob({ status: "error", errorMessage: String(err?.message || err), completedAt: Date.now() });
    await db.update(rippleFavorites).set({ pipelineStatus: "error" }).where(eq(rippleFavorites.id, favorite.id));
  }
}

// ─── tRPC Router ──────────────────────────────────────────────────────────────

export const rippleRouter = router({
  /**
   * RIPPLE-SCOUT: Run surgical search queries for a geography.
   * Checks 24h cache first — zero token cost on repeat runs.
   */
  scan: protectedProcedure
    .input(z.object({
      geography: z.string().min(2).max(128),
      minConfidence: z.number().min(0).max(1).default(0.4),
      forceRefresh: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      await ensureTable();
      const { geography, minConfidence, forceRefresh } = input;

      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = await getCachedScan(geography, minConfidence);
        if (cached) {
          const ageMinutes = Math.round((Date.now() - cached.cachedAt) / 60000);
          return {
            signalsFound: cached.signals.length,
            geography,
            fromCache: true,
            cachedAgo: `${ageMinutes}m ago`,
            message: `Cached result (${ageMinutes}m ago) — ${cached.signals.length} signals. Use force refresh to re-scan.`,
          };
        }
      }

      // Live scan
      const signals = await runLiveSearch(geography, minConfidence);

      // Persist each signal to ripple_signals table
      for (const signal of signals) {
        await persistSignal(signal);
      }

      // Save to cache
      await saveScanCache(geography, minConfidence, signals);

      return {
        signalsFound: signals.length,
        geography,
        fromCache: false,
        cachedAgo: null,
        message: `RippleEffect scan complete: ${signals.length} signals detected above ${Math.round(minConfidence * 100)}% confidence threshold.`,
      };
    }),

  /**
   * RIPPLE-ANALYST: Escalate a signal to full gap analysis.
   * Calls Gemini Flash (~600 tokens). Saves result to ripple_signals.
   */
  escalate: protectedProcedure
    .input(z.object({ signalId: z.number() }))
    .mutation(async ({ input }) => {
      await ensureTable();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rows = await db.execute(sql`SELECT * FROM ripple_signals WHERE id = ${input.signalId} LIMIT 1`) as any;
      const row = (rows[0] as any[])?.[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Signal not found" });

      const signal: ScoredSignal = {
        title: row.raw_title || "", snippet: row.snippet || "", url: row.source_url || "",
        sourceType: row.source_type, queryTemplate: row.query_template,
        confidenceScore: row.confidence_score, location: row.location,
        projectName: row.project_name, estimatedScale: row.estimated_scale || "Unknown scale",
        anchorType: row.anchor_type,
      };

      const gapAnalysis = await runGapAnalysis(signal);

      await db.execute(
        sql`UPDATE ripple_signals SET status = 'analyzed', gap_analysis = ${JSON.stringify(gapAnalysis)}, analyzed_at = ${Date.now()} WHERE id = ${input.signalId}`
      );

      return { signalId: input.signalId, gapAnalysis };
    }),

  /**
   * List ripple signals with filters.
   */
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["new", "escalated", "analyzed", "dismissed", "all"]).default("all"),
      anchorType: z.string().optional(),
      minConfidence: z.number().min(0).max(1).default(0),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      await ensureTable();
      const db = await getDb();
      if (!db) return [];
      const clauses: string[] = [];
      if (input.status !== "all") clauses.push(`status = '${input.status}'`);
      if (input.anchorType) clauses.push(`anchor_type = '${input.anchorType.replace(/'/g, "''")}'`);
      if (input.minConfidence > 0) clauses.push(`confidence_score >= ${input.minConfidence}`);
      const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
      const rows = await db.execute(sql.raw(`SELECT * FROM ripple_signals ${where} ORDER BY confidence_score DESC, created_at DESC LIMIT ${input.limit}`)) as any;
      return ((rows[0] as any[]) || []).map((r: any) => ({
        ...r,
        confidenceScore: Number(r.confidence_score),
        gapAnalysis: r.gap_analysis ? (typeof r.gap_analysis === "string" ? JSON.parse(r.gap_analysis) : r.gap_analysis) : null,
        createdAt: Number(r.created_at),
        analyzedAt: r.analyzed_at ? Number(r.analyzed_at) : null,
      }));
    }),

  /**
   * Dismiss a signal.
   */
  dismiss: protectedProcedure
    .input(z.object({ signalId: z.number() }))
    .mutation(async ({ input }) => {
      await ensureTable();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.execute(sql`UPDATE ripple_signals SET status = 'dismissed' WHERE id = ${input.signalId}`);
      return { success: true };
    }),

  /**
   * Get a single signal.
   */
  getById: protectedProcedure
    .input(z.object({ signalId: z.number() }))
    .query(async ({ input }) => {
      await ensureTable();
      const db = await getDb();
      if (!db) return null;
      const rows = await db.execute(sql`SELECT * FROM ripple_signals WHERE id = ${input.signalId} LIMIT 1`) as any;
      const row = (rows[0] as any[])?.[0];
      if (!row) return null;
      return {
        ...row,
        confidenceScore: Number(row.confidence_score),
        gapAnalysis: row.gap_analysis ? (typeof row.gap_analysis === "string" ? JSON.parse(row.gap_analysis) : row.gap_analysis) : null,
        createdAt: Number(row.created_at),
        analyzedAt: row.analyzed_at ? Number(row.analyzed_at) : null,
      };
    }),

  // ─── FAVORITES ────────────────────────────────────────────────────────────

  /**
   * Save a signal to favorites. Persists full snapshot for offline pipeline use.
   */
  favorite: protectedProcedure
    .input(z.object({
      signalId: z.number(),
      playsJson: z.array(z.any()).optional(),
      gapAnalysisJson: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureTable();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rows = await db.execute(sql`SELECT * FROM ripple_signals WHERE id = ${input.signalId} LIMIT 1`) as any;
      const row = (rows[0] as any[])?.[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Signal not found" });

      const data: InsertRippleFavorite = {
        userId: ctx.user.id,
        location: row.location,
        anchorType: row.anchor_type,
        projectName: row.project_name,
        signalSnapshot: row as any,
        playsJson: input.playsJson as any,
        gapAnalysisJson: input.gapAnalysisJson as any,
        pipelineStatus: "none",
        createdAt: Date.now(),
      };
      const result = await db.insert(rippleFavorites).values(data);
      const insertId = (result as any)[0]?.insertId ?? (result as any)?.insertId;
      return { favoriteId: insertId, success: true };
    }),

  /**
   * List user's favorited signals.
   */
  listFavorites: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(rippleFavorites)
        .where(eq(rippleFavorites.userId, ctx.user.id))
        .orderBy(rippleFavorites.createdAt);
      return rows.map((r) => ({
        ...r,
        createdAt: Number(r.createdAt),
      }));
    }),

  /**
   * Remove a favorite.
   */
  unfavorite: protectedProcedure
    .input(z.object({ favoriteId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.delete(rippleFavorites).where(
        and(eq(rippleFavorites.id, input.favoriteId), eq(rippleFavorites.userId, ctx.user.id))
      );
      return { success: true };
    }),

  // ─── PIPELINE ─────────────────────────────────────────────────────────────

  /**
   * Kick off the cross-tool enrichment pipeline on a favorited signal.
   * Runs async: Market Scan → TIDE → IC Consensus.
   */
  runPipeline: protectedProcedure
    .input(z.object({ favoriteId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const favRows = await db
        .select()
        .from(rippleFavorites)
        .where(and(eq(rippleFavorites.id, input.favoriteId), eq(rippleFavorites.userId, ctx.user.id)))
        .limit(1);
      if (!favRows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Favorite not found" });
      const favorite = favRows[0];

      // Create job record
      const jobData: InsertRipplePipelineJob = {
        favoriteId: input.favoriteId,
        userId: ctx.user.id,
        status: "queued",
        createdAt: Date.now(),
      };
      const jobResult = await db.insert(ripplePipelineJobs).values(jobData);
      const jobId = (jobResult as any)[0]?.insertId ?? (jobResult as any)?.insertId;

      // Update favorite status
      await db.update(rippleFavorites).set({ pipelineStatus: "queued" }).where(eq(rippleFavorites.id, input.favoriteId));

      // Fire-and-forget async pipeline
      runEnrichmentPipeline(jobId, favorite).catch(console.error);

      return { jobId, status: "queued", message: "Pipeline queued. Market Scan → TIDE → IC running in background." };
    }),

  /**
   * Poll pipeline job status.
   */
  getPipelineStatus: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(ripplePipelineJobs)
        .where(and(eq(ripplePipelineJobs.id, input.jobId), eq(ripplePipelineJobs.userId, ctx.user.id)))
        .limit(1);
      if (!rows.length) return null;
      const job = rows[0];
      return {
        ...job,
        createdAt: Number(job.createdAt),
        completedAt: job.completedAt ? Number(job.completedAt) : null,
      };
    }),

  /**
   * Get all pipeline jobs for the current user.
   */
  listPipelineJobs: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(ripplePipelineJobs)
        .where(eq(ripplePipelineJobs.userId, ctx.user.id))
        .orderBy(ripplePipelineJobs.createdAt);
      return rows.map((r) => ({
        ...r,
        createdAt: Number(r.createdAt),
        completedAt: r.completedAt ? Number(r.completedAt) : null,
      }));
    }),
});
