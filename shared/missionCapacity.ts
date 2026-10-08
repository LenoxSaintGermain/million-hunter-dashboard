import type { PlayUnderwritingResult } from "./playUnderwriting";

export type MissionCapacityPart = { label: string; cents: number; detail: string | null; binding: boolean };

/**
 * One capacity number for a saved Mission result, with the parts that set it.
 * Display only: every amount is read from the saved underwriting result; the
 * risk math in playUnderwriting.ts is not repeated or changed here.
 */
export function missionCapacityBreakdown(result: Pick<PlayUnderwritingResult, "objective" | "feasibility" | "plays" | "portfolioRisk">) {
  const { objective, feasibility, plays, portfolioRisk } = result;
  const roomCents = Math.max(0, feasibility.riskBudgetCents);
  const openRiskCents = Math.max(0, feasibility.aggregateOpenRiskBeforeCents ?? portfolioRisk.beforeCents);
  const accountRoomCents = Math.max(0, feasibility.maxOpenRiskCents - openRiskCents);
  const ceilingPct = feasibility.aggregatePolicyPct;
  const parts: MissionCapacityPart[] = [
    { label: "Mission planned-loss limit", cents: objective.maxPlannedLossCents, detail: null, binding: false },
    {
      label: "Account open-risk room",
      cents: accountRoomCents,
      detail: `${ceilingPct != null ? `${ceilingPct}% ` : ""}open-risk ceiling ${dollars(feasibility.maxOpenRiskCents)} − ${dollars(openRiskCents)} already at risk`,
      binding: false,
    },
  ];
  // The per-play policy, weekly-loss and event limits are applied in the same
  // minimum but are not stored separately on the result; show their outcome.
  if (parts.every(part => part.cents > roomCents)) parts.push({ label: "Per-play policy, weekly and event limits", cents: roomCents, detail: null, binding: false });
  const bindingIndex = parts.findIndex(part => part.cents === roomCents);
  if (bindingIndex >= 0) parts[bindingIndex].binding = true;
  const topPlayRiskCents = plays[0]?.sizing.plannedRiskCents ?? null;
  const afterTopPlay = topPlayRiskCents != null && topPlayRiskCents > 0 && portfolioRisk.remainingHeadroomCents != null
    ? { plannedRiskCents: topPlayRiskCents, remainingCents: portfolioRisk.remainingHeadroomCents }
    : null;
  return { roomCents, parts, afterTopPlay };
}

function dollars(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100);
}

/** Plain-language lines for the hover breakdown and the summary details. */
export function missionCapacityLines(breakdown: ReturnType<typeof missionCapacityBreakdown>): string[] {
  const lines = breakdown.parts.map(part => `${part.binding ? "Sets it · " : ""}${part.label}: ${dollars(part.cents)}${part.detail ? ` (${part.detail})` : ""}`);
  if (breakdown.afterTopPlay) lines.push(`After the top play (${dollars(breakdown.afterTopPlay.plannedRiskCents)} planned loss), ${dollars(breakdown.afterTopPlay.remainingCents)} of account room is left. Candidates draw on the same room; they are alternatives, not all fundable together.`);
  return lines;
}
