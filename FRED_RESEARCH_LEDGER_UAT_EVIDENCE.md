# FRED Research Ledger UAT Evidence

**Verification date:** 2026-08-15  
**Surface:** `Capital Aperture → run #30001 → Research ledger`  
**Session:** Isolated local preview using the owner-equivalent authenticated context; no live order submission occurred.

The completed Capital Brief was opened successfully and the **Research ledger** view was selected. The initial empty state correctly explained that FRED was connected but that the legacy brief did not yet contain a persisted macro snapshot. Selecting **Refresh macro evidence** performed a read-only refresh and returned the confirmation: **“Macro ledger refreshed — 7 FRED observations recorded.”**

The resulting ledger rendered all seven FRED-backed observations as cards. Each card showed the **FRED · verified macro evidence** provenance badge, the displayed value, an **Observed** date, the FRED series identifier and description, a direct **Source** link to the relevant FRED series, and a non-prescriptive **Why it matters** explanation. The dedicated help controls exposed thesis-impact guidance, including “How Federal funds rate affects this thesis.”

| Evidence card | Observation date shown | Series |
|---|---:|---|
| Federal funds rate | Aug 13, 2026 | DFF |
| 10-year Treasury | Aug 13, 2026 | DGS10 |
| 2-year Treasury | Aug 13, 2026 | DGS2 |
| Consumer price index | Jul 1, 2026 | CPIAUCSL |
| Unemployment rate | Jul 1, 2026 | UNRATE |
| Industrial production | Jun 1, 2026 | INDPRO |
| 10-year inflation expectation | Aug 14, 2026 | T10YIE |

The ledger itself carries the caution that these observations frame the macro regime for research and are **not a directional trade instruction**. The Capital Aperture disclaimer remained visible: **“Internal research tool — not investment advice. Paper-only decisions require human approval.”**
