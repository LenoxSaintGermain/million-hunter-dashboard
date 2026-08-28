/**
 * The mandate — the numbers Jim and the operator agreed to, in one versioned place.
 *
 * Why this file exists: the Short-Horizon Run preset's required fields ARE the
 * mandate. Holding period, liquidity floor, catalyst deadline, concentration cap
 * and invalidation rule are not UI decoration — they are the trading constitution
 * a run is gated against. Scattering those numbers across zod schemas and gate
 * functions would mean the mandate has no single readable statement and no
 * version, so an order row six months from now could not say what it was checked
 * against.
 *
 * Every run and every order stores `mandateVersion`. Rows written before this
 * existed carry null, which reads as "pre-mandate, not gated" — they are not
 * retroactively failed.
 *
 * PERCENTAGES ARE 0..100 (matching `portfolioRules` in the thesis graph).
 * MONEY IS IN CENTS unless the name says `Usd` — ADV is quoted in dollars because
 * that is how every provider states it.
 *
 * Signed off 2026-08-13 (v1).
 */

// ── Holding-period taxonomy ───────────────────────────────────────────────────

export type HoldingPeriod = "intraday" | "overnight" | "swing" | "catalyst_window" | "position";

export interface HoldingPeriodRule {
  key: HoldingPeriod;
  label: string;
  /** Trading sessions the position may be held. */
  maxSessions: number;
  /**
   * Calendar-day horizon the catalyst deadline must fall inside. Deliberately
   * looser than maxSessions — sessions are business days, deadlines are wall
   * clock, and a swing held 10 sessions can span two weekends.
   */
  maxHorizonDays: number;
  /** intraday must be entered during the regular session — no pre/after-hours. */
  requiresRegularSession: boolean;
  /** No overnight carry. */
  mustBeFlatBySessionEnd: boolean;
  description: string;
}

export const HOLDING_PERIODS: Record<HoldingPeriod, HoldingPeriodRule> = {
  intraday: {
    key: "intraday",
    label: "Intraday",
    maxSessions: 1,
    maxHorizonDays: 1,
    requiresRegularSession: true,
    mustBeFlatBySessionEnd: true,
    description: "Opened and closed in the same session. Flat by 15:55 ET.",
  },
  overnight: {
    key: "overnight",
    label: "Overnight",
    maxSessions: 1,
    maxHorizonDays: 2,
    requiresRegularSession: false,
    mustBeFlatBySessionEnd: false,
    description: "Carried across one session boundary. Exit by the next close.",
  },
  swing: {
    key: "swing",
    label: "Swing",
    maxSessions: 10,
    maxHorizonDays: 21,
    requiresRegularSession: false,
    mustBeFlatBySessionEnd: false,
    description: "Two to ten sessions.",
  },
  catalyst_window: {
    key: "catalyst_window",
    label: "Catalyst window",
    maxSessions: 20,
    maxHorizonDays: 30,
    requiresRegularSession: false,
    mustBeFlatBySessionEnd: false,
    description: "Bounded by a dated catalyst. Capped at 20 sessions regardless.",
  },
  position: {
    key: "position",
    label: "Long term",
    maxSessions: 504,
    maxHorizonDays: 730,
    requiresRegularSession: false,
    mustBeFlatBySessionEnd: false,
    description: "Multi-month paper position with a named review date; review at least every 30 days.",
  },
};

export const HOLDING_PERIOD_KEYS = Object.keys(HOLDING_PERIODS) as HoldingPeriod[];

export function isHoldingPeriod(v: unknown): v is HoldingPeriod {
  return typeof v === "string" && (HOLDING_PERIOD_KEYS as string[]).includes(v);
}

// ── The ceilings ──────────────────────────────────────────────────────────────

export interface Mandate {
  version: string;
  /** Single order, as a percentage of account equity at order time. */
  maxOrderNotionalPctOfEquity: number;
  /** …and an absolute cap, whichever binds first. */
  maxOrderNotionalCents: number;
  /** Post-fill position in one symbol. */
  maxPositionPctOfEquity: number;
  /** Post-fill exposure to one sector / correlated cluster. */
  maxClusterPctOfEquity: number;
  /** Gross capital a single run may deploy — the complement of the cash reserve. */
  maxRunGrossDeployedPctOfEquity: number;
  /** New buy notional across all runs in one ET calendar day. */
  maxDailyNewNotionalPctOfEquity: number;
  /** 30-day average daily dollar volume floor, in USD. */
  minAdvUsd30d: number;
  /** An order may not be more than this share of the name's ADV. */
  maxOrderPctOfAdv: number;
  /** Minutes past ET midnight after which no new intraday order may be created. */
  intradayCutoffEtMinutes: number;
  // ── Planned-loss ceilings ─────────────────────────────────────────────────
  // A second, independent axis from the notional ceilings above. Notional caps
  // how much capital an order commits; planned loss caps how much of it the
  // stop actually puts at risk. An order can sit inside every notional ceiling
  // and still risk 4% of the account on a wide stop, which is why both exist.
  //   planned loss = qty x (|entry - stop| + slippage allowance)
  /** Most a single play may plan to lose, as a percentage of equity. */
  maxPlannedRiskPctPerPlay: number;
  /** Most all plays opened in one ET day may plan to lose, combined. */
  maxDailyPlannedRiskPct: number;
  /** Most plays sharing a correlated cluster may plan to lose, combined. */
  maxCorrelatedPlannedRiskPct: number;
}

/**
 * v1 — sized against the live paper account (~$100k equity).
 *
 * The denominator is account EQUITY, not the run's deployable capital: deployable
 * capital is a plan, equity is the balance sheet the position actually sits on.
 */
export const MANDATE_V1: Mandate = {
  version: "v1",
  maxOrderNotionalPctOfEquity: 5,
  maxOrderNotionalCents: 1_000_000, // $10,000
  maxPositionPctOfEquity: 10,
  maxClusterPctOfEquity: 25,
  maxRunGrossDeployedPctOfEquity: 40, // 60% cash reserve
  maxDailyNewNotionalPctOfEquity: 20,
  minAdvUsd30d: 20_000_000,
  maxOrderPctOfAdv: 0.5,
  intradayCutoffEtMinutes: 15 * 60 + 55, // 15:55 ET
  // v1 did not have a planned-loss axis at all. These carry v2's values so the
  // type is satisfied, but no order was ever gated against them under v1.
  maxPlannedRiskPctPerPlay: 0.75,
  maxDailyPlannedRiskPct: 2,
  maxCorrelatedPlannedRiskPct: 1.25,
};

/**
 * v2 — adds the planned-loss axis, 2026-08-18.
 *
 * v1 sized only by notional, so a stop three points wide and a stop thirty
 * points wide were the same order to the gates. These three ceilings come from
 * the operator's own day-trading model: risk a fraction of a percent per play,
 * cap the day, and cap what a single correlated theme can cost when several
 * plays are really one bet.
 *
 * Orders and runs stamped "v1" were gated without them and are not
 * retroactively failed.
 */
export const MANDATE_V2: Mandate = {
  ...MANDATE_V1,
  version: "v2",
  maxPlannedRiskPctPerPlay: 0.75,
  maxDailyPlannedRiskPct: 2,
  maxCorrelatedPlannedRiskPct: 1.25,
};

export const CURRENT_MANDATE: Mandate = MANDATE_V2;

/** The literal the operator must echo. Cheap, but it puts consent on the record. */
export const PAPER_ACKNOWLEDGEMENT = "PAPER";

// ── Thesis rules may tighten, never loosen ────────────────────────────────────

/** The subset of `graph.portfolioRules` that overlaps the mandate. */
export interface ThesisPortfolioRules {
  maxSingleNamePct?: number | string | null;
  maxCorrelatedClusterPct?: number | string | null;
  minAvgDailyVolumeUsd?: number | string | null;
  reservePct?: number | string | null;
}

/** The compiler's JSON schema declares these as strings; the type says number. */
const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/**
 * Merge a thesis's own rules into the mandate. A thesis can only make a ceiling
 * stricter. If a thesis says "up to 30% in one name", the mandate's 10% wins —
 * otherwise the mandate is advisory, which is the same as not having one.
 */
export function effectiveMandate(
  base: Mandate,
  rules: ThesisPortfolioRules | null | undefined,
): Mandate {
  if (!rules) return base;
  const singleName = num(rules.maxSingleNamePct);
  const cluster = num(rules.maxCorrelatedClusterPct);
  const adv = num(rules.minAvgDailyVolumeUsd);
  const reserve = num(rules.reservePct);

  return {
    ...base,
    maxPositionPctOfEquity:
      singleName != null ? Math.min(base.maxPositionPctOfEquity, singleName) : base.maxPositionPctOfEquity,
    maxClusterPctOfEquity:
      cluster != null ? Math.min(base.maxClusterPctOfEquity, cluster) : base.maxClusterPctOfEquity,
    // A floor tightens upward.
    minAdvUsd30d: adv != null ? Math.max(base.minAdvUsd30d, adv) : base.minAdvUsd30d,
    maxRunGrossDeployedPctOfEquity:
      reserve != null
        ? Math.min(base.maxRunGrossDeployedPctOfEquity, 100 - reserve)
        : base.maxRunGrossDeployedPctOfEquity,
  };
}

// ── Free-text quality ─────────────────────────────────────────────────────────

export const MIN_NARRATIVE_CHARS = 20;

/**
 * Boilerplate a required field is most often filled with to get past the form.
 * A gate that accepts "n/a" is a gate that does nothing.
 */
const BOILERPLATE = new Set([
  "n/a", "na", "none", "tbd", "todo", "test", "testing", "x", "xx", "xxx",
  "see memo", "see above", "as discussed", "per thesis", "same as above",
  "asdf", "placeholder", "-", "--", ".",
]);

export interface NarrativeCheck {
  ok: boolean;
  reason: string | null;
}

export function checkNarrative(value: string | null | undefined, field: string): NarrativeCheck {
  const v = (value ?? "").trim();
  if (!v) return { ok: false, reason: `${field} is required` };
  if (BOILERPLATE.has(v.toLowerCase())) {
    return { ok: false, reason: `${field} is boilerplate ("${v}") — state the actual case` };
  }
  if (v.length < MIN_NARRATIVE_CHARS) {
    return { ok: false, reason: `${field} must be at least ${MIN_NARRATIVE_CHARS} characters (got ${v.length})` };
  }
  return { ok: true, reason: null };
}
