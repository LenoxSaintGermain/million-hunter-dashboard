import React, { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ShieldCheck, Lock, FileSearch, Crosshair, AlertTriangle, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FailurePoint {
  id: "fleet" | "keyperson" | "lease";
  label: string;
  sublabel: string;
  tag: string;
  xPercent: number;
  yPercent: number;
  statusBadge: string;
  severity: "high" | "critical" | "warning";
  claimedNumber: string;
  underwrittenNumber: string;
  deltaImpact: string;
  findingHeadline: string;
  findingDetail: string;
  epistemicState: "Modeled" | "Unverified" | "Corroborated";
}

const FAILURE_POINTS: FailurePoint[] = [
  {
    id: "fleet",
    label: "Fleet Line CapEx",
    sublabel: "18 Service Vans · Bay 01–06",
    tag: "FAIL-POINT 01 · ASSET INTEGRITY",
    xPercent: 24,
    yPercent: 54,
    statusBadge: "Add-Back: REJECTED",
    severity: "critical",
    claimedNumber: "$42,000 Add-Back Claimed",
    underwrittenNumber: "-$140,000 Reserve Required",
    deltaImpact: "-$42,000 Annual FCF Impact",
    findingHeadline: "14 of 18 Service Vans Exceed 160,000 Miles",
    findingDetail:
      "Broker capitalized ordinary fleet maintenance into non-recurring seller add-backs. Physical field inspection reveals transmission wear and deferred maintenance requiring an immediate $140,000 capital expenditure.",
    epistemicState: "Unverified",
  },
  {
    id: "lease",
    label: "Depot Lease Escalation",
    sublabel: "Warehouse Bay Envelope · Bay 07–12",
    tag: "FAIL-POINT 02 · LEASE COVENANT",
    xPercent: 56,
    yPercent: 34,
    statusBadge: "Covenant Risk: +$36K/yr",
    severity: "warning",
    claimedNumber: "$4,500/mo Below-Market Rent",
    underwrittenNumber: "$7,500/mo Market Standard",
    deltaImpact: "-0.12x Senior DSCR Compression",
    findingHeadline: "Facility Leased Month-to-Month from Seller Entity",
    findingDetail:
      "Depot rent is 40% below fair market value via an expired related-party lease. Renewing at prevailing commercial rates erodes bankable debt coverage from 1.34x down toward the 1.25x senior lender covenant floor.",
    epistemicState: "Modeled",
  },
  {
    id: "keyperson",
    label: "Key-Person Dispatch Desk",
    sublabel: "Operations & Electrical Bay · Station 04",
    tag: "FAIL-POINT 03 · OPERATING LEVERAGE",
    xPercent: 88,
    yPercent: 48,
    statusBadge: "Replacement Wage: -$72K/yr",
    severity: "high",
    claimedNumber: "94% Contract Retention",
    underwrittenNumber: "68% True Contracted Volume",
    deltaImpact: "-3.4% Operating Margin Erosion",
    findingHeadline: "Dispatch Run Uncompensated by Seller Spouse",
    findingDetail:
      "All daily route assignments, customer escalation calls, and crew scheduling are handled by the owner's spouse with zero W-2 wage recorded on the P&L. Replacing this operational nexus requires a dedicated $72,000/year general manager.",
    epistemicState: "Modeled",
  },
];

export function CenturionHeroHeader() {
  const [activePointId, setActivePointId] = useState<"fleet" | "keyperson" | "lease">("fleet");
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  const activePoint = FAILURE_POINTS.find((p) => p.id === activePointId) || FAILURE_POINTS[0];

  return (
    <section className="sh-centurion-hero" aria-label="Hero Centurion Overview">
      <div className="sh-centurion-inner">
        {/* ─── 1. Header Kicker & Headline Pairing ───────────────────────────── */}
        <div className="sh-centurion-header-stack">
          <div className="sh-hero-eyebrow">
            <span aria-hidden="true" className="sh-eyebrow-dot" />
            <span className="sh-eyebrow-text">DECISION ARCHITECTURE FOR PRINCIPALS &amp; ALLOCATORS</span>
          </div>

          <h1 className="sh-centurion-headline">
            Brokers sell EBITDA. Operators inherit the floor.
          </h1>
        </div>

        {/* ─── 2. Ultra-Wide Cinematic 21:9 Letterbox Frame ─────────────────── */}
        <div className="sh-centurion-letterbox" role="region" aria-label="Interactive Documentary HUD">
          {/* Top HUD Frame Bar */}
          <div className="sh-centurion-hud-bar">
            <div className="sh-hud-telemetry">
              <span className="sh-hud-pill">SYS.HUD // REV 2.4.8</span>
              <span className="sh-hud-pill sh-hud-pill--active">
                <span className="sh-hud-pulse-dot" />
                DILIGENCE SCAN: ACTIVE
              </span>
              <span className="sh-hud-coordinates hidden sm:inline">
                GRID: 38°53&apos;42&quot;N 77°02&apos;11&quot;W &middot; ELEV: 18M
              </span>
            </div>

            <div className="sh-hud-controls">
              <span className="text-xs text-[var(--sh-fg-3)] font-mono mr-2 hidden md:inline">
                TARGETS: {FAILURE_POINTS.length} CRITICAL GAPS DETECTED
              </span>
              <div className="sh-hud-switcher">
                {FAILURE_POINTS.map((point) => (
                  <button
                    key={point.id}
                    type="button"
                    onClick={() => {
                      setActivePointId(point.id);
                      setIsInspectorOpen(true);
                    }}
                    className={`sh-hud-switch-btn ${activePointId === point.id ? "sh-hud-switch-btn--active" : ""}`}
                    aria-label={`Inspect ${point.label}`}
                  >
                    <span>{point.id.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cinematic Canvas Container */}
          <div className="sh-centurion-viewport">
            <img
              src="/industrial-depot-yard.png"
              alt="Early morning industrial facility still showing commercial service fleet and dispatch bay"
              className="sh-centurion-img"
              loading="eager"
            />

            {/* Cinematic Vignette & Grain Overlay */}
            <div className="sh-centurion-vignette" aria-hidden="true" />

            {/* Glowing Monospaced Crosshair Pins Over Image */}
            <div className="sh-centurion-crosshair-layer" aria-label="Inspectable Failure Point Hotspots">
              {FAILURE_POINTS.map((point) => {
                const isActive = activePointId === point.id;
                return (
                  <div
                    key={point.id}
                    className="sh-centurion-pin-anchor"
                    style={{ left: `${point.xPercent}%`, top: `${point.yPercent}%` }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActivePointId(point.id);
                        setIsInspectorOpen(true);
                      }}
                      className={`sh-centurion-crosshair-btn ${isActive ? "sh-centurion-crosshair-btn--active" : ""}`}
                      aria-label={`Target ${point.label}`}
                    >
                      {/* Monospaced Crosshair Reticle */}
                      <span className="sh-reticle-ring" />
                      <span className="sh-reticle-pulse" />
                      <Crosshair size={18} className="sh-reticle-icon" />

                      {/* Floating HUD Tag Label */}
                      <span className="sh-reticle-tag">
                        <span className="sh-reticle-coords font-mono">
                          [{point.xPercent}%, {point.yPercent}%]
                        </span>
                        <span className="sh-reticle-name">{point.label}</span>
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Floating Live HUD Inspection Card */}
            <AnimatePresence mode="wait">
              {isInspectorOpen && activePoint && (
                <motion.div
                  key={activePoint.id}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="sh-centurion-card"
                >
                  <div className="sh-centurion-card-header">
                    <div className="flex items-center gap-2">
                      <span className="sh-card-severity-badge">
                        <AlertTriangle size={12} aria-hidden="true" />
                        <span>{activePoint.statusBadge}</span>
                      </span>
                      <span className="sh-card-epistemic-badge">
                        {activePoint.epistemicState}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsInspectorOpen(false)}
                      className="sh-card-close-btn"
                      aria-label="Minimize Inspector"
                    >
                      &times;
                    </button>
                  </div>

                  <div className="sh-centurion-card-body">
                    <div className="sh-card-tag">{activePoint.tag}</div>
                    <h2 className="sh-card-title">{activePoint.findingHeadline}</h2>
                    <p className="sh-card-desc">{activePoint.findingDetail}</p>

                    {/* Financial Reconciliation Strip */}
                    <div className="sh-card-math-strip">
                      <div className="sh-card-math-col">
                        <span className="sh-math-label">Seller Claim</span>
                        <span className="sh-math-val line-through text-[var(--sh-fg-3)]">
                          {activePoint.claimedNumber}
                        </span>
                      </div>
                      <div className="sh-card-math-arrow">
                        <ChevronRight size={14} />
                      </div>
                      <div className="sh-card-math-col">
                        <span className="sh-math-label">Signal Audit</span>
                        <span className="sh-math-val font-semibold text-[var(--crimson)]">
                          {activePoint.underwrittenNumber}
                        </span>
                      </div>
                      <div className="sh-card-math-col sh-card-math-col--impact">
                        <span className="sh-math-label">Downside Delta</span>
                        <span className="sh-math-impact">{activePoint.deltaImpact}</span>
                      </div>
                    </div>
                  </div>

                  <div className="sh-centurion-card-footer">
                    <span className="text-[11px] font-mono text-[var(--sh-fg-3)]">
                      Ref: Apex Commercial Cleaning &middot; Ground-Truth GT-001
                    </span>
                    <a href="#case-sandbox" className="sh-card-action-link">
                      <span>Test in Sandbox</span>
                      <ArrowRight size={12} />
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Letterbox Bottom Telemetry Bar */}
          <div className="sh-centurion-bottom-bar">
            <div className="sh-bottom-stat">
              <span className="sh-stat-kicker">VERIFIED DOWNSIDE FLOOR</span>
              <span className="sh-stat-val text-[var(--amber)]">$508,000 FCF</span>
              <span className="sh-stat-sub">From $650k Claimed SDE (-21.8%)</span>
            </div>

            <div className="sh-bottom-stat">
              <span className="sh-stat-kicker">MIN COVENANT DSCR</span>
              <span className="sh-stat-val text-[var(--sage)]">1.34x Coverage</span>
              <span className="sh-stat-sub">1.25x Senior Bank Floor [PASS]</span>
            </div>

            <div className="sh-bottom-stat hidden sm:flex">
              <span className="sh-stat-kicker">UNCOVERED FRAGILITIES</span>
              <span className="sh-stat-val text-[var(--crimson)]">3 Flagged</span>
              <span className="sh-stat-sub">Fleet, Lease, Key-Person</span>
            </div>
          </div>
        </div>

        {/* ─── 3. The Hook: One-Line Manifesto ──────────────────────────────── */}
        <div className="sh-centurion-manifesto-stack">
          <p className="sh-centurion-manifesto">
            Signal Hunter is the sovereign due diligence operating system that stress-tests
            assumptions, reconciles broker claims against bankable cash, and bounds your downside
            before you sign.
          </p>
        </div>

        {/* ─── 4. Action CTAs & Architecture Trust Badges ───────────────────── */}
        <div className="sh-centurion-cta-bar">
          <div className="sh-hero-cta-group mb-0">
            <a href="#case-sandbox" className="sh-btn-primary">
              <span>Enter Operator Sandbox</span>
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <Link href="/walkthrough" className="sh-btn-secondary">
              <span>Explore Diligence Desk</span>
            </Link>
            <a href="#request-access" className="sh-btn-secondary">
              <span>Request Desk Access</span>
            </a>
          </div>

          <div className="sh-hero-trust-bar pt-0 border-t-0">
            <div className="sh-trust-item">
              <ShieldCheck size={14} className="text-[var(--sage)]" />
              <span>Deterministic zero-API preview</span>
            </div>
            <div className="sh-trust-item">
              <Lock size={14} className="text-[var(--sh-fg-3)]" />
              <span>Upstream of QoE &amp; Accounting Retainers</span>
            </div>
            <div className="sh-trust-item">
              <FileSearch size={14} className="text-[var(--sh-fg-3)]" />
              <span>Four-State Evidence Grading</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
