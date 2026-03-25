/**
 * Signal Hunter — AI Model Registry
 *
 * Single source of truth for all available models across providers.
 * Includes experimental models (Gemini 3.1 Pro, etc.) — use them freely,
 * Google is generous with rate limits on experimental tiers.
 */

export type ModelProvider = "google" | "openai" | "perplexity";
export type ModelTier = "experimental" | "stable" | "fast" | "lite";

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
  // ── Google Gemini — Experimental ──────────────────────────────────────────
  {
    id: "gemini-3.1-pro-exp",
    label: "Gemini 3.1 Pro (Experimental)",
    provider: "google",
    tier: "experimental",
    contextWindow: 2000000,
    outputLimit: 65536,
    supportsJson: true,
    supportsGrounding: true,
    notes: "Latest frontier model. Generous rate limits on experimental tier.",
  },
  {
    id: "gemini-3.0-pro-exp",
    label: "Gemini 3.0 Pro (Experimental)",
    provider: "google",
    tier: "experimental",
    contextWindow: 2000000,
    outputLimit: 65536,
    supportsJson: true,
    supportsGrounding: true,
  },
  {
    id: "gemini-3.0-flash-exp",
    label: "Gemini 3.0 Flash (Experimental)",
    provider: "google",
    tier: "experimental",
    contextWindow: 1000000,
    outputLimit: 32768,
    supportsJson: true,
    supportsGrounding: true,
    notes: "Fast experimental model with grounding.",
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
  // ── OpenAI ────────────────────────────────────────────────────────────────
  {
    id: "gpt-5.4",
    label: "GPT-5.4",
    provider: "openai",
    tier: "stable",
    contextWindow: 128000,
    outputLimit: 16384,
    supportsJson: true,
    supportsGrounding: false,
    notes: "OpenAI flagship. Best for nuanced language/behavioral analysis.",
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 Mini",
    provider: "openai",
    tier: "fast",
    contextWindow: 128000,
    outputLimit: 16384,
    supportsJson: true,
    supportsGrounding: false,
    notes: "Faster/cheaper GPT-5.4 variant.",
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "openai",
    tier: "stable",
    contextWindow: 128000,
    outputLimit: 16384,
    supportsJson: true,
    supportsGrounding: false,
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "openai",
    tier: "fast",
    contextWindow: 128000,
    outputLimit: 16384,
    supportsJson: true,
    supportsGrounding: false,
  },
  // ── Perplexity ────────────────────────────────────────────────────────────
  {
    id: "sonar-pro",
    label: "Perplexity Sonar Pro",
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
    tier: "experimental",
    contextWindow: 127072,
    outputLimit: 8000,
    supportsJson: false,
    supportsGrounding: true,
    notes: "Multi-step autonomous research. Slower but most thorough.",
  },
];

// ─── Default Module → Model Assignments ──────────────────────────────────────

export const DEFAULT_MODULE_MODELS: Record<AnalysisModule, string> = {
  ownerPsychology: "gpt-5.4",
  digitalAudit: "sonar-pro",
  redTeam: "gemini-3.1-pro-exp",
  capitalStack: "gemini-2.5-flash",
  investmentMemo: "gemini-3.1-pro-exp",
  dealScoring: "gemini-2.5-flash",
  marketScan: "gemini-2.5-flash-lite",
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
