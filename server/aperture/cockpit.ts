/**
 * The operator cockpit — one round trip for the persistent top rail.
 *
 * WHY THIS EXISTS. Everything on this rail already existed somewhere: the
 * session in marketSession.ts, the account on portfolio_accounts, the ceilings
 * in mandate.ts, the preset on aperture_runs, provider availability persisted on
 * the run. What did not exist was a way to see all of it at once, before acting.
 * An operator who has to open three screens to learn that the market closed
 * eleven minutes ago, that the account last synced yesterday, and that the run
 * has already deployed 38% of a 40% ceiling, is an operator who will find out by
 * being blocked.
 *
 * NOTHING HERE COLLECTS NEW DATA. No provider call, no broker call, no model
 * call. It reads what is already recorded and arranges it. That is a deliberate
 * constraint: a rail that polls must be cheap, and a rail that can fail because
 * a provider was slow is a rail that will be ignored.
 *
 * THE HEADROOM ARITHMETIC IS NOT HERE. `computeHeadroom` lives in gates.ts and
 * is built out of `measurePctCeiling` — the literal function the order gates
 * call. If this file re-derived "10% of equity" the rail could promise room the
 * gate would then refuse, and a rail that lies once is worse than no rail.
 *
 * The honesty contract holds throughout: an unknown session says unknown, a
 * never-synced account reports null fields rather than zeros, and a ceiling that
 * cannot be measured carries a reason instead of a number. The pure parts —
 * session boundaries, headroom shaping, the preset countdown — take an injected
 * clock and are unit-tested without a database.
 */
import { and, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  apertureRuns, brokerOrders, portfolioAccounts, positions as positionsTable,
  type ApertureRun, type PortfolioAccount,
} from "../../drizzle/schema";
import { getFacts, normSymbol } from "./facts";
import {
  CALENDAR_HORIZON, closeMinutesFor, etClock, marketSession, startOfEtDay,
  PRE_MARKET_OPEN, REGULAR_OPEN, EXTENDED_MINUTES_AFTER_CLOSE,
  type MarketSession, type SessionState,
} from "./marketSession";
import {
  computeHeadroom, type HeadroomRail,
} from "./gates";
import { LIVE_ORDER_STATUSES } from "./orderFlow";
import {
  CURRENT_MANDATE, HOLDING_PERIODS, isHoldingPeriod,
  type HoldingPeriod, type Mandate,
} from "./mandate";

// ── Session rail ──────────────────────────────────────────────────────────────

/**
 * These mirror the private constants in marketSession.ts. They are duplicated
 * rather than imported because marketSession.ts does not export them, and the
 * duplication is pinned by a test that walks `marketSession()` across each
 * boundary and asserts the transition happens at exactly the minute named here.
 * If someone changes the session model without changing these, that test fails.
 */
// Imported, not mirrored — see marketSession.ts.
const PRE_MARKET_OPEN_ET = PRE_MARKET_OPEN;
const REGULAR_OPEN_ET = REGULAR_OPEN;
const MINUTE = 60_000;
const DAY_MS = 86_400_000;

export type BoundaryKind = "pre_market_open" | "regular_open" | "regular_close" | "after_hours_end";

export interface SessionBoundary {
  kind: BoundaryKind;
  label: string;
  /** Epoch ms of the boundary. */
  at: number;
  /** Minutes past ET midnight on the boundary's own ET date. */
  etMinutes: number;
  dateEt: string | null;
  /** True when the boundary falls on a later ET date than now. */
  laterDate: boolean;
}

export interface SessionRail {
  session: MarketSession;
  /** How the session was determined — carried through, never re-asserted. */
  basis: string;
  dateEt: string | null;
  etMinutes: number | null;
  halfDay: boolean;
  /** 13:00 or 16:00 ET, in minutes. Null when the date is not a trading day. */
  closeEtMinutes: number | null;
  nextBoundary: SessionBoundary | null;
  msToNextBoundary: number | null;
  minutesToNextBoundary: number | null;
  /** Why there is no countdown. Null when there is one. */
  unavailableReason: string | null;
}

/**
 * Epoch ms of `targetEtMinutes` past ET midnight on the ET day containing `at`.
 *
 * Not `startOfEtDay + n` — that is an hour wrong on the two DST changeover days,
 * and a countdown that is an hour wrong at 09:30 on the second Sunday in March
 * is exactly the kind of quiet error this codebase refuses to ship. The result
 * is verified against the ET clock and corrected, then verified again.
 */
export function etInstant(at: number, targetEtMinutes: number): number | null {
  const c = etClock(at);
  if (!c) return null;
  let t = at + (targetEtMinutes - c.etMinutes) * MINUTE;
  t -= t % MINUTE;
  for (let i = 0; i < 3; i++) {
    const check = etClock(t);
    if (!check) return null;
    if (check.etMinutes === targetEtMinutes) return t;
    t += (targetEtMinutes - check.etMinutes) * MINUTE;
  }
  return null;
}

/** True when the ET date containing `at` trades at all. */
function isTradingInstant(at: number): boolean {
  const s = marketSession(at);
  return s.session === "pre_market" || s.session === "regular" || s.session === "after_hours";
}

/**
 * The next pre-market open after `now`, searched forward day by day. Bounded:
 * past the maintained calendar horizon there is no answer, and the honest reply
 * is null with a reason rather than an assumed weekday.
 */
export function nextTradingOpen(now: number, maxDays = 10): { at: number; dateEt: string } | null {
  for (let k = 0; k <= maxDays; k++) {
    const probe = now + k * DAY_MS;
    const at = etInstant(probe, PRE_MARKET_OPEN_ET);
    if (at == null || at <= now) continue;
    if (!isTradingInstant(at)) continue;
    const c = etClock(at);
    if (!c) continue;
    return { at, dateEt: c.dateEt };
  }
  return null;
}

const BOUNDARY_LABEL: Record<BoundaryKind, string> = {
  pre_market_open: "Pre-market opens",
  regular_open: "Regular session opens",
  regular_close: "Regular session closes",
  after_hours_end: "After-hours ends",
};

/** The session, plus the next boundary and how long until it. Pure. */
export function sessionRail(now: number): SessionRail {
  const state: SessionState = marketSession(now);

  const base = {
    session: state.session,
    basis: state.basis,
    dateEt: state.dateEt,
    etMinutes: state.etMinutes,
    halfDay: state.halfDay,
  };

  if (state.session === "unknown") {
    // Deliberately not a guess. Past the calendar horizon the gates block every
    // order, and the rail must say the same thing rather than counting down to
    // an open that may not happen.
    return {
      ...base,
      closeEtMinutes: null,
      nextBoundary: null,
      msToNextBoundary: null,
      minutesToNextBoundary: null,
      unavailableReason: `market session is unknown — ${state.basis}. No countdown is offered; extend the calendar (${CALENDAR_HORIZON.from}..${CALENDAR_HORIZON.to}) in server/aperture/marketSession.ts.`,
    };
  }

  const dateEt = state.dateEt!;
  const etMinutes = state.etMinutes!;
  // "Does this ET date trade at all" — asked of the calendar, not of the current
  // session, so 02:00 and 21:00 on a Wednesday both know Wednesday's close.
  const openProbe = etInstant(now, REGULAR_OPEN_ET);
  const tradingDay = openProbe != null && isTradingInstant(openProbe);
  const closeEtMinutes = tradingDay ? closeMinutesFor(dateEt) : null;

  const boundaryOnToday = (kind: BoundaryKind, minutes: number): SessionBoundary | null => {
    const at = etInstant(now, minutes);
    if (at == null) return null;
    return { kind, label: BOUNDARY_LABEL[kind], at, etMinutes: minutes, dateEt, laterDate: false };
  };

  let boundary: SessionBoundary | null = null;
  if (closeEtMinutes != null) {
    if (etMinutes < PRE_MARKET_OPEN_ET) boundary = boundaryOnToday("pre_market_open", PRE_MARKET_OPEN_ET);
    else if (etMinutes < REGULAR_OPEN_ET) boundary = boundaryOnToday("regular_open", REGULAR_OPEN_ET);
    else if (etMinutes < closeEtMinutes) boundary = boundaryOnToday("regular_close", closeEtMinutes);
    else if (etMinutes < closeEtMinutes + EXTENDED_MINUTES_AFTER_CLOSE) {
      boundary = boundaryOnToday("after_hours_end", closeEtMinutes + EXTENDED_MINUTES_AFTER_CLOSE);
    }
  }

  if (!boundary) {
    // Closed for the day, or on a weekend/holiday: the next boundary is the next
    // trading day's pre-market open.
    const open = nextTradingOpen(now);
    if (open) {
      boundary = {
        kind: "pre_market_open",
        label: BOUNDARY_LABEL.pre_market_open,
        at: open.at,
        etMinutes: PRE_MARKET_OPEN_ET,
        dateEt: open.dateEt,
        laterDate: open.dateEt !== dateEt,
      };
    }
  }

  if (!boundary) {
    return {
      ...base,
      closeEtMinutes,
      nextBoundary: null,
      msToNextBoundary: null,
      minutesToNextBoundary: null,
      unavailableReason: `no trading session found within 10 days of ${dateEt} inside the maintained calendar (${CALENDAR_HORIZON.from}..${CALENDAR_HORIZON.to})`,
    };
  }

  const ms = boundary.at - now;
  return {
    ...base,
    closeEtMinutes,
    nextBoundary: boundary,
    msToNextBoundary: ms,
    minutesToNextBoundary: Math.floor(ms / MINUTE),
    unavailableReason: null,
  };
}

// ── Account rail ──────────────────────────────────────────────────────────────

export interface AccountRail {
  /** False when no account is in scope; every figure below is then null. */
  linked: boolean;
  accountId: number | null;
  label: string | null;
  brokerId: string | null;
  /** Null when unknown — never defaulted to true. Paper-only is structural. */
  isPaper: boolean | null;
  cashCents: number | null;
  buyingPowerCents: number | null;
  equityValueCents: number | null;
  lastSyncedAt: number | null;
  /** now − lastSyncedAt. Null when the account has never synced. */
  stalenessMs: number | null;
  syncSource: string | null;
  syncError: string | null;
  /** Why the figures are null. Null when they are populated. */
  unavailableReason: string | null;
}

export const UNLINKED_ACCOUNT_RAIL: AccountRail = {
  linked: false,
  accountId: null,
  label: null,
  brokerId: null,
  isPaper: null,
  cashCents: null,
  buyingPowerCents: null,
  equityValueCents: null,
  lastSyncedAt: null,
  stalenessMs: null,
  syncSource: null,
  syncError: null,
  unavailableReason: "no account in scope — this is an analysis-only view",
};

/** Pure. A never-synced account reports nulls and a reason, not zeros. */
export function accountRail(account: PortfolioAccount | null, now: number): AccountRail {
  if (!account) return UNLINKED_ACCOUNT_RAIL;
  const neverSynced = account.lastSyncedAt == null;
  return {
    linked: true,
    accountId: account.id,
    label: account.label,
    brokerId: account.brokerId,
    isPaper: account.isPaper === true,
    cashCents: account.cashCents ?? null,
    buyingPowerCents: account.buyingPowerCents ?? null,
    equityValueCents: account.equityValueCents ?? null,
    lastSyncedAt: account.lastSyncedAt ?? null,
    stalenessMs: neverSynced ? null : now - account.lastSyncedAt!,
    syncSource: account.syncSource ?? null,
    syncError: account.syncError ?? null,
    unavailableReason: neverSynced
      ? "this account has never synced — the balances below are whatever was last entered, and no staleness can be measured"
      : null,
  };
}

// ── Run preset rail ───────────────────────────────────────────────────────────

export interface RunRail {
  runId: number;
  status: string;
  holdingPeriod: HoldingPeriod | null;
  holdingPeriodLabel: string | null;
  maxSessions: number | null;
  maxHorizonDays: number | null;
  catalystDeadlineAt: number | null;
  /** Deadline minus now. Negative once the window has passed. Null when unset. */
  msToCatalystDeadline: number | null;
  /** True only when a deadline exists AND it has passed. Null-safe. */
  catalystExpired: boolean | null;
  liquidityFloorAdvUsd: number | null;
  maxSingleNamePct: number | null;
  invalidationRule: string | null;
  mandateVersion: string | null;
  universeCount: number | null;
  candidateCount: number | null;
  droppedNote: string | null;
  /** As persisted on the run. Null when the run predates the field. */
  providerAvailability: Record<string, boolean> | null;
  /** Providers that were NOT live for this run — named gaps, never a silent null. */
  providerGaps: string[] | null;
  /** Why preset fields are null. Null when the preset is fully stated. */
  unavailableReason: string | null;
}

/** Pure. `run` is an aperture_runs row. */
export function runRail(run: ApertureRun, now: number): RunRail {
  const hp = isHoldingPeriod(run.holdingPeriod) ? (run.holdingPeriod as HoldingPeriod) : null;
  const rule = hp ? HOLDING_PERIODS[hp] : null;
  const deadline = run.catalystDeadlineAt ?? null;
  const availability = (run.providerAvailability ?? null) as Record<string, boolean> | null;

  return {
    runId: run.id,
    status: run.status,
    holdingPeriod: hp,
    holdingPeriodLabel: rule?.label ?? null,
    maxSessions: rule?.maxSessions ?? null,
    maxHorizonDays: rule?.maxHorizonDays ?? null,
    catalystDeadlineAt: deadline,
    msToCatalystDeadline: deadline == null ? null : deadline - now,
    catalystExpired: deadline == null ? null : deadline <= now,
    liquidityFloorAdvUsd: run.liquidityFloorAdvUsd ?? null,
    maxSingleNamePct: run.maxSingleNamePct ?? null,
    invalidationRule: run.invalidationRule ?? null,
    mandateVersion: run.mandateVersion ?? null,
    universeCount: run.universeCount ?? null,
    candidateCount: run.candidateCount ?? null,
    droppedNote: run.droppedNote ?? null,
    providerAvailability: availability,
    providerGaps: availability
      ? Object.entries(availability).filter(([, live]) => !live).map(([id]) => id)
      : null,
    unavailableReason: run.mandateVersion == null
      ? "this brief was created before the mandate preset existed — it is pre-mandate, not gated, and no preset ceilings apply to it"
      : null,
  };
}

// ── The whole rail ────────────────────────────────────────────────────────────

/**
 * Hand-listed rather than spread from Mandate, so adding a ceiling to the
 * mandate is a compile error here until it is deliberately exposed — the rail
 * should never silently omit a ceiling that blocks orders. (It did exactly that
 * for the three planned-loss fields between v2 landing and this fix.)
 */
export interface CockpitMandateSummary {
  version: string;
  maxOrderNotionalPctOfEquity: number;
  maxOrderNotionalCents: number;
  maxPositionPctOfEquity: number;
  maxClusterPctOfEquity: number;
  maxRunGrossDeployedPctOfEquity: number;
  maxDailyNewNotionalPctOfEquity: number;
  /** The planned-loss axis — see mandate.ts. */
  maxPlannedRiskPctPerPlay: number;
  maxDailyPlannedRiskPct: number;
  maxCorrelatedPlannedRiskPct: number;
  minAdvUsd30d: number;
  maxOrderPctOfAdv: number;
  intradayCutoffEtMinutes: number;
}

export interface Cockpit {
  generatedAt: number;
  /** Structural, not a setting. There is no live-execution path in this build. */
  liveTrading: false;
  mandate: CockpitMandateSummary;
  session: SessionRail;
  account: AccountRail;
  headroom: HeadroomRail;
  run: RunRail | null;
}

export function buildCockpitMandateSummary(m: Mandate): CockpitMandateSummary {
  return {
    version: m.version,
    maxOrderNotionalPctOfEquity: m.maxOrderNotionalPctOfEquity,
    maxOrderNotionalCents: m.maxOrderNotionalCents,
    maxPositionPctOfEquity: m.maxPositionPctOfEquity,
    maxClusterPctOfEquity: m.maxClusterPctOfEquity,
    maxRunGrossDeployedPctOfEquity: m.maxRunGrossDeployedPctOfEquity,
    maxDailyNewNotionalPctOfEquity: m.maxDailyNewNotionalPctOfEquity,
    maxPlannedRiskPctPerPlay: m.maxPlannedRiskPctPerPlay,
    maxDailyPlannedRiskPct: m.maxDailyPlannedRiskPct,
    maxCorrelatedPlannedRiskPct: m.maxCorrelatedPlannedRiskPct,
    minAdvUsd30d: m.minAdvUsd30d,
    maxOrderPctOfAdv: m.maxOrderPctOfAdv,
    intradayCutoffEtMinutes: m.intradayCutoffEtMinutes,
  };
}

/**
 * The largest held name and the largest sector cluster, from positions + the
 * fact ledger. Pure, so the grouping rule is testable: a name with no sector
 * fact is its own cluster — the same treatment `evaluateOrderGates` records
 * when `sectorKnown` is false. Pretending an unclassified name belongs to an
 * empty cluster would understate concentration.
 */
export function largestExposures(
  holdings: Array<{ symbol: string; marketValueCents: number | null }>,
  sectorBySymbol: Map<string, string>,
): {
  largestPositionSymbol: string | null;
  largestPositionValueCents: number | null;
  largestClusterLabel: string | null;
  largestClusterValueCents: number | null;
} {
  if (!holdings.length) {
    return {
      largestPositionSymbol: null,
      largestPositionValueCents: null,
      largestClusterLabel: null,
      largestClusterValueCents: null,
    };
  }

  const bySymbol = new Map<string, number>();
  for (const h of holdings) {
    const s = normSymbol(h.symbol);
    bySymbol.set(s, (bySymbol.get(s) ?? 0) + (h.marketValueCents ?? 0));
  }

  const byCluster = new Map<string, number>();
  for (const [symbol, value] of Array.from(bySymbol.entries())) {
    const label = sectorBySymbol.get(symbol) ?? `${symbol} (unclassified)`;
    byCluster.set(label, (byCluster.get(label) ?? 0) + value);
  }

  const top = <T>(m: Map<T, number>): [T, number] =>
    Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0];

  const [posSymbol, posValue] = top(bySymbol);
  const [cluLabel, cluValue] = top(byCluster);
  return {
    largestPositionSymbol: posSymbol,
    largestPositionValueCents: posValue,
    largestClusterLabel: cluLabel,
    largestClusterValueCents: cluValue,
  };
}

export interface BuildCockpitArgs {
  userId: number;
  accountId?: number | null;
  runId?: number | null;
  /** Injected in tests. Production uses the real clock. */
  now?: number;
}

/**
 * One round trip. Reads only what is already persisted — no provider, broker or
 * model call — so this is safe to poll from a rail that is always on screen.
 */
export async function buildCockpit(args: BuildCockpitArgs): Promise<Cockpit> {
  const now = args.now ?? Date.now();
  const db = await getDb();
  if (!db) throw new Error("database unavailable");

  const run = args.runId != null
    ? (await db.select().from(apertureRuns)
        .where(and(eq(apertureRuns.id, args.runId), eq(apertureRuns.userId, args.userId)))
        .limit(1))[0] ?? null
    : null;

  // An explicit accountId wins; otherwise the run's own account is the subject.
  const accountId = args.accountId ?? run?.accountId ?? null;
  const account = accountId != null
    ? (await db.select().from(portfolioAccounts)
        .where(and(eq(portfolioAccounts.id, accountId), eq(portfolioAccounts.userId, args.userId)))
        .limit(1))[0] ?? null
    : null;

  const holdings = account
    ? await db.select({ symbol: positionsTable.symbol, marketValueCents: positionsTable.marketValueCents })
        .from(positionsTable).where(eq(positionsTable.accountId, account.id))
    : [];

  const heldSymbols = Array.from(new Set(holdings.map((h) => normSymbol(h.symbol))));
  const factRows = heldSymbols.length ? await getFacts(heldSymbols) : [];
  const sectorBySymbol = new Map<string, string>();
  for (const f of factRows) {
    if (f.factKey !== "sector" || f.basis === "unknown" || !f.valueText) continue;
    const s = normSymbol(f.symbol);
    if (!sectorBySymbol.has(s)) sectorBySymbol.set(s, f.valueText);
  }

  const sumBuys = (rows: Array<{ gated: number | null; notional: number | null; side: string }>) =>
    rows.filter((r) => r.side === "buy").reduce((s, r) => s + (r.gated ?? r.notional ?? 0), 0);

  const dayStart = startOfEtDay(now);
  const todayRows = dayStart == null ? null : await db.select({
    gated: brokerOrders.gatedNotionalCents,
    notional: brokerOrders.notionalCents,
    side: brokerOrders.side,
    symbol: brokerOrders.symbol,
    plannedRisk: brokerOrders.plannedRiskCents,
  }).from(brokerOrders).where(and(
    eq(brokerOrders.userId, args.userId),
    gte(brokerOrders.createdAt, dayStart),
    inArray(brokerOrders.status, [...LIVE_ORDER_STATUSES]),
  ));

  const runRows = run ? await db.select({
    gated: brokerOrders.gatedNotionalCents,
    notional: brokerOrders.notionalCents,
    side: brokerOrders.side,
  }).from(brokerOrders).where(and(
    eq(brokerOrders.runId, run.id),
    eq(brokerOrders.userId, args.userId),
    inArray(brokerOrders.status, [...LIVE_ORDER_STATUSES]),
  )) : null;

  const exposures = largestExposures(holdings, sectorBySymbol);

  // Planned loss committed today, and the theme carrying the most of it. An
  // order with no stated stop contributes nothing here — it was sized on
  // notional, and the gate records that rather than inventing a risk figure.
  const plannedRiskTodayCents = todayRows == null
    ? null
    : todayRows.reduce((s, r) => s + (r.plannedRisk ?? 0), 0);

  let largestClusterPlannedRiskLabel: string | null = null;
  let largestClusterPlannedRiskCents: number | null = null;
  if (todayRows != null) {
    const byCluster = new Map<string, number>();
    for (const r of todayRows) {
      if (!r.plannedRisk) continue;
      const sym = normSymbol(r.symbol);
      // A name with no sector fact is its own cluster — the same treatment the
      // gate applies, and the same blind spot: a real theme overlap is missed.
      const label = sectorBySymbol.get(sym) ?? `${sym} (unclassified)`;
      byCluster.set(label, (byCluster.get(label) ?? 0) + r.plannedRisk);
    }
    for (const [label, cents] of Array.from(byCluster.entries())) {
      if (largestClusterPlannedRiskCents == null || cents > largestClusterPlannedRiskCents) {
        largestClusterPlannedRiskCents = cents;
        largestClusterPlannedRiskLabel = label;
      }
    }
  }

  return {
    generatedAt: now,
    liveTrading: false,
    mandate: buildCockpitMandateSummary(CURRENT_MANDATE),
    session: sessionRail(now),
    account: accountRail(account ?? null, now),
    headroom: computeHeadroom({
      equityCents: account?.equityValueCents ?? null,
      plannedRiskTodayCents,
      largestClusterPlannedRiskLabel,
      largestClusterPlannedRiskCents,
      ...exposures,
      runGrossDeployedCents: runRows ? sumBuys(runRows) : null,
      newNotionalTodayCents: todayRows ? sumBuys(todayRows) : null,
    }, CURRENT_MANDATE),
    run: run ? runRail(run, now) : null,
  };
}
