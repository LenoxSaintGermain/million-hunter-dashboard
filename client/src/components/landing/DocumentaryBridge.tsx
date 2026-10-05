import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Wrench, UserX, Info, CheckCircle2, ShieldAlert } from "lucide-react";

interface InspectionPin {
  id: string;
  x: number; // percentage from left
  y: number; // percentage from top
  title: string;
  tag: string;
  headline: string;
  detail: string;
  impact: string;
  status: "rejected" | "warning";
}

const PINS: InspectionPin[] = [
  {
    id: "pin-fleet",
    x: 36,
    y: 62,
    title: "Pin 1 · Fleet Line",
    tag: "CAPEX UNDERSTATEMENT",
    headline: "14/18 Vehicles > 160k Miles",
    detail: "Reported P&L claimed $8,000 annual vehicle maintenance as a one-time add-back. Physical fleet odometer audit reveals imminent engine/transmission end-of-life across 78% of the route fleet.",
    impact: "Est. CapEx: $140,000 | Add-Back Status: REJECTED",
    status: "rejected",
  },
  {
    id: "pin-dispatch",
    x: 74,
    y: 38,
    title: "Pin 2 · Dispatch Office Window",
    tag: "KEY-PERSON EXPOSURE",
    headline: "Dispatch Run by Seller Spouse",
    detail: "CIM claimed owner worked 10 hrs/week with no operating replacement required. Field inquiry confirms seller's spouse manages daily customer routing, call dispatch, and payroll uncompensated.",
    impact: "Replacement Wage: -$72,000/yr | DSCR Impact: -0.19x",
    status: "warning",
  },
];

export function DocumentaryBridge() {
  const [selectedPin, setSelectedPin] = useState<InspectionPin | null>(PINS[0]);

  return (
    <section className="sh-doc-bridge-section">
      <div className="sh-doc-bridge-container">
        {/* Section Header */}
        <div className="sh-narrative-stack mb-8">
          <p className="sh-hero-eyebrow">
            <span aria-hidden="true" />
            <span>Documentary Field Report · Ground Truth</span>
          </p>
          <h2 className="sh-section-h2">Where Math Meets Asphalt.</h2>
          <p className="sh-section-desc">
            Spreadsheets accept any number you feed them. Real businesses run on worn fleet
            transmissions, unpaid spouse dispatch hours, and fragile handshake contracts.
            Signal Hunter forces broker claims to reconcile with physical operating reality.
          </p>
        </div>

        {/* The 16:9 Cinematic Yard + Field Note Layout */}
        <div className="sh-bridge-grid">
          {/* 16:9 Canvas Viewport */}
          <div className="sh-bridge-viewport-wrapper">
            <div className="sh-bridge-viewport">
              {/* SVG Photographic Landscape Rendering: 6:00 AM Industrial Depot */}
              <svg
                viewBox="0 0 960 540"
                className="sh-bridge-svg"
                preserveAspectRatio="xMidYMid slice"
                aria-label="Documentary field visualization: 6:00 AM commercial service yard"
              >
                <defs>
                  {/* Sky dawn gradient: 6:00 AM amber dawn horizon to slate blue sky */}
                  <linearGradient id="sky-dawn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2c3e50" />
                    <stop offset="45%" stopColor="#4a627a" />
                    <stop offset="75%" stopColor="#9a7b56" />
                    <stop offset="100%" stopColor="#d4a373" />
                  </linearGradient>

                  {/* Asphalt ground gradient with texture grit */}
                  <linearGradient id="asphalt-ground" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#24282c" />
                    <stop offset="30%" stopColor="#1a1d20" />
                    <stop offset="100%" stopColor="#121416" />
                  </linearGradient>

                  {/* Morning sunrise glow beam */}
                  <radialGradient id="sun-glow" cx="85%" cy="30%" r="50%">
                    <stop offset="0%" stopColor="#f7d08a" stopOpacity="0.45" />
                    <stop offset="50%" stopColor="#d4a373" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#24282c" stopOpacity="0" />
                  </radialGradient>

                  {/* Van Body Metallic Gradient */}
                  <linearGradient id="van-metal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f5f7fa" />
                    <stop offset="70%" stopColor="#d2d7df" />
                    <stop offset="100%" stopColor="#9aa0a6" />
                  </linearGradient>

                  {/* Window Glass Early Morning Reflection */}
                  <linearGradient id="window-glass" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#3d5a80" />
                    <stop offset="100%" stopColor="#1b263b" />
                  </linearGradient>

                  {/* Dispatch Office Interior Warm Light */}
                  <radialGradient id="office-glow" cx="50%" cy="50%" r="60%">
                    <stop offset="0%" stopColor="#ffe49e" stopOpacity="0.9" />
                    <stop offset="80%" stopColor="#f3a683" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#784b28" stopOpacity="0.2" />
                  </radialGradient>
                </defs>

                {/* 1. Sky & Dawn Horizon */}
                <rect x="0" y="0" width="960" height="260" fill="url(#sky-dawn)" />
                <rect x="0" y="0" width="960" height="260" fill="url(#sun-glow)" />

                {/* Distant industrial silhouettes & power lines */}
                <path
                  d="M0 240 L120 232 L220 238 L380 230 L520 236 L640 228 L780 234 L960 226 L960 260 L0 260 Z"
                  fill="#1f2428"
                  opacity="0.75"
                />
                <line x1="80" y1="90" x2="80" y2="250" stroke="#10151f" strokeWidth="2" opacity="0.6" />
                <line x1="80" y1="120" x2="880" y2="140" stroke="#10151f" strokeWidth="1" opacity="0.35" />
                <line x1="80" y1="135" x2="880" y2="155" stroke="#10151f" strokeWidth="1" opacity="0.35" />

                {/* 2. Warehouse & Dispatch Depot Building */}
                {/* Brick & metal building structure */}
                <polygon points="460,160 960,130 960,310 460,310" fill="#2d3436" />
                {/* Corrugated siding panels */}
                <polygon points="460,160 700,145 700,310 460,310" fill="#353b48" />
                {/* Roll-up bay doors 1 & 2 */}
                <rect x="480" y="200" width="90" height="105" fill="#1e272e" stroke="#485460" strokeWidth="2" />
                <line x1="480" y1="220" x2="570" y2="220" stroke="#485460" strokeWidth="1" />
                <line x1="480" y1="240" x2="570" y2="240" stroke="#485460" strokeWidth="1" />
                <line x1="480" y1="260" x2="570" y2="260" stroke="#485460" strokeWidth="1" />
                <line x1="480" y1="280" x2="570" y2="280" stroke="#485460" strokeWidth="1" />

                <rect x="590" y="195" width="90" height="110" fill="#1e272e" stroke="#485460" strokeWidth="2" />
                <line x1="590" y1="215" x2="680" y2="215" stroke="#485460" strokeWidth="1" />
                <line x1="590" y1="235" x2="680" y2="235" stroke="#485460" strokeWidth="1" />
                <line x1="590" y1="255" x2="680" y2="255" stroke="#485460" strokeWidth="1" />
                <line x1="590" y1="275" x2="680" y2="275" stroke="#485460" strokeWidth="1" />

                {/* Dispatch Office Building (Right) */}
                <polygon points="700,145 960,130 960,310 700,310" fill="#404040" />
                {/* Brick facade shadow */}
                <line x1="700" y1="145" x2="700" y2="310" stroke="#1e272e" strokeWidth="3" />
                {/* Dispatch Window with Warm 6:00 AM Glow */}
                <rect x="730" y="180" width="110" height="60" fill="url(#office-glow)" stroke="#e2b97f" strokeWidth="2" />
                {/* Window panes */}
                <line x1="785" y1="180" x2="785" y2="240" stroke="#2d3436" strokeWidth="2" />
                <line x1="730" y1="210" x2="840" y2="210" stroke="#2d3436" strokeWidth="2" />
                {/* Silhouette inside office: Dispatch desk & computer monitors */}
                <path d="M745 228 L765 228 L760 216 L748 216 Z" fill="#2d3436" opacity="0.85" />
                <circle cx="755" cy="210" r="4" fill="#2d3436" opacity="0.85" />
                <rect x="795" y="212" width="16" height="12" fill="#2d3436" opacity="0.75" />

                {/* 3. Asphalt Ground with Perspective Lines */}
                <rect x="0" y="260" width="960" height="280" fill="url(#asphalt-ground)" />
                {/* Worn yellow parking lane striping */}
                <polygon points="120,540 210,310 225,310 145,540" fill="#d4a373" opacity="0.35" />
                <polygon points="340,540 375,310 390,310 365,540" fill="#d4a373" opacity="0.35" />
                <polygon points="560,540 540,310 555,310 585,540" fill="#d4a373" opacity="0.3" />
                <polygon points="780,540 705,310 720,310 805,540" fill="#d4a373" opacity="0.3" />

                {/* Asphalt texture / oil stains / worn patches */}
                <ellipse cx="280" cy="460" rx="35" ry="8" fill="#0d0e10" opacity="0.6" />
                <ellipse cx="490" cy="485" rx="45" ry="10" fill="#0d0e10" opacity="0.55" />
                <ellipse cx="710" cy="440" rx="25" ry="6" fill="#0d0e10" opacity="0.5" />

                {/* 4. Fleet of Commercial Service Vans (Apex Fleet Line) */}
                {/* Back Van 3 (Further in yard) */}
                <g transform="translate(130, 255) scale(0.65)">
                  {/* Cast shadow */}
                  <ellipse cx="140" cy="115" rx="130" ry="18" fill="#0b0d0e" opacity="0.75" />
                  {/* Van body */}
                  <path
                    d="M20 50 L80 15 L240 15 L265 50 L265 95 L20 95 Z"
                    fill="url(#van-metal)"
                    stroke="#57606f"
                    strokeWidth="1.5"
                  />
                  {/* Cab windshield & side window */}
                  <polygon points="35,52 82,22 135,22 135,52" fill="url(#window-glass)" />
                  <polygon points="142,22 210,22 210,52 142,52" fill="url(#window-glass)" />
                  {/* Wheels */}
                  <circle cx="70" cy="95" r="22" fill="#1e272e" />
                  <circle cx="70" cy="95" r="10" fill="#747d8c" />
                  <circle cx="215" cy="95" r="22" fill="#1e272e" />
                  <circle cx="215" cy="95" r="10" fill="#747d8c" />
                </g>

                {/* Middle Van 2 */}
                <g transform="translate(380, 275) scale(0.85)">
                  {/* Cast shadow */}
                  <ellipse cx="150" cy="120" rx="145" ry="22" fill="#0b0d0e" opacity="0.8" />
                  {/* Van body */}
                  <path
                    d="M20 50 L85 15 L260 15 L285 50 L285 100 L20 100 Z"
                    fill="url(#van-metal)"
                    stroke="#57606f"
                    strokeWidth="2"
                  />
                  {/* Windshield */}
                  <polygon points="35,52 88,22 145,22 145,52" fill="url(#window-glass)" />
                  <polygon points="155,22 230,22 230,52 155,52" fill="url(#window-glass)" />
                  {/* Decal line */}
                  <line x1="25" y1="65" x2="280" y2="65" stroke="#95a5a6" strokeWidth="2" opacity="0.6" />
                  {/* Wheels */}
                  <circle cx="75" cy="100" r="24" fill="#1e272e" />
                  <circle cx="75" cy="100" r="12" fill="#747d8c" />
                  <circle cx="230" cy="100" r="24" fill="#1e272e" />
                  <circle cx="230" cy="100" r="12" fill="#747d8c" />
                </g>

                {/* Primary Foreground Van 1 (Right in front of Pin 1) */}
                <g transform="translate(180, 310) scale(1.1)">
                  {/* Low angle early morning sun reflection beam */}
                  <polygon points="20,55 90,16 280,16 300,55" fill="#f7d08a" opacity="0.18" />
                  {/* Deep cast shadow towards bottom-left */}
                  <ellipse cx="160" cy="130" rx="170" ry="26" fill="#08090a" opacity="0.9" />
                  {/* Van body */}
                  <path
                    d="M25 55 L95 16 L290 16 L315 55 L315 110 L25 110 Z"
                    fill="url(#van-metal)"
                    stroke="#485460"
                    strokeWidth="2.5"
                  />
                  {/* Windshield and front side windows */}
                  <polygon points="40,57 98,24 165,24 165,57" fill="url(#window-glass)" />
                  <polygon points="175,24 255,24 255,57 175,57" fill="url(#window-glass)" />
                  {/* Commercial side door seams */}
                  <line x1="170" y1="18" x2="170" y2="108" stroke="#747d8c" strokeWidth="1.5" />
                  <line x1="260" y1="18" x2="260" y2="108" stroke="#747d8c" strokeWidth="1.5" />
                  {/* Roof ladder rack */}
                  <line x1="80" y1="14" x2="280" y2="14" stroke="#57606f" strokeWidth="3" />
                  <line x1="110" y1="14" x2="110" y2="16" stroke="#57606f" strokeWidth="3" />
                  <line x1="250" y1="14" x2="250" y2="16" stroke="#57606f" strokeWidth="3" />
                  {/* Wheels */}
                  <circle cx="85" cy="110" r="28" fill="#18191a" />
                  <circle cx="85" cy="110" r="14" fill="#57606f" />
                  <circle cx="85" cy="110" r="6" fill="#a4b0be" />
                  <circle cx="255" cy="110" r="28" fill="#18191a" />
                  <circle cx="255" cy="110" r="14" fill="#57606f" />
                  <circle cx="255" cy="110" r="6" fill="#a4b0be" />
                </g>

                {/* 5. Yard Lighting and Atmosphere */}
                {/* 6:00 AM Security Lamp on Building Corner */}
                <circle cx="700" cy="150" r="4" fill="#fff275" />
                <path d="M700 150 L640 280 L760 280 Z" fill="#ffeaa7" opacity="0.08" />

                {/* Timestamp watermark */}
                <text
                  x="30"
                  y="45"
                  fill="#faf7ef"
                  opacity="0.5"
                  fontFamily="monospace"
                  fontSize="12"
                  letterSpacing="2"
                >
                  FIELD SURVEILLANCE · 06:14 EST · APEX DEPOT FACILITY
                </text>
              </svg>

              {/* Interactive Crosshairs Pins */}
              {PINS.map(pin => {
                const isSelected = selectedPin?.id === pin.id;
                return (
                  <div
                    key={pin.id}
                    className="sh-crosshair-pin-anchor"
                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  >
                    <button
                      type="button"
                      aria-label={`Inspect ${pin.title}`}
                      className={`sh-crosshair-trigger ${
                        isSelected ? "sh-crosshair-trigger--active" : ""
                      }`}
                      onClick={() => setSelectedPin(pin)}
                    >
                      <span className="sh-crosshair-pulse" />
                      <span className="sh-crosshair-dot" />
                      <span className="sh-crosshair-label">{pin.title}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Inspectable Pin Callout (Immediately Beneath/Overlaid) */}
            <AnimatePresence mode="wait">
              {selectedPin && (
                <motion.div
                  key={selectedPin.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="sh-pin-inspection-card"
                >
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[var(--rule)]">
                    <span className="font-mono text-xs font-semibold text-[var(--amber)] flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      {selectedPin.tag}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--sh-fg-3)]">
                      {selectedPin.title}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-[var(--ink)] m-0 mb-1">
                    {selectedPin.headline}
                  </h4>
                  <p className="text-xs text-[var(--sh-fg-2)] leading-relaxed m-0 mb-3">
                    {selectedPin.detail}
                  </p>

                  <div className="p-2.5 bg-[var(--bone)] border-l-2 border-[var(--clay)] font-mono text-xs text-[var(--clay)] font-semibold">
                    {selectedPin.impact}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Operator Field Note Sidebar */}
          <div className="sh-bridge-sidebar">
            <div className="sh-field-note-card">
              <div className="sh-field-note-header">
                <span className="sh-field-note-pill">OPERATOR FIELD NOTE</span>
                <span className="font-mono text-[10px] uppercase text-[var(--sh-fg-3)]">
                  The Human Stakes
                </span>
              </div>

              <blockquote className="sh-field-note-quote">
                &ldquo;The broker swore customer retention was 94%. Line 18 told a completely different
                story: half the volume was handshake agreements with two general contractors. If
                one leaves, the SBA debt service fails. Signal Hunter caught what deal momentum
                wanted me to overlook.&rdquo;
              </blockquote>

              <div className="sh-field-note-author">
                <div className="font-semibold text-sm text-[var(--ink)]">
                  Marcus V. · Self-Funded Searcher
                </div>
                <div className="text-xs text-[var(--sh-fg-3)] font-mono mt-0.5">
                  Illustrative Case Vignette · 104-Unit Cleaning Route (Composite Deal Audit)
                </div>
              </div>

              <div className="sh-field-note-audit-box">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--sh-fg-3)] mb-1.5 font-semibold">
                  AUDITED DISCREPANCIES (P&amp;L VS. FIELD):
                </div>
                <ul className="space-y-1.5 text-xs text-[var(--sh-fg-2)] m-0 pl-0 list-none">
                  <li className="flex items-start gap-1.5">
                    <span className="text-[var(--clay)] font-bold">✕</span>
                    <span>Broker claimed <strong>$650,000 SDE</strong> with 92% recurring customer retention.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[var(--clay)] font-bold">✕</span>
                    <span>Actual contracted retention: <strong>68%</strong>; top 2 GCs represent 44% of revenue.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[var(--amber)] font-bold">⚠</span>
                    <span>Owner spouse performs unrecorded 35 hr/wk dispatch operations.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[oklch(0.35_0.08_155)] font-bold">✓</span>
                    <span>Underwritten bankable cash: <strong>$508,000</strong> (1.34x DSCR safe floor).</span>
                  </li>
                </ul>
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--rule)] text-[11px] text-[var(--sh-fg-3)] font-mono">
                Prime Directive 1 Verified · Composite deal fixture, not a paid customer quote.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
