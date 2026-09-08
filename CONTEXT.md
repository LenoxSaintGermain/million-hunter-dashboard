# Capital Aperture domain language

- **Capital Mission** — the operator's declared capital, target, loss boundary, horizons, instrument preference, and canonical thesis for one Decision Run.
- **Canonical thesis** — the durable investment constitution selected by the operator. It is not a tactical market prediction.
- **Play Underwriter** — the upstream strategy layer that tests target feasibility, classifies the sourced market environment, proposes at most three conditional plays, and may return no trade.
- **Tactical market thesis** — a time-bounded, sourced statement with confirmation, invalidation, and expiry. It does not replace the canonical thesis.
- **Trade Play Blueprint** — a conditional, quantitatively sized research candidate. It is not an order or approval.
- **Validate this play** — the explicit handoff from a selected blueprint into the existing research and evidence lifecycle.
- **Play Desk** — the existing downstream operator surface for researched plays, tickets, approval, submission, monitoring, and records.
- **NO_TRADE / Sit Out** — a first-class underwriting decision with a reason and reopening condition. It creates no proposal or order.
- **Entry state** — a persisted lifecycle-derived presentation mode: `Start` when no usable Mission exists, `Resume` when authorized work is incomplete, or `Check in` when plays, orders, positions, or waiting decisions already exist. It is never based on visit count or device-local onboarding state.
- **Attention item** — a deterministic, material issue derived from authoritative lifecycle records. One item may be primary without hiding other critical issues.
- **Updated / Seen / Acknowledged / Resolved** — separate states. Updated means the source record changed; Seen means that version was displayed; Acknowledged is an explicit operator act; Resolved means the workflow condition cleared.
- **Information depth** — stable progressive disclosure: Glance for state and next action, Decision for implication and alternatives, Evidence for sources and calculations, and Record for prior revisions and events.
