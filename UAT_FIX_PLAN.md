# UAT Fix Plan — Jul 26 2026

## Issues to Fix

### 1. Ghost Assets (DONE)
- Hard-deleted rows 2490001, 2490002, 2490003 from DB via webdev_execute_sql
- These were test rows inserted during Wingate Phase D+E dev (commit 6f76a71)
- NOT re-seeded on startup — they were just never cleaned up

### 2. AI Narrative Button — Where Does It Go?
- In Scout card: "AI Score" button calls `trpc.scout.scoreAsset` → returns `{ score, summary, strengths, risks }` → shows toast only
- In Wingate drawer: "AI narrative" button calls `trpc.scout.scoreAsset` → shows toast only
- The narrative IS persisted to `aiAnalysis` field on the asset row (via `updateCommercialAssetAiScore`)
- FIX: After AI Score runs, expand an inline narrative panel below the score display showing `aiAnalysis` text
- In Scout card: show `aiAnalysis` text in an expandable section below the AI Score bar
- In Wingate drawer: already has a scorecard — add `aiAnalysis` text as a "AI Narrative" section

### 3. Navigation Doesn't Match Journey
Current PRIMARY_NAV: Command Center | Wingate | TIDE | Memos | Outreach
MORE_NAV: Freedom Map | Strategy Blender | Scout | Thesis Engine | Capital Stack | Investor Dossier | Insurance Prospector | RippleEffect
LABS_NAV: Market Scan | Opportunity Radar

FIX — Reorganize nav to reflect Search → Review → Analyze → Act journey:
PRIMARY_NAV (top bar):
  - "Command Center" → / (home)
  - "Scout" → /scout  [SEARCH — find & intake assets]
  - "Wingate" → /wingate  [REVIEW — score & tier assets]
  - "Analyze" dropdown → Thesis Engine + Investor Dossier + Capital Stack + TIDE
  - "Act" dropdown → Memos + Outreach + Opportunity Radar

MORE_NAV: keep remaining tools (Freedom Map, Strategy Blender, Insurance Prospector, RippleEffect, Market Scan)

### 4. Historic-Only Search — Clarity
Current state:
- Scout has "Historic" filter chip (amber) — but it's small and not prominent
- Search palette has "Historic building" quick-chip that redirects to /wingate
- No clear "Search historic assets" entry point

FIX:
- In Scout header: add a prominent "🏛️ Historic Only" toggle button next to Add Asset
- When activated, auto-enable filterHistoric + filterStabilized and show a banner "Showing Wingate-eligible assets only"
- In search palette: rename "Historic building" chip to "🏛️ Historic Assets (Wingate)" and add a subtitle in the palette footer explaining the two search modes
- Add a "Search historic pipeline" shortcut in the nav or home dashboard

### 5. Catalog UX Refinement
Current Scout card actions: AI Score | Status dropdown | Convert to Deal (conditional) | Remove asset
Issues:
- "AI Score" is vague — doesn't tell user what happens
- No way to see the AI narrative after it's generated
- No clear "Review" action that takes user to the Wingate scorecard

FIX:
- Rename "AI Score" → "Generate Analysis" with a clearer description
- After analysis runs, show the narrative inline (expandable) below the score bar
- Add "Review in Wingate →" link on historic assets that navigates to /wingate?asset=ID
- Make the status workflow clearer: New → Reviewing → Qualified → Act

## Files to Edit
1. `client/src/components/EditorialTopNav.tsx` — PRIMARY_NAV restructure + historic search clarity
2. `client/src/pages/Scout.tsx` — AI narrative display + historic toggle + catalog UX
3. `client/src/pages/Wingate.tsx` — AI narrative display in drawer
4. `client/src/pages/Home.tsx` — HistoricPipeline widget: filter to historic-only assets
