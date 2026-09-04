import { and, eq } from "drizzle-orm";
import {
  apertureDecisionRevisions,
  apertureDecisionRuns,
  aperturePendingOutcomes,
  apertureRunwayStates,
} from "../../drizzle/schema";
import { getDb } from "../db";

export type DecisionBranch = "research" | "eligible" | "conditional" | "cash";
export type PaperDecisionAction = "preflight" | "create_proposal" | "approve" | "submit";
export type DecisionOrderIntent = "open" | "close" | "unknown";

export type DecisionAuthorizationSnapshot = {
  source: "authoritative" | "legacy";
  decisionRunId: number | null;
  revisionId: number | null;
  effectiveBranch: DecisionBranch;
  accountId: number | null;
  researchRunId: number | null;
  /** Effective absolute loss limit persisted on the authoritative mission revision. */
  maxPlannedLossCents: number | null;
};

export class DecisionRunwayBlockedError extends Error {
  readonly code: "DECISION_RUNWAY_BLOCKED" | "DECISION_BINDING_MISMATCH";

  constructor(message: string, code: DecisionRunwayBlockedError["code"] = "DECISION_RUNWAY_BLOCKED") {
    super(message);
    this.name = "DecisionRunwayBlockedError";
    this.code = code;
  }
}

/**
 * A stored order may reduce an already-held paper position after a later
 * mission revision. Every other intent requires the current exact binding;
 * `unknown` is intentionally classified with opening exposure.
 */
export function requiresCurrentDecisionBinding(intent: DecisionOrderIntent | null | undefined): boolean {
  return intent !== "close";
}

export function decisionActionBlock(
  snapshot: DecisionAuthorizationSnapshot,
  action: PaperDecisionAction,
  intent: DecisionOrderIntent,
  expected?: { runId: number; accountId: number },
): string | null {
  // A proven closing order must remain possible even if a newer mission
  // revision was recorded after the position was opened. Exposure-reducing
  // intent is resolved from the held position before this helper is reached;
  // unknown intent remains fail-closed below.
  if (!requiresCurrentDecisionBinding(intent)) return null;
  if (snapshot.source === "authoritative" && expected) {
    if (snapshot.researchRunId !== expected.runId || snapshot.accountId !== expected.accountId) {
      return "Decision Runway binding mismatch: the mission revision, research run, and paper account must match exactly.";
    }
  }
  // Unknown intent is treated as opening exposure.
  if (snapshot.effectiveBranch === "cash") {
    return `Cash is the current Decision Runway outcome. ${action} is fail-closed until a new mission revision is recorded.`;
  }
  if (snapshot.effectiveBranch === "conditional") {
    return `This Decision Runway is conditional. Resolve the named gate before ${action.replace("_", " ")}.`;
  }
  return null;
}

export function missingDecisionAuthorityBlock(intent: DecisionOrderIntent): string | null {
  if (!requiresCurrentDecisionBinding(intent)) return null;
  return "This research run has no authoritative Decision Run binding. Opening paper actions are fail-closed; start from Capital Mission.";
}

export async function authorizeDecisionAction(input: {
  action: PaperDecisionAction;
  userId: number;
  runId: number;
  accountId: number;
  intent?: DecisionOrderIntent | null;
  decisionRunId?: number | null;
  decisionRevisionId?: number | null;
}): Promise<DecisionAuthorizationSnapshot | null> {
  const db = await getDb();
  if (!db) throw new Error("database unavailable");
  const requiresCurrentBinding = requiresCurrentDecisionBinding(input.intent);

  const [decisionRun] = await db.select().from(apertureDecisionRuns).where(and(
    eq(apertureDecisionRuns.userId, input.userId),
    eq(apertureDecisionRuns.researchRunId, input.runId),
  )).limit(1);

  if (requiresCurrentBinding && input.decisionRunId != null && (!decisionRun || decisionRun.id !== input.decisionRunId)) {
    throw new DecisionRunwayBlockedError(
      "Decision Runway binding mismatch: this order is not attached to its authoritative Decision Run.",
      "DECISION_BINDING_MISMATCH",
    );
  }

  if (decisionRun) {
    if (decisionRun.currentRevisionId == null) {
      if (requiresCurrentBinding) {
        throw new DecisionRunwayBlockedError("Decision Runway has no current mission revision.", "DECISION_BINDING_MISMATCH");
      }
      return {
        source: "authoritative",
        decisionRunId: decisionRun.id,
        revisionId: null,
        effectiveBranch: "cash",
        accountId: decisionRun.accountId,
        researchRunId: decisionRun.researchRunId,
        maxPlannedLossCents: null,
      };
    }
    const [revision] = await db.select().from(apertureDecisionRevisions).where(and(
      eq(apertureDecisionRevisions.id, decisionRun.currentRevisionId),
      eq(apertureDecisionRevisions.decisionRunId, decisionRun.id),
    )).limit(1);
    if (!revision) {
      if (!requiresCurrentBinding) {
        return {
          source: "authoritative",
          decisionRunId: decisionRun.id,
          revisionId: null,
          effectiveBranch: "cash",
          accountId: decisionRun.accountId,
          researchRunId: decisionRun.researchRunId,
          maxPlannedLossCents: null,
        };
      }
      throw new DecisionRunwayBlockedError(
        "Decision Runway revision mismatch: re-open the current mission before continuing.",
        "DECISION_BINDING_MISMATCH",
      );
    }
    if (requiresCurrentBinding && input.decisionRevisionId != null && revision.id !== input.decisionRevisionId) {
      throw new DecisionRunwayBlockedError(
        "Decision Runway revision mismatch: re-open the current mission before continuing.",
        "DECISION_BINDING_MISMATCH",
      );
    }
    const snapshot: DecisionAuthorizationSnapshot = {
      source: "authoritative",
      decisionRunId: decisionRun.id,
      revisionId: revision.id,
      effectiveBranch: revision.effectiveBranch,
      accountId: decisionRun.accountId,
      researchRunId: decisionRun.researchRunId,
      maxPlannedLossCents: revision.maxPlannedLossCents,
    };
    const block = decisionActionBlock(snapshot, input.action, input.intent ?? "unknown", {
      runId: input.runId,
      accountId: input.accountId,
    });
    if (block) throw new DecisionRunwayBlockedError(block, block.includes("mismatch") ? "DECISION_BINDING_MISMATCH" : "DECISION_RUNWAY_BLOCKED");
    return snapshot;
  }

  // Existing rows are retained only as legacy evidence. They do not gain a
  // fabricated exact binding and therefore cannot authorize new exposure.
  // Proven closing intent remains a separate safety path so a migration cannot
  // trap an existing paper position.
  const [legacy] = await db.select().from(apertureRunwayStates).where(and(
    eq(apertureRunwayStates.userId, input.userId),
    eq(apertureRunwayStates.runId, input.runId),
  )).limit(1);
  if (!legacy) {
    const block = missingDecisionAuthorityBlock(input.intent ?? "unknown");
    if (block) throw new DecisionRunwayBlockedError(block, "DECISION_BINDING_MISMATCH");
    return null;
  }
  const snapshot: DecisionAuthorizationSnapshot = {
    source: "legacy",
    decisionRunId: null,
    revisionId: null,
    effectiveBranch: legacy.branch,
    accountId: legacy.accountId,
    researchRunId: legacy.runId,
    maxPlannedLossCents: null,
  };
  const block = decisionActionBlock(snapshot, input.action, input.intent ?? "unknown");
  if (block) throw new DecisionRunwayBlockedError(block);
  const missingAuthority = missingDecisionAuthorityBlock(input.intent ?? "unknown");
  if (missingAuthority) throw new DecisionRunwayBlockedError(missingAuthority, "DECISION_BINDING_MISMATCH");
  return snapshot;
}

export type MissionObjective = "best_qualified_play" | "deploy_today" | "verify_catalyst" | "portfolio_gap" | "preserve_optionality";
export type HoldingPeriod = "intraday" | "overnight" | "swing" | "catalyst_window" | "position";

export type RankedMission = {
  key: "best_play" | "deploy_today" | "dated_catalyst" | "portfolio_gap" | "preserve_cash";
  label: string;
  missionText: string;
  objective: MissionObjective;
  score: number;
  reasons: string[];
  readiness: "researchable" | "conditional";
};

export function rankMissionLibrary(input: {
  thesisName: string;
  deployableCapitalCents: number;
  holdingPeriod: HoldingPeriod;
  objective: MissionObjective;
  concentrationUtilizationPct: number | null;
  accountFreshnessMinutes: number | null;
  hasVerifiedCatalyst: boolean;
}): RankedMission[] {
  const capital = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    .format(input.deployableCapitalCents / 100);
  const thesis = input.thesisName || "my active thesis";
  const concentrated = (input.concentrationUtilizationPct ?? 0) >= 85;
  const stale = input.accountFreshnessMinutes == null || input.accountFreshnessMinutes > 30;
  const intraday = input.holdingPeriod === "intraday";

  const missions: RankedMission[] = [
    {
      key: "best_play",
      label: "Best qualifying play",
      missionText: `Where can I best deploy ${capital} against ${thesis} within the stated loss ceiling?`,
      objective: "best_qualified_play",
      score: input.objective === "best_qualified_play" ? 80 : 58,
      reasons: ["Matches the assigned thesis and available paper capital."],
      readiness: stale ? "conditional" : "researchable",
    },
    {
      key: "deploy_today",
      label: intraday ? "Today’s qualifying play" : "Short-horizon deployment",
      missionText: intraday
        ? `Where can I deploy ${capital} against ${thesis} today without exceeding the planned-loss ceiling?`
        : `Which qualifying ${input.holdingPeriod.replace("_", "-")} play best expresses ${thesis} within the planned-loss ceiling?`,
      objective: "deploy_today",
      score: input.objective === "deploy_today" || intraday ? 76 : 52,
      reasons: [intraday ? "The selected horizon is flat by the declared review point." : "The selected horizon favors a bounded deployment question."],
      readiness: stale ? "conditional" : "researchable",
    },
    {
      key: "dated_catalyst",
      label: "Verify a dated catalyst",
      missionText: `What must be verified before a dated catalyst can support a paper expression of ${thesis}?`,
      objective: "verify_catalyst",
      score: input.objective === "verify_catalyst" ? 84 : input.hasVerifiedCatalyst ? 66 : 36,
      reasons: [input.hasVerifiedCatalyst ? "A verified catalyst is available in the current evidence context." : "No verified catalyst is attached; this remains conditional."],
      readiness: input.hasVerifiedCatalyst ? "researchable" : "conditional",
    },
    {
      key: "portfolio_gap",
      label: "Portfolio-gap deployment",
      missionText: `How can I use up to ${capital} to test ${thesis} without duplicating or increasing existing concentration?`,
      objective: "portfolio_gap",
      score: input.objective === "portfolio_gap" ? 88 : concentrated ? 96 : 55,
      reasons: [concentrated ? `Existing concentration is at ${input.concentrationUtilizationPct?.toFixed(0)}% utilization.` : "Checks the paper portfolio for overlap before ranking a new expression."],
      readiness: stale ? "conditional" : "researchable",
    },
    {
      key: "preserve_cash",
      label: "Preserve cash",
      missionText: `What evidence, portfolio, or risk condition must clear before deploying ${capital} against ${thesis}?`,
      objective: "preserve_optionality",
      score: input.objective === "preserve_optionality" ? 90 : concentrated ? 86 : stale ? 92 : 42,
      reasons: [stale ? "Paper-account context is stale or not measured." : concentrated ? "Concentration leaves limited verified headroom." : "Cash remains the control outcome when no play clears every gate."],
      readiness: "researchable",
    },
  ];

  return missions.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

export function outcomeReviewAt(holdingPeriod: HoldingPeriod | null, catalystDeadlineAt: number | null, now = Date.now()): number | null {
  // Preserve a declared instant even when it is stale. The run preset will
  // reject a past deadline; replacing it with a synthetic future horizon would
  // silently change the operator's thesis.
  if (catalystDeadlineAt != null) return catalystDeadlineAt;
  if (holdingPeriod === "intraday") return now + 8 * 60 * 60 * 1_000;
  if (holdingPeriod === "overnight") return now + 24 * 60 * 60 * 1_000;
  if (holdingPeriod === "swing") return now + 7 * 24 * 60 * 60 * 1_000;
  if (holdingPeriod === "position") return now + 30 * 24 * 60 * 60 * 1_000;
  return null;
}

export function decisionReceiptPendingOutcome(input: {
  branch: DecisionBranch;
  reviewAt: number | null;
  reopenCondition: string | null;
  namedGateKey: string | null;
}): { kind: "gate_review" | "play_outcome"; dueAt: number; gateKey: string | null; reviewBasis: string } | null {
  if (input.reviewAt == null) return null;
  if (input.branch === "conditional") {
    return {
      kind: "gate_review",
      dueAt: input.reviewAt,
      gateKey: input.namedGateKey,
      reviewBasis: input.reopenCondition ?? "Review the named gate at its declared horizon.",
    };
  }
  if (input.branch === "cash") {
    return {
      kind: "play_outcome",
      dueAt: input.reviewAt,
      gateKey: null,
      reviewBasis: "Review the zero-exposure cash decision at its declared horizon. No order or automatic exit exists.",
    };
  }
  return null;
}

export async function queuePaperOutcome(input: {
  userId: number;
  decisionRunId: number;
  revisionId: number;
  orderId: number;
  holdingPeriod: HoldingPeriod | null;
  catalystDeadlineAt: number | null;
  now?: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("database unavailable");
  const [existing] = await db.select({ id: aperturePendingOutcomes.id }).from(aperturePendingOutcomes).where(and(
    eq(aperturePendingOutcomes.orderId, input.orderId),
    eq(aperturePendingOutcomes.kind, "play_outcome"),
  )).limit(1);
  if (existing) return;
  const now = input.now ?? Date.now();
  const dueAt = outcomeReviewAt(input.holdingPeriod, input.catalystDeadlineAt, now);
  if (dueAt == null) {
    throw new DecisionRunwayBlockedError("A catalyst-window paper play requires an explicit outcome review time.");
  }
  await db.insert(aperturePendingOutcomes).values({
    userId: input.userId,
    decisionRunId: input.decisionRunId,
    revisionId: input.revisionId,
    orderId: input.orderId,
    kind: "play_outcome",
    status: "pending",
    dueAt,
    reviewBasis: input.holdingPeriod === "intraday"
      ? "Prompt the operator after the declared intraday review point. No automatic exit."
      : "Prompt the operator at the declared horizon. No automatic exit.",
    createdAt: now,
    updatedAt: now,
  });
}
