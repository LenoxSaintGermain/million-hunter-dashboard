/**
 * Investment memo generation.
 *
 * The model is handed the fact ledger for one symbol and nothing else. It is
 * told that "unknown" is a valid answer and that any figure not in the ledger
 * must be omitted. Then the output goes through the validator, which checks
 * every financial number against the ledger and REJECTS the memo if one does
 * not trace.
 *
 * The prompt is the request. The validator is the control. Both are needed:
 * three fabrication bugs in the property engine all started with a prompt that
 * asked nicely.
 */
import { GoogleGenAI } from "@google/genai";
import type { SecurityFact } from "../../drizzle/schema";
import { GEMINI_STRONG } from "../../shared/models";
import { looseJsonParse } from "../gemini";
import { factsToPromptBlock, unknownGaps } from "./facts";
import { validateMemoNumbers, type ValidationResult } from "./memoValidator";
import type { ThesisGraph } from "./thesisGraph";

export interface InvestmentMemo {
  thesisFit: string;
  whyNow: string;
  catalyst: string;
  whatWouldInvalidate: string;
  relationToPortfolio: string;
  whyThisDeservesCapital: string;
  risks: string[];
  downsideScenario: string;
  /** What the memo could not assess, and why. Required, not optional garnish. */
  unknowns: string[];
  researchConfidence: "high" | "medium" | "low";
  /** The UI labels deterministic fallback output; it is not model narrative. */
  generationBasis: "model" | "fact_ledger_fallback";
}

export interface MemoResult {
  memo: InvestmentMemo | null;
  status: "ok" | "rejected" | "skipped";
  rejectReason: string | null;
  validation: ValidationResult | null;
  citations: string[];
}

const SYSTEM_PROMPT = `You write investment memos for Signal Hunter Capital Aperture, an internal research tool for a single self-directed investor.

THE ONLY NUMBERS THAT EXIST ARE THE ONES IN THE FACT LEDGER BELOW.

This is not a style preference. Every figure you write is checked against the ledger after generation, and the memo is DISCARDED if any number in it cannot be traced to a ledger entry. A memo with no numbers is publishable. A memo with one invented number is not.

Specifically:
- Do not recall figures from training data. A revenue number you "know" is not in the ledger and will fail.
- Do not compute a derived figure (a ratio, a growth rate, a target price) unless every input is in the ledger AND you state that it is derived.
- Do not estimate, approximate, or say "roughly" a number that is absent. Say the ledger does not contain it.
- Entries marked UNKNOWN mean a source was consulted and stated nothing. Name those gaps in \`unknowns\` — that is real information about research coverage.
- Entries marked MODELED depend on an assumption; if you cite one, cite the assumption with it.

WRITE ABOUT MECHANISM, NOT SENTIMENT. "Datacenter buildout raises transformer demand and this company makes transformers" is analysis. "Well-positioned to benefit from AI tailwinds" is noise.

You are not recommending a purchase. You are laying out how this security relates to a stated thesis, what would have to be true, and what would break it. \`whatWouldInvalidate\` must be a falsifiable condition, not a hedge.

researchConfidence reflects LEDGER COVERAGE, not your enthusiasm:
  high   — the facts needed to assess thesis fit are present
  medium — meaningful gaps, but the core is covered
  low    — mostly unknowns; say so plainly

Return ONLY a JSON object.`;

const SCHEMA = {
  type: "object" as const,
  properties: {
    thesisFit: { type: "string" as const },
    whyNow: { type: "string" as const },
    catalyst: { type: "string" as const },
    whatWouldInvalidate: { type: "string" as const },
    relationToPortfolio: { type: "string" as const },
    whyThisDeservesCapital: { type: "string" as const },
    risks: { type: "array" as const, items: { type: "string" as const } },
    downsideScenario: { type: "string" as const },
    unknowns: { type: "array" as const, items: { type: "string" as const } },
    researchConfidence: { type: "string" as const, enum: ["high", "medium", "low"] },
  },
  required: ["thesisFit", "whyNow", "whatWouldInvalidate", "risks", "unknowns", "researchConfidence"],
};

export function buildMemoPrompt(
  symbol: string,
  facts: SecurityFact[],
  graph: ThesisGraph,
  holdings: string[],
): string {
  const gaps = unknownGaps(facts).map((f) => f.factKey);
  return [
    SYSTEM_PROMPT,
    "",
    `SECURITY: ${symbol}`,
    "",
    "FACT LEDGER — the complete set of figures you may use:",
    factsToPromptBlock(facts),
    "",
    gaps.length
      ? `EXPLICIT GAPS (a source was consulted and stated nothing): ${gaps.join(", ")}`
      : "EXPLICIT GAPS: none recorded.",
    "",
    "INVESTOR'S THESIS:",
    `Beliefs: ${graph.beliefs.join(" · ") || "(none stated)"}`,
    `Seeking: ${graph.seek.join(" · ") || "(none stated)"}`,
    `Avoiding: ${graph.avoid.join(" · ") || "(none stated)"}`,
    `Exclusions: ${graph.exclusions.join(" · ") || "(none stated)"}`,
    "",
    `CURRENT HOLDINGS: ${holdings.length ? holdings.join(", ") : "(none on record)"}`,
  ].join("\n");
}

/** Extract cited source URLs from the ledger — the memo's provenance trail. */
export function citationsFrom(facts: SecurityFact[]): string[] {
  const urls = new Set<string>();
  for (const f of facts) if (f.sourceUrl) urls.add(f.sourceUrl);
  return Array.from(urls);
}

/** A non-directional, no-new-number summary for structurally unrecoverable model output. */
export function buildFactLedgerFallbackMemo(
  symbol: string,
  facts: SecurityFact[],
  graph: ThesisGraph,
  holdings: string[],
): InvestmentMemo {
  const covered = Array.from(new Set(facts.filter((f) => f.basis !== "unknown").map((f) => f.factKey))).slice(0, 6);
  const gaps = Array.from(new Set(unknownGaps(facts).map((f) => f.factKey))).slice(0, 8);
  const belief = graph.beliefs[0] ?? "the stated thesis";
  const held = holdings.includes(symbol) ? `${symbol} is already present in the paper context.` : `${symbol} is not currently present in the paper context.`;

  return {
    thesisFit: `Ledger-only research summary for ${symbol}: assess its relation to ${belief} using the available fact coverage rather than a directional conclusion.`,
    whyNow: covered.length ? `The ledger currently covers ${covered.join(", ")}.` : "The current ledger contains sourced research context but no complete timing conclusion.",
    catalyst: "No validated catalyst conclusion is asserted until the open evidence checks are completed.",
    whatWouldInvalidate: "Invalidate this research path if subsequent verified evidence contradicts the stated thesis mechanism or removes the identified catalyst premise.",
    relationToPortfolio: held,
    whyThisDeservesCapital: "This memo does not support a paper-allocation conclusion; it preserves the fact-backed research record for human review.",
    risks: ["The model-formatted memo could not be structurally recovered.", "Open evidence checks remain before any paper-allocation decision."],
    downsideScenario: "Evidence remains incomplete or later verified facts weaken the thesis mechanism.",
    unknowns: gaps.length ? gaps.map((gap) => `Ledger gap: ${gap}`) : ["No explicit unknown fact rows were recorded; review source coverage before acting."],
    researchConfidence: "low",
    generationBasis: "fact_ledger_fallback",
  };
}

function factLedgerFallbackResult(symbol: string, facts: SecurityFact[], graph: ThesisGraph, holdings: string[], citations: string[], reason: string): MemoResult {
  const memo = buildFactLedgerFallbackMemo(symbol, facts, graph, holdings);
  return { memo, status: "ok", rejectReason: reason, validation: validateMemoNumbers(memo, facts), citations };
}

export interface GenerateOpts {
  /** Injected for tests; defaults to a real Gemini call. */
  generate?: (prompt: string) => Promise<unknown>;
  /** Retry once with the offending figures named. Models usually fix it. */
  retryOnReject?: boolean;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectMemoTexts(value: unknown, out: string[], seen: Set<object>, depth = 0): void {
  if (depth > 7 || value == null) return;
  if (typeof value === "string") {
    if (value.trim()) out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectMemoTexts(item, out, seen, depth + 1));
    return;
  }
  if (!isRecord(value) || seen.has(value)) return;
  seen.add(value);
  for (const key of ["text", "parts", "content", "candidates", "response", "data", "result", "output"]) {
    if (key in value) collectMemoTexts(value[key], out, seen, depth + 1);
  }
}

function unwrapMemoPayload(value: unknown): unknown {
  let payload = value;
  for (let i = 0; i < 3 && isRecord(payload); i++) {
    if ("thesisFit" in payload || "whatWouldInvalidate" in payload || "researchConfidence" in payload) break;
    const record = payload;
    const nested = ["data", "result", "output", "response", "content"]
      .map((key) => record[key])
      .find((candidate) => isRecord(candidate));
    if (!nested) break;
    payload = nested;
  }
  return payload;
}

/** Accept text, candidate parts, quoted JSON, and structured SDK envelopes. */
export function parseMemoResponse(response: unknown): unknown {
  const texts: string[] = [];
  collectMemoTexts(response, texts, new Set<object>());
  for (const text of texts) {
    try {
      let parsed = looseJsonParse(text);
      if (typeof parsed === "string") parsed = looseJsonParse(parsed);
      return unwrapMemoPayload(parsed);
    } catch {
      // Try the next textual part supplied by the provider.
    }
  }
  throw new Error("Memo output contained no parseable structured JSON.");
}

async function callGemini(prompt: string): Promise<unknown> {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return genai.models.generateContent({
    model: GEMINI_STRONG,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: SCHEMA as any,
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  });
}

/**
 * Generate a memo and refuse to return one that fails the ledger check.
 *
 * A rejected memo is recorded WITH its reason rather than silently retried into
 * existence — a symbol whose memo keeps failing is telling you the research
 * coverage is too thin to write about it.
 */
export async function generateMemo(
  symbol: string,
  facts: SecurityFact[],
  graph: ThesisGraph,
  holdings: string[],
  opts: GenerateOpts = {},
): Promise<MemoResult> {
  const citations = citationsFrom(facts);
  const usable = facts.filter((f) => f.basis !== "unknown");

  // With nothing sourced, there is nothing honest to write. Skipping is the
  // correct outcome, not generating a memo made entirely of hedges.
  if (!usable.length) {
    return {
      memo: null,
      status: "skipped",
      rejectReason: `No sourced facts for ${symbol} — nothing to write a memo from.`,
      validation: null,
      citations,
    };
  }

  const generate = opts.generate ?? callGemini;
  const prompt = buildMemoPrompt(symbol, facts, graph, holdings);

  let raw: unknown;
  try {
    raw = await generate(prompt);
  } catch (e: any) {
    return { memo: null, status: "skipped", rejectReason: `Memo generation failed: ${String(e?.message ?? e)}`, validation: null, citations };
  }

  let parsed: any;
  try {
    parsed = parseMemoResponse(raw);
  } catch {
    if (opts.retryOnReject !== false) {
      try {
        const retryRaw = await generate(
          `${prompt}\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED BEFORE VALIDATION because it was not parseable JSON. ` +
          `Return only one valid JSON object matching the requested fields. Do not add markdown, commentary, or code fences.`,
        );
        parsed = parseMemoResponse(retryRaw);
      } catch {
        return factLedgerFallbackResult(
          symbol, facts, graph, holdings, citations,
          "The model memo could not be structurally recovered after one retry. Showing a validated ledger-only summary instead.",
        );
      }
    } else {
      return { memo: null, status: "rejected", rejectReason: "Memo generation did not return parseable JSON.", validation: null, citations };
    }
  }

  let validation = validateMemoNumbers(parsed, facts);

  if (!validation.ok && opts.retryOnReject !== false) {
    const offenders = validation.offenders.map((o) => o.raw).join(", ");
    try {
      const retryRaw = await generate(
        `${prompt}\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED. These figures do not appear in the fact ledger: ${offenders}. ` +
          `Rewrite the memo without them. Either omit the claim entirely or state that the ledger does not contain the figure. ` +
          `Do not substitute a different invented number.`,
      );
      const retryParsed = parseMemoResponse(retryRaw);
      const retryValidation = validateMemoNumbers(retryParsed, facts);
      if (retryValidation.ok) {
        parsed = retryParsed;
        validation = retryValidation;
      }
    } catch {
      // Keep the original rejection; the retry is best-effort.
    }
  }

  if (!validation.ok) {
    if (opts.retryOnReject !== false) {
      return factLedgerFallbackResult(
        symbol,
        facts,
        graph,
        holdings,
        citations,
        "The model repeated figures that did not trace to the fact ledger. Those claims were discarded; showing a validated ledger-only research record instead.",
      );
    }
    return { memo: null, status: "rejected", rejectReason: validation.reason, validation, citations };
  }

  return { memo: coerceMemo(parsed), status: "ok", rejectReason: null, validation, citations };
}

/** Shape whatever came back into the memo interface without inventing content. */
export function coerceMemo(raw: any): InvestmentMemo {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map(String) : []);
  const conf = String(raw?.researchConfidence ?? "").toLowerCase();
  return {
    thesisFit: str(raw?.thesisFit),
    whyNow: str(raw?.whyNow),
    catalyst: str(raw?.catalyst),
    whatWouldInvalidate: str(raw?.whatWouldInvalidate),
    relationToPortfolio: str(raw?.relationToPortfolio),
    whyThisDeservesCapital: str(raw?.whyThisDeservesCapital),
    risks: arr(raw?.risks),
    downsideScenario: str(raw?.downsideScenario),
    unknowns: arr(raw?.unknowns),
    // An unrecognised confidence value means we do not know it is high.
    researchConfidence: conf === "high" || conf === "medium" ? (conf as "high" | "medium") : "low",
    generationBasis: raw?.generationBasis === "fact_ledger_fallback" ? "fact_ledger_fallback" : "model",
  };
}
