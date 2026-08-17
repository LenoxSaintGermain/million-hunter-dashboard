export type DecisionPathInput = {
  symbol: string;
  memoStatus?: string | null;
  decisionCriticalChecks: number;
};

export type DecisionPath = {
  stage: "read_memo" | "resolve_checks" | "prepare_paper_review";
  label: string;
  detail: string;
};

/** Returns one operator action, never a return forecast or order instruction. */
export function buildDecisionPath(input: DecisionPathInput): DecisionPath {
  if (input.memoStatus === "ok") {
    return {
      stage: "read_memo",
      label: `Read ${input.symbol} decision record`,
      detail: "Start with the fact-traced record before reviewing supporting research or paper context.",
    };
  }
  if (input.decisionCriticalChecks > 0) {
    return {
      stage: "resolve_checks",
      label: `Resolve ${input.decisionCriticalChecks} decisive check${input.decisionCriticalChecks === 1 ? "" : "s"}`,
      detail: "These are the only checks that control paper-order review. Supporting research can continue separately.",
    };
  }
  return {
    stage: "prepare_paper_review",
    label: "Review paper-account readiness",
    detail: "Evidence is ready for a human paper review. No order is created until a human explicitly approves one.",
  };
}
