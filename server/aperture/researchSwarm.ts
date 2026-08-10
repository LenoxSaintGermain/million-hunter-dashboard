/**
 * Research swarm — per-candidate specialist passes.
 *
 * Each candidate gets four specialist passes: fundamentals, catalyst, macro,
 * and technical. Each pass writes facts to the security_facts ledger via
 * collectSecurityFacts, then runs a targeted Sonar query for the pass-specific
 * signals that providers cannot supply (narrative catalysts, macro linkages,
 * technical regime). Sonar results are stored as "modeled" facts with the
 * citation URL as sourceUrl.
 *
 * Concurrency is bounded: too many parallel Sonar calls burn quota and produce
 * rate-limit errors that look like missing data. The default is 4 concurrent
 * symbols, each with sequential passes.
 *
 * The swarm never throws. A symbol that fails all passes ends up with an empty
 * ledger — the memo generator will skip it and say so, which is the correct
 * outcome.
 */
import { runResearch } from "../deepResearch";
import { recordFacts, type Fact } from "./facts";
import { collectSecurityFacts } from "./providers/index";

export type PassKind = "fundamentals" | "catalyst" | "macro" | "technical";

export interface SwarmResult {
  symbol: string;
  passesRun: PassKind[];
  passesFailed: Array<{ pass: PassKind; reason: string }>;
  factsWritten: number;
}

export interface SwarmOpts {
  /** Max symbols processed in parallel. Default 4. */
  concurrency?: number;
  /** Which passes to run. Default: all four. */
  passes?: PassKind[];
  /** Injected for tests. */
  research?: (key: string, query: string) => Promise<{ content: string; citations: string[] }>;
  /** Skip provider collection (useful when facts already in ledger). */
  skipProviders?: boolean;
}

// ── Sonar query builders ──────────────────────────────────────────────────────

function fundamentalsQuery(symbol: string): string {
  return `${symbol} stock: revenue, gross margin, operating income, free cash flow, debt-to-equity, P/E ratio, forward P/E, EV/EBITDA, revenue growth YoY, earnings per share (EPS), analyst consensus rating. Return only verified figures with sources.`;
}

function catalystQuery(symbol: string): string {
  return `${symbol} stock: upcoming catalysts, product launches, regulatory decisions, earnings dates, M&A activity, management changes, contract wins, or macro events that could materially move the stock in the next 6-12 months. Cite sources.`;
}

function macroQuery(symbol: string): string {
  return `How does ${symbol} stock correlate with macro factors: interest rates, inflation, USD strength, commodity prices, credit spreads? What macro regime is most favorable or adverse? Cite sources.`;
}

function technicalQuery(symbol: string): string {
  return `${symbol} stock: 52-week high/low, 200-day moving average, RSI, current trend regime (uptrend/downtrend/range), key support and resistance levels, recent volume trend. Cite sources.`;
}

const PASS_QUERIES: Record<PassKind, (symbol: string) => string> = {
  fundamentals: fundamentalsQuery,
  catalyst: catalystQuery,
  macro: macroQuery,
  technical: technicalQuery,
};

// ── Fact key prefixes per pass ────────────────────────────────────────────────

const PASS_FACT_PREFIX: Record<PassKind, string> = {
  fundamentals: "sonar_fundamentals",
  catalyst: "sonar_catalyst",
  macro: "sonar_macro",
  technical: "sonar_technical",
};

// ── Single-symbol research ────────────────────────────────────────────────────

async function researchSymbol(
  symbol: string,
  passes: PassKind[],
  research: (key: string, query: string) => Promise<{ content: string; citations: string[] }>,
  skipProviders: boolean,
): Promise<SwarmResult> {
  const result: SwarmResult = {
    symbol,
    passesRun: [],
    passesFailed: [],
    factsWritten: 0,
  };

  // 1. Provider collection (Edgar, FRED, Alpaca, etc.)
  if (!skipProviders) {
    try {
      const collected = await collectSecurityFacts(symbol);
      result.factsWritten += collected.facts.length;
    } catch (e: any) {
      // Non-fatal — providers are best-effort
    }
  }

  // 2. Specialist Sonar passes
  for (const pass of passes) {
    const cacheKey = `aperture:swarm:${pass}:${symbol.toLowerCase()}`;
    const query = PASS_QUERIES[pass](symbol);
    try {
      const res = await research(cacheKey, query);
      if (!res.content?.trim()) {
        result.passesFailed.push({ pass, reason: "empty response" });
        continue;
      }

      // Store the narrative as a single modeled fact so the memo can reference it
      const fact: Fact = {
        factKey: PASS_FACT_PREFIX[pass],
        valueText: res.content.slice(0, 4000), // cap to avoid DB column overflow
        unit: "none",
        basis: "modeled",
        assumption: `Sonar-pro research pass: ${pass}`,
        sourceUrl: res.citations[0] ?? null,
        sourceName: "Perplexity Sonar",
        asOf: Date.now(),
        providerId: "sonar",
      };
      await recordFacts(symbol, [fact]);
      result.factsWritten++;
      result.passesRun.push(pass);
    } catch (e: any) {
      result.passesFailed.push({ pass, reason: String(e?.message ?? e) });
    }
  }

  return result;
}

// ── Bounded concurrency pool ──────────────────────────────────────────────────

async function pool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item !== undefined) await fn(item);
    }
  });
  await Promise.all(workers);
}

// ── Public API ────────────────────────────────────────────────────────────────

async function defaultResearch(key: string, query: string) {
  const r = await runResearch({
    subjectKey: key,
    subjectType: "industry",
    query,
    model: "sonar-pro",
  });
  return { content: r.content ?? "", citations: r.citations ?? [] };
}

/**
 * Run research passes for a list of symbols.
 *
 * Returns one SwarmResult per symbol. Never rejects — failures are captured
 * inside each result so the caller can surface them as named gaps.
 */
export async function runResearchSwarm(
  symbols: string[],
  opts: SwarmOpts = {},
): Promise<SwarmResult[]> {
  const concurrency = opts.concurrency ?? 4;
  const passes = opts.passes ?? (["fundamentals", "catalyst", "macro", "technical"] as PassKind[]);
  const research = opts.research ?? defaultResearch;
  const skipProviders = opts.skipProviders ?? false;

  const results: SwarmResult[] = [];

  await pool(symbols, concurrency, async (symbol) => {
    const r = await researchSymbol(symbol, passes, research, skipProviders);
    results.push(r);
  });

  return results;
}
