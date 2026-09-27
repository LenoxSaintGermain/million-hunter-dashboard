# Acquisition journey repair — 2026-09-27

Status: repair in progress; live positive journey NOT YET certified.

## Follow-up release and second live run

- Source 7132071f66c9a9dc3c9bf2e0524489e147f370d7, build 4c16ad26-6754-4dce-bab0-c7726dfde49d succeeded; revision capital-aperture-00236-yow now serves 100%. Staged and production smoke 6/6; production checked 2026-09-27T05:04:21Z. Runtime configuration fingerprint unchanged; no migration.
- Final pre-release unit lane: 225 files passed, 4 skipped; 2,651 tests passed, 18 skipped. TypeScript passed. DATABASE_URL was empty.
- Browser reload confirms the existing Tampa record is explicitly illustrative, risk is unknown before analysis, and citations are labeled saved sources. It is not a real discovered listing.
- Recompiled original UAT text into Southeast Essential Trade Services. Unrequested franchise/PE exclusions were absent. FAIL: structured cash-flow/geography fields were omitted despite the narrative retaining them; launch misleadingly said National. This remains open.
- Search #3660001 returned provider leads but FAILED saving. Cloud log confirms ER_DATA_TOO_LONG for source. Provider supplied a paragraph instead of a bounded source label and used a BizBuySell category URL rather than an individual listing URL. Raw SQL text leaked into the failure receipt. No positive discovery pass; no seller outreach or financial action.
- Added three red regressions, then repaired bounded hostname provenance, rejection of category-page evidence and safe failed-search UI (including old persisted SQL messages). Targeted 8/8 tests and TypeScript pass. These latest save/error repairs are not yet deployed at this point.
- Follow-up 263f0cd requires explicit core cash-flow/asking-price/geography fields in provider output and local validation. Null is allowed only as an explicit unstated financial criterion and remains absent, not zero, after normalization. Missing keys fail preparation rather than silently launching an altered scope. Red regression reproduced the original acceptance of missing criteria, then passed. This validates structural completeness, not perfect natural-language interpretation; repeat the original live thesis to verify interpretation.
- Combined regression suite now 2,656 passed, 18 skipped across 225 passing files; TypeScript passed. Build 8fe7b711-4b39-4ae5-ac5b-a7fe779ec596 was submitted from exact source 263f0cd830621787ea0284eb170c17b1bc885130; deployment and positive live journey remain pending.
- That build succeeded and deployed as capital-aperture-00238-xih with 100% traffic. Staged and production smoke passed 6/6; production receipt 2026-09-27T05:17:19Z. Runtime fingerprint unchanged. Browser reload confirms old failed-job SQL is no longer displayed. Positive discovery retest underway.

## First release and live retest

- Commit 9bac81a4c5edcb27c63b4ae7b59847baf61355ab pushed to main.
- Build 5c2576e9-2ee3-4063-ba46-cca74ec9f310 succeeded. Revision capital-aperture-00234-hov promoted to 100% traffic after 6/6 staged smoke checks; production 6/6 at 2026-09-27T04:49:25Z. Runtime configuration fingerprint unchanged. No schema migration.
- Live Acquisition → Capital → Acquisition switched correctly without reload.
- Live compiler produced Southeast Essential Services Platform, correctly preserving $300k–$1M cash flow, $1M–$5M asking price and GA/FL/NC/SC. It introduced unrequested franchise/PE exclusions: FAIL, further repair required.
- One research-only scan completed with zero listings, zero qualified and zero scored. Existing Tampa electrical listing was not a new result of this test.
- Empty result incorrectly said Targets added: FAIL. Added failing component regressions for this and status-query failure before fixing them.
- Linear progress comment: 89a3d515-6919-492d-b0c4-7a69f37a5c47 on THI-266.
- Follow-up commit 732c91b fixes empty/error receipts and tightens preference interpretation. Build 2a61f641-c5ab-4223-b011-68d8fa6ff9c5 was deliberately canceled before promotion to include the newly observed source-disclosure fix in one follow-up release.
- Existing `/deal/2880003` opens, but saved dossier explicitly cannot verify Tampa Bay Electric Solutions' identity. This is NOT a discovered deal from this UAT and its financials are NOT validated. No seller contact or financial action was taken.
- Deal review now exposes a direct listing link when recorded, otherwise an unverified-source warning; saved sources are not labeled live. Missing risk analysis is unknown, not a clean bill of health.
- Targeted follow-up tests: 15 passed, including source-link safety and no false empty-result success.

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

## Public-source discovery benchmark

### Source-first discovery follow-up

Production revision `capital-aperture-00238-xih` (source `263f0cd830621787ea0284eb170c17b1bc885130`, build `8fe7b711-4b39-4ae5-ac5b-a7fe779ec596`) passed 6/6 staged and production release checks. The original browser thesis preserved its financial/geographic criteria but returned zero listings. A explicitly source-seeded diagnostic returned one listing with unknown financials and zero qualified candidates. Neither is a positive end-to-end discovery pass.

The pending source-first repair retrieves individual Perplexity Search records before extracting claims with the existing Google model role. Host allowlisting, individual listing paths, exact source URLs, source titles, explicitly labeled amounts, unknown values, sidebar exclusion and duplicate-source handling are validated locally. No new provider or database migration. Read-only provider probes use `DATABASE_URL=` and do not create deals.

A prototype probe returned 12 individual listings, three matching the financial bounds on indexed claims. This is not current-availability verification or a browser UAT pass. One prior indexed Atlanta listing returned HTTP 404 on direct inspection; indexed discovery must not imply availability.

Targeted source/extraction tests: 11/11 passed, including a duplicate-source regression observed red before repair. TypeScript passed. Isolated unit lane: 226 files passed, 4 skipped; 2,662 tests passed, 18 skipped. The broad test command, with production disconnected, failed 17 files (database/credential-dependent checks and an existing URL-path decoding issue); it is not an all-suite pass. Post-release browser journey remains pending.

Direct inspection of the indexed Bibb County listing `/2483466/` returned HTTP 404 as well. Keep this as an explicit availability limitation; do not count indexed results as confirmed available opportunities.

Open acceptance gaps: explain found-but-unqualified candidates; verify exact opportunity source and persisted record in the browser; distinguish generic screening score from thesis-specific weights; retain truthful unknown geography and source availability. No outreach, offers or financing actions were taken.

Read 2026-09-27: https://www.bizbuysell.com/business-opportunity/turnkey-hvac-and-commercial-refrigeration-company/2528214/

The listing header advertises a Florida HVAC/refrigeration business: asking $1,650,000, SDE $409,140, EBITDA $309,140, revenue $1,216,000, established 2014. These are seller/broker claims, not audited figures or confirmed transaction availability. The narrative separately describes $452K 2025 SDE, so period/figure reconciliation is required. Retained technicians are not proof of retained management. No contact form was submitted.

This primary listing meets the original numeric/geographic test scope on its face. Therefore zero discovery should not be interpreted as proof that no opportunities exist. Test provider discovery against this benchmark without pre-populating or inventing a deal record.
