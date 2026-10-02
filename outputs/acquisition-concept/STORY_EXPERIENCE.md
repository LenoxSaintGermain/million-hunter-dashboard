# Opportunity story — local prototype

## Portrait focus and wanted states
Unresolved portrait labels now show desired conditions (Recurring contracts / Management can stay) with explicit “Wanted / evidence pending” captions. Native buttons reveal the evidence that could support each requirement. Only one hint per portrait opens at a time; aria-expanded/controls track it. Hover/focus adds restrained elevation and marker emphasis; selected hints receive ink weight and amber rule. Reduced motion disables transitions. Evidence remains unknown; no click changes verification state. The wanted → reported → corroborated progression is documented, not backed by new evidence ingestion. The standalone cedar-portrait.svg is an earlier static export; the HTML/JS portrait is current. Syntax and placement regression pass; rendered UAT remains pending.

## Alignment Portrait / hero graphic
The opportunity feed and shortlist now lead with a native SVG portrait: two quantitative target windows with fixture-derived hollow markers, and a separate amber strip for unresolved recurring revenue and management continuity. Distinct captions reflect each composite's narrative. Large screens pair the image with its caption; narrow screens keep the image first. SVG accessible text exposes values and evidence limitations; a native details reveal explains implications. The portrait uses only the fixed sample thesis, not scratchpad edits. It is not an aggregate score, and does not yet have other asset adapters. Standalone Cedar export: `cedar-portrait.svg`. Syntax, Cedar marker geometry and existing regression checks pass; rendered browser acceptance remains pending.

## Thesis Lens preview
Overview opens with Cedar's thesis lens; each business story also includes its own lens. Four tracks compare fixed saved-search price/cash-flow bands and unresolved recurring-revenue/management requirements. Hollow markers mean reported, not verified; missing evidence is unplaced. Selecting a track reveals its implication and investigation/revision guidance. Phone overview tracks scroll horizontally and update context on swipe. No changes are persisted. The scratchpad is explicitly not connected to these fixed requirements. Only business adapters ship in this pass; other asset classes remain future adapters, not validated support. Syntax and existing regressions pass; visual UAT remains pending.

## Lexio-inspired profile pass
Opportunity profiles now pair identity and narrative with economics in a two-column composition, including at tablet width. On phones, economics appears directly after the headline and before extended background. Asking price, annual cash flow and multiple are native buttons revealing their basis inline in one click. Only one metric explanation per profile is open at a time. Each profile has a same-scale peer multiple chart, highlighting the selected business without implying a quality ranking. Filtering reinstalls the enhancement on replaced rows. Original listing captures are explicitly unavailable for these composites; no false source links are generated.

This pass changes opportunity profiles, not the intake workflow or production narrative pipeline. Visual/browser acceptance remains pending.

## Change
The business analysis opens as a visual story with four lenses: case, economics, people and risks. Mobile uses horizontal scroll-snap with explicit lens buttons and arrow-key alternatives. Wider screens pair the visualization with next-step context. Full analysis remains available, with a return-to-story control.

The downside slider uses the existing deterministic amortization model. Chart bars share a zero baseline. The remaining cash is explicitly before omitted costs, not free cash or a return forecast. People and evidence views display unknowns rather than invented findings.

## Scope and implementation
- `story.js` mounts after the existing reader render, for the three business fixtures only.
- `story.css` reuses paper, ink, rule and muted tokens.
- `reader.js` clears view classes before a new render so business state cannot hide another asset template.
- The authored advisor is disposed in story mode. There is no live research, agent execution, outreach, persistence or production deployment.
- This is a first story interaction pass, not the complete reusable visual-recipe library. The hero currently uses comparative bars, not a waterfall.

## Validation and remaining gate
JavaScript syntax and existing advisor, Senior Read and inline-placement regression tests are run locally. Browser visual acceptance remains pending: review 390px phone, tablet and wide desktop; swipe each lens; change downside; open full analysis; change scenario; return; switch business and asset type. Check keyboard focus, reduced motion, chart labels and overflow. Do not treat static checks as responsive UAT.
