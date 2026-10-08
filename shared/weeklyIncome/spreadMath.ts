/**
 * Weekly Income (#82) put credit spread arithmetic. Pure functions only: no
 * quotes, no broker calls, no order construction. Every amount is computed in
 * integer cents so a displayed maximum loss always matches the gate's figure.
 */

export type PutCreditSpreadInput = {
  /** Strike of the put you sell (the promise). Dollars per share. */
  shortStrike: number;
  /** Strike of the put you buy (the floor). Dollars per share, below the short strike. */
  longStrike: number;
  /** Net credit received per share. Dollars. */
  credit: number;
  /** Whole contracts; one contract covers 100 shares. */
  contracts: number;
  /** Modeled slippage per leg, dollars per share. Thesis default $0.05. */
  slippagePerLegUsd?: number;
  /** Fee allowance per contract, dollars. Thesis default $0.00. */
  feePerContractUsd?: number;
  /** Close when this share of the credit is kept. Thesis default 0.5. */
  takeProfitPctOfCredit?: number;
  /** Close when the cost to close reaches this multiple of the credit. Thesis default 2.0. */
  stopMultipleOfCredit?: number;
};

export type PutCreditSpreadRisk = {
  ok: true;
  widthCents: number;
  creditPctOfWidth: number;
  /** Paid up front: credit × 100 × contracts. */
  creditReceivedCents: number;
  /** (width − credit) × 100 × contracts, before allowances. */
  structuralMaxLossCents: number;
  /** Slippage on both legs plus fees, at entry. */
  allowanceCents: number;
  /** The figure shown and gated: structural max loss + allowances. */
  maxLossCents: number;
  /** Share price at expiration where the spread neither makes nor loses money, before costs. */
  breakevenCents: number;
  /** Debit (per share) that triggers the take-profit close. */
  takeProfitDebitCents: number;
  keepAtTakeProfitCents: number;
  /** Debit (per share) that triggers the stop close. Never beyond the width. */
  stopDebitCents: number;
  lossAtStopCents: number;
  /** How many take-profit results one full maximum loss would erase (rounded down, at least 1). */
  takeProfitsErasedByMaxLoss: number;
};

export type PutCreditSpreadRefusal = { ok: false; reason: string };

const toCents = (dollars: number) => Math.round(dollars * 100);

export function putCreditSpreadRisk(input: PutCreditSpreadInput): PutCreditSpreadRisk | PutCreditSpreadRefusal {
  const { shortStrike, longStrike, credit, contracts } = input;
  const slippage = input.slippagePerLegUsd ?? 0.05;
  const fee = input.feePerContractUsd ?? 0;
  const tp = input.takeProfitPctOfCredit ?? 0.5;
  const stop = input.stopMultipleOfCredit ?? 2;
  const finite = [shortStrike, longStrike, credit, contracts, slippage, fee, tp, stop].every(Number.isFinite);
  if (!finite) return { ok: false, reason: "Every input must be a number." };
  if (!Number.isInteger(contracts) || contracts < 1) return { ok: false, reason: "Contracts must be a whole number of at least 1." };
  if (longStrike <= 0 || shortStrike <= longStrike) return { ok: false, reason: "The protective put must have a lower strike than the put you sell." };
  if (credit <= 0) return { ok: false, reason: "A credit spread must collect a credit." };
  if (slippage < 0 || fee < 0) return { ok: false, reason: "Allowances cannot be negative." };
  if (tp <= 0 || tp >= 1) return { ok: false, reason: "Take profit must keep between 0% and 100% of the credit." };
  if (stop <= 1) return { ok: false, reason: "The stop multiple must be above 1." };
  const widthPerShare = toCents(shortStrike) - toCents(longStrike);
  const creditPerShare = toCents(credit);
  if (creditPerShare >= widthPerShare) return { ok: false, reason: "The credit must be smaller than the distance between the strikes." };
  const multiplier = 100 * contracts;
  const structuralMaxLossCents = (widthPerShare - creditPerShare) * multiplier;
  const allowanceCents = Math.round(2 * slippage * 100 * multiplier) + Math.round(fee * 100 * contracts);
  const maxLossCents = structuralMaxLossCents + allowanceCents;
  const takeProfitDebitCents = Math.round(creditPerShare * (1 - tp));
  const stopDebitCents = Math.min(widthPerShare, Math.round(creditPerShare * stop));
  const keepAtTakeProfitCents = (creditPerShare - takeProfitDebitCents) * multiplier;
  return {
    ok: true,
    widthCents: widthPerShare,
    creditPctOfWidth: Number(((creditPerShare / widthPerShare) * 100).toFixed(2)),
    creditReceivedCents: creditPerShare * multiplier,
    structuralMaxLossCents,
    allowanceCents,
    maxLossCents,
    breakevenCents: toCents(shortStrike) - creditPerShare,
    takeProfitDebitCents,
    keepAtTakeProfitCents,
    stopDebitCents,
    lossAtStopCents: (stopDebitCents - creditPerShare) * multiplier,
    takeProfitsErasedByMaxLoss: Math.max(1, Math.floor(maxLossCents / Math.max(1, keepAtTakeProfitCents))),
  };
}

/** "$410", "$12.50", "-$100". Whole dollars drop the cents. */
export function formatUsdCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  const whole = dollars.toLocaleString("en-US");
  return rem === 0 ? `${sign}$${whole}` : `${sign}$${whole}.${String(rem).padStart(2, "0")}`;
}

/** Strike prices always show cents when present: $95, $92.50. */
export function formatStrike(dollars: number): string {
  return formatUsdCents(toCents(dollars));
}

/** Percent with up to two decimals, trailing zeros removed: 0.75%, 2%. */
export function formatPct(value: number): string {
  return `${Number(value.toFixed(2))}%`;
}
