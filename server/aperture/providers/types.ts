/**
 * Data provider contract.
 *
 * Every provider turns an external source into `Fact` rows carrying basis and
 * provenance. Nothing else in Aperture is allowed to originate a number.
 *
 * A provider that cannot run — no key, network down, symbol not covered —
 * must be VISIBLE. It reports itself unavailable and the run records which
 * sources were live in `aperture_runs.provider_availability`, so the UI can say
 * "no earnings-transcript source configured" instead of showing a silent blank
 * where an analysis should be.
 *
 * A provider that runs but finds nothing emits an `unknown` fact for the key it
 * was asked about. "We looked and no source states this" and "we never looked"
 * are different claims and the product must be able to tell them apart.
 */
import type { Fact } from "../facts";

export interface FetchCtx {
  /** Wall clock, injected so runs are reproducible in tests. */
  now: number;
  /** Abort long fetches rather than hanging a run. */
  timeoutMs?: number;
}

export interface ProviderAdapter {
  id: string;
  label: string;
  /** security = per-symbol facts · macro = economy-wide series. */
  kind: "security" | "macro";
  /** Env vars that must be set. Empty = free and keyless. */
  requiredEnv: string[];
  /** Optional credential rule for providers that support current and legacy key names. */
  isAvailable?: () => boolean;
  /** Human-readable missing credential aliases when an optional rule is used. */
  missingEnv?: () => string[];
  /** Fact keys this provider can supply, for the availability matrix. */
  provides: string[];
  homepage?: string;
  fetchSecurityFacts?(symbol: string, ctx: FetchCtx): Promise<Fact[]>;
  fetchMacroFacts?(ctx: FetchCtx): Promise<Fact[]>;
}

export interface ProviderStatus {
  id: string;
  label: string;
  kind: "security" | "macro";
  available: boolean;
  /** Named, human-readable gap — rendered in the UI, not swallowed. */
  reason: string | null;
  provides: string[];
  missingEnv: string[];
}

export function isAvailable(p: ProviderAdapter): boolean {
  if (p.isAvailable) return p.isAvailable();
  return p.requiredEnv.every((k) => Boolean(process.env[k]));
}

export function statusOf(p: ProviderAdapter): ProviderStatus {
  const missingEnv = p.missingEnv ? p.missingEnv() : p.requiredEnv.filter((k) => !process.env[k]);
  const available = isAvailable(p);
  return {
    id: p.id,
    label: p.label,
    kind: p.kind,
    available,
    reason: available ? null : `not configured — missing ${missingEnv.join(", ")}`,
    provides: p.provides,
    missingEnv,
  };
}

/** An explicit "we looked and found nothing", as opposed to never looking. */
export function unknownFact(factKey: string, providerId: string, sourceName?: string): Fact {
  return { factKey, basis: "unknown", providerId, sourceName: sourceName ?? null, valueNum: null, valueText: null };
}

/** fetch with a timeout, returning null rather than throwing into a run. */
export async function httpJson<T = any>(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        // SEC requires a descriptive UA; harmless elsewhere.
        "User-Agent": "SignalHunterOS/1.0 (research; contact via repository owner)",
        Accept: "application/json",
        ...(opts.headers ?? {}),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Coerce a provider value to a finite number, or null. Never NaN, never 0-for-missing. */
export function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export const DAY = 24 * 60 * 60 * 1000;
