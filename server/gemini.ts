/**
 * AI Service Layer — Signal Hunter
 *
 * Model routing:
 *   Google Gemini (direct API) — all Gemini tasks. Only two IDs are valid on
 *   the production key (see shared/models.ts model policy):
 *     gemini-3.1-pro-preview → Deep reasoning: Red Team, investment memo synthesis
 *     gemini-3.1-flash-lite  → Fast structured extraction, capital stack math,
 *                              high-volume scoring, market scan
 *
 *   Poe API (OpenAI-compatible gateway) — non-Gemini models:
 *     Claude-Opus-4           → Owner Psychology profiling (nuanced language analysis)
 *
 *   Perplexity Sonar Pro (direct) — live web research:
 *     Claude-Opus-4 (Poe)     → Digital Footprint Audit
 */

import { GoogleGenAI } from "@google/genai";
import { poeJSON, POE_MODELS } from "./poe";
import { GEMINI_STRONG, GEMINI_FAST } from "../shared/models";
import type { Deal } from "../drizzle/schema";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ─── Gemini model IDs (single source of truth: shared/models.ts) ─────────────
const GEMINI_PRO    = GEMINI_STRONG;
const GEMINI_FLASH  = GEMINI_FAST;
const GEMINI_LITE   = GEMINI_FAST;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface OwnerPsychologyResult {
  distressScore: number;        // 0-1
  retirementSignal: boolean;
  negotiationStyle: "collaborative" | "adversarial" | "desperate";
  profileSummary: string;
}

export interface DigitalAuditResult {
  techDebtScore: number;        // 0-1
  growthTrend: "growing" | "stable" | "declining";
  seoAuthorityScore: number;    // 0-100
  reviewSentimentScore: number; // -1 to 1
  auditSummary: string;
}

export interface RedTeamResult {
  killProbability: number;      // 0-1
  redFlags: string[];
  summary: string;
}

export interface CapitalStackResult {
  sbaEligible: boolean;
  sbaAmount: number;
  sellerNote: number;
  equity: number;
  dscr: number;
  cashOnCashReturn: number;
  summary: string;
}

export interface InvestmentMemoResult {
  title: string;
  content: string;              // Full markdown memo
  executiveSummary: string;
  investmentThesis: string;
  riskFactors: string[];
  aiOptimizationOpportunities: string[];
}

// ─── Owner Psychology (Claude 4 Opus via Poe) ───────────────────────────────
export async function analyzeOwnerPsychology(deal: Deal): Promise<OwnerPsychologyResult> {
  const prompt = `You are an expert M&A psychologist and negotiation strategist. Analyze this business listing and infer the seller's psychological profile and motivation.

Business: ${deal.name}
Industry: ${deal.industry ?? "Unknown"}
Location: ${deal.location ?? "Unknown"}
Revenue: $${deal.revenue?.toLocaleString() ?? "N/A"}
Cash Flow: $${deal.cashFlow?.toLocaleString() ?? "N/A"}
Asking Price: $${deal.askingPrice?.toLocaleString() ?? "N/A"}
Multiple: ${deal.multiple ?? "N/A"}x
Year Established: ${deal.yearEstablished ?? "N/A"}
Description: ${deal.description ?? "No description provided"}

Analyze and return a JSON object with:
- distressScore: number 0-1 (1 = highly distressed/motivated seller)
- retirementSignal: boolean (true if retirement is likely motivation)
- negotiationStyle: "collaborative" | "adversarial" | "desperate"
- profileSummary: string (2-3 sentence analysis of seller psychology and recommended approach)`;

  try {
    const parsed = await poeJSON<OwnerPsychologyResult>({
      model: POE_MODELS.CLAUDE_OPUS,
      systemPrompt: "You are an expert M&A psychologist. Return only valid JSON with no markdown.",
      userPrompt: prompt,
      maxTokens: 512,
      temperature: 0.3,
    });
    return {
      distressScore: Math.min(1, Math.max(0, parsed.distressScore ?? 0.5)),
      retirementSignal: parsed.retirementSignal ?? false,
      negotiationStyle: parsed.negotiationStyle ?? "collaborative",
      profileSummary: parsed.profileSummary ?? "Insufficient data for psychological profiling.",
    };
  } catch (poeErr: any) {
    // Fall back to Gemini 3.1 Pro if Poe is unavailable
    console.warn("[OwnerPsychology] Poe unavailable, falling back to Gemini:", poeErr?.message);
    try {
      const fallbackResponse = await genai.models.generateContent({
        model: GEMINI_PRO,
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });
      const parsed = JSON.parse(fallbackResponse.text ?? "{}");
      return {
        distressScore: Math.min(1, Math.max(0, parsed.distressScore ?? 0.5)),
        retirementSignal: parsed.retirementSignal ?? false,
        negotiationStyle: parsed.negotiationStyle ?? "collaborative",
        profileSummary: `[Gemini Fallback] ${parsed.profileSummary ?? "Insufficient data for psychological profiling."}`,
      };
    } catch {
      return { distressScore: 0.5, retirementSignal: false, negotiationStyle: "collaborative", profileSummary: "Analysis unavailable." };
    }
  }
}

// ─── Digital Footprint Audit (Claude-Opus-4 via Poe) ───────────────────────
export async function runDigitalAudit(deal: Deal): Promise<DigitalAuditResult> {
  const { poeJSON, POE_MODELS } = await import("./poe");
  const prompt = `Research the digital footprint of this business and return a JSON analysis:
Business Name: ${deal.name}
Location: ${deal.location ?? "Unknown"}
Industry: ${deal.industry ?? "Unknown"}
Analyze: online reviews, website quality, social media presence, Google Business profile, tech stack indicators, and growth signals.
Return JSON with:
- techDebtScore: number 0-1 (1 = very outdated tech/systems)
- growthTrend: "growing" | "stable" | "declining"
- seoAuthorityScore: number 0-100
- reviewSentimentScore: number -1 to 1 (based on review sentiment)
- auditSummary: string (3-4 sentence summary of digital health and key opportunities/risks)
Return ONLY valid JSON.`;
  try {
    const parsed = await poeJSON<{
      techDebtScore: number;
      growthTrend: string;
      seoAuthorityScore: number;
      reviewSentimentScore: number;
      auditSummary: string;
    }>({
      model: POE_MODELS.CLAUDE_OPUS,
      systemPrompt: "You are a digital due diligence analyst specializing in Main Street business acquisitions. Return only valid JSON.",
      userPrompt: prompt,
      maxTokens: 1000,
    });
    return {
      techDebtScore: Math.min(1, Math.max(0, parsed.techDebtScore ?? 0.5)),
      growthTrend: (parsed.growthTrend as "growing" | "stable" | "declining") ?? "stable",
      seoAuthorityScore: Math.min(100, Math.max(0, parsed.seoAuthorityScore ?? 30)),
      reviewSentimentScore: Math.min(1, Math.max(-1, parsed.reviewSentimentScore ?? 0)),
      auditSummary: parsed.auditSummary ?? "Digital audit completed.",
    };
  } catch (e) {
    return { techDebtScore: 0.5, growthTrend: "stable", seoAuthorityScore: 30, reviewSentimentScore: 0, auditSummary: "Digital audit failed." };
  }
}

// ─── Red Team Analysis (Gemini 3.1 Pro — direct) ─────────────────────────────
export async function runRedTeamAnalysis(deal: Deal): Promise<RedTeamResult> {
  const prompt = `You are a ruthless Devil's Advocate for a private equity firm. Your ONLY job is to find reasons NOT to buy this business. Be specific, data-driven, and brutal.

Business: ${deal.name}
Industry: ${deal.industry ?? "Unknown"}
Location: ${deal.location ?? "Unknown"}
Revenue: $${deal.revenue?.toLocaleString() ?? "N/A"}
Cash Flow: $${deal.cashFlow?.toLocaleString() ?? "N/A"}
Asking Price: $${deal.askingPrice?.toLocaleString() ?? "N/A"}
Multiple: ${deal.multiple ?? "N/A"}x
Employees: ${deal.employees ?? "N/A"}
Year Established: ${deal.yearEstablished ?? "N/A"}
Description: ${deal.description ?? "No description provided"}

Analyze for: customer concentration risk, key man dependency, industry disruption risk, regulatory exposure, market saturation, operational complexity, and deal structure risks.

Return JSON with:
- killProbability: number 0-1 (1 = definitely kill this deal)
- redFlags: string[] (list of specific red flags, max 6)
- summary: string (2-3 sentence Devil's Advocate summary)

Return ONLY valid JSON.`;

  try {
    const response = await genai.models.generateContent({
      model: GEMINI_PRO,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    });
    const text = response.text ?? "{}";
    const parsed = JSON.parse(text);
    return {
      killProbability: Math.min(1, Math.max(0, parsed.killProbability ?? 0.3)),
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags.slice(0, 6) : [],
      summary: parsed.summary ?? "Red team analysis completed.",
    };
  } catch {
    return { killProbability: 0.3, redFlags: ["Analysis unavailable"], summary: "Red team analysis failed." };
  }
}

// ─── Capital Stack Wizard (Gemini 3 Flash — direct) ──────────────────────────
export async function buildCapitalStack(deal: Deal): Promise<CapitalStackResult> {
  const askingPrice = deal.askingPrice ?? 0;
  const cashFlow = deal.cashFlow ?? 0;
  const revenue = deal.revenue ?? 0;

  const prompt = `You are an SBA loan officer and acquisition finance expert. Model the optimal capital structure for this acquisition.

Business: ${deal.name}
Asking Price: $${askingPrice.toLocaleString()}
Annual Cash Flow (SDE): $${cashFlow.toLocaleString()}
Annual Revenue: $${revenue.toLocaleString()}
Multiple: ${deal.multiple ?? (askingPrice / (cashFlow || 1)).toFixed(2)}x
Industry: ${deal.industry ?? "Unknown"}

SBA rules (effective July 4, 2026 — NEW): Combined SBA 7(a) + 504 cap is now $10M total (up from $5M).
- SBA 7(a): up to $5M, general business acquisition, 10-year term at ~7.5% interest, 10% down minimum.
- SBA 504: up to $5M additional, for fixed assets (real estate, equipment), 20-year term at ~6.5% fixed.
- Combined 7(a)+504 stack: use when asking price is $5M-$10M and deal includes real estate or equipment.
- Seller financing can count toward the 10% equity injection (standby note), enabling 0% out-of-pocket.
- DSCR kill floor: 1.15x for Preferred Lender Program (PLP) banks; 1.25x for standard lenders.
Seller note: typically 10-20% of purchase price, subordinated.
Equity: remaining balance.

Calculate DSCR = Annual Cash Flow / Annual Debt Service.
Target DSCR >= 1.15 (PLP minimum). Flag if below 1.25 as standard lender risk.

Return JSON with:
- sbaEligible: boolean
- sbaAmount: number (dollar amount)
- sellerNote: number (dollar amount)
- equity: number (dollar amount, buyer's cash injection)
- dscr: number (debt service coverage ratio)
- cashOnCashReturn: number (year 1 cash-on-cash return as decimal, e.g. 0.22 = 22%)
- summary: string (2-3 sentence capital stack recommendation)

Return ONLY valid JSON.`;

  try {
    const response = await genai.models.generateContent({
      model: GEMINI_FLASH,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    });
    const text = response.text ?? "{}";
    const parsed = JSON.parse(text);
    return {
      sbaEligible: parsed.sbaEligible ?? true,
      sbaAmount: parsed.sbaAmount ?? Math.min(10000000, askingPrice * 0.8),
      sellerNote: parsed.sellerNote ?? askingPrice * 0.1,
      equity: parsed.equity ?? askingPrice * 0.1,
      dscr: parsed.dscr ?? (cashFlow / (askingPrice * 0.09) || 1.0),
      cashOnCashReturn: parsed.cashOnCashReturn ?? 0.2,
      summary: parsed.summary ?? "Capital stack modeled.",
    };
  } catch {
    const sbaAmount = Math.min(10000000, askingPrice * 0.8);
    const sellerNote = askingPrice * 0.1;
    const equity = askingPrice - sbaAmount - sellerNote;
    const annualDebtService = sbaAmount * 0.09;
    return {
      sbaEligible: askingPrice <= 10500000,
      sbaAmount,
      sellerNote,
      equity,
      dscr: cashFlow / (annualDebtService || 1),
      cashOnCashReturn: (cashFlow - annualDebtService) / (equity || 1),
      summary: "Capital stack modeled using standard SBA 7(a) parameters.",
    };
  }
}

// ─── Investment Memo (Gemini 3.1 Pro — direct) ───────────────────────────────
export async function generateInvestmentMemo(
  deal: Deal,
  signals?: {
    ownerProfile?: string;
    digitalAudit?: string;
    redTeam?: string;
    capitalStack?: string;
  }
): Promise<InvestmentMemoResult> {
  const prompt = `You are a senior M&A analyst at a top-tier private equity firm. Write a comprehensive investment memo for this acquisition opportunity.

DEAL OVERVIEW:
- Business: ${deal.name}
- Industry: ${deal.industry ?? "Unknown"} | Location: ${deal.location ?? "Unknown"}
- Revenue: $${deal.revenue?.toLocaleString() ?? "N/A"} | Cash Flow: $${deal.cashFlow?.toLocaleString() ?? "N/A"}
- Asking Price: $${deal.askingPrice?.toLocaleString() ?? "N/A"} | Multiple: ${deal.multiple ?? "N/A"}x
- Employees: ${deal.employees ?? "N/A"} | Est. ${deal.yearEstablished ?? "N/A"}
- Description: ${deal.description ?? "No description provided"}

THIRD SIGNAL INTELLIGENCE:
${signals?.ownerProfile ? `Owner Psychology: ${signals.ownerProfile}` : ""}
${signals?.digitalAudit ? `Digital Audit: ${signals.digitalAudit}` : ""}
${signals?.redTeam ? `Red Team: ${signals.redTeam}` : ""}
${signals?.capitalStack ? `Capital Stack: ${signals.capitalStack}` : ""}

Write a professional investment memo in Markdown format with these sections:
1. Executive Summary (3-4 sentences)
2. Business Overview
3. Investment Thesis (why buy this business)
4. AI Optimization Opportunities (specific ways to use AI to improve margins/operations)
5. Risk Factors & Mitigants
6. Capital Structure & Returns
7. Recommendation

Return JSON with:
- title: string (memo title)
- content: string (full markdown memo)
- executiveSummary: string
- investmentThesis: string
- riskFactors: string[] (top 4-5 risks)
- aiOptimizationOpportunities: string[] (top 4-5 AI opportunities)

Return ONLY valid JSON.`;

  try {
    const response = await genai.models.generateContent({
      model: GEMINI_PRO,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    });
    const text = response.text ?? "{}";
    const parsed = JSON.parse(text);
    return {
      title: parsed.title ?? `Investment Memo: ${deal.name}`,
      content: parsed.content ?? "# Investment Memo\n\nGeneration failed.",
      executiveSummary: parsed.executiveSummary ?? "",
      investmentThesis: parsed.investmentThesis ?? "",
      riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
      aiOptimizationOpportunities: Array.isArray(parsed.aiOptimizationOpportunities) ? parsed.aiOptimizationOpportunities : [],
    };
  } catch (e: any) {
    // Throw instead of returning a fake memo: the route must not persist a
    // "Generation failed" document as if it were a real memo (cache-first
    // reads would then serve the failure forever).
    console.error(`[InvestmentMemo] Generation failed for "${deal.name}" (model ${GEMINI_PRO}):`, e?.message ?? e);
    throw new Error(`Memo generation failed for ${deal.name}: ${e?.message ?? "unknown error"}`);
  }
}

// ─── Composite Scorer ────────────────────────────────────────────────────────
// TSL-DIM-CAP-STACK-001  Capital Stack Compatibility  — real LTV/DSCR logic
// TSL-DIM-OPS-ALPHA-001  Operational Alpha            — real industry/employee scoring
// TSL-DIM-MACRO-ARB-001  Macro Arbitrage Exposure     — real TIDE signal overlap

/**
 * TSL-DIM-CAP-STACK-001 — Capital Stack Compatibility
 *
 * Scores how well the deal's financials fit standard SBA/seller-note capital structures.
 * Uses three sub-signals:
 *   1. DSCR (Debt Service Coverage Ratio) — cash flow vs estimated annual debt service
 *   2. LTV (Loan-to-Value) — asking price vs SBA-eligible LTV ceiling (90%)
 *   3. Equity check — buyer equity injection as % of asking price (target ≤ 20%)
 *
 * Scoring bands:
 *   DSCR ≥ 1.35 → 1.0 | 1.25–1.35 → 0.8 | 1.10–1.25 → 0.5 | < 1.10 → 0.2
 *   LTV ≤ 80%   → 1.0 | 80–90%    → 0.7 | 90–100%   → 0.4 | > 100% → 0.1
 *   Equity ≤ 10% → 1.0 | 10–20%   → 0.7 | 20–30%    → 0.4 | > 30%  → 0.2
 */
function scoreCapitalStackCompatibility(deal: Deal): number {
  const cashFlow = deal.cashFlow ?? 0;
  const askingPrice = deal.askingPrice ?? 0;

  if (askingPrice <= 0 || cashFlow <= 0) return 0.3; // insufficient data — below neutral

  // Estimate annual debt service: SBA 7(a) at 90% LTV, 10-year term, ~11.5% rate
  // Monthly payment formula: P * r / (1 - (1+r)^-n)
  const loanAmount = askingPrice * 0.90;
  const monthlyRate = 0.115 / 12;
  const nMonths = 120; // 10-year SBA
  const monthlyPayment = loanAmount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -nMonths));
  const annualDebtService = monthlyPayment * 12;

  // Sub-signal 1: DSCR
  const dscr = cashFlow / annualDebtService;
  const dscrScore = dscr >= 1.35 ? 1.0
    : dscr >= 1.25 ? 0.8
    : dscr >= 1.10 ? 0.5
    : 0.2;

  // Sub-signal 2: LTV (asking price vs appraised value — use asking as proxy)
  // SBA ceiling is 90% LTV; below 80% is ideal
  const ltv = (loanAmount / askingPrice) * 100;
  const ltvScore = ltv <= 80 ? 1.0
    : ltv <= 90 ? 0.7
    : ltv <= 100 ? 0.4
    : 0.1;

  // Sub-signal 3: Equity injection required (10% of asking = SBA minimum)
  const equityPct = (askingPrice * 0.10) / askingPrice * 100; // always 10% for SBA
  // Adjust: if DSCR is strong, seller note can reduce equity; if weak, equity rises
  const effectiveEquityPct = dscr >= 1.25 ? 10 : dscr >= 1.10 ? 15 : 25;
  const equityScore = effectiveEquityPct <= 10 ? 1.0
    : effectiveEquityPct <= 20 ? 0.7
    : effectiveEquityPct <= 30 ? 0.4
    : 0.2;

  // Weighted composite: DSCR is most critical for SBA approval
  return Math.min(1, dscrScore * 0.55 + ltvScore * 0.25 + equityScore * 0.20);
}

/**
 * TSL-DIM-OPS-ALPHA-001 — Operational Alpha
 *
 * Scores the operational leverage potential — how much value can be unlocked
 * post-acquisition through AI, process optimization, and route/recurring model scaling.
 *
 * Scoring factors:
 *   1. Industry archetype — route-based / recurring / fragmented = high alpha
 *   2. Revenue per employee — lean operations = more automation headroom
 *   3. Owner-dependency signals — keywords in description suggesting key-man risk
 *   4. Employee count — smaller teams are easier to optimize; >100 = complexity penalty
 */
function scoreOperationalAlpha(deal: Deal): number {
  const industry = (deal.industry ?? "").toLowerCase();
  const description = (deal.description ?? "").toLowerCase();
  const employees = deal.employees ?? 0;
  const revenue = deal.revenue ?? 0;

  // Sub-signal 1: Industry archetype
  // Route-based and recurring-revenue businesses have the highest AI/ops leverage
  const highAlphaIndustries = [
    "pest control", "hvac", "plumbing", "cleaning", "janitorial",
    "landscaping", "lawn", "pool", "fire protection", "security",
    "waste", "recycling", "laundry", "vending", "route",
  ];
  const medAlphaIndustries = [
    "logistics", "delivery", "trucking", "freight", "staffing",
    "healthcare", "dental", "medical", "childcare", "auto repair",
    "printing", "signage", "restoration",
  ];
  const isHighAlpha = highAlphaIndustries.some(kw => industry.includes(kw));
  const isMedAlpha = medAlphaIndustries.some(kw => industry.includes(kw));
  const industryScore = isHighAlpha ? 1.0 : isMedAlpha ? 0.65 : 0.35;

  // Sub-signal 2: Revenue per employee (higher = leaner = more automation headroom)
  let revPerEmpScore = 0.5; // default if no employee data
  if (employees > 0 && revenue > 0) {
    const revPerEmp = revenue / employees;
    revPerEmpScore = revPerEmp >= 300000 ? 1.0  // $300K+ per head = very lean
      : revPerEmp >= 200000 ? 0.8
      : revPerEmp >= 100000 ? 0.55
      : 0.3; // labor-heavy
  }

  // Sub-signal 3: Owner-dependency penalty
  // Keywords that indicate the business is tied to the owner's personal relationships
  const ownerDependencyKeywords = [
    "owner operated", "owner-operated", "owner runs", "owner manages",
    "family run", "family-run", "founder led", "founder-led",
    "key relationships", "personal relationships", "owner's clients",
    "owner will train", "absentee not possible",
  ];
  const hasOwnerDependency = ownerDependencyKeywords.some(kw => description.includes(kw));
  const ownerPenalty = hasOwnerDependency ? 0.25 : 0;

  // Sub-signal 4: Team size score (smaller = easier to optimize)
  const teamScore = employees === 0 ? 0.5  // unknown
    : employees <= 10 ? 1.0
    : employees <= 25 ? 0.8
    : employees <= 50 ? 0.6
    : employees <= 100 ? 0.4
    : 0.2; // 100+ = complexity risk

  const raw = industryScore * 0.40 + revPerEmpScore * 0.30 + teamScore * 0.30;
  return Math.min(1, Math.max(0, raw - ownerPenalty));
}

/**
 * TSL-DIM-MACRO-ARB-001 — Macro Arbitrage Exposure
 *
 * Scores the deal's alignment with active macro tailwinds in the macro_signals table.
 * Queries live signals and cross-references impacted_asset_classes against the deal's
 * industry, and affected_geography against the deal's location.
 *
 * This function is synchronous — it accepts pre-fetched signals to avoid async in scorer.
 * The caller (scoreDeal) fetches signals once and passes them in.
 *
 * Scoring:
 *   - Each matching signal contributes: confidence_score * directionMultiplier
 *   - direction='tailwind' → positive; direction='headwind' → negative
 *   - Score = clamp(sum / normalization_factor, 0, 1)
 *   - No matching signals → 0.35 (neutral-low, not zero — unknown ≠ bad)
 */
function scoreMacroArbitrageFromSignals(
  deal: Deal,
  signals: Array<{
    title: string;
    signal_type: string;
    confidence_score: string | number;
    impacted_asset_classes: string[] | null;
    affected_naics: string[] | null;
    affected_geography: string[] | null;
    direction: string | null;
  }>
): number {
  const industry = (deal.industry ?? "").toLowerCase();
  const location = (deal.location ?? "").toLowerCase();

  if (signals.length === 0) return 0.35;

  let matchScore = 0;
  let matchCount = 0;

  for (const sig of signals) {
    const conf = parseFloat(String(sig.confidence_score)) || 0;
    const direction = sig.direction ?? "tailwind";
    const dirMult = direction === "headwind" ? -1 : 1;

    // Check industry match via impacted_asset_classes
    const assetClasses = sig.impacted_asset_classes ?? [];
    const industryMatch = assetClasses.some(ac => {
      const acLower = ac.toLowerCase();
      return industry.includes(acLower) || acLower.includes(industry.split(" ")[0]);
    });

    // Check location match via affected_geography
    const geoList = sig.affected_geography ?? [];
    const locationMatch = geoList.length === 0 // no geo restriction = national signal
      || geoList.some(geo => {
        const geoLower = geo.toLowerCase();
        return location.includes(geoLower) || geoLower.includes(location.split(",")[0].trim());
      });

    // Signal must match industry OR be a broad macro signal (macro_momentum/seasonal with no geo)
    const isBroadSignal = (sig.signal_type === "macro_momentum" || sig.signal_type === "seasonal")
      && geoList.length === 0;

    if (industryMatch && locationMatch) {
      // Strong match: industry + location aligned
      matchScore += conf * dirMult * 1.0;
      matchCount++;
    } else if (industryMatch && isBroadSignal) {
      // Partial match: industry aligned, national signal
      matchScore += conf * dirMult * 0.6;
      matchCount++;
    } else if (locationMatch && geoList.length > 0) {
      // Location match only — some relevance
      matchScore += conf * dirMult * 0.3;
      matchCount++;
    }
  }

  if (matchCount === 0) return 0.35; // no relevant signals found

  // Normalize: 3 strong signals at 0.9 confidence = perfect score
  const normalized = matchScore / (3 * 0.9);
  return Math.min(1, Math.max(0, 0.35 + normalized * 0.65));
}

export async function scoreDeal(deal: Deal): Promise<{ score: number; redFlagCount: number; dimensions?: Record<string, number> }> {
  const cashFlow = deal.cashFlow ?? 0;
  const revenue = deal.revenue ?? 0;
  const askingPrice = deal.askingPrice ?? 1;
  const multiple = deal.multiple ?? (askingPrice / (cashFlow || 1));

  // Dimension 1: Financial Health (40% weight)
  const marginScore = revenue > 0 ? Math.min(1, cashFlow / revenue / 0.4) : 0;
  const multipleScore = multiple > 0 ? Math.max(0, 1 - (multiple - 2) / 4) : 0;
  const sizeScore = cashFlow >= 1000000 ? 1 : cashFlow >= 500000 ? 0.7 : cashFlow >= 250000 ? 0.4 : 0.2;
  const financialScore = marginScore * 0.4 + multipleScore * 0.35 + sizeScore * 0.25;

  // Dimension 2: Strategic / Industry Fit (20% weight)
  const industryBonus = ["hvac", "plumbing", "pest control", "cleaning", "logistics", "healthcare"].some(
    (kw) => (deal.industry ?? "").toLowerCase().includes(kw)
  ) ? 0.8 : 0.5;

  // Dimension 3: Deal Structure (10% weight)
  const dealScore = multiple <= 3 ? 1 : multiple <= 4 ? 0.7 : 0.4;

  // Dimension 4: Capital Stack Compatibility (15% weight) — TSL-DIM-CAP-STACK-001
  const capitalStackScore = scoreCapitalStackCompatibility(deal);

  // Dimension 5: Operational Alpha (10% weight) — TSL-DIM-OPS-ALPHA-001
  const operationalAlphaScore = scoreOperationalAlpha(deal);

  // Dimension 6: Macro Arbitrage Exposure (5% weight) — TSL-DIM-MACRO-ARB-001
  // Fetch active macro signals once; pass to synchronous scorer
  let macroArbitrageScore = 0.35; // safe default if DB unavailable
  try {
    const { getDb } = await import("./db.js");
    const db = await getDb();
    if (db) {
      const [rows] = await db.execute(
        "SELECT title, signal_type, confidence_score, impacted_asset_classes, affected_naics, affected_geography, direction FROM macro_signals WHERE archived = 0 LIMIT 50"
      ) as any;
      const signals = Array.isArray(rows) ? rows : [];
      macroArbitrageScore = scoreMacroArbitrageFromSignals(deal, signals);
    }
  } catch {
    // DB unavailable — keep default 0.35
  }

  const score =
    0.40 * financialScore +
    0.20 * industryBonus +
    0.10 * dealScore +
    0.15 * capitalStackScore +
    0.10 * operationalAlphaScore +
    0.05 * macroArbitrageScore;

  const redFlagCount = [
    multiple > 5,
    cashFlow < 300000,
    (deal.employees ?? 0) > 100,
  ].filter(Boolean).length;

  const dimensions = {
    financial: financialScore,
    strategic: industryBonus,
    dealStructure: dealScore,
    capitalStackCompatibility: capitalStackScore,
    operationalAlpha: operationalAlphaScore,
    macroArbitrage: macroArbitrageScore,
  };

  return { score: Math.min(1, Math.max(0, score)), redFlagCount, dimensions };
}
