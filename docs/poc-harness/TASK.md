# TASK: build a POC bundle with the `poc-harness` pattern

Give this file, unchanged, to Grok Build and then to the Codex harness. Fill in the CANDIDATE block first. Both agents are graded against the same CHECKLIST at the bottom.

## CANDIDATE (fill in)
- Idea / product name:
- One-line problem it solves:
- Audience for the POC (who reviews it):
- Does a live app already exist to compare against? (URL or "no"):
- Backend that exists today (endpoints, repos, or "none"):
- Screens or flows you already know you want (optional):

## Goal
Produce a single-file, offline-capable, clickable proof of concept for the candidate, plus the contracts that tie it to the backend and a built-in feedback harness, so a reviewer can walk it, leave per-screen feedback, and export that feedback for the next iteration.

Reference: `docs/poc-harness/NOTES.md` (what the Signal Hunter POC does and why). If you cannot read it, the acceptance criteria below are self-contained.

## Hard rules
1. **Zero runtime network.** No fetch, XHR, websocket, CDN script, or web font URL at runtime. Fonts: system stack or inlined.
2. **No fabrication.** Every figure on screen carries a data label: `LIVE · CAPTURED <date>` (copied from a real read-only source with a stored capture), `EXAMPLE DATA`, or `MOCK`. No invented customers, quotes, logos, or metrics.
3. **Every screen has**: a stable ID (e.g. `HM-01`), a title, a one-line intent, an API status (`LIVE API` / `PARTIAL` / `PROPOSED`) with the endpoint it would use.
4. **No secrets** in the output. No keys, tokens, or private URLs.
5. **Label gaps honestly.** If something cannot be captured, sourced, or built, say so on the screen and in the report. Do not paper over it.
6. If a live app exists, include a **Compare** screen: live capture on the left, POC on the right, a one-line caption of what changed, and a "seams fixed" list.

## Deliverables (exact names)
- `poc.html`: one file, under 1.5 MB, works when served from `http://localhost` (note: `file://` is blocked in some viewers; say how you served it).
- `screens.json`: array of `{id, group, title, intent, api: "LIVE API"|"PARTIAL"|"PROPOSED", endpoint, dataLabel, liveCapture}`.
- `api-map.md`: generated from `screens.json`, grouped by status, one row per endpoint.
- `feedback.schema.json` and a sample `feedback.sample.json` that the harness can export: `{buildId, reviewer, exportedAt, items: [{screenId, status: "approved"|"changes"|"none", note, ts}]}`. Reference schema: `~/.agents/skills/poc-harness/contracts/feedback.schema.json`.
- `BUILD.md`: build id (date + short hash), how it was served, what was captured and when, known gaps.

## Required behaviours
1. **Screen index** screen listing all screens grouped, with API status tags, links, "Copy all feedback", "Download feedback (.json and .txt)", "Reset POC state".
2. **Feedback chip** on every screen: shows screen ID, title, intent bullets, note box, Approve / Request changes, Copy all, saved status. State in localStorage with try/catch so the page works with storage blocked. Export must include a reviewer name field set once.
3. **Self-presenting walkthrough** of the core flow in about 75 seconds: 5 steps, step tabs, Back / Autoplay / Next.
4. **At least four infographics that show a rule, not just a number** (for example a checks ring with one failing dot, a countdown timeline, a limit/headroom bar, a concentration donut, a saved/cost comparison). Each has a caption stating the rule in plain words.
5. **Motion contract**: 150-600 ms, ease-out, pure CSS opacity/transform, never blocks input, plays only on route change, staggered reveal in reading order, count-ups for hero numbers, one shared tooltip for `[data-tip]` (hover, focus, tap, Esc), and everything disabled under `prefers-reduced-motion`.
6. **Tokens**: CSS custom properties for color, type, radius, easing, defined once. Dark mode via `prefers-color-scheme`. State the real design system you mapped to, if any.
7. **Responsive**: usable at 375 px width with no horizontal scroll and no blank regions while animations run.

## CHECKLIST (run it and report each line pass/fail with evidence)
1. Serve over localhost and open `poc.html` in a real browser. Paste the URL used.
2. Walk every screen in `screens.json`. List any that render blank, overflow, or 404 within the app.
3. Network audit: open devtools network tab (or grep the file) and confirm zero requests after load.
4. Label audit: pick 5 numbers at random from different screens. Show each one's data label.
5. Export audit: leave feedback on 3 screens, export JSON, validate against `feedback.schema.json`.
6. Reduced-motion audit: emulate `prefers-reduced-motion: reduce` and show that nothing animates and all content is visible.
7. Mobile audit: emulate 375x812, screenshot Home and one infographic screen, confirm no blank gap above the first card.
8. Size budget: report bytes of `poc.html`.
9. Compare screen present (or state "no live app").
10. Report remaining gaps and what you did not do.

## Report format
One short section per checklist line, then "Remaining risk". Do not claim anything you did not run.
