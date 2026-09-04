export type EffectiveRiskLimit = {
  effectiveLimitCents: number | null;
  controllingLimit: "operator" | "account_mandate" | "unknown";
};

/**
 * A mission may tighten the account mandate, but it can never loosen it.
 * Keep this decision explicit so the UI does not mislabel two competing caps
 * as utilization or imply that adding mission capital raises the mandate.
 */
export function resolveEffectiveRiskLimit(
  operatorCapCents: number | null | undefined,
  accountMandateCents: number | null | undefined,
): EffectiveRiskLimit {
  if (operatorCapCents == null || operatorCapCents <= 0 || accountMandateCents == null || accountMandateCents <= 0) {
    return { effectiveLimitCents: null, controllingLimit: "unknown" };
  }
  if (operatorCapCents <= accountMandateCents) {
    return { effectiveLimitCents: operatorCapCents, controllingLimit: "operator" };
  }
  return { effectiveLimitCents: accountMandateCents, controllingLimit: "account_mandate" };
}

/** Convert an authoritative absolute mission limit into the percentage form
 * consumed by the existing order gate. Missing authority keeps the account
 * mandate unchanged; a mission can only make the result smaller. */
export function resolveEffectiveRiskCeilingPct(
  accountMandatePct: number,
  equityCents: number | null | undefined,
  missionLimitCents: number | null | undefined,
): number {
  if (equityCents == null || equityCents <= 0 || missionLimitCents == null || missionLimitCents <= 0) {
    return accountMandatePct;
  }
  return Math.min(accountMandatePct, (missionLimitCents / equityCents) * 100);
}
