/**
 * Tutorial asset + glossary.
 *
 * One record in the pipeline is a worked example rather than a real listing. It
 * carries a full, maxed-out scorecard, so every module on the dossier has
 * something to show — which makes it the natural first-run walkthrough.
 *
 * The glossary here is the SINGLE source of truth for what each number means.
 * It powers two things:
 *   1. the small ⓘ tooltips available on every asset, and
 *   2. the expanded inline explanations shown on the tutorial asset,
 * so a definition can never drift between the two.
 *
 * Deleting the tutorial asset is a normal delete. Nothing re-creates it, and the
 * next-highest-ranked asset simply takes the top slot.
 */

/** A tutorial record is flagged by its source, so no schema column is needed. */
export const TUTORIAL_SOURCE = "demo-fixture";

export function isTutorialAsset(asset: { source?: string | null } | null | undefined): boolean {
  return !!asset && asset.source === TUTORIAL_SOURCE;
}

export interface GlossaryEntry {
  /** Short label used as the tooltip heading. */
  term: string;
  /** One or two sentences — what it is and how to read it. */
  what: string;
  /** How it is computed, when that matters. */
  how?: string;
  /** What a reader should DO with it. Shown in the expanded tutorial view. */
  soWhat?: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  rankScore: {
    term: "Rank Score",
    what: "The ordering number for the pipeline. It blends how well an asset scores with how much of that score we can actually stand behind.",
    how: "Composite × (0.5 + 0.5 × Confidence). A perfect asset we know nothing about cannot outrank a good asset we have verified.",
    soWhat: "Work top-down. A low rank driven by low confidence is a research task, not a rejection.",
  },
  compositeScore: {
    term: "Composite",
    what: "The raw quality of the asset against the thesis, out of 100, before any discount for missing information.",
    how: "Sum of the seven dimensions (A–G), plus alpha bonuses, minus penalties. Bonuses are capped at +8.",
    soWhat: "Compare composites to compare assets. Compare rank scores to decide what to work on next.",
  },
  confidenceScore: {
    term: "Confidence",
    what: "How much of the scorecard rests on verified fact rather than a conservative assumption.",
    how: "Weighted share of the five critical fields that have been verified. Anything unverified is scored conservatively, never optimistically.",
    soWhat: "Low confidence caps an asset below Tier 1 no matter how good it looks. Verify the listed fields to unlock the real tier.",
  },
  assetTier: {
    term: "Tier",
    what: "The disposition band an asset lands in once gates, composite, and confidence are all applied.",
    how: "Tier 1 requires passing both hard gates AND a high composite AND verified critical fields. Fast-Track flags time pressure.",
    soWhat: "Tier is the recommendation. Rank is the queue.",
  },
  marketTier: {
    term: "Market Tier",
    what: "The quality of the submarket the asset sits in — A, B, or C.",
    how: "Derived from vacancy, rent growth, adaptive-reuse comps, population growth, and anchor institutions.",
    soWhat: "A great building in a C market still has an exit problem.",
  },
  gates: {
    term: "Tier-1 Gates",
    what: "Two hard gates. Dimension A (historic qualification) and Dimension B (development envelope) must each clear 12 of 20.",
    how: "These are pass/fail, not weighted. Failing either caps the asset below Tier 1 regardless of the composite.",
    soWhat: "A gate failure is structural — it usually cannot be fixed with better research, only with a different building.",
  },
  penalties: {
    term: "Penalties",
    what: "Deductions for conditions that make a deal materially harder: structural risk, hostile entitlement, easements that block the plan.",
    soWhat: "Penalties tell you what would have to be negotiated away.",
  },
  bonuses: {
    term: "Alpha Bonuses",
    what: "Additions for rare advantages that don't fit the standard dimensions — stacked incentives, an anchor commitment, an off-market angle.",
    how: "Capped at +8 total so a single lucky factor can't carry a weak asset.",
  },
  verifyFields: {
    term: "Unverified Critical Fields",
    what: "The five facts that must be confirmed from source before an asset can be underwritten: year built, GSF and parcel, ownership and title, prior HTC syndication, and integrity.",
    soWhat: "This list is the actual next-actions queue for the asset.",
  },
  economics: {
    term: "Deal Economics",
    what: "The underwriting math — what it costs, what the incentives return, and what equity is left to raise.",
    how: "Modeled from the asset's own figures plus published cost bands and program rates. Every input is shown as an assumption.",
    soWhat: "This is a screening model, not underwriting. It tells you whether a deal is worth a real model.",
  },
  basisEst: {
    term: "EST",
    what: "This figure is modeled from an assumption, not taken from a verified source.",
    soWhat: "Never commit capital against an EST figure. The assumption is printed beneath it so you can challenge it.",
  },
  basisVerified: {
    term: "VERIFIED",
    what: "This figure came from a confirmed source rather than a model.",
  },
  equityGap: {
    term: "Equity Gap",
    what: "The share of total project cost still unfunded after debt and incentive equity.",
    soWhat: "The number you would actually have to raise. A high gap isn't fatal, but it changes who the deal is for.",
  },
  incentiveCoverage: {
    term: "Incentive Coverage",
    what: "How much of the rehab cost the stacked credits cover.",
    how: "Federal HTC plus state HTC equity, divided by estimated rehab. Excludes the present value of abatements, which is not yet modeled.",
    soWhat: "Below the target, the incentive stack isn't doing enough work to justify the complexity of a historic deal.",
  },
  provenance: {
    term: "Source & Verification",
    what: "Where this record came from and when we last checked it against the live web.",
    soWhat: "A stale or withdrawn listing is the most common way a pipeline quietly rots. Check the date before you spend time.",
  },
  diligence: {
    term: "Diligence Checklist",
    what: "The workstreams this asset class requires — incentives, envelope, environmental, title.",
    how: "Driven by the asset class registry, so a different thesis shows a different checklist automatically.",
  },
  stage: {
    term: "Stage",
    what: "Where the asset sits in the pipeline: new, reviewing, qualified, rejected, or acquired.",
    soWhat: "Property assets advance in place. This dossier is the deal record — there is no separate deal room entry.",
  },
};

/** Ordered walkthrough steps for the tutorial asset's guided tour. */
export const TUTORIAL_STEPS: { anchor: string; title: string; body: string }[] = [
  {
    anchor: "scores",
    title: "Start with three numbers",
    body: "Rank orders your queue, Composite measures quality, Confidence measures how much of that quality is verified. Rank already accounts for the other two — so read left to right and you have the whole picture.",
  },
  {
    anchor: "economics",
    title: "Then ask what you'd make",
    body: "Every figure marked EST is modeled, with its assumption printed underneath. Nothing here is verified underwriting — it exists to tell you whether an asset earns a real model.",
  },
  {
    anchor: "scorecard",
    title: "The scorecard shows the why",
    body: "Seven dimensions, A through G. A and B are hard gates: each must clear 12 of 20 or the asset is capped below Tier 1 no matter how strong the rest looks. Unknown inputs are scored conservatively and flagged, never guessed upward.",
  },
  {
    anchor: "diligence",
    title: "Diligence is class-specific",
    body: "The checklist comes from the asset class, so a different thesis shows a different set of workstreams without anyone editing this page.",
  },
  {
    anchor: "provenance",
    title: "Always check the source",
    body: "Every real asset carries a source link and a last-checked date. A stale listing is the most common way a pipeline quietly rots.",
  },
];
