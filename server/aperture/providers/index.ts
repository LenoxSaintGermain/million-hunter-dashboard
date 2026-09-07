/**
 * Provider registry.
 *
 * The point of this file is the availability matrix. Signal Hunter has to be
 * able to say "the catalyst source is not configured" instead of showing an
 * analysis that quietly lacks catalysts — which is the difference between an
 * honest gap and a misleading answer.
 */
import { recordFacts, type Fact } from "../facts";
import { edgarProvider } from "./edgar";
import { fredProvider, MACRO_SYMBOL } from "./fred";
import { alpacaDataProvider, polygonProvider } from "./marketData";
import { benzingaProvider, fmpProvider } from "./paid";
import { statusOf, type FetchCtx, type ProviderAdapter, type ProviderStatus } from "./types";

export const PROVIDERS: ProviderAdapter[] = [
  edgarProvider,      // free, keyless
  fredProvider,       // free key
  alpacaDataProvider, // free tier
  polygonProvider,    // paid
  fmpProvider,        // paid
  benzingaProvider,   // paid
];

export function providerById(id: string): ProviderAdapter | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** Full matrix, including the unavailable ones — that is the whole point. */
export function describeAvailability(): ProviderStatus[] {
  return PROVIDERS.map(statusOf);
}

/** Compact form persisted on a run: { edgar: true, benzinga: false, … }. */
export function availabilityMap(): Record<string, boolean> {
  return Object.fromEntries(describeAvailability().map((s) => [s.id, s.available]));
}

/** Fact keys no configured provider can supply — named gaps for the UI. */
export function uncoveredCapabilities(): Array<{ factKey: string; wouldComeFrom: string[] }> {
  const live = new Set(describeAvailability().filter((s) => s.available).flatMap((s) => s.provides));
  const gaps = new Map<string, string[]>();
  for (const p of PROVIDERS) {
    for (const key of p.provides) {
      if (live.has(key)) continue;
      gaps.set(key, [...(gaps.get(key) ?? []), p.label]);
    }
  }
  return Array.from(gaps.entries()).map(([factKey, wouldComeFrom]) => ({ factKey, wouldComeFrom }));
}

export interface CollectResult {
  symbol: string;
  facts: Fact[];
  ranProviders: string[];
  skippedProviders: Array<{ id: string; reason: string }>;
  errors: Array<{ id: string; message: string }>;
}

/**
 * Run every available security provider for one symbol and persist the facts.
 * A provider that throws is recorded and skipped — one bad source must not take
 * down a research run, but it must not vanish either.
 */
export async function collectSecurityFacts(
  symbol: string,
  ctx: FetchCtx = { now: Date.now(), timeoutMs: 15_000 },
  opts: { persist?: boolean } = { persist: true },
): Promise<CollectResult> {
  const result: CollectResult = { symbol, facts: [], ranProviders: [], skippedProviders: [], errors: [] };

  for (const p of PROVIDERS) {
    if (p.kind !== "security" || !p.fetchSecurityFacts) continue;
    const status = statusOf(p);
    if (!status.available) {
      result.skippedProviders.push({ id: p.id, reason: status.reason ?? "unavailable" });
      continue;
    }
    try {
      const facts = await p.fetchSecurityFacts(symbol, ctx);
      result.facts.push(...facts);
      result.ranProviders.push(p.id);
    } catch (e: any) {
      result.errors.push({ id: p.id, message: String(e?.message ?? e) });
    }
  }

  if (opts.persist && result.facts.length) {
    await recordFacts(symbol, result.facts, ctx.now);
  }
  return result;
}

/**
 * Fast market-only collection for an underwriting preview. Full company and
 * catalyst research remains downstream in the existing research lifecycle.
 */
export async function collectMarketFacts(
  symbol: string,
  ctx: FetchCtx = { now: Date.now(), timeoutMs: 10_000 },
  opts: { persist?: boolean } = { persist: true },
): Promise<CollectResult> {
  const result: CollectResult = { symbol, facts: [], ranProviders: [], skippedProviders: [], errors: [] };
  const marketProviders = PROVIDERS.filter((provider) => provider.kind === "security" && provider.fetchSecurityFacts && ["alpaca", "polygon"].includes(provider.id));
  await Promise.all(marketProviders.map(async (provider) => {
    const status = statusOf(provider);
    if (!status.available) {
      result.skippedProviders.push({ id: provider.id, reason: status.reason ?? "unavailable" });
      return;
    }
    try {
      result.facts.push(...await provider.fetchSecurityFacts!(symbol, ctx));
      result.ranProviders.push(provider.id);
    } catch (error: any) {
      result.errors.push({ id: provider.id, message: String(error?.message ?? error) });
    }
  }));
  if (opts.persist && result.facts.length) await recordFacts(symbol, result.facts, ctx.now);
  return result;
}

/** Macro series, stored against the __MACRO__ pseudo-symbol. */
export async function collectMacroFacts(
  ctx: FetchCtx = { now: Date.now(), timeoutMs: 15_000 },
  opts: { persist?: boolean } = { persist: true },
): Promise<CollectResult> {
  const result: CollectResult = { symbol: MACRO_SYMBOL, facts: [], ranProviders: [], skippedProviders: [], errors: [] };

  for (const p of PROVIDERS) {
    if (p.kind !== "macro" || !p.fetchMacroFacts) continue;
    const status = statusOf(p);
    if (!status.available) {
      result.skippedProviders.push({ id: p.id, reason: status.reason ?? "unavailable" });
      continue;
    }
    try {
      const facts = await p.fetchMacroFacts(ctx);
      result.facts.push(...facts);
      result.ranProviders.push(p.id);
    } catch (e: any) {
      result.errors.push({ id: p.id, message: String(e?.message ?? e) });
    }
  }

  if (opts.persist && result.facts.length) {
    await recordFacts(MACRO_SYMBOL, result.facts, ctx.now);
  }
  return result;
}

export { MACRO_SYMBOL };
export type { ProviderAdapter, ProviderStatus, FetchCtx };
