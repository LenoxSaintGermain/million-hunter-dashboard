# Today arbitration and Strategist acceptance — September 9, 2026

Branch: `codex/aperture-play-desk`. Follow-up to local checkpoint `81476a7`. No production deployment, traffic promotion, production migration, or broker action.

## Reproduced and repaired

Four new component tests failed before the implementation change: a partial snapshot plus retry displayed two recovery paths; a stale no-mission snapshot still offered Start Mission after refresh failure; availability appeared as a duplicate workflow card beside dispatch; optional research loading held the entire status briefing busy. The repair centralizes transport/snapshot presentation in `arbitrateTodayRead` while retaining the existing authoritative attention ranking and order states.

The browser retry uncovered a separate keyboard focus loss caused by native disabling of the refresh button. A focus-preserving unavailable state and guarded handler now keep focus on the same button. No timers, fake progress percentages, automatic underwriting, or order mutation were added.

## Repeated isolated walkthrough

1. Desktop 1440 × 1000: reload `http://localhost:3110/aperture?uat_identity=lenox`. The named illustrative paper account resolves to a scoped quiet check-in. The recorded no-trade reopening condition remains available.
2. Mobile 390 × 844: repeat cold load. Paper mode, named account, scoped status and refresh are readable without page-wide horizontal overflow. This is an agent-operated viewport check, not a measured ten-second usability result.
3. Open Mission: the saved $25,000 declared capital, $6,000 weekly aspiration, $249 input risk and $187.50 effective normal-play risk remain. Required return remains 24%; the saved swing horizon is retained.
4. Activate Review result with the keyboard. The prior no-trade result opens without new underwriting. Missing provider data remains explicit, with a reopening condition rather than an invented market claim.
5. Return to Today. The isolated database has four broker orders, two underwriting jobs and one underwriting run; existing records were not changed by this navigation.

## Deterministic renderer checks

The separate `http://127.0.0.1:3111/` fixture serves the actual Today components and authored source states, not a screenshot facsimile. No tRPC/server/provider is connected. Its fixtures are labeled illustrative and intentionally disconnected from allocation and order mutations.

- Cold loading: account-loading wording, no missing-account prompt, no all-clear.
- Optional research loading: complete recorded-status briefing remains available; research alone shows loading.
- Partial dispatch: one availability notice, exact recorded quantities `1 filled / 2 remaining`, no invented broker acceptance, and reconciliation rather than resubmission.
- Retrying partial: one refreshing notice; the same dispatch task remains visible. Keyboard completion returns to partial, not complete.
- Failed cached quiet read: no all-clear. One retry starts status refresh without changing lifecycle records.
- Keyboard retry: focus remains `Refreshing status…`, `aria-disabled=true`; no focus movement to the document body.
- Inspected fixture receipt after retry: five query refreshes (status/context reads), zero lifecycle mutations. Seen is tested separately from acknowledgement/resolution in the persistence suite.
- Desktop and mobile partial captures have no horizontal page overflow. This does not establish full WCAG conformance.

The harness cannot validate live latency, another machine's authentication, a real option chain, or a broker. Those remain separate UAT activities.

## Capital Strategist acceptance boundary

The current Strategist is a pure, non-allocating comparison core. Passing its fixtures is not proof that the full objective-led user journey exists. In particular, the operator-facing excess-capital entry path, persisted event/allocation reservation ledger, and live discovery-to-selected-opportunity handoff are not integrated here.

| Required case | Evidence scope / remaining gate |
| --- | --- |
| Excess capital without saved thesis | Core accepts objective-led input without inventing a canonical thesis. The user-facing discovery entry remains unimplemented. |
| Selected $1,200 realized gains | Envelope arithmetic restricts comparison to proceeds minus basis/reserve; it never offers the entire sale proceeds as gain. No actual allocation occurs. |
| Unrealized/unreconciled gain | Core withholds deployable cash and preserves hypothetical-only planning. |
| Duplicate event/concurrent proposal | Known-claim fixtures reject double counting. Atomic concurrent capital reservation requires the missing persisted allocation ledger; not passed end to end. |
| Fixed-fee supplier link | Usage-driven revenue uplift is rejected without the necessary economic mechanism. |
| Technology/permission uncertainty | Conditional research; no confirmed launch catalyst. |
| Capability already launched | As-of historical baseline and genuinely new development are distinguished. |
| Odds without activity | No invented activity or revenue estimate. |
| Repeated articles | Deduplicated originating announcement, not multiple independent confirmations. |
| No qualified candidate | Retain capital with explanation and a review/reopening condition. |
| Provider/classifier failure | Explicit unavailable/conditional result, no fabricated confidence. |
| Chosen opportunity | Comparison is non-mutating and keeps underwriting identities. Full Strategist selection into the existing evidence/approval path remains an integration gate. |

Rejected/excluded hypotheses remain in the decision result with reasons, not just promoted alternatives. Historical evaluation uses the supplied decision cutoff; later observations/publications/retrievals cannot support an earlier decision. These are deterministic integrity checks, not evidence of positive expectancy.

## Evaluation limits

Source quality, unsupported claims, repeated-origin handling and economic mechanism have fixture coverage. Real-world false-alert rate, time to a useful decision, economic materiality calibration and eventual outcomes have not been measured. Recommendation frequency is not used as a success metric. No profitability or user-tested usability claim is made.

## Final test results

| Lane | Passed | Failed | Skipped | Interpretation |
| --- | ---: | ---: | ---: | --- |
| Final tracked offline unit | 1,159 | 0 | 6 | 128 test files passed; no new failure |
| Final tracked full, DB/credentials blank | 1,181 | 33 | 12 | 11 failing files, including one DB-related collection failure |
| Exact HEAD `81476a7` full baseline, same isolation | 1,103 | 33 | 12 | Same failure names/file set as final; zero new full-suite failures |
| Disposable isolated persistence journeys | 4 | 0 | 0 | Repeated with deterministic shuffled order; no prior browser fixture required |

The 33 full failures are 29 DB-dependent assertions and four unchanged credential-presence assertions. `sprint8.test.ts` additionally fails during collection when the DB URL is empty. Six unit skips are four persistence tests (run separately above), one Alpaca connection test and one FRED connection test. The full lane additionally skips two external URL imports and four share-token checks blocked by DB setup.

The unchanged DB assertions remain in `vitest.integration.config.ts`. Credential presence now has an explicit `test:credentials` lane and is excluded only from the pure unit lane, not the default full suite. No assertions were weakened and no fake keys supplied. Full-suite success remains unverified until those prerequisites are deliberately supplied to isolated tests; this is not an overall green claim.

TypeScript, client production build, server build and diff whitespace checks passed. The existing 4.4 MB client entry chunk warning and missing optional analytics configuration warnings remain. The test snapshot runner excluded unrelated untracked user work, blanked credentials and denied outgoing connections. Raw receipts: `/tmp/capital-repo-verification.TtjEgk/{unit,full,full-baseline}-summary.json`.

## Screenshot evidence

Actual browser captures, not mockups. The final persisted-app captures were checked against DOM dimensions: mobile 390 × 844 and desktop 1440 × 1000 CSS pixels. Browser display scale required a proportional physical viewport adjustment for the final captures.

- [Desktop Today](/Users/lenoxparis/.codex/visualizations/2026/08/25/01a0392e-5a5e-73c2-9f5e-675f1dc136d9/today-uat-2026-09-09/desktop-today.png)
- [Mobile Today](/Users/lenoxparis/.codex/visualizations/2026/08/25/01a0392e-5a5e-73c2-9f5e-675f1dc136d9/today-uat-2026-09-09/mobile-today.png)
- [Desktop retrying partial fixture](/Users/lenoxparis/.codex/visualizations/2026/08/25/01a0392e-5a5e-73c2-9f5e-675f1dc136d9/today-uat-2026-09-09/desktop-retrying-partial.png)
- [Mobile retrying partial fixture](/Users/lenoxparis/.codex/visualizations/2026/08/25/01a0392e-5a5e-73c2-9f5e-675f1dc136d9/today-uat-2026-09-09/mobile-retrying-partial.png)

The renderer harness has no database. The persisted-app captures use only the already labeled illustrative local account. No live market or broker behavior is inferred from either.

## Repeat commands

Node 26, repository root:

```sh
DATABASE_URL= ./node_modules/.bin/vitest run server/aperture/todayAttentionBehavior.test.ts server/aperture/todayReadArbitration.test.ts server/aperture/apertureAttention.test.ts
DATABASE_URL= ./node_modules/.bin/vitest run server/aperture/capitalStrategist.test.ts
node scripts/with-isolated-capital-uat.mjs --test
ISOLATED_UAT_MODE=true DATABASE_URL= ./node_modules/.bin/vite --config vite.today-uat.config.ts
DATABASE_URL= ./node_modules/.bin/tsc --noEmit
DATABASE_URL= ./node_modules/.bin/vite build
DATABASE_URL= ./node_modules/.bin/esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
```

The DB harness is guarded to the exact localhost database and blanks provider credentials. Do not run ordinary integration tests against the repository `.env`: it points at production.

## Remaining observed / unverified interactions

The deterministic no-provider journey ends in no trade. It does not demonstrate a fresh, qualified opportunity advancing through the full requested Strategist journey. Full screen-reader, enlarged-text, soft-keyboard and reduced-motion UAT are unverified. Production/cross-device authentication and real-network cold loading need approved isolated Cloud Run UAT. Existing large-bundle build warnings remain.
