import React, { useState } from "react";
import { Link } from "wouter";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  TrendingDown,
  Info,
} from "lucide-react";

interface DeductionItem {
  id: string;
  label: string;
  amount: number;
  category: string;
  detail: string;
  active: boolean;
}

const INITIAL_DEDUCTIONS: DeductionItem[] = [
  {
    id: "gm",
    label: "Replacement GM Wage",
    amount: 65000,
    category: "Unmodeled Owner Labor",
    detail: "Owner active 55 hrs/wk as operator; market GM replacement cost required.",
    active: true,
  },
  {
    id: "capex",
    label: "Deferred CapEx & Fleet",
    amount: 42000,
    category: "P&L Audit Gap",
    detail: "8 service vehicles over 140k miles; maintenance capitalized off-income.",
    active: true,
  },
  {
    id: "churn",
    label: "Churn Risk Buffer",
    amount: 35000,
    category: "Concentration Reserve",
    detail: "Top 2 enterprise accounts represent 38% of route billings without multi-year lock.",
    active: true,
  },
];

const REPORTED_SDE = 650000;
const SENIOR_DEBT_SERVICE = 380000; // $2.4M @ 10.5%, 10-year monthly amort
const MIN_DSCR_COVENANT = 1.25;

const fmtUsd = (val: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);

export function CashFlowBridgeCard({ compact = false }: { compact?: boolean }) {
  const [deductions, setDeductions] = useState<DeductionItem[]>(INITIAL_DEDUCTIONS);
  const [revenueShock, setRevenueShock] = useState(0); // 0% to -20%

  const toggleDeduction = (id: string) => {
    setDeductions(prev =>
      prev.map(item => (item.id === id ? { ...item, active: !item.active } : item))
    );
  };

  const totalDeductions = deductions
    .filter(d => d.active)
    .reduce((sum, d) => sum + d.amount, 0);

  const shockAmount = Math.round(REPORTED_SDE * (revenueShock / 100));
  const bankableFcf = Math.max(0, REPORTED_SDE - totalDeductions + shockAmount);
  const deltaPct = ((bankableFcf - REPORTED_SDE) / REPORTED_SDE) * 100;
  const dscr = bankableFcf / SENIOR_DEBT_SERVICE;
  const passesCovenant = dscr >= MIN_DSCR_COVENANT;

  return (
    <div className="sh-bridge-container">
      {/* Masthead */}
      <div className="sh-artifact-masthead">
        <div>
          <p className="sh-artifact-title">Acquisition Desk · 104-Unit Route</p>
          <h3 className="sh-artifact-subtitle">The Cash Flow Bridge</h3>
          <p className="text-[10px] text-[var(--sh-fg-3)] font-mono mt-0.5 m-0">
            Illustrative — composite 104-unit route deal, not a real customer.
          </p>
        </div>
        <span
          className={`sh-status-pill ${
            passesCovenant ? "sh-status-pill--pass" : "sh-status-pill--fail"
          }`}
        >
          {passesCovenant ? (
            <>
              <CheckCircle2 size={12} aria-hidden="true" />
              <span>Pass: {dscr.toFixed(2)}x DSCR</span>
            </>
          ) : (
            <>
              <XCircle size={12} aria-hidden="true" />
              <span>Kill: {dscr.toFixed(2)}x &lt; 1.25x</span>
            </>
          )}
        </span>
      </div>

      {/* Waterfall Rows */}
      <div className="sh-waterfall-list" role="list">
        {/* Row 0: Stated SDE */}
        <div className="sh-waterfall-row sh-waterfall-row--neutral" role="listitem">
          <div className="sh-waterfall-info">
            <span className="sh-waterfall-label">Reported Seller SDE</span>
            <span className="sh-waterfall-subtext">CIM Teaser Claim · Unreconciled</span>
          </div>
          <span className="sh-waterfall-val sh-waterfall-val--pos">
            {fmtUsd(REPORTED_SDE)}
          </span>
        </div>

        {/* Deductions */}
        {deductions.map(item => (
          <div
            key={item.id}
            className={`sh-waterfall-row ${
              item.active ? "sh-waterfall-row--deduction" : "opacity-40"
            }`}
            role="listitem"
          >
            <div className="sh-waterfall-info">
              <span className="sh-waterfall-label">
                <button
                  type="button"
                  onClick={() => toggleDeduction(item.id)}
                  className="sh-toggle-item-btn"
                  aria-pressed={item.active}
                  title={item.active ? "Exclude this adjustment" : "Apply this adjustment"}
                >
                  {item.active ? "−" : "+"}
                </button>
                {item.label}
              </span>
              <span className="sh-waterfall-subtext">[{item.category}]</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="sh-waterfall-val sh-waterfall-val--neg">
                {item.active ? `−${fmtUsd(item.amount)}` : "$0"}
              </span>
            </div>
          </div>
        ))}

        {revenueShock < 0 && (
          <div className="sh-waterfall-row sh-waterfall-row--deduction" role="listitem">
            <div className="sh-waterfall-info">
              <span className="sh-waterfall-label">
                <TrendingDown size={14} className="text-[var(--clay)]" />
                Stress Margin Compression ({revenueShock}%)
              </span>
              <span className="sh-waterfall-subtext">[Modeled Downside Shock]</span>
            </div>
            <span className="sh-waterfall-val sh-waterfall-val--neg">
              −{fmtUsd(Math.abs(shockAmount))}
            </span>
          </div>
        )}
      </div>

      {/* Result Box */}
      <div className="sh-result-box">
        <div className="sh-result-header">
          <div>
            <span className="sh-result-label">Bankable Free Cash Flow</span>
            <span className="sh-result-delta">
              (Δ {deltaPct.toFixed(1)}%)
            </span>
          </div>
          <span className="sh-result-val">{fmtUsd(bankableFcf)}</span>
        </div>

        <div className="sh-covenant-bar">
          <div className="sh-covenant-metric">
            <span className="text-[var(--sh-fg-3)]">Senior Debt Svc:</span>
            <span>{fmtUsd(SENIOR_DEBT_SERVICE)}/yr</span>
          </div>
          <div className="sh-covenant-metric">
            <span className="text-[var(--sh-fg-3)]">DSCR Coverage:</span>
            <span
              className={`sh-covenant-val ${
                passesCovenant ? "text-[oklch(0.35_0.08_155)]" : "text-[var(--clay)]"
              }`}
            >
              {dscr.toFixed(2)}x
            </span>
          </div>
        </div>

        {/* Covenant Warning / Pass Banner */}
        <div className="mt-3 text-xs leading-relaxed flex items-start gap-2">
          {passesCovenant ? (
            <p className="text-[var(--sh-fg-2)] m-0">
              <strong>Covenant Intact:</strong> Cash flow covers senior debt service with a{" "}
              {fmtUsd(bankableFcf - SENIOR_DEBT_SERVICE * MIN_DSCR_COVENANT)} cushion above bank
              threshold.
            </p>
          ) : (
            <p className="text-[var(--clay)] font-semibold m-0 flex items-center gap-1.5">
              <AlertTriangle size={14} className="shrink-0" />
              <span>
                Covenant Breach: DSCR falls below 1.25x requirement. Kill deal or restructure
                seller note before spending on QoE.
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Interactive Stress Slider */}
      {!compact && (
        <div className="sh-stress-slider-box">
          <div className="sh-stress-slider-header">
            <span>Stress Test: Top-Line Compression</span>
            <strong>{revenueShock}% Revenue Drop</strong>
          </div>
          <input
            type="range"
            min="-20"
            max="0"
            step="5"
            value={revenueShock}
            onChange={e => setRevenueShock(Number(e.target.value))}
            className="sh-stress-range-input"
            aria-label="Simulate top-line revenue drop percentage"
          />
          <div className="flex justify-between text-[10px] text-[var(--sh-fg-3)] mt-1 font-mono">
            <span>Base (0%)</span>
            <span>Mild (−10%)</span>
            <span>Severe (−20%)</span>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex justify-between items-center text-xs pt-2 border-t border-[var(--rule)]">
        <span className="text-[var(--sh-fg-3)] text-[11px] font-mono">
          Upstream of Quality of Earnings
        </span>
        <Link
          href="/walkthrough"
          className="inline-flex items-center gap-1.5 font-semibold text-[var(--ink)] hover:underline"
        >
          <span>Explore Diligence Case</span>
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
