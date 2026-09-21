/** Presentation only. Never use copy to decide eligibility or order state. */
export const apertureLanguage = {
  analyzePlan: "Analyze my plan",
  analyzingPlan: "Analyzing your plan…",
  analysisResult: "Analysis result",
  checkIdea: "Check this idea",
  planLoadFailed: "We couldn’t load your saved plan.",
  retry: "Try again",
  accountDetails: "Account details",
} as const;

/** A real API connection does not establish real-money execution support. */
export function practiceAccountLabel(isPaper: boolean | null | undefined): string {
  return isPaper === true ? "Practice account" : "Account mode unconfirmed";
}

export function accountFundsLabel(buyingPowerCents: number | null | undefined): string {
  return buyingPowerCents == null ? "Cash" : "Buying power";
}

export const tradingTermHelp = {
  long_call: { label: "Long call", explanation: "Buying a call gives you the right to buy at the strike price under the contract’s exercise terms. It can expire worthless." },
  long_put: { label: "Long put", explanation: "Buying a put gives you the right to sell at the strike price under the contract’s exercise terms. It can expire worthless." },
} as const;
