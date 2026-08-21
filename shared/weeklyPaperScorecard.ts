export type WeeklyPaperScorecardItem = {
  operatorDecision: "not_recorded" | "selected" | "skipped" | "deferred";
  outcomeStatus: "pending" | "resolved" | "unavailable";
  outcomeResult: "win" | "breakeven" | "loss" | "not_triggered" | "unresolved";
  outcomeBasis: "verified" | "modeled" | "unknown";
};

export type WeeklyPaperScorecardSlate = {
  snapshotBasis: "live_capture" | "historical_reconstruction";
  items: WeeklyPaperScorecardItem[];
};

export function buildWeeklyPaperScorecard(slates: WeeklyPaperScorecardSlate[]) {
  const live = slates.filter((slate) => slate.snapshotBasis === "live_capture");
  const historicalExcluded = slates.length - live.length;
  const items = live.flatMap((slate) => slate.items);
  const selected = items.filter((item) => item.operatorDecision === "selected");
  const verifiedTerminal = selected.filter((item) => item.outcomeStatus === "resolved" && item.outcomeBasis === "verified" && ["win", "breakeven", "loss"].includes(item.outcomeResult));
  const byResult = (result: "win" | "breakeven" | "loss") => verifiedTerminal.filter((item) => item.outcomeResult === result).length;
  const skipped = items.filter((item) => item.operatorDecision === "skipped").length;
  const deferred = items.filter((item) => item.operatorDecision === "deferred").length;
  const notTriggered = selected.filter((item) => item.outcomeStatus === "resolved" && item.outcomeResult === "not_triggered").length;
  const unavailable = selected.filter((item) => item.outcomeStatus === "unavailable" || item.outcomeResult === "unresolved").length;
  const pending = selected.filter((item) => item.outcomeStatus === "pending").length;

  const sampleLimit = verifiedTerminal.length === 0
    ? "No source-verified selected outcome yet. The record is process evidence, not a performance claim."
    : `${verifiedTerminal.length} source-verified selected outcome${verifiedTerminal.length === 1 ? "" : "s"}. This is process evidence only—not enough to establish accuracy, edge, or expected return.`;

  return {
    liveCohortCount: live.length,
    historicalExcluded,
    opportunityCount: items.length,
    selectedCount: selected.length,
    wins: byResult("win"),
    breakevens: byResult("breakeven"),
    losses: byResult("loss"),
    skipped,
    deferred,
    notTriggered,
    unavailable,
    pending,
    verifiedTerminalCount: verifiedTerminal.length,
    sampleLimit,
  };
}
