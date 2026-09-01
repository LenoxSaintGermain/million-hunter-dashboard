/**
 * Universe discovery — the aperture itself.
 *
 * A screener answers "which stocks match these filters". This answers a harder
 * question: "which securities express a node of this thesis that the investor's
 * portfolio does not already cover". That is why discovery walks the EXPOSURE
 * TREE rather than a sector list — the whole point is to reach the transformer
 * maker and the uranium miner from a thesis that said "AI infrastructure".
 *
 * Sourcing is Perplexity Sonar with citations, reusing the TTL cache in
 * server/deepResearch.ts. Two rules that keep it honest:
 *   • A ticker with no citation is discarded. The model naming a symbol is not
 *     evidence the symbol exists or does what it says.
 *   • Nothing is silently truncated. Whatever the cap drops is counted and
 *     reported on the run, because a quiet top-N reads as "we looked at
 *     everything" when we did not.
 */
import { runResearch } from "../deepResearch";
import { looseJsonParse } from "../gemini";
import { normSymbol } from "./facts";

export interface DiscoveredSymbol {
  symbol: string;
  name: string | null;
  /** Which exposure node this came from. */
  nodeLabel: string;
  /** Why the source says it belongs to that node. */
  rationale: string | null;
  citations: string[];
}

export interface UniverseResult {
  discovered: DiscoveredSymbol[];
  /** Symbols already held or already planned — excluded from discovery. */
  excludedKnown: string[];
  /** Everything the caps threw away, so the run can say so out loud. */
  droppedNote: string | null;
  nodesQueried: string[];
  nodesFailed: Array<{ node: string; reason: string }>;
}

/** A plausible US ticker. Deliberately strict — junk in here becomes junk facts. */
export function looksLikeTicker(s: unknown): boolean {
  if (typeof s !== "string") return false;
  const t = s.trim().toUpperCase();
  return /^[A-Z]{1,5}(\.[A-Z])?$/.test(t);
}

const PROMPT = (node: string, thesisSummary: string) =>
  `List publicly traded US-listed companies or ETFs whose business gives direct revenue exposure to: "${node}".

Context — the investor's thesis: ${thesisSummary}

Rules:
- Only US-listed securities with a real ticker.
- Prefer companies where this exposure is a MATERIAL part of revenue, not a passing mention.
- Include the occasional supplier, competitor, or adjacent beneficiary — second-order exposure is wanted.
- Do NOT include a company you cannot cite a source for.
- If you can only find one or two, return one or two. Do not pad the list.

Return ONLY a JSON array, max 12 entries:
[{"symbol":"XYZ","name":"Full Company Name","rationale":"one sentence on how it earns from this node"}]`;

/** Summarise the thesis for the discovery prompt without dumping the whole graph. */
export function thesisSummary(beliefs: string[], seek: string[]): string {
  const b = beliefs.slice(0, 3).join("; ");
  const s = seek.slice(0, 3).join("; ");
  return [b && `believes ${b}`, s && `seeking ${s}`].filter(Boolean).join(". ") || "(no thesis detail supplied)";
}

export interface DiscoverOpts {
  /** Max nodes to query — each is one Sonar call. */
  maxNodes?: number;
  /** Max symbols kept overall. */
  maxSymbols?: number;
  /** Injected for tests. */
  research?: (node: string, prompt: string) => Promise<{ content: string; citations: string[] }>;
}

/**
 * An explicitly named research symbol is the operator's requested universe,
 * including when that symbol is already held. The first brief must not replace
 * it with exposure-tree alternatives; those belong in optional follow-up work.
 */
export function operatorDeclaredUniverse(symbols: string[] | null | undefined): UniverseResult | null {
  const normalized = Array.from(new Set((symbols ?? [])
    .map((symbol) => normSymbol(symbol))
    .filter((symbol) => looksLikeTicker(symbol))));
  if (normalized.length === 0) return null;

  return {
    discovered: normalized.map((symbol) => ({
      symbol,
      name: null,
      nodeLabel: "Operator-declared universe",
      rationale: "The operator explicitly named this symbol in the canonical thesis.",
      citations: ["operator-declared://canonical-thesis"],
    })),
    excludedKnown: [],
    droppedNote: "Broad exposure discovery was intentionally deferred because the operator declared the research universe.",
    nodesQueried: ["Operator-declared universe"],
    nodesFailed: [],
  };
}

async function defaultResearch(node: string, prompt: string) {
  const r = await runResearch({
    subjectKey: `aperture:universe:${node.toLowerCase().replace(/\s+/g, "-").slice(0, 120)}`,
    subjectType: "industry",
    query: prompt,
    model: "sonar-pro",
  });
  return { content: r.content ?? "", citations: r.citations ?? [] };
}

/**
 * Walk the exposure tree and find securities for each node.
 *
 * Leaf-ward nodes are queried first: "uranium" finds things "AI adoption" never
 * will, and the broad root nodes are the ones most likely to return names the
 * investor already owns.
 */
export async function discoverUniverse(
  nodes: Array<{ label: string; depth: number }>,
  summary: string,
  known: Set<string>,
  opts: DiscoverOpts = {},
): Promise<UniverseResult> {
  const maxNodes = opts.maxNodes ?? 12;
  const maxSymbols = opts.maxSymbols ?? 150;
  const research = opts.research ?? defaultResearch;

  // Deepest first — specific nodes surface the non-obvious names.
  const ordered = nodes.slice().sort((a, b) => b.depth - a.depth);
  const queried = ordered.slice(0, maxNodes);
  const skippedNodes = ordered.length - queried.length;

  const discovered: DiscoveredSymbol[] = [];
  const seen = new Set<string>();
  const excludedKnown = new Set<string>();
  const nodesFailed: Array<{ node: string; reason: string }> = [];
  let uncited = 0;
  let malformed = 0;

  for (const node of queried) {
    let res: { content: string; citations: string[] };
    try {
      res = await research(node.label, PROMPT(node.label, summary));
    } catch (e: any) {
      nodesFailed.push({ node: node.label, reason: String(e?.message ?? e) });
      continue;
    }

    // No citations means nothing from this call is evidence.
    if (!res.citations.length) {
      uncited++;
      nodesFailed.push({ node: node.label, reason: "source returned no citations — discarded" });
      continue;
    }

    let rows: any;
    try {
      rows = looseJsonParse(res.content);
    } catch {
      malformed++;
      nodesFailed.push({ node: node.label, reason: "source returned unparseable output" });
      continue;
    }
    if (!Array.isArray(rows)) {
      malformed++;
      nodesFailed.push({ node: node.label, reason: "source did not return a list" });
      continue;
    }

    for (const r of rows) {
      if (!looksLikeTicker(r?.symbol)) continue;
      const sym = normSymbol(r.symbol);
      if (known.has(sym)) {
        excludedKnown.add(sym);
        continue;
      }
      if (seen.has(sym)) continue;
      if (discovered.length >= maxSymbols) break;
      seen.add(sym);
      discovered.push({
        symbol: sym,
        name: typeof r.name === "string" ? r.name.trim() : null,
        nodeLabel: node.label,
        rationale: typeof r.rationale === "string" ? r.rationale.trim() : null,
        citations: res.citations,
      });
    }
  }

  const dropped: string[] = [];
  if (skippedNodes > 0) dropped.push(`${skippedNodes} exposure node(s) not queried (cap of ${maxNodes})`);
  if (discovered.length >= maxSymbols) dropped.push(`symbol list truncated at ${maxSymbols}`);
  if (uncited > 0) dropped.push(`${uncited} node(s) discarded for returning no citations`);
  if (malformed > 0) dropped.push(`${malformed} node(s) returned unusable output`);
  if (excludedKnown.size > 0) dropped.push(`${excludedKnown.size} already held or planned`);

  return {
    discovered,
    excludedKnown: Array.from(excludedKnown),
    droppedNote: dropped.length ? dropped.join("; ") : null,
    nodesQueried: queried.map((n) => n.label),
    nodesFailed,
  };
}
