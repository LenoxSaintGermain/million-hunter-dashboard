/** WP-DIR1 contract. This module contains no market scoring, broker action, or execution logic. */
export const DISCLOSURE_MANDATE_V1 = {
  version: "DISCLOSURE_MANDATE_V1",
  maximumLagDays: 45,
  minimumDisclosedRangeFloorUsd: 15_001,
  maximumObservationsPerPlanDay: 25,
  allowedAssetTypes: ["equity", "etf"] as const,
  requiredResolutionGrade: "exact" as const,
} as const;

export type DisclosureControls = {
  maximumLagDays: number;
  minimumDisclosedRangeFloorUsd: number;
  maximumObservationsPerPlanDay: number;
  allowedAssetTypes: Array<(typeof DISCLOSURE_MANDATE_V1.allowedAssetTypes)[number]>;
};

export type DisclosurePlanV1 = {
  version: "DisclosurePlanV1";
  source: "house_clerk";
  filerCriteria: string | null;
  issuerCriteria: string | null;
  cadence: "daily" | "weekly" | null;
  controls: DisclosureControls;
  unresolved: string[];
  confidenceNotes: string[];
};

export type DisclosureTransactionInput = {
  sourceRowIdentity: string;
  ownerAsStated: "self" | "spouse" | "dependent" | "unknown";
  rawAssetName: string;
  transactionType: "purchase" | "sale" | "exchange" | "unknown";
  transactionDate: number | null;
  amountMinUsd: number | null;
  amountMaxUsd: number | null;
  assetType: string | null;
  resolutionGrade: "exact" | "strong" | "ambiguous" | "none";
  publicationAt: number | null;
  firstObservedAt: number;
};

export type DisclosureGateResult = {
  state: "held" | "reviewable" | "set_aside";
  reasons: string[];
  eligibleFrom: number | null;
  disclosureLagDays: number | null;
  effectiveControls: DisclosureControls;
};

const PROHIBITED_LANGUAGE = /\b(copy\s*congress|follow\s+smart\s+money|insider|conflict|congressional\s+alpha)\b/i;

export function compileDisclosureIntent(rawIntent: string): DisclosurePlanV1 {
  if (PROHIBITED_LANGUAGE.test(rawIntent)) {
    throw new Error("Prohibited disclosure-product language detected; describe a research and evidence workflow instead.");
  }
  const text = rawIntent.trim();
  const unresolved: string[] = [];
  const cadence = /\bdaily\b/i.test(text) ? "daily" : /\bweekly\b/i.test(text) ? "weekly" : null;
  if (!cadence) unresolved.push("Cadence is unresolved: choose daily or weekly before approval.");
  const filerCriteria = /\b(member|representative|house|filer|latta)\b/i.test(text) ? text : null;
  if (!filerCriteria) unresolved.push("Filer criteria are unresolved.");
  const issuerCriteria = /\b(issuer|equity|etf|sector|health|food|energy|technology)\b/i.test(text) ? text : null;
  if (!issuerCriteria) unresolved.push("Issuer or asset criteria are unresolved.");
  return {
    version: "DisclosurePlanV1",
    source: "house_clerk",
    filerCriteria,
    issuerCriteria,
    cadence,
    controls: { ...DISCLOSURE_MANDATE_V1, allowedAssetTypes: [...DISCLOSURE_MANDATE_V1.allowedAssetTypes] },
    unresolved,
    confidenceNotes: unresolved.length ? ["Approval is blocked until every listed ambiguity is resolved by the operator."] : [],
  };
}

export function tightenControls(overrides: Partial<DisclosureControls>): DisclosureControls {
  const allowed = overrides.allowedAssetTypes ?? [...DISCLOSURE_MANDATE_V1.allowedAssetTypes];
  if (overrides.maximumLagDays !== undefined && overrides.maximumLagDays > DISCLOSURE_MANDATE_V1.maximumLagDays) throw new Error("Plans may tighten, not loosen, the maximum disclosure lag.");
  if (overrides.minimumDisclosedRangeFloorUsd !== undefined && overrides.minimumDisclosedRangeFloorUsd < DISCLOSURE_MANDATE_V1.minimumDisclosedRangeFloorUsd) throw new Error("Plans may tighten, not loosen, the disclosed-range floor.");
  if (overrides.maximumObservationsPerPlanDay !== undefined && overrides.maximumObservationsPerPlanDay > DISCLOSURE_MANDATE_V1.maximumObservationsPerPlanDay) throw new Error("Plans may tighten, not loosen, the observation cap.");
  if (allowed.some((asset) => !DISCLOSURE_MANDATE_V1.allowedAssetTypes.includes(asset))) throw new Error("Only equities and ETFs are supported by WP-DIR1.");
  return {
    maximumLagDays: overrides.maximumLagDays ?? DISCLOSURE_MANDATE_V1.maximumLagDays,
    minimumDisclosedRangeFloorUsd: overrides.minimumDisclosedRangeFloorUsd ?? DISCLOSURE_MANDATE_V1.minimumDisclosedRangeFloorUsd,
    maximumObservationsPerPlanDay: overrides.maximumObservationsPerPlanDay ?? DISCLOSURE_MANDATE_V1.maximumObservationsPerPlanDay,
    allowedAssetTypes: allowed,
  };
}

export function evaluateDisclosureTransaction(transaction: DisclosureTransactionInput, controls: DisclosureControls, now: number): DisclosureGateResult {
  const reasons: string[] = [];
  const publicationBasis = transaction.publicationAt ?? transaction.firstObservedAt;
  const eligibleFrom = publicationBasis || null;
  const lagDays = transaction.transactionDate && eligibleFrom ? Math.floor((eligibleFrom - transaction.transactionDate) / 86_400_000) : null;
  if (!eligibleFrom) reasons.push("missing_eligible_from");
  if (lagDays === null) reasons.push("missing_transaction_or_publication_date");
  if (lagDays !== null && lagDays > controls.maximumLagDays) reasons.push("outside_disclosure_lag");
  if (!transaction.assetType || !controls.allowedAssetTypes.includes(transaction.assetType as "equity" | "etf")) reasons.push("unsupported_asset");
  if (transaction.resolutionGrade === "ambiguous") reasons.push("ambiguous_entity");
  if (transaction.resolutionGrade !== "exact") reasons.push("entity_unresolved");
  if (transaction.amountMaxUsd === null || transaction.amountMaxUsd < controls.minimumDisclosedRangeFloorUsd) reasons.push("below_disclosed_range_floor");
  if (eligibleFrom !== null && now < eligibleFrom) reasons.push("not_yet_eligible");
  return {
    state: reasons.length ? "held" : "reviewable",
    reasons,
    eligibleFrom,
    disclosureLagDays: lagDays,
    effectiveControls: controls,
  };
}

export function assertOutcomeWindow(eligibleFrom: number, outcomeWindowStart: number) {
  if (outcomeWindowStart < eligibleFrom) throw new Error("Look-ahead guard: an outcome window cannot begin before eligibleFrom.");
}
