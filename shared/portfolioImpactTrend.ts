/**
 * Portfolio-impact trend for captured paper slates.
 *
 * This is deliberately narrower than a performance report. It aggregates only
 * contemporaneously captured, operator-selected, source-verified counterfactual
 * outcomes. Historical reconstructions, non-triggers, missing tape, and records
 * without a complete modeled position remain visible as exclusions.
 */
export type PortfolioImpactTrendRow = {
  slateId: number;
  snapshotBasis: "live_capture" | "historical_reconstruction";
  slateStatus: "captured" | "awaiting_outcome" | "complete";
  itemDecision: string;
  outcomeStatus: "pending" | "resolved" | "unavailable";
  outcomeResult: "win" | "breakeven" | "loss" | "not_triggered" | "unresolved";
  outcomeBasis: "verified" | "modeled" | "unknown";
  entryPriceCents: number | null;
  settlementPriceCents: number | null;
  play: {
    side: "long" | "short";
    qty: number | null;
    notionalCents: number | null;
    plannedLossCents: number | null;
  } | null;
};

export type PortfolioImpactTrend = {
  liveCohortCount: number;
  historicalCohortCountExcluded: number;
  selectedPaperPlayCount: number;
  measuredSelectedOutcomeCount: number;
  nonTriggeredSelectedCount: number;
  unavailableSelectedCount: number;
  modeledExposureCents: number | null;
  plannedLossCents: number | null;
  observedImpactCents: number | null;
  evidenceNote: string;
  cohortBreakdown: Array<{
    slateId: number;
    selectedCount: number;
    measuredCount: number;
    observedImpactCents: number | null;
  }>;
};

const isMeasuredResult = (row: PortfolioImpactTrendRow) => row.outcomeStatus === "resolved"
  && row.outcomeBasis === "verified"
  && ["win", "breakeven", "loss"].includes(row.outcomeResult)
  && row.entryPriceCents != null
  && row.settlementPriceCents != null
  && row.play?.qty != null;

function paperImpactCents(row: PortfolioImpactTrendRow): number | null {
  if (!isMeasuredResult(row) || !row.play || row.entryPriceCents == null || row.settlementPriceCents == null || row.play.qty == null) return null;
  const direction = row.play.side === "short" ? -1 : 1;
  return Math.round((row.settlementPriceCents - row.entryPriceCents) * row.play.qty * direction);
}

/** Aggregate immutable paper observations without inventing any missing values. */
export function buildPortfolioImpactTrend(rows: PortfolioImpactTrendRow[]): PortfolioImpactTrend {
  const liveRows = rows.filter((row) => row.snapshotBasis === "live_capture");
  const selectedRows = liveRows.filter((row) => row.itemDecision === "selected");
  const measuredRows = selectedRows.filter(isMeasuredResult);
  const exposureRows = selectedRows.filter((row) => row.play?.notionalCents != null && row.play.notionalCents > 0);
  const riskRows = selectedRows.filter((row) => row.play?.plannedLossCents != null && row.play.plannedLossCents > 0);
  const cohortIds = new Set(liveRows.map((row) => row.slateId));
  const historicalIds = new Set(rows.filter((row) => row.snapshotBasis === "historical_reconstruction").map((row) => row.slateId));
  const impactRows = measuredRows.map((row) => ({ row, impact: paperImpactCents(row) })).filter((entry): entry is { row: PortfolioImpactTrendRow; impact: number } => entry.impact != null);
  const cohortBreakdown = Array.from(cohortIds).sort((a, b) => b - a).map((slateId) => {
    const cohortSelected = selectedRows.filter((row) => row.slateId === slateId);
    const cohortImpacts = impactRows.filter((entry) => entry.row.slateId === slateId).map((entry) => entry.impact);
    return {
      slateId,
      selectedCount: cohortSelected.length,
      measuredCount: cohortImpacts.length,
      observedImpactCents: cohortImpacts.length ? cohortImpacts.reduce((total, value) => total + value, 0) : null,
    };
  });

  const selectedPaperPlayCount = selectedRows.length;
  const measuredSelectedOutcomeCount = measuredRows.length;
  return {
    liveCohortCount: cohortIds.size,
    historicalCohortCountExcluded: historicalIds.size,
    selectedPaperPlayCount,
    measuredSelectedOutcomeCount,
    nonTriggeredSelectedCount: selectedRows.filter((row) => row.outcomeResult === "not_triggered").length,
    unavailableSelectedCount: selectedRows.filter((row) => row.outcomeStatus !== "resolved" || row.outcomeResult === "unresolved").length,
    modeledExposureCents: exposureRows.length ? exposureRows.reduce((total, row) => total + (row.play?.notionalCents ?? 0), 0) : null,
    plannedLossCents: riskRows.length ? riskRows.reduce((total, row) => total + (row.play?.plannedLossCents ?? 0), 0) : null,
    observedImpactCents: impactRows.length ? impactRows.reduce((total, entry) => total + entry.impact, 0) : null,
    evidenceNote: selectedPaperPlayCount === 0
      ? "No operator-selected live paper play exists yet; portfolio impact is not measured."
      : measuredSelectedOutcomeCount === 0
        ? "A paper posture is recorded, but its source-verified selected outcome is not measured yet."
        : `Process evidence only — ${measuredSelectedOutcomeCount} verified selected paper outcome${measuredSelectedOutcomeCount === 1 ? "" : "s"}; this is not a return forecast or performance claim.`,
    cohortBreakdown,
  };
}
