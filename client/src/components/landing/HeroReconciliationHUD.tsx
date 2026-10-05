import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, LineChart, AlertTriangle, ShieldCheck, ArrowRight } from "lucide-react";
import { Link } from "wouter";

interface HeroReconciliationHUDProps {
  onSelectDesk?: (desk: "acquisitions" | "aperture") => void;
}

export function HeroReconciliationHUD({ onSelectDesk }: HeroReconciliationHUDProps) {
  const [activeDesk, setActiveDesk] = useState<"acquisitions" | "aperture">("acquisitions");

  const handleToggle = (desk: "acquisitions" | "aperture") => {
    setActiveDesk(desk);
    onSelectDesk?.(desk);
  };

  return (
    <div className="sh-hero-hud-card">
      {/* Top Segmented Control */}
      <div className="sh-hud-segmented-nav" role="tablist" aria-label="Operating Desk Selector">
        <button
          type="button"
          role="tab"
          id="hero-tab-acquisitions"
          aria-selected={activeDesk === "acquisitions"}
          aria-controls="hero-panel-acquisitions"
          className={`sh-hud-tab ${activeDesk === "acquisitions" ? "sh-hud-tab--active" : ""}`}
          onClick={() => handleToggle("acquisitions")}
        >
          <Building2 size={14} aria-hidden="true" />
          <span>Private Deal Diligence</span>
        </button>
        <button
          type="button"
          role="tab"
          id="hero-tab-aperture"
          aria-selected={activeDesk === "aperture"}
          aria-controls="hero-panel-aperture"
          className={`sh-hud-tab ${activeDesk === "aperture" ? "sh-hud-tab--active" : ""}`}
          onClick={() => handleToggle("aperture")}
        >
          <LineChart size={14} aria-hidden="true" />
          <span>Capital Aperture</span>
        </button>
      </div>

      {/* Main HUD Body with Framer Motion Spring Transition */}
      <div className="sh-hud-body">
        <AnimatePresence mode="wait">
          {activeDesk === "acquisitions" ? (
            <motion.div
              key="hud-acquisitions"
              id="hero-panel-acquisitions"
              role="tabpanel"
              aria-labelledby="hero-tab-acquisitions"
              initial={{ opacity: 0, y: 8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="sh-hud-state-container"
            >
              {/* Header Badge */}
              <div className="sh-hud-meta-row">
                <span className="sh-hud-pill sh-hud-pill--amber">
                  RECONCILIATION HUD · 104-UNIT ROUTE
                </span>
                <span className="sh-hud-label-tag">Apex Commercial (Composite)</span>
              </div>

              {/* Data Strip 1: Broker Claim */}
              <div className="sh-hud-metric-row sh-hud-metric-row--claim">
                <div className="sh-hud-metric-head">
                  <span className="sh-hud-role">BROKER CLAIM</span>
                  <span className="sh-hud-context">(92% Recurring Claim)</span>
                </div>
                <div className="sh-hud-metric-value text-[var(--sh-fg-2)]">
                  $650,000 <span className="text-xs font-normal font-sans">SDE</span>
                </div>
              </div>

              {/* Data Strip 2: Signal Audit */}
              <div className="sh-hud-metric-row sh-hud-metric-row--audit">
                <div className="sh-hud-metric-head">
                  <span className="sh-hud-role text-[var(--ink)]">SIGNAL AUDIT</span>
                  <span className="sh-hud-context text-[var(--amber)]">
                    (68% True Contracted)
                  </span>
                </div>
                <div className="sh-hud-metric-value text-[var(--ink)] font-bold">
                  $508,000 <span className="text-xs font-normal font-sans">Bankable FCF</span>
                </div>
              </div>

              {/* Deductions Breakdown Mini Visual */}
              <div className="sh-hud-deductions-list">
                <div className="sh-hud-deduction-item">
                  <span className="sh-hud-deduction-bullet text-[var(--amber)]">├─</span>
                  <span className="sh-hud-deduction-name">Replacement GM Wage</span>
                  <span className="sh-hud-deduction-tag">-$65,000 [Unmodeled]</span>
                </div>
                <div className="sh-hud-deduction-item">
                  <span className="sh-hud-deduction-bullet text-[var(--amber)]">├─</span>
                  <span className="sh-hud-deduction-name">Deferred Fleet CapEx</span>
                  <span className="sh-hud-deduction-tag">-$42,000 [P&amp;L Audit]</span>
                </div>
                <div className="sh-hud-deduction-item">
                  <span className="sh-hud-deduction-bullet text-[var(--clay)]">└─</span>
                  <span className="sh-hud-deduction-name">Contract Drift Buffer</span>
                  <span className="sh-hud-deduction-tag">-$35,000 [Concentration]</span>
                </div>
              </div>

              {/* Bottom Verdict Strip */}
              <div className="sh-hud-verdict-box">
                <div className="sh-hud-verdict-left">
                  <span className="sh-hud-verdict-title">AUDIT VERDICT</span>
                  <span className="sh-hud-verdict-stat text-[var(--clay)] font-semibold">
                    -21.8% Multiple Adjustment
                  </span>
                </div>
                <div className="sh-hud-verdict-right">
                  <span className="sh-hud-verdict-title">DSCR BUFFER</span>
                  <span className="sh-hud-verdict-stat text-[oklch(0.35_0.08_155)] font-semibold flex items-center gap-1">
                    <ShieldCheck size={14} /> 1.34x (Min 1.25x)
                  </span>
                </div>
              </div>

              {/* Link Action */}
              <div className="mt-4 pt-3 border-t border-[var(--rule)] flex items-center justify-between">
                <span className="text-[11px] font-mono text-[var(--sh-fg-3)]">
                  Illustrative composite audit
                </span>
                <Link
                  href="/walkthrough"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)] hover:text-[var(--amber)] transition-colors"
                >
                  <span>Open Full Diligence Desk</span>
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="hud-aperture"
              id="hero-panel-aperture"
              role="tabpanel"
              aria-labelledby="hero-tab-aperture"
              initial={{ opacity: 0, y: 8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="sh-hud-state-container"
            >
              {/* Header Badge */}
              <div className="sh-hud-meta-row">
                <span className="sh-hud-pill sh-hud-pill--slate">
                  ALIGNMENT SPECTRUM · CONCENTRATED STUDY
                </span>
                <span className="sh-hud-label-tag">Macro Defense (Composite)</span>
              </div>

              {/* Data Strip 1: Allocation Band */}
              <div className="sh-hud-metric-row sh-hud-metric-row--claim">
                <div className="sh-hud-metric-head">
                  <span className="sh-hud-role">ALLOCATION BAND</span>
                  <span className="sh-hud-context">(Target 12.5% NAV)</span>
                </div>
                <div className="sh-hud-metric-value text-[var(--ink)] font-bold">
                  $10,000 — $15,000
                </div>
              </div>

              {/* Visual Track */}
              <div className="my-3 p-3 bg-[var(--paper)] border border-[var(--rule)]">
                <div className="flex justify-between text-[10px] font-mono text-[var(--sh-fg-3)] mb-1">
                  <span>$0 (Floor)</span>
                  <span className="text-[var(--ink)] font-bold">● $12,500 Modeled Exposure</span>
                  <span>$15,000 (Ceiling)</span>
                </div>
                <div className="relative h-2.5 bg-[var(--rule)] rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 left-[66%] right-[0%] bg-[oklch(0.35_0.08_155)] opacity-20"
                    title="Target Band: $10k - $15k"
                  />
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-[var(--amber)] rounded-full"
                    style={{ width: "83.3%" }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] font-mono text-[var(--sh-fg-3)]">
                  <span>Safe Reserve</span>
                  <span className="text-[oklch(0.35_0.08_155)] font-medium">Inside Target Band</span>
                  <span>Hard Limit</span>
                </div>
              </div>

              {/* Data Strip 2: Invalidation Trigger */}
              <div className="sh-hud-metric-row sh-hud-metric-row--audit">
                <div className="sh-hud-metric-head">
                  <span className="sh-hud-role text-[var(--clay)]">INVALIDATION TRIGGER</span>
                  <span className="sh-hud-context text-[var(--clay)]">
                    (Structural Stop Condition)
                  </span>
                </div>
                <div className="sh-hud-metric-value text-[var(--clay)] font-semibold text-sm">
                  Close below 20-DMA ($42.10)
                </div>
              </div>

              {/* Bottom Verdict Strip */}
              <div className="sh-hud-verdict-box">
                <div className="sh-hud-verdict-left">
                  <span className="sh-hud-verdict-title">BOUNDED DOWNSIDE</span>
                  <span className="sh-hud-verdict-stat text-[var(--clay)] font-semibold">
                    -$1,850 [Max 1.8% NAV Risk]
                  </span>
                </div>
                <div className="sh-hud-verdict-right">
                  <span className="sh-hud-verdict-title">THESIS STATE</span>
                  <span className="sh-hud-verdict-stat text-[oklch(0.35_0.08_155)] font-semibold flex items-center gap-1">
                    <ShieldCheck size={14} /> Bounded &amp; Compliant
                  </span>
                </div>
              </div>

              {/* Link Action */}
              <div className="mt-4 pt-3 border-t border-[var(--rule)] flex items-center justify-between">
                <span className="text-[11px] font-mono text-[var(--sh-fg-3)]">
                  Simulated risk envelope
                </span>
                <Link
                  href="/walkthrough/capital-desk"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)] hover:text-[var(--amber)] transition-colors"
                >
                  <span>Open Capital Aperture</span>
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
