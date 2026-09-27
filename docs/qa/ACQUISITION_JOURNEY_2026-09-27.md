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

#### Live run on source 5389097

Build `b178afda-979f-4193-8d89-50e7324362e0` succeeded; revision `capital-aperture-00240-quy` received 100% traffic. Staged smoke 6/6 at 05:45:53Z; production smoke 6/6 at 05:46:30Z. An earlier probe during traffic propagation saw the old SHA and failed, then passed after promotion finished. Configuration fingerprint stayed unchanged.

Original unseeded thesis -> search **3720001** -> **12 found / 3 financially matched / 3 scored**. Reload preserved completion. Saved opportunity **3660001** (Bibb County) retained the exact original thesis, source URL and discovery time in its detail view; other records were **3660002** and **3660003**. This verifies UI navigation and persistence, not availability or investment merit.

Browser inspection of the Bibb County original source displayed BizBuySell's "page could not be found" screen. The queue nevertheless labeled a different unverified indexed target HIGH CONVICTION and suggested outreach based on score. UAT is therefore not complete.

Pending follow-up: source HTTP checks reject known 404/410 records, preserve 403/redirect/timeout as unverified conditional research, and persist both promoted/rejected screening reasons in existing activity records. A local read-only source probe returned 403 for both the missing-page URL and the previously readable Columbia benchmark, proving that automated access denial must not be equated with sale/unavailability. No bypass attempted.

The dashboard now routes scored candidates to evidence review, labels claims unverified, distinguishes illustrative records, and displays screening history instead of blank activity rows. The rendered high-score handoff test failed against the old outreach link and passed after repair. New source-gate tests cover unavailable, blocked, redirect, timeout, and retained rejection records. Isolated unit lane: **228 files passed / 4 skipped; 2672 tests passed / 18 skipped**. Follow-up targeted lane **13/13 passed** and TypeScript passed. No database migration or seller contact.

Positive original-source check: opportunity **3660002**, https://www.bizbuysell.com/business-opportunity/commercial-hvac-sheet-metal-fabrication-and-installation/2489430/ opened successfully in the browser. The page states Columbia County, GA; asking $1.1M; SDE $338,930; revenue $2,792,789; established 1990; 12 full-time employees. All remain seller/broker claims. It describes commercial ductwork fabrication/installation, secured project backlog, GA/SC mechanical-contractor licensing, and an owner willing to remain at buyer discretion. Recurring maintenance revenue is not established. No contact form interaction.

Downstream gap reproduced: opening the new deal automatically generated a dossier using generic name/location/industry, omitting the original listing URL. It correctly declined to identify a legal business but searched unrelated companies and missed the source's disclosed location. The dossier query currently generates on reads, while its Refresh button only refetches the cached query and claims live updates. Next repair must pass the exact source context, separate saved reads from deliberate research, and verify refreshed evidence without borrowing identities from similarly named firms.

#### Dossier handoff repair (browser verified)

Thesis-comparison integration (pending deployment/UAT): scan trigger validates/captures saved weights before job creation; discovery retains exact indexed source excerpts and retrieval timestamps; each qualified listing is assessed against those exact dimensions with the existing configured Google role. Missing/changed dimensions or provider failure are explicitly unavailable, and unsupported quotes yield incomplete criteria. Weighted math remains deterministic. A versioned user/search-scoped snapshot is appended to existing `research_results` storage (no schema migration), separate from global catalog scores. Reads recompute from the saved weights/claims and do not call providers; expired records remain readable with a stale warning. Completed search now displays comparison, evidence coverage, each criterion's quote and a direct opportunity link. No prior searches are overwritten; oversized text is rejected before DB insert. Unit suite 2693 passed / 18 skipped before two additional edge cases; final focused comparison tests 13/13 passed and TypeScript passed. Live new-search comparison and cross-device reload remain unverified. Existing generic score/stage behavior is unchanged; audit rescans against advanced deal stages before claiming all lifecycle regressions covered.

Citation/financing release verified: build `26169977-9a3c-4d92-9dba-3b490f2958ae` succeeded at 06:25:23Z; source `38e535c50f023e5832b2f37cf7bd1c98d620ec2a` staged as `capital-aperture-00244-hud` with unchanged configuration fingerprint. Staged checks 6/6 at 06:27:06Z; production checks 6/6 at 06:27:29Z after 100% promotion. Browser opportunity 3660002 now shows modeled cash coverage 2.03, buyer equity $110k / loan $990k, and explicit 90% / 11.5% / 10-year assumptions and non-approval caveats. Expanding the saved dossier and Sources disclosure exposed numbered links 1 through 15. Research timestamp remained 02:13:47 AM ET during reload/read; no new research, seller contact, or financing action. Thesis comparison foundation in 30584cd is not in this release and is still unwired.

Ranking foundation (not wired to runtime): `shared/acquisitionThesisComparison.ts` calculates custom weighted totals from captured source-backed criterion assessments. Missing evidence retains its weight and produces no complete score; it is not silently renormalized. Exact quoted text and source URL must match the supplied snapshot, duplicate assessments fail that criterion, and weights must be unique and total 100. Four deterministic tests pass. Quote matching grounds the cited text, not its truth or the validity of a model's interpretation. Per-search persistence, provider assessment and visible comparison are still required before this resolves the ranking defect.

Ranking investigation, current source 38e535c: `scan.trigger` reads thesis text and compiled filters but not `scoringWeights`; `runScanPipeline` calls `scoreDeal(deal)` with no thesis context. The six fixed dimensions therefore cannot implement arbitrary compiled dimensions (for example recurring revenue). `deals.score` is a global catalog value, so overwriting it with one user's thesis-specific score would introduce cross-thesis contamination. The repair must keep a per-search comparison with the exact thesis/weights/evidence snapshot, calculate weighted totals deterministically, preserve unsupported criteria as unknown, and expose evidence coverage rather than renormalizing away missing dimensions. Existing schema has no per-search result field/table; choose a bounded versioned persistence path before connecting the UI, rather than silently reusing the global score.

Release in progress: build `26169977-9a3c-4d92-9dba-3b490f2958ae` for source `38e535c50f023e5832b2f37cf7bd1c98d620ec2a`, verified WORKING. It includes citation access and illustrative financing fixes. Production remains 00242-how until staging and release checks pass; no promotion claimed.

Financing follow-up (not yet deployed): removed the unsupported top-line DSCR shortcut. Shared screening math now amortizes the existing 90% loan / 11.5% annual rate / 120-month assumptions for both the server capital compatibility score and the opportunity page. The example gives $167,027.39 annual debt service and 2.03x seller-cash-flow coverage, not 4.40 DSCR. UI labels this modeled cash coverage, exposes assumptions and fees/working-capital exclusions, and does not claim SBA eligibility or lender approval. Missing/invalid data cannot manufacture coverage; zero and negative cash flow remain explicit. A rendered DealDetail test failed when the old formula was temporarily restored, then passed after restoring the fix. Isolated suite: **233 files passed, 4 skipped; 2682 tests passed, 18 skipped**. This is not deployed-browser or production-database integration validation.

Follow-up (not yet deployed): rendered dossier regression reproduced truncation at source 6 of 15, then passed after replacing the five-link cap with a numbered, keyboard-accessible all-sources disclosure. Targeted dossier tests 6/6 pass with DATABASE_URL empty. Rank/finance audit confirms `scoreDeal` uses fixed six-dimension weights without the saved thesis weights; DealDetail's top DSCR divides cash flow by asking price times 0.07 and its SBA down-payment card assumes 10% without showing that assumption. These remain substantive open work, not verified financing or thesis-specific ranking.

Live opportunity 3660002: deliberate research saved at **9/27/2026 2:10:12 AM ET**, with 15 cited sources including the exact original listing and broker PDF. The report identifies Columbia County, GA, preserves the seller-reported $1.1M asking price, $338,930 SDE and $2,792,789 revenue, and explicitly leaves legal identity, audited financials, recurring revenue, licensing transfer and current availability unresolved. No similarly named business was substituted.

Reload preserved the same saved timestamp and dossier. One explicit **Refresh research** retained the previous result while pending, then displayed a newer saved timestamp **2:13:47 AM ET**. This verifies the refreshed response is not simply the original cached result. No seller outreach, offer, financing or brokerage action occurred.

Remaining acceptance gaps: only five of the 15 citation links are exposed in the panel; generic screening scores are not proven to apply the compiled custom thesis weights; detail financial scenarios still need clearer assumption labels. The positive thesis → discovery → opportunity → source-aware research journey passes, but this is not a claim that every diligence module or all-suite integration test passes.

Release: build `7e39c5b2-c8e7-4e88-bc88-b164c8b5dc86` succeeded; source `48bf8a27eaa08a50be8b84c0a06ccf9f66d42817` staged as `capital-aperture-00242-how`. Staged smoke 6/6 at 06:08:50Z; production smoke 6/6 at 06:09:22Z after promotion. Runtime configuration unchanged, no migration. Browser reload of opportunity 3660002 showed no source-aware dossier; expanding the panel still showed an explicit Run Deal Research action. One deliberate click started the request; its button disabled while running.

`getForDeal` now reads saved evidence only, including legacy requests containing `forceRefresh`. Explicit `refreshForDeal` is an operator mutation that passes the original listing URL and saved discovery context to the provider. The cache key includes the listing URL and a source-aware version, preventing a generic-name dossier from masquerading as source-aware research. Older cache records are not relabeled. The client distinguishes loading failure, no saved evidence, a new research request, and a confirmed saved response; refresh no longer just refetches cache or claims live citations. Empty provider content is rejected before database access. Source text remains untrusted; similar-name businesses must not be substituted for an anonymous listing.

Regression tests observed reads calling the generator before the repair. Tests now assert no generation on reads, explicit refresh with exact source context, read-only-role mutation denial, and no database access for empty provider content. Unit lane: **230 files passed / 4 skipped; 2678 tests passed / 18 skipped**. TypeScript passed. These do not replace the pending deployed browser research test or database integration coverage.

Production revision `capital-aperture-00238-xih` (source `263f0cd830621787ea0284eb170c17b1bc885130`, build `8fe7b711-4b39-4ae5-ac5b-a7fe779ec596`) passed 6/6 staged and production release checks. The original browser thesis preserved its financial/geographic criteria but returned zero listings. A explicitly source-seeded diagnostic returned one listing with unknown financials and zero qualified candidates. Neither is a positive end-to-end discovery pass.

The pending source-first repair retrieves individual Perplexity Search records before extracting claims with the existing Google model role. Host allowlisting, individual listing paths, exact source URLs, source titles, explicitly labeled amounts, unknown values, sidebar exclusion and duplicate-source handling are validated locally. No new provider or database migration. Read-only provider probes use `DATABASE_URL=` and do not create deals.

A prototype probe returned 12 individual listings, three matching the financial bounds on indexed claims. This is not current-availability verification or a browser UAT pass. One prior indexed Atlanta listing returned HTTP 404 on direct inspection; indexed discovery must not imply availability.

Targeted source/extraction tests: 11/11 passed, including a duplicate-source regression observed red before repair. TypeScript passed. Isolated unit lane: 226 files passed, 4 skipped; 2,662 tests passed, 18 skipped. The broad test command, with production disconnected, failed 17 files (database/credential-dependent checks and an existing URL-path decoding issue); it is not an all-suite pass. Post-release browser journey remains pending.

Direct inspection of the indexed Bibb County listing `/2483466/` returned HTTP 404 as well. Keep this as an explicit availability limitation; do not count indexed results as confirmed available opportunities.

Open acceptance gaps: explain found-but-unqualified candidates; verify exact opportunity source and persisted record in the browser; distinguish generic screening score from thesis-specific weights; retain truthful unknown geography and source availability. No outreach, offers or financing actions were taken.

Read 2026-09-27: https://www.bizbuysell.com/business-opportunity/turnkey-hvac-and-commercial-refrigeration-company/2528214/

The listing header advertises a Florida HVAC/refrigeration business: asking $1,650,000, SDE $409,140, EBITDA $309,140, revenue $1,216,000, established 2014. These are seller/broker claims, not audited figures or confirmed transaction availability. The narrative separately describes $452K 2025 SDE, so period/figure reconciliation is required. Retained technicians are not proof of retained management. No contact form was submitted.

This primary listing meets the original numeric/geographic test scope on its face. Therefore zero discovery should not be interpreted as proof that no opportunities exist. Test provider discovery against this benchmark without pre-populating or inventing a deal record.
