/**
 * FRED — the macro agent's source. Rates, inflation, employment, industrial
 * production: the conditions a thesis is implicitly betting on.
 *
 * Macro facts are not per-symbol, so they are stored against the pseudo-symbol
 * `__MACRO__`. Each observation carries the series' own observation date as
 * `asOf`, because "CPI was 3.1%" is only meaningful with the month attached.
 */
import type { Fact } from "../facts";
import { DAY, httpJson, num, unknownFact, type FetchCtx, type ProviderAdapter } from "./types";

export const MACRO_SYMBOL = "__MACRO__";

const SERIES: Array<{ id: string; key: string; unit: "pct" | "ratio" | "count"; label: string }> = [
  { id: "DFF", key: "fed_funds_rate", unit: "pct", label: "Federal funds effective rate" },
  { id: "DGS10", key: "treasury_10y", unit: "pct", label: "10-year Treasury constant maturity" },
  { id: "DGS2", key: "treasury_2y", unit: "pct", label: "2-year Treasury constant maturity" },
  { id: "CPIAUCSL", key: "cpi_index", unit: "count", label: "CPI, all urban consumers" },
  { id: "UNRATE", key: "unemployment_rate", unit: "pct", label: "Unemployment rate" },
  { id: "INDPRO", key: "industrial_production", unit: "count", label: "Industrial production index" },
  { id: "T10YIE", key: "breakeven_inflation_10y", unit: "pct", label: "10-year breakeven inflation" },
];

export const fredProvider: ProviderAdapter = {
  id: "fred",
  label: "FRED (Federal Reserve economic data)",
  kind: "macro",
  requiredEnv: ["FRED_API_KEY"],
  provides: SERIES.map((s) => s.key),
  homepage: "https://fred.stlouisfed.org/docs/api/fred/overview.html",

  async fetchMacroFacts(ctx: FetchCtx): Promise<Fact[]> {
    const key = process.env.FRED_API_KEY;
    const out: Fact[] = [];

    for (const s of SERIES) {
      const url =
        `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}` +
        `&api_key=${key}&file_type=json&sort_order=desc&limit=1`;
      const data = await httpJson<{ observations?: Array<{ date: string; value: string }> }>(url, {
        timeoutMs: ctx.timeoutMs,
      });
      const obs = data?.observations?.[0];
      // FRED writes "." for a missing observation. That is a gap, not a zero.
      const value = obs && obs.value !== "." ? num(obs.value) : null;
      if (value == null) {
        out.push(unknownFact(s.key, "fred", `FRED ${s.id}`));
        continue;
      }
      out.push({
        factKey: s.key,
        valueNum: value,
        unit: s.unit,
        basis: "verified",
        providerId: "fred",
        sourceName: `FRED ${s.id} — ${s.label}`,
        sourceUrl: `https://fred.stlouisfed.org/series/${s.id}`,
        asOf: Date.parse(`${obs!.date}T00:00:00Z`) || null,
        ttlMs: DAY,
      });
    }
    return out;
  },
};

export const __fredInternals = { SERIES };
