/**
 * Weekly Income scorecard (#86). Quick Play leads with one plain sentence and
 * explains each figure in a line; Strategist shows every metric with basis and
 * asOf. Counterfactual rows are always labelled "Counterfactual, not a fill".
 */
import type { WeeklyIncomeScorecard } from "@shared/weeklyIncomeScorecard";
import { WI_COPY } from "@shared/weeklyIncome/copy";
import { ExampleDataBadge, PaperFidelityNote, WiLabel } from "./WeeklyIncomeGuide";

const CARD = { borderColor: "var(--rule)", background: "var(--paper)", borderRadius: 0 } as const;
const GUIDED_KEYS = ["net_kept", "avg_capital_at_risk", "return_on_account", "peak_max_loss_pct", "win_rate", "breakeven_win_rate"];
/** Main Street labels for Quick Play; Strategist keeps the exact metric names. */
const GUIDED_LABELS: Record<string, string> = {
  net_kept: "Kept after closing",
  avg_capital_at_risk: "Most you could lose, on average",
  return_on_account: "This week vs your whole balance",
  peak_max_loss_pct: "Most you could lose at one time",
  win_rate: "Trades that made money",
  breakeven_win_rate: "Win rate needed to break even",
};

export function WeeklyIncomeScorecardView({ scorecard, isGuided, isExample = false, history }: { scorecard: WeeklyIncomeScorecard; isGuided: boolean; isExample?: boolean; history?: { worstWeek: string; maxDrawdown: string } }) {
  const counterfactual = scorecard.basis === "counterfactual";
  const asOf = new Date(scorecard.asOf).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const rows = isGuided ? scorecard.metrics.filter((m) => GUIDED_KEYS.includes(m.key)) : scorecard.metrics;
  return (
    <section data-wi-scorecard data-basis={scorecard.basis} className="border p-5" style={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <WiLabel>{isGuided ? `How the week of ${scorecard.weekOf} went` : `Weekly scorecard · week of ${scorecard.weekOf}`}</WiLabel>
        <div className="flex flex-wrap items-center gap-2">
          {counterfactual && <span data-wi-counterfactual className="inline-block border px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: "var(--ink)", color: "var(--ink)" }}>{WI_COPY["wi.scorecard.counterfactual"]}</span>}
          {isExample && <ExampleDataBadge />}
        </div>
      </div>
      {counterfactual && isGuided && <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{WI_COPY["wi.scorecard.counterfactualPlain"]}</p>}
      {isGuided ? (
        <>
          <h4 data-wi-scorecard-headline className="mt-2 font-serif text-xl leading-snug" style={{ color: "var(--ink)" }}>{scorecard.guided.headline}</h4>
          {scorecard.annualized && <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink)" }}>{scorecard.annualized}</p>}
          <ul className="mt-3 grid gap-1 text-sm leading-6" style={{ color: "var(--ink)" }}>
            {[scorecard.guided.winRate, scorecard.guided.worst, scorecard.guided.endings].filter(Boolean).map((line) => <li key={line!}>{line}</li>)}
          </ul>
        </>
      ) : scorecard.headline && <p className="mt-2 text-sm" style={{ color: "var(--ink)" }}>{scorecard.headline}</p>}
      <dl className={`mt-4 grid gap-x-6 gap-y-3 ${isGuided ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        {rows.map((m) => (
          <div key={m.key} data-wi-metric={m.key} className="border-t pt-2" style={{ borderColor: "var(--rule)" }}>
            <dt className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--sh-fg-muted)" }}>{isGuided ? GUIDED_LABELS[m.key] ?? m.label : m.label}</dt>
            <dd className="mt-0.5 font-serif text-lg" style={{ color: m.value == null ? "var(--sh-fg-muted)" : "var(--ink)" }}>{m.display}</dd>
            {isGuided ? <dd className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{m.plain}</dd> : <dd className="font-mono text-[0.62rem]" style={{ color: "var(--sh-fg-muted)" }}>{m.basis} · as of {asOf} ET</dd>}
          </div>
        ))}
        {history && !isGuided && (
          <>
            <div data-wi-metric="worst_week" className="border-t pt-2" style={{ borderColor: "var(--rule)" }}><dt className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--sh-fg-muted)" }}>Worst week</dt><dd className="mt-0.5 font-serif text-lg" style={{ color: "var(--ink)" }}>{history.worstWeek}</dd></div>
            <div data-wi-metric="max_drawdown" className="border-t pt-2" style={{ borderColor: "var(--rule)" }}><dt className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--sh-fg-muted)" }}>Max drawdown</dt><dd className="mt-0.5 font-serif text-lg" style={{ color: "var(--ink)" }}>{history.maxDrawdown}</dd></div>
          </>
        )}
      </dl>
      <p data-wi-sample className="mt-4 border-l-2 pl-3 text-xs leading-5" style={{ borderColor: "var(--sh-signal)", color: "var(--ink)" }}>{scorecard.sampleLimit}</p>
      <div className="mt-3"><PaperFidelityNote /></div>
    </section>
  );
}
