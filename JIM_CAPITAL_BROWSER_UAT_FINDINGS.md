# Jim-equivalent Browser UAT Findings

**Environment:** isolated development server on port 3001 with `LOCAL_PREVIEW_OPENID=uat_jim_capital_20260813`.

## Verified browser state

The browser root navigation redirected to **`/aperture`**, confirming the fixture’s persisted `capital_aperture` default workspace is honored. The page rendered as the authenticated Jim-equivalent account (`J`) with the Capital Aperture editorial shell.

The Aperture overview visibly provides both required thesis paths:

1. **Create capital thesis**, for a new Capital / Trade thesis.
2. **Saved in Thesis Engine → Use in Aperture**, for a no-re-entry projection of an existing canonical thesis.

The browser shows the current first-run form, provider status, account selector, deployable-capital fields, and paper-only operating disclaimer. No live trading action is exposed.

## Capital / Trade creation state

Selecting **Capital / Trade** from `/thesis?scope=capital` renders a distinct, plain-language creation flow rather than acquisition templates. The page shows:

- A visible explanation that this creates a **personal canonical thesis** and then opens Capital Aperture for a **paper-only** securities research projection.
- A named thesis field, a capital-specific prompt prefilled with catalyst, evidence, invalidation, position-size, horizon, liquidity, and risk-control guidance.
- A scope-specific **Create Capital / Trade Thesis** action.
- The existing personal `Jim Capital UAT — AI Liquidity Cycle` thesis and the shared `Wingate Historic Stabilized` thesis, with clear shared provenance.

## Capital / Trade submission

The browser successfully submitted a newly authored **Jim UAT UI Capital Thesis — Catalyst Discipline**. The immediate UI state confirmed all intended transitions:

1. A visible confirmation: **“Capital / Trade thesis saved — building its paper-research projection.”**
2. The new record appeared in the saved thesis library labeled **CAPITAL / TRADE**.
3. The primary action changed to **Building capital projection…**.
4. The STRATEGIST panel entered its expected compilation state.

The final handoff is awaited from the asynchronous compile/projection cycle; no order submission UI was presented.

## Completed handoff

The asynchronous projection completed in the browser and redirected the fixture to `/aperture/thesis/90001`. The resulting Capital Aperture detail page showed:

- The exact newly created thesis title and source text.
- The explicit linked-state message: **“Linked to the main Thesis Engine.”**
- A compiled graph with beliefs, seeking, avoiding, a 10% maximum single-name rule, and compiler notes for unresolved details.
- A **Manage Canonical Thesis** return path.
- A successful **Thesis set as primary** confirmation after selecting the primary action.

This completes the browser path: **root → Capital Aperture → Capital / Trade → create → compile → linked Aperture projection → primary thesis**.
