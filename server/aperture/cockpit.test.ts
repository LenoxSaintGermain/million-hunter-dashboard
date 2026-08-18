/**
 * Cockpit — the pure parts, exercised.
 *
 * Three things are worth failing a build over:
 *
 *   1. The headroom rail must never disagree with the gate. If the rail says
 *      $2,000 of room is left, an order of exactly $2,000 must pass and an order
 *      of $2,001 must fail. That property is asserted directly against
 *      `evaluateOrderGates` here, not assumed from a shared import.
 *   2. Unknown must stay unknown. No equity means null headroom with a reason;
 *      an unknown session means no countdown, not a countdown to a guess.
 *   3. The session-boundary constants this file mirrors from marketSession.ts
 *      are pinned: each countdown is checked against the minute `marketSession`
 *      itself changes state.
 *
 * Everything here is pure — no database, no network, injected clock.
 */
import { describe, it, expect } from "vitest";
import {
  accountRail, etInstant, largestExposures, nextTradingOpen, runRail, sessionRail,
  UNLINKED_ACCOUNT_RAIL,
} from "./cockpit";
import { computeHeadroom, evaluateOrderGates, measurePctCeiling, singleOrderCeilingCents } from "./gates";
import { marketSession } from "./marketSession";
import { CURRENT_MANDATE, MANDATE_V1, PAPER_ACKNOWLEDGEMENT } from "./mandate";
import type { ApertureRun, PortfolioAccount } from "../../drizzle/schema";

const DAY = 86_400_000;
const MINUTE = 60_000;
/** $100,000 — the live paper account, rounded. */
const EQUITY = 10_000_000;

// Wed 2026-06-10, 10:30 ET (14:30Z — EDT).
const WED_1030 = Date.parse("2026-06-10T14:30:00Z");

const headroomInput = (over: Partial<Parameters<typeof computeHeadroom>[0]> = {}) => ({
  equityCents: EQUITY,
  largestPositionSymbol: "NVDA",
  largestPositionValueCents: 500_000, // $5,000 — 5% of equity
  largestClusterLabel: "Semiconductors",
  largestClusterValueCents: 1_500_000, // $15,000 — 15%
  runGrossDeployedCents: 2_000_000, // $20,000 — 20%
  newNotionalTodayCents: 1_000_000, // $10,000 — 10%
  ...over,
});

const lineOf = (rail: ReturnType<typeof computeHeadroom>, key: string) =>
  rail.lines.find((l) => l.key === key)!;

// ── Headroom arithmetic ───────────────────────────────────────────────────────

describe("computeHeadroom — used, ceiling, remaining", () => {
  it("states the mandate version the figures were measured against", () => {
    expect(computeHeadroom(headroomInput()).mandateVersion).toBe(MANDATE_V1.version);
  });

  it("computes the single-name ceiling as a percentage of equity", () => {
    const l = lineOf(computeHeadroom(headroomInput()), "position");
    expect(l.subject).toBe("NVDA");
    expect(l.usedCents).toBe(500_000);
    expect(l.ceilingPct).toBe(MANDATE_V1.maxPositionPctOfEquity); // 10%
    expect(l.ceilingCents).toBe(1_000_000); // $10,000
    expect(l.remainingCents).toBe(500_000); // $5,000 of room
    expect(l.usedPct).toBe(5);
    expect(l.reason).toBeNull();
  });

  it("computes the cluster ceiling on the summed cluster, not the single name", () => {
    const l = lineOf(computeHeadroom(headroomInput()), "cluster");
    expect(l.subject).toBe("Semiconductors");
    expect(l.ceilingCents).toBe(2_500_000); // 25% of $100k
    expect(l.remainingCents).toBe(1_000_000);
    expect(l.usedPct).toBe(15);
  });

  it("computes the per-run and daily ceilings", () => {
    const rail = computeHeadroom(headroomInput());
    expect(lineOf(rail, "run_gross_deployed").ceilingCents).toBe(4_000_000); // 40%
    expect(lineOf(rail, "run_gross_deployed").remainingCents).toBe(2_000_000);
    expect(lineOf(rail, "daily_new_notional").ceilingCents).toBe(2_000_000); // 20%
    expect(lineOf(rail, "daily_new_notional").remainingCents).toBe(1_000_000);
  });

  it("never reports negative room — a breached ceiling floors at zero", () => {
    const l = lineOf(computeHeadroom(headroomInput({ largestPositionValueCents: 2_000_000 })), "position");
    expect(l.usedPct).toBe(20);
    expect(l.remainingCents).toBe(0);
  });

  it("takes the absolute single-order cap when it binds before the percentage", () => {
    // 5% of $1,000,000 equity is $50,000; the absolute cap is $10,000.
    const l = lineOf(computeHeadroom(headroomInput({ equityCents: 100_000_000 })), "single_order");
    expect(l.ceilingCents).toBe(MANDATE_V1.maxOrderNotionalCents);
    expect(l.remainingCents).toBe(MANDATE_V1.maxOrderNotionalCents);
  });

  it("leaves the single-order line's used figure null — nothing accumulates against it", () => {
    const l = lineOf(computeHeadroom(headroomInput()), "single_order");
    expect(l.usedCents).toBeNull();
    expect(l.usedPct).toBeNull();
    expect(l.basis).toMatch(/not a running total/i);
  });
});

describe("computeHeadroom — unknown stays unknown", () => {
  it("returns null headroom with a reason when equity is unknown, never zero", () => {
    const rail = computeHeadroom(headroomInput({ equityCents: null }));
    expect(rail.equityCents).toBeNull();
    expect(rail.equityBasis).toMatch(/unknown/i);
    for (const l of rail.lines) {
      expect(l.usedCents).toBeNull();
      expect(l.ceilingCents).toBeNull();
      expect(l.remainingCents).toBeNull();
      expect(l.reason).toBeTruthy();
    }
  });

  it("treats zero equity as unknown — you cannot size against nothing", () => {
    expect(computeHeadroom(headroomInput({ equityCents: 0 })).equityCents).toBeNull();
  });

  it("states the ceiling but not the room when a figure is unmeasurable", () => {
    // No run in scope: the ceiling is knowable, the consumption is not.
    const l = lineOf(computeHeadroom(headroomInput({ runGrossDeployedCents: null })), "run_gross_deployed");
    expect(l.ceilingCents).toBe(4_000_000);
    expect(l.usedCents).toBeNull();
    expect(l.remainingCents).toBeNull();
    expect(l.reason).toMatch(/runId/);
  });

  it("reports no position or cluster subject when nothing is held", () => {
    const rail = computeHeadroom(headroomInput({
      largestPositionSymbol: null, largestPositionValueCents: null,
      largestClusterLabel: null, largestClusterValueCents: null,
    }));
    expect(lineOf(rail, "position").remainingCents).toBeNull();
    expect(lineOf(rail, "position").reason).toMatch(/no positions/i);
  });
});

// ── The property that matters: the rail cannot promise room the gate refuses ──

describe("headroom agrees with the gate that actually blocks the order", () => {
  const gateFor = (notionalCents: number, positionValueCents: number) => evaluateOrderGates({
    input: {
      symbol: "NVDA",
      side: "buy",
      orderType: "market",
      timeInForce: "day",
      holdingPeriod: "swing",
      reason: "Adds inference exposure ahead of the Q3 datacenter print",
      invalidationCondition: "Exit if the datacenter segment guide comes in below consensus",
      catalystDeadlineAt: WED_1030 + 5 * DAY,
      paperAcknowledgement: PAPER_ACKNOWLEDGEMENT,
      gatedNotionalCents: notionalCents,
      notionalBasis: "stated",
    },
    account: {
      isPaper: true,
      equityCents: EQUITY,
      positionValueCents,
      clusterValueCents: positionValueCents,
      clusterLabel: "Semiconductors",
      sectorKnown: true,
      newNotionalTodayCents: 0,
      runGrossDeployedCents: 0,
      advUsd: 500_000_000,
    },
    session: marketSession(WED_1030),
    mandate: CURRENT_MANDATE,
    now: WED_1030,
  });

  const positionGate = (ev: ReturnType<typeof gateFor>) =>
    ev.results.find((r) => r.key === "position_concentration")!;

  it("an order for exactly the remaining room passes the position gate", () => {
    const held = 500_000;
    const room = lineOf(computeHeadroom(headroomInput({ largestPositionValueCents: held })), "position").remainingCents!;
    expect(positionGate(gateFor(room, held)).passed).toBe(true);
  });

  it("one cent more than the remaining room is a different matter — the ceiling holds", () => {
    const held = 500_000;
    const room = lineOf(computeHeadroom(headroomInput({ largestPositionValueCents: held })), "position").remainingCents!;
    // A cent rounds away at 2dp; the first figure the gate actually renders as
    // over-cap is what must fail. Step by 0.01% of equity.
    expect(positionGate(gateFor(room + EQUITY / 100 / 100, held)).passed).toBe(false);
  });

  it("the single-order ceiling the rail shows is the one the gate applies", () => {
    const ceiling = lineOf(computeHeadroom(headroomInput()), "single_order").ceilingCents!;
    expect(ceiling).toBe(singleOrderCeilingCents(EQUITY, CURRENT_MANDATE));
    const at = gateFor(ceiling, 0).results.find((r) => r.key === "order_notional_ceiling")!;
    expect(at.passed).toBe(true);
    const over = gateFor(ceiling + 1, 0).results.find((r) => r.key === "order_notional_ceiling")!;
    expect(over.passed).toBe(false);
  });
});

describe("measurePctCeiling", () => {
  it("reports the post-add percentage, rounded the way the gate renders it", () => {
    const m = measurePctCeiling(500_000, 250_000, EQUITY, 10);
    expect(m.pct).toBe(7.5);
    expect(m.ok).toBe(true);
    expect(m.ceilingCents).toBe(1_000_000);
    expect(m.remainingCents).toBe(500_000);
  });

  it("does not round a breach back inside the cap, and shows what it blocked on", () => {
    // 10.001% of equity. Two decimal places would read 10.00% and let it pass;
    // a risk gate does not round in the operator's favour, so it blocks — and
    // carries the extra precision so the number on screen is the number that bound.
    const m = measurePctCeiling(1_000_100, 0, EQUITY, 10);
    expect(m.ok).toBe(false);
    expect(m.exactPct).toBeGreaterThan(10);
    expect(m.pct).toBeGreaterThan(10);
  });
});

// ── Session boundaries ────────────────────────────────────────────────────────

/** The minute `marketSession` itself flips, found by bisection. Pins the mirror. */
const sessionAt = (ms: number) => marketSession(ms).session;

describe("sessionRail — countdown to the next boundary", () => {
  it("counts down to the regular close during the regular session", () => {
    const rail = sessionRail(WED_1030);
    expect(rail.session).toBe("regular");
    expect(rail.halfDay).toBe(false);
    expect(rail.closeEtMinutes).toBe(16 * 60);
    expect(rail.nextBoundary!.kind).toBe("regular_close");
    expect(rail.minutesToNextBoundary).toBe(5 * 60 + 30); // 10:30 → 16:00
    expect(rail.unavailableReason).toBeNull();
  });

  it("counts down to the regular open during pre-market", () => {
    const rail = sessionRail(Date.parse("2026-06-10T12:00:00Z")); // 08:00 ET
    expect(rail.session).toBe("pre_market");
    expect(rail.nextBoundary!.kind).toBe("regular_open");
    expect(rail.minutesToNextBoundary).toBe(90);
  });

  it("counts down to the after-hours end once the regular session closes", () => {
    const rail = sessionRail(Date.parse("2026-06-10T20:30:00Z")); // 16:30 ET
    expect(rail.session).toBe("after_hours");
    expect(rail.nextBoundary!.kind).toBe("after_hours_end");
    expect(rail.minutesToNextBoundary).toBe(210); // 16:30 → 20:00 ET
  });

  it("counts down to the pre-market open before 04:00 ET", () => {
    const rail = sessionRail(Date.parse("2026-06-10T06:00:00Z")); // 02:00 ET
    expect(rail.session).toBe("closed");
    expect(rail.nextBoundary!.kind).toBe("pre_market_open");
    expect(rail.nextBoundary!.laterDate).toBe(false);
    expect(rail.minutesToNextBoundary).toBe(120);
  });

  it("rolls to the next trading day once after-hours has ended", () => {
    const rail = sessionRail(Date.parse("2026-06-11T01:00:00Z")); // Wed 21:00 ET
    expect(rail.session).toBe("closed");
    expect(rail.nextBoundary!.kind).toBe("pre_market_open");
    expect(rail.nextBoundary!.laterDate).toBe(true);
    expect(rail.nextBoundary!.dateEt).toBe("2026-06-11"); // Thursday
    expect(rail.minutesToNextBoundary).toBe(7 * 60); // 21:00 → 04:00
  });

  it("skips the weekend — Friday evening counts down to Monday", () => {
    const rail = sessionRail(Date.parse("2026-06-13T02:00:00Z")); // Fri 22:00 ET
    expect(rail.nextBoundary!.dateEt).toBe("2026-06-15"); // Monday
  });

  it("skips a market holiday", () => {
    // Fri 2026-07-03 is the observed Independence Day closure.
    const rail = sessionRail(Date.parse("2026-07-03T14:00:00Z")); // Fri 10:00 ET
    expect(rail.session).toBe("closed");
    expect(rail.nextBoundary!.dateEt).toBe("2026-07-06"); // Monday
  });

  it("uses the 13:00 ET close on a half day, and flags it", () => {
    const rail = sessionRail(Date.parse("2026-11-27T15:00:00Z")); // 10:00 ET, day after Thanksgiving
    expect(rail.halfDay).toBe(true);
    expect(rail.closeEtMinutes).toBe(13 * 60);
    expect(rail.nextBoundary!.kind).toBe("regular_close");
    expect(rail.minutesToNextBoundary).toBe(180);
  });

  it("offers no countdown when the session is unknown — it does not guess", () => {
    const rail = sessionRail(Date.parse("2028-03-01T14:30:00Z")); // past the calendar horizon
    expect(rail.session).toBe("unknown");
    expect(rail.nextBoundary).toBeNull();
    expect(rail.msToNextBoundary).toBeNull();
    expect(rail.minutesToNextBoundary).toBeNull();
    expect(rail.unavailableReason).toMatch(/unknown/i);
  });

  it("pins the mirrored boundary constants against marketSession itself", () => {
    // The rail's boundary must be the exact minute the session model flips.
    const cases: Array<[number, string, string]> = [
      [Date.parse("2026-06-10T06:00:00Z"), "closed", "pre_market"],
      [Date.parse("2026-06-10T12:00:00Z"), "pre_market", "regular"],
      [WED_1030, "regular", "after_hours"],
      [Date.parse("2026-06-10T20:30:00Z"), "after_hours", "closed"],
    ];
    for (const [now, before, after] of cases) {
      const at = sessionRail(now).nextBoundary!.at;
      expect(sessionAt(at - MINUTE)).toBe(before);
      expect(sessionAt(at)).toBe(after);
    }
  });
});

describe("etInstant / nextTradingOpen", () => {
  it("lands on the requested ET minute", () => {
    const at = etInstant(WED_1030, 9 * 60 + 30)!;
    expect(marketSession(at).etMinutes).toBe(9 * 60 + 30);
    expect(marketSession(at).dateEt).toBe("2026-06-10");
  });

  it("survives the spring-forward day, when a naive midnight+n is an hour wrong", () => {
    // 2026-03-08 is the US DST changeover. 09:30 ET must still be 09:30 ET.
    const at = etInstant(Date.parse("2026-03-08T18:00:00Z"), 9 * 60 + 30)!;
    expect(marketSession(at).etMinutes).toBe(9 * 60 + 30);
    expect(marketSession(at).dateEt).toBe("2026-03-08");
  });

  it("finds the next trading open and never returns one in the past", () => {
    const open = nextTradingOpen(WED_1030)!;
    expect(open.at).toBeGreaterThan(WED_1030);
    expect(open.dateEt).toBe("2026-06-11");
  });

  it("returns null past the maintained calendar rather than assuming a weekday", () => {
    expect(nextTradingOpen(Date.parse("2028-03-01T14:30:00Z"))).toBeNull();
  });
});

// ── Account rail ──────────────────────────────────────────────────────────────

const account = (over: Partial<PortfolioAccount> = {}): PortfolioAccount => ({
  id: 7,
  userId: 1,
  label: "Alpaca Paper",
  brokerId: "alpaca_paper",
  externalAccountId: null,
  isPaper: true,
  cashCents: 6_000_000,
  buyingPowerCents: 12_000_000,
  equityValueCents: EQUITY,
  lastSyncedAt: WED_1030 - 5 * MINUTE,
  syncSource: "alpaca",
  syncError: null,
  createdAt: 0,
  updatedAt: 0,
  ...over,
} as PortfolioAccount);

describe("accountRail", () => {
  it("reports an explicit staleness in ms", () => {
    expect(accountRail(account(), WED_1030).stalenessMs).toBe(5 * MINUTE);
  });

  it("returns null fields, not zeros, when no account is in scope", () => {
    const rail = accountRail(null, WED_1030);
    expect(rail).toEqual(UNLINKED_ACCOUNT_RAIL);
    expect(rail.cashCents).toBeNull();
    expect(rail.equityValueCents).toBeNull();
    expect(rail.isPaper).toBeNull();
    expect(rail.stalenessMs).toBeNull();
  });

  it("cannot measure staleness on an account that has never synced, and says so", () => {
    const rail = accountRail(account({ lastSyncedAt: null }), WED_1030);
    expect(rail.stalenessMs).toBeNull();
    expect(rail.unavailableReason).toMatch(/never synced/i);
  });

  it("carries a sync error through instead of hiding it behind stale balances", () => {
    expect(accountRail(account({ syncError: "401 from broker" }), WED_1030).syncError).toBe("401 from broker");
  });
});

// ── Run preset rail ───────────────────────────────────────────────────────────

const run = (over: Partial<ApertureRun> = {}): ApertureRun => ({
  id: 42,
  userId: 1,
  thesisId: 3,
  accountId: 7,
  deployableCapitalCents: 4_000_000,
  intendedTrades: [],
  hurdleRateBps: null,
  holdingPeriod: "swing",
  catalystDeadlineAt: WED_1030 + 3 * DAY,
  liquidityFloorAdvUsd: 50_000_000,
  maxSingleNamePct: 8,
  invalidationRule: "Exit if the datacenter capex guide is cut",
  mandateVersion: "v1",
  status: "completed",
  universeCount: 41,
  candidateCount: 29,
  droppedNote: "12 symbols deferred to a follow-up brief",
  providerAvailability: { alpaca: true, fred: true, sonar: false },
  error: null,
  startedAt: null,
  completedAt: null,
  createdAt: 0,
  ...over,
} as ApertureRun);

describe("runRail — preset context and the countdown to the catalyst", () => {
  it("counts down to the catalyst deadline", () => {
    const rail = runRail(run(), WED_1030);
    expect(rail.msToCatalystDeadline).toBe(3 * DAY);
    expect(rail.catalystExpired).toBe(false);
    expect(rail.holdingPeriodLabel).toBe("Swing");
    expect(rail.maxHorizonDays).toBe(21);
  });

  it("goes negative and flags expiry once the window has passed", () => {
    const rail = runRail(run({ catalystDeadlineAt: WED_1030 - DAY }), WED_1030);
    expect(rail.msToCatalystDeadline).toBe(-DAY);
    expect(rail.catalystExpired).toBe(true);
  });

  it("reports no countdown, not a zero, when no deadline was set", () => {
    const rail = runRail(run({ catalystDeadlineAt: null }), WED_1030);
    expect(rail.msToCatalystDeadline).toBeNull();
    expect(rail.catalystExpired).toBeNull();
  });

  it("names the providers that were not live, rather than a silent null", () => {
    expect(runRail(run(), WED_1030).providerGaps).toEqual(["sonar"]);
  });

  it("returns null gaps — not an empty list — when availability was never recorded", () => {
    const rail = runRail(run({ providerAvailability: null }), WED_1030);
    expect(rail.providerAvailability).toBeNull();
    expect(rail.providerGaps).toBeNull();
  });

  it("marks a pre-mandate run as ungated rather than as compliant", () => {
    const rail = runRail(run({ mandateVersion: null }), WED_1030);
    expect(rail.unavailableReason).toMatch(/pre-mandate/i);
  });

  it("carries the preset ceilings through verbatim", () => {
    const rail = runRail(run(), WED_1030);
    expect(rail.liquidityFloorAdvUsd).toBe(50_000_000);
    expect(rail.maxSingleNamePct).toBe(8);
    expect(rail.invalidationRule).toMatch(/datacenter capex/);
    expect(rail.mandateVersion).toBe("v1");
  });
});

// ── Exposure grouping ─────────────────────────────────────────────────────────

describe("largestExposures", () => {
  const sectors = new Map([["NVDA", "Semiconductors"], ["AMD", "Semiconductors"]]);

  it("finds the largest single name and the largest cluster", () => {
    const e = largestExposures([
      { symbol: "NVDA", marketValueCents: 800_000 },
      { symbol: "AMD", marketValueCents: 600_000 },
    ], sectors);
    expect(e.largestPositionSymbol).toBe("NVDA");
    expect(e.largestPositionValueCents).toBe(800_000);
    expect(e.largestClusterLabel).toBe("Semiconductors");
    expect(e.largestClusterValueCents).toBe(1_400_000);
  });

  it("treats a name with no sector fact as its own cluster, not as part of none", () => {
    const e = largestExposures([{ symbol: "XYZ", marketValueCents: 900_000 }], new Map());
    expect(e.largestClusterLabel).toBe("XYZ (unclassified)");
    expect(e.largestClusterValueCents).toBe(900_000);
  });

  it("sums duplicate position rows for the same symbol", () => {
    const e = largestExposures([
      { symbol: "nvda", marketValueCents: 300_000 },
      { symbol: "NVDA", marketValueCents: 200_000 },
    ], sectors);
    expect(e.largestPositionValueCents).toBe(500_000);
  });

  it("reports nulls, not zeros, when nothing is held", () => {
    const e = largestExposures([], sectors);
    expect(e.largestPositionSymbol).toBeNull();
    expect(e.largestPositionValueCents).toBeNull();
    expect(e.largestClusterValueCents).toBeNull();
  });
});
