import type { CapitalWalkthroughFixture } from "@shared/capitalWalkthrough";

export const CAPITAL_WALKTHROUGH_CAPTURE: CapitalWalkthroughFixture = {
  "version": "2026-08-21-glp1-postfix-v2",
  "capturedAt": 1787337123816,
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
    "equityValueCents": 9777718,
    "cashCents": 5999806,
    "lastSyncedAt": 1787335365831,
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
    "expiredPlayCount": null,
    "expiredPlayBasis": "Not measured by this capture source.",
    "queueOrderingBasis": "Captured source queue order."
  },
  "rail": {
    "marketSession": "regular",
    "marketSessionBasis": "maintained US equity calendar 2026-01-01..2027-12-31",
    "mandateVersion": "v2",
    "tightestConstraint": "Not measured by the capture generator.",
    "tightestConstraintBasis": "The capture did not retrieve a cockpit payload.",
    "headroom": {}
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
    "captureNow": 1787337123816,
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
        "status": "time_bound",
        "label": "Time-bound catalyst window",
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
          "status": "confirmed",
          "basis": "The catalyst deadline is still open."
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
    "setAsideBasis": "Set-aside rows were not retrieved by this capture version."
  },
  "proposal": {
    "allowed": {
      "evaluation": {
        "passed": false,
        "mandateVersion": "v2",
        "evaluatedAt": 1787337123816,
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
            "passed": true,
            "detail": "catalyst is 0.06d out, inside the 1d intraday horizon",
            "observed": 0.06,
            "ceiling": 1
          },
          {
            "key": "market_session_known",
            "passed": true,
            "detail": "session: regular (maintained US equity calendar 2026-01-01..2027-12-31)",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "market_open",
            "passed": true,
            "detail": "market session is regular",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "intraday_requires_regular_session",
            "passed": true,
            "detail": "intraday order placed during the regular session",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "intraday_cutoff",
            "passed": true,
            "detail": "14:32 ET is before the 15:55 ET intraday cutoff",
            "observed": 872,
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
            "detail": "account equity $97,777.18",
            "observed": 9777718,
            "ceiling": null
          },
          {
            "key": "order_notional_ceiling",
            "passed": true,
            "detail": "order $0.01 is within the $4,888.86 single-order ceiling",
            "observed": 1,
            "ceiling": 488885.9
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
        "session": "regular",
        "basis": "maintained US equity calendar 2026-01-01..2027-12-31",
        "dateEt": "2026-08-21",
        "etMinutes": 872,
        "halfDay": false
      },
      "note": "Preflight-only capture; no order row was created."
    },
    "refused": {
      "evaluation": {
        "passed": false,
        "mandateVersion": "v2",
        "evaluatedAt": 1787337123816,
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
            "passed": true,
            "detail": "catalyst is 0.06d out, inside the 1d intraday horizon",
            "observed": 0.06,
            "ceiling": 1
          },
          {
            "key": "market_session_known",
            "passed": true,
            "detail": "session: regular (maintained US equity calendar 2026-01-01..2027-12-31)",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "market_open",
            "passed": true,
            "detail": "market session is regular",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "intraday_requires_regular_session",
            "passed": true,
            "detail": "intraday order placed during the regular session",
            "observed": null,
            "ceiling": null
          },
          {
            "key": "intraday_cutoff",
            "passed": true,
            "detail": "14:32 ET is before the 15:55 ET intraday cutoff",
            "observed": 872,
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
            "detail": "account equity $97,777.18",
            "observed": 9777718,
            "ceiling": null
          },
          {
            "key": "order_notional_ceiling",
            "passed": true,
            "detail": "order $0.01 is within the $4,888.86 single-order ceiling",
            "observed": 1,
            "ceiling": 488885.9
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
        "session": "regular",
        "basis": "maintained US equity calendar 2026-01-01..2027-12-31",
        "dateEt": "2026-08-21",
        "etMinutes": 872,
        "halfDay": false
      },
      "note": "Preflight-only capture; no order row was created."
    },
    "refusalReason": "A stated close with no provable closing position is deliberately gated as an opening-risk violation or refused outright."
  },
  "outcome": {
    "captured": null,
    "absentReason": "No outcome-ledger row was captured for this source run.",
    "sampleSufficiency": "0 closed trades: this validates the decision process, not an edge."
  }
};
