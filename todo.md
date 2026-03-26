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
