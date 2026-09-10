/** Disposable browser fixture only. No production auth bypass or scheduler. */
import { requireIsolatedIntegrationDatabase } from "./isolated-integration-identity.mjs";
requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
if (process.env.NODE_ENV !== "development" || process.env.ISOLATED_UAT_MODE !== "true") throw new Error("Disposable browser mode required");

const { default: express } = await import("express");
const { createServer } = await import("node:http");
const { createExpressMiddleware } = await import("@trpc/server/adapters/express");
const { eq } = await import("drizzle-orm");
const { getDb } = await import("../server/db");
const { users, portfolioAccounts, capitalTheses, thesisCompilations, apertureDecisionRuns, apertureDecisionRevisions, aperturePendingOutcomes, apertureRuns, apertureCandidates, brokerOrders, monitoringChecks } = await import("../drizzle/schema");
const db = (await getDb())!;
const now = Date.now();
const [inserted] = await db.insert(users).values({ openId: "disposable_objective_browser", name: "Illustrative objective UAT",
  role: "capital_operator", onboardingCompleted: true, defaultWorkspace: "capital_aperture_trader" });
const [user] = await db.select().from(users).where(eq(users.id, Number(inserted.insertId)));
await db.insert(portfolioAccounts).values({ userId: user.id, label: "Illustrative disposable paper account", brokerId: "manual",
  isPaper: true, cashCents: 5_000_000, equityValueCents: 10_000_000, buyingPowerCents: 5_000_000,
  lastSyncedAt: now, syncSource: "illustrative_fixture", createdAt: now, updatedAt: now });
// Other scenarios start without a thesis or order. Monitoring seeds only owned,
// explicitly illustrative records in the exact disposable DB verified above.
if (process.env.ISOLATED_BROWSER_SCENARIO === "monitor") {
  const [account] = await db.select().from(portfolioAccounts).where(eq(portfolioAccounts.userId, user.id));
  const [thesis] = await db.insert(capitalTheses).values({ userId: user.id, name: "Illustrative monitoring thesis", rawText: "Illustrative UAT only, not a market recommendation.", status: "active", createdAt: now, updatedAt: now });
  const [run] = await db.insert(apertureRuns).values({ userId: user.id, thesisId: Number(thesis.insertId), accountId: account.id, deployableCapitalCents: 100_000, status: "completed", instrumentPreference: "options", holdingPeriod: "swing", createdAt: now });
  const runId = Number(run.insertId);
  const [candidate] = await db.insert(apertureCandidates).values({ runId, symbol: "DKNG", role: "core", createdAt: now });
  const candidateId = Number(candidate.insertId);
  await db.insert(brokerOrders).values({ userId: user.id, runId, candidateId, accountId: account.id, symbol: "DKNG261120P00020000", underlyingSymbol: "DKNG", instrumentType: "long_put", optionExpirationDate: "2026-11-20", optionStrikePriceCents: 2000, contractMultiplier: 100, side: "buy", intent: "open", qty: 1, filledQty: 1, filledAvgPriceCents: 100, filledAt: now - 1000, status: "filled", reason: "Illustrative held put, not a broker instruction", plannedRiskCents: 10_000, createdAt: now - 1000, updatedAt: now - 1000 });
  await db.insert(monitoringChecks).values({ runId, candidateId, symbol: "DKNG", checkType: "catalyst", flagged: true, finding: "Illustrative catalyst concern: the recorded launch condition is not confirmed.", citations: ["https://example.org/illustrative-monitoring-fixture"], checkedAt: now - 2 * 86_400_000, createdAt: now - 2 * 86_400_000 });
  const [canonical] = await db.insert(thesisCompilations).values({ userId: user.id, name: "Illustrative gate thesis", thesisText: "Illustrative only", status: "approved", templateUsed: "capital_trade" });
  const binding = { canonicalThesisId: Number(canonical.insertId), capitalThesisId: Number(thesis.insertId), accountId: account.id };
  await db.update(capitalTheses).set({ sourceCompilationId: binding.canonicalThesisId }).where(eq(capitalTheses.id, binding.capitalThesisId));
  const [decision] = await db.insert(apertureDecisionRuns).values({ userId: user.id, ...binding, createdAt: now, updatedAt: now });
  const decisionRunId = Number(decision.insertId);
  const [revision] = await db.insert(apertureDecisionRevisions).values({ decisionRunId, version: 1,
    missionText: "Illustrative portfolio-gap gate", missionHash: "illustrative-gate", missionSource: "edited", holdingPeriod: "swing", holdingPeriods: ["swing"],
    instrumentPreference: "shares", deployableCapitalCents: 100_000, maxPlannedLossCents: 5000,
    invalidationRule: "Illustrative evidence fails", operatorChoice: "conditional", effectiveBranch: "conditional",
    blocker: "Illustrative account context was unverified", reopenCondition: "Verify available headroom from a fresh account snapshot",
    namedGateKey: "illustrative-context", namedGateLabel: "Illustrative portfolio-gap gate", reviewAt: now - 1000,
    contextSnapshot: binding, gateSnapshot: { mandateVersion: "illustrative-v1", paperOnly: true, humanApprovalRequired: true }, createdByUserId: user.id, createdAt: now });
  const revisionId = Number(revision.insertId);
  await db.update(apertureDecisionRuns).set({ currentRevisionId: revisionId }).where(eq(apertureDecisionRuns.id, decisionRunId));
  await db.insert(aperturePendingOutcomes).values({ userId: user.id, decisionRunId, revisionId, kind: "gate_review", dueAt: now - 1000,
    reviewBasis: "Verify available headroom from a fresh account snapshot", status: "due", createdAt: now, updatedAt: now });
}
// Read-only invariant probe for this disposable fixture; no public runtime route.
const readProtectedFixture = async () => Promise.all([
  db.select().from(brokerOrders), db.select().from(monitoringChecks), db.select().from(aperturePendingOutcomes),
  db.select().from(apertureDecisionRuns), db.select().from(apertureDecisionRevisions),
]);
const protectedBefore = process.env.ISOLATED_BROWSER_SCENARIO === "monitor" ? JSON.stringify(await readProtectedFixture()) : null;
const { appRouter } = await import("../server/routers");
const { apertureRouter, executeUnderwriting } = await import("../server/apertureRouter");
const { discoverySelectionInput, selectDiscoveryForResearch } = await import("../server/aperture/discoverySelection");
const { producePositiveBrowserFixture } = await import("./objective-positive-browser-fixture");
const { strategyDiscoveryRouter } = await import("../server/aperture/strategyDiscoveryRouter");
const { router, capitalOperatorProcedure } = await import("../server/_core/trpc");
const { acceptObjectiveMission, acceptObjectiveMissionInput } = await import("../server/aperture/objectiveMission");
const { executeObjectiveDiscovery, validateObjectiveDiscoveryDraft, discoveryRunInput } = await import("../server/aperture/strategyDiscoveryWorkflow");
// Test-only transport seam: real acceptance, leases, parser and persistence;
// explicitly illustrative no-lead provider. Production router is unchanged.
const produceEmpty: import("../server/aperture/strategyDiscoveryWorkflow").DiscoveryProvider = async request => ({
  payload: { schemaVersion: 1, searchScope: request.searchScope, reviewedUniverse: [],
    coverageGaps: ["Illustrative empty-universe UAT fixture. Not a live market search."], hypotheses: [] },
  context: { requestId: request.requestId, provider: "illustrative-disposable-browser-fixture",
    asOf: now, receivedAt: now, searchScope: request.searchScope, universePolicy: request.universePolicy,
    permittedUniverse: [...request.permittedUniverse], citations: [], sources: [],
    providerState: { status: "available", failures: [] }, classifierState: { status: "available", failures: [] } },
});
const positive = process.env.ISOLATED_BROWSER_SCENARIO === "positive";
const produce = positive ? producePositiveBrowserFixture : produceEmpty;
const original = appRouter._def.record;
const aperture = apertureRouter._def.record;
const fixtureRouter = router({ ...original, aperture: router({ ...aperture,
  underwriter: router({ ...aperture.underwriter,
    selectDiscovery: capitalOperatorProcedure.input(discoverySelectionInput).mutation(async ({ ctx, input }) => {
      if (!positive) throw new Error("Positive scenario not enabled");
      const selected = await selectDiscoveryForResearch(db, ctx.user.id, input);
      const result = await executeUnderwriting({ userId: ctx.user.id, decisionRunId: selected.decisionRunId,
        decisionRevisionId: selected.decisionRevisionId, requestedPlayCount: 3, appendRevision: false, illustrativeUatFixture: true });
      return { ...selected, result, createdResearchRun: false, createdBrokerOrder: false };
    }),
  }), strategy: router({
  ...strategyDiscoveryRouter._def.record,
  start: capitalOperatorProcedure.input(acceptObjectiveMissionInput).mutation(async ({ ctx, input }) => {
    const accepted = await acceptObjectiveMission(db, ctx.user.id, input, Date.now(),
      (tx, values) => validateObjectiveDiscoveryDraft(tx, ctx.user.id, values));
    return executeObjectiveDiscovery(db, ctx.user.id,
      { decisionRunId: accepted.decisionRunId, decisionRevisionId: accepted.revisionId }, produce);
  }),
  run: capitalOperatorProcedure.input(discoveryRunInput).mutation(({ ctx, input }) =>
    executeObjectiveDiscovery(db, ctx.user.id, input, produce)),
}) }) });
const { setupVite } = await import("../server/_core/vite");
const app = express(); const server = createServer(app);
app.use(express.json({ limit: "2mb" }));
if (protectedBefore) app.get("/isolated-uat/integrity", async (_req, res) => {
  res.json({ unchanged: protectedBefore === JSON.stringify(await readProtectedFixture()) });
});
app.use("/api/trpc", createExpressMiddleware({ router: fixtureRouter, createContext: ({ req, res }) => ({ req, res, user }) }));
// Listen on loopback only; a busy port fails instead of changing the UAT URL.
await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(3114, "127.0.0.1", resolve); });
await setupVite(app, server);
console.log("ISOLATED_OBJECTIVE_BROWSER_READY");
