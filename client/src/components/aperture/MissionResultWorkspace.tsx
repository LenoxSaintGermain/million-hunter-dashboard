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
  return <section className="mx-auto max-w-5xl space-y-4 pb-12" aria-label="Completed mission">
    <header>
      <p className="text-sm font-semibold">{accountLabel} · Paper</p>
      <div className="mt-2 flex items-center justify-between gap-3"><h2 className="font-serif text-2xl">Mission result</h2><Button variant="outline" className="min-h-11" onClick={onEdit}>Edit mission</Button></div>
    </header>
    {notice}
    <section id="mission-underwriting-result" aria-label="Underwriting result" className="scroll-mt-24 space-y-3">
      <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>Analysis saved <time dateTime={new Date(result.asOf).toISOString()}>{new Date(result.asOf).toLocaleString()}</time> · not a current eligibility check</p>
      <PlayUnderwritingBrief result={result} selectedPlayId={selectedPlayId} busy={busy} onValidate={onValidate} />
    </section>
    <section aria-label="Saved mission summary" className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <p className="font-semibold break-words">{thesisLabel}</p>
      <p className="mt-1 leading-6">{money(result.objective.deployableCapitalCents)} allocated · {result.objective.holdingPeriods.map(h => horizons[h]).join(", ")} · {result.objective.instrumentPreference === "either" ? "Shares or options" : result.objective.instrumentPreference === "options" ? "Options" : "Shares"}</p>
      <p className="mt-1 leading-6">Planned-loss limit {money(result.objective.maxPlannedLossCents)} · <strong>{money(result.feasibility.riskBudgetCents)} effective at analysis</strong></p>
      {result.objective.targetProfitCents != null && result.objective.targetPeriod != null && <p className="mt-1 leading-6">{money(result.objective.targetProfitCents)} / {result.objective.targetPeriod} target · {result.feasibility.requiredReturnPct}% required · {result.feasibility.classification}. The target does not increase allowed risk.</p>}
      <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Saved {revisionLabel} · Account snapshot {accountAsOf == null ? "unavailable" : new Date(accountAsOf).toLocaleString()}. Declared allocation, not total account value.</p>
      {riskDetails}
    </section>

  </section>;
}
