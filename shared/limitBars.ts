import type { CockpitHeadroomLine } from "./cockpitRailSummary";

/**
 * The three limits the POC v3 context strip shows: single order, per play and
 * daily loss. Read only from the cockpit's own headroom lines. A per-order or
 * per-play ceiling is never a running total, so it gets no fill (the server
 * keeps usedCents null for exactly that reason); only today's planned loss
 * is a measured bar. Unknown is "not measured", never zero.
 */
export type LimitBar = {
  key: "single_order" | "per_play" | "daily_loss";
  label: string;
  kind: "ceiling" | "usage";
  ceilingCents: number | null;
  usedCents: number | null;
  /** 0–100, usage bars only. */
  usedPct: number | null;
  tone: "quiet" | "warning" | "critical" | "unknown";
  value: string;
  note: string;
};

// Exact to the cent when the amount isn't whole dollars: rounding a limit up
// would overstate it (a $187.50 cap must not read as $188).
const usd = (cents: number) => {
  const whole = Math.round(cents) % 100 === 0;
  return `$${(Math.round(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`;
};
const NOT_MEASURED = "Sync your account to measure this limit.";

function ceilingBar(key: LimitBar["key"], label: string, line: CockpitHeadroomLine | undefined, value: (cents: number) => string, note: string): LimitBar {
  const ceiling = line?.ceilingCents ?? null;
  if (ceiling == null || !Number.isFinite(ceiling)) {
    return { key, label, kind: "ceiling", ceilingCents: null, usedCents: null, usedPct: null, tone: "unknown", value: "Not measured", note: line?.reason ? NOT_MEASURED : "This limit wasn't reported." };
  }
  return { key, label, kind: "ceiling", ceilingCents: ceiling, usedCents: null, usedPct: null, tone: "quiet", value: value(ceiling), note };
}

export function buildLimitBars(lines: readonly CockpitHeadroomLine[] | null | undefined): LimitBar[] {
  const byKey = new Map((lines ?? []).map((line) => [line.key, line]));
  const single = ceilingBar("single_order", "Single order", byKey.get("single_order"), (c) => `Up to ${usd(c)}`, "Applies to each order. Nothing adds up against it.");
  const perPlay = ceilingBar("per_play", "Per play", byKey.get("planned_risk_per_play"), (c) => `Up to ${usd(c)} planned loss`, "The most one play may plan to lose.");
  const daily = byKey.get("daily_planned_risk");
  let dailyBar: LimitBar;
  if (!daily || daily.ceilingCents == null) {
    dailyBar = { key: "daily_loss", label: "Daily loss", kind: "usage", ceilingCents: null, usedCents: null, usedPct: null, tone: "unknown", value: "Not measured", note: NOT_MEASURED };
  } else if (daily.usedCents == null) {
    dailyBar = { key: "daily_loss", label: "Daily loss", kind: "usage", ceilingCents: daily.ceilingCents, usedCents: null, usedPct: null, tone: "unknown", value: `${usd(daily.ceilingCents)} limit · today not measured`, note: "Today's orders couldn't be read, so use is unknown, not zero." };
  } else {
    const pct = daily.ceilingCents > 0 ? Math.min(100, Math.max(0, (daily.usedCents / daily.ceilingCents) * 100)) : 100;
    dailyBar = {
      key: "daily_loss", label: "Daily loss", kind: "usage", ceilingCents: daily.ceilingCents, usedCents: daily.usedCents, usedPct: pct,
      tone: pct >= 85 ? "critical" : pct >= 70 ? "warning" : "quiet",
      value: `${usd(daily.usedCents)} of ${usd(daily.ceilingCents)} used`,
      note: "Planned loss on today's orders (ET).",
    };
  }
  return [single, perPlay, dailyBar];
}
