# TSL-BUILD-2026-011 — Acquisition concept: The Senior Read

**Target agent:** the agent maintaining `outputs/acquisition-concept/` (prototype first). §7 gives the production mapping for a later port.
**Depends on:** TSL-BUILD-2026-010 (Overview hierarchy + verdict-first inline brief). Build 010 first; this spec anchors to its structure.
**Date:** 2026-09-28 · **Decision owner:** Lenox
**Scope:** prototype only, deterministic, zero API calls. Production is untouched until §7 is approved separately.

---

## 0. Intent

The brief currently *reports*. It needs to *read back*: a senior deal maker scans the report and pencils in the margin. Some examples of what that sounds like:

- "This number is doing too much work."
- "Repeat isn't recurring."
- "Who holds the license?"
- "You're relaxing a must-have. Say so."

Each margin note is a fork. The operator can:

- push the system to **dig deeper**,
- **bring in their sponsor** (the human capital partner or advisor), or
- **settle it** with a recorded reason.

The operator's dispositions then drive the decision, which is **Advance to QoE / Hold / Pass**. The operator sees what must be true for each option.

**Feel:** alive but quiet. The page behaves like a thoughtful colleague who has already read it, not a chatbot. There is no chat box, no typing animation, no "AI is thinking…" spinner and no confidence percentages.

## 1. Prime directives (binding, from repo CLAUDE.md)

1. **No agent runs in the prototype, so nothing may look like one is running.** All notes are authored fixtures, labelled once per brief as follows: *"Sample annotations: what the panel would flag on this composite. No agents ran."* The draw-in motion (§4) reads as annotation order. It must never read as generation.
2. **Notes are questions and challenges, not findings.** Every note is phrased as something to verify. Numbers in notes must be derived arithmetically from existing fixtures (§3.1). Sector knowledge (licensing, refrigerant rules, working-capital pegs) is framed as *"verify"*, never as a fact about this business.
3. **Nothing is sent.** "Dig deeper" and "Bring in sponsor" produce drafts marked *"Draft · nothing sent"*. In production, both become explicit operator-approved actions (§7).
4. **Unknowns stay unknown.** Settling a note never upgrades evidence. A "settled" note means the operator made a judgment. It does not mean the claim was verified. The UI must keep those two states visually distinct.
5. Personas keep their existing honest labels: The Structuralist, The Restructurer, The Market Analyst, Transition analyst, Red Team. The new synthesis voice is **"The Senior Read"**. It is labelled *Roadmap* in any production-mapping copy because no such module exists yet.

## 2. Experience overview

Four surfaces, one loop:

```
 Overview row ── one-line senior read + open-push count
      │
      ▼
 Inline brief ── margin notes anchored to phrases/numbers
      │            ├─ Dig deeper      → drafted research scope (queued, not sent)
      │            ├─ Bring in sponsor → drafted sponsor question (not sent)
      │            └─ Settle           → operator reason recorded
      ▼
 Thesis tension ── where this deal bends your thesis (must-have relaxed? band fit?)
      ▼
 Decision frame ── Advance to QoE / Hold / Pass, gated by open pushes, recorded in ledger
```

## 3. Content model

### 3.1 Derived figures (compute from existing fixtures; do not hardcode)

| Figure | Formula | Cedar | Forge | Oakline |
|---|---|---|---|---|
| Cash-flow margin | cashFlow ÷ revenue | 29.8% | 12.2% | 59.9% |
| Price / cash flow | price ÷ cashFlow | 3.50× | 3.24× | 2.58× |
| Base debt coverage (business) | cashFlow ÷ annual debt (70% LTV, 10%, 10 yr) | 2.58× | computed | computed |
| Scenario coverage | cashFlow × (1+shock) ÷ debt | 2.06× at −20% | computed | computed |
| Debt-only break-even | 1 − debt ÷ cashFlow | 61.2% | computed | computed |

Use `payment()` from `analytics.js` and the numeric `price` / `cashFlow` fields added in 010.

### 3.2 Note schema (fixture file `senior-read.js`, a data module only, no render overrides)

```js
/* Authored sample annotations. Not agent output. */
const seniorNotes = {
  business: [ // keyed by assetKey; deal-specific copy via fn(deal, derived)
    {
      id: 'margin',
      author: 'The Structuralist',
      anchor: { target: 'story-deck', metric: 'cashFlow' }, // phrase/metric in the brief it attaches to
      weight: 'push',            // 'push' | 'question' | 'noted'  (reading weight, NOT a score)
      text: (d, x) => `${pct(x.margin)} of every revenue dollar reaches cash flow. In an owner-run shop, that is the first number to rebuild from tax returns, less a market-rate manager's salary.`,
      why: 'Every downstream figure (multiple, debt coverage, break-even) inherits this one.',
      dig: { scope: 'Three years of tax returns, the add-back schedule and the owner-compensation history.', prodModule: 'Deal Dossier (deepResearch.getDealDossier) + document request' },
      sponsorAsk: 'Before we pay for QoE: does a ~30% cash margin pass your smell test for residential HVAC, and what add-backs would you disallow first?',
      reacts: null
    },
    // …see §3.3
  ]
};
```

`weight` controls typography only (§4). It is never shown as a number, colour-coded as good or bad, or summed into a score.

### 3.3 Cedar HVAC note set (authored copy; the agent may tighten wording but must not add claims)

| id | Author | Anchor | Weight | Note | Reacts to slider? |
|---|---|---|---|---|---|
| `margin` | The Structuralist | cash-flow figure | push | See §3.2. | no |
| `coupled` | Red Team | the highlighted coverage `mark` | push | "Coverage is computed *from* that cash-flow figure. If add-backs fall away, the cushion shrinks with them. The model and the challenge are not independent." | **yes**: at shock ≤ −40 the text becomes "At {signed(shock)} you're at {coverage}×. Compare that to your lender's minimum coverage covenant before treating it as room." |
| `recurring` | The Market Analyst | "repeat clients" (deal brief) | push | "Repeat isn't recurring. Ask for the maintenance-agreement count, renewal rate and their share of revenue." | no |
| `license` | Transition analyst | "Georgia" | question | "Georgia licenses HVAC work through an individual qualifying agent. If that's the owner, the license may leave with them. Confirm who holds it and the plan to replace them." (verify with the state board) | no |
| `unasked` | The Senior Read | brief footer ("What you may not have raised") | question | A collapsed list of three prompts: (1) a **working-capital peg** that accounts for summer and winter peaks; (2) the **refrigerant transition** (EPA AIM Act equipment changes): inventory and technician-training cost; (3) **technician retention**: who is licensed, and are there retention or non-compete terms? Label: *"Senior checklist: questions to raise, not findings about this business."* | no |

Forge and Oakline each get a minimum of **two** notes, following the same rules:

- **Oakline:** `margin` push. The copy is "60¢ of each revenue dollar reaches cash flow. Someone's work may not be on the payroll." Add a `recurring` question.
- **Forge:** `margin` noted. The copy is "12% is a thinner cushion; small cost moves matter more." Add a `concentration` push: "Commercial project revenue: ask for top-5 customer share and backlog by contract term."

### 3.4 Thesis tension (derived from `thesisDraft` in `investigation.js`, which is shared with the thesis desk)

Render 2–4 lines under the verdict, each tagged **Fits**, **Bends** or **Unknown**:
- **Fits:** "Asking $1.77M sits inside your $1M–$5M band."
- **Fits:** "Cash flow $506k sits inside $300k–$1M." (as reported, unverified)
- **Bends:** "Recurring revenue is a **must-have** in your thesis and isn't established here. Advancing means relaxing it. Record that as an exception or hold."
- **Unknown:** "Management can stay: not assessed."

If the operator flips a priority in the thesis desk (must-have ↔ prefer), the tension lines update on the next brief render. This is the "thesis ramifications" link, and it is local state only.

## 4. Interaction and motion: "alive, subtly"

### 4.1 Layout
- **Desktop ≥ 1100px:** a 240px **margin gutter** to the right of the brief's reading column. Notes sit at the vertical position of their anchor. When two notes collide, stack them with 12px spacing.
- **Anchor treatment:** a thin pencil underline (1px, `--muted`, offset 4px) under the anchored phrase or number. Hovering or focusing an anchor highlights its note and the reverse. The two are also linked with `aria-describedby`.
- **Under 1100px:** notes move inline, directly after the paragraph that holds their anchor, as an indented block with a 2px left rule.
- **Mobile reader (375):** notes appear as a dedicated reader state, `'notes'`. Add a prompt button, "What would a senior partner push on?", to `reader.js`'s prompt row, and add `'notes'` to `readerStates`.

### 4.2 Note anatomy

```
THE STRUCTURALIST · push harder            ← eyebrow, mono 11px
30% of every revenue dollar reaches…       ← serif 15px (push) / sans 14px (question) / muted 13px (noted)
Why it matters ▸                           ← disclosure
[Dig deeper]  [Bring in sponsor]  [Settle…] ← textlinks, 44px targets
```

### 4.3 Motion (all respects `prefers-reduced-motion: reduce`, where notes appear instantly)
- **First open of a brief in a session:** notes draw in **in reading order**. Each anchor's underline draws left-to-right over 500ms, then its note fades and rises 4px over 200ms, with a 350ms stagger. The total must stay under 2.5s. A caption fades in above the gutter at the start: *"Sample annotations · replayed in reading order"*.
- **Re-opening the same brief** shows the notes statically. Draw-in happens once per deal per session (use a `Set`, not localStorage).
- **Slider-reactive notes** (`reacts`) cross-fade their text over 150ms when the threshold is crossed. The anchor underline briefly thickens to 2px for 600ms, which is the only "something changed" signal.
- **Edition bar ticker** (the existing `.edition` header): a quiet right-aligned count, e.g. `5 notes · 3 to push`. It updates in place as the operator settles notes. There are no badges or red dots.
- **Banned:** typing effects, shimmer skeletons, pulsing dots, "thinking", percentages of confidence, colour-coded severity.

### 4.4 The three forks
Each opens inline under the note, never in a modal, and returns focus to the fork button on close.

1. **Dig deeper** shows a drafted research scope:
   - what would be requested (`dig.scope`)
   - which production module would run it (`dig.prodModule`)
   - that the operator must approve spend before it runs

   Footer: *"Draft · nothing sent. In production this becomes a scoped request for your approval."* The **Queue it** button sets the note state to `queued`: the eyebrow reads "queued to dig", and the underline turns dashed.
2. **Bring in sponsor** shows a drafted message block, *editable* in a `textarea`, prefilled with `sponsorAsk` plus an auto-context line: "{deal} · {figure} · open questions: {n}". The **Tag sponsor** button sets the state to `sponsor`: the eyebrow reads "with your sponsor". Footer: *"Draft · nothing sent."*
3. **Settle…** offers three fixed reasons: "Accept the risk", "Out of scope for this deal", "Will address in QoE". There is an optional 160-char note. The state becomes `settled`, and the note collapses to a single muted line: "Settled by you: {reason}". Settled ≠ verified: the anchor underline stays, and the evidence meter does **not** change.

Any state can be reopened via "Reopen".

## 5. Decision frame (bottom of brief, replaces nothing; sits above the footer)

```
WHERE THIS LEAVES YOU
Advance to QoE     What must be true: add-backs reconcile; recurring mix evidenced or thesis exception recorded.
Hold · dig on 2    Queue: margin, recurring.            ← default emphasis while pushes are open
Pass               Record why; the deal stays in history.
```

- Choosing an option records it in the **decision ledger** (below). It never auto-advances anything.
- **Advance to QoE while `push` notes are still open** is allowed only after an explicit acknowledgement checkbox: "I'm advancing with {n} open pushes: {ids}". This is friction, not a block.
- The ledger (a `<details>` in the brief and a one-line state on the Overview row) lists each disposition with a time and actor ("you"). It is session-only state. Label: *"Session only · not saved."*

## 6. Overview integration (the "alive" hint on the front page)

- Each shortlist row (the 010 `compare-row`) gains **one italic serif line**: the top `push` note, shortened. Examples:
  - *Cedar:* "30¢ per revenue dollar to cash flow: rebuild it first."
  - *Oakline:* "60¢ per revenue dollar: someone may be unpaid."
  - *Forge:* "Ask for top-5 customer share."
- The row's evidence cell gains the open-push count and state, e.g. `3 to push · 1 with sponsor`, which updates after dispositions. Nothing else on the Overview animates.

## 7. Production mapping (for a later spec; do not build now)

| Prototype element | Production path | Status |
|---|---|---|
| Persona notes | Existing outputs: `runConsensusScoring` (3 personas), Red Team (`server/routers/agentRouter.ts`), `runThirdSignalPipeline` in `server/agents/index.ts` | Exists: outputs need anchor extraction |
| The Senior Read synthesis | **New pass** over saved agent outputs + thesis, model `GEMINI_STRONG` from `shared/models.ts` (never a literal ID). It must emit notes with an anchor (section + quoted span or metric key) and an evidence reference. **Notes without an anchor are dropped.** Unknown stays unknown. | Roadmap |
| Dig deeper | `deepResearch.getDealDossier(…, forceRefresh)` / `runResearch` with a scoped query; Red Team re-run on reconciled figures. **Requires operator approval before spend.** | Exists: needs scoping and approval UI |
| Bring in sponsor | Notification to a named sponsor on the deal. **Explicit operator send.** Sponsor reply attaches to the note thread. | Roadmap |
| Settle / ledger | Persisted dispositions (new table: `deal_note_dispositions`: noteId, dealId, state, reason, actor, at). Fed back into the next Senior Read as "operator already resolved X". **Never mutates the thesis or evidence automatically.** | Roadmap |
| Demo surfaces | Live-run-then-bake: capture a real Senior Read on a composite deal, freeze it as fixtures | Per directive 2 |

## 8. Build rules
- Add `senior-read.js` (data + one render module) and `senior-read.css`. Integrate by **calling** a `mountSeniorRead()` from the single `renderAnalytics` owner. Do not add another wrapper layer (010 §1).
- Anchors are located by a `data-anchor="<key>"` attribute added at render time in `editorial.js` / `analytics.js` templates. Never locate them by text search at runtime.
- Tokens only. The existing serif/sans/mono stacks only. No new fonts or libraries.

## 9. Acceptance checklist

**Honesty**
- [ ] The label "Sample annotations … No agents ran" is visible once per brief, at both 1440 and 375.
- [ ] Every note's numbers match §3.1 derivations. A grep for hardcoded "29.8" or "2.06" in the note copy finds none; they are computed.
- [ ] Sector notes contain "verify" or "confirm" language.
- [ ] "Draft · nothing sent" appears on every dig and sponsor draft.
- [ ] The network log shows static files only.

**Alive, subtly**
- [ ] First open: notes draw in in reading order, all finished in under 2.5s.
- [ ] Re-open: static.
- [ ] With reduced motion: instant.
- [ ] The slider to −40% changes the `coupled` note text and briefly thickens its anchor. Back to −20% restores the original text.
- [ ] The edition-bar count and the Overview row count update after each disposition.

**Decision**
- [ ] Queue, Sponsor, Settle and Reopen each work, and each returns focus to the originating button.
- [ ] Settling never changes the evidence meter.
- [ ] Advance with open pushes requires the acknowledgement checkbox, which lists the open note ids.
- [ ] Hold is the emphasised option while pushes are open.
- [ ] Flipping "Recurring revenue" to *Prefer* in the thesis desk turns its tension line from **Bends** to **Fits/Unknown** on the next brief open.

**Layout and a11y**
- [ ] Gutter at ≥1100px; inline notes under 1100px; a `notes` reader state at 375.
- [ ] `scrollWidth === clientWidth` at 375.
- [ ] Anchors and notes are linked (`aria-describedby`), keyboard-reachable, with 44px targets.
- [ ] No console errors; `node --check` passes on every JS file.

## 10. Out of scope
Production port (§7), persistence, real sponsor identity and notification, usability testing, and a full WCAG audit. Record the last two as pending in the README.
