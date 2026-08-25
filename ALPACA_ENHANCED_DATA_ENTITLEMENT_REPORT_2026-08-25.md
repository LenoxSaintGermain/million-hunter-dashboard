# Alpaca Enhanced Market Data — Entitlement Verification

**Verification date:** August 25, 2026  
**Account mode:** Paper Trading  
**Test boundary:** Read-only REST requests only. No order, account configuration, position, or broker-setting mutation was performed.

## Verdict

**Confirmed:** the currently configured Alpaca Paper credentials can access the enhanced **SIP equities** and **OPRA options** market-data endpoints. This is not inferred from the subscription screenshot; it was verified through successful authenticated API responses.

| Capability probed | Endpoint/feed | Result | Evidence |
|---|---|---:|---|
| Consolidated equity quote | `v2/stocks/NVDA/quotes/latest?feed=sip` | **HTTP 200** | Quote source marked consolidated (`z: C`); API timestamp `2026-08-25T14:47:59.061Z` matched the observation second. |
| Consolidated equity trade | `v2/stocks/NVDA/trades/latest?feed=sip` | **HTTP 200** | Returned price, size, exchange, and consolidated source fields. |
| SIP minute bars | `v2/stocks/NVDA/bars?timeframe=1Min&feed=sip` | **HTTP 200** | Returned one-minute OHLCV and VWAP bars. |
| IEX comparison feed | `v2/stocks/NVDA/quotes/latest?feed=iex` | **HTTP 200** | Expected; useful as a controlled fallback, not the preferred analytical tape. |
| OPRA option snapshots | `v1beta1/options/snapshots/NVDA?feed=opra` | **HTTP 200** | Returned a large option chain page with latest quote/trade, bars, implied volatility, and Greeks. |
| Indicative option snapshots | `v1beta1/options/snapshots/NVDA?feed=indicative` | **HTTP 200** | Expected fallback feed access confirmed. |
| Market news | `v1beta1/news?symbols=NVDA&limit=1` | **HTTP 200** | Returned current article metadata. |
| Account capability check | Paper `/v2/account` | **HTTP 200** | Account `ACTIVE`; `options_approved_level: 3`; `options_trading_level: 3`. |

## What the plan unlocks

Alpaca’s official documentation states that **Algo Trader Plus** provides full U.S. equities market coverage, no 15-minute historical restriction, up to 10,000 market-data API calls per minute, and real-time OPRA options coverage; the basic plan is limited to IEX for real-time equities and indicative options data.[1] The separate pricing page describes Plus as real-time across all U.S. exchanges with unlimited WebSocket symbol subscriptions.[2]

The direct probes above corroborate the two most important application-level claims: **SIP is accessible now** and **OPRA snapshots are accessible now**.

| Capital Aperture use case | What is now technically supported | Required product guardrail |
|---|---|---|
| Intraday thesis monitoring | Consolidated one-minute bars, quotes, trades, and session VWAP | Display measured observation timestamp and feed on every intraday surface. |
| Play trigger verification | SIP price/volume context rather than IEX-only partial tape | Keep trigger state as `observed`, `unknown`, or `stale`; do not imply guaranteed execution. |
| Disclosure event evaluation | Compare filing timestamp with post-disclosure market behavior using same-feed bars | Preserve transaction date, filing date, decision time, and outcome window separately. |
| Paper outcome reconstruction | More complete equity tape for entry/exit-window measurement | Continue to label outcomes **paper-simulated**. |
| Options evidence cards | Contract snapshot, BBO, Greeks, IV, and bar context from OPRA | No options proposal or order feature should activate from this entitlement alone. |
| News-linked evidence | News metadata alongside an existing source-backed thesis | News is context; it is not a verified catalyst or trade rationale. |

## Current integration gap

The platform can now use the enhanced entitlement, but one older code path still advertises and forces the free-tier behavior:

| File | Current behavior | Impact |
|---|---|---|
| `server/aperture/providers/marketData.ts` | The provider label says “free IEX tier — delayed, IEX only.” | UI/source labeling is now materially inaccurate. |
| Same file, `fetchSecurityFacts()` | Daily fact collection hardcodes `feed=iex`. | `last_price`, 30-day ADV, and 30-day volatility facts still use IEX rather than the verified SIP entitlement. |
| Same file, `fetchIntradayBars()` | Defaults to `sip` unless explicitly overridden. | Intraday paths can already exploit the enhanced feed, provided the observation metadata stays visible. |

### Recommended implementation patch

Make the daily fact path use the existing `intradayFeed()` configuration (default `sip`) and make provider/source labels dynamic. Add one read-only entitlement smoke test that asserts: SIP quote succeeds, OPRA snapshot succeeds, and each generated fact carries a feed/source identifier and `asOf` timestamp.

This is a data-quality correction, not an execution feature. It should be completed before using Aperture’s scorecards or outcome views as “consolidated” market evidence.

## What this does **not** prove

The entitlement does not validate strategy quality, trade suitability, order-routing reliability, or real-world performance. Alpaca’s paper environment does not model market impact, information leakage, latency slippage, queue position, price improvement, regulatory fees, or dividends.[3] It also does not justify enabling autonomous order placement.

## Delivery disclosure

**Basis:** API capability verification based on authenticated HTTP response status and returned fields; no performance or investment conclusion was calculated.  
**Time:** Read-only probes were made on August 25, 2026 at approximately `14:47 UTC`.  
**Assumptions:** The configured Paper credential is attached to the active Algo Trader Plus subscription shown in the provided account screen.  
**Sources and confidence:** High confidence for endpoint availability because all relevant probes returned HTTP 200. Plan coverage is sourced from Alpaca documentation.  
**Compliance:** This is technical market-data capability research, not personalized financial advice.

## References

[1]: https://docs.alpaca.markets/us/docs/about-market-data-api "Alpaca — About Market Data API"
[2]: https://alpaca.markets/data "Alpaca — Real-Time Stock, Options and Crypto Market Data"
[3]: https://docs.alpaca.markets/docs/paper-trading "Alpaca — Paper Trading"
