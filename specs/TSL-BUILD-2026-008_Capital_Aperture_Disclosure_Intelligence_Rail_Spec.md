# TSL-BUILD-2026-008 — Capital Aperture Disclosure Intelligence Rail

**Status:** PROPOSED — accelerated pre-30 pilot decisions recorded; implementation not authorized

**Primary surface:** Research OS

**App:** Signal Hunter OS / Capital Aperture

**Date:** 2026-08-25

**Decision owner:** Lenox

**Assumption:** Capital Aperture remains paper-only and human-approved.

> This document does not authorize implementation, a database migration, production activation, live trading, public release, or performance claims. Internal deterministic testing and a human-approved Alpaca Paper pilot are designed to begin before 30 closed trades. Thirty remains the first indicative evidence threshold, not an entry requirement for testing.

---

## 0. Decision

Build a bounded **Disclosure Intelligence Rail** that borrows Public Agents' workflow grammar:

**Describe → Normalize → Review → Monitor → Paper Stage → Learn**

Do not borrow Public's autonomous brokerage posture. The rail converts a human research intent into a visible, versioned monitoring plan; ingests primary-source public disclosures; preserves filing lag and ambiguity; and can promote a reviewed observation into Capital Aperture's existing paper-research path. It never creates, approves, submits, cancels, or closes an order by itself.

The product position is:

> Public Agents automates instructions inside a brokerage account. Capital Aperture underwrites whether a disclosure belongs in a thesis and whether a paper proposal clears evidence and risk gates.

---

## 1. Research review

### What the Manus recommendation gets right

1. **Borrow the workflow grammar, not the execution posture.** Public turns a natural-language request into a workflow the user reviews, approves, edits, pauses, and audits. That interaction model is useful even when Capital Aperture's terminal action remains a paper proposal.
2. **Treat congressional disclosures as delayed evidence, not live trade signals.** A Periodic Transaction Report may be filed after the transaction. The transaction date, filing date, first-publicly-observed time, and retrieval time must remain separate.
3. **Use primary sources and explicit entity resolution.** Raw asset names cannot silently become tickers. Ambiguous mappings, amendments, and duplicates must be held for review.
4. **Avoid “congressional alpha” and copy-trading claims.** A disclosure is evidence about a reported transaction. It is not proof of intent, informational advantage, conflict, expected return, or a recommendation.
5. **Keep initial scope narrow.** Equities and ETFs first; no options, multi-leg strategies, crypto, private assets, or live execution.

### Corrections required before implementation

1. **House PTR first, not “all congressional filings” at launch.** The first production adapter should target the official House Clerk disclosure surface. Senate ingestion is a later adapter with its own source and parser contract.
2. **No look-ahead through “lag adjustment.”** Backtests, rankings, and learning views may not treat a transaction as available on its transaction date. The earliest eligible observation time is the authoritative publication time when supplied; otherwise it is the system's conservative `firstObservedAt`.
3. **No committee score in the MVP.** Committee membership is contextual evidence only after a primary source can establish membership as of the relevant date. It must not imply conflict of interest and must not change a candidate score in this work package.
4. **No point estimate from a disclosed value range.** Filing amount ranges remain `{ min, max }`. They are never converted to a midpoint for position sizing, conviction, or return calculations.
5. **The Manus source package is now archived in this checkout.** `CAPITAL_APERTURE_PUBLIC_AGENTS_PATTERN_REPORT_2026-08-25.md` and `research/public_agents_primary_findings.md` provide the report and primary findings. The video referenced by Manus is [Public Agents: Automate Your Trading Strategy with AI](https://www.youtube.com/watch?v=o8pbbIqB2gg). Public's current prompting guide separately embeds [AI Agents for Investing | Public Agentic Brokerage](https://www.youtube.com/watch?v=2hS2eX4Cs0Y). Keep the two artifacts distinct in provenance. Every ingested House fixture still requires its own primary-source provenance before use.

### Current external basis

- `CAPITAL_APERTURE_PUBLIC_AGENTS_PATTERN_REPORT_2026-08-25.md`: archived Manus synthesis and cited implementation roadmap.
- `research/public_agents_primary_findings.md`: archived primary-source findings.
- [Referenced Public Agents video](https://www.youtube.com/watch?v=o8pbbIqB2gg): the video analyzed in the Manus report.
- [Public Agents prompting guide](https://public.com/ai-agents/how-it-works): natural-language intent, clarifying questions, compiled workflow, approval, edit, pause, and activity history.
- [Public Agents basics](https://help.public.com/en/articles/15435640-agents-the-basics): approved workflows are deterministic; the drafting conversation is not.
- [Public Agents terms](https://public.com/disclosures/agenticterms): active agents can continue transacting without per-transaction confirmation. Capital Aperture explicitly does not adopt this behavior.
- [House Clerk Financial Disclosure Reports](https://disclosures-clerk.house.gov/FinancialDisclosure): official public access to House financial disclosure reports.
- [House financial disclosure instructions](https://ethics.house.gov/sites/ethics.house.gov/files/documents/FDInstructionGuide_current.pdf): official PTR reporting context.
- [Alpaca paper-trading documentation](https://docs.alpaca.markets/us/v1.4.2/docs/paper-trading): paper fills are simulations and do not reproduce every live-market condition.

---

## 2. Product outcome

An operator can describe the public disclosures they want to monitor in plain English. Capital Aperture compiles that request into a typed research plan, flags assumptions, and requires explicit approval of the plan. A scheduled source adapter then retrieves official House PTR documents, stores immutable provenance, normalizes reported transactions, and applies deterministic eligibility gates.

Reviewable observations enter an evidence queue. A human may:

- promote an observation into an existing Capital Aperture thesis/run as cited evidence;
- set it aside with a recorded reason;
- request entity-resolution follow-up; or
- leave cash/no-trade as the decision.

Promotion creates no broker order. The existing paper proposal, preflight, typed `PAPER` acknowledgement, approval, and submit steps remain the only path toward Alpaca Paper.

---

## 3. Non-negotiable boundaries

1. **Paper-only remains structural.** Do not alter `assertPaperOnly()`, Alpaca's paper endpoint, or `liveTrading: false` behavior.
2. **No autonomous order path.** Compiling, approving, monitoring, pausing, refreshing, reviewing, or promoting a disclosure plan must not call `createOrder`, `approveOrder`, `submitOrder`, or a broker adapter.
3. **Plan approval is not trade approval.** Approving a disclosure plan authorizes scheduled research only. The UI and stored status must say this explicitly.
4. **Primary source or hold.** A transaction without an official source document, stable source identifier, source URL, retrieval timestamp, and content hash is not eligible for candidate promotion.
5. **Unknown fails closed.** Unknown publication time, transaction date, owner, transaction type, or asset mapping produces a named hold reason.
6. **No inferred motive.** Do not infer why a filer traded, whether the filer possessed material nonpublic information, or whether committee work caused the transaction.
7. **No score uplift in MVP.** A disclosure can become a cited evidence item and a decision-critical check. It cannot increase `compositeScore`, `confidenceScore`, expected return, or a claimed alpha measure in this work package.
8. **No live-per-click source retrieval.** The UI reads cached records. A cache miss schedules or requests a bounded refresh and returns a named pending state.
9. **No hardcoded fallback disclosures.** Empty source results render an honest empty state.
10. **Demo surfaces stay deterministic and zero-API.** Any walkthrough uses a versioned frozen capture with provenance and stale/unknown conditions preserved.

---

## 4. Deep module and seam

Create one deep module at `server/aperture/disclosureRail.ts`. Its interface is the test surface; parsers, source adapters, entity resolution, deduplication, lag calculation, and gate evaluation stay behind the seam.

```ts
export interface DisclosureIntelligenceRail {
  compileIntent(input: {
    userId: number;
    text: string;
  }): Promise<DisclosurePlanDraft>;

  refreshPlan(input: {
    userId: number;
    planId: number;
    asOf: number;
  }): Promise<DisclosureRefreshResult>;

  promoteObservation(input: {
    userId: number;
    observationId: number;
    thesisId: number;
  }): Promise<DisclosureCandidateSeed>;
}
```

### Interface invariants

- `compileIntent` returns a draft and confidence notes. It cannot start monitoring.
- `refreshPlan` runs only for a human-approved, non-paused research plan and is idempotent for the same source document hash and parser version.
- `promoteObservation` succeeds only for a reviewable observation with accepted entity resolution and all structural evidence gates passing.
- None of the three entry points touches `broker_orders` or a broker adapter.
- All failure modes return named, persisted reasons; no ambiguous input is silently defaulted.

### Internal seams and adapters

- `DisclosureSourcePort`: true-external source seam. Initial adapters are `HouseClerkDisclosureAdapter` and an in-memory fixture adapter. A Senate adapter is a later second production adapter.
- `DisclosureDocumentStore`: local-substitutable storage seam. MVP adapters are a content-addressed filesystem implementation and an in-memory test implementation. A future S3/GCS adapter may replace the filesystem implementation without changing the parser or rail interface.
- Entity resolution reuses the local `securities` identity table and SEC/EDGAR identifiers where available. Do not introduce a new external resolver until a second implementation is justified.
- Market context reuses the existing market-data provider seam. It is optional context, never source truth for the disclosed transaction.
- Candidate promotion returns a typed seed consumed by the existing Capital Aperture run/evidence modules. Do not create a second scoring, proposal, or order subsystem.

---

## 5. Compiled workflow grammar

The model may interpret language; it may not invent unstated operating limits. Missing limits remain explicit review items.

```ts
export interface DisclosurePlanV1 {
  version: "disclosure-plan-v1";
  objective: "monitor_primary_disclosures";
  sourceScope: {
    chambers: Array<"house">; // MVP
    filerIds?: string[];
  };
  assetScope: {
    supportedTypes: Array<"equity" | "etf">;
    symbols?: string[];
    issuers?: string[];
  };
  transactionScope: {
    types: Array<"purchase" | "sale" | "exchange">;
    amountRange?: { minUsd?: number; maxUsd?: number };
  };
  timing: {
    cadence?: "daily" | "weekly";
    maxPublicAgeDays?: number;
    maxDisclosureLagDays?: number;
  };
  thesisContext: {
    thesisId?: number;
    sectors?: string[];
    namedCatalysts?: string[];
  };
  outputMode: "research_only" | "paper_stage_eligible";
  confidenceNotes: string[];
}
```

### `DISCLOSURE_MANDATE_V1`

This is a research-hygiene mandate, not a trading mandate. It does not duplicate or weaken `MANDATE_V2`; every promoted candidate still passes through the existing trading gates.

```ts
export const DISCLOSURE_MANDATE_V1 = {
  version: "disclosure-v1",
  maxDisclosureLagDays: 45,
  minAmountRangeMinUsd: 15_001,
  maxObservationsPerPlanPerDay: 25,
  requiredAutoResolutionGrade: "exact",
  allowedAssetTypes: ["equity", "etf"],
} as const;
```

Rules:

- A plan may tighten these controls, never loosen them.
- A lower maximum lag, higher minimum range floor, lower daily observation cap, or narrower asset subset is tighter.
- The amount rule is a queue-volume filter, not a significance, conviction, or expected-return judgment.
- A disclosure beyond 45 days is retained and labeled late; it is held from automatic review eligibility rather than hidden.
- The daily cap is applied in deterministic source order. Overflow is persisted with a `daily_plan_cap_overflow` hold reason and shown in the activity/counts; it is never silently dropped.
- Every `disclosure_match` stamps `disclosureMandateVersion` and the effective controls used.
- No scoring weight, conviction threshold, order size, position size, or trading ceiling belongs in this mandate.

### Compiler rules

- No default filer, symbol, sector, cadence, or control outside `DISCLOSURE_MANDATE_V1` may be invented.
- A compiled plan must show the mandate defaults and identify every operator-supplied tightening rule.
- `paper_stage_eligible` must be explicitly requested and separately confirmed in the review screen.
- “Follow,” “copy,” “buy what they buy,” or equivalent wording is rejected with an explanation that the rail supports research monitoring, not copy trading.
- Unsupported asset classes are preserved as excluded scope, not coerced to equities.
- Every material ambiguity becomes a `confidenceNote` and blocks plan approval until resolved.
- The approved plan is immutable. Editing creates a new revision and preserves the prior revision in the audit history.

### Plan lifecycle

`draft → review → monitoring ↔ paused → archived`

Do not use `active` or `activated` in the interface; those words imply brokerage authority. `monitoring` means scheduled research only.

---

## 6. Source and normalized evidence model

Do not put raw disclosure rows directly into `security_facts`. Raw source truth can exist before a ticker is known, while `security_facts` is symbol-scoped. Store the source document and normalized transaction first; emit a verified security fact only after entity resolution passes.

### `disclosure_plans`

- identity, owner, current lifecycle status, current revision id
- `approvedAt`, `pausedAt`, `archivedAt`
- no broker/account credential fields

### `disclosure_plan_revisions`

- immutable `rawIntent`
- compiled `DisclosurePlanV1`
- compiler model/registry role, prompt version, compiled timestamp
- confidence notes and explicit operator resolutions
- content hash

### `disclosure_filings`

- source: `house_clerk`
- stable source document id and canonical URL
- filer id/name and chamber as stated by the source
- `filedAt`, `firstObservedAt`, `retrievedAt`
- content-addressed storage key, SHA-256, media type, byte size, parser version
- amendment/supersession relationship when stated

### `disclosure_retrievals`

- source id, retrieved timestamp, observed hash, retrieval result, and transport metadata
- same source id + same hash records a repeat retrieval without rewriting the stored document
- same source id + different hash records a source-change event and creates a new immutable document version
- raw files live outside TiDB behind `DisclosureDocumentStore`; the database stores references and provenance metadata only
- retention is indefinite; future cost control may tier by access frequency, never delete by age

### `disclosure_transactions`

- filing id and source row identity
- owner as stated: self/spouse/dependent/unknown
- raw asset name and description
- transaction type and transaction date
- amount range `{ minUsd, maxUsd }`
- asset type as stated
- normalized issuer/security ids when resolved
- `resolutionGrade`: `exact | strong | ambiguous | none`
- `resolutionBasis[]`
- `publicationBasis`: `source_timestamp | first_observed`
- computed `disclosureLagDays`

### `disclosure_matches`

- plan revision id + transaction id
- deterministic gate snapshot
- `disclosureMandateVersion` and effective research controls
- state: `held | reviewable | promoted | set_aside`
- named hold/set-aside reasons
- reviewer, review timestamp, and notes
- linked Capital Aperture thesis/run/candidate ids after promotion

### `disclosure_entity_aliases`

- exact raw asset text, resolved security id, status, and provenance
- creator/revoker identity, timestamps, and basis
- accepting a mapping for one observation does not create an alias
- alias creation is a separate explicit human action
- aliases match identical stored raw text only; no fuzzy, substring, or inferred variant matching
- revocation stops future automatic resolution and never rewrites historical matches

All source records and revisions are append-only. Corrections create new rows or supersession links; they do not rewrite history.

Raw documents are content-addressed and never refreshed in place. A retrieval either confirms the existing hash or creates a new immutable version whose change is visible in the activity history.

---

## 7. Time and lag contract

Every observation carries four distinct clocks:

1. `transactionDate`: when the filing says the transaction occurred.
2. `filedAt`: when the report says it was filed.
3. `firstObservedAt`: when Capital Aperture first retrieved the public document.
4. `retrievedAt`: when this specific copy was fetched.

Define:

```ts
eligibleFrom = sourcePublicationTimestamp ?? firstObservedAt;
disclosureLagDays = calendarDays(transactionDate, eligibleFrom);
```

Rules:

- Historical evaluation, ranking, and outcome analysis may not use the observation before `eligibleFrom`.
- If the source does not expose a trustworthy publication timestamp, use `firstObservedAt`; never backfill an earlier inferred time.
- A negative lag, impossible date ordering, or missing transaction date produces a hold.
- The UI shows both transaction date and “publicly observable from” date.
- “Lag-adjusted” describes this clock discipline. It is not a claim that delay bias has been removed.

---

## 8. Entity resolution and collision policy

### Automatic resolution

Only `resolutionGrade: exact` may pass automatically. Exact requires a unique supported security supported by a durable identifier or a unique canonical issuer alias already tied to the `securities` table.

`strong`, `ambiguous`, and `none` require human review. The UI shows the raw asset text, proposed mapping, alternatives, and basis. Do not display a free-floating numerical confidence score that implies precision the evidence does not support.

Accepting a manual mapping resolves only that observation. The operator may separately promote an identical raw-text mapping to a reusable alias, with its own confirmation, provenance, and audit record. Alias creation must never be a side effect of observation review.

### Collision classes

1. **Duplicate document:** same source id or content hash → ingest once, record repeat retrieval.
2. **Amendment:** preserve both documents; mark the prior record superseded; recompute affected plan matches.
3. **Duplicate transaction candidate:** same filer, owner, asset text, transaction date/type, and amount range across documents without a stated amendment → hold for review.
4. **Entity collision:** one asset description maps to multiple supported securities → hold.
5. **Cluster:** multiple filers disclose the same resolved issuer inside a window → descriptive cluster evidence, not a duplicate and not a recommendation.

Committee adjacency, spouse ownership, and clusters must remain separate fields. Combining them into a single “insider” or “conflict” score is prohibited.

---

## 9. Evidence gates

An observation is `reviewable` only when all structural gates pass:

- official primary-source document exists and hash verifies;
- source document and row identities are stable;
- transaction date, eligible-from time, owner, transaction type, and amount range are present;
- asset type is supported;
- entity resolution is exact or manually accepted;
- no unresolved duplicate, amendment, or entity collision exists;
- any plan-defined age/lag/amount filters are measurable and pass;
- the effective `DISCLOSURE_MANDATE_V1` controls are stamped and pass;
- the approved plan revision matches the one used to evaluate the observation.

Promotion adds decision-critical questions, not a recommendation:

- Does this disclosure belong to the named thesis, or is the connection merely thematic?
- Does the filing lag make the observation too stale for the stated horizon?
- Is the disclosed owner and transaction direction represented accurately?
- Is there independent evidence for the catalyst or causal mechanism?
- Would the proposed paper exposure duplicate an existing cluster?

Every required question must receive a recorded `reviewed` state through the existing evidence-review contract before a paper proposal can be prepared.

---

## 10. User journey

### 1. Describe

The operator writes a research intent, for example:

> Monitor newly public House PTR purchases in exchange-listed US healthcare companies related to my GLP-1 thesis. Show the filing lag, preserve amount ranges, and hold anything that cannot be mapped exactly. Research only until I explicitly allow paper staging.

### 2. Normalize

Show the compiled plan as a plain-language workflow and structured fields. Highlight assumptions and missing parameters. Nothing begins monitoring here.

### 3. Review

The operator confirms source scope, asset scope, filters, cadence, output mode, and unresolved compiler notes. Approval records a versioned research plan.

### 4. Monitor

An activity ledger shows source checks, documents found, rows normalized, duplicates/amendments, held observations, reviewable observations, and named failures. A paused plan performs no scheduled retrieval.

### 5. Paper Stage

The operator promotes one reviewed observation into a named thesis/run. The resulting candidate shows:

- what the filing states;
- source document and retrieval provenance;
- transaction date and publicly observable date;
- amount range, owner, and transaction type;
- entity-resolution basis;
- disclosure lag and remaining evidence questions;
- a clear statement that the filing is evidence, not a recommendation.

Promotion does not create a broker-order row. The existing play recipe and paper proposal interfaces take over only after independent evidence and portfolio checks are complete.

### 6. Learn

The record compares decisions and paper outcomes using `eligibleFrom`, never the hidden historical transaction date. It includes promoted, held, overflow, set-aside, deferred, and cash decisions.

Reuse `INDICATIVE_SAMPLE_FLOOR = 30`, `EDGE_SAMPLE_FLOOR = 100`, `sampleSufficiency`, and `sufficiencyNote` from `server/aperture/scorecard.ts` rather than creating a second taxonomy. The counting unit is a closed paper trade promoted from a disclosure observation, not an observation. Below 30 closed disclosure-sourced trades, use the existing process-only language. A disclosure-sourced versus non-disclosure comparison is not allowed until both cohorts contain at least 30 closed paper trades; even then it is indicative, not an edge claim. Edge-capable language still requires 100+ closed trades and a separately approved evaluation protocol.

The hypothesis is: **do public disclosures widen the research aperture while preserving evidence quality and guardrail adherence?** It is not whether copying filers makes money.

---

## 11. UI scope

### Operator model

Jim and his wife are the same user type: **Capital Operator**. Each may author monitoring intent, review provenance, resolve entities, promote evidence into a thesis, and continue into the existing play/paper-proposal journey.

Same user type does not mean a shared login. They use separate identities with identical permissions so every review, resolution, approval, and paper-order action has an attributable audit actor. The rail remains under thesis/research navigation and is also reachable from the Capital Operator's daily front door.

### Purpose-built operator journey

The rail must follow `TSL-BUILD-2026-008A_CAPITAL_OPERATOR_UX_RESEARCH_AND_RECOVERY_ADDENDUM.md`. It is not a chat-UI project. The default surface is a structured operator journey: orient to active thesis/account → choose one decision → verify the evidence that can change it → stage on paper or decline → record the outcome.

Before new rail UI is added, reconcile the missing recent test-thesis state identified in owner browser review. The known recovery targets are `Jim Reference — Catalyst Reaction (Paper Trial)` and `GLP-1 Demand Shock: Food & Health Day-Trading Opportunities`. Recovery must be provenance-backed, idempotent, dry-run by default, owner-scoped, and must not backfill outcomes or measurements.

Reuse the existing Capital Aperture design system and modules:

- `--sh-*` design tokens only;
- `ResearchLedger` for provenance and source review;
- `DecisionFocusCard` for the next human question;
- `PlayRecipeCard` only after candidate promotion;
- `PaperProposalForm` and current preflight for paper staging;
- `SetAsideHistory` and the scorecard for learning.

Add only the surfaces the new domain requires:

1. **Disclosure Plans:** draft/review/monitoring/paused list.
2. **Compiled Plan Review:** raw intent beside the typed workflow and confidence notes.
3. **Disclosure Evidence Queue:** reviewable, held, promoted, and set-aside observations.
4. **Plan Activity:** append-only source, parser, gate, revision, and operator history.

Do not create a Public-like agent marketplace in this enhancement. Shareable templates, if pursued later, share research-plan grammar only and never carry brokerage credentials, approvals, or executable order state.

---

## 12. Work packages and 90-day proposal

### Entry gates before WP-DIR1

1. Complete the read-only thesis-continuity inventory and produce a recovery manifest for the two known Capital test theses.
2. Create a provenance-complete official House fixture corpus; no synthetic filing may be presented as an official record.
3. Use the **Capital Operator** user type for both Jim and his wife, with separate audit identities.
4. Confirm the named human prohibited-language reviewer. Recommendation: Lenox owns product-language sign-off; public release later requires separately scoped legal/compliance review.
5. Reconcile the remaining migration-prefix collision and add a deterministic test that fails when two `drizzle/*.sql` files share a numeric prefix. The former duplicate `0044_order_intent.sql` is now `0050_order_intent.sql`; duplicate prefix `0024` remains.

No work package begins while any entry gate is unresolved.

The 30-closed-trade threshold is not an entry gate. Follow the accelerated pilot in `TSL-BUILD-2026-008_ACCELERATED_PAPER_PILOT_TEST_PLAN.md`; below 30, all outcome language remains process-only.

### WP-DIR0 — Continuity and operator-journey proof (before DIR1)

- Run the dry-run thesis inventory and reconcile or recover the two named test theses from provenance-backed sources.
- Add post-rebuild continuity validation for saved-thesis visibility, active-thesis selection, projection/run linkage, and owner scope.
- Observe both Capital Operators completing the current Today → evidence → paper-preparation path.
- Produce and test low-fidelity wireframes for Today, Candidate decision, Evidence resolution, and Saved/New Thesis.
- Record terminology, wrong turns, backtracks, and explanation requests before UI implementation.

**Exit:** both test theses are visible and nonduplicated; active context is coherent; both operators can explain the proposed journey; no broker or outcome data is fabricated.

### WP-DIR1 — Grammar and provenance foundation (days 0–30)

- Define and test `DisclosurePlanV1` compiler/normalizer.
- Define and test `DISCLOSURE_MANDATE_V1`, including tighten-never-loosen behavior and visible overflow.
- Add plan/revision, filing, transaction, and match schema.
- Implement House Clerk + fixture source adapters.
- Store immutable source documents through `DisclosureDocumentStore` with hashes, sizes, parser versions, and indefinite retention.
- Implement time/lag, amendment, duplicate, resolution, and structural gate logic.
- Supply frozen official-source fixtures for deterministic tests.

**Exit:** a plain-language intent compiles to a reviewable plan; one official House fixture ingests into normalized, provenance-complete transactions; no UI or broker path is required.

### WP-DIR2 — Review and Capital Aperture promotion (days 31–60)

- Build plan review/lifecycle and activity history.
- Build evidence queue and manual entity-resolution review.
- Add observation-specific mapping acceptance and separately confirmed exact-text alias creation/revocation.
- Promote reviewed observations as typed candidate evidence into an existing thesis/run.
- Reuse evidence-review readiness and current paper preflight.
- Add scheduled, cached refresh with pause enforcement and bounded retries.

**Exit:** a reviewed observation can reach a Capital Aperture candidate and its evidence queue without creating an order.

### WP-DIR3 — Learning, replay, and owner UAT (days 61–90)

- Add disclosure decision/outcome views keyed to `eligibleFrom`.
- Reuse the existing 30/100 sample-sufficiency taxonomy and count closed promoted paper trades, not observations.
- Include set-aside, defer, and cash outcomes.
- Capture an immutable, zero-network owner walkthrough from a real paper research session.
- Run authenticated desktop and 375px UAT.
- Evaluate a Senate source adapter and historical committee-membership source as separate go/no-go decisions; do not silently add either.

**Exit:** the full Describe → Normalize → Review → Monitor → Paper Stage → Learn path is replayable and auditable, with no live action or performance claim.

---

## 13. Acceptance

1. A natural-language monitoring request compiles into `DisclosurePlanV1` with every ambiguity visible.
2. Monitoring cannot begin until a human approves a specific immutable revision.
3. Editing creates a new revision; prior revisions and matches remain readable.
4. One official House PTR fixture is retrieved or replayed with source URL, stable id, SHA-256, parser version, and all four timestamps.
5. The raw document is stored outside TiDB under its SHA-256; a repeat retrieval preserves the same object, while changed bytes under the same source id create a visible immutable version.
6. Transaction value ranges remain ranges through storage, UI, and candidate promotion.
7. `DISCLOSURE_MANDATE_V1` defaults are stamped on every match; plans can tighten but cannot loosen them; overflow remains counted and visible.
8. Historical evaluation proves the observation is invisible before `eligibleFrom`.
9. Duplicate, amendment, date-order, unsupported-asset, and ambiguous-entity fixtures fail closed with distinct reasons.
10. Accepting a manual entity mapping changes one observation only; creating or revoking an exact-text alias requires a separate audited action and does not rewrite history.
11. Committee context does not affect scoring and cannot render as a conflict claim.
12. Promotion produces cited candidate evidence and decision-critical checks; it creates no broker order.
13. A paper proposal still requires the existing recipe readiness, live preflight, typed `PAPER`, explicit approval, and separate submit action.
14. Pausing a plan prevents scheduled source retrieval while preserving its definition and history.
15. Disclosure evaluation counts closed promoted paper trades, reports held/set-aside/overflow counts, and cannot compare cohorts until each reaches 30 closed trades.
16. A frozen walkthrough renders with zero source, model, market-data, or broker calls.
17. A migration-prefix test fails on duplicate numeric prefixes before any new disclosure migration is written.
18. A named human reviewer signs off on the prohibited-language scan; CI text matching is supporting evidence, not the sign-off.
19. `pnpm check` is clean and `DATABASE_URL= pnpm test` introduces no new failures.
20. The implementation report identifies any unavailable source field, parser ambiguity, unsupported asset, or unverified claim instead of supplying a fallback.

---

## 14. Must not happen

- No “copy Congress,” “follow smart money,” “insider,” “conflict,” or “congressional alpha” product language.
- No ranking based solely on purchase/sale direction, filer identity, committee membership, transaction size, or number of filers.
- No use of transaction date as the signal-availability date.
- No amount-range midpoint used for sizing or conviction.
- No unresolved asset text silently converted to a ticker.
- No amendment overwrites or deletion of a prior source record.
- No model-generated filing, missing value, source link, timestamp, or entity match.
- No options or multi-leg paper ticket generated from an unsupported disclosure.
- No plan approval interpreted as order approval.
- No live-trading code, credentials, domain, account, or migration toggle added.
- No public/canon/marketing claim that the rail produces alpha or predicts returns.

---

## 15. Verification matrix

| Concern | Required proof |
| --- | --- |
| Compiler ambiguity | Fixture prompts with omitted cadence/thresholds remain unresolved, never defaulted |
| Provenance | Source id, URL, hash, parser version, and retrieval timestamps survive normalization and promotion |
| Document storage | Raw bytes live outside TiDB under the content hash; same-id changed bytes create a new immutable version |
| Research mandate | Defaults are stamped; tighter plan rules pass; attempts to loosen fail; overflow is visible |
| Look-ahead | Tests reject any outcome window beginning before `eligibleFrom` |
| Entity collision | Multi-symbol alias fixture remains held until explicit review |
| Alias lifecycle | Observation acceptance, alias creation, and alias revocation are three distinct audited actions |
| Amendments | Original and amended filings remain present; the later record supersedes without erasure |
| Amount ranges | Min/max values remain unchanged; no midpoint appears downstream |
| Paper boundary | Compile, refresh, pause, review, and promote tests assert zero broker-order writes/calls |
| Existing risk wall | Promoted candidate reaches the same `preflightOrder()` path as every other paper proposal |
| Demo determinism | Network blocked during every walkthrough step |
| Claims | UI/text scan contains no prohibited copy-trading, conflict, insider, or alpha language |
| Evaluation | Closed promoted paper trades are the sample unit; both cohorts must reach 30 before comparison |
| Migration registry | Duplicate numeric prefixes fail a deterministic repository test |
| Thesis continuity | Both known test theses survive/reconcile with correct ownership, saved visibility, active context, and surviving links; recovery is idempotent |
| Operator hierarchy | First viewport shows active thesis/account, primary decision, status, consequence, and one next action without exposing the full candidate universe |
| Evidence resolution | Question, why it matters, source, answer, and readiness consequence appear in one surface; horizon-irrelevant valuation checks do not block intraday plays |
| Non-chat boundary | No transcript, chat composer, or assistant panel becomes the primary Capital Operator interaction |

---

## 16. Recorded decisions and remaining authorization gates

### Recorded decisions

1. **The supporting research archive is present.** Use `CAPITAL_APERTURE_PUBLIC_AGENTS_PATTERN_REPORT_2026-08-25.md` and `research/public_agents_primary_findings.md`; primary-source House fixture provenance remains the internal-pilot source gate.
2. **House-only MVP is approved.** Senate is a separate work package and go/no-go after WP-DIR1 exit.
3. **`DISCLOSURE_MANDATE_V1` is approved for research hygiene only.** Use 45 maximum lag days, `$15,001` minimum disclosed-range floor, 25 observations per plan/day, exact auto-resolution, and equities/ETFs only. Plans may tighten, never loosen. No trading or scoring fields.
4. **Raw-document storage is approved as content-addressed files outside TiDB.** The DB stores the reference, hash, media type, byte size, parser version, and retrieval history. Retention is indefinite; never overwrite or refresh a stored object in place.
5. **Manual entity resolution is observation-specific by default.** Reusable exact-text aliases require a separate deliberate action, provenance, and reversible prospective status.
6. **Evaluation reuses the existing scorecard taxonomy.** Count closed promoted paper trades; use 30/100 floors; key every window to `eligibleFrom`; show held/set-aside/overflow counts; require both cohorts to reach 30 before comparison.
7. **Migration numbers are assigned at implementation time.** Use `max(existing prefix) + 1`; on merge collision, the later-merged file renumbers. The `0044` collision is resolved by `0050_order_intent.sql`; reconcile the remaining duplicate `0024` prefix and add a duplicate-prefix test before a disclosure migration is authored.
8. **Do not wait for 30 closed paper trades to test.** Begin deterministic qualification and operator UAT as soon as the implementation gates clear, then use 5/10/20/30 closed-trade checkpoints. Thirty remains the first indicative evidence threshold; it is not a test-start threshold.
9. **Jim and his wife share one user type: `Capital Operator`.** They receive the same capabilities but use separate identities for auditability. Neither identity may bypass the existing paper preflight, typed `PAPER` acknowledgement, approval, or submission gates.
10. **The two Public videos are resolved and distinct.** Manus references [Public Agents: Automate Your Trading Strategy with AI](https://www.youtube.com/watch?v=o8pbbIqB2gg), id `o8pbbIqB2gg`. Public's current guide separately embeds [AI Agents for Investing | Public Agentic Brokerage](https://www.youtube.com/watch?v=2hS2eX4Cs0Y), id `2hS2eX4Cs0Y`.
11. **Purpose-built Capital Operator UX is required.** Follow `TSL-BUILD-2026-008A_CAPITAL_OPERATOR_UX_RESEARCH_AND_RECOVERY_ADDENDUM.md`; do not convert Capital Aperture into a chat interface.
12. **Thesis continuity precedes new UI.** Reconcile or recover the Jim catalyst-reaction and owner GLP-1 test theses with correct ownership, provenance, active context, and surviving links before implementation screenshots or UAT are accepted.

### Remaining authorization gates

1. **Language review owner:** confirm the recommendation that Lenox signs off on prohibited product language for the internal pilot.
2. **Continuity execution:** authorize the scoped, dry-run-first reconciliation/recovery of the two named test theses after the read-only manifest is reviewed.
3. **Implementation authorization:** approve WP-DIR0, then WP-DIR1 only after continuity, fixture-provenance, and remaining `0024` migration-registry safeguards are ready. This document and its test plan do not themselves authorize the build.

---

## 17. Report back with

- Compiled plan interface and sample plan revision.
- Pre-write/post-write thesis recovery manifests and observed two-operator UX notes.
- `DISCLOSURE_MANDATE_V1` implementation and tighten-never-loosen/overflow proof.
- One source document manifest with URL, hash, parser version, and timestamps.
- Content-addressed storage and repeat/changed retrieval evidence.
- Normalized transaction sample showing range, lag, owner, and resolution basis.
- Gate snapshots for one reviewable and at least four held observations.
- Observation-specific mapping plus alias create/revoke audit evidence.
- Proof that promotion creates no broker order and reuses current preflight downstream.
- Frozen walkthrough version and zero-network validation.
- Typecheck/test results run with `DATABASE_URL=`.
- Closed-trade sample counts, held/set-aside/overflow counts, and `eligibleFrom` window proof.
- Remaining source, parser, entity, compliance, and evaluation risks.
