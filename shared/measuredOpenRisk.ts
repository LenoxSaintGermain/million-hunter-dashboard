export type MeasuredOpenRiskSum =
  | { ok: true; totalCents: number }
  | { ok: false; reason: "unmeasured_or_invalid_risk" | "unsafe_total" };

/** No partial total: one unknown exposure invalidates the measured risk sum. */
export function sumMeasuredOpenRiskCents(rows: readonly { plannedRiskCents: unknown }[]): MeasuredOpenRiskSum {
  let totalCents = 0;
  for (const row of rows) {
    const cents = row.plannedRiskCents;
    if (typeof cents !== "number" || !Number.isSafeInteger(cents) || cents < 0) {
      return { ok: false, reason: "unmeasured_or_invalid_risk" };
    }
    if (cents > Number.MAX_SAFE_INTEGER - totalCents) return { ok: false, reason: "unsafe_total" };
    totalCents += cents;
  }
  return { ok: true, totalCents };
}
