import { describe, expect, it } from "vitest";
import {
  assessCausalEconomicPath,
  deriveCapitalEnvelope,
  type CausalEconomicPath,
  type RealizedGainsCapitalSource,
} from "../../shared/capitalStrategy";
import { buildCapitalStrategyDecision } from "./capitalStrategist";

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
