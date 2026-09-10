import { describe, expect, it, vi } from "vitest";
import { resolveLiquidityFact, refreshExpiredLiquidityFact } from "./liquidityFactRefresh";
import type { SecurityFact } from "../../drizzle/schema";

/**
 * Reproduces the deployed blocker found on 2026-09-10: every candidate in run
 * #690001 held a good modeled ADV (PWR $743M) recorded on Sept 9, all expired
 * by Sept 10, so the liquidity gate refused every paper ticket with
 * "no 30-day ADV fact" and no operator path existed to refresh it.
 */

const now = Date.UTC(2026, 8, 10, 15);
const fact = (over: Partial<SecurityFact> = {}): SecurityFact => ({
  symbol: "PWR", factKey: "adv_usd_30d", basis: "modeled", valueNum: 743_294_848,
  fetchedAt: now - 1000, expiresAt: now + 86_400_000, unit: "usd", valueText: null,
  providerId: "alpaca", sourceName: "Alpaca", sourceUrl: null, asOf: now - 1000,
  assumption: null, ...over,
}) as SecurityFact;

describe("liquidity fact stays decidable after its one-day TTL", () => {
  it("uses a stored unexpired fact without calling a provider", async () => {
    const collect = vi.fn();
    const read = vi.fn();
    const got = await resolveLiquidityFact("PWR", [fact()], now, { collect: collect as any, read: read as any });
    expect(got?.valueNum).toBe(743_294_848);
    expect(collect).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it("refreshes exactly once when the stored fact has expired out of the read", async () => {
    // getFacts filters expired rows, so the preflight sees an empty list.
    const collect = vi.fn(async () => ({ symbol: "PWR", facts: [], ranProviders: ["alpaca"], skippedProviders: [], errors: [] }));
    const read = vi.fn(async () => [fact({ fetchedAt: now })]);
    const got = await resolveLiquidityFact("PWR", [], now, { collect: collect as any, read: read as any });
    expect(collect).toHaveBeenCalledTimes(1);
    expect(collect.mock.calls[0][0]).toBe("PWR");
    expect(collect.mock.calls[0][2]).toEqual({ persist: true });
    expect(got?.valueNum).toBe(743_294_848);
  });

  it("returns null when the provider yields nothing, so the gate still refuses", async () => {
    const collect = vi.fn(async () => ({ symbol: "PWR", facts: [], ranProviders: [], skippedProviders: [], errors: [] }));
    const read = vi.fn(async () => []);
    expect(await resolveLiquidityFact("PWR", [], now, { collect: collect as any, read: read as any })).toBeNull();
  });

  it("never promotes an unknown-basis fact into a liquidity pass", async () => {
    const collect = vi.fn(async () => ({ symbol: "PWR", facts: [], ranProviders: ["alpaca"], skippedProviders: [], errors: [] }));
    const read = vi.fn(async () => [fact({ basis: "unknown", valueNum: null })]);
    expect(await resolveLiquidityFact("PWR", [], now, { collect: collect as any, read: read as any })).toBeNull();
  });

  it("survives a throwing provider and still reads what was written", async () => {
    const collect = vi.fn(async () => { throw new Error("PROVIDER_SENTINEL upstream 503"); });
    const read = vi.fn(async () => [fact({ fetchedAt: now })]);
    const got = await refreshExpiredLiquidityFact("PWR", now, { collect: collect as any, read: read as any });
    expect(got?.valueNum).toBe(743_294_848);
  });

  it("ignores a fact recorded against a different symbol", async () => {
    const collect = vi.fn(async () => ({ symbol: "PWR", facts: [], ranProviders: [], skippedProviders: [], errors: [] }));
    const read = vi.fn(async () => [fact({ symbol: "MYRG" })]);
    expect(await resolveLiquidityFact("pwr", [], now, { collect: collect as any, read: read as any })).toBeNull();
  });
});
