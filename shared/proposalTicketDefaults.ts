/**
 * Defaults for the execute-screen ticket (#111).
 *
 * A run whose catalyst deadline has passed never seeds a past time: both
 * fields start blank and the screen says why. The close-review time is its
 * own default (a few hours out), never a copy of the catalyst deadline.
 */
export const CLOSE_REVIEW_DEFAULT_MS = 6 * 3_600_000;
export const CATALYST_DEFAULT_MS = 7 * 86_400_000;

export type TicketTimeDefaults = {
  deadlineAt: number | null;
  timeStopAt: number | null;
  /** The run recorded a catalyst deadline and it is already past. */
  catalystPassed: boolean;
};

export function ticketTimeDefaults(runCatalystDeadlineAt: number | null | undefined, now: number): TicketTimeDefaults {
  const recorded = runCatalystDeadlineAt != null && Number.isFinite(runCatalystDeadlineAt) ? runCatalystDeadlineAt : null;
  if (recorded != null && recorded <= now) return { deadlineAt: null, timeStopAt: null, catalystPassed: true };
  const deadlineAt = recorded ?? now + CATALYST_DEFAULT_MS;
  const review = now + CLOSE_REVIEW_DEFAULT_MS;
  return { deadlineAt, timeStopAt: review < deadlineAt ? review : null, catalystPassed: false };
}

type Level = { priceCents: number } | null | undefined;
export type RecipeLike = {
  readiness?: string | null;
  entry?: Level; stop?: Level;
  qty?: number | null; plannedLossCents?: number | null; notionalCents?: number | null;
  targets?: ReadonlyArray<{ rMultiple: number | string; priceCents: number }> | null;
} | null | undefined;

/**
 * One source for the summary: the form's own values, and the recipe's
 * modeled levels only when the recipe is ready to prepare. A not-ready
 * recipe's levels come back separately as reference levels, so the screen can
 * label them and never show them as the plan.
 */
export function sharePlanSummary(input: { recipe: RecipeLike; recipeReady: boolean; formEntryCents: number | null; formStopCents: number | null }) {
  const ready = input.recipeReady ? input.recipe : null;
  const reference = !input.recipeReady && input.recipe && (input.recipe.entry || input.recipe.stop)
    ? { entryCents: input.recipe.entry?.priceCents ?? null, stopCents: input.recipe.stop?.priceCents ?? null }
    : null;
  return {
    entryCents: input.formEntryCents ?? ready?.entry?.priceCents ?? null,
    stopCents: input.formStopCents ?? ready?.stop?.priceCents ?? null,
    qty: ready?.qty ?? null,
    plannedLossCents: ready?.plannedLossCents ?? null,
    notionalCents: ready?.notionalCents ?? null,
    targets: (ready?.targets ?? []).map((t) => ({ label: `${t.rMultiple}R`, priceCents: t.priceCents })),
    reference,
  };
}
