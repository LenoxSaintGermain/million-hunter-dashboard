# Trading Ontology UAT — 2026-08-21

## Operator-facing decision brief

Validated the paper-only Capital decision brief for run `#330001`, candidate `LEN`, after the taxonomy refactor.

| Contract element | Rendered outcome |
| --- | --- |
| Market play | `opening range breakout`, visibly separate from execution choice |
| Execution choice | `long · buy shares` with an explicit equity expression |
| Time horizon | `Day trade · same session` with flat-before-close basis |
| Confirmation signals | Opening range, VWAP hold, and catalyst-window state shown as separate signals |
| Portfolio posture boundary | Not presented as an entry or exit strategy on the recipe surface |
| Safety boundary | The expired catalyst window correctly produced **No paper play** and exposed no order-submission action |

The recipe also retained its modeled-level disclosure, tape basis, assumptions, thesis provenance, and the existing human-only paper ticket boundary. No paper proposal, approval, submission, fill, or broker-order mutation was invoked during this validation.
