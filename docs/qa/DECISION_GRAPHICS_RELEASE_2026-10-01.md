# Decision graphics release — 2026-10-01

Tracking: THI-266. Runtime source: `82773fe3360a7137eaf257b0b61a604591301826`.

## Scope

- Today and Portfolio: selectable gross-holdings composition; cash excluded and missing marks counted. Source marks are revealed on demand on Today.
- Mission: common-scale comparison of the operator limit and saved effective planned-loss allowance; zero, unknown, and over-limit states remain distinct.
- Play Desk: proportional workflow-count bars that filter the existing lanes. Critical attention and recovery stay above the chart. Saved financial details are collapsed.
- Research: recorded universe/candidate count comparison, with repeated entries and unknown counts explicitly labeled.
- Theses: holding-period filters and comparable per-play limit bars, initially capped at six rows.
- Deal detail: reported cash less modeled debt waterfall, with an editable local additional-cost scenario. It does not save a valuation or change a verdict.
- Public `/walkthrough/capital-desk`: frozen, synthetic, zero-provider-call examples using these same components. No account mutations.

## Validation before deployment

- Whole working tree: TypeScript passed; 3,130 tests passed, 18 skipped.
- Exact staged release in isolated archive: TypeScript passed; 2,989 tests passed, 18 skipped; production build passed. The difference excludes unrelated in-progress V2 files.
- Mobile preview: 350 CSS-pixel content width with equal scroll width, no horizontal overflow. Holding selection, workflow selection, horizon filtering, and cash input verified.
- Cash example: $400,000 reported cash minus $151,843 modeled debt = $248,157 subtotal; entering $100,000 additional costs yields $148,157.
- Signed-in operator verified via account menu: treble.design@gmail.com, Admin.

## Release verification

Cloud Build: `14643946-910e-4e16-9515-836696f25d86` succeeded. Image digest: `sha256:f546467de590024c86938482c1a5297386fd63f9aa871f95e539638365513fa6`.

Revision `capital-aperture-00280-jer` serves 100% of production traffic. Runtime configuration fingerprint is unchanged. Previous revision: `capital-aperture-00278-boy`.

- Candidate: 33/33 read-only checks passed at 2026-10-01T23:39:04.502Z.
- Production: 33/33 read-only checks passed at 2026-10-01T23:39:44.965Z. Served bundle matches runtime SHA; all six chart signatures and anonymous-access denials verified.
- Signed-in production: Today, Mission, Play Desk, Research, Portfolio, Theses, and saved deal 2880003 show the new components.
- Mission: recorded $500 limit versus $0 effective allowance, with hollow zero marker; boundary disclosure opens inline.
- Play Desk: Monitor selection changes the URL to `?stage=monitor`; both critical reviews remain above the filter. Mobile chart fits 350px without horizontal overflow.
- Research: aggregate is honestly Unknown when a chapter count is missing; filtering to PW yields 42 universe entries and 42 candidates across four journeys.
- Portfolio: selecting MSFT changes the donut/readout to 21.5% and $8,362 without changing holdings. Mobile width and scroll width both 350px.
- Theses: Today horizon filter narrows the comparison to two records without activating a thesis. Mobile page width and scroll width both 350px.
- Saved composite deal: $1,260,000 less $765,289 modeled debt = $494,711; adding $100,000 local costs yields $394,711. Test input cleared afterward.
- Production public preview loaded with synthetic labels and no login gate.

Visual evidence saved locally under `/tmp/decision-graphics-proof/`: `today-desktop.png`, `research-desktop.png`, `portfolio-mobile.png`, `play-desk-mobile.png`.

## Boundaries

No research, provider, broker, account, approval, or order mutation was performed for this release. Existing stale records remain stale. This is visual/read-only workflow UAT, not a claim that live research, document ingestion, V2 migration, or paper execution passed end-to-end. Unrelated V2 work is intentionally excluded.
