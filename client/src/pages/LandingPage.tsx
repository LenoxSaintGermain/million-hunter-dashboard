import React, { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ShieldCheck,
  FileSearch,
  Building2,
  LineChart,
  Scale,
  FileText,
  AlertTriangle,
  Lock,
  Layers,
  Check,
  ShieldAlert,
} from "lucide-react";
import { UnifiedDeskHero } from "@/components/landing/UnifiedDeskHero";
import { CashFlowBridgeCard } from "@/components/landing/CashFlowBridgeCard";
import { BoundedRiskGaugeCard } from "@/components/landing/BoundedRiskGaugeCard";
import "@/styles/landing-editorial.css";

const CAPITAL_OPTIONS = [
  "Under $500K",
  "$500K – $1M",
  "$1M – $2.5M",
  "$2.5M – $5M",
  "$5M – $10M",
  "$10M+",
];

const OPERATOR_TRACKS = [
  "Search Fund / Independent Sponsor (Acquisition)",
  "Family Office Principal / Private Investor",
  "Corporate Development / Private Equity",
  "Liquid Portfolio Operator / Trader (Capital Aperture)",
  "M&A Advisor / Diligence Specialist",
];

function InstitutionalAccessForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [operatorTrack, setOperatorTrack] = useState("");
  const [capitalAccess, setCapitalAccess] = useState("");
  const [dealThesis, setDealThesis] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const requestAccess = trpc.publicAccess.requestAccess.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: err =>
      setError(err.message || "Something went wrong submitting your request. Please try again."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim()) {
      setError("Full name and business email are required.");
      return;
    }

    const compiledThesis = [
      operatorTrack ? `Operator Track: ${operatorTrack}` : "",
      dealThesis.trim(),
    ]
      .filter(Boolean)
      .join("\n\n");

    requestAccess.mutate({
      name: name.trim(),
      email: email.trim(),
      dealThesis: compiledThesis || undefined,
      capitalAccess: capitalAccess || undefined,
    });
  };

  if (submitted) {
    return (
      <div className="sh-access-form-box" role="status">
        <div className="flex items-center gap-2 text-[oklch(0.35_0.08_155)] mb-3">
          <CheckCircle2 size={24} aria-hidden="true" />
          <h3 className="font-serif text-2xl m-0 text-[var(--ink)]">Access Request Received</h3>
        </div>
        <p className="text-sm leading-relaxed text-[var(--sh-fg-2)] mb-4">
          Your operator profile has been received and queued for manual qualification review.
          Because Signal Hunter handles institutional underwriting and private diligence
          workflows, access is granted selectively to active buyers, allocators, and sponsors.
        </p>
        <div className="p-3 bg-[var(--paper)] border-l-2 border-[var(--sage)] text-xs font-mono text-[var(--sh-fg-3)]">
          Qualification SLA: Manual review within 1 business day. Confirmation sent to {email}.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="sh-access-form-box">
      <div className="mb-4">
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--sh-fg-3)] mb-1">
          Institutional Qualification
        </p>
        <h3 className="font-serif text-2xl text-[var(--ink)] m-0">Request Operator Desk Access</h3>
        <p className="text-xs text-[var(--sh-fg-3)] mt-1">
          Tell us about your mandate. Submission does not grant automated access; active deals and
          mandates are verified manually.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sh-form-field">
          <label htmlFor="form-name">Full name *</label>
          <input
            id="form-name"
            autoComplete="name"
            className="sh-form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Marcus Vance"
            required
          />
        </div>
        <div className="sh-form-field">
          <label htmlFor="form-email">Work / institutional email *</label>
          <input
            id="form-email"
            autoComplete="email"
            type="email"
            className="sh-form-input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="marcus@vancecapital.com"
            required
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sh-form-field">
          <label htmlFor="form-track">Operator mandate / role</label>
          <select
            id="form-track"
            className="sh-form-select"
            value={operatorTrack}
            onChange={e => setOperatorTrack(e.target.value)}
          >
            <option value="">Select your operating track</option>
            {OPERATOR_TRACKS.map(track => (
              <option key={track} value={track}>
                {track}
              </option>
            ))}
          </select>
        </div>
        <div className="sh-form-field">
          <label htmlFor="form-capital">Target capital / deal size</label>
          <select
            id="form-capital"
            className="sh-form-select"
            value={capitalAccess}
            onChange={e => setCapitalAccess(e.target.value)}
          >
            <option value="">Select capital range</option>
            {CAPITAL_OPTIONS.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="sh-form-field">
        <label htmlFor="form-thesis">Current deal, mandate, or thesis criteria</label>
        <textarea
          id="form-thesis"
          className="sh-form-textarea"
          value={dealThesis}
          onChange={e => setDealThesis(e.target.value)}
          placeholder="What asset or allocation are you evaluating? (e.g., $3M HVAC route in Southeast; or concentrated macro options mandate). Please do not include confidential deal secrets."
          rows={3}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 p-3 bg-[var(--paper)] border-l-2 border-[var(--clay)] text-xs text-[var(--clay)]"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        className="sh-form-submit-btn"
        disabled={requestAccess.isPending}
      >
        {requestAccess.isPending ? "Submitting application…" : "Submit Operator Request"}
      </button>

      <p className="mt-3 text-[11px] text-[var(--sh-fg-3)] font-mono text-center">
        Zero automated data sharing · Private institutional vetting
      </p>
    </form>
  );
}

export default function LandingPage() {
  return (
    <div className="sh-landing">
      {/* ─── Institutional Header Navigation ──────────────────────────────── */}
      <header className="sh-landing-nav-bar">
        <Link href="/" className="sh-brand-mark">
          <ArrowUpRight size={18} aria-hidden="true" className="text-[var(--amber)]" />
          <span>Signal Hunter</span>
          <span className="sh-brand-badge">Decision Engine</span>
        </Link>

        <nav className="sh-nav-links" aria-label="Main Navigation">
          <a href="#acquisitions" className="sh-nav-link">
            Acquisition Desk
          </a>
          <a href="#capital-aperture" className="sh-nav-link">
            Capital Aperture
          </a>
          <a href="#methodology" className="sh-nav-link">
            The Methodology
          </a>
          <a href="#document-desk" className="sh-nav-link">
            Document Intake
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

      {/* ─── 1. Hero: The Unified Verdict ─────────────────────────────────── */}
      <UnifiedDeskHero />

      {/* ─── 2. Two Distinct Portals (The Two Desks) ───────────────────────── */}
      <section id="acquisitions" className="sh-section-wrap">
        <div className="sh-section-header">
          <p className="sh-hero-eyebrow">
            <span aria-hidden="true" />
            <span>Two Desks · One Operating System</span>
          </p>
          <h2 className="sh-section-h2">
            Bounded Capital Allocation: Define the Boundary First.
          </h2>
          <p className="sh-section-desc">
            Whether buying an operating business or allocating liquid market capital, the failure
            mode is identical: letting unverified optimism outrun capital defense. Signal Hunter
            enforces strict risk boundaries before capital moves.
          </p>
        </div>

        <div className="sh-desks-grid">
          {/* Desk 1: Acquisition Desk */}
          <div className="sh-desk-portal-card sh-desk-portal-card--acquisitions">
            <span className="sh-desk-audience-tag">
              Desk A · For Searchers, Independent Sponsors & Family Offices
            </span>
            <h3 className="sh-desk-title">Acquisition Diligence Desk</h3>
            <p className="sh-desk-summary">
              Sits upstream of Quality of Earnings (QoE). Reconciles broker CIM claims, strips
              unverified add-backs, models replacement operator labor, and stress-tests senior debt
              coverage to kill flawed deals before you spend on audits.
            </p>

            <ul className="sh-desk-feature-list">
              <li className="sh-desk-feature-item">
                <Check size={16} className="sh-desk-feature-icon text-[oklch(0.35_0.08_155)]" />
                <span>
                  <strong>EBITDA-to-Cash-Flow Erosion:</strong> Uncover unmodeled owner labor,
                  deferred CapEx, and working capital drains before Letter of Intent.
                </span>
              </li>
              <li className="sh-desk-feature-item">
                <Check size={16} className="sh-desk-feature-icon text-[oklch(0.35_0.08_155)]" />
                <span>
                  <strong>DSCR Covenant Stress Testing:</strong> Model senior bank debt against
                  downside margin compression to ensure the target survives economic turbulence.
                </span>
              </li>
              <li className="sh-desk-feature-item">
                <Check size={16} className="sh-desk-feature-icon text-[oklch(0.35_0.08_155)]" />
                <span>
                  <strong>Pre-QoE Red Team Memo:</strong> Sits upstream of accounting diligence to
                  identify deal-killing red flags before spending \$25k–\$75k on third-party QoE.
                </span>
              </li>
            </ul>

            <div className="mb-4">
              <CashFlowBridgeCard compact />
            </div>

            <div className="sh-desk-card-footer">
              <span className="font-mono text-xs text-[var(--sh-fg-3)]">
                Upstream diligence engine
              </span>
              <Link href="/walkthrough" className="sh-btn-primary">
                <span>Explore Diligence Desk</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Desk 2: Capital Aperture */}
          <div id="capital-aperture" className="sh-desk-portal-card sh-desk-portal-card--aperture">
            <span className="sh-desk-audience-tag">
              Desk B · For Professional Allocators, Portfolio Managers & Macro Desks
            </span>
            <h3 className="sh-desk-title">Capital Aperture Desk</h3>
            <p className="sh-desk-summary">
              Liquid market allocation with hard thesis boundaries. Translates thesis parameters
              into explicit allocation target bands, enforces hard invalidation triggers, and caps
              downside stop exposure before entering the market.
            </p>

            <ul className="sh-desk-feature-list">
              <li className="sh-desk-feature-item">
                <Check size={16} className="sh-desk-feature-icon text-[var(--amber)]" />
                <span>
                  <strong>Concentrated Sizing Boundaries:</strong> Set explicit allocation bands
                  anchored to verified conviction rather than speculative portfolio drift.
                </span>
              </li>
              <li className="sh-desk-feature-item">
                <Check size={16} className="sh-desk-feature-icon text-[var(--amber)]" />
                <span>
                  <strong>Binding Invalidation Triggers:</strong> Pre-define the technical or
                  fundamental event that proves the thesis wrong, locking in disciplined defense.
                </span>
              </li>
              <li className="sh-desk-feature-item">
                <Check size={16} className="sh-desk-feature-icon text-[var(--amber)]" />
                <span>
                  <strong>Asymmetric Risk/Reward:</strong> Require minimum positive asymmetry
                  (+3.0x R:R) with strict 2.0% maximum portfolio risk ceilings per trade thesis.
                </span>
              </li>
            </ul>

            <div className="mb-4">
              <BoundedRiskGaugeCard compact />
            </div>

            <div className="sh-desk-card-footer">
              <span className="font-mono text-xs text-[var(--sh-fg-3)]">
                Bounded allocation engine
              </span>
              <Link href="/walkthrough/capital-desk" className="sh-btn-secondary">
                <span>Launch Capital Aperture</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 3. Shared DNA: The "Alignment Portrait" & 4 Epistemic States ──── */}
      <section id="methodology" className="sh-section-wrap border-t border-[var(--rule)]">
        <div className="sh-section-header">
          <p className="sh-hero-eyebrow">
            <span aria-hidden="true" />
            <span>Shared Methodology · Epistemic Rigor</span>
          </p>
          <h2 className="sh-section-h2">A Claim Is Not a Conclusion.</h2>
          <p className="sh-section-desc">
            Most diligence software manufactures a meaningless 1–100 score by blending broker
            assertions with real facts. Signal Hunter strictly isolates data into four distinct
            epistemic states so you never mistake a seller’s unverified claim for corroborated
            reality.
          </p>
        </div>

        <div className="sh-dna-grid">
          {/* State 1: Reported */}
          <div className="sh-epistemic-card" data-state="reported">
            <div className="sh-epistemic-header">
              <span className="sh-epistemic-name text-[var(--sh-fg-3)]">01 · Reported</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--sh-fg-3)]">
                Unverified Claim
              </span>
            </div>
            <p className="sh-epistemic-def">
              What the seller, broker, or issuer asserts in the teaser or CIM. Unaudited,
              unadjusted, and subject to confirmation bias.
            </p>
            <div className="sh-epistemic-app">
              <div>
                <strong>Acquisitions:</strong> $720K stated SDE in broker listing.
              </div>
              <div className="mt-1">
                <strong>Capital:</strong> Issuer press release or analyst target.
              </div>
            </div>
          </div>

          {/* State 2: Modeled */}
          <div className="sh-epistemic-card" data-state="modeled">
            <div className="sh-epistemic-header">
              <span className="sh-epistemic-name text-[var(--amber)]">02 · Modeled</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--amber)]">
                Algorithmic Stress
              </span>
            </div>
            <p className="sh-epistemic-def">
              The mathematical output of underwriting formulas under explicit baseline assumptions
              (interest rates, margin shock, debt amortization).
            </p>
            <div className="sh-epistemic-app">
              <div>
                <strong>Acquisitions:</strong> 1.34x DSCR under 10.5% senior debt.
              </div>
              <div className="mt-1">
                <strong>Capital:</strong> Modeled drawdown at technical stop price.
              </div>
            </div>
          </div>

          {/* State 3: Corroborated */}
          <div className="sh-epistemic-card" data-state="corroborated">
            <div className="sh-epistemic-header">
              <span className="sh-epistemic-name text-[var(--ink)]">03 · Corroborated</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink)]">
                Primary Evidence
              </span>
            </div>
            <p className="sh-epistemic-def">
              Hard evidence tied to third-party primary sources: bank statements, IRS corporate tax
              returns, executed customer contracts, or SEC filings.
            </p>
            <div className="sh-epistemic-app">
              <div>
                <strong>Acquisitions:</strong> Form 1120-S returns reconciled to deposits.
              </div>
              <div className="mt-1">
                <strong>Capital:</strong> Audited 10-K balance sheet & verified cash.
              </div>
            </div>
          </div>

          {/* State 4: Unknown */}
          <div className="sh-epistemic-card" data-state="unknown">
            <div className="sh-epistemic-header">
              <span className="sh-epistemic-name text-[var(--clay)]">04 · Unknown</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--clay)]">
                Outstanding Gap
              </span>
            </div>
            <p className="sh-epistemic-def">
              Critical conditions that have not yet been established. Invariant: Unknown is NEVER
              treated as zero or assumed to pass.
            </p>
            <div className="sh-epistemic-app">
              <div>
                <strong>Acquisitions:</strong> Customer contract renewal clauses missing.
              </div>
              <div className="mt-1">
                <strong>Capital:</strong> Catalyst regulatory approval unconfirmed.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 4. Production Document Engine Feature ─────────────────────────── */}
      <section id="document-desk" className="sh-section-wrap border-t border-[var(--rule)]">
        <div className="sh-doc-engine-banner">
          <div>
            <p className="sh-hero-eyebrow">
              <span aria-hidden="true" />
              <span>Production Intake · Deployed & Live</span>
            </p>
            <h2 className="sh-section-h2">Bring Your Own Deal Documents.</h2>
            <p className="sh-section-desc mb-6">
              Upload private CIMs, financial statements, and operating schedules. Signal Hunter
              extracts every claim with page-linked citations, performs automated conflict
              detection against financial statements, and produces an audit-ready pre-QoE red team
              memo.
            </p>

            <div className="sh-doc-steps">
              <div className="sh-doc-step-item">
                <span className="sh-doc-step-num">01</span>
                <div className="sh-doc-step-text">
                  <h4>Secure Tenant Upload & Private Storage</h4>
                  <p>
                    Private durable storage with server-derived authorization keys. Bounded file
                    isolation ensures confidential deal PDFs are never exposed or indexed publicly.
                  </p>
                </div>
              </div>
              <div className="sh-doc-step-item">
                <span className="sh-doc-step-num">02</span>
                <div className="sh-doc-step-text">
                  <h4>Page-Linked Citation & OCR Extraction</h4>
                  <p>
                    Every reported revenue, add-back, and margin figure links directly to its
                    exact source page and paragraph in the original CIM or tax schedule.
                  </p>
                </div>
              </div>
              <div className="sh-doc-step-item">
                <span className="sh-doc-step-num">03</span>
                <div className="sh-doc-step-text">
                  <h4>Upstream Pre-QoE Red Team Audit</h4>
                  <p>
                    Flags unverified owner perks, unrecorded management wages, and customer
                    concentration before you execute an LOI or pay accounting retainers.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-[var(--bone)] border border-[var(--rule)] border-t-2 border-[var(--ink)]">
            <div className="flex items-center gap-2 mb-3 text-xs font-mono uppercase tracking-wider text-[var(--sh-fg-3)]">
              <FileText size={16} className="text-[var(--ink)]" />
              <span>Supported Intake Documents</span>
            </div>
            <ul className="space-y-2 text-sm text-[var(--sh-fg-2)] mb-6 list-disc list-inside">
              <li>Confidential Information Memorandums (CIM)</li>
              <li>Year-end P&Ls & Balance Sheets (3-year trailing)</li>
              <li>IRS Form 1120 / 1120-S / Schedule C returns</li>
              <li>Customer Concentration & Aging Schedules</li>
              <li>Fleet & Equipment Depreciation Schedules</li>
            </ul>

            <div className="pt-4 border-t border-[var(--rule)] flex flex-col gap-3">
              <a href="#request-access" className="sh-btn-primary w-full text-center">
                <span>Request Document Desk Access</span>
                <ArrowRight size={15} aria-hidden="true" />
              </a>
              <p className="text-[11px] text-[var(--sh-fg-3)] font-mono text-center m-0">
                Encrypted in-transit & at-rest · Tenant isolated
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 5. Institutional Qualification & Access Request ──────────────── */}
      <section id="request-access" className="sh-access-section">
        <div className="sh-section-wrap">
          <div className="sh-access-grid">
            <div>
              <p className="sh-hero-eyebrow">
                <span aria-hidden="true" />
                <span>Operator Qualification</span>
              </p>
              <h2 className="sh-section-h2">Bring a Decision Worth Testing.</h2>
              <p className="sh-section-desc mb-6">
                Tell us what you are evaluating. Signal Hunter is designed for serious operators,
                searchers, and capital allocators who need institutional-grade diligence before
                moving capital.
              </p>

              <div className="space-y-4 text-sm text-[var(--sh-fg-2)]">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={18} className="text-[oklch(0.35_0.08_155)] shrink-0 mt-0.5" />
                  <div>
                    <strong>Sits Upstream of QoE:</strong> Identify deal-breakers early. Save
                    tens of thousands in audit retainers on deals that should have been killed in
                    hour one.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck size={18} className="text-[oklch(0.35_0.08_155)] shrink-0 mt-0.5" />
                  <div>
                    <strong>Zero Vendor Conflicts:</strong> We do not broker deals, sell lender
                    products, or charge commission on transaction volume.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck size={18} className="text-[oklch(0.35_0.08_155)] shrink-0 mt-0.5" />
                  <div>
                    <strong>Deterministic & Secure:</strong> Local arithmetic and isolated tenant
                    workspaces protect your deal pipeline and execution models.
                  </div>
                </div>
              </div>
            </div>

            <InstitutionalAccessForm />
          </div>
        </div>
      </section>

      {/* ─── 6. Institutional Footer & Legal Disclosures ───────────────────── */}
      <footer className="sh-footer">
        <div className="sh-footer-inner">
          <div className="sh-footer-disclosure">
            <p className="font-semibold text-[var(--ink)] mb-1">
              Regulatory & Diligence Disclosure
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
            <span>© {new Date().getFullYear()} Third Signal Lab · Signal Hunter OS</span>
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
