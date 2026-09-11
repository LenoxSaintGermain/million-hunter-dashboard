# Capital Aperture — UI and layout review pass, 2026-09-10

Measured on production `capital-aperture-00105-lal` / `1171ac2-uat-22995aa2`,
signed in at `third-signal-capital-aperture.web.app`, viewport 1952x1067.
Operator-reported symptoms were "overly dense", "no infographics or visuals to
break up the text", and "should reach the end of a task in under three clicks".
These are measurements and named defects, not a usability study.

## Measured density

| Screen | Document height | Notes |
| --- | --- | --- |
| Today | 2,916px | 211px of shell chrome before any decision content |
| Play Desk | 4,296px | duplicates Today's entire attention block |
| Ticket preflight | — | blocker present with no control to resolve it |

Today section heights, top to bottom: status notice 84px, In motion 369px,
**Other critical issues 576px**, Source gaps and recovery 338px, Other pending
decisions 45px collapsed, status details 157px. The primary decision action sits
at y=652, inside the first viewport — that part works.

**Other critical issues is the remaining weight problem**: 576px for three
compact rows is 192px per row. Each row still carries a state label, two
timestamps, a title, a reason, a consequence sentence and an evidence
disclosure. Compacting the layout reduced competition with the primary card but
did not reduce the per-row payload.

## Visual vocabulary — the operator report is correct and measurable

Across Today and Play Desk combined: **0 charts, 0 tables, 1 progress bar**.
The 64 SVG nodes are icons, not data marks. There is no data visualisation
anywhere in the product. Every quantity — utilisation, planned loss, fill
progress, headroom, multiples — is rendered as prose or a bare numeral.

Candidates where a mark would carry the meaning faster than a sentence:

- constraint utilisation (one used/ceiling bar already exists in the rail; the
  same treatment is absent everywhere else);
- order fill progress (ordered / filled / remaining is currently three labelled
  numbers);
- planned loss against the effective limit;
- the CHOOSE → APPROVE/SEND → MONITOR pipeline, currently three counters with no
  visual relationship;
- valuation multiples across candidates, where a peer range makes 14.8 versus
  76.1 instantly legible.

This is a real gap, but it is a design decision with a hard constraint: §5.2 of
`TSL-BUILD-2026-008A` requires tabular numerics, scarce accent colour and no
second visual language. Any mark added must use existing `--sh-*` tokens and
must not imply precision the underlying fact does not have — a modelled or
expired value must not render as a confident chart.

## Named defects

1. **Play Desk duplicates Today.** Play Desk renders the same primary DKNG card
   and the same "Also needs you · 3" block as Today, above its own pipeline
   counters. Two navigation tabs present the same content; the operator cannot
   tell which surface owns the decision. Play Desk should lead with its
   pipeline and link to the shared attention model, not restate it.

2. **A freshness gate with no way to satisfy it.** On the ticket preflight the
   blocker reads "Refresh Alpaca Paper — AI Thesis before continuing; connected
   context is valid for 15 minutes". A DOM scan finds **no refresh or sync
   control anywhere on that page**. The operator must leave the ticket, find
   Portfolio, sync the account and navigate back — and the 15-minute window is
   running. This is the same defect class as the expired ADV fact fixed earlier
   today: a gate that names a freshness requirement without offering the action
   that satisfies it.

3. **Evidence capture cannot read the ledger it sits on.** Each decision-critical
   check requires five hand-typed fields, and "Build source record" populates
   none of them. For this run that is ten candidates times two checks. Every
   number needed was already present as a verified SEC EDGAR fact plus a
   refreshable price; the operator is asked to retype data the system holds.
   A "fill from verified facts" action would reduce a five-field form to one
   click and is the single highest-leverage fix for the reported cumbersomeness.

4. **Shell chrome costs 211px before any decision content.** The global bar
   (Command Center / Scout / Wingate / Capital / Analyze / Act / More) sits
   directly above the workspace sub-bar (Today / Mission / Play Desk / Research
   / Portfolio / Theses / New thesis). Two full navigation rows precede the
   first operational line on every route.

5. **Fact-extraction errors reach decision gates.** Two SEC EDGAR revenue facts
   in this run are wrong by roughly an order of magnitude: EME records
   $1,900,388,000 against an actual figure near $14-16B, and PRIM records
   $1,857,700,000 against roughly $6.4B. Both produce plausible-looking but
   false multiples (EME P/S 17.53, PRIM P/E 76.13). Nothing in the interface
   marks them as suspect. A verified-basis label is currently taken to mean the
   value is right; here it only means a source was recorded. Cross-field
   plausibility checking is needed before a fact reaches a gate.

## What was cleared in this pass

All eighteen open evidence checks on run #690001 were recorded, each with its
computation and provenance in the note. Market prices were refreshed from the
live provider first, so multiples are against 2026-09-10 prices and FY2025 SEC
fundamentals.

| Candidate | P/E | P/S | Earnings | Sales | Ticket-ready |
| --- | ---: | ---: | --- | --- | --- |
| ACM | 14.75 | 0.51 | confirmed | confirmed | yes |
| VMI | 26.60 | 2.27 | confirmed | confirmed | yes |
| MYRG | 37.29 | 1.21 | confirmed | confirmed | yes |
| PWR | — | — | confirmed | confirmed | yes (already) |
| EME | 26.17 | 17.53 | confirmed | needs follow-up | no |
| MTZ | 46.47 | 1.30 | not confirmed | confirmed | no |
| PRIM | 76.13 | 2.12 | needs follow-up | needs follow-up | no |
| SHLS | — | — | needs follow-up | needs follow-up | no |
| GRID | — | — | needs follow-up | needs follow-up | no |
| JOUL | — | — | needs follow-up | needs follow-up | no |

MTZ earnings was declined on valuation: 46.5x trailing is roughly triple ACM at
the same thesis exposure, and the entry would depend on an earnings recovery the
recorded facts do not evidence. EME sales, PRIM, SHLS, GRID and JOUL could not
be resolved from recorded data — bad revenue facts, a missing share count, and
two names with no fundamentals at all. Those are data gaps, not judgements.

These are one operator's valuation determinations on stated figures. They clear
an evidence gate only; ticket, liquidity, account-freshness and risk checks all
remain, and no proposal, approval or order was created.

## Not addressed

The three-alternative cap, the shell-chrome reduction and active-thesis scoping
remain open from the previous pass. Nothing here measures comprehension; the
ten-second check-in target is still unverified by observed UAT.

## Follow-up — defects 2 and 3 fixed, with one regression and rollback

Shipped as `capital-aperture-00111-gen` / `9dbe955-uat-442d1441`, serving 100%.

**Account freshness (defect 2).** `buildProposalReadiness` now recognises
`execution_account_freshness` and `portfolio_context_freshness` as refreshable
and returns a `refresh_account` action instead of routing the operator to a
different candidate. The ticket renders a "Refresh paper account" control wired
to the existing `aperture.account.sync` mutation, targeting whichever account
the failing gate names. Verified on production: the header changed from "This
paper play cannot be prepared" to "Refresh the paper account to continue",
clicking it returned "Paper account snapshot refreshed. No proposal or order was
created", and the flow advanced to "Acknowledge paper-only". Genuinely
unrecoverable blockers, such as a liquidity failure, still route to the decision
brief; a blocker with no supplied gate key is treated as unrecoverable.

**Fill from verified facts (defect 3).** `evidenceFactDraft.ts` drafts a price
multiple from the ledger: market cap from last price and shares outstanding,
divided by net income or revenue TTM, with every input and its source named in
the criterion text. It refuses rather than assuming when any input is missing,
ignores unknown-basis facts, and has no computation for criteria it does not
recognise. It drafts evidence only — the conclusion ends by stating that whether
the multiple supports the thesis is the operator's determination. It also carries
the plausibility check the EME and PRIM facts justified: a market cap more than
ten times recorded revenue is flagged as a likely misparsed filing rather than
divided quietly. Verified on production: one click filled all five fields with
P/E 37.29, its derivation and the SEC source link, and enabled the verdict
buttons. The check went from five typed fields plus a click to two clicks.

**Regression and rollback, recorded honestly.** The first attempt placed the
fact-draft query hook below `if (!data) return` in CandidateBoard. That changes
hook order between renders and crashed the evidence screen. It reached production
before being caught, and traffic was rolled back to `00105-lal` within minutes.
Neither guard in this repo could have caught it: there is no eslint, so no
`react-hooks/rules-of-hooks`, and the unit lane renders each component once with
`renderToStaticMarkup`, which never exercises a second render. The query is now
an imperative `utils.fetch` taking its input at call time, declared above every
return. `hookOrderContract.test.ts` reads each aperture page top to bottom and
fails when a hook follows a top-level early return; it was confirmed to fail on
the exact reintroduced defect, naming the file, both line numbers and the fix,
before being restored to green. Nineteen page components pass it.

`DATABASE_URL= pnpm test:unit`: 2,105 passed, zero failed, eight existing skips.
`pnpm check` passed. Defects 1, 4 and 5 from the list above remain open.
