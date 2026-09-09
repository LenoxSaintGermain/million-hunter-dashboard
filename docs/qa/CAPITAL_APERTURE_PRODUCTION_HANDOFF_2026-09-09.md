# Capital Aperture production handoff — September 9, 2026

## Release scope

The operator explicitly authorized production traffic and closure of the known
test/deployment handoff. Source `300fc558ca1b3a4658cc3609f86d348d475f2165`
includes persisted Mission drafts/jobs, shared Today loading/partial arbitration,
compact mobile disclosure, and the scan JSON read repair. Broker mode remains
paper-only; proposal, approval, submission, and monitoring gates are separate.

Today uses `At a glance`, one timestamped quiet conclusion, the complete recorded
reopening condition, and visible monitoring/refresh semantics. Routine status
provenance sits in `Status details`; critical warnings are not collapsed. The
UX-copy skill informed this reduction in repeated explanations, not risk logic.

## Database boundary

Applied only reviewed additive migrations 0063 and 0064: three new tables for
owner drafts, append-only draft revisions, and durable underwriting jobs. No
existing table, broker order, approval, or position was modified by the migration.

Broker-order readback: **7 before / 7 after**, exact row hash unchanged:
`94170ffca5732dc8dbd1fd7fe8448449e583df557145444a5fcf826566151fee`.
The final post-promotion readback also confirmed all three required tables exist,
seven broker-order rows remain, and the exact broker-order hash is unchanged.

Read-only metadata confirmed the legacy STACK tables and both existing deal
identity indexes. The source schema now describes them; no production index
change or `db:push` was performed. Historical fixture seeds ran only in a new,
scoped, disposable localhost database, then were removed.

## Automated verification

| Lane | Result | Boundary |
| --- | --- | --- |
| Exact committed-source unit suite | 1,166 passed; 0 failed; 6 skipped | No DB/provider network; untracked user tests excluded |
| Real isolated integration | 66 passed; 0 failed; 2 skipped | Exact disposable localhost database; no provider calls |
| Persisted Mission journeys | 4 passed | Separate guarded localhost UAT DB; owner-scoped disposable fixtures |
| Credential presence/length | 4 passed | Real existing values; zero provider calls, not provider-validity proof |
| Isolation/network safety | 21 passed | Reject production, browser DB, arbitrary sockets and commands |
| TypeScript | Passed | Production DB disabled |

The unit lane's four persistence skips were run separately. The remaining unit
Alpaca/FRED connection checks and two external URL checks remain unverified;
they are not counted as passes. No assertions were removed or thresholds lowered.
The scan integration test now exercises the application's actual JSON read seam.
See `docs/ISOLATED_INTEGRATION_AUTHORITY_2026-09-09.md` for fixture authority.

## Observed interaction checks

- 390×844 mobile deterministic fixture: concise quiet state, no horizontal page
  overflow, named illustrative account, timestamp and on-demand monitoring.
- Keyboard Enter on Refresh retains focus, shows one refreshing state, and
  suppresses cached all-clear. Partial dispatch remains visible with filled and
  remaining quantities and a no-duplicate-submission instruction.
- Fixture receipt: five status reads, zero lifecycle mutations.
- Representative desktop partial/refresh screenshot also captured. These are
  agent-operated checks, not a human usability study or WCAG certification.

Screenshot artifacts are in the task visualization folder under
`production-2026-09-09/mobile-quiet.png` and
`production-2026-09-09/desktop-partial-refresh.png`.

## Deployment record

Initial validation image `f303385`:

- Build `855629a9-633c-4c60-ad5f-f389e692f8d6`: SUCCESS.
- Revision `capital-aperture-00079-kej`: ready, 0% production traffic.
- Six public release smoke checks passed, including exact bundle SHA, JSON API
  health and HTTP 401 for unauthenticated account access.
- No ERROR-severity events observed for that revision in the bounded log check.

Final source build: `30a3b38e-5a00-4f0c-814a-803786b2f0b4`: **SUCCESS**.

- Source: `300fc558ca1b3a4658cc3609f86d348d475f2165`, pushed to GitHub main.
- Image digest: `sha256:10bcb0b2d307f23dbf093f5b57cd42dd9e081aecf4958e6df1ccc7237b965455`.
- Revision: `capital-aperture-00080-cub`, healthy and ready.
- Production traffic: **100%**, authoritative service readback confirmed.
- Public URL: `https://third-signal-capital-aperture.web.app/aperture`.
- Production smoke at `2026-09-09T12:12:56.644Z`: **6/6 passed**. App shell,
  same-origin bundle, exact SHA, compact Today copy, JSON health and unauthenticated
  account-access denial. No mutation calls.
- Bounded post-promotion ERROR-severity log query returned no events. This is
  not a claim of continuous monitoring or complete live-user UAT.
- Previous production revision `capital-aperture-00075-fig` remains available
  at 0% as the rollback target. Additive new tables are preserved on rollback.

The already-approved `uat-f303385` alias was reused for final-image verification;
the alias name is not a source-version claim. The served bundle SHA above is the
source authority. No additional UAT hostname was authorized for the final build.

## Authenticated UAT boundary

The operator approved temporary sign-in for the exact hostname
`uat-f303385---capital-aperture-oxiyp4dcpq-uc.a.run.app`. The authorized-domain
count changed from 10 to 11. Google's quota-project requirement was resolved
without changing account permissions. Browser security separately blocked access
to the Google account chooser; the operator was asked to select their account.
An authenticated walkthrough must not be inferred from public health checks.
Production was promoted on verified automated/release checks at the operator's
explicit request; the account-picker handoff remains uncompleted. The normal
production URL rendered Operator sign-in. Use that URL for operator UAT, not
the temporary preview. No authenticated desktop/mobile production journey or
new-device login success is claimed.

Temporary sign-in cleanup is complete: the exact UAT hostname was removed and
the authorized-domain count returned from 11 to 10. Readback confirmed that the
temporary hostname is no longer authorized. The normal production sign-in URL
remains open for the operator; no Google account chooser was inspected after the
browser security denial.

## Remaining product acceptance

The broader Capital Strategist discovery UI, transactional gains-allocation
ledger and provider-backed origination-to-selection handoff remain deferred,
as documented in the prior design checkpoint. Passing deterministic core
fixtures does not mean that full feature exists. The ten-second check-in target,
full screen-reader/enlarged-text testing and live positive-quote broker scenarios
are not certified by this release.
