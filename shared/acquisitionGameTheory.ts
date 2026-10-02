import { z } from "zod";
import { acquisitionMandateSchema, annualDebtService, type AcquisitionMandate } from "./acquisitionV2";

const probability = z.number().finite().min(0).max(1);
export const gamePriorsSchema = z.object({
  version: z.string().min(1).max(80),
  clean: probability,
  haircut: probability,
  holdUp: probability,
  collapse: probability,
  sdeHaircut: probability,
  holdUpLoss: probability,
  licenseHoldUpShift: probability,
  familyHoldUpShift: probability,
  familyCollapseShift: probability,
  financialHaircutShift: probability,
  staleHaircutShift: probability,
  staleCollapseShift: probability,
  unionCollapseShift: probability,
  protectionFactor: probability,
  repriceFraction: probability,
}).refine(p => Math.abs(p.clean + p.haircut + p.holdUp + p.collapse - 1) < 1e-9, "Scenario probabilities must sum to one");

export const exampleGamePriors = gamePriorsSchema.parse({
  version: "2026-09-29/reconciled-1",
  clean: .6,
  haircut: .2,
  holdUp: .12,
  collapse: .08,
  sdeHaircut: .15,
  holdUpLoss: .25,
  licenseHoldUpShift: .05,
  familyHoldUpShift: .05,
  familyCollapseShift: .03,
  financialHaircutShift: .05,
  staleHaircutShift: .03,
  staleCollapseShift: .02,
  unionCollapseShift: .03,
  protectionFactor: .5,
  repriceFraction: .5,
});

const costsSchema = z.object({
  ownerReplacement: z.number().finite().nonnegative(),
  marketRent: z.number().finite().nonnegative(),
  capexReserve: z.number().finite().nonnegative(),
  qualifierFee: z.number().finite().nonnegative(),
  investorReturn: z.number().finite().nonnegative(),
});
export type WaterfallCosts = Record<keyof z.infer<typeof costsSchema>, number | null>;

export type Countermove = {
  id: string;
  flagId: string;
  title: string;
  description: string;
  marginalEvGain: number;
  walkAway: boolean;
};

/** Seeded pseudo-random number generator (Mulberry32) for deterministic Monte Carlo simulations. */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simulates 10,000 draws over interest rate (±1.5%), SDE haircut (0% to 25%), and capex reserve (±30%).
 * Reports P10, P50, P90 distributable cash and the probability that DSCR falls below 1.25.
 */
export function simulateMonteCarloV2(input: {
  ask: number;
  sde: number;
  mandate: AcquisitionMandate;
  costs: z.infer<typeof costsSchema>;
  seed?: number;
}) {
  const { ask, sde, mandate, costs } = input;
  const rng = mulberry32(input.seed ?? Math.round(ask + sde));
  const DRAWS = 10000;
  const cashDistributions: number[] = new Array(DRAWS);
  let dscrBelowThresholdCount = 0;

  const costTotalNoCapex = costs.ownerReplacement + costs.marketRent + costs.qualifierFee + costs.investorReturn;
  const principal = (ask + mandate.closingCosts) * (1 - mandate.equityPct);

  for (let i = 0; i < DRAWS; i++) {
    // Interest rate ± 1.5% (-0.015 to +0.015)
    const rateDelta = (rng() * 2 - 1) * 0.015;
    const drawRate = Math.max(0.01, mandate.rate + rateDelta);

    // SDE haircut 0% to 25%
    const sdeHaircut = rng() * 0.25;
    const drawSde = sde * (1 - sdeHaircut);

    // Capex reserve ± 30% (0.70 to 1.30)
    const capexMultiplier = 0.70 + rng() * 0.60;
    const drawCapex = costs.capexReserve * capexMultiplier;

    const drawDebt = annualDebtService(principal, drawRate, mandate.termYears);
    const drawDistributable = drawSde - (costTotalNoCapex + drawCapex) - drawDebt;
    cashDistributions[i] = drawDistributable;

    const drawDscr = drawDebt > 0 ? drawSde / drawDebt : 0;
    if (drawDscr < mandate.dscrMin) {
      dscrBelowThresholdCount++;
    }
  }

  cashDistributions.sort((a, b) => a - b);
  const p10 = cashDistributions[Math.floor(DRAWS * 0.10)];
  const p50 = cashDistributions[Math.floor(DRAWS * 0.50)];
  const p90 = cashDistributions[Math.floor(DRAWS * 0.90)];
  const dscrBelowThresholdProb = dscrBelowThresholdCount / DRAWS;

  return {
    draws: 10000 as const,
    p10: Math.round(p10),
    p50: Math.round(p50),
    p90: Math.round(p90),
    dscrBelowThresholdProb: Math.round(dscrBelowThresholdProb * 1000) / 1000,
  };
}

/** No implied default costs; explicit zero means an operator-reviewed scenario assumption. */
export function simulateAcquisitionV2(input: {
  ask: number;
  sde: number;
  mandate: AcquisitionMandate;
  costs: WaterfallCosts;
  flags: string[];
  priors: z.infer<typeof gamePriorsSchema>;
}) {
  const ask = z.number().finite().positive().parse(input.ask), sde = z.number().finite().positive().parse(input.sde);
  const mandate = acquisitionMandateSchema.parse(input.mandate), priors = gamePriorsSchema.parse(input.priors);
  const checked = costsSchema.safeParse(input.costs);
  if (!checked.success) throw new Error("Every waterfall cost needs an explicit reviewed amount, including zero when not applicable");
  const costs = checked.data;
  const annualDebt = annualDebtService((ask + mandate.closingCosts) * (1 - mandate.equityPct), mandate.rate, mandate.termYears);
  const costTotal = Object.values(costs).reduce((sum, v) => sum + v, 0);
  const distributable = sde - costTotal - annualDebt;
  const flags = new Set(input.flags);

  // Shifts from active flags
  const haircutShift = (["R7", "R8", "R14"].some(f => flags.has(f)) ? priors.financialHaircutShift : 0)
    + (["R9", "R10"].some(f => flags.has(f)) ? priors.staleHaircutShift : 0);
  const holdUpShift = (flags.has("R1") ? priors.licenseHoldUpShift : 0) + (flags.has("R2") ? priors.familyHoldUpShift : 0);
  const collapseShift = (flags.has("R2") ? priors.familyCollapseShift : 0)
    + (["R9", "R10"].some(f => flags.has(f)) ? priors.staleCollapseShift : 0) + (flags.has("R3") ? priors.unionCollapseShift : 0);

  const haircut = priors.haircut + haircutShift;
  const holdUp = priors.holdUp + holdUpShift;
  const collapse = priors.collapse + collapseShift;
  const clean = 1 - haircut - holdUp - collapse;
  if (clean < 0) throw new Error("Risk shifts exceed available probability mass");

  // Return removed adverse mass to clean; reprice only the transferred haircut mass.
  const protectedHoldUp = holdUp * priors.protectionFactor, protectedCollapse = collapse * priors.protectionFactor;
  const repricedProbability = haircut * priors.repriceFraction;
  const priceReduction = sde * priors.sdeHaircut * (ask / sde);
  const repricedDebt = annualDebtService((ask - priceReduction + mandate.closingCosts) * (1 - mandate.equityPct), mandate.rate, mandate.termYears);
  
  const states = [
    { id: "clean", cash: distributable, unprotected: clean, protected: clean + holdUp - protectedHoldUp + collapse - protectedCollapse },
    { id: "haircut", cash: distributable - sde * priors.sdeHaircut, unprotected: haircut, protected: haircut - repricedProbability },
    { id: "hold_up", cash: distributable - sde * priors.holdUpLoss, unprotected: holdUp, protected: protectedHoldUp },
    { id: "collapse", cash: 0, unprotected: collapse, protected: protectedCollapse },
    { id: "repriced", cash: sde * (1 - priors.sdeHaircut) - costTotal - repricedDebt, unprotected: 0, protected: repricedProbability },
  ];

  const evUnprotected = states.reduce((sum, s) => sum + s.cash * s.unprotected, 0);
  const evProtected = states.reduce((sum, s) => sum + s.cash * s.protected, 0);

  // ─── Marginal EV Countermove Ranking (Step 4 of V2 spec) ────────────────────
  const countermoves: Countermove[] = [];

  const defineMove = (id: string, flagId: string, title: string, description: string, protectedHoldUpShift: number, protectedCollapseShift: number, protectedHaircutShift: number) => {
    // Isolated move calculation: protect only this specific shift
    const moveHoldUp = (holdUp - protectedHoldUpShift) + protectedHoldUpShift * priors.protectionFactor;
    const moveCollapse = (collapse - protectedCollapseShift) + protectedCollapseShift * priors.protectionFactor;
    const moveHaircutReprice = protectedHaircutShift * priors.repriceFraction;
    const moveHaircut = (haircut - protectedHaircutShift) + (protectedHaircutShift - moveHaircutReprice);
    const moveClean = clean + (protectedHoldUpShift * (1 - priors.protectionFactor)) + (protectedCollapseShift * (1 - priors.protectionFactor));

    const moveEv = (distributable * moveClean)
      + ((distributable - sde * priors.sdeHaircut) * moveHaircut)
      + ((distributable - sde * priors.holdUpLoss) * moveHoldUp)
      + (0 * moveCollapse)
      + ((sde * (1 - priors.sdeHaircut) - costTotal - repricedDebt) * moveHaircutReprice);

    const marginalEvGain = Math.max(0, moveEv - evUnprotected);
    countermoves.push({ id, flagId, title, description, marginalEvGain, walkAway: false });
  };

  if (flags.has("R1")) {
    defineMove(
      "move_r1",
      "R1",
      "Qualifier agreement & LOI terms",
      "Fix price and transition terms for license qualifier in LOI as a closing condition; add vesting profit share.",
      priors.licenseHoldUpShift,
      0,
      0
    );
  }

  if (flags.has("R2")) {
    defineMove(
      "move_r2",
      "R2",
      "Retention agreements for the brother and father",
      "Execute non-competes, non-solicits, and structured retention agreements with named family managers.",
      priors.familyHoldUpShift,
      priors.familyCollapseShift,
      0
    );
  }

  if (flags.has("R3")) {
    defineMove(
      "move_r3",
      "R3",
      "Multiemployer pension withdrawal liability cap",
      "Require actuarial assessment and contractual indemnification / price escrow for pension withdrawal liabilities.",
      0,
      priors.unionCollapseShift,
      0
    );
  }

  if (flags.has("R9") || flags.has("R10")) {
    defineMove(
      "move_lemons",
      flags.has("R9") ? "R9" : "R10",
      "Screening menu (Option A full ask w/ seller note vs Option B 92% ask)",
      "Offer structured screening menu to test seller private information regarding staleness or motivation.",
      0,
      priors.staleCollapseShift,
      priors.staleHaircutShift
    );
  }

  if (flags.has("R7") || flags.has("R8") || flags.has("R14")) {
    defineMove(
      "move_haircut",
      flags.has("R7") ? "R7" : flags.has("R8") ? "R8" : "R14",
      "Detailed add-back itemization and escrow",
      "Verify normalized SDE and establish escrow for add-backs unsupported in general ledger audit.",
      0,
      0,
      priors.financialHaircutShift
    );
  }

  // Sort countermoves descending by marginal EV gain
  countermoves.sort((a, b) => b.marginalEvGain - a.marginalEvGain);

  // Designate the move with highest marginal EV gain as the walk-away condition
  if (countermoves.length > 0) {
    countermoves[0].walkAway = true;
  }

  const walkAwayCondition = countermoves.find(m => m.walkAway)?.title ?? "No critical countermove identified";

  // Run Seeded Monte Carlo
  const monteCarlo = simulateMonteCarloV2({ ask, sde, mandate, costs });

  return {
    version: priors.version,
    priors,
    states,
    waterfall: { sde, ...costs, annualDebtService: annualDebt, distributable },
    evUnprotected,
    evProtected,
    difference: evProtected - evUnprotected,
    priceReduction,
    countermoves,
    walkAwayCondition,
    monteCarlo,
    label: "judgment-based priors, not a statistical forecast",
    limitations: [
      "Protections are hypothetical, not executed agreements or proven probability reductions.",
      "Collapse assumes zero distributable cash; it does not model capital loss or liabilities.",
      "Negative operating cash remains negative; expected cash is not an investment return.",
      "Marginal protection gains are isolated scenario simulations per move.",
    ],
  };
}

/**
 * Applies binding walk-away refusal: if the seller refuses the primary walk-away countermove,
 * the acquisition verdict is capped/downgraded to WATCHLIST with reason 'walk_away_triggered'.
 */
export function applyWalkAwayRefusal(
  simulation: ReturnType<typeof simulateAcquisitionV2>,
  refusedMoveId: string
) {
  const move = simulation.countermoves.find(m => m.id === refusedMoveId);
  if (!move) throw new Error(`Countermove ${refusedMoveId} not found in simulation`);
  if (!move.walkAway) {
    return {
      walkAwayTriggered: false,
      reason: `Refusal of secondary countermove '${move.title}' noted; does not trigger walk-away.`,
      verdictOverride: null,
    };
  }

  return {
    walkAwayTriggered: true,
    reason: `walk_away_triggered: Seller refused critical countermove '${move.title}' (marginal EV: $${Math.round(move.marginalEvGain).toLocaleString()}). Deal cannot proceed at current terms.`,
    verdictOverride: "WATCHLIST" as const,
  };
}
