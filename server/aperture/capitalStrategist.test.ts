import { describe, expect, it } from "vitest";
import {
  assessCausalEconomicPath,
  deriveCapitalEnvelope,
  type CausalEconomicPath,
  type CapitalStrategyCandidate,
  type CapitalSource,
  type RealizedGainsCapitalSource,
} from "../../shared/capitalStrategy";
import { buildCapitalStrategyDecision, type CapitalStrategistInput } from "./capitalStrategist";

const realizedGainSource = (overrides: Partial<RealizedGainsCapitalSource> = {}): RealizedGainsCapitalSource => ({
  id: "source-gain-1",
  kind: "realized_gains",
  account: { id: "alpaca-paper-ai-thesis", name: "Alpaca Paper — AI Thesis", mode: "paper" },
  capitalEventId: "capital-event-close-1",
  sourcePlayId: "play-1",
  closingFillIds: ["fill-close-1"],
  realizationState: "realized",
  reconciliationState: "reconciled",
  availabilityState: "verified_available",
  recordedCostBasisCents: 1_000_000,
  netSaleProceedsCents: 1_180_000,
  feesCents: 2_500,
  profitReserveCents: 60_000,
  reserveBasis: "operator_selected",
  ...overrides,
});

const causalPath = (overrides: Partial<CausalEconomicPath> = {}): CausalEconomicPath => ({
  id: "path-1",
  originatingSignal: {
    id: "assertion-origin-1",
    statement: "A sports data supplier announced expanded distribution.",
    assertionClass: "reported_observation",
    sources: [{
      id: "source-article-1",
      originId: "origin-announcement-1",
      sourceName: "Issuer release",
      sourceUrl: "https://example.test/release",
      observedAt: Date.UTC(2026, 8, 8, 13),
      publishedAt: Date.UTC(2026, 8, 8, 12),
      retrievedAt: Date.UTC(2026, 8, 8, 14),
    }],
    requiredConditions: [],
    contradictions: [],
    unknowns: [],
    invalidation: "Invalidate if the announced distribution does not occur.",
  },
  hops: [{
    id: "hop-1",
    from: "Expanded distribution",
    to: "Supplier revenue",
    assertion: {
      id: "assertion-hop-1",
      statement: "More usage would increase supplier revenue.",
      assertionClass: "analyst_inference",
      sources: [{
        id: "source-article-2",
        originId: "origin-contract-1",
        sourceName: "Supplier filing",
        sourceUrl: "https://example.test/filing",
        observedAt: Date.UTC(2026, 8, 8, 13),
        publishedAt: Date.UTC(2026, 8, 8, 12),
        retrievedAt: Date.UTC(2026, 8, 8, 14),
      }],
      requiredConditions: ["Usage must affect supplier consideration."],
      contradictions: [],
      unknowns: [],
      invalidation: "Invalidate usage-driven revenue if consideration is fixed.",
    },
    mechanism: { kind: "variable_usage", commercialTermsStatus: "verified" },
    estimatedImpact: { basis: "usage_driven", amountCents: null, description: "Incremental usage revenue" },
    expectedTiming: "Next reporting period",
    nextFactToVerify: "Verify variable consideration in the contract.",
    failureCondition: "No variable consideration exists.",
  }],
  affectedEntities: ["Sports data supplier"],
  securityMapping: { entity: "Sports data supplier", symbol: "DATA", status: "verified" },
  whatChangedFromExpectations: "Distribution scope expanded beyond the prior baseline.",
  counterargument: "A fixed fee prevents higher usage from increasing near-term revenue.",
  technologyPermission: null,
  marketMeasurement: null,
  providerState: { status: "available", failures: [] },
  reviewAt: Date.UTC(2026, 9, 1, 14),
  expiresAt: Date.UTC(2026, 11, 31, 23, 59),
  ...overrides,
});

// Illustrative acceptance fixtures only: no provider, database, or broker calls.
const decisionTime = Date.UTC(2026, 8, 8, 14);
const strategyCandidate = (id = "candidate-1", overrides: Partial<CapitalStrategyCandidate> = {}): CapitalStrategyCandidate => ({
  id, use: "new_play", title: id, symbol: "DATA", horizon: "swing",
  causalPath: causalPath({ id: `path-${id}` }),
  underwriter: { resultId: `uw-${id}`, playId: `play-${id}`, state: "qualified", overallScore: 80, plannedRiskCents: 6_000 },
  whyThisUse: "Sourced economic change within the existing underwriting limit.",
  whyNow: "New evidence relative to the recorded baseline.",
  whyNotAlternatives: "Other reviewed uses did not rank as highly.",
  changeCondition: "Reassess when the economic mechanism changes.",
  ...overrides,
});
const strategyInput = (overrides: Partial<CapitalStrategistInput> = {}): CapitalStrategistInput => ({
  intent: "redeploy_realized_gains", capital: { source: realizedGainSource() },
  candidates: [strategyCandidate()], searchScope: "related_opportunities",
  reviewedUniverse: ["DATA"], coverageGaps: [],
  providerState: { status: "available", failures: [] },
  comparisonHorizon: "swing", now: decisionTime, reviewAt: decisionTime + 86_400_000,
  ...overrides,
});

describe("Capital Strategist point-in-time acceptance", () => {
  it.each(["publishedAt", "observedAt", "retrievedAt"] as const)("excludes a source whose %s is after the decision cutoff", (field) => {
    const candidate = strategyCandidate();
    candidate.causalPath.originatingSignal.sources[0][field] = decisionTime + 1;
    const result = buildCapitalStrategyDecision(strategyInput({ candidates: [candidate] }));
    expect(result.investmentAlternatives).toEqual([]);
    expect(result.rejectedHypotheses[0].reasons).toContain("source_after_cutoff");
    const assessment = assessCausalEconomicPath(candidate.causalPath, decisionTime);
    expect(assessment.independentOriginCount).toBe(1);
    expect(assessment.excludedSources[0].source.id).toBe("source-article-1");
    expect(assessment.sources.map((source) => source.id)).not.toContain("source-article-1");
  });

  it("does not backfill a historical decision with evidence retrieved later", () => {
    const candidate = strategyCandidate();
    candidate.causalPath.originatingSignal.sources[0].retrievedAt = decisionTime + 1;
    expect(buildCapitalStrategyDecision(strategyInput({ candidates: [candidate] })).primaryConclusion.kind).toBe("retain_capital");
    expect(buildCapitalStrategyDecision(strategyInput({ candidates: [candidate], now: decisionTime + 1 })).investmentAlternatives).toHaveLength(1);
  });

  it("does not launder a hindsight-derived assertion by adding an older citation", () => {
    const candidate = strategyCandidate();
    const source = candidate.causalPath.originatingSignal.sources[0];
    candidate.causalPath.originatingSignal.sources.push({ ...source, id: "future", originId: "future-development", publishedAt: decisionTime + 1 });
    const result = buildCapitalStrategyDecision(strategyInput({ candidates: [candidate] }));
    expect(result.investmentAlternatives).toEqual([]);
    expect(result.rejectedHypotheses[0].reasons).toContain("source_after_cutoff");
  });

  it("does not let a repeated assertion ID hide a missing source", () => {
    const path = causalPath();
    path.originatingSignal.sources = [];
    path.hops[0].assertion.id = path.originatingSignal.id;
    expect(assessCausalEconomicPath(path, decisionTime).reasons).toContain("missing_evidence");
    expect(assessCausalEconomicPath(path, decisionTime).status).toBe("conditional_research");
  });

  it("requires a deterministic evaluation time and dated evidence", () => {
    expect(assessCausalEconomicPath(causalPath()).status).toBe("conditional_research");
    const candidate = strategyCandidate();
    Object.assign(candidate.causalPath.originatingSignal.sources[0], { observedAt: null, publishedAt: null });
    expect(buildCapitalStrategyDecision(strategyInput({ candidates: [candidate] })).rejectedHypotheses[0].reasons).toContain("source_time_unverified");
  });

  it("deduplicates origin echoes without increasing confidence or changing qualification", () => {
    const path = causalPath();
    const before = assessCausalEconomicPath(path, decisionTime);
    path.originatingSignal.sources.push({ ...path.originatingSignal.sources[0], id: "syndicated-copy", sourceUrl: "https://example.test/echo" });
    const after = assessCausalEconomicPath(path, decisionTime);
    expect(after.status).toBe(before.status);
    expect(after.independentOriginCount).toBe(2);
    expect(after.sources).toHaveLength(2);
    expect(after.confidence).toBeNull();
    expect(after.reasons).toContain("repeated_source_origin");
  });

  it("does not count missing origin identities as independent evidence", () => {
    const path = causalPath();
    path.originatingSignal.sources[0].originId = " ";
    expect(assessCausalEconomicPath(path, decisionTime)).toMatchObject({ status: "conditional_research", independentOriginCount: 1, confidence: null });
  });

  it.each(["failed", "partial"] as const)("does not rank a candidate after a %s classifier result", (status) => {
    const result = buildCapitalStrategyDecision(strategyInput({ classifierState: { status, failures: ["classification unavailable"] } }));
    expect(result.investmentAlternatives).toEqual([]);
    expect(result.status).toBe(status === "failed" ? "unavailable" : "incomplete");
    expect(result.rejectedHypotheses[0].reasons).toContain(status === "failed" ? "classifier_failure" : "classifier_partial");
  });

  it("retains a candidate-local classifier failure as unavailable, not a complete no-setup result", () => {
    const candidate = strategyCandidate();
    candidate.causalPath.classifierState = { status: "failed", failures: ["classification unavailable"] };
    const result = buildCapitalStrategyDecision(strategyInput({ candidates: [candidate] }));
    expect(result.status).toBe("incomplete");
    expect(result.rejectedHypotheses[0].reasons).toContain("classifier_failure");
    expect(result.coverageGaps).toContain("classification unavailable");
  });

  it("fails closed on an unrecognized assertion classification", () => {
    const candidate = strategyCandidate();
    Object.assign(candidate.causalPath.originatingSignal, { assertionClass: "guessed" });
    const result = buildCapitalStrategyDecision(strategyInput({ candidates: [candidate] }));
    expect(result.investmentAlternatives).toEqual([]);
    expect(result.rejectedHypotheses[0].reasons).toContain("classification_unverified");
  });

  it("does not upgrade documented technology into product or jurisdiction permission", () => {
    const path = causalPath({ technologyPermission: {
      technicalCapabilityDocumented: true, rightsDocumented: false, jurisdictionAndProductIdentified: false,
      permissionStatus: "verified", commercialLaunchStatus: "announced", adoptionObserved: false, financialImpactSupportable: false,
    } });
    expect(assessCausalEconomicPath(path, decisionTime)).toMatchObject({ status: "conditional_research", confidence: null });
    expect(assessCausalEconomicPath(path, decisionTime).reasons).toContain("permission_unverified");
  });

  it("keeps an already launched development in the historical baseline, not a new catalyst", () => {
    const path = causalPath();
    path.expectationsBaseline = {
      asOf: decisionTime - 86_400_000, commercialLaunchStatus: "launched",
      sources: [{ ...path.originatingSignal.sources[0], id: "baseline", originId: "baseline-launch", observedAt: decisionTime - 86_400_000, publishedAt: decisionTime - 86_400_000, retrievedAt: decisionTime - 86_400_000 }],
      incrementalChange: null,
    };
    const result = buildCapitalStrategyDecision(strategyInput({ candidates: [strategyCandidate("historical", { causalPath: path })] }));
    expect(result.investmentAlternatives).toEqual([]);
    expect(result.rejectedHypotheses[0].reasons).toContain("historical_launch_not_incremental");
    path.expectationsBaseline.incrementalChange = { ...path.originatingSignal, id: "incremental", statement: "A subsequent sourced contract changed variable consideration." };
    expect(assessCausalEconomicPath(path, decisionTime).status).toBe("verified");
    path.expectationsBaseline.incrementalChange.sources = [{ ...path.originatingSignal.sources[0], originId: "baseline-launch" }];
    expect(assessCausalEconomicPath(path, decisionTime).reasons).toContain("historical_launch_not_incremental");
  });

  it.each(["odds", "listed_markets"] as const)("does not treat %s coverage as measured customer activity", (kind) => {
    const path = causalPath({ marketMeasurement: {
      kind, volumeObserved: true, claimedMetrics: ["customer_count", "profitability"],
      methodology: "Published price and market availability", coverage: "One event", asOf: decisionTime,
    } });
    expect(assessCausalEconomicPath(path, decisionTime).reasons).toContain("unsupported_activity_inference");
    expect(assessCausalEconomicPath(path, decisionTime).status).toBe("rejected");
  });

  it("does not promote a future measurement or expired path", () => {
    const path = causalPath({ marketMeasurement: {
      kind: "reported_activity", volumeObserved: true, claimedMetrics: ["handle"],
      methodology: "Reported activity", coverage: "One event", asOf: decisionTime + 1,
    }, expiresAt: decisionTime });
    expect(assessCausalEconomicPath(path, decisionTime).reasons).toEqual(expect.arrayContaining(["measurement_after_cutoff", "path_expired"]));
  });

  it("rejects fixed-fee usage uplift but permits a sourced fixed-fee amount without usage uplift", () => {
    const path = causalPath();
    path.hops[0].mechanism.kind = "fixed_fee";
    expect(assessCausalEconomicPath(path, decisionTime).status).toBe("rejected");
    path.hops[0].estimatedImpact = { basis: "reported", amountCents: 10_000, description: "Illustrative reported fixed contract consideration; not usage-linked." };
    expect(assessCausalEconomicPath(path, decisionTime).status).toBe("verified");
  });
});

describe("Capital Strategist exclusion audit acceptance", () => {
  it("records every non-selected hypothesis, including horizon, capital, score and shortlist exclusions", () => {
    const horizon = strategyCandidate("horizon", { horizon: "position" });
    const missingScore = strategyCandidate("missing-score");
    missingScore.underwriter.overallScore = null;
    const candidates = [strategyCandidate("a"), strategyCandidate("b"), strategyCandidate("c"), horizon, missingScore];
    const result = buildCapitalStrategyDecision(strategyInput({ candidates }));
    expect(result.rejectedHypotheses).toEqual(expect.arrayContaining([
      { candidateId: "c", reasons: ["not_shortlisted"] },
      { candidateId: "horizon", reasons: ["horizon_mismatch"] },
      { candidateId: "missing-score", reasons: ["underwriter_score_unavailable"] },
    ]));
    expect([...result.investmentAlternatives.map((item) => item.candidateId), ...result.rejectedHypotheses.map((item) => item.candidateId)].sort()).toEqual(candidates.map((item) => item.id).sort());
    const blocked = buildCapitalStrategyDecision(strategyInput({ candidates, capital: { source: realizedGainSource({ availabilityState: "unavailable" }) } }));
    expect(blocked.rejectedHypotheses).toHaveLength(candidates.length);
    expect(blocked.rejectedHypotheses.every((item) => item.reasons.includes("capital_unavailable"))).toBe(true);
    expect(blocked.rejectedHypotheses.find((item) => item.candidateId === "horizon")?.reasons).toContain("horizon_mismatch");
  });

  it.each([null, Number.NaN, -1, Number.POSITIVE_INFINITY, 120_001])("excludes unmeasured, invalid, or envelope-exceeding planned risk %s", (risk) => {
    const candidate = strategyCandidate();
    candidate.underwriter.plannedRiskCents = risk;
    const result = buildCapitalStrategyDecision(strategyInput({ candidates: [candidate] }));
    expect(result.investmentAlternatives).toEqual([]);
    expect(result.rejectedHypotheses[0].reasons).toContain(risk === 120_001 ? "capital_envelope_exceeded" : "underwriter_risk_unavailable");
  });

  it("retains capital when the realized gain envelope is empty even though source reconciliation succeeded", () => {
    const result = buildCapitalStrategyDecision(strategyInput({ capital: { source: realizedGainSource({ netSaleProceedsCents: 900_000, profitReserveCents: 0 }) } }));
    expect(result.envelope).toMatchObject({ status: "verified", returnedPrincipalCents: 900_000, realizedProfitLossCents: -100_000, deployableCents: 0 });
    expect(result.investmentAlternatives).toEqual([]);
    expect(result.rejectedHypotheses[0].reasons).toContain("capital_envelope_empty");
  });

  it("does not mutate input or increase existing underwriter risk or score", () => {
    const input = strategyInput();
    const before = structuredClone(input);
    const first = buildCapitalStrategyDecision(input);
    expect(buildCapitalStrategyDecision(input)).toEqual(first);
    expect(input).toEqual(before);
    expect(first.investmentAlternatives[0]).toMatchObject({ plannedRiskCents: 6_000, underwriterScore: 80 });
    expect(Object.values(first.sideEffects)).toEqual([false, false, false, false]);
  });

  it.each([null, Number.NaN, Number.POSITIVE_INFINITY, -1])("records an unusable underwriter score %s", (score) => {
    const candidate = strategyCandidate();
    candidate.underwriter.overallScore = score;
    expect(buildCapitalStrategyDecision(strategyInput({ candidates: [candidate] })).rejectedHypotheses[0].reasons).toContain("underwriter_score_unavailable");
  });

  it("enforces measured capital required as well as risk without resizing the play", () => {
    const candidate = strategyCandidate();
    candidate.underwriter.proposedNotionalCents = 120_001;
    const result = buildCapitalStrategyDecision(strategyInput({ candidates: [candidate] }));
    expect(result.investmentAlternatives).toEqual([]);
    expect(result.rejectedHypotheses[0].reasons).toContain("capital_envelope_exceeded");
    expect(candidate.underwriter.plannedRiskCents).toBe(6_000);
    candidate.underwriter.proposedNotionalCents = 120_000;
    expect(buildCapitalStrategyDecision(strategyInput({ candidates: [candidate] })).investmentAlternatives).toHaveLength(1);
  });

  it("preserves all hypotheses during global provider failure and local evidence failure", () => {
    const candidate = strategyCandidate();
    candidate.causalPath.providerState = { status: "failed", failures: ["issuer evidence unavailable"] };
    const result = buildCapitalStrategyDecision(strategyInput({ candidates: [candidate], providerState: { status: "failed", failures: ["source service unavailable"] } }));
    expect(result.status).toBe("unavailable");
    expect(result.investmentAlternatives).toEqual([]);
    expect(result.rejectedHypotheses).toHaveLength(1);
    expect(result.coverageGaps).toEqual(expect.arrayContaining(["issuer evidence unavailable", "source service unavailable"]));
    expect(result.rejectedHypotheses[0].reasons).toContain("provider_failure");
  });
});

describe("Capital Strategist envelope boundary acceptance", () => {
  it.each([0.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY, -1])("rejects non-integral, unsafe, or invalid cents %s without rounding up capital", (value) => {
    const result = deriveCapitalEnvelope({ source: realizedGainSource({ netSaleProceedsCents: value }) });
    expect(result).toMatchObject({ status: "blocked", deployableCents: 0 });
    expect(result.blockers).toContain("invalid_capital_amount");
  });

  it.each([[], [" "], ["fill-1", "fill-1"]].map((closingFillIds) => ({ closingFillIds })))("requires usable unique closing-fill lineage $closingFillIds", ({ closingFillIds }) => {
    expect(deriveCapitalEnvelope({ source: realizedGainSource({ closingFillIds }) }).status).toBe("blocked");
  });

  it.each(["pending", "failed"] as const)("keeps %s reconciliation gains unavailable", (reconciliationState) => {
    expect(deriveCapitalEnvelope({ source: realizedGainSource({ reconciliationState }) })).toMatchObject({ status: "hypothetical_only", deployableCents: 0 });
  });

  it("blocks duplicate capital-event and allocation records without double-counting claims", () => {
    const claim = { allocationId: "claim-1", capitalEventId: "capital-event-close-1", amountCents: 50_000, state: "committed" as const };
    const result = deriveCapitalEnvelope({ source: realizedGainSource(), allocationClaims: [claim, claim], observedCapitalEventIds: [claim.capitalEventId, claim.capitalEventId] });
    expect(result).toMatchObject({ status: "blocked", alreadyAllocatedCents: 50_000, deployableCents: 0 });
    expect(result.blockers).toEqual(expect.arrayContaining(["duplicate_capital_event", "duplicate_allocation_claim"]));
  });

  it("ignores released and unrelated claims but cannot reserve the remainder itself", () => {
    const result = deriveCapitalEnvelope({ source: realizedGainSource(), allocationClaims: [
      { allocationId: "released", capitalEventId: "capital-event-close-1", amountCents: 120_000, state: "released" },
      { allocationId: "unrelated", capitalEventId: "other-event", amountCents: 120_000, state: "pending" },
    ] });
    expect(result).toMatchObject({ status: "verified", deployableCents: 120_000, alreadyAllocatedCents: 0 });
  });

  it("requires a named account and traceable source, without treating an unverified account as allocated capital", () => {
    const result = deriveCapitalEnvelope({ source: realizedGainSource({ account: { id: "", name: "", mode: "unknown" }, capitalEventId: "" }) });
    expect(result).toMatchObject({ status: "blocked", deployableCents: 0 });
    expect(result.blockers).toEqual(expect.arrayContaining(["account_unverified", "invalid_capital_lineage"]));
  });

  const namedAccount = realizedGainSource().account;
  const sourceCases: Array<{ source: CapitalSource; status: string; deployable: number }> = [
    { source: { id: "declared", kind: "operator_declared_excess", account: namedAccount, amountCents: 100_000, declarationId: "declaration-1" }, status: "operator_declared", deployable: 100_000 },
    { source: { id: "reconciled", kind: "reconciled_available_funds", account: namedAccount, amountCents: 100_000, reconciliationId: "reconciliation-1", reconciledAt: decisionTime }, status: "verified", deployable: 100_000 },
    { source: { id: "principal", kind: "returned_principal", account: namedAccount, amountCents: 100_000, capitalEventId: "return-1" }, status: "verified", deployable: 100_000 },
    { source: { id: "hypothetical", kind: "hypothetical_future_proceeds", account: namedAccount, amountCents: 100_000, sourcePlayId: "play-1", assumption: "Illustrative future sale, not a reconciled fill." }, status: "hypothetical_only", deployable: 0 },
  ];
  it.each(sourceCases)("keeps $source.kind availability and provenance distinct", ({ source, status, deployable }) => {
    expect(deriveCapitalEnvelope({ source })).toMatchObject({ status, deployableCents: deployable, realizedProfitLossCents: null, mayIncreaseRiskBudget: false });
  });

  it.each(sourceCases)("rejects invalid cents in $source.kind", ({ source }) => {
    expect(deriveCapitalEnvelope({ source: { ...source, amountCents: 0.5 } as CapitalSource })).toMatchObject({ status: "blocked", deployableCents: 0 });
  });

  it("honors claims against declared capital lineage, not only sale events", () => {
    const result = deriveCapitalEnvelope({ source: sourceCases[0].source, allocationClaims: [{ allocationId: "pending-1", capitalEventId: "declaration-1", amountCents: 50_000, state: "pending" }] });
    expect(result).toMatchObject({ status: "blocked", deployableCents: 0, alreadyAllocatedCents: 50_000 });
  });

  it("does not use a reconciliation completed after the historical decision cutoff", () => {
    const source: CapitalSource = { id: "later-reconciliation", kind: "reconciled_available_funds", account: namedAccount, amountCents: 100_000, reconciliationId: "later-1", reconciledAt: decisionTime + 1 };
    const result = buildCapitalStrategyDecision(strategyInput({ capital: { source } }));
    expect(result.investmentAlternatives).toEqual([]);
    expect(result.envelope.blockers).toContain("capital_after_cutoff");
    expect(result.rejectedHypotheses[0].reasons).toContain("capital_after_cutoff");
  });

  it.each([180_000, 180_001])("honors reserve boundary %s without redeploying principal", (profitReserveCents) => {
    const result = deriveCapitalEnvelope({ source: realizedGainSource({ profitReserveCents }) });
    expect(result.deployableCents).toBe(0);
    expect(result.status).toBe(profitReserveCents === 180_000 ? "verified" : "blocked");
    expect(result.returnedPrincipalCents).toBe(1_000_000);
  });

  it("keeps each portion of valid gains conserved with fees deducted exactly once", () => {
    for (const profit of [0, 1, 10_000, 180_000]) {
      for (const reserve of [0, profit]) {
        const result = deriveCapitalEnvelope({ source: realizedGainSource({ netSaleProceedsCents: 1_000_000 + profit, profitReserveCents: reserve }) });
        expect(result.returnedPrincipalCents + result.reserveCents + result.deployableCents).toBe(result.netSaleProceedsCents);
        expect(result.deployableCents).toBe(profit - reserve);
      }
    }
  });
});


describe("Capital Strategist capital lineage", () => {
  it("offers only realized gains remaining after returned principal and reserve", () => {
    expect(deriveCapitalEnvelope({ source: realizedGainSource() })).toMatchObject({
      status: "verified",
      netSaleProceedsCents: 1_180_000,
      returnedPrincipalCents: 1_000_000,
      realizedProfitLossCents: 180_000,
      reserveCents: 60_000,
      deployableCents: 120_000,
      mayIncreaseRiskBudget: false,
    });
  });

  it("keeps unrealized gains hypothetical and unavailable for allocation", () => {
    const result = deriveCapitalEnvelope({ source: realizedGainSource({ realizationState: "unrealized" }) });
    expect(result.status).toBe("hypothetical_only");
    expect(result.deployableCents).toBe(0);
    expect(result.hypotheticalDeployableCents).toBe(120_000);
  });

  it("blocks a second allocation claim on the same capital event", () => {
    const result = deriveCapitalEnvelope({
      source: realizedGainSource(),
      allocationClaims: [{ allocationId: "allocation-pending-1", capitalEventId: "capital-event-close-1", amountCents: 120_000, state: "pending" }],
    });
    expect(result).toMatchObject({ status: "blocked", deployableCents: 0, alreadyAllocatedCents: 120_000 });
    expect(result.blockers).toContain("concurrent_allocation");
  });
});

describe("Capital Strategist causal evidence", () => {
  it("rejects usage-driven uplift when supplier economics are fixed-fee", () => {
    const path = causalPath();
    path.hops[0]!.mechanism = { kind: "fixed_fee", commercialTermsStatus: "verified" };
    const result = assessCausalEconomicPath(path);
    expect(result.status).toBe("rejected");
    expect(result.reasons).toContain("fixed_fee_has_no_usage_uplift");
  });

  it("does not infer handle, customers, revenue, or profitability from odds without volume", () => {
    const result = assessCausalEconomicPath(causalPath({
      marketMeasurement: {
        kind: "odds",
        volumeObserved: false,
        claimedMetrics: ["odds", "revenue"],
        methodology: "Displayed odds snapshot",
        coverage: "One event",
        asOf: Date.UTC(2026, 8, 8, 14),
      },
    }));
    expect(result.status).toBe("rejected");
    expect(result.reasons).toEqual(expect.arrayContaining(["odds_feed_has_no_volume", "unsupported_activity_inference"]));
  });

  it("does not convert provider failure into confidence", () => {
    const result = assessCausalEconomicPath(causalPath({ providerState: { status: "failed", failures: ["feed unavailable"] } }));
    expect(result.status).toBe("unavailable");
    expect(result.confidence).toBeNull();
  });
});

describe("Capital Strategist comparison", () => {
  it("compares at most two underwritten investments and always keeps retain capital available", () => {
    const candidates = [
      { id: "new-1", use: "new_play" as const, score: 88 },
      { id: "increment-1", use: "incremental_existing_thesis" as const, score: 82 },
      { id: "new-2", use: "new_play" as const, score: 70 },
    ].map(({ id, use, score }) => ({
      id,
      use,
      title: id,
      symbol: id.startsWith("increment") ? "PW" : "DATA",
      horizon: "swing" as const,
      causalPath: causalPath({ id: `path-${id}` }),
      underwriter: { resultId: `underwriting-${id}`, playId: `play-${id}`, state: "qualified" as const, overallScore: score, plannedRiskCents: 6_000 },
      whyThisUse: "Strongest qualified fit in the reviewed set.",
      whyNow: "A sourced development changed the baseline.",
      whyNotAlternatives: "Other candidates have weaker evidence or fit.",
      changeCondition: "Reassess if the economic mechanism is invalidated.",
    }));
    const result = buildCapitalStrategyDecision({
      intent: "redeploy_realized_gains",
      capital: { source: realizedGainSource() },
      candidates,
      searchScope: "related_opportunities",
      reviewedUniverse: ["DATA", "PW", "ALT"],
      coverageGaps: [],
      providerState: { status: "available", failures: [] },
      now: Date.UTC(2026, 8, 8, 14),
      reviewAt: Date.UTC(2026, 8, 15, 14),
    });
    expect(result.primaryConclusion).toMatchObject({ kind: "new_play", candidateId: "new-1" });
    expect(result.investmentAlternatives.map((item) => item.candidateId)).toEqual(["new-1", "increment-1"]);
    expect(result.retainCapital).toMatchObject({ alwaysAvailable: true, amountCents: 120_000 });
    expect(result.sideEffects).toEqual({ capitalReserved: false, proposalCreated: false, orderCreated: false, brokerInvoked: false });
  });
});
