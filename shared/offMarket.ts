/**
 * Off-market sourcing from public records.
 *
 * The strategic point: sourcing from listing sites means competing for the same
 * inventory a CoStar seat already shows. The alpha is in buildings that are not
 * for sale — findable because distress and ownership are public record:
 * delinquent-tax rolls, vacant-building registries, land-bank inventories, code
 * enforcement, and National Register nominations.
 *
 * This is a SECOND AXIS, deliberately kept apart from the thesis score:
 *   thesis score      — is this the right building?
 *   motivation score  — is this owner likely to sell?
 * A building can be perfect and unavailable, or available and wrong. Collapsing
 * the two into one number would hide exactly the distinction that makes an
 * off-market approach worth making.
 */

export type PublicRecordSource =
  | "delinquent_tax"
  | "vacant_registry"
  | "land_bank"
  | "code_enforcement"
  | "foreclosure"
  | "nrhp_nomination"
  | "preservation_watch"
  | "estate_probate";

export const RECORD_SOURCE_LABELS: Record<PublicRecordSource, string> = {
  delinquent_tax: "Delinquent tax roll",
  vacant_registry: "Vacant / abandoned registry",
  land_bank: "Land bank inventory",
  code_enforcement: "Code enforcement",
  foreclosure: "Foreclosure filing",
  nrhp_nomination: "National Register nomination",
  preservation_watch: "Preservation most-endangered list",
  estate_probate: "Estate / probate",
};

export interface OffMarketSignals {
  /** Which public records this building turned up in. */
  sources?: PublicRecordSource[];
  taxDelinquentYears?: number | null;
  taxDelinquentAmount?: number | null;
  onVacantRegistry?: boolean | null;
  landBankOwned?: boolean | null;
  openCodeViolations?: number | null;
  foreclosureFiled?: boolean | null;
  ownerOutOfState?: boolean | null;
  ownerIsEstateOrTrust?: boolean | null;
  yearsSinceLastSale?: number | null;
  condemnedOrDemolitionList?: boolean | null;
  /** Named on a preservation "most endangered" / watch list — a real distress
   *  signal in its own right, and the one channel that is reliably enumerable. */
  onPreservationWatchList?: boolean | null;
  /** Publicly reported as vacant or long-underused, without a formal registry. */
  reportedVacantOrUnderused?: boolean | null;
  /** Free text, always sourced. */
  notes?: string | null;
  /** Where each claim came from. */
  citations?: string[];
}

export interface MotivationFactor {
  label: string;
  points: number;
  max: number;
  present: boolean;
}

export interface MotivationResult {
  score: number;              // 0–100
  band: "cold" | "warm" | "hot" | "distressed";
  factors: MotivationFactor[];
  /** The single most useful sentence for an outreach letter. */
  headline: string;
}

/**
 * How likely is this owner to entertain an offer?
 *
 * Weights favour carrying cost and legal pressure over mere absence: an
 * out-of-state owner is a weak signal on its own, but an out-of-state owner
 * three years delinquent on taxes is a conversation.
 */
export function computeMotivation(s: OffMarketSignals | null | undefined): MotivationResult {
  const sig = s ?? {};
  const f: MotivationFactor[] = [];

  const add = (label: string, present: boolean, points: number, max: number) =>
    f.push({ label, present, points: present ? points : 0, max });

  const delinqYears = sig.taxDelinquentYears ?? 0;
  const delinqPoints = delinqYears >= 3 ? 30 : delinqYears === 2 ? 22 : delinqYears === 1 ? 12 : 0;
  f.push({
    label: delinqYears ? `Tax delinquent ${delinqYears} year${delinqYears === 1 ? "" : "s"}` : "Tax delinquent",
    present: delinqYears > 0, points: delinqPoints, max: 30,
  });

  add("Foreclosure filed", !!sig.foreclosureFiled, 20, 20);
  add("On vacant / abandoned registry", !!sig.onVacantRegistry, 15, 15);
  add("Land bank owned (motivated by mandate)", !!sig.landBankOwned, 15, 15);

  const viol = sig.openCodeViolations ?? 0;
  f.push({
    label: viol ? `${viol} open code violation${viol === 1 ? "" : "s"}` : "Open code violations",
    present: viol > 0, points: viol >= 3 ? 12 : viol > 0 ? 7 : 0, max: 12,
  });

  add("On a preservation most-endangered list", !!sig.onPreservationWatchList, 14, 14);
  add("Reported vacant or long underused", !!sig.reportedVacantOrUnderused, 10, 10);
  add("Owner is an estate or trust", !!sig.ownerIsEstateOrTrust, 10, 10);
  add("Owner out of state", !!sig.ownerOutOfState, 6, 6);

  const held = sig.yearsSinceLastSale ?? 0;
  f.push({
    label: held ? `Held ${held} years` : "Long hold",
    present: held >= 15, points: held >= 25 ? 8 : held >= 15 ? 5 : 0, max: 8,
  });

  add("On condemnation / demolition list", !!sig.condemnedOrDemolitionList, 10, 10);

  const score = Math.min(100, f.reduce((n, x) => n + x.points, 0));
  const band: MotivationResult["band"] =
    score >= 70 ? "distressed" : score >= 45 ? "hot" : score >= 22 ? "warm" : "cold";

  // Lead with whatever is actually driving the score.
  const top = [...f].filter((x) => x.present).sort((a, b) => b.points - a.points)[0];
  const headline = !top
    ? "No public distress or ownership signals found — treat as a cold approach."
    : band === "distressed"
      ? `Carrying cost is real: ${top.label.toLowerCase()}. This owner has a reason to talk.`
      : band === "hot"
        ? `${top.label} — worth a direct approach.`
        : `${top.label} — a soft touch, not a hard offer.`;

  return { score, band, factors: f, headline };
}

export const MOTIVATION_BAND_LABEL: Record<MotivationResult["band"], string> = {
  distressed: "Distressed",
  hot: "Motivated",
  warm: "Worth a letter",
  cold: "Cold",
};
