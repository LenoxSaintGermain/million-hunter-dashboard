# Acquisition harness migration map

## Operator Desk / administrative extension
Nine Admin atlas sketches cover overview, access requests, role assignments, module permissions, invitations, model routing, consensus, operational controls and personal profile. Existing routes remain `/admin`, `/operator-registry`, `/settings`, `/profile`; these are subsections, not nine new routes. Verified page-level call sites below are not a certification of server authorization.

| Existing page / calls inspected | Proposed presentation | Consequential boundary |
|---|---|---|
| AdminPanel: admin.listUsers/platformStats/updateRole | Attention-first desk and compact person records | Review exact user/current/proposed role; reauthorize at apply |
| AdminPanel: rolePermissions.getAll/setPermission/resetToDefaults | Accessible permission matrix, focused impact pane | Preserve locked modules; affected population and reset scope visible |
| AdminPanel: invite.list/create/sendEmail/revoke | Invitation lifecycle and scoped recipient review | Create ≠ send ≠ acceptance; revoke is separate confirmed action |
| OperatorRegistry: admin.listUsers/listAccessRequests/updateRole/updateAccessRequestStatus | Access-request inbox, identity beside requested scope | Request status is not implicitly a role grant |
| Settings: models.catalog/config/update/resetDefaults | Validated routing ledger with before/after diff | Registry remains authoritative; no raw arbitrary model IDs |
| Settings: models.consensusConfig/updateConsensus | Panel configuration and affected roles | Validate before save; do not claim successful provider execution |
| Settings: scan.trigger, user.resetOnboarding | Explicit run/reset controls, not ambient actions | Show cost/scope if known, require confirmation; preserve receipts |
| OperatorIdentity: user.getProfile/saveHuntingParams | Personal identity and search preferences | User-scoped save, never permission escalation |

### Design and interaction contract
Admin shares paper/ink, restrained accent, editorial headings and progressive disclosure with the product. It does not force every record into a story card: dense permission matrices and config diffs remain appropriate. Desktop pairs records with the selected impact review; mobile shows the selected record and an explicit review screen, retaining target identity and cancel. Avoid hover-only controls and offscreen confirmation buttons. Actions must have named targets; do not put destructive actions in swipe gestures.

Default shows current authoritative state and observation time. Draft shows before/proposed values. Submitting disables duplicate submission. Success requires server receipt and refreshed state. Error keeps the draft and distinguishes validation failure from unknown outcome; reconcile before retrying a possibly successful mutation. Denied state exposes no protected records. Empty list differs from failed load. Unknown telemetry is not zero or healthy. Reset/revoke operations need exact scope, consequences, confirmation and recovery guidance where supported. No secret values in rendered pages, logs or fixtures.

Accessibility: native labeled inputs and buttons, 44px actions, visible focus, keyboard-operable matrices, status announcements, no color-only grant/deny state. Three-click evidence access is a navigation target, not a reason to bypass a required safety confirmation.

### Administrative migration gates
Before implementing: inspect server procedures and role/tenant enforcement; test denial via direct endpoint calls as well as UI visibility. Validate invitation expiry/revocation and delivery errors, concurrent edits, safe retries, stale config, locked modules, reset scope and prevention of unintended privilege changes. Confirm existing audit/rollback support; receipt and conflict-handling requirements here are proposed, not asserted shipped capabilities. Personal profile remains available according to existing user access, not admin-gated by this grouping.

Preview contains synthetic records only. No users, roles, invitations, models or database settings were changed. Syntax check passed; visual UAT, server-contract audit and production implementation remain pending.

## Interactive walkthrough preview
`walkthrough-preview.html` provides two deterministic four-chapter paths: asset acquisition and capital/paper review. Chapters cover thesis, evidence, sensitivity and the resulting sample brief. Asset sensitivity changes cash flow against fixed amortizing debt. Capital sensitivity changes a fixed hypothetical equity position; no actual ticker, account or order. The final brief reflects the selected path's lever, with independent state per path and a reset control. The atlas links to this preview.

Current limits: business acquisition only (property walkthrough still to design); chapter buttons and back/next rather than swipe gestures; responsive stacked spread below 700px rather than a validated immersive mobile stage. Browser visual/accessibility UAT pending. No production `/walkthrough` change. Native controls are keyboard operable; use 44px minimum targets, no animation, fixed composite fixtures and no external dependencies. Before production migration, test fresh anonymous sessions, both paths, extrema, reset, focus transitions and zero provider/order/outreach calls. Preserve unknown evidence and avoid unsupported performance statistics.

Status: proposed mapping + synthetic pre-visualization, 2026-09-29. No production migration authorized by this artifact. Inventory verified against `client/src/components/EditorialTopNav.tsx` and `client/src/App.tsx`; selected query/mutation names checked in the existing page sources. This is not a full API/schema audit.

## Destination model
### Public and marketing extension
The atlas now includes a Public group with 13 route/state sketches: signed-out landing, public discovery, scenario demo, guided tour, solo walkthrough, investor brief, pricing, sign-in, auth unavailable, invitation, shared deal, shared asset and not-found. Route names are present in App.tsx; full anonymous-session access and token behavior must be verified, not inferred from route declarations. Signed-in `/` remains the Today workspace.

**Proposed public positioning:** “See where the opportunity meets your thesis.” Supporting copy: “Explore the business, follow the numbers, and see what still needs evidence before you move forward.” Lead with acquisition diligence; show other asset adapters as specific supported workflows, not a universal promise.

**Landing sequence:** concise masthead → headline paired with an illustrative Thesis Lens → one interactive worked case → three jobs (find a candidate / investigate the case / prepare a decision) → evidence and model limitations → approved access CTA. Primary preview CTA opens the deterministic example; sign-in remains secondary and visible. Replace the four-pillar brochure grid with selectable worked cases. Preserve paper/ink identity, restrained accent, analytical graphics and contextual guide illustrations. Never animate a fake agent run.

**Claim audit gate:** screenshots contain 70–90%, 3.1×, 68%, 82%, 48h, “zero blind spots,” “100%” and broad verification/conviction claims. These are unverified in this pass, not declared false. Exclude them from proposed copy until each has a traceable source, defined population, calculation, period and appropriate qualification; turnaround promises additionally require operational evidence. Do not generalize zero-API demo behavior to all production workflows. Cite research does not equal independently verify every claim. No production copy was changed.

**Public acceptance:** clean anonymous session on every route; demo zero-provider/network-mutation checks; clear composite labels; keyboard/touch reveals; safe login return path; no private data in public HTML or payloads; expired/revoked shared tokens fail closed; no indexing of private shared reports; approved pricing only; reduced motion; 390/768/1440px visual checks. Public content must remain comprehensible before sign-in. Legal/privacy/footer links require a separate inventory of LandingPage and shared layouts before release—this route map does not certify their completeness.

The Public atlas entries are pre-visualization sketches, not finished marketing pages. Production implementation and deployment remain separate gates.

Primary experiences: Today, Discover, Your thesis, Investigate, Model, Decide, Act. Existing feature names remain searchable and deep-linkable. Specialist workspaces are profile-relevant, not promoted globally. Capital/paper execution retains its own permissions and is not folded into acquisition actions.

| Existing surface | Proposed destination | Primary content / visual |
|---|---|---|
| Command Center `/` | Today | Thesis feed, changes, next unresolved decision, compact shortlist |
| Scout `/scout` | Discover | Entity profiles; property-specific unknowns, history and evidence |
| Wingate `/wingate`, asset dossier `/wingate/asset/:id` | Property workspace | Investor-relevant property lens and reuse investigation |
| Investment Memos `/memos` | Decide | Evidence-bound story, financial derivations, dissent, version history |
| Outreach `/outreach` | Act | Relationship timeline; draft, review, authorized action |
| Opportunity Radar `/opportunity-radar` | Discover | Dated signal stories tied to thesis and citations |
| Market Scan `/scan` | Discover / experimental | Search receipt and verification funnel; truthful runtime labeling |
| Off-Market `/off-market` | Discover | Research scope, candidate profiles, identity gaps |
| Theses `/thesis` | Your thesis | Wanted brief, explicit requirements, revision comparison |
| Property Criteria `/theses` | Your thesis | Property adapter with its own measures and units |
| Verification Queue `/verify` | Investigate | Claim ledger, missing/stale/contradictory evidence |
| CSV Import `/import` | Intake | Mapping preview, validation, dedupe, confirmed import |
| Sourcing Schedules `/schedules` | Thesis watches | Cadence, scope, costs, run receipts, pause control |
| Investor Dossier `/investor-dossier` | Decide | Investor-scoped brief and constraint comparison |
| Capital Stack `/stack` | Model | Sources/uses, financing layers, visible formulas |
| TIDE `/tide` | Context | Signal-to-thesis implications, separating inference from fact |
| Freedom Map `/freedom-map` | Your thesis | Personal targets and constraints, not promised outcomes |
| Strategy Blender `/strategy-blender` | Model | Comparable scenario alternatives and assumptions |
| Insurance Prospector `/insurance-prospector` | Specialist Discover | Agency/book profiles, retention and concentration evidence |
| RippleEffect `/ripple` | Context | Signal → causal hypothesis → exposed entities → investigation |
| Deal `/deal/:id`, IC `/ic-review/:id`, behavioral `/behavioral/:id` | Investigate / Decide | Entity story, persona contributions, observable evidence; no invented owner motives |

## Shared adapter contract
`StoryEnvelope`: entity ID/type, tenant scope, thesis ID/revision, snapshot time, narrative claims, metrics with units and periods, source references with spans/capture times/status, deterministic gate results/version, visual recipe, available actions/permissions.

Keep reported, corroborated, modeled, inferred, stale, withdrawn and unknown distinct. A source-backed seller statement is not independently verified. Narrative renders only validated fields. Invalid or missing provenance suppresses the claim, not the warning. Changed inputs or withdrawn sources invalidate dependent narrative and verdicts together. No universal numerical quality score across asset classes.

## Verified integration anchors and boundaries
- Scout reads `scout.list`; import/create/delete/score/updateStatus/convertToDeal and `agents.runPipeline` are separate mutations. A profile reveal never invokes them.
- Memos reads `memos.list/getByDealId`; `memos.generate` is explicit and preserves failure/retry states.
- Outreach reads `outreach.list`; create/updateStatus are mutations. Do not infer message delivery from an outreach record.
- Radar reads `opportunityRadar.list`; scan is explicit. Ripple reads list/favorites/jobs/status; scan/escalate/dismiss/favorite/runPipeline remain distinct.
- Stack reads templates/stacks/getStack; createFromTemplate/updateLayer/deleteStack retain existing authorization and confirmation semantics.
- Freedom Map generate, Strategy Blender analyze, Insurance batchScore/updateStatus are not triggered merely by opening a story.
- Remaining endpoint/schema contracts require inspection in the implementation phase.

## Pre-viz and interaction contract
Open `migration-preview.html`. Twenty-one navigation entries have selectable authored samples using six visual patterns: evidence state, unknowns, workflow, change comparison, funnel and capital mix. These are representative layouts, not complete feature implementations. No production records are copied; no calls or writes occur.

Desktop: 230px module index; story/evidence spread at 1.4:1. Tablet/phone below 760px: horizontal module chooser, story followed by selected visual. This atlas demonstrates content mapping; production mobile must use the focused story stage, not inherit this gallery layout.

Within a destination: conclusion visible at zero clicks; reasoning at one; source/formula at two; proposed action confirmation at three. Menu selection is not proof the full workflow meets the click ceiling. Audit each task from its actual entry point.

Use existing ink/paper/rule/muted tokens in production, minimum 44px controls, native keyboard buttons/details, meaningful selected states. Long titles wrap. Empty: explain missing data and offer a scoped next step. Loading: retain prior snapshot with timestamp. Error: preserve draft, show recoverable failure, never invent a completed story. Stale: retain dated evidence with a stale label. Reduced motion: no required animation.

## Rollout sequence
1. Freeze route, permission, query and mutation inventory; reconcile Radar duplication and Market Scan badge/comment conflict in navigation. Verify actual backing before choosing labels.
2. Implement typed adapters and deterministic fixtures: business, property, missing-data, stale and failed-run cases. Validate provenance and formula dependency invalidation.
3. Ship behind a local/feature flag: Today + Scout + entity detail, preserving existing deep links.
4. Add investigation, memo and financing surfaces; then outreach, with explicit action review and regression tests.
5. Add specialist More modules and thesis watches; keep Wingate profile-relevant and administration separate.
6. UAT at phone/tablet/desktop: all routes, focus, overflow, three-click evidence paths, permission denial, zero implicit mutations, no fabricated source spans. Production release is a separate approval gate.

## Current validation
Route/menu inventory and selected integration anchors inspected. Preview JavaScript syntax checked. Responsive/browser visual UAT and complete field-level schema mappings remain pending. Production files and data untouched.
