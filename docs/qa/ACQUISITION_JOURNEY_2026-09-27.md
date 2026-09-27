# Acquisition journey repair — 2026-09-27

Status: repair in progress; live positive journey NOT YET certified.

## First release and live retest

- Commit 9bac81a4c5edcb27c63b4ae7b59847baf61355ab pushed to main.
- Build 5c2576e9-2ee3-4063-ba46-cca74ec9f310 succeeded. Revision capital-aperture-00234-hov promoted to 100% traffic after 6/6 staged smoke checks; production 6/6 at 2026-09-27T04:49:25Z. Runtime configuration fingerprint unchanged. No schema migration.
- Live Acquisition → Capital → Acquisition switched correctly without reload.
- Live compiler produced Southeast Essential Services Platform, correctly preserving $300k–$1M cash flow, $1M–$5M asking price and GA/FL/NC/SC. It introduced unrequested franchise/PE exclusions: FAIL, further repair required.
- One research-only scan completed with zero listings, zero qualified and zero scored. Existing Tampa electrical listing was not a new result of this test.
- Empty result incorrectly said Targets added: FAIL. Added failing component regressions for this and status-query failure before fixing them.
- Linear progress comment: 89a3d515-6919-492d-b0c4-7a69f37a5c47 on THI-266.

## Reproduced in signed-in production UI

- Acquisition selection changed the query string but not the workspace until reload.
- Create acquisition search returned HTTP 500 at 2026-09-27T04:29:18Z. The text stayed visible, but no usable configuration appeared.
- The compiler used the old Forge gateway; deployed runtime has a Google provider credential but no backend Forge credential. The failed attempt may have saved a placeholder thesis record. Preserve it; do not claim no mutation.
- Sentinel refresh succeeded independently. Gemini's agent quota failure is not evidence of an application-wide outage.

## Repair

- Query subscriptions update the thesis workspace without reload.
- Acquisition compilation uses the configured Google SDK with the existing shared model role; locally validates numeric values, ranges and scoring weights.
- Asking price, revenue and seller cash flow stay separate. Removed the client's implicit 35%-of-revenue cash-flow assumption.
- Full owner-authorized thesis is passed into listing research. Ownership is checked before creating a scan job.
- Direct listing URLs are required; no arbitrary citation is substituted for a missing URL. Unknown financials remain null. Multiples are calculated only from disclosed asking price and cash flow.
- Provider/parsing failure fails the scan instead of completing with a false empty result. Scoring failure does not report all listings scored.
- Source-reported listing claims and discovery timestamp are recorded in new deal descriptions. A returned URL alone is not proof of availability or audited financials.

## Verification

- Original provider regression failed against the old router, then passed after the repair.
- Unit lane: 223 files passed, 4 skipped; 2,645 tests passed, 18 skipped. DATABASE_URL explicitly empty. This is not production database integration coverage.
- TypeScript check passed before final copy updates; rerun before release.
- Query subscription source contract is not a browser navigation test; live query-only navigation must still be repeated.

## Live journey to repeat

Use the existing hypothetical UAT thesis: Southeast HVAC/plumbing, Georgia/Florida/North Carolina/South Carolina, asking price $1M–$5M, disclosed seller cash flow $300k–$1M, five years operating, recurring maintenance and retained management preferred. These are test search criteria, not user capital commitments.

Compile → inspect exact filters → launch discovery once → await actual persisted job result → open a sourced opportunity → inspect direct source and missing evidence → reload and verify persistence. Record IDs, source URLs and gaps. No seller outreach, offers, financing applications or trading actions.

Remaining review: direct-source availability, constrained industry/geography fit, partial-result presentation, historical unsupported numeric claims, and whether every result is easily traceable to its search. Do not label the full journey complete from unit tests or deployment health.
