/**
 * Thesis Graph compiler.
 *
 * "Aggressive / moderate / conservative" is robo-advisor mush. This compiles
 * natural language into an investment constitution: what the investor believes,
 * what they seek, what they refuse, the portfolio rules that bind sizing, and
 * how they actually behave. Every candidate is then scored against THAT.
 *
 * Deliberate design choices:
 *   • Direct Gemini API, not the Forge gateway — Forge is a Manus-hosted proxy
 *     and this is meant to outlive that dependency.
 *   • Numbers come back as STRINGS and are parsed here. Gemini's structured
 *     output renders integer schema fields as enormous decimal strings; the
 *     property-side STRATEGIST hit this and the same workaround applies.
 *   • `confidenceNotes` is required output. A compiler that silently resolves an
 *     ambiguous reading is worse than one that flags it — the investor has to be
 *     able to see where it guessed.
 *   • The compiler NEVER invents a portfolio rule. If the text does not state a
 *     max position size, the field stays undefined rather than defaulting to a
 *     "sensible" number that would then silently govern real sizing.
 */
import { GoogleGenAI } from "@google/genai";
import { GEMINI_STRONG } from "../../shared/models";
import { looseJsonParse } from "../gemini";

export interface ThesisGraph {
  beliefs: string[];
  seek: string[];
  avoid: string[];
  horizons: string[];
  sectors: string[];
  exclusions: string[];
  portfolioRules: {
    maxSingleNamePct?: number;
    maxCorrelatedClusterPct?: number;
    minAvgDailyVolumeUsd?: number;
    reservePct?: number;
  };
  behavior: { researches?: number; shortlists?: number; executes?: number };
  /** Root nodes of the exposure decomposition: "AI adoption" → inference → power → … */
  exposureTree: ExposureTreeNode[];
  /** Explicit symbols declared by the operator. Never inferred by fallback. */
  researchSymbols: string[];
  evidenceRequirements: string[];
  invalidationConditions: string[];
  instrumentPreference: "shares" | "options" | "either" | null;
  confidenceNotes: string[];
  suggestedName: string;
}

export interface ExposureTreeNode {
  label: string;
  children?: ExposureTreeNode[];
}

const SYSTEM_PROMPT = `You are the Thesis Compiler for Signal Hunter Capital Aperture.

Your job: turn an investor's free-text investment thesis into a structured investment constitution that a machine can score securities against.

You are NOT an advisor. You do not recommend securities, predict returns, or judge whether the thesis is good. You restate what the investor said, precisely, and flag where their words were ambiguous.

HARD RULES:
1. NEVER invent a portfolio rule. If the investor did not state a maximum position size, a cluster limit, a liquidity floor, or a cash reserve, OMIT that field entirely. A number you made up would go on to govern real position sizing.
2. NEVER add a belief, sector, or exclusion the investor did not express or clearly imply. Do not "round out" a thesis.
3. Every ambiguous reading MUST appear in confidenceNotes, phrased as what you assumed and what the alternative was.
4. All numbers must be returned as STRINGS containing plain integers or decimals (e.g. "8" or "2.5"), never as JSON numbers.

EXPOSURE TREE:
Decompose the thesis into the causal chain of who benefits. This is the most valuable output — it is how the system finds expressions of a thesis the investor never considered. Go 3-4 levels deep and be specific about physical and industrial dependencies.

Example, for "AI infrastructure over consumer AI":
AI adoption → inference demand → datacenter expansion → { GPUs, networking, optical, cooling, power management, electricity generation, natural gas, uranium, grid equipment, construction, industrial real estate }

Prefer concrete industrial nodes ("transformers", "gas turbines") over abstractions ("innovation", "growth"). A node should be something a company can actually sell.

PORTFOLIO RULES — map only what is stated:
  maxSingleNamePct        "no more than 8% in one name"       → "8"
  maxCorrelatedClusterPct "cap correlated cluster at 25%"     → "25"
  minAvgDailyVolumeUsd    "minimum $5M average daily volume"  → "5000000"
  reservePct              "hold back 15%"                     → "15"

BEHAVIOR — only if stated: "usually researches 10, shortlists 5, executes 3" → researches "10", shortlists "5", executes "3".

Return ONLY a JSON object. No markdown, no commentary.`;

const SCHEMA = {
  type: "object" as const,
  properties: {
    beliefs: { type: "array" as const, items: { type: "string" as const } },
    seek: { type: "array" as const, items: { type: "string" as const } },
    avoid: { type: "array" as const, items: { type: "string" as const } },
    horizons: { type: "array" as const, items: { type: "string" as const } },
    sectors: { type: "array" as const, items: { type: "string" as const } },
    exclusions: { type: "array" as const, items: { type: "string" as const } },
    portfolioRules: {
      type: "object" as const,
      properties: {
        maxSingleNamePct: { type: "string" as const },
        maxCorrelatedClusterPct: { type: "string" as const },
        minAvgDailyVolumeUsd: { type: "string" as const },
        reservePct: { type: "string" as const },
      },
    },
    behavior: {
      type: "object" as const,
      properties: {
        researches: { type: "string" as const },
        shortlists: { type: "string" as const },
        executes: { type: "string" as const },
      },
    },
    exposureTree: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          label: { type: "string" as const, maxLength: 120, description: "Short concrete noun phrase only; never include reasoning, schema commentary, or self-correction." },
          children: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                label: { type: "string" as const, maxLength: 120, description: "Short concrete noun phrase only; never include reasoning, schema commentary, or self-correction." },
                children: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      label: { type: "string" as const, maxLength: 120, description: "Short concrete noun phrase only; never include reasoning, schema commentary, or self-correction." },
                      children: { type: "array" as const, items: { type: "object" as const, properties: { label: { type: "string" as const, maxLength: 120, description: "Short concrete noun phrase only; never include reasoning, schema commentary, or self-correction." } } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    confidenceNotes: { type: "array" as const, items: { type: "string" as const } },
    suggestedName: { type: "string" as const },
  },
  required: ["beliefs", "seek", "avoid", "exposureTree", "confidenceNotes", "suggestedName"],
};

/** Parse a model-returned numeric string. Missing/garbage → undefined, never 0. */
export function optionalNum(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(String(v).replace(/[$,%\s_]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => String(x).trim()) : [];

/** Normalise raw model output into a ThesisGraph. Exported for testing. */
export function normalizeGraph(raw: any): ThesisGraph {
  const rules: ThesisGraph["portfolioRules"] = {};
  const pr = raw?.portfolioRules ?? {};
  // Each rule is set ONLY when the model returned something parseable. An
  // omitted rule must stay omitted — a default here would silently govern sizing.
  const maxSingle = optionalNum(pr.maxSingleNamePct);
  if (maxSingle != null) rules.maxSingleNamePct = maxSingle;
  const maxCluster = optionalNum(pr.maxCorrelatedClusterPct);
  if (maxCluster != null) rules.maxCorrelatedClusterPct = maxCluster;
  const minAdv = optionalNum(pr.minAvgDailyVolumeUsd);
  if (minAdv != null) rules.minAvgDailyVolumeUsd = minAdv;
  const reserve = optionalNum(pr.reservePct);
  if (reserve != null) rules.reservePct = reserve;

  const behavior: ThesisGraph["behavior"] = {};
  const b = raw?.behavior ?? {};
  const researches = optionalNum(b.researches);
  if (researches != null) behavior.researches = researches;
  const shortlists = optionalNum(b.shortlists);
  if (shortlists != null) behavior.shortlists = shortlists;
  const executes = optionalNum(b.executes);
  if (executes != null) behavior.executes = executes;

  const cleanTree = (nodes: any): ExposureTreeNode[] => {
    if (!Array.isArray(nodes)) return [];
    return nodes
      .filter((n) => n && typeof n.label === "string" && n.label.trim())
      .map((n) => {
        const node: ExposureTreeNode = { label: String(n.label).trim() };
        const kids = cleanTree(n.children);
        if (kids.length) node.children = kids;
        return node;
      });
  };

  return {
    beliefs: strArray(raw?.beliefs),
    seek: strArray(raw?.seek),
    avoid: strArray(raw?.avoid),
    horizons: strArray(raw?.horizons),
    sectors: strArray(raw?.sectors),
    exclusions: strArray(raw?.exclusions),
    portfolioRules: rules,
    behavior,
    exposureTree: cleanTree(raw?.exposureTree),
    researchSymbols: strArray(raw?.researchSymbols).map((symbol) => symbol.toUpperCase()),
    evidenceRequirements: strArray(raw?.evidenceRequirements),
    invalidationConditions: strArray(raw?.invalidationConditions),
    instrumentPreference: ["shares", "options", "either"].includes(raw?.instrumentPreference)
      ? raw.instrumentPreference
      : null,
    confidenceNotes: strArray(raw?.confidenceNotes),
    suggestedName: typeof raw?.suggestedName === "string" && raw.suggestedName.trim()
      ? raw.suggestedName.trim()
      : "Untitled thesis",
  };
}

/** Flatten the tree into rows for the exposure_nodes table. */
export function flattenExposureTree(
  tree: ExposureTreeNode[],
): Array<{ label: string; depth: number; path: string; parentPath: string | null }> {
  const out: Array<{ label: string; depth: number; path: string; parentPath: string | null }> = [];
  const walk = (nodes: ExposureTreeNode[], depth: number, parentPath: string | null) => {
    for (const n of nodes) {
      const path = parentPath ? `${parentPath} / ${n.label}` : n.label;
      out.push({ label: n.label, depth, path, parentPath });
      if (n.children?.length) walk(n.children, depth + 1, path);
    }
  };
  walk(tree, 0, null);
  return out;
}

export class ThesisCompileError extends Error {}

const EXPOSURE_LABEL_MAX_CHARS = 160;
const EXPOSURE_PATH_MAX_CHARS = 512;
const EXPOSURE_NODE_MAX_COUNT = 256;
const EXPOSURE_PROVIDER_META = /\b(?:wait[,;:]?\s+i\s+need|i\s+need\s+to\s+format|let['’]?s\s+(?:do|format|rewrite)|schema\s+dictates|format\s+this\s+as\s+the\s+schema|previous\s+response|return\s+(?:only|exactly)\s+(?:json|an?\s+json))\b/i;

/**
 * Keep provider output inside the durable exposure-node contract before any
 * row is written. Rejecting the whole projection is intentional: truncating a
 * causal label or path would silently change the operator's thesis.
 */
export function validateGraphForPersistence(graph: ThesisGraph): ThesisGraph {
  const rows = flattenExposureTree(graph.exposureTree);
  const invalid = rows.find((row) =>
    row.label.length > EXPOSURE_LABEL_MAX_CHARS
    || row.path.length > EXPOSURE_PATH_MAX_CHARS
    || /[\r\n\t]/.test(row.label)
    || EXPOSURE_PROVIDER_META.test(row.label)
  );
  if (rows.length > EXPOSURE_NODE_MAX_COUNT || invalid) {
    throw new ThesisCompileError(
      "The thesis service returned an invalid exposure map. Your thesis is saved unchanged; please try the projection again.",
    );
  }
  return graph;
}

type ThesisGraphCompiler = (thesisText: string) => Promise<ThesisGraph>;

/**
 * A historical thesis can predate the durable exposure-map guard. Do not make
 * the operator leave a Decision Run to repair machine-authored projection
 * data: re-project the unchanged thesis text once, validate the replacement,
 * and let the caller persist an auditable repaired graph. If recovery also
 * fails, the original validation error remains a hard stop.
 */
export async function resolveRunGraph(
  graph: ThesisGraph,
  thesisText: string,
  compile: ThesisGraphCompiler = compileThesis,
): Promise<{ graph: ThesisGraph; recovered: boolean }> {
  try {
    return { graph: validateGraphForPersistence(graph), recovered: false };
  } catch (error) {
    if (!(error instanceof ThesisCompileError)) throw error;
    const recovered = validateGraphForPersistence(await compile(thesisText));
    return { graph: recovered, recovered: true };
  }
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Gemini can expose structured content through `text`, candidate parts, or a
 * nested response wrapper depending on SDK version and safety/stream handling.
 * Collect textual leaves so a valid JSON object is never rejected merely because
 * it arrived through a different SDK response shape.
 */
function collectResponseTexts(value: unknown, out: string[], seen: Set<object>, depth = 0): void {
  if (depth > 7 || value == null) return;
  if (typeof value === "string") {
    if (value.trim()) out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectResponseTexts(item, out, seen, depth + 1));
    return;
  }
  if (!isRecord(value) || seen.has(value)) return;
  seen.add(value);

  for (const key of ["text", "parts", "content", "candidates", "response", "data", "result", "output"]) {
    if (key in value) collectResponseTexts(value[key], out, seen, depth + 1);
  }
}

function unwrapCompilerPayload(value: unknown): unknown {
  let payload = value;
  for (let i = 0; i < 3 && isRecord(payload); i++) {
    if ("beliefs" in payload || "seek" in payload || "exposureTree" in payload) break;
    const record = payload;
    const wrapped = ["data", "result", "output", "response", "content"]
      .map((key) => record[key])
      .find((candidate) => isRecord(candidate));
    if (!wrapped) break;
    payload = wrapped;
  }
  return payload;
}

/**
 * Parse JSON from any supported Gemini response shape. Exported so parser
 * recovery is deterministic and independently regression-tested.
 */
export function parseCompilerResponse(response: unknown): unknown {
  const texts: string[] = [];
  collectResponseTexts(response, texts, new Set<object>());

  for (const text of texts) {
    try {
      let parsed = looseJsonParse(text);
      // Some providers serialise the JSON object as a JSON string. Unwrap it
      // once more rather than treating a valid response as an empty graph.
      if (typeof parsed === "string") parsed = looseJsonParse(parsed);
      return unwrapCompilerPayload(parsed);
    } catch {
      // Try the next text-bearing candidate part.
    }
  }
  throw new ThesisCompileError("The thesis service returned an unreadable structured response.");
}

async function generateCompilerResponse(genai: GoogleGenAI, thesisText: string, retry = false) {
  const recovery = retry
    ? `\n\nRECOVERY: The previous response violated the durable exposure-map contract. Rewrite the entire object from scratch.
- Return exactly one JSON object matching the schema; no markdown, prose, or code fences.
- Every exposureTree label must be a concrete noun phrase of at most 120 characters.
- Labels must never contain reasoning, self-correction, instructions, or commentary about formatting or the schema.
- Use no more than four exposure-tree levels and 64 total nodes.
- Do not truncate a thought into a label. Omit a node when it cannot be stated cleanly.`
    : "";
  return genai.models.generateContent({
    model: GEMINI_STRONG,
    contents: [
      { role: "user", parts: [{ text: `${SYSTEM_PROMPT}${recovery}\n\nINVESTOR'S THESIS:\n${thesisText}` }] },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: SCHEMA as any,
      temperature: retry ? 0 : 0.2,
      maxOutputTokens: 4096,
    },
  });
}

type CompilerGenerator = (retry: boolean) => Promise<unknown>;

/**
 * Run the persistence-safe compiler loop against an injected provider seam.
 * Exported so malformed-first-response recovery is regression-testable without
 * a network call or provider key.
 */
export async function compileThesisWithGenerator(
  thesisText: string,
  generate: CompilerGenerator,
): Promise<ThesisGraph> {
  if (!thesisText || thesisText.trim().length < 20) {
    throw new ThesisCompileError("A thesis needs at least a sentence or two to compile.");
  }

  const compileResponse = async (retry: boolean) => validateGraphForPersistence(
    normalizeGraph(parseCompilerResponse(await generate(retry))),
  );

  let graph: ThesisGraph;
  try {
    graph = await compileResponse(false);
  } catch {
    try {
      graph = await compileResponse(true);
    } catch {
      throw new ThesisCompileError("The thesis service could not format a structured projection after an automatic retry. Your thesis is saved unchanged; please try the projection again.");
    }
  }

  if (!graph.beliefs.length && !graph.seek.length) {
    throw new ThesisCompileError(
      "The compiler could not extract any beliefs or criteria from that text. Say what you believe and what you are looking for.",
    );
  }
  return graph;
}

/** Compile free text into a Thesis Graph. */
export async function compileThesis(thesisText: string): Promise<ThesisGraph> {
  if (!thesisText || thesisText.trim().length < 20) {
    throw new ThesisCompileError("A thesis needs at least a sentence or two to compile.");
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new ThesisCompileError("GEMINI_API_KEY is not configured — the thesis compiler cannot run.");
  }

  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return compileThesisWithGenerator(
    thesisText,
    (retry) => generateCompilerResponse(genai, thesisText, retry),
  );
}
