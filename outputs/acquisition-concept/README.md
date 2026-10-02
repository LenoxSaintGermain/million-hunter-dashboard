# Acquisition workspace concept — September 28, 2026

## Analytical template update

The deal workspace now uses `analytics.js` and `analytics.css`: asset-specific metric cards, zero-based cash-flow bars, a funding-composition bar, labeled sensitivity scenarios, exact formulas and a short interpretation. The asset selector demonstrates operating business, income property, public equity and an unmapped type. This supersedes the original deal-tab walkthrough below; overview and comparison remain as designed.

The shell is reusable, not the financial model. Business uses price/cash flow and modeled debt coverage; property uses NOI, cap rate and amortizing debt; equity uses position cost, P/E, indicated yield and price-only P&L. Unsupported assets produce no invented ratios or charts. Additional types require registered metric definitions, units, periods, provenance and suitable risk math. Derivatives and alternative assets are not implemented.

All inputs remain fixed illustrative fixtures except the scenario slider and share-count control. No historical time series was invented. Scenario bars carry no probabilities. Charts expose numeric text and formulas without hover; patterned cost/scenario bars do not rely on color alone. Debt service uses a fixed-rate fully amortizing payment formula; fees, reserves, working capital, capital expenditure and taxes are excluded.

Checks: numerical assertions passed for amortization, zero-rate payment, cap rate, P/E, dividend yield and unmapped no-chart fallback. Browser checked business slider change from −20% to −25%, property/equity/unmapped switching, and 390px property layout. These are prototype checks, not production UAT or financial validation. Captures: /tmp/acquisition-analytics-business.png and /tmp/acquisition-analytics-mobile.png. Production unchanged.

Review prototype, not a production release. Start with `python3 -m http.server 3118 --bind 127.0.0.1 --directory outputs/acquisition-concept` and open http://localhost:3118/.

## Walkthrough

1. Overview: one next decision, why it matters, compact shortlist and saved search scope. Review Cedar HVAC or choose Compare all.
2. Opportunities: comparable financials and incomplete evidence beside each business. Filter by business or industry; choose a business to continue.
3. Deal workspace: concise business explanation, financial claims, open questions and a next-step checklist. Decision brief, Evidence and History change the reading pane without leaving the deal.
4. Inspect a gap, then inspect its source: maximum two actions. Detail panel closes with Escape and returns focus. Thesis, search scope, checklist and memo are read-only previews.

## Design decisions

Design-critique principles informed a shared hierarchy instead of separate page-level compression. Existing bone/paper/ink/rule/sage/amber token values are preserved from client/src/index.css. Serif headings are restrained; normal reading copy stays 15–17px. Type stacks have local system fallbacks; no external fonts or dependencies load. Desktop uses a persistent acquisition rail and contextual side panel. Mobile uses top navigation, labeled comparison cards and full-width detail. No sticky footer covers content.

## Boundaries

All businesses, narratives, counts and figures are explicitly illustrative. No live provider, database, research, outreach, approval or order path exists. No localStorage persistence. The six criteria and unknowns demonstrate disclosure behavior, not a new scoring model. This file is outside the production client bundle.

## Checked

- Desktop 1440×1000: overview, comparison and deal briefing visually inspected.
- Comparison filter reduced three rows to Forge Mechanical; keyboard clearing restored three.
- Comparison → Cedar HVAC preserves its illustrative figures.
- Checklist → source works in two actions without navigation away from the report.
- Escape closes detail; arrow keys switch report tabs.
- 390×844 mobile report and source panel visually inspected; comparison becomes labeled records.
- No API requests exist in the implementation; server serves static files only.

Captures: /tmp/acquisition-concept-overview.png, /tmp/acquisition-concept-comparison.png, /tmp/acquisition-concept-deal.png, /tmp/acquisition-concept-mobile.png.

## Not yet validated

This is not user-tested usability, full WCAG certification, production integration or full UAT. Fresh-user thesis creation, revisions, failed/partial jobs, persisted resume, actual report generation and seller workflow remain implementation work after design approval. Do not replace real business names with these short fictional names; production needs truthful display labels and access to full source titles. Mobile next-step placement and document controls should be reviewed with the user before implementation. Browser history is intentionally simplified in this concept.
# Editorial iteration — September 28

`editorial.js` and `editorial.css` extend the local concept only. Newspaper-style horizontal navigation, lead comparison graphic, open columns and rules replace card chrome. Opportunity analysis unfolds on the same route. Asset choices are visible buttons; assumptions update the headline, interpretation and pressure-test chart. Calculations, counterargument and evidence gaps reveal inline.

Browser verified: business downside at −80% changes the headline and coverage to 0.52×; inline formulas match; front-page brief unfolds without changing route. Desktop visual inspected. Syntax check passed. Mobile and full accessibility regression still require review for this iteration. No production deployment or live analysis. Illustrative composite inputs only; unsupported asset types still produce no inferred valuation.
# Specialist dossier iteration

Added `dossier.js` / `dossier.css`: five editorial contributions mapped to inspected production modules in `server/agents/index.ts` and `client/src/pages/DealDetail.tsx`. Financial resilience, people/handover, operations/improvement, market/thesis fit and Red Team form one assessment. These are explicitly sample framing, not imported production outputs or executed agents. Unknown evidence is not scored.

Selective highlighting emphasizes the scenario result and verification caveat. Financial contribution and combined assessment follow the scenario. In-page section links open the relevant basis/next-evidence reveal without changing route. Browser validated section reveal and −80% scenario synchronization (0.52× in both lead and financial contribution); desktop visual inspected. Syntax check passed. Production unchanged; mobile regression remains pending.
# Visual investigation + tactile thesis iteration

`investigation.js/css` makes the brief a compact analysis-state map, with all specialist narratives initially folded away. One inquiry reveals in place; financial pressure testing is one further reveal. State symbols are not confidence or quality scores. The thesis drawer is now an index-card scratchpad with editable asset/location, price slider, must-have stamps and reading-order arrows. It updates a draft sentence only; no persistence, search, scoring or production thesis mutation.

Verified in browser: finance pressure test opens, switching to people hides it, priority stamp and keyboard price control update the draft sentence ($4.5M). Desktop screenshots reviewed. Node syntax passes. Mobile/accessibility regression remains pending. Production untouched.
# Mobile guided reader

`reader.js/css` adds a distinct <=700px deal-reading experience. Closed catalog: brief, risk, stress, comparison, next evidence. Suggested intents replace the article in place, with a back path and full-analysis escape. A deterministic parser accepts cash-flow/NOI declines (0–80%); unsupported requests are explicit, and revenue is not silently treated as cash flow. No real agent, API, dispatch or persistence.

390px browser validation: “cash flow falls 15%” produced the pressure-test component, $430,100 available cash and 2.19x coverage. Phone screenshot inspected. Desktop keeps investigation/workbench layout. Scope: deal reader; mobile overview/shortlist remain the existing responsive surfaces. Further usability and full accessibility testing pending.
# Overview hierarchy iteration — TSL-BUILD-2026-010

Implemented in owning files, no new wrapper. One lead and primary action; consolidated shortlist with fixture-derived multiples; explanatory evidence caption; search context retained in thesis desk. Inline brief anchors below trigger, has one fold control and returns focus. Judgment and pressure test precede the investigation map; template asset choices are secondary. Signed scenario labels use U+2212. Initial mobile Back removed.

Verified: JS syntax for every external script; browser single fold control, directly visible slider, −80% / 0.52× deck and map, focus return, Forge selection, mobile no horizontal overflow and no initial Back. Captures: `/tmp/acquisition-hierarchy-after-desktop.png` and `/tmp/acquisition-hierarchy-after-mobile.png`. Earlier screenshots exist from prior iterations but exact spec-sized before captures were not taken. Requested phone override rendered at 341 CSS pixels; exact 375px recheck, complete network audit, asset-switch regression, usability and full WCAG audit remain pending. Production edits pre-existing in worktree were untouched. No deployment or commit.
# Senior Read — TSL-BUILD-2026-011

Implemented September 28, 2026. Local prototype only; production is unchanged.

Authored persona annotations attach to explicit rendered data anchors. Desktop uses a 240px gutter with collision stacking; narrower layouts put notes after their anchor paragraph. Mobile has a dedicated notes reader state. Five Cedar annotations, two each for Forge and Oakline; other asset adapters do not receive borrowed business judgments. Fixture arithmetic supplies margins and debt coverage.

Dig deeper queues a scoped draft; Sponsor stores an editable draft; Settle records a reason without changing evidence. Reopen restores the challenge. Advance / Hold / Pass record a session-only ledger; Advance with open pushes requires explicit acknowledgment. Thesis tension reads the same scratchpad as the thesis desk. State is synchronized between desktop and mobile views. Nothing is sent, persisted, purchased or run.

Validation completed:
- Node syntax check on every external JS file; `node outputs/acquisition-concept/senior-read.test.cjs` passes fixture arithmetic, threshold copy, disposition isolation and thesis tests.
- Browser: Queue, Sponsor, Settle, Reopen, focus return, Advance acknowledgment, ledger feedback, unchanged 1-of-6 evidence, and overview/ticker counts.
- Cedar -40% challenge shows 1.55x; Forge margin 12.2%; Oakline rounds to 60 cents per revenue dollar.
- Recurring revenue Must-have -> Prefer changes tension from Bends to Unknown on next brief render.
- Exact CSS widths 1440 and 375 checked: one visible sample label, no horizontal overflow; desktop gutter 240px. Browser zoom required compensating viewport dimensions. Reopened brief has no arrival animation. CSS reduces all annotation motion under prefers-reduced-motion.
- Property, equity and unmapped adapters still render; no business annotations appear on them.
- Browser console returned no errors. Local HTTP access log contains static HTML/JS/CSS requests only for this run. Static code scan found no fetch/XHR/WebSocket/beacon or browser persistence calls. This is not a captured cross-origin HAR audit.
- Screenshots: /tmp/senior-read-desktop.png and /tmp/senior-read-mobile.png.

Remaining validation: human usability testing, full WCAG audit, live reduced-motion device check, precise animation timing measurement, and cross-origin HAR capture. No production port, deployment or persistence is implied. Production mapping remains Roadmap per the spec. UX-copy skill informed the explicit distinction between queued, sponsor draft, settled judgment and verified evidence.

# Live Advisor concept — TSL-BUILD-2026-012, Phase 0

Reading-focus follow-up: editorial.css now separates lead, figures and metadata, adds amber hover/keyboard row cues, contextual action emphasis, open-reveal rule changes and quieter previous advisor captions. Essential figures/evidence are never hidden. Scroll-linked rule progression is progressive enhancement; reduced-motion disables motion. Design-system skill used to keep existing tokens and keyboard parity. Browser keyboard focus and no overflow verified on Opportunities; both Node suites pass. Full accessibility/contrast audit and mobile regression for this styling pass remain pending. Local only.

Implemented September 28, 2026 in the local prototype only. Proposed brand: **The Senior — your margin partner**. Original themeable SVG character has 13 poses; review `advisor-character-sheet.html` and provenance in `ADVISOR_ASSET_DNA.md`. Name and likeness await human approval. The thesis scratchpad now previews a newspaper WANTED classified; it remains private, unsaved and unposted.

`advisor.js`, `advisor-timeline.js` and `advisor.css` provide a silent, explicitly authored sample: computed captions, pointing to existing evidence anchors, scenario changes through the same slider as the operator, three branches, pause/replay, and a persistent comic-strip history. Dig and Sponsor open existing editable drafts; Keep reading reveals an existing note. No branch queues, sends, settles or verifies anything automatically. The mobile portrait opens a native bottom-sheet reader. Listening/thinking artwork is reserved and never implies a live connection.

The A2UI patterns skill informed the closed action catalog and renderer-owned actions. The requested signal-stage-library skill was unavailable; local asset DNA records provenance without claiming central registration. No microphone, speech, model, provider, storage or production integration was added.

Validation:
- Advisor and Senior Read Node tests pass: fixture math, caption interpolation, branch schema, action boundaries, vector poses and static zero-provider checks.
- Modified JS syntax checks pass; final browser console returned no errors.
- Cedar at -40% reports $303,600 cash against $196,482 annual debt payments, 1.55x, in both the story and advisor.
- All three branches reach the existing review controls; mobile focus returns to the opened note/draft rather than the launcher. Evidence coverage and judgments remain unchanged.
- Strip history re-highlights its referenced anchor without changing the scenario. Replay clears the strip; Pause/Next disable at a choice boundary.
- Exact 375 CSS-pixel mobile width has no horizontal overflow. Character light/reversed-ink variants and WANTED ad visually inspected. Temporary viewport override reset.

Remaining: mascot approval, human usability/full accessibility review, actual reduced-motion device verification, cross-origin HAR audit, and refinement of long-brief sticky placement and pointing tails after resize. Phase 1 voice transport/probe and Phase 2 live integration are not implemented. No production deployment, commit or release build. Pre-existing production edits were left untouched; base HEAD 007a7c9.
