/**
 * Post-entry monitoring — catalyst and thesis-invalidation checks.
 *
 * Design contract:
 *   1. Checks are sourced from Sonar with citations. A check that fires is surfaced
 *      to the operator; it does not trigger any autonomous action.
 *   2. Four check types: catalyst, thesis_invalidation, earnings, macro.
 *   3. Each check writes a monitoring_checks row regardless of whether it flags.
 *      Only a current, well-formed, cited response may produce a clear state.
 *   4. Flagged checks are returned to the caller for immediate surfacing.
 *   5. The caller (router or heartbeat) decides cadence. This module is pure logic.
 */
import { eq, and, desc, lt, or } from "drizzle-orm";
import { getDb } from "../db";
import {
  monitoringChecks, apertureCandidates, apertureRuns,
  type MonitoringCheck,
} from "../../drizzle/schema";
import {
  MONITORING_FRESHNESS_MS,
  UNKNOWN_MONITORING_PREFIX,
  monitoringReviewState,
  validMonitoringCitations,
} from "../../shared/monitoringState";

export { monitoringReviewState } from "../../shared/monitoringState";

const SONAR_BASE = "https://api.perplexity.ai";

type CheckType = "catalyst" | "thesis_invalidation" | "earnings" | "macro";

interface CheckResult {
  checkType: CheckType;
  finding: string | null;
  flagged: boolean;
  citations: string[];
}

// ── Sonar query ───────────────────────────────────────────────────────────────

async function sonarCheck(prompt: string): Promise<{ content: string; citations: string[] }> {
  const key = process.env.SONAR_API_KEY;
  if (!key) return { content: "", citations: [] };

  const res = await fetch(`${SONAR_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 512,
      return_citations: true,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return { content: "", citations: [] };
  const data: any = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content ?? "";
  const citations: string[] = (data?.citations ?? []).filter((c: unknown) => typeof c === "string");
  return { content, citations };
}

// ── Per-check prompts ─────────────────────────────────────────────────────────

function catalystPrompt(symbol: string, thesisSummary: string): string {
  return `You are monitoring a paper position in ${symbol} for an investor whose thesis is: "${thesisSummary}".

Search for news from the last 7 days. Has anything happened that CONFIRMS or ACCELERATES the thesis? Examples: regulatory approval, contract win, earnings beat, partnership, product launch, analyst upgrade.

Reply in two parts:
FINDING: One sentence. If nothing material, say "No material catalyst found."
FLAGGED: YES or NO — flag YES only if there is a concrete, sourced catalyst event.`;
}

function thesisInvalidationPrompt(symbol: string, thesisSummary: string): string {
  return `You are monitoring a paper position in ${symbol} for an investor whose thesis is: "${thesisSummary}".

Search for news from the last 7 days. Has anything happened that CONTRADICTS or INVALIDATES the thesis? Examples: loss of key customer, regulatory block, earnings miss on the core thesis driver, management departure, competitor breakthrough.

Reply in two parts:
FINDING: One sentence. If nothing material, say "No thesis-invalidating event found."
FLAGGED: YES or NO — flag YES only if there is a concrete, sourced event that undermines the thesis.`;
}

function earningsPrompt(symbol: string): string {
  return `Search for ${symbol} earnings announcements in the next 14 days or results from the last 7 days.

Reply in two parts:
FINDING: One sentence with the date and whether it is upcoming or already reported. If none, say "No earnings event in window."
FLAGGED: YES or NO — flag YES if there is an earnings event within the window.`;
}

function macroPrompt(symbol: string, thesisSummary: string): string {
  return `You are monitoring a paper position in ${symbol} for an investor whose thesis is: "${thesisSummary}".

Search for macro or sector-level news from the last 7 days that could materially affect this position. Examples: Fed rate decision, sector rotation, commodity price shock, geopolitical event affecting the supply chain.

Reply in two parts:
FINDING: One sentence. If nothing material, say "No material macro signal found."
FLAGGED: YES or NO — flag YES only if there is a concrete macro event with direct sector relevance.`;
}

// ── Parse Sonar reply ─────────────────────────────────────────────────────────

export function parseMonitoringProviderOutput(
  content: string,
  checkType: CheckType,
  citations: unknown,
): Omit<CheckResult, "citations"> {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  let finding: string | null = null;
  let flagged: boolean | null = null;

  for (const line of lines) {
    if (line.toUpperCase().startsWith("FINDING:")) {
      finding = line.slice("FINDING:".length).trim() || null;
    }
    if (line.toUpperCase().startsWith("FLAGGED:")) {
      const match = line.match(/^FLAGGED:\s*(YES|NO)\s*$/i);
      flagged = match ? match[1]!.toUpperCase() === "YES" : null;
    }
  }

  const validCitations = validMonitoringCitations(citations);
  const staleClaim = /\b(stale|outdated|unable to verify current|cannot verify current|no access to current)\b/i.test(content);
  if (!finding || flagged == null) {
    return {
      checkType,
      finding: `${UNKNOWN_MONITORING_PREFIX} Provider output did not contain a valid FINDING and FLAGGED decision.`,
      flagged: true,
    };
  }
  if (validCitations.length === 0) {
    return {
      checkType,
      finding: `${UNKNOWN_MONITORING_PREFIX} Provider output was not backed by a source citation.`,
      flagged: true,
    };
  }
  if (staleClaim) {
    return {
      checkType,
      finding: `${UNKNOWN_MONITORING_PREFIX} Provider output could not establish current evidence.`,
      flagged: true,
    };
  }

  return { checkType, finding, flagged };
}

// ── Run checks for one candidate ─────────────────────────────────────────────

export async function runMonitoringChecks(
  runId: number,
  candidateId: number,
  symbol: string,
  thesisSummary: string,
  checkTypes: CheckType[] = ["catalyst", "thesis_invalidation", "earnings", "macro"],
): Promise<MonitoringCheck[]> {
  const db = await getDb();
  if (!db) throw new Error("database unavailable");

  const results: MonitoringCheck[] = [];
  const now = Date.now();

  for (const checkType of checkTypes) {
    let prompt: string;
    switch (checkType) {
      case "catalyst": prompt = catalystPrompt(symbol, thesisSummary); break;
      case "thesis_invalidation": prompt = thesisInvalidationPrompt(symbol, thesisSummary); break;
      case "earnings": prompt = earningsPrompt(symbol); break;
      case "macro": prompt = macroPrompt(symbol, thesisSummary); break;
    }

    const { content, citations } = await sonarCheck(prompt);
    const validCitations = validMonitoringCitations(citations);
    const parsed = parseMonitoringProviderOutput(content, checkType, validCitations);

    const [result] = await db.insert(monitoringChecks).values({
      runId,
      candidateId,
      symbol,
      checkType,
      finding: parsed.finding,
      flagged: parsed.flagged,
      citations: validCitations,
      checkedAt: now,
      createdAt: now,
    });

    const rows = await db.select().from(monitoringChecks)
      .where(eq(monitoringChecks.id, (result as any).insertId))
      .limit(1);
    if (rows[0]) results.push(rows[0]);
  }

  return results;
}

// ── Get recent checks for one candidate ───────────────────────────────────────

export async function getMonitoringChecks(runId: number, candidateId: number): Promise<MonitoringCheck[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(monitoringChecks)
    .where(and(
      eq(monitoringChecks.runId, runId),
      eq(monitoringChecks.candidateId, candidateId),
    ))
    .orderBy(desc(monitoringChecks.checkedAt));
}

export async function getFlaggedChecks(runId: number): Promise<MonitoringCheck[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(monitoringChecks)
    .where(and(
      eq(monitoringChecks.runId, runId),
      or(
        eq(monitoringChecks.flagged, true),
        lt(monitoringChecks.checkedAt, Date.now() - MONITORING_FRESHNESS_MS),
      ),
    ))
    .orderBy(desc(monitoringChecks.checkedAt));
}
