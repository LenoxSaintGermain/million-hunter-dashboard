/**
 * TIDE — Temporal Intelligence for Deployment Events
 * Phase 1: Political Capital Deployment
 *
 * Three-agent pipeline:
 *  TIDE-SCOUT    → fetches raw flows from USAspending, Federal Register, FEC
 *  TIDE-CLASSIFIER → Gemini classifies each flow by category + geography + confidence
 *  TIDE-LINKER   → Gemini detects convergence events (2+ flows, same geo, 90-day window)
 *                  and generates thesis pre-compilation seeds
 */

import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import { TRPCError } from "@trpc/server";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawFlow {
  source: "usaspending" | "federal_register" | "fec";
  entity: string;
  amount: number | null; // cents
  geography: string;
  rawTitle: string;
  sourceUrl: string;
  flowDate: string; // YYYY-MM-DD
}

interface ClassifiedFlow extends RawFlow {
  category: string;
  confidence: number;
}

interface ConvergenceEvent {
  geography: string;
  signalType: string;
  flowIds: number[];
  totalCapital: number;
  thesisSeed: string;
  confidence: number;
}

// ─── TIDE-SCOUT ───────────────────────────────────────────────────────────────

async function scoutUSASpending(geography: string): Promise<RawFlow[]> {
  try {
    const stateCode = getStateCode(geography);
    const url = `https://api.usaspending.gov/api/v2/search/spending_by_award/`;
    const body = {
      filters: {
        time_period: [{ start_date: getDateNDaysAgo(180), end_date: getTodayDate() }],
        award_type_codes: ["A", "B", "C", "D"],
        place_of_performance_locations: stateCode ? [{ country: "USA", state: stateCode }] : [],
      },
      fields: [
        "Award ID",
        "Recipient Name",
        "Award Amount",
        "Place of Performance State Code",
        "Award Type",
        "Description",
        "generated_unique_award_id",
      ],
      sort: "Award Amount",
      order: "desc",
      limit: 20,
      page: 1,
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const results: any[] = data.results || [];
    return results.slice(0, 15).map((r) => ({
      source: "usaspending" as const,
      entity: r["Recipient Name"] || "Unknown",
      amount: r["Award Amount"] ? Math.round(r["Award Amount"] * 100) : null,
      geography,
      rawTitle: r["Description"] || r["Award Type"] || "Federal Contract Award",
      sourceUrl: `https://www.usaspending.gov/award/${r["generated_unique_award_id"] || ""}`,
      flowDate: getTodayDate(),
    }));
  } catch {
    return [];
  }
}

async function scoutFederalRegister(geography: string): Promise<RawFlow[]> {
  try {
    const url = `https://www.federalregister.gov/api/v1/documents.json?conditions[term]=${encodeURIComponent(geography)}&conditions[type][]=NOTICE&conditions[type][]=RULE&per_page=15&order=newest`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    const results: any[] = data.results || [];
    return results.slice(0, 10).map((r) => ({
      source: "federal_register" as const,
      entity: r.agencies?.map((a: any) => a.name).join(", ") || "Federal Agency",
      amount: null,
      geography,
      rawTitle: r.title || "Federal Register Notice",
      sourceUrl: r.html_url || `https://www.federalregister.gov`,
      flowDate: r.publication_date || getTodayDate(),
    }));
  } catch {
    return [];
  }
}

async function scoutFEC(geography: string): Promise<RawFlow[]> {
  try {
    const state = getStateCode(geography);
    if (!state) return [];
    const url = `https://api.open.fec.gov/v1/schedules/schedule_b/?api_key=DEMO_KEY&state=${state}&sort=-disbursement_date&per_page=15&two_year_transaction_period=2024`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    const results: any[] = data.results || [];
    return results.slice(0, 10).map((r) => ({
      source: "fec" as const,
      entity: r.recipient_name || r.committee?.name || "Political Committee",
      amount: r.disbursement_amount ? Math.round(r.disbursement_amount * 100) : null,
      geography,
      rawTitle: r.disbursement_description || "FEC Disbursement",
      sourceUrl: `https://www.fec.gov/data/disbursements/?state=${state}`,
      flowDate: r.disbursement_date?.split("T")[0] || getTodayDate(),
    }));
  } catch {
    return [];
  }
}

// ─── TIDE-CLASSIFIER ──────────────────────────────────────────────────────────

async function classifyFlows(flows: RawFlow[]): Promise<ClassifiedFlow[]> {
  if (flows.length === 0) return [];

  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  const prompt = `You are TIDE-CLASSIFIER, a capital flow intelligence agent. Classify each of the following capital flows.

For each flow, output a JSON object with:
- "index": the array index (0-based)
- "category": one of: infrastructure | defense | healthcare | housing | energy | education | agriculture | technology | finance | other
- "geography": the most specific geography you can determine (city, state, or MSA)
- "confidence": 0.0-1.0 how confident you are in the classification

Flows to classify:
${flows
  .map(
    (f, i) =>
      `[${i}] Source: ${f.source} | Entity: ${f.entity} | Title: ${f.rawTitle} | Geography: ${f.geography} | Amount: ${f.amount ? "$" + Math.round(f.amount / 100).toLocaleString() : "N/A"}`
  )
  .join("\n")}

Return a JSON object with key "classifications" containing an array of classification objects. No explanation.`;

  try {
    const res = await fetch(`${forgeUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${forgeKey}` },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Classifier HTTP ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '{"classifications":[]}';
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    const classifications: any[] = parsed.classifications || parsed.flows || (Array.isArray(parsed) ? parsed : []);

    return flows.map((f, i) => {
      const cls = classifications.find((c: any) => c.index === i) || {};
      return {
        ...f,
        category: cls.category || "other",
        geography: cls.geography || f.geography,
        confidence: typeof cls.confidence === "number" ? cls.confidence : 0.7,
      };
    });
  } catch {
    return flows.map((f) => ({ ...f, category: "other", confidence: 0.6 }));
  }
}

// ─── TIDE-LINKER ──────────────────────────────────────────────────────────────

async function detectConvergence(
  flows: Array<ClassifiedFlow & { id: number }>,
  geography: string
): Promise<Omit<ConvergenceEvent, "flowIds">[]> {
  if (flows.length < 2) return [];

  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  const prompt = `You are TIDE-LINKER, a convergence intelligence agent. Identify when multiple capital flows in the same geography signal a coordinated deployment pattern that creates business acquisition opportunity.

Geography: ${geography}
Flows detected in the last 180 days:
${flows
  .map(
    (f) =>
      `- [${f.category.toUpperCase()}] ${f.entity}: ${f.rawTitle} (${f.flowDate}, confidence: ${f.confidence})`
  )
  .join("\n")}

Identify convergence events where 2+ flows suggest:
1. Infrastructure build-out creating service demand
2. Defense/government expansion creating B2B opportunity
3. Healthcare expansion creating support services demand
4. Housing push creating property services demand
5. Energy transition creating maintenance/services demand

For each convergence event found, output:
- "signal_type": one of: infrastructure_surge | defense_pivot | housing_push | energy_transition | healthcare_expansion | government_expansion | other
- "thesis_seed": 2-3 sentence investment thesis pre-compilation (what business sectors benefit, why now, what to look for)
- "confidence": 0.0-1.0

Return a JSON object with key "events" containing an array. If no clear convergence, return {"events": []}.`;

  try {
    const res = await fetch(`${forgeUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${forgeKey}` },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '{"events":[]}';
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    const events: any[] = parsed.events || [];
    return events.map((e: any) => ({
      geography,
      signalType: e.signal_type || "other",
      totalCapital: flows.reduce((sum, f) => sum + (f.amount || 0), 0),
      thesisSeed: e.thesis_seed || "",
      confidence: typeof e.confidence === "number" ? e.confidence : 0.7,
    }));
  } catch {
    return [];
  }
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

async function persistFlows(flows: ClassifiedFlow[]): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const ids: number[] = [];
  for (const f of flows) {
    try {
      const result = await db.execute(
        sql`INSERT INTO capital_flows (source, entity, amount, geography, category, flow_date, raw_title, source_url, confidence)
            VALUES (${f.source}, ${f.entity.slice(0, 512)}, ${f.amount}, ${f.geography}, ${f.category}, ${f.flowDate}, ${(f.rawTitle || "").slice(0, 1000)}, ${(f.sourceUrl || "").slice(0, 1024)}, ${f.confidence})`
      ) as any;
      const insertId = result[0]?.insertId ?? result?.insertId;
      if (insertId) ids.push(insertId);
    } catch {
      // Skip duplicates or errors
    }
  }
  return ids;
}

async function persistConvergence(event: ConvergenceEvent): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.execute(
      sql`INSERT INTO convergence_events (geography, signal_type, flow_ids, total_capital, thesis_seed, confidence, window_days)
          VALUES (${event.geography}, ${event.signalType}, ${JSON.stringify(event.flowIds)}, ${event.totalCapital}, ${event.thesisSeed}, ${event.confidence}, 180)`
    ) as any;
    return result[0]?.insertId ?? result?.insertId ?? null;
  } catch {
    return null;
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function getStateCode(geography: string): string {
  const map: Record<string, string> = {
    Atlanta: "GA", Georgia: "GA", GA: "GA",
    Miami: "FL", Florida: "FL", FL: "FL", "Fort Lauderdale": "FL", FLL: "FL",
    "New York": "NY", NYC: "NY", NY: "NY",
    Texas: "TX", Dallas: "TX", Houston: "TX", TX: "TX",
    California: "CA", "Los Angeles": "CA", "San Francisco": "CA", CA: "CA",
    Chicago: "IL", Illinois: "IL", IL: "IL",
    Charlotte: "NC", "North Carolina": "NC", NC: "NC",
    Phoenix: "AZ", Arizona: "AZ", AZ: "AZ",
    Denver: "CO", Colorado: "CO", CO: "CO",
    Nashville: "TN", Tennessee: "TN", TN: "TN",
    Washington: "DC", DC: "DC",
  };
  for (const [key, code] of Object.entries(map)) {
    if (geography.includes(key)) return code;
  }
  return "";
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

// ─── tRPC Router ──────────────────────────────────────────────────────────────

export const tideRouter = router({
  /**
   * Run the full TIDE pipeline for a geography:
   * SCOUT → CLASSIFY → PERSIST → LINK → PERSIST CONVERGENCE
   */
  scan: protectedProcedure
    .input(z.object({ geography: z.string().min(2).max(128) }))
    .mutation(async ({ input }) => {
      const { geography } = input;

      // Phase 1: TIDE-SCOUT — fetch raw flows from 3 sources in parallel
      const [usaFlows, fedFlows, fecFlows] = await Promise.all([
        scoutUSASpending(geography),
        scoutFederalRegister(geography),
        scoutFEC(geography),
      ]);
      const rawFlows = [...usaFlows, ...fedFlows, ...fecFlows];

      if (rawFlows.length === 0) {
        return {
          flowsFound: 0,
          convergenceEvents: 0,
          message: "No flows found for this geography. Try a state name (e.g. 'Georgia') or major city.",
        };
      }

      // Phase 2: TIDE-CLASSIFIER — classify each flow
      const classifiedFlows = await classifyFlows(rawFlows);

      // Phase 3: Persist flows to DB
      const flowIds = await persistFlows(classifiedFlows);
      const persistedFlows = classifiedFlows
        .map((f, i) => ({ ...f, id: flowIds[i] || 0 }))
        .filter((f) => f.id > 0);

      // Phase 4: TIDE-LINKER — detect convergence events
      const convergenceEvents = await detectConvergence(persistedFlows, geography);

      // Phase 5: Persist convergence events
      let savedConvergence = 0;
      for (const event of convergenceEvents) {
        const eventWithIds: ConvergenceEvent = { ...event, flowIds: persistedFlows.map((f) => f.id) };
        const id = await persistConvergence(eventWithIds);
        if (id) savedConvergence++;
      }

      return {
        flowsFound: persistedFlows.length,
        convergenceEvents: savedConvergence,
        message: `TIDE scan complete: ${persistedFlows.length} flows classified, ${savedConvergence} convergence events detected.`,
      };
    }),

  /** List classified capital flows with optional filters */
  listFlows: protectedProcedure
    .input(z.object({
      geography: z.string().optional(),
      category: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      // Build dynamic query
      let baseQuery = `SELECT * FROM capital_flows WHERE 1=1`;
      const clauses: string[] = [];
      if (input.geography) clauses.push(`geography LIKE '%${input.geography.replace(/'/g, "''")}%'`);
      if (input.category) clauses.push(`category = '${input.category.replace(/'/g, "''")}'`);
      const whereClause = clauses.length > 0 ? " AND " + clauses.join(" AND ") : "";
      const fullQuery = `${baseQuery}${whereClause} ORDER BY flow_date DESC, confidence DESC LIMIT ${input.limit}`;
      const rows = await db.execute(sql.raw(fullQuery)) as any;
      return (rows[0] as any[]) || [];
    }),

  /** List convergence events */
  listConvergence: protectedProcedure
    .input(z.object({
      geography: z.string().optional(),
      status: z.enum(["active", "archived", "converted_to_thesis"]).optional().default("active"),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const statusSafe = input.status.replace(/'/g, "''");
      let baseQuery = `SELECT * FROM convergence_events WHERE status = '${statusSafe}'`;
      if (input.geography) {
        baseQuery += ` AND geography LIKE '%${input.geography.replace(/'/g, "''")}%'`;
      }
      baseQuery += ` ORDER BY confidence DESC, created_at DESC LIMIT ${input.limit}`;
      const rows = await db.execute(sql.raw(baseQuery)) as any;
      return ((rows[0] as any[]) || []).map((r: any) => ({
        ...r,
        flow_ids: typeof r.flow_ids === "string" ? JSON.parse(r.flow_ids) : (r.flow_ids || []),
      }));
    }),

  /** Log a TIDE prediction for track record */
  logPrediction: protectedProcedure
    .input(z.object({
      convergenceEventId: z.number().optional(),
      claim: z.string().min(10).max(2000),
      geography: z.string().min(2).max(128),
      category: z.string().min(2).max(128),
      confidence: z.number().min(0).max(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.execute(
        sql`INSERT INTO tide_predictions (convergence_event_id, claim, geography, category, confidence, user_id)
            VALUES (${input.convergenceEventId ?? null}, ${input.claim}, ${input.geography}, ${input.category}, ${input.confidence}, ${ctx.user.id})`
      );
      return { success: true };
    }),

  /** List prediction track record */
  listPredictions: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(30) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.execute(
        sql`SELECT * FROM tide_predictions WHERE user_id = ${ctx.user.id} ORDER BY predicted_at DESC LIMIT ${input.limit}`
      ) as any;
      return (rows[0] as any[]) || [];
    }),

  /** Update prediction outcome */
  updateOutcome: protectedProcedure
    .input(z.object({
      id: z.number(),
      outcome: z.enum(["confirmed", "disconfirmed", "pending"]),
      outcomeNote: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.execute(
        sql`UPDATE tide_predictions SET outcome = ${input.outcome}, outcome_note = ${input.outcomeNote ?? null}, outcome_at = NOW() WHERE id = ${input.id} AND user_id = ${ctx.user.id}`
      );
      return { success: true };
    }),

  /** Archive a convergence event */
  archiveConvergence: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.execute(sql`UPDATE convergence_events SET status = 'archived' WHERE id = ${input.id}`);
      return { success: true };
    }),

  /** Convert convergence event to thesis seed */
  convertToThesis: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const rows = await db.execute(
        sql`SELECT * FROM convergence_events WHERE id = ${input.id}`
      ) as any;
      const event = ((rows[0] as any[]) || [])[0];
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Convergence event not found" });
      await db.execute(
        sql`UPDATE convergence_events SET status = 'converted_to_thesis' WHERE id = ${input.id}`
      );
      return { thesisSeed: event.thesis_seed || "", geography: event.geography, signalType: event.signal_type };
    }),
});
