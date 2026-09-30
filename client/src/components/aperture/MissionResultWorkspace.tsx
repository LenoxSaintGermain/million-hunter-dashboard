import type { ReactNode } from "react";
import type { PlayUnderwritingResult } from "@shared/playUnderwriting";
import { Button } from "@/components/ui/button";
import { PlayUnderwritingBrief } from "./PlayUnderwritingBrief";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
const horizons = { intraday: "Today", overnight: "Next close", swing: "This week", catalyst_window: "Catalyst window", position: "Long term" };

/** Presentation of a persisted, completed revision. Opening it runs no analysis. */
export function MissionResultWorkspace({ result, accountLabel, accountAsOf, thesisLabel, revisionLabel, selectedPlayId, busy, notice, riskDetails, onEdit, onValidate }: {
  result: PlayUnderwritingResult; accountLabel: string; accountAsOf: number | null;
  thesisLabel: string; revisionLabel: string; selectedPlayId: string | null; busy: boolean;
  notice?: ReactNode; riskDetails: ReactNode; onEdit: () => void; onValidate: (id: string) => void;
}) {
  const limit = result.objective.maxPlannedLossCents;
  const effective = result.feasibility.riskBudgetCents;
  const riskShare = limit > 0 ? Math.min(100, Math.max(0, effective / limit * 100)) : null;
  return <section className="mission-result-edition mx-auto max-w-5xl space-y-4 pb-12" aria-label="Completed mission">
    <header>
      <div className="flex items-center justify-between gap-3"><h2 className="font-serif text-2xl">Mission result</h2><Button variant="outline" className="min-h-11" onClick={onEdit}>Edit mission</Button></div>
      <p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>{accountLabel} · Paper</p>
    </header>
    {notice}
    <dl className="mission-result-facts" aria-label="Saved analysis boundaries">
      <div><dt>Declared allocation</dt><dd>{money(result.objective.deployableCapitalCents)}</dd><small>Not account value or buying power</small></div>
      <div><dt>Effective planned-loss allowance</dt><dd>{money(effective)}</dd><div className="mission-risk-track" aria-hidden="true"><span style={{ width: `${riskShare ?? 0}%` }} /></div><small>{money(limit)} operator limit · saved at analysis</small></div>
      <div><dt>Research horizon</dt><dd>{result.objective.holdingPeriods.map(h => horizons[h]).join(", ")}</dd><small>{result.objective.instrumentPreference === "either" ? "Shares or options" : result.objective.instrumentPreference === "options" ? "Options" : "Shares"} · paper only</small></div>
    </dl>
    <section id="mission-underwriting-result" aria-label="Analysis result" className="scroll-mt-24 space-y-3">
      <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>Analysis saved <time dateTime={new Date(result.asOf).toISOString()}>{new Date(result.asOf).toLocaleString()}</time> · not a current eligibility check</p>
      <PlayUnderwritingBrief result={result} selectedPlayId={selectedPlayId} busy={busy} onValidate={onValidate} onAdjustRisk={onEdit} />
    </section>
    <details aria-label="Saved mission summary" className="border-y py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }}>
      <summary>Mission context & risk assumptions</summary>
      <p className="font-semibold break-words">{thesisLabel}</p>
      <p className="mt-1 leading-6">{money(result.objective.deployableCapitalCents)} allocated · {result.objective.holdingPeriods.map(h => horizons[h]).join(", ")} · {result.objective.instrumentPreference === "either" ? "Shares or options" : result.objective.instrumentPreference === "options" ? "Options" : "Shares"}</p>
      <p className="mt-1 leading-6">Planned-loss limit {money(result.objective.maxPlannedLossCents)} · <strong>{money(result.feasibility.riskBudgetCents)} effective at analysis</strong></p>
      {result.objective.targetProfitCents != null && result.objective.targetPeriod != null && <p className="mt-1 leading-6">{money(result.objective.targetProfitCents)} / {result.objective.targetPeriod} target · {result.feasibility.requiredReturnPct}% required · {result.feasibility.classification}. The target does not increase allowed risk.</p>}
      <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Saved {revisionLabel} · Account snapshot {accountAsOf == null ? "unavailable" : new Date(accountAsOf).toLocaleString()}. Declared allocation, not total account value.</p>
      {riskDetails}
    </details>

  </section>;
}
