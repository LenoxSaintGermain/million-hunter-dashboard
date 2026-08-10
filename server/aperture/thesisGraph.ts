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
          label: { type: "string" as const },
          children: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                label: { type: "string" as const },
                children: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      label: { type: "string" as const },
                      children: { type: "array" as const, items: { type: "object" as const, properties: { label: { type: "string" as const } } } },
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

/** Compile free text into a Thesis Graph. */
export async function compileThesis(thesisText: string): Promise<ThesisGraph> {
  if (!thesisText || thesisText.trim().length < 20) {
    throw new ThesisCompileError("A thesis needs at least a sentence or two to compile.");
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new ThesisCompileError("GEMINI_API_KEY is not configured — the thesis compiler cannot run.");
  }

  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await genai.models.generateContent({
    model: GEMINI_STRONG,
    contents: [
      { role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\nINVESTOR'S THESIS:\n${thesisText}` }] },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: SCHEMA as any,
      temperature: 0.2,
      maxOutputTokens: 8192,
    },
  });

  let raw: any;
  try {
    raw = looseJsonParse(res.text);
  } catch {
    throw new ThesisCompileError("The thesis compiler did not return parseable JSON. Try again or simplify the thesis.");
  }
  const graph = normalizeGraph(raw);

  if (!graph.beliefs.length && !graph.seek.length) {
    throw new ThesisCompileError(
      "The compiler could not extract any beliefs or criteria from that text. Say what you believe and what you are looking for.",
    );
  }
  return graph;
}
