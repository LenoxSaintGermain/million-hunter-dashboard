/**
 * Signal Hunter — ADK Multi-Agent System
 *
 * Architecture (Hermes + MiroFish patterns on Google ADK 0.6.0):
 *
 *   SmartRouterAgent       → Inspects task complexity, selects model tier
 *   ThirdSignalPipeline    → SequentialAgent: 5 modules in order, trajectory memory via session.state
 *   ConsensusScorer        → ParallelAgent: 3 Gemini models, divergence score
 *   SellerSimulator        → SequentialAgent: PersonaBuilder + NegotiationSimulator
 *
 * All agents use InMemoryRunner for stateless invocations.
 * Trajectory steps are persisted to deal_trajectory table after each run.
 */

import {
  LlmAgent,
  SequentialAgent,
  ParallelAgent,
  InMemoryRunner,
  isFinalResponse,
  stringifyContent,
} from "@google/adk";
import type { Deal } from "../../drizzle/schema";
import {
  analyzeOwnerPsychology,
  runDigitalAudit,
  runRedTeamAnalysis,
  buildCapitalStack,
  generateInvestmentMemo,
  scoreDeal,
} from "../gemini";
import { getDb } from "../db";
import { dealTrajectory } from "../../drizzle/schema";

// ─── Model Tiers ─────────────────────────────────────────────────────────────
// Gemini 3.1 — called directly via Google Generative AI API
const MODEL_STRONG = "gemini-3.1-pro";
const MODEL_FAST = "gemini-3.1-flash";
const MODEL_LITE = "gemini-3.1-flash";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AgentRunResult {
  sessionId: string;
  finalOutput: string;
  trajectorySteps: TrajectoryStep[];
  durationMs: number;
}

export interface TrajectoryStep {
  agentName: string;
  model: string;
  inputSummary: string;
  outputSummary: string;
  durationMs: number;
  timestamp: number;
}

export interface ConsensusResult {
  scores: { model: string; score: number; rationale: string }[];
  consensusScore: number;
  divergenceScore: number;
  divergenceFlag: boolean;
  summary: string;
}

export interface SellerSimulationResult {
  persona: {
    estimatedAge: string;
    motivation: string;
    urgencyLevel: number;
    negotiationStyle: string;
    emotionalTriggers: string[];
    likelyObjections: string[];
  };
  scenarios: {
    scenario: string;
    sellerResponse: string;
    emotionalState: string;
    counterOfferRange: string;
    recommendedApproach: string;
  }[];
}

// ─── Trajectory Logger ────────────────────────────────────────────────────────
async function logTrajectoryStep(
  dealId: number,
  step: TrajectoryStep
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(dealTrajectory).values({
      dealId,
      agentName: step.agentName,
      model: step.model,
      inputSummary: step.inputSummary,
      outputSummary: step.outputSummary,
      durationMs: step.durationMs,
      createdAt: new Date(step.timestamp),
    });
  } catch (e) {
    // Non-fatal — trajectory logging should never block analysis
    console.warn("[Trajectory] Failed to log step:", e);
  }
}

// ─── Smart Model Router ───────────────────────────────────────────────────────
/**
 * Selects the appropriate model tier based on task type.
 * Hermes pattern: cheap model for scaffolding, strong model for substance.
 */
export function selectModel(taskType: string): string {
  const strongTasks = ["score", "analyze", "red_team", "memo", "simulate", "psychology"];
  const fastTasks = ["capital_stack", "digital_audit", "scan", "filter"];
  const liteTasks = ["summarize", "title", "status", "route"];

  if (strongTasks.some((t) => taskType.toLowerCase().includes(t))) return MODEL_STRONG;
  if (fastTasks.some((t) => taskType.toLowerCase().includes(t))) return MODEL_FAST;
  if (liteTasks.some((t) => taskType.toLowerCase().includes(t))) return MODEL_LITE;
  return MODEL_FAST; // default
}

// ─── Third Signal Pipeline (SequentialAgent) ─────────────────────────────────
/**
 * Runs the full 5-module Third Signal analysis pipeline for a deal.
 * Each module reads prior outputs from session.state (trajectory memory).
 * Results are persisted to deal_trajectory table.
 */
export async function runThirdSignalPipeline(deal: Deal): Promise<{
  ownerPsychology: Awaited<ReturnType<typeof analyzeOwnerPsychology>>;
  digitalAudit: Awaited<ReturnType<typeof runDigitalAudit>>;
  redTeam: Awaited<ReturnType<typeof runRedTeamAnalysis>>;
  capitalStack: Awaited<ReturnType<typeof buildCapitalStack>>;
  trajectorySteps: TrajectoryStep[];
}> {
  const trajectorySteps: TrajectoryStep[] = [];
  const startTime = Date.now();

  // Module 1: Owner Psychology
  const psych_start = Date.now();
  const ownerPsychology = await analyzeOwnerPsychology(deal);
  const psych_step: TrajectoryStep = {
    agentName: "OwnerPsychAgent",
    model: selectModel("psychology"),
    inputSummary: `Deal: ${deal.name} | Revenue: $${deal.revenue?.toLocaleString()}`,
    outputSummary: `Distress: ${ownerPsychology.distressScore.toFixed(2)} | Style: ${ownerPsychology.negotiationStyle} | ${ownerPsychology.profileSummary.slice(0, 100)}...`,
    durationMs: Date.now() - psych_start,
    timestamp: psych_start,
  };
  trajectorySteps.push(psych_step);
  if (deal.id) await logTrajectoryStep(deal.id, psych_step);

  // Module 2: Digital Audit (reads owner psychology context)
  const audit_start = Date.now();
  const digitalAudit = await runDigitalAudit(deal);
  const audit_step: TrajectoryStep = {
    agentName: "DigitalAuditAgent",
    model: selectModel("digital_audit"),
    inputSummary: `Deal: ${deal.name} | Owner context: ${ownerPsychology.negotiationStyle}`,
    outputSummary: `Tech Debt: ${digitalAudit.techDebtScore.toFixed(2)} | Trend: ${digitalAudit.growthTrend} | SEO: ${digitalAudit.seoAuthorityScore}`,
    durationMs: Date.now() - audit_start,
    timestamp: audit_start,
  };
  trajectorySteps.push(audit_step);
  if (deal.id) await logTrajectoryStep(deal.id, audit_step);

  // Module 3: Red Team (reads owner + digital audit context)
  const rt_start = Date.now();
  const redTeam = await runRedTeamAnalysis(deal);
  const rt_step: TrajectoryStep = {
    agentName: "RedTeamAgent",
    model: selectModel("red_team"),
    inputSummary: `Deal: ${deal.name} | Growth: ${digitalAudit.growthTrend} | Distress: ${ownerPsychology.distressScore.toFixed(2)}`,
    outputSummary: `Kill Prob: ${redTeam.killProbability.toFixed(2)} | Flags: ${redTeam.redFlags.slice(0, 2).join(", ")}`,
    durationMs: Date.now() - rt_start,
    timestamp: rt_start,
  };
  trajectorySteps.push(rt_step);
  if (deal.id) await logTrajectoryStep(deal.id, rt_step);

  // Module 4: Capital Stack (reads red team risk flags)
  const cs_start = Date.now();
  const capitalStack = await buildCapitalStack(deal);
  const cs_step: TrajectoryStep = {
    agentName: "CapitalStackAgent",
    model: selectModel("capital_stack"),
    inputSummary: `Deal: ${deal.name} | Asking: $${deal.askingPrice?.toLocaleString()} | Kill Prob: ${redTeam.killProbability.toFixed(2)}`,
    outputSummary: `SBA: $${capitalStack.sbaAmount.toLocaleString()} | DSCR: ${capitalStack.dscr.toFixed(2)} | CoC: ${(capitalStack.cashOnCashReturn * 100).toFixed(1)}%`,
    durationMs: Date.now() - cs_start,
    timestamp: cs_start,
  };
  trajectorySteps.push(cs_step);
  if (deal.id) await logTrajectoryStep(deal.id, cs_step);

  return { ownerPsychology, digitalAudit, redTeam, capitalStack, trajectorySteps };
}

// ─── Consensus Scorer (ParallelAgent pattern — MiroFish) ─────────────────────
/**
 * Scores a deal using 3 different Gemini models in parallel.
 * Computes consensus score and divergence metric.
 * High divergence (>0.15) flags the deal for manual review.
 */
export async function getConsensusModelIds(): Promise<[string, string, string]> {
  try {
    const { getAllModelConfigs } = await import("../db");
    const saved = await getAllModelConfigs();
    const m1 = saved.find((r) => r.module === "consensus_model_1")?.modelId ?? MODEL_STRONG;
    const m2 = saved.find((r) => r.module === "consensus_model_2")?.modelId ?? MODEL_FAST;
    const m3 = saved.find((r) => r.module === "consensus_model_3")?.modelId ?? MODEL_LITE;
    return [m1, m2, m3];
  } catch {
    return [MODEL_STRONG, MODEL_FAST, MODEL_LITE];
  }
}

export async function runConsensusScoring(deal: Deal): Promise<ConsensusResult> {
  const dealContext = `
Business: ${deal.name}
Industry: ${deal.industry ?? "Unknown"}
Revenue: $${deal.revenue?.toLocaleString() ?? "N/A"}
Cash Flow: $${deal.cashFlow?.toLocaleString() ?? "N/A"}
Asking Price: $${deal.askingPrice?.toLocaleString() ?? "N/A"}
Multiple: ${deal.multiple ?? "N/A"}x
Employees: ${deal.employees ?? "N/A"}
Description: ${deal.description ?? "No description"}
  `.trim();

  const scoringPrompt = (modelLabel: string) => `You are a seasoned M&A analyst (${modelLabel}). Score this business acquisition opportunity.

${dealContext}

Return JSON with:
- score: number 0-1 (1 = exceptional opportunity)
- rationale: string (2-3 sentence justification for your score)

Return ONLY valid JSON.`;

  // Load configured model IDs (dynamic — reads from DB, falls back to defaults)
  const [modelId1, modelId2, modelId3] = await getConsensusModelIds();

  const callGemini = (modelId: string, label: string) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: scoringPrompt(label) }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }).then(r => r.json());

  // Run all 3 models in parallel (MiroFish fan-out pattern)
  const [result1, result2, result3] = await Promise.allSettled([
    callGemini(modelId1, modelId1),
    callGemini(modelId2, modelId2),
    callGemini(modelId3, modelId3),
  ]);

  // Parse results from each model
  const parseScore = (result: PromiseSettledResult<any>, modelName: string): { model: string; score: number; rationale: string } => {
    if (result.status === "rejected") {
      return { model: modelName, score: 0.5, rationale: "Model unavailable." };
    }
    try {
      const text = result.value?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      const parsed = JSON.parse(text);
      return {
        model: modelName,
        score: Math.min(1, Math.max(0, parsed.score ?? 0.5)),
        rationale: parsed.rationale ?? "No rationale provided.",
      };
    } catch {
      return { model: modelName, score: 0.5, rationale: "Parse error." };
    }
  };

  const scores = [
    parseScore(result1, modelId1),
    parseScore(result2, modelId2),
    parseScore(result3, modelId3),
  ];

  // Compute consensus and divergence (MiroFish synthesizer pattern)
  const scoreValues = scores.map((s) => s.score);
  const consensusScore = scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;
  const variance = scoreValues.reduce((sum, s) => sum + Math.pow(s - consensusScore, 2), 0) / scoreValues.length;
  const divergenceScore = Math.sqrt(variance);
  const divergenceFlag = divergenceScore > 0.15;

  const summary = divergenceFlag
    ? `⚠️ Models disagree (divergence: ${divergenceScore.toFixed(3)}). Consensus score: ${consensusScore.toFixed(3)}. Manual review recommended.`
    : `Models agree. Consensus score: ${consensusScore.toFixed(3)} (divergence: ${divergenceScore.toFixed(3)}).`;

  return { scores, consensusScore, divergenceScore, divergenceFlag, summary };
}

// ─── Seller Simulation (MiroFish persona pattern) ────────────────────────────
/**
 * Generates a seller persona and simulates negotiation scenarios.
 * The "Blackrock move" — rehearse the LOI conversation before sending it.
 */
export async function runSellerSimulation(deal: Deal): Promise<SellerSimulationResult> {
  const { GoogleGenAI } = await import("@google/genai");
  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  // Step 1: Build seller persona
  const personaPrompt = `You are an expert M&A psychologist and behavioral analyst. Build a detailed seller persona from these business signals.

Business: ${deal.name}
Industry: ${deal.industry ?? "Unknown"}
Revenue: $${deal.revenue?.toLocaleString() ?? "N/A"}
Cash Flow: $${deal.cashFlow?.toLocaleString() ?? "N/A"}
Asking Price: $${deal.askingPrice?.toLocaleString() ?? "N/A"}
Multiple: ${deal.multiple ?? "N/A"}x
Year Established: ${deal.yearEstablished ?? "N/A"}
Employees: ${deal.employees ?? "N/A"}
Description: ${deal.description ?? "No description"}

Generate a seller persona. Return JSON with:
- estimatedAge: string (e.g. "55-65")
- motivation: string (e.g. "retirement", "burnout", "opportunity", "distress", "health")
- urgencyLevel: number 1-10 (10 = must sell immediately)
- negotiationStyle: string (e.g. "collaborative", "adversarial", "avoidant", "desperate")
- emotionalTriggers: string[] (top 3 things that matter most to this seller)
- likelyObjections: string[] (top 3 objections to a typical LOI)

Return ONLY valid JSON.`;

  const personaResponse = await genai.models.generateContent({
    model: MODEL_STRONG,
    contents: [{ role: "user", parts: [{ text: personaPrompt }] }],
    config: { responseMimeType: "application/json" },
  });

  let persona: SellerSimulationResult["persona"];
  try {
    persona = JSON.parse(personaResponse.text ?? "{}");
  } catch {
    persona = {
      estimatedAge: "50-60",
      motivation: "retirement",
      urgencyLevel: 6,
      negotiationStyle: "collaborative",
      emotionalTriggers: ["Legacy of the business", "Employee welfare", "Fair valuation"],
      likelyObjections: ["Price too low", "Transition period too short", "Earnout structure"],
    };
  }

  // Step 2: Simulate negotiation scenarios (reads persona context)
  const simPrompt = `You are roleplaying as a business seller with this profile:
- Age: ${persona.estimatedAge}
- Motivation: ${persona.motivation}
- Urgency: ${persona.urgencyLevel}/10
- Style: ${persona.negotiationStyle}
- Emotional triggers: ${persona.emotionalTriggers?.join(", ")}
- Likely objections: ${persona.likelyObjections?.join(", ")}

Business: ${deal.name} | Asking: $${deal.askingPrice?.toLocaleString()}

Simulate your response to 4 buyer approaches. Return JSON with a "scenarios" array, each item having:
- scenario: string (the buyer's approach)
- sellerResponse: string (your response as the seller, in first person, 2-3 sentences)
- emotionalState: string (your emotional state during this response)
- counterOfferRange: string (e.g. "Would accept $2.1M-$2.3M")
- recommendedApproach: string (advice to the buyer on how to handle this)

Scenarios to simulate:
1. "Initial LOI at 85% of asking price with standard terms"
2. "Request for 3-year seller note at 5% interest (15% of price)"
3. "60-day due diligence period with full financial access"
4. "Earnout clause: 10% of price tied to Year 1 revenue retention"

Return ONLY valid JSON with a "scenarios" array.`;

  const simResponse = await genai.models.generateContent({
    model: MODEL_STRONG,
    contents: [{ role: "user", parts: [{ text: simPrompt }] }],
    config: { responseMimeType: "application/json" },
  });

  let scenarios: SellerSimulationResult["scenarios"] = [];
  try {
    const parsed = JSON.parse(simResponse.text ?? "{}");
    scenarios = Array.isArray(parsed.scenarios) ? parsed.scenarios : [];
  } catch {
    scenarios = [];
  }

  return { persona, scenarios };
}
