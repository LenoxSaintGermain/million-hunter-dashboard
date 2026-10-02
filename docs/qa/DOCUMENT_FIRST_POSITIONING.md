# Document-first positioning — local copy review

Date: 2026-09-30
Status: local edits only; not a deployment or ingestion-readiness receipt.
Primary surface: Research OS. Tracking artifact: this document only; no external writes.

## Why

Signal Hunter is an evidence-first deal diligence and decision desk for buyers,
acquisition entrepreneurs, sponsors and investment teams. The core job is to
pressure-test a deal before committing capital. Search is one entrypoint, not
the product identity. The product sits upstream of Quality of Earnings (QoE),
not in place of accounting, legal or lender diligence.

## Authorized scope and exact changes

- `client/src/pages/LandingPage.tsx`: diligence-led hero and audience; evidence-first
  first job; document-first roadmap section; explicit PDF-ingestion limitation;
  deal-or-thesis access prompt with confidentiality caution. Existing form mutation
  and request-access behavior remain unchanged and were not exercised.
- `client/src/pages/HunterWalkthrough.tsx`: deal-first chapter label and introduction;
  upstream-of-QoE boundary; case-oriented closing CTA; expandable document journey
  preview. Both asset/capital paths, sliders, calculations, reset, chapter navigation,
  focus and swipe behavior are preserved.
- `client/src/pages/DemoTour.tsx`: sourcing framed as case context; cached review
  perspectives instead of certainty claims; comparison instead of promised lower
  risk; alternative earnings explicitly assumed, not verified; roadmap boundary and
  accurate sign-in CTA. Five chapters and their interactive mechanics remain intact.
- `client/src/pages/InvestorBrief.tsx`: evidence-first hook, audience, document roadmap,
  QoE boundary and readiness caveat; replace unsupported market estimates with review
  questions; remove implied customer-volume claims; correct cold-run demo language;
  distinguish demonstrated simulators from sourcing previews and roadmap ingestion.
  Existing pricing and subscription terms are not changed.
- `docs/qa/DOCUMENT_FIRST_POSITIONING.md`: this scoped validation and handoff record.

## Desired journey — roadmap, not connected

Bring a CIM, financial statements and contracts → review extracted claims and
source references → challenge assumptions and unresolved evidence → prepare a
buyer-owned decision and independent-diligence questions.

No upload control, parser, provider request, document storage, decision automation
or new network call was added. These pages do not establish that parallel engine
or UX work is complete. Illustrative fixtures are not customer evidence.

## Route inspection

- `/` renders the landing page for unauthenticated users through the existing home route.
- `/walkthrough` imports `HunterWalkthrough.tsx`, not the older `Walkthrough.tsx`.
- `/demo-tour` renders `DemoTour.tsx`; `/brief` renders `InvestorBrief.tsx`.
- `/demo` is a separate `DemoScenario` surface outside this change.
- `/walkthrough/capital-desk` remains the existing secondary preview destination.

## Validation

### Parent integration check

- Combined foundation/V2 tests: 36 passed; migration truth contracts: 5 passed.
- Final repository typecheck and production build passed. Existing large-chunk warning remains.
- Isolated source preview at `http://127.0.0.1:3137/` created by `scripts/document-first-public-preview.mjs`. Access requests are stubbed with an explicit preview-only error; no data is submitted.
- Browser checked landing framing, walkthrough navigation, -80% cash-flow adjustment (modeled 0.62× coverage), next-decision copy and reset. This is a targeted component smoke test, not full-route/offline-network certification or production acceptance.
- Main tracked work under THI-266; pricing and market proposals remain internal, unapproved. No deployment or price change.

Environment: `PATH=/opt/homebrew/opt/node@26/bin:/opt/homebrew/bin:$PATH`.
All test/check commands used an empty `DATABASE_URL` override.

- `DATABASE_URL= pnpm test server/hunterMigrationTruth.test.ts`: PASS, 4 tests.
  These are existing source-contract guards, not browser coverage of these pages.
- Read-only Node/TypeScript assertions: PASS for all four edited TSX files:
  parse without diagnostics; roadmap, illustrative and disconnected-PDF labels;
  same ordered call targets as HEAD (inline array contents normalized).
- Same assertions: no `fetch`, `axios` or `trpc` references in the three demo pages.
  The landing page retains its pre-existing, explicit-submit access-request mutation.
- Deterministic model assertions: PASS for both walkthrough paths at -80, -20,
  -10, 0 and +30%; repeatable results, finite coverage, two unknown evidence fields
  retained at every setting, and capital -10% P/L equals -$100.
- `DATABASE_URL= pnpm check`: initially failed with TS18028 private-identifier
  target errors in parallel `server/dealDocumentEngine.ts` (lines 32–37 and 41).
  No errors were reported in the four owned pages. Final rerun: PASS (exit 0)
  after parallel workspace changes; this task did not edit that server file.
- Scoped `git diff --check`: PASS.

## Remaining gaps / acceptance boundaries

1. Parent integration fixed `App.tsx` to exclude `/brief` and `/demo-tour` from
   `OnboardingGuard`, alongside the existing two public walkthrough routes.
   A source-contract regression guards that bypass. Full route-wide network UAT
   is still not certified. No analysis API calls were added; demo calculations remain local.
2. Browser/mobile visual review and full interactive/offline network UAT were not
   run. Existing responsive classes and editorial tokens were retained; concise
   copy is not proof of mobile layout acceptance.
3. Document upload, extraction accuracy, source references, permissions, retention
   and end-to-end decision outputs need separate implementation and verification.
4. Legacy sourcing descriptions elsewhere in the brief are not a production audit.
   The revised matrix explicitly limits what this brief demonstrates.
5. No commits, deploys, production DB/provider mutations, outreach, access-form
   submissions or pricing changes. Unrelated shared-workspace changes are untouched.
