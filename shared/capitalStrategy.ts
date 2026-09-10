import type { UnderwritingHoldingPeriod } from "./playUnderwriting";
import { z } from "zod";

export const strategyIntentSchema = z.enum([
  "deploy_excess_capital", "redeploy_realized_gains", "explore_opportunity", "review_material_change",
]);
export type StrategyIntent = z.infer<typeof strategyIntentSchema>;

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

const receiptId = z.string().refine(value => value.trim().length > 0);
const receiptTime = z.number().int().nonnegative().safe();
const allocationClaimsSchema = z.array(z.object({
  allocationId: receiptId, capitalEventId: receiptId,
  amountCents: z.number().int().nonnegative().safe(),
  state: z.enum(["pending", "committed", "consumed", "released"]),
}).strict());
const observedEventsSchema = z.array(receiptId);
const receiptIdentitySchema = z.object({
  receiptId, status: z.enum(["complete", "partial", "failed"]),
  sourceId: receiptId, accountId: receiptId, capitalEventId: receiptId, asOf: receiptTime,
});

/** Supplied by an authorized, complete ledger read for this exact source and decision time.
 * Never accept this receipt from browser/model claims. It is not a reservation. */
export const capitalLedgerReceiptSchema = receiptIdentitySchema.extend({
  allocationClaims: allocationClaimsSchema, observedCapitalEventIds: observedEventsSchema,
}).strict();
export type CapitalLedgerReceipt = z.infer<typeof capitalLedgerReceiptSchema>;

/** Independent owned-record lookup, not a candidate's self-declared linkage.
 * A future adapter must authorize/join the persisted source and underwriting rows. */
export const capitalStrategyBindingReceiptSchema = receiptIdentitySchema.extend({
  candidates: z.array(z.object({
    candidateId: receiptId, symbol: receiptId, causalPathId: receiptId,
    underwritingResultId: receiptId, playId: receiptId,
  }).strict()),
}).strict();
export type CapitalStrategyBindingReceipt = z.infer<typeof capitalStrategyBindingReceiptSchema>;

export type CapitalEnvelopeBlocker =
  | "invalid_capital_amount"
  | "invalid_capital_lineage"
  | "account_unverified"
  | "capital_after_cutoff"
  | "missing_closing_fill"
  | "gain_not_realized"
  | "gain_not_reconciled"
  | "funds_not_available"
  | "reserve_exceeds_realized_profit"
  | "duplicate_capital_event"
  | "duplicate_allocation_claim"
  | "concurrent_allocation"
  | "allocation_ledger_unverified"
  | "allocation_ledger_mismatch";

export type CapitalEnvelope = {
  sourceId: string;
  sourceKind: CapitalSourceKind;
  account: NamedCapitalAccount;
  status: "verified" | "operator_declared" | "hypothetical_only" | "blocked";
  grossSourceCents: number | null;
  netSaleProceedsCents: number | null;
  returnedPrincipalCents: number | null;
  realizedProfitLossCents: number | null;
  reserveCents: number | null;
  alreadyAllocatedCents: number | null;
  /** Permitted allocation, not a claim that an unknown cash balance equals zero. */
  deployableCents: number;
  hypotheticalDeployableCents: number;
  blockers: CapitalEnvelopeBlocker[];
  mayIncreaseRiskBudget: false;
};

export type CapitalEnvelopeInput = {
  source: CapitalSource;
  /** Optional for source compatibility; absent/incomplete proof blocks real allocation. */
  ledgerReceipt?: CapitalLedgerReceipt | null;
  /** @deprecated Only consistency-checked against ledgerReceipt; never proof by themselves. */
  allocationClaims?: CapitalAllocationClaim[];
  /** @deprecated Only consistency-checked against ledgerReceipt; never proof by itself. */
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

export type StrategyEvidenceState = {
  status: "available" | "partial" | "failed";
  failures: string[];
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
  /** Explicit historical baseline; a launch already known here is not a new catalyst. */
  expectationsBaseline?: {
    asOf: number;
    commercialLaunchStatus: TechnologyPermissionEvidence["commercialLaunchStatus"];
    sources: CausalEvidenceSource[];
    /** Sourced development after the baseline, not a prose relabeling of the launch. */
    incrementalChange: CausalAssertion | null;
  } | null;
  counterargument: string;
  technologyPermission: TechnologyPermissionEvidence | null;
  marketMeasurement: MarketMeasurementEvidence | null;
  providerState: StrategyEvidenceState;
  /** Optional for callers that supply already-classified assertions without a model. */
  classifierState?: StrategyEvidenceState;
  reviewAt: number | null;
  expiresAt: number | null;
};

export type CausalPathReason =
  | "provider_failure"
  | "provider_partial"
  | "classifier_failure"
  | "classifier_partial"
  | "classification_unverified"
  | "evaluation_time_unverified"
  | "source_time_unverified"
  | "source_after_cutoff"
  | "source_provenance_unverified"
  | "measurement_after_cutoff"
  | "measurement_unverified"
  | "expectations_baseline_unverified"
  | "historical_launch_not_incremental"
  | "path_expired"
  | "path_expiry_unverified"
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
  /** Ineligible source records remain auditable but never count as current evidence. */
  excludedSources: Array<{ source: CausalEvidenceSource; reasons: CausalPathReason[] }>;
  unknowns: string[];
  contradictions: string[];
  confidence: number | null;
};

export const capitalSearchScopeSchema = z.enum(["current_thesis", "related_opportunities", "broader_permitted_universe"]);
export type CapitalSearchScope = z.infer<typeof capitalSearchScopeSchema>;
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
    /** If measured by the Underwriter, also enforce funding, not just planned risk. */
    proposedNotionalCents?: number | null;
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
  /** Every non-selected hypothesis, including eligible candidates outside the shortlist. */
  rejectedHypotheses: Array<{ candidateId: string; reasons: string[] }>;
  sideEffects: {
    capitalReserved: false;
    proposalCreated: false;
    orderCreated: false;
    brokerInvoked: false;
  };
};

const validCents = (value: number) => Number.isSafeInteger(value) && value >= 0;
const nonBlank = (value: string) => typeof value === "string" && value.trim().length > 0;
const validTime = (value: number | null | undefined): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function capitalSourceLineageId(source: CapitalSource): string {
  if (source.kind === "realized_gains" || source.kind === "returned_principal") return source.capitalEventId;
  if (source.kind === "operator_declared_excess") return source.declarationId;
  if (source.kind === "reconciled_available_funds") return source.reconciliationId;
  return source.sourcePlayId;
}

function capitalLineageBlockers(source: CapitalSource): CapitalEnvelopeBlocker[] {
  const blockers: CapitalEnvelopeBlocker[] = [];
  if (!nonBlank(source.account.id) || !nonBlank(source.account.name) || !["paper", "live"].includes(source.account.mode)) blockers.push("account_unverified");
  if (!nonBlank(source.id) || !nonBlank(capitalSourceLineageId(source))
    || (source.kind === "realized_gains" && !nonBlank(source.sourcePlayId))
    || (source.kind === "hypothetical_future_proceeds" && !nonBlank(source.assumption))
    || (source.kind === "reconciled_available_funds" && !validTime(source.reconciledAt))) blockers.push("invalid_capital_lineage");
  return blockers;
}

function activeAllocationState(input: CapitalEnvelopeInput, capitalEventId: string | null, asOf?: number): { blockers: CapitalEnvelopeBlocker[]; alreadyAllocatedCents: number | null } {
  const blockers: CapitalEnvelopeBlocker[] = [];
  // Hypothetical proceeds cannot have an available event ledger or reserve capital.
  if (capitalEventId == null) return { blockers, alreadyAllocatedCents: null };
  const parsed = capitalLedgerReceiptSchema.safeParse(input.ledgerReceipt);
  if (!parsed.success || parsed.data.status !== "complete") return { blockers: ["allocation_ledger_unverified"], alreadyAllocatedCents: null };
  const receipt = parsed.data;
  if (!validTime(asOf) || receipt.asOf !== asOf || receipt.sourceId !== input.source.id
    || receipt.accountId !== input.source.account.id || receipt.capitalEventId !== capitalEventId
    || !receipt.observedCapitalEventIds.includes(capitalEventId)) {
    return { blockers: ["allocation_ledger_mismatch"], alreadyAllocatedCents: null };
  }
  // Keep old typed callers compatible, but refuse contradictory parallel ledgers.
  const claimSignature = (claims: CapitalAllocationClaim[]) => JSON.stringify(claims.map(claim => JSON.stringify([claim.allocationId, claim.capitalEventId, claim.amountCents, claim.state])).sort());
  if (input.allocationClaims !== undefined) {
    const legacy = allocationClaimsSchema.safeParse(input.allocationClaims);
    if (!legacy.success || claimSignature(legacy.data) !== claimSignature(receipt.allocationClaims)) return { blockers: ["allocation_ledger_mismatch"], alreadyAllocatedCents: null };
  }
  if (input.observedCapitalEventIds !== undefined) {
    const legacy = observedEventsSchema.safeParse(input.observedCapitalEventIds);
    if (!legacy.success || JSON.stringify([...legacy.data].sort()) !== JSON.stringify([...receipt.observedCapitalEventIds].sort())) return { blockers: ["allocation_ledger_mismatch"], alreadyAllocatedCents: null };
  }
  if (receipt.observedCapitalEventIds.filter((id) => id === capitalEventId).length > 1) {
    blockers.push("duplicate_capital_event");
  }
  const activeClaims = receipt.allocationClaims.filter((claim) =>
    claim.capitalEventId === capitalEventId && claim.state !== "released",
  );
  const claimIds = new Set<string>();
  let alreadyAllocatedCents = 0;
  for (const claim of activeClaims) {
    if (!nonBlank(claim.allocationId)) blockers.push("invalid_capital_lineage");
    if (claimIds.has(claim.allocationId)) {
      if (!blockers.includes("duplicate_allocation_claim")) blockers.push("duplicate_allocation_claim");
      continue;
    }
    claimIds.add(claim.allocationId);
    if (!validCents(claim.amountCents) || !validCents(alreadyAllocatedCents + claim.amountCents)) {
      if (!blockers.includes("invalid_capital_amount")) blockers.push("invalid_capital_amount");
      continue;
    }
    alreadyAllocatedCents += claim.amountCents;
  }
  if (activeClaims.length) blockers.push("concurrent_allocation");
  return { blockers, alreadyAllocatedCents };
}

export function deriveCapitalEnvelope(input: CapitalEnvelopeInput, asOf?: number): CapitalEnvelope {
  const { source } = input;
  // Claims on declared/reconciled funds use their lineage identity too. This is
  // snapshot validation only; a transactional allocation ledger must enforce writes.
  const capitalEventId = source.kind === "hypothetical_future_proceeds" ? null : capitalSourceLineageId(source);
  const allocation = activeAllocationState(input, capitalEventId, asOf);
  if (source.kind !== "realized_gains") {
    const amount = validCents(source.amountCents) ? source.amountCents : null;
    const blockers = [...capitalLineageBlockers(source), ...allocation.blockers];
    if (source.kind === "reconciled_available_funds" && validTime(asOf) && source.reconciledAt > asOf) blockers.push("capital_after_cutoff");
    if (amount == null || amount <= 0) blockers.push("invalid_capital_amount");
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
      deployableCents: hardBlocked || hypothetical ? 0 : amount!,
      hypotheticalDeployableCents: hypothetical && !hardBlocked ? amount! : 0,
      blockers: Array.from(new Set(blockers)),
      mayIncreaseRiskBudget: false,
    };
  }

  const blockers: CapitalEnvelopeBlocker[] = [...capitalLineageBlockers(source), ...allocation.blockers];
  const values = [source.recordedCostBasisCents, source.netSaleProceedsCents, source.feesCents, source.profitReserveCents];
  if (values.some((value) => !validCents(value))) blockers.push("invalid_capital_amount");
  if (!source.closingFillIds.length || source.closingFillIds.some((id) => !nonBlank(id))) blockers.push("missing_closing_fill");
  if (new Set(source.closingFillIds.map((id) => id.trim())).size !== source.closingFillIds.length) blockers.push("invalid_capital_lineage");
  if (source.realizationState !== "realized") blockers.push("gain_not_realized");
  if (source.reconciliationState !== "reconciled") blockers.push("gain_not_reconciled");
  if (source.availabilityState !== "verified_available") blockers.push("funds_not_available");

  const costBasisCents = validCents(source.recordedCostBasisCents) ? source.recordedCostBasisCents : null;
  const netSaleProceedsCents = validCents(source.netSaleProceedsCents) ? source.netSaleProceedsCents : null;
  const realizedProfitLossCents = netSaleProceedsCents == null || costBasisCents == null ? null : netSaleProceedsCents - costBasisCents;
  const returnedPrincipalCents = costBasisCents == null || netSaleProceedsCents == null ? null : Math.min(costBasisCents, netSaleProceedsCents);
  const realizedGainCents = realizedProfitLossCents == null ? null : Math.max(0, realizedProfitLossCents);
  const reserveCents = validCents(source.profitReserveCents) ? source.profitReserveCents : null;
  if (reserveCents != null && realizedGainCents != null && reserveCents > realizedGainCents) blockers.push("reserve_exceeds_realized_profit");

  const uniqueBlockers = Array.from(new Set(blockers));
  const hypotheticalOnly = uniqueBlockers.some((blocker) =>
    blocker === "gain_not_realized" || blocker === "gain_not_reconciled" || blocker === "funds_not_available",
  );
  const hardBlocked = uniqueBlockers.some((blocker) =>
    blocker === "invalid_capital_amount"
    || blocker === "invalid_capital_lineage"
    || blocker === "account_unverified"
    || blocker === "missing_closing_fill"
    || blocker === "reserve_exceeds_realized_profit"
    || blocker === "duplicate_capital_event"
    || blocker === "duplicate_allocation_claim"
    || blocker === "concurrent_allocation"
    || blocker === "allocation_ledger_unverified"
    || blocker === "allocation_ledger_mismatch",
  );
  const gainsAfterReserveCents = realizedGainCents == null || reserveCents == null ? null : Math.max(0, realizedGainCents - reserveCents);
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
    deployableCents: uniqueBlockers.length ? 0 : gainsAfterReserveCents!,
    hypotheticalDeployableCents: uniqueBlockers.length && !hardBlocked ? gainsAfterReserveCents! : 0,
    blockers: uniqueBlockers,
    mayIncreaseRiskBudget: false,
  };
}

/** All clocks are input facts. Never use Date.now() to replay an old decision. */
function evidenceExclusions(source: CausalEvidenceSource, asOf?: number): CausalPathReason[] {
  const reasons: CausalPathReason[] = [];
  let sourcedUrl = false;
  try {
    const url = new URL(source.sourceUrl);
    sourcedUrl = url.protocol === "https:" || url.protocol === "http:";
  } catch { /* Missing or malformed provenance is not evidence. */ }
  if (![source.id, source.originId, source.sourceName].every(nonBlank) || !sourcedUrl) reasons.push("source_provenance_unverified");
  const eventTimes = [source.observedAt, source.publishedAt].filter((time) => time != null);
  if (!validTime(source.retrievedAt) || !eventTimes.length || eventTimes.some((time) => !validTime(time))) reasons.push("source_time_unverified");
  if (validTime(asOf) && [source.retrievedAt, ...eventTimes].some((time) => validTime(time) && time > asOf)) reasons.push("source_after_cutoff");
  return reasons;
}

/**
 * Without a point-in-time cutoff, legacy callers can inspect a path but cannot
 * promote it as verified. Deduplication does not change qualification; excluded
 * source inputs require re-evaluating the assertion without hindsight evidence.
 */
export function assessCausalEconomicPath(path: CausalEconomicPath, asOf?: number): CausalPathAssessment {
  const reasons: CausalPathReason[] = [];
  const baseline = path.expectationsBaseline;
  const assertions = [path.originatingSignal, ...path.hops.map((hop) => hop.assertion),
    ...(baseline?.incrementalChange ? [baseline.incrementalChange] : [])];
  const sourcesByOrigin = new Map<string, CausalEvidenceSource>();
  const excludedSources: CausalPathAssessment["excludedSources"] = [];
  const eligibleByAssertion = new Map<CausalAssertion, CausalEvidenceSource[]>();
  const collectSources = (sources: CausalEvidenceSource[], cutoff?: number) => {
    const eligible: CausalEvidenceSource[] = [];
    for (const source of sources) {
      const exclusions = evidenceExclusions(source, cutoff);
      if (exclusions.length) {
        reasons.push(...exclusions);
        excludedSources.push({ source, reasons: exclusions });
        continue;
      }
      eligible.push(source);
      const origin = source.originId.trim();
      if (sourcesByOrigin.has(origin)) reasons.push("repeated_source_origin");
      else sourcesByOrigin.set(origin, source);
    }
    return eligible;
  };
  for (const assertion of assertions) eligibleByAssertion.set(assertion, collectSources(assertion.sources, asOf));
  const baselineSources = baseline ? collectSources(baseline.sources, validTime(asOf) && validTime(baseline.asOf) ? Math.min(asOf, baseline.asOf) : asOf) : [];
  if (!validTime(asOf)) reasons.push("evaluation_time_unverified");
  if (path.providerState.status === "failed") reasons.push("provider_failure");
  if (path.providerState.status === "partial") reasons.push("provider_partial");
  if (path.classifierState?.status === "failed") reasons.push("classifier_failure");
  if (path.classifierState?.status === "partial") reasons.push("classifier_partial");
  if (assertions.some((assertion) => !["reported_observation", "issuer_claim", "analyst_inference", "user_hypothesis"].includes(assertion.assertionClass))) reasons.push("classification_unverified");
  if (path.hops.length > 3) reasons.push("too_many_hops");
  if (assertions.some((assertion) => !eligibleByAssertion.get(assertion)?.length || !nonBlank(assertion.statement))) reasons.push("missing_evidence");
  if (assertions.some((assertion) => !nonBlank(assertion.invalidation))) reasons.push("missing_invalidation");
  if (!nonBlank(path.whatChangedFromExpectations)) reasons.push("missing_expectations_delta");
  if (!nonBlank(path.counterargument)) reasons.push("missing_counterargument");
  if (path.securityMapping.status !== "verified" || !path.securityMapping.symbol?.trim() || !nonBlank(path.securityMapping.entity)) reasons.push("security_mapping_unverified");
  if (path.expiresAt != null) {
    if (!validTime(path.expiresAt)) reasons.push("path_expiry_unverified");
    else if (validTime(asOf) && path.expiresAt <= asOf) reasons.push("path_expired");
  }

  for (const hop of path.hops) {
    if (hop.mechanism.kind === "fixed_fee" && hop.estimatedImpact?.basis === "usage_driven") reasons.push("fixed_fee_has_no_usage_uplift");
    if (hop.mechanism.commercialTermsStatus !== "verified" || hop.mechanism.kind === "unknown") reasons.push("commercial_terms_unverified");
  }
  const permission = path.technologyPermission;
  if (permission && (
    permission.permissionStatus === "unverified"
    || !permission.jurisdictionAndProductIdentified
    || (permission.permissionStatus === "verified" && !permission.rightsDocumented)
  )) reasons.push("permission_unverified");
  if (permission?.commercialLaunchStatus === "launched" && !baseline) reasons.push("expectations_baseline_unverified");
  if (baseline) {
    if (!validTime(baseline.asOf) || !validTime(asOf) || baseline.asOf > asOf || !baselineSources.length) reasons.push("expectations_baseline_unverified");
    if (baseline.commercialLaunchStatus === "launched") {
      const changeSources = baseline.incrementalChange ? eligibleByAssertion.get(baseline.incrementalChange) ?? [] : [];
      // Retrieval of the same old announcement does not establish a new change.
      const hasSubsequentDevelopment = changeSources.some((source) =>
        !baselineSources.some((prior) => prior.originId.trim() === source.originId.trim())
        && [source.observedAt, source.publishedAt].some((time) => validTime(time) && time > baseline.asOf));
      if (!baseline.incrementalChange || !nonBlank(baseline.incrementalChange.statement) || !hasSubsequentDevelopment) reasons.push("historical_launch_not_incremental");
    }
  }

  const measurement = path.marketMeasurement;
  if (measurement) {
    if (!validTime(measurement.asOf) || !nonBlank(measurement.methodology) || !nonBlank(measurement.coverage)) reasons.push("measurement_unverified");
    if (validTime(asOf) && measurement.asOf > asOf) reasons.push("measurement_after_cutoff");
    if (measurement.kind === "odds" && !measurement.volumeObserved) reasons.push("odds_feed_has_no_volume");
    if (measurement.kind === "odds" || measurement.kind === "listed_markets") {
      // Availability and prices are not activity, even if an inconsistent volume
      // flag is attached. Activity requires its own measurement and provenance.
      if (measurement.claimedMetrics.some((metric) => ["handle", "customer_count", "revenue", "profitability"].includes(metric))) reasons.push("unsupported_activity_inference");
    }
  }

  const uniqueReasons = Array.from(new Set(reasons));
  const hardRejected = uniqueReasons.some((reason) =>
    reason === "too_many_hops" || reason === "fixed_fee_has_no_usage_uplift" || reason === "unsupported_activity_inference"
    || reason === "historical_launch_not_incremental" || reason === "path_expired",
  );
  const unavailable = uniqueReasons.includes("provider_failure") || uniqueReasons.includes("classifier_failure");
  const needsResearch = uniqueReasons.some((reason) => reason !== "repeated_source_origin");
  return {
    pathId: path.id,
    status: unavailable ? "unavailable" : hardRejected ? "rejected" : needsResearch ? "conditional_research" : "verified",
    reasons: uniqueReasons,
    independentOriginCount: sourcesByOrigin.size,
    sources: Array.from(sourcesByOrigin.values()),
    excludedSources,
    unknowns: Array.from(new Set(assertions.flatMap((assertion) => assertion.unknowns))),
    contradictions: Array.from(new Set(assertions.flatMap((assertion) => assertion.contradictions))),
    // Passing structural checks is not a calibrated 100% probability.
    confidence: null,
  };
}
