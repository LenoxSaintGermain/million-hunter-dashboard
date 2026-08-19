export type ProposalReadiness = {
  title: string;
  explanation: string;
  actionLabel: string;
  action: "return_to_evidence" | "review_recipe" | "confirm_paper" | "create_proposal";
};

/** Translate a technical research/preflight state into the operator's next safe action. */
export function buildProposalReadiness(input: {
  recipeReady: boolean;
  unavailableReason?: string | null;
  preflightReady?: boolean;
  blocking?: string[];
  paperAcknowledged?: boolean;
}): ProposalReadiness {
  if (!input.recipeReady) {
    return {
      title: "No paper proposal yet",
      explanation: input.unavailableReason || "The measured recipe is not available yet. Do not fill a ticket around an unmeasured setup.",
      actionLabel: "Return to evidence",
      action: "return_to_evidence",
    };
  }
  if (!input.preflightReady) {
    return {
      title: "Resolve the first blocking gap",
      explanation: input.blocking?.[0] || "The current paper plan has a measurable guardrail gap.",
      actionLabel: "Review the plan",
      action: "review_recipe",
    };
  }
  if (!input.paperAcknowledged) {
    return {
      title: "Confirm paper-only use",
      explanation: "This creates a proposal for your separate approval. It does not submit any broker order.",
      actionLabel: "Acknowledge paper-only",
      action: "confirm_paper",
    };
  }
  return {
    title: "Ready for your proposal review",
    explanation: "The modelled plan cleared current research and paper guardrails. Creating it still does not submit an order.",
    actionLabel: "Create paper proposal",
    action: "create_proposal",
  };
}
