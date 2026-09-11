/**
 * The three answers an operator wants before reading a single row: what is at
 * stake, what it is worth now, and what is left to deploy.
 *
 * Every figure here is a sum over records that were actually measured, and each
 * one reports how many records it could NOT include. A total that silently
 * drops the positions it could not mark is worse than no total — it looks
 * complete. So `countedOf` travels with every number, and a partial sum says
 * so in the same breath as the figure.
 *
 * PURE. No clock of its own, no network, no formatting decisions beyond the
 * labels that change the meaning of a number.
 */

import { deskOrderReturn, type PositionMark } from "./positionReturn";

export interface GlanceOrder {
  status: string;
  instrumentType: string;
  plannedRiskCents: number | null;
  qty: number | null;
  filledQty: number | null;
  latestMark?: PositionMark | null;
  markSourceUnavailable?: boolean;
}

export interface GlanceAccount {
  label: string | null;
  cashCents: number | null;
  buyingPowerCents: number | null;
  lastSyncedAt: number | null;
  syncSource: string | null;
}

/** How long a synced account balance counts as current. Matches the
 *  `execution_account_freshness` gate in server/aperture/orderFlow.ts. */
export const ACCOUNT_FRESHNESS_MS = 15 * 60_000;

export interface AtRiskGlance {
  cents: number;
  /** Orders that carried a recorded risk figure. */
  counted: number;
  /** Orders in scope that did not, and are therefore missing from the sum. */
  uncounted: number;
  /** "Premium at risk" / "Planned loss at modeled stop" / both. */
  label: string;
}

export interface UnrealizedGlance {
  measured: boolean;
  pnlCents: number | null;
  /** Positions whose return could be marked, out of those with a fill. */
  marked: number;
  openPositions: number;
  /** Marked positions whose price is older than the freshness window. */
  stale: number;
  /** Oldest mark in the sum — the honest "as of" for the total. */
  asOf: number | null;
  /** Why the figure is absent or partial. Null when it is complete. */
  caveat: string | null;
}

export interface DeployableGlance {
  cents: number | null;
  asOf: number | null;
  source: string | null;
  stale: boolean;
  /** Present when no figure can be stated. */
  unavailableReason: string | null;
}

export interface InMotionGlance {
  liveOrders: number;
  awaitingFill: number;
  openPositions: number;
}

export interface DeskGlance {
  atRisk: AtRiskGlance;
  unrealized: UnrealizedGlance;
  deployable: DeployableGlance;
  inMotion: InMotionGlance;
}

/** Statuses that still represent capital committed or about to be. A rejected
 *  or cancelled ticket risks nothing and must not inflate the total. */
const LIVE_STATUSES = new Set(["pending_approval", "approved", "submitted", "filled"]);

const isOption = (instrumentType: string) => instrumentType === "long_call" || instrumentType === "long_put";

export function buildDeskGlance(
  orders: GlanceOrder[],
  account: GlanceAccount | null,
  now: number,
): DeskGlance {
  const live = orders.filter((order) => LIVE_STATUSES.has(order.status));

  // ── At risk ───────────────────────────────────────────────────────────────
  let cents = 0;
  let counted = 0;
  let uncounted = 0;
  let sawOption = false;
  let sawShares = false;
  for (const order of live) {
    if (isOption(order.instrumentType)) sawOption = true; else sawShares = true;
    const risk = order.plannedRiskCents;
    if (risk != null && Number.isFinite(risk)) { cents += risk; counted += 1; }
    else uncounted += 1;
  }
  const atRisk: AtRiskGlance = {
    cents,
    counted,
    uncounted,
    label: sawOption && sawShares
      ? "Premium at risk and planned loss at modeled stops"
      : sawOption
        ? "Premium at risk"
        : "Planned loss at modeled stops",
  };

  // ── Unrealized ────────────────────────────────────────────────────────────
  const filled = live.filter((order) => order.status === "filled");
  let pnl = 0;
  let marked = 0;
  let stale = 0;
  let oldestMark: number | null = null;
  let firstRefusal: string | null = null;
  for (const order of filled) {
    const result = deskOrderReturn(order, now);
    if (!result.measured) { firstRefusal ??= result.reason; continue; }
    pnl += result.pnlCents;
    marked += 1;
    if (result.stale) stale += 1;
    oldestMark = oldestMark == null ? result.markAsOf : Math.min(oldestMark, result.markAsOf);
  }
  const unrealized: UnrealizedGlance = {
    measured: marked > 0,
    pnlCents: marked > 0 ? pnl : null,
    marked,
    openPositions: filled.length,
    stale,
    asOf: oldestMark,
    caveat: filled.length === 0
      ? "No position has a recorded fill yet."
      : marked === 0
        ? firstRefusal ?? "No open position could be marked."
        : marked < filled.length
          ? `${filled.length - marked} of ${filled.length} open positions could not be marked and are not in this total.`
          : stale > 0
            ? `${stale} of ${marked} marks are older than the ${Math.round(ACCOUNT_FRESHNESS_MS / 60_000)}-minute freshness window.`
            : null,
  };

  // ── Deployable ────────────────────────────────────────────────────────────
  // Buying power is the number that actually limits a new order; cash is the
  // fallback when the broker did not report it. Neither is asserted without the
  // sync timestamp and source that make it a fact rather than a remembered value.
  const balance = account?.buyingPowerCents ?? account?.cashCents ?? null;
  const deployable: DeployableGlance = account == null
    ? { cents: null, asOf: null, source: null, stale: false, unavailableReason: "No paper account is connected, so there is no deployable balance to state." }
    : account.lastSyncedAt == null || !account.syncSource
      ? { cents: null, asOf: null, source: null, stale: false, unavailableReason: `${account.label ?? "This account"} has never reported a synced balance. Refresh it to state one.` }
      : balance == null || !Number.isFinite(balance)
        ? { cents: null, asOf: account.lastSyncedAt, source: account.syncSource, stale: false, unavailableReason: "The broker did not report buying power or cash on the last sync." }
        : {
          cents: balance,
          asOf: account.lastSyncedAt,
          source: account.syncSource,
          stale: now - account.lastSyncedAt > ACCOUNT_FRESHNESS_MS,
          unavailableReason: null,
        };

  // ── In motion ─────────────────────────────────────────────────────────────
  const inMotion: InMotionGlance = {
    liveOrders: live.length,
    awaitingFill: live.filter((order) => order.status !== "filled").length,
    openPositions: filled.length,
  };

  return { atRisk, unrealized, deployable, inMotion };
}
