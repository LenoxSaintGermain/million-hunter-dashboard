import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ accounts: [] as any[], writes: [] as any[], getAccount: vi.fn(), selects: 0 }));
vi.mock("../db", () => ({ getDb: async () => ({
  select: () => {
    const account = harness.accounts[harness.selects++];
    if (!account) throw new Error("END_OF_ACCOUNT_TEST_SEAM");
    return { from: () => ({ where: () => ({ limit: async () => [account] }) }) };
  },
  update: () => ({ set: (value: unknown) => ({ where: async () => { harness.writes.push(value); } }) }),
}) }));
vi.mock("./brokers/index", () => ({ brokerFor: () => ({ available: () => true, getAccount: harness.getAccount }) }));
import { preflightOrder } from "./orderFlow";

const now = Date.parse("2026-09-21T15:00:00Z");
const old = now - 86_400_000;
const account = (brokerId: string) => ({ id: 1, userId: 2, brokerId, externalAccountId: "paper-fixture", isPaper: true, lastSyncedAt: old, equityValueCents: 200_000, cashCents: 200_000 });
async function exercise() {
  // Stop immediately after the real account-refresh code, before positions,
  // quotes or order evaluation. No real DB, provider, or order mutation exists.
  await expect(preflightOrder({ runId: 1, accountId: 1, userId: 2, symbol: "TEST", side: "buy", qty: 1, orderType: "limit", limitPriceCents: 100, holdingPeriod: "swing", now } as any)).rejects.toThrow();
}
beforeEach(() => { harness.accounts = []; harness.writes = []; harness.selects = 0; harness.getAccount.mockReset(); });
describe("real preflight account freshness boundary", () => {
  it("never refreshes manual declarations merely because time passed", async () => {
    const saved = account("manual"); harness.accounts = [saved];
    await exercise();
    expect(harness.writes).toEqual([]);
    expect(saved.lastSyncedAt).toBe(old);
    expect(harness.getAccount).not.toHaveBeenCalled();
  });
  it("preserves stale data when the broker refresh fails", async () => {
    const saved = account("alpaca_paper"); harness.accounts = [saved];
    harness.getAccount.mockRejectedValue(new Error("provider unavailable"));
    await exercise();
    expect(harness.getAccount).toHaveBeenCalledOnce();
    expect(harness.writes).toEqual([]);
    expect(saved.lastSyncedAt).toBe(old);
  });
  it.each(["wrong identity", "live account", "stale snapshot"])("rejects %s without renewing freshness", async (kind) => {
    const saved = account("alpaca_paper"); harness.accounts = [saved];
    harness.getAccount.mockResolvedValue({ externalAccountId: kind === "wrong identity" ? "other" : "paper-fixture", isPaper: kind !== "live account", asOf: kind === "stale snapshot" ? old : now });
    await exercise();
    expect(harness.getAccount).toHaveBeenCalledOnce();
    expect(harness.writes).toEqual([]);
    expect(saved.lastSyncedAt).toBe(old);
  });
  it("persists a successful matching snapshot with its measured timestamp", async () => {
    const saved = account("alpaca_paper"); harness.accounts = [saved];
    harness.getAccount.mockResolvedValue({ externalAccountId: "paper-fixture", isPaper: true, asOf: now - 1000, equityValueCents: 210_000, cashCents: 190_000, buyingPowerCents: 190_000 });
    await exercise();
    expect(harness.writes).toEqual([{ lastSyncedAt: now - 1000, updatedAt: now, equityValueCents: 210_000, cashCents: 190_000, buyingPowerCents: 190_000 }]);
    expect(saved.lastSyncedAt).toBe(now - 1000);
  });
});
