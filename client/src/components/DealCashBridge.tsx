import React, { useId, useState } from "react";
import { modelAcquisitionFinancing } from "@shared/acquisitionFinancing";
import "@/styles/decision-graphics.css";

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
export function cashBridge(asking: number | null, cash: number | null, adjustment: string) {
  const financing = modelAcquisitionFinancing(asking, cash);
  if (!financing || cash == null || !Number.isFinite(cash)) return null;
  const cost = adjustment.trim() === "" ? null : Number(adjustment);
  const valid = cost != null && Number.isFinite(cost) && cost >= 0;
  const subtotal = cash - financing.annualDebtService;
  return { cash, debt: financing.annualDebtService, subtotal, cost: valid ? cost : null, remaining: valid ? subtotal - cost! : null };
}

/** Local arithmetic only. Neither saves a valuation nor changes a verdict. */
export function DealCashBridge({ asking, cash, composite = false }: { asking: number | null; cash: number | null; composite?: boolean }) {
  const id = useId();
  const [cost, setCost] = useState("");
  const [selected, setSelected] = useState(0);
  const model = cashBridge(asking, cash, cost);
  const rows = model ? [
    { label: "Reported cash flow", value: model.cash, from: 0, to: model.cash, note: "Seller claim. Add-backs and underlying accounts have not been reconciled.", tone: "ink" },
    { label: "Modeled debt", value: -model.debt, from: model.cash, to: model.subtotal, note: "90% financing, 11.5% annual interest, ten-year amortization. Not lender terms or approval.", tone: "cost" },
    { label: "Before other costs", value: model.subtotal, from: 0, to: model.subtotal, note: "A subtotal, not take-home cash. Owner replacement, reserves, fees, working capital and taxes are not included.", tone: "ink" },
    ...(model.remaining != null ? [{ label: "After your costs", value: model.remaining, from: 0, to: model.remaining, note: "Local scenario after the annual costs you entered. Any excluded obligations remain unresolved; this is not a valuation.", tone: "result" }] : []),
  ] : [];
  const low = Math.min(0, ...rows.flatMap(r => [r.from, r.to]));
  const high = Math.max(1, ...rows.flatMap(r => [r.from, r.to]));
  const y = (n: number) => 190 - (n - low) / (high - low) * 164;
  const focus = rows[Math.min(selected, rows.length - 1)];
  return <section className="decision-graphic" aria-labelledby={`${id}-title`}>
    <header><p className="hunter-eyebrow">The cash bridge / annual USD</p><h3 id={`${id}-title`}>What survives the first subtraction?</h3><p>{composite ? "Illustrative composite · " : "Saved seller claims · "}modeled financing, not verified cash.</p></header>
    {model ? <>
      <svg viewBox="0 0 560 216" role="img" aria-label={`Cash waterfall: ${rows.map(r => `${r.label} ${usd(r.value)}`).join('; ')}`}>
        <line x1="12" x2="548" y1={y(0)} y2={y(0)} className="graphic-zero" />
        {rows.map((r, i) => {
          const x = 26 + i * 134;
          return <g key={r.label} className={`graphic-column graphic-${r.tone}`} opacity={selected === i ? 1 : .65}>
            <rect x={x} y={Math.min(y(r.from), y(r.to))} width="96" height={Math.max(2, Math.abs(y(r.from) - y(r.to)))} style={r.tone === "result" && r.value < 0 ? { fill: "var(--sh-destructive)" } : undefined} />
            <text x={x + 48} y="210" textAnchor="middle">0{i + 1}</text>
            {i < rows.length - 1 && <line x1={x + 96} x2={x + 134} y1={y(r.to)} y2={y(r.to)} className="graphic-connector" />}
          </g>;
        })}
      </svg>
      <div className="graphic-legend">{rows.map((r, i) => <button type="button" key={r.label} aria-pressed={selected === i} onClick={() => setSelected(i)}><small>0{i + 1} / {r.label}</small><strong>{usd(r.value)}</strong></button>)}</div>
      <p className="graphic-reading" aria-live="polite">{focus?.note}</p>
      <details className="graphic-scenario"><summary>Pencil in the next subtraction</summary>
        <label htmlFor={`${id}-cost`}>Additional annual costs · USD</label>
        <input id={`${id}-cost`} type="number" min="0" step="1000" inputMode="decimal" placeholder="Unknown — enter an amount" value={cost} onChange={e => setCost(e.target.value)} />
        <p>Include owner replacement and reserves. Enter zero only if deliberately excluded. Changes stay on this screen.</p>
        <output aria-live="polite">{model.remaining == null ? "Additional costs unresolved — no final cash estimate." : `${usd(model.remaining)} after entered costs, before any excluded obligations.`}</output>
      </details>
    </> : <div className="graphic-gap"><span aria-hidden="true">— · — · —</span><h4>The bridge needs two anchors.</h4><p>Record an asking price and annual cash flow to model debt service. Unknown figures are not zero.</p></div>}
  </section>;
}
