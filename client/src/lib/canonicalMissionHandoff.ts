import { emptyMissionDraftValues, missionDraftValuesSchema, type MissionDraftValues } from "@shared/apertureMissionDraft";

export type CanonicalMissionHandoff = { canonicalThesisId: number; capitalThesisId: number };

/** A new thesis must not depend on another mission's historical receipt. */
export function missionReceiptReadEnabled(hasHandoff: boolean, exactReceipt: { decisionRunId: number; revisionId: number } | null): boolean {
  return !hasHandoff || exactReceipt != null;
}

/** Syntax only. Ownership and source linkage must be checked against reads. */
export function parseCanonicalMissionHandoff(search: string): CanonicalMissionHandoff | "invalid" | null {
  const params = new URLSearchParams(search);
  const keys = ["canonicalThesisId", "capitalThesisId", "newMission"];
  if (!keys.some(key => params.has(key))) return null;
  if (keys.some(key => params.getAll(key).length !== 1) || params.get("newMission") !== "1") return "invalid";
  const id = (key: string) => {
    const raw = params.get(key)!;
    return /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : null;
  };
  const canonicalThesisId = id("canonicalThesisId"), capitalThesisId = id("capitalThesisId");
  return canonicalThesisId && capitalThesisId ? { canonicalThesisId, capitalThesisId } : "invalid";
}

/** Only declarations in the exact saved source/projection seed the new form.
 * Account, capital, loss and receipt identities deliberately remain unbound. */
export function canonicalMissionHandoffValues(
  source: { id: number; thesisText: string; compiledFilters?: unknown },
  projection: { missionDefaults?: { holdingPeriod?: unknown; instrumentPreference?: unknown } },
): MissionDraftValues {
  const filters = source.compiledFilters && typeof source.compiledFilters === "object"
    ? source.compiledFilters as Record<string, unknown> : {};
  const holdingPeriod = filters.holdingPeriod ?? projection.missionDefaults?.holdingPeriod ?? "intraday";
  return missionDraftValuesSchema.parse({ ...emptyMissionDraftValues(), canonicalThesisId: source.id,
    mission: source.thesisText, missionDirty: true, holdingPeriod, holdingPeriods: [holdingPeriod],
    instrument: filters.instrumentPreference ?? projection.missionDefaults?.instrumentPreference ?? "shares",
    objective: holdingPeriod === "intraday" ? "deploy_today" : "best_qualified_play",
  });
}
