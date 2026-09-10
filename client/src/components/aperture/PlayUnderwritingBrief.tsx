import { CircleSlash2 } from "lucide-react";
import type { PlayUnderwritingResult } from "@shared/playUnderwriting";
import { TargetFeasibilityCard } from "./TargetFeasibilityCard";
import { MarketRegimeBrief } from "./MarketRegimeBrief";
import { TradePlayCard } from "./TradePlayCard";

export function PlayUnderwritingBrief({ result, selectedPlayId, busy, onValidate }: { result: PlayUnderwritingResult; selectedPlayId: string | null; busy: boolean; onValidate: (playId: string) => void }) {
  const thesisById = new Map(result.tacticalTheses.map(thesis => [thesis.id, thesis]));
  const leadPlay = result.plays[0] ?? null;
  const fresh = Object.values(result.market.indexTrend).every(metric => metric.freshness === "fresh" && metric.asOf != null);
  return <div className="space-y-4">
    {result.noTrade ? <section aria-label="No new trade" className="rounded-xl border p-4" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}>
      <div className="flex items-start gap-3">
        <CircleSlash2 aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" style={{ color: "var(--sh-signal)" }} />
        <div className="min-w-0">
          <h3 className="font-serif text-2xl">No new trade</h3>
          <p className="mt-2 text-sm leading-6">{result.noTrade.explanation}</p>
          {result.noTrade.reopenCondition && <p className="mt-3 text-sm leading-6"><strong>Reassess when:</strong> {result.noTrade.reopenCondition}</p>}
          {result.noTrade.reviewAt != null && <p className="mt-2 text-sm">Review: {new Date(result.noTrade.reviewAt).toLocaleString()} · on demand</p>}
          <p className="mt-3 text-sm" style={{ color: "var(--sh-fg-muted)" }}>No paper ticket created; existing positions unchanged.</p>
        </div>
      </div>
    </section> : <section aria-label="Conditional playbook">
      <div className="mb-4">
        <h3 className="font-serif text-2xl">{result.plays.length} conditional {result.plays.length === 1 ? "play" : "plays"}</h3>
        <p className="mt-2 text-sm leading-6">{result.market.regime === "unknown" ? "Market context is incomplete." : result.market.regime.replaceAll("_", " ") + " market context."} {leadPlay ? leadPlay.symbol + " ranks first; confirm its entry condition and evidence before a ticket." : "No play is actionable without evidence."}</p>
        <p className="mt-2 text-sm" style={{ color: "var(--sh-fg-muted)" }}>Validate a play to open its evidence task. This does not create an order.</p>
      </div>
      <div className="space-y-4">{result.plays.map((play, index) => <TradePlayCard key={play.id} rank={index + 1} play={play} thesis={thesisById.get(play.tacticalThesisId) ?? null} portfolioRiskBeforeCents={result.portfolioRisk.beforeCents} maxOpenRiskCents={result.feasibility.maxOpenRiskCents} selected={selectedPlayId === play.id} busy={busy} onValidate={() => onValidate(play.id)} />)}</div>
    </section>}
    <p className="text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>Market snapshot: {new Date(result.market.asOf).toLocaleString()}{!fresh ? " · stale or incomplete; current entry conditions are unverified." : " · freshness at analysis time, not a live quote."}</p>
    <details className="rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">Evidence and calculations behind this result</summary>
      <div className="space-y-4 border-t p-4" style={{ borderColor: "var(--sh-border-1)" }}><TargetFeasibilityCard feasibility={result.feasibility} noTrade={result.noTrade} remainingHeadroomCents={result.portfolioRisk.remainingHeadroomCents} operatorMaxLossCents={result.objective.maxPlannedLossCents} /><MarketRegimeBrief market={result.market} /></div>
    </details>
  </div>;
}
