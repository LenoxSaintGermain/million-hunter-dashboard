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
- [ ] Run tests and save checkpoint

## Model Routing Audit — Gemini Direct + Poe for Claude/GPT
- [ ] gemini.ts: update Gemini model IDs to gemini-3.1-pro-preview / gemini-3-flash-preview (direct Google API)
- [ ] gemini.ts: replace Anthropic SDK (claude-3-5-sonnet) with Poe client (Claude-Opus-4.7) for Owner Psychology
- [ ] agents/index.ts: update MODEL_STRONG/FAST/LITE constants to Gemini 3.1 IDs
- [ ] agents/index.ts: consensus scorer calls Google API directly with Gemini 3.1 models
- [ ] routers.ts: update modelVersions metadata labels
- [ ] DB model_config: update consensus model IDs to Gemini 3.1 strings
- [ ] Run tests and save checkpoint

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
