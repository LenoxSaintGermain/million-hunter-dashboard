/**
 * Signal Hunter — AI Model Registry
 *
 * Single source of truth for all available models across providers.
 *
 * MODEL POLICY (Jul 2026): All Gemini 3.x variants below are validated live
 * against the production GEMINI_API_KEY. Safe to use:
 *   gemini-3.6-flash         → GA Jul 21 2026, best token efficiency, high-volume
 *   gemini-3.5-flash         → GA, strongest Flash tier, balanced speed/quality
 *   gemini-3.5-flash-lite    → GA Jul 21 2026, ultra-cheap subagent tasks
 *   gemini-3.1-pro-preview   → Deep reasoning, long-context, multimodal
 *   gemini-3.1-flash-lite    → Fast structured extraction (legacy fallback)
 *   gemini-3-flash-preview   → Available but superseded by 3.5-flash
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
  // ── Google Gemini (direct API — all validated Jul 2026) ───────────────────
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
  // ── Claude via Poe API ────────────────────────────────────────────────────────────────────
  {
    id: "Claude-Opus-4.7",
    label: "Claude Opus 4.7 (via Poe)",
    provider: "poe",
    tier: "preview",
    contextWindow: 200000,
    outputLimit: 32000,
    supportsJson: true,
    supportsGrounding: false,
    notes: "Anthropic's most capable model. Best for Owner Psychology profiling.",
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
    id: "GPT-5.5",
    label: "GPT-5.5 (via Poe)",
    provider: "poe",
    tier: "preview",
    contextWindow: 128000,
    outputLimit: 32768,
    supportsJson: true,
    supportsGrounding: false,
    notes: "OpenAI's latest flagship. Released April 23, 2026.",
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
// All IDs below validated live against production GEMINI_API_KEY (Jul 24 2026).
// Direct-API call sites must resolve to one of these; anything else read from
// config (e.g. a stale model_configs row) must fall back to a valid default.

export const GEMINI_STRONG = "gemini-3.1-pro-preview";   // Deep reasoning: Red Team, Memo
export const GEMINI_FAST   = "gemini-3.6-flash";          // High-volume: Scoring, Capital Stack
export const GEMINI_BALANCED = "gemini-3.5-flash";        // Balanced: Market Scan, Consensus
export const GEMINI_LITE   = "gemini-3.5-flash-lite";     // Ultra-cheap: background tasks
export const VALID_GEMINI_IDS = new Set<string>([
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

// ─── Default Module → Model Assignments ──────────────────────────────────────

export const DEFAULT_MODULE_MODELS: Record<AnalysisModule, string> = {
  ownerPsychology: "Claude-Opus-4.7",     // Nuanced behavioral profiling
  digitalAudit:    "sonar-pro",            // Live web research with citations
  redTeam:         GEMINI_STRONG,          // gemini-3.1-pro-preview — deep adversarial reasoning
  capitalStack:    GEMINI_FAST,            // gemini-3.6-flash — fast structured math
  investmentMemo:  GEMINI_STRONG,          // gemini-3.1-pro-preview — long-form synthesis
  dealScoring:     GEMINI_BALANCED,        // gemini-3.5-flash — quality scoring
  marketScan:      GEMINI_FAST,            // gemini-3.6-flash — high-volume extraction
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
