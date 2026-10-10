# Signal Hunter POC: what makes it work (notes for our own skills)

Source: `Third Signal Lab/specs/signal-hunter-poc.html` (1,006,923 bytes, 2,492 lines, 36 screens, built by Grokbot). Observed 2026-10-07/10 by walking the screens in the browser pane (served over localhost) and reading the source. Line numbers refer to that file.

Labelling used below: **Observed** = seen on screen or in source. **Inferred** = my reading, not verified.

## 1. It redesigns a live app, not a blank page
- `#/compare` (CP-01): left = live app screenshots "captured 10/7/2026, read-only", right = the POC screen for the same step, a one-line caption on what changed, and a "SEAMS FIXED" list per step. Observed.
- Review is a diff against reality, so feedback is concrete ("seam 3 is wrong") instead of taste.
- Rule for the skill: when a live app exists, the compare view is required, not optional.

## 2. Backend honesty is a UI primitive
- Every screen has an API status tag: LIVE API / PARTIAL / PROPOSED. Hover or focus shows the endpoint. The index legend points to `api-map.md`, which is NOT in the specs folder (gap). Observed.
- Real figures carry `LIVE PAPER DATA · CAPTURED 10/7/2026`. Invented ones carry `EXAMPLE DATA`, `(mock)`, or `PROPOSED`. Observed.
- Tags are inline `APIT(...)` calls in the source, so they sit next to the thing they describe (e.g. line 2359). Observed.
- This is the repo's prime directives (no fabrication, honest labels, zero live API in demos) expressed as UI.

## 3. Feedback harness is built in
- Floating chip on every screen: `POC feedback · <screen-id>`. Opens a panel with screen title, intent bullets (the "look" list from the screen registry, line ~1375), a note box, Approve / Request changes, Copy all, and a status line ("No status yet · saved in this browser"). Observed.
- Index (IX-00): 36 screens grouped Meta / Prospect / Onboarding / App / Quick Play / Strategist / Learn & Explore / Review & trust / Signals. Buttons: Copy all feedback, Download feedback (.txt), Reset POC state. Observed.
- Gap: state is localStorage only, so it is per browser, with no reviewer identity and no machine-readable export an agent can ingest.

## 4. Stable screen IDs
LP-01, WT-01..05, DM-01, ON-01..05, HM-01, MN-01, RV-01, AC-01, PF-01, QP-01..05, ST-01..05, LX-01..03, TR-01, HS-01, SG-01, CP-01, RL-01, IX-00. The ID is the unit of feedback and maps 1:1 to a Linear issue. Observed.

## 5. Self-presenting modes
- Walkthrough WT-01..05: 5 steps, "about 75 seconds", tabs plus Back / Autoplay / Next. Observed.
- Promo reel RL-01: autoplay about 60 s, captions swap. Observed.
- Investor demo DM-01. Observed.
- All run on captured data with no runtime network (consistent with the zero-API demo rule). Inferred from no network libs/URLs found in source (grep for external js/css found none).

## 6. Infographic patterns (each shows a rule, not just a number)
| Pattern | Seen on | What it communicates |
|---|---|---|
| Guardrail ring (N of 12 dots, one red) | WT-03 | 11/12 checks pass, the failing one is visible, button disabled with reason |
| Flat-by-close timeline + countdown ("2h 12m") | WT-04, MN-01 | Position auto-closes at 3:50 PM ET; time left is a bar, not a sentence |
| 52-wk range bar + price vs VWAP sparkline | WT-02, QP-02 | Where the price sits in its range and why it qualified; "most you can lose" caption |
| Mission-limit bars ("$249 of $500 operator limit") | QP-02 | Three plays against one risk budget; "$3 left / $0 left" |
| Exposure donut + ranked list | PF-01 | 25.6% NVDA concentration; pairs with "NVDA at its ceiling" card |
| Pipeline rail with counts | HM-01 | Idea, Plays, Ticket, Monitor, Review as a status strip |
| Saved-you / cost-you cards | HS-01 | Plays you skipped, run through the same rules; "+$37 kept by skipping" |
| Self-drawing annotated line ("resistance") | HM-01, LX-01 | Jargon term gets a tiny chart that draws itself |
| Next-best-action card with severity tag | HM-01 | One blocking action leads ("BLOCKS EVERYTHING") instead of 4 duplicate buttons |

## 7. Motion contract (source lines ~434-490, 1285+)
- 150-600 ms, `cubic-bezier(0.16, 1, 0.3, 1)` (`--ease-out`), pure CSS opacity/transform, never blocks input.
- Plays only when the route changes. A same-screen re-render shows final values immediately (`enhance(root, routeChanged)`).
- Staggered reveal: JS sets `--d` on top-level blocks in reading order, 45 ms steps, capped at 540 ms.
- Keyframes: `rise`, `fade`, `draw` (stroke-dashoffset), `growx`, `growy`, `pop` (dots), `stamp` (rotate-in badge), `flag` / `okflash` (row flash when a check flips), `pulse`, `shimmer` (skeleton), `swap` (reel captions).
- JS: count-ups via `data-count` + `data-fmt` (usd0, usd2, pct1, r2, int; duration 420-900 ms), one shared tooltip for any `[data-tip]` (hover, focus, tap, Esc closes, repositions on scroll), scrubbable charts (pointer and arrow keys, `.vz-scrub` line + dot), View Transitions crossfade (220/320 ms).
- Everything turns off under `prefers-reduced-motion` (CSS at lines 434 and 488, JS `reduced()` at 1288, plus an `rm` class override).

## 8. Design system
- oklch tokens: bone / paper / ink, amber accent, sage, clay; semantic `--t-ok` / `--t-warn` / `--t-bad`.
- IBM Plex Serif display, Inter UI, JetBrains Mono for eyebrows and tags.
- `--sh-*` aliases so the POC maps back to the real `index.css` ("index.css :root, light mode (the app default)", line 21). Components cite the real file they mirror (e.g. `contexts/ExperienceModeContext.tsx`, line 168). Observed.

## Defects and gaps
1. **Blank block on Home at narrow width: not reproduced at desktop.** In the narrow pane, HM-01 showed about 500 px of empty space above the first card. At desktop width it rendered fully (opacity 1, `--d` 0-315 ms, 14 animations running). Likely cause (inferred, unverified): the `rise` animation uses `both` fill with a per-block delay, so blocks stay at opacity 0 until their delay passes, and a pane that throttles animations while hidden can leave them stuck. CP-01 also looked empty until the feedback chip was clicked, which fits the same cause. Needs a test in a foreground tab at 375 px before the template is reused.
2. Feedback is localStorage only. No export schema, no reviewer, no history.
3. `api-map.md` is referenced but missing.
4. Single 1 MB file is hard to diff and iterate. Needs source plus a build step.
5. `file://` is refused by the in-app browser pane and the Chrome extension. The POC must be served over `http://localhost`.
6. Compare shows live-app screenshots; their capture method is not recorded anywhere in the file (inferred: manual). The skill needs a `capture` step.

## What this means for the skill
See `~/.agents/skills/poc-harness/SKILL.md` and `TASK.md` in this folder.
