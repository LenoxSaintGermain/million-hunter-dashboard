import React, { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  ShieldCheck,
  Building2,
  LineChart,
  FileSearch,
  Lock,
} from "lucide-react";
import { CashFlowBridgeCard } from "./CashFlowBridgeCard";
import { BoundedRiskGaugeCard } from "./BoundedRiskGaugeCard";

export function UnifiedDeskHero() {
  const [activeTab, setActiveTab] = useState<"acquisition" | "aperture">("acquisition");

  return (
    <section className="sh-hero-section">
      <div className="sh-hero-grid">
        {/* Left Column: Unified Value Proposition */}
        <div className="sh-hero-content">
          <div className="sh-hero-eyebrow">
            <span aria-hidden="true" />
            <span>Signal Hunter · The Bounded Capital Operating System</span>
          </div>

          <h1 className="sh-hero-h1">
            Know Your Downside Before Capital Moves.
          </h1>

          <p className="sh-hero-lead">
            Signal Hunter bounds risk and stress-tests assumptions upstream of
            execution—whether evaluating an acquisition or sizing liquid exposure.
          </p>

          {/* Dynamic Context Lead */}
          <div className="mb-6 p-3 bg-[var(--paper)] border-l-2 border-[var(--amber)] text-sm leading-relaxed text-[var(--sh-fg-2)]">
            {activeTab === "acquisition" ? (
              <p className="m-0">
                <strong>Acquisition Desk:</strong> Pressure-test reported seller cash flow,
                disallow inflated add-backs, and uncover bank covenant breaches before ordering a
                Quality-of-Earnings report.
              </p>
            ) : (
              <p className="m-0">
                <strong>Capital Aperture:</strong> Size concentrated positions within explicit
                thesis bands, set binding invalidation stops, and cap portfolio risk before
                entering market exposure.
              </p>
            )}
          </div>

          {/* Action CTAs */}
          <div className="sh-hero-cta-group">
            {activeTab === "acquisition" ? (
              <Link href="/walkthrough" className="sh-btn-primary">
                <span>Explore Business Diligence</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <Link href="/walkthrough/capital-desk" className="sh-btn-primary">
                <span>Launch Capital Aperture</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
            <a href="#request-access" className="sh-btn-secondary">
              <span>Request Operator Access</span>
            </a>
          </div>

          {/* Trust & Architecture Strip */}
          <div className="sh-hero-trust-bar">
            <div className="sh-trust-item">
              <ShieldCheck size={14} className="text-[var(--sage)]" />
              <span>Deterministic zero-API preview</span>
            </div>
            <div className="sh-trust-item">
              <Lock size={14} className="text-[var(--sh-fg-3)]" />
              <span>Upstream of QoE</span>
            </div>
            <div className="sh-trust-item">
              <FileSearch size={14} className="text-[var(--sh-fg-3)]" />
              <span>Four-state evidence grading</span>
            </div>
          </div>
        </div>

        {/* Right Column: Tabbed Dual-Desk Visual Artifact */}
        <div className="sh-hero-visual-card">
          <div className="sh-hero-tabs-header" role="tablist" aria-label="Signal Hunter Operating Desks">
            <button
              type="button"
              role="tab"
              id="tab-acquisition"
              aria-selected={activeTab === "acquisition"}
              aria-controls="panel-acquisition"
              className="sh-hero-tab-btn"
              onClick={() => setActiveTab("acquisition")}
            >
              <Building2 size={15} aria-hidden="true" />
              <span>Acquisition Diligence</span>
            </button>
            <button
              type="button"
              role="tab"
              id="tab-aperture"
              aria-selected={activeTab === "aperture"}
              aria-controls="panel-aperture"
              className="sh-hero-tab-btn"
              onClick={() => setActiveTab("aperture")}
            >
              <LineChart size={15} aria-hidden="true" />
              <span>Capital Aperture</span>
            </button>
          </div>

          <div
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
            className="sh-hero-tab-panel"
          >
            {activeTab === "acquisition" ? (
              <CashFlowBridgeCard />
            ) : (
              <BoundedRiskGaugeCard />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
