# Model and Provider Pricing Audit — 2026-09-01

## Decision summary

- **Direct Gemini Standard is the cleanest price baseline.** For the Gemini models relevant to this repository, Poe's published token prices are consistently about **1.01% above** Google's current Standard rates. This is a small convenience premium, not a material cost advantage.
- **Google Batch or Flex is the cheapest published route for deferrable work.** Its relevant rates are generally 50% below Google Standard and therefore roughly half Poe's real-time rates. It is not a substitute for latency-sensitive thesis compilation or interactive approval flows.
- **Gemini 3.7 Flash and 3.6 Flash currently cost much less than Gemini 3.1 Pro Preview.** At Google's current through-2026 introductory rate, either Flash model is 62.5% cheaper on input and 68.75% cheaper on output than 3.1 Pro for prompts up to 200k tokens.
- **Manus cannot be normalized to dollars per 1M tokens from public documentation.** Manus documents credit- and consumption-based billing covering LLM tokens, virtual machines, and third-party APIs, but publishes no Forge or public-task token rate card. A claim that Manus is cheaper must be proven from the account's WebDev/task usage ledger using matched production prompts.
- **Recommendation:** retain 3.1 Pro for Red Team and high-risk synthesis until a quality benchmark passes; test 3.7 Flash first for the Capital thesis compiler and candidate memo. Keep direct Gemini for synchronous Cloud Run inference, use Manus Forge only where its server-side credentials are natively supplied, and reserve the public Manus task API for asynchronous work.

## Scope and method

Prices below were read on 2026-09-01 from first-party sources only. Token prices are normalized to USD per 1 million input or output tokens. "Poe markup" compares Poe's exact API-catalog rate with Google's current Standard rate for the closest named Gemini model. It does not measure latency, quality, tool-call charges, search charges, subscription cost, taxes, or infrastructure.

The repository currently maps `GEMINI_STRONG` to `gemini-3.1-pro-preview`, `GEMINI_FAST` to `gemini-3.6-flash`, `GEMINI_BALANCED` to `gemini-3.5-flash`, and `GEMINI_LITE` to `gemini-3.5-flash-lite`. Poe-configured alternatives include Claude Opus 4.8, Sonnet 4.6, and Haiku 4.5.

## Published real-time token prices

| Model / route | Input / 1M | Output / 1M | Cache read / 1M | Notes |
| --- | ---: | ---: | ---: | --- |
| Gemini 3.7 Flash — Google Standard | $0.75 | $3.75 | $0.075 | Introductory pricing through 2026-12-31; rises to $1.50 / $7.50 / $0.15 on 2027-01-01. |
| Gemini 3.7 Flash — Poe | $0.7576 | $3.7879 | $0.0758 | About 1.01% above Google Standard. Poe model ID: `gemini-3.7-flash`. |
| Gemini 3.6 Flash — Google Standard | $0.75 | $3.75 | $0.075 | Same introductory and scheduled 2027 pricing as 3.7 Flash. |
| Gemini 3.6 Flash — Poe | $0.7576 | $3.7879 | $0.0758 | About 1.01% above Google Standard. |
| Gemini 3.5 Flash — Google Standard | $1.50 | $9.00 | $0.15 | No date-limited discount shown. |
| Gemini 3.5 Flash — Poe | $1.5152 | $9.0909 | $0.1515 | About 1.01% above Google Standard. |
| Gemini 3.5 Flash-Lite — Google Standard | $0.30 | $2.50 | $0.03 | Lowest published Google Standard rate in this repo's active set. |
| Gemini 3.5 Flash-Lite — Poe | $0.3030 | $2.5253 | $0.0303 | About 1.01% above Google Standard. |
| Gemini 3.1 Pro Preview — Google Standard, prompt <=200k | $2.00 | $12.00 | $0.20 | No Google free tier. Output includes thinking tokens. |
| Gemini 3.1 Pro Preview — Google Standard, prompt >200k | $4.00 | $18.00 | $0.40 | Context-dependent tier; cache storage is $4.50 per 1M tokens per hour. |
| Gemini 3.1 Pro — Poe | $2.0202 | $12.1212 | $0.2020 | About 1.01% above Google's <=200k Standard tier. Poe lists `gemini-3.1-pro`, not Google's `gemini-3.1-pro-preview`, and its catalog row does not expose a >200k pricing tier. Do not assume long-context equivalence without a usage receipt. |
| Claude Opus 4.8 — Poe | $4.2929 | $21.4646 | $0.4293 | Cache write: $5.3662 / 1M. No Google comparison applies. |
| Claude Sonnet 4.6 — Poe | $2.5758 | $12.8788 | $0.2576 | Cache write: $3.2197 / 1M. |
| Claude Haiku 4.5 — Poe | $0.8586 | $4.2929 | $0.0859 | Cache write: $1.0732 / 1M. |

Poe's rounded web table displays these as $0.76/$3.79, $1.52/$9.09, $0.30/$2.53, $2.02/$12.12, $4.29/$21.46, $2.58/$12.88, and $0.86/$4.29. The table above uses the more precise values returned by Poe's first-party `GET /v1/models` catalog.

## Google Batch, Flex, free tier, and context caveats

| Google model | Batch or Flex input / 1M | Batch or Flex output / 1M | Difference from Standard |
| --- | ---: | ---: | ---: |
| Gemini 3.7 Flash, through 2026-12-31 | $0.375 | $1.875 | 50% lower |
| Gemini 3.6 Flash, through 2026-12-31 | $0.375 | $1.875 | 50% lower |
| Gemini 3.5 Flash | $0.75 | $4.50 | 50% lower |
| Gemini 3.5 Flash-Lite | $0.15 | $1.25 | 50% lower |
| Gemini 3.1 Pro Preview, prompt <=200k | $1.00 | $6.00 | 50% lower |
| Gemini 3.1 Pro Preview, prompt >200k | $2.00 | $9.00 | 50% lower |

- Google's pricing page marks Standard input and output as free of charge for 3.7 Flash, 3.6 Flash, 3.5 Flash, and 3.5 Flash-Lite, but **not** for 3.1 Pro Preview. Free access is limited and model/project rate limits are not a universal static quota; Google directs users to AI Studio to view the effective limits for their project.
- Google says free-tier content may be used to improve its products, while paid-tier content is not. This is operationally relevant for private theses and portfolio information.
- Google Batch/Flex is not published by Poe as a selectable discount for these catalog rows. Poe does expose cache-read pricing, but its web table does not disclose every possible context tier.
- Google Search grounding for Gemini 3.x includes 5,000 free search requests per month shared across Gemini 3.x models, then $14 per 1,000 requests. A model call can issue more than one search query, so search cost is not equivalent to prompt count.

## Relative cost observations

- For prompts up to 200k, direct Gemini 3.1 Pro costs **2.67x** 3.7/3.6 Flash input and **3.20x** Flash output. Above 200k it costs **5.33x** Flash input and **4.80x** Flash output at the current through-2026 Flash price.
- Poe preserves almost exactly the same ratios because its Gemini premium is approximately 1.01% across the compared models.
- On Poe, Claude Opus 4.8 costs about **2.13x** Gemini 3.1 Pro input and **1.77x** its output. Sonnet 4.6 costs about **1.28x** Gemini 3.1 Pro input and **1.06x** its output. These are price comparisons only, not quality equivalence.
- Direct Google's largest published savings come from Batch/Flex, not from avoiding Poe's small markup. For interactive calls, provider choice should therefore weigh reliability, model availability, latency, billing visibility, and failover more heavily than the approximately 1% Poe delta.

## Poe billing qualifications

- Poe publishes per-token USD prices in its model catalog and bills API use through account points. Paid-model API access requires an active Poe subscription or add-on points.
- Poe's Usage API reports both `cost_usd` and `cost_points`, with per-call token and cache breakdowns. Those receipts are the appropriate source for reconciling actual spend.
- The model catalog can represent cache pricing and context-dependent tiers, but absence of a tier in a displayed row is not proof that every prompt shape has identical economics. Model availability and catalog prices can change; cache the model catalog only briefly and retain the resolved model/rate with each run receipt.

## Manus: what is and is not comparable

### Manus WebDev / Forge

- Manus says deployed WebDev applications use a separate usage balance covering cloud hosting, databases, AI features, integrations, and application API calls. Charges are based on actual resource consumption.
- Manus does **not** publish a Forge model-by-model input/output token rate card in the reviewed official WebDev documentation. Therefore no honest per-1M-token comparison against Google or Poe is available.
- The account's **Website usage & billing** ledger is required to calculate an effective rate. Hosting, database, VM, and third-party API charges must be separated from LLM inference before comparing it with token-only Google or Poe prices.

### Public Manus task API

- Manus tasks are asynchronous agent runs, not a raw synchronous model-completion tariff. Public documentation says credit use depends on LLM tokens, virtual machines, third-party APIs, task complexity, and duration.
- The public task interface selects Manus agent profiles rather than exposing an underlying model price. Structured output is supported, but this does not make the route token-price-equivalent to Gemini or Poe.
- `task.create` is limited to 10 requests per minute per user, with no subscription-tier differentiation in the published rate-limit table. This supports background research or audit jobs better than latency-sensitive execution screens.
- Manus's free membership currently advertises 300 daily refresh credits and access to Manus 1.6 Lite in Agent Mode. That is a membership allowance, **not** a published API or Forge per-token free tier, and cannot be normalized to dollars per 1M tokens.

## Recommendation for this repository

1. **Do not globally replace `gemini-3.1-pro-preview` on price alone.** Keep it for Red Team and investment-memo safety benchmarks until another model passes the frozen rigor suite.
2. **A/B Gemini 3.7 Flash first** for thesis-graph compilation and candidate memo generation. It is newer than the current 3.6 Fast role, has the same current direct price, and is materially cheaper than 3.1 Pro. Require schema validity, unsupported-number rate, gate recall, latency, and retry thresholds before changing a role.
3. **Use Google Batch/Flex for offline jobs** such as re-scoring, nightly comparisons, and noninteractive audit enrichment. Keep Standard for user-blocking calls.
4. **Treat Poe as a model-access/failover layer, not a cost-saving layer for Gemini.** Its roughly 1% premium is modest; its value is provider breadth and a single API/usage ledger.
5. **Treat Manus as unpriced until measured.** Run matched prompts through Manus-hosted Forge and direct Google, capture account-level Manus usage before/after, subtract non-LLM WebDev consumption, and compare successful structured outputs—not raw calls.
6. **Persist a provider receipt per invocation:** logical role, provider, resolved model, input/output/cache tokens, dollar or credit charge, latency, retries, schema result, fallback use, and timestamp. Never silently switch a decision-critical model.

## First-party sources

- Google, [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing) — Standard, Batch, Flex, Priority, caching, long-context tiers, free-tier status, and grounding charges.
- Google, [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) — project/tier-dependent limits and AI Studio visibility.
- Poe, [Model pricing catalog](https://poe.com/api/models) and [`GET /v1/models` reference](https://creator.poe.com/api-reference/listModels) — exact per-token prices, cache rates, context windows, and model IDs.
- Poe, [Usage API](https://creator.poe.com/docs/resources/usage-api) — points and USD usage receipts.
- Poe, [External Application Guide](https://creator.poe.com/docs/external-applications/external-application-guide) — subscription/add-on requirement for paid-model API calls.
- Manus, [WebDev billing](https://help.manus.im/en/articles/13885710-how-does-webdev-billing-work) — separate usage balance and covered resources.
- Manus, [Credit consumption rules](https://help.manus.im/en/articles/11711097-what-are-the-rules-for-credits-consumption-and-how-can-i-obtain-them) — LLM, VM, third-party API, complexity, and duration drivers.
- Manus, [API introduction](https://open.manus.im/docs/v2/introduction), [`task.create`](https://open.manus.im/docs/v2/task.create), [task lifecycle](https://open.manus.im/docs/v2/task-lifecycle), and [rate limits](https://open.manus.im/docs/v2/rate-limits) — asynchronous task behavior, agent profiles, structured output, and request limits.
- Manus, [membership pricing](https://help.manus.im/en/articles/11711111-what-is-the-current-membership-pricing-for-manus) — current free membership allowance and profile restrictions.
