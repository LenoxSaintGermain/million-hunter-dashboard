/**
 * Signal Hunter — AI Model Registry
 *
 * Single source of truth for all available models across providers.
 * Includes experimental models (Gemini 3.1 Pro, etc.) — use them freely,
 * Google is generous with rate limits on experimental tiers.
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
  // ── Google Gemini 3.1 (Preview — direct API) ───────────────────────────────
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
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash (Preview)",
    provider: "google",
    tier: "preview",
    contextWindow: 1000000,
    outputLimit: 32768,
    supportsJson: true,
    supportsGrounding: true,
    notes: "Fast frontier model. Best for Capital Stack, Consensus scoring.",
  },
  {
    id: "gemini-3.1-flash-lite-preview",
    label: "Gemini 3.1 Flash-Lite (Preview)",
    provider: "google",
    tier: "lite",
    contextWindow: 1000000,
    outputLimit: 16384,
    supportsJson: true,
    supportsGrounding: false,
    notes: "Fastest/cheapest Gemini 3.x. Best for Deal Scoring, Market Scan.",
  },
  // ── Google Gemini — Stable ────────────────────────────────────────────────
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "google",
    tier: "stable",
    contextWindow: 1000000,
    outputLimit: 65536,
    supportsJson: true,
    supportsGrounding: true,
    notes: "Best reasoning + long context. Recommended for memos and red team.",
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "google",
    tier: "fast",
    contextWindow: 1000000,
    outputLimit: 32768,
    supportsJson: true,
    supportsGrounding: true,
    notes: "Best price/performance. Recommended for scoring and capital stack.",
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    provider: "google",
    tier: "lite",
    contextWindow: 1000000,
    outputLimit: 16384,
    supportsJson: true,
    supportsGrounding: false,
    notes: "Cheapest/fastest. High-volume extraction tasks.",
  },
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    provider: "google",
    tier: "fast",
    contextWindow: 1000000,
    outputLimit: 8192,
    supportsJson: true,
    supportsGrounding: true,
    notes: "Previous gen fast model. Use 2.5 Flash instead.",
  },
  {
    id: "gemini-2.0-flash-lite",
    label: "Gemini 2.0 Flash-Lite",
    provider: "google",
    tier: "lite",
    contextWindow: 1000000,
    outputLimit: 8192,
    supportsJson: false,
    supportsGrounding: false,
  },
  {
    id: "gemini-1.5-pro",
    label: "Gemini 1.5 Pro",
    provider: "google",
    tier: "stable",
    contextWindow: 2000000,
    outputLimit: 8192,
    supportsJson: true,
    supportsGrounding: false,
    notes: "Legacy. Use 2.5 Pro instead.",
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

// ─── Default Module → Model Assignments ──────────────────────────────────────

export const DEFAULT_MODULE_MODELS: Record<AnalysisModule, string> = {
  ownerPsychology: "Claude-Opus-4.7",
  digitalAudit: "sonar-pro",
  redTeam: "gemini-3.1-pro-preview",
  capitalStack: "gemini-3-flash-preview",
  investmentMemo: "gemini-3.1-pro-preview",
  dealScoring: "gemini-3.1-flash-lite-preview",
  marketScan: "gemini-3.1-flash-lite-preview",
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
