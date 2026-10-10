/**
 * Server authority for Weekly Income parameters (#83). Validates overrides
 * against the template ranges and the current mandate, then freezes the result
 * with an order-independent hash. Interim storage: the immutable thesis
 * compilation row (compiledFilters.strategyTemplate) until #9 adds
 * aperture_strategy_parameter_sets.
 */
import { createHash } from "node:crypto";
import { CURRENT_MANDATE, type Mandate } from "./mandate";
import {
  WEEKLY_INCOME_TEMPLATE_ID,
  WEEKLY_INCOME_TEMPLATE_VERSION,
  canonicalParameterJson,
  migrateLegacyStructuresDefault,
  validateWeeklyIncomeParameters,
  type StoredWeeklyIncomeTemplate,
  type WeeklyIncomeParameters,
  type WiMandateCeilings,
} from "../../shared/strategyTemplates/weeklyIncome";

export function mandateCeilings(mandate: Mandate = CURRENT_MANDATE): WiMandateCeilings {
  return {
    version: mandate.version,
    maxPlannedRiskPctPerPlay: mandate.maxPlannedRiskPctPerPlay,
    maxAggregateOpenRiskPct: mandate.maxAggregateOpenRiskPct,
    maxDailyPlannedRiskPct: mandate.maxDailyPlannedRiskPct,
    maxCorrelatedPlannedRiskPct: mandate.maxCorrelatedPlannedRiskPct,
    maxWeeklyPlannedRiskPct: mandate.maxWeeklyPlannedRiskPct,
    minAdvUsd30d: mandate.minAdvUsd30d,
  };
}

export function hashWeeklyIncomeParameters(parameters: WeeklyIncomeParameters): string {
  return `sha256:${createHash("sha256").update(canonicalParameterJson(parameters)).digest("hex")}`;
}

export type WeeklyIncomeBuildResult = { ok: true; template: StoredWeeklyIncomeTemplate } | { ok: false; errors: string[] };

export function buildStoredWeeklyIncomeTemplate(overrides: unknown, mandate: Mandate = CURRENT_MANDATE): WeeklyIncomeBuildResult {
  // No owner decision store exists yet, so O1 is never recorded: P2 stays off.
  const ceilings = mandateCeilings(mandate);
  // A saved thesis re-saved as a new version sends its stored parameters back.
  // Only the exact old structures default is mapped to the new one; existing
  // rows are immutable and are not touched.
  const { overrides: input } = migrateLegacyStructuresDefault(overrides);
  const result = validateWeeklyIncomeParameters(input, ceilings, { o1Recorded: false });
  if (!result.ok) return result;
  return {
    ok: true,
    template: {
      id: WEEKLY_INCOME_TEMPLATE_ID,
      version: WEEKLY_INCOME_TEMPLATE_VERSION,
      parameters: result.parameters,
      parameterHash: hashWeeklyIncomeParameters(result.parameters),
      mandateVersion: mandate.version,
      mandateCeilings: ceilings,
      strategyState: "halted",
      storage: "thesis_compilation_immutable",
    },
  };
}
