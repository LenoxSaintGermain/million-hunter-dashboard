import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { HunterPublicShell } from "@/components/HunterPublicShell";

// Public launch framing only. Not purchasable or enforced entitlements.
const PACKAGES = [
  {
    name: "Deal Review", price: "$299", term: "one-time · one target",
    audience: "One deal deserves a closer look.",
    scope: "Initial review + two evidence refreshes over 60 days.",
    detail: "Planned for one operator and up to two named reviewers. A different target needs a separate review. No automatic renewal.",
  },
  {
    name: "Team Desk", price: "$699", term: "per month · three new reviews",
    audience: "A shared desk for repeat acquirers.",
    scope: "Five operators. Up to ten active targets.",
    detail: "Planned monthly renewal, with three new Deal Reviews each billing month. Each activated review has its own 60-day window. Unused monthly reviews do not roll over. Cancel renewal before the next billing date; activated reviews keep their remaining window.",
  },
  {
    name: "Three-Deal Pack", price: "$799", term: "one-time · three targets",
    audience: "Several decisions. No subscription.",
    scope: "Three Deal Reviews, activated within 12 months.",
    detail: "Each review has its own 60-day window, initial analysis and two evidence refreshes. Planned for repeat buyers, without automatic renewal.",
  },
] as const;

export default function Pricing() {
  return (
    <HunterPublicShell>
      <main className="hunter-public-main">
        <header className="max-w-3xl">
          <p className="hunter-eyebrow">The decision desk / launch pricing</p>
          <h1>Price the review.<br />Not the outcome.</h1>
          <p className="hunter-lead">Bring the deal evidence. Pressure-test the case. A decision to pause or pass belongs at the desk as much as a decision to proceed.</p>
          <Link href="/walkthrough" className="hunter-cta">Try the illustrative case <ArrowRight size={17} aria-hidden="true" /></Link>
        </header>

        <section className="hunter-public-section" aria-labelledby="launch-pricing-title">
          <div className="border-l-2 border-amber pl-4 mb-7" role="note">
            <h2 id="launch-pricing-title">Planned launch pricing · preview only</h2>
            <p className="mt-2 text-sm">Not available for purchase. Secure document intake, team permissions and billing are not ready for paid launch. No payment is collected here.</p>
          </div>
          <p className="hunter-eyebrow">USD · excluding applicable taxes · planned scope below</p>
          <div className="hunter-jobs">
            {PACKAGES.map((plan, index) => (
              <article key={plan.name} aria-labelledby={`package-${index}`} className="min-w-0">
                <p className="hunter-eyebrow">0{index + 1} / {plan.audience}</p>
                <h3 id={`package-${index}`}>{plan.name}</h3>
                <div className="font-serif text-5xl tracking-tight tabular-nums my-3">{plan.price}</div>
                <p className="text-sm font-medium">{plan.term}</p>
                <p className="text-sm mt-3">{plan.scope}</p>
                <details className="mt-4 border-t border-rule text-sm">
                  <summary className="min-h-11 py-3 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4">Planned terms</summary>
                  <p className="pb-3 text-muted-foreground">{plan.detail}</p>
                </details>
              </article>
            ))}
          </div>
          <div className="mt-7 border-t border-rule pt-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
            <p className="text-sm">Access requests are reviewed manually—not purchases or reservations.</p>
            <a href="/#request-access" className="hunter-cta shrink-0">Request access <ArrowRight size={17} aria-hidden="true" /></a>
          </div>
        </section>

        <section className="hunter-public-section hunter-spread" aria-labelledby="review-scope-title">
          <div>
            <p className="hunter-eyebrow">The intended deliverable</p>
            <h2 id="review-scope-title">One target. An inspectable case.</h2>
            <p className="mt-3 text-sm">A source-linked decision record: claims, contradictions, downside assumptions and questions still needing evidence. You decide what happens next.</p>
          </div>
          <div>
            <details className="border-t border-rule text-sm">
              <summary className="min-h-11 py-3 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4">What is ready today?</summary>
              <p className="pb-4">The free illustrative walkthrough uses a composite case, not your documents. No card, live analysis or purchase is needed. Document processing and the package allowances above remain planned launch capabilities.</p>
            </details>
            <details className="border-t border-rule text-sm">
              <summary className="min-h-11 py-3 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4">What stays outside the review?</summary>
              <p className="pb-4">Independent accounting, legal, lender and Quality of Earnings diligence. No guaranteed returns or avoided losses. Trading, seller outreach and commitments of capital are not included.</p>
            </details>
            <details className="border-y border-rule text-sm">
              <summary className="min-h-11 py-3 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4">How will scope be agreed?</summary>
              <p className="pb-4">Supported documents, processing limits, privacy, retention and service terms must be confirmed before any paid review opens. No unlimited-processing promise or automatic overages. Do not send confidential deal documents through the access form.</p>
            </details>
          </div>
        </section>

        <section className="hunter-public-section" aria-labelledby="enterprise-title">
          <p className="hunter-eyebrow">A different mandate</p>
          <h2 id="enterprise-title">Enterprise, scoped in conversation.</h2>
          <p className="mt-3 text-sm">Quote only after requirements and delivery review. No standard private-instance, integration or service-level commitment is offered here.</p>
          <a href="/#request-access" className="inline-flex gap-2 items-center underline mt-3 text-sm">Discuss your scope <ArrowRight size={16} aria-hidden="true" /></a>
        </section>
      </main>
    </HunterPublicShell>
  );
}
