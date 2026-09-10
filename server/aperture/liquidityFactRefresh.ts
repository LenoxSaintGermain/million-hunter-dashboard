import { collectMarketFacts } from "./providers";
import { getFacts, freshestPerKey, normSymbol } from "./facts";
import { type SecurityFact } from "../../drizzle/schema";

/**
 * Reference market facts carry a one-day TTL. `getFacts` filters expired rows
 * out and nothing outside a full re-underwrite rewrites them, so a run older
 * than a day loses its `adv_usd_30d` fact and the liquidity gate refuses every
 * ticket with "no 30-day ADV fact" — even when a good value was recorded the
 * day before. This refreshes the exact exposure symbol on demand so the gate
 * decides against current data instead of an expiry artifact.
 *
 * It never invents a value: a failed or unknown provider result still yields
 * null, and the gate still refuses. It writes only facts.
 */

export type LiquidityFactDeps = {
  collect?: typeof collectMarketFacts;
  read?: typeof getFacts;
};

const usableAdv = (rows: SecurityFact[], symbol: string) =>
  freshestPerKey(rows.filter((row) => normSymbol(row.symbol) === symbol))
    .find((row) => row.factKey === "adv_usd_30d" && row.basis !== "unknown" && row.valueNum != null)
    ?? null;

/**
 * Returns a usable `adv_usd_30d` fact for `symbol`, refreshing from the market
 * providers only when no unexpired one is already stored. At most one provider
 * pass is made per call; the refreshed fact persists with its own TTL, so a
 * repeat within that window reads storage instead of calling out again.
 */
export async function refreshExpiredLiquidityFact(
  symbol: string,
  now = Date.now(),
  deps: LiquidityFactDeps = {},
): Promise<SecurityFact | null> {
  const collect = deps.collect ?? collectMarketFacts;
  const read = deps.read ?? getFacts;
  const exact = normSymbol(symbol);
  if (!exact) return null;

  try {
    await collect(exact, { now, timeoutMs: 10_000 }, { persist: true });
  } catch {
    // A provider failure is not a liquidity pass. Fall through to the read so a
    // fact written by another provider in the same pass is still honoured.
  }
  return usableAdv(await read(exact, now), exact);
}

/**
 * The preflight entry point: use the stored fact when it is still valid, and
 * only reach for a provider when it is missing or expired.
 */
export async function resolveLiquidityFact(
  symbol: string,
  storedRows: SecurityFact[],
  now = Date.now(),
  deps: LiquidityFactDeps = {},
): Promise<SecurityFact | null> {
  const exact = normSymbol(symbol);
  const stored = usableAdv(storedRows, exact);
  if (stored) return stored;
  return refreshExpiredLiquidityFact(exact, now, deps);
}
