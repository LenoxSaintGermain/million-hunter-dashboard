/**
 * Signal Hunter — AI Model Registry
 *
 * Single source of truth for all available models across providers.
 *
 * MODEL POLICY — re-validated live Sep 1 2026 via `npx tsx scripts/validate-models.ts`
 * (one-token generateContent probe per id against the production GEMINI_API_KEY).
 * Re-run that script before changing anything here; it is the authority, not this
 * comment and not CLAUDE.md.
 *
 * PASSED (7/8) — safe to use:
 *   gemini-3.7-flash         → validated Sep 1 2026, newest Flash tier
 *   gemini-3.6-flash         → GA Jul 21 2026, best token efficiency, high-volume
 *   gemini-3.5-flash         → GA, strongest Flash tier, balanced speed/quality
 *   gemini-3.5-flash-lite    → GA Jul 21 2026, ultra-cheap subagent tasks
 *   gemini-3.1-pro-preview   → Deep reasoning, long-context, multimodal
 *   gemini-3.1-flash-lite    → Fast structured extraction (legacy fallback)
 *   gemini-3-flash-preview   → Available but superseded by 3.5-flash
 *
 * FAILED (1/8) — DO NOT USE, and do not re-add on the assumption it is a typo:
 *   gemini-3.1-flash         → HTTP 404 NOT_FOUND: "models/gemini-3.1-flash is not
 *                              found for API version v1beta, or is not supported for
 *                              generateContent." This id was live in
 *                              server/_core/llm.ts until Aug 18 2026.
 *
 * POE IDS — VALIDATED LIVE through 2026-09-01 against GET /v1/models plus a real
 * /v1/chat/completions probe on the production Poe_api_key. Poe uses its own
 * label-style namespace; these ids are NOT interchangeable with the direct-API
 * Gemini ids above.
 *   PASS  claude-opus-4.8 · claude-opus-4.7 · Claude-Sonnet-4.6 · Claude-Haiku-4.5
 *         Gemini-3.1-Pro · Gemini-3-Flash · Gemini-3.1-Flash-Lite · GPT-5.4 · GPT-4.1
 *         kimi-k3 · deepseek-v4-pro · deepseek-v4-flash
 *   FAIL  Claude-Opus-4 → HTTP 500, absent from /v1/models. This was the id
 *         server/poe.ts actually sent for Owner Psychology and the Digital
 *         Footprint Audit, so both were calling a model that does not exist.
 *   FAIL  GPT-5.5 → HTTP 404 "Model `GPT-5.5` not found." Catalog-only, never sent.
 * Both dead ids are removed. Re-validate before changing any of them: an invented
 * Poe label fails at request time exactly the way gemini-3.1-flash did.
 *
 * Perplexity sonar ids remain unverified by any validator.
 */

export type ModelProvider = "google" | "poe" | "perplexity";
export type ModelTier = "preview" | "stable" | "fast" | "lite";

export interface ModelDefinition {
  id: string;
  label: string;
  provider: ModelProvider;
  tier: ModelTier;
  contextWindow: number;       // tokens
  outputLimit: number;         // tokens
  supportsJson: boolean;       // native JSON mode
  supportsGrounding: boolean;  // web search grounding
  notes?: string;
}

export type AnalysisModule =
  | "ownerPsychology"
  | "digitalAudit"
  | "redTeam"
  | "capitalStack"
  | "investmentMemo"
  | "dealScoring"
  | "marketScan";

export interface ModuleModelConfig {
  module: AnalysisModule;
  modelId: string;
  enabled: boolean;
}

// ─── Model Catalog ────────────────────────────────────────────────────────────

export const MODEL_CATALOG: ModelDefinition[] = [
  // ── Google Gemini (direct API — all validated through Sep 2026) ───────────
  {
    id: "gemini-3.7-flash",
    label: "Gemini 3.7 Flash",
    provider: "google",
    tier: "stable",
    contextWindow: 1000000,
    outputLimit: 65536,
    supportsJson: true,
    supportsGrounding: true,
    notes: "Validated live Sep 1 2026. Primary structured compiler and fast synthesis model.",
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    provider: "google",
    tier: "stable",
    contextWindow: 1000000,
    outputLimit: 65536,
    supportsJson: true,
    supportsGrounding: true,
    notes: "GA Jul 21 2026. Best token efficiency. Ideal for high-volume scoring, consensus, capital stack.",
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    provider: "google",
    tier: "stable",
    contextWindow: 1000000,
    outputLimit: 65536,
    supportsJson: true,
    supportsGrounding: true,
    notes: "GA. Strongest Flash tier — balanced speed and quality. Best for deal scoring, market scan.",
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    provider: "google",
    tier: "lite",
    contextWindow: 1000000,
    outputLimit: 16384,
    supportsJson: true,
    supportsGrounding: false,
    notes: "GA Jul 21 2026. Ultra-cheap subagent tasks, background automation.",
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (Preview)",
    provider: "google",
    tier: "preview",
    contextWindow: 2000000,
    outputLimit: 65536,
    supportsJson: true,
    supportsGrounding: true,
    notes: "Frontier reasoning. Best for Red Team, Investment Memo, deep long-context analysis.",
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
    provider: "google",
    tier: "lite",
    contextWindow: 1000000,
    outputLimit: 16384,
    supportsJson: true,
    supportsGrounding: false,
    notes: "Legacy fast/cheap Gemini 3.1. Kept as fallback.",
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash (Preview)",
    provider: "google",
    tier: "preview",
    contextWindow: 1000000,
    outputLimit: 65536,
    supportsJson: true,
    supportsGrounding: true,
    notes: "Validated live but superseded by gemini-3.5-flash. Listed so the Settings UI can render any id that passes VALID_GEMINI_IDS; prefer 3.5-flash.",
  },
  // ── Claude via Poe API ────────────────────────────────────────────────────────────────────
  {
    id: "claude-opus-4.8",
    label: "Claude Opus 4.8 (via Poe)",
    provider: "poe",
    tier: "preview",
    contextWindow: 200000,
    outputLimit: 32000,
    supportsJson: true,
    supportsGrounding: false,
    notes: "Most capable Claude on this key (validated live Aug 18 2026). Best for Owner Psychology profiling.",
  },
  {
    id: "Claude-Sonnet-4.6",
    label: "Claude Sonnet 4.6 (via Poe)",
    provider: "poe",
    tier: "stable",
    contextWindow: 200000,
    outputLimit: 16000,
    supportsJson: true,
    supportsGrounding: false,
    notes: "Speed + intelligence balance. Good alternative for Owner Psychology.",
  },
  {
    id: "Claude-Haiku-4.5",
    label: "Claude Haiku 4.5 (via Poe)",
    provider: "poe",
    tier: "lite",
    contextWindow: 200000,
    outputLimit: 8000,
    supportsJson: true,
    supportsGrounding: false,
    notes: "Fastest Claude. Use for high-volume tasks via Poe.",
  },
  // ── GPT via Poe API ───────────────────────────────────────────────────────────────────────
  {
    id: "GPT-5.4",
    label: "GPT-5.4 (via Poe)",
    provider: "poe",
    tier: "preview",
    contextWindow: 128000,
    outputLimit: 32768,
    supportsJson: true,
    supportsGrounding: false,
    notes: "OpenAI flagship available on this key. GPT-5.5 was catalogued here and does not exist (404).",
  },
  {
    id: "GPT-4.1",
    label: "GPT-4.1 (via Poe)",
    provider: "poe",
    tier: "stable",
    contextWindow: 128000,
    outputLimit: 16384,
    supportsJson: true,
    supportsGrounding: false,
    notes: "Stable GPT flagship. Reliable fallback.",
  },
  // ── Independent reasoning models via Poe API ─────────────────────────────
  {
    id: "kimi-k3",
    label: "Kimi K3 (via Poe)",
    provider: "poe",
    tier: "stable",
    contextWindow: 1000000,
    outputLimit: 32768,
    supportsJson: false,
    supportsGrounding: false,
    notes: "Provider-owned Poe route validated Sep 1 2026. Premium long-context synthesis and independent memo perspective.",
  },
  {
    id: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro (via Poe)",
    provider: "poe",
    tier: "stable",
    contextWindow: 1048576,
    outputLimit: 32768,
    supportsJson: false,
    supportsGrounding: false,
    notes: "Provider-owned Poe route validated Sep 1 2026. Independent adversarial and quantitative reviewer.",
  },
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash (via Poe)",
    provider: "poe",
    tier: "fast",
    contextWindow: 1000000,
    outputLimit: 32768,
    supportsJson: false,
    supportsGrounding: false,
    notes: "Provider-owned Poe route validated Sep 1 2026. Low-cost parallel critic, routing, and scoring perspective.",
  },
  // Perplexity (direct API)
  {
    id: "sonar-pro",label: "Perplexity Sonar Pro",
    provider: "perplexity",
    tier: "stable",
    contextWindow: 127072,
    outputLimit: 8000,
    supportsJson: false,
    supportsGrounding: true,
    notes: "Best for live web research and digital audits. Always grounded.",
  },
  {
    id: "sonar",
    label: "Perplexity Sonar",
    provider: "perplexity",
    tier: "fast",
    contextWindow: 127072,
    outputLimit: 8000,
    supportsJson: false,
    supportsGrounding: true,
    notes: "Faster/cheaper Sonar variant.",
  },
  {
    id: "sonar-deep-research",
    label: "Perplexity Sonar Deep Research",
    provider: "perplexity",
    tier: "preview",
    contextWindow: 127072,
    outputLimit: 8000,
    supportsJson: false,
    supportsGrounding: true,
    notes: "Multi-step autonomous research. Slower but most thorough.",
  },
];

// ─── Production Gemini model policy ───────────────────────────────────────────
// Every ID below re-validated live against the production GEMINI_API_KEY on
// Sep 1 2026 (scripts/validate-models.ts). Call sites MUST import these
// constants rather than hardcoding a model string; anything read from config
// (e.g. a stale model_configs row) MUST pass through toValidGeminiId() with a
// valid fallback. Skipping that coercion is what produced the Memos
// "Generation failed" bug.

export const GEMINI_STRONG = "gemini-3.1-pro-preview";   // Deep reasoning: safety-critical Red Team
export const GEMINI_FAST   = "gemini-3.7-flash";          // High-volume: Scoring, Capital Stack
export const GEMINI_BALANCED = "gemini-3.7-flash";        // Structured synthesis and consensus
export const GEMINI_LITE   = "gemini-3.5-flash-lite";     // Ultra-cheap: background tasks
// Legacy 3.1 lite tier. Still validated live, kept only as a fallback and for
// config round-trip tests. Prefer GEMINI_LITE for new work.
export const GEMINI_LEGACY_LITE = "gemini-3.1-flash-lite";
export const VALID_GEMINI_IDS = new Set<string>([
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
]);

export function toValidGeminiId(id: string | null | undefined, fallback: string): string {
  return id && VALID_GEMINI_IDS.has(id) ? id : fallback;
}

export const POE_KIMI_K3 = "kimi-k3";
export const POE_DEEPSEEK_V4_PRO = "deepseek-v4-pro";
export const POE_DEEPSEEK_V4_FLASH = "deepseek-v4-flash";

export const VALID_POE_IDS = new Set<string>(
  MODEL_CATALOG.filter((model) => model.provider === "poe").map((model) => model.id),
);

export const VALID_CATALOG_MODEL_IDS = new Set<string>(MODEL_CATALOG.map((model) => model.id));

export const VALID_ROUTABLE_MODEL_IDS = new Set<string>([
  ...Array.from(VALID_GEMINI_IDS),
  ...Array.from(VALID_POE_IDS),
]);

export function toValidRoutableModelId(
  id: string | null | undefined,
  fallback: string,
): string {
  return id && VALID_ROUTABLE_MODEL_IDS.has(id) ? id : fallback;
}

/** Three genuinely independent default reviewers; order is intentional. */
export const DEFAULT_CONSENSUS_MODELS = [
  GEMINI_STRONG,
  POE_KIMI_K3,
  POE_DEEPSEEK_V4_PRO,
] as const;

// ─── Default Module → Model Assignments ──────────────────────────────────────

export const DEFAULT_MODULE_MODELS: Record<AnalysisModule, string> = {
  ownerPsychology: "Claude-Sonnet-4.6",   // Nuanced behavioral profiling without Opus-everywhere cost
  digitalAudit:    "Claude-Sonnet-4.6",    // Structured digital-health interpretation
  redTeam:         GEMINI_STRONG,          // gemini-3.1-pro-preview — deep adversarial reasoning
  capitalStack:    GEMINI_FAST,            // gemini-3.7-flash — fast structured math
  investmentMemo:  POE_KIMI_K3,            // independent long-context synthesis
  dealScoring:     GEMINI_BALANCED,        // primary score; DeepSeek participates in consensus
  marketScan:      GEMINI_FAST,            // gemini-3.7-flash — high-volume extraction
};

export const MODULE_LABELS: Record<AnalysisModule, string> = {
  ownerPsychology: "Owner Psychology",
  digitalAudit: "Digital Footprint Audit",
  redTeam: "Red Team Analysis",
  capitalStack: "Capital Stack Wizard",
  investmentMemo: "Investment Memo",
  dealScoring: "Deal Scoring",
  marketScan: "Market Scan",
};

export const MODULE_DESCRIPTIONS: Record<AnalysisModule, string> = {
  ownerPsychology: "Behavioral profiling of the seller — distress signals, retirement readiness, negotiation style.",
  digitalAudit: "Live web research — reviews, SEO authority, tech stack, growth trend.",
  redTeam: "Devil's Advocate — finds every reason NOT to buy. Kill probability + red flags.",
  capitalStack: "SBA 7(a) modeling, seller note optimization, DSCR calculation.",
  investmentMemo: "Full investment thesis — executive summary, AI opportunities, risk factors.",
  dealScoring: "Composite financial + strategic score (0–1) with red flag detection.",
  marketScan: "Structured extraction from raw business listings across 11 platforms.",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getModelById(id: string): ModelDefinition | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}

export function getModelsByProvider(provider: ModelProvider): ModelDefinition[] {
  return MODEL_CATALOG.filter((m) => m.provider === provider);
}

export function getModelsByTier(tier: ModelTier): ModelDefinition[] {
  return MODEL_CATALOG.filter((m) => m.tier === tier);
}
