import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Search,
  Code2,
} from "lucide-react";

export function DialecticScrollytelling() {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  return (
    <section id="methodology" className="sh-section-frame">
      <div className="sh-narrative-stack">
        <p className="sh-hero-eyebrow">
          <span aria-hidden="true" />
          <span>The Auditable Engine · 3-Step Dialectic</span>
        </p>
        <h2 className="sh-section-h2">A Claim Is Not a Conclusion.</h2>
        <p className="sh-section-desc">
          Most software manufactures a vanity score by blending broker assertions with real facts.
          Signal Hunter isolates claims into an auditable dialectic before capital ever moves.
        </p>
      </div>

      {/* Step Selector Pills */}
      <div className="sh-dialectic-step-selector" role="tablist" aria-label="Methodology Steps">
        <button
          type="button"
          role="tab"
          id="tab-step-1"
          aria-selected={activeStep === 1}
          aria-controls="panel-step-1"
          className={`sh-step-pill-btn ${activeStep === 1 ? "sh-step-pill-btn--active" : ""}`}
          onClick={() => setActiveStep(1)}
        >
          <span className="sh-step-num">01</span>
          <span className="sh-step-name">Ingestion &amp; Citation</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-step-2"
          aria-selected={activeStep === 2}
          aria-controls="panel-step-2"
          className={`sh-step-pill-btn ${activeStep === 2 ? "sh-step-pill-btn--active" : ""}`}
          onClick={() => setActiveStep(2)}
        >
          <span className="sh-step-num">02</span>
          <span className="sh-step-name">Epistemic Triangulation</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-step-3"
          aria-selected={activeStep === 3}
          aria-controls="panel-step-3"
          className={`sh-step-pill-btn ${activeStep === 3 ? "sh-step-pill-btn--active" : ""}`}
          onClick={() => setActiveStep(3)}
        >
          <span className="sh-step-num">03</span>
          <span className="sh-step-name">Downside Stress Testing</span>
        </button>
      </div>

      {/* Scrollytelling 2-Column Split: Narrative on Left, Artifact on Right */}
      <div className="sh-dialectic-content-grid">
        {/* Left Column: Structured Step Narrative */}
        <div className="sh-dialectic-narrative-col">
          <AnimatePresence mode="wait">
            {activeStep === 1 && (
              <motion.div
                key="narrative-1"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="font-mono text-xs uppercase tracking-widest text-[var(--sh-fg-3)]">
                  Step 01 · Ingestion
                </div>
                <h3 className="font-serif text-2xl text-[var(--ink)] m-0">
                  Extract Claims With Deterministic Bounding Boxes
                </h3>
                <p className="text-sm text-[var(--sh-fg-2)] leading-relaxed m-0">
                  Ingest raw CIM PDFs, 3-year P&amp;L spreadsheets, tax schedules, or thesis
                  documents. Signal Hunter binds every extracted claim to its exact coordinate on the
                  page, generating immutable JSON receipts with paragraph-level provenance.
                </p>
                <ul className="space-y-2 text-xs text-[var(--sh-fg-2)] pt-2 list-none pl-0">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-[oklch(0.35_0.08_155)] shrink-0" />
                    <span>Exact bounding-box coordinates mapped to source pages.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-[oklch(0.35_0.08_155)] shrink-0" />
                    <span>No ungrounded generative hallucinations in extraction.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-[oklch(0.35_0.08_155)] shrink-0" />
                    <span>Detects conflicting representations across CIM vs. Tax Returns.</span>
                  </li>
                </ul>
              </motion.div>
            )}

            {activeStep === 2 && (
              <motion.div
                key="narrative-2"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="font-mono text-xs uppercase tracking-widest text-[var(--sh-fg-3)]">
                  Step 02 · Triangulation
                </div>
                <h3 className="font-serif text-2xl text-[var(--ink)] m-0">
                  Separate Hard Evidence From Modeled Hope
                </h3>
                <p className="text-sm text-[var(--sh-fg-2)] leading-relaxed m-0">
                  A broker&apos;s verbal assurance is not evidence. Signal Hunter classifies every line
                  item into four strict epistemic bins: Corroborated, Modeled, Reported, or
                  Unknown. Unknown is never treated as zero or assumed to pass.
                </p>
                <ul className="space-y-2 text-xs text-[var(--sh-fg-2)] pt-2 list-none pl-0">
                  <li className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--ink)] shrink-0" />
                    <span>
                      <strong>Corroborated:</strong> Tied to bank statements, IRS 1120-S, or SEC filings.
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full border border-[var(--amber)] bg-transparent shrink-0" />
                    <span>
                      <strong>Modeled:</strong> Formula-derived debt service &amp; stress curves.
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--clay)] shrink-0" />
                    <span>
                      <strong>Unverified:</strong> Verbal broker claims &amp; speculative add-backs.
                    </span>
                  </li>
                </ul>
              </motion.div>
            )}

            {activeStep === 3 && (
              <motion.div
                key="narrative-3"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="font-mono text-xs uppercase tracking-widest text-[var(--sh-fg-3)]">
                  Step 03 · Stress Testing
                </div>
                <h3 className="font-serif text-2xl text-[var(--ink)] m-0">
                  Model Drawdowns Against Debt Covenants
                </h3>
                <p className="text-sm text-[var(--sh-fg-2)] leading-relaxed m-0">
                  Deals fail when debt coverage breaches during recessions or client churn. We model
                  combined revenue drawdowns (-10%, -20%, -30%) and margin compression against the
                  senior bank covenant (1.25x minimum DSCR) to define the exact failure horizon.
                </p>
                <ul className="space-y-2 text-xs text-[var(--sh-fg-2)] pt-2 list-none pl-0">
                  <li className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[oklch(0.35_0.08_155)] shrink-0" />
                    <span>
                      <strong>Green (&gt;1.35x):</strong> Safe operating cushion for owner draw.
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[var(--amber)] shrink-0" />
                    <span>
                      <strong>Amber (1.15x–1.35x):</strong> Covenant warning; distribution freeze.
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[var(--clay)] shrink-0" />
                    <span>
                      <strong>Red (&lt;1.15x):</strong> Technical default; bank acceleration risk.
                    </span>
                  </li>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Interactive Visual Artifact */}
        <div className="sh-dialectic-artifact-col">
          <AnimatePresence mode="wait">
            {activeStep === 1 && (
              <motion.div
                key="artifact-step-1"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="sh-annotated-doc-mockup"
              >
                {/* Mock CIM Document Header */}
                <div className="sh-doc-mockup-header">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-[var(--sh-fg-3)]" />
                    <span className="font-mono text-xs font-semibold text-[var(--ink)]">
                      CONFIDENTIAL_OFFERING_MEMORANDUM.PDF · PAGE 18
                    </span>
                  </div>
                  <span className="sh-hud-pill sh-hud-pill--amber">OCR EXTRACTOR ACTIVE</span>
                </div>

                {/* Simulated Document Text with Highlight Bounding Boxes */}
                <div className="sh-doc-mockup-body">
                  <p className="text-xs text-[var(--sh-fg-3)] leading-relaxed m-0 font-serif">
                    ...The company demonstrates exceptional pricing power across its commercial
                    customer portfolio. In FY2025, the company delivered:
                  </p>

                  {/* Bounding Box 1: SDE */}
                  <div className="sh-bbox-container sh-bbox-container--highlight">
                    <div className="sh-bbox-tag">
                      <span>BBOX #1 · CLAIMED EARNINGS</span>
                    </div>
                    <div className="text-sm font-semibold text-[var(--ink)] font-mono">
                      &ldquo;Normalized Seller Discretionary Earnings (SDE): $650,000&rdquo;
                    </div>
                    <div className="sh-bbox-connector">
                      <Code2 size={12} className="text-[var(--amber)]" />
                      <span className="font-mono text-[11px] text-[var(--amber)]">
                        &rarr; json.reported_sde: 650000 | confidence: 0.99
                      </span>
                    </div>
                  </div>

                  {/* Bounding Box 2: Recurring Rate */}
                  <div className="sh-bbox-container sh-bbox-container--highlight">
                    <div className="sh-bbox-tag">
                      <span>BBOX #2 · RETENTION ASSERTION</span>
                    </div>
                    <div className="text-sm font-semibold text-[var(--ink)] font-mono">
                      &ldquo;Historical Customer Retention Rate: 92% contracted recurring&rdquo;
                    </div>
                    <div className="sh-bbox-connector">
                      <Code2 size={12} className="text-[var(--clay)]" />
                      <span className="font-mono text-[11px] text-[var(--clay)]">
                        &rarr; json.unverified_retention: 0.92 | flag: NO_CONTRACT_BACKING
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--sh-fg-3)] leading-relaxed m-0 font-serif">
                    Owner currently oversees business on part-time basis with fully self-sufficient
                    operations and experienced supervisor staff in place...
                  </p>
                </div>

                {/* Footer JSON Output Badge */}
                <div className="sh-doc-mockup-footer">
                  <span className="font-mono text-[11px] text-[oklch(0.35_0.08_155)] flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 size={13} />
                    Source Coordinates Bounded &amp; Linked
                  </span>
                  <span className="font-mono text-[10px] text-[var(--sh-fg-3)]">
                    SHA256: 7b89...41c2
                  </span>
                </div>
              </motion.div>
            )}

            {activeStep === 2 && (
              <motion.div
                key="artifact-step-2"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="sh-confidence-gauge-card"
              >
                <div className="sh-doc-mockup-header">
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-[var(--sh-fg-3)]" />
                    <span className="font-mono text-xs font-semibold text-[var(--ink)]">
                      EPISTEMIC CONFIDENCE GAUGE · 4-TIER SEPARATION
                    </span>
                  </div>
                  <span className="sh-hud-pill sh-hud-pill--slate">TRIANGULATION AUDIT</span>
                </div>

                <div className="p-4 space-y-3">
                  {/* Corroborated */}
                  <div className="p-3 bg-[var(--paper)] border border-[var(--ink)] flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-[var(--ink)] text-[var(--paper)] font-mono text-[10px] font-bold uppercase tracking-wider rounded-sm">
                          Corroborated
                        </span>
                        <span className="font-mono text-xs font-semibold text-[var(--ink)]">
                          $1,840,000 Verified Revenue
                        </span>
                      </div>
                      <p className="text-xs text-[var(--sh-fg-2)] m-0">
                        Primary Source: 3-Year IRS Form 1120-S reconciled to 36 months of bank deposits.
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-[oklch(0.35_0.08_155)] shrink-0">
                      100% Validated
                    </span>
                  </div>

                  {/* Modeled */}
                  <div className="p-3 bg-[var(--paper)] border border-dashed border-[var(--amber)] flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 border border-[var(--amber)] text-[var(--amber)] font-mono text-[10px] font-bold uppercase tracking-wider rounded-sm">
                          Modeled
                        </span>
                        <span className="font-mono text-xs font-semibold text-[var(--ink)]">
                          -$65,000 Replacement GM Salary
                        </span>
                      </div>
                      <p className="text-xs text-[var(--sh-fg-2)] m-0">
                        Underwriting Rule: BLS commercial service management median wage for market area.
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-[var(--amber)] shrink-0">
                      Algorithmic
                    </span>
                  </div>

                  {/* Unverified */}
                  <div className="p-3 bg-[var(--paper)] border-l-4 border-l-[var(--clay)] border border-[var(--rule)] flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-[var(--clay)] text-white font-mono text-[10px] font-bold uppercase tracking-wider rounded-sm">
                          Unverified
                        </span>
                        <span className="font-mono text-xs font-semibold text-[var(--clay)]">
                          $42,000 Owner Cell &amp; Travel Add-Backs
                        </span>
                      </div>
                      <p className="text-xs text-[var(--sh-fg-2)] m-0">
                        Broker Pitch Claim: No general ledger receipts or business justification provided.
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-[var(--clay)] shrink-0">
                      Disallowed
                    </span>
                  </div>
                </div>

                <div className="sh-doc-mockup-footer">
                  <span className="font-mono text-[11px] text-[var(--sh-fg-3)]">
                    Audit Rule: No unverified claims enter bankable cash base.
                  </span>
                </div>
              </motion.div>
            )}

            {activeStep === 3 && (
              <motion.div
                key="artifact-step-3"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="sh-dscr-matrix-card"
              >
                <div className="sh-doc-mockup-header">
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-[var(--sh-fg-3)]" />
                    <span className="font-mono text-xs font-semibold text-[var(--ink)]">
                      3x3 DSCR SENSITIVITY MATRIX · SENIOR DEBT STRESS
                    </span>
                  </div>
                  <span className="sh-hud-pill sh-hud-pill--amber">BANK COVENANT: 1.25x</span>
                </div>

                <div className="p-4">
                  {/* Table Matrix */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse font-mono text-xs">
                      <thead>
                        <tr className="border-b border-[var(--rule)] text-[10px] uppercase text-[var(--sh-fg-3)]">
                          <th className="p-2 text-left">Margin \ Rev Shock</th>
                          <th className="p-2">Base (0%)</th>
                          <th className="p-2">-10% Revenue</th>
                          <th className="p-2">-20% Revenue</th>
                          <th className="p-2">-30% Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Row 1: Base Margin */}
                        <tr className="border-b border-[var(--rule)]">
                          <td className="p-2 text-left font-semibold text-[var(--ink)]">Base Margin</td>
                          <td className="p-2 font-bold text-[oklch(0.35_0.08_155)] bg-[oklch(0.95_0.03_155)]">
                            1.34x
                          </td>
                          <td className="p-2 font-bold text-[var(--amber)] bg-[oklch(0.95_0.03_85)]">
                            1.21x
                          </td>
                          <td className="p-2 font-bold text-[var(--clay)] bg-[oklch(0.95_0.03_25)]">
                            1.07x
                          </td>
                          <td className="p-2 font-bold text-[var(--clay)] bg-[oklch(0.95_0.03_25)]">
                            0.94x
                          </td>
                        </tr>

                        {/* Row 2: -2.5% Margin */}
                        <tr className="border-b border-[var(--rule)]">
                          <td className="p-2 text-left font-semibold text-[var(--ink)]">-2.5% Margin</td>
                          <td className="p-2 font-bold text-[var(--amber)] bg-[oklch(0.95_0.03_85)]">
                            1.22x
                          </td>
                          <td className="p-2 font-bold text-[var(--clay)] bg-[oklch(0.95_0.03_25)]">
                            1.09x
                          </td>
                          <td className="p-2 font-bold text-[var(--clay)] bg-[oklch(0.95_0.03_25)]">
                            0.96x
                          </td>
                          <td className="p-2 font-bold text-[var(--clay)] bg-[oklch(0.95_0.03_25)]">
                            0.82x
                          </td>
                        </tr>

                        {/* Row 3: -5.0% Margin */}
                        <tr>
                          <td className="p-2 text-left font-semibold text-[var(--ink)]">-5.0% Margin</td>
                          <td className="p-2 font-bold text-[var(--clay)] bg-[oklch(0.95_0.03_25)]">
                            1.10x
                          </td>
                          <td className="p-2 font-bold text-[var(--clay)] bg-[oklch(0.95_0.03_25)]">
                            0.98x
                          </td>
                          <td className="p-2 font-bold text-[var(--clay)] bg-[oklch(0.95_0.03_25)]">
                            0.85x
                          </td>
                          <td className="p-2 font-bold text-[var(--clay)] bg-[oklch(0.95_0.03_25)]">
                            0.71x
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Legend */}
                  <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-[var(--sh-fg-3)] pt-2 border-t border-[var(--rule)]">
                    <span className="flex items-center gap-1.5 text-[oklch(0.35_0.08_155)] font-bold">
                      ● &gt;1.35x Pass
                    </span>
                    <span className="flex items-center gap-1.5 text-[var(--amber)] font-bold">
                      ● 1.15x–1.35x Warning
                    </span>
                    <span className="flex items-center gap-1.5 text-[var(--clay)] font-bold">
                      ● &lt;1.15x Default Risk
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
