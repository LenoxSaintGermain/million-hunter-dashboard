import { describe, expect, it, vi } from "vitest";
import { isDailyOutcomeRefreshEligible, refreshLiveSlateOutcomes } from "./dailyOutcomeRefresh";
const provider = vi.hoisted(() => ({ bars: vi.fn() }));
vi.mock("./providers/marketData", () => ({ fetchIntradayBars: provider.bars }));

const atEt = (value: string) => Date.parse(value);

describe("daily paper-outcome refresh eligibility", () => {
  const live = { snapshotBasis: "live_capture" as const, status: "awaiting_outcome" as const, sessionDateEt: "2026-08-20" };

  it("waits until the captured ET session is closed plus the evidence buffer", () => {
    expect(isDailyOutcomeRefreshEligible(live, atEt("2026-08-20T20:14:00Z"))).toBe(false); // 16:14 ET
    expect(isDailyOutcomeRefreshEligible(live, atEt("2026-08-20T20:15:00Z"))).toBe(true); // 16:15 ET
  });

  it("allows a later ET date but excludes complete or historical records", () => {
    expect(isDailyOutcomeRefreshEligible(live, atEt("2026-08-21T13:00:00Z"))).toBe(true);
    expect(isDailyOutcomeRefreshEligible({ ...live, status: "complete" }, atEt("2026-08-21T13:00:00Z"))).toBe(false);
    expect(isDailyOutcomeRefreshEligible({ ...live, snapshotBasis: "historical_reconstruction" }, atEt("2026-08-21T13:00:00Z"))).toBe(false);
  });
});

describe("persisted snapshot outcome calculation", () => {
  it("keeps a provider-unavailable result retryable instead of completing the slate", async () => {
    const capturedAt = Date.parse("2026-08-20T14:00:00Z");
    const writes: any[] = [];
    const rows = [{ id: 1, symbol: "IWM", recommendationSnapshot: { play: { side: "long", entry: { priceCents: 10000 }, stop: { priceCents: 9800 }, timeStopAt: capturedAt + 60000 } } }];
    const db = { select: () => ({ from: () => ({ where: async () => rows }) }),
      update: () => ({ set: (value: unknown) => { writes.push(value); return { where: async () => {} }; } }) };
    provider.bars.mockResolvedValue({ bars: [], unavailableReason: "Illustrative provider timeout" });
    const result = await refreshLiveSlateOutcomes(db as any, { id: 1, snapshotBasis: "live_capture", capturedAt } as any, capturedAt + 120000);
    expect(result.terminalCount).toBe(0);
    expect(writes[0]).toMatchObject({ outcomeStatus: "unavailable", outcomeBasis: "unknown", returnBps: null });
    expect(writes.at(-1)).toMatchObject({ status: "awaiting_outcome" });
  });
  it.each([false, true])("calculates the same source-session result with serialized=%s", async serialized => {
    const capturedAt = Date.parse("2026-08-20T14:00:00Z");
    const snapshot = { play: { side: "long", entry: { priceCents: 10000 }, stop: { priceCents: 9800 },
      timeStopAt: capturedAt + 60000, plannedLossCents: 2000, notionalCents: 100000, noTradeConditions: [] } };
    const rows = [{ id: 1, symbol: "IWM", recommendationSnapshot: serialized ? JSON.stringify(snapshot) : snapshot }];
    const writes: any[] = [];
    const db = { select: () => ({ from: () => ({ where: async () => rows }) }),
      update: () => ({ set: (value: unknown) => { writes.push(value); return { where: async () => {} }; } }) };
    provider.bars.mockResolvedValue({ bars: [
      { t: capturedAt, o: 100, h: 100.2, l: 99.9, c: 100.1, v: 1000, vw: 100.1 },
      { t: capturedAt + 60000, o: 100.1, h: 100.7, l: 100.1, c: 100.6, v: 1000, vw: 100.6 },
    ], unavailableReason: null });
    const result = await refreshLiveSlateOutcomes(db as any, { id: 1, snapshotBasis: "live_capture", capturedAt } as any, capturedAt + 120000);
    expect(result.terminalCount).toBe(1);
    expect(writes[0]).toMatchObject({ triggerObservation: "met", exitObservation: "time_stop", settlementPriceCents: 10060, outcomeBasis: "verified" });
    expect(writes[0].outcomeExplanation).toContain("not a broker fill");
  });
});
