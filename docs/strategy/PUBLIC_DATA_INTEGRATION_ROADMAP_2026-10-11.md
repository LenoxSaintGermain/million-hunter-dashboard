# Public data: verified inventory and integration roadmap

Date: 2026-10-11. Team: Third Signal Lab. Project: Third Signal Lab Agency.
Primary surface/label: Research OS. Status: SEC issuer receipts and shared feed quotas released as `484fe40`; remaining integrations planned.
Linear is unavailable (UNAUTHORIZED). Work packages below are ready to sync, not created issues.

## Decision

Build sourced diligence evidence, not a directory of API widgets. The authenticated lookup layer is implemented in `23c1993`. The first durable evidence slice now captures owner-scoped SEC issuer snapshots; automatic deal binding and agent enrichment are not implemented. See [SEC verification and release gate](../qa/SEC_EVIDENCE_RECEIPTS_2026-10-11.md). Public demos remain frozen, explicitly illustrative and zero-API. Nothing in this roadmap grants trade, outreach, credit, legal, or investment approval.

The supplied Gemini plan is a candidate inventory, not an access or licensing guarantee. HTTP success alone is insufficient: validate content type, schema, timestamps, entity identity and permitted use. Unknown data stays unknown. No account registrations, subscriptions or credentials were created during this audit.

## Already implemented

See [repair and UAT record](../qa/PUBLIC_INTELLIGENCE_FEEDS_2026-10-11.md) for point-in-time adapter and browser evidence.

| Provider | Implemented | Not implemented / not implied |
| --- | --- | --- |
| Polymarket Gamma | Event/outcome lookups and probability bars | Independent forecasts, agent evidence receipts |
| Markbase | Trademark-name lookup and raw status | Legal clearance, validated entity ownership |
| USAspending | Recipient autocomplete | Awards, verified UEI matching, contract revenue |
| SEC | Ticker/CIK index, explicit owner-scoped submissions receipts, immutable history and exact form-count chart | Filing-content analysis, historical archive ingestion, automatic deal matching or engine enrichment |
| Frankfurter | Dated reference FX | Executable prices or historical valuation service |
| favicon.im | Decorative URL helper | Authoritative business identity |

All lookups are authenticated. SEC capture is an explicit persistence action, disabled by default. SEC index/submissions now share a database-backed quota and provider cooldown. The other lookup providers have shared application-enforced provider budgets (60/minute) and a shared caller budget (30/minute across all lookups); caches remain local. These are application limits, not claims about official provider allowances. Production deployment and signed-in deployed-route UAT remain separate release gates.

## Candidate audit

Checked 2026-10-11. Direct probes are unauthenticated, read-only observations from this environment, not uptime guarantees or legal clearance. Keyed services were documentation-reviewed, not tested with credentials. Commercial rights require confirmation for our customer-facing use even where an endpoint is readable.

| Source and primary reference | Observed access / correction to original plan | Disposition |
| --- | --- | --- |
| [SEC submissions](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) | `data.sec.gov/submissions/CIK0000320193.json`: 200 JSON, Apple Inc., 1,001 recent filing entries. Official API requires no key. | First filing integration candidate; retain accession, form, filing date and original source. An 8-K is not automatically a material-risk finding. |
| [Census](https://www.census.gov/data/developers/guidance/api-user-guide.html) | A 2023 CBP county/NAICS query returned 200 **HTML “Missing Key”**, not usable data. | Key gate. Validate dataset vintage, FIPS, NAICS and suppression before use. Regional aggregates do not verify a target's payroll. |
| [USPTO ODP](https://www.uspto.gov/about-us/news-updates/uspto-open-data-portal-require-registration-access-beginning-june-18-2026) | Official registration requirement effective June 18, 2026; account/MFA and API key needed. No authenticated probe. | Credential gate; assignments are not proof of validity or defensibility. |
| [OpenCorporates API](https://api.opencorporates.com/documentation/API-Reference), [terms](https://opencorporates.com/terms-of-use/) | Key required. Free/open access is conditional; proprietary customer-facing redistribution is not generally free. | Commercial licensing gate before entity enrichment. |
| [Finlight pricing](https://finlight.me/pricing) | Free plan: 5,000 requests/month, 12-hour delay; no sentiment, ticker/entities or streaming. | Delayed context only if licensed; not free real-time catalyst/sentiment monitoring. |
| [Adanos docs](https://api.adanos.org/docs), [terms](https://adanos.org/terms) | OpenAPI fetched successfully; `X-API-Key` required. Free/Hobby is noncommercial; customer-facing commercial use requires a different plan. | Hold production use for commercial rights and credentials. |
| [AlphAI developers](https://alphai.io/developers) | Keyed free tier: 100 requests/day, 20/minute, 30-day archive; Radar delayed 60 minutes. No authenticated probe. | Optional delayed-context evaluation; confirm production commercial terms. Distinct from AlphaSMO. |
| [FilingFirehose](https://filingfirehose.com/), [terms](https://filingfirehose.com/terms) | `/v1/public/8k?limit=1`: 200 JSON, 72-hour window; free tier has 15-minute caching. History/webhooks paid. Terms restrict redistribution. | Internal delayed pilot only until product rights resolved; direct SEC first. |
| [AlphaSMO docs](https://alphasmo.com/developer/docs), [terms](https://alphasmo.com/terms) | Institutions and convergence endpoints returned 200 JSON anonymously. Exact anonymous quota unverified. Sample reporting period 2025-12-31 and last-buy date 2026-09-11 are not current activity. | Research evaluation only pending rights. Congressional-data restrictions need separate review. No automatic IC weighting from scores. |
| [PredScope API policy](https://predscope.com/api) | `/api/markets.json`: 200 JSON; 10-minute snapshots, not a verified probability time-series API. Policy allows commercial use; upstream rights still relevant. | Optional comparison; same Polymarket origin is not independent corroboration. Lifecycle validation still needed. |
| [SCALA API](https://score.get-scala.com/api/), [terms](https://score.get-scala.com/terms) | Search returned 401, key required. Free key offers 50 calls/month; commercial use requires subscription. Scores explicitly are not credit ratings. | Remove from zero-auth quick wins. Do not treat estimates as EBITDA, payroll or solvency proof. Exclude `to_verify` records from redistribution. |
| [Congressional Stock Brain](https://congressionalstockbrain.com/) | Homepage returned 402 and unavailable notice; usable primary API documentation not established. | Hold. Auth, quota and reuse rights unknown; this does not establish permanent closure. |
| [Statistics of the World](https://statisticsoftheworld.com/api-docs), [terms](https://statisticsoftheworld.com/terms) | Indicator catalog returned 200 JSON, total 335 (not the claimed 440+). Docs allow 1,000 anonymous requests/day. Reuse is source-specific. | Small rights-cleared macro pilot; preserve units, observation period, revisions and forecast labels. |
| [Project Cost Estimator](https://projectcostestimator.com/api-docs), [terms](https://projectcostestimator.com/terms) | `/api/cost-data`: 200 JSON, CC BY 4.0, version 2026-07-16. `/api/v1/estimate`: 401. Keyed estimates limited to 100/month; compare/index endpoints described as roadmap. | Attributed indicative dataset only after resolving scope of dataset vs general service terms. Not seller expense verification. |

The blanket descriptions “unlimited,” “no-auth,” “real-time,” “credit rating,” and “ready immediately” must not be carried from directory entries into product copy.

## Implementation sequence and acceptance gates

Each row is one concrete work package. PD-01's SEC registry/shared-budget slice, PD-02's issuer receipt slice, PD-03 submissions ingestion and PD-07's SEC review UI are production-shipped in `484fe40`, with signed-in capture verification. The broader provider registry, deal binding, retention administration, engine consumption and frozen SEC demo remain open. Complete the dependency gates before expanding UI claims.

| ID / priority | Change | Acceptance / dependency |
| --- | --- | --- |
| PD-01 / P0 | Source registry and deployment budgets | Record official endpoint, auth mode, credential reference (never value), approved use, quota, attribution, timestamp semantics and kill switch. Denied/unconfirmed use cannot be enabled in production. Distributed quotas required before multi-instance release; test 429, cooldown and concurrent callers. |
| PD-02 / P0 | Owner-scoped, append-only evidence receipts | Store owner, authorized deal/subject, provider, source URL, provider record/accession, schema version, normalized payload hash, retrieval time, observation/reporting period, expiry and failure state. Re-fetch creates a revision, not an overwrite. Test two-user isolation, duplicate/amended records, deletion policy, migration and rollback on an isolated DB. Depends PD-01. |
| PD-03 / P1 | SEC submissions ingestion | Server resolves verified CIK; ingest forms/accessions/dates with original SEC links under fair-access budget. Tests cover malformed JSON, missing CIK, amendments, duplicates, stale/429/timeout. UI shows reporting period and source; no inferred verdict. Depends PD-02. |
| PD-04 / P1 | USAspending award evidence | Human confirms recipient identity/UEI before award lookup. Distinguish award ceiling, obligations, disbursements and period. Never equate federal obligations to current business revenue, municipal contracts or QoE. Preserve no-match and ambiguous-match states. Depends PD-02. |
| PD-05 / P1 | Licensed local-market and currency context | Census key configured server-side; dataset/schema/vintage verified. Preserve suppressed values and geography. Historical FX must use applicable valuation date, not silently today's rate. Tests cover unsupported dates/currencies and missing observations. Depends PD-01/02 and credential availability. |
| PD-06 / P1 | Engine consumes evidence receipts | Explicit research action binds receipt IDs into Red Team/IC inputs and saved output. Citations survive synthesis; contradictions and missing evidence are exposed. Old decisions do not mutate when a source refreshes. Fail closed on unsupported entity matches. No automatic orders/outreach/approval. Depends PD-03/04. |
| PD-07 / P1 | Visual evidence review and frozen demos | Compact source/freshness coverage, actual comparison charts with units and dates, inline inspect/retry; no chart for unknown data. Keyboard and 354px mobile UAT. Freeze sanctioned illustrative receipts for demos; network assertion proves zero API calls and no auth wall. Depends available receipts; does not require every optional source. |
| PD-08 / P2 | Optional-provider pilot | Evaluate one rights-cleared macro or cost dataset only after PD-01/02. Measure incremental evidence, entity match quality and failure behavior. Filing/insider/news aggregators remain disabled until license/key gates are met. No score substitution for diligence. |

## Architecture constraints

- Reuse adapter envelopes and validation patterns from `server/publicIntelligence.ts`; do not equate transient lookup success with saved diligence.
- Existing `researchResults` stores a subject cache; `server/deepResearch.ts` replaces cached rows. It is **not** an immutable evidence ledger. PD-02 needs a separately reviewed schema/migration and ownership enforcement before engine adoption.
- Credentials stay in server secret storage. User-supplied URLs never become unrestricted server fetch targets. Resolve allowed provider paths and authorized subjects server-side.
- Observe provider terms, bounded response sizes/timeouts and separate per-user/provider budgets. Retried failures remain visible; cached evidence keeps its original successful-fetch time.
- No scheduled paid runs or automatic expansion of data collection is authorized by this roadmap. Public demos never invoke these adapters.

## Verification and release checklist

For each implementation: red regression test → isolated-DB tests → opt-in read-only live probe → desktop/mobile browser success, empty, malformed, timeout, rate-limit, stale and recovery states → demo zero-network check → scoped commit. Never run tests against the production `.env` database.

Before claiming production readiness: verify deployed revision/traffic, authenticated route/account, source provenance and errors in the actual browser. A successful build or pushed commit is not a deployment receipt. Keys/licenses and inaccessible providers are explicit blockers for those integrations, not reasons to fabricate data or silently substitute another feed.

## PD-06 local implementation checkpoint

The first deal-analysis slice now binds owner-confirmed, same-legal-entity SEC receipt versions into immutable Red Team and IC runs. Exact input hashes, citation facts, model IDs, failures and version comparisons are retained. Actual provider success and isolated browser tests are recorded in [PD-06 verification](../qa/PD06_EVIDENCE_ANALYSIS_2026-10-11.md). This is local implementation, not a production release. Production remains the SEC receipt release above until migration and deployed UAT gates pass. Research-brief binding, award evidence, filing-content interpretation and uploads remain open.

## Ship-log boundary

Five lookup feeds were pushed in `23c1993`; baseline repairs and the initial roadmap followed in `48717d2`. SEC receipts and shared feed budgets are the current implementation. Validation and exact release status are recorded in the linked SEC QA report; implementation is not a production-deployment claim. Linear synchronization awaits reauthentication.
