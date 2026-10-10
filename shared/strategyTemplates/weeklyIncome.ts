/**
 * Weekly Income (defined-risk premium) strategy template, v0.1 (#83, tracker #82).
 *
 * All 52 tunables from the thesis spec §10: default, range, unit, rationale and
 * a one-line plain explanation for Quick Play. Mandate-linked rows are
 * tighten-only. Locked rows cannot change in v0.1.
 *
 * Parameters describe research rules. They cannot lift the strategy halt,
 * enable order routing, or loosen any mandate ceiling.
 */
import { z } from "zod";

export const WEEKLY_INCOME_TEMPLATE_ID = "capital_weekly_income" as const;
export const WEEKLY_INCOME_TEMPLATE_VERSION = "0.1" as const;
export const WEEKLY_INCOME_TEMPLATE_LABEL = "Weekly Income · defined-risk premium · v0.1 · paper";

export type WiGroup = "Universe" | "Contract filters" | "Structure" | "Events & session" | "Sizing" | "Management" | "Scorecard";
export const WI_GROUPS: WiGroup[] = ["Universe", "Contract filters", "Structure", "Events & session", "Sizing", "Management", "Scorecard"];

/** Mandate ceilings a thesis may only tighten (keys of server/aperture/mandate.ts Mandate). */
export type WiMandateKey = "maxPlannedRiskPctPerPlay" | "maxAggregateOpenRiskPct" | "maxDailyPlannedRiskPct" | "maxCorrelatedPlannedRiskPct" | "maxWeeklyPlannedRiskPct" | "minAdvUsd30d";
export type WiMandateCeilings = Record<WiMandateKey, number> & { version: string };

export type Structure = "P1" | "P2" | "P3";
const STRUCTURE_NAMES: Record<Structure, string> = { P1: "put credit spread", P2: "cash-secured put", P3: "covered call" };

/**
 * structures_enabled default before the owner switched it to put credit spreads
 * only (2026-10-10). Theses saved earlier store this value inside an immutable,
 * hashed compilation row; those rows are never rewritten.
 */
export const WI_LEGACY_STRUCTURES_DEFAULT: readonly Structure[] = ["P1", "P3"];

/** True when a stored structures list is exactly the old default (any order). */
export function isLegacyStructuresDefault(list: unknown): boolean {
  if (!Array.isArray(list) || list.length !== WI_LEGACY_STRUCTURES_DEFAULT.length) return false;
  return [...list].sort().join(",") === [...WI_LEGACY_STRUCTURES_DEFAULT].sort().join(",");
}

/**
 * When a saved thesis is re-saved as a new version, its stored parameters come
 * back as overrides. Only if structures_enabled equals the old default exactly,
 * map it to the new default; any other value passes through unchanged and is
 * validated as usual. Returns a copy; the input is never mutated.
 */
export function migrateLegacyStructuresDefault<T>(overrides: T): { overrides: T; migrated: boolean } {
  const o = overrides as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || !isLegacyStructuresDefault(o.structures_enabled)) return { overrides, migrated: false };
  return { overrides: { ...o, structures_enabled: ["P1"] } as T, migrated: true };
}

/** Plain note for a saved thesis that still stores the old default. */
export const WI_LEGACY_STRUCTURES_NOTE = "Saved under the old default (put credit spreads + covered calls). The screen only looks for put credit spreads, so nothing changes; a new version saves put credit spreads only.";
export type EntryDay = "mon" | "tue" | "wed" | "thu";
export type WidthTiers = { under50: number; from50to150: number; above150: number };
export type MacroBlackout = { beforeMinutes: number; afterMinutes: number };

type Base = { key: string; group: WiGroup; label: string; unit: string; rationale: string; plain: string; mandateKey?: WiMandateKey; locked?: string };
type NumberDef = Base & { kind: "number"; default: number; min: number; max: number; decimals: number; integer?: boolean };
type BoolDef = Base & { kind: "boolean"; default: boolean };
type EnumDef = Base & { kind: "enum"; default: string; options: readonly string[] };
type TimeDef = Base & { kind: "time"; default: string; min: string; max: string };
type StructuresDef = Base & { kind: "structures"; default: readonly Structure[] };
type DaysDef = Base & { kind: "days"; default: readonly EntryDay[] };
type TiersDef = Base & { kind: "tiers"; default: WidthTiers; min: number; max: number };
type BlackoutDef = Base & { kind: "blackout"; default: MacroBlackout };
export type WiParamDef = NumberDef | BoolDef | EnumDef | TimeDef | StructuresDef | DaysDef | TiersDef | BlackoutDef;

const V01 = "Deferred to v0.2 (owner decision)";

export const WEEKLY_INCOME_PARAMETERS = [
  { key: "structures_enabled", group: "Structure", kind: "structures", default: ["P1"], label: "Structures enabled", unit: "set", rationale: "Put credit spreads only (owner decision)", plain: "Which kinds of trade are allowed. Put credit spreads only: covered calls and cash-secured puts are off by default." },
  { key: "min_avg_dollar_volume", group: "Universe", kind: "number", default: 100_000_000, min: 50_000_000, max: 500_000_000, decimals: 0, label: "Minimum average dollar volume (20-day)", unit: "USD", rationale: "Liquidity", plain: "Only stocks where at least this much money changes hands on an average day.", mandateKey: "minAdvUsd30d" },
  { key: "min_underlying_price", group: "Universe", kind: "number", default: 20, min: 10, max: 100, decimals: 2, label: "Minimum share price", unit: "USD", rationale: "Tick and quality noise", plain: "Skip stocks priced below this." },
  { key: "require_weekly_expirations", group: "Universe", kind: "boolean", default: true, label: "Weekly expirations required", unit: "flag", rationale: "Weekly thesis", plain: "Only stocks that have options expiring every week.", locked: "Fixed for this thesis" },
  { key: "exclude_otc", group: "Universe", kind: "boolean", default: true, label: "Exclude OTC", unit: "flag", rationale: "Data and spread quality", plain: "Skip stocks that trade over the counter instead of on an exchange.", locked: "Fixed for this thesis" },
  { key: "max_candidates_per_week", group: "Universe", kind: "number", default: 10, min: 3, max: 25, decimals: 0, integer: true, label: "Candidates shown per week", unit: "count", rationale: "Focus", plain: "Show at most this many ideas a week." },
  { key: "quote_feed_required", group: "Contract filters", kind: "enum", default: "opra", options: ["opra"], label: "Quote feed required", unit: "feed", rationale: "Indicative quotes are modified", plain: "Only official real-time option prices (OPRA).", locked: "Fixed for this thesis" },
  { key: "max_quote_age_seconds", group: "Contract filters", kind: "number", default: 60, min: 15, max: 300, decimals: 0, integer: true, label: "Maximum quote age", unit: "seconds", rationale: "Stale-data guard", plain: "Prices older than this are treated as missing." },
  { key: "max_bid_ask_pct_of_mid", group: "Contract filters", kind: "number", default: 10, min: 3, max: 20, decimals: 1, label: "Maximum bid/ask width", unit: "% of mid", rationale: "Execution cost", plain: "Skip contracts where the gap between buyers and sellers is too wide." },
  { key: "max_bid_ask_usd_floor", group: "Contract filters", kind: "number", default: 0.05, min: 0.03, max: 0.15, decimals: 2, label: "Bid/ask floor", unit: "USD", rationale: "Low-price contracts", plain: "A gap this small is always acceptable, even on cheap contracts." },
  { key: "min_open_interest_short", group: "Contract filters", kind: "number", default: 500, min: 100, max: 5_000, decimals: 0, integer: true, label: "Minimum open interest (sold put)", unit: "contracts", rationale: "Exit liquidity", plain: "The put you sell must already be widely held, so it's easy to close." },
  { key: "min_open_interest_long", group: "Contract filters", kind: "number", default: 100, min: 50, max: 2_000, decimals: 0, integer: true, label: "Minimum open interest (floor put)", unit: "contracts", rationale: "Hedge leg liquidity", plain: "The floor put must also have real interest." },
  { key: "min_option_daily_volume", group: "Contract filters", kind: "number", default: 50, min: 0, max: 1_000, decimals: 0, integer: true, label: "Minimum daily option volume", unit: "contracts", rationale: "Activity", plain: "At least this many contracts traded today." },
  { key: "short_delta_min", group: "Structure", kind: "number", default: 0.15, min: 0.05, max: 0.25, decimals: 2, label: "Sold put delta, minimum", unit: "delta", rationale: "Premium floor", plain: "Lowest market-implied chance (about 15%) of the promise price being reached." },
  { key: "short_delta_max", group: "Structure", kind: "number", default: 0.30, min: 0.20, max: 0.40, decimals: 2, label: "Sold put delta, maximum", unit: "delta", rationale: "Assignment / ITM odds", plain: "Highest market-implied chance (about 30%) of the promise price being reached." },
  { key: "dte_min", group: "Structure", kind: "number", default: 4, min: 2, max: 7, decimals: 0, integer: true, label: "Days to expiration, minimum", unit: "days", rationale: "No 0–1 DTE (existing gate)", plain: "No options that expire in the next few days." },
  { key: "dte_max", group: "Structure", kind: "number", default: 10, min: 7, max: 14, decimals: 0, integer: true, label: "Days to expiration, maximum", unit: "days", rationale: "Weekly cadence", plain: "No options more than about a week and a half out." },
  { key: "spread_width_tiers", group: "Structure", kind: "tiers", default: { under50: 1, from50to150: 2.5, above150: 5 }, min: 1, max: 10, label: "Spread width by share price", unit: "USD", rationale: "By underlying price", plain: "How far below the promise price the floor sits, by share price." },
  { key: "min_credit_pct_of_width", group: "Structure", kind: "number", default: 15, min: 10, max: 25, decimals: 1, label: "Minimum payment as % of width", unit: "%", rationale: "Worth the risk", plain: "Skip trades that pay too little for what they risk." },
  { key: "max_credit_pct_of_width", group: "Structure", kind: "number", default: 40, min: 30, max: 50, decimals: 1, label: "Maximum payment as % of width", unit: "%", rationale: "Not a directional bet", plain: "A very large payment means the promise is likely to be called on, so it's skipped." },
  { key: "earnings_window_sessions_after", group: "Events & session", kind: "number", default: 1, min: 0, max: 3, decimals: 0, integer: true, label: "Earnings window after expiration", unit: "sessions", rationale: "Event gap", plain: "Skip a stock if it reports earnings before the trade ends, or this many trading days after." },
  { key: "earnings_unknown_policy", group: "Events & session", kind: "enum", default: "exclude", options: ["exclude"], label: "Unknown earnings date", unit: "policy", rationale: "Fail closed", plain: "If we don't know when a company reports, we skip it.", locked: "Fixed for this thesis" },
  { key: "ex_dividend_blackout_calls", group: "Events & session", kind: "boolean", default: true, label: "Ex-dividend blackout for calls", unit: "flag", rationale: "Early assignment", plain: "Don't sell calls that span a dividend cutoff date." },
  { key: "entry_days", group: "Events & session", kind: "days", default: ["mon", "tue", "wed"], label: "Entry days", unit: "weekdays", rationale: "Time to work", plain: "Days new trades may open." },
  { key: "opening_no_trade_minutes", group: "Events & session", kind: "number", default: 15, min: 5, max: 30, decimals: 0, integer: true, label: "No entries after the open", unit: "minutes", rationale: "Wide opening quotes", plain: "Wait this long after the market opens; prices are messy at first." },
  { key: "last_entry_time", group: "Events & session", kind: "time", default: "15:30", min: "14:30", max: "15:40", label: "Last entry time (ET)", unit: "HH:MM ET", rationale: "Same as #9", plain: "No new trades after this time." },
  { key: "macro_event_entry_blackout", group: "Events & session", kind: "blackout", default: { beforeMinutes: 5, afterMinutes: 10 }, label: "Macro event entry blackout", unit: "minutes", rationale: "Same as #13", plain: "No new trades just before and after big economic announcements." },
  { key: "max_loss_per_position_pct", group: "Sizing", kind: "number", default: 0.75, min: 0.25, max: 0.75, decimals: 2, label: "Max loss per position", unit: "% of equity", rationale: "Mandate per-play", plain: "Each trade can lose at most this share of your practice balance.", mandateKey: "maxPlannedRiskPctPerPlay" },
  { key: "max_open_loss_pct", group: "Sizing", kind: "number", default: 3, min: 1, max: 3, decimals: 2, label: "Max open loss, all positions", unit: "% of equity", rationale: "Mandate aggregate", plain: "All open trades together can lose at most this share.", mandateKey: "maxAggregateOpenRiskPct" },
  { key: "max_daily_new_loss_pct", group: "Sizing", kind: "number", default: 2, min: 0.5, max: 2, decimals: 2, label: "Max new loss per day", unit: "% of equity", rationale: "Mandate daily", plain: "New trades opened in one day can add at most this much possible loss.", mandateKey: "maxDailyPlannedRiskPct" },
  { key: "max_correlated_loss_pct", group: "Sizing", kind: "number", default: 1.25, min: 0.5, max: 1.25, decimals: 2, label: "Max loss per correlated cluster", unit: "% of equity", rationale: "Mandate cluster", plain: "Trades in similar stocks together can lose at most this share.", mandateKey: "maxCorrelatedPlannedRiskPct" },
  { key: "weekly_loss_limit_pct", group: "Sizing", kind: "number", default: 2, min: 1, max: 4, decimals: 2, label: "Weekly loss limit", unit: "% of equity", rationale: "Mandate weekly is 4%", plain: "After losing this much in a week, no new trades until Monday.", mandateKey: "maxWeeklyPlannedRiskPct" },
  { key: "max_open_positions", group: "Sizing", kind: "number", default: 6, min: 1, max: 10, decimals: 0, integer: true, label: "Max open positions", unit: "count", rationale: "Monitoring load", plain: "At most this many trades open at once." },
  { key: "max_positions_per_underlying", group: "Sizing", kind: "number", default: 1, min: 1, max: 2, decimals: 0, integer: true, label: "Max positions per stock", unit: "count", rationale: "Concentration", plain: "At most this many trades on the same stock." },
  { key: "slippage_per_leg_usd", group: "Sizing", kind: "number", default: 0.05, min: 0.01, max: 0.20, decimals: 2, label: "Slippage allowance per leg", unit: "USD/share", rationale: "Paper fills at NBBO with no queue or size check", plain: "A cost cushion added to the possible loss for each side of the trade." },
  { key: "fee_allowance_per_contract_usd", group: "Sizing", kind: "number", default: 0, min: 0, max: 1, decimals: 2, label: "Fee allowance per contract", unit: "USD", rationale: "Set to broker schedule", plain: "Broker fees counted per contract." },
  { key: "csp_loss_basis", group: "Sizing", kind: "enum", default: "stop_based", options: ["stop_based", "stress_pct", "full_notional"], label: "Cash-secured put loss basis", unit: "policy", rationale: "Owner decision O1", plain: "How a cash-secured put's possible loss is counted (owner decision pending)." },
  { key: "csp_stop_atr_mult", group: "Sizing", kind: "number", default: 1, min: 0.5, max: 2, decimals: 2, label: "Cash-secured put stop (× ATR14)", unit: "× ATR", rationale: "Planned loss at stop", plain: "How far below the promise price the stop sits, in typical daily moves." },
  { key: "csp_gap_stress_pct", group: "Sizing", kind: "number", default: 25, min: 10, max: 50, decimals: 0, label: "Cash-secured put gap stress", unit: "%", rationale: "Display only, never gated", plain: "The overnight drop used to show a bad-case loss." },
  { key: "cc_min_strike_vs_cost_basis", group: "Structure", kind: "boolean", default: true, label: "Covered call strike ≥ cost basis", unit: "flag", rationale: "Avoid locking in a loss on assignment", plain: "Don't agree to sell shares for less than you paid." },
  { key: "take_profit_pct_of_credit", group: "Management", kind: "number", default: 50, min: 25, max: 80, decimals: 0, label: "Take profit", unit: "% of credit kept", rationale: "H2", plain: "Close early once you've kept this share of the payment." },
  { key: "stop_multiple_of_credit", group: "Management", kind: "number", default: 2, min: 1.5, max: 3, decimals: 2, label: "Stop", unit: "× credit to close", rationale: "Loss about 1× credit", plain: "Close when buying the trade back costs this many times the payment (a loss of about one payment at 2×)." },
  { key: "close_on_short_strike_breach", group: "Management", kind: "boolean", default: true, label: "Close on strike breach", unit: "flag", rationale: "Structure failed", plain: "Close if the stock falls below the promise price." },
  { key: "close_sessions_before_expiry", group: "Management", kind: "number", default: 1, min: 1, max: 2, decimals: 0, integer: true, label: "Close sessions before expiry", unit: "sessions", rationale: "Pin and assignment", plain: "Close this many trading days before the option expires." },
  { key: "time_exit", group: "Management", kind: "time", default: "15:30", min: "14:30", max: "15:45", label: "Time exit (ET)", unit: "HH:MM ET", rationale: "Before close", plain: "The time of day the planned close happens." },
  { key: "rolls_allowed", group: "Management", kind: "boolean", default: false, label: "Rolls allowed", unit: "flag", rationale: "Honesty", plain: "No rolling a losing trade into a later one; close it and record the result.", locked: V01 },
  { key: "accept_assignment_csp", group: "Management", kind: "boolean", default: false, label: "Accept assignment (wheel)", unit: "flag", rationale: "Wheel", plain: "Never end up owning shares from a put in this version.", locked: V01 },
  { key: "max_loss_breach_action", group: "Management", kind: "enum", default: "halt", options: ["halt"], label: "If a loss exceeds its stated max", unit: "action", rationale: "Same as #13", plain: "If any trade loses more than its stated maximum, the strategy stops until the owner reviews.", locked: "Fixed for this thesis" },
  { key: "consecutive_losing_weeks_pause", group: "Management", kind: "number", default: 2, min: 1, max: 4, decimals: 0, integer: true, label: "Pause after losing weeks", unit: "weeks", rationale: "Drawdown control", plain: "After this many losing weeks in a row, stop until the owner reviews." },
  { key: "monitor_interval_minutes", group: "Management", kind: "number", default: 5, min: 1, max: 15, decimals: 0, integer: true, label: "Monitor interval", unit: "minutes", rationale: "Management", plain: "How often open trades are checked." },
  { key: "account_equity_usd", group: "Scorecard", kind: "enum", default: "measured", options: ["measured"], label: "Account value basis", unit: "basis", rationale: "Never declared capital (#19)", plain: "All percentages use your measured account value, never a typed-in amount.", locked: "Fixed for this thesis" },
  { key: "direction", group: "Structure", kind: "enum", default: "neutral_to_bullish", options: ["neutral_to_bullish"], label: "Direction", unit: "view", rationale: "P1/P2/P3 only (like D3)", plain: "These trades do well when the stock holds steady or rises.", locked: "Neutral-to-bullish (locked)" },
] as const satisfies readonly WiParamDef[];

export type WiParamKey = (typeof WEEKLY_INCOME_PARAMETERS)[number]["key"];
type ValueOf<D> = D extends { kind: "number" } ? number
  : D extends { kind: "boolean" } ? boolean
  : D extends { kind: "enum" | "time" } ? string
  : D extends { kind: "structures" } ? Structure[]
  : D extends { kind: "days" } ? EntryDay[]
  : D extends { kind: "tiers" } ? WidthTiers
  : D extends { kind: "blackout" } ? MacroBlackout
  : never;
export type WeeklyIncomeParameters = { [D in (typeof WEEKLY_INCOME_PARAMETERS)[number] as D["key"]]: ValueOf<D> };

const DEFS = WEEKLY_INCOME_PARAMETERS as readonly WiParamDef[];
export const WI_PARAM_BY_KEY: Record<string, WiParamDef> = Object.fromEntries(DEFS.map((def) => [def.key, def]));

export function weeklyIncomeDefaults(): WeeklyIncomeParameters {
  return Object.fromEntries(DEFS.map((def) => [def.key, structuredClone(def.default)])) as WeeklyIncomeParameters;
}

const minutes = (hhmm: string) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

export function formatParamValue(def: WiParamDef, value: unknown): string {
  if (def.kind === "number") {
    const n = Number(value);
    if (def.unit === "USD" && n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString("en-US")}M`;
    if (def.unit === "USD" || def.unit === "USD/share") return `$${n.toFixed(2)}`;
    const text = n.toFixed(def.decimals);
    return def.unit.startsWith("%") ? `${Number(text)}%` : text;
  }
  if (def.kind === "tiers") { const t = value as WidthTiers; return `$${t.under50} / $${t.from50to150} / $${t.above150}`; }
  if (def.kind === "blackout") { const b = value as MacroBlackout; return `−${b.beforeMinutes} / +${b.afterMinutes} min`; }
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  return String(value);
}

const rangeText = (def: NumberDef) => `${formatParamValue(def, def.min)} and ${formatParamValue(def, def.max)}`;

/** Zod shape of an override payload. Range rules run in validateWeeklyIncomeParameters. */
export const weeklyIncomeOverridesSchema = z.object(Object.fromEntries(DEFS.map((def) => {
  switch (def.kind) {
    case "number": return [def.key, z.number().finite()];
    case "boolean": return [def.key, z.boolean()];
    case "enum": return [def.key, z.string()];
    case "time": return [def.key, z.string()];
    case "structures": return [def.key, z.array(z.enum(["P1", "P2", "P3"])).max(3)];
    case "days": return [def.key, z.array(z.enum(["mon", "tue", "wed", "thu"])).max(4)];
    case "tiers": return [def.key, z.object({ under50: z.number().finite(), from50to150: z.number().finite(), above150: z.number().finite() }).strict()];
    case "blackout": return [def.key, z.object({ beforeMinutes: z.number().finite(), afterMinutes: z.number().finite() }).strict()];
  }
})) as Record<string, z.ZodTypeAny>).partial().strict();

export type WeeklyIncomeOverrides = Partial<WeeklyIncomeParameters>;

export type WeeklyIncomeValidation =
  | { ok: true; parameters: WeeklyIncomeParameters }
  | { ok: false; errors: string[] };

export type WeeklyIncomeDecisions = {
  /** Owner decision O1 (cash-secured put loss basis) has been recorded. */
  o1Recorded?: boolean;
};

/**
 * Merge overrides onto defaults and check every rule. Server-side authority:
 * the client may mirror it, but only the server result is stored.
 */
export function validateWeeklyIncomeParameters(overrides: unknown, mandate: WiMandateCeilings, decisions: WeeklyIncomeDecisions = {}): WeeklyIncomeValidation {
  const parsed = weeklyIncomeOverridesSchema.safeParse(overrides ?? {});
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => issue.code === "unrecognized_keys" ? `Unknown parameter: ${(issue as any).keys.join(", ")}` : `${issue.path.join(".") || "parameters"}: ${issue.message}`) };
  }
  const params = { ...weeklyIncomeDefaults(), ...(parsed.data as WeeklyIncomeOverrides) } as WeeklyIncomeParameters;
  const values = params as unknown as Record<string, unknown>;
  const errors: string[] = [];
  for (const def of DEFS) {
    const value = values[def.key];
    if (def.locked && JSON.stringify(value) !== JSON.stringify(def.default)) {
      errors.push(`${def.key} is locked: ${def.locked}.`);
      continue;
    }
    switch (def.kind) {
      case "number": {
        const n = value as number;
        if (n < def.min || n > def.max) errors.push(`${def.key} must be between ${rangeText(def)}`);
        else if (def.integer && !Number.isInteger(n)) errors.push(`${def.key} must be a whole number`);
        if (def.mandateKey) {
          const ceiling = mandate[def.mandateKey];
          if (def.mandateKey === "minAdvUsd30d" ? n < ceiling : n > ceiling) {
            errors.push(`${def.key} can only tighten the mandate: ${formatParamValue(def, n)} is looser than mandate ${mandate.version} ${def.mandateKey} (${formatParamValue(def, ceiling)}).`);
          }
        }
        break;
      }
      case "enum":
        if (!def.options.includes(value as string)) errors.push(`${def.key} must be one of ${def.options.join(", ")}`);
        break;
      case "time": {
        const m = minutes(value as string);
        if (m == null || m < minutes(def.min)! || m > minutes(def.max)!) errors.push(`${def.key} must be between ${def.min} and ${def.max} ET`);
        break;
      }
      case "structures": {
        const list = value as Structure[];
        if (!list.length) errors.push("structures_enabled must include at least one structure");
        if (new Set(list).size !== list.length) errors.push("structures_enabled must not repeat a structure");
        if (list.includes("P2") && !decisions.o1Recorded) errors.push("structures_enabled cannot include P2 (cash-secured put) until owner decision O1 is recorded");
        // Tighten-only: a thesis may drop structures from the default but not add
        // new ones. P2 is the one owner-gated exception (O1, checked above).
        for (const s of list) if (s !== "P2" && !def.default.includes(s)) errors.push(`structures_enabled cannot include ${s}${STRUCTURE_NAMES[s] ? ` (${STRUCTURE_NAMES[s]})` : ""}: the default is put credit spreads only, and a thesis can only narrow it`);
        break;
      }
      case "days": {
        const list = value as EntryDay[];
        if (!list.length) errors.push("entry_days must include at least one day");
        if (new Set(list).size !== list.length) errors.push("entry_days must not repeat a day");
        break;
      }
      case "tiers": {
        const t = value as WidthTiers;
        for (const [name, width] of Object.entries(t)) if (width < def.min || width > def.max) errors.push(`spread_width_tiers.${name} must be between $${def.min} and $${def.max}`);
        if (!(t.under50 <= t.from50to150 && t.from50to150 <= t.above150)) errors.push("spread_width_tiers must not get narrower as the share price rises");
        break;
      }
      case "blackout": {
        const b = value as MacroBlackout;
        if (b.beforeMinutes < 0 || b.beforeMinutes > 15) errors.push("macro_event_entry_blackout.beforeMinutes must be between 0 and 15");
        if (b.afterMinutes < 5 || b.afterMinutes > 30) errors.push("macro_event_entry_blackout.afterMinutes must be between 5 and 30");
        break;
      }
    }
  }
  // Cross-field rules (#83 acceptance criteria).
  if (!(params.dte_min < params.dte_max)) errors.push("dte_min must be less than dte_max");
  if (!(params.short_delta_min < params.short_delta_max)) errors.push("short_delta_min must be less than short_delta_max");
  if (!(params.min_credit_pct_of_width < params.max_credit_pct_of_width)) errors.push("min_credit_pct_of_width must be less than max_credit_pct_of_width");
  const lastEntry = minutes(params.last_entry_time);
  const timeExit = minutes(params.time_exit);
  // The spec's own defaults are equal (15:30 / 15:30), so the rule is "not later
  // than": entries stop no later in the day than the planned time exit.
  if (lastEntry != null && timeExit != null && lastEntry > timeExit) errors.push("last_entry_time must not be later than time_exit");
  return errors.length ? { ok: false, errors } : { ok: true, parameters: params };
}

/** Order-independent canonical JSON (sorted keys at every depth). Hash it on the server. */
export function canonicalParameterJson(params: WeeklyIncomeParameters): string {
  const sort = (value: unknown): unknown => Array.isArray(value)
    ? value.map(sort)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value as object).sort().map((key) => [key, sort((value as Record<string, unknown>)[key])]))
      : value;
  return JSON.stringify(sort(params));
}

/** "0.75% · mandate v2 maxPlannedRiskPctPerPlay" for tighten-only rows. */
export function tightenOnlySource(key: WiParamKey, params: WeeklyIncomeParameters, mandate: WiMandateCeilings): string | null {
  const def = WI_PARAM_BY_KEY[key];
  if (!def?.mandateKey) return null;
  return `${formatParamValue(def, (params as Record<string, unknown>)[key])} · mandate ${mandate.version} ${def.mandateKey} (ceiling ${formatParamValue(def, mandate[def.mandateKey])})`;
}

const DAY_LABEL: Record<EntryDay, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday" };
const clock = (hhmm: string) => {
  const m = minutes(hhmm) ?? 0;
  const h = Math.floor(m / 60);
  return `${h > 12 ? h - 12 : h}:${String(m % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"} ET`;
};

/**
 * Quick Play: the rules in plain English, one line per group, computed from
 * the actual parameter values (so an edited plan reads correctly).
 */
export function plainRuleSummary(p: WeeklyIncomeParameters): Array<{ group: WiGroup; text: string }> {
  const days = p.entry_days.map((day) => DAY_LABEL[day as EntryDay]);
  const dayText = days.length > 1 ? `${days.slice(0, -1).join(", ")} or ${days[days.length - 1]}` : days[0];
  return [
    { group: "Universe", text: `Only large, heavily traded US stocks and funds (at least $${p.min_avg_dollar_volume / 1_000_000}M traded a day) priced over $${p.min_underlying_price}, with weekly options. At most ${p.max_candidates_per_week} ideas a week.` },
    { group: "Contract filters", text: `Only official real-time prices no older than ${p.max_quote_age_seconds} seconds, a narrow gap between buyers and sellers, and contracts many people already hold.` },
    { group: "Structure", text: `The promise price has roughly a ${Math.round(p.short_delta_min * 100)}–${Math.round(p.short_delta_max * 100)}% market-implied chance of being reached, ${p.dte_min} to ${p.dte_max} days out, and the trade pays ${p.min_credit_pct_of_width}–${p.max_credit_pct_of_width}% of the gap to the floor.` },
    { group: "Events & session", text: `Skip any stock that reports earnings before the trade would end. New trades open ${dayText}, not in the first ${p.opening_no_trade_minutes} minutes and not after ${clock(p.last_entry_time)}.` },
    { group: "Sizing", text: `Each trade can lose at most ${p.max_loss_per_position_pct}% of your practice balance; all open trades together at most ${p.max_open_loss_pct}%. After a ${p.weekly_loss_limit_pct}% loss in a week, no new trades until Monday.` },
    { group: "Management", text: `Close early at ${p.take_profit_pct_of_credit}% of the payment kept, at a loss of about ${Number((p.stop_multiple_of_credit - 1).toFixed(2))}× the payment, or ${p.close_sessions_before_expiry === 1 ? "the day" : `${p.close_sessions_before_expiry} trading days`} before expiration at ${clock(p.time_exit)}. No rolling.` },
    { group: "Scorecard", text: "Every week is measured as what was collected against what was at risk, using your measured account value." },
  ];
}

/** The thesis statement (§0.1) and detail (§0.2) prefilled into the New-thesis form. Editable. */
export const WEEKLY_INCOME_THESIS_PREFILL = {
  name: WEEKLY_INCOME_TEMPLATE_LABEL,
  statement: "I am testing a paper-only weekly premium-selling thesis. I sell short-dated, defined-risk option premium on liquid US stocks and ETFs I would be willing to own, one expiration week at a time, and I measure what it collects against what it puts at risk. An entry needs a current OPRA quote, real open interest and a tight bid/ask, a short strike between 0.15 and 0.30 delta, 4 to 10 days to expiration, and no earnings or ex-dividend date inside the window. Every position states its maximum loss before it is proposed, and fits the account mandate. Every position is closed early: at half the credit, at a loss about equal to the credit, or the session before expiration. This thesis does not target a return. A week with no qualifying setup is a valid result.",
  details: {
    belief: "Short-dated option premium on liquid names is often priced above the moves that follow, but the gap is small and losses arrive in clusters. A rules-based, defined-risk, size-capped approach may collect it with bounded weekly losses. This is a hypothesis to measure, not an assumption.",
    evidence: "Cboe One-Week PutWrite research reports an average weekly at-the-money S&P 500 put premium of 0.71% of notional (2006-2018) and notes net returns can be negative. Each candidate needs an OPRA quote under 60 seconds old, open interest, bid/ask width and delta from the broker snapshot.",
    seeks: "Put credit spreads only in this version. Liquid US stocks and ETFs, 4-10 days to expiration, short strike 0.15-0.30 delta.",
    avoids: "Earnings or ex-dividend dates inside the window, same-day or next-day expirations, uncovered short calls, positions without a stated maximum loss, indicative quotes, wide or stale quotes, averaging down, and rolling to avoid booking a loss.",
    horizon: "One expiration week per position (4-10 calendar days), closed the session before expiration.",
    holdingPeriod: "swing" as const,
    invalidation: "Pause new entries when the week's loss reaches the weekly limit, after two losing weeks in a row net of costs, when any position loses more than its stated maximum, or when quotes are stale or not OPRA.",
    risk: "Maximum loss per position no more than 0.75% of measured account equity; all open maximum losses no more than 3% of equity; new planned loss no more than 2% per day; weekly loss limit 2% of equity; whole contracts; paper only.",
    symbols: "",
    researchUniverse: "Liquid US large-cap stocks and broad ETFs with listed weekly options, at least $100M average daily dollar volume, that I would be willing to hold as shares.",
    instrument: "options" as const,
  },
};

/** What is stored in compiledFilters.strategyTemplate until #9's parameter-set table lands. */
export type StoredWeeklyIncomeTemplate = {
  id: typeof WEEKLY_INCOME_TEMPLATE_ID;
  version: typeof WEEKLY_INCOME_TEMPLATE_VERSION;
  parameters: WeeklyIncomeParameters;
  parameterHash: string;
  mandateVersion: string;
  /** Ceilings at save time, so tighten-only rows can show their source later. */
  mandateCeilings: WiMandateCeilings;
  /** Always "halted": parameters never lift the halt or enable routing. */
  strategyState: "halted";
  /** Interim storage note; #9 moves parameters to aperture_strategy_parameter_sets. */
  storage: "thesis_compilation_immutable";
};

export function readStoredWeeklyIncomeTemplate(compiledFilters: unknown): StoredWeeklyIncomeTemplate | null {
  const template = (compiledFilters as Record<string, any> | null)?.strategyTemplate;
  return template && template.id === WEEKLY_INCOME_TEMPLATE_ID && template.parameters ? template as StoredWeeklyIncomeTemplate : null;
}
