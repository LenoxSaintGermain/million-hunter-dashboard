import React, { useState } from "react";
import { Link } from "wouter";
import {
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Activity,
  AlertOctagon,
} from "lucide-react";

const fmtUsd = (val: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);

export function BoundedRiskGaugeCard({ compact = false }: { compact?: boolean }) {
  // Two scenarios: "disciplined" (within mandate) vs "drift" (oversized / unbounded)
  const [scenario, setScenario] = useState<"disciplined" | "drift">("disciplined");

  const isDisciplined = scenario === "disciplined";
  const accountSize = 100000; // $100k illustrative liquid portfolio
  const modeledAllocation = isDisciplined ? 12500 : 28000;
  const targetMin = 10000;
  const targetMax = 15000;
  const scaleMax = 32000;

  const stopLossPrice = 42.10;
  const entryPrice = 48.50;
  const dropPct = (entryPrice - stopLossPrice) / entryPrice; // ~13.2%
  const downsideLoss = Math.round(modeledAllocation * dropPct);
  const portfolioRiskPct = (downsideLoss / accountSize) * 100;
  const isWithinMandate = portfolioRiskPct <= 2.0;

  // Geometry calculations for visual gauge
  const minPercent = (targetMin / scaleMax) * 100;
  const maxPercent = (targetMax / scaleMax) * 100;
  const pointPercent = Math.min(100, (modeledAllocation / scaleMax) * 100);

  return (
    <div className="sh-gauge-container">
      {/* Masthead */}
      <div className="sh-artifact-masthead">
        <div>
          <p className="sh-artifact-title">Capital Aperture · Concentrated Allocation</p>
          <h3 className="sh-artifact-subtitle">The Bounded Risk Gauge</h3>
          <p className="text-[10px] text-[var(--sh-fg-3)] font-mono mt-0.5 m-0">
            Illustrative — composite options fixture, not an investment recommendation.
          </p>
        </div>
        <span
          className={`sh-status-pill ${
            isWithinMandate ? "sh-status-pill--pass" : "sh-status-pill--fail"
          }`}
        >
          {isWithinMandate ? (
            <>
              <ShieldCheck size={12} aria-hidden="true" />
              <span>Mandate Compliant</span>
            </>
          ) : (
            <>
              <AlertOctagon size={12} aria-hidden="true" />
              <span>Breach: Risk Limit</span>
            </>
          )}
        </span>
      </div>

      {/* Metrics Triad */}
      <div className="sh-metrics-triad">
        <div className="sh-triad-cell">
          <dt>Modeled Sizing</dt>
          <dd>{fmtUsd(modeledAllocation)}</dd>
          <small>{isDisciplined ? "12.5% of Book" : "28.0% (Oversized)"}</small>
        </div>
        <div className="sh-triad-cell">
          <dt>Target Band</dt>
          <dd>$10K – $15K</dd>
          <small>Thesis Tolerance</small>
        </div>
        <div className="sh-triad-cell">
          <dt>Max Thesis Ceiling</dt>
          <dd>$15,000</dd>
          <small>Corroborated Anchor</small>
        </div>
      </div>

      {/* The Bounded Allocation Axis */}
      <div className="sh-axis-track-wrapper">
        <div className="sh-axis-track" aria-hidden="true">
          {/* Target Green Band */}
          <div
            className="sh-axis-band"
            style={{
              left: `${minPercent}%`,
              width: `${maxPercent - minPercent}%`,
            }}
          >
            <span className="sh-axis-band-label">Target Band</span>
          </div>

          {/* Modeled Point */}
          <div
            className={`sh-axis-point ${
              isWithinMandate ? "sh-axis-point--corroborated" : ""
            }`}
            style={{
              left: `${pointPercent}%`,
              borderColor: isWithinMandate ? "var(--ink)" : "var(--clay)",
              backgroundColor: isWithinMandate ? "var(--ink)" : "var(--clay)",
            }}
          />
        </div>

        {/* Axis Labels */}
        <div className="sh-axis-tick-labels">
          <span>$0</span>
          <span>$10K Min</span>
          <span>$15K Ceiling</span>
          <span>$30K+</span>
        </div>
      </div>

      {/* Thesis Invalidation Trigger Box */}
      <div className="sh-trigger-box">
        <div className="sh-trigger-header">
          <div className="sh-trigger-title">
            <Activity size={14} className="text-[var(--amber)]" />
            <span>Thesis Invalidation Trigger</span>
          </div>
          <span className="font-mono text-[11px] text-[var(--sh-fg-3)]">
            Stop Anchor: $42.10
          </span>
        </div>

        <p className="sh-trigger-condition">
          <strong>Failure Condition:</strong> Volume collapse & closing print below 20-DMA ($42.10).
          Invalidates underlying momentum thesis; mandatory execution exit.
        </p>

        <div className="sh-trigger-metrics">
          <div className="sh-trigger-stat">
            <span className="text-[var(--sh-fg-3)]">Downside at Stop: </span>
            <strong className={isWithinMandate ? "text-[var(--ink)]" : "text-[var(--clay)]"}>
              −{fmtUsd(downsideLoss)}
            </strong>
          </div>
          <div className="sh-trigger-stat">
            <span className="text-[var(--sh-fg-3)]">Book Risk: </span>
            <strong className={isWithinMandate ? "text-[oklch(0.35_0.08_155)]" : "text-[var(--clay)]"}>
              {portfolioRiskPct.toFixed(2)}%
            </strong>
            <span className="text-[var(--sh-fg-3)] ml-1">(2.0% Cap)</span>
          </div>
          <div className="sh-trigger-stat">
            <span className="text-[var(--sh-fg-3)]">Asymmetry: </span>
            <strong className="text-[var(--ink)]">+3.4x R:R</strong>
          </div>
        </div>
      </div>

      {/* Interactive Scenario Toggle */}
      {!compact && (
        <div className="sh-interactive-mode-toggle" role="radiogroup" aria-label="Position Sizing Simulation">
          <button
            type="button"
            className="sh-mode-btn"
            aria-pressed={isDisciplined}
            onClick={() => setScenario("disciplined")}
          >
            Bounded Discipline (2% Cap)
          </button>
          <button
            type="button"
            className="sh-mode-btn"
            aria-pressed={!isDisciplined}
            onClick={() => setScenario("drift")}
          >
            Simulate Unbounded Drift
          </button>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex justify-between items-center text-xs pt-2 border-t border-[var(--rule)]">
        <span className="text-[var(--sh-fg-3)] text-[11px] font-mono">
          Paper Allocation & Thesis Bounds
        </span>
        <Link
          href="/walkthrough/capital-desk"
          className="inline-flex items-center gap-1.5 font-semibold text-[var(--ink)] hover:underline"
        >
          <span>Preview Capital Desk</span>
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
