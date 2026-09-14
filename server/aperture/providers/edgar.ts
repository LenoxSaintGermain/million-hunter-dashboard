/**
 * SEC EDGAR — free, keyless, and the most authoritative source we have.
 *
 * Uses the company-facts XBRL API, which returns values exactly as filed. Each
 * fact carries the filing's own `end` date as `asOf` and links back to EDGAR, so
 * a memo citing revenue can be traced to the filing that stated it.
 *
 * Flow facts are either a filed annual at its own year end or a derived TTM
 * from compatible FY + current YTD - prior YTD. Never substitute an older FY
 * when a newer reporting period exists. Every input must be filed by ctx.now.
 */
import type { Fact } from "../facts";
import { httpJson, num, unknownFact, type FetchCtx, type ProviderAdapter } from "./types";

const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const FACTS_URL = (cik: string) => `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
const EDGAR_PAGE = (cik: string) => `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-K`;

/** Entity-wide totals only; never sum alternatives or bridge across concepts.
 * Companyfacts supplies non-custom, entire-entity contexts (SEC API contract).
 * Concept order breaks ties at the SAME period end, not across periods.
 */
const CONCEPTS: Array<{ key: string; concepts: string[]; unit: string }> = [
  { key: "revenue_ttm", concepts: ["RevenueFromContractWithCustomerExcludingAssessedTax", "RevenueFromContractWithCustomerIncludingAssessedTax", "Revenues", "SalesRevenueNet"], unit: "USD" },
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

/** Balance-sheet concepts are point-in-time and carry no period start. */
const INSTANT_KEYS = new Set(["total_assets", "total_liabilities", "cash_and_equivalents", "long_term_debt", "shares_outstanding"]);

const DAY_MS = 86_400_000;
function dateMs(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : null;
}

/** A filed period's length in days; null for an instant (balance) fact. */
function periodDays(u: any): number | null {
  if (!u?.start || !u?.end) return null;
  const start = dateMs(u.start);
  const end = dateMs(u.end);
  if (start == null || end == null) return null;
  return (end - start) / DAY_MS;
}

/**
 * Most recent annual datapoint for a concept.
 *
 * A 10-K contains quarterly rows alongside the annual one, and some concepts
 * hold nothing but a single old 10-Q. Selecting on form and period end alone
 * accepted both: PRIM's revenue came back as a 91-day figure and EME's as a
 * quarter filed in 2018. Period length is what separates an annual flow from a
 * quarter, so require it, and return nothing rather than falling back to an
 * arbitrary row — a missing fact is recoverable, a wrong one is not.
 */
function latestAnnual(factsForConcept: any, unit: string, opts: { instant: boolean }): { value: number; end: string; form?: string; accn?: string } | null {
  const units = factsForConcept?.units?.[unit];
  if (!Array.isArray(units) || !units.length) return null;
  const qualifying = units.filter((u: any) => {
    if (!u?.end || num(u.val) == null) return false;
    const days = periodDays(u);
    // Allow a filed year to run slightly short or long (52/53-week retailers).
    return opts.instant ? u.start == null && dateMs(u.end) != null : days != null && days >= 330 && days <= 400;
  });
  if (!qualifying.length) return null;
  const filed10K = qualifying.filter((u: any) => u.fp === "FY" && u.form && /10-K/.test(u.form));
  const pool = filed10K.length ? filed10K : qualifying;
  const sorted = pool.slice().sort((a: any, b: any) => String(a.end).localeCompare(String(b.end)));
  const last = sorted[sorted.length - 1];
  const value = num(last?.val);
  if (value == null || !last?.end) return null;
  return { value, end: last.end, form: last.form, accn: last.accn };
}

/**
 * The freshest qualifying concept wins. First-hit-wins let a concept holding
 * one 2018 quarter outrank a sibling concept holding the current annual.
 */
function selectConceptHit(gaap: any, dei: any, concepts: string[], unit: string, instant: boolean) {
  let best: ReturnType<typeof latestAnnual> = null;
  for (const c of concepts) {
    const hit = latestAnnual(gaap?.[c] ?? dei?.[c], unit, { instant });
    if (hit && (!best || String(hit.end) > String(best.end))) best = hit;
  }
  return best;
}

type EdgarRow = {
  val: number;
  start?: string;
  end: string;
  filed: string;
  form: string;
  accn?: string;
};
type CurrentHit = {
  value: number;
  end: string;
  concept: string;
  rows: EdgarRow[];
  derived: boolean;
};

/** SEC supplies filing DAYS, not acceptance times. Exclude the cutoff day
 * itself: a same-day row could have been filed after an intraday ctx.now.
 * Missing/invalid filing dates cannot establish point-in-time availability.
 * Keep malformed values/starts here so a newly disclosed but unusable flow
 * still prevents silently falling back to an older annual.
 */
function disclosedRows(concept: any, unit: string, now: number): EdgarRow[] {
  const rows = concept?.units?.[unit];
  if (!Array.isArray(rows) || !Number.isFinite(now)) return [];
  const cutoffDay = Math.floor(now / DAY_MS) * DAY_MS;
  return rows.filter((r: any) => {
    const end = dateMs(r?.end);
    const filed = dateMs(r?.filed);
    return end != null && filed != null && end <= filed && filed < cutoffDay
      && /^(10-K|10-Q|20-F|40-F|6-K)(\/A)?$/.test(r?.form)
      && r.segment == null && r.dimensions == null;
  });
}

/** Resolve repetitions/restatements by period, then filing date, not API order.
 * Conflicting values in the latest filing-day cohort are ambiguous; do not
 * choose an arbitrary one or resurrect a superseded value.
 */
function resolvedRows(rows: EdgarRow[]): EdgarRow[] {
  const groups = new Map<string, EdgarRow[]>();
  for (const row of rows) {
    const key = `${row.start ?? "instant"}/${row.end}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const out: EdgarRow[] = [];
  for (const group of Array.from(groups.values())) {
    const latest = group.reduce((a, b) => a.filed > b.filed ? a : b).filed;
    const cohort = group.filter(r => r.filed === latest);
    if (cohort.some(r => typeof r.val !== "number" || !Number.isFinite(r.val) || r.val !== cohort[0].val)) continue;
    // Identical duplicates may differ only by accession; stabilize provenance.
    out.push(cohort.slice().sort((a, b) => String(a.accn ?? "").localeCompare(String(b.accn ?? "")))[0]);
  }
  return out;
}

const annualPeriod = (r: EdgarRow) => {
  const days = periodDays(r);
  return days != null && days >= 330 && days <= 400;
};

function compatibleBridge(fy: EdgarRow, current: EdgarRow, prior: EdgarRow): boolean {
  const days = periodDays(current);
  const priorDays = periodDays(prior);
  if (days == null || priorDays == null || days < 60 || days > 300 || Math.abs(days - priorDays) > 7) return false;
  if (dateMs(current.start)! !== dateMs(fy.end)! + DAY_MS || prior.start !== fy.start || prior.end >= fy.end) return false;
  // Corresponding fiscal cutoffs may shift up to a week for 52/53-week years.
  // Do not use SEC fy/fp/frame: comparative rows inherit the filing's labels.
  const trailingDays = (dateMs(current.end)! - dateMs(prior.end)!) / DAY_MS;
  // A calendar year (365/366 days) +/- one week; do not compound shifts
  // into a 54-week "TTM" even when the individual YTD lengths look close.
  return trailingDays >= 358 && trailingDays <= 373;
}

function flowHit(rows: EdgarRow[], concept: string, targetEnd: string): CurrentHit | null {
  const resolved = resolvedRows(rows);
  const annuals = resolved.filter(annualPeriod);
  const direct = annuals.filter(r => r.end === targetEnd);
  // Distinct annual starts for the same end are not interchangeable periods.
  if (direct.length === 1) return { value: direct[0].val, end: targetEnd, concept, rows: direct, derived: false };
  if (direct.length > 1) return null;

  const candidates: CurrentHit[] = [];
  for (const current of resolved.filter(r => r.end === targetEnd)) {
    for (const fy of annuals) {
      for (const prior of resolved.filter(r => r.start === fy.start && r.end < fy.end)) {
        if (!compatibleBridge(fy, current, prior)) continue;
        const value = fy.val + current.val - prior.val;
        if (Number.isFinite(value)) candidates.push({ value, end: targetEnd, concept, rows: [fy, current, prior], derived: true });
      }
    }
  }
  // Multiple possible fiscal bridges are an evidence gap, even if sums agree.
  return candidates.length === 1 ? candidates[0] : null;
}

function filingUrl(cik: string, row: EdgarRow): string {
  return row.accn && /^\d{10}-\d{2}-\d{6}$/.test(row.accn)
    ? `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${row.accn.replace(/-/g, "")}/${row.accn}-index.html`
    : EDGAR_PAGE(cik);
}

function bridgeAssumption(hit: CurrentHit, unit: string, cik: string): string {
  const [fy, current, prior] = hit.rows;
  const describe = (r: EdgarRow) => `${r.val} ${unit} [${r.start} through ${r.end}; ${r.form} filed ${r.filed}; accession ${r.accn ?? "unavailable"}; ${filingUrl(cik, r)}]`;
  return `Derived TTM: FY + current YTD - prior YTD, using only ${hit.concept} in ${unit}. `
    + `FY ${describe(fy)} + current YTD ${describe(current)} - prior YTD ${describe(prior)} = ${hit.value} ${unit}. `
    + "Assumes comparable accounting scope within the same entity-wide concept; contiguous fiscal periods and corresponding YTD lengths (up to seven days of 52/53-week calendar variation). Not an annualized quarter or a directly filed TTM.";
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

    const rowsByConcept = new Map<string, EdgarRow[]>();
    let latestReportingEnd = "";
    for (const { key, concepts, unit } of CONCEPTS) {
      for (const concept of concepts) {
        const rows = disclosedRows(gaap[concept] ?? dei[concept], unit, ctx.now);
        rowsByConcept.set(concept, rows);
        // Financial-statement balances also establish that a newer reporting
        // period exists. Cover-page share counts are dated independently.
        if (key !== "shares_outstanding") {
          for (const row of rows) {
            const reportingRow = INSTANT_KEYS.has(key) ? row.start == null : row.start != null;
            if (reportingRow && row.end > latestReportingEnd) latestReportingEnd = row.end;
          }
        }
      }
    }

    for (const { key, concepts, unit } of CONCEPTS) {
      const instant = INSTANT_KEYS.has(key);
      let hit: CurrentHit | null = null;
      for (const concept of concepts) {
        const rows = rowsByConcept.get(concept) ?? [];
        if (instant) {
          const instants = rows.filter(r => r.start == null);
          const latestEnd = instants.reduce((end, r) => r.end > end ? r.end : end, "");
          const row = resolvedRows(instants).find(r => r.end === latestEnd);
          if (row && (!hit || row.end > hit.end)) hit = { value: row.val, end: row.end, concept, rows: [row], derived: false };
        } else {
          hit = flowHit(rows, concept, latestReportingEnd);
          if (hit) break;
        }
      }
      if (!hit) {
        out.push(unknownFact(key, "edgar", instant ? "SEC EDGAR" : `SEC EDGAR — no compatible annual/TTM inputs${latestReportingEnd ? ` for ${latestReportingEnd}` : ""} available by filing cutoff`));
        continue;
      }
      const sourceRow = hit.derived ? hit.rows[1] : hit.rows[0];
      const periodLabel = instant ? "instant" : hit.derived ? "derived TTM" : "annual (TTM at fiscal year end only)";
      out.push({
        factKey: key,
        valueNum: hit.value,
        unit: unit === "shares" ? "shares" : "usd",
        basis: hit.derived ? "modeled" : "verified",
        ...(hit.derived ? { assumption: bridgeAssumption(hit, unit, cik) } : {}),
        providerId: "edgar",
        sourceName: `SEC EDGAR ${sourceRow.form} ${periodLabel} through ${hit.end} (${data.entityName ?? symbol}; ${hit.concept})`,
        sourceUrl: filingUrl(cik, sourceRow),
        asOf: dateMs(hit.end),
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
export const __edgarInternals = { latestAnnual, selectConceptHit, periodDays, CONCEPTS, resetTickerCache: () => { tickerCache = null; } };
