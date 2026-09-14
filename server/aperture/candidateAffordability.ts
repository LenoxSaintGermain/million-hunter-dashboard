import type { CandidateAffordability } from "../../shared/candidateAffordability";
import { singleOrderCeilingCents } from "./gates";

/** Uses the order gate's policy; this early hint cannot grant order eligibility. */
export function candidateAffordability(input: {
  equityCents: number | null; capitalCents: number; instrumentPreference: string | null;
  accountAsOf: number | null; now: number;
  price?: { basis: string; valueNum: number | null; asOf: number | null; expiresAt: number | null; sourceName: string | null; unit: string | null } | null;
}): CandidateAffordability {
  const knownCapital = Number.isSafeInteger(input.capitalCents) && input.capitalCents >= 0;
  const ceilingCents = input.equityCents != null && Number.isSafeInteger(input.equityCents) && input.equityCents > 0 && knownCapital
    ? Math.floor(Math.min(singleOrderCeilingCents(input.equityCents), input.capitalCents)) : null;
  const empty: CandidateAffordability = { state: "unknown", referencePriceCents: null, ceilingCents, asOf: null, sourceName: null, accountAsOf: input.accountAsOf };
  if (input.instrumentPreference === "options") return { ...empty, state: "options_required" };
  const p = input.price;
  if (ceilingCents == null || !p || p.basis !== "verified" || p.unit !== "usd" || !p.sourceName
    || p.valueNum == null || !Number.isFinite(p.valueNum) || p.valueNum <= 0
    || p.asOf == null || p.asOf <= 0 || p.asOf > input.now
    || p.expiresAt == null || p.expiresAt <= input.now) return empty;
  const referencePriceCents = Math.round(p.valueNum * 100);
  if (!Number.isSafeInteger(referencePriceCents) || referencePriceCents <= 0) return empty;
  return { ...empty, state: referencePriceCents > ceilingCents ? "above_limit" : "within_reference", referencePriceCents, asOf: p.asOf, sourceName: p.sourceName };
}
