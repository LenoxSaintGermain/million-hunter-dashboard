# Diesel Mission recovery — 2026-09-13

Surface: Research OS / Capital Aperture. Tracking: THI-266.

## Scope and operator authorization

Production Mission 750001, revision 1080001, job 1. The operator authorized replacing the old PW draft with diesel research, $2,000 declared paper capital and $200 planned-loss ceiling. Accepted draft version 6 has no canonical thesis, broad permitted search, shares and intraday horizon. No permission to approve or submit an order is inferred from UAT.

## Reproduced failure and cause

Both original UI attempts failed with `classifier_request_failed`; the receipt correctly did not claim a successful empty search. The default discovery dependency called the legacy Forge gateway, but production configures direct Gemini and has no Forge gateway credentials. Prior tests mocked that function and never exercised the real routing boundary.

The new routing test reproduced the exact failure in under a second with Forge absent. Moving to the configured direct provider exposed a second failure: HTTP 400 on the full, deeply nested generated schema. A live differential probe succeeded with structure-only transport validation. Gemini documents a limited JSON Schema subset and potential schema-complexity rejection: https://ai.google.dev/gemini-api/docs/structured-output.

The transport now preserves required fields, types, enums, nullability and additional-property constraints. Repeated length/range limits are supplied in the full prompt schema and remain enforced by the unchanged authoritative local Zod schema. Malformed, truncated, refused, oversized and decision-critical invalid output still fails closed. No model ID, evidence authority, risk rule, persistence schema or broker boundary changed.

## Verification before deployment

- Routing regression observed red before repair, green afterward; 57 focused provider/routing tests passed.
- Real provider, illustrative zero-evidence fixture: valid zero-hypothesis JSON in 2.5 seconds. Not investment evidence.
- Exact cached diesel research replay through the repaired classifier: 20.7 seconds; two conditional leads and one rejected hypothesis; no schema issues. Two SELECT statements only, no database writes. Source quality, security mapping and commercial terms remain unverified. This replay is not a published Mission result or proof of economic accuracy.
- Isolated suite: 2,341 passed, 8 existing skips. Explicit `DATABASE_URL=` used. Type check and production build passed; existing large-bundle warnings remain.

## Live retest

Pending deployment and UI verification. Do not treat predeployment checks as completed UAT. Preserve the same Mission/revision/job identity when deliberately retrying; record the actual result and any subsequent blocker below.

## Recovery fixes

The objective editor now waits for the persisted draft before initializing on Back/reload. It restores unfinished objective drafts rather than creating blank inputs and new request identities; true concurrent conflicts still require comparison. Draft saving is no longer labeled underwriting. A stale-account blocker names the account and links to manual balance refresh, followed by constraint reinspection. Successful balance refresh invalidates the account, positions, cockpit and desk read caches, without starting research or changing order records.

Agent checks: 166 focused Mission regressions passed, including three repeated saved-draft return checks; 9 new cache invalidation regressions and 61 nearby tests passed. Global active-thesis versus objective-led Mission labeling remains a separate disclosed UX issue; the accepted diesel Mission still has no canonical thesis.

Independent review also found that the SDK text accessor can omit a non-text/function-call response part. A red routing regression confirmed this. The adapter now requires text-only parts before accepting a STOP result; executable or other unexpected parts fail closed before response conversion. No tool execution was enabled or performed.
