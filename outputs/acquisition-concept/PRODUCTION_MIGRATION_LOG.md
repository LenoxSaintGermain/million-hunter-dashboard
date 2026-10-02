# Production migration implementation log

## Continuation — public entry and planning/admin truth

- Sign-in now uses the shared public shell and ruled access panel. Google authentication, session exchange, error recovery and sanitized return path are unchanged. Removed unsupported encryption/isolation marketing claims. At 390px there is no horizontal overflow and the primary action is visible within the viewport. No real login was initiated.
- Strategy Blender now uses the shared portrait and clearly labels starting assumptions. Analysis is associated with its submitted recipe/scenario key; edits withhold mismatched results, including late responses. Modeled DSCR no longer claims SBA readiness or PLP eligibility. Added accessible input and remove-action labels.
- Freedom Map adds an income-gap/capital/horizon portrait and removes the promise that a generated asset blend reaches the user's goal.
- Operator Registry no longer fabricates DNA scores from user IDs, 98.4% matching accuracy, agent health, clearance protocols or live events. It displays recorded onboarding/access state; missing telemetry is explicit. Failed/loading requests no longer masquerade as empty registries. Role/request decisions confirm their named targets and remain separate mutations.
- These are further migrated surfaces, not completion of every atlas route. Remaining specialty, public and full authenticated mutation UAT requirements below still apply. Source-contract tests are regression guards, not proof of end-to-end authorization or provider behavior.
- Validation: TypeScript and production build pass. Final regression rerun: 2,724 passed, 18 skipped, 242 files passed / 4 skipped. An earlier full run exceeded an unchanged timing assertion (52ms vs 50ms); the complete rerun passed without changing the threshold. Four new source-contract checks guard registry truth, separate request/role changes, analysis input binding and the sign-in exchange. No deployment or live auth/admin/provider actions performed.

## Integrated production-source pass — 2026-09-29

Status: local source implementation, not deployed. This supersedes the component-by-component status below; those entries remain as history.

### Implemented together

- Shared typed `AlignmentPortrait`, metric formatting and geometry: target bands, reported/modeled/corroborated markers, pencilled wanted conditions, native-button reveals, stale-state warning, reduced-motion treatment. Missing or non-finite values never become zero. No universal cross-asset score.
- Saved acquisition shortlist, Scout property cards and deal analysis consume that shared visual. Financial snapshot fields remain optional for historical receipts; no backfill or database migration.
- Public landing reframed around thesis/evidence/decision, removing unsupported performance statistics. Existing access-request mutation retained with labeled fields and manual-review disclosure.
- Production `/walkthrough` now has deterministic business and capital paths, four chapters, independent sensitivity controls, formulas, mobile reader focus and swipe navigation. No live research, account or order. Existing legacy walkthrough source remains unused by this route.
- Shared workspace presentation reaches the existing navigation. Market Scan is labeled experimental; duplicate Radar Labs entry removed without removing its primary destination.
- Memos distinguish fetch failure from an empty library and suppress missing-memo generation suggestions until records load. Outreach explicitly distinguishes recording a contact from sending a message.
- Admin separates people, invitations and permissions. Role changes review exact identity/current/proposed role before mutation. Permission/reset/revoke and model-route changes require confirmation. Missing platform stats are not rendered as zero. Existing server gates and model registry remain authoritative.

### Validation

- `DATABASE_URL= pnpm check`: passes.
- `DATABASE_URL= pnpm build`: passes; main client chunk remains large (4.90 MB / 1.17 MB gzip). Bundle splitting remains a performance follow-up, not a hidden release success claim.
- `DATABASE_URL= pnpm test:unit`: 2,720 passed, 18 skipped; 241 files passed, 4 skipped. Includes snapshot compatibility, portrait presentation, finite-value guards, finance presentation and existing capital gates.
- Public walkthrough visually inspected at desktop, 768px tablet and 390px mobile. No horizontal overflow at 390/768. Mobile asset -80% produces 0.62x coverage; synthetic capital -80% produces -$800. Zero `/api/` resource requests observed on the walkthrough.
- Existing isolated local UAT harness used with provider credentials blanked. Capital fixture renders truthful unavailable-status warnings. Non-admin `/admin` navigation redirects to Capital without admin-record requests. No admin mutation was exercised.
- Isolated server startup auto-archived one expired local fixture signal; no production database was connected. No outreach, orders, invitations or provider calls were initiated by this migration review.

### Still required before declaring the atlas migrated

Shared styling is not a bespoke workflow migration. Freedom Map, Strategy Blender, Insurance Prospector, RippleEffect, import/schedules/verification, Operator Registry and remaining public/demo/brief surfaces still need their atlas-specific layouts and interaction audits. Capital received the shared visual treatment on its constraint rail, not a wholesale workflow rewrite.

Authorized admin fixture UAT must cover role/permission/invitation changes, stale edits, denied endpoints and uncertain mutation outcomes. Existing confirmations do not add atomic conflict detection or a new audit ledger. Authenticated acquisition/property data flows need full-browser verification. Provider availability and public deployment are separate gates; this pass makes no claim of either. Existing unrelated working-tree edits were preserved.

Tracking: Third Signal Linear issue THI-266. No commit, push or deployed revision claimed.

## Slice 2 — financial snapshot adapter
Future saved comparisons capture optional financialBounds and per-item reported asking price/cash flow directly from the existing scan inputs and extracted listing. Read responses expose those immutable snapshot fields; no current-deal join or backfill. Older v1 receipts remain valid and expose undefined financial fields.

AcquisitionFinancialPortrait renders target windows and hollow reported markers only for complete positive-width nonnegative ranges and nonnegative values. Partial, absent and negative-value cases stay textual; unknowns are never zero. Each axis has an explicit scale and no combined score. Existing stale alert applies to the saved comparison. No new scan, database migration or provider call was run.

TypeScript passes. Twelve targeted tests pass, including snapshot round-trip and legacy-field absence. Browser UAT and deployment remain pending. Changes to routers.ts were confined to the comparison snapshot capture; pre-existing edits preserved.

## Slice 1 — saved shortlist evidence
Implemented in production client source, not deployed: `AcquisitionEvidencePortrait.tsx`, integrated into `AcquisitionThesisComparison.tsx`.

Uses the existing read-only comparison response. Each actual criterion shows its weight and supported/missing state; native details reveal explanations and original source links in place. Stale and assessment-failed states remain explicit. No API contract, permission, mutation or synthetic data changes. Existing detailed comparison and deal navigation remain available.

This is the evidence adapter slice, not the complete financial Alignment Portrait. The shortlist response does not currently provide the prototype's price/cash-flow target-band inputs. Those require a reviewed typed data adapter before rendering. Marketing, admin, walkthrough and other atlas destinations are not migrated yet. Existing unrelated working-tree edits were preserved.

Validation: diff whitespace check; TypeScript and targeted comparison tests run with DATABASE_URL empty. Browser UAT and release gate remain outstanding. No commit, push, build ID or deployed revision claimed.
