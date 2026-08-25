# TSL-BUILD-2026-008 — Stage 1 Pre-Write Thesis Recovery Manifest

**Generated:** 2026-08-25  
**Mode:** Read-only inventory; no database mutation, broker call, or order action.  
**Decision:** **STOP — scoped recovery writes are not authorized by the evidence currently available.**

## Scope

The inventory covers the two continuity targets mandated by `MANUS-PROMPT-TSL-BUILD-2026-008.md`:

| Target | Named provenance source | Expected historical links |
| --- | --- | --- |
| `Jim Reference — Catalyst Reaction (Paper Trial)` | `scripts/run-jim-catalyst-reference-trial.mjs` | Canonical Capital thesis `#150001`; completed source run `#300001` per the source-file commit record |
| `GLP-1 Demand Shock: Food & Health Day-Trading Opportunities` | Immutable capture `2026-08-21-glp1-postfix-v3` and `CAPITAL_APERTURE_GLP1_WALKTHROUGH.md` | Capture references run `#390002`, candidate `#360001`; walkthrough records a prior completed run `#150004` |

## Source Manifest

| Artifact | SHA-256 | Git provenance | Recoverable content |
| --- | --- | --- | --- |
| `scripts/run-jim-catalyst-reference-trial.mjs` | `e022f209e96c992c937c556f873f0e343b645d4924bb0484265d4f92f3a731ee` | `0f0236fd0a8017f8ab2fdc0808229b5f5cf9bc48` · 2026-08-18 | Full raw Jim catalyst thesis text; source script identifies `USER.id = 1` (Lenox) |
| `client/src/fixtures/capitalWalkthroughFixtures.ts` | `79923aedc45397fdd0f0f4cf953a0b34f614fed2d6f9c5df8e93b957ee32f8a0` | Registered immutable fixture registry | GLP-1 title, run `#390002`, candidate `#360001`, account `#1` |
| `client/src/fixtures/captures/2026-08-21-glp1-postfix-v3.ts` | `e68465d0ecfb18a42a8821d05f75d07a9ce37f726f767d6b5abc85558301a827` | `e8b0e5ed5d40e9611e437c25e1ba1b7a1394e0b2` · 2026-08-22 | GLP-1 display title and frozen run/candidate/account context; no recoverable raw thesis text |
| `CAPITAL_APERTURE_GLP1_WALKTHROUGH.md` | `b90df1f6ce5bc259795daf9d0136a5e33ae08f5ab3cf896ab9ced9321473768a` | `ab87a000823c2bd2accec75b310532a43712081f` · 2026-08-17 | Prior run `#150004`, 12 candidates, 33 deferred; no recoverable raw thesis text |

## Database Inventory

All queries were read-only against the restored database.

| Continuity entity | Query basis | Row count | Result |
| --- | --- | ---: | --- |
| Named Capital theses | Exact title and source-text search | 0 | Both named Capital-thesis records absent |
| Named canonical thesis compilations | Exact title and source-text search | 0 | Both canonical compilation records absent |
| Canonical thesis `#150001` | Historical source id | 0 | Absent |
| Thesis shares for `#150001` | Historical compilation id | 0 | Absent |
| Runs `#300001`, `#150004`, `#390002` | Historical source/capture ids | 0 | Absent |
| Candidates for historical runs or `#360001` | Historical ids | 0 | Absent |
| Evidence reviews for historical runs/candidate | Historical ids | 0 | Absent |
| Strategies for historical runs | Historical ids | 0 | Absent |
| Play decisions and slate items for historical runs/candidate | Historical ids | 0 | Absent |

### Current identity and active-context inventory

| User id | Identity | Workspace | Active Capital thesis | Interpretation |
| ---: | --- | --- | --- | --- |
| 1 | Lenox Saint Germain | `command_center` | none | Owner identity in the Jim source script, but not named Jim |
| 690001 | Jimmy Butler | `command_center` | none | Possible Jim-like identity; no provenance link to the source thesis |
| 7470015 | Jim Butler | `command_center` | none | Possible Jim-like identity; no provenance link to the source thesis |
| 20640001 | Jim Capital UAT | `capital_aperture` | none | Synthetic UAT identity; provisioner source is explicitly not the thesis-recovery source of truth |

## Recovery Decision

No scoped write is safe yet.

1. **Jim ownership is ambiguous.** The only full-content recovery source names the thesis “Jim Reference” yet hard-codes `USER.id = 1` (Lenox). Three distinct Jim-like identities exist, and none has a surviving thesis, share, active-thesis association, or source-authored ownership binding.
2. **GLP-1 source fidelity is insufficient for reconstruction.** The immutable captures prove title and frozen display/run context, but none preserves the original raw thesis text, canonical compilation, owner binding, or graph. Recreating a new thesis from a title plus a captured candidate queue would invent source content, which the contract prohibits.
3. **No surviving related rows can be reconnected.** The required canonical, run, candidate, evidence, strategy, slate, decision, memo, and outcome links are absent for the historical identifiers.

## Required Resolution Before Any Recovery Write

Provide both of the following explicit mappings or a provenance-backed source artifact that establishes them:

| Target | Required decision |
| --- | --- |
| Jim catalyst thesis | Which existing user identity owns the recovered thesis: `1`, `690001`, `7470015`, or `20640001`? The named source currently points to `1`, while the display name implies a Jim operator. |
| Owner GLP-1 thesis | The original raw thesis text or canonical compilation/source artifact, plus the owning user identity. The current immutable capture is enough to preserve replay context, but not enough to recreate a canonical thesis without invention. |

When resolved, recovery must remain dry-run by default, idempotent, owner-scoped, and limited to source-backed records. No outcomes, measurements, historical timestamps, unrelated users, or broker-order rows may be created or modified.

## Database and Broker-Order Statement

This manifest was produced from read-only database queries and source-controlled artifacts. **No database row was inserted, updated, deleted, reseeded, or backfilled. No broker order was created, approved, submitted, canceled, filled, or closed.**
