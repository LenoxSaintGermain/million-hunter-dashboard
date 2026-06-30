# Perplexity Sonar Deep Research — API Reference Notes
# Retrieved: 2026-06-30

## Model String
`sonar-deep-research`

## Endpoint
`POST https://api.perplexity.ai/v1/sonar`

## Pricing (as of 2026-06-30)
- Input tokens: $2 / 1M
- Output tokens: $8 / 1M
- Citation tokens: $2 / 1M
- Search queries: $5 / 1K requests
- Reasoning tokens: $3 / 1M
- Typical single deep-research call: ~$0.80 (per sample in docs)

## Response Shape
```json
{
  "id": "string",
  "model": "sonar-deep-research",
  "created": 1756488074,
  "usage": {
    "prompt_tokens": 33,
    "completion_tokens": 11395,
    "total_tokens": 11428,
    "citation_tokens": 19028,
    "num_search_queries": 21,
    "reasoning_tokens": 193947,
    "cost": { "total_cost": 0.816 }
  },
  "citations": ["https://...", "https://..."],
  "search_results": [
    {
      "title": "string",
      "url": "https://...",
      "date": null,
      "last_updated": null,
      "snippet": "string"
    }
  ],
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Full markdown report text with inline [1][2] citation markers"
      }
    }
  ]
}
```

## Key Notes
- `citations[]` = array of source URLs (top-level, not nested)
- `search_results[]` = richer objects with title, url, snippet
- `choices[0].message.content` = full report text with inline [N] citation markers
- Context length: 128K
- Typical latency: 30s–several minutes (async API available)
- Async API endpoint available for long-running jobs

## Async API
For jobs expected to take >30s, use the async endpoint pattern.
See: https://docs.perplexity.ai/docs/sonar/models/sonar-deep-research (async-api tab)

## Cost Controls for Signal Hunter
- Per-subject budget cap: ~$2 max per research call (use sonar-pro for cheaper queries)
- TTL: 24h for Radar signals, 72h for deal dossiers
- Monthly hard cap: implement via token counter in DB
- Kill-switch: ENV flag `DEEP_RESEARCH_ENABLED=true/false`
