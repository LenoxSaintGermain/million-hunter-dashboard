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
  /** Recorded direction. Null on legacy candidates written before it existed. */
  playSide?: "long" | "short" | null;
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
  /**
   * Set when the offered plays do not all point the same way. This is a
   * statement about recorded direction, not a correlation finding: whether a
   * long in one name and a short in another actually offset each other is not
   * measured anywhere in this system, and is not claimed here.
   */
  directionalMix: { long: number; short: number; unrecorded: number; note: string } | null;
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

  const best = distinct[0] ?? null;
  const alternatives = distinct.slice(1, 1 + maxAlternatives);
  const offered = best ? [best, ...alternatives] : [];
  const long = offered.filter((candidate) => candidate.playSide === "long").length;
  const short = offered.filter((candidate) => candidate.playSide === "short").length;
  const unrecorded = offered.length - long - short;

  // The brief this is measured against says "ORCL and PSQ cannot both activate".
  // That judgement rests on knowing PSQ is an inverse Nasdaq expression, which
  // nothing here records. So the honest output is the fact we do hold — these
  // plays point opposite ways — and an explicit statement that the offsetting
  // question is not answered. Inventing a correlation model to answer it would
  // be a fabricated number in a sizing decision.
  const directionalMix = long > 0 && short > 0
    ? {
      long, short, unrecorded,
      note: "These plays point in opposite directions. Whether they offset each other is not measured: no correlation between different underlyings is recorded. Size them as separate decisions, not as a hedge.",
    }
    : null;

  return { best, alternatives, withheld, directionalMix };
}
