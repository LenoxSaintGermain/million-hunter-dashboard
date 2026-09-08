import { CircleSlash2 } from "lucide-react";
import type { PlayUnderwritingResult } from "@shared/playUnderwriting";
import { TargetFeasibilityCard } from "./TargetFeasibilityCard";
import { MarketRegimeBrief } from "./MarketRegimeBrief";
import { TradePlayCard } from "./TradePlayCard";

export function PlayUnderwritingBrief({ result, selectedPlayId, busy, onValidate }: { result: PlayUnderwritingResult; selectedPlayId: string | null; busy: boolean; onValidate: (playId: string) => void }) {
  const thesisById = new Map(result.tacticalTheses.map((thesis) => [thesis.id, thesis]));
  const leadPlay = result.plays[0] ?? null;
  const synthesis = result.noTrade
    ? result.noTrade.explanation
    : `${result.market.regime.replaceAll("_", " ")} conditions support ${result.plays.length} conditional ${result.plays.length === 1 ? "play" : "plays"}. ${leadPlay ? `${leadPlay.symbol} ranks first, but its trigger and evidence still require validation.` : "No play is actionable without validation."}`;
  return <div className="space-y-5">
    <section className="rounded-xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Mission synthesis</p><p className="mt-2 text-sm leading-6">{synthesis}</p><p className="mt-2 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Market facts as of {new Date(result.market.asOf).toLocaleString()}. Target feasibility explains pressure; it never increases risk.</p></section>
    <section><div className="mb-3"><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Conditional playbook</p><h2 className="mt-1 font-serif text-3xl">Best plays—or sit out.</h2><p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>A blueprint is not an order. Validate one to enter the existing research workflow.</p></div><div className="space-y-4">{result.plays.map((play, index) => <TradePlayCard key={play.id} rank={index + 1} play={play} thesis={thesisById.get(play.tacticalThesisId) ?? null} portfolioRiskBeforeCents={result.portfolioRisk.beforeCents} maxOpenRiskCents={result.feasibility.maxOpenRiskCents} selected={selectedPlayId === play.id} busy={busy} onValidate={() => onValidate(play.id)} />)}</div></section>
    {result.noTrade && <section className="rounded-xl border p-5" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface)" }}><div className="flex gap-3"><CircleSlash2 className="mt-1 h-5 w-5" style={{ color: "var(--sh-signal)" }} /><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Sit out · no trade</p><h3 className="mt-1 font-serif text-2xl">No setup clears the current evidence and risk thresholds.</h3><p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{result.noTrade.explanation}</p>{result.noTrade.reopenCondition && <p className="mt-2 text-sm"><strong>Reopen when:</strong> {result.noTrade.reopenCondition}</p>}</div></div></section>}
    <details className="rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">Evidence and calculations behind this result</summary><div className="space-y-4 border-t p-4" style={{ borderColor: "var(--sh-border-1)" }}><TargetFeasibilityCard feasibility={result.feasibility} /><MarketRegimeBrief market={result.market} /></div></details>
  </div>;
}
