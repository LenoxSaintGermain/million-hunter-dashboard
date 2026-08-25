# Capital Aperture × Public Agents
## What to Borrow, What to Refuse, and the Congressional-Disclosure Wedge

**Author:** Manus AI  
**Research date:** August 25, 2026  
**Reference product:** [Public Agents: Automate Your Trading Strategy with AI][1]

## Executive judgment

Jim is right to like the **interaction model**. Public’s strongest idea is not “AI that trades”; it is a legible contract between a user’s intent and a deterministic workflow: describe an intent, resolve ambiguity, inspect the compiled logic, explicitly approve it, and retain a durable activity trail. Public describes the product as an AI-powered conversational interface for self-directed recurring transactions, where the user remains responsible for suitability and verification before activation.[1]

> **The contrarian call:** do **not** build a “congressional trade copier” or a Public clone on Alpaca. That is commodity distribution layered over a delayed and noisy public filing stream. The durable opportunity is a **Disclosure Intelligence Rail**: a research system that converts lagged political disclosures into auditable, portfolio-aware evidence packets and paper-testable hypotheses. The product should help an operator decide *whether the disclosure changes a pre-existing thesis*—not imply that a filing is a fresh trade instruction.

The reporting lag is structural. The STOCK Act generally requires covered transaction reports within **30–45 days** of notification for qualifying transactions, and the reports become publicly available after filing.[2] A congressional disclosure therefore cannot honestly be presented as a real-time catalyst. It can be useful context, particularly for policy exposure, clustering, and thesis corroboration; it is weak as a direct “buy now” trigger.

| Recommendation | Decision |
|---|---|
| Borrow Public’s natural-language-to-visible-workflow compiler | **Yes—now** |
| Borrow preflight, explicit confirmation, pause/edit, and activity-history affordances | **Yes—now** |
| Borrow native autonomous execution | **No—explicitly refuse** |
| Build a congressional-disclosure “alpha feed” | **No—reframe as evidence intelligence** |
| Use disclosures to enrich an existing thesis and paper proposal | **Yes—after a provenance-first data layer** |
| Support options, multi-leg spreads, or live order automation in this module | **Not in the first three releases** |

## 1. What Public has solved

Public’s product page presents a mature control loop. A user can write a prompt or select a marketplace starting point; the platform asks for missing details, proposes a workflow for review, requires explicit approval, and lets the user edit, pause, or stop the agent.[1] It also exposes an action log and transaction history. That is a superior UX pattern to a black-box “run agent” button.

The reference video shows the same product grammar: a free-form instruction is converted into visible **trigger**, **data fetch**, and **if/then/else** components. The language model is positioned as a translator; the activated workflow is deterministic. This distinction is the piece to borrow.

| Public pattern | Why it works | Capital Aperture translation |
|---|---|---|
| Describe intent in natural language | Reduces setup friction without hiding logic | “Monitor policy/disclosure evidence relevant to my AI infrastructure thesis.” |
| Ask for missing parameters | Prevents ambiguous activation | Require horizon, evidence threshold, portfolio mandate, and expiry policy. |
| Render compiled workflow | Makes interpretation inspectable | Render a **Research Recipe**, not an order recipe. |
| Explicit approve / pause / edit controls | Preserves agency | Approve a paper-research monitor; never auto-approve a broker action. |
| Running action history | Builds auditability and trust | Persist source document, parsing version, identity mapping, lag measure, evidence outcome, and human decision. |
| Marketplace / sharing | Creates distribution | Share **sanitized research templates**, never a purported alpha signal or prefilled trade. |

Public’s model includes native live execution and market monitoring, supported by an in-account infrastructure and real-time market data.[1] That is precisely where Capital Aperture should diverge. The current product’s strategic advantage is **research quality and refusal discipline**, not low-friction broker routing.

## 2. Congressional disclosure: useful evidence, weak trigger

The proposed signal-to-Alpaca pipeline has good instincts—portfolio sync, horizon-aware framing, collision warnings, and sizing safety rails—but it currently overstates the role of a public filing. The filing date, transaction date, transaction range, report type, and issuer identity must remain separate facts. The STOCK Act’s 30–45-day reporting framework means the research system must visibly calculate and display a **Lag Tax**.[2]

| Signal component | Product rule | Why it matters |
|---|---|---|
| Source provenance | Store the original House/Senate report URL or PDF, retrieval timestamp, parser version, and extracted fields. | The House Clerk provides official disclosure-report access; an aggregator may accelerate ingestion but cannot be the sole system of record.[3] |
| Time semantics | Preserve `transaction_date_range`, `filing_date`, `published_at`, and `observed_at` separately. | Prevents a 45-day-old event from being framed as contemporaneous momentum. |
| Entity resolution | Resolve member, issuer, security, CIK, ticker, asset class, and confidence; quarantine unresolved mappings. | “Alphabet,” funds, trust accounts, and generic descriptions create material mapping ambiguity. |
| Ownership context | Label self-directed, spouse, dependent, trust, blind trust, mutual fund, or unknown. | A disclosure is not automatically an expression of personal conviction. |
| Committee linkage | Treat committee relevance as a hypothesis with a cited assignment source—not causal proof. | Policy adjacency can inform diligence but is not a causal return model. |
| Cluster analysis | Aggregate only after normalized identities, comparable time windows, and duplicate handling. | Prevents multiple reports of the same underlying activity from looking like independent confirmation. |

### The correct disclosure card

The first surface should not say **“Congressional play.”** It should say:

> **Disclosure evidence — requires thesis fit review**  
> *Observed 37 days after reported transaction window. Entity mapping: 0.86 confidence. Committee relevance: documented, not causal. Portfolio collision: none measured. Disposition: investigate / track / reject.*

That language is materially more credible than a “copy this trade” posture. It forces the operator to see the information-decay cost before consuming any narrative.

## 3. The product to build: Disclosure Intelligence Rail

Capital Aperture already has the right primitives: thesis graph, fact ledger, evidence review, paper account snapshot, proposal preparation, monitoring, and an outcome ledger. Do not create a competing “Congress dashboard.” Add a **source class** to the existing research engine.

### The canonical user journey

| Step | Operator experience | System responsibility | Human boundary |
|---|---|---|---|
| **1. Describe** | “Watch congressional disclosures that could change my AI infrastructure thesis.” | Compile intent into constrained research criteria. | Operator confirms scope. |
| **2. Ingest** | See a queue of *evidence events*, not tickers to buy. | Retrieve primary report, normalize facts, measure lag, resolve entity with confidence. | Unresolved or low-confidence items are quarantined. |
| **3. Interpret** | Open a thesis-linked evidence card. | Explain what changed, what did not change, conflicts, and missing facts. | Operator can reject, track, or request a paper study. |
| **4. Stress test** | Compare against current holdings, concentration, and existing thesis nodes. | Detect collision, stale catalyst, duplicate exposure, and invalidation conflicts. | A constraint breach produces a refusal, not a work-around. |
| **5. Paper stage** | Review a scenario-backed research proposal. | Generate a dated, paper-only plan with source trail and explicit unknowns. | Separate recorded approval is required before any proposal exists. |
| **6. Learn** | Review outcome against the actual disclosed-event date and decision date. | Measure coverage, delay, paper assumptions, and decision quality. | No performance claim unless outcome data is sufficient and labeled. |

The important reframing is **research-to-stage**, not signal-to-order. Public’s “Describe → Build → Review → Run” becomes Capital Aperture’s **Describe → Normalize → Review → Paper Stage → Learn**.

## 4. Borrow / adapt / avoid matrix

| Pattern | Classification | Capital Aperture implementation | Reason |
|---|---|---|---|
| Natural-language agent creation | **Borrow** | Constrain prompts to thesis scope, horizon, evidence threshold, and mandate. | Eliminates setup friction while retaining a typed schema. |
| Visual logic graph | **Borrow** | Render source → lag gate → entity confidence → thesis fit → collision gate → disposition. | Turns opaque AI judgment into inspectable evidence logic. |
| Clarifying questions | **Borrow** | Block activation until horizon, research purpose, and evidence-disposition rules are explicit. | Removes ambiguity before a persistent monitor is created. |
| Approval / pause / edit lifecycle | **Borrow** | Use it for monitors and paper proposals, with immutable history. | The right trust loop, without broker autonomy. |
| Full activity history | **Borrow** | Log document retrieval, parser output, mapping changes, evidence checks, refusals, and operator decisions. | Essential for auditability and learning. |
| Prompt marketplace | **Adapt** | Share anonymized **research templates** and evidence policies; recipients must bind their own thesis and caps. | Gives distribution without broadcasting an implied trade recommendation. |
| Deterministic rule engine | **Adapt** | Rules produce dispositions: `track`, `needs-review`, `paper-study`, `refuse`. | Determinism is valuable; automatic trading is not the product edge. |
| Portfolio-aware analysis | **Adapt** | Display concentration/collision effects as facts and constraints, not “you should buy/sell.” | Maintains usefulness without drifting into unsuitable individualized advice. |
| Native live order execution | **Avoid** | Keep Paper-only rail and human-controlled broker boundaries. | Capital Aperture does not have Public’s brokerage, supervisory, or operational model. |
| “Congressional alpha” or copy-trading claims | **Avoid** | Use “disclosure intelligence,” “policy evidence,” and “lag-adjusted research.” | The disclosure lag makes simple alpha claims fragile. |
| Initial options / multi-leg product | **Avoid** | Defer until a later, separately governed module with explicit suitability, contract, liquidity, and risk controls. | Adds complexity before the core evidence engine is proven. |

## 5. Recommended 90-day build sequence

### Release A — **Evidence, not execution** (Weeks 1–3)

Build the normalized data rail and visible provenance before any scoring narrative. Create `policy_disclosures`, `disclosure_entities`, `disclosure_evidence_links`, and `disclosure_outcomes`. Every event must carry a raw-source reference, retrieval timestamp, original transaction range, filing date, mapping confidence, and a parser/model version.

The first operator surface is a **Disclosure Queue** inside Capital Aperture, filtered by active thesis. Its only primary actions are **Review evidence**, **Track**, and **Reject**. It should not contain a trade button.

### Release B — **Lag-adjusted thesis interpretation** (Weeks 4–6)

Introduce a transparent ruleset:

```text
if entity_mapping_confidence < required_confidence → QUARANTINE
if filing_lag_days > thesis.max_disclosure_lag_days → CONTEXT_ONLY
if source is non-primary and primary_document_missing → NEEDS_EVIDENCE
if portfolio_collision exceeds mandate cap → REFUSE
if thesis-node relevance is unproven → TRACK
else → PAPER_STUDY_ELIGIBLE
```

This is where the Public-style visible workflow pays off. The user should see why a signal was reduced, quarantined, or refused—without any hidden “agent confidence” magic.

### Release C — **Paper-study and measurement loop** (Weeks 7–10)

Let an operator convert an accepted evidence event into a paper-only study linked to the thesis graph. The paper study must record its decision time separately from disclosure and transaction dates. It should use existing Aperture monitoring and outcome primitives, but label outputs as **paper-simulated**.

Alpaca explicitly cautions that paper trading does not account for market impact, information leakage, latency slippage, queue position, price improvement, regulatory fees, or dividends.[4] The UI must surface that caveat beside every paper outcome.

### Release D — **Template sharing and supervised scale** (Weeks 11–13)

Release shareable research templates only after the queue has an audit log and stable refusal rates. A sharable object should contain no specific security, account, or order parameter. It should be a policy: source scope, disclosure-lag gate, evidence threshold, thesis linkage, and review cadence.

## 6. What to measure

Do not launch with a return target. The first product metric is **decision quality**, not alpha.

| Metric | Definition | Why it compounds |
|---|---|---|
| Primary-source coverage | % of ingested events linked to official source material. | Measures provenance integrity. |
| Entity-resolution confidence | Distribution of mapping confidence and manual overrides. | Reveals where automation is unsafe. |
| Lag-tax distribution | Filing/publication delay by event and source. | Prevents a stale feed from masquerading as a catalyst engine. |
| Thesis-change rate | % of events that change an evidence state, not just generate narrative. | Measures analytical relevance. |
| Refusal rate | % of events stopped by lag, mapping, collision, or evidence gates. | High can be healthy; it demonstrates integrity. |
| Paper-study completeness | % of paper studies with dated evidence, explicit invalidation, and outcome record. | Produces a defensible learning loop. |
| Outcome basis | Actual, paper-simulated, not measured. | Stops accidental performance overclaiming. |

## 7. Strategic conclusion

The valuable move is to borrow **Public’s workflow grammar** while refusing its execution posture. Public has optimized for helping a self-directed user automate instructions inside a native brokerage. Signal Hunter should optimize for helping a serious operator decide whether a lagged, messy public disclosure changes a thesis under explicit constraints.

That creates a cleaner division of labor:

> **Public:** “I already know the rule; execute it.”  
> **Capital Aperture:** “Show me whether this new evidence survives source, lag, thesis, and portfolio scrutiny—and make the refusal explain itself.”

That is defensible, more aligned with the existing Aperture architecture, and substantially less likely to degrade into a generic retail trading-agent clone.

## Delivery disclosure

**Basis:** This is product and workflow analysis; “Lag Tax” refers to the elapsed time between the reported transaction window and public filing/observation, not a forecast of return.  
**Time:** Sources reviewed on August 25, 2026. Public’s product state and Alpaca’s paper-trading documentation may change after this date.  
**Assumptions:** Capital Aperture remains paper-only, human-approved, and positioned as research tooling; no market-data or paid congressional-data provider is assumed.  
**Sources and confidence:** Public’s product page, the referenced video, the STOCK Act text, the House Clerk disclosure portal, and Alpaca’s paper-trading documentation are primary or official sources. The proposed roadmap is strategic synthesis, not empirical alpha validation.  
**Compliance:** This is research and analysis only, not personalized financial advice.

## References

[1]: https://public.com/ai-agents "Public — AI Agents"
[2]: https://www.congress.gov/bill/112th-congress/senate-bill/2038 "Congress.gov — STOCK Act"
[3]: https://disclosures-clerk.house.gov/FinancialDisclosure "Office of the Clerk, U.S. House of Representatives — Financial Disclosure"
[4]: https://docs.alpaca.markets/docs/paper-trading "Alpaca — Paper Trading"
[5]: https://www.youtube.com/watch?v=o8pbbIqB2gg "Public Agents: Automate Your Trading Strategy with AI"
