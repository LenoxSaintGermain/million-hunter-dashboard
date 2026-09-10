import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import http from "node:http";
import https from "node:https";
import { users, capitalTheses, portfolioAccounts, apertureRuns, apertureCandidates, brokerOrders, monitoringChecks, apertureAttentionBaselines } from "../../drizzle/schema";
import { attentionBaselineToken, type ApertureAttentionBaseline } from "../../shared/apertureAttention";
import { monitoringFindingVersion } from "../../shared/monitoringFinding";
import { parsePersistedJson } from "../../shared/persistedJson";
import { requireIsolatedIntegrationDatabase } from "../../scripts/isolated-integration-identity.mjs";

// Empty means the explicit DATABASE_URL= unit guard, never permission to load .env.
// Unlike the older browser journeys, this test rejects the browser-UAT database.
// Main stages this file into the existing disposable integration harness; it
// neither provisions a DB nor invokes any seed, browser, provider, or broker.
const unitGuard = process.env.DATABASE_URL === "";
if (!unitGuard) requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);

type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;
type Owner = typeof users.$inferSelect;
type Check = typeof monitoringChecks.$inferSelect;
const NOW = Date.UTC(2026, 8, 9, 18);
const REQUEST_ONE = "00000000-0000-4000-8000-000000000001";
const REQUEST_TWO = "00000000-0000-4000-8000-000000000002";

it("rejects browser-UAT and production-like targets before database imports", () => {
  for (const target of [
    "mysql://root:fixture-only@127.0.0.1:3307/capital_aperture_uat_9c18799",
    "mysql://fixture:fixture-only@production.invalid:4000/app",
  ]) expect(() => requireIsolatedIntegrationDatabase(target, process.env.ISOLATED_INTEGRATION_DATABASE)).toThrow("exact disposable loopback database");
});

describe.skipIf(unitGuard)("real isolated DB — exact monitoring review receipts", () => {
  let db: Db;
  let router: typeof import("../apertureRouter").apertureRouter;
  let ownerIds: number[] = [];
  let runIds: number[] = [];
  let fixtures: Array<{ owner: Owner; runId: number; candidateId: number; orderIds: number[]; checks: Check[] }> = [];
  let expectedOrders: (typeof brokerOrders.$inferSelect)[] | null;
  let expectedChecks: Check[] | null;
  const networkAttempt = vi.fn(() => { throw new Error("Network/provider calls are forbidden in receipt persistence tests."); });
  const caller = (owner = fixtures[0].owner) => router.createCaller({ user: owner, req: {} as any, res: {} as any });
  const orders = () => db.select().from(brokerOrders).where(inArray(brokerOrders.userId, ownerIds)).orderBy(brokerOrders.id);
  const checks = () => db.select().from(monitoringChecks).where(inArray(monitoringChecks.runId, runIds)).orderBy(monitoringChecks.id);
  const baselineRows = (userId = fixtures[0].owner.id) => db.select().from(apertureAttentionBaselines).where(eq(apertureAttentionBaselines.userId, userId));
  const baseline = async () => {
    const [row] = await baselineRows();
    expect(row).toBeDefined();
    return parsePersistedJson(row.snapshot) as ApertureAttentionBaseline;
  };
  const target = (fixture = fixtures[0]) => ({ runId: fixture.runId, candidateId: fixture.candidateId, orderId: fixture.orderIds[0], findingId: fixture.checks[0].id, findingVersion: monitoringFindingVersion(fixture.checks[0]) });
  const review = () => ({ ...target(), requestId: REQUEST_ONE, decision: "needs_fresh_evidence" as const, note: "Illustrative review: verify fresh catalyst evidence before another decision." });
  const markSeen = (snapshot: ApertureAttentionBaseline) => caller().desk.markSeen({ snapshot, token: attentionBaselineToken(snapshot) });

  beforeAll(async () => {
    // Revalidate immediately before imports/connections, not only collection.
    requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    vi.stubGlobal("fetch", networkAttempt);
    vi.spyOn(http, "request").mockImplementation(networkAttempt);
    vi.spyOn(http, "get").mockImplementation(networkAttempt);
    vi.spyOn(https, "request").mockImplementation(networkAttempt);
    vi.spyOn(https, "get").mockImplementation(networkAttempt);
    const { getDb } = await import("../db");
    db = (await getDb())!;
    if (!db) throw new Error("Disposable database unavailable; do not substitute another target.");
    router = (await import("../apertureRouter")).apertureRouter;
  });

  beforeEach(async () => {
    ownerIds = []; runIds = []; fixtures = []; expectedOrders = null; expectedChecks = null;
    networkAttempt.mockClear();
    for (let index = 0; index < 2; index++) {
      // UUIDs isolate rows between shuffled/parallel runs, not business outcomes.
      const [created] = await db.insert(users).values({ openId: `uat_disposable_review_${randomUUID()}`, name: "Illustrative disposable review", role: "capital_operator" });
      const userId = Number(created.insertId); ownerIds.push(userId);
      const [owner] = await db.select().from(users).where(eq(users.id, userId));
      const [thesis] = await db.insert(capitalTheses).values({ userId, name: "Illustrative monitoring thesis", rawText: "Illustrative fixture only; not a market thesis or recommendation.", status: "active", createdAt: NOW, updatedAt: NOW });
      const [account] = await db.insert(portfolioAccounts).values({ userId, label: "Illustrative disposable paper account", brokerId: "manual", isPaper: true, syncSource: "illustrative_fixture", createdAt: NOW, updatedAt: NOW });
      const [run] = await db.insert(apertureRuns).values({ userId, thesisId: Number(thesis.insertId), accountId: Number(account.insertId), deployableCapitalCents: 100_000, status: "completed", instrumentPreference: "options", holdingPeriod: "swing", createdAt: NOW });
      const runId = Number(run.insertId); runIds.push(runId);
      const [candidate] = await db.insert(apertureCandidates).values({ runId, symbol: "DKNG", role: "core", createdAt: NOW });
      const candidateId = Number(candidate.insertId);
      const orderIds: number[] = [];
      for (const kind of ["long_put", "long_call"] as const) {
        const [order] = await db.insert(brokerOrders).values({ userId, runId, candidateId, accountId: Number(account.insertId), symbol: kind === "long_put" ? "DKNG261120P00020000" : "DKNG261120C00020000", underlyingSymbol: "DKNG", instrumentType: kind, optionExpirationDate: "2026-11-20", optionStrikePriceCents: 2000, contractMultiplier: 100, side: "buy", intent: "open", qty: 1, filledQty: 1, filledAvgPriceCents: 100, filledAt: NOW - 1000, status: "filled", reason: `Illustrative ${kind} sentinel, not a broker instruction`, plannedRiskCents: 10_000, createdAt: NOW - 1000, updatedAt: NOW - 1000 });
        orderIds.push(Number(order.insertId));
      }
      for (const checkType of ["catalyst", "macro"] as const) await db.insert(monitoringChecks).values({ runId, candidateId, symbol: "DKNG", checkType, flagged: checkType === "catalyst", finding: `Illustrative ${checkType} observation`, citations: ["https://example.org/illustrative-monitoring-fixture"], checkedAt: NOW - 2 * 86_400_000, createdAt: NOW - 2 * 86_400_000 });
      fixtures.push({ owner, runId, candidateId, orderIds, checks: await db.select().from(monitoringChecks).where(eq(monitoringChecks.runId, runId)).orderBy(monitoringChecks.id) });
    }
    expectedOrders = await orders(); expectedChecks = await checks();
  });

  afterEach(async () => {
    if (!db || !ownerIds.length) return;
    try {
      expect(networkAttempt).not.toHaveBeenCalled();
      // Full rows catch inserts, deletes, status/flag changes, and timestamp edits.
      // Both owners and both expressions are covered, not just global counts.
      if (expectedOrders) expect(await orders()).toEqual(expectedOrders);
      if (expectedChecks) expect(await checks()).toEqual(expectedChecks);
    } finally {
      await db.transaction(async tx => {
        await tx.delete(apertureAttentionBaselines).where(inArray(apertureAttentionBaselines.userId, ownerIds));
        if (runIds.length) await tx.delete(monitoringChecks).where(inArray(monitoringChecks.runId, runIds));
        await tx.delete(brokerOrders).where(inArray(brokerOrders.userId, ownerIds));
        if (runIds.length) await tx.delete(apertureCandidates).where(inArray(apertureCandidates.runId, runIds));
        await tx.delete(apertureRuns).where(inArray(apertureRuns.userId, ownerIds));
        await tx.delete(capitalTheses).where(inArray(capitalTheses.userId, ownerIds));
        await tx.delete(portfolioAccounts).where(inArray(portfolioAccounts.userId, ownerIds));
        await tx.delete(users).where(inArray(users.id, ownerIds));
      });
      expect(await db.select().from(users).where(inArray(users.id, ownerIds))).toEqual([]);
    }
  });
  afterAll(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("persists and reloads the exact receipt without turning it into Seen or resolution", async () => {
    expect(await caller().monitor.reviews.list(target())).toEqual({ receipts: [] });
    expect(await baselineRows()).toEqual([]);
    const saved = await caller().monitor.reviews.record(review());
    expect(saved.duplicate).toBe(false);
    expect(saved.receipt).toMatchObject({ ...review(), userId: fixtures[0].owner.id, reviewedAt: NOW, resolved: false });
    const persisted = await baseline();
    expect(persisted.monitoringReviews).toEqual([saved.receipt]);
    expect(persisted.items).toEqual([]); expect(persisted.capturedAt).toBe(0);
    const rowsBeforeRead = await baselineRows();
    // New caller performs the actual router SELECT, not a mocked/in-memory store.
    expect(await caller().monitor.reviews.list(target())).toEqual({ receipts: [saved.receipt] });
    expect(await baselineRows()).toEqual(rowsBeforeRead);
    expect(await caller().monitor.reviews.list({ ...target(), orderId: fixtures[0].orderIds[1] })).toEqual({ receipts: [] });
    expect(await baselineRows(fixtures[1].owner.id)).toEqual([]);
  });

  it("preserves same-owner reviews and per-item Seen versions under concurrent real transactions", async () => {
    await markSeen({ capturedAt: NOW - 10, items: [{ key: "finding:fixture", fingerprint: "latest-visible" }] });
    const input = review();
    await Promise.all([
      caller().monitor.reviews.record(input),
      markSeen({ capturedAt: NOW - 2, items: [{ key: "unrelated:fixture", fingerprint: "second-visible" }] }),
      markSeen({ capturedAt: NOW - 20, items: [{ key: "finding:fixture", fingerprint: "old-device" }] }),
    ]);
    const merged = await baseline();
    expect(merged.items.map(item => [item.key, item.fingerprint]).sort()).toEqual([["finding:fixture", "latest-visible"], ["unrelated:fixture", "second-visible"]]);
    expect(merged.monitoringReviews).toHaveLength(1);
    expect(merged.monitoringReviews![0]).toMatchObject({ requestId: REQUEST_ONE, resolved: false });
    await Promise.all([
      caller().monitor.reviews.record({ ...input, requestId: REQUEST_TWO, decision: "reviewed_unresolved", note: "Illustrative follow-up review; the concern is still open." }),
      markSeen({ capturedAt: NOW - 1, items: [{ key: "finding:fixture", fingerprint: "next-visible" }] }),
    ]);
    const next = await baseline();
    expect(next.monitoringReviews).toHaveLength(2);
    expect(next.monitoringReviews![0]).toEqual(merged.monitoringReviews![0]);
    expect(next.items.find(item => item.key === "finding:fixture")?.fingerprint).toBe("next-visible");
    expect(next.items.find(item => item.key === "unrelated:fixture")?.fingerprint).toBe("second-visible");
  });

  it("deduplicates simultaneous retries and retains an earlier receipt after a later review", async () => {
    const input = review();
    const results = await Promise.all([caller().monitor.reviews.record(input), caller().monitor.reviews.record(input), caller().monitor.reviews.record(input)]);
    expect(results.filter(result => !result.duplicate)).toHaveLength(1);
    expect(results.every(result => JSON.stringify(result.receipt) === JSON.stringify(results[0].receipt))).toBe(true);
    expect((await baseline()).monitoringReviews).toHaveLength(1);
    await caller().monitor.reviews.record({ ...input, requestId: REQUEST_TWO, decision: "reviewed_unresolved", note: "Illustrative second assessment with concern retained." });
    const beforeRetry = await baselineRows();
    expect(await caller().monitor.reviews.record(input)).toEqual({ receipt: results[0].receipt, duplicate: true });
    expect(await baselineRows()).toEqual(beforeRetry);
    expect((await baseline()).monitoringReviews).toHaveLength(2);
  });

  it("rejects cross-owner reads/writes and mixed-owner identities without creating an outsider baseline", async () => {
    const input = review(); await caller().monitor.reviews.record(input);
    const before = await baselineRows(); const outsider = caller(fixtures[1].owner);
    await expect(outsider.monitor.reviews.list(target())).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(outsider.monitor.reviews.record(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller().monitor.reviews.record({ ...input, orderId: fixtures[1].orderIds[0] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller().monitor.reviews.record({ ...input, findingId: fixtures[1].checks[0].id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller().monitor.reviews.record({ ...input, ...target(fixtures[1]) })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await baselineRows()).toEqual(before);
    expect(await baselineRows(fixtures[1].owner.id)).toEqual([]);
  });

  it("rejects version drift and conflicting retry intent with no check/order or receipt mutation", async () => {
    const input = review(); await caller().monitor.reviews.record(input);
    const before = await baselineRows();
    const wrongVersion = input.findingVersion === "v1-00000000" ? "v1-ffffffff" : "v1-00000000";
    await expect(caller().monitor.reviews.record({ ...input, findingVersion: wrongVersion, requestId: REQUEST_TWO })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(caller().monitor.reviews.record({ ...input, note: "Conflicting use of the same request identity." })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await baselineRows()).toEqual(before);
    expect((await baseline()).monitoringReviews!.every(receipt => receipt.resolved === false)).toBe(true);
  });
});
