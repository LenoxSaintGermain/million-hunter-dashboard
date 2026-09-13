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
- Final isolated suite: 2,348 passed, 8 existing skips. Explicit `DATABASE_URL=` used. Type check and production build passed; existing large-bundle warnings remain.

## Live retest

Production release `capital-aperture-00148-zif`, source `a8aec3b4ab4fca95ed6e44538bd8883ff5713db8`, was promoted to 100% traffic after six tagged-release checks passed. The same six public-host checks passed at 19:30:08Z. Build: `ff9b7dc3-5cf0-44e2-b36a-c55229b799c8`. Image digest: `sha256:1ffcad74d0fa1dd4b4d06afefe9cb1f2d9e0d75fc56f03fa97be49ccf26b52da`. Rollback: `capital-aperture-00146-xaf`. No migration, auth-domain change, risk-policy change or broker-setting change.

### Authenticated walkthrough

1. Reloaded the exact original Mission/revision. The previous failed receipt remained visible. Clicked **Retry research once**, using the remaining allowed attempt; no new parent Mission or request identity.
2. Job 1 completed attempt 3, receipt **30001**, at 19:33:59.276Z. The classifier was available. UI showed **Research incomplete / Analysis recorded**, two unverified leads and one rejected hypothesis. Fifteen source-manifest entries were retained. This is a successful technical result with incomplete evidence, not verified investment research.
3. Selected `hyp-diesel-refiners-01` via **Underwrite this lead**. Selection **1** created the exact child decision **780001**, revision **1110001**, underwriting job **30001**, result revision **30001**. The child completed on its first attempt at approximately 19:35:05Z.
4. Child result: **No new trade**. Evidence disclosure showed $2,000 declared capital, $200 planned-loss input, $0 effective normal-play risk and $0 remaining aggregate headroom. Market references were explicitly stale/incomplete and the regime unknown. No ticket was offered or created. No limits were increased to force a play.
5. Followed **Review original Mission and sources** back to the exact parent. The selected lead now offered **Open saved analysis**, not another analysis mutation. Reopened it and reloaded; the same child and saved timestamp remained.
6. Opened Mission, then Portfolio, then browser Back. Mission retained the selected diesel research context and its exact **Review selected analysis** destination; it did not return a blank setup or conflict screen.
7. Desktop and narrow-screen result/research views were inspected. Requested narrow viewport 390x844; observed browser viewport **354x767 CSS pixels**, document width **351**. No horizontal document overflow observed. Viewport override reset. This is a responsive inspection, not physical-device, enlarged-text, screen-reader, WCAG or measured comprehension acceptance.
8. Browser error log was empty after saved-result reload. Read-only database checks at **19:36:39.497Z** confirmed one parent job (three preserved attempts), one exact selection, and one child job (one attempt).

### Mutation safety receipt

The seven account-scoped broker-order rows had the same full-row SHA-256 before and after the live retry/handoff: `94170ffca5732dc8dbd1fd7fe8448449e583df557145444a5fcf826566151fee`. Statuses remained 1 submitted; 2 filled; 30001 submitted; 60001 submitted; 90001 filled; 120001 rejected; 150001 submitted. No approval, submission, cancellation, replacement or review-resolution action was taken. Production inspections were SELECT-only; automated tests used an empty DATABASE_URL.

### Evidence and remaining acceptance limits

- The source provider is partial. Source origin, observation timestamps, economic mechanism, commercial terms and security mapping are not independently verified. The app labels both leads unverified and supplies no eligible lead-level citation. Numerical diesel claims in model prose are **not confirmed by this UAT**.
- The broad-energy ETF hypothesis was retained as rejected, with dilution of direct distillate exposure and missing holdings/valuation evidence recorded.
- The global rail still shows the separately active Semiconductor Foundry thesis. The selected-Mission section explicitly distinguishes research context from canonical thesis, but the global labeling remains confusing. The long accepted prompt also pushes research below the first mobile viewport. These remain UX follow-ups, not claims of completed usability.
- New-draft round-trip recovery and balance-cache invalidation have deterministic regression coverage; this live pass verified accepted-context return, not a second destructive replacement of the user's draft or another balance refresh.
- Market-open entry, qualified-play evidence-to-ticket, human approval and submission were not exercised. Zero measured headroom and incomplete evidence are legitimate stopping conditions; this is a repaired research-to-underwriter path, **not a full trading-lifecycle pass**.

Screenshots under `/Users/lenoxparis/.codex/visualizations/2026/08/25/01a0392e-5a5e-73c2-9f5e-675f1dc136d9/diesel-uat-2026-09-13/`:

- `selected-lead-result-desktop.png`
- `selected-lead-result-mobile.png` and `selected-lead-result-mobile-full.png`
- `research-recovered-desktop.png`
- `research-recovered-mobile.png`

## Recovery fixes

The objective editor now waits for the persisted draft before initializing on Back/reload. It restores unfinished objective drafts rather than creating blank inputs and new request identities; true concurrent conflicts still require comparison. Draft saving is no longer labeled underwriting. A stale-account blocker names the account and links to manual balance refresh, followed by constraint reinspection. Successful balance refresh invalidates the account, positions, cockpit and desk read caches, without starting research or changing order records.

Agent checks: 166 focused Mission regressions passed, including three repeated saved-draft return checks; 9 new cache invalidation regressions and 61 nearby tests passed. Global active-thesis versus objective-led Mission labeling remains a separate disclosed UX issue; the accepted diesel Mission still has no canonical thesis.

Independent review also found that the SDK text accessor can omit a non-text/function-call response part. A red routing regression confirmed this. The adapter now requires text-only parts before accepting a STOP result; executable or other unexpected parts fail closed before response conversion. No tool execution was enabled or performed.
