import type { UnderwritingHoldingPeriod } from "./playUnderwriting";

export type StrategyIntent =
  | "deploy_excess_capital"
  | "redeploy_realized_gains"
  | "explore_opportunity"
  | "review_material_change";

export type NamedCapitalAccount = {
  id: string;
  name: string;
  mode: "paper" | "live" | "unknown";
};

export type CapitalSourceKind =
  | "operator_declared_excess"
  | "reconciled_available_funds"
  | "realized_gains"
  | "returned_principal"
  | "hypothetical_future_proceeds";

type CapitalSourceBase = {
  id: string;
  kind: CapitalSourceKind;
  account: NamedCapitalAccount;
};

export type DeclaredCapitalSource = CapitalSourceBase & {
  kind: "operator_declared_excess";
  amountCents: number;
  declarationId: string;
};

export type ReconciledFundsCapitalSource = CapitalSourceBase & {
  kind: "reconciled_available_funds";
  amountCents: number;
  reconciliationId: string;
  reconciledAt: number;
};

export type ReturnedPrincipalCapitalSource = CapitalSourceBase & {
  kind: "returned_principal";
  amountCents: number;
  capitalEventId: string;
};

export type HypotheticalProceedsCapitalSource = CapitalSourceBase & {
  kind: "hypothetical_future_proceeds";
  amountCents: number;
  sourcePlayId: string;
  assumption: string;
};

export type RealizedGainsCapitalSource = CapitalSourceBase & {
  kind: "realized_gains";
  capitalEventId: string;
  sourcePlayId: string;
  closingFillIds: string[];
  realizationState: "realized" | "unrealized";
  reconciliationState: "reconciled" | "pending" | "failed";
  availabilityState: "verified_available" | "unavailable";
  /** Cost basis attributed to the closing fills, not total historical purchases. */
  recordedCostBasisCents: number;
  /** Proceeds after fees. feesCents is retained as lineage and is not deducted twice. */
  netSaleProceedsCents: number;
  feesCents: number;
  profitReserveCents: number;
  reserveBasis: "operator_selected" | "declared_policy";
};

export type CapitalSource =
  | DeclaredCapitalSource
  | ReconciledFundsCapitalSource
  | RealizedGainsCapitalSource
  | ReturnedPrincipalCapitalSource
  | HypotheticalProceedsCapitalSource;

export type CapitalAllocationClaim = {
  allocationId: string;
  capitalEventId: string;
  amountCents: number;
  state: "pending" | "committed" | "consumed" | "released";
};

export type CapitalEnvelopeBlocker =
  | "invalid_capital_amount"
  | "missing_closing_fill"
  | "gain_not_realized"
  | "gain_not_reconciled"
  | "funds_not_available"
  | "reserve_exceeds_realized_profit"
  | "duplicate_capital_event"
  | "duplicate_allocation_claim"
  | "concurrent_allocation";

export type CapitalEnvelope = {
  sourceId: string;
  sourceKind: CapitalSourceKind;
  account: NamedCapitalAccount;
  status: "verified" | "operator_declared" | "hypothetical_only" | "blocked";
  grossSourceCents: number;
  netSaleProceedsCents: number | null;
  returnedPrincipalCents: number;
  realizedProfitLossCents: number | null;
  reserveCents: number;
  alreadyAllocatedCents: number;
  deployableCents: number;
  hypotheticalDeployableCents: number;
  blockers: CapitalEnvelopeBlocker[];
  mayIncreaseRiskBudget: false;
};

export type CapitalEnvelopeInput = {
  source: CapitalSource;
  allocationClaims?: CapitalAllocationClaim[];
  observedCapitalEventIds?: string[];
};

export type AssertionClass = "reported_observation" | "issuer_claim" | "analyst_inference" | "user_hypothesis";

export type CausalEvidenceSource = {
  id: string;
  /** Stable identity of the originating announcement, filing, dataset, or observation. */
  originId: string;
  sourceName: string;
  sourceUrl: string;
  observedAt: number | null;
  publishedAt: number | null;
  retrievedAt: number;
};

export type CausalAssertion = {
  id: string;
  statement: string;
  assertionClass: AssertionClass;
  sources: CausalEvidenceSource[];
  requiredConditions: string[];
  contradictions: string[];
  unknowns: string[];
  invalidation: string;
};

export type EconomicMechanism = {
  kind: "transactional" | "revenue_share" | "variable_usage" | "fixed_fee" | "minimum_commitment" | "unknown";
  commercialTermsStatus: "verified" | "unverified";
};

export type CausalPathHop = {
  id: string;
  from: string;
  to: string;
  assertion: CausalAssertion;
  mechanism: EconomicMechanism;
  estimatedImpact: {
    basis: "reported" | "modeled" | "usage_driven" | "unsupported";
    amountCents: number | null;
    description: string;
  } | null;
  expectedTiming: string;
  nextFactToVerify: string;
  failureCondition: string;
};

export type TechnologyPermissionEvidence = {
  technicalCapabilityDocumented: boolean;
  rightsDocumented: boolean;
  jurisdictionAndProductIdentified: boolean;
  permissionStatus: "verified" | "unverified" | "not_required";
  commercialLaunchStatus: "not_documented" | "announced" | "launched";
  adoptionObserved: boolean;
  financialImpactSupportable: boolean;
};

export type MarketMeasurementEvidence = {
  kind: "odds" | "listed_markets" | "reported_activity" | "operator_revenue" | "customer_adoption";
  volumeObserved: boolean;
  claimedMetrics: Array<"odds" | "listed_markets" | "handle" | "customer_count" | "revenue" | "profitability">;
  methodology: string;
  coverage: string;
  asOf: number;
};

export type CausalEconomicPath = {
  id: string;
  originatingSignal: CausalAssertion;
  /** Consequential links beyond the originating development. Maximum three. */
  hops: CausalPathHop[];
  affectedEntities: string[];
  securityMapping: { entity: string; symbol: string | null; status: "verified" | "unverified" | "not_public" };
  whatChangedFromExpectations: string;
  counterargument: string;
  technologyPermission: TechnologyPermissionEvidence | null;
  marketMeasurement: MarketMeasurementEvidence | null;
  providerState: { status: "available" | "partial" | "failed"; failures: string[] };
  reviewAt: number | null;
  expiresAt: number | null;
};

export type CausalPathReason =
  | "provider_failure"
  | "provider_partial"
  | "too_many_hops"
  | "missing_evidence"
  | "missing_invalidation"
  | "missing_expectations_delta"
  | "missing_counterargument"
  | "fixed_fee_has_no_usage_uplift"
  | "commercial_terms_unverified"
  | "permission_unverified"
  | "odds_feed_has_no_volume"
  | "unsupported_activity_inference"
  | "repeated_source_origin"
  | "security_mapping_unverified";

export type CausalPathAssessment = {
  pathId: string;
  status: "verified" | "conditional_research" | "rejected" | "unavailable";
  reasons: CausalPathReason[];
  independentOriginCount: number;
  sources: CausalEvidenceSource[];
  unknowns: string[];
  contradictions: string[];
  confidence: number | null;
};

export type CapitalSearchScope = "current_thesis" | "related_opportunities" | "broader_permitted_universe";
export type CapitalUseKind = "new_play" | "incremental_existing_thesis";

export type CapitalStrategyCandidate = {
  id: string;
  use: CapitalUseKind;
  title: string;
  symbol: string;
  horizon: UnderwritingHoldingPeriod;
  causalPath: CausalEconomicPath;
  /** Existing Play Underwriter output. The Strategist does not recalculate score or risk. */
  underwriter: {
    resultId: string;
    playId: string;
    state: "qualified" | "research_required" | "blocked";
    overallScore: number | null;
    plannedRiskCents: number | null;
  };
  whyThisUse: string;
  whyNow: string;
  whyNotAlternatives: string;
  changeCondition: string;
};

export type CapitalInvestmentAlternative = {
  candidateId: string;
  kind: CapitalUseKind;
  title: string;
  symbol: string;
  horizon: UnderwritingHoldingPeriod;
  underwritingResultId: string;
  playId: string;
  underwriterScore: number;
  plannedRiskCents: number | null;
  evidenceStatus: CausalPathAssessment["status"];
  whyThisUse: string;
  whyNow: string;
  whyNotAlternatives: string;
  changeCondition: string;
};

export type CapitalStrategyDecision = {
  intent: StrategyIntent;
  status: "complete" | "incomplete" | "unavailable";
  asOf: number;
  searchScope: CapitalSearchScope;
  envelope: CapitalEnvelope;
  primaryConclusion:
    | { kind: CapitalUseKind; candidateId: string; explanation: string }
    | { kind: "retain_capital"; candidateId: null; explanation: string };
  /** Includes the primary investment when investment is primary. Maximum two. */
  investmentAlternatives: CapitalInvestmentAlternative[];
  retainCapital: {
    alwaysAvailable: true;
    amountCents: number;
    reason: string;
    reviewCondition: string | null;
    reviewAt: number | null;
  };
  reviewedUniverse: string[];
  coverageGaps: string[];
  rejectedHypotheses: Array<{ candidateId: string; reasons: string[] }>;
  sideEffects: {
    capitalReserved: false;
    proposalCreated: false;
    orderCreated: false;
    brokerInvoked: false;
  };
};

const nonNegativeFinite = (value: number) => Number.isFinite(value) && value >= 0;

function activeAllocationState(input: CapitalEnvelopeInput, capitalEventId: string | null) {
  const blockers: CapitalEnvelopeBlocker[] = [];
  if (capitalEventId && (input.observedCapitalEventIds ?? [capitalEventId]).filter((id) => id === capitalEventId).length > 1) {
    blockers.push("duplicate_capital_event");
  }
  const activeClaims = capitalEventId == null ? [] : (input.allocationClaims ?? []).filter((claim) =>
    claim.capitalEventId === capitalEventId && claim.state !== "released",
  );
  const claimIds = new Set<string>();
  let alreadyAllocatedCents = 0;
  for (const claim of activeClaims) {
    if (claimIds.has(claim.allocationId)) {
      if (!blockers.includes("duplicate_allocation_claim")) blockers.push("duplicate_allocation_claim");
      continue;
    }
    claimIds.add(claim.allocationId);
    if (!nonNegativeFinite(claim.amountCents)) {
      if (!blockers.includes("invalid_capital_amount")) blockers.push("invalid_capital_amount");
      continue;
    }
    alreadyAllocatedCents += Math.round(claim.amountCents);
  }
  if (activeClaims.length) blockers.push("concurrent_allocation");
  return { blockers, alreadyAllocatedCents };
}

export function deriveCapitalEnvelope(input: CapitalEnvelopeInput): CapitalEnvelope {
  const { source } = input;
  const capitalEventId = "capitalEventId" in source ? source.capitalEventId : null;
  const allocation = activeAllocationState(input, capitalEventId);
  if (source.kind !== "realized_gains") {
    const amount = nonNegativeFinite(source.amountCents) ? Math.round(source.amountCents) : 0;
    const blockers = [...allocation.blockers];
    if (amount <= 0) blockers.push("invalid_capital_amount");
    const hypothetical = source.kind === "hypothetical_future_proceeds";
    const hardBlocked = blockers.length > 0;
    return {
      sourceId: source.id,
      sourceKind: source.kind,
      account: source.account,
      status: hardBlocked ? "blocked" : hypothetical ? "hypothetical_only" : source.kind === "operator_declared_excess" ? "operator_declared" : "verified",
      grossSourceCents: amount,
      netSaleProceedsCents: null,
      returnedPrincipalCents: source.kind === "returned_principal" ? amount : 0,
      realizedProfitLossCents: null,
      reserveCents: 0,
      alreadyAllocatedCents: allocation.alreadyAllocatedCents,
      deployableCents: hardBlocked || hypothetical ? 0 : amount,
      hypotheticalDeployableCents: hypothetical && !hardBlocked ? amount : 0,
      blockers: Array.from(new Set(blockers)),
      mayIncreaseRiskBudget: false,
    };
  }

  const blockers: CapitalEnvelopeBlocker[] = [...allocation.blockers];
  const values = [source.recordedCostBasisCents, source.netSaleProceedsCents, source.feesCents, source.profitReserveCents];
  if (values.some((value) => !nonNegativeFinite(value))) blockers.push("invalid_capital_amount");
  if (!source.closingFillIds.length) blockers.push("missing_closing_fill");
  if (source.realizationState !== "realized") blockers.push("gain_not_realized");
  if (source.reconciliationState !== "reconciled") blockers.push("gain_not_reconciled");
  if (source.availabilityState !== "verified_available") blockers.push("funds_not_available");

  const costBasisCents = nonNegativeFinite(source.recordedCostBasisCents) ? Math.round(source.recordedCostBasisCents) : 0;
  const netSaleProceedsCents = nonNegativeFinite(source.netSaleProceedsCents) ? Math.round(source.netSaleProceedsCents) : 0;
  const realizedProfitLossCents = netSaleProceedsCents - costBasisCents;
  const returnedPrincipalCents = Math.min(costBasisCents, netSaleProceedsCents);
  const realizedGainCents = Math.max(0, realizedProfitLossCents);
  const reserveCents = nonNegativeFinite(source.profitReserveCents) ? Math.round(source.profitReserveCents) : 0;
  if (reserveCents > realizedGainCents) blockers.push("reserve_exceeds_realized_profit");

  const uniqueBlockers = Array.from(new Set(blockers));
  const hypotheticalOnly = uniqueBlockers.some((blocker) =>
    blocker === "gain_not_realized" || blocker === "gain_not_reconciled" || blocker === "funds_not_available",
  );
  const hardBlocked = uniqueBlockers.some((blocker) =>
    blocker === "invalid_capital_amount"
    || blocker === "missing_closing_fill"
    || blocker === "reserve_exceeds_realized_profit"
    || blocker === "duplicate_capital_event"
    || blocker === "duplicate_allocation_claim"
    || blocker === "concurrent_allocation",
  );
  const gainsAfterReserveCents = Math.max(0, realizedGainCents - reserveCents);
  return {
    sourceId: source.id,
    sourceKind: source.kind,
    account: source.account,
    status: hardBlocked ? "blocked" : hypotheticalOnly ? "hypothetical_only" : "verified",
    grossSourceCents: netSaleProceedsCents,
    netSaleProceedsCents,
    returnedPrincipalCents,
    realizedProfitLossCents,
    reserveCents,
    alreadyAllocatedCents: allocation.alreadyAllocatedCents,
    deployableCents: uniqueBlockers.length ? 0 : gainsAfterReserveCents,
    hypotheticalDeployableCents: uniqueBlockers.length && !hardBlocked ? gainsAfterReserveCents : 0,
    blockers: uniqueBlockers,
    mayIncreaseRiskBudget: false,
  };
}

export function assessCausalEconomicPath(path: CausalEconomicPath): CausalPathAssessment {
  const reasons: CausalPathReason[] = [];
  const assertions = [path.originatingSignal, ...path.hops.map((hop) => hop.assertion)];
  const allSources = assertions.flatMap((assertion) => assertion.sources);
  const sourcesByOrigin = new Map<string, CausalEvidenceSource>();
  for (const source of allSources) if (!sourcesByOrigin.has(source.originId)) sourcesByOrigin.set(source.originId, source);
  if (sourcesByOrigin.size < allSources.length) reasons.push("repeated_source_origin");
  if (path.providerState.status === "failed") reasons.push("provider_failure");
  if (path.providerState.status === "partial") reasons.push("provider_partial");
  if (path.hops.length > 3) reasons.push("too_many_hops");
  if (assertions.some((assertion) => !assertion.sources.length)) reasons.push("missing_evidence");
  if (assertions.some((assertion) => !assertion.invalidation.trim())) reasons.push("missing_invalidation");
  if (!path.whatChangedFromExpectations.trim()) reasons.push("missing_expectations_delta");
  if (!path.counterargument.trim()) reasons.push("missing_counterargument");
  if (path.securityMapping.status !== "verified") reasons.push("security_mapping_unverified");

  for (const hop of path.hops) {
    if (hop.mechanism.kind === "fixed_fee" && hop.estimatedImpact?.basis === "usage_driven") reasons.push("fixed_fee_has_no_usage_uplift");
    if (hop.mechanism.commercialTermsStatus !== "verified") reasons.push("commercial_terms_unverified");
  }
  if (path.technologyPermission?.permissionStatus === "unverified") reasons.push("permission_unverified");
  if (path.marketMeasurement?.kind === "odds" && !path.marketMeasurement.volumeObserved) {
    reasons.push("odds_feed_has_no_volume");
    if (path.marketMeasurement.claimedMetrics.some((metric) => ["handle", "customer_count", "revenue", "profitability"].includes(metric))) {
      reasons.push("unsupported_activity_inference");
    }
  }

  const uniqueReasons = Array.from(new Set(reasons));
  const hardRejected = uniqueReasons.some((reason) =>
    reason === "too_many_hops" || reason === "fixed_fee_has_no_usage_uplift" || reason === "unsupported_activity_inference",
  );
  const unavailable = uniqueReasons.includes("provider_failure");
  return {
    pathId: path.id,
    status: unavailable ? "unavailable" : hardRejected ? "rejected" : uniqueReasons.length ? "conditional_research" : "verified",
    reasons: uniqueReasons,
    independentOriginCount: sourcesByOrigin.size,
    sources: Array.from(sourcesByOrigin.values()),
    unknowns: Array.from(new Set(assertions.flatMap((assertion) => assertion.unknowns))),
    contradictions: Array.from(new Set(assertions.flatMap((assertion) => assertion.contradictions))),
    confidence: uniqueReasons.length ? null : 100,
  };
}
