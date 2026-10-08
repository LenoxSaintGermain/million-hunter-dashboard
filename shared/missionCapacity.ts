import type { PlayUnderwritingResult } from "./playUnderwriting";

export type MissionCapacityPart = { label: string; cents: number | null; detail: string | null; binding: boolean };

/**
 * One capacity number for a saved Mission result, with the parts that set it.
 * Display only: every amount is read from the saved underwriting result; the
 * risk math in playUnderwriting.ts is not repeated or changed here.
 *
 * #19: the account-wide ceiling is a share of measured account equity. When
 * equity was not measured, the room is "Not measured" and blocks; results
 * saved before #19 say their ceiling used declared capital.
 */
export function missionCapacityBreakdown(result: Pick<PlayUnderwritingResult, "objective" | "feasibility" | "plays" | "portfolioRisk">) {
  const { objective, feasibility, plays, portfolioRisk } = result;
  const ceilingPct = feasibility.aggregatePolicyPct;
  const pct = ceilingPct != null ? `${ceilingPct}%` : "The mandate share";
  const openRiskCents = Math.max(0, feasibility.aggregateOpenRiskBeforeCents ?? portfolioRisk.beforeCents);
  const notMeasured = feasibility.aggregateCeilingStatus === "not_measured";
  const equity = feasibility.accountEquityCents ?? null;
  const roomCents = notMeasured ? null : Math.max(0, feasibility.riskBudgetCents);
  const accountRoomCents = notMeasured ? null : Math.max(0, feasibility.maxOpenRiskCents - openRiskCents);
  const accountDetail = notMeasured
    ? `${pct} of account equity; equity is unknown or the broker snapshot is older than 4 hours, so new planned risk is blocked. Declared capital does not substitute`
    : feasibility.aggregateCeilingStatus === "measured" && equity != null
      ? `${pct} of ${dollars(equity)} account equity = ${dollars(feasibility.maxOpenRiskCents)} ceiling − ${dollars(openRiskCents)} already at risk`
      : `${pct} of declared capital = ${dollars(feasibility.maxOpenRiskCents)} ceiling − ${dollars(openRiskCents)} already at risk; saved before the ceiling moved to account equity`;
  const parts: MissionCapacityPart[] = [
    { label: "Mission planned-loss limit", cents: objective.maxPlannedLossCents, detail: null, binding: false },
    { label: "Account open-risk room", cents: accountRoomCents, detail: accountDetail, binding: notMeasured },
  ];
  if (!notMeasured) {
    // The per-play policy, weekly-loss and event limits are applied in the same
    // minimum but are not stored separately on the result; show their outcome.
    if (parts.every(part => part.cents != null && part.cents > roomCents!)) parts.push({ label: "Per-play policy, weekly and event limits", cents: roomCents, detail: null, binding: false });
    const bindingIndex = parts.findIndex(part => part.cents === roomCents);
    if (bindingIndex >= 0) parts[bindingIndex].binding = true;
  }
  const topPlayRiskCents = plays[0]?.sizing.plannedRiskCents ?? null;
  const afterTopPlay = !notMeasured && topPlayRiskCents != null && topPlayRiskCents > 0 && portfolioRisk.remainingHeadroomCents != null
    ? { plannedRiskCents: topPlayRiskCents, remainingCents: portfolioRisk.remainingHeadroomCents }
    : null;
  return { roomCents, notMeasured, parts, afterTopPlay };
}

function dollars(cents: number | null) {
  if (cents == null) return "Not measured";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100);
}

/** Plain-language lines for the hover breakdown and the summary details. */
export function missionCapacityLines(breakdown: ReturnType<typeof missionCapacityBreakdown>): string[] {
  const lines = breakdown.parts.map(part => `${part.binding ? (breakdown.notMeasured ? "Blocks it · " : "Sets it · ") : ""}${part.label}: ${dollars(part.cents)}${part.detail ? ` (${part.detail})` : ""}`);
  if (breakdown.afterTopPlay) lines.push(`After the top play (${dollars(breakdown.afterTopPlay.plannedRiskCents)} planned loss), ${dollars(breakdown.afterTopPlay.remainingCents)} of account room is left. Candidates draw on the same room; they are alternatives, not all fundable together.`);
  return lines;
}
