/**
 * AI Service Layer — Signal Hunter
 *
 * Model routing:
 *   Google Gemini (direct API) — all Gemini tasks:
 *     gemini-3.1-pro-preview    → Deep reasoning: Red Team, investment memo synthesis
 *     gemini-3-flash-preview    → Fast structured extraction, capital stack math
 *     gemini-3.1-flash-lite-preview → High-volume scoring, market scan
 *
 *   Poe API (OpenAI-compatible gateway) — non-Gemini models:
 *     Claude-Opus-4.7           → Owner Psychology profiling (nuanced language analysis)
 *
 *   Perplexity Sonar Pro (direct) — live web research:
 *     sonar-pro                 → Digital Footprint Audit
 */

import { GoogleGenAI } from "@google/genai";
import { poeJSON, POE_MODELS } from "./poe";
import type { Deal } from "../drizzle/schema";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ─── Gemini model IDs ─────────────────────────────────────────────────────────
const GEMINI_PRO    = "gemini-3.1-pro-preview";
const GEMINI_FLASH  = "gemini-3-flash-preview";
const GEMINI_LITE   = "gemini-3.1-flash-lite-preview";

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

// ─── Owner Psychology (Claude Opus 4.7 via Poe) ───────────────────────────────
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

// ─── Digital Footprint Audit (Perplexity Sonar Pro — direct) ─────────────────
export async function runDigitalAudit(deal: Deal): Promise<DigitalAuditResult> {
  const sonarApiKey = process.env.SONAR_API_KEY;
  if (!sonarApiKey) {
    return { techDebtScore: 0.5, growthTrend: "stable", seoAuthorityScore: 30, reviewSentimentScore: 0, auditSummary: "Perplexity API key not configured." };
  }

  const prompt = `Research the digital footprint of this business and return a JSON analysis:

Business Name: ${deal.name}
Location: ${deal.location ?? "Unknown"}
Industry: ${deal.industry ?? "Unknown"}

Search for: online reviews, website quality, social media presence, Google Business profile, tech stack indicators, and growth signals.

Return JSON with:
- techDebtScore: number 0-1 (1 = very outdated tech/systems)
- growthTrend: "growing" | "stable" | "declining"
- seoAuthorityScore: number 0-100
- reviewSentimentScore: number -1 to 1 (based on review sentiment)
- auditSummary: string (3-4 sentence summary of digital health and key opportunities/risks)

Return ONLY valid JSON.`;

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${sonarApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: "You are a digital due diligence analyst. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        return_citations: true,
      }),
    });
    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const text = data.choices?.[0]?.message?.content ?? "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    return {
      techDebtScore: Math.min(1, Math.max(0, parsed.techDebtScore ?? 0.5)),
      growthTrend: parsed.growthTrend ?? "stable",
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

SBA 7(a) rules: max $5M loan, 10% down minimum, 10-year term at ~7.5% interest.
Seller note: typically 10-20% of purchase price, subordinated.
Equity: remaining balance.

Calculate DSCR = Annual Cash Flow / Annual Debt Service.
Target DSCR >= 1.25.

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
      sbaAmount: parsed.sbaAmount ?? Math.min(5000000, askingPrice * 0.8),
      sellerNote: parsed.sellerNote ?? askingPrice * 0.1,
      equity: parsed.equity ?? askingPrice * 0.1,
      dscr: parsed.dscr ?? (cashFlow / (askingPrice * 0.09) || 1.0),
      cashOnCashReturn: parsed.cashOnCashReturn ?? 0.2,
      summary: parsed.summary ?? "Capital stack modeled.",
    };
  } catch {
    const sbaAmount = Math.min(5000000, askingPrice * 0.8);
    const sellerNote = askingPrice * 0.1;
    const equity = askingPrice - sbaAmount - sellerNote;
    const annualDebtService = sbaAmount * 0.09;
    return {
      sbaEligible: askingPrice <= 5500000,
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
  } catch (e) {
    return {
      title: `Investment Memo: ${deal.name}`,
      content: `# Investment Memo: ${deal.name}\n\nMemo generation failed. Please retry.`,
      executiveSummary: "Generation failed.",
      investmentThesis: "Generation failed.",
      riskFactors: [],
      aiOptimizationOpportunities: [],
    };
  }
}

// ─── Composite Scorer (rule-based, no LLM call) ───────────────────────────────
export async function scoreDeal(deal: Deal): Promise<{ score: number; redFlagCount: number }> {
  const cashFlow = deal.cashFlow ?? 0;
  const revenue = deal.revenue ?? 0;
  const askingPrice = deal.askingPrice ?? 1;
  const multiple = deal.multiple ?? (askingPrice / (cashFlow || 1));

  // Rule-based base score
  let score = 0;

  // Financial score (55% weight)
  const marginScore = revenue > 0 ? Math.min(1, cashFlow / revenue / 0.4) : 0;
  const multipleScore = multiple > 0 ? Math.max(0, 1 - (multiple - 2) / 4) : 0;
  const sizeScore = cashFlow >= 1000000 ? 1 : cashFlow >= 500000 ? 0.7 : cashFlow >= 250000 ? 0.4 : 0.2;
  score += 0.55 * (marginScore * 0.4 + multipleScore * 0.35 + sizeScore * 0.25);

  // Strategic score (30% weight) — heuristics
  const industryBonus = ["hvac", "plumbing", "pest control", "cleaning", "logistics", "healthcare"].some(
    (kw) => (deal.industry ?? "").toLowerCase().includes(kw)
  ) ? 0.8 : 0.5;
  score += 0.30 * industryBonus;

  // Deal structure (15% weight)
  const dealScore = multiple <= 3 ? 1 : multiple <= 4 ? 0.7 : 0.4;
  score += 0.15 * dealScore;

  const redFlagCount = [
    multiple > 5,
    cashFlow < 300000,
    (deal.employees ?? 0) > 100,
  ].filter(Boolean).length;

  return { score: Math.min(1, Math.max(0, score)), redFlagCount };
}
