# Manus brief — Aperture cockpit UI, order ticket, and migration apply

Everything below is already built and pushed on `main` (`83423f1`). The server
contract is fixed and unit-tested. This brief is the client work plus the DB
apply — the parts that need a running app and a browser to validate.

**Do not change any file under `server/aperture/`, `drizzle/schema.ts`, or the
existing migration files.** If you believe the server contract is wrong, say so
and stop; do not work around it in the client.

---

## Non-negotiables

- **Paper-only is structural.** `assertPaperOnly()`, a hardcoded
  `paper-api.alpaca.markets` base URL, `liveTrading: false` on every broker.
  There is no live-execution path and there must not be one. Nothing in this
  brief may add one, including a "just for testing" flag.
- **No autonomous execution.** A human approves every order. A time stop or an
  invalidation condition is a documented review plan, never an automatic close.
- **Honesty contract.** A field the source does not state stays null and renders
  as an explicit "not measured" with a reason — never `0`, never a bare dash,
  never a plausible-looking placeholder. Modeled figures declare their basis.
  This has been violated three times in this repo's history; it is the rule that
  gets checked first in review.
- **`.env` `DATABASE_URL` is PRODUCTION.** Never run a bare `pnpm test` — always
  `DATABASE_URL= pnpm test`. Baseline is **34 failures** (DB-integration and
  API-key suites: `api-keys`, `sprint4/5/6/11`, `stack`, `scan-pipeline`,
  `urlImport`, `alpacaConnection`, `fredConnection`). Any 35th failure is yours.
- **Every Aperture surface keeps the banner:** "Internal research tool — not
  investment advice. Modeled figures are labeled as such."
- Design system is the existing `--sh-*` custom properties in
  `client/src/index.css`. No new visual language, no chart library, no new
  dependency.

---

## Task 1 — Apply three pending migrations

None of these have been applied to the deployed database. Apply in this order
and report the result of each.

1. `drizzle/0032_aperture_risk_gates.sql` — **only the `aperture_runs` half.**
   The `broker_orders` half was already applied to prod by your own
   `0034_broker_order_risk_gate_repair.sql`; re-running it will fail on
   duplicate columns. The file carries a SUPERSEDED header saying exactly this.
   The `aperture_runs` preset columns (`holding_period`, `catalyst_deadline_at`,
   `liquidity_floor_adv_usd`, `max_single_name_pct`, `invalidation_rule`,
   `mandate_version`) are still missing in prod and `run.start` writes them.
2. `drizzle/0036_pilot_scorecard.sql` — `aperture_alpha` scorecard columns.
   (Renumbered from 0033 to clear the collision with your
   `0033_aperture_evidence_reviews.sql`.)
3. `drizzle/0037_aperture_cockpit.sql` — creates `aperture_set_aside`.

All columns are nullable by design. **Do not backfill anything.** A row written
before a migration carries null, which reads as "not measured under that
version" — it is not retroactively failed, and inventing a value for it would
be exactly the fabrication this codebase forbids.

Verify after applying: start a run, create a paper proposal, and confirm no
"unknown column" errors in the server log.

---

## Task 2 — The cockpit rail

New component, rendered on every `/aperture/*` page. One query:

`trpc.aperture.cockpit.useQuery({ accountId?, runId? })` — a **query**, not a
mutation. With no `accountId`, the run's own account is used.

It returns, in one round trip:

```ts
{
  generatedAt: number;
  liveTrading: false;
  mandate: { version, maxOrderNotionalPctOfEquity, maxOrderNotionalCents,
             maxPositionPctOfEquity, maxClusterPctOfEquity,
             maxRunGrossDeployedPctOfEquity, maxDailyNewNotionalPctOfEquity,
             maxPlannedRiskPctPerPlay, maxDailyPlannedRiskPct,
             maxCorrelatedPlannedRiskPct, minAdvUsd30d, maxOrderPctOfAdv,
             intradayCutoffEtMinutes };
  session: {
    session: "regular"|"pre_market"|"after_hours"|"closed"|"unknown";
    basis: string; dateEt: string|null; etMinutes: number|null; halfDay: boolean;
    closeEtMinutes: number|null;
    nextBoundary: { kind, label, at, etMinutes, dateEt, laterDate } | null;
    msToNextBoundary: number|null; minutesToNextBoundary: number|null;
    unavailableReason: string|null;
  };
  account: { linked, accountId, label, brokerId, isPaper, cashCents,
             buyingPowerCents, equityValueCents, lastSyncedAt, stalenessMs,
             syncSource, syncError, unavailableReason };
  headroom: {
    mandateVersion: string; equityCents: number|null; equityBasis: string;
    lines: Array<{
      key: "position"|"cluster"|"run_gross_deployed"|"daily_new_notional"
         |"single_order"|"daily_planned_risk"|"correlated_planned_risk"
         |"planned_risk_per_play";
      label: string; subject: string|null;
      usedCents: number|null; ceilingCents: number|null;
      remainingCents: number|null; usedPct: number|null; ceilingPct: number;
      basis: string; reason: string|null;
    }>;
  };
  run: { runId, status, holdingPeriod, holdingPeriodLabel, maxSessions,
         maxHorizonDays, catalystDeadlineAt, msToCatalystDeadline,
         catalystExpired, liquidityFloorAdvUsd, maxSingleNamePct,
         invalidationRule, mandateVersion, universeCount, candidateCount,
         droppedNote, providerAvailability, providerGaps, unavailableReason }
       | null;
}
```

Render three strips:

1. **Market clock** — session state and a live countdown to `nextBoundary`
   (tick client-side off `msToNextBoundary`; do not re-poll every second).
   `session: "unknown"` must render `unavailableReason` verbatim, not "closed".
   Those are different facts: unknown means the calendar does not cover the
   date, and order creation is blocked. Show the half-day flag when set.
2. **Account** — equity, cash, buying power, and staleness ("synced 6m ago").
   `stalenessMs: null` means never synced — say that. `syncError` non-null must
   be visible, not swallowed. Paper badge from `isPaper`.
3. **Headroom** — one thin bar per line, used against ceiling.
   - `usedCents: null` **with a `reason`** means not measurable. Render the
     reason. **Never draw it as 0%.**
   - `key: "single_order"` and `key: "planned_risk_per_play"` are per-order
     ceilings, not running totals — they arrive with `usedCents: null` on
     purpose. Show the ceiling only; do not draw a consumption bar.
   - The three planned-loss lines are a **separate axis** from the notional
     lines and should be visually grouped as such. Notional is what orders
     commit; planned loss is what their stops put at risk. Label the group so
     the operator can see they are different questions.

When `runId` is given, add the run preset as a fourth strip: holding period,
catalyst countdown from `msToCatalystDeadline` (negative = expired, show that),
liquidity floor, single-name cap, invalidation rule. `run.unavailableReason`
non-null means a pre-mandate run — render it, do not show empty ceilings.

`providerGaps: null` and `providerGaps: []` are different: null means never
recorded, `[]` means every provider was live. Do not collapse them.

---

## Task 3 — Order ticket with live preflight

`trpc.aperture.order.preflight.useQuery(...)` — a **query**. Same fields as
`order.create`, except `reason`, `invalidationCondition`, `holdingPeriod`,
`catalystDeadlineAt` and `paperAcknowledgement` are optional, so a half-typed
ticket gets a real answer instead of a zod 400. It writes nothing.

```ts
{
  wouldPass: boolean;
  blocking: string[];          // render this — gate failures + schema + evidence
  evaluation: { passed, mandateVersion, evaluatedAt,
                results: Array<{ key, passed, detail, observed, ceiling }>,
                failures: string[], notes: string[] };
  schemaErrors: string[];
  evidenceBlock: string|null;
  gatedNotionalCents: number|null;
  notionalBasis: "stated"|"derived_from_last_price"|"unknown";
  marketSession: string; sessionBasis: string;
}
```

**Use `wouldPass`, not `evaluation.passed`** — the latter omits the schema and
evidence-review preconditions that `order.create` also enforces, so a ticket
could show green and then fail on submit.

Requirements:

- Debounce and re-run preflight as the operator types. Show `blocking` inline,
  and show `evaluation.notes` too — the notes are where honest caveats live
  (a derived notional, an unclassified cluster, an unmeasurable planned loss).
- `notionalBasis: "derived_from_last_price"` must be labelled as derived. It is
  a modeled figure and the ceiling was checked against it.
- **Planned-loss fields.** For `intraday` and `overnight`, `qty`, entry, stop
  and slippage are required — planned loss is `qty x (|entry - stop| +
  slippage)`. Show the computed planned loss in dollars AND as a percentage of
  equity next to the 0.75% per-play ceiling, live, as the operator changes the
  stop. This is the number the operator's own model is built on; it should be
  the most legible figure on the ticket.
- The `paperAcknowledgement` field must be typed as the literal `PAPER` by the
  operator. Do not prefill it, do not default it, do not auto-fill it on focus.
  Its entire purpose is to put a human's consent on the audit record.
- On submit, `order.create` may still throw `PRECONDITION_FAILED`. Render the
  message; do not retry automatically.

---

## Task 4 — Set-aside on the run view

`aperture.run.get` now returns `setAside: Array<{ id, runId, symbol, reason,
createdAt }>` and `setAsideNote: string|null`.

Render the set-aside list on the candidate board — every symbol the run dropped
and why. This is the thing that distinguishes this product from a screener, and
it was being discarded until now.

`setAsideNote` non-null means the run predates the table. **Render the note.
Do not render "nothing was set aside"** — an absence of record is not an empty
set, and showing it as one is a false claim about the run.

---

## Validation — do all of it and report results

1. `pnpm check` — must be clean.
2. `DATABASE_URL= pnpm test` — 34 failures, no 35th.
3. Browser UAT, with the temporary auth seam removed afterwards and
   `grep -c LOCAL_PREVIEW_OPENID` confirmed at 0 in both files:
   - Rail renders on every `/aperture/*` page; countdown ticks.
   - Headroom shows a not-measurable line with its reason (unlink the account
     or use one that has never synced) and does **not** render it as 0%.
   - Order ticket: type a stop wide enough to breach 0.75% planned loss and
     confirm the ticket blocks **before** submit, naming the ceiling.
   - Create two plays in the same sector and confirm the 1.25% correlated
     ceiling blocks the second one.
   - Try an intraday order after 15:55 ET and confirm it is refused.
   - Confirm the set-aside list renders on a run that has one.
4. Report anything you could not validate, and say why. A gap named honestly is
   the expected outcome; a gap papered over is the one failure mode this
   codebase does not tolerate.

**No order may be created, approved, or submitted against the live paper account
as part of this work without saying so explicitly in your report.**
