# Document-first diligence: pricing proposal

Date: 2026-09-30. Status: **internal proposal for review, not approved pricing or a launch commitment**. Currency: USD, excluding applicable taxes. Owner: pricing-analysis workstream. Primary surface: Research OS. Artifact: operating-model document; parent handles Linear tracking; pricing scope is local proposal only. No outreach is authorized in this run. Parent will present the proposed prices as explicitly unapproved.

## Recommendation and decision requested

Price the pressure-testing of **one acquisition decision**, not access to a listing feed, the number of documents a buyer supplies, or a successful closing. Test a **$299 one-time Deal Review** for episodic buyers and a **$699/month Team Desk** for repeat acquirers. Offer a **$799 three-deal pack** only as a repeat-purchase experiment. Keep enterprise quote-only until its requirements and delivery costs are known. These are price hypotheses, not market-clearing prices supported by customer transactions.

The commercial promise should be: **Bring your own deal evidence; pressure-test the case before committing capital.** Search is an optional entrypoint and research is a supporting input. The deliverable is a source-linked decision record: material claims, conflicting evidence, downside cases, questions for specialists, and a human decision to proceed, pause or pass. A defensible pass is a successful product outcome, not a reason for a refund.

Do not sell an automated document experience today. PDF upload and ingestion remain unfinished/not connected; pricing validation can start with illustrative examples, while any real-evidence pilot requires separately approved intake, privacy, delivery and spending controls. Do not replace accounting, legal, lender or Quality-of-Earnings diligence, or promise avoided losses.

Approve the metric and experiment first. Do **not** approve billing implementation, public pricing changes, provider runs, production changes or outreach merely by accepting this document.

## 1. Actual current structure: inspected source, not verified commerce

Read-only inspection on 2026-09-30 of the dirty shared checkout. Other workers may change these files after this snapshot. No production billing account, database, customer invoice or deployed checkout was inspected.

| Current advertised tier | Monthly list | Annual charge | Advertised boundary in source |
| --- | ---: | ---: | --- |
| Scout | $297 | $2,970 | 10 active deals/property dossiers; 10 URL imports/month; diligence, Red Team, capital stack and memo features |
| Operator | $697 | $6,970 | Unlimited active deals, cited imports and research; three-agent IC; Radar; negotiation/outreach; one syndicate seat |
| Family Office | $2,500 | $25,000 | Five seats; Capital Aperture paper rails; white-label output; onboarding, integrations and four-hour support SLA |
| Institutional | Custom | Not specified | Copy states an $8,000/month floor, unlimited seats, private instance, custom integrations and SLA |

Source: `client/src/pages/Pricing.tsx`, re-read on 2026-09-30. Exact evidence locations in the current checkout:

- Scout: [monthly price, line 16](</Volumes/Mini_2T/lenoxparis data/Dev/million-hunter-dashboard/client/src/pages/Pricing.tsx:16>); annual charge line 17; active-deal limit line 22; URL-import allowance line 25.
- Operator: [monthly price, line 37](</Volumes/Mini_2T/lenoxparis data/Dev/million-hunter-dashboard/client/src/pages/Pricing.tsx:37>); annual charge line 38; unlimited deals/research lines 44–45; syndicate seat line 50.
- Family Office: [monthly price, line 59](</Volumes/Mini_2T/lenoxparis data/Dev/million-hunter-dashboard/client/src/pages/Pricing.tsx:59>); annual charge line 60; five seats line 66; support SLA line 72.
- Institutional: [null list price, line 81](</Volumes/Mini_2T/lenoxparis data/Dev/million-hunter-dashboard/client/src/pages/Pricing.tsx:81>); null annual charge line 82; $8,000/month floor in copy line 96.
- Display behavior: [annual default, line 291](</Volumes/Mini_2T/lenoxparis data/Dev/million-hunter-dashboard/client/src/pages/Pricing.tsx:291>); monthly-equivalent calculation line 380; actual annual charge line 389.
- Purchase path: [tier CTA, line 409](</Volumes/Mini_2T/lenoxparis data/Dev/million-hunter-dashboard/client/src/pages/Pricing.tsx:409>) routes to login or email, not checkout. Public-page classification is [App.tsx, line 135](</Volumes/Mini_2T/lenoxparis data/Dev/million-hunter-dashboard/client/src/App.tsx:135>); pricing route line 234.
- Unverified economics claims: [AI COGS assertion, line 598](</Volumes/Mini_2T/lenoxparis data/Dev/million-hunter-dashboard/client/src/pages/Pricing.tsx:598>); projected margin/churn/LTV:CAC/cost cards lines 603–606. ROI assumptions and calculations are lines 142–151; competitor comparison starts at line 100.

Annual is the default display: rounded monthly equivalents of $248, $581 and $2,083, with the actual annual charge underneath. Annual charges equal ten monthly payments, a calculated 16.7% discount versus twelve monthly payments. These locations verify local source content, not deployed prices, successful billing or enforced entitlements; concurrent edits can move line numbers.

**Implementation findings:**

- Scout/Operator CTAs call `getLoginUrl()`, not a checkout. Family Office/Institutional CTAs use a contact email. The page is public through `client/src/App.tsx`.
- Searches across `server`, `shared`, `drizzle` and `package.json` found no product billing implementation under Stripe, Paddle, Lemon Squeezy, billing, checkout, subscription ID or entitlement terms. The inspected server entrypoint registers auth, storage, scheduled callbacks and tRPC, not a payment webhook. No payment SDK appears in `package.json`; the inspected users schema has role/workspace fields, not a paid-plan entitlement. These are bounded negative findings, **not proof that no off-repository invoicing exists**.
- `shared/pricing.ts` formats acquisition asking prices; it is **not** a subscription price registry. `planId` hits in disclosure-plan code and market-data entitlements are unrelated to customer billing.
- Therefore the tier limits, recurring billing, cancellations and seat allowances above are **advertised, not verified as enforced**. No customer counts, paid conversion, revenue, churn, actual gross margin or willingness-to-pay data was available in this scope.
- Concurrent source now explicitly labels the document journey a roadmap preview in `LandingPage.tsx` and `HunterWalkthrough.tsx`. PDF MIME support in a low-level LLM type and CSV/URL import code do not establish a working PDF ingestion flow. No end-to-end ingestion UAT was performed.

### Existing claims requiring separate review before publication

The current pricing source includes an analyst-overhead replacement assertion, avoided-deal ROI calculator, sub-$0.15 AI cost per analysis, under-1%-of-revenue AI COGS, 85% projected margin, 8% estimated churn and 21.9× LTV:CAC. They are not measured evidence for this proposal. The ROI calculator treats the modeled bad-deal expense as avoidable without a measured product-effect assumption. Do not use it to establish economic value or customer savings.

The existing competitor table also understates DealOrb's advertised analysis capabilities and uses price ranges not supported by the current primary-source evidence below. The “Most Popular” badge is not backed here by sales data. Unlimited research, isolation, enterprise integrations, replacement claims and support SLAs all require independent delivery verification. **This run flags these issues but changes no UI, claim or billing behavior.**

## 2. Primary-source market evidence

Research retrieved **2026-09-30**. These are vendor-published offers, not negotiated quotes, quality audits or proof of feature performance. Dates below distinguish publication/update date from retrieval date; an undated page is not assumed to have been published today. Billing-toggle and cache limitations remain explicit. No third-party price estimates are used.

| Vendor / relationship | Observed offer and charging unit | Source, date and confidence boundary | Implication, not equivalence |
| --- | --- | --- | --- |
| DealOrb — closest SMB acquisition workflow comparator | Starter $49/mo: 25 CIM/document analyses, 25 active deals, 50 deal-chat responses. Growth $79/mo: unlimited analyses/active deals, 100 chat responses. Pro custom. | [Official pricing](https://dealorb.ai/pricing). Undated; official-page search extract retrieved Sep 30, crawl reported three weeks old. Direct open returned an incomplete page. Monthly/yearly toggle visible in extract; selected commitment state not independently confirmed. Treat as provisional advertised monthly-denominated prices, not a verified monthly contract quote. | Generic document summarization and pipeline access already face low advertised anchors. A $299 review must prove better decision utility; do not claim this competitor lacks analysis. |
| DealRoom — team M&A diligence workflow | Deal-volume subscription; unlimited users; annual commitment; AI diligence is an add-on. No numeric price published in inspected page. | [Official pricing](https://dealroom.net/products/pricing). Undated; retrieved Sep 30 through direct page read. Numeric price: **not disclosed**, not estimated. | Supports deal-volume and collaboration-inclusive packaging; does not establish our dollar price. |
| Dropbox DocSend — adjacent secure sharing/data room | Advanced $150/month; Advanced Data Rooms $180/month; three users included in each. | [Official pricing](https://www.docsend.com/pricing/?pp=iaqb). Undated; direct read Sep 30. Monthly and yearly controls appear but extracted text does not identify selected billing commitment. Search extract and direct read disagree on Standard ($45 versus $30); exclude Standard from price comparison. | A bounded collaboration package is familiar. A VDR price is not the price of substantive acquisition analysis. No annual total inferred. |
| DueVestor — adjacent company/person risk screening | One report $199; five reports $799; fifteen $1,799. Vendor says credits do not expire. | [Official offer](https://duevestor.com/en), pricing section. Undated; direct read Sep 30; page explicitly states USD. | Evidence that episodic reports and packs are commercially legible. Sanctions/adverse-media screening is not financial diligence. Its savings/comparative-depth claims are not adopted. |
| Acquire.com — adjacent marketplace access | Help article lists Premium $390/year, Platinum $780/year, recurring annual billing; free browsing. | [Official buyer-plan help](https://help.acquire.com/how-do-i-upgrade-from-the-free-plan), updated **Jan 10, 2025**, retrieved Sep 30, 2026. Current [marketing page](https://acquire.com/pricing/) did not expose those numeric prices in the retrieved text. **Older still-published reference; present checkout price unconfirmed.** | Access to sellers is a different purchase from pressure-testing a deal already in hand. Do not price by marketplace access alone. |
| DealGround — adjacent CRE research | $83/month for annual plan; $99/month for monthly plan; enterprise custom for teams of 5+. Different ownership-research credit allowances by plan. | [Official pricing](https://www.dealground.com/pricing). Undated; retrieved Sep 30. Annual monthly equivalent is explicit; computed annual equivalent $996, not a checkout verification. | Research can be usage-bounded without defining the diligence product as a sourcing subscription. |

**Interpretation:** the market provides examples of cheap subscription analysis, episodic reports and deal-volume team software. It does not prove a willingness to pay $299/$699 for Signal Hunter. Do not average unlike products or anchor against an unsourced $20k–$50k QoE bill. The main competitive test is whether source-linked contradictions and decision questions materially outperform a summary—not whether a model produces more pages.

## 3. Proposed structure — all terms require approval and implementation

### Monetization unit

One **Deal Review** = one named target acquisition, one accepted evidence baseline, an initial pressure-test and up to two customer-requested evidence refreshes during 60 days. It includes the final decision record and preserves unknowns. A different target consumes another review; renaming, archiving or reopening does not reset the allowance. A portfolio acquisition with multiple entities is scoped before purchase.

Run a free eligibility check before activating the paid review: supported evidence types, authority to share, scope, size and readiness. Activate only after the buyer accepts the scope and starts the first analysis. Product failures, duplicate job retries and corrections of system errors do not consume customer refreshes. If technical failure prevents delivery, restore the entitlement or refund; do not charge again to obtain the originally promised result. A completed review recommending pause/pass still consumes the review.

Do not charge per page, token, exported memo or negative finding. Use evidence-size and run caps as disclosed operational bounds, not silent overages. Do not use a success fee or percentage of deal value: the product should be economically neutral about whether the buyer closes.

| Proposed package | Test price / term | Included entitlement | Intended buyer / renewal boundary |
| --- | --- | --- | --- |
| Illustrative walkthrough | $0; no card | Cached, explicitly illustrative example; no live analysis or user-document intake | Anyone evaluating the method; no auto-conversion |
| Deal Review | $299 once | One target; initial review + two refreshes; 60-day active window; one operator and up to two named reviewers | Episodic buyer; no auto-renewal |
| Three-Deal Pack | $799 once | Three Deal Reviews; activate within 12 months; each gets its own 60-day window and limits | Repeat episodic buyer; $266.33/review at full use, 10.9% below three singles; experiment, not initial default |
| Team Desk | $699/month, monthly renewal | Three new Deal Reviews per billing month; five operators; up to ten concurrent active targets; named read-only reviewers without seat fees | Recurring acquisition team; cancel renewal before next billing date; no initial annual commitment |
| Enterprise | Quote only; no proposed minimum | Negotiated deal volume, security, integrations, retention and service scope | Only after requirements discovery and costed delivery review; no default private-instance/SSO/SLA promise |

Each paid review has the same analytical rigor, source visibility and human approval boundary. More expensive packages buy volume and collaboration, not permission to hide uncertainty or safety checks. Reviewer access and collaboration are **proposed entitlements**, not claims that the required permissions already exist.

**Proposed operational caps per review:** 500 accepted source-page equivalents, 1 million cumulative input tokens, 100,000 cumulative output tokens, and 20 external research requests across the entire 60-day review and refreshes. These are initial cost-control hypotheses, not validated ingestion capacity. Where page and token limits conflict, the first reached stops additional processing pending a scope decision. For spreadsheets, scope sheets/rows and token size before acceptance rather than inventing a page count. Show remaining capacity and scope before execution; no surprise charge. Do not silently truncate evidence and imply full coverage.

Team credits do not roll over in the initial test; previously activated reviews retain their 60-day window even after subscription cancellation. Additional new reviews: $249 each, explicit purchase, same caps. Extra refresh: proposed $79 for one same-target rerun within the original evidence/research allowance; any evidence-cap increase needs a separate scoped quote. No automatic overages. Pilot must test whether these rules are understandable before building them.

After a review expires, propose 12 months of read-only record access from activation and a usable export, with advance deletion notice and an earlier deletion request path. Retention, backup deletion, access after cancellation and sensitive-document storage require security/legal approval and implementation before being promised. Keep evidence access independent of repeat payment during the promised retention window.

**Choice economics:** one review/month costs $299 versus $699 for Team; two cost $598; three cost $897. At three reviews Team saves $198 (22.1%) and adds collaboration. Full-use Team revenue per review is $233; at one review it is $699. Offer Team to buyers with sustained throughput or real collaboration needs, not to a buyer waiting months for a single seller. Four reviews in a month would be $948 on Team including the explicit $249 add-on. Do not call prepaid deal packs ARR.

**Excluded from core packages:** unlimited autonomous search, outreach, Capital Aperture/trading access, bespoke integrations, CPA/legal opinions, manual document cleanup and institutional certifications. Optional research should enrich the supplied evidence within caps; retain a source-only path. Core value must not depend on Signal Hunter finding the target.

## 4. Unit economics: inspectable assumptions, not measured costs

No production usage/billing telemetry was read and no provider probe was run. The following deliberately round rates are **model assumptions, not vendor price quotes**. Actual provider mix, long-context rates, retries, caching, extraction accuracy, human rework and payment contracts must replace them. All costs cover the full review including included refreshes.

Formula: contribution = price − model cost − research − extraction − storage/serving − delivery support − payment fee. Model cost = input millions × assumed blended input rate + output millions × assumed blended output rate. Payment fee assumption = 3% of revenue + $0.30/transaction. Support assumption = $40/hour fully loaded. No sales CAC, fixed engineering, general overhead, tax, refund reserve or chargeback cost is included; this is **contribution margin**, not company profit or audited gross margin.

| Per-review input | Lean | Base | Stress / scope exception |
| --- | ---: | ---: | ---: |
| Cumulative input tokens | 0.5M | 1M | 3M |
| Cumulative output tokens | 0.05M | 0.1M | 0.3M |
| Assumed input/output $ per million | $2 / $10 | $4 / $20 | $8 / $40 |
| Calculated model cost | $1.50 | $6.00 | $36.00 |
| Research requests × assumed $0.10 | 5 = $0.50 | 20 = $2.00 | 80 = $8.00 |
| Extraction allowance | $1 | $5 | $15 |
| Storage/serving allocation | $1 | $3 | $6 |
| Support | 15 min = $10 | 45 min = $30 | 120 min = $80 |
| Cost before payment fee | **$14.00** | **$46.00** | **$145.00** |
| $299 single: contribution after $9.27 fee | **$275.73 / 92.2%** | **$243.73 / 81.5%** | **$144.73 / 48.4%** |
| $699 Team, three reviews, $21.27 fee | **$635.73 / 90.9%** | **$539.73 / 77.2%** | **$242.73 / 34.7%** |

Stress intentionally breaches the proposed token/research caps to expose the downside of an exception or failed limiter. Do not sell those quantities as included. Token volume is summed across agents and refreshes, not estimated from document length alone. Base support is technical assistance, not expert accounting or legal review.

### Decisions most sensitive to cost and behavior

- At a proposed 75% contribution target, a $299 single permits $65.48 of non-payment delivery cost; full-use Team permits $51.16 per review: `(699 × 25% − 21.27) / 3`. Base has only $5.16/review of Team headroom. Thirty extra support minutes cost $20/review and reduce full-use Team margin to 68.6%.
- At base cost, the three-deal pack contributes $636.73, or 79.7%, after $24.27 payment cost. Unused credits improve cash economics but do not establish customer value; report activation, expiration and refunds separately.
- Doubling only base model cost adds $6/review; Team margin falls to 74.6%. Doubling the whole base non-payment cost gives 57.5%. Measure replayed context and failed retries, not just successful model completions.
- At $150 assumed CAC per new single-review customer, base first-purchase contribution after CAC is $93.73. At $300 CAC it is negative $56.27. No repeat purchase is assumed; do not manufacture a subscription LTV for an episodic buyer.
- If fixed operating cost were $15,000/month (illustrative, not a budget), approximately 62 base-cost single reviews or 28 full-use Team account-months would cover it before acquisition expense and omitted costs. Sales-assisted onboarding can invalidate this simple break-even.
- A proposed 5% revenue reserve for refunds/chargebacks reduces contribution margin by five percentage points. Team base would fall to 72.2%, below the proposed target. Measure actual refunds before setting an annual discount.
- A $79 refresh permits only $17.08 of non-payment cost at 75% contribution. Do not offer it as a complete new analyst engagement. If observed refresh costs exceed this, raise its price or narrow its scope before launch.

Instrument cost by account, target, evidence version, run and provider: input/output tokens, retries/failures, research requests, extraction, storage, support minutes, refunds and recognized revenue. Record p50/p90 cost plus tail cases. The target is a planning threshold, not evidence of achieved margin. Security, retention and permissioning work has real cost even when the model bill is small.

## 5. Demo, trial and launch boundaries

1. **Public demo now:** deterministic cached fixtures, zero API calls, no login/card required; label “Illustrative — composite deal, not a real customer.” No real-document drop zone disguised as an operational feature. Do not convert a demo click into a provider run.
2. **Pricing discovery now, only after separate recruitment approval:** show a fixed example decision record and the proposed terms. Record purchase intent as stated intent, not revenue or conversion. No outreach or participant contact occurs in this run.
3. **Real-evidence pilot later:** only after secure intake, sharing authority, supported-format checks, provenance, deletion/retention policy and delivery-owner approval. If manual preparation is used, disclose it explicitly as an assisted pilot; it is not automated PDF ingestion. No live spend or production mutation authorized by this document.
4. **Future bounded trial:** one named target, one initial pass, no refresh; cap at 50 pages, 200k input/20k output tokens, five research requests and a $10 provider/extraction budget. Stop before a cap is exceeded; these are proposed controls requiring enforcement. Limited invited cohort only, no card, no auto-renewal. If the product is not ready, offer only the illustrative demo instead.
5. **Paid launch gate:** tested input-to-source-link-to-decision workflow; error recovery and allowance restoration; tenant isolation and sharing tests; retention/export/deletion; accurate feature disclosure; server-side entitlement enforcement; payment/webhook idempotency; cancellations/refunds; observable cost caps. Billing must never grant permission to contact a seller or commit capital.

## 6. Validation experiment and acceptance decisions

**Hypothesis:** episodic buyers prefer a bounded purchase tied to their own target; recurring teams prefer shared throughput without paying per reviewer. The proposed premium wins only when users can identify decision-relevant evidence and unresolved questions they could not obtain as easily from their present process.

**Phase A — concept research, proposed two weeks:** recruit 12 qualified episodic buyers with a recent acquisition evaluation and six repeat-acquisition teams. Separate friends/current collaborators from new prospects in reporting. Show the same illustrative output and scope to everyone. Rotate $199/$299/$399 single-review price cards, recording presentation order to expose anchoring; test Team at $699 versus three $299 singles. Do not interpret this small, nonrandom sample as a statistically powered pricing A/B test. Ask what their last process cost in time and money, what they would replace, which result would justify payment, and when their next eligible deal is likely. Do not tell them they will save a diligence retainer.

**Phase B — paid assisted pilot, separately approved:** up to ten single-review buyers and five teams over eight weeks after readiness gates. Quote the approved price transparently; no fake scarcity or hidden variant pricing. A manual invoice is still billing and needs explicit approval. Limit total provider spend in advance. Compare equal-scope outputs against the buyer's existing workflow; source accuracy and contradictory-evidence handling must be reviewed, not inferred from satisfaction.

Measure and report with explicit denominators:

- Qualified-to-paid: paid eligible buyers / all eligible buyers offered that price, by episodic/team cohort. Track refusals, no-deal-yet, unsupported evidence and privacy objections separately.
- Activation: accepted evidence and first delivered review / paid reviews; elapsed time from accepted evidence, excluding separately disclosed seller waiting time.
- Decision utility: buyers identifying at least one source-supported question or changed assumption / delivered reviews; independent review must verify the cited support. Do not label this avoided losses or causal ROI.
- Cost and quality: delivery contribution per review/account-month, p50/p90 support time, failed jobs, restoration/refund rate, material unsupported-claim count, and scope-cap frequency. Unknown source coverage stays visible.
- Repeat purchase: second paid review / buyers known to have another eligible target within 90 days. Also report the raw all-buyer repeat rate and pending follow-up; no-next-deal is not necessarily dissatisfaction.
- Team continuation: second paid month / pilot teams whose first month has ended; report utilization and collaboration alongside renewal. Eight weeks cannot establish annual churn or LTV.

**Proposed go/no-go rules, not results:** seek at least five paid episodic pilots at $299 and three teams at $699; at least 70% of delivered pilot reviews must yield a source-supported useful question/changed assumption. Require zero unresolved critical provenance/privacy failures; median contribution at least 75% and p90 non-payment delivery cost within the corresponding package budget. Small samples are directional: passing authorizes another bounded cohort, not a public “validated ROI” claim. If price acceptance fails but utility is strong, test narrower $199 scope; if utility fails, improve the product before discounting. If Team support breaches budget, re-scope service or reprice rather than assume customers will underuse it.

## 7. Approval checklist and handoff

| Decision | Recommendation | Current status |
| --- | --- | --- |
| Value metric | Paid target review with bounded refreshes; team volume bundle | Proposed |
| Prices | $299 single; $699 monthly Team; $799 pack experiment | Proposed, no publication |
| Discovery/recruitment | Approve cohort, consent and research script before contact | Not authorized here |
| Real documents and provider spend | Security/readiness gate, delivery owner and explicit budget first | Not authorized here |
| Scope and service economics | Validate caps, support minutes, refund reserve and extra-refresh price | Unmeasured assumptions |
| Billing | Implement entitlement/payment/cancellation controls only in separately approved work | Not implemented by this proposal |
| Public claims | Remove or substantiate unsupported comparisons, ROI/margin claims and popularity badges in a separate change | Flagged, untouched |
| Enterprise / annual plans | Quote only; no default annual discount until retention and service burden observed | Deferred |
| Capital Aperture and outreach | Separate scope/authority; not bundled into document diligence by default | Excluded |

**Parent tracking handoff:** “Evaluate per-deal pricing for document-first diligence.” Primary surface: Research OS. Parent handles Linear tracking; pricing scope is local proposal only. Why: subscription-only packaging mismatches episodic evidence review. Scope: pricing research and proposal only. Acceptance: distinguish implemented commerce from advertised prices; cite primary sources/dates; define package rules, sensitivity model, validation and approval gates. Proposed prices remain unapproved. No shipped build, deploy revision or live-price URL is claimed. Existing branch observed: `main`; no commit created.

**Validation receipt:** read repository AGENTS and required Third Signal playbooks; used product-business-analysis and its business-context/analysis-quality guidance to separate observations, assumptions and decisions. Read current pricing, routing, schema, package dependencies and server entrypoint; searched for billing enforcement. Retrieved the six named primary-source offers above, retaining cache/date uncertainties. Arithmetic is reproduced from this document's explicit inputs with an isolated Node calculation; no customer data or provider calls are required. No application test/build is necessary for this Markdown-only change; any future test run must use `DATABASE_URL=` and the required Node PATH. Only this proposal is owned by this workstream; unrelated concurrent edits are preserved.

**Remaining gaps:** current negotiated competitor quotes; Signal Hunter's actual invoices/customer contracts, willingness to pay, cost telemetry, unit-level support burden, finished ingestion/provenance workflow, team permissions, billing enforcement, retention/security review, and paid-cohort evidence. Until those exist, approve an experiment—not a monetization forecast or live-product claim.
