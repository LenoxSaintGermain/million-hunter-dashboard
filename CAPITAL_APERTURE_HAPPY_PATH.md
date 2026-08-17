# Capital Aperture — Paper-Only Happy Path

## Purpose

This walkthrough shows a new operator how to turn one market belief into a **paper research brief**, observe evidence arriving in place, and move into paper-order review only after a human decision. It is an internal research workflow, not investment advice. No live order, live account, or transfer is part of this journey.

## The Core Journey

| Step | Operator action | What the system makes visible | Expected destination |
|---|---|---|---|
| 1 | Open **Theses** and choose **Research a market view**. | The scope card states that it builds a paper-only Capital Aperture brief and creates no order. | A Capital Aperture thesis template. |
| 2 | Start with **Dated catalyst** or **Portfolio gap**, then describe the belief in plain language. | The template explains its purpose; the primary button says **Create paper research brief**. | Capital Aperture setup. |
| 3 | Select the saved belief, confirm the default paper account and research budget, then choose **Build my research brief**. | Safeguards remain collapsed unless customization is necessary. The system does not expose thesis compilation as a user task. | The run-detail page. |
| 4 | Stay on the run-detail page. | An in-place animated status panel shows the active phase, elapsed time, evidence universe, partial candidates, and next action. | The same page; no status-page scavenger hunt. |
| 5 | Review the Decision Brief, Evidence Queue, and Research Ledger. | Every FRED observation carries provider provenance, observation date, source link, and thesis-impact context. | Human research decision. |
| 6 | Generate a candidate memo when evidence is sufficient. | If formatting fails, the ledger remains intact and the operator sees a **Retry fact-only memo** action rather than a raw JSON error. | Fact-validated memo. |
| 7 | Choose whether to create an order for human approval. | Paper-only warning, approval gate, and source/basis labels remain visible. Nothing submits autonomously. | Optional paper-order queue. |

## Guided Use Cases

| Use case | Start template | What to learn | What would invalidate it |
|---|---|---|---|
| Event research | Dated catalyst | Whether an observable event changes the evidence base within a defined deadline. | The catalyst misses, its disclosure contradicts the premise, or it expires. |
| Portfolio gap | Portfolio gap | Whether a security adds a distinct thesis path rather than duplicating current exposure. | The new evidence shows correlation, overlap, or a broken mechanism. |
| Exposure challenge | Existing Capital thesis | Whether an existing position still earns its place after fresh fundamental, liquidity, and macro evidence. | The supporting evidence weakens or violates the paper mandate. |

## Approved Alpaca Paper Research Canvas

The operator approved the following **simulated notional purchases** for the connected Alpaca Paper account. They are research context only; their presence is not a recommendation.

| Symbol | Simulated notional | Research role |
|---|---:|---|
| NVDA | $10,000 | Compute / semiconductor exposure |
| MSFT | $8,000 | Platform and enterprise AI demand exposure |
| AVGO | $7,000 | Networking / custom silicon exposure |
| VRT | $6,000 | Data-center thermal and power infrastructure exposure |
| ETN | $5,000 | Electrification and power-distribution exposure |
| CEG | $4,000 | Independent power-generation exposure |
| **Total** | **$40,000** | **Six-paper-position research canvas** |

The orders were accepted by Alpaca Paper on **2026-08-16**. After the market opened, Alpaca reported **partial fills** for NVDA and CEG while MSFT, AVGO, VRT, and ETN remained queued as `new`. A read-only sync then mirrored four current positions into Capital Aperture and updated synced cash to **$90,790.62**. The portfolio remains labeled **Partially filled — broker updates pending** until the remaining orders resolve; no autonomous follow-on order is permitted.

## Where Outcomes Appear

An **acquisition thesis** such as Septic Route belongs on **Command Center**, not Asset Scout. The Thesis Workspace’s visible **Search** action creates a thesis-linked discovery job; Command Center then displays its thesis name with the live scan-progress card and the resulting qualified deals. Asset Scout remains a distinct property/historic-asset workflow.

## Operator Expectations

> The system should never leave an operator to infer whether a run is researching, completed with no candidates, or failed. The run-detail page is the single source of truth for live progress, partial results, failure recovery, and the next human decision.
