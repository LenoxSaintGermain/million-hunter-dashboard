# Specs

Source-of-truth build specs for Signal Hunter OS. When a spec conflicts with a `CLAUDE.md` prime directive, the prime directive wins.

## Status (reconciled against git history 2026-07-10 — verify against live code before acting)

### TSL-BUILD-2026-004 — Fix-It + Investor Brief
- **A-1 fabricated testimonials:** ✅ removed (`6de766d`, verified in `LandingPage.tsx`)
- **A-2 demote Market Scan/Radar, kill "Live" badge:** ✅ shipped; Radar later returned to primary nav under 005 WP-DR2's sanctioned reversal (real cited sonar-pro data)
- **A-3 rigor gate hardening:** ✅ shipped 2026-07-10 — GT-001/002/003 run cold through production Red Team (`scripts/rigor-gate-cold.ts`); raw output + honest gap notes in `ground-truth-deals.json` → `rigor_gate_test.results`. All 3 passed; contract-term extraction remains the flagged enhancement.
- **A-4 IC labeling:** ✅ persona labels shipped (`28644ba`)
- **Part B investor brief:** ✅ `/brief` shipped (`6de766d`) — absorbed into 006

### TSL-BUILD-2026-005 — Deep Research Data Layer
- **WP-DR1 research service + cache:** ✅ shipped (`b29bcc9`) — cost controls (budgets, monthly cap, kill-switch) unverified
- **WP-DR2 Radar made real:** ✅ shipped, restored to primary nav with citations
- **WP-DR3 Market Scan decision:** ✅ kept as honest Labs module (outcome b)
- **WP-DR4 diligence enrichment dossier:** 🟡 Deal Dossier module shipped (sonar-pro, 72h TTL, citations); dossier→Red Team/IC evidence wiring unverified
- **WP-DR5 brief reuse:** 🟡 `/brief` sims verified deterministic with provenance labels

### TSL-BUILD-2026-006 — Bulletproof Solo Walkthrough
- ✅ `/walkthrough` shipped (`6c1e0b2`, 8 steps, zero-auth, zero-API, framer-motion polish)
- ⬜ OPEN: the §6 "MUST NOT HAPPEN" acceptance pass — run end-to-end logged out on a fresh browser: no login redirects, no role/token gates, zero API calls (network tab), every control self-explains, progress indicator, mobile + laptop.

### TSL-BUILD-2026-007 — Wingate Bespoke Demo Rails
- ⬜ BLOCKED on operator inputs (§1): confirmed Wingate thesis, selected real deal with a blind-spot signal, captured live-run fixture. Shell + flagged placeholders allowed; never invent deal data. Builds after 006 acceptance passes.
