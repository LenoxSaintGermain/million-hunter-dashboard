/**
 * Mandate risk fields are stored as percentage points: `0.75` means 0.75%, not
 * 75%. Keep this formatting in one place so rail copy cannot silently multiply
 * a human-entered percentage by 100.
 */
export function formatMandatePercentPoints(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "not measured";
  return `${value.toFixed(2)}%`;
}
