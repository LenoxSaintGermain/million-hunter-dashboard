/**
 * Builds the Guided-mode explanation for one put credit spread from numbers
 * already computed elsewhere. Display only; it never decides eligibility.
 */
import { formatStrike, formatUsdCents, putCreditSpreadRisk, type PutCreditSpreadInput } from "./spreadMath";
import { wiCopy } from "./copy";

export type GuidedSpreadInput = PutCreditSpreadInput & {
  symbol: string;
  /** Human expiration label, e.g. "Fri Oct 16". */
  expirationLabel: string;
  /** Planned time exit label, e.g. "Thu 3:30 PM ET". */
  timeExitLabel: string;
  /** True for example/fixture numbers; the UI must show the Example data label. */
  isExample: boolean;
};

export type GuidedSpreadExplainer = {
  isExample: boolean;
  symbol: string;
  maxLossCents: number;
  creditReceivedCents: number;
  headline: string;
  summary: string;
  closeEarly: string;
  keep: string;
  maxLoss: string;
  maxLossDetail: string;
  breakeven: string;
  whatCanGoWrong: string;
  gapRisk: string;
  /** Guided wording, in total dollars. */
  plan: string;
  /** §14 wi.mgmt.plan wording, per-share prices, for Pro surfaces. */
  proPlan: string;
  rows: Array<{ label: string; value: string; plain: string }>;
};

export function buildGuidedSpreadExplainer(input: GuidedSpreadInput): GuidedSpreadExplainer | { error: string } {
  const risk = putCreditSpreadRisk(input);
  if (!risk.ok) return { error: risk.reason };
  const vars = {
    symbol: input.symbol,
    credit: formatUsdCents(risk.creditReceivedCents),
    shortStrike: formatStrike(input.shortStrike),
    longStrike: formatStrike(input.longStrike),
    expiration: input.expirationLabel,
    maxLoss: formatUsdCents(risk.maxLossCents),
    structuralMaxLoss: formatUsdCents(risk.structuralMaxLossCents),
    allowance: formatUsdCents(risk.allowanceCents),
    breakeven: formatUsdCents(risk.breakevenCents),
    keepAtTakeProfit: formatUsdCents(risk.keepAtTakeProfitCents),
    takeProfitsErased: risk.takeProfitsErasedByMaxLoss,
    takeProfitPrice: formatUsdCents(risk.takeProfitDebitCents),
    stopPrice: formatUsdCents(risk.stopDebitCents),
    lossAtStop: formatUsdCents(risk.lossAtStopCents),
    timeExit: input.timeExitLabel,
  };
  return {
    isExample: input.isExample,
    symbol: input.symbol,
    maxLossCents: risk.maxLossCents,
    creditReceivedCents: risk.creditReceivedCents,
    headline: wiCopy("wi.guided.headline"),
    summary: wiCopy("wi.guided.p1", vars),
    closeEarly: wiCopy("wi.guided.closeEarly"),
    keep: wiCopy("wi.guided.keep", vars),
    maxLoss: wiCopy("wi.guided.maxLoss", vars),
    maxLossDetail: wiCopy("wi.guided.maxLossDetail", vars),
    breakeven: wiCopy("wi.guided.breakeven", vars),
    whatCanGoWrong: wiCopy("wi.guided.whatCanGoWrong", vars),
    gapRisk: wiCopy("wi.guided.gapRisk", vars),
    plan: wiCopy("wi.guided.plan", vars),
    proPlan: wiCopy("wi.mgmt.plan", vars),
    rows: [
      { label: "Paid to you up front", value: vars.credit, plain: "Yours to keep if the stock stays above the promise price." },
      { label: "Promise price", value: vars.shortStrike, plain: "The price you agree to buy at (the put you sell)." },
      { label: "Floor", value: vars.longStrike, plain: "The cheaper put you buy. Below it, your loss stops growing." },
      { label: "Most you can lose", value: vars.maxLoss, plain: "Set aside from your practice balance while the trade is open." },
      { label: "Breakeven", value: vars.breakeven, plain: "Below this price at expiration, you lose money." },
      { label: "Planned exit", value: input.timeExitLabel, plain: "Closed before expiration day, whatever happens." },
    ],
  };
}

/**
 * The thesis's worked example (§11): hypothetical XYZ. Always rendered with the
 * Example data label. Not a quote, not a result.
 */
export const WI_EXAMPLE_SPREAD: GuidedSpreadInput = {
  symbol: "XYZ",
  shortStrike: 95,
  longStrike: 90,
  credit: 1,
  contracts: 1,
  slippagePerLegUsd: 0.05,
  feePerContractUsd: 0,
  takeProfitPctOfCredit: 0.5,
  stopMultipleOfCredit: 2,
  expirationLabel: "Friday (7 days out)",
  timeExitLabel: "Thursday 3:30 PM ET",
  isExample: true,
};
