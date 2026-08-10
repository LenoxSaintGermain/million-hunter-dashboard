/**
 * The fact ledger — Capital Aperture's honesty contract, in code.
 *
 * Rule: no number reaches a score, a strategy, or a memo unless a row exists in
 * `security_facts` to back it. Providers write facts; everything downstream reads
 * facts. A model is never asked for a figure, only for prose about figures it has
 * been handed.
 *
 * This exists because the same failure has already happened three times in the
 * property engine — offMarket.hunt inventing businesses, Market Scan prompting
 * for "realistic listings", convertToDeal fabricating cash flow. Each time a
 * model was asked to produce plausible data and the result was stored as sourced
 * fact. Prompt wording did not prevent it; structure does.
 *
 * `basis` mirrors server/scoring/economics.ts:
 *   verified — the source states this value
 *   modeled  — derived from an assumption, which must be recorded alongside it
 *   unknown  — the input is missing; NO number is invented
 */
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "../db";
import { securityFacts, type SecurityFact } from "../../drizzle/schema";

export type FactBasis = "verified" | "modeled" | "unknown";

/**
 * Units are explicit because "0.44" and "44" are the same margin and a silent
 * mix-up is the classic way a portfolio number ends up 100x wrong.
 *   usd    — a dollar amount (NOT cents; cents are for stored money columns)
 *   ratio  — 0..1
 *   pct    — 0..100
 *   x      — a multiple
 *   shares / days / count / none
 */
export type FactUnit = "usd" | "ratio" | "pct" | "x" | "shares" | "days" | "count" | "none";

/** What a provider returns, before it is persisted. */
export interface Fact {
  factKey: string;
  valueNum?: number | null;
  valueText?: string | null;
  unit?: FactUnit;
  basis: FactBasis;
  /** Required when basis === "modeled". */
  assumption?: string | null;
  providerId: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
  /** When the SOURCE says this was true — not when we fetched it. */
  asOf?: number | null;
  /** TTL. Null means it does not go stale (e.g. a filed historical figure). */
  ttlMs?: number | null;
}

export class FactContractError extends Error {}

/**
 * The write-time gate. A fact that cannot say where it came from does not get
 * stored, so downstream code never has to wonder whether a value is real.
 */
export function assertFactWritable(symbol: string, f: Fact): void {
  const where = `${symbol}.${f.factKey}`;
  if (!f.factKey) throw new FactContractError("a fact needs a factKey");
  if (!f.providerId) throw new FactContractError(`${where}: a fact needs a providerId`);

  if (f.basis === "unknown") {
    if (f.valueNum != null || (f.valueText != null && f.valueText !== "")) {
      throw new FactContractError(
        `${where}: basis "unknown" must carry NO value — a missing input stays null, it is not estimated`,
      );
    }
    return;
  }

  const hasValue = f.valueNum != null || (f.valueText != null && f.valueText !== "");
  if (!hasValue) {
    throw new FactContractError(`${where}: basis "${f.basis}" needs a value (use basis "unknown" instead)`);
  }
  if (f.valueNum != null && !Number.isFinite(f.valueNum)) {
    throw new FactContractError(`${where}: valueNum is not a finite number`);
  }
  if (f.basis === "modeled" && !f.assumption) {
    throw new FactContractError(
      `${where}: basis "modeled" must record the assumption it depends on — the UI renders it inline`,
    );
  }
  if (f.basis === "verified" && !f.sourceUrl && !f.sourceName) {
    throw new FactContractError(
      `${where}: basis "verified" means a source stated it, so it needs a sourceName or sourceUrl`,
    );
  }
}

/** Normalise a symbol so "nvda " and "NVDA" are the same security. */
export const normSymbol = (s: string): string => s.trim().toUpperCase();

/**
 * Persist facts for one symbol. Facts are append-only: an older row for the same
 * (symbol, factKey) is kept so a memo written last week still traces to what was
 * true then. Readers take the freshest unexpired row.
 */
export async function recordFacts(symbol: string, facts: Fact[], now = Date.now()): Promise<number> {
  const sym = normSymbol(symbol);
  for (const f of facts) assertFactWritable(sym, f);

  const db = await getDb();
  if (!db) return 0;
  if (!facts.length) return 0;

  await db.insert(securityFacts).values(
    facts.map((f) => ({
      symbol: sym,
      factKey: f.factKey,
      valueNum: f.valueNum ?? null,
      valueText: f.valueText ?? null,
      unit: f.unit ?? "none",
      basis: f.basis,
      assumption: f.assumption ?? null,
      providerId: f.providerId,
      sourceName: f.sourceName ?? null,
      sourceUrl: f.sourceUrl ?? null,
      asOf: f.asOf ?? null,
      fetchedAt: now,
      expiresAt: f.ttlMs == null ? null : now + f.ttlMs,
    })),
  );
  return facts.length;
}

/** Freshest unexpired fact per factKey, for one or more symbols. */
export async function getFacts(symbols: string | string[], now = Date.now()): Promise<SecurityFact[]> {
  const list = (Array.isArray(symbols) ? symbols : [symbols]).map(normSymbol);
  const db = await getDb();
  if (!db || !list.length) return [];

  const rows = await db
    .select()
    .from(securityFacts)
    .where(
      and(
        inArray(securityFacts.symbol, list),
        or(isNull(securityFacts.expiresAt), gt(securityFacts.expiresAt, now)),
      ),
    );

  return freshestPerKey(rows);
}

/** Keep one row per (symbol, factKey) — the most recently fetched. */
export function freshestPerKey(rows: SecurityFact[]): SecurityFact[] {
  const best = new Map<string, SecurityFact>();
  for (const r of rows) {
    const k = `${r.symbol}::${r.factKey}`;
    const prev = best.get(k);
    if (!prev || (r.fetchedAt ?? 0) > (prev.fetchedAt ?? 0)) best.set(k, r);
  }
  return Array.from(best.values());
}

/** Facts a source explicitly could not supply — rendered as named gaps, not nulls. */
export function unknownGaps(rows: SecurityFact[]): SecurityFact[] {
  return rows.filter((r) => r.basis === "unknown");
}

/**
 * The ONLY thing a memo prompt is allowed to see. Rendering facts as an explicit
 * ledger — with basis and source on every line — is what makes it reasonable to
 * tell the model "anything not in this list does not exist".
 */
export function factsToPromptBlock(rows: SecurityFact[]): string {
  if (!rows.length) return "(no facts available for this security)";
  const fmt = (r: SecurityFact) => {
    if (r.basis === "unknown") return "UNKNOWN — no source states this";
    const v = r.valueNum != null ? String(r.valueNum) : String(r.valueText ?? "");
    const unit = r.unit && r.unit !== "none" ? ` ${r.unit}` : "";
    const basis = r.basis === "modeled" ? ` [MODELED: ${r.assumption ?? "assumption not recorded"}]` : "";
    const src = r.sourceName ? ` (${r.sourceName}${r.asOf ? `, as of ${new Date(r.asOf).toISOString().slice(0, 10)}` : ""})` : "";
    return `${v}${unit}${basis}${src}`;
  };
  return rows
    .slice()
    .sort((a, b) => a.factKey.localeCompare(b.factKey))
    .map((r) => `- ${r.factKey}: ${fmt(r)}`)
    .join("\n");
}
