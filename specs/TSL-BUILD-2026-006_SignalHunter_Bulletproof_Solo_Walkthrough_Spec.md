# TSL-BUILD-2026-006 — Signal Hunter: Bulletproof Solo Walkthrough
**Target agent:** Manus | **App:** Signal Hunter OS (`million-hunter-dashboard`)
**Supersedes/absorbs:** TSL-BUILD-2026-004 Part B (investor brief). Build ONE self-guided artifact, not two.
**Depends on:** TSL-BUILD-2026-004 Part A (fabricated testimonials + "Live" badge fixes) ships first.

---

## 0. Context & Prime Directive

A real prospect session (Jim, evaluating for a family-office/attorney buyer) exposed exactly where the solo experience breaks. Jim could not navigate alone — he hit login walls, role restrictions, unexplained buttons, and token gates, and needed live narration to understand anything.

**Prime directive:** Build a walkthrough that **anyone can run completely solo — no operator narration, no login, no dead-ends — and come away understanding the value.** It must be impossible to break, impossible to get lost in, and self-explanatory at every step. Jim will screen-share this to a live prospect on a clock. It cannot fail, cost tokens, or confuse.

Three words, all mandatory: **bulletproof** (can't break), **solo** (no help needed), **gets it** (value lands).

---

## 1. The Four Hard Requirements

### 1A. ZERO-FRICTION ACCESS — kill the login walls
The #1 failure in the Jim session: in-demo actions bounced him to a login screen ("run this on a real deal" → login).
- The **entire walkthrough is public, no auth, ever.** One URL, works immediately, no logged-in state required, no refresh-for-latest gymnastics.
- **No in-demo action may redirect to login, roles, or permissions.** Every "run," "try," "scan," "analyze" button executes *in the demo on sample data.* The demo is a self-contained sandbox that does not touch the real app's auth/role/token system at all.
- The only place auth appears is a clearly-separated, optional end CTA: **"Want to run your own deals? Log into the live app →."** That is a door, never a wall, and never mid-experience.

### 1B. SELF-NARRATING — kill the "what does this do?"
Jim had to ask what buttons did ("initiate outreach — what does that do?").
- The walkthrough is **on-rails and guided** — a stepped path with Next, a persistent progress indicator (so the user knows it's finite and where they are), and a clear beginning/middle/end. Not a free-roam dashboard the user has to figure out.
- **Every interactive element explains itself** inline — a label or annotation stating what it is and why it matters, before or beside the interaction. Zero unexplained controls.
- Each section leads with plain-language **What it is → Why it matters (the loss it prevents)** before any interaction.

### 1C. BULLETPROOF — deterministic, cached, zero-API
- **Every simulator is pre-baked, deterministic, and makes zero live API calls.** No token cost, no latency, no failure mode. Reuse the composite deals as fixtures. (Same discipline as the cached demo route.)
- **No token-gating, no role-restriction, no sponsor-must-run-it** anywhere in the walkthrough. It's "god mode" because it's all pre-computed — everything the user clicks just works.
- Fully responsive — flawless on a laptop in a meeting and on a phone.

### 1D. GETS IT — the comprehension arc
The user must finish understanding: the problem, the wedge, the differentiation, and the proof — without anyone explaining it to them. See the walkthrough structure in §2. The centerpiece is the landmine-catch (§2.3); that is the moment it clicks.

---

## 2. Walkthrough Structure (on-rails, each step self-narrating)

1. **The problem.** "Most deals fail before they close." The stakes: a bad acquisition + $40–50K wasted on QoE. [static]
2. **What this is.** One line: the diligence engine that catches what kills a deal *before* you spend. [static]
3. **THE GET-IT MOMENT — catch the landmine.** "Here's a real acquisition that fell apart — anonymized, and only the numbers the buyer had before they closed. Watch what our engine caught." Paced reveal of the Red Team surfacing the landmine, ending: "The engine flagged it in seconds. The buyer found out in month seven." [deterministic sim — this is the section that sells]
4. **How it works — the engine.** Brief guided tour: Thesis → IC Review → Red Team → Capital Stack → Memo/LOI. Each: one-line what/why + a small inline demo on the sample deal. [deterministic sims]
5. **Where the data comes from.** Proactively answer the question Jim asked five times — in the *differentiated* framing, not the commodity one: on-market listings (LoopNet/CoStar/broker sites) are table stakes everyone already sees; the value is the **off-market signals and broker blind-spots the agents surface** (e.g., "the Amazon warehouse driving foot traffic — its lease ends in a year"). Honest about public-data sourcing (county/government records, public web) + the insight layer on top. [static, optionally a small sim]
6. **Why you can trust it — the backtest.** The costly signal: the engine was tested against documented failed deals using only pre-close data, and it catches what killed them. Show the real rigor-gate results, labeled. [real data, labeled]
7. **The value / who it's for.** Family offices — capital to deploy without big-PE infrastructure. "Before you spend $40–50K on QoE, this tells you which deals are even worth it." The moat: not competing with what they do, saving them money before they waste it. [static]
8. **Get the real thing.** The single, clearly-labeled, optional CTA: "Want to run your own deals? Log into the live app →." [door, not wall]

---

## 3. Separation from the real (gated) app — architecture note

Do NOT try to make the real, role-gated, token-controlled app "solo-friendly." That gating (investor discovers/tags, sponsor runs analysis to control token burn) is correct for the live product — and it's exactly what broke Jim's solo run. **Build this walkthrough as a standalone, auth-free sandbox that lives alongside the real app**, shares its look, and hands off to it only via the final optional login CTA. The walkthrough never reads roles, never checks tokens, never calls the live analysis pipeline.

---

## 4. Honesty guardrails (carry forward from 004 Part A)
- **No fabricated testimonials, metrics, logos, or traction** anywhere in the walkthrough.
- Simulators labeled **"Interactive Demo — sample composite deal."**
- Nothing claims "Live" that isn't. Anything forward-looking labeled **Roadmap** / **Projection**.
- The composite deals stay labeled composite.

---

## 5. Design direction
- Use the existing Signal Hunter design system (`--sh-*` tokens in `client/src/index.css`). Do not invent a new visual language.
- Investor-grade polish: guided, deliberate, premium. Smooth transitions, restrained motion, clear progress.

---

## 6. Acceptance Criteria — "MUST NOT HAPPEN" (mapped to Jim's session; all testable)
Run the walkthrough end-to-end **logged out, on a fresh browser**, and confirm:
- [ ] **No action anywhere redirects to a login/auth screen** (except the single explicit end CTA).
- [ ] **No role or permission gate blocks any demo action** — every button in the walkthrough executes on sample data.
- [ ] **No token gate / "sponsor must run this"** stops any step.
- [ ] **Zero live API calls** on the entire walkthrough (verify in network tab) — nothing can fail or cost money.
- [ ] **Every interactive element has an inline explanation** — no unexplained buttons.
- [ ] **Works at one public URL** with no logged-in state and no refresh ritual required.
- [ ] **A persistent progress indicator** is present; the path has a clear start and finish.
- [ ] **Fully functional on mobile and laptop.**
- [ ] **No fabricated testimonials/metrics/logos;** all demos labeled; Roadmap items labeled.
- [ ] The data-source section addresses sourcing in the **off-market/insight** framing, not the commodity-scraper framing.

## 7. Report back with
- The walkthrough URL.
- A network-tab confirmation of **zero API calls** across the full flow.
- Confirmation the walkthrough shares no auth/role/token code path with the live app.
- Any element you could not make deterministic or self-explanatory — flagged, not faked.
