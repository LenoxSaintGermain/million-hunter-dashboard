# Capital Aperture — original-scope completion audit

## September 10 — paper ticket path unblocked (supersedes the entry below)

`capital-aperture-00102-vax` / marker `0a7b191-uat-f9c83e1b` serves 100%.
An end-to-end workflow walk found that **no paper ticket could be prepared on
any candidate in any run older than about a day**: reference market facts carry
a one-day TTL, `getFacts` filters expired rows, and nothing outside a full
re-underwrite rewrites them, so the liquidity gate reported "no 30-day ADV fact"
even though a healthy value (PWR $743M) was stored and merely aged out.
The preflight now refreshes the exact exposure symbol on demand and still
refuses on a failed, empty or unknown provider result. Verified on the deployed
revision: the refused preflight now reads "Next guarded action: Acknowledge
paper-only", and the stored fact is a genuinely re-fetched $722,942,208.
`DATABASE_URL= pnpm test:unit`: 2,067 passed / 0 failed / 8 skips.

Route sweep found no dead ends across Today, Play Desk, CandidateBoard, the
evidence view, ticket preflight, Research, Portfolio, Theses and the objective
Mission flow. Proposal, approval and submission remain separate human-confirmed
steps and were deliberately not exercised — the operator's own paper run is
still the acceptance event.

## September 10 — decision prominence increment (supersedes the release snapshot below)

`capital-aperture-00099-buj` / release marker `918db8d-uat-6cbcc3fb` **now serves
100% of production traffic**, promoted on explicit operator instruction after the
desktop pass. `capital-aperture-00096-fuh` is retained for rollback.
The revision fixes the three presentation problems observed on `00098-xuc`:
repeated account chrome above the decision, a utilization percentage sitting
beside "blocked" without reconciling them, and a restated no-trade consequence.

Measured on Today at 1379 CSS px: header 2 paragraph blocks → 1, header height
119px → 95px, primary decision action 673px → 652px, no horizontal overflow.
The blocked-constraint explanation now renders while the rail is expanded, which
is the exact state where it previously disappeared.

`DATABASE_URL= pnpm test:unit`: 2,061 passed / 0 failed / 8 existing skips across
175 files. Type check and client/server builds passed. Desktop regression checks
confirmed the inline finding review (Save review still disabled), the inline gate
review, and Mission opening to its saved result. No order, approval, review save,
monitoring refresh or evidence answer was invoked.

**Deployed narrow-viewport acceptance now passes at a measured 402 CSS px**
(not 390 — Chrome floors the window width and this profile runs ~80% page zoom;
the number is recorded as measured). The earlier failure was a stale window whose
`window.outerWidth` reads 0; a fresh MCP window resizes normally. Today, the inline
finding review (Save review still disabled), the inline gate review and Mission all
render with no horizontal overflow. **One item is explicitly not closed:** the
primary decision action sits at y=724 against a 707px viewport — 17px below the
fold. The header repair cut 119px to 87px but the dominant consumers are 220px of
page chrome and a 132px status notice, outside this increment. Physical-device and
screen-reader acceptance remain separate and unproven. Every other row of this matrix
— verified gains, allocation/proposal integration, sourced retrieval, market-open
lifecycle and accessibility — remains open and is not narrowed by this increment.
See `CAPITAL_APERTURE_REVIEW_HANDOFF_2026-09-10.md` for the full evidence.

## September 10 — latest UI release status (supersedes earlier release snapshots)

Revision `capital-aperture-00096-fuh` / `7b5095a` serves 100% production traffic
(Cloud Run traffic rechecked September 10, approximately 05:06 ET).
Public health returned JSON and the matching release marker. Fresh authenticated
Chrome Today → exact DKNG finding passed; an older tab failed to navigate, with
cause still unverified. Context loading now waits honestly rather than asserting
a missing finding before dependent records arrive. No broker or review action
was performed in that check.

Evidence formatting source `f3eeb7f`, production-compatible branch `7b5095a`,
passed 1,345 release unit tests (six existing skips) and isolated exact-finding
navigation. Full account/order/check/explicit-review fixture hash stayed unchanged.
Renderer screenshots show formatted paragraphs and emphasis, retained numbered
sources, no embedded media, and unavailable unsafe links. Narrow-screen measured
width was 433 CSS pixels at current zoom, not the requested 390; exact 390-pixel
acceptance was subsequently verified on production at measured 390×844; physical
device acceptance remains open. Cloud Build
`d03597cd-a867-4775-b797-117b803a15e9` completed successfully and revision 96 was
promoted. These later production results supersede the earlier renderer viewport
qualification only for the sampled production handoff.
See `CAPITAL_APERTURE_REVIEW_HANDOFF_2026-09-10.md` for the detailed evidence.

These are UI acceptance increments only. The original Strategist/gains,
allocation/proposal integration, revision, sourced retrieval, market-open
lifecycle and accessibility requirements below remain authoritative and open.

## September 10 — public discovery action through persisted no-trade result

The isolated integration suite now exercises `selectDiscovery` through the real
router, source-bound child creation, leased underwriting execution and persisted
result readback. Only market analysis is a deterministic, explicitly illustrative
no-setup fixture passed through the actual quantitative engine. The selected
projection remains non-canonical and the original capital/loss inputs reach the
engine unchanged. A second caller reads the completed result without writes;
repeating the selection reuses the same selection and underwriting revision,
without another analysis call. Canonical/account records, research, candidates,
orders and allocation claims remain unchanged.

Evidence: `/tmp/capital-isolated-integration.AuiVc3/summary.json`: 222 passed,
zero failed, two external-URL skips; owned disposable DB/user cleanup confirmed.
Typecheck passed. This is API/persistence journey coverage, not browser coverage,
live market proof or positive-play/evidence/verified-gains acceptance. No new
deployment or production migration occurred in this increment.

### Positive source-bound research handoff — API/persistence verified

The same real-router journey now also generates one explicitly illustrative
conditional DATA play, records its selection, and starts the real research
orchestrator. Only macro/provider research and underwriting market inputs are
fixture replacements; each provider seam throws unless explicitly authorized
by that test. The swarm receives exactly DATA. The orchestrator completes and
persists one DATA candidate with the selected discovery's capital-source and
allocation-verification requirements intact. No canonical thesis, account,
order, evidence-review or allocation-claim row changes. Reading/replaying the
underwriting result still produces no duplicate analysis.

Latest receipt: `/tmp/capital-isolated-integration.HgziLr/summary.json`:
223 passed, zero failed, two external-URL skips. Typecheck and diff check pass;
owned disposable database/user cleanup confirmed. This is now positive API
handoff coverage, but not a browser test, actual provider-quality validation,
completed evidence answers or verified-gains allocation. No production release
or schema migration is claimed.

## September 10, 04:12–04:20 ET — connected exact-finding UAT

A separate illustrative owner (144), manual paper account (52), run (27),
candidate (20), recorded order (26) and two checks (1/2) were added to the exact
loopback browser-UAT database. These are frozen UI records, not provider or broker
execution evidence. The seed is idempotent and never changes existing fixture
work. The explicit wrong-host test refused before opening a database connection.

The current working backend failed on its expected-but-unapplied `context_kind`
schema. No migration was applied to conceal this. The connected UI retest instead
used production baseline 070d04c plus the five-file review/navigation fix. Its
files matched release worktree `a42b16bd8ae474ea4af849c14b5200b3aaa69821`
exactly (excluding dependencies/git/build output). This release branch is pushed.
It does not contain the pending Strategist backend or migrations.

At localhost:3112, Today’s primary action opened:
`/aperture/run/27/execute?candidate=20&lifecycle=monitoring&order=26&finding=2&findingVersion=v1-758ed8f1`.
Desktop click and 390×844 Enter activation both selected and focused the catalyst
finding, expanded its evidence, retained the other check and kept Save review
disabled. Example-domain evidence was correctly unverified; partial coverage was
not an all-clear. No assessment or sourced check was requested.

Before/after the mobile repeat, full account/order/check rows plus explicit
review receipts had the same SHA-256:
`139549688b93d6d5d840e69dea8dfccd87126734d53e50700fcdb96ad1310c26`.
Counts remained one order, two checks and zero reviews. Seen is intentionally
excluded; this is not a zero-write claim. Temporary viewport override was reset.
Screenshots in the earlier `routing-2026-09-10` evidence directory:
`exact-finding-desktop.png`, `exact-today-mobile.png`, `exact-finding-mobile.png`.

The production-compatible package passed 1,341 unit tests, zero failed, six
existing skips (`/tmp/aperture-ui-review-release-unit.json`). Current workspace
type checking also passed. Cloud Build
`050676f1-318a-4e0e-827d-1035bb6800b5` was started from the clean release worktree;
at this checkpoint it was WORKING, with no traffic change. Production promotion
and signed-in verification must be recorded separately. Full original scope,
including the gains/claim/revision path, remains unfinished.

## September 10, 04:06–04:10 ET — Today routing consistency (local only)

Source checkpoint `7d38fbc994b0c43a9a0f50233c1c0f2d42ae0b48` pushed to
origin/main. Not deployed; larger uncommitted work remains separate.

Today now passes attention destinations to the existing Wouter router, as Play
Desk already does, instead of requiring a full-page location assignment. A new
test exercises DailyPlayList's actual briefing callback and verifies exact
run/candidate/order/finding/version preservation, one navigation, no reload and
no mutation. It failed before the change and passes afterward. The browser's
suppression of the original production full-page assignment is not diagnosed;
this is a routing-consistency fix, not a claim about extension internals.

The existing isolated server on localhost:3110 rendered the change through Vite.
Using its labeled illustrative account, Today → Resume mission setup opened the
saved Review decision section with the existing $25,000 capital, $249 entered
ceiling and $187.50 effective allowance intact. Desktop pointer activation and
390×844 Enter activation both worked. The mobile primary action occupied roughly
44 CSS pixels at y=513–557, within the first viewport. No inputs were edited or
conditional review submitted; ordinary Seen state is not claimed unchanged.
Temporary viewport override was reset. This fixture has no exact monitoring
finding, so the affected Today → selected-finding browser retest remains open.

Evidence directory:
`/Users/lenoxparis/.codex/visualizations/2026/08/25/01a0392e-5a5e-73c2-9f5e-675f1dc136d9/routing-2026-09-10/`
contains `today-desktop.png`, `today-mobile.png`, `mission-mobile.png`.
The source test is not a substitute for that missing connected fixture.

Verification: 1,959 unit tests pass, zero fail, eight existing explicit skips;
type checking and whitespace validation pass. Unit receipt:
`/tmp/aperture-today-routing-unit.json`. No production deployment, broker action,
or full stakeholder-readiness claim. Existing gaps elsewhere in this matrix
remain part of the objective.

## September 10, 04:00–04:06 ET — signed-in regression and hydration fix

The existing authenticated production Chrome session was available. Mission
opened directly on its saved no-trade result with the plan compact and editable;
suggestions no longer interrupted that completed-result path. This is a sampled
desktop observation, not a fresh mobile or new-Mission acceptance pass.

Play Desk's primary DKNG action navigated to run 360001, candidate 240003,
order 2, finding 120001, version v1-951cb173, and focused that exact finding after
hydration. No assessment, monitoring refresh, proposal or broker action was
invoked. Ordinary visibility can record Seen; this is not a zero-write claim.

Two gaps were observed:

- **Open blocker:** Today's primary review button repeatedly remained on Today,
  although workspace navigation and the Desk's equivalent action worked. The
  root cause is not established. Do not claim a speculative routing fix or a
  complete Today-to-review journey.
- **Locally repaired, not deployed:** before the candidate/order queries settled,
  Monitoring briefly reported an unmatched finding and an empty checks list.
  A disabled dependent query was mistaken for a settled empty result. The parent
  now passes loading/failure state; missing context waits explicitly, failures
  provide a retry, and retained evidence stays visible without permitting new
  checks on unconfirmed context. Actual settled identity mismatches still fail
  closed. A regression rendered the original false-missing/empty messages before
  the fix; 14 targeted monitoring tests and full type checking pass afterward.

Full unit receipt: `/tmp/aperture-monitoring-hydration-unit.json`: 1,958 passed,
zero failed, eight existing explicit skips. Client/server build passed with the
existing large-chunk and Node deprecation warnings. No production
deployment, schema change, physical-device check, screen-reader acceptance, or
market-open lifecycle success occurred in this pass. Full scope remains open,
including verified gains availability, allocation claims, revisions and connected
desktop/mobile UAT. Current time is premarket, not the missed market-close target.

## September 10 — closing-fill reconciliation (local only)

Saved execution reads now reconcile symbol, closing side, cumulative quantity,
remaining quantity, chronological sequence and explicit option multiplier against
the selected order. Exact decimal arithmetic produces gross proceeds without
per-fill cent rounding. Partial fills remain partial; empty, incomplete or
conflicting execution records return no proceeds amount. This does not establish
net proceeds, cost basis, settlement or available capital. The gains panel labels
the subtotal before fees and never upgrades the source to verified gains.

Twelve arithmetic/identity tests and the panel distinction test were added.
Unit receipt `/tmp/aperture-gross-reconciliation-unit.json`: 1,955 passed,
zero failed, eight explicit skips. Disposable DB receipt
`/tmp/capital-isolated-integration.t3CU4r/summary.json`: 221 passed,
zero failed, two external-URL skips. Current order schema has no explicit
opening-lot attribution for a closing order; this must be sourced rather than
inferred from matching symbols. Fee completeness, funds availability, reserve
application and source-bound proposal claims remain required.

Provider contract reviewed: https://docs.alpaca.markets/us/docs/account-activities.
The fill contract is not independent proof of cost basis or spendable proceeds.

## September 10 — source-order entry (local only)

Objective setup now includes secondary, expandable gains-source selection.
The server lists owned Alpaca Paper closing sell orders with exact account,
run, candidate and order identity; keyset pagination preserves older sources.
The picker requires an explicit Use this source confirmation. It changes the
draft account/source/intent, retains capital, loss and other declarations, and
requires saving/review before analysis. It does not invent an active thesis,
ingest executions, verify gains or create an order. Failed/loading source reads
cannot apply a choice; previous draft values remain intact.

Isolated DB receipt `/tmp/capital-isolated-integration.Vu3Z6j/summary.json`:
221 passed, zero failed, two external-URL skips. Includes owned-source lookup,
opening-order exclusion and 52-source pagination without duplication; no live
provider calls or production/browser-database mutations. The connected fixture
was extended for the new read endpoint; no production endpoint is mocked by
the application. Full reconciliation and rendered desktop/mobile UAT remain open.

## September 10 — execution evidence in gains setup (local only)

The account/risk section now presents saved executions for the exact selected
source order. Opening the section reads saved evidence only. A deliberate
paper-execution refresh is capability-gated, keeps the request identity after
an uncertain response, and requires status reconciliation before retrying.
Failed refreshes retain the prior count and timestamp. Pending means completion
unconfirmed, not a claim that a worker is still running. The adjacent source
order link offers inspection; no capital allocation or order action is invoked.

Interrupted refresh recovery is now explicit: the operator can discard the exact
pending attempt. Its failed/abandoned receipt remains auditable, a late provider
reply cannot replace it, and a new explicit attempt is allowed. Discarding does
not cancel network I/O or a broker order. Concurrent new request IDs are blocked
while a pending attempt exists. Reads and repeated discard calls are idempotent;
completed evidence cannot be discarded. The isolated regression first failed
without this path, then passed with owner/identity/late-response tests.
Receipt: `/tmp/capital-isolated-integration.4tIvKP/summary.json` — 219 passed,
zero failed, two external-URL skips; owned disposable resources removed.

The panel says **Gains not verified** and names cost basis, fees and available
proceeds as missing reconciliation. It does not turn fills into spendable profit.
Nine controller tests and 79 adjacent Mission tests passed. These are
deterministic interaction tests, not rendered desktop/mobile or stakeholder UAT.
The full source reconciliation, connected
isolated fixtures and release remain unfinished. No production changes.

## September 10 — persisted execution refresh (local follow-up)

`aperture.strategy.refreshExecutionEvidence` now records an exact owned closing
order refresh before provider work and finalizes that attempt once. Reusing a
request observes its saved pending/complete/failed attempt instead of issuing
another broker query. Provider reads run outside database transactions. The
read-only `executionEvidence` query retains the last successful snapshot when
a later attempt fails. Account/order identity, observation time, receipt shape
and canonical hashes are checked; malformed or self-asserted gain proof is not
persisted as successful evidence. Provider errors are sanitized.

Migration `0069_aperture_execution_evidence.sql` adds evidence attempts only.
It is not applied to production or the browser database. No existing order,
account balance, capital claim, approval, or submission record is changed.
The production refresh is guarded by the existing discovery feature gate;
isolated UI refresh requires a dedicated fixture rather than live provider calls.

The final disposable DB pass has 217 passing tests, 2 external-URL skips,
including ownership mismatch, simultaneous retry, tamper rejection and failed
refresh preservation. Actual 0069 migration SQL also passed against owned
shadow tables, preserving existing rows and enforcing request uniqueness.
Receipts: `/tmp/capital-isolated-integration.ba7n7Q/summary.json` and
`/tmp/aperture-persisted-executions-unit.json`. Type-check and server build passed.

Visible refresh/status controls are now connected locally (above). Still required: connected browser fixtures;
cost-basis attribution, fee completeness, settlement/availability, reserves and
proposal claims. A complete execution query alone remains insufficient for
verified gains. No shareable stakeholder-ready release is claimed.

## September 10 — individual execution reader (local follow-up)

The Alpaca Paper adapter now exposes a deliberate, read-only execution query
for an exact broker order and expected external paper account. It verifies the
account before and after pagination, preserves decimal prices/quantities,
rejects overlapping/wrong-order IDs and malformed/future evidence, and refuses
to call bounded/truncated or failed pagination complete. An empty execution
query is not a filled-order or proceeds claim. The transport uses only the
paper account-activities GET endpoint; no live credentials were exercised.

Provider contract verified against:
[Account Activities](https://docs.alpaca.markets/us/docs/account-activities) and
[Retrieve Account Activities](https://docs.alpaca.markets/us/reference/getaccountactivities-2).
Execution coverage does not establish attributed cost basis, complete fees,
settlement or available funds. Those flags remain explicitly false.

Verification: the full unit receipt is
`/tmp/aperture-execution-evidence-unit.json`; the new execution tests include
the actual adapter's URL/query/method boundary with mocked HTTP. Type-check and
server build passed. This is deterministic development evidence, not a live
provider probe or completed browser UAT.

Still required: durable versioned execution ingestion/correction lineage,
attributed lots and fee completeness, availability reconciliation, event-bound
reserve policy and proposal claim integration. The reader is not yet wired to
a user-facing sync action or claimed as verified-gains ingestion. No automatic
Today/status reads invoke it. No production migration, broker call or release.

## September 10 — declared source registration (local follow-up)

The deliberate discovery selection now atomically registers one capital event
for its accepted excess-capital declaration and retains that event identity in
the child receipt. It reuses the existing account-locked ledger and original
declaration identity, not a new source per hypothesis/request. The event remains
operator-declared; available cash is still unknown and no allocation claim,
proposal, approval, or order is created. Gains and other non-declaration intents
do not use this adapter. Registration happens on authorized selection, not on
Mission/status reads or ordinary draft acceptance.

Verification: 206 isolated database tests pass with 2 external-URL skips,
including conflicting amount rejection and rollback after an injected final
selection-write failure. Receipt:
`/tmp/capital-isolated-integration.YEHcos/summary.json`. The disposable database
and user were removed by their owning harness. Type-check passed. Full unit
results are in `/tmp/aperture-declared-source-unit.json`.

Still required: independently reconciled gains/available-funds ingestion,
transactional proposal claims and lifecycle reconciliation, reviewed source
revisions, and connected authenticated browser UAT. Source registration alone
does not establish allocation eligibility. No production migration or deployment.

## September 10 — selected discovery handoff (local, not released)

This checkpoint supersedes the earlier statement that no selection handoff
exists. It does **not** establish full end-to-end stakeholder readiness.

Selection now records a source-bound tactical projection and child Decision Run,
with a distinct `discovery` context and no canonical-thesis identity. The source
Mission and active thesis remain unchanged. Source/owner/job/attempt checks,
immutable JSON hashes and a transaction prevent substituted or duplicate
selections. Re-entry opens the child's current saved task, not a new mission.

The deliberate **Underwrite this lead** action continues into the existing
leased Underwriter. Queries never start analysis. Expired or unsupported leads
cannot advance; historical records remain inspectable. The research worker
retains the selected symbol and carries source requirements, contradictions,
invalidation and capital-source uncertainty into the candidate evidence fields.
It does not recompile or promote the tactical projection into a canonical thesis.

**Still blocked by design, pending implementation:** new opening paper actions
for discovery contexts require capital-source/allocated-envelope proof and
transactional claim integration. Selection is not allocation. Hypothetical
gains must not become verified cash. Accepted source-Mission revision support
also remains incomplete: a changed Underwriter objective cannot silently
replace the source assumptions. These are required remaining features, not
waivers or a revised definition of done.

Development evidence now includes 1,898 unit tests (0 failed, 8 existing
skips), type-checking, and 204 disposable-database tests (0 failed,
2 external-URL skips). Evidence: `/tmp/aperture-discovery-resume-unit.json`
and `/tmp/capital-isolated-integration.S4QMth/summary.json`. The extra
current-child-revision resume case passes. Copying MariaDB text JSON into a
new revision had double-encoded the context; the shared revision-copy boundary
now decodes once and rejects malformed or already double-encoded fields. The
router's conditional-provider receipt and resume fixture use that same boundary.
Six focused regressions cover decoded/text driver values and all four JSON
fields. The prior ledger test timeout did not recur; no timeout was increased.
Both server and client builds passed; the existing client chunk-size warning
remains. This is not a performance or browser-UAT acceptance claim.
Actual 0065–0068 SQL was exercised on owned disposable shadow tables, including
old-row preservation and selection uniqueness. Neither production nor the
separate browser database was migrated. A changed job-token regression was
caught and fixed before the successful database repeat.

Chrome became accessible on this turn. A signed-in **read-only desktop** check
of the existing production Today page confirmed PW active-thesis identity,
separate NVDA portfolio constraint, stale/unresolved DKNG finding, other critical
issues, accepted-but-unfilled orders, and on-demand monitoring language. A
desktop screenshot was inspected. The extension tab read timed out; native
Chrome accessibility worked. This is not testing the new local discovery flow,
mobile layout, keyboard/enlarged-text behavior or real-provider correctness.
No broker action, acknowledgement, source check, deployment or production
traffic change was performed. The previous Mac-lock blocker is no longer the
current browser-access condition.

Next: complete reviewed source assumptions and capital-envelope handoff, add
deterministic connected browser fixtures, run the selected-lead → Underwriter →
exact evidence journey and approval/submission invariants, then complete
responsive/authenticated release UAT. THI-266 and the full goal remain open.

## September 10 — connected objective UI checkpoint

**Source only, default off, not deployed.** Mission now exposes deliberate
objective entry when server capability is confirmed, resumes persisted drafts,
and opens exact accepted discovery receipts. Original inputs survive conflicts
and uncertain-start recovery; retries retain the original request/version/job.
Completed research remains readable while availability is loading or disabled.
An explicit refresh rechecks availability without starting research. Stale risk
previews block authorization, including callbacks captured before expiry.

Result summaries distinguish unverified research leads from trade plays, keep
rejected hypotheses and source records accessible, and do not offer an
unimplemented evidence handoff. Today/Desk share exact discovery-state links;
failed receipt reads produce partial status rather than a false all-clear.
No new homepage or broker/risk authority was introduced.

| Final verification | Result | Receipt |
| --- | --- | --- |
| Full unit lane | 1,787 passed, 0 failed, 8 existing explicit skips | `/tmp/aperture-objective-connected-verified-unit.json` |
| Disposable database lane | 147 passed, 0 failed, 2 external-URL skips | `/tmp/capital-isolated-integration.FaMMZW/summary.json` |
| Existing-schema migration | Actual 0065/0066/0067 SQL applied to owned shadow tables; old receipts preserved | Included in the 147, not additional |
| Type check; client/server builds | Passed; existing large-chunk warning remains | No performance claim |
| Authenticated desktop/mobile | Not repeated; Mac locked | No new screenshots or user-tested usability claim |

The migration-test parser initially split a semicolon inside a SQL comment;
that test-only parsing error was fixed before the successful repeat. A failing
availability-refresh regression was also reproduced and corrected. The final
database harness removed only its disposable database/user and reported zero
browser-database mutations. Production migrations and feature flags remain
unchanged. The market-open UAT deadline was not met.

**Still required:** source-bound selection into existing Underwriter/evidence;
accepted-assumption revisions; verified gains ingestion and actual proposal
claim revalidation; deterministic connected browser fixtures; signed-in
responsive/keyboard/enlarged-text/screen-reader journeys and release review.
The goal remains open. Green development checks do not waive this work.

Checkpoint: September 9 evening. Production was last verified at `070d04c` / `capital-aperture-00092-yil` with 100% traffic; the UI-only follow-up was public health/version checked. Its local desktop/mobile interaction checks passed; the signed-in post-deployment repeat is pending because the Mac is locked. Separate Strategist safeguards and persistence work are not deployed. Later sections distinguish each local increment from this production checkpoint. The market has closed. No market-open submission success is claimed.

## Operator workflow

| Requirement | Evidence now | Remaining acceptance |
| --- | --- | --- |
| Simple result-first Mission and compact Desk | Authenticated desktop/mobile production screenshots in the refinement receipt; suggestions follow the result, one no-trade conclusion, compact critical rows | Human stakeholder usability acceptance; ten-second comprehension remains an unmeasured target |
| Persisted Start / Resume / Check in | Existing owner-scoped draft CAS/history, underwriting job and attention baseline tests; isolated multi-tab resume | Further independently authenticated device coverage; not a browser-only onboarding flag |
| Uncertain / quiet / critical states | Shared attention arbitration and deterministic journey tests; no false all-clear from failed or partial reads; critical issues survive filters | Additional real provider-failure and assistive-technology sessions |
| Evidence handoff / lifecycle | Existing selected-play and exact monitoring identity paths, independent review/approval/submission boundaries | Bounded market-open paper lifecycle repeat with fresh evidence; no forced trade if gates fail |
| Mobile / keyboard | Local first-focus skip link reaches one named main; account rail retained; refresh focus preserved; ten opaque text/surface contrast pairs checked. Sept 10 revision 99: signed-in deployed pass at a measured 402 CSS px — Today, inline finding review, inline gate review and Mission, all with no horizontal overflow | **The primary decision action is still 17px below the fold at 402px**, and the account label still appears twice in view. Plus physical-device, screen reader, full keyboard-only setup-to-evidence, enlarged text, reduced-motion and zoom coverage; these checks are not WCAG certification |
| Revision / no-trade history | Existing immutable decision and underwriting revisions, explicit before/after review | Continue checking disposition-specific copy; old orders and approvals must remain unchanged |

## Capital Strategist acceptance table

The following tests cover deterministic decisions or adapter boundaries. A green helper test is not a completed UI/API/persistence journey.

| Original scenario | Verified increment | Missing end-to-end work |
| --- | --- | --- |
| Excess capital, no saved thesis | Existing draft store and default-off acceptance API preserve an objective with null thesis identity; authenticated exact receipt/resume, concurrency and ownership tests pass | User-facing entry, sourced discovery and explicit selected-opportunity handoff |
| Realized-gain fixture | Helper computes only the selected $1,200 after basis and reserve | Authoritative executions, attributed lots, fees, reconciliation and availability ingestion; UI source selection |
| Unrealized / unreconciled gains | Helper rejects deployment; new read adapter keeps unknown amounts null and never promotes position marks to gains | Persist proof and show exact source uncertainty in the user journey |
| Duplicate event / concurrent proposal | New internal event/claim ledger proves unique event identity and serialized claims on separate DB connections; missing history stays unknown | Authoritative source ingestion and integration/revalidation inside the actual proposal transaction; service concurrency tests are not end-to-end proposal proof |
| Fixed-fee supplier | Existing causal guard rejects invented usage-driven uplift | Provider adapter and reviewed economic claim lineage |
| Technology, permission unverified | Conditional research result, not verified catalyst | Sourced retrieval and user-visible path |
| Already launched capability | Historical baseline and cutoff tests | Persisted provider receipts and simulated-time replay |
| Odds without activity | No inferred handle/customers/revenue | Licensed data and bounded securities-oriented discovery |
| Repeated announcement articles | Origin identity deduplication; parser binds citations to a supplied provenance manifest | Retrieval adapter must actually establish origin identity; a model cannot declare it verified |
| No qualified candidate | Retain-capital explanation and review condition | Persisted comparison/result UI with no forced allocation |
| Data / classifier failure | Explicit uncertainty, null confidence, rejected hypotheses preserved | Live retrieval recovery, durable job/retry and source-receipt persistence |
| Chosen opportunity | Existing Underwriter/evidence lifecycle is human gated | Persist exact discovery selection into that existing path; no placeholder canonical identity |

## New boundary adapters (local, not exposed as released capabilities)

- `realizedGainSource.ts` reads exact owner/account/run/candidate/order identity. It emits no verified gain source with today's schema. Closing executions, attributed basis, fees, reconciliation, availability, reserve policy and allocation ledger are explicit gaps. An unavailable read is not zero profit or available cash.
- `strategyDiscovery.ts` accepts strict structured output and an independently supplied provider provenance manifest. It preserves source cutoffs, originating signals, rejected hypotheses and null unsupported confidence. It invokes no provider, persists nothing, reserves no capital and creates no order. Schema/citation validity is not economic fact verification.
- The existing Strategist comparison now requires an independent exact candidate/security/evidence-path/underwriting-result/play binding receipt. Model or browser assertions are not authorized receipt producers. Blank IDs, unreviewed securities, mismatched lineage and stale receipts refuse promotion. Invalid proceeds/basis retain null arithmetic instead of manufacturing profit. Receipt producers remain integration work.

Earlier boundary-adapter checkpoint: 1,475 unit tests passed, zero failed, six existing skips; 72 isolated integration tests passed, zero failed, two external-URL skips. Type checking and client/server builds passed. The integration harness removed only its disposable test database/user and left production and browser-fixture records untouched. Four persisted journey tests also passed earlier in this follow-up. Later results supersede these counts, not the remaining acceptance requirements.

## Release and evidence boundaries

1. The existing paper-only execution, approval and submission gates remain authoritative. None of this audit authorizes new broker activity.
2. Personalized allocation recommendations require the qualified advisory/disclosure/recordkeeping/data-license review specified in the original brief. No such completed review is recorded here.
3. Scheduled discovery requires explicit enable/pause controls, bounded cadence/budgets, real jobs and deduplication. It is not implemented by showing a next-review time.
4. Recommendation frequency, illustrative successful scenarios and narrative backtests are not evidence of positive expectancy. Preserve rejected hypotheses and evaluate against information available at the decision time.
5. The goal remains open while original required work is unfinished. The completed presentation subset is not a substitute for this matrix.

## Reconciled next implementation seam

At the boundary-adapter checkpoint, accepted Decision Runs required canonical and Capital-thesis bindings. The acceptance increment below now supplies an explicit discriminated objective context. It does not invent a thesis ID or bypass `runway.startResearch`. The following was the reconciled implementation plan; discovery and selected-opportunity handoff remain unfinished.

- Extend the existing persisted draft with backward-compatible intent/search-scope fields and keep version-conflict protection. Explicit null must not fall back to the user's active thesis.
- Add accepted Mission context discrimination, nullable thesis bindings only in that branch, and owner/request uniqueness through a reviewed additive migration. Reuse immutable revision snapshots and leased underwriting jobs; do not create a second job authority.
- Update canonical-thesis inner joins in attention/receipt queries so intent Missions remain visible. Keep old canonical receipts readable and unchanged.
- Persist sourced discovery receipts, rejected hypotheses, exact selection lineage, and the independently underwritten comparison. A selected research lead is not yet a qualified investment.
- On deliberate validation, materialize a genuine tactical research context with evidence requirements/invalidation and `sourceCompilationId: null`, linked to the exact accepted Mission/underwriting/selection. Do not call `thesis.createCapital`, change the active canonical thesis, or treat this context as a legacy record awaiting canonical promotion.
- Keep the new capability server-enforced and default off until schema, authorization, isolated journeys, and the specified release review are satisfied. This is the remaining implementation plan, not implemented behavior.

## September 9 late follow-up — persisted objective and ledger foundation

**Local implementation, not deployed.** The public release remains the UI-only
checkpoint above. The Mac was still locked at the latest browser attempt; no
new authenticated screenshots or market-open submission are claimed.

### Implemented boundaries

- `shared/apertureMissionDraft.ts` and `missionDraftRouter.ts` extend the existing
  strict JSON draft, authenticated owner scope, CAS and immutable draft history.
  Canonical identity remains null when absent. The existing mission/capital
  fields retain the question and raw declared amount; no duplicate target or
  verified-cash authority is introduced. Exact source order/account/run/candidate
  references are authorized, but are never treated as realized gains.
- An older client cannot erase the new context on autosave. Explicit replacement
  preserves history. An unrelated accepted canonical receipt cannot complete an
  objective-led draft. This does not yet implement accepted intent receipts.
- `DecisionRunway.tsx` preserves unsupported objective drafts instead of asking
  for a manufactured thesis. It shows that discovery is unavailable, retains
  saved inputs and exposes cached-success-to-failed-refresh recovery. Independent
  review found the initially hidden refresh error; its new failing test was
  reproduced and then passed after the fix. This compatibility notice is not the
  completed entry/discovery UI and has not been browser-validated.
- `capitalLedger.ts` adds server-only transaction-scoped event registration,
  claims, explicit claim transitions and complete exact-source ledger reads.
  Owner/account locks and unique source/event/allocation identities serialize
  retries and competing claims. Claims count pending, committed and consumed
  amounts; only explicit release restores the declared envelope. Read failure
  or a missing event never becomes checked-empty proof.
- Only operator-declared excess capital can be earmarked in this increment.
  Realized gains, returned principal and purported reconciled funds remain
  **unknown**, even when an amount is supplied. A complete receipt attests claim
  coverage, not source cash provenance. No broker order, approval, submission,
  monitoring check or account balance is written by the service.
- The proposed additive migration `drizzle/0065_aperture_capital_ledger.sql`
  defines `aperture_capital_events` and `aperture_capital_claims`; no backfill or
  alteration to existing order tables. The isolated lane generated these tables
  from the exported schema. The migration has **not** been applied to production
  or the browser fixture. No public ledger endpoint/ingestion producer is added.

### Verified results

| Lane | Result | Receipt |
| --- | --- | --- |
| Full local unit lane | 1,519 passed, 0 failed, 8 explicit skips | `/tmp/aperture-objective-ledger-final-unit.json` |
| Actual persisted Mission journeys | 6 passed, shuffled seed 630001 | Exact isolated browser-fixture DB; disposable owners only |
| Full disposable integration lane | 81 passed, 0 failed, 2 external-URL skips | `/tmp/capital-isolated-integration.K5zcSq/summary.json` |
| Type check and client/server builds | Passed | Existing large-bundle warning remains; not a performance pass |

The eight unit skips are the six persisted journeys executed separately plus
the explicitly gated Alpaca/FRED provider probes. The ledger DB file is excluded
from unit collection and refuses any target other than the scoped disposable
integration database; it does not silently skip there. All code hashes matched
the successful integration snapshot at final readback.

The initial ledger DB run failed in fixture setup because its disposable user
identifier exceeded the existing 64-character limit. The fixture was shortened,
with an explicit length assertion; the application user schema was not widened.
Only the successful repeat establishes the nine ledger DB tests. Both disposable
databases/users were removed by the harness; production and browser records were
not changed by that lane.

### Still required, not waived

The acceptance increment below supersedes the missing accepted-Mission item.
Durable provider/discovery jobs and cited/rejected hypotheses; verified capital-source
ingestion; exact opportunity selection into existing underwriting/research;
proposal-transaction claim/revalidation; public release review; authenticated
desktop/mobile end-to-end UAT. The ledger cannot deduplicate real-world money
behind invented fresh source keys: its future producer must use the stable owned
origin/declaration record. It supplies current snapshots, not historical replay.

## September 9 late follow-up — accepted objective Mission

**Local, default off, not deployed.** This closes the accepted-assumptions seam,
not the full Strategist journey. `CAPITAL_OBJECTIVE_MISSIONS_ENABLED` must be
explicitly true on the server; the browser cannot enable it. No acceptance CTA
is exposed in this increment.

- `runway.acceptObjectiveDraft` uses the existing Mission/revision store. An
  objective head has null canonical and Capital-thesis IDs; an optional owned
  saved thesis is only an explicit context anchor. No active thesis is invented,
  selected or replaced, and no research projection is manufactured.
- A transaction locks the owner's draft before reading its version. The exact
  request UUID has one owner-scoped head, one immutable first revision, and one
  atomic draft completion/history update. Identical retries return the original
  receipt, including after a newer draft exists. Version/request conflicts and
  history-write failures leave the attempted Mission unchanged.
- Exact reads, retries and claimed draft baselines validate the original draft
  history, fingerprint, account/request/anchor, calculations, pending-risk gate,
  research-only disposition and zero proposed risk. Corrupt or cross-kind
  receipts fail closed; they are never repaired by reading them. Legacy draft
  completion cannot accept an objective receipt. Source/anchor changes cannot
  silently reuse an old accepted baseline.
- The entered amount and loss limit remain declarations, not permission or cash
  verification. Available capital and permitted risk remain null. Even a filled
  owned closing order establishes a reference only: gains remain hypothetical.
  No allocation, underwriting job, provider call, evidence answer, approval or
  broker order is created by acceptance or ordinary status reads.
- Shared attention and exact receipt routes preserve the saved objective and
  say analysis is unavailable. They do not replace it with the active thesis,
  call the job complete, or suggest that underwriting can run through the old
  thesis-only path. The existing research/underwriting authority rejects an
  objective before job/provider work until the verified handoff is implemented.
  The compatibility view is not the finished guided entry experience.
- `drizzle/0066_aperture_objective_mission.sql` adds the context discriminator,
  owner/request uniqueness and nullable thesis/invalidation fields. Existing
  thesis receipts keep their identity and substantive invalidation requirement.
  Neither this migration nor 0065 has been applied to production or the browser
  fixture. The release must account for both even while the feature is off,
  because ordinary ORM queries read the new columns. Fresh-schema integration
  testing is not proof of the existing-database migration path.

### Acceptance-increment verification

| Lane | Result | Evidence |
| --- | --- | --- |
| Full unit lane | 1,590 passed, 0 failed, 8 explicit skips | `/tmp/aperture-objective-acceptance-verified-unit.json` |
| Disposable DB integration | 120 passed, 0 failed, 2 external-URL skips | `/tmp/capital-isolated-integration.qnYc7D/summary.json` |
| Persisted Mission journeys | All 6 passed; included in the 120, not additional | Same disposable integration run |
| Type check and client/server builds | Passed | Required Node runtime; existing large-bundle warning remains |
| Signed-in desktop/mobile | Not repeated in this increment | Mac remained locked; no new screenshots or user-tested usability claim |

Two independent agents inspected authority boundaries and added authenticated
database cases. Their review exposed legacy completion, insufficient retry
validation, baseline drift and disposition inconsistency; each is now covered
by a failing-closed regression. The final integration harness removed only its
own database/user and reported no browser database mutations. The eight unit
skips are the six DB journeys plus two opt-in external provider probes.

All 21 changed non-document source/configuration files matched the final
integration snapshot hashes. A silent local client-build attempt was stopped
after it stalled; the repeat with the required runtime path completed. This is
build verification, not a performance or browser usability pass.

Still required: the intent-entry UI; accepted-assumption revision UI/API;
durable provider-backed discovery and provenance/origin/cutoff receipts;
promoted and rejected hypotheses; independently verified source ingestion;
selected-opportunity lineage into existing underwriting/evidence; actual
proposal-transaction claim revalidation; migration/release review; and the
authenticated responsive, keyboard, enlarged-text and screen-reader journeys.
The exact objective `validatePlay` mutation path has not yet been exercised by
this new DB file; it remains guarded in source and needs explicit journey proof
with the handoff implementation. None of these open items is waived by the
acceptance service, green tests or an illustrative comparison.

## September 10 — persisted discovery increment (not deployed)

The existing accepted objective now has a server-gated path through bounded
research/classification into an immutable discovery receipt. Both
`CAPITAL_OBJECTIVE_MISSIONS_ENABLED` and `CAPITAL_STRATEGY_DISCOVERY_ENABLED`
must be true; the isolated browser runtime refuses a default live provider.
No route in this increment creates a canonical thesis, investment allocation,
Underwriter result, research candidate, evidence answer, approval or broker order.

- Reuses `aperture_underwriting_jobs`, its Mission lock, lease and attempt token.
  Reload/read does not launch work; repeats reuse completion, concurrent starts
  cannot duplicate provider work, and a failed job needs explicit identity-bound
  retry, limited to three attempts. Correctable prerequisites run inside the
  acceptance lock before completing the draft.
- The source adapter uses existing cited research and model abstractions. Broad
  no-thesis/no-symbol discovery permits proposed US security leads, not verified
  listing. Narrower thesis scopes require explicitly named securities. Scope and
  horizon cannot be expanded by model output; rejected out-of-horizon hypotheses
  remain recorded rather than invalidating a separate valid research lead.
- Stores bounded payload bytes, the server-built source manifest, current or
  historical evaluation cutoff, conditional/rejected hypotheses and exclusions.
  Missing lineage, dates, quality, permission and economics stay unknown. There
  is no independent verification adapter yet; the current provider output can
  support conditional research, not independently qualified allocation.
- Readback verifies owner/revision/job/attempt/token/time and content integrity,
  then re-runs the deterministic parser. Native JSON object-key reordering does
  not break the saved content hash. Corruption, missing receipts and failed
  classification fail closed. A second failure while recording status is
  sanitized and remains unresolved; it is not an all-clear or duplicate-start CTA.
- `ObjectiveMissionWorkspace` is a controlled three-section component, not yet
  mounted in the Mission flow. Its 36 callback/render tests cover no-thesis
  setup, saved-state acknowledgment, adjacent errors, declared capital, tighter
  server-returned risk, stale/failed preview, and no implicit actions. They do
  not establish actual browser, focus, keyboard, device or usability behavior.

### Verification for this increment

| Lane | Result | Evidence |
| --- | --- | --- |
| Full unit lane | 1,692 passed, 0 failed, 8 explicit skips | `/tmp/aperture-discovery-final-unit.json` |
| Disposable database lane | 144 passed, 0 failed, 2 external-URL skips | `/tmp/capital-isolated-integration.PbkqvG/summary.json` |
| New actual discovery persistence | 23 passed, included in 144 | Same isolated run; full unchanged collateral row comparisons |
| Actual 0065/0066 migration SQL | 1 passed, included in 144 | Mechanically renamed owned shadow tables, original SQL hashes checked |
| Existing persisted Mission journeys | All 6 passed, included in 144 | Same isolated run |
| Full type check and client/server builds | Passed | Required Node runtime; existing bundle/deprecation warnings retained |
| Live provider / signed-in responsive UAT | Not performed | No production/source accuracy or user-tested usability claim |

The migration test preserved legacy receipt values, history, defaults and
uniqueness through the actual old-to-new SQL. This is local MariaDB compatibility
evidence, not a production TiDB migration claim. New migration 0067 adds discovery
receipts; the disposable schema lane covers its ORM table and actual CRUD, not
execution of that SQL file against a production database. Migrations 0065–0067
remain unapplied to production and the separate browser fixture. The harness
verified removal of its own disposable DB/user; no browser DB changes occurred.

Review found and fixed invalid-input draft consumption, rejected-horizon
overblocking, raw database failure exposure, strict-provider input mismatch and
JSON content-hash instability. These are implementation checks, not proof that
the complete user journey is ready.

Remaining critical path: mount the guided entry and discovery-result disclosure,
carry one selected lead and its immutable source path into the existing
Underwriter/evidence task, persist explicit assumption revisions, connect actual
capital-source ingestion and proposal-transaction claims, then run isolated
desktop/mobile and authenticated release UAT. Shared attention still shows the
compatibility state until its exact discovery-result handoff is wired. No live
feature enablement, production build/promotion or market-open UAT occurred in
this increment. THI-266 remains In Progress.
