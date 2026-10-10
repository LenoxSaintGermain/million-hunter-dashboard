import { describe, expect, it } from "vitest";
import { CURRENT_MANDATE } from "./mandate";
import { buildStoredWeeklyIncomeTemplate, hashWeeklyIncomeParameters, mandateCeilings } from "./weeklyIncomeParameters";
import {
  WEEKLY_INCOME_PARAMETERS,
  WEEKLY_INCOME_TEMPLATE_ID,
  WEEKLY_INCOME_THESIS_PREFILL,
  isLegacyStructuresDefault,
  migrateLegacyStructuresDefault,
  readStoredWeeklyIncomeTemplate,
  plainRuleSummary,
  tightenOnlySource,
  validateWeeklyIncomeParameters,
  weeklyIncomeDefaults,
} from "../../shared/strategyTemplates/weeklyIncome";
import { passesWeeklyIncomeLanguage } from "../../shared/weeklyIncome/copy";

const ceilings = mandateCeilings(CURRENT_MANDATE);
const errorsFor = (overrides: Record<string, unknown>) => {
  const result = validateWeeklyIncomeParameters(overrides, ceilings);
  return result.ok ? [] : result.errors;
};

describe("Weekly Income parameters (#83)", () => {
  it("defines all 52 thesis §10 parameters exactly once", () => {
    const keys = WEEKLY_INCOME_PARAMETERS.map((def) => def.key);
    expect(keys).toHaveLength(52);
    expect(new Set(keys).size).toBe(52);
  });

  it("round-trips the §10 defaults exactly", () => {
    const result = validateWeeklyIncomeParameters({}, ceilings);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parameters).toEqual(weeklyIncomeDefaults());
    expect(result.parameters).toMatchObject({
      structures_enabled: ["P1"], min_avg_dollar_volume: 100_000_000, short_delta_min: 0.15, short_delta_max: 0.3,
      dte_min: 4, dte_max: 10, spread_width_tiers: { under50: 1, from50to150: 2.5, above150: 5 },
      min_credit_pct_of_width: 15, max_credit_pct_of_width: 40, entry_days: ["mon", "tue", "wed"], last_entry_time: "15:30",
      max_loss_per_position_pct: 0.75, max_open_loss_pct: 3, max_daily_new_loss_pct: 2, weekly_loss_limit_pct: 2,
      take_profit_pct_of_credit: 50, stop_multiple_of_credit: 2, time_exit: "15:30", rolls_allowed: false, accept_assignment_csp: false,
      direction: "neutral_to_bullish", account_equity_usd: "measured",
    });
  });

  it("accepts every numeric range at its edge and refuses it just beyond, naming the range", () => {
    for (const def of WEEKLY_INCOME_PARAMETERS) {
      if (def.kind !== "number" || "locked" in def) continue;
      const step = def.decimals === 0 ? 1 : 10 ** -def.decimals;
      for (const edge of [def.min, def.max]) {
        // Mandate-linked rows can't exceed the mandate even inside their range.
        const tighten = "mandateKey" in def && def.mandateKey !== "minAdvUsd30d" && edge > ceilings[def.mandateKey];
        if (!tighten) expect(errorsFor(cross(def.key, edge)), `${def.key}=${edge}`).toEqual([]);
      }
      expect(errorsFor(cross(def.key, def.max + step)).join(" "), def.key).toMatch(new RegExp(`${def.key} must be between`));
      expect(errorsFor(cross(def.key, def.min - step)).join(" "), def.key).toMatch(new RegExp(`${def.key} must be between`));
    }
    expect(errorsFor({ short_delta_max: 0.45 })).toEqual(["short_delta_max must be between 0.20 and 0.40"]);
  });

  it("enforces the cross-field rules", () => {
    expect(errorsFor({ dte_min: 7, dte_max: 7 })).toContain("dte_min must be less than dte_max");
    expect(errorsFor({ short_delta_min: 0.25, short_delta_max: 0.2 })).toContain("short_delta_min must be less than short_delta_max");
    expect(errorsFor({ min_credit_pct_of_width: 25, max_credit_pct_of_width: 30 })).toEqual([]);
    expect(errorsFor({ last_entry_time: "15:40", time_exit: "15:35" })).toContain("last_entry_time must not be later than time_exit");
    expect(errorsFor({ last_entry_time: "15:30", time_exit: "15:30" })).toEqual([]);
  });

  it("tighten-only rows show their source and refuse anything looser than the mandate", () => {
    const params = weeklyIncomeDefaults();
    expect(tightenOnlySource("max_loss_per_position_pct", params, ceilings)).toBe("0.75% · mandate v2 maxPlannedRiskPctPerPlay (ceiling 0.75%)");
    expect(errorsFor({ max_loss_per_position_pct: 0.5 })).toEqual([]);
    const looser = validateWeeklyIncomeParameters({ weekly_loss_limit_pct: 3 }, { ...ceilings, maxWeeklyPlannedRiskPct: 2.5 });
    expect(looser.ok ? [] : looser.errors).toEqual(["weekly_loss_limit_pct can only tighten the mandate: 3% is looser than mandate v2 maxWeeklyPlannedRiskPct (2.5%)."]);
    // The template's mandate-linked defaults equal the live mandate.
    expect(params.max_loss_per_position_pct).toBe(CURRENT_MANDATE.maxPlannedRiskPctPerPlay);
    expect(params.max_open_loss_pct).toBe(CURRENT_MANDATE.maxAggregateOpenRiskPct);
    expect(params.max_daily_new_loss_pct).toBe(CURRENT_MANDATE.maxDailyPlannedRiskPct);
    expect(params.max_correlated_loss_pct).toBe(CURRENT_MANDATE.maxCorrelatedPlannedRiskPct);
    expect(params.min_avg_dollar_volume).toBeGreaterThanOrEqual(CURRENT_MANDATE.minAdvUsd30d);
  });

  it("locks rolls, assignment and direction in v0.1, and keeps P2 off until O1", () => {
    expect(errorsFor({ rolls_allowed: true })).toEqual(["rolls_allowed is locked: Deferred to v0.2 (owner decision)."]);
    expect(errorsFor({ accept_assignment_csp: true })).toEqual(["accept_assignment_csp is locked: Deferred to v0.2 (owner decision)."]);
    expect(errorsFor({ direction: "bearish" })[0]).toMatch(/^direction is locked/);
    expect(errorsFor({ structures_enabled: ["P1", "P2"] })).toEqual(["structures_enabled cannot include P2 (cash-secured put) until owner decision O1 is recorded"]);
    expect(validateWeeklyIncomeParameters({ structures_enabled: ["P1", "P2"] }, ceilings, { o1Recorded: true }).ok).toBe(true);
  });

  it("refuses unknown keys and wrong types", () => {
    expect(errorsFor({ halt_lifted: true })[0]).toMatch(/Unknown parameter: halt_lifted/);
    expect(errorsFor({ dte_min: "4" })[0]).toMatch(/^dte_min:/);
  });

  it("freezes a halted template with an order-independent hash", () => {
    const a = buildStoredWeeklyIncomeTemplate({ dte_min: 5, take_profit_pct_of_credit: 40 });
    const b = buildStoredWeeklyIncomeTemplate({ take_profit_pct_of_credit: 40, dte_min: 5 });
    if (!a.ok || !b.ok) throw new Error("expected valid");
    expect(a.template.parameterHash).toBe(b.template.parameterHash);
    expect(a.template.parameterHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(a.template.parameterHash).not.toBe(hashWeeklyIncomeParameters(weeklyIncomeDefaults()));
    expect(a.template).toMatchObject({ id: "capital_weekly_income", version: "0.1", strategyState: "halted", mandateVersion: "v2" });
  });

  it("explains the rules in plain English from the actual values", () => {
    const rows = plainRuleSummary(weeklyIncomeDefaults());
    expect(rows.map((row) => row.group)).toEqual(["Universe", "Contract filters", "Structure", "Events & session", "Sizing", "Management", "Scorecard"]);
    expect(rows.find((row) => row.group === "Sizing")?.text).toContain("at most 0.75% of your practice balance");
    expect(rows.find((row) => row.group === "Events & session")?.text).toContain("Monday, Tuesday or Wednesday");
    expect(rows.find((row) => row.group === "Management")?.text).toContain("3:30 PM ET");
    for (const row of rows) expect(passesWeeklyIncomeLanguage(row.text), row.text).toBe(true);
    for (const def of WEEKLY_INCOME_PARAMETERS) expect(passesWeeklyIncomeLanguage(def.plain), def.key).toBe(true);
  });

  it("prefills a statement and detail block under the 4,000-character limit", () => {
    const { statement, details } = WEEKLY_INCOME_THESIS_PREFILL;
    const block = [details.belief, details.evidence, details.seeks, details.avoids, details.horizon, details.invalidation, details.risk, details.researchUniverse].join("\n");
    expect(statement.length + block.length + 200).toBeLessThan(4_000);
    expect(passesWeeklyIncomeLanguage(statement)).toBe(true);
  });
});

/** Keep cross-field partners consistent when probing one parameter's edge. */
function cross(key: string, value: number): Record<string, unknown> {
  const out: Record<string, unknown> = { [key]: Number(value.toFixed(6)) };
  if (key === "dte_min" && value >= 10) out.dte_max = 14;
  if (key === "dte_max" && value <= 4) out.dte_min = 2;
  if (key === "short_delta_min" && value >= 0.3) out.short_delta_max = 0.4;
  if (key === "short_delta_max" && value <= 0.15) out.short_delta_min = 0.05;
  return out;
}

describe("structures_enabled default: put credit spreads only (Refs #83)", () => {
  it("defaults to P1 only and says so in the help text", () => {
    expect(weeklyIncomeDefaults().structures_enabled).toEqual(["P1"]);
    const def = WEEKLY_INCOME_PARAMETERS.find((d) => d.key === "structures_enabled")!;
    expect(def.plain).toMatch(/put credit spreads only/i);
    expect(def.plain).toMatch(/covered calls and cash-secured puts are off/i);
  });

  it("stays tighten-only: P3 can't be added, P2 still needs O1", () => {
    expect(errorsFor({ structures_enabled: ["P1", "P3"] })).toEqual(["structures_enabled cannot include P3 (covered call): the default is put credit spreads only, and a thesis can only narrow it"]);
    expect(errorsFor({ structures_enabled: ["P3"] })).toHaveLength(1);
    expect(errorsFor({ structures_enabled: ["P1"] })).toEqual([]);
    expect(errorsFor({ structures_enabled: [] })).toEqual(["structures_enabled must include at least one structure"]);
    expect(validateWeeklyIncomeParameters({ structures_enabled: ["P1", "P2"] }, ceilings, { o1Recorded: true }).ok).toBe(true);
  });

  it("migrates only the exact old default when a saved thesis is re-saved", () => {
    const saved = { ...weeklyIncomeDefaults(), structures_enabled: ["P1", "P3"] };
    const frozen = JSON.stringify(saved);
    const out = migrateLegacyStructuresDefault(saved);
    expect(out.migrated).toBe(true);
    expect(out.overrides.structures_enabled).toEqual(["P1"]);
    expect(JSON.stringify(saved)).toBe(frozen); // stored value not mutated
    expect(migrateLegacyStructuresDefault({ structures_enabled: ["P3", "P1"] }).migrated).toBe(true);
    for (const other of [["P1"], ["P3"], ["P1", "P2"], ["P1", "P2", "P3"]]) {
      expect(migrateLegacyStructuresDefault({ structures_enabled: other }).migrated, other.join(",")).toBe(false);
    }
    expect(migrateLegacyStructuresDefault({}).migrated).toBe(false);
  });

  it("re-saving an old thesis with the old default succeeds as P1 only; other P3 lists are refused, not rewritten", () => {
    const old = buildStoredWeeklyIncomeTemplate({ ...weeklyIncomeDefaults(), structures_enabled: ["P1", "P3"] });
    expect(old.ok).toBe(true);
    if (old.ok) expect(old.template.parameters.structures_enabled).toEqual(["P1"]);
    const custom = buildStoredWeeklyIncomeTemplate({ structures_enabled: ["P3"] });
    expect(custom.ok).toBe(false);
  });

  it("reads stored rows with the old default as-is", () => {
    const stored = { strategyTemplate: { id: WEEKLY_INCOME_TEMPLATE_ID, parameters: { ...weeklyIncomeDefaults(), structures_enabled: ["P1", "P3"] } } };
    expect(readStoredWeeklyIncomeTemplate(stored)?.parameters.structures_enabled).toEqual(["P1", "P3"]);
    expect(isLegacyStructuresDefault(["P1", "P3"])).toBe(true);
  });
});
