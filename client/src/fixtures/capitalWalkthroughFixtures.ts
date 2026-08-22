import type { CapitalWalkthroughFixture } from "@shared/capitalWalkthrough";
import { CAPITAL_WALKTHROUGH_CAPTURE as GLP1_POSTFIX_V2 } from "./captures/2026-08-21-glp1-postfix-v2";
import { CAPITAL_WALKTHROUGH_CAPTURE as GLP1_POSTFIX_V3 } from "./captures/2026-08-21-glp1-postfix-v3";

/**
 * Written only by scripts/capture-capital-walkthrough.mts. Never overwrite an
 * existing version: the replay contract is versioned so a client demo can be
 * reopened unchanged after the captured session.
 */
export const CAPITAL_WALKTHROUGH_FIXTURES: readonly CapitalWalkthroughFixture[] = [{
  version: "2026-08-21-glp1-postfix-v1",
  capturedAt: 1787336283655,
  source: {
    runId: 390002,
    candidateId: 360001,
    slateId: null,
    accountId: 1,
    accountLabel: "Alpaca Paper — AI Thesis",
    captureReason: "Post-fix real Alpaca Paper research session captured for immutable admin replay.",
  },
  disclosure: "Frozen replay of a captured Alpaca Paper research session. Values and tape state are shown exactly as captured; stale or unknown conditions are preserved and are not recalculated. Internal research tool — not investment advice. No order can be created here.",
  account: {
    equityValueCents: 9777718,
    cashCents: 5999806,
    lastSyncedAt: 1787335365831,
    syncSource: "alpaca_paper",
    positionCount: 7,
  },
  thesis: {
    name: "GLP-1 Demand Shock: Food & Health Day-Trading Opportunities",
    holdingPeriod: "intraday",
    catalystDeadlineAt: 1787342100000,
  },
  today: {
    cashOutcome: "Cash is the explicit control outcome. No setup cleared the captured tape, liquidity, and measured-risk gates.",
    expiredPlayCount: null,
    expiredPlayBasis: "Not measured in this capture: the source-run fixture did not preserve the filtered expired-play count.",
    queueOrderingBasis: "Captured source queue order. It is not a predicted-return ranking.",
  },
  rail: {
    marketSession: "regular",
    marketSessionBasis: "maintained US equity calendar 2026-01-01..2027-12-31",
    mandateVersion: "v2",
    tightestConstraint: "Largest single name · NVDA 97.8%",
    tightestConstraintBasis: "Captured cockpit state. This session did not recalculate portfolio headroom during replay.",
    headroom: {
      largestSingleName: "$9,559 / $9,778",
      newNotionalTodayEt: "$0 / $19,555",
      plannedLossTodayEt: "$0 / $1,956",
      plannedLossPerPlayCeiling: "$733",
    },
  },
  queue: ["LLY", "PFE", "AMGN", "OZEM", "THNR", "TFX", "MDT", "JNJ"].map((symbol) => ({
    symbol,
    company: null,
    compositeScore: 3,
    playSide: null,
    evidenceSummary: "2 decision-critical evidence check(s) captured.",
    decision: null,
  })),
  selectedPlay: {
    id: 360001,
    symbol: "LLY",
    companyName: null,
    compositeScore: 3,
    verifyFields: ["D: Average daily dollar volume", "D: Realised volatility"],
    playSide: null,
  },
  trigger: {
    state: "unknown",
    minutesHeld: 0,
    minutesRequired: 15,
    vwap: null,
    lastPrice: null,
    feed: "sip",
    lagMs: null,
    needsOperatorConfirmation: true,
    basis: "no bars were returned for this session window",
    captureNow: 1787336283655,
    tapeUnavailableReason: "no SIP minute bars returned for LLY since 2026-08-21T04:00:00.000Z",
    note: "Preserved exactly as captured; the walkthrough never recomputes this trigger.",
  },
  recipe: {
    symbol: "LLY",
    side: "long",
    holdingPeriod: "intraday",
    taxonomy: {
      marketPlay: { family: "breakout", specificPlay: "opening_range_breakout", status: "candidate", basis: "30-minute opening range is still forming; this identifies a candidate setup, while VWAP remains a separate confirmation signal." },
      execution: { direction: "long", strategy: "buy_shares", instrument: "equity" },
      horizon: { key: "day_trade", label: "Day trade · same session", sourceHoldingPeriod: "intraday", basis: "The mandate requires the position to be flat before the regular session ends." },
      catalyst: { status: "time_bound", label: "Time-bound catalyst window", deadlineAt: 1787342100000, subtype: "not_classified" },
      signals: [
        { key: "opening_range", label: "30-minute opening range", status: "pending", basis: "Opening range is still forming." },
        { key: "vwap_hold", label: "VWAP hold confirmation", status: "pending", basis: "no bars were returned for this session window" },
        { key: "catalyst_deadline", label: "Catalyst-window boundary", status: "confirmed", basis: "The catalyst deadline is still open." },
      ],
    },
    readiness: "needs_tape",
    entry: null,
    stop: null,
    slippage: null,
    targets: [],
    budgetCents: null,
    qty: null,
    notionalCents: null,
    plannedLossCents: null,
    plannedLossPctOfEquity: null,
    sizeLimitedByNotionalCeiling: false,
    timeStopAt: null,
    noTradeConditions: [],
    trigger: { state: "unknown", minutesHeld: 0, minutesRequired: 15, vwap: null, lastPrice: null, feed: "sip", lagMs: null, needsOperatorConfirmation: true, basis: "no bars were returned for this session window" },
    tapeBasis: "SIP consolidated tape; no bar timestamp available",
    feed: "sip",
    unavailableReasons: ["no minute bars for this session — no level can be derived without an observed tape"],
    assumptions: [],
  },
  evidence: {
    verifiedFields: ["D: Average daily dollar volume", "D: Realised volatility"],
    setAside: [],
    setAsideBasis: "No set-aside rows were persisted for source run #390002; the replay preserves that absence rather than backfilling rejected names.",
  },
  proposal: {
    allowed: {
      evaluation: { passed: false, mandateVersion: "v2", evaluatedAt: 1787336283655, failures: ["intraday play requires a positive entry price", "intraday play requires a stop different from entry", "intraday play requires a slippage allowance", "intraday play requires a future time stop inside the catalyst window", "intraday play requires at least one no-trade condition", "a intraday play must state qty, entry, stop and slippage so its planned loss can be measured — an unmeasurable loss is not a small one", "no 30-day ADV fact for LLY — an unknown liquidity is not a passing liquidity"] },
      resolvedIntent: { intent: "open", inferred: false, basis: "stated intent \"open\" (no position is held)", conflict: null },
      session: { session: "regular", basis: "maintained US equity calendar 2026-01-01..2027-12-31", dateEt: "2026-08-21", etMinutes: 858, halfDay: false },
      note: "Preflight-only capture; no order row was created.",
    },
    refused: {
      evaluation: { passed: false, mandateVersion: "v2", evaluatedAt: 1787336283655, failures: ["this order was marked closing, but there is no long position for it to close", "intraday play requires a positive entry price", "intraday play requires a stop different from entry", "intraday play requires a slippage allowance", "intraday play requires a future time stop inside the catalyst window", "intraday play requires at least one no-trade condition", "a intraday play must state qty, entry, stop and slippage so its planned loss can be measured — an unmeasurable loss is not a small one", "no 30-day ADV fact for LLY — an unknown liquidity is not a passing liquidity"] },
      resolvedIntent: { intent: "open", inferred: false, basis: "stated intent \"close\" but no position is held — treated as opening so the exposure ceilings apply", conflict: "this order was marked closing, but there is no long position for it to close" },
      session: { session: "regular", basis: "maintained US equity calendar 2026-01-01..2027-12-31", dateEt: "2026-08-21", etMinutes: 858, halfDay: false },
      note: "Preflight-only capture; no order row was created.",
    },
    refusalReason: "A stated close with no provable closing position is deliberately gated as an opening-risk violation or refused outright. The replay preserves that refusal.",
  },
  outcome: {
    captured: null,
    absentReason: "No live slate or outcome-ledger row existed for this source run at capture time.",
    sampleSufficiency: "0 closed trades: this validates the decision process, not an edge.",
  },
}, GLP1_POSTFIX_V2, GLP1_POSTFIX_V3];
