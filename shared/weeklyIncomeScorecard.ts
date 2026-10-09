/**
 * Weekly Income scorecard v1 (#86, thesis §9). Pure: takes position records
 * (paper fills or modeled counterfactuals) and returns every metric with its
 * basis and asOf. A missing input is "Not measured: <reason>", never 0.
 * Paper-fill and counterfactual rows are never mixed in one scorecard.
 */
import { formatPct, formatUsdCents } from "./weeklyIncome/spreadMath";
import { WI_COPY, wiCopy } from "./weeklyIncome/copy";

export type WiBasis = "paper_fill" | "counterfactual";
export type WiExitReason = "take_profit" | "stop" | "time_exit" | "strike_breach" | "assignment" | "manual";

export type WiPositionRecord = {
  id: string;
  underlying: string;
  basis: WiBasis;
  openedAt: number;
  closedAt: number | null;
  contracts: number;
  /** Opening credit per share, cents. */
  openingCreditCents: number;
  /** Closing debit per share, cents; null while open. */
  closingDebitCents: number | null;
  /** Current cost to close per share, cents, for open positions; null = not measured. */
  markDebitCents: number | null;
  markAsOf: number | null;
  /** Stated maximum loss for the whole position, cents (P1: width − credit + allowances). */
  maxLossCents: number;
  feesCents: number;
  exitReason: WiExitReason | null;
};

export type WiWeekInput = {
  /** Monday of the ET week, YYYY-MM-DD. */
  weekOf: string;
  weekStartMs: number;
  weekEndMs: number;
  mondayEquityCents: number | null;
  mondayEquityAsOf: number | null;
  positions: WiPositionRecord[];
  skippedReasons: string[];
  asOf: number;
};

export type WiMetric = {
  key: string;
  label: string;
  value: number | null;
  display: string;
  basis: WiBasis;
  asOf: number;
  /** Plain one-line explanation for Quick Play. */
  plain: string;
};

const NM = (reason: string) => `Not measured: ${reason}`;
const positionPnlCents = (p: WiPositionRecord, debit: number) => (p.openingCreditCents - debit) * 100 * p.contracts - p.feesCents;
const pct2 = (ratio: number) => formatPct(ratio * 100);

export function buildWeeklyIncomeScorecard(week: WiWeekInput, basis: WiBasis) {
  const positions = week.positions.filter((p) => p.basis === basis);
  const metric = (key: string, label: string, value: number | null, display: string, plain: string): WiMetric => ({ key, label, value, display, basis, asOf: week.asOf, plain });
  const closed = positions.filter((p) => p.closedAt != null && p.closingDebitCents != null);
  const open = positions.filter((p) => p.closedAt == null);
  const equity = week.mondayEquityCents != null && week.mondayEquityCents > 0 ? week.mondayEquityCents : null;

  const gross = positions.reduce((sum, p) => sum + p.openingCreditCents * 100 * p.contracts, 0);
  const paidToClose = closed.reduce((sum, p) => sum + (p.closingDebitCents ?? 0) * 100 * p.contracts, 0);
  const closedPnls = closed.map((p) => ({ p, pnl: positionPnlCents(p, p.closingDebitCents!) }));
  const netKept = closedPnls.reduce((sum, x) => sum + x.pnl, 0);

  // Time-weighted capital at risk and peak committed max loss over the week window.
  const span = week.weekEndMs - week.weekStartMs;
  const clip = (t: number) => Math.min(Math.max(t, week.weekStartMs), week.weekEndMs);
  const weighted = positions.reduce((sum, p) => sum + p.maxLossCents * (clip(p.closedAt ?? week.asOf) - clip(p.openedAt)), 0);
  const avgAtRisk = span > 0 ? Math.round(weighted / span) : null;
  const events = positions.flatMap((p) => [{ t: p.openedAt, d: p.maxLossCents }, { t: p.closedAt ?? Infinity, d: -p.maxLossCents }]).sort((a, b) => a.t - b.t || a.d - b.d);
  let running = 0;
  let peak = 0;
  for (const e of events) { running += e.d; peak = Math.max(peak, running); }

  const unmarked = open.filter((p) => p.markDebitCents == null);
  const weekPnl = unmarked.length ? null : netKept + open.reduce((sum, p) => sum + positionPnlCents(p, p.markDebitCents!), 0);
  const roa = weekPnl != null && equity != null ? weekPnl / equity : null;
  const roaReason = equity == null ? "Monday's measured account value" : unmarked.length ? `current price for ${unmarked.map((p) => p.underlying).join(", ")}` : "";

  const wins = closedPnls.filter((x) => x.pnl > 0);
  const losses = closedPnls.filter((x) => x.pnl < 0);
  const avgWin = wins.length ? wins.reduce((s, x) => s + x.pnl, 0) / wins.length : null;
  const avgLoss = losses.length ? -losses.reduce((s, x) => s + x.pnl, 0) / losses.length : null;
  const avgWinX = wins.length ? wins.reduce((s, x) => s + x.pnl / (x.p.openingCreditCents * 100 * x.p.contracts), 0) / wins.length : null;
  const avgLossX = losses.length ? -losses.reduce((s, x) => s + x.pnl / (x.p.openingCreditCents * 100 * x.p.contracts), 0) / losses.length : null;
  const winRate = closed.length ? wins.length / closed.length : null;
  const breakevenWinRate = avgWin != null && avgLoss != null ? avgLoss / (avgWin + avgLoss) : null;
  const worst = losses.length ? losses.reduce((a, b) => (b.pnl < a.pnl ? b : a)) : null;
  const exits = (reason: WiExitReason) => closed.filter((p) => p.exitReason === reason).length;
  const reasonCounts = Object.entries(week.skippedReasons.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r]: (acc[r] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);

  const simpleAnnual = roa != null ? roa * 52 : null;
  const compoundAnnual = roa != null ? Math.pow(1 + roa, 52) - 1 : null;
  const usd = formatUsdCents;

  const metrics: WiMetric[] = [
    metric("gross_premium", "Premium collected (gross)", gross, usd(gross), "Total paid to you up front when trades opened."),
    metric("paid_to_close", "Paid to close", paidToClose, usd(paidToClose), "Total you paid to end trades early or on the planned day."),
    metric("net_kept", "Net premium kept", netKept, usd(netKept), "What closed trades kept after paying to close and fees."),
    metric("avg_capital_at_risk", "Capital at risk (average)", avgAtRisk, avgAtRisk == null ? NM("week window") : usd(avgAtRisk), "The most you could have lost, averaged over the week."),
    metric("peak_max_loss_pct", "Max loss committed (peak)", equity == null ? null : peak / equity, equity == null ? NM("Monday's measured account value") : `${usd(peak)} · ${pct2(peak / equity)}`, "The largest total you could have lost at any one moment."),
    metric("return_on_capital_at_risk", "Return on capital at risk", avgAtRisk ? netKept / avgAtRisk : null, avgAtRisk ? pct2(netKept / avgAtRisk) : NM("capital at risk"), "What was kept compared with what was at risk."),
    metric("return_on_account", "Return on account", roa, roa == null ? NM(roaReason) : pct2(roa), "This week's gain or loss compared with your whole practice balance on Monday."),
    metric("annualized_simple", "Annualized (simple, ×52)", simpleAnnual, simpleAnnual == null ? NM(roaReason) : pct2(simpleAnnual), "Arithmetic only, not a forecast."),
    metric("annualized_compound", "Annualized (compound)", compoundAnnual, compoundAnnual == null ? NM(roaReason) : pct2(compoundAnnual), "Arithmetic only, not a forecast."),
    metric("win_rate", "Win rate", winRate, winRate == null ? NM("no closed positions") : pct2(winRate), "Share of closed trades that made money."),
    metric("avg_win", "Average win", avgWin, avgWin == null ? NM("no winning positions") : `${usd(Math.round(avgWin))} · ${avgWinX!.toFixed(2)}× credit`, "The typical gain on a trade that made money."),
    metric("avg_loss", "Average loss", avgLoss, avgLoss == null ? NM("no losing positions") : `${usd(Math.round(avgLoss))} · ${avgLossX!.toFixed(2)}× credit`, "The typical loss on a trade that lost money."),
    metric("breakeven_win_rate", "Breakeven win rate", breakevenWinRate, breakevenWinRate == null ? NM("needs at least one win and one loss") : pct2(breakevenWinRate), "The win rate needed just to break even, given the sizes of wins and losses."),
    metric("worst_position", "Worst position", worst ? worst.pnl : null, worst ? `${worst.p.underlying} ${usd(worst.pnl)}${equity ? ` · ${pct2(-worst.pnl / equity)}` : ""} · ${-worst.pnl > worst.p.maxLossCents ? "exceeded stated max" : "within stated max"}` : NM("no losing positions"), "The biggest single loss, and whether it stayed within its stated maximum."),
    metric("exits", "Closed at take profit / stop / time exit", closed.length, closed.length ? `${exits("take_profit")} / ${exits("stop")} / ${exits("time_exit")}${exits("assignment") ? ` · ${exits("assignment")} assigned` : ""}` : NM("no closed positions"), "How trades ended."),
    metric("skipped_by_rule", "Skipped by rule", week.skippedReasons.length, `${week.skippedReasons.length}${reasonCounts.length ? ` · top: ${reasonCounts.slice(0, 3).map(([r, n]) => `${r} (${n})`).join(", ")}` : ""}`, "Ideas the plan's rules turned away."),
  ];

  const guided = {
    headline: roa == null || avgAtRisk == null
      ? `This week's return isn't measured yet: ${equity == null ? "we don't have your practice balance from Monday" : unmarked.length ? `we don't have a current price for ${unmarked.map((p) => p.underlying).join(", ")}` : "the week window is missing"}. Trades that closed kept ${usd(netKept)} after paying to close.`
      : wiCopy(basis === "counterfactual" ? "wi.guided.scorecard.headlineCounterfactual" : "wi.guided.scorecard.headline", { direction: roa >= 0 ? "gained" : "lost", weekReturn: pct2(Math.abs(roa)), netPremium: usd(netKept), capitalAtRisk: usd(avgAtRisk) }),
    winRate: winRate != null && breakevenWinRate != null ? wiCopy("wi.guided.scorecard.winRate", { winRate: pct2(winRate), breakevenWinRate: pct2(breakevenWinRate) }) : null,
    worst: worst ? wiCopy("wi.guided.scorecard.worst", { worstLoss: usd(-worst.pnl), symbol: worst.p.underlying, worstPct: equity ? pct2(-worst.pnl / equity) : "an unmeasured share", withinMax: -worst.pnl > worst.p.maxLossCents ? "That was more than its stated maximum loss, which needs review." : "That stayed within its stated maximum loss." }) : null,
    endings: closed.length ? wiCopy("wi.guided.scorecard.endings", { takeProfit: String(exits("take_profit")), stop: String(exits("stop")), timeExit: String(exits("time_exit")) }) : null,
  };

  return {
    weekOf: week.weekOf,
    basis,
    basisLabel: basis === "counterfactual" ? WI_COPY["wi.scorecard.counterfactual"] : "Paper fills",
    asOf: week.asOf,
    returnOnAccount: roa,
    metrics,
    headline: roa != null && avgAtRisk != null ? wiCopy("wi.scorecard.headline", { weekReturn: pct2(roa), netPremium: usd(netKept), capitalAtRisk: usd(avgAtRisk) }) : null,
    annualized: roa != null ? wiCopy("wi.scorecard.annualized", { weekReturn: pct2(roa), simpleAnnual: pct2(simpleAnnual!), compoundAnnual: pct2(compoundAnnual!) }) : null,
    sampleLimit: wiCopy("wi.scorecard.sample", { n: String(closed.length) }),
    guided,
  };
}

export type WeeklyIncomeScorecard = ReturnType<typeof buildWeeklyIncomeScorecard>;

/** Across weeks of one basis: worst week and max drawdown of the compounded weekly return on account. */
export function weeklyIncomeHistory(weeks: Array<{ weekOf: string; returnOnAccount: number | null }>) {
  const measured = weeks.filter((w) => w.returnOnAccount != null) as Array<{ weekOf: string; returnOnAccount: number }>;
  if (!measured.length) return { worstWeek: null, maxDrawdown: null, display: { worstWeek: NM("no measured week"), maxDrawdown: NM("no measured week") }, unmeasuredWeeks: weeks.length };
  const worst = measured.reduce((a, b) => (b.returnOnAccount < a.returnOnAccount ? b : a));
  let level = 1;
  let peak = 1;
  let maxDd = 0;
  for (const w of measured) {
    level *= 1 + w.returnOnAccount;
    peak = Math.max(peak, level);
    maxDd = Math.max(maxDd, 1 - level / peak);
  }
  return {
    worstWeek: worst,
    maxDrawdown: maxDd,
    display: { worstWeek: `${pct2(worst.returnOnAccount)} (week of ${worst.weekOf})`, maxDrawdown: pct2(maxDd) },
    unmeasuredWeeks: weeks.length - measured.length,
  };
}
