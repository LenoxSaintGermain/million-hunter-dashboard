import { z } from "zod";
import { missionDraftValuesSchema } from "../../shared/apertureMissionDraft";
import { parsePersistedJson } from "../../shared/persistedJson";

/** Decode driver JSON before writing a new immutable revision, never twice. */
export function revisionJsonForInsert<T extends {
  holdingPeriods: unknown; contextSnapshot: unknown; gateSnapshot: unknown; rankingSnapshot: unknown;
}>(revision: T) {
  const decoded = {
    holdingPeriods: parsePersistedJson(revision.holdingPeriods),
    contextSnapshot: parsePersistedJson(revision.contextSnapshot),
    gateSnapshot: parsePersistedJson(revision.gateSnapshot),
    rankingSnapshot: parsePersistedJson(revision.rankingSnapshot),
  };
  z.array(z.enum(["intraday", "overnight", "swing", "catalyst_window", "position"])).nullable().parse(decoded.holdingPeriods);
  for (const value of [decoded.contextSnapshot, decoded.gateSnapshot, decoded.rankingSnapshot]) {
    z.record(z.string(), z.unknown()).nullable().parse(value);
  }
  return decoded as Pick<T, "holdingPeriods" | "contextSnapshot" | "gateSnapshot" | "rankingSnapshot">;
}

export type StoredDecisionBinding = {
  ownerId: number;
  /** Omitted only by legacy thesis receipts. Null/unknown is never a kind. */
  contextKind?: "thesis" | "objective" | "discovery";
  clientRequestId?: string | null;
  canonicalThesisId: number | null;
  capitalThesisId: number | null;
  accountId: number;
};

const positiveId = z.number().int().positive().safe();
const requestId = z.string().uuid();
const objectiveContextSchema = z.object({
  contextKind: z.literal("objective"),
  requestId,
  canonicalThesisId: z.null(),
  capitalThesisId: z.null(),
  selectedCanonicalThesisId: positiveId.nullable(),
  accountId: positiveId,
  sourceDraftId: positiveId,
  sourceDraftVersion: positiveId,
  // Reuse the strict draft schema: prose or additional proof claims cannot
  // stand in for the accepted structured inputs.
  acceptedDraft: missionDraftValuesSchema,
  sourceBasis: z.enum(["operator_declared", "hypothetical_only"]),
  availableCapitalCents: z.null(),
});
const objectiveGateSchema = z.object({
  mandateVersion: z.string().trim().min(1),
  paperOnly: z.literal(true),
  humanApprovalRequired: z.literal(true),
  riskAuthorityState: z.literal("pending_verification"),
  permittedRiskCents: z.null(),
  sourceAvailabilityVerified: z.literal(false),
});

/** Narrow structural proof, not verification of thesis ownership or evidence. */
export function hasThesisDecisionBinding(run: Pick<StoredDecisionBinding, "contextKind" | "canonicalThesisId" | "capitalThesisId">): boolean {
  return (run.contextKind === undefined || run.contextKind === "thesis")
    && positiveId.safeParse(run.canonicalThesisId).success
    && positiveId.safeParse(run.capitalThesisId).success;
}

export function immutableReceiptBindingIssue(input: {
  requestedOwnerId: number;
  run: StoredDecisionBinding;
  contextSnapshot: unknown;
  gateSnapshot: unknown;
}) {
  if (!positiveId.safeParse(input.run.ownerId).success || input.requestedOwnerId !== input.run.ownerId) return "owner";
  if (!input.contextSnapshot || typeof input.contextSnapshot !== "object" || Array.isArray(input.contextSnapshot)) return "context_snapshot";
  if (!input.gateSnapshot || typeof input.gateSnapshot !== "object" || Array.isArray(input.gateSnapshot)) return "gate_snapshot";
  const context = input.contextSnapshot as Record<string, unknown>;
  const gate = input.gateSnapshot as Record<string, unknown>;
  const kind = input.run.contextKind === undefined ? "thesis" : input.run.contextKind;
  if (kind !== "thesis" && kind !== "objective" && kind !== "discovery") return "context_kind";
  if (context.contextKind !== undefined && context.contextKind !== kind) return "context_kind";
  if (kind !== "thesis" && context.contextKind !== kind) return "context_kind";
  if ((kind === "thesis" ? !positiveId.safeParse(input.run.canonicalThesisId).success : input.run.canonicalThesisId !== null)
    || context.canonicalThesisId !== input.run.canonicalThesisId) return "canonical_thesis";
  if ((kind !== "objective" ? !positiveId.safeParse(input.run.capitalThesisId).success : input.run.capitalThesisId !== null)
    || context.capitalThesisId !== input.run.capitalThesisId) return "capital_thesis";
  if (!positiveId.safeParse(input.run.accountId).success || context.accountId !== input.run.accountId) return "account";
  if (typeof gate.mandateVersion !== "string" || !gate.mandateVersion.trim()) return "mandate";
  if (kind === "discovery") {
    if (![context.sourceDecisionRunId, context.sourceRevisionId, context.discoveryReceiptId, context.selectedAt].every(value => positiveId.safeParse(value).success)
      || typeof context.hypothesisId !== "string" || !context.hypothesisId.trim()
      || !/^[a-f0-9]{64}$/.test(String(context.sourceRecordHash)) || !/^[a-f0-9]{64}$/.test(String(context.projectionHash))
      || context.availableCapitalCents !== null || !objectiveGateSchema.safeParse(gate).success) return "discovery_context";
    // Structural check only. Production must separately verify the owned
    // immutable selection, source receipt and tactical projection.
  }
  if (kind === "objective") {
    if (!requestId.safeParse(input.run.clientRequestId).success || context.requestId !== input.run.clientRequestId) return "request";
    const parsed = objectiveContextSchema.safeParse(context);
    if (!parsed.success) return "context_snapshot";
    const accepted = parsed.data.acceptedDraft;
    if (!accepted.strategyContext || accepted.baseDecisionRunId !== null || accepted.baseDecisionRevisionId !== null) return "accepted_draft";
    if (accepted.strategyContext.requestId !== input.run.clientRequestId) return "request";
    if (accepted.accountId !== input.run.accountId) return "account";
    if (accepted.canonicalThesisId !== parsed.data.selectedCanonicalThesisId) return "canonical_thesis";
    const sourceBasis = accepted.strategyContext.intent === "deploy_excess_capital" ? "operator_declared" : "hypothetical_only";
    if (parsed.data.sourceBasis !== sourceBasis) return "source_basis";
    if (!objectiveGateSchema.safeParse(gate).success) return "gate_snapshot";
  }
  return null;
}
