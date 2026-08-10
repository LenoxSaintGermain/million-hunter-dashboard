/**
 * SEC EDGAR — free, keyless, and the most authoritative source we have.
 *
 * Uses the company-facts XBRL API, which returns values exactly as filed. Each
 * fact carries the filing's own `end` date as `asOf` and links back to EDGAR, so
 * a memo citing revenue can be traced to the filing that stated it.
 *
 * Company facts do not go stale in the usual sense — a filed number stays true
 * for the period it covers — so these are written with a long TTL and their
 * period end date rather than "now".
 */
import type { Fact } from "../facts";
import { httpJson, num, unknownFact, type FetchCtx, type ProviderAdapter } from "./types";

const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const FACTS_URL = (cik: string) => `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
const EDGAR_PAGE = (cik: string) => `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-K`;

/** us-gaap concept → our fact key. Order matters: first hit wins. */
const CONCEPTS: Array<{ key: string; concepts: string[]; unit: string }> = [
  { key: "revenue_ttm", concepts: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"], unit: "USD" },
  { key: "net_income_ttm", concepts: ["NetIncomeLoss"], unit: "USD" },
  { key: "gross_profit_ttm", concepts: ["GrossProfit"], unit: "USD" },
  { key: "operating_income_ttm", concepts: ["OperatingIncomeLoss"], unit: "USD" },
  { key: "total_assets", concepts: ["Assets"], unit: "USD" },
  { key: "total_liabilities", concepts: ["Liabilities"], unit: "USD" },
  { key: "cash_and_equivalents", concepts: ["CashAndCashEquivalentsAtCarryingValue"], unit: "USD" },
  { key: "long_term_debt", concepts: ["LongTermDebtNoncurrent", "LongTermDebt"], unit: "USD" },
  { key: "shares_outstanding", concepts: ["CommonStockSharesOutstanding", "EntityCommonStockSharesOutstanding"], unit: "shares" },
];

let tickerCache: Map<string, string> | null = null;

/** symbol → zero-padded CIK. Cached for the process; the mapping barely moves. */
export async function cikFor(symbol: string, timeoutMs?: number): Promise<string | null> {
  if (!tickerCache) {
    const raw = await httpJson<Record<string, { cik_str: number; ticker: string }>>(TICKERS_URL, { timeoutMs });
    if (!raw) return null;
    tickerCache = new Map();
    for (const row of Object.values(raw)) {
      if (row?.ticker) tickerCache.set(row.ticker.toUpperCase(), String(row.cik_str).padStart(10, "0"));
    }
  }
  return tickerCache.get(symbol.toUpperCase()) ?? null;
}

/** Most recent annual (FY) datapoint for a concept, with its period end. */
function latestAnnual(factsForConcept: any, unit: string): { value: number; end: string; form?: string; accn?: string } | null {
  const units = factsForConcept?.units?.[unit];
  if (!Array.isArray(units) || !units.length) return null;
  const annual = units.filter((u: any) => u.fp === "FY" && u.form && /10-K/.test(u.form));
  const pool = annual.length ? annual : units;
  const sorted = pool.slice().sort((a: any, b: any) => String(a.end).localeCompare(String(b.end)));
  const last = sorted[sorted.length - 1];
  const value = num(last?.val);
  if (value == null || !last?.end) return null;
  return { value, end: last.end, form: last.form, accn: last.accn };
}

export const edgarProvider: ProviderAdapter = {
  id: "edgar",
  label: "SEC EDGAR (XBRL company facts)",
  kind: "security",
  requiredEnv: [], // free and keyless
  provides: CONCEPTS.map((c) => c.key),
  homepage: "https://www.sec.gov/search-filings/edgar-application-programming-interfaces",

  async fetchSecurityFacts(symbol: string, ctx: FetchCtx): Promise<Fact[]> {
    const cik = await cikFor(symbol, ctx.timeoutMs);
    if (!cik) {
      // Not an error — ETFs and foreign issuers legitimately have no CIK here.
      return CONCEPTS.map((c) => unknownFact(c.key, "edgar", "SEC EDGAR"));
    }

    const data = await httpJson<any>(FACTS_URL(cik), { timeoutMs: ctx.timeoutMs });
    if (!data?.facts) return CONCEPTS.map((c) => unknownFact(c.key, "edgar", "SEC EDGAR"));

    const gaap = data.facts["us-gaap"] ?? {};
    const dei = data.facts["dei"] ?? {};
    const out: Fact[] = [];

    for (const { key, concepts, unit } of CONCEPTS) {
      let hit: ReturnType<typeof latestAnnual> = null;
      for (const c of concepts) {
        hit = latestAnnual(gaap[c] ?? dei[c], unit);
        if (hit) break;
      }
      if (!hit) {
        out.push(unknownFact(key, "edgar", "SEC EDGAR"));
        continue;
      }
      out.push({
        factKey: key,
        valueNum: hit.value,
        unit: unit === "shares" ? "shares" : "usd",
        basis: "verified",
        providerId: "edgar",
        sourceName: `SEC EDGAR ${hit.form ?? "filing"} (${data.entityName ?? symbol})`,
        sourceUrl: EDGAR_PAGE(cik),
        asOf: Date.parse(`${hit.end}T00:00:00Z`) || null,
        // A filed figure does not go stale; refresh weekly to pick up new filings.
        ttlMs: 7 * 24 * 60 * 60 * 1000,
      });
    }

    if (data.entityName) {
      out.push({
        factKey: "entity_name",
        valueText: String(data.entityName),
        basis: "verified",
        providerId: "edgar",
        sourceName: "SEC EDGAR",
        sourceUrl: EDGAR_PAGE(cik),
        ttlMs: 30 * 24 * 60 * 60 * 1000,
      });
    }
    return out;
  },
};

/** Exposed for tests. */
export const __edgarInternals = { latestAnnual, CONCEPTS, resetTickerCache: () => { tickerCache = null; } };
