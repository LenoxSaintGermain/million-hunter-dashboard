/**
 * The RETURN half of TSL-BUILD-2026-009.
 *
 * Every figure here is arithmetic over modeled terms the constructor already
 * recorded — quantity, entry, stop, target. Nothing is forecast, weighted or
 * scored. A missing term yields "not measured" rather than a zero or an
 * average, because an unmeasurable loss is not a small one.
 */

export type PlayReturnInput = {
  quantity: number | null | undefined;
  entryCents: number | null | undefined;
  stopCents: number | null | undefined;
  /** Contract multiplier; 1 for shares, 100 for a standard option. */
  multiplier?: number;
  targets?: Array<{ label: string; priceCents: number | null | undefined }>;
};

export type PlayOutcome = {
  label: string;
  profitCents: number;
  roiPct: number;
  rMultiple: number | null;
};

export type PlayReturn =
  | { measured: false; missing: string[] }
  | {
      measured: true;
      deployedCents: number;
      plannedDownsideCents: number;
      downsideRoiPct: number;
      outcomes: PlayOutcome[];
      /** Required disclosure; no caller may substitute its own wording. */
      disclosure: string;
    };

export const PLAY_RETURN_DISCLOSURE =
  "Modeled price targets, not a forecast. No probability is assigned.";

const positive = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

export function buildPlayReturn(input: PlayReturnInput): PlayReturn {
  const multiplier = input.multiplier && input.multiplier > 0 ? input.multiplier : 1;
  const missing: string[] = [];
  if (!positive(input.quantity)) missing.push("quantity");
  if (!positive(input.entryCents)) missing.push("entry price");
  if (!positive(input.stopCents)) missing.push("stop price");
  if (missing.length) return { measured: false, missing };

  const qty = input.quantity as number;
  const entry = input.entryCents as number;
  const stop = input.stopCents as number;
  // A stop at or above entry cannot express downside for a long play. Refuse
  // rather than rendering a negative or zero risk as if it were measured.
  if (stop >= entry) return { measured: false, missing: ["a stop below the entry price"] };

  const unit = qty * multiplier;
  const deployedCents = Math.round(entry * unit);
  const riskPerUnit = entry - stop;
  const plannedDownsideCents = Math.round(riskPerUnit * unit);

  const outcomes: PlayOutcome[] = [];
  for (const target of input.targets ?? []) {
    if (!positive(target.priceCents)) continue;
    const price = target.priceCents as number;
    if (price <= entry) continue; // not an upside level for a long play
    const profitCents = Math.round((price - entry) * unit);
    outcomes.push({
      label: target.label,
      profitCents,
      roiPct: (profitCents / deployedCents) * 100,
      rMultiple: riskPerUnit > 0 ? (price - entry) / riskPerUnit : null,
    });
  }

  return {
    measured: true,
    deployedCents,
    plannedDownsideCents,
    downsideRoiPct: -(plannedDownsideCents / deployedCents) * 100,
    outcomes: outcomes.sort((a, b) => a.profitCents - b.profitCents),
    disclosure: PLAY_RETURN_DISCLOSURE,
  };
}
