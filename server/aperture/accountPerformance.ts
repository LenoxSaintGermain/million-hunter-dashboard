import { etClock, isMarketHoliday, startOfEtDay } from "./marketSession";
import { EDGE_SAMPLE_FLOOR, INDICATIVE_SAMPLE_FLOOR } from "./scorecard";

/**
 * Pure maths for the Performance view. No DB, no clock reads: every input is passed
 * in so the numbers can be tested against fixed fixtures. Anything that cannot be
 * measured is null and renders as "Not measured", never as zero.
 */

/** Plan target = entry + this many times the risked distance (entry - stop). */
export const PLAN_TARGET_R = 2.5;
const QTY_EPSILON = 1e-9;
const DAY_MS = 86_400_000;

export interface PerfOrder {
  id: number;
  symbol: string;
  side: "buy" | "sell";
  filledQty: number | null;
  filledAvgPriceCents: number | null;
  entryPriceCents: number | null;
  stopPriceCents: number | null;
  plannedRiskCents: number | null;
  multiplier: number;
  thesisName: string | null;
  filledAt: number | null;
}

export interface PerfPosition {
  symbol: string;
  qty: number;
  multiplier: number;
  avgCostCents: number | null;
  lastPriceCents: number | null;
  marketValueCents: number | null;
}

export interface ClosedPlay {
  symbol: string;
  thesis: string;
  openedAt: number | null;
  closedAt: number | null;
  plannedLossCents: number | null;
  resultCents: number;
  /** result / planned loss recorded on the order; null when no loss was recorded. */
  r: number | null;
}

export interface OpenPlayContext {
  symbol: string;
  thesis: string;
  entryCents: number | null;
  stopCents: number | null;
  plannedLossCents: number | null;
}

export interface OrderWalk {
  closedPlays: ClosedPlay[];
  openContexts: Map<string, OpenPlayContext>;
  realizedCents: number;
  /** Sells with no known buy in this record (cost basis not held by the app). */
  unattributedSells: number;
}

export const UNTITLED_THESIS = "No thesis recorded";

/** Average-cost walk over filled orders, the same rule as the practice ledger. */
export function walkFilledOrders(orders: PerfOrder[]): OrderWalk {
  type Play = { thesis: string; openedAt: number | null; planned: number | null; plannedMissing: boolean; realized: number; entries: { qty: number; entry: number | null; stop: number | null }[] };
  const state = new Map<string, { qty: number; cost: number; play: Play | null }>();
  const closedPlays: ClosedPlay[] = [];
  let realized = 0;
  let unattributedSells = 0;

  for (const order of [...orders].sort((a, b) => a.id - b.id)) {
    const filled = Math.max(0, order.filledQty ?? 0);
    if (filled <= 0 || order.filledAvgPriceCents == null) continue;
    const symbol = order.symbol.toUpperCase();
    const s = state.get(symbol) ?? { qty: 0, cost: 0, play: null };
    state.set(symbol, s);

    if (order.side === "buy") {
      if (s.qty <= QTY_EPSILON || !s.play) {
        s.qty = Math.max(0, s.qty);
        s.play = { thesis: order.thesisName ?? UNTITLED_THESIS, openedAt: order.filledAt, planned: 0, plannedMissing: false, realized: 0, entries: [] };
      }
      s.qty += filled;
      s.cost += filled * order.filledAvgPriceCents;
      if (order.plannedRiskCents == null || order.plannedRiskCents <= 0) s.play.plannedMissing = true;
      else s.play.planned = (s.play.planned ?? 0) + order.plannedRiskCents;
      s.play.entries.push({ qty: filled, entry: order.entryPriceCents ?? order.filledAvgPriceCents, stop: order.stopPriceCents });
    } else {
      if (s.qty <= QTY_EPSILON || !s.play) { unattributedSells += 1; continue; }
      const sold = Math.min(filled, s.qty);
      const avg = s.cost / s.qty;
      const pnl = (order.filledAvgPriceCents - avg) * sold * order.multiplier;
      realized += pnl;
      s.play.realized += pnl;
      s.cost -= avg * sold;
      s.qty -= sold;
      if (s.qty <= QTY_EPSILON) {
        const planned = s.play.plannedMissing ? null : s.play.planned;
        const result = Math.round(s.play.realized);
        closedPlays.push({
          symbol, thesis: s.play.thesis, openedAt: s.play.openedAt, closedAt: order.filledAt,
          plannedLossCents: planned, resultCents: result,
          r: planned && planned > 0 ? result / planned : null,
        });
        s.play = null; s.qty = 0; s.cost = 0;
      }
    }
  }

  const openContexts = new Map<string, OpenPlayContext>();
  for (const [symbol, s] of Array.from(state.entries())) {
    if (s.qty <= QTY_EPSILON || !s.play) continue;
    const priced = s.play.entries.filter((e) => e.entry != null);
    const totalQty = priced.reduce((sum, e) => sum + e.qty, 0);
    const entry = totalQty > 0 ? priced.reduce((sum, e) => sum + e.qty * (e.entry as number), 0) / totalQty : null;
    const stopped = [...s.play.entries].reverse().find((e) => e.stop != null);
    openContexts.set(symbol, {
      symbol, thesis: s.play.thesis, entryCents: entry, stopCents: stopped?.stop ?? null,
      plannedLossCents: s.play.plannedMissing ? null : s.play.planned,
    });
  }
  return { closedPlays, openContexts, realizedCents: Math.round(realized), unattributedSells };
}

export interface OpenPlayOutcome {
  symbol: string;
  thesis: string | null;
  qty: number;
  entryCents: number | null;
  lastCents: number | null;
  stopCents: number | null;
  targetCents: number | null;
  /** Counted in the account totals only when stop, target and last price are all known. */
  counted: boolean;
  uncountedReason: string | null;
  unrealizedCents: number | null;
  rNow: number | null;
  plannedLossCents: number | null;
  atStopFromHereCents: number | null;
  atTargetFromHereCents: number | null;
}

export interface PlanOutcomes {
  plays: OpenPlayOutcome[];
  countedCount: number;
  uncountedSymbols: string[];
  unrealizedCents: number | null;
  plannedLossCents: number | null;
  atStopFromHereCents: number | null;
  atTargetFromHereCents: number | null;
}

export function computePlanOutcomes(positions: PerfPosition[], contexts: Map<string, OpenPlayContext>): PlanOutcomes {
  const plays: OpenPlayOutcome[] = [];
  for (const p of positions) {
    if (p.qty <= QTY_EPSILON) continue;
    const symbol = p.symbol.toUpperCase();
    const ctx = contexts.get(symbol) ?? null;
    const m = p.multiplier;
    const last = p.lastPriceCents;
    const avg = p.avgCostCents;
    const unrealized = last != null && avg != null ? Math.round((last - avg) * p.qty * m) : null;
    const entry = ctx?.entryCents ?? null;
    const stop = ctx?.stopCents ?? null;
    const risk = entry != null && stop != null ? entry - stop : null;
    const target = entry != null && risk != null && risk > 0 ? Math.round(entry + PLAN_TARGET_R * risk) : null;
    let reason: string | null = null;
    if (!ctx) reason = "No plan levels saved";
    else if (stop == null || entry == null) reason = "No stop saved";
    else if (risk == null || risk <= 0) reason = "Stop is not below the entry";
    else if (last == null) reason = "No price from the last sync";
    const counted = reason == null && target != null && last != null;
    plays.push({
      symbol, thesis: ctx?.thesis ?? null, qty: p.qty, entryCents: entry, lastCents: last, stopCents: stop, targetCents: target,
      counted, uncountedReason: reason, unrealizedCents: unrealized,
      rNow: counted && last != null && entry != null && risk ? (last - entry) / risk : null,
      plannedLossCents: counted ? ctx?.plannedLossCents ?? null : null,
      atStopFromHereCents: counted && last != null && stop != null ? Math.round((stop - last) * p.qty * m) : null,
      atTargetFromHereCents: counted && last != null && target != null ? Math.round((target - last) * p.qty * m) : null,
    });
  }
  const counted = plays.filter((p) => p.counted);
  const sum = (pick: (p: OpenPlayOutcome) => number | null) =>
    counted.length && counted.every((p) => pick(p) != null) ? counted.reduce((acc, p) => acc + (pick(p) as number), 0) : null;
  return {
    plays,
    countedCount: counted.length,
    uncountedSymbols: plays.filter((p) => !p.counted).map((p) => p.symbol),
    unrealizedCents: sum((p) => p.unrealizedCents),
    plannedLossCents: sum((p) => p.plannedLossCents),
    atStopFromHereCents: sum((p) => p.atStopFromHereCents),
    atTargetFromHereCents: sum((p) => p.atTargetFromHereCents),
  };
}

/** Unrealized across every holding the last sync priced; null if any holding is unpriced. */
export function totalUnrealizedCents(positions: PerfPosition[]): number | null {
  const held = positions.filter((p) => p.qty > QTY_EPSILON);
  if (!held.length) return 0;
  let total = 0;
  for (const p of held) {
    if (p.lastPriceCents == null || p.avgCostCents == null) return null;
    total += (p.lastPriceCents - p.avgCostCents) * p.qty * p.multiplier;
  }
  return Math.round(total);
}

export type SampleLabel = "process_only" | "indicative" | "edge_capable";

export interface ThesisResult { thesis: string; plays: number; pnlCents: number; wins: number; avgR: number | null; avgWinCents: number | null; avgLossCents: number | null }

export interface ClosedPlayStats {
  closed: number;
  wins: number;
  winRate: number | null;
  avgR: number | null;
  avgWinCents: number | null;
  /** Positive magnitude of the average losing play. */
  avgLossCents: number | null;
  best: ClosedPlay | null;
  worst: ClosedPlay | null;
  byThesis: ThesisResult[];
  sample: SampleLabel;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function summarizeClosedPlays(plays: ClosedPlay[]): ClosedPlayStats {
  const stat = (list: ClosedPlay[]) => {
    const wins = list.filter((p) => p.resultCents > 0);
    const losses = list.filter((p) => p.resultCents < 0);
    const rs = list.map((p) => p.r).filter((r): r is number => r != null);
    const w = mean(wins.map((p) => p.resultCents));
    const l = mean(losses.map((p) => -p.resultCents));
    return { wins: wins.length, avgR: mean(rs), avgWinCents: w == null ? null : Math.round(w), avgLossCents: l == null ? null : Math.round(l) };
  };
  const base = stat(plays);
  const sorted = [...plays].sort((a, b) => b.resultCents - a.resultCents);
  const groups = new Map<string, ClosedPlay[]>();
  for (const p of plays) groups.set(p.thesis, [...(groups.get(p.thesis) ?? []), p]);
  const byThesis = Array.from(groups.entries()).map(([thesis, list]) => ({
    thesis, plays: list.length, pnlCents: list.reduce((a, p) => a + p.resultCents, 0), ...stat(list),
  })).sort((a, b) => b.pnlCents - a.pnlCents);
  return {
    closed: plays.length,
    wins: base.wins,
    winRate: plays.length ? base.wins / plays.length : null,
    avgR: base.avgR,
    avgWinCents: base.avgWinCents,
    avgLossCents: base.avgLossCents,
    best: sorted[0] ?? null,
    worst: sorted.length ? sorted[sorted.length - 1] : null,
    byThesis,
    sample: plays.length >= EDGE_SAMPLE_FLOOR ? "edge_capable" : plays.length >= INDICATIVE_SAMPLE_FLOOR ? "indicative" : "process_only",
  };
}

export interface EquityPoint { takenAt: number; equityCents: number }

export interface DeltaWindow {
  deltaCents: number | null;
  /** The saved sync the change is measured from; null when there is nothing to compare. */
  fromAt: number | null;
}

export interface Headline {
  equityCents: number | null;
  asOf: number | null;
  today: DeltaWindow;
  thisWeek: DeltaWindow;
  sinceStart: DeltaWindow & { startingCents: number | null };
}

/** Epoch ms of the most recent Monday 00:00 ET at or before `now`. */
export function startOfEtWeek(now: number): number | null {
  const clock = etClock(now);
  const dayStart = startOfEtDay(now);
  if (!clock || dayStart == null) return null;
  const sinceMonday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(clock.weekday);
  if (sinceMonday < 0) return null;
  // Aim at midday so a DST change inside the week cannot land on the wrong date.
  return startOfEtDay(dayStart - sinceMonday * DAY_MS + 12 * 3_600_000);
}

export function computeHeadline(input: {
  points: EquityPoint[];
  now: number;
  startingCashCents: number | null;
  startingAt: number | null;
}): Headline {
  const points = [...input.points].sort((a, b) => a.takenAt - b.takenAt);
  const latest = points[points.length - 1] ?? null;
  const from = (since: number | null): DeltaWindow => {
    if (!latest || since == null) return { deltaCents: null, fromAt: null };
    const first = points.find((p) => p.takenAt >= since);
    // Needs an earlier saved sync inside the window; the latest alone is no comparison.
    if (!first || first.takenAt >= latest.takenAt) return { deltaCents: null, fromAt: null };
    return { deltaCents: latest.equityCents - first.equityCents, fromAt: first.takenAt };
  };
  const first = points[0] ?? null;
  const sinceStart: Headline["sinceStart"] = input.startingCashCents != null && latest
    ? { deltaCents: latest.equityCents - input.startingCashCents, fromAt: input.startingAt, startingCents: input.startingCashCents }
    : latest && first && first.takenAt < latest.takenAt
      ? { deltaCents: latest.equityCents - first.equityCents, fromAt: first.takenAt, startingCents: first.equityCents }
      : { deltaCents: null, fromAt: null, startingCents: null };
  return {
    equityCents: latest?.equityCents ?? null,
    asOf: latest?.takenAt ?? null,
    today: from(startOfEtDay(input.now)),
    thisWeek: from(startOfEtWeek(input.now)),
    sinceStart,
  };
}

export interface SeriesGap { fromDateEt: string; toDateEt: string }

const dateOf = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * A gap is a run of market days (Mon-Fri, not a holiday) with no saved sync between two
 * saved points. Weekends, holidays and overnight are not gaps.
 */
export function findSeriesGaps(points: EquityPoint[]): SeriesGap[] {
  const sorted = [...points].sort((a, b) => a.takenAt - b.takenAt);
  const gaps: SeriesGap[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = etClock(sorted[i - 1].takenAt)?.dateEt;
    const b = etClock(sorted[i].takenAt)?.dateEt;
    if (!a || !b) continue;
    let run: string[] = [];
    const flush = () => { if (run.length) gaps.push({ fromDateEt: run[0], toDateEt: run[run.length - 1] }); run = []; };
    for (let t = dateOf(a) + DAY_MS; t < dateOf(b); t += DAY_MS) {
      const iso = isoOf(t);
      const dow = new Date(t).getUTCDay();
      if (dow === 0 || dow === 6 || isMarketHoliday(iso)) continue;
      run.push(iso);
    }
    flush();
  }
  return gaps;
}
