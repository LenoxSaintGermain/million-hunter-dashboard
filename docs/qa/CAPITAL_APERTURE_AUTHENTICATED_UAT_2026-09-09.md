# Authenticated production UAT — September 9, 2026

## Verdict

**Authenticated access verified; overall UX acceptance not passed.** The operator
signed into Chrome and authorized takeover. This pass exercised production Today,
Mission, Play Desk, existing monitoring, and PWR ticket/evidence navigation. It
did not change implementation or deploy another release.

Release under test: `300fc55`, production revision `capital-aperture-00080-cub`
from the preceding release receipt. Browser observations were made around
09:10–09:17 ET on the normal production domain. The current deployment was not
re-promoted or independently rebuilt during this pass.

## Journey results

| Journey | Observed outcome | Result / limit |
| --- | --- | --- |
| Authenticated Today | Named Alpaca Paper account and existing work load; no sign-in redirect | Pass for this signed-in Chrome session |
| Loading / partial arbitration | Loading notice followed by partial notice and available critical findings; no false all-clear observed | Pass for sampled states, not frame-by-frame exhaustive proof |
| Desktop keyboard Refresh | Enter activates Refresh; button retains active focus; partial state remains | Pass for activation/focus; request counts not instrumented |
| Mobile Today | 390×844 CSS viewport, document width 386–390; primary review control is 44px high | No horizontal document overflow; primary task below first viewport (fail) |
| Exact monitoring link | Today → `/aperture/run/360001/execute?candidate=240003&lifecycle=monitoring` → DKNG $20 put | Pass for selected candidate/lifecycle identity |
| Reading is not resolution | DKNG material finding and other critical issues remain after visiting monitoring and returning | Pass at visible workflow level; Seen persistence not independently audited |
| Mission resume | PW v720001, $8,000 capital, $500 input ceiling, This week, Either; saved completed NO_TRADE remains | Pass; no new underwriting action requested |
| Risk disclosure | Effective risk $0; aggregate risk/headroom explained; entered $500 unchanged | Pass for visible tighter constraint; inspection action fails below |
| Explicit result jump | Review result lands result heading around 134px below viewport top after scrolling settles | Pass for header clearance; keyboard focus remains on invoking button |
| Cross-tab resume | Opened Account & risk; waited for Saved 09:12 AM; second authenticated tab resumes section 2 with same inputs | Pass for same-browser cross-tab, not separate-device proof |
| Instrument filter | Shares shows IWM only in in-motion grid; critical DKNG and other issues remain above, with explicit out-of-filter count | Pass; Shares URL restored after back navigation |
| PWR handoff | Play Desk → run690001/candidate540001 → ticket → completed evidence | Fail: market-session blocker produces evidence/ticket loop |

## Reproduced gaps, prioritized

### UAT-01 · High — completed evidence / blocked ticket loop

1. Play Desk contains two visually identical PW cards, each with Review PWR.
2. Open the upper card: `/aperture/run/690001?candidate=540001`.
3. Page says opening-range setup is blocked because the session has not opened,
   while also saying evidence review is complete and PWR is ready for preflight.
4. Review paper ticket opens `/aperture/run/690001/execute?candidate=540001`.
5. Ticket has no modeled prices/sizing and routes Return to evidence.
6. Evidence shows 0 left and both answers recorded, then Choose paper contract.
   Its summary nevertheless says 2 questions must be reviewed.

Expected: keep the actual session/trigger condition and its next eligible check
visible. Do not send the operator back to completed evidence. Count unresolved
checks, not total historic questions. Do not bypass the opening-range or risk
gate just to complete UAT. No proposal existed on this ticket (all four lifecycle
counters were zero).

### UAT-02 · High — mobile primary task is below the first viewport

At 390×844, Review what changed begins around y=1010–1014, despite scrollY=0.
Brand/workspace chrome, constraint disclosure, partial notice, and a long raw
research paragraph precede the action. The full critical-card copy includes
literal `**` and orphaned citation markers `[1][3][5][10][12][15]`.

Expected: concise play-specific implication and action in the first meaningful
viewport; complete evidence one level deeper. Keep mode, binding risk, and
material uncertainty visible. Fix hierarchy rather than shrinking body text.

### UAT-03 · High — finding does not interpret the selected put

The primary DKNG finding says positive developments support/accelerate a long,
bullish thesis. Its link opens the filled DKNG $20 **put**. The implication text
is generic and never explains how that evidence supports or challenges the
selected put/hedge rationale. Monitoring says Review the monitored finding but
offers no explicit acknowledgement/resolution control beside that finding;
the visible general action is Run reviewed checks.

Expected: bind the explanation to the selected play's actual recorded rationale
and direction, retaining uncertainty. Provide an explicit operator review path;
do not auto-resolve from reading. This inspection did not verify the truth of
the external market headlines and makes no trade recommendation.

### UAT-04 · Medium — partial warning omits the unavailable source

Both Today and expanded Status details repeat a generic partially-available
notice. Refresh does not explain what is missing, whether it is stale recorded
monitoring or a failed source, or which action can actually recover it. The
captured browser error/warn list was empty, which is not proof of API health.

Expected: source/category, decision impact, last-success timestamp, and recovery
action. Distinguish reloading saved status from running new monitoring checks.

### UAT-05 · Medium — Today and Play Desk disagree on the primary task

Today promotes DKNG with one partial-state notice. Play Desk promotes Some
decisions cannot be verified / Refresh status, demotes DKNG to Other critical
issues, and repeats partial-state information in multiple status blocks.

Expected: one shared attention/disclosure decision across both surfaces. Source
inspection confirms Today applies `arbitrateTodayRead`, while the shared raw
attention list still contains a priority94 `status:partial` item. Do not create
another component-specific priority workaround.

### UAT-06 · Medium — Inspect effective constraint opens the wrong content

In Account & risk, the button opens Tune this run (objective, instruments,
horizons), not the binding portfolio allocation or headroom calculation.
`DecisionRunway.tsx` line820 wires it to `setShowTune(true)`.

Expected: open the actual named constraint/calculation, preserving the draft.

### UAT-07 · Medium — review timing conflicts across surfaces

Play Desk's MGM and DKNG put cards show Review: Not scheduled, but its Scheduled
reviews section lists October1 checkpoints for both. Today uses a raw OCC string
for the MGM next-checkpoint label. A recorded human review is not an automatic
monitoring schedule, but the current labels do not explain that distinction.

Expected: reconcile the displayed human checkpoint with recorded reviews and
label monitoring automation separately; format the contract consistently.

### UAT-08 · Low — residual navigation/card ambiguity

- Mobile header menu button has no accessible name in the DOM/AX snapshot.
- Two PW/PWR choose cards look identical; expose run/revision/date differences
  before navigation. This is a display ambiguity, not proof of duplicate DB rows.
- Reading the completed result still sits inside a tall setup page with suggested
  missions between the form and result, although the explicit result jump works.

## Mutations and acceptance boundary

No monetary, thesis, instrument, horizon, or risk input was changed. Selecting
Mission section2 caused an intentional persisted draft/navigation save. Today
may record displayed versions as Seen; this pass did not instrument those writes.
No acknowledgement, resolution, new underwriting, source-generation, mirror-fill,
proposal, approval, submission, cancel, or exit action was invoked. The existing
six in-motion rows remained visible and the inspected PWR ticket stayed empty.
This is not an independent database-hash proof of zero server-side mutations.

Positive new-play validation, fresh source checks, separate-device persistence,
live partial-fill/dispatch fixtures, enlarged text, reduced motion and full
screen-reader coverage remain untested here. The existing zero-risk mission and
pre-session PWR setup were not overridden to manufacture an end-to-end pass.
Unit/integration suites were not rerun because no implementation changed.

The testing-strategy skill guided journey selection and explicit mutation limits.
Browser back-navigation briefly timed out at the automation layer; recovery
showed the intended Shares-filtered Play Desk. No app failure is attributed solely
to that tooling timeout. Temporary responsive overrides were reset; final page
dimensions returned to 2027×1251. The extra UAT tab was closed and authenticated
production Today was left open.

## Visual evidence

Artifacts in the task's `authenticated-uat-2026-09-09` visualization directory:

- `mobile-first-viewport.png`: 390×844; uncertainty and long narrative are visible,
  primary review action is below the frame.
- `mobile-today-full.png`: shows the eventual action and all critical issues.
- `desktop-pwr-evidence-loop.png`: zero remaining checks beside the contradictory
  two-question summary and return-to-contract action.

These are real authenticated browser captures, not generated mockups. They do
not establish the ten-second usability target or human acceptance.

**Next implementation priority:** fix UAT-01's session-aware recovery and unresolved
counts, then UAT-02/03's concise play-specific attention card; repeat these exact
production journeys without weakening any risk or human gates.
