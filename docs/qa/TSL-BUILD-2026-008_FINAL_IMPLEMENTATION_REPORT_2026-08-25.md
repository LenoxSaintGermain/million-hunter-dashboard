# TSL-BUILD-2026-008 — Final Implementation and UAT Report

**Scope:** Stage 1 Capital Operator recovery and decision journey, followed by the bounded **WP-DIR1 Disclosure Intelligence Rail grammar and provenance foundation**.  
**Date:** 2026-08-25  
**Baseline synced from:** `origin/main` commit `590591f` via checkpoint `75ec0dc4`.

## Delivery Decision

The implementation follows the required decision model:

> **Orient → Choose one decision → Verify what matters → Stage on paper or decline → Record the outcome.**

No chat surface, copying mechanism, prediction language, broker execution shortcut, autonomous action, or outcome backfill was added. The disclosure rail is a **House Clerk evidence workflow**, not a ranking or trade-generation product.

| Deliverable | Result | Evidence |
|---|---|---|
| Stage 1 recovery | **Pass** | Owner-scoped, idempotent script; two recovered thesis pairs only |
| Capital Operator journey | **Pass** | Decision-first queue, compact context rail, explicit evidence consequence, saved-vs-new thesis separation |
| WP-DIR1 schema | **Pass** | Seven additive provenance tables present |
| WP-DIR1 grammar | **Pass** | Deterministic plan compiler, ambiguity blockers, immutable revisions, tighten-only controls |
| Source provenance | **Pass** | Frozen official House Clerk fixture, content-addressed raw-store seam, retrieval ledger and stable source ID |
| Broker boundary | **Pass** | Zero broker-order rows; no order procedure invoked |
| Prohibited-language review | **Pending named reviewer sign-off** | Lenox must explicitly sign off before later disclosure-product expansion |

## Stage 1 — Recovery Manifest and Scoped Write

The pre-write inventory is preserved in [`TSL-BUILD-2026-008_STAGE1_PREWRITE_RECOVERY_MANIFEST_2026-08-25.md`](./TSL-BUILD-2026-008_STAGE1_PREWRITE_RECOVERY_MANIFEST_2026-08-25.md). It found no surviving canonical thesis, Capital projection, run, candidate, fact, evidence, outcome, or broker-order record for either recovery target.

The approved recovery was performed only after source and ownership became unambiguous. The script [`scripts/recover-stage1-capital-theses.mjs`](../../scripts/recover-stage1-capital-theses.mjs) defaults to dry-run, hashes each source, uses owner-scoped idempotency checks, and maps the active Capital context to the **canonical compilation ID**, never a projection row.

| Thesis | Bound owner | Source basis | Recovery behavior |
|---|---:|---|---|
| `Jim Reference — Catalyst Reaction (Paper Trial)` | Lenox, `user_id=1` | Existing source-controlled catalyst trial artifact | Preserved source text; no run, fact, candidate, outcome, or broker history created |
| `GLP-1 Demand Shock: Food & Health Day-Trading Opportunities` | Jim Butler, `user_id=7470015` | User-supplied verbatim original raw text | Preserved exact raw text; no inferred facts, measurements, or history created |

The second invocation was idempotent: it created no duplicate canonical or Capital thesis record. The final database inspection found **exactly two** named recovered Capital thesis rows.

## Capital Operator Journey Refinement

The Stage 1 layout now makes the next decision visible before the broader research set. The first fold states active Capital context, Paper account freshness, mandate consequences, and current exposure constraints. Today’s queue contains the lead decision and two alternatives; the wider set remains intentionally available rather than silently discarded.

Evidence review changed from an acknowledgment to a source-contextual decision. Operators answer the current evidence question with explicit ready, follow-up, or decline consequences. Existing review rows were not backfilled. The enum expansion was additive in `0051_aperture_evidence_answer_states.sql`.

Saved thesis contexts have a separate `/aperture/theses` surface. Creating a new canonical thesis remains a deliberate exit to `/thesis`; saved contexts are owner-scoped and cannot alter another operator’s active context.

## WP-DIR1 — Disclosure Intelligence Rail

### Grammar and lifecycle

The rail adds `/aperture/disclosures` and the following lifecycle:

| Step | Behavior | Boundary |
|---|---|---|
| Describe | An operator writes one bounded monitoring request | No conversational agent or inferred instruction |
| Compile | `DisclosurePlanV1` identifies source, cadence, filer/issuer criteria, controls, and unresolved ambiguity | Prohibited copy/prediction language throws; ambiguity blocks approval |
| Save | A revision stores raw intent, compiled plan, compiler/version metadata, resolutions, and content hash | Revision history is immutable |
| Approve | Only a fully resolved revision may move a plan to `monitoring` | Explicit human approval required |
| Retrieve/replay | The fixture replay writes provenance and gates raw observations | No automatic schedule is enabled |
| Verify | Each observation remains held until the exact entity, asset type, lag, disclosed range, and timing gates pass | No midpoint or ticker is inferred |
| Promote | A reviewable observation may become **cited research evidence only** | Paper recipe readiness/preflight remains separate; no broker order exists |

### Mandate gates

`DISCLOSURE_MANDATE_V1` is versioned and stored with every match. It applies a maximum 45-day lag, a $15,001 disclosed-range floor, an observation cap, equity/ETF-only asset support, and exact entity resolution. A user may tighten but never loosen these controls. Explicit hold reasons include missing dates, excessive lag, unsupported asset, ambiguous or unresolved entity, and below-floor range.

`eligibleFrom` uses the official source timestamp where present, otherwise the first-observed timestamp. `assertOutcomeWindow()` rejects every outcome window that begins before `eligibleFrom`; no outcome analytics were implemented or backfilled in this package.

### Provenance foundation

The additive `0053_disclosure_intelligence_rail.sql` creates:

| Table | Purpose |
|---|---|
| `disclosure_plans` | Owner-scoped plan lifecycle |
| `disclosure_plan_revisions` | Immutable intent, compiled plan, controls, hashes, and resolutions |
| `disclosure_filings` | Stable official document identity and content hash |
| `disclosure_retrievals` | Every retrieval attempt, including repeat and source-change events |
| `disclosure_transactions` | Raw filing rows, range bounds, owner-as-stated, timing, and resolution state |
| `disclosure_matches` | Stored mandate gate snapshot and review/promotion state |
| `disclosure_entity_aliases` | Reviewable, revocable explicit alias mapping only |

The official fixture is derived from House Clerk document `20034401`, preserves the canonical URL, filer identity, filing/retrieval times, stated spouse ownership, raw asset text, and both range endpoints. `DisclosureDocumentStore` provides a content-addressed immutable storage seam; a duplicate raw document resolves to the same key rather than silently overwriting prior provenance.

## Migration Hygiene and Database Changes

Two duplicate numeric migration prefixes were eliminated by deterministic renames: `0024_sticky_scream.sql` became `0052_sticky_scream.sql`, and the earlier duplicate 0044 was previously moved to `0050_order_intent.sql`. `server/migrationPrefixes.test.ts` prevents recurrence.

All database changes were additive schema changes. No existing Capital outcome, alpha, thesis measurement, broker order, or unrelated-user data was modified.

| Database evidence at completion | Value |
|---|---:|
| WP-DIR1 tables present | 7 / 7 |
| Named recovered Capital thesis rows | 2 |
| `broker_orders` rows | 0 |
| `aperture_alpha` rows | 0 |
| Disclosure plans / filings / matches created during implementation | 0 / 0 / 0 |

## Two-Operator UAT and Visual Evidence

The full Stage 1 two-operator procedure and exact local-preview seam cleanup are recorded in [`TSL-BUILD-2026-008_STAGE1_VALIDATION_REPORT_2026-08-25.md`](./TSL-BUILD-2026-008_STAGE1_VALIDATION_REPORT_2026-08-25.md).

| Operator | Path tested | Result |
|---|---|---|
| Lenox / owner context | Capital Decision Center → Saved Theses | Recovered Catalyst Reaction appears as an owner-scoped saved context; active canonical handoff renders correctly |
| Jim Butler (`7470015`) | Isolated authenticated Capital Operator → Saved Theses | Only the recovered GLP-1 context appears; local preview identity seam was removed immediately afterward |

**Before/after capture summary:** the prior Capital surface was breadth-first with generic review acknowledgement. The after capture shows the compact rail, lead-decision hierarchy, explicit exposure consequence, and the new Disclosure Plans rail. The after capture also shows the new workflow’s first state: no plan exists until an operator explicitly compiles and saves one. Both capture routes were rendered through the managed preview during this validation.

## Validation Results

| Check | Result |
|---|---|
| `pnpm check` | Pass — no TypeScript errors |
| `DATABASE_URL= pnpm test` | Pass — 80 test files passed, 2 skipped; 727 tests passed, 4 skipped |
| WP-DIR1 focused tests | Pass — 8 / 8 including source store dedupe, ambiguity, tightening, range, hold, and look-ahead guards |
| Stage 1 focused evidence tests | Pass |
| Migration prefix registry | Pass |
| Preview screenshots | Disclosure Plans and Saved Theses routes rendered successfully |
| Local preview seam cleanup | Pass — `LOCAL_PREVIEW_OPENID` count is 0 in required locations |

## Explicit Broker-Order Statement

**No broker order was created, approved, submitted, rejected, modified, mirrored, or canceled by this implementation.** No broker adapter was called by WP-DIR1. The only read-only market/account context already present in Capital Aperture remained unchanged. The database ended with `broker_orders = 0`.

## Remaining Required Sign-off and Deliberate Non-Scope

Lenox is the named reviewer for prohibited disclosure-product language. The implementation blocks prohibited phrasing in the deterministic compiler, but the formal reviewer sign-off is still required before broader rollout.

The following remain deliberately out of scope: new paid data providers, a live recurring disclosure-refresh schedule, filer ranking, trade direction, return prediction, options/derivatives expansion, broker execution, autonomous order action, and outcome measurement before `eligibleFrom`.
