import React, { useState } from "react";
import type { PortraitHolding } from "./PortfolioPortrait";
import "@/styles/holdings-composition.css";

export function holdingSlices(holdings: PortraitHolding[]) {
  const measured = holdings.filter(h => h.marketValueCents != null && Number.isFinite(h.marketValueCents));
  const gross = measured.reduce((sum, h) => sum + Math.abs(h.marketValueCents!), 0);
  const sorted = [...measured].sort((a,b) => Math.abs(b.marketValueCents!) - Math.abs(a.marketValueCents!));
  const top = sorted.slice(0,4).map(h => ({ label: h.symbol, value: Math.abs(h.marketValueCents!) }));
  if (sorted.length > 4) top.push({ label: `Other ${sorted.length - 4} holdings`, value: sorted.slice(4).reduce((s,h) => s + Math.abs(h.marketValueCents!),0) });
  let offset = 0;
  return { gross, missing: holdings.length - measured.length, slices: top.map(h => { const share = gross > 0 ? h.value/gross*100 : 0; const row = {...h, share, offset}; offset += share; return row; }) };
}
export function HoldingsComposition({ holdings }: { holdings: PortraitHolding[] }) {
  const [selected,setSelected] = useState(0);
  const { slices,gross,missing } = holdingSlices(holdings);
  const current = slices[Math.min(selected,slices.length-1)];
  const money = (n:number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n/100);
  return <figure className="holdings-composition" aria-label="Composition of measured gross holdings">
    <div className="composition-dial"><svg viewBox="0 0 120 120" role="img" aria-label={gross > 0 ? slices.map(s=>`${s.label}: ${s.share.toFixed(1)}%`).join('; ') : "No positive measured gross holdings"}>
      <circle cx="60" cy="60" r="46" fill="none" stroke="var(--sh-border)" strokeWidth="14" />
      {gross > 0 && slices.map((s,i)=><circle key={s.label} cx="60" cy="60" r="46" pathLength="100" fill="none" stroke={i === selected ? 'var(--sh-amber)' : 'var(--sh-fg-1)'} opacity={i === selected ? 1 : .25 + i*.14} strokeWidth="14" strokeDasharray={`${Math.max(0,s.share-.8)} ${100-Math.max(0,s.share-.8)}`} strokeDashoffset={-s.offset} transform="rotate(-90 60 60)" />)}
    </svg><div><strong>{gross > 0 ? `${current?.share.toFixed(1)}%` : '—'}</strong><span>{gross > 0 ? 'of measured gross' : 'No measured share'}</span></div></div>
    <figcaption><p className="hunter-eyebrow">The concentration picture</p><p className="composition-focus" aria-live="polite">{gross > 0 ? `${current?.label} · ${money(current?.value ?? 0)}` : 'Exposure cannot be drawn yet.'}</p>
      <div className="composition-select">{gross > 0 && slices.map((s,i)=><button key={s.label} type="button" aria-pressed={selected===i} onClick={()=>setSelected(i)}>{s.label}<span>{s.share.toFixed(1)}%</span></button>)}</div>
      <small>Saved absolute market values · cash excluded · {missing} unmeasured. Not risk contribution.</small>
    </figcaption>
  </figure>;
}
