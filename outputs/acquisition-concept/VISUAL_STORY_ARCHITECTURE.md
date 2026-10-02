# Visual story engine — proposed architecture

Status: researched catalog and implementation plan, not a production integration. September 29, 2026.

## Decision

Code owns eligibility, math, scales, layout and rendering. An optional small model chooses an editorial angle from already eligible patterns. It returns a bounded recipe, never SVG, JavaScript, numbers, formulas or arbitrary chart specifications. Deterministic selection works without it. No model call on page view or slider movement.

Research completion → normalize facts → calculate derived facts → enumerate eligible patterns → rule-based ranking → optional editorial selection → validate → store recipe → render responsive SVG/HTML.

Generate once per immutable input version, not once per asset forever. A recipe is reusable across desktop, mobile, exports and the advisor. Each rendering remains interactive and accessible rather than becoming a flattened image.

## Initial pattern library

| ID | Question | Required inputs | Honest fallback |
|---|---|---|---|
| target-range | Does this meet my bounds? | value, min/max, identical units and basis | Display missing input; never position unknown at zero |
| cash-bridge | Where does the cash go? | reconciled signed components, period/currency, formula lineage | Component table if totals do not reconcile |
| threshold | How close are we to a limit? | observed/scenario value and named threshold | No threshold inferred from a generic industry label |
| scenario-comparison | What changes under assumptions? | common metric and explicit assumption sets | Unweighted scenarios, never invented probabilities |
| concentration | What dominates exposure? | components with known common denominator | Show unallocated remainder; no pie from partial totals |
| evidence-matrix | What remains to establish? | named requirements, provenance and explicit states | Unknown remains unknown, not a zero quality score |
| paired-change | What changed since the previous report? | comparable dated versions and definitions | Mark definition changes rather than plotting false deltas |

Every pattern includes a takeaway, caption, source/assumption reveal, accessible numeric table and a mobile layout. No hover-only evidence. Color is redundant with text, shape or hatching. Financial inputs remain reported/unverified when appropriate. Missing evidence is not a statistical confidence interval.

First hero: cash-bridge for Cedar, followed by target-range for asking price and reported cash flow, then evidence-matrix for recurring revenue and management. At -40%: $506,000 → $303,600 → $107,118 before omitted costs, using unrounded annual debt internally. Negative remainder must render below zero and change the caption; no clipped positive-only bars. The bridge is not approval or verified free cash.

## Contracts

Fact: id, metricDefinitionId, assetId, value|null, unit, currency, period, basis, sourceIds, sourceAsOf, evidenceState, derivedFrom[], formulaVersion.

Recipe: schemaVersion, patternId, assetId, researchVersion, thesisVersion, factBindings, assumptionBindings, headlineTemplateId, captionTemplateId, emphasisFactIds[], caveatIds[], selectorVersion, rendererVersion.

Model output is limited to candidateId and an allowed angleId. Validate membership against the eligible candidate set; bind numbers and caveats in code. On invalid output, timeout or provider failure, use deterministic ranking. Do not trust instructions embedded in research documents. Model selection receives minimal normalized facts, not credentials or raw account records.

Adapters map business cash flow, property NOI, equity earnings and other asset definitions explicitly. The shared renderer does not equate these measures. Unsupported asset types render an evidence/inputs view rather than invented valuation math.

## Cache and jobs

Tenant-scoped SHA-256 key over canonical normalized facts, evidence/source versions, thesis bounds/version, assumptions, metric/formula versions, catalog version, selector/prompt version and locale where text differs. Use canonical serialization; include null distinctly from zero. Never cross account boundaries.

Persist recipe + computed fact snapshot + provenance; optional SVG export has an additional renderer/theme/export-size key. Unique database key plus job lease deduplicates concurrent workers. States: pending, ready, failed, superseded. Retries are bounded and idempotent. Publish only if the research version still matches; an older worker cannot overwrite a newer recipe. Existing stale assets can be displayed only with a stale label and their actual timestamp.

Slider changes derive ephemeral facts in-browser from the same tested functions; no LLM regeneration. Saving a scenario creates a new version. New research, changed evidence, changed thesis bounds or formula fixes invalidate the affected recipe. Theme or viewport changes rerender without research or editorial selection calls.

## Delivery order

1. Pure calculation/eligibility functions and fixtures: zero, missing, negative, out-of-range, incompatible units and stale sources.
2. Three initial renderers and a labeled illustrative gallery; integrate into the existing render owner, not another renderAnalytics wrapper.
3. Browser checks: keyboard/touch, 375px and desktop, reduced motion, numeric table/chart agreement, captions at threshold crossings.
4. Server job/cache integration after local approval, tenant isolation and concurrency tests.
5. Optional model selection experiment only if it improves editorial relevance over rules. Use the existing shared/models.ts role registry; verify current routing before activation. Record latency, token usage, fallback rate and accepted candidate distribution. No speculative price claims.

## Research basis

- Datawrapper bullet bars support comparison against goals: https://www.datawrapper.de/academy/how-to-create-a-bullet-bar-chart
- Datawrapper documents range and annotation controls: https://www.datawrapper.de/academy/customizing-your-bullet-bar-chart
- Vega-Lite demonstrates declarative interactive graphics: https://vega.github.io/vega-lite/
- Its maintained gallery includes waterfall, comparisons and threshold-style layered charts: https://vega.github.io/vega-lite/examples/

These support chart grammar choices, not the correctness of any financial interpretation. Native SVG/HTML is the initial renderer recommendation for this small editorial catalog; evaluate a grammar library only when pattern complexity justifies the dependency.

## Delegation status

Requested cheap research subagent could not be dispatched: no general-purpose subagent tool is exposed in this session. Research and this catalog were prepared by the main agent. No paid provider calls or production changes were made.
