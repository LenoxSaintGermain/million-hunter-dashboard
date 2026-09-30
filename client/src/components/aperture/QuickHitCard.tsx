import React, { useEffect, useState } from "react";
import { type QuickHitPlay, calculateBudgetSizing } from "../../../../shared/quickHitSymphony";

interface QuickHitCardProps {
  play: QuickHitPlay;
  defaultBudget?: number;
  onAuthorized?: (symbol: string) => void;
}
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** A fixed scenario worksheet, never an executable recommendation. */
export const QuickHitCard: React.FC<QuickHitCardProps> = ({ play, defaultBudget = 50 }) => {
  const [budgetUsd, setBudgetUsd] = useState(defaultBudget);
  useEffect(() => setBudgetUsd(defaultBudget), [defaultBudget]);
  const sizing = calculateBudgetSizing({ budgetUsd, limitPriceCents: play.bracket.limitPriceCents, stopPriceCents: play.bracket.stopLossPriceCents });
  const { stopLossPriceCents: stop, limitPriceCents: entry, takeProfitPriceCents: target } = play.bracket;
  const validRange = target > entry && entry > stop;
  const entryPosition = validRange ? 8 + ((entry - stop) / (target - stop)) * 84 : 50;
  const targetGain = sizing.shares * (target - entry);
  return <article className="scenario-story" aria-label={`${play.symbol} illustrative scenario`}>
    <header><span className="eyebrow">{play.catalyst.badge} / illustrative, not current</span><h3>{play.symbol}</h3><p>{play.companyName}</p></header>
    <div className="scenario-premise"><span className="eyebrow">The sample premise</span><h4>{play.catalyst.headline}</h4></div>
    <figure className="scenario-price-portrait">
      <figcaption>Where the example holds—or breaks</figcaption>
      <svg viewBox="0 0 300 72" role="img" aria-label={`Sample price scale: stop ${dollars(stop)}, limit ${dollars(entry)}, target ${dollars(target)}. Not a price history.`}>
        <line x1="24" x2="276" y1="36" y2="36" stroke="currentColor" />
        <line x1="24" x2="24" y1="18" y2="54" stroke="currentColor" strokeDasharray="3 3" />
        <line x1="276" x2="276" y1="18" y2="54" stroke="currentColor" strokeDasharray="3 3" />
        <circle cx={entryPosition * 3} cy="36" r="8" fill="var(--paper)" stroke="currentColor" strokeWidth="2" />
      </svg>
      <div className="scenario-price-labels"><div><span>Stop</span><strong>{dollars(stop)}</strong></div><div><span>Limit</span><strong>{dollars(entry)}</strong></div><div><span>Target</span><strong>{dollars(target)}</strong></div></div>
      <p>Linear price scale · fixed sample levels, not a forecast</p>
    </figure>
    <fieldset className="scenario-budget"><legend>Try a sample budget</legend>{[25, 50, 100].map(amount => <button key={amount} type="button" aria-pressed={budgetUsd === amount} onClick={() => setBudgetUsd(amount)}>${amount}</button>)}</fieldset>
    <div className="scenario-outcomes" aria-live="polite"><div><span>Planned loss at stop</span><strong>−{dollars(sizing.maxCapitalAtRiskCents)}</strong></div><div><span>If target is reached</span><strong>{dollars(targetGain)}</strong></div></div>
    <p className="scenario-sizing">{sizing.shares} shares · {dollars(sizing.committedCents)} allocated · {dollars(sizing.uncommittedCents)} left. Before fees and slippage; stop fills are not guaranteed.</p>
    <details><summary>Read the premise & sample basis</summary><p>{play.catalyst.summary}</p><p>Sample attribution: {play.catalyst.source}. Not independently verified here.</p><p>Sample price {dollars(play.currentPriceCents)} · spread {play.spreadPct.toFixed(2)}% · volume {(play.dailyVolume / 1_000_000).toFixed(1)}M. These are fixture inputs, not market quotes.</p></details>
    {play.backtest && <details><summary>Illustrative sample results—not a backtest</summary><p>Sample win rate {play.backtest.winRatePct}% · drawdown {play.backtest.maxDrawdownPct}% · {play.backtest.sampleOccurrences} sample events · profit factor {play.backtest.profitFactor}× · average holding {play.backtest.avgHoldingDays} days · sample return per dollar ${play.backtest.expectedReturnPerDollar}.</p><p>Fixed illustrative data. No verified historical performance or expected return is established.</p></details>}
    <footer id={`example-only-${play.id}`}>Unverified sample data. Use Micro Plays for reviewed research and separate paper-order approval.</footer>
    <button className="scenario-order-unavailable" type="button" disabled aria-describedby={`example-only-${play.id}`}>Example only · order unavailable</button>
  </article>;
};
