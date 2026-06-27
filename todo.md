# Signal Hunter — Production Build TODO

## Infrastructure
- [x] Initialize web-db-user full-stack project
- [x] Fix useAuth import error in Home.tsx
- [x] Fix TypeScript build cache errors
- [x] Define database schema (deals, signals, memos, outreach, activity_log, scan_jobs)
- [x] Run pnpm db:push to migrate schema
- [x] Align outreach table columns (channel, subject, body, status enum)

## Backend — tRPC Procedures
- [x] deals.list — paginated list with filters
- [x] deals.getById — full deal detail with all signals
- [x] deals.create — add new deal manually
- [x] deals.updateStage — move deal through pipeline stages
- [x] signals.analyze — trigger AI analysis for a deal (Gemini)
- [x] memos.generate — generate investment memo via Gemini 2.5 Pro
- [x] memos.getByDealId — retrieve memo for a deal
- [x] outreach.list — list outreach contacts
- [x] outreach.create — create new outreach contact
- [x] outreach.updateStatus — update contact status
- [x] activity.list — get recent activity feed
- [x] scan.trigger — trigger a new market scan
- [x] scan.getLatest — get latest scan results
- [x] dashboard.stats — aggregate KPI stats

## AI Integrations
- [x] Gemini 2.5 Flash — deal scoring and capital stack modeling
- [x] Gemini 2.5 Pro — investment memo synthesis and Red Team analysis
- [x] Gemini 2.0 Flash — digital audit with web grounding
- [x] Perplexity Sonar Pro — Digital Audit (live market research)
- [x] Anthropic Claude 3.5 Sonnet — Owner Psychology (with Gemini fallback for low credits)

## Frontend — Dashboard Pages
- [x] Command Center (Home) — wired to real tRPC data
- [x] Market Scan page — real scan results with filters and deal creation
- [x] Deal Detail / War Room — full Third Signal view with AI analysis triggers
- [x] Investment Memos page — real memo repository with generation
- [x] Outreach page — real contact pipeline with status management
- [x] Settings page — AI model config, scan sources, scoring filters, scan trigger

## API Keys & Secrets
- [x] GEMINI_API_KEY — injected and validated (live)
- [x] ANTHROPIC_API_KEY — injected (insufficient credits; Gemini fallback active)
- [x] SONAR_API_KEY — injected and validated (live)

## Tests
- [x] server/auth.logout.test.ts — auth flow (1/1 passing)
- [x] server/api-keys.test.ts — API key validation (3/3 passing)

## GCP / Deployment Prep
- [ ] Add Dockerfile for Cloud Run deployment
- [ ] Add cloudbuild.yaml for CI/CD pipeline
- [ ] Document GCP deployment steps in README

## Model Upgrade (Mar 25)
- [x] Replace Anthropic with OpenAI gpt-5.4 for Owner Psychology module
- [x] Replace deprecated gemini-2.0-flash with gemini-2.5-flash in Digital Audit
- [x] Update all Gemini model IDs to latest stable (gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite)
- [x] Inject OPENAI_API_KEY secret
- [x] Update api-keys.test.ts to validate OpenAI key
- [x] Install openai npm package
- [x] Save production checkpoint after model upgrades

## Dynamic Model Selector (Mar 25)
- [x] Build model registry in shared/models.ts with all Gemini + GPT-5.4 models (including experimental)
- [x] Add model_config table to database schema for per-module model persistence
- [x] Add tRPC procedures: models.catalog, models.config, models.update, models.resetDefaults
- [x] Update gemini.ts to read model IDs dynamically from config (no hardcoded models)
- [x] Build AI Model Selector UI in Settings.tsx with per-module dropdowns
- [x] Replace Anthropic with OpenAI gpt-5.4 in Owner Psychology (primary, no fallback needed)
- [x] Save production checkpoint after model selector is live

## Scan Feedback & Real-Time Progress (Mar 25)
- [x] Audit scan pipeline backend — understand phases, timing, and what data is returned
- [x] Add phase tracking to scan job (currentPhase, phaseDetail, progress %) in DB
- [x] Add tRPC procedure: scan.getStatus — poll current scan job with live phase info
- [x] Build ScanProgress component — step indicators, live polling, results summary
- [x] Integrate ScanProgress into Home and Settings pages
- [x] Add clear error states and retry button
- [x] Save checkpoint after scan feedback is live

## Bug: Scan Results Not Persisting (Mar 25)
- [x] Debug why createDeal fails silently in runScanPipeline
- [x] Fix deal persistence so scanned deals appear in Command Center (root cause: mysql2/drizzle returns [ResultSetHeader, null] array, not .insertId directly — fixed to use [0].insertId)
- [x] Verify KPI cards update after scan completes

## Phase 2: Mainstreet Investor OS Expansion

### Schema & Backend
- [x] Add freedom_goals table (target income, timeline, location, situation, risk tolerance)
- [x] Add strategy_blueprints table (goal_id, recipe JSON, ai_rationale, capital_stack JSON)
- [x] Add opportunity_radar table (type: permit/TAD/land/creative, location, signal, ai_analysis)
- [x] Add tRPC procedures: freedomMap.generate, freedomMap.save, freedomMap.list
- [x] Add tRPC procedures: strategyBlender.generate, strategyBlender.save
- [x] Add tRPC procedures: opportunityRadar.scan, opportunityRadar.list
- [x] Add tRPC procedures: investorDossier.generate, investorDossier.get

### Freedom Map Page
- [x] Goal-first intake form (target monthly income, timeline, capital, risk, location, situation)
- [x] AI-generated portfolio recipe (deal mix: business + rentals + flip + land play)
- [x] Dynamic milestone timeline with lifestyle markers
- [x] Three view modes: Lifestyle / Portfolio / Wealth
- [x] Preset profiles (Side Hustle → FI, Family Freedom, Aggressive Builder)
- [x] AI agent voice narrating the path ("Here's how we get you there...")

### Strategy Blender Page
- [x] Deal type selector (SBA business, rental, flip, microloan, land/parking, TAD play, hold)
- [x] Live capital stack with toggleable levers (seller note, SBA 7a, impact fund, green stack)
- [x] DSCR calculator and debt service visualization
- [x] Scenario presets: Conservative / Base / Aggressive
- [x] Multi-year projection chart (Recharts)
- [x] "Mirror the Blackrock move" — portfolio rebalancing logic

### Opportunity Radar Page
- [x] Signal type cards: Permit Filed, TAD Boundary, World Cup proximity, Zoning Change
- [x] Creative play templates: Parking lot arbitrage, Gas station hold, Lot prep for acquisition
- [x] AI analysis per signal ("Why this matters now...")
- [x] Map integration showing signal locations
- [x] Filter by signal type, location radius, urgency score

### Investor Pitch Dossier
- [x] DossierView component (sidebar nav: Thesis / Financials / Risks / Brand+GTM)
- [x] AgentCommentary component (Analyst / Skeptic / Visionary perspectives)
- [x] InvestorReceipt drawer (slide-in, portfolio cart, confetti on 3+ positions)
- [x] Bespoke AI-generated pitch narrative per investor persona
- [x] PDF export of full dossier
- [x] "The AI is looking out for you" messaging layer

### UX Upgrade
- [x] Install framer-motion for showcase-quality animations
- [x] Staggered entrance animations on all major pages
- [x] Cinematic hero sections with gradient text
- [x] Agent voice commentary woven throughout (not just in Dossier)
- [x] Mobile-first responsive audit of all new pages

## Phase 3: ADK Multi-Agent Architecture

### Sprint 1 — Core ADK Refactor (no new GCP services)
- [x] Install @google/adk TypeScript SDK
- [x] Create server/agents/ directory with skill pack layout
- [x] Build SmartRouterAgent (BaseAgent) — routes tasks to cheap vs strong model
- [x] Refactor Third Signal pipeline to ADK SequentialAgent (5 modules in order)
- [x] Wire session.state as trajectory memory (output_key per agent)
- [x] Add deal_trajectory table to DB for persistent agent step logging
- [x] Add tRPC procedures: agents.getTrajectory, agents.runPipeline
- [x] Update War Room tab in DealDetail to show live agent trajectory steps

### Sprint 2 — Consensus Scoring + Cloud Run Config
- [x] Build ParallelAgent consensus scorer (3 Gemini models in parallel)
- [x] Add consensus_scores table to DB with divergence flag
- [x] Add "Models Disagree — Review Manually" flag to Consensus tab
- [x] Add tRPC procedure: agents.consensusScore, agents.getConsensusScore
- [ ] Write Dockerfile for agent-service Cloud Run container
- [ ] Write cloudbuild.yaml for CI/CD from GitHub main branch

### Sprint 3 — Seller Simulation
- [x] Build SellerPersonaAgent (generates seller persona from deal signals)
- [x] Build NegotiationSimulatorAgent (simulates 4 negotiation scenarios)
- [x] Add seller_simulations table to DB
- [x] Add Seller Simulation tab to Deal Detail page
- [x] Add tRPC procedures: agents.sellerSimulation, agents.getSellerSimulation

## AI Generation Persistence (cache-first, no re-runs)
- [x] Audit all AI-generating tRPC procedures for cache-first logic
- [x] Fix signals.analyze — serve from DB if exists, only re-run if forced
- [x] Fix memos.generate — serve from DB if exists, only re-run if forced
- [x] Fix agents.runPipeline — serve trajectory from DB if exists
- [x] Fix agents.consensusScore — serve from DB if exists
- [x] Fix agents.sellerSimulation — serve from DB if exists
- [x] Fix freedomMap.generate — serve from DB if exists
- [x] Fix strategyBlender.generate — serve from DB if exists
- [x] Fix opportunityRadar.scan — serve from DB if exists
- [x] Fix investorDossier.generate — serve from DB if exists
- [x] Add "Re-analyze" force-refresh button to Third Signal tab in War Room
- [x] Save checkpoint after persistence fixes

## Sprint 4 — Data Foundation

- [x] Deal deduplication: add UNIQUE constraint on deals(name, source)
- [x] Update runScanPipeline to use INSERT ... ON DUPLICATE KEY UPDATE
- [x] Add OZ/TAD fields to deals table: opportunityZone, ozTractId, tadDistrict, ozPotentialGain
- [x] Wire HUD Opportunity Zone API into scan pipeline enrichment phase
- [x] Wire Atlanta TAD boundary lookup into scan pipeline enrichment phase
- [ ] Add OZ/TAD badges to deal cards in Command Center and Deal Detail (Sprint 5)
- [x] Move consensus scoring models from hardcoded to model_config table
- [x] Add consensus_* module entries to AI Engine Settings tab
- [ ] Add commercial_assets table schema (foundation for Sprint 5 Scout)
- [x] Run tests and save Sprint 4 checkpoint

## Sprint 5 — Signal Surface + Scout Foundation

- [x] OZ/TAD badges: add 🟢 OZ and 🏙 TAD badges to Command Center deal table rows
- [x] OZ/TAD badges: add OZ/TAD badges to Deal Detail header section
- [x] Commercial Assets Scout: add commercial_assets table to DB schema
- [x] Commercial Assets Scout: run db:push migration
- [x] Commercial Assets Scout: add tRPC stubs (scout.list, scout.create)
- [x] Consensus divergence alert: ⚠️ banner in War Room Consensus tab when divergenceFlag=true
- [x] Consensus divergence alert: 3-model side-by-side rationale view on divergence
- [x] Run tests and save Sprint 5 checkpoint

## Sprint 6 — Scout UI + Macro Signals Sentinel

- [x] Fix Settings.tsx duplicate useState import (Vite console error)
- [x] Scout UI: create /scout page with filterable commercial assets grid
- [x] Scout UI: OZ/TAD filter chips + property type filter
- [x] Scout UI: cap rate sort + status filter
- [x] Scout UI: Add Asset dialog (manual entry form)
- [x] Scout UI: Run AI Score button per asset card
- [x] Scout UI: register /scout route in App.tsx + sidebar nav
- [x] Macro Signals: add sentinel tRPC procedures (sentinel.list, sentinel.seed)
- [x] Macro Signals: seed macro_signals with realistic Atlanta/national signals
- [x] Macro Signals: surface Sentinel live feed panel in Command Center
- [x] Macro Signals: urgency score color coding + signal type icons
- [x] Run tests and save Sprint 6 checkpoint

## Sprint 7 — Cinematic Onboarding Lobby

- [x] Inventory NotebookLM videos from user's Drive folder
- [x] Upload videos to CDN (manus-upload-file --webdev)
- [x] Add onboarding_completed field to users table + db:push migration
- [x] Add user.markOnboardingComplete tRPC mutation
- [x] Build /lobby page: cinematic full-screen video player with chapter nav
- [x] Lobby: elegant chapter cards (Porsche/Bentley walkthrough aesthetic)
- [x] Lobby: progress indicator + chapter titles
- [x] Lobby: Skip / Watch Later option (graceful exit)
- [x] Lobby: Enter Dashboard CTA after final chapter
- [x] Wire first-login gate in App.tsx routing
- [x] Run tests and save Sprint 7 checkpoint

## Sprint 7 Bug Fixes

- [x] Fix Lobby: Skip intro button not navigating to dashboard
- [x] Fix Lobby: Enter Dashboard button not navigating to dashboard
- [x] Ensure markOnboardingComplete mutation fires before navigation

## Sprint 8 — Lobby Polish + Scout Bridge + Sentinel Intelligence

- [x] Settings: Re-watch Onboarding button (resets onboarding_completed in DB + sessionStorage)
- [x] Add user.resetOnboarding tRPC mutation
- [x] Lobby: buffering/loading spinner overlay while video stalls
- [x] Lobby: onWaiting/onCanPlay video events to show/hide spinner
- [x] Scout: Convert to Deal button on asset cards
- [x] Scout: pre-populate deal from asset financials (name, asking price, cap rate, OZ/TAD)
- [x] Scout: route to /deal/:id after conversion
- [x] Sentinel: sort signals by confidence score descending
- [x] Sentinel: ⚡ High Urgency badge for signals >= 0.88 confidence
- [x] Sentinel: Refresh Signals button calling LLM via Perplexity Sonar
- [x] Sentinel: AI-generated signals with real-time Atlanta market grounding
- [x] Run tests and save Sprint 8 checkpoint

## Sprint 9 — Data Integrity + Pipeline Automation

- [x] DECIMAL audit: parseFloat guard for capRate in DealDetail, Home, Scan pages
- [x] DECIMAL audit: parseFloat guard for confidenceScore in War Room Consensus tab
- [x] DECIMAL audit: parseFloat guard for score fields in DealDetail Third Signal tab
- [x] DECIMAL audit: parseFloat guard for all numeric fields in Command Center KPI cards
- [x] Scout: auto-trigger scoreAsset immediately after AddAssetDialog success
- [x] Scout: show "Scoring..." state on newly created card while auto-score runs
- [x] Scout→Deal Bridge: auto-trigger agents.runPipeline after convertToDeal succeeds
- [x] Scout→Deal Bridge: War Room opens with pipeline already in progress
- [x] Run tests and save Sprint 9 checkpoint
## Sprint 10 — Signal Intelligence + UX Polish + Pipeline Visibility
- [x] Sentinel: expiresAt countdown badge on signal cards (time-remaining display)
- [x] Sentinel: archived signal filtering (hide expired signals from live feed)
- [x] Scout: isAutoScoring shimmer overlay on AssetCard while AI score is in flight
- [x] Scout: "AI Scoring..." pulsing spinner overlay with semi-transparent backdrop
- [x] Command Center: Pipeline Velocity sparkline (Recharts AreaChart, 8-week rolling window)
- [x] deals.velocity tRPC procedure (raw SQL GROUP BY ISO week)
- [x] Run tests (55/55 passing) and save Sprint 10 checkpoint

## Sprint 10 — Signal Intelligence + UX Polish + Pipeline Visibility
- [x] Sentinel: expiresAt countdown badge on signal cards (time-remaining display)
- [x] Sentinel: archived signal filtering (hide expired signals from live feed)
- [x] Scout: isAutoScoring shimmer overlay on AssetCard while AI score is in flight
- [x] Scout: AI Scoring pulsing spinner overlay with semi-transparent backdrop
- [x] Command Center: Pipeline Velocity sparkline (Recharts AreaChart, 8-week rolling window)
- [x] deals.velocity tRPC procedure (raw SQL GROUP BY ISO week)
- [x] Run tests (55/55 passing) and save Sprint 10 checkpoint

## Sprint 11 — Auto-Archive + Deal Share + Scout Pre-fill + GCP Deploy
- [x] Sentinel: auto-archive backend — cron job marks signals archived=true when expiresAt passes
- [x] Sentinel: archived field added to macro_signals schema + db:push
- [x] Sentinel: sentinel.archive tRPC mutation (manual archive) + auto-archive on server startup
- [x] Sentinel: sentinel.listActive procedure — returns only non-archived, non-expired signals
- [x] War Room: public Deal Share page at /deal-share/:token (cinematic investor one-pager)
- [x] War Room: deal_share_tokens table (token, dealId, expiresAt, viewCount)
- [x] War Room: dealShare.createToken tRPC mutation + dealShare.getByToken public procedure
- [x] War Room: Share button in Deal Detail header generates token + copies URL to clipboard
- [x] Scout: pre-fill War Room seed context on Scout→Deal conversion (capRate, OZ/TAD, SBA eligibility, DSCR estimate)
- [x] Scout: capitalStackSummary pre-seeded with [Scout Pre-fill] context tag
- [x] GCP: Dockerfile for Cloud Run (Node 22 Alpine, multi-stage build)
- [x] GCP: cloudbuild.yaml for CI/CD with Artifact Registry + Cloud Run deploy
- [x] GCP: .dockerignore file
- [x] Sprint 11 vitest suite — 8 tests (63/63 total passing)

## GPT-5.5 Model Audit & Fix
- [ ] Run GPT-5.5 code review on all AI feature code
- [ ] Fix DB model_config: replace all phantom/deprecated model IDs with live models
- [ ] Fix investmentMemo DB row: gpt-5.4 → gpt-5.5
- [ ] Fix capitalStack DB row: gemini-3.1-pro-exp → gemini-2.5-flash
- [ ] Fix dealScoring DB row: gemini-3.0-flash-exp → gemini-2.5-flash
- [ ] Fix marketScan DB row: gemini-3.0-flash-exp → gemini-2.5-flash
- [ ] Fix ownerPsychology DB row: gemini-3.1-pro-exp → gemini-2.5-pro
- [ ] Fix digitalAudit DB row: sonar-deep-research → sonar-pro
- [ ] Fix consensus_model_3 DB row: gemini-2.5-flash-lite → gemini-2.5-flash-lite-preview-06-17
- [ ] Fix agents/index.ts: MODEL_LITE constant to correct preview ID
- [ ] Fix gemini.ts header comment to reflect accurate model assignments
- [ ] Update investmentMemo to use gpt-5.5 via OpenAI SDK
- [x] Run tests and save checkpoint

## Model Routing Audit — Gemini Direct + Poe for Claude/GPT
- [ ] gemini.ts: update Gemini model IDs to gemini-3.1-pro-preview / gemini-3-flash-preview (direct Google API)
- [ ] gemini.ts: replace Anthropic SDK (claude-3-5-sonnet) with Poe client (Claude-Opus-4.7) for Owner Psychology
- [ ] agents/index.ts: update MODEL_STRONG/FAST/LITE constants to Gemini 3.1 IDs
- [ ] agents/index.ts: consensus scorer calls Google API directly with Gemini 3.1 models
- [ ] routers.ts: update modelVersions metadata labels
- [ ] DB model_config: update consensus model IDs to Gemini 3.1 strings
- [x] Run tests and save checkpoint

## Hotfix — Pipeline Velocity NaN Bug
- [x] Server: velocity query handles MySQL Date objects (week_start instanceof Date check)
- [x] Server: velocity query handles BigInt week_start values
- [x] Server: fallback week label uses YEARWEEK value when date parse fails
- [x] Frontend: VelocitySparkline guards total and trend against NaN with safeTotal/safeTrend
- [x] Frontend: all numeric children cast to String before render to prevent React NaN warning
- [x] 63/63 tests passing after fix

## Sprint 12 — Co-Pilot + Market Scan Redesign + Signal Cleanup
- [x] DB: Delete 26 Sprint 6/8 test signals — 5 real signals remain
- [x] Market Scan: Add targetLocations to scan.trigger input schema
- [x] Market Scan: Filter SAMPLE_LISTINGS by targetLocations in runScanPipeline
- [x] Market Scan: Redesign Scan.tsx — explicit "Where to Scan" targeting panel with presets and custom input
- [x] Market Scan: ScanProgress wired to jobId from triggerScan mutation result
- [x] Co-Pilot: copilot.chat tRPC mutation — Claude-Opus-4.7 via Poe with full pipeline context
- [x] Co-Pilot: System prompt includes Lenox's profile, acquisition thesis, pipeline top 10, recent activity
- [x] Co-Pilot: Optional dealId injection for deal-specific context (SBA, DSCR, kill prob, OZ/TAD)
- [x] Co-Pilot: CoPilot.tsx floating panel — violet gradient FAB, suggested prompts, markdown rendering
- [x] Co-Pilot: GlobalCoPilot in App.tsx — visible on all authenticated pages, hidden on lobby/deal-share
- [x] Co-Pilot: DealDetail.tsx — CoPilot receives dealId + dealName for deal-specific analysis
- [x] Tests: 63/63 passing

## Playwright Audit — API Error Fixes (Apr 25)
- [x] Purge remaining test deals (Sprint11 Scout Prefill Test, Sprint6 Test Retail Strip, etc.)
- [x] Purge 23 test commercial assets from DB
- [x] Remove duplicate real deals (330xxx IDs) — keep canonical IDs 5-13 + 30001
- [x] Fix sentinel.list 401 — add enabled: isAuthenticated guard in Home.tsx SentinelPanel
- [x] Fix scout.list 401 — add enabled: isAuthenticated guard in Scout.tsx
- [x] Add useAuth import to Home.tsx and Scout.tsx
- [x] Re-run Playwright audit — 0 console errors, 0 API errors, 0 failed requests (11/11 pages clean)

## Sprint 13 — Clean Data + Location Agnostic + Off-Market Scout Agent

- [x] Purge Sprint 11 test deals (Sprint11 Scout Prefill Test, Sprint11 Share Test Deal) from DB
- [x] Make Market Scan location-agnostic: remove Atlanta hardcodes, set Miami/FLL as default presets
- [x] Update scan.trigger to accept any targetLocations (no Atlanta fallback hardcode)
- [x] Build Off-Market Scout AI agent: Claude-Opus-4.7 via Poe, web-grounded, hunts unlisted businesses
- [x] Add off-market scan UI panel on Market Scan page (separate from on-market scan)
- [x] Off-market results feed into Asset Scout pipeline (same createCommercialAsset flow)
- [x] Run tests and save checkpoint

## Sprint 13 — Three-Agent Loop (Hermes-pattern)

- [x] Purge Sprint 11 test deals from DB (Sprint11 Scout Prefill Test, Sprint11 Share Test Deal)
- [x] Fix Market Scan location defaults to Miami/FLL (remove Atlanta hardcodes)
- [x] Build Off-Market Scout agent (Claude-powered, web-grounded research)
- [x] Three-agent DB schema: agent_runs table with artifacts/findings/remediations JSON columns
- [x] Deal Architect tRPC procedure (generates 6 artifacts: cold email, LOI, thesis, DD checklist, seller profile, negotiation playbook)
- [x] Red Team tRPC procedure (adversarial stress-test: findings by severity/category, deal-killers, red flags)
- [x] Remediation Agent tRPC procedure (fills gaps, generates missing artifacts, go/no-go recommendation)
- [x] Agent Loop Panel UI in DealDetail — 3-step pipeline cards, artifact accordion, findings accordion, remediation plan with go/no-go badge
- [x] Fix zoning column truncation (expanded to TEXT)
- [x] 63/63 tests passing

## Sprint 14 — Mobile Polish + Investor Portal

- [ ] Mobile nav: DS-styled bottom sheet drawer with backdrop blur
- [ ] Mobile nav: smooth slide-up animation with spring easing
- [ ] Mobile nav: active state indicators matching desktop sidebar
- [ ] Mobile nav: tap-outside and swipe-down gesture dismiss
- [ ] Investor Portal: add 'investor' role to user enum in schema
- [ ] Investor Portal: role-based routing (investor role → portal, operator → dashboard)
- [ ] Investor Portal: InvestorLayout — clean read-only nav (no scan/scout/outreach tools)
- [ ] Investor Portal: Deal Room page — curated deal cards with thesis summaries
- [ ] Investor Portal: Memo Viewer — DS-styled read-only memo with two-column layout
- [ ] Investor Portal: Portfolio Snapshot — committed capital, target returns, deal stages
- [ ] Investor Portal: role-gate tRPC procedures (investors cannot trigger scans/AI runs)

## Sprint 15 — Investor Experience Upgrade (Tripoli-inspired)

- [ ] Auto-assign investor role on new user registration (except operator gmail)
- [ ] Role-based post-login redirect (investor → /investor, operator → /)
- [ ] Investor DNA schema: add investor_dna table to DB
- [ ] Investor DNA onboarding quiz (5-step: horizon, risk, liquidity, ESG, sectors)
- [ ] DNA Card component (strand bars, archetype code, animated reveal)
- [ ] Deal Room upgrade: hero shelf, DNA-matched deal shelves, ticker tape, stat grid
- [ ] InvestorDealDetail: stat grid, DNA match radar, recent commits tape
- [ ] Investor Scan access with operator approval flow for AI scoring
- [ ] Investor Scout access with operator approval flow
- [ ] Allocation Builder: portfolio impact simulator, DNA shift preview
- [ ] Operator notification when investor submits scan/scout findings

## Sprint 16 — Tripoli Investor DNA Experience

- [ ] Inject Lenox's DNA profile into DB (Alpha Hunter archetype, operator preview)
- [ ] Add Market Scan + Asset Scout to investor nav with operator-approval flow
- [ ] Build animated DNA Card component (baseball card × Spotify Wrapped × 23andMe)
- [ ] Wire DNA Card into Deal Room header, Deal Detail right rail, My Position
- [ ] Animated onboarding archetype reveal screen
- [ ] DNA strand bars with live animation on every investor screen

## Sprint 18 — Delete Capability + Test Data Purge

- [x] Purge 7 Sprint6 test signals from DB (macro_signals table)
- [x] Purge 2 Sprint11 test deals from DB (Sprint11 Share Test Deal, Sprint11 Scout Prefill Test)
- [x] Add deals.delete tRPC procedure (hard-delete by id, operator-protected)
- [x] Add sentinel.delete tRPC procedure (hard-delete macro signal by id, operator-protected)
- [x] Wire trash icon delete button into each deal row in Command Center (with confirm dialog)
- [x] Wire trash icon delete button into each signal card in Sentinel panel (with confirm dialog)
- [x] 81/81 tests passing, zero TypeScript errors

## Sprint 17 — DNA Match Scores on Deal Cards

- [x] Create client/src/lib/dnaMatch.ts — pure scoring engine (sector 30pts, size 25pts, risk 25pts, IRR 20pts)
- [x] DNAMatchBadge component with click-to-expand breakdown popover (sub-score bars per dimension)
- [x] Wire dnaProfile from getDnaStatus into every DealCard in DealRoom.tsx
- [x] Sort toggle: "Signal" (AI score) vs "DNA Match" (computed compatibility) 
- [x] Avg DNA match score shown in archetype banner
- [x] Tier color coding: strong (green ≥80), good (amber ≥60), partial (muted <60)
- [x] Strong-match cards get subtle green glow border treatment
- [x] 18 new vitest tests in server/dna-match.test.ts — 81/81 total passing
- [x] Zero TypeScript errors

## Sprint 19 — Cinematic Command Center Redesign

- [x] Rewrite Home.tsx: Bloomberg/Palantir editorial layout (briefing header, stat strip, intelligence feed, signal stream)
- [x] Replace 4-card KPI grid with 6-stat horizontal strip (no card borders, dense information)
- [x] Replace "Top Opportunities" card with ranked Intelligence Feed (rank numbers, stagger entry animation)
- [x] Replace Sentinel card with Signal Stream (ticker-style, left-border urgency indicators)
- [x] Asymmetric 2-column editorial grid (feed left, signal stream right 340px)
- [x] Proactive system annotation in briefing header (context-aware: high priority / empty / response pending)
- [x] Bloomberg-style dateline in header (uppercase mono font)
- [x] Run Market Scan elevated to primary CTA with persistent glow pulse animation (scan-btn-idle)
- [x] Progressive section reveals via useFadeIn hook (staggered delays per section)
- [x] Feed rows: stagger entry animation (feedEntry, 60ms delay per row)
- [x] Signal entries: stagger entry animation (signalEntry, 50ms delay per item)
- [x] High-urgency signals: pulsing left-border animation (urgencyBorder)
- [x] Velocity sparkline moved to compact inline strip below feed
- [x] Activity log moved to editorial System Log section below feed
- [x] All delete buttons preserved and functional
- [x] Zero TypeScript errors, 81/81 tests passing

## Sprints 20–22 — Tripoli Editorial Design Elevation

- [x] Audited Tripoli Investor Hub repo: extracted Fraunces font, blur-in motion, hairline rules, 3-stat footer, warm amber accent
- [x] Installed Fraunces variable serif font via Google Fonts CDN
- [x] Added --font-display CSS token and .eyebrow utility class to index.css
- [x] Applied Fraunces to all display headings in Command Center (Home.tsx)
- [x] Installed framer-motion, added blur-in reveals to Command Center hero, stat strip, intelligence feed, signal stream
- [x] Built animated SVG MiniSparkline component (path draw animation via framer-motion)
- [x] Rewrote DealRoom DealCard to Tripoli editorial format: Fraunces title, 3-stat footer, sparkline, amber top-signal ribbon
- [x] Moved DNA match badge to card footer row alongside Express Interest CTA
- [x] Applied Fraunces wordmark + eyebrow labels to DashboardLayout sidebar
- [x] 81/81 tests passing, zero TypeScript errors

## Sprint 23 — Thesis Engine (Spec TSL-SCI-PROD-001-A1)

- [x] Create thesis_compilations table in DB (direct SQL migration — TiDB compatible)
- [x] Build thesisRouter.ts: thesis.compile (STRATEGIST agent via Claude JSON schema), thesis.list, thesis.delete
- [x] Wire thesisRouter into appRouter as thesis namespace
- [x] STRATEGIST system prompt: 5 base dimensions, 5 custom dimension examples, 3 worked examples, geography reference, NAICS categories
- [x] Build ThesisEngine.tsx: editorial two-panel layout with Fraunces headings + Framer Motion blur-in
- [x] Template gallery: Hirsch Durability, Silver Tsunami, Recurring Revenue, Sector Roll-up, Generational Transition
- [x] STRATEGIST output review: compiled filters, scoring weight bars (amber=custom), evidence, disqualifiers, confidence notes
- [x] Universe estimate panel: estimated targets + estimated cost
- [x] Approve & Run Pipeline button + Reset button
- [x] Saved theses list with load/delete per user
- [x] Tier gate banner: Custom Dimension Authoring (Operator tier)
- [x] Add /thesis route to App.tsx
- [x] Add Thesis Engine nav item to DashboardLayout (amber badge, Sparkles icon)
- [x] Amber badge color support in NavItem (desktop + mobile)
- [x] 81/81 tests passing, zero TypeScript errors

## Sprint 24 — Thesis→Scan Wiring, Feed Dedup, High Priority Auto-Tag

- [x] Wire Thesis Engine "Approve & Run" to scan.trigger with compiled filters (geographies→targetLocations, revenueMin→minCashFlow proxy, multipleMax)
- [x] Add thesis scan confirmation dialog showing compiled parameters before triggering
- [x] Navigate to Command Center after scan is triggered from Thesis Engine
- [x] Deduplicate Intelligence Feed by name (case-insensitive) — keep highest-score entry per unique name
- [x] High Priority auto-tag: lowered threshold to score >= 0.75, backfilled 10 existing deals to high_priority
- [x] Verify High Priority stat shows correct count after scan (10 deals now show in stat strip)

## Sprint 25 — TIDE Capital Flow Intelligence (Phase 1: Political Capital Deployment)

- [x] Add capital_flows table to DB schema (entity, amount, geography, category, flow_date, source, confidence)
- [x] Add convergence_events table to DB schema (flows[], signal_type, geography, thesis_seed, confidence)
- [x] Add tide_predictions table to DB schema (claim, geography, category, confidence, outcome)
- [x] Run direct SQL migration for all 3 tables (TiDB compatible)
- [x] Build tideRouter.ts: tide.scan (TIDE-SCOUT + TIDE-CLASSIFIER + TIDE-LINKER agents)
- [x] TIDE-SCOUT: fetch USAspending.gov awards, Federal Register notices, FEC disbursements
- [x] TIDE-CLASSIFIER: Gemini classifies each flow by category + geography + confidence
- [x] TIDE-LINKER: Gemini identifies convergence events (2+ flows in same geography within 90 days)
- [x] tide.listFlows, tide.listConvergence, tide.listPredictions, tide.scan procedures
- [x] tide.archiveConvergence, tide.convertToThesis, tide.logPrediction, tide.updateOutcome procedures
- [x] Build TIDE.tsx dashboard page: flow feed with category filter, convergence events panel, prediction track record
- [x] Add TIDE Intelligence nav item to DashboardLayout sidebar (amber New badge)
- [x] Add /tide route to App.tsx
- [x] 81/81 tests passing, zero TypeScript errors## Sprint 26 — Editorial Finance Design System Overhaul
- [x] Define Editorial Finance CSS token spec: bone/paper/ink/amber/sage/clay/rule, sh-fg-1–4, sh-cyan, sh-violet
- [x] Load Fraunces display font + JetBrains Mono via Google Fonts CDN in index.html
- [x] Set --font-display, --font-mono, --font-sans in index.css @theme inline
- [x] Add .eyebrow utility class (10px, 700, uppercase, 0.12em tracking)
- [x] Overhaul DashboardLayout: bone/paper sidebar, eyebrow section labels, no colored backgrounds
- [x] Overhaul TIDE.tsx: contextual flow explanations (no raw FEC dump links), "Why this matters" copy per convergence event, fmtMoney/fmtPct number formatting, blur-in animations
- [x] Global color token sweep: 251 replacements across 28 files (zinc/white → bone/paper/ink/rule/amber/sage/clay)
- [x] Fix DealDetail.tsx StatCard dark oklch → paper/rule/ink tokens
- [x] Fix Scan.tsx deal card dark oklch → bone/paper/rule tokens
- [x] Fix Memos.tsx amber background to use Editorial Finance amber token
- [x] 81/81 tests passing, zero TypeScript errors

## Sprint 27 — Insurance Prospector + Multi-User Admin

### Insurance Prospector
- [ ] Add `insurance_prospects` table to schema (dealId, premiumPotential, riskProfile, policyFit JSON, prospectScore, briefText, status)
- [x] Add `insurance` role to users enum in schema
- [x] Run db:push migration for new tables and role
- [x] Add insuranceProspector router: scoreProspect, generateBrief, listProspects, updateStatus
- [x] Build InsuranceProspector.tsx page: prospect list, policy fit badges, brief generator
- [x] Add /insurance-prospector route to App.tsx
- [x] Add Insurance Prospector nav item (visible to admin + insurance roles)

### Multi-User Admin
- [x] Add getAllUsers, updateUserRole, deactivateUser procedures (admin-only)
- [x] Build AdminPanel.tsx: user list table, role selector, deactivate toggle
- [x] Add /admin route to App.tsx (admin-only guard)
- [x] Add Admin Panel nav item (admin role only)
- [x] Role-gate nav: insurance role sees Insurance Prospector, not acquisition modules
- [ ] Add role badge to user avatar in sidebar (Admin / Investor / Insurance)

### Backlog / Polish
- [ ] Fix mobile nav active state amber indicator not rendering in sheet
- [ ] Extract fmtMoney/fmtPct into client/src/lib/format.ts and import site-wide
- [ ] Seed Sentinel Signals with 8 real macro signals (archive test entries)
- [x] 81+ tests passing, zero TypeScript errors

## Sprint 28 — Email Invite + Insurance Score All

- [ ] Wire Gmail MCP into inviteRouter.create — send invite link to recipientEmail
- [ ] Add email sent confirmation to Admin Panel InviteManager UI
- [ ] Add Score All Deals button to InsuranceProspector with progress bar
- [ ] scoreAllDeals procedure in insuranceRouter — batch AI scoring with progress
- [ ] Empty state onboarding CTA for insurance users with zero scored deals

## Sprint 29 — Real SCORER Dimensions (Zero Stubs)

- [x] Implement Capital Stack Compatibility (TSL-DIM-CAP-STACK-001) — real LTV/DSCR logic using capital_stack_templates
- [x] Implement Operational Alpha (TSL-DIM-OPS-ALPHA-001) — real industry/employee/revenue-per-employee scoring
- [x] Implement Macro Arbitrage (TSL-DIM-MACRO-ARB-001) — real TIDE signal overlap using macro_signals table
- [x] Rebalance composite score weights to 6-factor (Financial 40%, Strategic 20%, Deal Structure 10%, Cap Stack 15%, Ops Alpha 10%, Macro Arb 5%)
- [x] Remove all stub comments from gemini.ts
- [x] Update stack.test.ts to verify real dimension logic (not just identifier presence)
- [x] Run pnpm test — confirm 98/98 passing
- [x] Save checkpoint Sprint 29

## Stitch UI Integration — Signal Hunter Intelligence Terminal
- [x] Pull reference UI from Stitch MCP (Command Center + Intelligence Dossier screens)
- [x] Apply Stitch design tokens: signal-gold #ffba20, surface-container #182028, surface #1e2a34
- [x] Morning Brief cinematic hero with IBM Plex Serif headline and posture metrics bar
- [x] Signal Gold conviction borders on high-score deal rows (score >= 0.75)
- [x] Signal Gold score display for deals scoring >= 0.8
- [x] Stitch Signal Stream header with sensors icon and live ping indicator
- [x] Signal Gold left border on high-conviction signals
- [x] DashboardLayout dark terminal surfaces (sidebar, topbar, content area)
- [x] Signal Gold active nav indicator bar and label
- [x] Logo icon upgraded to signal gold tint on dark surface
- [x] Material Symbols Outlined loaded for wb_twilight and sensors icons
- [x] ping keyframe animation for live indicator

## Sprint 30 — Stitch UI Integration + Real Posture Wiring
- [x] Stitch Intelligence Dossier hero on DealDetail page (conviction score, macro alignment alert, agent action row)
- [x] Add direction field (tailwind/headwind/neutral) to macro_signals schema + DB migration
- [x] Add dashboard.macroPosture tRPC procedure (weighted confidence posture calculation)
- [x] Wire posture bar to live macro signal data (AGGRESSIVE/ACTIVE/DEFENSIVE/MONITORING)
- [x] Add TIDE ticker strip to Morning Brief hero (top 2 signals inline)
- [x] Add direction ↑/↓ badge to Signal Stream items
- [x] Add direction field to sentinel.create input schema

## Sprint 31–39 — Signal Hunter OS Editorial Edition (Full Build)

### Sprint 31 — Design System Migration
- [ ] Install Fraunces font via Google Fonts CDN in index.html
- [ ] Replace dark terminal CSS tokens with Editorial Finance light tokens in index.css
- [ ] Build EditorialTopNav component (replaces DashboardLayout sidebar)
- [ ] Update App.tsx to use EditorialTopNav layout wrapper
- [ ] Purge dark terminal anti-patterns (navy bg, Signal Gold #ffba20, colored section backgrounds)

### Sprint 32 — Command Center Rebuild
- [ ] Rebuild Home.tsx with editorial layout (top nav, warm paper background)
- [ ] Add Co-Analyst Insight banner (amber border-l-2 strip with LLM directive)
- [ ] Rebuild stat strip with Fraunces section-h2 numbers and hover-lift
- [ ] Rebuild deal list with editorial card anatomy (eyebrow + card-title + body + data footer)
- [ ] Rebuild Sentinel signal feed with editorial timeline dots
- [ ] Add dashboard.coAnalystInsight tRPC procedure (Poe API powered, 4hr cache)

### Sprint 33 — Deal Room Bento Grid
- [ ] Rebuild DealDetail.tsx with editorial bento grid (6 AI modules)
- [ ] Build AgentMonitoringPanel component (fixed right aside, xl+)
- [ ] Build BentoModule component (Owner Psychology, Digital Audit, Red Team, Capital Stack, Investment Memo, Consensus)
- [ ] Add editorial hero strip (Location Catalyst, Event Horizon, Deal Velocity metadata)
- [ ] Wire bento modules to deals.getAgenticInsight tRPC procedure

### Sprint 34 — Multi-Model Orchestration Backend
- [ ] Add deal_agent_runs table to schema + migration
- [ ] Build Poe API helper (server/_core/poe.ts)
- [ ] Add deals.runAgentAnalysis procedure (parallel 3-model runs)
- [ ] Add deals.getAgentRuns procedure
- [ ] Add deals.getConsensusScore procedure (weighted vote + divergence detection)
- [ ] Add deals.getAgenticInsight procedure (behavioral|redteam|capital|digital|memo)
- [ ] Add dashboard.coAnalystInsight procedure (pipeline-level directive)

### Sprint 35 — IC Review Page
- [ ] Build /deal/:id/ic-review route and page
- [ ] Editorial article layout (Executive Summary, Strategic Rationale, Risk Factors)
- [ ] Consensus Dashboard right aside (model votes, divergence flag, confidence score)
- [ ] Action Bar (Approve for LOI, Request Revision, Share with LPs)
- [ ] Gutter Float Note component (left margin AI annotations)

### Sprint 36 — Behavioral Profile + Owner Psychology
- [ ] Build /deal/:id/behavioral-profile route and page
- [ ] Build /deal/:id/owner-psychology route and page
- [ ] Agentic Insight Card component (Fraunces 32px headline, recommendation block)
- [ ] Negotiation Rehearsal section (3 scenario cards with win probability)
- [ ] Wire to deals.getAgenticInsight(dealId, 'behavioral') and 'psychology'

### Sprint 37 — TIDE + Market Scan Redesign
- [ ] Redesign TIDE.tsx with editorial signal cards (eyebrow + card-title + body + data footer)
- [ ] Direction badges: sage (tailwind) / clay (headwind) — text color only
- [ ] Redesign Scan.tsx with underline filter inputs (no box borders)
- [ ] Add TIDE hero with capital tracked stat ($18.7B Fraunces headline)

### Sprint 38 — Framer Motion System
- [ ] Install framer-motion (already installed — verify)
- [ ] Build useEditorialEntrance hook (blur-fade choreography)
- [ ] Apply entrance animations to Command Center hero + stat strip
- [ ] Apply scroll-reveal to all section headings
- [ ] Apply card hover-lift (y: -3, no scale)
- [ ] Apply list stagger (delay: index * 0.07)
- [ ] Implement header scroll behavior (transparent → paper/80 + border-rule)

### Sprint 39 — Polish + Tests
- [ ] Run full test suite — confirm all passing
- [ ] Fix any TypeScript errors
- [ ] Save final checkpoint

## Sprint 31–39 — Signal Hunter OS Editorial Edition

- [x] Design system migration: Fraunces font, Editorial Finance tokens, light theme
- [x] EditorialTopNav component (replaces DashboardLayout sidebar)
- [x] Batch layout swap — all 15 operator pages migrated to EditorialTopNav
- [x] Command Center (Home.tsx) rebuilt with Co-Analyst Insight banner + TIDE ticker + posture bar
- [x] deal_agent_runs schema added to DB
- [x] Multi-model orchestration router (agentRouter.ts) — Poe API integration
- [x] AgentMonitoringPanel component — live agent status, model attribution
- [x] AgentMonitoringPanel integrated into DealDetail agents tab
- [x] IC Review page — editorial article layout, Consensus Dashboard aside, Gutter Float notes
- [x] Behavioral Profile page — Agentic Insight card, Negotiation Rehearsal scenarios
- [x] Routes wired: /ic-review/:id, /behavioral/:id

## Sprint 32 — Stitch Editorial Layout Rebuild (Complete)
- [x] Command Center: Fraunces hero-h1 masthead, lg:grid-cols-12, editorial deal cards, signal timeline
- [x] Deal Room: PROJECT [NAME]: masthead at clamp(2.5rem,7vw,5.5rem), enrichment strip, 3-col bento grid, Agent Monitoring aside
- [x] Behavioral Profile: 64px metric numbers, 2-col editorial layout, Negotiation Rehearsal 3-col grid, Agentic Friction card
- [x] TIDE: col-span-7 hero + col-span-5 map, stat strip, editorial signal feed
- [x] IC Review: col-span-8 article + col-span-4 sticky Consensus Dashboard, Stitch masthead
- [x] Design tokens: font-hero-h1, font-eyebrow, font-card-title, font-section-h2, font-data-mono added to @theme
- [x] All inline styles replaced with Tailwind editorial utility classes

## Sprint 33 — Permanent Test Artifact Elimination
- [x] Delete all Sprint 6 hardcoded SAMPLE_LISTINGS from runScanPipeline (Peach State, Charlotte Logistics, Route-Based Pest Control, Metro HVAC, TX Government, Southeast Plumbing, Gulf Coast Electrical, Florida Pool, Mid-Atlantic Medical, Carolinas Roofing)
- [x] Replace static SAMPLE_LISTINGS array with LLM-generated dynamic listings (unique per scan, never repeats)
- [x] Delete Sprint11 test rows from production DB (Sprint11 Scout Prefill Test, Sprint11 Share Test Deal, source='test')
- [x] Confirmed no auto-seed on server startup in _core/index.ts
- [x] 96/96 tests passing after removal

## Sprint 34 — Unauth Lockdown + Marketing Landing Page
- [x] Build LandingPage.tsx — editorial broadsheet hero, value props, social proof, CTA
- [x] Build PublicSearch.tsx — limited read-only deal search with blur gates and upgrade CTA
- [x] Add publicDeals.search tRPC procedure — returns limited/sanitized deal data for unauth users
- [x] Wire / route: unauth → LandingPage, auth → Home (Command Center)
- [x] Wire /explore route → PublicSearch (public, no auth required)
- [x] Add ProtectedRoute wrapper — all operator routes redirect unauth users to login
- [x] Lock all 15+ operator routes behind ProtectedRoute
- [x] Run tests, save checkpoint

## Sprint 35 — Co-Pilot Embed + Living Demo Scenario
- [x] Remove floating Co-Pilot FAB bubble from GlobalCoPilot component
- [x] Embed Co-Pilot trigger as inline icon in EditorialTopNav (right side, near user avatar)
- [x] Create demo_scenarios table: thesis_title, snapshot_at, signals, score_breakdown, ic_summary, catalysts, key_risks, data_sources_used
- [x] Build /demo route — read-only rails UI with thesis deal, real signals, AI scoring, IC summary, snapshot timestamp
- [x] Add demo.refresh protectedProcedure — LLM-powered scenario regeneration with fresh market data
- [x] Wire "Refresh Scan" button in demo UI (visible only to authenticated operator)
- [x] Run tests, save checkpoint (96/96 passing)

## Sprint 36 — Co-Pilot Removal + TIDE Reference Rebuild
- [x] Remove Co-Pilot sparkle icon from EditorialTopNav (not in spec)
- [x] Remove embedded CoPilot state from EditorialTopNav entirely
- [x] Rebuild TIDE.tsx: dark editorial bg (#0F0F1E), Fraunces hero title, eyebrow badge
- [x] TIDE: Real US map (MapView component) with convergence cluster markers
- [x] TIDE: Live intelligence stream feed (right column) — convergence events, FEC signals, Federal Register
- [x] TIDE: AI analyst commentary strip below map
- [x] TIDE: Stat strip — Capital Tracked, Active Deals, Active Signals
- [x] TIDE: Match Stitch reference layout exactly (col-span-7 map + col-span-5 stream)
- [x] Run tests, save checkpoint

## Sprint 37 — Model Version Sync + TIDE Layout Rebuild
- [x] Audit all model strings in server/routers.ts and server/routers/ subdirectories
- [x] Update invokeLLM model overrides: Claude 4 Opus for owner psychology + Sentinel
- [x] Update invokeLLM model overrides: Gemini 3.1 Pro for Consensus + Red Team
- [x] Update invokeLLM model overrides: Gemini 3.1 Flash for TIDE enrichment + scan
- [x] Update Perplexity calls to sonar-pro model string
- [x] Update all UI model badge labels (CoPilot panel, Consensus Dashboard, Deal Room)
- [x] Rebuild TIDE hero: dark #0F0F1E bg, Fraunces title, eyebrow badge, system status
- [x] TIDE: Replace fake SVG map with real MapView + convergence cluster AdvancedMarkers
- [x] TIDE: Add live intelligence stream column (right, col-span-5) with timestamped event cards
- [x] TIDE: Stat strip at bottom — Capital Tracked, Active Events, Prediction Accuracy
- [x] TIDE: AI analyst commentary strip below map (Gemini 3.1 Flash label)
- [x] Run tests, save checkpoint — 96/96 passing

## Sprint 38 — Rory Sutherland Copy Rewrite + Persona Role Map
- [x] Audit all copy surfaces: LandingPage, PublicSearch, CoPilot, Consensus, Deal Room, TIDE, Settings
- [x] Define persona role map: assign named roles to each AI function (no model names in UI)
- [x] Rewrite LandingPage.tsx hero, value props, social proof, CTA with Rory Sutherland oblique framing
- [x] Rewrite PublicSearch.tsx gated CTA copy with same psychological register
- [x] Replace all model name badges in CoPilot panel with persona role names
- [x] Replace all model name badges in Consensus Dashboard with persona role names
- [x] Replace all model name badges in Deal Room (Third Signal, War Room) with persona role names
- [x] Replace all model name badges in TIDE intelligence stream with persona role names
- [x] Replace all model name badges in Settings AI Engine tab with persona role names
- [x] Run tests, save checkpoint

## Sprint 39 — Google Maps Singleton Fix
- [x] Audit Map.tsx loader logic and Scout page for multiple MapView instances causing duplicate script loads
- [x] Implement singleton Google Maps script loader (module-level guard, deduplicate across all MapView mounts)
- [x] Run tests, save checkpoint — 96/96 passing

## Sprint 40 — Deal Scoring + Market Scan v2026 + LOI Generation
- [x] Score all 15 live deals via financial algorithm — 3 HIGH PRIORITY, 5 QUALIFIED, avg 0.74
- [x] Wire /demo CTA on LandingPage.tsx — "See a live thesis →" button pointing to /demo
- [x] Fix Consensus Dashboard persona labels — replaced with The Quant, The Skeptic, The Scout
- [x] Market Scan: add Deal DNA v2026 comparison table (Operational Moat, Key-Man Risk, Institutional Readiness, Owner Psychology)
- [x] Market Scan: add Macro Signal Alignment panel (TIDE overlap signals with match %)
- [x] Market Scan: add Agentic Hunting live feed (off-market agent log with living-border animation)
- [x] Build LOIGeneration.tsx component with living-border draft canvas
- [x] LOI: left pane — LOI parameters (purchase price, earn-out, exclusivity, contingencies)
- [x] LOI: right pane — draft canvas with The Architect synthesis badge, NON-BINDING LOI preview
- [x] LOI: agent monitoring sidebar — The Orchestrator, The Auditor, The Architect with live activity log
- [x] LOI: Co-Analyst earn-out guidance panel (legacy preservation framing)
- [x] LOI: "Share with Counsel" + "Review Final Draft" action buttons
- [x] Add LOI Draft tab to DealDetail.tsx tabs
- [x] Run tests, save checkpoint — 96/96 passing

## Sprint 41 — Access Request Form + Visual QA
- [x] Add inline access request form to LandingPage.tsx (name, email, deal thesis, capital access)
- [x] Add publicAccess.requestAccess tRPC procedure — saves to DB + notifyOwner ping
- [x] Add access_requests table to DB schema (access_requests: id, name, email, deal_thesis, capital_access, status, created_at)
- [x] Refactor LandingPage hero CTA to scroll to #request-access anchor instead of login redirect
- [x] Add "Already have access? Sign in" link to access request section
- [x] Visual QA: TypeScript clean (0 errors), 96/96 tests passing
- [x] Run tests, save checkpoint

## Sprint 42 — Operator Registry + Operator Identity + Default Role Fix
- [x] Fix default role: new sign-ins default to 'user' (operator experience) instead of 'investor'
- [x] Add admin.listAccessRequests procedure — lists pending access_requests rows
- [x] Add admin.updateAccessRequestStatus procedure — approve/reject with status update
- [x] Build OperatorRegistry.tsx — Admin DNA view (Verified Operators stats, DNA Matching cards, Access Protocol table, Deal Assignment Queue, Live Stream Activity)
- [x] Build OperatorIdentity.tsx — User profile (Clearance badge, Investment DNA Heatmap, Agentic Command input, Security & Access log)
- [x] Wire /operator-registry route (admin only) and /profile route (all authenticated users)
- [x] Add Operator Registry + Operator Identity links to DashboardLayout Platform section
- [x] Add hunting_params column to users table (db:push migration 0014)
- [x] Add user.getProfile and user.saveHuntingParams tRPC procedures
- [x] CLIPIT (kvng.gunner@gmail.com) promoted from investor → user immediately
- [x] 96/96 tests passing, 0 TS errors, save checkpoint

## Sprint 42b — Theme Fix: Operator Registry + Operator Identity
- [x] Audit app CSS design tokens (index.css) — mapped var(--bone), var(--paper), var(--rule), var(--sh-fg-*), var(--signal-gold), var(--sage), var(--clay), var(--amber)
- [x] Rewrite OperatorRegistry.tsx — replaced all hardcoded dark hex colors with CSS design tokens; switched DashboardLayout → EditorialTopNav
- [x] Rewrite OperatorIdentity.tsx — replaced all hardcoded dark hex colors with CSS design tokens; switched DashboardLayout → EditorialTopNav
- [x] Both pages now match the app's light cream/parchment aesthetic (same as Command Center, AdminPanel, Scan)
- [x] 0 TypeScript errors, 96/96 tests passing, save checkpoint

## Sprint 43 — Global String-to-Number Audit
- [x] Scan all client pages for .toFixed(), division, and numeric comparison on DB-sourced fields
- [x] Added coerceRow()/coerceRows() utility to server/db.ts — normalizes 20+ numeric fields at the data layer
- [x] Applied coercion to getDeals, getDealById, getSignalByDealId, getCommercialAssets, getCommercialAssetById, getMacroSignals, getMacroSignalsActive, getDealShareToken
- [x] Fixed inline opportunityRadar.list query in routers.ts (urgencyScore, estimatedROI, capitalRequired, estimatedHoldYears)
- [x] Fixed inline getConsensusScore query in routers.ts (consensusScore, divergenceScore)
- [x] Pre-emptively coerced InvestorScout capRate, askingPrice, noi, sqft with Number() as defense-in-depth
- [x] 0 TypeScript errors, 96/96 tests passing, save checkpoint

## Sprint 44 — SBA Rule Update (Effective July 4, 2026)
- [x] gemini.ts: Updated capital stack prompt — SBA 7(a) max $5M per program, combined 7(a)+504 = $10M total; 504 stacking guidance for $5M–$10M deals with real estate/equipment
- [x] gemini.ts: Added seller note standby note language (counts toward 10% equity injection, 0% out-of-pocket)
- [x] gemini.ts: Updated fallback sbaEligible threshold $5.5M → $10.5M
- [x] gemini.ts: Updated fallback sbaAmount cap Math.min(5000000) → Math.min(10000000)
- [x] gemini.ts: Lowered DSCR kill floor from 1.25 → 1.15 (PLP minimum); 1.25 flagged as standard lender risk
- [x] stackRouter.ts: Added sba_7a_504_combined DEFAULT_LAYERS template (7(a) 50% + 504 40% + Seller Standby 10%)
- [x] ICReview.tsx: Updated benchmark "< $5M" → "≤ $10M (7(a)+504 combined)"; pass threshold updated to $10M
- [x] ICReview.tsx: Updated DSCR benchmark "1.25x" → "≥ 1.15x (PLP)"; pass threshold updated to 1.15
- [x] DealDetail.tsx: Updated DSCR label "Min 1.25 for SBA approval" → "Min 1.15x (PLP lenders), 1.25x standard"
- [x] DealDetail.tsx: Updated DSCR color threshold from 1.25 → 1.15
- [x] StrategyBlender.tsx: Updated DSCR color bands — 1.25+ green, 1.15–1.25 amber (PLP Eligible), <1.15 red
- [x] DealShare.tsx: Updated DSCR threshold from 1.25 → 1.15
- [x] routers.ts: Updated sbaEligibleSeed cap $5M → $10M
- [x] 0 TypeScript errors, 96/96 tests passing, save checkpoint

## Sprint 45 — UAT Blocker Fixes (logged in previous session)
- [x] Purge all Sprint8 test users from DB
- [x] Unblock CLIPIT + Jimmy Butler: set onboarding_completed=1, seed investor_dna records
- [x] InvestorOnboarding.tsx: saveDna.onSuccess now calls markOnboardingComplete + invalidates dnaStatus cache
- [x] OnboardingGuard: tightened guard condition to strict === false check
- [x] OperatorRegistry: fix Last Active timestamps (MySQL UTC string parsed with 'Z' suffix)
- [x] 96/96 tests passing, 0 TS errors, save checkpoint

## Sprint 46 — Gemini API Fix (logged in previous session)
- [x] Replace suspended Gemini API key with valid key
- [x] Update model names: gemini-3.1-pro-preview + gemini-3.1-flash-lite
- [x] 96/96 tests passing, 0 TS errors, save checkpoint

## Sprint 47 — Investor Onboarding Redirect Loop Fix
- [x] Root cause: OnboardingGuard had staleTime: Infinity on dnaStatus query — cache invalidation after quiz completion did not trigger a refetch
- [x] Fix 1: Changed staleTime from Infinity → 0 on investor.getDnaStatus query in OnboardingGuard
- [x] Fix 2: Added onboardingCompletedInDb bypass — reads authData.onboardingCompleted from auth.me; if true, skips redirect regardless of dnaStatus cache state
- [x] Verified: auth.me returns full User row including onboardingCompleted boolean
- [x] Verified: saveDna sets quizCompleted: true in investor_dna table (both insert and update paths)
- [x] 0 TypeScript errors, 96/96 tests passing, save checkpoint

## Sprint 48 — RippleEffect Scanner
- [x] Add ripple_signals table (auto-created via ensureTable() in rippleRouter.ts — no schema migration needed)
- [x] Add rippleEffect tRPC router: scan, escalate, list, getById, dismiss
- [x] scan: executes 8 surgical query templates via Perplexity Sonar, keyword-scores results, no LLM until escalation
- [x] escalate: calls Gemini Flash with structured gap-analysis prompt, returns JSON plays
- [x] Build RippleEffect.tsx page — signal queue, confidence bars, anchor type filters, escalate button, gap analysis drawer
- [x] Gap analysis drawer: EV/food/lodging/housing gap cards, 2-3 Main Street plays with capital stack sketch
- [x] Wire /ripple route in App.tsx, add Waves icon + RippleEffect to EditorialTopNav MORE_NAV
- [x] 96/96 tests passing, 0 TS errors, save checkpoint

## Sprint 49 — RippleEffect Persistence + Demo Experience

### Phase 1: RippleEffect Persistence & Caching
- [x] Add ripple_scan_cache table (24h TTL)
- [x] Add ripple_favorites table (user_id, signal_snapshot, plays, gap_analysis, pipeline_status)
- [x] Update rippleRouter.scan: check cache first, return cached result with fromCache flag
- [x] ripple.saveAnalysis, ripple.favorite, ripple.listFavorites, ripple.unfavorite procedures
- [x] RippleEffect.tsx: Save Analysis button, Favorite star, cache indicator, Favorites panel

### Phase 2: Favorites → Cross-Tool Pipeline
- [x] Add ripple_pipeline_jobs table (favorite_id, status, market_scan_results, tide_signals, ic_verdict)
- [x] ripple.runPipeline mutation — async: Market Scan → TIDE → IC Consensus on favorited signal
- [x] ripple.getPipelineStatus / listPipelineJobs procedures
- [x] RippleEffect.tsx: Run Pipeline button on favorites, pipeline results drawer

### Phase 3: On-Rails Demo Experience
- [x] Create /demo-tour route in App.tsx (public, no auth)
- [x] Create DemoTour.tsx — static 4-step on-rails walkthrough (Signal Detected → Deal Scored → IC Consensus → Main Street Plays)
- [x] Zero live API calls — all data hardcoded, no reverse-engineering surface
- [x] Chapter nav, step progress dots, animated score bars, IC verdict cards, Main Street play cards
- [x] Gated CTA → Request Access on landing page
- [x] LandingPage.tsx "See a live thesis" → /demo-tour
- [x] 96/96 tests passing, 0 TS errors, checkpoint saved

## Sprint 51 — Role-Based Module Permissions

- [ ] Audit all nav modules and map to route keys (command_center, market_scan, tide, memos, outreach, deal_room, asset_scout, opportunity_radar, strategy_blender, freedom_map, ripple_effect, settings, admin)
- [ ] Add role_module_permissions table: id, role (enum: operator/investor/user), module_key (string), enabled (bool), updated_at
- [ ] Seed defaults: operator = all ON; investor = market_scan, deal_room, tide, memos, outreach ON; user = none
- [ ] Add rolePermissions tRPC router: getAll (admin only), setPermission (admin only), getMyPermissions (protected — returns array of allowed module keys for current user)
- [ ] Mount rolePermissions router in appRouter
- [ ] Admin panel: add "Module Access" tab with role x module toggle matrix (3 columns: Operator / Investor / User, rows = all modules)
- [ ] useModulePermissions hook — fetches user's allowed modules from trpc.rolePermissions.getMyPermissions, cached, returns Set<string>
- [ ] EditorialTopNav: use useModulePermissions to hide nav links for modules user doesn't have access to
- [ ] Route guard: PermissionGuard component — wraps protected routes, redirects to /unauthorized if module not in user's permission set
- [ ] /unauthorized page — clean "Access Restricted" page with back button
- [ ] Wire PermissionGuard around all non-admin routes in App.tsx
- [ ] Tests for rolePermissions procedures (getAll, setPermission, getMyPermissions)
- [ ] Checkpoint

## TSL-BUILD-2026-003 — Diligence Reframe

### WP4: Ground Truth Deal Library + Rigor Gate
- [ ] Research ≥5 Acquiring Minds post-mortems, extract structured facts per schema
- [ ] Build composite anonymized deal for public demo (no real names/identifiers)
- [ ] Run rigor gate: feed pre-acquisition signals only to Red Team, verify it surfaces the correct failure mode
- [ ] Save Ground Truth Library as JSON fixture at server/fixtures/ground-truth-deals.json
- [ ] Document raw rigor-test output for report-back

### WP1: Homepage Copy Reframe
- [ ] Replace hero headline with Option C: "The deals that sink searchers all looked fine on the broker sheet."
- [ ] Replace hero subhead with spec copy (QoE-upstream line above fold)
- [ ] Update primary CTA to "Watch it catch a real landmine →" (routes to /demo-tour)
- [ ] Update secondary CTA to "Request access"
- [ ] Replace feature grid with 3 value sections (second opinion / partner who talks you out of it / decision to paper)
- [ ] Add "Who this is for" block
- [ ] Zero instances of banned vocabulary on any public route
- [ ] Market Scan and Opportunity Radar not featured/linked on public homepage

### WP3: Nav Reshuffle + IC Consensus Fix
- [ ] Reorder primary nav: Deal Room → Thesis Engine → IC Consensus → Seller Sim → Red Team → Capital Stack → Memo → LOI
- [ ] Move Market Scan + Opportunity Radar to "Labs (Experimental)" section with "Phase 2 — not live data" tag
- [ ] Fix IC Consensus: route model 1 → Claude (Poe), model 2 → Gemini, model 3 → Sonar
- [ ] Verify IC badge labels match actual model routing

### WP2: Read-Only Cached Demo at /demo-tour
- [ ] Pre-compute ONE full diligence run on WP4 composite deal, store as static fixture in client/src/fixtures/demo-run.ts
- [ ] Rewrite DemoTour.tsx: land → IC vote (show divergence) → Red Team teardown → landmine reveal → outcome → CTA
- [ ] Sequential reveal pacing — no spinner-to-verdict; show skepticism happening step by step
- [ ] Zero API calls on this route (verify in network tab)
- [ ] No login, no DB writes, no secrets reachable from this surface

### WP5: Gated Free Run + Searcher Intelligence DB
- [ ] Add searcher_intelligence table to schema (searcher_id, contact JSON, thesis JSON, behavior JSON, consent JSON, created_at)
- [ ] Add tRPC procedures: freeRun.start, freeRun.getResult, freeRun.saveSearcher
- [ ] Build /try route: deal input form → name+email gate (value-framed) → Red Team always-on + choose-2-of-4
- [ ] Locked modules: count + teaser UI, zero LLM calls ("2 concerns locked — unlock with full access")
- [ ] Every run writes Searcher Intelligence DB record with consent flags
- [ ] Specific target company NOT persisted without explicit opt-in
- [ ] Add /try to App.tsx public routes and landing page nav
