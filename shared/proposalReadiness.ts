export type ProposalReadiness = {
  title: string;
  explanation: string;
  actionLabel: string;
  action: "return_to_evidence" | "return_to_decision" | "complete_ticket" | "review_recipe" | "confirm_paper" | "create_proposal";
};

function readableList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "required ticket terms";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function enterLabel(field: string | undefined): string {
  if (!field) return "Complete paper ticket";
  return `Enter ${field}`;
}

/** Translate a technical research/preflight state into the operator's next safe action. */
export function buildProposalReadiness(input: {
  recipeReady: boolean;
  unavailableReason?: string | null;
  ticketReady?: boolean;
  ticketMissing?: string[];
  preflightReady?: boolean;
  blocking?: string[];
  hardBlocker?: string | null;
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
  if (input.ticketReady === false) {
    const missing = input.ticketMissing?.length ? input.ticketMissing : ["required ticket terms"];
    return {
      title: "Complete the exact paper ticket",
      explanation: `Enter ${readableList(missing)} here. The ticket stays on this screen; nothing is sent until preflight, approval, and submission all clear separately.`,
      actionLabel: enterLabel(missing[0]),
      action: "complete_ticket",
    };
  }
  if (!input.preflightReady) {
    if (input.hardBlocker) {
      return {
        title: "This paper play cannot be prepared",
        explanation: `${input.hardBlocker} Choose another play below or preserve cash.`,
        actionLabel: "Choose another play here",
        action: "return_to_decision",
      };
    }
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
