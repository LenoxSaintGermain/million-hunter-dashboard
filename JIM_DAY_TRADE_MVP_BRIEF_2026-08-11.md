# Action Items

| Owner | Action | When | Completion standard |
|---|---|---:|---|
| Lenox + Jim | Set the 30-day paper-pilot mandate: permitted instruments, capital ceiling, maximum position size, maximum concentration, permitted holding periods, and loss / invalidation rules. | Before the next market session | The mandate is recorded before any candidate run or paper order. |
| Product / Engineering | Add a **Short-Horizon Paper Run** preset to Aperture. | Sprint 1 | A run cannot start without a thesis, liquidity requirement, catalyst window, deployable capital, holding-period range, and invalidation condition. |
| Engineering | Conduct one controlled Alpaca Paper flow: account sync → candidate review → human approval → paper submit → fill mirror → monitoring review. | Next market session | A complete, timestamped audit trail exists; no live order is possible. |
| Lenox + Jim | Choose **one** paid data provider to pilot first: Polygon, Benzinga, or FMP. | Before Phase 3 | The choice is tied to a named information gap, monthly spend ceiling, and measurable evaluation criterion. |
| Engineering | Produce an all-in hosting comparison: current environment versus Cloud Run / Cloud Run Jobs. | Within 3 business days | Model includes interactive compute, scheduled jobs, database, observability, data fees, secret management, and operating burden. |
| Product | Define the human-versus-system baseline for the pilot. | Before pilot start | Baseline, benchmark, sample size, and observation window are immutable for the pilot period. |

# TL;DR

Jim’s feedback confirms the right wedge for Capital Aperture: a **thesis-driven, portfolio-aware paper-trading cockpit** that helps an operator identify overlooked opportunities, construct short / medium / long-horizon allocations, and measure whether the system improves the operator’s documented opportunity set and paper outcome.[1]

The product should **not** be framed as an autonomous day-trading bot. That would be premature operationally and weak strategically. The current advantage is the evidence chain: thesis → discovery → research → score → construct → memo → human-approved paper order → monitoring → measured outcome. The MVP should make that loop daily, legible, and auditable.

The meeting’s reference to “consistent 30%+ day pops” is an aspiration, not validated evidence.[1] It should not become a success criterion, product claim, or investor-facing metric. The pilot needs a scorecard that measures returns *and* downside, concentration, utilization, data quality, and sample size.

# Product Decision Log

| Topic | Stakeholder signal | Decision / recommendation | Status |
|---|---|---|---|
| Core promise | “Given a thesis + portfolio + deployable capital, find what I have not considered.” | Preserve the re-underwrite principle: system-discovered and user-intended names are scored on the same evidence basis. | **Adopt** |
| Initial workflow | Day-trade-first, with short / medium / long tranches. | Build a short-horizon **paper** workflow first; model gain-cascading into medium / long allocations later. | **Adopt** |
| Execution rail | Validate in Alpaca sandbox. | Require explicit human approval before Paper submission; mirror fills; structurally refuse live execution. | **Adopt** |
| Data sources | EDGAR, Alpaca, Polygon, Benzinga, and FMP discussed. | Keep free/public rails. Add one paid provider only after selecting the decision gap it must close. | **Decision required** |
| Performance narrative | Discussion referenced large day-move and human-baseline aspirations. | Do not use as KPI or claim. Report only verified paper outcomes with a defined denominator and horizon. | **Reject as product claim** |
| Hosting | Current environment perceived as expensive for experimentation. | Build the total-cost model before migration; compute is only one cost component. | **Decision required** |
| Access model | Invite-only versus broad beta unresolved. | Run an operator-curated, high-touch paper pilot before exposing the workflow broadly. | **Recommend** |

> **Contrarian point:** “Day trading” is not a thesis. It is an execution horizon. The defensible product is the evidence-and-risk system that can support a short horizon without becoming a generic signal feed or copy-trading interface.

# Day-Trade MVP: Daily Operator Journey

| Step | Operator decision | Aperture behavior | Required guardrail |
|---:|---|---|---|
| 1 | Select thesis, Paper account, capital, horizon mix, and risk mandate. | Shows thesis graph, portfolio exposure, provider availability, and missing coverage. | Every input is versioned in the run. |
| 2 | Start a bounded discovery run. | Produces candidate roles: core, complementary, remainder, and alternative expression. | Every candidate retains discovery provenance. |
| 3 | Review a candidate’s evidence. | Runs fundamental, catalyst, macro, and technical research with citations and freshness labels. | Missing / stale inputs are named, not silently omitted. |
| 4 | Decide whether it fits the thesis and portfolio. | Shows composite fit, confidence, role, existing exposure impact, and verification flags. | A score is a decision aid, not a forecast. |
| 5 | Construct a short / medium / long paper tranche. | Compares allocations, capital use, concentration, and modeled portfolio effect. | Modelled figures are labeled; hard risk rules block order creation. |
| 6 | Generate a candidate record. | Saves a fact-validated memo in **Capital Aperture → Memo Library** with the run, thesis, score, sources, unknowns, and validation result. | Unsourced numbers are rejected by the memo validator. |
| 7 | Approve a paper trade. | Creates the proposal, requires explicit approval, submits only to Alpaca Paper, and mirrors fill status. | No autonomous or live execution path. |
| 8 | Review outcome and thesis health. | Runs catalyst / invalidation checks and reports Aperture Alpha with its verified, modeled, or mixed basis. | No realized-result claim without mirrored paper fills. |

## Current foundation and the real gaps

Capital Aperture already has the essential research and paper-trading substrate: thesis graph, candidate roles, research swarm, portfolio construction, fact-validated memos, Paper order approval/submission/fill mirroring, post-entry checks, and an Alpha surface. The critical MVP work is not a new generic screener. It is the **short-horizon decision contract**.

| Priority | Work item | Acceptance criterion |
|---:|---|---|
| P0 | Short-Horizon Paper Run preset | Requires holding period, liquidity floor, catalyst deadline, capital, concentration cap, and invalidation rule. |
| P0 | Paper-order risk gates | A Paper order cannot be submitted without notional, thesis link, reason, invalidation condition, market-hours state, and explicit Paper acknowledgement. |
| P0 | Monitoring cadence | Pre-market, intraday, and end-of-day checks are timestamped with citation freshness; alerts require human review. |
| P0 | Pilot scorecard | Every outcome view displays baseline, benchmark, sample size, horizon, drawdown, and metric basis. |
| P0 | Short-horizon memo extension | Each memo shows catalyst, expected time window, invalidation trigger, liquidity note, and source freshness. |
| P1 | One paid provider adapter | Adapter includes availability state, freshness labels, bounded errors, and recorded-fixture tests. |
| P1 | Gain-cascade simulator | Converts verified or modeled short-horizon gains into clearly labeled medium / long allocation scenarios. |
| P1 | Hosting model | Compares all-in cost and operational reliability before any migration. |
| P2 | Curated pilot controls | Supports isolated account / thesis data and an explicit risk profile for each pilot participant. |

# Pilot Scorecard and Decisions Required

The initial pilot should measure whether Aperture improves **decision quality** before it attempts to prove a trading edge. A return-only metric invites overfitting and hides concentration or tail risk.

| Metric | Definition | Valid basis | Required display context |
|---|---|---|---|
| System opportunity expansion | Candidates not initially proposed by the operator, grouped by role and source. | Run record + intended-trade list | Count, source mix, and later outcome. |
| Human vs. system paper P&L | Result of human-intended versus Aperture-added candidates under identical horizon rules. | Mirrored Paper fills and snapshots | Sample size, holding period, and closed / marked status. |
| Maximum drawdown | Largest peak-to-trough decline by strategy or tranche. | Position snapshots | Paired with return, never hidden. |
| Concentration delta | Change in HHI and top-position share versus baseline. | Portfolio snapshots | Requires acknowledgement if concentration increases. |
| Capital utilization | Deployable capital allocated and filled. | Order and fill records | Unallocated capital remains a valid outcome. |
| Evidence quality | Share of high-conviction claims with citations, freshness, and cleared verification flags. | Fact ledger and memo validator | Core missing facts prevent “high confidence” labeling. |

### Decisions Jim and Lenox need to make

1. What holding-period taxonomy will define short, medium, and long in the pilot?
2. What paper-capital ceiling, per-position notional ceiling, and concentration ceiling apply?
3. Which paid provider is first, what exact information gap does it solve, and what monthly spend ceiling is acceptable?
4. What pilot comparison is authoritative: manually logged operator ideas, a fixed benchmark, or both?
5. What minimum number of closed paper trades and what observation window are required before any performance conclusion is discussed?
6. What all-in monthly operating-cost ceiling would justify a Cloud Run migration?
7. Is the initial pilot strictly Lenox + Jim, or a small curated cohort? If a cohort, what disclosure and risk-profile requirements apply?

## Provider selection lens

| Provider | Use it first when… | Do not buy it first when… |
|---|---|---|
| **Polygon** | Intraday price, liquidity, and market-session context are the binding constraint. | The immediate bottleneck is catalyst detection rather than market data. |
| **Benzinga** | News, earnings, analyst actions, and event detection are the binding constraint. | The team cannot yet distinguish a useful catalyst from headline volume. |
| **FMP** | Financial normalization and broad company screening are the binding constraint. | Existing EDGAR/public data is sufficient for the pilot’s throughput. |

## Hosting decision lens

Do not move the system simply because a platform line item feels expensive. Compare interactive app compute, scheduled pre-market / post-market jobs, database, logging, secret management, data subscriptions, support overhead, and outage handling. A split design—interactive application plus scheduled job runner—may be right for Cloud Run, but only after the cost and operating model is explicit.

## References

[1]: ./Pasted_content_06.txt "Jim stakeholder meeting notes — day-trade thesis"
