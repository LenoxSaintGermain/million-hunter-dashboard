import type { CandidateAffordability } from "../../shared/candidateAffordability";
import { singleOrderCeilingCents } from "./gates";
import { CURRENT_MANDATE } from "./mandate";

/** Uses the order gate's policy; this early hint cannot grant order eligibility. */
export function candidateAffordability(input: {
  equityCents: number | null; capitalCents: number; instrumentPreference: string | null;
  accountAsOf: number | null; now: number;
  price?: { basis: string; valueNum: number | null; asOf: number | null; expiresAt: number | null; sourceName: string | null; unit: string | null } | null;
}): CandidateAffordability {
  const knownCapital = Number.isSafeInteger(input.capitalCents) && input.capitalCents >= 0;
  const ceilingCents = input.equityCents != null && Number.isSafeInteger(input.equityCents) && input.equityCents > 0 && knownCapital
    ? Math.floor(Math.min(singleOrderCeilingCents(input.equityCents), input.capitalCents)) : null;
  const empty: CandidateAffordability = { state: "unknown", referencePriceCents: null, ceilingCents, asOf: null, sourceName: null, accountAsOf: input.accountAsOf, requiredEquityCents: null, requiredCapitalCents: null };
  if (input.instrumentPreference === "options") return { ...empty, state: "options_required" };
  const p = input.price;
  if (ceilingCents == null || !p || p.basis !== "verified" || p.unit !== "usd" || !p.sourceName
    || p.valueNum == null || !Number.isFinite(p.valueNum) || p.valueNum <= 0
    || p.asOf == null || p.asOf <= 0 || p.asOf > input.now
    || p.expiresAt == null || p.expiresAt <= input.now) return empty;
  const referencePriceCents = Math.round(p.valueNum * 100);
  if (!Number.isSafeInteger(referencePriceCents) || referencePriceCents <= 0) return empty;
  const aboveLimit = referencePriceCents > ceilingCents;
  // Which input is actually binding? The ceiling is the lower of the policy
  // allowance and the research budget, so say the one that is holding this
  // share back rather than both. A fresh operator hit a $100 ceiling on a
  // $2,000 account and was told only to "compare another candidate" — with
  // every candidate in their own thesis priced above it, that is a dead end.
  const policyCeiling = input.equityCents != null ? singleOrderCeilingCents(input.equityCents) : null;
  const equityBinds = policyCeiling != null && policyCeiling <= input.capitalCents;
  return {
    ...empty,
    state: aboveLimit ? "above_limit" : "within_reference",
    referencePriceCents, asOf: p.asOf, sourceName: p.sourceName,
    requiredEquityCents: aboveLimit && equityBinds
      ? Math.ceil(referencePriceCents * (100 / CURRENT_MANDATE.maxOrderNotionalPctOfEquity)) : null,
    requiredCapitalCents: aboveLimit && !equityBinds ? referencePriceCents : null,
  };
}
