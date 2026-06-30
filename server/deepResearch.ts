/**
 * Deep Research Service
 * ─────────────────────
 * Routes research queries to the right Perplexity model:
 *   - sonar-pro  → fast, ~$0.01/call, <10s latency — used for on-demand deal dossiers + Radar signals
 *   - sonar-deep-research → thorough, ~$0.80/call, 4-8 min — reserved for background deep dossiers
 *
 * All results are cached in the research_results table with TTL enforcement.
 * TTLs: deal dossier = 72h, radar signal = 24h, industry/market = 48h
 */

import { getDb } from "./db";
import { researchResults } from "../drizzle/schema";
import { eq, and, gt } from "drizzle-orm";

const SONAR_API_URL = "https://api.perplexity.ai/v1/sonar";

function getSonarKey(): string {
  const key = process.env.SONAR_API_KEY;
  if (!key) throw new Error("SONAR_API_KEY not configured");
  return key;
}

// TTL constants in milliseconds
const TTL = {
  deal: 72 * 60 * 60 * 1000,          // 72h
  radar_signal: 24 * 60 * 60 * 1000,  // 24h
  industry: 48 * 60 * 60 * 1000,      // 48h
  market: 48 * 60 * 60 * 1000,        // 48h
} as const;

type SubjectType = "deal" | "radar_signal" | "industry" | "market";
type SonarModel = "sonar" | "sonar-pro" | "sonar-deep-research";

interface ResearchOptions {
  subjectKey: string;
  subjectType: SubjectType;
  query: string;
  model?: SonarModel;
  forceRefresh?: boolean;
}

interface SonarResponse {
  model: string;
  citations?: string[];
  search_results?: Array<{ title: string; url: string; snippet: string; date?: string }>;
  choices: Array<{ message: { role: string; content: string } }>;
  usage?: {
    num_search_queries?: number;
    cost?: { total_cost?: number };
  };
}

/**
 * Get cached research result if still valid (not expired).
 */
export async function getCachedResearch(subjectKey: string) {
  const now = Date.now();
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(researchResults)
    .where(
      and(
        eq(researchResults.subjectKey, subjectKey),
        gt(researchResults.expiresAt, now)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Call Perplexity Sonar API and persist the result.
 */
export async function runResearch(opts: ResearchOptions) {
  const { subjectKey, subjectType, query, model = "sonar-pro", forceRefresh = false } = opts;

  // Cache-first: skip API call if valid cache exists
  if (!forceRefresh) {
    const cached = await getCachedResearch(subjectKey);
    if (cached) return cached;
  }

  const key = getSonarKey();
  const response = await fetch(SONAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a rigorous business due diligence analyst. Return only verified, sourced information. Clearly distinguish between confirmed facts and publicly available information. Never fabricate data. Always cite sources.",
        },
        { role: "user", content: query },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sonar API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as SonarResponse;
  const content = data.choices[0]?.message?.content ?? "";
  const citations = data.citations ?? [];
  const searchResults = data.search_results ?? [];
  const numSearchQueries = data.usage?.num_search_queries ?? null;
  const costUsd = data.usage?.cost?.total_cost ?? null;

  const now = Date.now();
  const expiresAt = now + TTL[subjectType];

  // Upsert: delete old entry for this key, then insert fresh
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(researchResults).where(eq(researchResults.subjectKey, subjectKey));
  const [inserted] = await db
    .insert(researchResults)
    .values({
      subjectKey,
      subjectType,
      model,
      query,
      content,
      citations,
      searchResults,
      numSearchQueries,
      costUsd,
      createdAt: now,
      expiresAt,
    })
    .$returningId();

  const rows = await db
    .select()
    .from(researchResults)
    .where(eq(researchResults.id, inserted.id))
    .limit(1);

  return rows[0];
}

// ─── Deal Dossier ─────────────────────────────────────────────────────────────

export async function getDealDossier(dealId: number, dealName: string, location: string, industry: string, forceRefresh = false) {
  const subjectKey = `deal:${dealId}`;
  const query = `Conduct business due diligence research on "${dealName}", a ${industry} business located in ${location}. 
Research and report on:
1. Business background — how long operating, any ownership history, web presence
2. Owner/principal names — any publicly available information about the seller or principals
3. Customer reviews and complaints — Yelp, BBB, Google, industry forums
4. Litigation or regulatory issues — court filings, OSHA violations, BBB complaints, licensing issues
5. Competitive landscape — who are the main competitors in this market and geography
6. Industry health — current market conditions, growth trends, risk factors for this sector in this location

Return ONLY verified, publicly available information with citations. Clearly state when information is not available rather than speculating.`;

  return runResearch({
    subjectKey,
    subjectType: "deal",
    query,
    model: "sonar-pro",
    forceRefresh,
  });
}

// ─── Opportunity Radar Signals ────────────────────────────────────────────────

export interface RadarSignalQuery {
  location: string;
  signalType: "permit" | "tad" | "zoning" | "market_shift" | "distress";
}

export async function getRadarSignals(location: string, forceRefresh = false) {
  const locationKey = location.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 64);
  const subjectKey = `radar:${locationKey}`;

  const query = `Research current real estate and commercial development signals in ${location}. Find:
1. Recent commercial development permits or major construction projects announced
2. Tax Allocation District (TAD) or Tax Increment Financing (TIF) district activity or new designations
3. Zoning changes or rezoning applications filed
4. Major anchor tenants or employers announced, relocated, or closed
5. Infrastructure investments (transit, roads, utilities) that could affect commercial property values
6. Any distressed commercial properties, foreclosures, or motivated sellers in the market
7. Population or demographic shifts affecting the commercial real estate market

Focus on the past 6-12 months. Cite all sources. Only include verified, publicly reported information.`;

  return runResearch({
    subjectKey,
    subjectType: "radar_signal",
    query,
    model: "sonar-pro",
    forceRefresh,
  });
}

// ─── Industry Research ────────────────────────────────────────────────────────

export async function getIndustryResearch(industry: string, location: string, forceRefresh = false) {
  const industryKey = industry.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 48);
  const locationKey = location.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 32);
  const subjectKey = `industry:${industryKey}:${locationKey}`;

  const query = `Research the ${industry} industry in ${location} for business acquisition due diligence:
1. Market size and growth trends for this sector in this region
2. Typical EBITDA margins and revenue multiples for acquisitions
3. Common customer concentration risks in this industry
4. Key operational risks and deal-killers buyers should watch for
5. Regulatory environment — licensing, compliance requirements
6. Labor market conditions — availability, wage trends, unionization
7. Recent M&A activity or notable transactions in this space

Cite all sources. Focus on data from the past 12-24 months.`;

  return runResearch({
    subjectKey,
    subjectType: "industry",
    query,
    model: "sonar-pro",
    forceRefresh,
  });
}
