/** Explicit composite browser evidence. Never a production provider. */
import { requireIsolatedIntegrationDatabase } from "./isolated-integration-identity.mjs";
import type { DiscoveryProvider } from "../server/aperture/strategyDiscoveryWorkflow";

export const producePositiveBrowserFixture: DiscoveryProvider = async request => {
  requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
  if (process.env.ISOLATED_BROWSER_HARNESS !== "true" || process.env.NODE_ENV !== "development") throw new Error("Disposable browser fixture required");
  const now = Date.now();
  return {
    context: {
      requestId: request.requestId, provider: "illustrative-positive-browser-fixture", asOf: now, receivedAt: now,
      searchScope: request.searchScope, universePolicy: request.universePolicy, permittedUniverse: [...request.permittedUniverse],
      citations: ["https://example.test/release", "https://example.test/contract"],
      sources: ["release", "contract"].map(id => ({ id, originId: id, originUrl: `https://example.test/${id}`,
        sourceName: `Illustrative ${id}`, sourceUrl: `https://example.test/${id}`,
        observedAt: now - 300, publishedAt: now - 400, retrievedAt: now - 100,
        quality: { kind: "primary" as const, basis: "Composite UAT source, not retrieved evidence" } })),
      providerState: { status: "available", failures: [] }, classifierState: { status: "available", failures: [] },
    },
    payload: {
      schemaVersion: 1, searchScope: request.searchScope, reviewedUniverse: ["UATQ"],
      coverageGaps: ["Illustrative composite fixture; not a market search or recommendation."],
      hypotheses: [{
        id: "illustrative-positive-lead", title: "Illustrative usage-linked research lead", use: "new_play", horizon: "swing",
        disposition: "research_lead", rejectionReasons: [], whyThisUse: "Investigate variable consideration.",
        whyNow: "Composite comparison with a recorded baseline; no current event asserted.",
        whyNotAlternatives: "Fixed fees may not participate in usage growth.", changeCondition: "Verify actual terms and adoption.",
        causalPath: {
          id: "illustrative-path", originatingSignal: { id: "origin", statement: "Composite issuer claim of wider distribution.",
            assertionClass: "issuer_claim", sourceIds: ["release"], requiredConditions: [], contradictions: [], unknowns: [], invalidation: "Distribution withdrawn." },
          hops: [{ id: "hop", from: "Distribution", to: "Variable consideration",
            assertion: { id: "economic-link", statement: "Composite contract varies with usage; adoption remains unproven.",
              assertionClass: "analyst_inference", sourceIds: ["contract"], requiredConditions: ["Incremental usage occurs."],
              contradictions: ["Usage may displace existing business."], unknowns: [], invalidation: "Consideration is fixed." },
            mechanism: { kind: "variable_usage", commercialTermsStatus: "verified" },
            estimatedImpact: { basis: "usage_driven", amountCents: null, description: "No revenue estimate." },
            expectedTiming: "Next reporting period", nextFactToVerify: "Actual incremental adoption", failureCondition: "No adoption." }],
          affectedEntities: ["Composite supplier"], securityMapping: { entity: "Composite supplier", symbol: "UATQ", status: "unverified" },
          whatChangedFromExpectations: "Composite participation change, subject to adoption verification.",
          counterargument: "Pricing pressure may offset participation.", expectationsBaseline: null,
          technologyPermission: null, marketMeasurement: null, reviewAt: now + 3_600_000, expiresAt: now + 7_200_000,
        },
      }],
    },
  };
};
