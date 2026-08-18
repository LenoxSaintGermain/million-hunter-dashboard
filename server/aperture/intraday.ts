/**
 * Intraday tape structure — session VWAP, the opening range, and the honesty
 * label that has to travel with both.
 *
 * WHY THIS FILE HAS A LATENCY FIELD IN EVERY RETURN TYPE
 *
 * Measured against the live Alpaca key on 2026-08-18, XHB, 10:24 ET:
 *
 *   feed=iex   12,317 shares on the day   ~1 min behind   (real-time, 4.8% of tape)
 *   feed=sip  255,439 shares on the day   15 min behind   (consolidated, delayed)
 *
 * Both carry a per-bar `vw`, so VWAP is arithmetic, not a missing data type.
 * But the two feeds produce genuinely different numbers: a VWAP built from IEX
 * prints alone is not the VWAP any other participant is looking at, and a
 * consolidated VWAP that is fifteen minutes old is not the VWAP the market is
 * trading against right now. Either can be the right input — neither can be
 * presented as "the VWAP" without saying which one it is.
 *
 * So every figure here carries `feed`, `asOf` and `lagMs`, and a trigger
 * evaluated against a stale or partial tape is labelled `stale` or
 * `partial_tape` rather than answered yes/no as though it were live. The
 * operator confirms the trigger on their own real-time terminal until the
 * account is upgraded to real-time SIP; when it is, `feed` becomes "sip" with a
 * sub-minute lag and the labels resolve themselves. Nothing else changes.
 *
 * PURE. Bars come in, structure comes out. No network, no clock, no database —
 * the fetching lives in providers/marketData.ts.
 */

// ── Inputs ────────────────────────────────────────────────────────────────────

/** One minute bar, in the shape every provider we use already returns. */
export interface MinuteBar {
  /** Bar start, epoch ms. */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  /** Volume in shares. */
  v: number;
  /** The bar's own volume-weighted average price. */
  vw?: number | null;
}

export type TapeFeed = "sip" | "iex" | "unknown";

export interface TapeContext {
  feed: TapeFeed;
  /** Timestamp of the newest bar used. */
  asOf: number | null;
  /** How far behind the reference clock that bar is. */
  lagMs: number | null;
}

/** Anything above this and an intraday trigger is being judged on old news. */
export const STALE_LAG_MS = 2 * 60_000;

// ── Session VWAP ──────────────────────────────────────────────────────────────

export interface SessionVwap {
  /** Cumulative VWAP from the session open through the last bar used. */
  vwap: number | null;
  /** Shares traded across the bars that fed it. */
  cumulativeVolume: number;
  barCount: number;
  /** First and last bar timestamps actually included. */
  fromAt: number | null;
  throughAt: number | null;
  feed: TapeFeed;
  asOf: number | null;
  lagMs: number | null;
  /**
   * How each bar's price was taken: the provider's own `vw` where present,
   * the typical price (h+l+c)/3 where it is not, or a mix. Stated because a
   * VWAP built from typical prices is a close approximation, not the same number.
   */
  priceBasis: "provider_vw" | "typical_price" | "mixed" | "none";
  /** Null when there is nothing to compute from, with the reason.  */
  unavailableReason: string | null;
}

const typicalPrice = (b: MinuteBar): number => (b.h + b.l + b.c) / 3;

/**
 * Cumulative session VWAP: sum(price x volume) / sum(volume) across the bars.
 *
 * Zero-volume bars are skipped rather than treated as a zero-price print — a
 * minute with no trades says nothing about where value traded.
 */
export function sessionVwap(
  bars: MinuteBar[],
  ctx: { feed: TapeFeed; now: number },
): SessionVwap {
  const usable = bars.filter((b) => Number.isFinite(b.v) && b.v > 0).sort((a, b) => a.t - b.t);

  const base = {
    cumulativeVolume: 0,
    barCount: 0,
    fromAt: null,
    throughAt: null,
    feed: ctx.feed,
    asOf: null,
    lagMs: null,
  } as const;

  if (!usable.length) {
    return {
      ...base,
      vwap: null,
      priceBasis: "none",
      unavailableReason: bars.length
        ? "every bar in the window had zero volume — no trade printed, so no VWAP exists yet"
        : "no bars were returned for this session window",
    };
  }

  let pv = 0;
  let volume = 0;
  let usedVw = 0;
  let usedTypical = 0;

  for (const b of usable) {
    const price = b.vw != null && Number.isFinite(b.vw) && b.vw > 0 ? (usedVw++, b.vw) : (usedTypical++, typicalPrice(b));
    if (!Number.isFinite(price) || price <= 0) continue;
    pv += price * b.v;
    volume += b.v;
  }

  if (volume <= 0) {
    return {
      ...base,
      vwap: null,
      priceBasis: "none",
      unavailableReason: "no usable price on any bar in the window",
    };
  }

  const last = usable[usable.length - 1]!;
  return {
    vwap: pv / volume,
    cumulativeVolume: volume,
    barCount: usable.length,
    fromAt: usable[0]!.t,
    throughAt: last.t,
    feed: ctx.feed,
    asOf: last.t,
    lagMs: Math.max(0, ctx.now - last.t),
    priceBasis: usedVw && usedTypical ? "mixed" : usedVw ? "provider_vw" : "typical_price",
    unavailableReason: null,
  };
}

// ── Opening range ─────────────────────────────────────────────────────────────

export interface OpeningRange {
  high: number | null;
  low: number | null;
  /** high − low. Null when the range is not established. */
  widthCents: number | null;
  /** Width as a percentage of the low — the "opening range wider than ~4%" skip. */
  widthPct: number | null;
  volume: number;
  barCount: number;
  minutes: number;
  openedAt: number | null;
  /** When the range window closes. The range is not final before this. */
  completesAt: number | null;
  /** False while the window is still filling — a partial range is not a range. */
  complete: boolean;
  feed: TapeFeed;
  asOf: number | null;
  lagMs: number | null;
  unavailableReason: string | null;
}

/**
 * High and low of the first N minutes of the regular session.
 *
 * `complete` is the field that matters. Jim's post-earnings recipe says "wait
 * through the first 30 minutes" — acting on a range that is still forming is
 * the mistake the recipe exists to prevent, so a partial window returns its
 * figures WITH complete:false rather than pretending to be finished. On a
 * 15-minute-delayed feed a 30-minute range is not knowable until 10:15 ET, and
 * `lagMs` is what says so.
 */
export function openingRange(
  bars: MinuteBar[],
  ctx: { sessionOpenAt: number; minutes: number; feed: TapeFeed; now: number },
): OpeningRange {
  const { sessionOpenAt, minutes, feed, now } = ctx;
  const windowEnd = sessionOpenAt + minutes * 60_000;

  const empty = {
    high: null, low: null, widthCents: null, widthPct: null,
    volume: 0, barCount: 0, minutes,
    openedAt: sessionOpenAt, completesAt: windowEnd,
    complete: false, feed, asOf: null, lagMs: null,
  };

  if (minutes <= 0) {
    return { ...empty, unavailableReason: "an opening range needs a positive window" };
  }

  const inWindow = bars
    .filter((b) => b.t >= sessionOpenAt && b.t < windowEnd && Number.isFinite(b.v) && b.v > 0)
    .sort((a, b) => a.t - b.t);

  if (!inWindow.length) {
    return {
      ...empty,
      unavailableReason: now < sessionOpenAt
        ? "the session has not opened yet"
        : "no bars printed inside the opening-range window",
    };
  }

  let high = -Infinity;
  let low = Infinity;
  let volume = 0;
  for (const b of inWindow) {
    if (Number.isFinite(b.h)) high = Math.max(high, b.h);
    if (Number.isFinite(b.l)) low = Math.min(low, b.l);
    volume += b.v;
  }
  if (!Number.isFinite(high) || !Number.isFinite(low) || low <= 0) {
    return { ...empty, unavailableReason: "bars in the window carried no usable high/low" };
  }

  const last = inWindow[inWindow.length - 1]!;
  // The window is only complete once the tape we can SEE has passed its end —
  // on a delayed feed that is later than the wall clock says.
  const observedThrough = last.t + 60_000;
  const complete = observedThrough >= windowEnd;

  return {
    high,
    low,
    widthCents: Math.round((high - low) * 100),
    widthPct: ((high - low) / low) * 100,
    volume,
    barCount: inWindow.length,
    minutes,
    openedAt: sessionOpenAt,
    completesAt: windowEnd,
    complete,
    feed,
    asOf: last.t,
    lagMs: Math.max(0, now - last.t),
    unavailableReason: complete
      ? null
      : `the opening range is still forming — bars observed through ${new Date(observedThrough).toISOString()}, window closes ${new Date(windowEnd).toISOString()}`,
  };
}

// ── Trigger evaluation ────────────────────────────────────────────────────────

/**
 * A VWAP condition is answered three ways, not two. `unknown` is a real answer
 * and the most common one on a delayed feed — treating it as `false` would let
 * a stale tape veto a live setup, and treating it as `true` would be worse.
 */
export type TriggerState = "confirmed" | "rejected" | "unknown";

export interface VwapHoldCheck {
  state: TriggerState;
  /** Consecutive minutes the price has held the required side of VWAP. */
  minutesHeld: number;
  minutesRequired: number;
  vwap: number | null;
  lastPrice: number | null;
  feed: TapeFeed;
  lagMs: number | null;
  /** True when the tape is too old or too thin to settle the question. */
  needsOperatorConfirmation: boolean;
  /** Always populated — the sentence the ticket renders under the trigger. */
  basis: string;
}

/**
 * "Only after a 15-minute hold above VWAP."
 *
 * Returns `unknown` — and asks for operator confirmation — when the tape is
 * stale or partial, because that is the honest answer. The operator's own
 * real-time terminal settles it until the feed is upgraded.
 */
export function checkVwapHold(
  bars: MinuteBar[],
  vwap: SessionVwap,
  opts: { side: "above" | "below"; minutesRequired: number; now: number },
): VwapHoldCheck {
  const { side, minutesRequired, now } = opts;
  const partialTape = vwap.feed === "iex";
  const lagMs = vwap.lagMs;
  const stale = lagMs == null || lagMs > STALE_LAG_MS;

  const sorted = bars
    .filter((b) => Number.isFinite(b.c) && b.c > 0 && Number.isFinite(b.v) && b.v > 0)
    .sort((a, b) => a.t - b.t);
  const lastPrice = sorted.length ? sorted[sorted.length - 1]!.c : null;

  if (vwap.vwap == null || !sorted.length) {
    return {
      state: "unknown",
      minutesHeld: 0,
      minutesRequired,
      vwap: vwap.vwap,
      lastPrice,
      feed: vwap.feed,
      lagMs,
      needsOperatorConfirmation: true,
      basis: vwap.unavailableReason
        ?? "no session VWAP is available, so the hold condition cannot be evaluated",
    };
  }

  // Count back from the newest bar while it stays on the required side.
  let held = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const c = sorted[i]!.c;
    const onSide = side === "above" ? c > vwap.vwap : c < vwap.vwap;
    if (!onSide) break;
    held++;
  }

  const satisfied = held >= minutesRequired;

  if (stale || partialTape) {
    const why = partialTape
      ? `this VWAP is built from the IEX feed alone (a fraction of the consolidated tape), so it is not the VWAP the market is trading against`
      : `the newest bar is ${Math.round((lagMs ?? 0) / 60_000)} min old, so a ${minutesRequired}-minute hold cannot be confirmed in real time`;
    return {
      state: "unknown",
      minutesHeld: held,
      minutesRequired,
      vwap: vwap.vwap,
      lastPrice,
      feed: vwap.feed,
      lagMs,
      needsOperatorConfirmation: true,
      basis: `${satisfied ? "held" : "not held"} for ${held} of ${minutesRequired} min on the data available, but ${why} — confirm on a real-time terminal before entering`,
    };
  }

  return {
    state: satisfied ? "confirmed" : "rejected",
    minutesHeld: held,
    minutesRequired,
    vwap: vwap.vwap,
    lastPrice,
    feed: vwap.feed,
    lagMs,
    needsOperatorConfirmation: false,
    basis: satisfied
      ? `price has held ${side} VWAP for ${held} min (needed ${minutesRequired}), consolidated tape ${Math.round((lagMs ?? 0) / 1000)}s old`
      : `price has held ${side} VWAP for only ${held} of the ${minutesRequired} min required`,
  };
}

/** One line the UI can print under any intraday figure. */
export function describeTape(ctx: TapeContext): string {
  const feed = ctx.feed === "sip"
    ? "SIP consolidated tape"
    : ctx.feed === "iex"
      ? "IEX feed only — a fraction of consolidated volume"
      : "feed not identified";
  if (ctx.asOf == null || ctx.lagMs == null) return `${feed}; no bar timestamp available`;
  const lag = ctx.lagMs < 60_000
    ? `${Math.round(ctx.lagMs / 1000)}s`
    : `${Math.round(ctx.lagMs / 60_000)} min`;
  return `${feed}, as of ${new Date(ctx.asOf).toISOString()} (${lag} behind)`;
}
