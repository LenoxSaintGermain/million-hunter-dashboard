# TSL-BUILD-2026-010 — Acquisition concept: Overview hierarchy + inline brief

**Target agent:** the agent maintaining `outputs/acquisition-concept/` (static prototype served by `python3 -m http.server 3118 --bind 127.0.0.1 --directory outputs/acquisition-concept`)
**Surface:** http://localhost:3118/#overview and the inline brief it unfolds
**Scope:** prototype only. Production client/server stay untouched. `outputs/` stays uncommitted unless the operator asks.
**Reviewed:** 2026-09-28, walked at 1440×1000 and 375×812 by Claude Code.

## 0. Prime directives (from repo CLAUDE.md, still binding)
- No new figures, claims or reasoning. Every number in this spec comes from existing fixtures: the `deals` array in `index.html` and the `choose` override in `analytics.js`.
- Zero API calls, no new dependencies, no external fonts.
- Keep every "Illustrative / composite" label.
- Keep the existing tokens (`--bone --paper --ink --rule --muted --sage --amber`). No new visual language.

## 1. Build rule: edit in place, no sixth wrapper
The prototype already stacks five `renderAnalytics = function(){ prev(); … }` wrappers (analytics → editorial → dossier → investigation → reader). **Do not add another override file.** Make each change in the file that owns the behaviour, at the line references below. The line numbers match the current single-line-per-statement files.

## 2. Findings (what the review saw)

| # | Severity | Finding | Where |
|---|---|---|---|
| F1 | Bug | The inline brief renders **two** "Fold away analysis ↑" buttons | `editorial.js:19` and `:20` both create one |
| F2 | Bug | Scenario labels use a hyphen: "-20%" | every `${shock}%` |
| F3 | Hierarchy | Two competing headlines. "A clearer path to your next deal." (slogan h1) sits above the real lead (h2) | `index.html` `#overview .heading`, `editorial.js:23` |
| F4 | Hierarchy | The same 3 businesses are listed twice with different data: lead bar chart (multiples) and shortlist (asking) | `editorial.js:23` `.focus-aside`, `#overview-list` |
| F5 | Hierarchy | The primary action is a text link ("Unfold the Cedar analysis ↓"). The original `button.primary` is gone | `editorial.js:23` |
| F6 | Noise | 3 / 0 / 0 metric strip, where two of the three hero numbers are zero | `index.html .metric-strip` |
| F7 | Redundancy | Three entry points to the thesis: nav "Your thesis", "Search settings ↗", "Review your criteria →" | `index.html` |
| F8 | Clarity | "1/6 supported" badge is identical on all rows and never explained | `index.html` overview-list renderer |
| F9 | Flow | Unfolding inserts the brief after the whole overview section, far below the trigger | `editorial.js:19` `origin.after(brief)` |
| F10 | Hierarchy | Desktop opens the brief on a table of contents ("Follow the evidence."). The verdict and the pressure test sit about 3 disclosures deep. The mobile reader leads with the verdict, 2.06× and bars, which is the better pattern | `investigation.js:10,16` |
| F11 | Coherence | The asset-type tabs (Operating business / Income property / Public equity / Unmapped) sit at the top of *Cedar HVAC's* brief. They demo the template, not this deal | `editorial.js:11` `.asset-tabs` |
| F12 | Noise | The mobile reader shows a disabled "← Back" on first view | `reader.js:13` |

## 3. Changes

### 3.1 Bugs

**F1: one Fold button, brief anchored to its trigger (also fixes F9).** Add module state and replace `editorial.js:18–20`:

```js
let unfoldAnchor=null,unfoldTrigger=null;
document.addEventListener('click',e=>{if(!e.target.closest('[data-close-brief]'))return;const host=$('inline-brief');$('main').append($('deal'));$('deal').hidden=true;host.remove();(unfoldTrigger||document.querySelector('[data-route="overview"]')).focus()});
choose=function(i){fullBriefChoose(i);const host=$('inline-brief');if(host)host.remove();const origin=document.querySelector('[data-inline-origin]');if(!origin)return;
 const brief=document.createElement('div');brief.id='inline-brief';const close=document.createElement('button');close.textContent='Fold away analysis ↑';close.className='textlink';close.setAttribute('data-close-brief','');brief.append(close,$('deal'));
 (unfoldAnchor&&origin.contains(unfoldAnchor)?unfoldAnchor:origin).after(brief);
 $('deal').hidden=false;document.querySelectorAll('.screen').forEach(s=>{if(s.id!=='deal')s.hidden=s.id!==origin.dataset.inlineOrigin});history.replaceState(null,'','#'+origin.dataset.inlineOrigin);brief.scrollIntoView({block:'start',behavior:'auto'});origin.removeAttribute('data-inline-origin')};
document.addEventListener('click',e=>{const b=e.target.closest('[data-deal]');if(!b)return;shock=-20;const s=b.closest('.screen');if(!s||s.id==='deal')return;const old=$('inline-brief');if(old){$('main').append($('deal'));old.remove()}s.setAttribute('data-inline-origin',s.id);unfoldTrigger=b;unfoldAnchor=b.closest('.list-row, .lead, tr')},true);
```

The `queueMicrotask` second-button block is deleted. For table rows (`tr`) on the Opportunities screen, `after()` would put a `div` inside `tbody`. In that case, fall back to the table's wrapper: `anchor=b.closest('.list-row, .lead')||b.closest('table')`.

**F2: real minus sign.** Add next to `money` in `analytics.js`:

```js
const signed=n=>(n>0?'+':n<0?'−':'')+Math.abs(n)+'%';
```

Replace every display occurrence of `${shock}%` and `shock+'%'` with `signed(shock)`:
- `editorial.js:5, 7` (twice), `11`, `13`
- `dossier.js:6`
- `investigation.js:11, 20`
- `reader.js:12, 17, 19`

Do not change range-input `value`s or the `reader-form` parser. `highlightBrief()` re-derives its match string from `editorialView()`, so it stays in sync automatically.

### 3.2 Overview (`index.html` `#overview`, `editorial.js:21–23`, `editorial.css`)

**Fixture: add numeric fields** to each `deals` entry (the same values `analytics.js` `choose` already uses):
- Cedar: `price:1770000, cashFlow:506000`
- Forge: `price:1100000, cashFlow:339000`
- Oakline: `price:1000000, cashFlow:388000`

**Replace the `#overview` section markup** (F3, F5, F6, F7):

```html
<section class="screen" id="overview">
 <header class="masthead">
  <p class="eyebrow">Southeast essential services · saved search · Sep 28 snapshot</p>
  <p class="status-line small muted">3 to review · none fully assessed · no seller contact</p>
 </header>
 <div class="lead">
  <span class="eyebrow">The lead / illustrative acquisition analysis</span>
  <h1>Three asking prices.<br>One unanswered question: durable cash.</h1>
  <p class="lead-deck">A low multiple is only useful when the cash survives the handover. Compare the economics, then investigate what supports them.</p>
  <div class="lead-action">
   <button class="primary" data-deal="0">Open the Cedar analysis ↓</button>
   <p class="small muted">Cedar HVAC fits your price range. Recurring revenue and owner dependence still need evidence.</p>
  </div>
 </div>
 <div class="columns">
  <section aria-labelledby="shortlist-h">
   <div class="row section-head"><h2 id="shortlist-h">Your shortlist</h2><button class="textlink" data-route="opportunities">Compare all →</button></div>
   <p class="small muted list-caption">Price / cash flow · illustrative multiples, not quality rankings · zero-based, same scale. Evidence: each business has 1 of 6 thesis criteria supported (operating history) in this snapshot.</p>
   <div id="overview-list"></div>
  </section>
  <section class="pad compact">
   <div class="eyebrow">Your search</div><h2 style="margin-top:10px">Essential services</h2>
   <p class="muted">HVAC &amp; plumbing · Southeast US</p>
   <div class="factline"><span class="muted">Asking price</span><strong>$1M–$5M</strong></div>
   <div class="factline"><span class="muted">Cash flow</span><strong>$300k–$1M</strong></div>
   <div class="chipset"><span class="badge">Recurring revenue</span><span class="badge">Retained management</span></div>
   <button class="textlink" data-panel="thesis" style="margin-top:12px">Edit thesis →</button>
  </section>
 </div>
 <p class="notice">Illustrative results · fixed September 28 snapshot. No search or seller outreach runs in this prototype.</p>
</section>
```

- The lead copy is reused verbatim. The reason line is the original fixture copy from the old `.focus` block.
- Before removing the "Search settings ↗" button, check whether `panels.search` holds anything `panels.thesis` lacks. If it does, fold that content into the thesis desk (`investigation.js` `thesisDesk()`) instead of dropping it.
- **Delete `editorial.js:21–23`.** The lead now lives in markup.
- The copy "operating history" comes from the existing `criteria` block ("Operating history · 20% / Source support only"). Confirm it before shipping.

**Replace the overview-list renderer** (F4, F8):

```js
const MULT_MAX=4;
$('overview-list').innerHTML=deals.map((d,i)=>{const m=d.price/d.cashFlow;return `<div class="list-row compare-row">
 <span class="icon" aria-hidden="true">${String(i+1).padStart(2,'0')}</span>
 <div class="grow"><h3>${d.name}</h3><p>${d.industry} · ${d.location}</p></div>
 <dl class="row-figures"><div><dt>Asking</dt><dd>${d.ask}</dd></div><div><dt>Cash flow</dt><dd>${d.cash}</dd></div></dl>
 <div class="row-multiple"><span class="multiple-value">${m.toFixed(2)}×</span><span class="multiple-track" aria-hidden="true"><span style="width:${(m/MULT_MAX*100).toFixed(1)}%"></span></span></div>
 <div class="row-evidence"><span>1 of 6 evidenced</span><span class="coverage" aria-hidden="true"></span></div>
 <button data-deal="${i}" aria-label="Review ${d.name}">Review →</button></div>`}).join('');
```

The multiples must reproduce the current lead: 3.50× / 3.24× / 2.58×.

**CSS** (append to `editorial.css`, tokens only):

```css
.masthead{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;border-bottom:1px solid var(--rule);padding-bottom:12px;margin-bottom:28px}
.lead{border-bottom:1px solid var(--ink);padding-bottom:32px;margin-bottom:32px}
.lead h1{font:clamp(32px,3.6vw,50px)/1.08 'Fraunces',Georgia,serif;letter-spacing:-.025em;margin:12px 0 16px;max-width:22ch}
.lead-deck{font-size:17px;max-width:56ch}
.lead-action{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-top:24px}
.lead-action p{max-width:44ch}
.compare-row{display:grid;grid-template-columns:38px minmax(0,1.4fr) minmax(150px,1fr) minmax(120px,.9fr) 110px auto;gap:18px}
.row-figures{display:flex;gap:18px;margin:0}.row-figures dt{font-size:12px;color:var(--muted)}.row-figures dd{margin:0;font-variant-numeric:tabular-nums}
.multiple-value{font-variant-numeric:tabular-nums;font-weight:600}
.multiple-track{display:block;height:6px;background:var(--rule);margin-top:6px}.multiple-track>span{display:block;height:6px;background:var(--ink)}
.row-evidence{font-size:12px;color:var(--muted)}
.list-caption{padding:0 0 12px}
@media(max-width:800px){.compare-row{grid-template-columns:1fr auto;grid-template-areas:"name btn" "fig fig" "mult ev"}.compare-row .icon{display:none}.compare-row .grow{grid-area:name}.compare-row>button{grid-area:btn}.row-figures{grid-area:fig}.row-multiple{grid-area:mult}.row-evidence{grid-area:ev}.masthead{display:block}}
```

Remove the now-unused `.focus-main h2` / `.focus-aside` overrides in `editorial.css` (lines 10–13, 49–50) and the `.metric-strip` markup.

### 3.3 Inline brief: verdict first (F10, F11)

**`investigation.js:10`.** Stop hiding the story and the pressure test. The order becomes story header → metrics → pressure test → evidence map:

```js
spread.after(map); // was: story.before(map);story.hidden=true;metrics.hidden=true;spread.hidden=true;
```

**`investigation.js:16`.** Delete the whole `if(id==='finance'){…model-reveal…}else{…}` branch. The pressure test is always visible, so no reveal moves it.

**`investigation.js:9`.** Demote the map heading: `<h1>Follow the evidence.</h1>` → `<h2>`. Update the selector in `investigation.css` from `.map-intro h1` to `.map-intro h2`. The page keeps a single h1 (the story headline).

**`editorial.js:11`.** Move the asset tabs out of the header. Remove the `<div class="asset-tabs">…</div>` from its current spot and emit it just before `<footer class="edition">`:

```html
<details class="reveal asset-demo"${assetKey!=='business'?' open':''}>
 <summary>See how this template handles other asset types</summary>
 <p class="small muted">Template demonstration on composite inputs, not alternatives to ${p.name}.</p>
 <div class="asset-tabs" aria-label="Illustrative asset examples">…existing buttons…</div>
</details>
```

The `open` attribute survives the re-render in `editorial.js:12`, so the existing focus call keeps working. When `assetKey!=='business'`, the story eyebrow must still carry the composite asset's `p.name`. That already happens.

Keep `highlightBrief()`, `#map-ratio` sync and the slider listeners (`investigation.js:19–21`, `dossier.js:34`). They bind to elements that still exist.

### 3.4 Mobile reader (F12)
In `reader.js:13`, render the Back button only when there is history:

```js
${readerBack.length?'<button id="reader-return">← Back</button>':''}
```

Then guard the binding at `reader.js:15`: `if($('reader-return'))$('reader-return').onclick=…`.

## 4. Acceptance checklist (the build is done when every box passes)

**Desktop 1440×1000**
- [ ] `#overview` has exactly one `h1` (the lead).
- [ ] No slogan, no 3/0/0 strip, no "Search settings ↗".
- [ ] One primary button, "Open the Cedar analysis ↓".
- [ ] One shortlist showing 3.50× / 3.24× / 2.58× bars on a shared scale, with the caption visible.
- [ ] The primary button and each row's Review open the brief **directly below the trigger**.
- [ ] Exactly one "Fold away analysis ↑".
- [ ] The hash stays `#overview`.
- [ ] Fold returns focus to the button that opened the brief.
- [ ] Without extra clicks, the brief shows the headline "The debt fits. The quality of the cash is the question.", the highlighted 2.06× and the pressure-test chart with slider. "Follow the evidence" sits below them.
- [ ] Slider to −80%:
  - headline "The downside now outruns the debt cushion."
  - 0.52× in the deck, in `#map-ratio` and in the finance inquiry claim
  - every label shows "−80%" (U+2212)
- [ ] Forge → Review shows Forge's figures (the `analytics.js` choose override), not Cedar's.
- [ ] Asset tabs appear only inside the closed "other asset types" reveal. Switching to Income property and back to Operating business works and keeps the reveal open.

**Mobile 375×812**
- [ ] `document.documentElement.scrollWidth === clientWidth`.
- [ ] Shortlist rows stack as labelled records.
- [ ] The reader shows no Back button until a second view is opened.

**Always**
- [ ] `node --check` passes for every `.js` file.
- [ ] No console errors.
- [ ] The network log shows static files only.
- [ ] Every "Illustrative / composite / zero API calls" label is still present.

## 5. Out of scope
Opportunities table redesign, thesis desk, production `client/` port, usability testing and a full WCAG audit. Note the last two as pending in the README.

## 6. Deliverables
1. The code changes above.
2. A README note, "Overview hierarchy iteration — TSL-BUILD-2026-010", in the existing house style: what changed, what was verified, what is pending.
3. Before and after captures at 1440 and 375.
