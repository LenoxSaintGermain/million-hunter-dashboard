# Capital Aperture Play-First UAT

**Date:** August 18, 2026  
**Scope:** Authenticated, paper-only read path for the daily trader surface.  
**Reference universe:** Jim Reference — Catalyst Reaction (Paper Trial), eight completed intraday research candidates.

## Observed Results

| Check | Result | Evidence |
|---|---|---|
| Primary entry point | Pass | `/aperture` opens to **Today’s paper plays**, with research setup behind the secondary **New research brief** action. |
| Paper account truth | Pass | Cockpit rail resolves the preferred **Alpaca Paper — AI Thesis** account, including synced equity, cash, and mandate headroom. |
| Cash / no-trade outcome | Pass | The daily list explicitly presents cash/no trade as an active decision even when research plays exist. |
| In-place play detail | Pass | The top ranked TT research play expands inside the list, retaining the surrounding ranked plays. |
| Mobile layout | Pass | A CDP-emulated **375 × 812** viewport had `scrollWidth = 375`; no horizontal overflow was detected. |
| Trader safeguards | Pass | Expanded intraday play describes the trigger as **unknown / task for you** when no verified ticket-side tape observation exists. |
| Paper-order boundary | Pass | The mobile read-path UAT did not expose a create-proposal action and invoked no skip, approval, submission, or broker action. |

## Known Limitation, Shown Honestly

The daily-play list does not yet carry a verified per-play VWAP/opening-range observation or same-theme classification. It explicitly labels those states as **not measured** and sends the operator to the evidence/preflight path rather than inventing a trigger or correlation claim.
