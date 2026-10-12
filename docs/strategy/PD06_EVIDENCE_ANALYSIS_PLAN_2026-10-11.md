# PD-06 — Carry source evidence into a preserved analysis

Team: Third Signal Lab · Project: Third Signal Lab Agency · Primary surface: Research OS.
Status: first deal-analysis slice implemented and locally verified; production migration and deployed UAT remain open. Not deployed. Linear synchronization awaits reauthentication.

## Outcome

An operator explicitly selects a saved SEC receipt for an authorized deal, confirms its relevance, and commissions an evidence-aware analysis. The saved result names the exact inputs it used. A subsequent source capture does not rewrite that result or an earlier decision.

## Boundaries

- SEC submissions are filing metadata, not independently verified finances or filing-content analysis.
- Matching an issuer requires explicit confirmation; a name similarity is not a match.
- Owner checks apply to the deal, receipt, attachment, and saved analysis.
- Failed or missing evidence must never become an all-clear or a fabricated finding.
- Provider output is untrusted: validate structure and citation references before presenting a saved success.
- No automatic broker, order, outreach, or approval action.
- Public demos remain labeled, deterministic, and zero-API.

## Design contract

Reuse Signal Hunter's existing `--sh-*` tokens and editorial components: cream paper, ink, serif section titles, mono provenance labels, hairline rules, restrained semantic color. No imported Stripe colors or pill geometry; its receipt patterns are reference only.

Show a compact evidence-to-analysis sequence with actual counts and dates, a clear primary action, and inline selection/recovery. Reveal sources, hashes, and longer rationale on demand. Unknown values have no chart. Preserve visible keyboard focus, readable labels, reduced motion, and 354px usability.

## Execution and verification

1. Implement scoped, immutable evidence bindings and analysis records; test ownership, input validation, duplicate requests, and failure persistence.
2. Wire selected versions into Red Team/IC analysis and retain source references in the saved result without overwriting legacy decisions.
3. Add the editorial deal review surface and explicit action. Distinguish earlier input versions from newer captures.
4. Run tests with `DATABASE_URL=`; exercise additive schema against the isolated local database only.
5. Verify desktop/mobile browser success, failure, stale evidence, retry, and history. Record which tests use controlled fixtures versus live providers.
6. Typecheck/build and independent review before any production release. Report incomplete gates explicitly.

Research-brief binding, USAspending award receipts, and document ingestion are subsequent extensions; this first slice is the deal analysis path.
