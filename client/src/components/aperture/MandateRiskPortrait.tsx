import React, { useState } from "react";
import "@/styles/mandate-risk-portrait.css";

/** Missing, non-finite and invalid amounts never acquire a zero-width data mark. */
export function recordedRiskCents(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export const riskMoney = (value: unknown) => {
  const cents = recordedRiskCents(value);
  return cents == null ? "Not recorded" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
};

/** A shared zero baseline. Zero is a outlined marker; unknown has no data mark. */
function RiskBar({ value, maximum, label, emphasis = false }: { value: unknown; maximum: number; label: string; emphasis?: boolean }) {
  const cents = recordedRiskCents(value);
  return <div className="mrp-bar" role="img" aria-label={`${label}: ${riskMoney(value)}${cents != null ? `; scale zero to ${riskMoney(maximum)}` : ""}`}>
    {cents == null ? <span className="mrp-unknown">Not recorded — no bar drawn</span> : <svg viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden="true">
      <line x1="2" y1="12" x2="398" y2="12" className="mrp-baseline" />
      {cents === 0 ? <circle cx="4" cy="12" r="3" className="mrp-zero" /> : <rect x="2" y="6" width={maximum > 0 ? cents / maximum * 396 : 0} height="12" className={emphasis ? "mrp-fill mrp-emphasis" : "mrp-fill"} />}
    </svg>}
  </div>;
}

export function MissionRiskPortrait({ limitCents, effectiveCents }: { limitCents: unknown; effectiveCents: unknown }) {
  const limit = recordedRiskCents(limitCents);
  const effective = recordedRiskCents(effectiveCents);
  const maximum = Math.max(limit ?? 0, effective ?? 0);
  const share = limit != null && limit > 0 && effective != null ? effective / limit * 100 : null;
  return <figure className="mandate-risk-portrait" aria-label="Saved mission risk allowance comparison">
    <figcaption><span className="mrp-eyebrow">Risk allowance / saved analysis</span><h3>What the mission could risk.</h3></figcaption>
    <div className="mrp-mission-lead"><strong>{riskMoney(effective)}</strong><span>Effective planned-loss allowance<br />{share == null ? "Share of operator limit unavailable" : `${share.toLocaleString("en-US", { maximumFractionDigits: 1 })}% of operator limit`}</span></div>
    <div className="mrp-risk-row"><div><span>Operator limit</span><strong>{riskMoney(limit)}</strong></div><RiskBar value={limit} maximum={maximum} label="Operator limit" /></div>
    <div className="mrp-risk-row"><div><span>Effective at analysis</span><strong>{riskMoney(effective)}</strong></div><RiskBar value={effective} maximum={maximum} label="Effective at analysis" emphasis /></div>
    {maximum > 0 && <div className="mrp-axis" aria-hidden="true"><span>$0</span><span>{riskMoney(maximum)} · planned loss</span></div>}
    <p className="mrp-caption">Saved allowance, not current headroom or permission to trade.</p>
    {limit != null && effective != null && effective > limit && <p className="mrp-warning">Saved allowance exceeds the operator limit. Reconcile this record before proceeding.</p>}
    <details><summary>Read the boundary</summary><p>The difference between these bars is not measured risk used. Other limits can reduce a play’s allowance. Missing amounts remain unknown; a hollow marker means a recorded zero. Fresh checks and human approval still apply.</p></details>
  </figure>;
}

const HORIZONS = [
  ["intraday", "Today"], ["overnight", "Next close"], ["swing", "Swing"],
  ["catalyst_window", "Catalyst"], ["position", "Position"], ["unknown", "Not set"],
] as const;
export type RiskComparisonThesis = {
  id: number; name?: string | null; sourceCompilationId?: number | null; isPrimary?: boolean;
  missionDefaults?: { maxPlannedLossCents?: number | null; holdingPeriod?: string | null } | null;
};
export function thesisHorizonKey(value: unknown): string {
  return HORIZONS.some(([key]) => key !== "unknown" && key === value) ? String(value) : "unknown";
}

export function ThesisRiskComparison({ theses, activeCompilationId, onReview }: { theses: RiskComparisonThesis[]; activeCompilationId?: number | null; onReview: (id: number) => void }) {
  const [horizon, setHorizon] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const maximum = Math.max(0, ...theses.map(t => recordedRiskCents(t.missionDefaults?.maxPlannedLossCents) ?? 0));
  const counts = HORIZONS.map(([key, label]) => ({ key, label, count: theses.filter(t => thesisHorizonKey(t.missionDefaults?.holdingPeriod) === key).length }));
  const visible = horizon === "all" ? theses : theses.filter(t => thesisHorizonKey(t.missionDefaults?.holdingPeriod) === horizon);
  const shown = expanded ? visible : visible.slice(0, 6);
  const unknown = theses.filter(t => recordedRiskCents(t.missionDefaults?.maxPlannedLossCents) == null).length;
  return <section className="mandate-risk-portrait" aria-label="Thesis mandate comparison">
    <header><span className="mrp-eyebrow">Compare the mandates</span><h2>Different horizons. Different limits.</h2><p className="mrp-caption">{theses.length} theses in this library view · {unknown} without a recorded planned-loss limit</p></header>
    <div className="mrp-horizons" role="group" aria-label="Filter comparison by holding period">
      {counts.map(({ key, label, count }) => <button key={key} type="button" aria-pressed={horizon === key} onClick={() => { setHorizon(horizon === key ? "all" : key); setExpanded(false); }}>
        <span>{label}</span><strong>{count}</strong><span className="mrp-count-track" aria-hidden="true"><span style={{ width: `${theses.length ? count / theses.length * 100 : 0}%` }} /></span>
      </button>)}
    </div>
    <p className="mrp-caption">Bars show thesis counts, not duration. Select a horizon to narrow this comparison.</p>
    {horizon !== "all" && <button className="mrp-link" type="button" onClick={() => { setHorizon("all"); setExpanded(false); }}>Show every horizon</button>}
    <div className="mrp-comparison-heading"><span>Planned-loss limit / play</span><span>{maximum > 0 ? `$0 — ${riskMoney(maximum)}` : "No positive limit recorded"}</span></div>
    {shown.map(thesis => {
      const key = thesisHorizonKey(thesis.missionDefaults?.holdingPeriod);
      const active = (activeCompilationId != null && thesis.sourceCompilationId === activeCompilationId) || thesis.isPrimary;
      return <div key={thesis.id} className="mrp-comparison-row">
        <button type="button" className="mrp-review" onClick={() => onReview(thesis.id)}><span>{thesis.name || "Untitled Capital thesis"}{active && <small> · active context</small>}</span><span aria-hidden="true">↗</span></button>
        <div className="mrp-risk-row"><div><span>{HORIZONS.find(([id]) => id === key)?.[1]}</span><strong>{riskMoney(thesis.missionDefaults?.maxPlannedLossCents)}</strong></div><RiskBar value={thesis.missionDefaults?.maxPlannedLossCents} maximum={maximum} label={`${thesis.name || "Untitled Capital thesis"} planned-loss limit`} emphasis={!!active} /></div>
      </div>;
    })}
    {!visible.length && <p className="mrp-caption">No theses in this holding-period category.</p>}
    {visible.length > 6 && <button className="mrp-link" type="button" onClick={() => setExpanded(!expanded)}>{expanded ? "Show first 6" : `Compare all ${visible.length} theses`}</button>}
    <details><summary>How to read this comparison</summary><p>Every amount shares one zero-based scale across this library view. These are saved per-play limits, not portfolio exposure, available capacity or additive allocations. Horizon categories are not expiry dates. Opening a thesis does not activate it or place an order.</p></details>
  </section>;
}
