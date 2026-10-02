# Capital Today — portfolio portrait

Mobile follow-up: primary explanation now opens under “Why this needs review,” while title, action, consequence and evidence warnings stay visible. Account snapshot uses one responsive native disclosure (expanded desktop, initially closed mobile). No duplicate snapshot instances. Mobile explanation open/close verified. 58 Today behavior/hierarchy/snapshot tests and typecheck passed. Inline resolution beyond existing gate/finding handlers remains a separate pending request; the preview notice is not a production resolution workflow.

Status: local implementation and isolated visual UAT; not deployed.

Replaces the dense opening cockpit on `/aperture` with an editorial account portrait. The existing account controls remain in a disclosure below. Other routes keep their current cockpit. Uses existing owner-scoped `account.getPositions` and cockpit reads; no new server mutation or order path.

## Presentation

- Account value, cash and buying power remain separate.
- Clickable holding bars use absolute measured market value / measured gross holdings, excluding cash. Signed values and individual mark timestamps remain inspectable. Missing values are not zero.
- Active thesis is explicitly a research lens, not a portfolio forecast or holdings-match claim.
- Binding constraint remains visible outside disclosure; percentage is ceiling utilization, not portfolio allocation.
- Existing paper/ink tokens, serif headings and restrained amber focus treatment; keyboard focus and reduced-motion support.
- Loading, failed reads, partial measurements, undated/stale marks and account sync errors retain visible uncertainty.

## Verification

- `DATABASE_URL= pnpm check` passed.
- `DATABASE_URL= pnpm build` passed; existing large-chunk warning remains.
- Component tests cover absolute/signed exposure, unknown data, stale marks and no invented forecasts.
- Browser: desktop editorial layout inspected; selecting TLT updates the selected source/value; mobile breakpoint stacked, DOM scroll width 351 vs viewport 354 (no horizontal overflow); viewport reset.
- Preview: `DATABASE_URL= node scripts/portfolio-portrait-visual-uat.mjs`, http://127.0.0.1:3135/__portfolio-portrait. Synthetic values explicitly labeled. No database/RPC/providers/orders in preview. Destination links target real production routes but are not implemented by the isolated preview server.

## Remaining gate

Authenticated full-page production UAT and deployment have not occurred. No portfolio data, approval rules, risk gates or orders were changed. This is a holdings composition snapshot, not performance history, a reconciled balance sheet or a predictive outlook.

## Approved-direction continuation

User approved the portrait as elevated, boutique and within the existing visual language. Extended that treatment into the actual `TodayAttentionBriefing` component with a decision-desk heading, order-linked margin label and scoped `capital-today-edition.css`. Position stories now use a responsive grid rather than a clipped carousel. Priority selection, evidence disclosures, mobile reading controls and all handlers remain unchanged.

The same preview now includes actual `AttentionDecisionCard`, `TodayExecutionSnapshot` and `TodayOrderRows` components with synthetic fixtures. Preview clicks produce an explicit local-only notice; they do not execute production review actions. Desktop spread visually checked, preview action checked, narrow-screen grid measured at one column with scroll width 351 vs viewport 354. Viewport reset afterward.

Validation: typecheck and build passed (existing bundle-size warning). 77 tests passed across portrait, cockpit summary/hydration, Today execution snapshot, attention behavior, decision hierarchy and UAT presentation. No deployment or authenticated end-to-end UAT claimed.
