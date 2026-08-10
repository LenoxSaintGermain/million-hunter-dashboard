/**
 * Deployment strategy construction.
 *
 * The weak product answers "where does the leftover $20K go?". This one answers
 * "knowing what we know now, would we still allocate the original $30K that way?"
 * — so the human's own intended trades are re-underwritten alongside everything
 * else, and the diff against their plan is a first-class output.
 *
 * Four competing constructions rather than one ranked list, because the choice
 * between concentration and breadth is the investor's to make, not the model's:
 *   concentrated  — highest conviction only
 *   expanded      — core plus complementary exposure
 *   risk_balanced — core preserved, correlation and cluster limits respected
 *   dry_powder    — deploy only where expected return clears the hurdle
 *
 * Sizing is always a RANGE. Portfolio rules from the thesis graph are hard
 * constraints, not preferences: a name that cannot be sized within them is
 * dropped and SAID to be dropped.
 */
import { impactOf, round, type Holding, type ImpactDelta } from "./portfolioMath";

export type StrategyKind = "concentrated" | "expanded" | "risk_balanced" | "dry_powder" | "human_baseline";

export interface PortfolioRules {
  /** Cap on any single position as a % of total portfolio value after deployment. */
  maxSingleNamePct?: number;
  /** Cap on any one correlated cluster (sector proxy) as a % of total. */
  maxCorrelatedClusterPct?: number;
  /** Share of deployable capital to hold back regardless of opportunity. */
  reservePct?: number;
  /** Names below this average daily dollar volume are not investable. */
  minAvgDailyVolumeUsd?: number;
}

export interface Candidate {
  symbol: string;
  role: "core" | "complementary" | "remainder" | "alternative_expression";
  /** 0..100 thesis fit. */
  compositeScore: number;
  /** 0..1 — how much of the fit rests on facts we actually have. */
  confidenceScore: number;
  sector?: string | null;
  advUsd?: number | null;
  /** Expected return in basis points, when a source supports one. Null is normal. */
  expectedReturnBps?: number | null;
}

export interface Allocation {
  symbol: string;
  dollarsCents: number;
  pctOfDeployable: number;
  /** Sizing is a range; dollarsCents is the midpoint actually modelled. */
  lowCents: number;
  highCents: number;
}

export interface Strategy {
  kind: StrategyKind;
  label: string;
  rationale: string;
  allocations: Allocation[];
  cashRetainedCents: number;
  /** Names considered and deliberately not funded, with the reason. */
  excluded: Array<{ symbol: string; reason: string }>;
  impact?: ImpactDelta;
}

export interface BuildInput {
  deployableCapitalCents: number;
  candidates: Candidate[];
  holdings: Holding[];
  cashCents: number;
  rules?: PortfolioRules;
  /** What the human already planned to do. */
  intendedTrades?: Array<{ symbol: string; dollarsCents: number }>;
  /** Minimum expected return for dry-powder deployment, in basis points. */
  hurdleRateBps?: number | null;
}

/** rank = fit discounted by how much of that fit is actually evidenced. */
export const rankOf = (c: Candidate): number => round(c.compositeScore * (0.5 + 0.5 * c.confidenceScore), 2);

/**
 * Size a set of names by rank, respecting the portfolio rules.
 * Returns the funded allocations and every name the rules pushed out.
 */
export function sizeByRank(
  picks: Candidate[],
  deployableCents: number,
  holdings: Holding[],
  rules: PortfolioRules = {},
): { allocations: Allocation[]; excluded: Array<{ symbol: string; reason: string }>; unspentCents: number } {
  const excluded: Array<{ symbol: string; reason: string }> = [];
  const investable = picks.filter((c) => {
    if (rules.minAvgDailyVolumeUsd != null) {
      if (c.advUsd == null) {
        excluded.push({ symbol: c.symbol, reason: "no average daily volume on record — liquidity rule cannot be checked" });
        return false;
      }
      if (c.advUsd < rules.minAvgDailyVolumeUsd) {
        excluded.push({ symbol: c.symbol, reason: `below the $${rules.minAvgDailyVolumeUsd.toLocaleString()} ADV floor` });
        return false;
      }
    }
    return true;
  });

  if (!investable.length || deployableCents <= 0) {
    return { allocations: [], excluded, unspentCents: Math.max(0, deployableCents) };
  }

  // Weight by rank so conviction shows up in size, not just in ordering.
  const totalRank = investable.reduce((s, c) => s + rankOf(c), 0);
  const existingTotal = holdings.reduce((s, h) => s + h.valueCents, 0);

  const allocations: Allocation[] = [];
  const sectorCents = new Map<string, number>();
  for (const h of holdings) if (h.sector) sectorCents.set(h.sector, (sectorCents.get(h.sector) ?? 0) + h.valueCents);

  let spent = 0;
  for (const c of investable) {
    const share = totalRank > 0 ? rankOf(c) / totalRank : 1 / investable.length;
    let target = Math.floor(deployableCents * share);

    // Cap: single name as a % of the post-deployment portfolio.
    if (rules.maxSingleNamePct != null) {
      const held = holdings.filter((h) => h.symbol === c.symbol).reduce((s, h) => s + h.valueCents, 0);
      const projectedTotal = existingTotal + deployableCents;
      const cap = Math.floor((rules.maxSingleNamePct / 100) * projectedTotal) - held;
      if (cap <= 0) {
        excluded.push({ symbol: c.symbol, reason: `already at or above the ${rules.maxSingleNamePct}% single-name cap` });
        continue;
      }
      target = Math.min(target, cap);
    }

    // Cap: correlated cluster, proxied by sector.
    if (rules.maxCorrelatedClusterPct != null && c.sector) {
      const projectedTotal = existingTotal + deployableCents;
      const clusterCap = Math.floor((rules.maxCorrelatedClusterPct / 100) * projectedTotal);
      const already = sectorCents.get(c.sector) ?? 0;
      const room = clusterCap - already;
      if (room <= 0) {
        excluded.push({ symbol: c.symbol, reason: `${c.sector} cluster already at the ${rules.maxCorrelatedClusterPct}% cap` });
        continue;
      }
      target = Math.min(target, room);
      sectorCents.set(c.sector, already + target);
    }

    if (target <= 0) {
      excluded.push({ symbol: c.symbol, reason: "no room left within the portfolio rules" });
      continue;
    }

    allocations.push({
      symbol: c.symbol,
      dollarsCents: target,
      pctOfDeployable: round((target / deployableCents) * 100, 2),
      // ±25% band: a suggested range, never an unexplained point estimate.
      lowCents: Math.floor(target * 0.75),
      highCents: Math.ceil(target * 1.25),
    });
    spent += target;
  }

  return { allocations, excluded, unspentCents: Math.max(0, deployableCents - spent) };
}

/** Capital held back by the reserve rule before anything is sized. */
function applyReserve(deployableCents: number, rules: PortfolioRules): { usableCents: number; reservedCents: number } {
  const pct = rules.reservePct ?? 0;
  const reserved = Math.floor(deployableCents * (pct / 100));
  return { usableCents: deployableCents - reserved, reservedCents: reserved };
}

function build(
  kind: StrategyKind,
  label: string,
  rationale: string,
  picks: Candidate[],
  input: BuildInput,
): Strategy {
  const rules = input.rules ?? {};
  const { usableCents, reservedCents } = applyReserve(input.deployableCapitalCents, rules);
  const { allocations, excluded, unspentCents } = sizeByRank(picks, usableCents, input.holdings, rules);
  const sectorOf = new Map(input.candidates.map((c) => [c.symbol, c.sector ?? null]));
  const advOf = new Map(input.candidates.map((c) => [c.symbol, c.advUsd ?? null]));

  return {
    kind,
    label,
    rationale,
    allocations,
    cashRetainedCents: reservedCents + unspentCents,
    excluded,
    impact: impactOf(
      input.holdings,
      input.cashCents,
      allocations.map((a) => ({
        symbol: a.symbol,
        dollarsCents: a.dollarsCents,
        sector: sectorOf.get(a.symbol) ?? null,
        advUsd: advOf.get(a.symbol) ?? null,
      })),
    ),
  };
}

/**
 * The human's own plan, scored on the same basis as everything else. Without
 * this there is nothing to compare a recommendation against.
 */
export function humanBaseline(input: BuildInput): Strategy {
  const intended = input.intendedTrades ?? [];
  const spent = intended.reduce((s, t) => s + t.dollarsCents, 0);
  const sectorOf = new Map(input.candidates.map((c) => [c.symbol, c.sector ?? null]));
  return {
    kind: "human_baseline",
    label: "Your plan",
    rationale: "The trades you were already considering, left exactly as you set them.",
    allocations: intended.map((t) => ({
      symbol: t.symbol,
      dollarsCents: t.dollarsCents,
      pctOfDeployable: input.deployableCapitalCents
        ? round((t.dollarsCents / input.deployableCapitalCents) * 100, 2)
        : 0,
      lowCents: t.dollarsCents,
      highCents: t.dollarsCents,
    })),
    cashRetainedCents: Math.max(0, input.deployableCapitalCents - spent),
    excluded: [],
    impact: impactOf(
      input.holdings,
      input.cashCents,
      intended.map((t) => ({ symbol: t.symbol, dollarsCents: t.dollarsCents, sector: sectorOf.get(t.symbol) ?? null })),
    ),
  };
}

export function buildStrategies(input: BuildInput): Strategy[] {
  const ranked = input.candidates.slice().sort((a, b) => rankOf(b) - rankOf(a));
  const core = ranked.filter((c) => c.role === "core");
  const complementary = ranked.filter((c) => c.role === "complementary" || c.role === "alternative_expression");
  const remainder = ranked.filter((c) => c.role === "remainder");

  const out: Strategy[] = [];

  if (input.intendedTrades?.length) out.push(humanBaseline(input));

  out.push(
    build(
      "concentrated",
      "Concentrated",
      "The three highest-conviction expressions of the thesis and nothing else. Highest thesis exposure, highest single-name risk.",
      (core.length ? core : ranked).slice(0, 3),
      input,
    ),
  );

  out.push(
    build(
      "expanded",
      "Expanded aperture",
      "The core plus complementary exposure you would not have surfaced alone — same thesis, more of its surface area.",
      [...(core.length ? core : ranked).slice(0, 3), ...complementary.slice(0, 4)],
      input,
    ),
  );

  // Risk-balanced deliberately spreads across sectors before it spreads across ranks.
  const seenSector = new Set<string>();
  const diversified: Candidate[] = [];
  for (const c of ranked) {
    const key = c.sector ?? `__${c.symbol}`;
    if (seenSector.has(key)) continue;
    seenSector.add(key);
    diversified.push(c);
    if (diversified.length >= 7) break;
  }
  out.push(
    build(
      "risk_balanced",
      "Risk-balanced",
      "Core thesis preserved, but weighted to hold cluster concentration down — one name per correlated group before doubling up.",
      diversified,
      input,
    ),
  );

  // Dry powder: only names that clear the hurdle. A name with no expected-return
  // evidence does NOT clear it — absence of data is not a pass.
  const hurdle = input.hurdleRateBps ?? null;
  const clears = hurdle == null
    ? [...core, ...complementary, ...remainder].slice(0, 5)
    : ranked.filter((c) => c.expectedReturnBps != null && c.expectedReturnBps >= hurdle);
  const dry = build(
    "dry_powder",
    "Dry powder",
    hurdle == null
      ? "Deploy selectively and hold the rest. No hurdle rate was set, so this funds only the top names."
      : `Deploy only where a sourced expected return clears ${(hurdle / 100).toFixed(2)}%. Everything else stays in cash — including names with no return evidence, because a gap is not a pass.`,
    clears,
    input,
  );
  out.push(dry);

  return out;
}

// ── Capital Recomposition — the actual product ───────────────────────────────
export interface RecompositionLine {
  symbol: string;
  humanCents: number;
  proposedCents: number;
  deltaCents: number;
  /** added | trimmed | increased | dropped | unchanged */
  change: "added" | "trimmed" | "increased" | "dropped" | "unchanged";
}

export interface Recomposition {
  lines: RecompositionLine[];
  humanCashCents: number;
  proposedCashCents: number;
  /** Names in the proposal the human had not considered at all. */
  discovered: string[];
  /** Names the human planned that the proposal does not fund. */
  dropped: string[];
}

/** Diff a proposed strategy against what the human was going to do anyway. */
export function recompose(human: Strategy, proposed: Strategy): Recomposition {
  const h = new Map(human.allocations.map((a) => [a.symbol, a.dollarsCents]));
  const p = new Map(proposed.allocations.map((a) => [a.symbol, a.dollarsCents]));
  const symbols = Array.from(new Set([...Array.from(h.keys()), ...Array.from(p.keys())]));

  const lines: RecompositionLine[] = symbols.map((symbol) => {
    const humanCents = h.get(symbol) ?? 0;
    const proposedCents = p.get(symbol) ?? 0;
    const deltaCents = proposedCents - humanCents;
    let change: RecompositionLine["change"];
    if (humanCents === 0) change = "added";
    else if (proposedCents === 0) change = "dropped";
    else if (deltaCents > 0) change = "increased";
    else if (deltaCents < 0) change = "trimmed";
    else change = "unchanged";
    return { symbol, humanCents, proposedCents, deltaCents, change };
  });

  lines.sort((a, b) => Math.abs(b.deltaCents) - Math.abs(a.deltaCents));

  return {
    lines,
    humanCashCents: human.cashRetainedCents,
    proposedCashCents: proposed.cashRetainedCents,
    discovered: lines.filter((l) => l.change === "added").map((l) => l.symbol),
    dropped: lines.filter((l) => l.change === "dropped").map((l) => l.symbol),
  };
}

/**
 * What deploying into `chosen` gives up versus the alternatives and versus cash.
 * Stated as a comparison of what each strategy does to the portfolio, not as a
 * predicted return — we do not claim to know which one wins.
 */
export function opportunityCost(chosen: Strategy, others: Strategy[]): {
  versus: Array<{ kind: StrategyKind; label: string; givesUp: string[] }>;
} {
  const num = (m: { value: number | null } | undefined) => (m?.value ?? null);
  return {
    versus: others
      .filter((o) => o.kind !== chosen.kind)
      .map((o) => {
        const givesUp: string[] = [];
        const cHhi = num(chosen.impact?.after.hhi);
        const oHhi = num(o.impact?.after.hhi);
        if (cHhi != null && oHhi != null && cHhi > oHhi) {
          givesUp.push(`more concentrated (HHI ${cHhi} vs ${oHhi})`);
        }
        const cCash = chosen.cashRetainedCents;
        if (cCash < o.cashRetainedCents) {
          givesUp.push(`less cash held back ($${((o.cashRetainedCents - cCash) / 100).toLocaleString()} more committed)`);
        }
        const cNames = chosen.allocations.length;
        if (cNames < o.allocations.length) {
          givesUp.push(`${o.allocations.length - cNames} fewer position(s) of thesis surface area`);
        }
        if (!givesUp.length) givesUp.push("no measured disadvantage on concentration, cash, or breadth");
        return { kind: o.kind, label: o.label, givesUp };
      }),
  };
}
