# Poe Non-Gemini Model Role Audit — 2026-09-01

## Decision summary

- **Use `deepseek-v4-flash` as the first cheap parallel critic.** Poe's DeepSeek-owned route is text-only, tool-capable, exposes a 1M-token context window, and costs **$0.1414 input / $0.2828 output / $0.0283 cache read per 1M tokens**. It is inexpensive enough to run beside a primary model without making every workflow a Gemini workflow.
- **Benchmark `deepseek-v4-pro` as the first non-Gemini adversarial and quantitative/coding reviewer.** It is a DeepSeek-owned, 1,048,576-token, tool-capable route at **$1.7576 input / $3.5152 output / $0.1465 cache read per 1M tokens**. DeepSeek's first-party API documentation confirms JSON output and tool calling for the underlying V4 Pro model. It must challenge deterministic calculations, never replace them.
- **Use `kimi-k3` selectively for long-context synthesis and difficult red-team cases.** Its Moonshot-owned Poe route supports text and image input, tools, and a 1M-token context, but costs **$3.0303 input / $15.1515 output per 1M tokens**. This is a specialist, not a default background worker.
- **Add `qwen3.8-27b-el` as the inexpensive multimodal/coding challenger.** Poe lists text, image, and video input, tools, structured JSON in the model description, 262,144-token context, and **$0.1717 input / $0.5051 output / $0.0808 cache read per 1M tokens**. The underlying Qwen3.8-27B checkpoint is an official Qwen open model; the Poe route itself is an EmpirioLabs-hosted NVFP4 service.
- **Keep `mistral-small-4` on the watchlist, not in production routing yet.** Mistral documents Apache 2.0 weights, 256K context, function calling, structured outputs, and hybrid instruct/reasoning/coding behavior. Poe's live catalog, however, exposes no price, context, or supported feature for this exact EmpirioLabs route. Missing catalog data is unknown, not free.

## Scope and method

The catalog was read at **2026-09-01T06:39:31Z** from Poe's first-party [`GET /v1/models`](https://api.poe.com/v1/models) endpoint, which returned 346 models. The endpoint's [first-party reference](https://creator.poe.com/api-reference/listModels) defines `id`, `owned_by`, modalities, pricing, and context fields. Dollar prices below convert Poe's per-token strings to USD per 1 million tokens.

Capability and release-status claims were checked only against first-party model/provider sources:

- Moonshot AI's [Kimi K3 repository](https://github.com/MoonshotAI/Kimi-K3), [Kimi Code model configuration](https://moonshotai.github.io/kimi-code/en/configuration/config-files), [Kimi vendor verifier](https://github.com/MoonshotAI/Kimi-Vendor-Verifier), and [Kimi K3 license](https://github.com/MoonshotAI/Kimi-K3/blob/main/LICENSE)
- DeepSeek's [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/) page
- Qwen's official [Qwen3.8 repository](https://github.com/QwenLM/Qwen3.8)
- Mistral's official [Mistral Small 4 model card](https://docs.mistral.ai/models/mistral-small-4-0-26-03)
- Poe's [Responses API](https://creator.poe.com/api-reference/createResponse) and [OpenAI-compatible API](https://creator.poe.com/docs/external-applications/openai-compatible-api) documentation

No completion calls were made. Presence in `GET /v1/models` proves catalog availability, not quality, latency, structured-output conformance, or successful invocation on this account. Those require a separate frozen-prompt benchmark.

## Live Poe catalog: primary candidates

All prices are USD per 1M tokens. `—` means the field was null or absent in the live catalog; it does not mean zero.

| Exact Poe model ID | Poe `owned_by` | Input | Output | Cache read | Cache write | Context | Poe-exposed input → output | Tools | Structured output evidence |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| `kimi-k3` | Moonshot AI | $3.0303 | $15.1515 | $0.3030 | — | 1,000,000 | text, image → text | Yes | Not enumerated by Poe's catalog; Moonshot's vendor verifier covers `response_format`, but Poe-route conformance is untested. |
| `kimi-k3-el` | EmpirioLabs AI | $3.0303 | $15.1515 | — | — | 1,048,576 | text, image, video → text | Yes | Not enumerated by Poe's catalog and untested. |
| `deepseek-v4-pro` | DeepSeek | $1.7576 | $3.5152 | $0.1465 | — | 1,048,576 | text → text | Yes | DeepSeek documents JSON output for V4 Pro; Poe-route conformance is untested. |
| `deepseek-v4-flash` | DeepSeek | $0.1414 | $0.2828 | $0.0283 | — | 1,000,000 | text → text | Yes | DeepSeek documents JSON output for V4 Flash; Poe-route conformance is untested. |
| `qwen3.8-27b-el` | EmpirioLabs AI | $0.1717 | $0.5051 | $0.0808 | — | 262,144 | text, image, video → text | Yes | Poe's live description explicitly says structured JSON output; invocation remains untested. |
| `mistral-small-4` | EmpirioLabs AI | — | — | — | — | — | text → text | No features enumerated | Mistral supports structured output, but Poe does not expose it for this route in the catalog. |

### Why the exact route matters

Poe can list multiple hosted routes for the same underlying family. The `owned_by` value describes the Poe catalog owner/provider route, not necessarily the model developer or the license of the underlying weights.

| Underlying model / Poe route | Poe owner | Input | Output | Cache read | Context exposed | Selection note |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `deepseek-v4-pro` | DeepSeek | $1.7576 | $3.5152 | $0.1465 | 1,048,576 | Preferred first-party-owner route and cheapest output among the listed Pro routes. |
| `deepseek-v4-pro-0813-el` | EmpirioLabs AI | $1.3333 | $4.0000 | — | 1,000,000 | Lower uncached input, higher output; adds a third-party web-search control. |
| `deepseek-v4-pro-0813` | Novita AI | $1.3333 | $4.0000 | $0.4444 | — | Catalog description says 1M, but the structured context field is absent. Do not infer it in routing code. |
| `deepseek-v4-flash` | DeepSeek | $0.1414 | $0.2828 | $0.0283 | 1,000,000 | Preferred cheap critic route. |
| `ds-v4-flash-0731-el` | EmpirioLabs AI | $0.4283 | $1.2848 | — | 1,000,000 | Roughly 3.0x the preferred route's input and 4.5x its output price. |
| `deepseek-v4-0731` | Novita AI | $0.1414 | $0.2828 | $0.0283 | — | Same token price as the DeepSeek-owned route, but no structured context field. |
| `kimi-k3` | Moonshot AI | $3.0303 | $15.1515 | $0.3030 | 1,000,000 | Preferred K3 route: first-party owner and priced cache reads. |
| `kimi-k3-el` | EmpirioLabs AI | $3.0303 | $15.1515 | — | 1,048,576 | Adds video and optional web search in Poe metadata, but no cache price. |

## Capability and provenance findings

### Kimi K3

Moonshot describes Kimi K3 as an **open-weight**, native multimodal, agentic model with 2.8T parameters, native vision, long-horizon coding and knowledge-work strengths, and a 1M-token context. Its official API uses `kimi-k3`; thinking is always enabled and accepts `low`, `high`, or `max` effort. Multi-turn and tool-call history must preserve the complete assistant message, including reasoning content and tool calls.

The exact release is governed by the **Kimi K3 License**, not a generic OSI license label. It permits access to weights and broad use, modification, deployment, and redistribution subject to stated conditions. Therefore this audit calls K3 **open-weight** and does not shorten that to “open source.”

Poe's Moonshot-owned `kimi-k3` record differs slightly from Moonshot's native configuration: Poe exposes `low`, `medium`, and `high`, with `medium` as default, while Moonshot documents `low`, `high`, and `max`, defaulting to `max`. The application must use the values returned by Poe for the Poe route rather than forwarding provider-native parameters blindly.

**Repository fit:** best specialist for long-context investment-memo synthesis, large evidence-ledger reconciliation, and a second high-effort adversarial opinion. It is too expensive for every candidate or every parallel critic.

### DeepSeek V4 Pro and Flash

DeepSeek's first-party API documentation identifies the current underlying versions as DeepSeek-V4-Pro-0813 and DeepSeek-V4-Flash-0731. Both support:

- 1M-token context and up to 384K output on DeepSeek's own API;
- thinking and non-thinking modes;
- JSON output and tool calls;
- Responses and Anthropic-compatible APIs;
- prefix and fill-in-the-middle completion, with FIM limited to non-thinking mode.

Poe's first-party-owner routes expose tools and thinking but do not enumerate JSON output or maximum output tokens in `GET /v1/models`. Use Poe's Responses API plus local schema validation for any decision-critical structured output; do not assume provider-native maximums or options automatically transit through Poe.

The reviewed first-party DeepSeek API page does not make an open-weight or open-source licensing claim for V4. This audit therefore labels Poe's V4 entries as **hosted DeepSeek models**, not open-source models. No licensing conclusion is inferred from older DeepSeek families or third-party model descriptions.

**Repository fit:**

- `deepseek-v4-pro`: adversarial Red Team challenger; code-path and quantitative-logic reviewer; long-form contradiction search.
- `deepseek-v4-flash`: cheap parallel critic, rubric scoring challenger, source-gap detector, and batch consistency pass.
- Neither model should perform authoritative risk arithmetic. Deterministic code remains the source of truth; the model reviews assumptions, formulas, and contradictions.

### Qwen3.8-27B via EmpirioLabs

Qwen's official repository calls Qwen3.8 a Qwen-Max-class **open release**, lists `Qwen/Qwen3.8-27B` among its open models, and carries an Apache 2.0 repository license. It highlights coding, professional work, research, long-horizon agent tasks, tool-use compatibility, and adjustable reasoning effort.

Poe's exact `qwen3.8-27b-el` route is an EmpirioLabs-hosted NVFP4 service. Poe—not Qwen—supplies the route-specific claims of text/image/video input, function calling, structured JSON, and the $0.1717/$0.5051 price. The open status of the underlying Qwen checkpoint does not make EmpirioLabs' hosted service itself “open source.”

**Repository fit:** inexpensive multimodal critic for screenshots, charts, source documents, and code/diff review; a useful independent family for consensus diversity. It should not become the sole financial or provenance judge.

### Mistral Small 4

Mistral's first-party model card identifies Mistral Small 4 as a GA Apache 2.0 model with 119B total parameters, 6.5B active parameters, a 256K context window, and combined instruct, reasoning, and coding behavior. Mistral exposes function calling, built-in tools, structured outputs, document Q&A, and batching on its own API, with direct-provider pricing of $0.15 input / $0.60 output per 1M tokens.

Poe's `mistral-small-4` entry is owned by EmpirioLabs AI. In the audited Poe catalog it has null pricing and context, text-only architecture, and an empty `supported_features` array. Those fields conflict with or omit parts of the provider model card. Until a Poe invocation probe and usage receipt establish the route behavior and cost, it is a **watchlist candidate**, not an enabled production role.

## Structured-output and tool-use boundary

Poe documents two materially different interfaces:

- `POST /v1/responses` supports reasoning, function tools, web search, and JSON-schema structured outputs across Poe models.
- Chat Completions supports ordinary tool calling, but Poe documents that `response_format: {type: "json_schema"}` is not supported there and strict tool schemas may be ignored.

This repository's current `server/poe.ts` uses Chat Completions. Its `poeJSON()` helper asks for JSON in the prompt and extracts/parses a returned block; it does not obtain provider-enforced schema conformance. Any role that emits decision records should either move to Poe's Responses API or retain prompt-based generation with explicit local schema validation, bounded repair, and a fail-closed result.

## Recommended role policy

| Repository role | Primary non-Gemini candidate | Secondary/challenger | Why | Required acceptance gate |
| --- | --- | --- | --- | --- |
| Adversarial Red Team | `deepseek-v4-pro` | `kimi-k3` for the hardest or longest cases | Independent reasoning families; DeepSeek Pro is substantially cheaper, K3 adds long-context multimodal synthesis. | Must pass the frozen GT-001/002/003 rigor suite with no loss of red-flag recall or false-safe increase. |
| Long-context synthesis | `kimi-k3` | `deepseek-v4-pro` | K3 is purpose-built for million-token, long-horizon knowledge work; DeepSeek Pro is the cheaper fallback. | Citation/provenance retention, unsupported-number rate, context recall, latency, and cost receipt. |
| Quantitative/coding verification | `deepseek-v4-pro` | `qwen3.8-27b-el` | DeepSeek Pro supports code/reasoning/tools; Qwen adds a cheaper independent review family and multimodal document handling. | Compare against deterministic expected outputs; zero authority to alter risk calculations. |
| Cheap parallel critic | `deepseek-v4-flash` | `qwen3.8-27b-el` | Both are inexpensive; Flash is the cheapest audited route, Qwen adds model-family diversity and visual input. | Schema-valid critique, useful-new-finding rate, p50/p95 latency, and per-call Poe receipt. |

## Implementation recommendation

1. Add these as **logical role candidates**, not global replacements: `POE_RED_TEAM`, `POE_LONG_CONTEXT`, `POE_CODE_REVIEW`, and `POE_CHEAP_CRITIC`.
2. Prefer the Poe route whose `owned_by` matches the underlying provider when economics and capabilities are otherwise suitable: `kimi-k3`, `deepseek-v4-pro`, and `deepseek-v4-flash`.
3. Resolve model metadata at startup from `GET /v1/models`, cache it for no more than 24 hours, and fail closed when an exact model ID disappears or required modalities/tools are absent.
4. Persist the resolved Poe model ID, `owned_by`, catalog price snapshot, input/output/cache tokens, actual USD/points receipt, latency, retries, schema result, and fallback use with every invocation.
5. Benchmark with frozen repository fixtures before enabling a role. Do not compare eloquent prose alone: score red-flag recall, false-safe rate, unsupported numbers, deterministic-math agreement, structured-output validity, source retention, latency, and cost.
6. Keep the primary model and critic independent. A DeepSeek critic should not grade another DeepSeek route in the same decision when Qwen, Kimi, Claude, or deterministic checks are available.
7. Do not silently fall back from one model family to another on a decision-critical call. Record and surface the provider/model change in the run receipt.

## Concise recommendation

Adopt **DeepSeek V4 Flash** now as the benchmark target for cheap parallel criticism, benchmark **DeepSeek V4 Pro** as the non-Gemini Red Team and code/quant reviewer, and reserve **Kimi K3** for long-context synthesis where its higher cost is justified. Add **Qwen3.8-27B-EL** as the low-cost multimodal independent critic. Leave **Mistral Small 4** disabled until Poe exposes or a usage receipt establishes its exact route cost and capabilities.
