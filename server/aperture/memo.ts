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

export interface GenerateOpts {
  /** Injected for tests; defaults to a real Gemini call. */
  generate?: (prompt: string) => Promise<string>;
  /** Retry once with the offending figures named. Models usually fix it. */
  retryOnReject?: boolean;
}

async function callGemini(prompt: string): Promise<string> {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await genai.models.generateContent({
    model: GEMINI_STRONG,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: SCHEMA as any,
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  });
  return res.text ?? "";
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

  let raw: string;
  try {
    raw = await generate(prompt);
  } catch (e: any) {
    return { memo: null, status: "skipped", rejectReason: `Memo generation failed: ${String(e?.message ?? e)}`, validation: null, citations };
  }

  let parsed: any;
  try {
    parsed = looseJsonParse(raw);
  } catch {
    if (opts.retryOnReject !== false) {
      try {
        const retryRaw = await generate(
          `${prompt}\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED BEFORE VALIDATION because it was not parseable JSON. ` +
          `Return only one valid JSON object matching the requested fields. Do not add markdown, commentary, or code fences.`,
        );
        parsed = looseJsonParse(retryRaw);
      } catch {
        return {
          memo: null,
          status: "rejected",
          rejectReason: "Memo formatting could not be validated after one automatic fact-only retry. Your research facts remain available; retry when you are ready.",
          validation: null,
          citations,
        };
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
      const retryParsed = looseJsonParse(retryRaw);
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
  };
}
