import { useState, type ReactNode } from "react";
import type { PlayUnderwritingResult } from "@shared/playUnderwriting";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { missionCapacityBreakdown, missionCapacityLines } from "@shared/missionCapacity";
import { PlayUnderwritingBrief } from "./PlayUnderwritingBrief";
import { MissionRiskPortrait, riskMoney } from "./MandateRiskPortrait";
import { ManualOrderTicketModal } from "./ManualOrderTicketModal";
import { paperTicketReadiness, type PaperTicketPrefill } from "@shared/paperTicketPrefill";

const money = riskMoney;
const horizons = { intraday: "Today", overnight: "Next close", swing: "This week", catalyst_window: "Catalyst window", position: "Long term" };

/** Presentation of a persisted, completed revision. Opening it runs no analysis. */
export function MissionResultWorkspace({ result, accountLabel, accountAsOf, thesisLabel, revisionLabel, selectedPlayId, busy, notice, riskDetails, onEdit, onValidate, researchRunId = null }: {
  result: PlayUnderwritingResult; accountLabel: string; accountAsOf: number | null;
  thesisLabel: string; revisionLabel: string; selectedPlayId: string | null; busy: boolean;
  notice?: ReactNode; riskDetails: ReactNode; onEdit: () => void; onValidate: (id: string) => void;
  /** Research run bound to this Mission after a play was checked; required to stage a paper ticket. */
  researchRunId?: number | null;
}) {
  // Opening the existing ticket builder creates nothing; staging needs PAPER and the server gates.
  // The prefill is captured once on open so later re-renders never overwrite operator edits.
  const [ticketPrefill, setTicketPrefill] = useState<PaperTicketPrefill | null>(null);
  const prepareTicket = (playId: string) => {
    const play = result.plays.find(candidate => candidate.id === playId);
    const ticket = play ? paperTicketReadiness({ play, thesis: result.tacticalTheses.find(t => t.id === play.tacticalThesisId) ?? null, selectedPlayId, researchRunId }) : null;
    if (ticket?.state === "ready") setTicketPrefill(ticket.prefill);
  };
  const limit = result.objective.maxPlannedLossCents;
  const effective = result.feasibility.riskBudgetCents;
  // One capacity number: the effective allowance. Headroom after the top play is part of its breakdown.
  const capacity = missionCapacityBreakdown(result);
  const capacityLines = missionCapacityLines(capacity);
  // #19: the account-wide ceiling is a share of account equity (results saved earlier used declared capital).
  const ceilingBasis = result.feasibility.aggregateCeilingStatus == null
    ? "saved before the account ceiling moved to account equity"
    : `the account ceiling is ${result.feasibility.aggregatePolicyPct != null ? `${result.feasibility.aggregatePolicyPct}%` : "a fixed share"} of account equity`;
  return <section className="mission-result-edition mx-auto max-w-5xl space-y-4 pb-12" aria-label="Completed mission">
    <header>
      <div className="flex items-center justify-between gap-3"><h2 className="font-serif text-2xl">Mission result</h2><Button variant="outline" className="min-h-11" onClick={onEdit}>Edit mission</Button></div>
      <p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>{accountLabel} · Paper</p>
    </header>
    {notice}
    <dl className="mission-result-facts" aria-label="Saved analysis boundaries">
      <div><dt>Declared allocation</dt><dd>{riskMoney(result.objective.deployableCapitalCents)}</dd><small>Not account value or buying power</small></div>
      <div><dt>Room for new planned loss</dt><dd><TooltipProvider delayDuration={120}><Tooltip><TooltipTrigger asChild><span tabIndex={0} aria-describedby="mission-capacity-breakdown" className="cursor-help underline decoration-dotted decoration-1 underline-offset-4">{capacity.notMeasured ? "Not measured" : riskMoney(capacity.roomCents)}</span></TooltipTrigger><TooltipContent className="max-w-[320px]"><ul className="space-y-1 text-xs leading-5">{capacityLines.map(line => <li key={line}>{line}</li>)}</ul></TooltipContent></Tooltip></TooltipProvider></dd><small>{capacity.notMeasured ? "Blocked: account equity not measured" : "Smallest limit at analysis"} · {ceilingBasis} · candidates share it · not cash or buying power</small><span id="mission-capacity-breakdown" className="sr-only">{capacityLines.join(" ")}</span></div>
      <div><dt>Research horizon</dt><dd>{result.objective.holdingPeriods.map(h => horizons[h]).join(", ")}</dd><small>{result.objective.instrumentPreference === "either" ? "Shares or options" : result.objective.instrumentPreference === "options" ? "Options" : "Shares"} · paper only</small></div>
    </dl>
    <MissionRiskPortrait limitCents={limit} effectiveCents={effective} />
    <section id="mission-underwriting-result" aria-label="Analysis result" className="scroll-mt-24 space-y-3">
      <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>Analysis saved <time dateTime={new Date(result.asOf).toISOString()}>{new Date(result.asOf).toLocaleString()}</time> · not a current eligibility check</p>
      <PlayUnderwritingBrief result={result} selectedPlayId={selectedPlayId} busy={busy} onValidate={onValidate} onAdjustRisk={onEdit} researchRunId={researchRunId} onPrepareTicket={prepareTicket} />
    </section>
    <details aria-label="Saved mission summary" className="border-y py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }}>
      <summary>Mission context & risk assumptions</summary>
      <p className="font-semibold break-words">{thesisLabel}</p>
      <p className="mt-1 leading-6">{money(result.objective.deployableCapitalCents)} allocated · {result.objective.holdingPeriods.map(h => horizons[h]).join(", ")} · {result.objective.instrumentPreference === "either" ? "Shares or options" : result.objective.instrumentPreference === "options" ? "Options" : "Shares"}</p>
      <p className="mt-1 leading-6">Planned-loss limit {money(result.objective.maxPlannedLossCents)} · <strong>{money(result.feasibility.riskBudgetCents)} effective at analysis</strong></p>
      <ul aria-label="How the room for new planned loss is set" className="mt-1 list-disc pl-5 leading-6">{capacityLines.map(line => <li key={line}>{line}</li>)}</ul>
      {result.objective.targetProfitCents != null && result.objective.targetPeriod != null && <p className="mt-1 leading-6">{money(result.objective.targetProfitCents)} / {result.objective.targetPeriod} target · {result.feasibility.requiredReturnPct}% required · {result.feasibility.classification}. The target does not increase allowed risk.</p>}
      <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Saved {revisionLabel} · Account snapshot {accountAsOf == null ? "unavailable" : new Date(accountAsOf).toLocaleString()}. Declared allocation, not total account value.</p>
      {riskDetails}
    </details>
    {ticketPrefill && <ManualOrderTicketModal open onOpenChange={open => { if (!open) setTicketPrefill(null); }} initialValues={ticketPrefill} />}
  </section>;
}
