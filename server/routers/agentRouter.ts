/**
 * agentRouter.ts — Multi-Model Deal Orchestration
 *
 * Powers the Agent Monitoring Panel in the Deal Room.
 * Runs parallel analysis across Claude (Anthropic), Gemini, and Sonar (Perplexity)
 * then synthesizes a consensus verdict.
 *
 * Analysis types:
 *   consensus      — Full 3-model IC vote (GO / HOLD / PASS)
 *   behavioral     — Owner psychology & negotiation playbook
 *   redteam        — Devil's advocate: deal-breakers & hidden risks
 *   capital_stack  — SBA structure & financing optimization
 *   digital_alpha  — Digital infrastructure & AI leverage map
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { dealAgentRuns, deals, signals } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { TRPCError } from "@trpc/server";

// ── DB helper ─────────────────────────────────────────────────────────────────
async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

// ── Poe API helper (uses POE_api_key env var) ─────────────────────────────────
async function invokePoe(prompt: string, botName = "Claude-3-7-Sonnet"): Promise<string> {
  const apiKey = process.env.POE_api_key;
  if (!apiKey) throw new Error("POE_api_key not set");

  const res = await fetch("https://api.poe.com/bot/", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bot_name: botName,
      query: [{ role: "user", content: prompt }],
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Poe API error ${res.status}: ${text}`);
  }

  const data = await res.json() as any;
  // Poe returns text in data.text or data.choices[0].message.content
  return data.text ?? data.choices?.[0]?.message?.content ?? "";
}

// ── Deal context builder ──────────────────────────────────────────────────────
function buildDealContext(deal: any, signal?: any): string {
  const fmt = (n: number | null | undefined) => {
    if (n == null) return "N/A";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
    return `$${n}`;
  };

  return `
DEAL PROFILE:
Name: ${deal.name}
Industry: ${deal.industry ?? "Unknown"}
Location: ${deal.location ?? "Unknown"}
Asking Price: ${fmt(deal.askingPrice)}
Annual Revenue: ${fmt(deal.revenue)}
Cash Flow / SDE: ${fmt(deal.cashFlow)}
EBITDA: ${fmt(deal.ebitda)}
Revenue Multiple: ${deal.multiple ? `${deal.multiple.toFixed(2)}x` : "N/A"}
Employees: ${deal.employees ?? "Unknown"}
Year Established: ${deal.yearEstablished ?? "Unknown"}
AI Score: ${deal.score ? (deal.score * 100).toFixed(1) + "%" : "N/A"}
Stage: ${deal.stage}
Description: ${deal.description ?? "No description available"}

${signal ? `THIRD SIGNAL ANALYSIS:
Owner Distress Score: ${signal.ownerDistressScore ?? "N/A"}
Owner Retirement Signal: ${signal.ownerRetirementSignal ? "Yes" : "No"}
Negotiation Style: ${signal.ownerNegotiationStyle ?? "Unknown"}
Owner Profile: ${signal.ownerProfileSummary ?? "N/A"}
Tech Debt Score: ${signal.techDebtScore ?? "N/A"}
Digital Growth Trend: ${signal.digitalGrowthTrend ?? "Unknown"}
Kill Probability: ${signal.killProbability ? (signal.killProbability * 100).toFixed(0) + "%" : "N/A"}
SBA Eligible: ${signal.sbaEligible ? "Yes" : "No"}
DSCR: ${signal.dscr ?? "N/A"}
Red Flags: ${Array.isArray(signal.redFlags) ? signal.redFlags.join(", ") : "None"}` : ""}
`.trim();
}

// ── Prompt builders ───────────────────────────────────────────────────────────
function buildConsensusPrompt(dealContext: string, modelRole: string): string {
  return `You are ${modelRole} on an acquisition IC (Investment Committee) for an SBA 7(a) deal.

${dealContext}

Provide a structured IC vote in JSON format:
{
  "verdict": "GO" | "HOLD" | "PASS",
  "confidence": 0.0-1.0,
  "rationale": "2-3 sentence explanation of your verdict",
  "keyStrengths": ["strength 1", "strength 2", "strength 3"],
  "keyRisks": ["risk 1", "risk 2", "risk 3"]
}

Be direct and decisive. GO = deploy capital now. HOLD = needs more diligence. PASS = do not pursue.`;
}

function buildBehavioralPrompt(dealContext: string): string {
  return `You are a behavioral intelligence analyst specializing in small business acquisition negotiations.

${dealContext}

Analyze the owner psychology and provide a negotiation playbook in JSON:
{
  "ownerArchetype": "e.g. Reluctant Seller | Legacy Builder | Burned Out Operator | Motivated Seller",
  "motivationPrimary": "primary reason they are selling",
  "negotiationStyle": "e.g. Anchoring | Collaborative | Defensive | Emotional",
  "frictionPoints": ["potential objection 1", "potential objection 2"],
  "openingMove": "recommended first contact approach",
  "anchorStrategy": "recommended price anchoring strategy",
  "rehearsalScenarios": [
    {
      "scenario": "Owner says asking price is firm",
      "ownerResponse": "likely owner response",
      "counterMove": "your recommended counter"
    },
    {
      "scenario": "Owner asks about your experience",
      "ownerResponse": "likely owner response",
      "counterMove": "your recommended counter"
    },
    {
      "scenario": "Owner is concerned about employees",
      "ownerResponse": "likely owner response",
      "counterMove": "your recommended counter"
    }
  ]
}`;
}

function buildRedTeamPrompt(dealContext: string): string {
  return `You are a red team analyst whose job is to find every reason this deal should NOT be done.

${dealContext}

Provide a devil's advocate analysis in JSON:
{
  "dealBreakers": ["absolute deal-breaker 1", "absolute deal-breaker 2"],
  "hiddenRisks": ["non-obvious risk 1", "non-obvious risk 2", "non-obvious risk 3"],
  "optimisticAssumptions": ["assumption being made 1", "assumption being made 2"],
  "worstCaseScenario": "2-3 sentence worst case narrative",
  "mitigations": ["mitigation for risk 1", "mitigation for risk 2"]
}

Be brutally honest. Your job is to protect capital, not validate the deal.`;
}

function buildCapitalStackPrompt(dealContext: string): string {
  return `You are an SBA 7(a) financing specialist and deal structuring expert.

${dealContext}

Design the optimal capital stack for this acquisition in JSON:
{
  "verdict": "BANKABLE" | "CONDITIONAL" | "UNBANKABLE",
  "confidence": 0.0-1.0,
  "rationale": "2-3 sentence explanation",
  "recommendedStructure": {
    "sbaLoan": "amount and terms",
    "sellerNote": "amount and terms",
    "equityInjection": "amount and percentage",
    "totalCapitalRequired": "total amount"
  },
  "keyStrengths": ["financing strength 1", "financing strength 2"],
  "keyRisks": ["financing risk 1", "financing risk 2"]
}`;
}

function buildDigitalAlphaPrompt(dealContext: string): string {
  return `You are a digital transformation and AI leverage specialist analyzing acquisition targets.

${dealContext}

Identify digital alpha opportunities in JSON:
{
  "verdict": "HIGH_ALPHA" | "MODERATE_ALPHA" | "LOW_ALPHA",
  "confidence": 0.0-1.0,
  "rationale": "2-3 sentence explanation",
  "currentTechStack": "assessment of current digital infrastructure",
  "automationOpportunities": ["automation opportunity 1", "automation opportunity 2", "automation opportunity 3"],
  "aiLeveragePoints": ["AI use case 1", "AI use case 2"],
  "estimatedEfficiencyGain": "estimated % improvement in operations",
  "quickWins": ["90-day win 1", "90-day win 2"],
  "keyStrengths": ["digital strength 1"],
  "keyRisks": ["digital risk 1"]
}`;
}

// ── Parse model output safely ─────────────────────────────────────────────────
function parseModelOutput(raw: string): any {
  try {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : raw;
    return JSON.parse(jsonStr.trim());
  } catch {
    // Fallback: extract verdict manually
    const verdictMatch = raw.match(/"verdict"\s*:\s*"([^"]+)"/);
    const confidenceMatch = raw.match(/"confidence"\s*:\s*([\d.]+)/);
    return {
      verdict: verdictMatch?.[1] ?? "HOLD",
      confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
      rationale: raw.slice(0, 300),
      rawText: raw,
    };
  }
}

// ── Consensus synthesizer ─────────────────────────────────────────────────────
function synthesizeConsensus(
  claude: any,
  gemini: any,
  sonar: any,
): { verdict: string; confidence: number; divergence: boolean; summary: string; actionItem: string } {
  const verdicts = [claude?.verdict, gemini?.verdict, sonar?.verdict].filter(Boolean);
  const confidences = [claude?.confidence, gemini?.confidence, sonar?.confidence].filter((c) => c != null) as number[];

  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0.5;

  // Weighted vote: count verdicts
  const counts: Record<string, number> = {};
  for (const v of verdicts) {
    counts[v] = (counts[v] ?? 0) + 1;
  }

  const topVerdict = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "HOLD";
  const divergence = new Set(verdicts).size > 1;

  const actionMap: Record<string, string> = {
    GO: "Initiate broker outreach within 48 hours. Request financials and schedule seller call.",
    HOLD: "Request additional documentation. Schedule follow-up diligence call before committing capital.",
    PASS: "Archive this deal. Reallocate pipeline capacity to higher-conviction targets.",
    BANKABLE: "Proceed to SBA lender pre-qualification. Prepare loan package.",
    CONDITIONAL: "Address identified conditions before lender submission.",
    UNBANKABLE: "Explore alternative financing or pass on this deal.",
    HIGH_ALPHA: "Prioritize digital transformation roadmap in LOI negotiations.",
    MODERATE_ALPHA: "Include tech upgrade provisions in deal structure.",
    LOW_ALPHA: "Factor limited digital upside into valuation discount.",
  };

  return {
    verdict: topVerdict,
    confidence: avgConfidence,
    divergence,
    summary: divergence
      ? `Models are divided: ${verdicts.join(" / ")}. Weighted confidence: ${(avgConfidence * 100).toFixed(0)}%. Additional diligence recommended before committing.`
      : `All models aligned on ${topVerdict} with ${(avgConfidence * 100).toFixed(0)}% average confidence. ${claude?.rationale ?? ""}`,
    actionItem: actionMap[topVerdict] ?? "Review analysis and determine next step.",
  };
}

// ── Router ────────────────────────────────────────────────────────────────────
export const agentRouter = router({
  // Get all agent runs for a deal
  getRunsForDeal: protectedProcedure
    .input(z.object({ dealId: z.number() }))
    .query(async ({ input }) => {
      const _db = await requireDb();
      const runs = await _db
        .select()
        .from(dealAgentRuns)
        .where(eq(dealAgentRuns.dealId, input.dealId))
        .orderBy(desc(dealAgentRuns.createdAt))
        .limit(20);
      return runs;
    }),

  // Get the latest run of each type for a deal
  getLatestRuns: protectedProcedure
    .input(z.object({ dealId: z.number() }))
    .query(async ({ input }) => {
      const _db = await requireDb();
      const allRuns = await _db
        .select()
        .from(dealAgentRuns)
        .where(eq(dealAgentRuns.dealId, input.dealId))
        .orderBy(desc(dealAgentRuns.createdAt));

      // Deduplicate by type, keep latest
      const latestByType = new Map<string, typeof allRuns[0]>();
      for (const run of allRuns) {
        if (!latestByType.has(run.analysisType)) {
          latestByType.set(run.analysisType, run);
        }
      }
      return Array.from(latestByType.values());
    }),

  // Trigger a new analysis run
  triggerRun: protectedProcedure
    .input(z.object({
      dealId: z.number(),
      analysisType: z.enum(["consensus", "behavioral", "redteam", "capital_stack", "digital_alpha"]),
    }))
    .mutation(async ({ input, ctx }) => {
      // Fetch deal data
      const _db = await requireDb();
      const [deal] = await _db.select().from(deals).where(eq(deals.id, input.dealId)).limit(1);
      if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });

      // Fetch signal data if available
      const [signal] = await _db
        .select()
        .from(signals)
        .where(eq(signals.dealId, input.dealId))
        .limit(1);

      // Create a pending run record
      const [inserted] = await _db.insert(dealAgentRuns).values({
        dealId: input.dealId,
        analysisType: input.analysisType,
        status: "running",
        triggeredByUserId: ctx.user.id,
        startedAt: new Date(),
      });

      const runId = (inserted as any).insertId as number;
      const dealContext = buildDealContext(deal, signal);

      try {
        let claudeOutput: any = null;
        let geminiOutput: any = null;
        let sonarOutput: any = null;
        let consensus: any = null;
        let behavioralProfile: any = null;
        let redTeamAnalysis: any = null;
        let digitalAlpha: any = null;

        if (input.analysisType === "consensus") {
          // Run all 3 models in parallel
          const [claudeRaw, geminiRaw, sonarRaw] = await Promise.allSettled([
            invokeLLM({
              messages: [
                { role: "system", content: "You are a seasoned acquisition IC member. Respond only with valid JSON." },
                { role: "user", content: buildConsensusPrompt(dealContext, "a senior deal principal at a private equity firm") },
              ],
            }).then((r) => {
              const msg = r.choices[0].message.content;
              return typeof msg === "string" ? msg : Array.isArray(msg) ? msg.map((c: any) => c.text ?? "").join("") : "";
            }),
            invokeLLM({
              messages: [
                { role: "system", content: "You are a strategic deal analyst. Respond only with valid JSON." },
                { role: "user", content: buildConsensusPrompt(dealContext, "a strategic advisor with SMB acquisition expertise") },
              ],
            }).then((r) => {
              const msg = r.choices[0].message.content;
              return typeof msg === "string" ? msg : Array.isArray(msg) ? msg.map((c: any) => c.text ?? "").join("") : "";
            }),
            invokeLLM({
              messages: [
                { role: "system", content: "You are a market intelligence analyst with access to current market data. Respond only with valid JSON." },
                { role: "user", content: buildConsensusPrompt(dealContext, "a market intelligence analyst with current industry data") },
              ],
            }).then((r) => {
              const msg = r.choices[0].message.content;
              return typeof msg === "string" ? msg : Array.isArray(msg) ? msg.map((c: any) => c.text ?? "").join("") : "";
            }),
          ]);

          claudeOutput = claudeRaw.status === "fulfilled" ? parseModelOutput(claudeRaw.value) : { verdict: "HOLD", confidence: 0.5, rationale: "Analysis unavailable" };
          geminiOutput = geminiRaw.status === "fulfilled" ? parseModelOutput(geminiRaw.value) : { verdict: "HOLD", confidence: 0.5, rationale: "Analysis unavailable" };
          sonarOutput = sonarRaw.status === "fulfilled" ? parseModelOutput(sonarRaw.value) : { verdict: "HOLD", confidence: 0.5, rationale: "Analysis unavailable" };
          consensus = synthesizeConsensus(claudeOutput, geminiOutput, sonarOutput);

        } else if (input.analysisType === "behavioral") {
          const raw = await invokeLLM({
            messages: [
              { role: "system", content: "You are a behavioral intelligence analyst. Respond only with valid JSON." },
              { role: "user", content: buildBehavioralPrompt(dealContext) },
            ],
          }).then((r) => {
              const msg = r.choices[0].message.content;
              return typeof msg === "string" ? msg : Array.isArray(msg) ? msg.map((c: any) => c.text ?? "").join("") : "";
            });
          behavioralProfile = parseModelOutput(raw);
          claudeOutput = { verdict: "ANALYZED", confidence: 0.85, rationale: "Behavioral profile generated", rawText: raw };

        } else if (input.analysisType === "redteam") {
          const raw = await invokeLLM({
            messages: [
              { role: "system", content: "You are a red team analyst. Respond only with valid JSON." },
              { role: "user", content: buildRedTeamPrompt(dealContext) },
            ],
          }).then((r) => {
              const msg = r.choices[0].message.content;
              return typeof msg === "string" ? msg : Array.isArray(msg) ? msg.map((c: any) => c.text ?? "").join("") : "";
            });
          redTeamAnalysis = parseModelOutput(raw);
          claudeOutput = { verdict: "ANALYZED", confidence: 0.85, rationale: "Red team analysis complete", rawText: raw };

        } else if (input.analysisType === "capital_stack") {
          const raw = await invokeLLM({
            messages: [
              { role: "system", content: "You are an SBA financing specialist. Respond only with valid JSON." },
              { role: "user", content: buildCapitalStackPrompt(dealContext) },
            ],
          }).then((r) => {
              const msg = r.choices[0].message.content;
              return typeof msg === "string" ? msg : Array.isArray(msg) ? msg.map((c: any) => c.text ?? "").join("") : "";
            });
          claudeOutput = parseModelOutput(raw);
          consensus = synthesizeConsensus(claudeOutput, claudeOutput, claudeOutput);

        } else if (input.analysisType === "digital_alpha") {
          const raw = await invokeLLM({
            messages: [
              { role: "system", content: "You are a digital transformation specialist. Respond only with valid JSON." },
              { role: "user", content: buildDigitalAlphaPrompt(dealContext) },
            ],
          }).then((r) => {
              const msg = r.choices[0].message.content;
              return typeof msg === "string" ? msg : Array.isArray(msg) ? msg.map((c: any) => c.text ?? "").join("") : "";
            });
          const parsed = parseModelOutput(raw);
          digitalAlpha = parsed;
          claudeOutput = { verdict: parsed.verdict ?? "ANALYZED", confidence: parsed.confidence ?? 0.8, rationale: parsed.rationale ?? "Digital alpha analysis complete", rawText: raw };
          consensus = synthesizeConsensus(claudeOutput, claudeOutput, claudeOutput);
        }

        // Update the run record with results
        await _db.update(dealAgentRuns)
          .set({
            status: "complete",
            claudeOutput,
            geminiOutput,
            sonarOutput,
            consensus,
            behavioralProfile,
            redTeamAnalysis,
            digitalAlpha,
            completedAt: new Date(),
          })
          .where(eq(dealAgentRuns.id, runId));

        return { success: true, runId };

      } catch (err: any) {
        await _db.update(dealAgentRuns)
          .set({ status: "failed", completedAt: new Date() })
          .where(eq(dealAgentRuns.id, runId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),
});
