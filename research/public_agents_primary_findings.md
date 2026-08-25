# Public Agents and Congressional Disclosure — Primary-Source Findings

**Research date:** 2026-08-25.

| Source | Verified finding | Product implication |
|---|---|---|
| Public Agents product page | Public lets users describe an agent in plain language, refines missing parameters, presents a workflow for review, requires explicit approval, and supports pause/edit/stop controls. | Borrow the **intent → compiled workflow → explicit review** interaction pattern, not automatic execution. |
| Public Agents disclosures | Public characterizes the product as self-directed recurring transactions based on user instructions; users are responsible for suitability and verification before activation. | Capital Aperture should keep an auditable human-decision boundary and avoid language that implies an autonomous recommendation. |
| STOCK Act (Congress.gov) | Covered disclosures are generally due within 30–45 days after notice of a qualifying transaction; reports are made public after filing. | Treat congressional filings as delayed, evidence-bearing research inputs—not contemporaneous trade signals. |
| House Clerk financial-disclosure portal | The House maintains official financial-disclosure download/search infrastructure and official committee-assignment references. | Store each signal’s original report URL, filing date, transaction date/range, and committee metadata rather than treating an aggregator as the system of record. |
| Alpaca Paper Trading documentation | Paper trading simulates fills from real-time quotes but does not account for market impact, information leakage, latency slippage, queue position, price improvement, regulatory fees, or dividends. | All research outcomes must be labeled **paper-simulated**; do not use simulated fills as proof of real-world alpha. |

## Directly observed Public Agents flow

The referenced video and Public’s product page show a consistent workflow: users provide a natural-language instruction, the platform translates it into a visible, deterministic workflow, asks for missing details, requires explicit approval before activation, and retains an activity/history record. Public offers a native, live-execution brokerage capability; Capital Aperture should deliberately stop one step earlier: **research → evidence review → paper proposal → human decision record**.

## Source URLs

- https://public.com/ai-agents
- https://www.youtube.com/watch?v=o8pbbIqB2gg
- https://www.congress.gov/bill/112th-congress/senate-bill/2038
- https://disclosures-clerk.house.gov/FinancialDisclosure
- https://docs.alpaca.markets/docs/paper-trading
