import type { CockpitHeadroomLine } from "./cockpitRailSummary";

/**
 * The one single-order limit every screen shows: the server's own
 * `single_order` headroom line (min(pct of equity, absolute cap)). The client
 * never recomputes it. The absolute cap is shown only as the rule behind it.
 */
export type SingleOrderLimit = {
  ceilingCents: number | null;
  /** e.g. "$4,978.85", or "Not measured". */
  value: string;
  /** Plain-words rule: which of the two parts is the limit right now. */
  explanation: string;
};

const usd = (cents: number) => {
  const whole = Math.round(cents) % 100 === 0;
  return `$${(Math.round(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`;
};

export function singleOrderLimit(
  lines: readonly CockpitHeadroomLine[] | null | undefined,
  capCents: number | null | undefined,
  equityCents: number | null | undefined,
): SingleOrderLimit {
  const line = (lines ?? []).find((l) => l.key === "single_order");
  const pct = line?.ceilingPct ?? null;
  const rule = pct != null && capCents != null
    ? `${pct}% of your account value, never more than ${usd(capCents)}`
    : capCents != null ? `never more than ${usd(capCents)}` : null;
  const ceiling = line?.ceilingCents;
  if (ceiling == null || !Number.isFinite(ceiling)) {
    return { ceilingCents: null, value: "Not measured", explanation: `Refresh balances to measure this limit.${rule ? ` The rule: ${rule}.` : ""}` };
  }
  const capBinds = capCents != null && ceiling >= capCents;
  const which = capBinds
    ? `Right now the ${usd(capCents!)} cap is the lower of the two, so it is your limit.`
    : `Right now ${pct ?? "the percentage"}${pct != null ? "%" : ""} of ${equityCents != null ? usd(equityCents) : "your account value"} is the lower of the two, so it is your limit.`;
  return { ceilingCents: ceiling, value: usd(ceiling), explanation: `${rule ? `${rule.charAt(0).toUpperCase()}${rule.slice(1)}. ` : ""}${which}` };
}
