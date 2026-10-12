# Capital evidence-context bridge — integration contract

Scope: read-only projection of explicitly bound acquisition evidence findings into a thesis-led Capital equity research context. No provider calls, ranking, approvals, orders, or mutation of old decisions. No migration is introduced.

## Main integration points

- Mount `capitalEvidenceRouter` from `server/aperture/capitalEvidenceRouter.ts` under the existing authenticated application router. Query: `context({ decisionRunId, revisionId, candidateId })`. Owner comes only from authentication.
- `createCapitalEvidenceReader()` is the real SELECT-only loader; it uses the saved-run finding projection, not an arbitrary text adapter. It rejects legacy analysis without finding-level support.
- Client contract: `CapitalEvidenceView` in `shared/capitalEvidenceContext.ts`: status/reason, scope, authority, findings, attention, source. Present one finding with uncertainty and a next-action cue; proof/history remain secondary. `ready` means readable research, never eligibility.
- Attention is a derived, deduplicated read projection, not a persisted task or recorded resolution. Merge by its stable `key`; the provided URL returns to the existing candidate research evidence view. Main must preserve finding context when opening inline proof. Do not pretend that following this link resolves a review.

## Implemented explicit write path (local; not deployed)

Namespace: `trpc.aperture.capitalEvidence`.

- `securityChoices(scope)` authorizes the exact current owned decision/research/candidate and returns `{choices: [{id,symbol,assetType,cik}], requiresExplicitSelection: true, limitation}`. At most 10 exact-symbol suggestions; symbol filtering does not bind identity. The UI must require selection and send the chosen ID to `choices`. Unsupported assets or missing/invalid CIK remain fail-closed at validation.
- Confirmation loader uses full-row locking reads for every mutable context record, including account, thesis, security and deal. It does not validate ordinary repeatable-read snapshots after discarding lock-query results. Real two-connection SQL concurrency validation remains an independent acceptance gate.

- `options({decisionRunId, revisionId, candidateId})`: owner-scoped latest 20 saved attempts, `hasMore`, candidate and validated existing binding security when available. Attempts are not prequalified. Candidate schema has only a symbol, no security FK; unbound candidates return `security: null, securitySelectionRequired: true`. No ticker inference or global security enumeration. First-bind explicit security selection remains a UI/infrastructure integration requirement.
- `choices({...scope, dealId, analysisRunId, securityId})`: returns `{expectedLockVersion, binding, findings, criteria, issuer}`. Binding echo excludes server owner/time and criterion pairs. No automatic semantic pairing.
- `confirmBinding({...scope, expectedLockVersion, binding: {...choices.binding, criterionBindings}, confirmed: true, requestId: UUID})`: returns `{decisionRunId, revisionId, created}`. Reuse request ID only for an exact retry.

`decisionRevisionWriter.ts` is the shared extracted transaction used by both existing `runway.begin` append and this confirmation. It locks the head, rejects unresolved broker dispatch, appends history, advances head by CAS, and supersedes review outcomes through existing receipt semantics. Confirmation additionally locks/validates identity records and exact source/graph hashes. New research basis clears selected candidate, ranking and risk authority; old approvals cannot authorize the new revision. It never updates old decisions or broker orders.

Existing immutable `aperture_decision_revisions.contextSnapshot` JSON stores the strict `evidenceContext` object. Existing unbound records stay unbound until explicit confirmation appends a new revision. No migration was added.

1. Load and authorize exact decision/research/candidate, canonical and Capital thesis, account, security, acquisition deal and analysis run.
2. Require explicit same-legal-entity confirmation for the exact security ID and normalized 10-digit CIK. Symbol/name matching is only a consistency check, never the source of a binding. Version one rejects ETFs, options, crypto, parent/competitor relations, discovery/objective contexts.
3. Select existing finding keys from the exact saved v2 analysis. Explicitly map each selected finding to a thesis graph field/index (`beliefs`, `seek`, `avoid`, `evidenceRequirements`, `invalidationConditions`). Never infer this semantic relation from prose.
4. Pin `capitalEvidenceHash(analysis.inputSnapshot)` and `capitalEvidenceHash(thesis.graph)`. Validate with `validateCapitalEvidenceBinding` using the authorized records and the proposed new revision context/gate/createdAt. Its IDs must be those that will actually be persisted. The function performs no writes.
5. Append via the authoritative revision path with current-head concurrency check; retain the old revision. Writer must record owner/confirmation time from server context, not trust client timestamps/owners/hashes.

Router and explicit client binding UI are integrated. Isolated HTTP/SQL confirmation, replay and two-connection REPEATABLE READ rejection checks passed. Final actual-browser selection/confirmation/new-revision reload remains an Antigravity acceptance gate; mocked transaction tests alone are not durable database proof. No current records are silently upgraded.

## Invalidation and limits

Owner, candidate, issuer, source hash, graph hash, account, thesis scope and current revision mismatches fail closed. Changed thesis/current revision requires explicit reassessment/rebinding. Expiry now is separate from `staleAtRun`; expired research is displayed only as needing reassessment. A new capture cannot replace the pinned receipt. A failed new analysis cannot be attached as a successful result; the bridge does not automatically follow latest analysis.

The SEC evidence remains submission metadata. Model interpretations are not corroborated filing content or financial verification. Finding citation membership is checked again against the immutable snapshot; upstream saved-run parsing validates exact quotes. Scores are intentionally absent from the consumer contract.

Read-only head recheck catches a revision change during loading; as with other read surfaces, the response is not a transactional authorization for any later action. Reauthorize at any future write or execution boundary.

Acceptance: source/owner/context mismatch tests, citation and criterion failure tests, no client identity injection, repeat-read attention dedup, stale/current-expiry separation, read-only routing, preserved inputs and no score/order/approval fields. Full UI and durable revision-write integration must be verified separately by Main.
