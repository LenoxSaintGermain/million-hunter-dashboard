# Thesis and deployment reading desk / UAT correction

Surface: Orbital / Signal Hunter. Tracking: THI-266.

## Scope and interaction contract

- `/thesis?scope=acquisition` and property input: editorial writing surface beside an explicit requirements portrait; editable starters in a horizontal reveal. Mobile switches between writing and review. Existing compilation, saving, deletion and approval handlers are retained.
- Requirements portrait is **guidance**, not extracted facts. Hollow markers mean not assessed. Entering a draft does not establish evidence or fill the guidance with invented values.
- `/aperture/deploy`: budget and horizon beside saved research; sober candidate receipts; recorded review counts include confirmed/not-applicable and never claim independent verification. Prices and risk limits explicitly await order review. Missing buying power is not zero or cash-as-buying-power.
- Strategy Sandbox: linear stop/limit/target price portrait; calculated loss/target scenarios respond to individual and global budgets; native disclosures hold premise and sample results. Unverified fixtures remain non-executable. This is not price history, a forecast or a verified backtest.
- Micro Plays: same reading hierarchy and compact research cards; existing current-price checks, paper acknowledgement, preparation and separate approval remain unchanged.
- Existing tokens: paper/bone/ink, ruled receipts, serif emphasis, restrained amber focus. No new product palette. The design-system skill guided reuse and responsive state consistency.

## Validation

- Exact source: `4324335854332a3d3684d7bff9ff845e69617f40`, pushed to origin/main.
- Clean release checkout: `/tmp/signal-hunter-thesis-deploy-release`. Unrelated dirty backend, Scan and investor changes excluded.
- TypeScript and production build passed.
- `DATABASE_URL= pnpm test:unit --maxWorkers=2 --minWorkers=1`: 245 files passed, four skipped; 2,737 tests passed, 18 skipped. No production DB writes.
- Six new assertions cover all three requirement scopes, uncompiled drafts, scenario arithmetic/non-execution and honest review/risk labels.
- Offline visual harness: `DATABASE_URL= node scripts/thesis-deploy-visual-uat.mjs`. Actual route components, inert RPC fixtures, blocked mutations; no production auth bypass. Local fixture wiring initially needed the Symphony RPC import alias corrected; final sandbox rendered normally.
- Desktop visual inspection: thesis spread, disclosure starters, template-to-draft state; deployment mandate/results spread; scenario price portraits.
- Global sample budget $50 → $100 updated all three cards: PLUG modeled loss $4.60 → $9.20 and target outcome $10.35 → $20.70; other cards updated independently from their own levels.
- Narrow view: write/review focus hides the inactive pane; horizontal scenario feed; Micro Plays preserves empty/closed-session explanation and next research action. Document scrollWidth equaled clientWidth (351 CSS pixels under browser zoom). Viewport override reset.
- No thesis creation, scan, simulation API mutation, quote/risk check, order preparation or broker action was executed during inspection.

## Release

- Frozen source: `/tmp/aperture-release-source.5QM54T/source`.
- Frozen input SHA256: `cd60a6936dc4ae826b651ace23b32ca3ac8cf01c5d52f72fb3158eecc56fe06a`.
- Cloud Build: `5f0d7658-9fa7-4409-a784-b163031951f3`.
- Prior production revision: `capital-aperture-00260-bej`.
- Release status: production promoted at 2026-09-30T02:25:59.432Z; revision `capital-aperture-00262-bap` serves 100% of traffic. Prior revision retained for rollback.
- Image digest: `sha256:6e6f8483943430931491fbc7d6357cca854ee5d76f25a51f9f7e285ce962325d`.
- Runtime configuration fingerprint (excluding image and RELEASE_SHA) unchanged: `261f7bfbe6b97cef6c7c3896e2ec01190fdb4c7f1b5bc79ae233d858cfd155c9`.
- Staged and production release verification: 11/11 checks passed each; zero mutations. Production check at 2026-09-30T02:26:13.042Z verified exact source bundle, API health and unauthenticated account denial.
- Signed-in production visual inspection confirmed the acquisition requirements portrait, deployment budget/research spread, and all three Sandbox price portraits. Production tabs left open for operator UAT. No research, simulation, thesis creation or order action was run.
- UAT URLs: https://third-signal-capital-aperture.web.app/thesis?scope=acquisition and https://third-signal-capital-aperture.web.app/aperture/deploy.

## Operator UAT

1. Thesis: open a starter, edit its text, inspect requirement hints; confirm that hints do not become claimed evidence. On mobile switch Write / What must be true. Actual compile/save remains an explicit operator action.
2. Deployment: change budget and horizon. Saved research and cross-horizon alternatives must remain readable; no order is placed. Missing values remain explicit.
3. Sandbox: change global and individual budgets, inspect the price scale and sample basis. Orders must remain unavailable.
4. Micro Plays: inspect reviewed research and existing blockers. Current-price checks, paper-order preparation and approval are separate operator UAT steps, not certified by visual inspection.

## Remaining risk

Large shared client bundle warning remains. This release changes the listed surfaces, not every route in the migration atlas. Live provider and order workflow acceptance remains separate from these UI checks.
