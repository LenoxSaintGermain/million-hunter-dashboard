# Acquisition journey repair — 2026-09-27

Status: repair in progress; live positive journey NOT YET certified.

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
