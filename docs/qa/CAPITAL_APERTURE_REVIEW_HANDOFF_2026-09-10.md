# Today → exact finding: connected UAT

## Today decision hierarchy — September 10, operator walkthrough punch list

Built against `TSL-BUILD-2026-008A` §5 and its Today attention model, from an
operator walkthrough of the deployed briefing. Staged as
`capital-aperture-00105-lal`, marker `1171ac2-uat-22995aa2`, digest
`sha256:2fe44857236a138aec98da0c245292a0267b3b018c69fa2e02ac41f467b4bbbd`,
Cloud Build `1a649928-c243-4cfa-a97f-598a821e72b9`, **zero traffic**.
Production deliberately remains `capital-aperture-00102-vax` so an in-progress
UAT is not disturbed; the operator compares and decides when to promote.

Four observed failures, each reproduced by a failing test first:

- **Secondary attention competed with the primary decision.** `BriefRow` rendered
  every attention row through the full card layout, so MGM and the two due
  reviews appeared at the same visual weight as the focal DKNG card, each with
  its own evidence block. Secondary rows now use the existing compact layout.
  Measured on the deployed revision: one `primary` card, **zero** `card`-layout
  rows (was three), three `compact` rows.
- **Fifteen raw source anchors dominated the first viewport.** `FindingEvidence`
  laid every citation out inline. Above three, they now sit behind a counted
  "Sources · 15" disclosure, closed by default. Verified on the deployed
  revision: the tray is present and collapsed, with **zero loose anchors** left
  in the primary card. Provenance stays one deliberate action away, per §5.6 —
  it is not hidden, and three or fewer links stay inline rather than being
  buried.
- **In Motion sat below every large card.** The section now renders directly
  beneath the primary decision and its inline review, ahead of the secondary
  attention sections. Confirmed by document order on the deployed revision.
- **No changed-since baseline was visible.** The section only existed when
  something had changed, so an operator could not tell "nothing changed" from
  "not tracked". A baseline line now always renders and keeps the two states
  distinct: a first baseline reads "Current status · 0 — this is the first
  recorded baseline"; a later comparison reads "Changed since your last review ·
  0 — nothing changed since your last review on <time>. Timestamp-only churn is
  ignored." Observed live: the latter, dated Sep 10 7:02 PM.

Seven tests in `todayDecisionHierarchy.test.ts`. `DATABASE_URL= pnpm test:unit`:
2,074 passed, zero failed, eight existing skips across 177 files. `pnpm check`
passed. The existing `attentionUatPresentation` and `todayAttentionBehavior`
contracts still pass unchanged, so the compaction did not drop any state label,
consequence or honest-failure copy.

**Not addressed, and not claimed.** The Addendum's "at most three ranked
alternatives" cap is not enforced — the count is still whatever the attention
model returns. The redundant global-plus-sub navigation shell (~180px before any
decision text) is untouched; that is a layout-wide change beyond this briefing.
Active-thesis scoping ambiguity between the PW rail label and cross-thesis
attention rows is unresolved. The ten-second comprehension target remains an
unmeasured usability claim: these are structural and test results, not observed
UAT. The narrow-viewport below-the-fold item from the earlier entry is unchanged.

## Expired liquidity facts blocked every paper ticket — September 10, 12:5x ET

Walking the operator workflows end to end on the deployed build found a hard
stop: **no paper ticket could be prepared, on any candidate, in any run older
than about a day.** Fixed and released as `capital-aperture-00102-vax`, release
marker `0a7b191-uat-f9c83e1b`, digest
`sha256:5d347681cd4eaaee6a5edbe9700eb8d70d6fcbe80a5692f76267e5f7ea81e0e2`,
Cloud Build `c2ff8a72-eaf2-497b-9fa6-567d8cecab46`, now serving 100%.
`capital-aperture-00099-buj` is retained for rollback.

**What was observed.** Play Desk showed CHOOSE 2 / APPROVE-SEND 0 / MONITOR 6.
Both ready candidates refused preflight with "this paper play cannot be
prepared — no 30-day ADV fact for PWR — an unknown liquidity is not a passing
liquidity", and all nine alternatives in that run still had two evidence checks
outstanding. APPROVE / SEND was therefore unreachable.

**What it actually was — not missing data.** A read-only query against the
`security_facts` table showed a good `adv_usd_30d` value stored for all ten
symbols, PWR at $743,294,848, far above any floor. Every one had **expired**:
seven on September 9, three on September 7. `providers/marketData.ts` writes
these facts with `ttlMs: DAY`, `getFacts` filters on
`expiresAt > now`, and `collectMarketFacts` is only ever called from the
underwriter and the market-regime read. Nothing else rewrites them, so once a
day passed the fact vanished from the read and `loadOrderAccountState` saw
`advUsd: null`. The gate then reported "no 30-day ADV fact", which was
misleading: a fact existed and was healthy, it had simply aged out with no
operator path to refresh it short of a full re-underwrite that would create a
new decision revision.

**Fix.** `server/aperture/liquidityFactRefresh.ts` resolves the exposure
symbol's liquidity fact for the preflight: it uses a stored unexpired fact
untouched, and only when none is available makes a single market-provider pass
and re-reads. `loadOrderAccountState` calls it in place of the raw fact scan.
It cannot manufacture a pass — a throwing provider, an empty result, an
unknown-basis fact, or a fact recorded against another symbol all still yield
null and the gate still refuses. Because the refreshed fact persists with its
own TTL, the provider is contacted at most once per symbol per day.

Six tests in `liquidityFactRefresh.test.ts` cover exactly those cases and were
written against the observed failure before the fix existed.

**Verified on the deployed revision.** The same PWR preflight that refused now
reads "Next guarded action: Acknowledge paper-only" with no liquidity blocker,
and a repeat read-only query shows PWR carrying a **freshly fetched** fact —
$722,942,208, a different value from the stored $743,294,848, expiring
September 11 — proving a real provider round trip rather than a relaxed gate.
The other nine symbols remain expired until their own preflight runs, which is
the intended per-symbol behaviour, not an oversight.

`DATABASE_URL= pnpm test:unit`: 2,067 passed, zero failed, eight existing skips
across 176 files. `pnpm check` passed.

Route sweep on the same revision, no errors and no dead ends: Today, Play Desk
(pipeline counts and candidate comparison), CandidateBoard, the evidence view
with its four answer options and source-record actions, the paper ticket
preflight, Research journeys, Portfolio, Theses, and the objective Mission flow
(question and scope, account and risk, review, "Underwrite my mission").

**Still open.** Nothing here was submitted: proposal, approval and paper
submission remain separate human-confirmed steps and were deliberately not
exercised, so the operator's own end-to-end paper run is still the acceptance
event. The nine alternative candidates in run #690001 each need their two
evidence checks answered before they can reach a ticket. The narrow-viewport
below-the-fold item from the previous entry is unchanged. Verified gains,
allocation/proposal integration, physical-device and screen-reader acceptance
all remain open.

## Decision prominence fixed and deployed — September 10, 11:2x ET

Continued from the interrupted prior session. Its three named presentation
problems were reproduced on the deployed `uat-7dc389ef` revision, fixed, and
re-verified on a new tagged revision. Desktop only; see the viewport gap below.

Revision under test: `capital-aperture-00099-buj`, release marker
`918db8d-uat-6cbcc3fb`, digest
`sha256:6598d39ab986165f8c350c22fdcc90804c5a19e3d56c197af99cc7828c19f2c4`,
Cloud Build `34acd41d-51af-4546-86dd-f4b16695dc0b`, 717-file working-tree
snapshot `6cbcc3fbec8d9ecc054588509acadb6859919679473f023fe2be8a0d1338d494`.
Zero traffic. Production remains `capital-aperture-00096-fuh` at 100%.

**Tag reuse, stated plainly.** The new revision carries its accurate tag
`uat-6cbcc3fb`. The already-Firebase-authorized `uat-7dc389ef` hostname was also
repointed to it, so the existing authenticated session could continue without
re-adding an authorizedDomain entry. No Firebase authentication configuration was
read or changed in this session. That tag name therefore no longer matches the
source hash it encodes; the served release marker is the authority, and it was
confirmed as `918db8d-uat-6cbcc3fb` before any conclusion was drawn.

Measured on Today at 1379 CSS px, before (`00098-xuc`) → after (`00099-buj`):

| Measure | Before | After |
| --- | --- | --- |
| Briefing header paragraph blocks | 2 | 1 |
| Briefing header height | 119px | 95px |
| Primary decision action offset | 673px | 652px |
| "paper" mentions above the decision | 5 | 4 |
| Today document height | 2871px | 2850px |
| Horizontal overflow | none | none |

- **Repeated account chrome.** The briefing header stacked an eyebrow, the page
  heading, and a separate paragraph restating the account that the cockpit rail
  already displays immediately above it. Mode and account now share one line
  under the heading. The account identity is not dropped and the page still has
  exactly one `h1`, preserving the earlier duplicate-heading repair.
- **Utilization beside "blocked".** The reconciling sentence was gated on
  `!expanded`, so it disappeared exactly when an operator opened the rail for
  detail. It now renders whenever severity is critical and ties the number to the
  state: "NVDA uses 99% of its ceiling, leaving 1%. New exposure that relies on
  NVDA is blocked; existing positions are unchanged." Confirmed present with the
  rail expanded (`aria-expanded` true, `#cockpit-rail-detail` in the DOM) and
  appearing once. The expand preference was toggled and restored to collapsed.
- **Restated no-trade consequence.** "No paper ticket has been created. Existing
  positions are unchanged." became "No paper ticket created; existing positions
  unchanged." Both substantive claims are retained; the shortened wording is
  asserted explicitly in `missionResultGlance.test.ts` rather than dropped. The
  Mission result heading now precedes its account line instead of following it.

Regression checks on the new revision: the inline finding review still opens in
place on Today with four recorded source links and **Save review disabled**; the
inline gate review still shows account/revision 6, the saved blocker, the
reopening condition and its explicit "has not been re-evaluated" statement;
Mission still opens directly to its saved result. No assessment, sourced check,
monitoring refresh, proposal, approval, order or evidence answer was invoked.
Ordinary displayed-status `markSeen` writes occur on Today; this is not a
zero-write claim, and the rail preference write above is stated rather than hidden.

Verification: `DATABASE_URL= pnpm test:unit` — 2,061 passed, zero failed, eight
existing skips across 175 files (the prior baseline was 2,055; the six additional
tests are the new `uatDecisionClarity.test.ts`, each reproduced failing before its
fix). `pnpm check` passed. Client/server production build passed with the existing
~4,595 kB main-chunk warning. Every command explicitly cleared `DATABASE_URL`.

**Responsive verification now passes, with one named exception.** The earlier
narrow-viewport failure is explained: the tab inherited from the prior session sat
in a window whose `window.outerWidth` reads 0, and `resize_window` is a silent
no-op there. Retries at 390x844 and 820x900, and a retry after the operator left
macOS fullscreen, never moved the measurement. **Closing that tab and opening a
fresh MCP window made the same call work immediately.** That window is the fix;
the tool was never the whole problem. The prior session's conclusion that this was
purely a capability limit was too broad.

Measured before capture, as required: `document.documentElement.clientWidth` = 402
with `window.innerHeight` = 707, and `matchMedia("(max-width: 639px)")` matching,
so the narrow layout is genuinely active. It is **402, not 390** — Chrome floors
the window width, and this profile renders at roughly 80% page zoom (screenshot
frame 1148 against a reported 1383 CSS px before the resize). Record 402; do not
round it to 390. Session persisted throughout; no sign-in was attempted and no
Firebase configuration was read or changed.

At 402 CSS px on `00099-buj`, every one of these passed with
`scrollWidth == clientWidth` (no horizontal overflow) on each page:

- Today renders; briefing header is one 87px block reading "At a glance" /
  "TODAY · PAPER · Alpaca Paper — AI Thesis"; exactly one `h1`.
- The constraint rail reconciles its number in place: "NVDA uses 99% of its
  ceiling, leaving 1%. New exposure that relies on NVDA is blocked; existing
  positions are unchanged."
- Inline finding review opens on Today with its recorded source links and
  **Save review disabled**.
- Inline gate review opens on Today with account/revision 6, the saved blocker,
  the reopening condition and its "not re-evaluated" statement.
- Mission opens to its saved result ($8,000 allocated), heading above its account
  line, ending "No paper ticket created; existing positions unchanged."

**The decision is still below the fold at this width, and that item is NOT
closed.** The primary action sits at y=724 against a 707px viewport — short by
17px. The header repair measurably helped (119px → 87px at 402 CSS px) but did not
reach the goal. The space above it is: 220px of page chrome (global nav, workspace
header, section nav), 117px of cockpit rail, then an 87px briefing header and a
132px "Some play evidence is out of date" notice before the card at 577px. The two
largest consumers are outside what this increment changed. The account label also
still appears twice in view — "PAPER MODE Alpaca Paper — AI Thesis" in the rail and
again in the briefing line. Closing the last 17px needs a decision about page
chrome or the status notice; it should not be claimed by trimming this header
further.

Promoted after the desktop pass, on explicit operator instruction, with deployed
narrow-viewport results then still outstanding; they are recorded above. Held-option outcome automation, verified gains, allocation/proposal
integration, physical-device, screen-reader, enlarged-text and full keyboard
journeys, and stakeholder acceptance all remain open and are not narrowed by this
presentation increment.

## Temporary authorization completed and removed — September 10, 09:34 ET

Operator explicitly approved temporary Google sign-in for the exact
`uat-7dc389ef` hostname. Updated only authorizedDomains through the Identity
Platform API, preserving all existing entries. The initial API read required
the `x-goog-user-project` header; no permissions were broadened to fix it.
Normal Google account selection returned to authenticated Today on revision
00098-xuc. No token/session was copied or fabricated.

Observed deployed desktop interactions:
- Gate review opened on Today, with account/revision 6, saved blocker and
  reopening condition. It explicitly did not claim a fresh reevaluation.
- DKNG finding opened on Today with source links and the version-specific
  review form. No assessment was saved and no sourced checks were invoked.
- Mission opened directly to the saved result, not setup: PW, $8,000 allocated,
  this-week horizon, shares/options, $500 planned-loss limit and $0 effective
  at the dated analysis. Existing positions explicitly unchanged.

Responsive testing is NOT passed: the viewport capability accepted 390x844
but actual DOM measured 1383x1273, including in a new owned tab. The screenshot
was desktop-sized, not mobile evidence. Reset the override and closed only that
temporary tab. This tool limitation needs an alternate genuine narrow-viewport
check; do not relabel existing fixture results as deployed mobile acceptance.

Removed the exact temporary hostname after this walkthrough. Readback confirms
it absent and all ten other domains preserved. Existing authenticated UAT tab
2002431716 retained for continuation; no new sign-ins to this tag are enabled.
No proposal, approval, order, review receipt or fresh monitoring check was
initiated through these UI actions. Ordinary seen-state reads remain separate.
Production traffic unchanged; full stakeholder acceptance remains incomplete.

## Public runtime verification — September 10, 09:20 ET

While temporary Google hostname authorization is awaiting the operator:
the tagged revision's served JavaScript contains exact release marker
`918db8d-uat-7dc389ef`; the health query returns HTTP 200 / `ok: true`;
the actual `aperture.strategy.capabilities` read without a session returns
HTTP 401 / UNAUTHORIZED and no result. An initial probe used an incorrect
router name and returned 404; it is not counted as authentication evidence.
These checks neither establish authenticated UAT nor authorize changing the
Firebase domain list. No access-control change or production promotion made.

## Tagged runtime ready; Google domain gate — September 10, 09:19 ET

Cloud Build `0f740d77-b3e7-415e-93c2-b24f7a2d8a39` succeeded.
Verified image digest:
`sha256:fb59307bce9b0f9b2de8fc515eaec1629f22798de836d76da8860b32ea602549`.
Deployed this exact digest as `capital-aperture-00098-xuc`, tag
`uat-7dc389ef`, with no production traffic. Objective missions and strategy
discovery flags are true on the new revision only. Production remains 100%
`capital-aperture-00096-fuh`. URL:
`https://uat-7dc389ef---capital-aperture-oxiyp4dcpq-uc.a.run.app/aperture`.

The API health query returned JSON `ok: true` with its required timestamp
input. A first probe omitted that required input and correctly returned 400;
that was a probe error, not API unavailability. Chrome opened the product
sign-in screen. Clicking Continue with Google returned
`auth/unauthorized-domain`; the new tag hostname is not authorized for Firebase
Google sign-in. Do not call authenticated runtime UAT passed.

Existing production Chrome tab remains signed in and untouched. Browser
connection recovered by selecting the actual browser id 1 after the generic
Chrome identifier timed out. New UAT tab 2002431716 is marked for continuation.
Request temporary authorization for this exact new hostname, then remove the
temporary entry after checks. Previous permission named another tag and must
not be silently reused. No authentication rule was weakened, token copied,
session fabricated, proposal/approval/order submitted, or traffic promoted.

## Runtime build underway — September 10, 09:10 ET

Prepared a frozen 716-file runtime/build snapshot, excluding environment files,
workspace history, `.manus` records, private recovery data and unrelated untracked
files. It contains the current tracked working-tree UAT changes, not only HEAD.
Manifest: `/tmp/aperture-release-source.l8fAFI/manifest.json`.
Source SHA-256: `7dc389efa8c709b06af337599d77e0b406ff17cd4a28ec2b03f7d9031960d5a9`.
Release marker: `918db8d-uat-7dc389ef` (a working-tree snapshot identity, not a
new commit SHA). Image destination:
`us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:918db8d-uat-7dc389ef`.

Cloud Build `0f740d77-b3e7-415e-93c2-b24f7a2d8a39` is confirmed WORKING;
latest log reached production-dependency install, Docker step 29/35. Continue
observing this exact job; do not start another build merely because a wait
turn ended. Required public Firebase build inputs were taken from the prior
successful project build; no runtime/provider secrets entered the snapshot.

Fresh offline unit suite: 2,055 passed / zero failed / eight intentional skips;
174 files passed / three skipped. `/tmp/aperture-pre-runtime-unit.log`.
Production still serves `capital-aperture-00096-fuh` at 100%. No application
revision or traffic change yet. Existing Chrome Capital Aperture tabs located
using the browser-control skill's read-only inventory, without cookie/session
extraction or tab mutations. Next: verify image success/digest and create a
tagged no-traffic revision, then read-only desktop/mobile runtime walkthrough.

## Production schema complete — September 10, 09:07 ET

Split the 0066 column/index changes to avoid TiDB's same-statement reference
limit. Revised 0066 source hash:
`001102be1a7dcdcaa6a6c36fb4f4c8f98904f0df3e792b7de10491e7b4df1cca`.
Reviewed nine-step plan hash:
`4612cba395cb8340d370c62335f2d86d1a2bf21c9401acf7cfeefdbfd47d88d2`.
The observer now checks the intermediate column-created/index-absent state;
malformed or prefix indexes remain conflicts. Plan-specific receipt directories
preserve old-plan history while sharing the same per-target exclusive lock.

Production execution completed at 13:07:19 UTC: seven remaining steps applied,
the two 0065 tables reconciled without repeated CREATEs, and all nine final
postconditions verified. Durable receipt:
`/Users/lenoxparis/.codex/private-releases/capital-aperture-20260910/be7b9bc9e3e5ee5ee38605997b190f5eb2fc013dbb9d0748d64a0b0acf4d7c4b/b46740c6ce771c0e204eba47658f1cea03e960d1e95b4e00544e2a6b3d86d92d/verified-1789045639597.json`.

Read-only post-application comparison against the original recovery capture:
24/24 decision runs and 42/42 revisions retained, zero missing rows and zero
changed values in original columns. No broker orders, approvals, outcomes or
feature flags were changed. This is schema completion, not application release.

Fresh isolated integration: `/tmp/capital-isolated-integration.r7Q3TF`,
284 passed / zero failed / two external-URL skips; owned DB/user removed.
The earlier b1bNt9 run failed on its old two-statement shape expectation; fixed
that explicit expectation, then reran. TypeScript and whitespace checks pass.
Added TiDB-shaped separate-statement/intermediate-index tests and cross-plan
lock/history tests. Next: source checkpoint, tagged application build/runtime
UAT, then promotion only after checking the actual stakeholder flow.

## Production application stopped safely at 0066 — September 10

Implemented the separate execution adapter, restricted to the exact reviewed
plan's SQL/step identities, and recovery-proof verification that pins original
artifact/proof bytes, target, plan, matched table counts and cleanup success.
18 release-tool tests pass. Original snapshot and restore proof are now retained
in owner-only durable local storage:
`/Users/lenoxparis/.codex/private-releases/capital-aperture-20260910/`.
Proof SHA-256:
`c1fec52c7c4da30b1ac933e18801155e1edfa42eb1fea0d3ef2506829b1a0eb7`.

The explicitly invoked runner applied and verified only the two 0065 CREATE
statements: `aperture_capital_events` and `aperture_capital_claims`.
0066 step 1 was rejected with MySQL error 1072
(`ER_KEY_COLUMN_DOES_NOT_EXITS`). Read-only schema reconciliation shows that
the mission table is still in its original before-state. The saved journal
retains complete receipts for 0065 and started for the rejected 0066 step.
A diagnostic resume reconciled both completed steps without repeating them
and returned the same 1072 rejection. No further retries are justified until
the migration shape is corrected. ADMIN SHOW DDL JOBS was unavailable (8121).

The failing statement adds `client_request_id` and an index referencing it in
the same ALTER. TiDB documents that changes in a multi-change ALTER cannot
reference a column introduced by another change in the same statement:
https://docs.pingcap.com/tidb/stable/sql-statement-alter-table/ . This is the
supported explanation for the observed failure; the local MariaDB integration
did not expose that TiDB-specific compatibility limit.

Next: separate column creation from index creation, review new source/plan
hashes, add intermediate-state inspection and TiDB-shaped regression coverage,
preserve the original journal as history, then resume the remaining schema
steps. Do not silently weaken hash guards or classify 1072 as success.

Production application traffic/revision is unchanged. No existing row data,
broker order, approval or outcome was rewritten. The new schema is incomplete;
the full local application must not be promoted yet. Original receipts and
the two additive tables are retained, not rolled back destructively.

## Production read-only preflight and recovery drill — September 10, 08:55 ET

Added an explicit connection adapter with target fingerprint checks before
connection and actual database identity verification afterward. Inspection
exposes metadata reads, bounded capture of the two altered receipt tables,
and close; no arbitrary DDL method. Importing it opens no connection.

Read-only production preflight at 12:49:24 UTC confirmed the legacy starting
schema. The 0068 enum step cannot match until its 0066 prerequisite exists;
that dependency is not evidence of unexpected production data. Evidence:
`/tmp/aperture-production-release-preflight-20260910.json`.

Captured original DDL and 24 decision runs / 42 revisions in one read
transaction, ended by rollback. Private recovery file (0600):
`/tmp/aperture-receipt-recovery.0ZvQIY/original-receipts.json`.
Artifact SHA-256:
`51fc7e67eded8898fae95b647d1734da0352cbddebcf97318034dea464bf1ead`.
Original records must never be committed, pasted into tracking, or converted
into demo fixtures.

`verify-aperture-receipt-recovery.mjs` restored the exact DDL and all captured
rows into a fresh, scoped-user loopback database. It compared every captured
column, normalizing JSON representation, and verified row counts and content
hashes. Both tables matched. Proof:
`/tmp/aperture-receipt-recovery.0ZvQIY/restore-proof-0d0554d59130.json`.
Only its owned disposable database and user were removed; original recovery
material is retained. This is a MariaDB restore drill for these two tables,
not a full TiDB backup or production rollback execution.

Sixteen planner/executor/journal/connection tests pass; diff whitespace check
passes. The testing strategy deliberately checks actual restored contents,
not just successful file creation. No production DDL, deployment, feature
enablement, broker action, or historical repair occurred.

Next: retain recovery material in durable private release storage, connect
the hash-pinned executor to a bounded DDL adapter with a verified recovery
proof and exclusive journal, then verify tagged runtime UAT before promotion.
The active stakeholder-UAT goal remains open; this recovery drill does not
close held-option outcome automation, live mobile usability, or production
acceptance.

## Controlled execution core — September 10, local preparation

`aperture-release-executor.mjs` now validates the exact approved plan hash,
target, exclusive-lease adapter and recovery-proof adapter before DDL. It awaits
a durable `started` receipt before execution, verifies the schema afterward,
and records completion only after the postcondition passes. A lost response
leaves `started`; subsequent execution inspects schema rather than blindly
repeating the statement. All eight final postconditions are required.

The actual shadow-table integration now creates the final execution table,
throws a simulated lost-response error, and resumes through this executor.
Assertions prove one CREATE call, eight reconciled steps, and preserved legacy
records. Fresh run `/tmp/capital-isolated-integration.KobnX5`: 284 passed,
zero failed, two skipped; owned test DB/user removed. Its recovery/lease adapters
are explicitly fixture-only, not evidence about production backups or locking.

`aperture-release-journal.mjs` adds owner-only files, exclusive per-target locks,
fsync-before-return, atomic receipt replacement and directory synchronization.
Existing locks are not stolen. Eleven planner/executor/journal tests passed;
the journal tests reopen persisted receipts and reject concurrent runners and
non-private storage. TypeScript passed. Database integration uses an in-memory
receipt adapter; filesystem durability has separate tests, not a combined
process-kill/real-DB test.

Still pending: production connection adapter, verified recovery material and
combined execution receipt, then tagged runtime UAT/promotion. No production
connection or DDL is made by these modules on import. No deployment occurred.

## Hash-pinned schema plan — September 10, 08:43 ET (planning only)

Added `scripts/aperture-release-plan.mjs` and
`scripts/aperture-release-schema-state.mjs`. The plan validates all five source
hashes before returning eight ordered statements; it cannot connect to a DB or
apply changes. Plan SHA-256:
`7549ff58dca027965c75b8daea28f5c2e1320b6a06a5e930265bd46b41b85838`.
Output: `/tmp/aperture-reviewed-release-plan-20260910.json`.

The schema observer checks CREATE column types, nullability, defaults,
auto-increment and full index columns; ALTER checks distinguish before/after
states. Journal identity mismatch or schema conflict is not treated as an
already-applied success. A lost response after DDL requires postcondition
verification, not duplicate execution.

Actual migration integration now inspects all eight steps before and after
applying their hash-pinned SQL to owned shadow tables, then simulates a started
journal with already-applied schema. Earlier passes failed on metadata-format
differences. Normalization accepts SQL NULL versus native null and JSON aliases
only with a matching JSON_VALID constraint; literal 'NULL' and unchecked
LONGTEXT remain conflicts. The final fresh run
`/tmp/capital-isolated-integration.5H14uE` passed 284 / 0 / 2 skips and removed
its owned DB/user. Five planner tests pass. An omitted-shadow collision check
was also corrected to bind all seven exact owned table names.

Still not an application runner or verified production backup. Next: controlled
DDL execution with durable per-step receipts, verified target/recovery context,
and postchecks; then runtime UAT and promotion. No production DDL was performed.

## Source checkpoint and release gate — September 10, 08:35 ET

Outcome integrity fixes committed and pushed to origin/main as
`918db8d729a57ebec9e67ce25e91053be3fd8928`. The focused commit contains only
the two outcome modules and their two test files; unrelated staged/unstaged
UAT work remains intact. Current full working-tree build passed
(`/tmp/aperture-release-build-20260910.log`), with the existing bundle-size warning.
This build is not proof that all local changes are in that commit.

Live read-only recheck confirms production still serves revision
`capital-aperture-00096-fuh` at 100%. At 12:34:45 UTC, the schema checker again
rejected the full local release: five tables, five column requirements and ten
deduplication keys remain missing/incompatible. Evidence:
`/tmp/aperture-production-schema-20260910-0834.json`.

Neither existing migration runner is suitable for 0065–0069: one is an older
single-migration script; the restored-capital runner ends at 0050, automatically
loads .env and suppresses broad duplicate-DDL errors. Do not repurpose either
by blindly adding new filenames. Next release work is an explicit, hash-pinned,
resume-aware application procedure with preflight, recovery evidence and
post-application checks, followed by a tagged runtime test before promotion.
No production DDL, deployment, traffic change or feature enablement occurred.

## Automatic modeled-outcome integrity — September 10, 08:32 ET (local)

Traced the existing scheduled live-slate outcome calculator; it does not cover
held-option broker outcomes. Deterministic failing reproductions found and fixed:

- Serialized recommendation JSON was silently skipped while the equivalent
  decoded object calculated successfully. Reused `parsePersistedJson`.
- Provider-unavailable outcomes counted as terminal and marked the slate
  complete, excluding it from later automatic retry. Only resolved, verified
  outcomes now count as terminal.
- An old last bar could be used as the later time-stop settlement. End-window
  coverage is now required; gaps between source minutes remain unresolved.
- A trigger not yet seen during an open observation window was treated as a
  final no-trigger result. It now remains not observed until the window closes.

Future/invalid-price bars are excluded. Tests exercise the real refresh and
evaluator functions with deterministic source bars and captured DB writes;
they do not invoke providers or production storage. Existing counterfactual
labels remain explicit: these are not broker fills or realized gains.

Final offline suite: 2,055 passed / 0 failed / 8 skipped; TypeScript passed.
`/tmp/aperture-outcome-final-unit.json`. Isolated integration run
`/tmp/capital-isolated-integration.hwUm0C` passed 284 / 0 / 2 external-URL skips
and removed its owned database/user. That snapshot precedes the final pure
minute-gap guard, which is covered by the final unit suite.

Not deployed; scheduler execution in production is not verified by these tests.
No historical output rows were rewritten. Existing rows incorrectly marked
complete would need an audited repair before automatic retry can include them.
Held-option marks, matched exits/fees/cost basis, and actual realized outcomes
remain separate acceptance requirements, not solved by this intraday repair.

## Inline gate review — September 10, 08:26 ET (local only)

Today opens the exact conditional decision receipt in place. Routing uses
structured `reviewKind`, not display text. The existing owner-scoped receipt
query checks run/revision identity and paper-account binding. The panel displays
the saved blocker, reopening condition, account and revision. Missing, failed,
loading or mismatched records cannot offer revision. Reading does not clear a
gate; deliberate revision still opens the exact decision editor.

Connected fixture `/tmp/aperture-mobile-journey.3vnvjS` passed six checkpoints
at 390px and 1280px, without horizontal overflow. Both review actions remained
on Today. The explicit finding receipt survived reload. The disposable integrity
probe compared complete rows in broker orders, monitoring checks, pending
outcomes, decision runs and decision revisions against their pre-review snapshot:
all unchanged. One explicit review-receipt POST was allowed; seen-baseline writes
remain separate. No provider or real broker was used.

The initial browser attempt (`Y06vAx`) was blank because the isolated tracked-file
snapshot omitted the new component. Included the exact two new files and reran
from a fresh disposable snapshot (`gP9Lb0`); do not count the failed attempt as a
pass. Unit tests: 2,049 passed / 0 failed / 8 skipped; TypeScript passed.

This closes the navigation detour for inspecting a gate, not automated gate
evaluation. Current gate conditions are free text. They need typed evaluation
rules and matching fresh observations before a machine can claim they cleared.
Held-option outcome automation, repeated UI context, stakeholder validation and
production release remain open. These changes have not been deployed.

## Inline finding review — September 10, 08:19 ET (local only)

Connected disposable desktop/mobile UAT passed four checkpoints in
`/tmp/aperture-mobile-journey.dUfUPz`: open the exact finding on Today,
read its source, explicitly save a review, then reload and recover the receipt.
The network assertion found zero workflow POSTs on opening (excluding the
existing seen-baseline write), and exactly one `monitor.reviews.record` POST
after explicit Save. This is not a full before/after database equality proof.
No live broker or provider was called by this illustrative fixture.

The first connected pass exposed serialized JSON citations being mistaken for
missing evidence. A failing regression preceded guarded JSON-array parsing in
`validMonitoringCitations`; malformed/non-array input still fails closed.
Original record bytes remain the finding-version authority. The new browser
assertions require the recorded source link and unresolved/stale state.

Today now receives the persisted pending-review basis and presents the exact
condition in its attention reason; absent conditions are explicitly unknown.
This read-only enrichment is unit-tested but has not had a connected gate fixture
repeat yet. It does not evaluate the gate or resolve it.

Validation: 2,043 offline unit tests passed, zero failed, eight skipped;
`pnpm check` passed. Report: `/tmp/aperture-today-inline-unit-20260910b.json`.
Screenshots remain tall and repeat some evidence context; do not claim final
stakeholder polish or measured usability. Inline gate evaluation and automated
held-option outcomes still require work. Market marks alone cannot establish a
fill, realized P&L, or an exit. These local changes are not deployed.

## Migration preservation and idempotency gate — September 10, 08:05 ET

Re-read all 0065–0069 SQL and the hash-pinned shadow-table migration test.
The fresh isolated integration run `/tmp/capital-isolated-integration.Rqncky`
passed 284 tests / zero failures / two external-URL skips; owned database/user
were removed. The migration case applies the actual SQL against owned legacy
fixtures, checks unchanged receipt values/history and expected default context,
and exercises duplicate identity rejection for events, claims, discovery jobs,
selections and execution requests. This is MySQL fixture coverage, not proof
that production TiDB has been migrated.

The new release checker had an actual false-positive seam: matching columns
without any deduplication indexes returned compatible. Added a failing test,
then required ten exact full-column UNIQUE key shapes, including column order,
uniqueness and absent prefix truncation. Thirteen deterministic tests now pass;
negative column/table cases retain valid indexes to avoid false confidence.
Read-only production recheck at 12:05:12 UTC correctly rejects 20 unmet shape/key
requirements. No production mutation or migration was performed.

Release remains pending: build a reviewed clean source candidate, establish
the production migration/rollback receipt, apply additive changes in dependency
order, inspect all post-migration structures, and test the tagged runtime before
promotion. An app rollback should retain additive schema; do not drop new tables
or rewrite operator history. Gains verification and full acceptance remain open.

## Production compatibility recheck — September 10, 08:02 ET

Cloud Run still serves 100% through `capital-aperture-00096-fuh`.
Read-only information_schema queries confirm missing tables:
`aperture_capital_events`, `aperture_capital_claims`,
`aperture_strategy_discoveries`, `aperture_discovery_selections`, and
`aperture_execution_evidence`. Decision Run lacks context_kind/client_request_id;
its thesis IDs and revision invalidation remain non-nullable. Therefore the
current local objective/discovery build is not schema-compatible with production.

Added `scripts/check-aperture-release-schema.mjs`: explicit DATABASE_URL,
`--read-only`, no automatic dotenv loading, no DDL/customer-row queries, and
redacted connection failures. It exits nonzero for incompatibility. Eight
deterministic node tests pass, including the observed legacy schema and each
missing table. Production invocation with explicit dotenv loading rejected all
ten required shape checks at 12:02:57 UTC. This gate checks table/column shape,
not full indexes or migration history; those still require release review.

No migrations, flags, deployment or traffic changes were made. Next release work
must reconcile and apply reviewed 0065–0069 migrations before this build, verify
old records and indexes, then verify a tagged build and authenticated UAT before
promotion. Verified gains and full stakeholder acceptance remain separate gaps.

## Evidence disclosure duplication — September 10

The connected browser regression reproduced two visible Build source record
actions for one active question (2 versus expected 1). CandidateBoard now keeps
the action beside that question, suppresses the repeated instruction heading
while a question is active, and omits Compare 0 other candidates. Declined-state
warnings, the full checklist, source disclosure and ticket-readiness gates remain.

Fresh isolated journey `/tmp/aperture-mobile-journey.Q9LfKq/results.json` passed
all eight checkpoints. Follow-up `/tmp/aperture-mobile-journey.LFgM0M/results.json`
passed duplicate-action checks, collapsed/expanded evidence, exact saved-research
recovery, doubled root text and 1280px desktop. Inspection/recovery issued zero
POSTs. Mobile document width remained 390px; default height fell from the prior
2697px capture to 2474px. Screenshots were visually inspected on mobile/desktop.
Expanded and doubled-text views remain long (8528px/7655px); this is not a claim
of stakeholder-tested comprehension or full accessibility acceptance.

TypeScript passed; offline unit suite 2038 passed / zero failed / eight skipped.
Report: `/tmp/aperture-evidence-clarity-unit-20260910.json`. No production
deployment or broker action. Remaining: source-view focus/redundancy, broader
release reconciliation, verified gains, live-source and full stakeholder UAT.

## Full deterministic gate-to-dispatch journey — September 10

One connected disposable DB journey now runs actual fact storage/read, order
risk gates, declared-source authorization, proposal/reservation creation,
approval, and explicit simulated submission without mocking gate arithmetic or
authorization. Its source fact is explicitly illustrative and stored only in
the disposable database; the broker is an injected no-network fixture. This is
not current market verification or broker execution evidence.

Preflight is read-only. Missing rationale and excessive stop-based planned loss
both fail without writes/submission. Complete illustrative inputs pass. Proposal
creation and approval each make zero broker calls. Explicit SUBMIT PAPER calls
the simulated broker once, records accepted/unfilled (not a position), and keeps
the exact reservation committed.

Initial test-data insert exceeded provider_id's 32-character schema bound;
shortened fixture ID, without weakening validation. `.R7k1Sc` passed full journey;
final `.NaArLw` includes refusal checkpoints: 284 passed / zero failed / two
external-URL skips. Owned DB/user cleaned. TypeScript passed before last two
fixture checkpoints; diff check passes. No production deployment/migration or
live broker action. Browser UAT, gains-source evidence, clean release and actual
stakeholder acceptance remain incomplete.

## Declared-source opening authority connected — September 10

Discovery opening authority is now conditional on the server's persisted source
and capital-ledger read rather than an unconditional research-only refusal.
Feature flags, exact current binding, positive declared envelope and existing
branch/account checks still apply. Approval/submit require an exact owned pending
reservation; orderFlow supplies stored order identity to revalidation. The proof
flag is server-computed, not a router input. Proven closes retain their prior path.
This is operator-declared capital, not independently verified proceeds or gains.

Two positive DB authority cases failed before connection (`.2WF9XK`), then pass.
Five negative DB cases reject missing claim/order, wrong account, disabled feature
and cash branch with unchanged snapshots. Existing actual creation concurrency,
approval and five dispatch scenarios now use REAL decision authorization; market
gate arithmetic remains explicitly injected to isolate the transaction seam.

Final `.Qnjkob`: 283 passed / zero failed / two external-URL skips; owned DB/user
cleaned. Unit 2,038/0/8 (`/tmp/aperture-declared-authority-unit-20260910.json`);
TypeScript passed before final test-only additions; diff check passed.
This supersedes earlier notes saying declared-source opening is always closed.
No deployment, migration or live broker activity. Still required: fully sourced
market/evidence journey, gains proof, clean release and stakeholder desktop/mobile
UAT. Do not present injected market gates as production eligibility proof.

## Exact own-reservation eligibility view — September 10

Internal declared-envelope reader accepts an optional own-order identity for
revalidation. It excludes only the verified exact pending reservation from the
in-memory comparison: owner, source, amount, current decision/revision, research,
account, selected symbol, passed stored gate, acknowledgement and unsent status
must match. Missing/wrong/changed/dispatched records fail closed. This neither
releases the claim nor persists a new cash/source receipt. Other claims remain
binding. This internal helper is not yet wired into opening authorization.

Six DB cases failed before support (`.z9lA1I`) then passed (`.9qXpzD`). Added
seventh other-claim case initially used the internal event row ID incorrectly;
fixed the fixture to resolve its public capitalEventId, without changing product
validation. Final `.CqJDl1`: 276 passed / zero failed / two external-URL skips;
owned DB/user cleaned. Full unit 2,038/0/8
(`/tmp/aperture-own-reservation-unit-20260910.json`); TypeScript passed before
the final other-claim fixture correction. No deployment or broker activity.

Next remains actual declared-source opening/revalidation authorization, source
and gains proof, clean release, and complete stakeholder desktop/mobile UAT.

## Forced concurrent proposal creation — September 10

Strengthened the actual creation DB case with an authorization barrier: both
requests pass the initial no-existing-proposal read before either may proceed.
Both settle successfully, exactly one reports `created`, and both return the
same order ID. One exact pending reservation exists; another retry makes no
changes. `allSettled` ensures fixture cleanup never races the second request.
Gate/auth outcomes remain injected; database insertion, locking, reservation,
retry and deduplication are actual implementation paths.

Two concurrent-suite runs passed: `.5LXyNQ` before explicit barrier and `.CMV203`
with barrier. Final 269 passed / zero failed / two external-URL skips, owned
DB/user cleaned; TypeScript passed. No source/gate opening, deployment, migration
or broker action. This closes the pending real concurrent-creation check, not
declared-source authorization, gains proof or stakeholder UI acceptance.

## Actual proposal insertion / reservation — September 10

Actual `createOrder` now attaches discovery-opening proposals to their existing
declared capital pool in the same DB-only transaction. It acquires ledger locks
before research/decision locks and reserves only the persisted gated amount.
Existing proposal retries still return the same identity. Missing feature or
decision identity fails closed. Real discovery opening authorization is unchanged
and remains research-only pending its separate eligibility work.

Two real DB cases inject gate/authorization outcomes to isolate this boundary.
Before wiring: proposal had no claim and over-budget creation resolved; both
failed (`.H36mL7`: 267 passed / two failed). After: exact pending claim created
once, repeat has no mutations, and over-budget failure rolls back the proposal.
Final `.whnDrL`: 269 passed / zero failed / two external-URL skips, owned DB/user
cleaned. Full unit final report `/tmp/aperture-create-bound-unit-final-20260910.json`
passes; TypeScript/diff pass. Updated one source-text contract for extracted
orderId; real DB retry/rollback assertions remain independent of that text test.

No source verification, real gate pass, concurrent creation, live provider or
broker eligibility is claimed by these injected fixtures. Still required:
declared-source authorization and own-reservation revalidation, concurrent real
creation, gains proof, clean release, and complete desktop/mobile UAT.
No deployment, migration, or live broker action.

## Connected DB approval / dispatch / late response — September 10

Five disposable DB scenarios now exercise actual `approveOrder` and `submitOrder`
with real ledger transactions: acceptance, zero-fill rejection, timeout, and a
separate committed fill reconciliation before late acceptance/timeout returns.
Gate evaluation and decision authorization are explicitly injected for this
transaction seam; this does not prove that discovery may pass real opening gates.

Approval records approved status with pending claim and zero submits. The simulated
broker callback reads the committed submitted lease and committed reservation.
Success remains committed, zero-fill rejection releases, timeout retains capital.
Late responses preserve filled quantity/price and consumed reservation. Every
scenario refuses a second submit before contacting the broker. Full protected
table snapshots remain unchanged except the exact order/claim. No real broker
or provider network is allowed.

Final DB receipt `/tmp/capital-isolated-integration.OBcwvg/summary.json`: 267
passed, zero failed, two external-URL skips; owned DB/user cleanup confirmed.
Intermediate three-scenario run `.Jn8DJ2`: 265/0/2. TypeScript passed before
the two late-response fixture variants; diff check passed. These tests strengthen
the earlier adapter-only evidence, not whole-product stakeholder acceptance.

Still required: real proposal creation/reservation attachment, declared-source
opening eligibility, genuine gains evidence, clean release and desktop/mobile UAT.
No production deployment, schema migration or live broker action.

## Approval and dispatch reservation wiring — September 10

Discovery-enabled actual approval, pre-broker dispatch lease, broker success and
transport-failure writes now call the DB-only reservation transaction helper.
Approval/submission still require their separate exact confirmation strings.
Broker submission is outside the helper and is not replayed by DB retries.
Owner/status checks and late-response fill snapshot guards remain in place.

The actual-orchestration test now has twelve cases: six prior response-race
cases plus approval without dispatch, accepted/timeout reservation boundaries
and rejection of three non-submit confirmations. A second submit attempt on an
unresolved submitted order is refused before the broker. Three boundary cases
failed before wiring and pass after. This seam mocks the transaction helper and
gate arithmetic: it proves orchestration, not real DB atomicity of these newly
wired branches. Add the connected DB tests before calling this integration done.

Full offline unit 2,038 / zero failed / eight skipped, report
`/tmp/aperture-dispatch-bound-unit-20260910.json`; TypeScript/diff pass.
Existing isolated DB suite 262 / zero failed / two skipped, `.Aj2gmN`; owned
DB/user removed. No production deployment, broker action or schema migration.
Actual proposal attachment and declared-source eligibility remain closed/open
work, respectively; verified gains and stakeholder UI acceptance remain unproven.

## Late dispatch response race — September 10

Actual `submitOrder` adapter tests reproduced both late acceptance and transport
failure overwriting an already-reconciled fill. Response writes now compare
owner, submitted status, stable client identity and the original broker/fill
snapshot. A winning reconciliation is returned without duplicate snapshot or
outcome side effects. Timeout copy asks to inspect/reconcile recorded status,
instead of asserting an already-filled order is necessarily still unresolved.

Six deterministic cases cover full/partial competing fills for acceptance and
timeout, plus uncontested acceptance/timeout. Each invokes exactly one simulated
broker submit. Gate arithmetic is mocked in this orchestration test and is not
new live eligibility proof. Initial two cases failed before the fix; final six
pass. Full offline unit 2,032 passed / zero failed / eight skipped
(`/tmp/aperture-dispatch-race-unit-20260910.json`). Type/diff checks pass.
Existing isolated DB suite 262 / zero failed / two skipped; `.NpWEBv` receipt,
owned database/user cleaned. A real-DB competing-dispatch regression is still
required; this checkpoint does not claim that stronger seam was tested.

No deployment, migration, broker call or risk-policy change. Creation and
approval/dispatch reservation wiring and stakeholder UAT remain incomplete.

## Actual fill refresh / reservation transaction — September 10

Three actual `mirrorFills` integration cases reproduced order updates leaving
their bound allocation pending: partial fill, confirmed zero-fill rejection,
and unknown-fill rejection. Red receipt: `.d4IJzf` (259 passed / 3 failed).

The discovery-enabled mirror now records the already-fetched broker result and
reconciles its existing reservation in one DB-only transaction. Broker polling
remains outside transaction retries. Existing status/fill compare-and-set guards
and post-update outcome/snapshot conditions remain intact; no new order status.
Partial fills retain committed capital, established zero-fill rejection releases,
and unknown-fill rejection retains committed capital. Repeated refresh is
idempotent in these fixtures. No submit method is provided by the fixture broker.

Green: `/tmp/capital-isolated-integration.rgX3UG/summary.json`: 262 passed,
zero failed, two external-URL skips; owned disposable DB/user cleaned.
Offline unit suite: 2,026 passed / zero failed / eight skipped, report
`/tmp/aperture-mirror-bound-unit-20260910.json`. TypeScript and diff checks pass.
These are synthetic broker responses, not live broker or gains-reconciliation
proof. Actual creation/approval/dispatch integration and final connected UAT
remain open. No deployment, production migration, or broker action.

## Actual rejection / reservation transaction — September 10

The discovery-enabled `rejectOrder` path now uses one DB-only transaction for
the existing allocation locks, compare-and-set order rejection, and reservation
reconciliation. Broker operations are not inside retryable transactions. The
default-off legacy path retains its existing owner/status compare-and-set.

Three actual-function disposable DB cases now cover pending and approved-but-unsent
proposal rejection releasing the exact attached reservation, and inconsistent
released-claim state refusing rejection without any record changes. These start
from synthetic persisted proposals; they do not prove live proposal creation.

Verification: `/tmp/capital-isolated-integration.msQDlJ/summary.json` reports
259 passed, zero failed, two external-URL skips. Owned DB and user cleanup are
confirmed. Focused rejection/fill/ledger unit checks: 56 passed; TypeScript and
diff checks passed. Prior interrupted run `.ZQP9MQ` was terminal and successful
(257 passed), not restarted on an observation timeout.

Remaining: actual proposal attachment, approval/submission/fill lifecycle wiring,
declared-source opening authorization, gains reconciliation, and connected
desktop/mobile stakeholder UAT. No production migration, deployment, traffic
change, or broker order occurred in this checkpoint.

## Exact proposal reservation boundary — September 10

Added internal `reserveDiscoveryProposalCapital`. It accepts only owned order
identity, reads the persisted gated notional, checks pending/unsubmitted status,
paper acknowledgement, passed gate snapshot, exact child/source revision,
research account/thesis and selected candidate symbol. It uses the existing
declaration envelope and stable `paper-order:<id>` allocation key. It does not
accept a browser-supplied amount/source and does not create or approve an order.

Seven disposable DB cases cover one-time attachment, repeat identity, over-budget,
failed gate, dispatched/foreign order, caller rollback and concurrent connection
retries. Fixtures are explicitly synthetic persisted proposals: these tests do
not prove real `createOrder` preflight or its transaction integration.

The concurrent test exposed `ER_CHECKREAD` in locking claims after another
transaction committed. The root DB-only `withCapitalLedgerTransaction` wrapper
now retries a complete rolled-back transaction at most three times, only for
snapshot/deadlock conflicts. Connection loss, timeout and duplicate-key errors
are not replayed. This wrapper must not surround provider/broker operations.
Six unit cases cover the bounded retry policy. Red receipts: `.sj1AyT` and
`.MUBrm1`; final green: `/tmp/capital-isolated-integration.cx6uMV/summary.json`.

Final 256 integration tests passed / zero failed / two external-URL skips;
owned DB/user cleaned. Unit 2,026 passed / zero failed / eight skips
(`/tmp/aperture-proposal-retry-unit-20260910.json`); type/diff checks passed.
No public router or opening-gate change. Next is wiring reservation and
reconciliation into actual order transactions and proving that connected path.
No production migration or deployment; verified gains remain separate work.

## Order-bound allocation reconciliation — September 10

Added internal `reconcilePaperOrderClaim` to the existing capital ledger. It
locks account/event/claims/order in that order, verifies owned opening-order
identity and only transitions an already bound `paper-order:<id>` claim. It
never creates an order, source or allocation, and never contacts a broker.
Unbound legacy orders remain unbound.

- Awaiting approval / approved-but-unsent: pending reservation stays pending.
- Submitted, including partial fills: committed; unknown dispatch remains flagged.
- Filled or terminal partial fill: entire earmark consumed, not prorated into
  purported available cash. Unused remainder needs independent cost reconciliation.
- Undispatched local rejection, or terminal broker-confirmed zero fill: released.
- Missing fill quantity or transport ambiguity: retained and flagged for review.
- Later contradictory evidence does not recycle consumed claims or silently
  revive a released claim. Released-with-fill fails ledger integrity checking.

Fifteen additional disposable DB cases exercise these paths, repeated reads,
foreign ownership, contradiction and atomic caller rollback of order plus claim.
No order mutations are performed by the reconciler; fixture updates are explicit.
Final suite: 249 passed / zero failed / two external-URL skips
(`/tmp/capital-isolated-integration.2gZiCK/summary.json`); cleanup removed the
owned DB/user. Offline unit: 2,020 passed / zero failed / eight skips
(`/tmp/aperture-order-claim-unit-20260910.json`). TypeScript/diff pass.

This service is not yet called by production order transitions. Next integration
must atomically attach the declaration claim when creating a proposal and call
reconciliation within the same order transaction using the documented lock
order. Discovery opening gates remain closed until that integration is complete.
No migration, deployment or verified-gains capability is claimed here.

## Clean-commit verification — September 10

Committed only the order lifecycle fixes and their unit/database tests as
`464ad90114a1fbd64bae8294bb354a97823c8eb9` (four files). Other staged and unstaged
Mission/discovery/UI work was preserved. GitHub `origin/main` was fast-forwarded
from `1738976`; remote readback confirms the full new SHA. No force push.

Independent detached checkout `/tmp/aperture-order-release-check.Hpw5nI`
contains exactly that commit, not the mixed working tree. It passes TypeScript,
client/server build, 1,820 unit tests (zero failures, eight skips) and 151 isolated
database tests (zero failures, two external-URL skips). All six fill-progress
and nine rejection regressions are present and passed in the clean unit report.
Reports: `/tmp/aperture-order-clean-unit-20260910.json` and
`/tmp/capital-isolated-integration.xuqEvH/summary.json`; owned database/user
cleanup confirmed. These clean counts differ from the larger development-tree
suite because unfinished changes/tests are intentionally absent.

Build still warns about a large main client bundle (~4,565 kB / 1,096 kB gzip).
No Cloud Run deployment, traffic change, production migration or broker action
was performed. GitHub sync is not deployment or stakeholder acceptance. The
clean checkout is retained for reproducibility; full goal remains open.

## Accepted-order partial-fill progress — September 10

The existing mirror skipped an accepted order whenever its broker ID and mapped
status were unchanged. Because partial fills also map to `submitted`, new filled
quantity/average price was lost. The mirror now compares those fields too, keeps
missing fields at their prior values, and records material progress without
inventing a new order status or marking a partial fill complete.

Its update now compares the owner, previous status and previous fill fields.
If another poll wins, the stale update produces no outcome/snapshot side effects
and is not counted as a successful mirror. This protects concurrent updates;
it does not establish broker correction/bust lineage or settlement evidence.

Six real-function tests cover progress, price updates, unchanged/missing fields
and a lost update. Three progress cases failed before the fix; the stale-update
count case also failed before the affected-row check. Two disposable DB cases
prove persistence/repeat-read behavior and a newer 0.75-share fill surviving an
in-flight 0.5-share result. No terminal-fill claim, capital allocation or broker
submission was created. Shared attention already consumes recorded filled and
remaining quantities; fresh live UI UAT remains required.

Final: 2,020 unit tests passed / zero failed / eight skipped
(`/tmp/aperture-partial-progress-final-unit-20260910.json`), 234 isolated tests
passed / zero failed / two external-URL skips
(`/tmp/capital-isolated-integration.45UWbM/summary.json`). TypeScript/diff passed;
owned DB/user cleaned. No deployment. Actual proposal-claim integration remains
unfinished; this closes an underlying fill-recording defect needed by it.

## Reject-versus-dispatch race repaired — September 10

While tracing allocation release, found that `rejectOrder` read a rejectable
status and then updated by order ID alone. A concurrent submission or fill could
be overwritten with `rejected`; future claim release would inherit this unsafe
terminal state. The update now compares exact order ID, owner and previously
read status, checks affected rows, and asks the operator to review changed state
instead of reporting successful rejection.

Real-function unit tests reproduced six stale-write failures before the fix;
all nine focused cases pass afterward. Disposable database tests interleave an
actual second-connection submitted/filled update between the service's read and
write. Both preserve the winning status, unchanged rejection reason, unrelated
records and empty ledger; no broker call occurs. This tests deterministic race
interleaving, not live broker dispatch or allocation release.

Full results: 2,014 unit tests passed, zero failed, eight skipped
(`/tmp/aperture-rejection-cas-unit-20260910.json`); 232 isolated integration tests
passed, zero failed, two external-URL skips
(`/tmp/capital-isolated-integration.ywYlDq/summary.json`). TypeScript and diff
checks pass. Owned database/user cleanup confirmed. No deployment, production
mutation or opening-gate removal. Actual proposal allocation/claim lifecycle
remains the next integration task, now with a safe rejection transition.

## Declared-source envelope binding — September 10

Added `readDiscoveryDeclaredEnvelope` beside the immutable discovery binding.
It verifies the exact owned current child revision, source receipt and original
accepted declaration, then reads the existing event/claims ledger in the caller's
transaction. It invokes the existing `deriveCapitalEnvelope` calculation;
there is no parallel risk or money calculation. Missing events are not recreated.
Amounts remain operator-declared, never verified cash or realized gains.

Two children from one discovery receipt resolve to the same source envelope.
A pending claim blocks both using the existing concurrent-allocation policy.
Changed amount/source/account binding and expired research are refused. Full-row
snapshots confirm these reads and refusals write no records. No provider call.

Red run: `/tmp/capital-isolated-integration.mmajw8/summary.json` (two failures
for the absent reader). Final green:
`/tmp/capital-isolated-integration.yVgho4/summary.json` — 230 passed, zero failed,
two external-URL skips. Owned DB/user cleanup confirmed. Offline unit suite:
2,005 passed, zero failed, eight skips in
`/tmp/aperture-declared-envelope-unit-20260910.json`. TypeScript passed.

This is an internal prerequisite, not completed proposal integration. No router
exposes new allocation authority, no opening gate was removed, and no proposal
claims are created by this reader. Next: integrate the exact source claim into
the actual proposal transaction, with rejection/release and consumed-state
reconciliation, before permitting discovery opening orders. Gains still need
independent basis/fees/availability evidence. No migration or deployment.

## Release audit — September 10, after interruption verification

Rechecked the current mixed working tree, not a clean release checkout:
TypeScript passed, client/server production build passed, and the offline unit
suite passed 2,005 tests with zero failures and eight skips. Report:
`/tmp/aperture-release-audit-unit-20260910.json`. All commands explicitly cleared
`DATABASE_URL`; no production database migration or deployment was performed.
The build warns about large chunks: its main client bundle is approximately
4,589 kB (1,102 kB gzip). Build success is not mobile-load performance acceptance.

The remaining gains blocker is a missing authoritative producer, not a cosmetic
gate to remove. Recorded closing execution receipts do not establish attributed
opening-lot basis, complete fees, settled available proceeds or selected reserves.
`realizedGainSource.ts` therefore continues to return no verified gains source.
The internal claim ledger permits operator-declared events but still needs
integration with the actual proposal transaction and lifecycle. Do not relabel
gross sale proceeds as profit, infer missing proofs from account totals, or
enable discovery opening orders to make the walkthrough appear complete.

Verified the existing THI-266 operator-annotation comment
`3a569f19-46b8-4276-aaac-ccf0ba41ae89`; no duplicate annotation post was created.
The referenced **Review Capital Aperture UAT** task was read again. Its September
9 authenticated observations remain historical evidence, not a fresh production
retest. The full stakeholder/release completion matrix remains open.

## Browser interruption proof — September 10, 06:40 ET

Added bounded request/response interruption modes to the disposable browser
driver; only the startResearch request is intercepted, never production traffic.

- Before dispatch: `/tmp/aperture-mobile-journey.eUgLoU/results.json`, eight
  checkpoints. Selection persisted; first request was aborted before reaching
  the server. Reload + Continue selected research created run #1. One validation,
  two browser start attempts (one deliberately blocked), one persisted run.
- After dispatch: `/tmp/aperture-mobile-journey.qewxYk/results.json`, nine
  checkpoints. Response was deliberately lost after the server responded.
  Reload + Continue selected research reopened run #2 without another start
  request. One validation and one start request. Read-only recovery also returned
  to that same evidence run without additional POSTs.

These were two distinct missions in one owned database: final two completed
research runs, zero broker orders. No evidence was answered. Provider access
remained denied. Owned database/user cleanup succeeded in
`/tmp/capital-isolated-integration.KCwSjX/cleanup.json`.

Visual inspection caught misleading preexisting recovery copy (“without creating
new work”) above the new continuation action. For a saved selection it now says
“Continue opens or starts its research; no order is created.” The screenshot
`interrupted-selection-before-copy-correction.png` deliberately records the
before state, not proof of the corrected copy. Fourteen callback tests pass.
No deployment. Full live-data, capital-source/allocation, execution and release
acceptance remain open; this proves browser recovery, not those other gates.

## Duplicate-safe research continuation — September 10, 06:37 ET

The real `runway.startResearch` path now reuses an existing owner/account/thesis
bound run for the exact current Mission revision. Creation locks the Mission
row before inserting/binding research. A concurrent caller reads that binding;
only the caller that created it invokes the research worker. Changed revisions,
invalid bindings and changed unbound lock versions remain blocked.

The persisted positive-discovery integration test now sends concurrent start
requests, then repeats the request after binding. It failed before repair and
passes after: same run ID from every request, one candidate, one research-worker
invocation; protected account/canonical/order/claim/evidence records unchanged.
Isolated suite: 223 passed, 0 failed, 2 external-source skips.
Red: `/tmp/capital-isolated-integration.znzYY6/summary.json`.
Green: `/tmp/capital-isolated-integration.05tePz/summary.json`.
Both owned databases/users cleaned successfully.

Mission result adds **Continue selected research** alongside read-only
**Check saved research** for a persisted selection. It rereads matching context,
opens a bound run or explicitly invokes the duplicate-safe path when absent;
it never selects again. Fourteen callback tests pass. Full offline unit suite:
2,005 passed / 0 failed / 8 skipped, TypeScript/diff clean. Report:
`/tmp/aperture-dispatch-resume-unit-20260910.json`.

New continuation action still needs connected browser UAT. This does not claim
durable worker execution across a process crash between commit and worker start:
an already queued/failed run is reopened, not automatically redispatched. That
remains governed by the existing research status/recovery experience. No new
broker/proposal authority, migration or deployment in this change.

## Desktop and enlarged evidence — September 10, 06:33 ET

Repeated the full disposable setup/selection/evidence/recovery journey from a
new database: `/tmp/aperture-mobile-journey.dtUvPZ/results.json`, eight passing
checkpoints. The larger-text follow-up reproduced 422px width at 390px. Cause:
comparison controls stayed in one row and the long decline action could not
wrap. CandidateBoard now wraps those controls and allows evidence answer
buttons to grow vertically while retaining their 44px minimum.

Final `/tmp/aperture-mobile-journey.ZiPPnj/results.json`: collapsed/expanded
mobile evidence, read-only recovery, doubled-root-font evidence and 1280px
desktop captures pass width checks. No POST occurred in this inspection and
recovery pass. Before cleanup: one research run, zero orders, zero evidence
reviews. Owned fixture DB and user removed; cleanup receipt in
`/tmp/capital-isolated-integration.R2GMf3/cleanup.json`. The running snapshot
received the same CandidateBoard wrapping patch after initial capture; initial
snapshot hashes precede that patch.

Visual review: no document overflow, but doubled-text page remains 8,475px tall.
This does not establish comfortable large-text usability, all control touch
targets, full keyboard/screen-reader acceptance or live sourced validation.
Normal mobile is 2,697px; desktop 2,024px. Next work must preserve this evidence
while addressing the outstanding workflow/release requirements, not call the
full journey complete based on layout alone. No deployment or broker action.

## Connected evidence and mobile recovery — September 10, 06:29 ET

Real browser actions completed the disposable objective-led flow through
selection and `runway.startResearch`. The real research orchestration produced
one UATQ candidate with 35 unresolved checks, with provider credentials blank and
external networking denied. It completed a research record, not market-data
verification or a qualified trade. No evidence answers were recorded.

Initial run `/tmp/aperture-mobile-journey.68drLE` reached the exact evidence view
but failed mobile recovery layout (411px in a 390px viewport). A cold inspection
reproduced 402px width: source-record buttons did not wrap and long checklist
text overflowed. The page also expanded all 35 checks, producing an 8,475px page.

Repair: source actions wrap, long requirements break within their container, and
the full checklist is collapsed under **All required checks · 35**. Active
question, unresolved counts and missing-evidence explanation remain visible;
no check is removed or automatically answered. Final default height is 2,697px.

Final connected proof `/tmp/aperture-mobile-journey.eqg19u/results.json` passes
collapsed evidence, expanded full checklist and saved-research recovery at 390px.
Recovery opens the same run #1 / evidence view from decision #2 / revision #2.
This inspection/recovery makes zero POST requests. The initial journey made
exactly one validatePlay and one startResearch request. Before cleanup: one
completed research run, one candidate, zero broker orders, zero evidence reviews.

The browser used an owned disposable profile. The loopback server snapshot was
patched only with the same two CandidateBoard lines as the worktree, after the
overflow reproduction; its initial snapshot hashes therefore precede that UI
repair. User browsers and the older UAT database were untouched. Owned database
and scoped user removed successfully: `/tmp/capital-isolated-integration.gG6S34/cleanup.json`.

TypeScript passes; full offline unit suite remains 2,004 passed, 0 failed,
8 skipped (`/tmp/aperture-evidence-mobile-unit-20260910.json`). No deployment.
Remaining: desktop/enlarged-text evidence, live sourced answerability, missing
dispatch recovery, gains allocation, human-gated execution and stakeholder UAT.
The long provenance requirements remain verbose when expanded; this is not a
claim that the full evidence experience is polished or user-tested.

## Saved research recovery — September 10, 06:25 ET

The selected-result page now offers **Check saved research** after a saved
selection or an uncertain validation/dispatch response. It rereads the exact
Mission receipt and current underwriting record. Only matching decision,
revision, underwriting revision and selected-play identities may open the
server-bound research run's evidence view. Errors and absent run bindings remain
explicit; this action never repeats validation or dispatch. A synchronous latch
coalesces repeated clicks, and status messages remain inline without focus moves.

The actual callback test failed because no recovery control existed, then passed
after implementation. Thirteen callback tests include a successful read-only
resume, missing binding, query failure, wrong Mission/revision, changed play and
concurrent clicks. Full offline unit report:
`/tmp/aperture-research-recovery-unit-20260910.json`: 2,004 passed, 0 failed,
8 skipped. TypeScript and diff checks pass. Existing design tokens and a wrapping
44px-minimum action are reused; no new visual system.

Acceptance still open: connected browser evidence handoff; rendering/recovery on
mobile and enlarged text; selected-but-never-dispatched recovery after the
server definitively establishes that no request is in flight. An absent run in
one read is not proof of safe dispatch retry. No production change, provider
request, broker mutation or deployment occurred in this turn.

## Underwriting → evidence destination — September 10, 06:22 ET

The actual `ApertureUnderwriting` validation callback sent successful research
handoffs to `/aperture/run/:id`, whose CandidateBoard defaults to the play
overview. It now sends them to `/aperture/run/:id?view=evidence`, using the
server-returned run identity. No candidate ID is invented before asynchronous
research creates it.

Regression evidence: the exact-destination callback assertion failed before the
change and passes after. Six callback tests cover retained/uncertain and old
results, double-click suppression, successful selection ordering, blocked
research, and lost research responses. Blocked/failed dispatch does not navigate
or show a success receipt; there is no automatic mutation retry. Full offline
unit suite: 1,997 passed, 0 failed, 8 skipped. TypeScript and diff checks pass.
Report: `/tmp/aperture-evidence-handoff-unit-20260910.json`.

This is callback/source evidence, not a connected browser research acceptance
claim. The positive browser journey still stops at underwriting. A remaining
recovery gap is visible in current source: selected cards are disabled, while a
lost startResearch response has no explicit bound-run recovery action on this
result page. Add a read-only, exact-Mission/revision reconciliation path before
calling interrupted validation complete. Preserve the server's duplicate-run
guard; do not solve this by replaying dispatch.

No deployment, migration, provider request, or broker action in this check.

## Connected mobile and interrupted setup — September 10, 06:12 ET

The deterministic driver `scripts/check-objective-mobile-journey.mjs` launches
its own headless Chrome profile at 390×844 CSS pixels, with reduced motion, and
uses the disposable positive browser server. No user browser cookies are read.

Final receipt: `/tmp/aperture-mobile-journey.pzDQz0/results.json`. Six checkpoints
pass: saved account/risk section, fresh-page draft resume, effective constraint,
positive discovery lead, exact saved underwriting result, and doubled-text
result after reload. A fresh page resumes the server-owned draft with the exact
$2,000 capital / $100 requested loss / swing / shares assumptions; the review
returns $15 effective risk. The result preserves unknown sizing and no-order
boundaries. Resume and result reload issue no POST requests. No validate-play,
start-research, proposal, approval or submission request occurs in this test.

All captured pages have no horizontal document overflow. Important actions have
at least 44px height. Visual inspection found the Validate action crowded its
arrow at doubled text; the button now wraps its label and retains the arrow.
A rendered contract failed before repair and passed after; the final connected
driver additionally asserts no important action-content overflow. This is
browser emulation/root-font enlargement, not physical-device, OS text scaling,
screen-reader certification or measured stakeholder comprehension.

Earlier driver attempts exposed selector/loading/scroll timing issues. The
first apparently successful enlarged-text run captured a blank reload frame;
it was rejected after visual inspection. Final assertions require a new
navigation time origin, populated content and rendered frames before capture.
Only the final receipt above supports acceptance.

Final DB readback: two Missions (source and child), one selection, one
underwriting revision, two complete jobs at attempt 1, zero research runs,
orders and claims. Harness `/tmp/capital-isolated-integration.Kc3lab` removed its
owned database/user. Prior attempts FJGVYl, oE85Ur, kDjgfH and xZpkEs also have
confirmed owned-resource cleanup. The driver's own Chrome processes exited.

Representative screenshots copied without alteration into routing-2026-09-10:
`connected-mobile-resumed-draft.png` and
`connected-mobile-result-large-text.png`. Not deployed. Evidence completion,
full execution lifecycle, gains allocation and stakeholder readiness remain open.

## Positive discovery → underwriting browser pass — September 10, 05:57–06:02 ET

Added `--browser-positive` to the disposable integration wrapper. The explicit
composite provider lives only in `scripts/objective-positive-browser-fixture.ts`.
The local transport uses real source-bound selection and the exported existing
underwriting executor with its illustrative calculation fixture. No production
HTTP procedure, auth gate, risk rule or provider setting was relaxed.

Actual Chrome journey: no canonical thesis → question/swing/shares → named
illustrative account → $2,000 declared capital / $100 loss input → inspect $15
effective risk → Underwrite my mission → recorded research lead → Underwrite
this lead → exact `/aperture/decision/2/revision/2/underwrite`. The original
Mission/source link returns to revision 1; Open saved analysis reopens the same
child result without another job.

Readback before and after reopening: one discovery selection, one underwriting
revision, two complete jobs at attempt 1 (discovery and underwriting), zero
research runs, broker orders and allocation claims. This is count/identity
verification, not a whole-database checksum audit. No evidence was answered.

The positive path exposed a real presentation defect: absent share entry/stop
data rendered as $0 planned loss, 0% capital risk and unchanged hypothetical
portfolio exposure. TradePlayCard now shows Not measured and withholds that
impact calculation. An options budget remains labeled a ceiling, not contract
loss. Measured share scenarios retain their numbers with a stop-execution
uncertainty statement. Three rendered regressions failed before the repair and
pass after. Full unit suite: 1,994 passed, zero failed, eight existing skips;
typecheck and diff check pass. `/tmp/aperture-positive-risk-unit.json`.

The same card patch was applied explicitly to the running disposable snapshot
for browser retest; its initial snapshot manifest therefore predates this one
file update. Chrome confirmed the corrected wording. Before/after screenshots
are `positive-handoff-unmeasured-risk-before.png` and
`positive-handoff-unmeasured-risk-after.png` in the routing-2026-09-10 evidence
directory. Harness receipt: `/tmp/capital-isolated-integration.7PTRVS`; owned
database/user removed and own Chrome tab closed. The initial failed harness
wiring attempt `.AogIPQ` also has confirmed cleanup.

Not deployed. This proves desktop discovery-to-underwriting and saved reuse
with composite inputs, not live-source quality, mobile, evidence completion,
approval/submission or gains allocation. Those remain acceptance requirements.

## Selected-lead recovery follow-up — local, September 10

`DiscoveryLeadAction` now explains missing or refreshing saved-selection reads,
offers read-only recovery for an unavailable response, and contains a rejected
recovery read without retrying the selection mutation. A separate regression
reproduced a loading message masking the eligibility blocker; both messages now
remain visible. No research, approval, submission, or order behavior was added.

The original recovery regressions failed before repair. The additional blocker
visibility test failed before its repair; all 16 focused interaction tests now
pass, including double-click, exact identity, timeout and cross-device reuse.
Type checking passes. Full-suite evidence is recorded in
`/tmp/aperture-selection-recovery-unit.json`.

This is local callback/render-contract coverage, not a connected positive-lead
browser pass. The disposable browser still injects an empty-universe discovery
provider; positive discovery and subsequent underwriting need an explicit
fixture seam without relaxing production provider or database boundaries.
No deployment or production migration occurred. Full stakeholder acceptance,
connected mobile journeys and verified gains allocation remain open.

## Scope and result

September 10, 2026, approximately 04:12–04:20 ET. Agent-operated isolated
Chrome checks, not stakeholder usability research or a market-open execution test.

Production baseline `070d04c` plus review fix `7d38fbc` is isolated in release
commit `a42b16bd8ae474ea4af849c14b5200b3aaa69821`. No backend, schema, risk,
approval or submission change is included in that release.

| Journey | Observed result |
| --- | --- |
| Desktop Today → Review unresolved finding | Opens the exact selected put and catalyst finding; focus moves to that finding. |
| Mobile 390×844 → Enter on the same action | Same route and finding identity; evidence is expanded; the other check remains available. |
| Missing monitoring coverage | Partial-status explanation remains visible; no all-clear. |
| Unverified illustrative source | Not promoted to verified evidence. |
| Review without assessment | Save review remains disabled; no review is persisted. |
| Record preservation across mobile repeat | Full account/order/check rows and explicit review receipts retain the same digest. Seen state is excluded. |

Exact fixture route:
`/aperture/run/27/execute?candidate=20&lifecycle=monitoring&order=26&finding=2&findingVersion=v1-758ed8f1`.

The separate illustrative owner is 144, account 52. This manually seeded record
is not a provider-confirmed fill. One order, two checks and zero explicit reviews
were present before and after the mobile repeat. Their SHA-256 was unchanged:
`139549688b93d6d5d840e69dea8dfccd87126734d53e50700fcdb96ad1310c26`.

No source refresh, review assessment, proposal, approval, submission or exit was
requested. Temporary mobile viewport override was reset. No production records
or schema were modified for this test.

## Reproduction

Use Node 26 and the existing local-only MariaDB container. The runner verifies
its exact container, database and loopback binding, then blanks credentials
before starting child processes. Do not substitute a production URL.

1. `DATABASE_URL= node scripts/with-isolated-capital-uat.mjs --monitoring-seed`
   creates the separate labeled fixture once; retries preserve existing state.
2. `DATABASE_URL= node scripts/with-isolated-capital-uat.mjs --monitoring-inspect`
   reads the record digest without seeding or updating anything.
3. Run the wrapper with `--monitoring-server` from the compatible release source
   to serve port 3112 and the separate fixture identity. It must not replace the
   existing saved-Mission server on port 3110.
4. Open Today, activate Review unresolved finding, and verify exact identity,
   selected focus, other check visibility and disabled Save review.
5. Repeat at 390×844 with Enter; inspect the digest again and reset the viewport.

The current development backend requires unapplied Strategist schema and cannot
be substituted for this release baseline on the older browser database. Its
failed read correctly displayed uncertainty. No automatic migration was added
to the UAT runner.

## Verification and evidence

- Compatible UI package: 1,341 unit tests passed, zero failed, six existing skips.
  `/tmp/aperture-ui-review-release-unit.json`.
- Main source checkpoint: 1,959 unit tests passed, zero failed, eight existing
  skips; type checking and build passed. Those counts include unreleased work
  and are not the release package's count.
- Seed retry preserved the fixture. An explicit production-like wrong host was
  rejected before opening a database connection.
- Screenshots:
  `/Users/lenoxparis/.codex/visualizations/2026/08/25/01a0392e-5a5e-73c2-9f5e-675f1dc136d9/routing-2026-09-10/`
  — `exact-finding-desktop.png`, `exact-today-mobile.png`,
  `exact-finding-mobile.png`.

## Remaining acceptance

Production promotion and authenticated post-release retest require a separate
release receipt. Physical-device, screen-reader, enlarged-text and complete
keyboard traversal are not established by this mobile emulation. The original
Strategist/excess-capital/gains/revision lifecycle remains unfinished; this UAT
does not narrow that scope or prove positive expectancy or ten-second comprehension.

## Production receipt — 2026-09-10 08:31 UTC

- UI-only release `a42b16bd8ae474ea4af849c14b5200b3aaa69821`, branch
  `codex/aperture-review-handoff-release`, based on production `070d04c`.
- Cloud Build `050676f1-318a-4e0e-827d-1035bb6800b5` succeeded;
  `capital-aperture-00094-hay` now serves 100% traffic. Revision 92 remains
  available for rollback. Runtime settings unchanged except image.
- Public Firebase app returned 200 and exact release marker; health returned
  200 JSON with `ok:true` at 08:29 UTC. No migration or broker action.
- **Authenticated production UAT remains failing:** Today review button focused
  without navigating after accessibility click, Enter and direct pointer click.
  Browser attachment also timed out twice. Isolated connected success above does
  not prove production browser success; root cause remains undetermined.
- THI-266 release/blocker comment: `f89f7cbc-96d6-4136-a284-fa92f8a4ea97`.
- Next: diagnose this signed-in navigation discrepancy, then repeat the exact
  desktop/mobile task. Full UAT and gains backend remain open.

### Fresh authenticated production tab comparison

A new tab in the same signed-in Chrome profile successfully opened Today and
activated Review unresolved finding. The destination retained run 360001,
candidate 240003, order 2, finding 120001 and version v1-951cb173. Loading showed
“Loading selected play and order… No checks are being run.” before focusing the
selected finding and expanding catalyst evidence. Save review remained disabled;
no check generation or review/approval/submission action was invoked.

The previous failure is therefore session/tab-specific so far, not universal.
Its root cause remains unverified. Fresh production desktop passes this bounded
handoff; post-release mobile remains pending. Screenshot:
`routing-2026-09-10/production-fresh-finding-desktop.png` in the evidence folder.
Raw Markdown and citation markers in the finding body remain a visible polish
gap; safe rich-text/source rendering needs follow-through.

## Evidence readability increment — local, not deployed

FindingEvidence now uses the existing Markdown parser (react-markdown 10.1.0,
already present transitively, now an explicit dependency). Recorded emphasis and
paragraph structure render normally; no rewriting or summarization is performed.
Raw HTML and embedded images are excluded. Inline and recorded source links are
restricted to HTTP(S) without embedded credentials. Invalid source slots retain
their original number with “link unavailable,” so references are not renumbered.
Numeric citation markers remain literal references to the numbered source list.
Headings are visually restrained and cannot replace the page heading hierarchy.

Regression was reproduced before the change. Four new rendering/safety tests
cover formatted evidence, non-embedding, invalid source slots, and inline URL
safety. Existing complete-narrative assertion now compares all visible text
rather than requiring literal Markdown delimiters. Full unit suite: 1,963 pass,
0 failures, 8 existing skips (`/tmp/aperture-evidence-render-unit.json`). Typecheck,
production build and diff whitespace check pass. Existing chunk-size and Node
deprecation warnings remain. No data, risk or lifecycle mutation added.

Browser visual verification and deployment of this increment are still pending.

### Production-compatible browser verification

Release branch `codex/aperture-review-handoff-release` now contains `7b5095a`
(source `f3eeb7f`) plus isolated fixture tooling, without the unfinished backend
migrations. Release-compatible unit suite: 1,345 pass, 0 failures, 6 existing
skips (`/tmp/aperture-evidence-release-unit.json`).

The connected isolated Today → exact finding route passed again with the new
renderer. Account/order/check/explicit-review hash before and after remains
`139549688b93d6d5d840e69dea8dfccd87126734d53e50700fcdb96ad1310c26`;
one illustrative order, two checks, zero reviews. Seen state is excluded.

A separate zero-API renderer fixture exercised emphasis, lists, inline links,
unsafe source slots and excluded media, because the persisted navigation fixture
does not contain Markdown. Desktop and narrow-screen screenshots are saved as
`formatted-evidence-desktop.png` and `formatted-evidence-mobile.png` beside prior
evidence. Requested viewport was 390×844; measured CSS width was 433 at the
browser's current zoom, with scroll width also 433 (no horizontal overflow).
This is narrow-screen verification, not an exact 390 CSS-pixel or physical-device
pass. No images or unsafe links appeared in the rendered DOM. Temporary viewport
was reset, both test tabs closed, and test servers 3112/3113 stopped. Renderer
HTML moved out of the release tree into the evidence folder. Production is still
revision 94; this increment is not deployed.

## Evidence release receipt — September 10, 08:51 UTC

- Build `d03597cd-a867-4775-b797-117b803a15e9` succeeded at 08:47 UTC.
- Release `7b5095a0458ef278643c98148a9b99f0f7ec2021`, image digest
  `sha256:6ceca670878ed8394b6323dfa755eefb44dace43f7de186a8b7044f3feea718d`.
- Revision `capital-aperture-00096-fuh` staged at zero traffic; JSON health,
  exact client release marker and runtime-settings comparison passed. Only image
  changed. Promoted to 100%; revision 94 preserved for rollback. Public Firebase
  URL returned 200 health JSON and exact release marker after promotion.
- Fresh signed-in production Chrome Today → DKNG finding passed on desktop and
  with Enter at measured 390×844 CSS viewport. Destination retained all original
  run/candidate/order/finding/version identities. Finding context loaded explicitly,
  then focused selected evidence with rendered strong/emphasis text. Save review
  was disabled. Scroll width 386 at viewport width 390: no horizontal overflow.
- Screenshot: `released-formatted-evidence-mobile.png` in the evidence folder.
  Temporary viewport reset and test tab closed. No monitoring refresh, assessment,
  review save, approval or submission invoked; ordinary Seen writes are possible.
- No schema migration or backend gains capability shipped. Full keyboard-only
  journey, physical-device/screen-reader UAT, older-tab discrepancy and remaining
  original-scope acceptance are still open. This is not a full usability pass.

## Saved Mission keyboard increment — local, not deployed

On the existing isolated 3110 Mission fixture, Tab first selected Skip to
workspace; Enter focused the named main. A recorded ten-Tab traversal reached
the first Mission section (six account/constraint help controls precede it).
Enter opened and focused the thesis section. Semantic keyboard activation of
Review account & risk and Review mission focused their respective h2 headings.
No final Queue conditional review action was taken. Reload returned to the saved
review section with $25,000 capital, $249 input limit and $187.50 effective risk
unchanged. Section navigation autosaved resume state; this is not a zero-write
claim. No assumptions were edited and no new analysis was authorized.

Observed duplicate h1 for the nested mission statement. Corrected it to h3 under
the thesis h2; nested empty/error headings use h2, leaving the page as sole h1.
The regression failed before the fix and passes afterward. Browser DOM confirms
one h1 and correct section focus. Typecheck and 1,964 unit tests pass (zero
failures, eight existing skips; `/tmp/aperture-mission-headings-unit.json`).
Changes overlap the unreleased DecisionRunway work and are deliberately not
included in a broad commit or deployment. This is bounded keyboard/resume
coverage, not a complete screen-reader or keyboard-only submission journey.
# Isolated persistence recheck and annotation reconciliation

Re-read the referenced authenticated Chrome walkthrough and confirmed the four
operator annotations are already captured in THI-266 comment
`3a569f19-46b8-4276-aaac-ccf0ba41ae89`. No duplicate annotation comment was added.
That walkthrough records September 9 observations, not a current production
retest. Its result-first, exact-finding, answerable-evidence and compact-disclosure
requirements remain acceptance criteria; later release receipts govern which
specific repairs have newer verification.

Re-ran the current tracked working-tree snapshot through the isolated integration
harness: 18 files passed, 221 tests passed, zero failed, two explicit external-URL
skips. Evidence: `/tmp/capital-isolated-integration.YihtHn/summary.json` and
`cleanup.json`. The disposable schema and restricted database user were removed
successfully. The separate browser fixture and production database were not
used. Provider networking was denied by the harness.

This verifies persisted contracts, including objective mission and discovery
selection, not a connected browser journey or verified gains allocation. No
production migration, release, research, approval or broker action was performed
by this recheck. Full stakeholder acceptance remains open.

## Resumed underwriting action boundary — local follow-up

Actual-page callback tests confirm that persisted running-job status polls and
completion refreshes the result without authorizing new analysis. Two new tests
failed before repair: invoking validation with retained evidence and a failed
status query, or with an older decision revision, still dispatched selection.
The visual disabled state alone was the only client-side guard. This is not a
demonstrated production UI bypass or proof of server acceptance.

The action handler now checks current readiness, matching decision identity,
completed job state and a synchronous pending latch. A positive test confirms
one selection request for a double click, research only after its response, and
navigation to the returned research run. Twelve focused tests and typecheck
pass. Full unit evidence is `/tmp/aperture-underwriting-resume-unit.json`.

No runtime provider call, database write or broker action occurred in these
mock-boundary tests. The page already overlaps unreleased discovery work; this
follow-up is deliberately not committed wholesale or deployed. Complete
connected browser and gains-allocation journeys remain open.

## Public discovery-to-result persistence journey

Added a real-router journey for selected discovery → leased underwriting → saved
no-trade result → second-caller read → repeated selection. Market analysis is an
explicit illustrative no-setup fixture using the real deterministic quantitative
engine. The retry reuses the selection and underwriting revision; only one
analysis call occurs. Original canonical/account rows and research, candidates,
orders and claims are unchanged. This does not certify a positive-play handoff.

All 222 integration tests passed, zero failures, two explicit external-URL skips;
disposable DB/user removal confirmed. Receipt:
`/tmp/capital-isolated-integration.AuiVc3/summary.json`. Typecheck passed. No
production migration, provider call, broker action or deployment occurred.
Cloud Run readback separately confirms revision 96 still has 100% traffic.

## Positive discovery-to-research handoff — September 10

Extended the router journey to a single conditional DATA fixture. Actual play
selection precedes the actual research orchestrator, which completes and saves
one matching candidate. Original discovery evidence/verification requirements
remain attached. Provider seams are explicitly fixture-authorized and otherwise
throw; research receives exactly DATA. Canonical/account/order/review/claim
rows remain unchanged. This verifies a positive persisted research handoff,
not live source accuracy, browser usability or approval/submission.

Latest isolated receipt: `/tmp/capital-isolated-integration.HgziLr/summary.json`:
223 passed, zero failed, two external-URL skips. Typecheck passed; temporary DB
and user removed. No deployment or production migration. Connected browser UAT,
realized-gains allocation and original remaining acceptance are still open.

## Production result-first recheck and local tab identity repair

Fresh authenticated Chrome Mission on revision 96 opens the saved outcome first:
no new trade, binding risk reason, reassessment condition, no-ticket/unchanged-
positions boundary. Suggested missions do not intervene. This desktop sample
does not establish a new mobile or full-journey pass. Screenshot retained at
`routing-2026-09-10/production-result-first-recheck.png` in the task evidence
directory. Reads only; Seen state may be written by the application.

The same browser still labeled the production tab Acquisition Command Center.
Fixed route-based tab identity in source commit `1738976`: Mission, Today, Play
Desk, result, research and record get Capital Aperture labels without exposing
account/position details or claiming order status. Non-Aperture routes retain
the existing title. Actual local Chrome Mission → Today verifies both labels.
Twelve route tests, typecheck and full unit suite pass (1,980 passed, zero
failed, eight existing skips). Receipt `/tmp/aperture-workspace-title-unit.json`.
Both temporary browser tabs closed; no input, research, review or order action.
This title change is not yet deployed; broader backend work remains uncommitted
and separate. Full stakeholder scope is still open.

## Disposable browser objective setup and refusal recovery

Actual Chrome on a separately provisioned disposable database completed the
no-canonical-thesis setup through saved review: $2,000 operator-declared capital,
$100 requested loss ceiling, swing horizon and shares. The effective constraint
was $15 before underwriting. The flow required separate constraint inspection
and draft saving; that interaction remains a simplification candidate, not a
verified usability improvement.

The start correctly refused because no deterministic discovery fixture was
configured. No Mission or provider work started. The UI incorrectly replaced
that reason with generic unchanged-draft retry guidance. The local fix preserves
the refusal reason through reconciliation and repeated saved-start checks.
Regression test failed before the fix; all 45 objective-flow tests and typecheck
pass afterward. The fix has not yet been repeated in the browser or deployed.

The browser harness permits only literal loopback DNS for its local listener;
external provider access remains blocked. Network guard tests: 10 passed.
Harness receipt: `/tmp/capital-isolated-integration.BdJDbD`; termination confirmed
removal of its owned temporary database and user. Existing local UAT and
production databases were not migrated or changed by this harness. Positive
browser discovery/research, gains allocation and full stakeholder UAT remain
open. This is not a market-open or full-journey pass.

## Browser discovery receipt and exact-return repair

The disposable server now injects an explicitly illustrative empty-universe
provider at its test-only transport seam. Real acceptance, job leasing, parser,
and persistence run; the production router and its isolated-mode refusal remain
unchanged. Actual Chrome completed question → account/risk → $15 effective
constraint → save → authorized discovery → no-leads receipt, without inventing
a canonical thesis, evidence, available gains or an order.

This exposed a return-link defect: completion retained `?objective=1`, so reopening
that address displayed a new blank form. Normal Mission navigation correctly
restored the receipt. The local repair replaces the new-draft address with the
exact accepted decision/revision after verified start or reconciliation. The
controller test failed before the fix; the route test also checks replacement,
not just component presence.

Browser retest confirmed `/aperture/decision/1/revision/1` immediately after
acceptance and in a fresh tab. Database readback after reopening: one Mission,
one complete job (attempt 1), one discovery receipt, zero broker orders, zero
capital claims. The fixture DB/user were removed and both browser tabs closed.
Receipt: `/tmp/capital-isolated-integration.ZdyWcX`; screenshot:
`routing-2026-09-10/objective-exact-receipt-reopened.png` in the task evidence
directory. This proves the desktop illustrative no-leads path, not live-provider,
mobile, selected-positive-play or broker submission UAT.

Focused controller tests: 46 passed. Network guards: 10 passed. Typecheck passed.
Full unit suite: 1,982 passed, zero failures, eight existing skips; report
`/tmp/aperture-objective-browser-unit.json`. No deployment or production migration.
Result copy remains too diffuse for glance-level use; separate save/constraint
clicks also remain a refinement target. Stakeholder readiness remains open.

## Glance-level research outcome refinement

The research-result heading now states the actual outcome: incomplete, failed,
running, interrupted, no leads, or a research-lead count. A finished analysis is
labeled "Analysis recorded", not a blanket successful/qualified result. The
visible outcome group contains the implication, specific coverage/source gaps,
and reopening condition. Generic incomplete copy is omitted only when specific
coverage gaps already say why the result is incomplete. No-lead states no longer
invite underwriting a nonexistent lead. The full source/calculation/history
content remains under the shorter "Evidence & record" disclosure. Named paper
account, source timestamp and no-allocation/no-order boundary remain visible.

The UX-copy skill guided the reduction of repeated explanation, not the removal
of truth. Existing Signal Hunter tokens and typography remain in use. A new
regression failed on the old generic heading and passes on the outcome-led view.

Validation: 1,983 unit tests passed, zero failures, eight existing skips;
typecheck passed. Report: `/tmp/aperture-result-glance-unit.json`. Six zero-API
Chrome visual checks passed: incomplete/failed at 390 and 1280 CSS pixels, plus
both mobile states with root text doubled. Assertions cover actual viewport,
no horizontal overflow, visible source uncertainty and no-order boundary,
44-pixel controls, reduced-motion preference, keyboard focus and native evidence
disclosure activation. These are renderer checks, not full WCAG certification or
user-tested usability. The fixture buttons are explicitly non-operational.

Annotated screenshots in task evidence `routing-2026-09-10/`:
- `research-incomplete-mobile.png`: outcome, account and freshness precede the
  bounded no-lead reason, source gaps and next condition; record stays secondary.
- `research-failed-desktop.png`: failure remains prominent while prior findings
  stay readable; the page does not report a successful empty search.
- `research-incomplete-mobile-large-text.png`: the same reading order reflows
  vertically at doubled text size without horizontal clipping.

Fixture/results: `/tmp/aperture-result-layout.xJSn43/results.json`. The separate
headless Chrome profiles have no user cookies; processes and local renderer were
stopped after inspection. No database, provider or broker call was involved.
No deployment. Positive-play connected UAT, full mobile journey, setup click
reduction, gains allocation and other completion-matrix items remain open.

## Reviewed draft → underwriting: remove the separate-save prerequisite

Objective setup now lets the explicit "Underwrite my mission" action save the
reviewed assumptions and then start their exact confirmed version. Manual Save
draft remains available for interruption. Inspect effective constraint stays
read-only and remains required; the UI explains that underwriting saves the
assumptions and builds research, not an order. No implicit save on page load.

The controller waits for a matching successful save response before starting.
Duplicate clicks share the existing operation guard. Failed/mismatched saves
stop and expose draft comparison. A slow save must still pass the current
account/preview freshness check before analysis. Four new regression cases cover
these boundaries; the first failed on the old separate-save behavior.

Actual Chrome on a fresh disposable DB: entered $2,000 capital, $100 loss ceiling,
swing/shares, inspected the returned $15 limit, and clicked underwriting without
ever clicking Save draft. Before authorization: zero drafts/Missions/jobs/orders.
After: one draft, one Mission, one completed job at attempt 1, one research
receipt, zero broker orders, zero capital claims. The exact revision URL and the
refined incomplete-result view appeared. Screenshot:
`routing-2026-09-10/one-action-underwriting-receipt.png`. Receipt:
`/tmp/capital-isolated-integration.ypVZac`; owned DB/user cleanup confirmed and
test tab closed. This is an illustrative desktop no-leads journey, not a live
market or positive-play UAT pass.

Tests: 50 controller tests passed; full unit suite 1,987 passed, zero failures,
eight existing skips (`/tmp/aperture-one-action-unit.json`). Typecheck passed.
No production deployment, migration or broker action. Full mobile interaction,
positive-play research handoff, gains allocation and completion matrix remain.
