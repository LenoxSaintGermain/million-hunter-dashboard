import { beforeEach, describe, expect, it, vi } from "vitest";
const seam = vi.hoisted(() => ({ db: vi.fn(), authorize: vi.fn(), preflight: vi.fn(), create: vi.fn(), construct: vi.fn(), evidence: vi.fn() }));
vi.mock("../db", () => ({ getDb: seam.db }));
vi.mock("./decisionRunway", async original => ({ ...await original<typeof import("./decisionRunway")>(), authorizeDecisionAction: seam.authorize }));
vi.mock("./orderFlow", async original => ({ ...await original<typeof import("./orderFlow")>(), preflightOrder: seam.preflight, createOrder: seam.create }));
import { createQuickPlayRouter, sizeQuickPlay } from "./quickPlay";
import { DecisionRunwayBlockedError } from "./decisionRunway";
import { plannedRiskCentsFor } from "./gates";

const NOW = Date.parse("2026-09-21T15:00:00Z");
const selection = { runId: 33, candidateId: 66, accountId: 11, decisionRunId: 44, decisionRevisionId: 55, budgetCents: 10_000 };
const recipe = () => ({ readiness: "constructed" as const, entry: { priceCents: 215 }, stop: { priceCents: 195 }, slippage: { priceCents: 2 },
  qty: 100, targets: [{ priceCents: 260, rMultiple: 2, modeled: true, basis: "Illustrative fixture scenario" }], timeStopAt: NOW + 60_000,
  trigger: { state: "confirmed", lagMs: 30_000, lastPrice: 2.22 }, feed: "sip", unavailableReasons: [], noTradeConditions: ["Stop condition invalidates idea"], tapeBasis: "Illustrative fixture tape" });
const row = () => ({
  run: { id: 33, accountId: 11, userId: 7, holdingPeriod: "intraday", instrumentPreference: "shares", catalystDeadlineAt: NOW + 86400_000, invalidationRule: "Price falls below the recorded support level" },
  decision: { id: 44, accountId: 11, currentRevisionId: 55, lifecycle: "eligible" },
  revision: { id: 55, holdingPeriod: "intraday", instrumentPreference: "shares", deployableCapitalCents: 200_000, maxPlannedLossCents: 2000,
    missionText: "Investigate an illustrative sourced catalyst and its economic mechanism", invalidationRule: "Price falls below the recorded support level" },
  account: { id: 11, userId: 7, isPaper: true, label: "Illustrative practice account", brokerId: "alpaca_paper" },
  candidate: { id: 66, symbol: "UAT", playSide: "long", memoStatus: "ok", citations: ["https://example.com/fixture"], verifyFields: ["Confirm catalyst"], createdAt: NOW - 60_000 },
});
let current: ReturnType<typeof row> | null;
let orders: any[];
const caller = (id = 7) => createQuickPlayRouter({ construct: seam.construct, evidenceBlock: seam.evidence }).createCaller({ user: { id, role: "admin" } as any, req: {} as any, res: {} as any });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  current = row(); orders = [];
  seam.db.mockResolvedValue({ select: (shape: unknown) => {
    const result = shape ? (current ? [current] : []) : orders;
    const query: any = { then: (resolve: any) => Promise.resolve(result).then(resolve) };
    for (const key of ["from", "innerJoin", "where", "orderBy", "limit"]) query[key] = () => query;
    return query;
  } });
  seam.authorize.mockResolvedValue({ source: "authoritative", revisionId: 55 });
  seam.construct.mockResolvedValue({ play: recipe(), disclosure: "Illustrative fixture" });
  seam.evidence.mockResolvedValue(null);
  seam.preflight.mockResolvedValue({ evaluation: { passed: true, results: [] } });
  seam.create.mockResolvedValue({ orderId: 99, created: true });
});

describe("Quick Play sizing", () => {
  it("uses whole shares within both capital and risk ceilings, including slippage", () => {
    const result = sizeQuickPlay({ budgetCents: 10_000, missionCapitalCents: 8000, missionRiskCents: 500, recipeQty: 100,
      entryCents: 215, stopCents: 195, slippageCents: 2 });
    expect(result).toEqual({ qty: 22, notionalCents: 4730, plannedLossCents: 484 });
    expect(result?.plannedLossCents).toBe(plannedRiskCentsFor({ qty: 22, entryPriceCents: 215, stopPriceCents: 195, slippageCents: 2 }));
  });
  it("never increases the measured recipe size, even when a larger budget is requested", () => {
    expect(sizeQuickPlay({ budgetCents: 100_000_000, missionCapitalCents: 8000, missionRiskCents: 5000, recipeQty: 1, entryCents: 215, stopCents: 195, slippageCents: 2 })?.qty).toBe(1);
  });
  it.each([0, 100])("returns no size when %i cents cannot fund one share", budgetCents => {
    expect(sizeQuickPlay({ budgetCents, missionCapitalCents: 8000, missionRiskCents: 500, recipeQty: 100, entryCents: 215, stopCents: 195, slippageCents: 2 })).toBeNull();
  });
});

describe("Quick Play router lifecycle", () => {
  it("lists only saved matching research without constructing or ordering", async () => {
    const result = await caller().list({ budgetCents: 10_000 });
    expect(result.items[0].selection).toEqual(selection);
    expect(seam.construct).not.toHaveBeenCalled(); expect(seam.create).not.toHaveBeenCalled();
    expect(seam.authorize).toHaveBeenCalledWith(expect.objectContaining({ runId: 33, accountId: 11, decisionRunId: 44, decisionRevisionId: 55 }));
  });
  it("previews exact records and prepares a pending review, never approval or submission", async () => {
    const preview = await caller().preview(selection);
    expect(preview).toMatchObject({ ready: true, qty: 46, notionalCents: 9890, plannedLossCents: 1012 });
    expect(seam.create).not.toHaveBeenCalled();
    const result = await caller().prepare({ ...selection, fingerprint: preview.fingerprint, acknowledgement: "PAPER" });
    expect(result).toMatchObject({ orderId: 99, created: true });
    expect(result.url).toContain("candidate=66&order=99");
    expect(seam.create).toHaveBeenCalledWith(expect.objectContaining({ ...selection, symbol: "UAT", qty: 46, orderType: "limit", intent: "open", paperAcknowledgement: "PAPER" }));
  });
  it("rejects stale or other-owner identities rather than selecting another plan", async () => {
    current = null;
    await expect(caller().preview(selection)).rejects.toThrow("plan or account changed");
    expect(seam.construct).not.toHaveBeenCalled(); expect(seam.create).not.toHaveBeenCalled();
  });
  it("keeps changed account/plan authorization fail-closed", async () => {
    seam.authorize.mockRejectedValue(new DecisionRunwayBlockedError("binding mismatch"));
    await expect(caller().preview(selection)).rejects.toThrow("binding mismatch");
    expect(seam.construct).not.toHaveBeenCalled(); expect(seam.create).not.toHaveBeenCalled();
  });
  it.each(["isPaper", "memoStatus", "citations", "horizon", "direction", "expired", "checks"])("rejects unsupported or unverified %s", async field => {
    if (field === "isPaper") current!.account.isPaper = false;
    if (field === "memoStatus") current!.candidate.memoStatus = "rejected";
    if (field === "citations") current!.candidate.citations = ["SEC EDGAR"];
    if (field === "horizon") current!.run.holdingPeriod = "swing";
    if (field === "direction") current!.candidate.playSide = "short";
    if (field === "expired") current!.run.catalystDeadlineAt = NOW - 1;
    if (field === "checks") current!.candidate.verifyFields = [];
    await expect(caller().preview(selection)).rejects.toThrow();
    expect(seam.construct).not.toHaveBeenCalled(); expect(seam.create).not.toHaveBeenCalled();
  });
  it("does not silently confirm unresolved evidence", async () => {
    seam.evidence.mockResolvedValue("Confirm the catalyst first");
    await expect(caller().preview(selection)).rejects.toThrow("Confirm the catalyst first");
    expect(seam.create).not.toHaveBeenCalled();
  });
  it.each(["stale", "unknown", "delayed", "expired", "entry_not_met"])("blocks %s tape before pricing an order", async state => {
    const play = recipe();
    if (state === "stale") play.trigger.lagMs = 180_000;
    if (state === "unknown") play.trigger.state = "unknown";
    if (state === "delayed") play.feed = "iex";
    if (state === "expired") play.timeStopAt = NOW - 1;
    if (state === "entry_not_met") play.trigger.lastPrice = 2.00;
    seam.construct.mockResolvedValue({ play });
    await expect(caller().preview(selection)).rejects.toThrow("not ready");
    expect(seam.preflight).not.toHaveBeenCalled(); expect(seam.create).not.toHaveBeenCalled();
  });
  it("keeps market-closed research readable without fabricating current prices", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-21T12:00:00Z"));
    expect((await caller().list({ budgetCents: 10_000 })).items).toHaveLength(1);
    await expect(caller().preview(selection)).rejects.toThrow("regular-session prices");
    expect(seam.construct).not.toHaveBeenCalled();
  });
  it("shows the authoritative risk block and refuses preparation", async () => {
    seam.preflight.mockResolvedValue({ evaluation: { passed: false, results: [{ passed: false, detail: "No remaining account risk allowance" }] } });
    const preview = await caller().preview(selection);
    expect(preview.ready).toBe(false);
    await expect(caller().prepare({ ...selection, fingerprint: preview.fingerprint, acknowledgement: "PAPER" })).rejects.toThrow("No remaining account risk allowance");
    expect(seam.create).not.toHaveBeenCalled();
  });
  it("requires review again if measured terms change", async () => {
    const preview = await caller().preview(selection);
    seam.construct.mockResolvedValue({ play: { ...recipe(), entry: { priceCents: 220 } } });
    await expect(caller().prepare({ ...selection, fingerprint: preview.fingerprint, acknowledgement: "PAPER" })).rejects.toThrow("terms changed");
    expect(seam.create).not.toHaveBeenCalled();
  });
  it("reconciles repeated requests to the existing candidate order", async () => {
    orders = [{ id: 99, intent: "open", status: "pending_approval" }];
    const result = await caller().prepare({ ...selection, fingerprint: "a".repeat(64), acknowledgement: "PAPER" });
    expect(result).toMatchObject({ orderId: 99, created: false });
    expect(seam.create).not.toHaveBeenCalled(); expect(seam.construct).not.toHaveBeenCalled();
  });
  it("propagates database failures instead of returning an empty all-clear", async () => {
    seam.db.mockRejectedValue(new Error("DB unavailable"));
    await expect(caller().list({ budgetCents: 10_000 })).rejects.toThrow("DB unavailable");
  });
  it("rejects invented client prices and missing practice acknowledgement", async () => {
    await expect(caller().preview({ ...selection, symbol: "PLUG", limitPriceCents: 100 } as any)).rejects.toThrow();
    await expect(caller().prepare({ ...selection, fingerprint: "a".repeat(64) } as any)).rejects.toThrow();
    expect(seam.create).not.toHaveBeenCalled();
  });
});
