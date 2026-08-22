import type { CapitalWalkthroughFixture } from "@shared/capitalWalkthrough";

export const CAPITAL_WALKTHROUGH_CAPTURE: CapitalWalkthroughFixture = {
  "version": "2026-08-21-glp1-postfix-v3",
  "capturedAt": 1787363996287,
  "source": {
    "runId": 390002,
    "candidateId": 360001,
    "slateId": null,
    "accountId": 1,
    "accountLabel": "Alpaca Paper — AI Thesis",
    "captureReason": "Real paper research session captured for immutable admin replay."
  },
  "disclosure": "Frozen replay of a captured Alpaca Paper research session. Values and tape state are shown exactly as captured; stale or unknown conditions are preserved and are not recalculated. Internal research tool — not investment advice. No order can be created here.",
  "account": {
    "equityValueCents": 9778515,
    "cashCents": 5999806,
    "lastSyncedAt": 1787356309024,
    "syncSource": "alpaca_paper",
    "positionCount": 7
  },
  "thesis": {
    "name": "GLP-1 Demand Shock: Food & Health Day-Trading Opportunities",
    "holdingPeriod": "intraday",
    "catalystDeadlineAt": 1787342100000
  },
  "today": {
    "cashOutcome": "Cash is the explicit control outcome in the captured session.",
    "expiredPlayCount": 16,
    "expiredPlayBasis": "Same-thesis completed intraday and catalyst-window candidates whose deadline had passed at capture.",
    "queueOrderingBasis": "Captured source queue order.",
    "capturedAt": 1787363996287,
    "source": "aperture.play.list expiry predicate"
  },
  "rail": {
    "marketSession": "closed",
    "marketSessionBasis": "maintained US equity calendar 2026-01-01..2027-12-31",
    "mandateVersion": "v2",
    "tightestConstraint": "Captured full headroom payload; use the smallest remaining measure with its source reason.",
    "tightestConstraintBasis": "server/aperture/cockpit.buildCockpit",
    "headroom": {
      "mandateVersion": "v2",
      "equityCents": 9778515,
      "equityBasis": "last synced account equity",
      "lines": [
        {
          "key": "position",
          "label": "Largest single name",
          "subject": "NVDA",
          "usedCents": 953794,
          "ceilingCents": 977851.5,
          "remainingCents": 24057.5,
          "usedPct": 9.75,
          "ceilingPct": 10,
          "basis": "market value of the largest held position",
          "reason": null
        },
        {
          "key": "cluster",
          "label": "Largest correlated cluster",
          "subject": "NVDA (unclassified)",
          "usedCents": 953794,
          "ceilingCents": 2444628.75,
          "remainingCents": 1490834.75,
          "usedPct": 9.75,
          "ceilingPct": 25,
          "basis": "summed market value of held names sharing a sector fact; a name with no sector fact is its own cluster",
          "reason": null
        },
        {
          "key": "run_gross_deployed",
          "label": "This run, gross deployed",
          "subject": null,
          "usedCents": 0,
          "ceilingCents": 3911406,
          "remainingCents": 3911406,
          "usedPct": 0,
          "ceilingPct": 40,
          "basis": "buy notional on this run's orders that are pending approval, approved, submitted or filled",
          "reason": null
        },
        {
          "key": "daily_new_notional",
          "label": "New notional today (ET)",
          "subject": null,
          "usedCents": 0,
          "ceilingCents": 1955703,
          "remainingCents": 1955703,
          "usedPct": 0,
          "ceilingPct": 20,
          "basis": "buy notional created since ET midnight, across all runs",
          "reason": null
        },
        {
          "key": "daily_planned_risk",
          "label": "Planned loss today (ET)",
          "subject": null,
          "usedCents": 0,
          "ceilingCents": 195570.30000000002,
          "remainingCents": 195570.30000000002,
          "usedPct": 0,
          "ceilingPct": 2,
          "basis": "qty x (|entry - stop| + slippage), summed over live orders created since ET midnight; orders with no stated stop contribute nothing",
          "reason": null
        },
        {
          "key": "correlated_planned_risk",
          "label": "Planned loss, largest theme",
          "subject": null,
          "usedCents": null,
          "ceilingCents": 122231.4375,
          "remainingCents": null,
          "usedPct": null,
          "ceilingPct": 1.25,
          "basis": "planned loss summed over today's live orders sharing a sector fact — several plays on one theme are one bet",
          "reason": "no planned loss is committed in any cluster today"
        },
        {
          "key": "planned_risk_per_play",
          "label": "Planned loss, one play",
          "subject": null,
          "usedCents": null,
          "ceilingCents": 73338.8625,
          "remainingCents": null,
          "usedPct": null,
          "ceilingPct": 0.75,
          "basis": "per-play ceiling on qty x (|entry - stop| + slippage)",
          "reason": null
        },
        {
          "key": "single_order",
          "label": "Single order",
          "subject": null,
          "usedCents": null,
          "ceilingCents": 488925.75,
          "remainingCents": 488925.75,
          "usedPct": null,
          "ceilingPct": 5,
          "basis": "per-order ceiling — 5% of equity or $10,000, whichever binds first. Not a running total.",
          "reason": null
        }
      ]
    },
    "capturedAt": 1787363996287,
    "source": "persisted Capital cockpit rail"
  },
  "queue": [
    {
      "symbol": "LLY",
      "company": null,
      "compositeScore": 3,
      "playSide": null,
      "evidenceSummary": "2 decision-critical evidence check(s) captured.",
      "decision": null
    },
    {
      "symbol": "PFE",
      "company": null,
      "compositeScore": 3,
      "playSide": null,
      "evidenceSummary": "2 decision-critical evidence check(s) captured.",
      "decision": null
    },
    {
      "symbol": "AMGN",
      "company": null,
      "compositeScore": 3,
      "playSide": null,
      "evidenceSummary": "2 decision-critical evidence check(s) captured.",
      "decision": null
    },
    {
      "symbol": "OZEM",
      "company": null,
      "compositeScore": 3,
      "playSide": null,
      "evidenceSummary": "2 decision-critical evidence check(s) captured.",
      "decision": null
    },
    {
      "symbol": "THNR",
      "company": null,
      "compositeScore": 3,
      "playSide": null,
      "evidenceSummary": "2 decision-critical evidence check(s) captured.",
      "decision": null
    },
    {
      "symbol": "TFX",
      "company": null,
      "compositeScore": 3,
      "playSide": null,
      "evidenceSummary": "2 decision-critical evidence check(s) captured.",
      "decision": null
    },
    {
      "symbol": "MDT",
      "company": null,
      "compositeScore": 3,
      "playSide": null,
      "evidenceSummary": "2 decision-critical evidence check(s) captured.",
      "decision": null
    },
    {
      "symbol": "JNJ",
      "company": null,
      "compositeScore": 3,
      "playSide": null,
      "evidenceSummary": "2 decision-critical evidence check(s) captured.",
      "decision": null
    }
  ],
  "selectedPlay": {
    "id": 360001,
    "symbol": "LLY",
    "companyName": null,
    "compositeScore": 3,
    "verifyFields": [
      "D: Average daily dollar volume",
      "D: Realised volatility"
    ],
    "playSide": null
  },
  "trigger": {
    "state": "unknown",
    "minutesHeld": 0,
    "minutesRequired": 15,
    "vwap": null,
    "lastPrice": null,
    "feed": "sip",
    "lagMs": null,
    "needsOperatorConfirmation": true,
    "basis": "no bars were returned for this session window",
    "captureNow": 1787363996287,
    "tapeUnavailableReason": "no SIP minute bars returned for LLY since 2026-08-21T04:00:00.000Z",
    "note": "Preserved exactly as captured; the walkthrough never recomputes this trigger."
  },
  "recipe": {
    "symbol": "LLY",
    "side": "long",
    "holdingPeriod": "intraday",
    "taxonomy": {
      "marketPlay": {
        "family": "breakout",
        "specificPlay": "opening_range_breakout",
        "status": "candidate",
        "basis": "30-minute opening range is still forming; this identifies a candidate setup, while VWAP remains a separate confirmation signal."
      },
      "execution": {
        "direction": "long",
        "strategy": "buy_shares",
        "instrument": "equity"
      },
      "horizon": {
        "key": "day_trade",
        "label": "Day trade · same session",
        "sourceHoldingPeriod": "intraday",
        "basis": "The mandate requires the position to be flat before the regular session ends."
      },
      "catalyst": {
        "status": "expired",
        "label": "Catalyst deadline has passed",
        "deadlineAt": 1787342100000,
        "subtype": "not_classified"
      },
      "signals": [
        {
          "key": "opening_range",
          "label": "30-minute opening range",
          "status": "pending",
          "basis": "Opening range is still forming."
        },
        {
          "key": "vwap_hold",
          "label": "VWAP hold confirmation",
          "status": "pending",
          "basis": "no bars were returned for this session window"
        },
        {
          "key": "catalyst_deadline",
          "label": "Catalyst-window boundary",
          "status": "rejected",
          "basis": "The catalyst deadline has passed."
        }
      ]
    },
    "readiness": "needs_tape",
    "entry": null,
    "stop": null,
    "slippage": null,
    "targets": [],
    "budgetCents": null,
    "qty": null,
    "notionalCents": null,
    "plannedLossCents": null,
    "plannedLossPctOfEquity": null,
    "sizeLimitedByNotionalCeiling": false,
    "timeStopAt": null,
    "noTradeConditions": [],
    "trigger": {
      "state": "unknown",
      "minutesHeld": 0,
      "minutesRequired": 15,
      "vwap": null,
      "lastPrice": null,
      "feed": "sip",
      "lagMs": null,
      "needsOperatorConfirmation": true,
      "basis": "no bars were returned for this session window"
    },
    "tapeBasis": "SIP consolidated tape; no bar timestamp available",
    "feed": "sip",
    "unavailableReasons": [
      "no minute bars for this session — no level can be derived without an observed tape"
    ],
    "assumptions": []
  },
  "evidence": {
    "verifiedFields": [
      "D: Average daily dollar volume",
      "D: Realised volatility"
    ],
    "setAside": [],
    "setAsideBasis": "Persisted scorer hard stops from aperture_set_aside for the captured source run.",
    "capturedAt": 1787363996287,
    "source": "aperture_set_aside"
  },
  "proposal": {
    "allowed": {
      "evaluation": {
        "passed": false,
        "mandateVersion": "v2",
        "evaluatedAt": 1787363996287,
        "results": [
          {
            "key": "order_intent",
            "passed": true,
            "detail": "opens exposure — stated intent \"open\" (no position is held)",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "paper_account",
            "passed": true,
            "detail": "account is a paper account",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "paper_acknowledgement",
            "passed": true,
            "detail": "operator acknowledged this is a paper order",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "reason",
            "passed": true,
            "detail": "reason stated",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "invalidation_condition",
            "passed": true,
            "detail": "invalidation condition stated",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "holding_period",
            "passed": true,
            "detail": "holding period: Intraday",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "catalyst_deadline",
            "passed": false,
            "detail": "catalystDeadlineAt is in the past",
            "observed": 1787342100000,
            "ceiling": 1787363996287
          },
          {
            "key": "market_session_known",
            "passed": true,
            "detail": "session: closed (maintained US equity calendar 2026-01-01..2027-12-31)",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "market_open",
            "passed": false,
            "detail": "market is closed — no order may be created",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "intraday_requires_regular_session",
            "passed": false,
            "detail": "an intraday order requires the regular session (current: closed)",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "intraday_cutoff",
            "passed": false,
            "detail": "no new intraday order after 15:55 ET (now 21:59 ET) — the position must be flat by the close",
            "observed": 1319,
            "ceiling": 955
          },
          {
            "key": "play_entry",
            "passed": false,
            "detail": "intraday play requires a positive entry price",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "play_stop",
            "passed": false,
            "detail": "intraday play requires a stop different from entry",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "play_slippage",
            "passed": false,
            "detail": "intraday play requires a slippage allowance",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "play_time_stop",
            "passed": false,
            "detail": "intraday play requires a future time stop inside the catalyst window",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "play_no_trade_condition",
            "passed": false,
            "detail": "intraday play requires at least one no-trade condition",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "planned_risk_stated",
            "passed": false,
            "detail": "a intraday play must state qty, entry, stop and slippage so its planned loss can be measured — an unmeasurable loss is not a small one",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "notional_resolvable",
            "passed": true,
            "detail": "order notional $0.01 (derived_from_last_price)",
            "observed": 1,
            "ceiling": null
          },
          {
            "key": "equity_known",
            "passed": true,
            "detail": "account equity $97,785.15",
            "observed": 9778515,
            "ceiling": null
          },
          {
            "key": "order_notional_ceiling",
            "passed": true,
            "detail": "order $0.01 is within the $4,889.26 single-order ceiling",
            "observed": 1,
            "ceiling": 488925.75
          },
          {
            "key": "position_concentration",
            "passed": true,
            "detail": "LLY would be 0% of equity, within 10%",
            "observed": 0,
            "ceiling": 10
          },
          {
            "key": "cluster_concentration",
            "passed": true,
            "detail": "cluster \"LLY (unclassified)\" would be 0% of equity, within 25%",
            "observed": 0,
            "ceiling": 25
          },
          {
            "key": "run_gross_deployed",
            "passed": true,
            "detail": "run would have deployed 0% of equity, within 40%",
            "observed": 0,
            "ceiling": 40
          },
          {
            "key": "daily_new_notional",
            "passed": true,
            "detail": "new notional today would be 0% of equity, within 20%",
            "observed": 0,
            "ceiling": 20
          },
          {
            "key": "liquidity_adv_floor",
            "passed": false,
            "detail": "no 30-day ADV fact for LLY — an unknown liquidity is not a passing liquidity",
            "observed": null,
            "ceiling": 20000000
          }
        ],
        "failures": [
          "catalystDeadlineAt is in the past",
          "market is closed — no order may be created",
          "an intraday order requires the regular session (current: closed)",
          "no new intraday order after 15:55 ET (now 21:59 ET) — the position must be flat by the close",
          "intraday play requires a positive entry price",
          "intraday play requires a stop different from entry",
          "intraday play requires a slippage allowance",
          "intraday play requires a future time stop inside the catalyst window",
          "intraday play requires at least one no-trade condition",
          "a intraday play must state qty, entry, stop and slippage so its planned loss can be measured — an unmeasurable loss is not a small one",
          "no 30-day ADV fact for LLY — an unknown liquidity is not a passing liquidity"
        ],
        "notes": [
          "order notional derived from the last priced fact, not stated by the operator — the ceiling was checked against a modeled figure",
          "no sector fact for LLY — treated as a single-name cluster, so the cluster gate equals the position gate"
        ]
      },
      "resolvedIntent": {
        "intent": "open",
        "inferred": false,
        "basis": "stated intent \"open\" (no position is held)",
        "conflict": null
      },
      "session": {
        "session": "closed",
        "basis": "maintained US equity calendar 2026-01-01..2027-12-31",
        "dateEt": "2026-08-21",
        "etMinutes": 1319,
        "halfDay": false
      },
      "note": "Preflight-only capture; no order row was created."
    },
    "refused": {
      "evaluation": {
        "passed": false,
        "mandateVersion": "v2",
        "evaluatedAt": 1787363996287,
        "results": [
          {
            "key": "order_intent",
            "passed": false,
            "detail": "this order was marked closing, but there is no long position for it to close",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "paper_account",
            "passed": true,
            "detail": "account is a paper account",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "paper_acknowledgement",
            "passed": true,
            "detail": "operator acknowledged this is a paper order",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "reason",
            "passed": true,
            "detail": "reason stated",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "invalidation_condition",
            "passed": true,
            "detail": "invalidation condition stated",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "holding_period",
            "passed": true,
            "detail": "holding period: Intraday",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "catalyst_deadline",
            "passed": false,
            "detail": "catalystDeadlineAt is in the past",
            "observed": 1787342100000,
            "ceiling": 1787363996287
          },
          {
            "key": "market_session_known",
            "passed": true,
            "detail": "session: closed (maintained US equity calendar 2026-01-01..2027-12-31)",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "market_open",
            "passed": false,
            "detail": "market is closed — no order may be created",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "intraday_requires_regular_session",
            "passed": false,
            "detail": "an intraday order requires the regular session (current: closed)",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "intraday_cutoff",
            "passed": false,
            "detail": "no new intraday order after 15:55 ET (now 21:59 ET) — the position must be flat by the close",
            "observed": 1319,
            "ceiling": 955
          },
          {
            "key": "play_entry",
            "passed": false,
            "detail": "intraday play requires a positive entry price",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "play_stop",
            "passed": false,
            "detail": "intraday play requires a stop different from entry",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "play_slippage",
            "passed": false,
            "detail": "intraday play requires a slippage allowance",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "play_time_stop",
            "passed": false,
            "detail": "intraday play requires a future time stop inside the catalyst window",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "play_no_trade_condition",
            "passed": false,
            "detail": "intraday play requires at least one no-trade condition",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "planned_risk_stated",
            "passed": false,
            "detail": "a intraday play must state qty, entry, stop and slippage so its planned loss can be measured — an unmeasurable loss is not a small one",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "notional_resolvable",
            "passed": true,
            "detail": "order notional $0.01 (derived_from_last_price)",
            "observed": 1,
            "ceiling": null
          },
          {
            "key": "equity_known",
            "passed": true,
            "detail": "account equity $97,785.15",
            "observed": 9778515,
            "ceiling": null
          },
          {
            "key": "order_notional_ceiling",
            "passed": true,
            "detail": "order $0.01 is within the $4,889.26 single-order ceiling",
            "observed": 1,
            "ceiling": 488925.75
          },
          {
            "key": "position_concentration",
            "passed": true,
            "detail": "LLY would be 0% of equity, within 10%",
            "observed": 0,
            "ceiling": 10
          },
          {
            "key": "cluster_concentration",
            "passed": true,
            "detail": "cluster \"LLY (unclassified)\" would be 0% of equity, within 25%",
            "observed": 0,
            "ceiling": 25
          },
          {
            "key": "run_gross_deployed",
            "passed": true,
            "detail": "run would have deployed 0% of equity, within 40%",
            "observed": 0,
            "ceiling": 40
          },
          {
            "key": "daily_new_notional",
            "passed": true,
            "detail": "new notional today would be 0% of equity, within 20%",
            "observed": 0,
            "ceiling": 20
          },
          {
            "key": "liquidity_adv_floor",
            "passed": false,
            "detail": "no 30-day ADV fact for LLY — an unknown liquidity is not a passing liquidity",
            "observed": null,
            "ceiling": 20000000
          }
        ],
        "failures": [
          "this order was marked closing, but there is no long position for it to close",
          "catalystDeadlineAt is in the past",
          "market is closed — no order may be created",
          "an intraday order requires the regular session (current: closed)",
          "no new intraday order after 15:55 ET (now 21:59 ET) — the position must be flat by the close",
          "intraday play requires a positive entry price",
          "intraday play requires a stop different from entry",
          "intraday play requires a slippage allowance",
          "intraday play requires a future time stop inside the catalyst window",
          "intraday play requires at least one no-trade condition",
          "a intraday play must state qty, entry, stop and slippage so its planned loss can be measured — an unmeasurable loss is not a small one",
          "no 30-day ADV fact for LLY — an unknown liquidity is not a passing liquidity"
        ],
        "notes": [
          "order notional derived from the last priced fact, not stated by the operator — the ceiling was checked against a modeled figure",
          "no sector fact for LLY — treated as a single-name cluster, so the cluster gate equals the position gate"
        ]
      },
      "resolvedIntent": {
        "intent": "open",
        "inferred": false,
        "basis": "stated intent \"close\" but no position is held — treated as opening so the exposure ceilings apply",
        "conflict": "this order was marked closing, but there is no long position for it to close"
      },
      "session": {
        "session": "closed",
        "basis": "maintained US equity calendar 2026-01-01..2027-12-31",
        "dateEt": "2026-08-21",
        "etMinutes": 1319,
        "halfDay": false
      },
      "note": "Preflight-only capture; no order row was created."
    },
    "refusalReason": "A stated close with no provable closing position is deliberately gated as an opening-risk violation or refused outright."
  },
  "outcome": {
    "captured": null,
    "absentReason": "No outcome-ledger row was captured for this source run.",
    "sampleSufficiency": "0 closed trades: this validates the decision process, not an edge.",
    "capturedAt": 1787363996287,
    "source": "aperture_play_slates and aperture_play_slate_items"
  }
};
