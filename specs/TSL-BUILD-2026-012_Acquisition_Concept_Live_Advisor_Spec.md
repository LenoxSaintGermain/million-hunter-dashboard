# TSL-BUILD-2026-012 — The Live Advisor: a comic-strip senior who lives in the page

**Target agent:** the agent maintaining `outputs/acquisition-concept/` (Phase 0). Phases 1–2 are for the production app and need separate approval.
**Depends on:** 010 (verdict-first brief), 011 (Senior Read margin notes, anchors, forks).
**Date:** 2026-09-28 · **Decision owner:** Lenox
**Playbook:** `~/.antigravity/agent-playbooks/third-signal/A2UI_CANVAS_ENGINE.md` (voice layer, closed catalog, "agent decides what, client decides how").
**Sources:** Gemini 3.8 Live docs, read 2026-09-28: [overview](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-8-live), [live avatars](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/configure-live-avatars), [async function calling](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/asynchronous-function-calling), [sessions](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/start-manage-session).

---

## 0. The idea in one paragraph

The Senior Read (011) gets a body and a voice. A small **2D ink-and-halftone character** (a seasoned deal partner) lives in the brief's margin gutter, inside a comic panel. It reads along with the operator. When it calls something out, it **leans out of its panel and points** at the anchored number, and its words appear as a **speech balloon**. The operator can **tap to talk**. The character answers in voice through Gemini 3.8 Live, while the client moves the page to match: it highlights anchors, opens notes, sets the scenario slider and drafts a dig or sponsor note. Every exchange becomes a **panel in a strip**, and the strip is the conversation record. Nothing is photoreal, nothing is 3D, and no realistic lip-sync is attempted.

## 1. Decision: do NOT use Gemini "live avatars"

Gemini 3.8 Live's avatar feature (`response_modalities: ["VIDEO"]` + `avatar_config`) generates **real-time video of a talking human face**. The source is either a prebuilt human avatar (e.g. `avatar_name: "Ben"`) or a customer-supplied **face photo** (`customized_avatar`, select customers only, with consent and likeness obligations). That is precisely the uncanny-valley path. It also cuts sessions short: **audio+video sessions cap at 2 minutes** without compression, against 15 minutes for audio-only.

**Architecture instead:**
- Live runs **audio-out only**, with `input_audio_transcription` and `output_audio_transcription` enabled.
- The client renders the character itself. Output-audio amplitude drives the mouth, transcripts drive the balloons, and tool calls drive gestures and the page.
- This keeps the look fully on-brand and themeable (light/dark), keeps cost down, and follows A2UI Law 1: *the agent decides what, the client decides how.*

## 2. Art direction

- **Style:** European *ligne claire*. Uniform ink line, flat fills, no rendered shading. Add **Ben-Day halftone dots** for tone, drawn with SVG `<pattern>` fills in the existing tokens (`--ink`, `--bone`, `--paper`, `--amber` at low alpha). It should read like the newspaper the prototype already is.
- **Character:** a fictional archetype, not a likeness of any real person. Late-50s, reading glasses pushed up or down, rolled sleeves, a pencil behind one ear. Warm, dry, unhurried. Placeholder name "The Senior". **Open decision for Lenox:** final name and look.
- **Format:** SVG sprite set, one `<symbol>` per pose, so line colour and halftone follow theme tokens. No raster frames. No 3D. No blend-shape faces.
- **Pose set (minimum 11):**

| Pose | Used when |
|---|---|
| `idle` (2 frames: settle and breathe, 4s loop, ±1px) | nothing happening |
| `reading` (eyes down, page in hand) | brief first opens; draw-in of 011 notes |
| `listening` (head tilt, glasses down) | mic open / user speaking |
| `thinking` (pencil to chin) | **only while a tool call is actually in flight** |
| `talk-closed`, `talk-mid`, `talk-open` | mouth frames driven by audio amplitude |
| `point-left`, `point-down` (leans past the panel border) | `point_to_anchor` tool |
| `skeptical` (one eyebrow, glasses lowered) | voicing a `push` note |
| `nod` | operator settles or queues something |

- **Blink:** swap eyes every 4–9s at random, 120ms.
- **Asset provenance:** commissioned or generated, then hand-cleaned. Record provenance with the `signal-stage-library` skill (Asset DNA, lineage, approval state). Never regenerate an approved asset.

## 3. How it "lives in the page"

- **Home panel:** a 132×160 bordered comic panel (`border-radius: 0`, 1.5px `--ink` border) pinned at the top of the 011 margin gutter. It stays sticky within the brief while scrolling.
- **Breaking the frame:** when pointing, the character's arm (a separate SVG group) extends *past* the panel border. A **balloon tail** draws from the panel to the anchored phrase with a 1px ink path, and the anchor underline goes 2px (011 §4.1). This is the single "wow" gesture. Keep it rare: one per turn at most.
- **Balloons:**
  - Rectangular with clipped corners (still `border-radius: 0`) and a comic lettering face from local system fonts. No web fonts.
  - Text streams from `output_audio_transcription` in *phrases*, not letter by letter (no typewriter effect).
  - At most two balloons are visible. Older ones slide into the strip.
- **The strip:** below the home panel sits a vertical column of small panels. Each panel is one turn: a pose thumbnail, a balloon and any tool effect (e.g. "moved scenario to −40%"). Clicking a past panel re-highlights what it pointed at. **The strip is the transcript**, so captions are never optional and the accessibility text is there by default.
- **Mobile (375):**
  - The home panel becomes a 64px portrait at the bottom-right of the reader, clear of content.
  - Talking opens a bottom sheet with the strip.
  - Pointing scrolls the anchor into view and flashes its underline instead of drawing a long tail.
- **Reduced motion:** poses swap without tweens, tails appear without drawing, and there is no idle breathing.

## 4. Talking to it: Phase 1 production design (Gemini 3.8 Live)

### 4.1 Session
- **Model:** `gemini-3.8-live`. **Server-side registry only.** Add a `GEMINI_LIVE` role constant to `shared/models.ts` **after** it passes a Live probe (§6). Never put the ID in client code (repo model policy + A2UI policy note 2026-09-21).
- **Config:** `response_modalities: ["AUDIO"]`, a prebuilt HD voice (choose by ear from the prebuilt list; record the choice in the registry), `input_audio_transcription: {}`, `output_audio_transcription: {}`, `sessionResumption` enabled, and context-window compression (sliding window) so sessions survive past the 15-minute audio-only cap. Omit `thinkingConfig` (playbook).
- **Transport and auth:** the Vertex Live endpoint uses **OAuth bearer tokens** (`wss://{LOCATION}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1.LlmBidiService/BidiGenerateContent`). Those tokens never go to the browser. Build a **server WebSocket relay** in `server/_core` (Express): the browser streams 16 kHz PCM to the relay, and the relay owns the Live session. The alternative, if the Developer API key serves this model, is the Gemini ephemeral-token pattern already used in Signal Card (`api/index.js` token endpoint). Decide after the §6 probe, not before.
- **Lifecycle:**
  - The session starts **only** on an explicit tap of "Talk it through".
  - It auto-ends after 60s of silence.
  - Handle `GoAway` by reconnecting with the resumption handle. The WebSocket connection itself lives about 10 minutes.
  - Set a per-operator daily session cap in config.
- **Barge-in:** when Live signals an interruption, stop playback immediately and switch to `listening`.

### 4.2 Mouth sync (cheap, stylised, deliberately not realistic)
Run output PCM (24 kHz) through an `AnalyserNode`, and compute RMS every 40ms:
- below threshold → `talk-closed`
- mid → `talk-mid`
- high → `talk-open`

Hold each frame for at least 80ms to avoid flicker. The effect is comic "flap", not visemes.

### 4.3 Closed tool catalog (A2UI Law 1: the agent picks, the client renders)

| Tool | Args | Client effect | Behavior / scheduling |
|---|---|---|---|
| `point_to_anchor` | `anchorId` (enum of 011 anchors) | lean + tail + underline | fast; await inline |
| `open_note` | `noteId` (enum) | expands the 011 note | fast |
| `set_scenario` | `shock` (int −80..30, step 5) | moves the slider; brief + notes recompute | **BLOCKING**: the model must not describe the result before the page shows it |
| `compute` | `metric` (enum: coverage, breakEven, margin, multiple), `shock` | returns the deterministic value from `analytics.js` math | fast. **All numbers the advisor speaks come from this tool, never from model arithmetic.** |
| `get_context` | `section` (enum: brief, thesis, notes, evidence, ledger) | returns the grounded fixture/DB payload | fast |
| `draft_dig` | `noteId`, `scope` | opens the 011 Dig draft **for operator approval** | **BLOCKING**; the draft is never sent by the agent |
| `draft_sponsor_note` | `noteId`, `text` | opens the editable sponsor draft | **BLOCKING**; never sent by the agent |
| `run_research` *(Phase 1b)* | `approvalId`, `query` | runs `deepResearch.runResearch` **only with an operator approval id** | **NON_BLOCKING**; reply with `scheduling: "WHEN_IDLE"` so the advisor mentions results at a natural pause. While it runs, the client sends the model: "Say you're checking and will come back." |

**Explicitly not tools:** settling notes, choosing Advance/Hold/Pass, sending anything, or editing the thesis. **The agent proposes, the operator disposes.**

Handle duplicate calls as the docs recommend: ignore a duplicate while the first is still pending.

### 4.4 System instruction (skeleton)
```
You are The Senior, a seasoned acquisitions partner reviewing a deal brief alongside the operator.
Voice: dry, warm, brief. Two or three sentences per turn. Ask one sharp question at a time.
You challenge; you do not decide. Never recommend buying or passing. Lay out what must be true.
Ground rules:
- Only state figures returned by `compute` or `get_context`. If you don't have it, say so.
- Say "the listing says" / "as reported" for unverified inputs. Unknown stays unknown.
- Sector knowledge (licensing, refrigerant rules, working-capital pegs) is framed as "worth confirming", never as a fact about this business.
- When you reference a specific number or phrase, call `point_to_anchor` first.
- To change what the operator sees, call `set_scenario` / `open_note` before talking about it.
- You may draft a dig or a sponsor note; the operator approves and sends. You cannot settle notes or make the decision.
- If asked for investment, legal or tax advice, say you're not able to give it, and name who would.
Context: {deal brief, 011 notes with anchor ids, thesis tension, evidence states, ledger} via get_context.
```

### 4.5 Guardrails
- A turn in which the model states a number with no `compute` / `get_context` call fires a client-side flag. Log it in the trajectory log (`server/agents` trajectory logger pattern) for review.
- **Operator data:** audio is not stored by default, and the transcript is saved to the ledger only when the operator taps "Keep this conversation".
- **Label:** a truthful "Live" chip only while a real session is connected. Otherwise "Replay" or "Scripted sample" (see §5).

## 5. Demo surfaces and the prototype: Phase 0, zero API

Prime directive 2 applies: public demos (`/walkthrough`, `/brief`, this prototype) **cannot call Live**. So the character is driven by a **timeline player** that consumes the *same event shapes* a Live session emits. That way Phase 2 can bake a real session straight into it.

```js
// advisor-timeline.js: authored for Phase 0; replaced by a captured Live log in Phase 2
const advisorScript = {
  label: 'Scripted sample: authored, not a recorded session', // Phase 2: 'Replay of a recorded session · {date}'
  events: [
    { t: 0,    type: 'pose', pose: 'reading' },
    { t: 1800, type: 'tool', name: 'point_to_anchor', args: { anchorId: 'margin' } },
    { t: 1900, type: 'pose', pose: 'skeptical' },
    { t: 2000, type: 'transcript', role: 'advisor', text: "Thirty cents of every revenue dollar to cash flow." },
    { t: 3400, type: 'transcript', role: 'advisor', text: "In an owner-run shop, I'd rebuild that before anything else." },
    { t: 5200, type: 'tool', name: 'set_scenario', args: { shock: -40 } },
    { t: 5300, type: 'transcript', role: 'advisor', text: "Take forty percent off and you're at {compute:coverage}." },
    { t: 7600, type: 'await_operator', choices: ['Dig into the add-backs', 'Ask my sponsor', 'Keep reading'] }
  ]
};
```

- `{compute:…}` placeholders are resolved at play time from `analytics.js` math, so the numbers are never hand-typed.
- **Phase 0 has no audio.** Balloons plus mouth flaps are driven by a synthetic amplitude envelope derived from the text length. This is honest because it is visibly captioned and labelled *scripted*.
- `await_operator` renders 2–3 **reply chips** in a balloon, styled as the operator's own balloon. Choosing one branches to the next script segment. Keep 3 branches max, each 2–4 turns, all ending at the 011 fork UI.
- A "Talk it through" mic button is present but shows *"Voice runs in the signed-in app. This preview plays a scripted sample."* It is not disabled, and it never fakes a mic session.
- **Phase 2 (live-run-then-bake):** run a real Live session on a composite deal in the authenticated app. Capture events, transcript, tool calls and audio, then freeze them into `advisor-timeline.json` + `audio.webm`. The player gets audio and real amplitude, and the label becomes "Replay of a recorded session · {date}".

## 6. Validation before any Phase 1 code
1. **Live probe.** `scripts/validate-models.ts` probes `generateContent`, which Live models don't serve. Add a `--live` mode: open a Live session with `gemini-3.8-live`, send one text turn, assert that one audio chunk and one output transcription come back, then close. Run it against both the Vertex service account and the Developer `GEMINI_API_KEY`, and record which one serves the model. Only then add `GEMINI_LIVE` to `shared/models.ts` and update the CLAUDE.md model section in the same commit.
2. Confirm prebuilt voice names against the live docs page at build time. Do not copy them from this spec.
3. Measure first-audio latency and interruption behaviour on a 5-turn scripted conversation. Record the results in the ship log.

## 7. Phase 0 build rules (prototype)
- New files: `advisor.js` (player + renderer), `advisor.css`, `advisor-sprites.svg` (symbols) and `advisor-timeline.js` (data). Mount the advisor by calling `mountAdvisor()` from the single `renderAnalytics` owner. Do not add a new wrapper layer (010 §1).
- Reuse 011 anchors (`data-anchor`) and forks. Use the same functions for the advisor's tool effects that the operator's own clicks use (slider, note open, drafts). There is no second code path.
- Local fonts only, tokens only, `border-radius: 0` on panels and balloons.

## 8. Acceptance: Phase 0
- [ ] The character renders in ligne-claire SVG, themeable in light and dark, with no raster faces and nothing photoreal.
- [ ] On first brief open, the character reads, then points at the `margin` anchor with the tail drawn to the phrase. Only one lean-out per turn.
- [ ] The scripted `set_scenario` moves the real slider. The brief headline, notes and spoken balloon all show the same computed coverage (−40% → 1.55× for Cedar).
- [ ] Reply chips branch correctly, and every branch ends at a 011 fork with **drafts only**.
- [ ] The strip lists every turn, and clicking a past panel re-highlights its anchor.
- [ ] The label "Scripted sample: authored, not a recorded session" is visible whenever the advisor is on screen. "Live" never appears in Phase 0.
- [ ] The mic button explains that voice is in the signed-in app, and no `getUserMedia` call is made.
- [ ] Reduced motion swaps poses without tweens. At 375, the portrait and sheet cause no horizontal scroll.
- [ ] The network log shows static files only. No console errors, and `node --check` passes.

## 9. Acceptance: Phase 1 (for the later production spec)
- [ ] The Live probe passes, and `GEMINI_LIVE` is registered server-side with a rollback target.
- [ ] No model ID or credential ever reaches the client bundle (`grep` the build output).
- [ ] First audio arrives within the latency target set after measurement (§6.3). Barge-in stops playback in under 200ms.
- [ ] Every number spoken is traceable to a `compute` / `get_context` call in the trajectory log.
- [ ] The agent cannot settle, decide or send. Attempts are impossible because no such tools exist.
- [ ] A session survives `GoAway` via resumption, and ends after 60s of silence.

## 10. Open decisions (Lenox)
1. The character's name and final look (illustrator vs. generated + cleaned).
2. One advisor, or the five personas as a cast of cameo portraits in the 011 notes with one voice. **Recommended:** one voice, the personas as small ink cameos only.
3. Transport: Vertex server relay vs. Developer-API ephemeral tokens (decided by the §6 probe).
