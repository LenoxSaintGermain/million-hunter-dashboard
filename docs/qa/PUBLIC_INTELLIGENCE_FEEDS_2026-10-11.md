# Public Intelligence — repair and verification

Date: 2026-10-11. Surface: authenticated `/public-intelligence`.
Primary label: Research OS. Change: harden Gemini's public-feed prototype.
Tracking: Linear issue creation failed with UNAUTHORIZED; this record is ready to sync.

## Scope and truth boundary

This change integrates five read-only lookup feeds into the authenticated product, plus a decorative favicon URL helper. It does **not** attach results to a deal, create durable/versioned diligence receipts, run agents, alter investment gates, submit orders, or deploy a production release. The broader free-data directory in the supplied plan is a candidate roadmap, not proof that every listed service works or has been integrated.

| Source | Implemented capability | Important boundary |
| --- | --- | --- |
| Polymarket Gamma | Category-filtered events and outcome-labeled probability bars | Source-reported market prices, not forecasts. Explicitly closed/inactive child markets excluded. Missing probabilities remain unknown. |
| Markbase | Trademark name search, raw status code, owner and USPTO link | No inferred legal registration status. Match does not establish company identity or clearance. |
| USAspending.gov | Recipient-name autocomplete | No invented UEI/DUNS; not award verification or current contractor status. |
| SEC | Company ticker/CIK index search and official filings link | Index lookup, not filing-content analysis. |
| Frankfurter v1 | Dated FX reference rates | Canonical non-redirecting endpoint; not executable/live trading quotes. |
| favicon.im | Validated public-host image URL helper | Decorative only; not displayed as an authoritative company identity. |

## Repairs

- Shared typed envelope distinguishes validated empty, unavailable, stale cache, and successful response. Includes source, URL, successful-fetch time and provider-attempt time.
- Runtime validation rejects mismatched/malformed data instead of inventing probabilities, identities, status, or FX values.
- Eight-second deadline covers headers and streamed body; two-MiB body bound; bounded search/limit/domain inputs.
- Coalesced bounded process caches, negative-cache cooldown, stale retention limits, authenticated procedures, per-caller and per-provider budgets. No unauthenticated proxy.
- Only the active tab fetches. Search needs an explicit submission; blank/whitespace input is rejected. Visible errors, retry, provenance and dated FX values.
- Long markets and trademark descriptions use progressive disclosure. Probability charts preserve the associated outcome and do not chart unknown values.
- Provider refresh may use cache; UI says so. Client transport failure does not show cached content as a successful current response.

## Verification evidence

All local tests/startup used an explicitly empty `DATABASE_URL`. No production DB or broker actions were performed.

### Live providers through repaired adapters

Opt-in `scripts/public-intelligence-probe.ts --live`, 2026-10-11 around 19:07:48 UTC:

| Probe | Observed result |
| --- | --- |
| Economy, limit 2 | `ok`, 2 events |
| Trademark Tesla, limit 2 | `ok`, 2 records; raw status codes preserved |
| Federal Boeing, limit 2 | `ok`, 2 names; identifiers null |
| SEC AAPL | `ok`, Apple Inc., CIK 0000320193 |
| USD to EUR/GBP | `ok`; rate date 2026-10-09 |
| apple.com favicon | HTTP 200, image/x-icon |

These are point-in-time availability checks, not an uptime promise. No provider keys were needed for these sampled endpoints.

### Browser UAT

Actual app frontend and actual feed router, served at loopback port 3147 with an explicitly illustrative local identity; no production login claim.

- All five tabs exercised against real responses: economy/politics/business markets, Tesla trademarks, Boeing recipients, AAPL SEC result, six USD FX targets.
- Deliberate SEC nonsense query returned a genuine `empty` state with the caveat that no match is not proof of absence.
- Whitespace search showed validation without a source query.
- Initial network trace showed only auth and the active macro feed, not hidden tab feeds.
- Verified closed June-30 Argentina child market disappeared while the December-31 market remained.
- Expanded remaining-market disclosure successfully.
- Injected **local test-only** transport rejection: visible unavailable message, no probability meters; restored real transport and Retry recovered.
- Injected **local test-only** stale envelope around a real response: stale warning remained visible with cached charts; restored real transport afterward. Actual cache expiry/failure/recovery is covered by mocked-clock backend tests.
- 354×767 mobile: document width 354, no horizontal overflow, tabs wrap, figures remain readable. Desktop flow also exercised. Visual inspection caught misuse of the red `--clay` token for general copy; replaced with `--sh-text-secondary`.
- `/walkthrough/capital-desk` still opened as an illustrative demo with **zero fetch/XHR/API requests** in the browser trace. Feed code did not enter demo execution.

### Automated checks

- Focused feature + shared regression tests: 432 passed across 53 files, rerun after final copy changes (19:11:28 UTC).
- Typecheck passed; production build passed (existing chunk-size warning).
- Broader `pnpm test:unit`: 3,678 passed, 8 failed, 18 skipped. All eight failures independently reproduced at unchanged HEAD `4098c70` (8 failed / 44 passed when running the four affected files):
  - Research library: four tests omit `thesis.list` in their mock.
  - Portfolio portrait: two classic-JSX test renders encounter missing React runtime import in MicroTooltip.
  - Capital thesis input: one single-slot insert mock asserts the later projection instead of the compilation row.
  - Attention briefing: one pre-existing text expectation/implementation mismatch.
- These baseline failures are not silently called green and were not changed in this scoped feed repair.

## Reproduction

Use Node 22+ (local path: `/opt/homebrew/opt/node@26/bin`). Never let these commands inherit the production DB URL.

```sh
DATABASE_URL= pnpm exec vitest run server/publicIntelligence.test.ts server/publicIntelligenceFrontend.test.tsx server/publicIntelligenceRouter.test.ts shared/
DATABASE_URL= pnpm check
DATABASE_URL= pnpm build
DATABASE_URL= pnpm exec tsx scripts/public-intelligence-probe.ts --live
DATABASE_URL= NODE_ENV=development pnpm exec tsx scripts/public-intelligence-uat.ts
```

## Remaining product/release gates

- Public-data discovery is not yet versioned deal evidence or automatic agent enrichment. Additional named APIs were access/documentation-audited in the [integration roadmap](../strategy/PUBLIC_DATA_INTEGRATION_ROADMAP_2026-10-11.md); they remain unimplemented, with provider-specific credentials/licensing/verification gates.
- Quotas and caches are process-local; multi-instance deployments need a shared edge quota. No distributed quota is claimed.
- Production Cloud Run/Firebase deployment and signed-in deployed-route UAT are separate from this local live-provider verification; no deployment performed here.
- The eight historical baseline failures above are resolved in the follow-up below. Skipped tests and production UAT are not claimed as passed.
- Linear requires reauthentication.

Ship log: branch `main`; feed repair pushed as `23c199300d2adbb1b84f0e8db8b8caef9363c674`. Pre-existing local commit `4098c70` was already ahead of `origin/main` before that change. Unrelated strategy files remain excluded. No production deployment claimed.

## Follow-up: baseline failures and roadmap reconciled

2026-10-11, after the feed repair. The historical failed run above is retained rather than rewritten as successful.

- Reproduced all eight failures locally: 44 passed / 8 failed across the four affected files.
- Research-library tests now include the actual `thesis.list` query in their mock.
- Capital-thesis storage mock records compilation and projection separately and asserts both inserts; no assertion removed to hide the overwrite.
- MicroTooltip imports the React runtime needed by the rendering tests.
- Missing review conditions now say the condition is not recorded. Removed the unsupported claim that a checkpoint protects against losses; added undefined, null, empty and whitespace regression cases.
- Focused affected tests: 56/56 passed. Feed regressions: 135/135 passed.
- Full `DATABASE_URL= pnpm test:unit`: **3,700 passed, 18 skipped, zero failures**; 348 passed files / 4 skipped, 32.13 seconds, started 18:35:11 America/New_York. Skips remain skips, not verification.
- Follow-up `DATABASE_URL= pnpm check`, `DATABASE_URL= pnpm build` and `git diff --check` passed. Build retains the bundle-size warning; it is not a test failure and is not silently marked resolved.
- The [API roadmap](../strategy/PUBLIC_DATA_INTEGRATION_ROADMAP_2026-10-11.md) now records each named candidate, official references, access observations, commercial-use gates, dependencies and acceptance criteria. HTTP 200 HTML from Census is recorded as a missing-key response, not working data. Optional API integrations are not misrepresented as implemented.

No production DB, broker actions, credential creation, provider subscriptions or deployment were performed by this follow-up. Linear remains unavailable pending reauthentication.

## Subsequent SEC receipt release

The later `484fe40` release supersedes the process-local quota and undeployed status above: all five lookup feeds now use shared database budgets, and SEC has owner-scoped immutable issuer receipts. [Complete migration, test, build, deployment and signed-in browser verification](SEC_EVIDENCE_RECEIPTS_2026-10-11.md). Earlier failed/skipped runs are retained here as historical evidence, not silently rewritten. Automatic deal matching, filing-content analysis and engine consumption remain roadmap work.
