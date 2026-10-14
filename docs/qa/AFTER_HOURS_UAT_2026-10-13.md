# After-hours UAT — 2026-10-13

Team: Third Signal Lab · Project: Third Signal Lab Agency · Surface: Research OS / Capital Aperture.

## October 14 follow-up

The historical observations below are retained. Upload permission is no longer the current blocker: the synthetic TXT was uploaded, persisted and downloaded byte-for-byte. Expanded SDE extraction, undisclosed-value confirmation safety and mobile proposal clipping are fixed and production-retested on `capital-aperture-document-mobile-322c30b`. See `DOCUMENT_EXTRACTION_RELEASE_2026-10-14.md` for exact builds, both-origin checks, test caveats and screenshots. Stakeholder HOLD remains for the uncovered flows; confirmation/evaluation and OCR are not certified.

**Status: HOLD for stakeholder acceptance.** Initial observations below describe `81b85b6`; remediation was subsequently deployed as `eb5aaf0` on revision `capital-aperture-startup-eb5aaf0-d2`. See `DOCUMENT_STORAGE_RELEASE_2026-10-13.md` for exact cloud, two-origin and mobile evidence. Private storage passes separate-container hash readback; Today production mobile overflow is fixed. Browser file permission still blocks upload/extraction/download acceptance. Broader uncovered flows remain open. Linear authentication was unavailable; this report is ready to sync.

## Boundaries

- Verified signed-in identity: Lenox Saint Germain, `treble.design@gmail.com`, ADMIN.
- No orders submitted, cancelled, exited, or approved. Existing active thesis and approvals were not changed. No account balance refresh was invoked.
- Production browser: Chrome, Firebase hosting origin. This run does not repeat the earlier two-origin cold-start certification.
- Desktop and 390 × 844 mobile inspection. Temporary viewport override reset afterward.
- Tests/build use explicitly empty `DATABASE_URL`; no test suite connected to production TiDB.

## Observed acceptance matrix

| Flow | Observed result | Acceptance |
| --- | --- | --- |
| Acquisition command center | 14 deals; missing linked search is visible, not silently replaced | Gap: recovery only offered reload; local thesis-review link added |
| Deal 3690010, Challenge the cash | Evidence absent is explicit; inspect inputs inline; Red Team disabled without inputs; historical output remains separately labeled | Empty-state safety passed; live v2 analysis not run |
| Document intake | Synthetic empty dossier created; no file uploaded | Blocked: browser upload permission; unsafe production storage fallback |
| Public intelligence | Polymarket source response, timestamp and probability bars visible | Read path observed; other providers not fully retested |
| SEC | Explicit Apple identity confirmation; fresh immutable receipt saved; expired older receipt remains | Capture/history/provenance passed; chart and on-demand receipts present |
| Capital research / run 840001 | APP review opens; evidence attachment expands inline | Correctly blocked: no saved analysis or security choices; production binding happy path not verified |
| Today mobile | Refresh button reached x=404.87 on 390px viewport | Local fix: controls stack; isolated real-component retest scrollWidth 386 / viewport 390 |
| Play Desk | Saved priorities, workflow counts, stale marks, unmeasured MGM mark and unfilled orders distinguished | Read-only observed; no order actions exercised |
| Portfolio | Separate accounts; concentration charts, exact values, stale timestamps, controls on demand | Read-only desktop observed; screenshot captured |
| Mission | Saved failed discovery remains visible with attempted receipt and explicit retry | Fail-closed read state observed; retry not triggered |
| Remaining full scope | Performance, complete thesis lifecycle, all providers, document extraction/download persistence, production binding, every mobile route, zero-API public demo audit | Not certified by this pass |

## Findings and remediation

### AH-01 — Document retention safety (release blocker)

Production service environment has no document bucket configuration. Read-only inspection of `third-signal-v2` / `capital-aperture` also returned no volume/volume-mount configuration. `DealDocumentStorageService` otherwise falls back to the local instance filesystem. Such fallback cannot establish durable retention across Cloud Run instances. Do not use stakeholder files until durable private storage is provisioned and upload/download/hash verification survives a fresh instance.

Local remediation: reject production writes without cloud storage; protected upload-availability query disables file choice and explains the missing configuration before upload. This is a fail-closed mitigation, **not** a working durable-storage deployment. Credentials, bucket access and retention policy still need infrastructure verification. No new cloud permissions were granted.

### AH-02 — Document UI integrity (local fixes; production retest pending)

- Dossier list/detail errors now surface with recovery rather than looking like an empty intake.
- Deal-scoped desk filters out other deals' dossiers.
- Download uses the normal typed RPC decoder and errors on absent content rather than silently doing nothing.
- Upload is a keyboard-operable button; removed unimplemented drop promise and literal math notation in limits.
- Example mandate is explicitly named and disclosed as an example, not a silently applied standard investment mandate.

### AH-03 — Today mobile overflow (local browser retest passed)

Tour/refresh controls alongside the heading caused 15px horizontal overflow. Controls now stack below the heading on narrow screens and retain the desktop row. Real-component isolated UAT confirms both controls inside the viewport. Production retest remains required after release.

### AH-04 — Evidence binding prerequisites (open)

The current APP research review returns no eligible saved deal analyses and no security choices. Confirmation correctly stays unavailable. Do not attach the Apple receipt to APP or an unrelated acquisition merely to make a demo pass. Needs a legitimate matching target, saved successful analysis, explicit security/CIK and thesis criterion, then browser-confirmed immutable revision/readback without inherited approval.

### AH-05 — Missing acquisition search recovery (local fix)

Missing search remains visible. Added direct acquisition-thesis review as recovery; no automatic scan, reassignment or clearing of saved state.

## Production writes made during UAT

1. Empty dossier named `UAT — 2026-10-13 — Synthetic document verification`, FY2025 synthetic period, under deal 3690010. Revision 1, zero uploaded documents. No synthetic financial facts were attached. Retained for traceability; not deleted.
2. SEC receipt `e0c29cbe-d395-41f0-8313-64bbc1d1e882`, Apple Inc., CIK `0000320193`, captured 2026-10-13 18:50:34 ET. Status `ok`; 1,001 filings in bounded submissions snapshot, 2015-09-17 through 2026-10-08. Not financial-statement verification or investment approval.
   - Request `ca5f6c86-8e23-419f-ab1d-df4c7fa73a6a`
   - Payload hash `ae850fab2b50cf63d76e007bbe50c88ac0a8252caea316b1bc04a11831047b0e`
   - Prior expired receipt retained; no automatic deal binding.

## Local verification

- Document engine/storage/UAT + scan recovery: 47 tests passed.
- Today decision clarity/attention presentation: 15 tests passed.
- Whole-project typecheck passed.
- Production build passed; existing oversized-bundle warning remains (main JS about 5.49 MB uncompressed / 1.30 MB gzip).
- Full isolated unit suite: 4,148 passed / 18 skipped; 367 files passed / 4 skipped. Skipped tests are not acceptance passes.
- No new deployment, production retest, or stakeholder approval claimed.

## Screenshot / demo capture index

Local directory: `/Users/lenoxparis/.codex/visualizations/2026/10/13/capital-after-hours-uat/`.

| File | Meaning / caveat |
| --- | --- |
| `sec-receipt-desktop.png` | Production receipt success, filing-count charts, immutable history and on-demand provenance |
| `sec-receipt-mobile.png` | Production receipt on mobile; captured separately from local fixes |
| `capital-today-mobile.png` | Production baseline; includes pre-fix layout gap; not a polished acceptance screenshot |
| `play-desk-desktop.png` | Production saved priorities/stale-data state; not live market clearance |
| `portfolio-desktop.png` | Production exposure visuals; private account data, internal review only |
| `today-mobile-fixed-local.png` | Explicitly illustrative offline component; proof of local responsive fix, not deployed account state |

Do not present local synthetic screenshots as live production. Account screenshots are not approved for public marketing distribution. For a stakeholder video, show the visual summary, open one insight, reveal its source receipt, then return to the action; do not scroll through every raw filing.

## Release / stakeholder gate

1. Configure and verify private durable document storage; demonstrate upload, extraction, confirmation, download hash and fresh-instance readback using a clearly labeled test fixture.
2. Complete legitimate evidence-to-Capital binding and immutable-revision browser test; no order needed.
3. Complete uncovered flows and mobile coverage above; distinguish demo fixtures from real receipts.
4. Review and deploy local fixes; repeat authenticated production paths and both-origin smoke tests.
5. Capture the final accepted desktop/mobile frames with release identity and timestamps. Only then mark ready for stakeholders.
