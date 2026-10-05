import React, { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  ArrowRight,
  ShieldCheck,
  Building2,
  LineChart,
  AlertTriangle,
  RotateCcw,
  Sliders,
  ExternalLink,
} from "lucide-react";

export function CaseStudySandbox() {
  const [activeCase, setActiveCase] = useState<"acquisition" | "capital">("acquisition");
  const [revenueStress, setRevenueStress] = useState<number>(0); // 0% to -25%
  const [positionDrift, setPositionDrift] = useState<number>(12500); // $5k to $25k

  // Calculations for Acquisition Case
  const reportedSde = 650000;
  const fixedDeductions = 142000; // -$65k GM, -$42k CapEx, -$35k drift
  const stressDeduction = Math.round(reportedSde * (revenueStress / 100));
  const bankableFcf = Math.max(0, reportedSde - fixedDeductions + stressDeduction);
  const debtService = 380000;
  const dscr = bankableFcf / debtService;
  const isDscrPassing = dscr >= 1.25;

  // Calculations for Capital Case
  const accountSize = 100000;
  const stopDropPct = 0.132; // from $48.50 to $42.10 stop
  const dollarLoss = Math.round(positionDrift * stopDropPct);
  const portfolioRiskPct = (dollarLoss / accountSize) * 100;
  const isRiskPassing = portfolioRiskPct <= 2.0;

  return (
    <div id="case-sandbox" className="sh-case-sandbox-wrapper">
      {/* Top Status Bar */}
      <div className="sh-sandbox-top-bar">
        <div className="flex items-center gap-2">
          <span className="sh-live-indicator-dot" />
          <span className="sh-live-status-text">
            LOCAL DEMO SESSION · LIVE CALCULATION ACTIVE
          </span>
        </div>
        <div className="sh-sandbox-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeCase === "acquisition"}
            className={`sh-sandbox-tab ${activeCase === "acquisition" ? "sh-sandbox-tab--active" : ""}`}
            onClick={() => setActiveCase("acquisition")}
          >
            <Building2 size={13} aria-hidden="true" />
            <span>Apex Cleaning (M&amp;A)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCase === "capital"}
            className={`sh-sandbox-tab ${activeCase === "capital" ? "sh-sandbox-tab--active" : ""}`}
            onClick={() => setActiveCase("capital")}
          >
            <LineChart size={13} aria-hidden="true" />
            <span>Macro Allocation (Aperture)</span>
          </button>
        </div>
      </div>

      {/* Interactive Sandbox Viewport */}
      <div className="sh-sandbox-viewport">
        <AnimatePresence mode="wait">
          {activeCase === "acquisition" ? (
            <motion.div
              key="case-acquisition"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="sh-sandbox-content"
            >
              {/* Header Info */}
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4 pb-4 border-b border-[var(--rule)]">
                <div>
                  <div className="font-mono text-xs uppercase tracking-wider text-[var(--sh-fg-3)]">
                    Target Case GT-001 · Service Business Diligence
                  </div>
                  <h4 className="text-xl font-bold text-[var(--ink)] m-0 mt-0.5">
                    Apex Commercial Cleaning Services, LLC
                  </h4>
                  <p className="text-xs text-[var(--sh-fg-2)] m-0 mt-1 font-mono">
                    Asking: $2,100,000 | Reported SDE: $650,000 | SBA 7(a) Underwrite
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 text-xs font-mono font-bold rounded-sm ${
                      isDscrPassing
                        ? "bg-[oklch(0.95_0.03_155)] text-[oklch(0.35_0.08_155)] border border-[oklch(0.85_0.05_155)]"
                        : "bg-[oklch(0.95_0.03_25)] text-[var(--clay)] border border-[oklch(0.85_0.05_25)]"
                    }`}
                  >
                    DSCR: {dscr.toFixed(2)}x {isDscrPassing ? "(COVENANT PASS)" : "(DEFAULT BREACH)"}
                  </span>
                </div>
              </div>

              {/* Live Arithmetic Controls Grid */}
              <div className="grid md:grid-cols-2 gap-6 items-center">
                {/* Sliders & Stress Controls */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1.5">
                      <span className="text-[var(--sh-fg-2)] font-semibold flex items-center gap-1">
                        <Sliders size={13} />
                        Simulate Revenue Shock
                      </span>
                      <span className="text-[var(--ink)] font-bold">{revenueStress}% Drawdown</span>
                    </div>
                    <input
                      type="range"
                      min="-25"
                      max="0"
                      step="1"
                      value={revenueStress}
                      onChange={e => setRevenueStress(Number(e.target.value))}
                      className="w-full accent-[var(--amber)] cursor-pointer h-2 bg-[var(--rule)] rounded-lg"
                      aria-label="Revenue stress percentage slider"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-[var(--sh-fg-3)] mt-1">
                      <span>0% (Reported Base)</span>
                      <span>-10% (Recession)</span>
                      <span>-25% (Client Churn)</span>
                    </div>
                  </div>

                  <div className="p-3 bg-[var(--bone)] border border-[var(--rule)] space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-[var(--sh-fg-3)]">Broker Claimed SDE:</span>
                      <span className="font-semibold">$650,000</span>
                    </div>
                    <div className="flex justify-between text-[var(--amber)]">
                      <span>Total Identified Deductions:</span>
                      <span className="font-semibold">-$142,000</span>
                    </div>
                    {revenueStress < 0 && (
                      <div className="flex justify-between text-[var(--clay)]">
                        <span>Revenue Stress Deduction:</span>
                        <span className="font-semibold">
                          -${Math.abs(stressDeduction).toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="pt-1.5 border-t border-[var(--rule)] flex justify-between text-[var(--ink)] font-bold text-sm">
                      <span>Bankable Free Cash Flow:</span>
                      <span>${bankableFcf.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Verdict & Direct Walkthrough Seam */}
                <div className="p-4 bg-[var(--paper)] border border-[var(--rule)] flex flex-col justify-between h-full">
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--sh-fg-3)] mb-1">
                      Live Risk Verdict
                    </div>
                    <div className="text-sm font-semibold text-[var(--ink)] mb-2">
                      {isDscrPassing
                        ? "Deal survives covenant stress test at current baseline."
                        : "CRITICAL BREACH: Bank debt service fails 1.25x covenant under stress."}
                    </div>
                    <p className="text-xs text-[var(--sh-fg-2)] leading-relaxed m-0 mb-4">
                      Explore the complete 8-step decision pipeline: thesis bounds, IC consensus,
                      red team audit, and automated letter of intent generator.
                    </p>
                  </div>

                  <Link href="/walkthrough" className="sh-btn-primary w-full text-center">
                    <span>Enter Full Diligence Walkthrough</span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="case-capital"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="sh-sandbox-content"
            >
              {/* Header Info */}
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4 pb-4 border-b border-[var(--rule)]">
                <div>
                  <div className="font-mono text-xs uppercase tracking-wider text-[var(--sh-fg-3)]">
                    Target Case AP-002 · Liquid Risk Envelope
                  </div>
                  <h4 className="text-xl font-bold text-[var(--ink)] m-0 mt-0.5">
                    Concentrated Liquid Allocation Study
                  </h4>
                  <p className="text-xs text-[var(--sh-fg-2)] m-0 mt-1 font-mono">
                    Portfolio NAV: $100,000 | Invalidation Trigger: Close &lt; $42.10 | Stop Loss: -13.2%
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 text-xs font-mono font-bold rounded-sm ${
                      isRiskPassing
                        ? "bg-[oklch(0.95_0.03_155)] text-[oklch(0.35_0.08_155)] border border-[oklch(0.85_0.05_155)]"
                        : "bg-[oklch(0.95_0.03_25)] text-[var(--clay)] border border-[oklch(0.85_0.05_25)]"
                    }`}
                  >
                    Risk: {portfolioRiskPct.toFixed(2)}% NAV {isRiskPassing ? "(WITHIN 2% LIMIT)" : "(RISK CEILING BREACH)"}
                  </span>
                </div>
              </div>

              {/* Live Arithmetic Controls Grid */}
              <div className="grid md:grid-cols-2 gap-6 items-center">
                {/* Sliders & Sizing Controls */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1.5">
                      <span className="text-[var(--sh-fg-2)] font-semibold flex items-center gap-1">
                        <Sliders size={13} />
                        Adjust Modeled Position Sizing
                      </span>
                      <span className="text-[var(--ink)] font-bold">
                        ${positionDrift.toLocaleString()} ({(positionDrift / 1000).toFixed(1)}% NAV)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="5000"
                      max="25000"
                      step="500"
                      value={positionDrift}
                      onChange={e => setPositionDrift(Number(e.target.value))}
                      className="w-full accent-[var(--amber)] cursor-pointer h-2 bg-[var(--rule)] rounded-lg"
                      aria-label="Modeled position size slider"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-[var(--sh-fg-3)] mt-1">
                      <span>$5,000 (Conservative)</span>
                      <span className="text-[oklch(0.35_0.08_155)] font-semibold">
                        $10K–$15K Target Band
                      </span>
                      <span>$25,000 (Overallocated)</span>
                    </div>
                  </div>

                  <div className="p-3 bg-[var(--bone)] border border-[var(--rule)] space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-[var(--sh-fg-3)]">Entry Price / Stop Trigger:</span>
                      <span className="font-semibold">$48.50 / $42.10</span>
                    </div>
                    <div className="flex justify-between text-[var(--clay)]">
                      <span>Max Trade Dollar Exposure:</span>
                      <span className="font-semibold">-${dollarLoss.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[var(--sh-fg-2)]">
                      <span>Portfolio Risk Ceiling:</span>
                      <span className="font-semibold">2.00% NAV Max</span>
                    </div>
                    <div className="pt-1.5 border-t border-[var(--rule)] flex justify-between text-[var(--ink)] font-bold text-sm">
                      <span>Actual Realized Risk:</span>
                      <span>{portfolioRiskPct.toFixed(2)}% NAV</span>
                    </div>
                  </div>
                </div>

                {/* Verdict & Direct Walkthrough Seam */}
                <div className="p-4 bg-[var(--paper)] border border-[var(--rule)] flex flex-col justify-between h-full">
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--sh-fg-3)] mb-1">
                      Aperture Guard Verdict
                    </div>
                    <div className="text-sm font-semibold text-[var(--ink)] mb-2">
                      {isRiskPassing
                        ? "Position size is strictly bounded within mandate parameters."
                        : "EXCESSIVE EXPOSURE: Position drift breaches the 2.0% maximum risk mandate."}
                    </div>
                    <p className="text-xs text-[var(--sh-fg-2)] leading-relaxed m-0 mb-4">
                      Explore the live Capital Aperture sandbox with thesis compilation, play slate
                      reranking, scenario pressure-testing, and bounded risk envelopes.
                    </p>
                  </div>

                  <Link
                    href="/walkthrough/capital-desk"
                    className="sh-btn-secondary w-full text-center"
                  >
                    <span>Launch Capital Aperture Sandbox</span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
