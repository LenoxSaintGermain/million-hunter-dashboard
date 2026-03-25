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
