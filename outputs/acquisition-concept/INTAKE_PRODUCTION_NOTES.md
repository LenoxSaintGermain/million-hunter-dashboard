# Bring your own thesis, research or analysis

September 29, 2026 — design/production notes, not implemented ingestion. PDF skill used for Jim's seven-page document; v2 Google Doc read via connector. Originals unchanged. No contacts/signatures copied into the seed.

## POC journey

Front of house: “Start with your own idea” alongside the opportunity profiles. Choose Write an idea, Bring research, or Review an existing analysis. Offer a clearly labeled example: “Five-vehicle fleet scenario — adapted from a supplied thesis.”

One intake sheet: document type, paste area/file attachment concept, objective and asset type. POC accepts local draft text only; no claim that a PDF was parsed or a research service ran. Example loader uses the authored seed, never pretends to extract arbitrary uploads. Input is rendered as text, not executable markup. No provider or storage calls.

Next reveal: “Here is what we understood.” Separate mandate requirements, sourced claims, assumptions, calculations and unanswered questions. Show origin/page on each field. User confirms or corrects the mapping before evaluation. Imported material cannot modify system instructions or approval rules.

Next: choose acquisition screening versus scenario analysis. Do not silently apply a business-acquisition mandate to a fleet thesis. Show which checks apply and which are not applicable. A deliberately selected acquisition mandate may fail the fleet price gate; preserve that result separately from scenario economics.

Back of house: versioned input sheet → source checks → deterministic math/gates → risk questions → visual story → human review. POC uses fixed synthetic businesses and authored example inputs. No generated company/owner facts, live-source claims or implied completed agents.

## Example seed from Jim's PDF

Source: supplied PDF, forwarded analysis dated September 15, 2026. This is a historical document, not current Tesla verification.

| Input | Value | Basis |
|---|---:|---|
| Vehicles | 5 | Document scenario, p1 |
| Assumed purchase per vehicle | $30,000 | Document assumption, p1 |
| Paid fare per mile | $2 | Third-party-modeling assumption in document, p1 |
| Paid miles/day/vehicle | 75 / 120 / 150 | Downside/base/upside scenario, p6 |
| Operating days/year | 365 | Implied by annual arithmetic; must confirm, not explicitly a utilization guarantee |
| Network share | 20–40%; base 30% | Hypothetical, p2–3 |
| Detailed operating costs | Unknown | Not supplied as reconciled line items |

Code examples: 5 × 120 × 365 × $2 = $438,000 gross fares; × (1 − .30) = $306,600 retained before operating expenses. At 75 miles and 40% share: $164,250 before expenses. $200,000 operating profit is an author target, not a computed conclusion. It implies $106,600 of costs at the base scenario, but that inference is not an expense budget. Do not present 133% as expected return, verified yield or distributable cash.

Hero: utilization × network-share matrix, captioned “What remains before costs?” Reveal operating days, deadhead miles, downtime, insurance, maintenance, taxes, depreciation and financing as unresolved levers. Platform control is a scenario risk pending contractual evidence, not a verified current market claim.

## v2 impact on agents and architecture

- Extraction agents propose verbatim spans with source URL/page/timestamp. Code parses typed fields; malformed money is flagged, never repaired by guessing.
- Completeness pass distinguishes extraction failure, not disclosed and on request. Add document assumption, derived and conflicting states for imported analyses; do not treat an uploaded opinion as a verified listing.
- Mandate config is per user/run and versioned. Spec defaults are an example mandate, not universal gates. Confirmation precedes activation.
- Code computes ratios, financing, waterfall and verdict precedence. Narrative agents cannot override gates or invent entities, motives, legal strategies, benchmarks or probabilities.
- Red flags emit templated research questions. Licensing and contract remedies require jurisdiction-specific verification, not automatic advice or assumed enforceability.
- Game-theory probabilities are labeled judgment-based priors, not forecasts. Missing benchmark tables disable dependent detectors. Scenario assumptions and uncertainty are visible next to the graphic.
- User uploads stay tenant-scoped; retain provenance, permissions, extraction version and retention policy. Document instructions are untrusted data. Production upload needs file validation, size limits, malware handling and explicit privacy disclosure.
- Visual recipes use the same typed fact snapshot and version as verdicts. Edits invalidate downstream results; no cached graphic may masquerade as current analysis.
- Human review remains distinct from lender approval, outreach, purchase or workflow authorization. No contact automation is in v2 scope.

## Resolve before production

1. G7 restricts WATCHLIST to $400–599K plus moat, but G5/G10/G11 and golden fixtures cap higher earnings at WATCHLIST. Define separate earnings-band and risk-cap paths.
2. Unknown gates need explicit precedence. PURSUE requires all pass; missing fields must not become pass.
3. Fixture 3 asking price is explicitly unverified; freeze it as blocked, not silently $2.5M.
4. EV protected-case redistribution/repricing and R3 collapse shifts need an unambiguous state model and reconciled worked arithmetic before acceptance. Do not tune implementation to force the quoted EV target.
5. Seller SDE/hour is not salary or proof of willingness to sell; label the heuristic and handle missing/zero owner hours.
6. Platform-risk criticality depends on documented control and revenue concentration. The Cybercab fixture's assumed dependency must remain distinguished from externally verified facts.
7. Validate reference screenshots/listing snapshots before adopting golden-case verdicts as authority; the spec is a requirements source, not independently verified financial evidence.

## Acceptance plan

Same frozen facts/config yield identical verdicts; changed mandate changes gates without prompt edits. Missing/zero/conflicting/approximate inputs tested separately. No snippet-derived numbers promoted. Formula denominator tests distinguish margin from multiple. No fabricated top-five padding. Imports cannot inject instructions or execute HTML. Example is contact-free and labeled. No API calls in POC; production implementation requires a separate reviewed change.
