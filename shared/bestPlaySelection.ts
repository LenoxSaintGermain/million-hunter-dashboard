/**
 * Tap 2 of TSL-BUILD-2026-009: "what's the best play right now with $X?".
 *
 * This ranks work the engine has already finished. It starts no research,
 * invents no candidate, and cannot make a play eligible — a candidate whose
 * evidence is unresolved or declined is not offered, it is counted.
 */

export type ReadyPlayCandidate = {
  runId: number;
  candidateId: number;
  symbol: string;
  role: string;
  holdingPeriod: string | null;
  rankScore: number | null;
  compositeScore: number | null;
  /** Every decision-critical check recorded on this candidate. */
  checks: string[];
  /** checkLabel → recorded status. */
  reviews: Record<string, string>;
};

export type BestPlaySelection = {
  best: ReadyPlayCandidate | null;
  alternatives: ReadyPlayCandidate[];
  /** Counted, not hidden: why the rest are not on offer. */
  withheld: { unresolvedEvidence: number; declined: number; outOfHorizon: number; duplicateSymbol: number };
};

/** A resolution that clears a gate. Anything else leaves the play unavailable. */
const CLEARING = new Set(["confirmed", "not_applicable"]);

export function evidenceState(candidate: ReadyPlayCandidate): "ready" | "declined" | "unresolved" {
  if (!candidate.checks.length) return "unresolved";
  let cleared = 0;
  for (const check of candidate.checks) {
    const status = candidate.reviews[check];
    if (status === "not_confirmed") return "declined";
    if (status && CLEARING.has(status)) cleared += 1;
  }
  return cleared === candidate.checks.length ? "ready" : "unresolved";
}

const score = (c: ReadyPlayCandidate) => c.rankScore ?? c.compositeScore ?? -1;

export function selectBestPlays(
  candidates: ReadyPlayCandidate[],
  options: { horizon?: string | null; maxAlternatives?: number } = {},
): BestPlaySelection {
  const maxAlternatives = options.maxAlternatives ?? 2;
  const withheld = { unresolvedEvidence: 0, declined: 0, outOfHorizon: 0, duplicateSymbol: 0 };
  const ready: ReadyPlayCandidate[] = [];

  for (const candidate of candidates) {
    const state = evidenceState(candidate);
    if (state === "declined") { withheld.declined += 1; continue; }
    if (state === "unresolved") { withheld.unresolvedEvidence += 1; continue; }
    if (options.horizon && candidate.holdingPeriod && candidate.holdingPeriod !== options.horizon) {
      withheld.outOfHorizon += 1;
      continue;
    }
    ready.push(candidate);
  }

  // Deterministic: score first, then symbol, so the same inputs always rank the
  // same way and a tie is not resolved by database order.
  ready.sort((a, b) => score(b) - score(a) || a.symbol.localeCompare(b.symbol));

  // The same name researched in several runs is one opportunity, not three.
  // Keep its highest-ranked instance; offering duplicates wastes the two
  // alternatives the spec allows.
  const seen = new Set<string>();
  const distinct = ready.filter((candidate) => {
    const key = candidate.symbol.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  withheld.duplicateSymbol = ready.length - distinct.length;
  return { best: distinct[0] ?? null, alternatives: distinct.slice(1, 1 + maxAlternatives), withheld };
}
