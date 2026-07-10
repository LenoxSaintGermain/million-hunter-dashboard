/**
 * Signal Hunter — AI Model Registry
 *
 * Single source of truth for all available models across providers.
 *
 * MODEL POLICY (Sprint 46+): only two Gemini variants are valid on the
 * production GEMINI_API_KEY — gemini-3.1-pro-preview and gemini-3.1-flash-lite.
 * Any other Gemini ID fails at the API and surfaces as "Generation failed".
 * Do not add Gemini entries here without validating them live on the key.
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
  // ── Google Gemini (direct API — only key-validated variants) ──────────────
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (Preview)",
    provider: "google",
    tier: "preview",
    contextWindow: 2000000,
    outputLimit: 65536,
    supportsJson: true,
    supportsGrounding: true,
    notes: "Frontier reasoning model. Best for Red Team, Investment Memo, deep analysis.",
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
    notes: "Fast/cheap Gemini 3.1. Best for Capital Stack, Deal Scoring, Market Scan, consensus support.",
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
// The only Gemini IDs valid on the production GEMINI_API_KEY (validated live).
// Direct-API call sites must resolve to one of these; anything else read from
// config (e.g. a stale model_configs row) must fall back to a valid default.

export const GEMINI_STRONG = "gemini-3.1-pro-preview";
export const GEMINI_FAST = "gemini-3.1-flash-lite";
export const VALID_GEMINI_IDS = new Set<string>([GEMINI_STRONG, GEMINI_FAST]);

export function toValidGeminiId(id: string | null | undefined, fallback: string): string {
  return id && VALID_GEMINI_IDS.has(id) ? id : fallback;
}

// ─── Default Module → Model Assignments ──────────────────────────────────────

export const DEFAULT_MODULE_MODELS: Record<AnalysisModule, string> = {
  ownerPsychology: "Claude-Opus-4.7",
  digitalAudit: "sonar-pro",
  redTeam: GEMINI_STRONG,
  capitalStack: GEMINI_FAST,
  investmentMemo: GEMINI_STRONG,
  dealScoring: GEMINI_FAST,
  marketScan: GEMINI_FAST,
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
