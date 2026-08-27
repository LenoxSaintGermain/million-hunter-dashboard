export type StoredDecisionBinding = {
  ownerId: number;
  canonicalThesisId: number;
  capitalThesisId: number;
  accountId: number;
};

export function immutableReceiptBindingIssue(input: {
  requestedOwnerId: number;
  run: StoredDecisionBinding;
  contextSnapshot: unknown;
  gateSnapshot: unknown;
}) {
  if (input.requestedOwnerId !== input.run.ownerId) return "owner";
  if (!input.contextSnapshot || typeof input.contextSnapshot !== "object") return "context_snapshot";
  if (!input.gateSnapshot || typeof input.gateSnapshot !== "object") return "gate_snapshot";
  const context = input.contextSnapshot as Record<string, unknown>;
  const gate = input.gateSnapshot as Record<string, unknown>;
  if (context.canonicalThesisId !== input.run.canonicalThesisId) return "canonical_thesis";
  if (context.capitalThesisId !== input.run.capitalThesisId) return "capital_thesis";
  if (context.accountId !== input.run.accountId) return "account";
  if (typeof gate.mandateVersion !== "string" || !gate.mandateVersion) return "mandate";
  return null;
}
