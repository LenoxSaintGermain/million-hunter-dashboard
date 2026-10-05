import React from "react";
import { Link } from "wouter";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { CenturionHeroHeader } from "@/components/landing/CenturionHeroHeader";
import { CashFlowBridgeCard } from "@/components/landing/CashFlowBridgeCard";
import { BoundedRiskGaugeCard } from "@/components/landing/BoundedRiskGaugeCard";
import { HeroReconciliationHUD } from "@/components/landing/HeroReconciliationHUD";
import { DialecticScrollytelling } from "@/components/landing/DialecticScrollytelling";
import { CaseStudySandbox } from "@/components/landing/CaseStudySandbox";
import { OperatorAccessGate } from "@/components/landing/OperatorAccessGate";
import "@/styles/landing-editorial.css";

export default function LandingPage() {
  return (
    <div className="sh-landing">
      {/* ─── Institutional Header Navigation ──────────────────────────────── */}
      <header className="sh-landing-nav-bar">
        <Link href="/" className="sh-brand-mark">
          <ArrowUpRight size={18} aria-hidden="true" className="text-[var(--amber)]" />
          <span>Signal Hunter</span>
          <span className="sh-brand-badge">Sovereign Desk</span>
        </Link>

        <nav className="sh-nav-links" aria-label="Main Navigation">
          <a href="#the-two-desks" className="sh-nav-link">
            Operating Desks
          </a>
          <a href="#methodology" className="sh-nav-link">
            Methodology
          </a>
          <a href="#case-sandbox" className="sh-nav-link">
            Case Sandbox
          </a>
          <Link href="/pricing" className="sh-nav-link">
            Pricing
          </Link>
          <Link href="/sign-in" className="sh-nav-link">
            Sign In
          </Link>
          <a href="#request-access" className="sh-nav-btn">
            <span>Request Access</span>
            <ArrowRight size={14} aria-hidden="true" />
          </a>
        </nav>
      </header>

      <main>
        {/* ─── 1. CENTURION HERO: 21:9 LETTERBOX & MONOSPACED HUD ───────────── */}
        <CenturionHeroHeader />

        {/* ─── 2. THE TWO OPERATING DESKS: DEEP-DIVE CARDS ──────────────────── */}
        <section id="the-two-desks" className="sh-section-frame">
          <div className="sh-narrative-stack mb-8">
            <p className="sh-hero-eyebrow">
              <span aria-hidden="true" className="sh-eyebrow-dot" />
              <span className="sh-eyebrow-text">Two Operating Desks · One Methodology</span>
            </p>
            <h2 className="sh-section-h2">
              Bounded Capital Allocation: Define the Boundary First.
            </h2>
            <p className="sh-section-desc">
              Whether acquiring a physical operating business or taking concentrated liquid risk,
              the fundamental rule is identical: you define the structural downside limit before
              capital is deployed.
            </p>
          </div>

          <div className="sh-desks-grid">
            {/* Desk I: Private M&A & Buyout Diligence */}
            <div className="sh-desk-portal-card sh-desk-portal-card--acquisitions">
              <div className="mb-4">
                <span className="sh-desk-audience-tag">
                  Desk I · Private M&amp;A &amp; Buyout Diligence
                </span>
                <h3 className="sh-desk-title">The Cash Flow Waterfall</h3>
                <p className="sh-desk-summary font-serif italic text-base text-[var(--ink)] mb-2">
                  &ldquo;Brokers sell pro-forma optimism. Operators inherit fixed costs.&rdquo;
                </p>
                <p className="text-xs text-[var(--sh-fg-2)] leading-relaxed m-0">
                  Sits upstream of Quality of Earnings. Reconciles broker CIM claims, strips
                  unverified add-backs, models replacement operator labor, and stress-tests senior
                  debt coverage to kill flawed acquisitions before you spend \$25k–\$75k on accounting retainers.
                </p>
              </div>

              {/* Data Graphic: EBITDA Erosion Waterfall */}
              <div className="mb-6">
                <CashFlowBridgeCard compact />
              </div>

              <div className="sh-desk-card-footer">
                <span className="font-mono text-xs text-[var(--sh-fg-3)]">
                  Underwritten DSCR: 1.34x (Min Covenant: 1.25x) [PASS]
                </span>
                <Link href="/walkthrough" className="sh-btn-primary">
                  <span>Explore Diligence Desk</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Desk II: Capital Aperture (Liquid Allocation) */}
            <div id="capital-aperture" className="sh-desk-portal-card sh-desk-portal-card--aperture">
              <div className="mb-4">
                <span className="sh-desk-audience-tag">
                  Desk II · Capital Aperture (Liquid Allocation)
                </span>
                <h3 className="sh-desk-title">The Framer Alignment Portrait</h3>
                <p className="sh-desk-summary font-serif italic text-base text-[var(--ink)] mb-2">
                  &ldquo;An idea is just an opinion until you define the exact invalidation line.&rdquo;
                </p>
                <p className="text-xs text-[var(--sh-fg-2)] leading-relaxed m-0">
                  Translates thesis parameters into explicit allocation target bands, enforces
                  binding structural invalidation triggers, and caps portfolio downside stop
                  exposure before entering market positions.
                </p>
              </div>

              {/* Data Graphic: Alignment Portrait / Bounded Risk Slider */}
              <div className="mb-6">
                <BoundedRiskGaugeCard compact />
              </div>

              <div className="sh-desk-card-footer">
                <span className="font-mono text-xs text-[var(--sh-fg-3)]">
                  Invalidation: $42.10 | Max Downside: 1.8% NAV [BOUNDED]
                </span>
                <Link href="/walkthrough/capital-desk" className="sh-btn-secondary">
                  <span>Launch Capital Aperture</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>

          {/* Interactive Dual-Desk Reconciliation HUD */}
          <div className="mt-12">
            <div className="mb-4">
              <span className="font-mono text-xs uppercase tracking-wider text-[var(--sh-fg-3)]">
                Interactive Model HUD · Cross-Desk Comparison
              </span>
            </div>
            <HeroReconciliationHUD />
          </div>
        </section>

        {/* ─── 3. METHODOLOGY: THE AUDITABLE ENGINE ─────────────────────────── */}
        <div id="methodology">
          <DialecticScrollytelling />
        </div>

        {/* ─── 4. CASE STUDY SANDBOX & ACCESS GATE ─────────────────────────── */}
        <section id="case-sandbox" className="sh-section-frame border-t border-[var(--rule)]">
          <div className="sh-narrative-stack mb-4">
            <p className="sh-hero-eyebrow">
              <span aria-hidden="true" className="sh-eyebrow-dot" />
              <span className="sh-eyebrow-text">Live Case Preview · Deterministic Verification</span>
            </p>
            <h2 className="sh-section-h2">Test The Decision Engine Live.</h2>
            <p className="sh-section-desc">
              Explore live calculation models on real-deal fixtures. Zero API calls, zero login
              walls, zero speculative hallucinations.
            </p>
          </div>

          {/* Interactive Sandbox */}
          <CaseStudySandbox />

          {/* Single-Column Access Gate */}
          <div id="request-access">
            <OperatorAccessGate />
          </div>
        </section>
      </main>

      {/* ─── Institutional Footer & Legal Disclosures ─────────────────────── */}
      <footer className="sh-footer">
        <div className="sh-footer-inner">
          <div className="sh-footer-disclosure">
            <p className="font-semibold text-[var(--ink)] mb-1">
              Regulatory &amp; Diligence Disclosure
            </p>
            <p className="m-0">
              Signal Hunter is an institutional decision support engine, not a registered investment
              advisor, broker-dealer, or accounting firm. All composite fixtures, scenarios, and
              walkthrough models are illustrative and do not constitute investment recommendations,
              lending approvals, or tax advice. Signal Hunter sits upstream of Quality of
              Earnings (QoE) and legal representation—not in place of independent accounting audits,
              lender underwriting, or licensed legal counsel. Capital Aperture execution remains
              bounded paper modeling and risk management discipline—never a route to live broker
              orders without explicit operator authorization.
            </p>
          </div>

          <div className="sh-footer-bottom">
            <span>&copy; {new Date().getFullYear()} Third Signal Lab &middot; Signal Hunter OS</span>
            <div className="sh-footer-links">
              <Link href="/walkthrough" className="sh-footer-link">
                Diligence Walkthrough
              </Link>
              <Link href="/walkthrough/capital-desk" className="sh-footer-link">
                Capital Desk Preview
              </Link>
              <Link href="/pricing" className="sh-footer-link">
                Launch Pricing
              </Link>
              <Link href="/jims-file" className="sh-footer-link">
                Jim’s File (Case)
              </Link>
              <Link href="/sign-in" className="sh-footer-link">
                Operator Sign In
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
