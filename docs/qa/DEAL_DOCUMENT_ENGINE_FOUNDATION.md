# Deal document engine foundation

## Why / scope

Signal Hunter pressure-tests operator-supplied deal evidence before committing capital. Search is one entrypoint, not its identity. This is a process-local, deterministic text/page foundation, not live PDF ingestion, an upload endpoint, or a persistence/security implementation. No router, package, UI, provider, production DB, outreach, commit, or deployment changes are included.

Tracking handoff: Third Signal Lab / Third Signal Lab Agency; primary surface Research OS. Concrete change: **Add review-gated document evidence to deterministic acquisition screening**. Tracking remains in this allowed local document under the task's bounded write scope. Build/revision/live URL: not applicable; not deployed.

## Language and decisions

- Document: versioned operator-supplied page text with source locator, capture timestamp, and extraction version. A source locator is metadata, not a fetched or authenticated source.
- Proposal: deterministic label extraction, never automatically a fact. States retain exact, approximate, conflicting, on-request, failed, and not-disclosed distinctions.
- Operator-confirmed source claim: an exact proposal selected by an operator with a reason after considering all candidates for that field. It is not independently verified or audited truth.
- Conflict: differing proposed values across documents/pages or conflicting labels within a page. Confirmation retains the original contradictory proposals; it does not erase them.
- Missing: no confirmed exact source claim. Zero is an explicit value, not missing.
- Review: operator-selected acquisition mandate and evidence revision. It permits a partial deterministic screen, not financing, purchase, publication, outreach, or other execution.

Document assumptions and derived figures have separate basis labels and cannot be promoted through `confirmProposal`. Basis is currently document-wide; mixed-basis documents require separately classified inputs. Labeling must be reviewed by an operator; this module cannot verify the submitter's classification.

## Contract and use

`shared/dealDocument.ts` exports strict Zod text/page validation and shared record types. `server/dealDocumentEngine.ts` exports `proposeDealDocument` and `DealDocumentEngine`.

1. Construct with explicit `business_acquisition` or `scenario_analysis` intent.
2. `putDocument(unknown)` validates already-extracted text. Only `format: "text_pages"` is accepted. Pages are positive, unique, and bounded. Maximums: 100 pages/document, 100,000 characters/page, 1 million characters/document, 20 documents and 2 million characters/dossier.
3. Read `snapshot.proposals` and `snapshot.fields`. All returned state is cloned. Show page/source/document version/extraction version, raw spans, missing information and contradictory candidates.
4. `confirmProposal` requires an exact source-claim proposal ID, operator identity string, reason, and the full list of non-not-disclosed candidates for that field. The application must obtain the operator decision; do not auto-confirm proposals. These strings are not authenticated identities.
5. `review(mandate, operator)` validates the existing V2 mandate. Scenario analysis is incompatible and blocked; no fleet scenario is silently evaluated as an acquisition. Missing facts may be reviewed deliberately, producing unknown checks rather than invented inputs.
6. `evaluate()` adapts only confirmed money fields to `evaluateAcquisitionV2`. Its envelope includes revision and confirmed provenance. Same state/config yields the same result. The underlying source type `primary` describes supplied source material, not independent verification. Dossier `fetchedAt` selects the oldest capture instant using `Date.parse`, not ISO-string lexical ordering; original offset strings and per-document provenance are preserved.

All document additions/replacements/removals clear confirmations and invalidate review/evaluation. Replacement requires a higher document version. Confirmation/revocation, intent changes and mandate review invalidate downstream evaluation. Mandate review captures complete validated content, so reusing a version label cannot preserve old results. No-op confirmation/review also advances revision conservatively. Failed validation does not mutate state. Corrections use a new document version plus explicit reconfirmation, not free-form overriding of a sourced value.

## V2 adapter boundary

Supported: asking price, revenue, SDE, EBITDA, inventory and FF&E, using existing bounded V2 money extraction. Extraction is proposal-only and inherits V2 label/format limitations, including listing-oriented section truncation. The source/page text is retained; omitted extraction is not proof of absent information.

Raw text is never passed into V2 narrative detection. Thus financing disclosure, listing status, management, geography, moat and concentration checks remain unavailable/unknown/capped according to existing V2 semantics. No positive narrative evidence or negative narrative detection is claimed. Partial screens cannot PURSUE under current V2 because required narrative gates remain unknown; known numerical failures can still FAIL. Formula outputs remain modeled assumptions, not financing approval. Unconfirmed exact claims map to null (V2 has no unconfirmed state); the document snapshot preserves their proposed status. Other unresolved extraction states remain visible in the adapter.

Text is untrusted data, not an instruction channel: no model prompts, provider calls, tools, URL fetches, HTML execution or rendering exist in this module. The module does not promise hostile text cannot contain misleading financial labels. Human review of actual source context is still necessary. Future UI must render text safely, never use raw HTML. Dates/currency/period alignment and semantic claim validation are not implemented; operator review must reconcile them before relying on any calculation. No automatic currency conversion or period normalization is performed.

## Validation

Use Node PATH `/opt/homebrew/opt/node@26/bin:/opt/homebrew/bin:$PATH`, always `DATABASE_URL=` for tests.

- `DATABASE_URL= pnpm exec vitest run server/dealDocumentEngine.test.ts server/acquisitionV2.test.ts`: final rerun passed, 32 tests (25 foundation + 7 existing V2).
- Offset regression: `10:00+02:00` (08:00Z) is older than `09:00-04:00` (13:00Z), despite sorting lexically after it. Both insertion orders failed before the fix and pass after comparing parsed instants; document order and source strings remain unchanged.
- `DATABASE_URL= pnpm check`: final repository-wide typecheck passed. Initial private-field target incompatibility and intermediate naming collision were corrected without configuration changes.
- Explicit strict TypeScript check of all three new TypeScript files, including the test file: passed (`--target ES2022 --module ESNext --moduleResolution bundler --esModuleInterop --skipLibCheck --strict --noEmit`).
- `git diff --check`: passed. New files also checked for trailing whitespace. No full test suite or deployment validation was performed.
- Fixtures are explicitly illustrative composite claims, not real customer evidence. Tests exercise provenance, missing/zero/approximate/malformed/conflicting amounts, assumptions/derivations, all-candidate review, malicious text, incompatible mandates, stale versions, invalidation, detached snapshots and deterministic V2 math.

## Remaining integration and security work

- No API routes, request authentication, tenant ownership checks, durable storage, transactions, access control, retention/deletion, encryption or trusted audit log. Never accept serialized client engine state as authoritative. IDs and operator strings are metadata, not security controls.
- Implement optimistic concurrency/current-revision checks across sessions and persist review/evaluation identity atomically before production. Old returned objects remain historical snapshots; consumers must compare revision against authoritative current state. Process restart loses this state.
- No file upload, PDF parsing, OCR, MIME/signature verification, malware scanning, sandboxing, privacy/consent policy, signed URL handling or secure storage. Text length limits are resource bounds, not an upload security claim.
- Add typed narrative/period/currency proposals with provenance and confirmation before enabling narrative V2 detectors. Add mixed-basis field classification, richer conflict reconciliation and source freshness checks. Full document diligence is not implemented.
- Build explicit review UI and safe rendering, request validation/authenticated actor attribution, integration tests, and review current V2 behavior separately. Public demos must use frozen illustrative fixtures with zero API calls.
