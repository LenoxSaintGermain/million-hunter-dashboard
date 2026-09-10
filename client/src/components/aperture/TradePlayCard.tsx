import { ArrowRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TacticalMarketThesis, TradePlayBlueprint } from "@shared/playUnderwriting";
import { BasisMark, StateMark } from "./DecisionVisualLanguage";

const money = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value / 100);

export function TradePlayCard({ rank, play, thesis, portfolioRiskBeforeCents, maxOpenRiskCents, selected, busy, onValidate }: { rank: number; play: TradePlayBlueprint; thesis: TacticalMarketThesis | null; portfolioRiskBeforeCents: number; maxOpenRiskCents: number; selected: boolean; busy: boolean; onValidate: () => void }) {
  const portfolioRiskAfterCents = portfolioRiskBeforeCents + play.sizing.plannedRiskCents;
  const remainingHeadroomCents = Math.max(0, maxOpenRiskCents - portfolioRiskAfterCents);
  const isShareScenario = play.instrument.kind === "shares";
  const sizingUnmeasured = play.outcome.basis === "insufficient_data";
  const riskValue = sizingUnmeasured && play.sizing.plannedRiskCents <= 0 ? "Not measured" : money(play.sizing.plannedRiskCents);
  const riskLabel = isShareScenario ? "Planned loss at the modeled stop" : play.outcome.basis === "market_derived" ? "Bounded contract loss" : "Planned risk ceiling";
  return <article className="overflow-hidden rounded-xl border" style={{ borderColor: selected ? "var(--sh-signal)" : "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4" style={{ borderColor: "var(--sh-border-1)" }}><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Play {rank} · score {play.scoring.overall}</p><h3 className="mt-1 font-serif text-xl">{play.title}</h3><p className="mt-1 text-xs capitalize" style={{ color: "var(--sh-fg-muted)" }}>{play.playClass.replaceAll("_", " ")} · {play.horizon.replaceAll("_", " ")}</p></div><StateMark state={play.status === "eligible_for_research" ? "researchable" : "conditional"} label={play.status.replaceAll("_", " ")} compact /></div>
    <div className="grid gap-px sm:grid-cols-2" style={{ background: "var(--sh-border-1)" }}>
      <div className="p-4" style={{ background: "var(--sh-surface)" }}><p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Why consider it</p><p className="mt-1 text-sm leading-5">{thesis?.statement ?? "Research must establish the tactical thesis."}</p></div>
      <div className="p-4" style={{ background: "var(--sh-surface)" }}><p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Entry condition · {play.trigger.status.replaceAll("_", " ")}</p><p className="mt-1 text-sm leading-5">{play.trigger.description}</p></div>
      <div className="p-4" style={{ background: "var(--sh-surface)" }}><p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>{riskLabel}</p><p className="mt-1 font-mono text-sm">{riskValue}</p>{sizingUnmeasured ? <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Scenario output withheld; fresh contract or market data is required.</p> : <><p className="mt-1 font-mono text-xs">Scenario: {money(play.outcome.downsideCents)} / {money(play.outcome.expectedBaseCents)} / {money(play.outcome.expectedHighCents)}</p>{isShareScenario && <p className="mt-1 text-xs leading-5">Stop execution can differ from the modeled price.</p>}</>}<BasisMark basis={sizingUnmeasured ? "unknown" : "modeled"} label={play.outcome.basis.replaceAll("_", " ")} /></div>
      <div className="p-4" style={{ background: "var(--sh-surface)" }}><p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Kill condition</p><p className="mt-1 text-sm leading-5">{play.invalidation.description}{play.invalidation.price == null ? "" : ` · $${play.invalidation.price.toFixed(2)}`}</p></div>
    </div>
    {(play.warnings.length > 0 || thesis) && <details className="border-t" style={{ borderColor: "var(--sh-border-1)" }}><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">Deeper analysis and evidence</summary><div className="space-y-3 border-t px-4 py-3 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>{play.warnings.length > 0 && <div className="flex gap-2"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--sh-signal)" }} /><p>{play.warnings.join(" ")}</p></div>}{thesis && <><p><strong style={{ color: "var(--sh-text-primary)" }}>Confirmation:</strong> {thesis.confirmation}</p><p><strong style={{ color: "var(--sh-text-primary)" }}>Thesis expires:</strong> {thesis.expiresAt ? new Date(thesis.expiresAt).toLocaleString() : "Not measured"}</p></>}</div></details>}
    <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--sh-border-1)" }}>
      <div className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{sizingUnmeasured ? <p>Portfolio impact not measured. Validate the entry and sizing first.</p> : <><p>{riskLabel} {money(play.sizing.maxLossCents)} · {play.sizing.percentCapitalAtRisk}% of declared capital</p><p>Portfolio open risk {money(portfolioRiskBeforeCents)} → {money(portfolioRiskAfterCents)} · {money(remainingHeadroomCents)} remaining</p></>}<p className="mt-1"><strong style={{ color: "var(--sh-text-primary)" }}>Next:</strong> Validate only the unresolved evidence. No paper ticket is created.</p></div>
      <Button className="h-auto min-h-11 max-w-full whitespace-normal py-3" disabled={busy || selected} onClick={onValidate}>
        <span className="min-w-0 break-words">{selected ? "Selected for research" : "Validate this play"}</span>
        <ArrowRight className="h-4 w-4 shrink-0" />
      </Button>
    </div>
  </article>;
}
