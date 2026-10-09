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

export type SingleNameCheck = {
  /** Server per-name ceiling (pct of equity), or null when not measured. */
  ceilingCents: number | null;
  heldCents: number | null;
  /** Held + this order. */
  afterCents: number | null;
  over: boolean;
  /** Plain warning, or null when within the limit / not measured. */
  warning: string | null;
  explanation: string;
};

/**
 * The one-company limit, from the server's `position` headroom line (its
 * ceiling is the per-name cap × equity). Held value comes from the server's
 * saved positions. Nothing here is a hard-coded percentage.
 */
export function singleNameCheck(
  lines: readonly CockpitHeadroomLine[] | null | undefined,
  symbol: string,
  heldCents: number | null | undefined,
  orderCents: number,
): SingleNameCheck {
  const line = (lines ?? []).find((l) => l.key === "position");
  const ceiling = line?.ceilingCents;
  const name = symbol.trim().toUpperCase() || "this company";
  if (ceiling == null || !Number.isFinite(ceiling)) {
    return { ceilingCents: null, heldCents: heldCents ?? null, afterCents: null, over: false, warning: null, explanation: "Refresh balances to measure the one-company limit." };
  }
  const held = Math.abs(heldCents ?? 0);
  const after = held + Math.max(0, orderCents);
  const over = after > ceiling;
  const rule = `${line!.ceilingPct}% of your account value in any one company (${usd(ceiling)})`;
  return {
    ceilingCents: ceiling,
    heldCents: held,
    afterCents: after,
    over,
    warning: over
      ? `With this order you would hold ${usd(after)} of ${name}${held > 0 ? ` (you already hold ${usd(held)})` : ""}. That is over the limit of ${rule}. Make the order smaller.`
      : null,
    explanation: `One-company limit: ${rule}.${held > 0 ? ` You already hold ${usd(held)} of ${name}.` : ""}`,
  };
}
