import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { users, portfolioAccounts, capitalTheses, thesisCompilations, apertureRuns, apertureCandidates,
  apertureDecisionRuns, apertureDecisionRevisions, brokerOrders } from "../../drizzle/schema";
import { createQuickPlayRouter } from "./quickPlay";
import { requireIsolatedIntegrationDatabase } from "../../scripts/isolated-integration-identity.mjs";

const isolated = process.env.ISOLATED_INTEGRATION_DATABASE
  ? Boolean(requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE)) : false;
if (process.env.DATABASE_URL && !isolated) throw new Error("Quick Play integration requires the owned disposable database.");
const NOW = Date.parse("2026-09-21T15:00:00Z");
describe.skipIf(!isolated)("Quick Play exact persisted binding", () => {
  let db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  let owner: typeof users.$inferSelect;
  let selection: { runId: number; candidateId: number; decisionRunId: number; decisionRevisionId: number; accountId: number; budgetCents: number };
  const construct = vi.fn(async () => ({ play: null, disclosure: "No fixture market data" }));
  const evidenceBlock = vi.fn(async () => null);
  const caller = (user = owner) => createQuickPlayRouter({ construct, evidenceBlock }).createCaller({ user, req: {} as any, res: {} as any });
  beforeAll(async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No network in persisted binding test"); }));
    db = (await getDb())!;
    const [user] = await db.insert(users).values({ openId: `quick_play_disposable_${randomUUID()}`, name: "Illustrative Quick Play test", role: "capital_operator" });
    [owner] = await db.select().from(users).where(eq(users.id, Number(user.insertId)));
    const [canonical] = await db.insert(thesisCompilations).values({ userId: owner.id, name: "Illustrative idea", thesisText: "Illustrative source-bound idea", status: "approved", templateUsed: "capital_trade" });
    const [thesis] = await db.insert(capitalTheses).values({ userId: owner.id, name: "Illustrative idea", rawText: "Illustrative source-bound idea", sourceCompilationId: Number(canonical.insertId), status: "active", createdAt: NOW, updatedAt: NOW });
    const [account] = await db.insert(portfolioAccounts).values({ userId: owner.id, label: "Illustrative practice", brokerId: "manual", isPaper: true, createdAt: NOW, updatedAt: NOW });
    const accountId = Number(account.insertId);
    const [research] = await db.insert(apertureRuns).values({ userId: owner.id, thesisId: Number(thesis.insertId), accountId, deployableCapitalCents: 200_000, status: "completed", holdingPeriod: "intraday", instrumentPreference: "shares", catalystDeadlineAt: NOW + 86400_000, createdAt: NOW });
    const runId = Number(research.insertId);
    const [candidate] = await db.insert(apertureCandidates).values({ runId, symbol: "UAT", role: "core", playSide: "long", memoStatus: "ok", citations: ["https://example.com/fixture"], verifyFields: ["Illustrative check"], createdAt: NOW });
    const [decision] = await db.insert(apertureDecisionRuns).values({ userId: owner.id, canonicalThesisId: Number(canonical.insertId), capitalThesisId: Number(thesis.insertId), accountId, researchRunId: runId, lifecycle: "eligible", createdAt: NOW, updatedAt: NOW });
    const decisionRunId = Number(decision.insertId);
    const [revision] = await db.insert(apertureDecisionRevisions).values({ decisionRunId, version: 1, missionText: "Illustrative source-bound idea", missionHash: "fixture", holdingPeriod: "intraday", instrumentPreference: "shares", deployableCapitalCents: 200_000, maxPlannedLossCents: 2000, effectiveBranch: "eligible", createdByUserId: owner.id, createdAt: NOW });
    const decisionRevisionId = Number(revision.insertId);
    await db.update(apertureDecisionRuns).set({ currentRevisionId: decisionRevisionId }).where(eq(apertureDecisionRuns.id, decisionRunId));
    selection = { runId, candidateId: Number(candidate.insertId), accountId, decisionRunId, decisionRevisionId, budgetCents: 10_000 };
  });
  afterAll(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); }); // The harness removes only its owned disposable database.
  it("keeps the exact identity through list and current-price review", async () => {
    const result = await caller().list({ budgetCents: 10_000 });
    expect(result.items[0]?.selection).toEqual(selection);
    await expect(caller().preview(selection)).rejects.toThrow("not ready for an order");
    expect(construct).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ id: owner.id }) }), selection);
  });
  it("does not expose or use another owner's research", async () => {
    expect((await caller({ ...owner, id: owner.id + 1_000_000 }).list({ budgetCents: 10_000 })).items).toEqual([]);
    await expect(caller({ ...owner, id: owner.id + 1_000_000 }).preview(selection)).rejects.toThrow("plan or account changed");
  });
  it.each(["runId", "candidateId", "accountId", "decisionRunId", "decisionRevisionId"] as const)("rejects wrong %s without falling back", async key => {
    await expect(caller().preview({ ...selection, [key]: selection[key] + 1_000_000 })).rejects.toThrow("plan or account changed");
  });
  it("does not create orders or rewrite plan bindings during list/preview", async () => {
    expect(await db.select().from(brokerOrders).where(eq(brokerOrders.userId, owner.id))).toEqual([]);
    const [decision] = await db.select().from(apertureDecisionRuns).where(eq(apertureDecisionRuns.id, selection.decisionRunId));
    expect(decision).toMatchObject({ accountId: selection.accountId, researchRunId: selection.runId, currentRevisionId: selection.decisionRevisionId });
    expect(fetch).not.toHaveBeenCalled();
  });
});
