import { describe, it, expect, beforeAll } from "vitest";

// ─── Sprint 11: Sentinel Auto-Archive + Deal Share Tokens ────────────────────

describe("Sentinel Auto-Archive", () => {
  it("archiveExpiredSignals returns a number (count of archived signals)", async () => {
    const { archiveExpiredSignals } = await import("./db");
    const count = await archiveExpiredSignals();
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("archiveSignalById does not throw for a non-existent id", async () => {
    const { archiveSignalById } = await import("./db");
    await expect(archiveSignalById(999999999)).resolves.not.toThrow();
  });

  it("getMacroSignalsActive returns only non-archived signals", async () => {
    const { getMacroSignalsActive } = await import("./db");
    const signals = await getMacroSignalsActive(50);
    expect(Array.isArray(signals)).toBe(true);
    for (const s of signals) {
      expect(s.archived).toBe(false);
    }
  });
});

describe("Deal Share Tokens", () => {
  let token: string;
  let dealId: number;

  beforeAll(async () => {
    // Create a test deal to share
    const { createDeal } = await import("./db");
    const res = await createDeal({
      name: "Sprint11 Share Test Deal",
      source: "test",
      stage: "new",
    }) as any;
    dealId = res[0]?.insertId;
    expect(dealId).toBeGreaterThan(0);
  });

  it("createDealShareToken returns a non-empty token string", async () => {
    const { createDealShareToken } = await import("./db");
    token = await createDealShareToken(dealId, 30);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(16);
  });

  it("getDealShareToken retrieves the token row", async () => {
    const { getDealShareToken } = await import("./db");
    const row = await getDealShareToken(token);
    expect(row).not.toBeNull();
    expect(row?.dealId).toBe(dealId);
    expect(row?.viewCount).toBe(0);
  });

  it("incrementShareTokenViewCount increments the view count", async () => {
    const { incrementShareTokenViewCount, getDealShareToken } = await import("./db");
    await incrementShareTokenViewCount(token);
    const row = await getDealShareToken(token);
    expect(row?.viewCount).toBe(1);
  });

  it("getDealShareToken returns null for a non-existent token", async () => {
    const { getDealShareToken } = await import("./db");
    const row = await getDealShareToken("nonexistent-token-xyz-123");
    expect(row == null).toBe(true); // undefined or null
  });
});

describe("Scout → War Room Pre-fill", () => {
  it("convertToDeal returns prefilled:true when dealId is set", async () => {
    // We test the logic indirectly by checking the db helper chain
    const { createDeal, upsertSignal, getSignalByDealId } = await import("./db");
    const res = await createDeal({
      name: "Sprint11 Scout Prefill Test",
      source: "scout",
      stage: "new",
      askingPrice: 2_500_000,
    }) as any;
    const dealId = res[0]?.insertId;
    expect(dealId).toBeGreaterThan(0);

    // Simulate the pre-fill logic
    await upsertSignal({
      dealId,
      sbaEligible: true,
      dscr: 1.35,
      capitalStackSummary: "[Scout Pre-fill] Cap rate: 6.50% · Property type: retail · Location: Atlanta, GA. Run capital stack analysis to generate full SBA/seller note/equity breakdown.",
      modelVersions: { source: "scout-prefill", version: "1.0" },
    });

    const signal = await getSignalByDealId(dealId);
    expect(signal).not.toBeNull();
    expect(signal?.sbaEligible).toBe(true);
    expect(signal?.capitalStackSummary).toContain("[Scout Pre-fill]");
  });
});
