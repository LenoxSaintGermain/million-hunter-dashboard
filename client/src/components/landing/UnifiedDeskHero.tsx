import React, { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ShieldCheck, Lock, FileSearch } from "lucide-react";
import { HeroReconciliationHUD } from "./HeroReconciliationHUD";

export function UnifiedDeskHero() {
  const [activeDesk, setActiveDesk] = useState<"acquisitions" | "aperture">("acquisitions");

  return (
    <section className="sh-hero-section">
      <div className="sh-hero-grid">
        {/* Left Column: Sovereign Desk Positioning */}
        <div className="sh-hero-content">
          <div className="sh-hero-eyebrow">
            <span aria-hidden="true" />
            <span>DECISION ARCHITECTURE FOR PRINCIPALS &amp; ALLOCATORS</span>
          </div>

          <h1 className="sh-hero-h1">
            Where high-stakes capital sets its boundaries.
          </h1>

          <p className="sh-hero-lead">
            Before you sign a personal guarantee or commit a concentrated position, Signal Hunter
            pressure-tests claims, uncovers structural fragility, and enforces downside limits.
          </p>

          {/* Dynamic Context Lead */}
          <div className="mb-6 p-3 bg-[var(--paper)] border-l-2 border-[var(--amber)] text-sm leading-relaxed text-[var(--sh-fg-2)]">
            {activeDesk === "acquisitions" ? (
              <p className="m-0">
                <strong>Acquisition Desk:</strong> Sits upstream of Quality of Earnings. Reconciles
                broker CIM claims, strips unverified add-backs, models replacement operator labor,
                and stress-tests senior debt coverage before you spend on accounting retainers.
              </p>
            ) : (
              <p className="m-0">
                <strong>Capital Aperture:</strong> Liquid market allocation with hard thesis
                boundaries. Translates parameters into explicit target bands, enforces binding
                invalidation triggers, and caps downside stop exposure before entering the market.
              </p>
            )}
          </div>

          {/* Action CTAs */}
          <div className="sh-hero-cta-group">
            <a href="#case-sandbox" className="sh-btn-primary">
              <span>Enter Operator Sandbox</span>
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <a href="#request-access" className="sh-btn-secondary">
              <span>Request Desk Access</span>
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

        {/* Right Column: Interactive Reconciliation HUD */}
        <div className="sh-hero-visual-card">
          <HeroReconciliationHUD onSelectDesk={setActiveDesk} />
        </div>
      </div>
    </section>
  );
}
