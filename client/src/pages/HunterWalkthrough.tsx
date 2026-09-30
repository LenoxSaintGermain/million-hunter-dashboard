import React, { useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowLeft, RotateCcw } from "lucide-react";
import { AlignmentPortrait } from "@/components/AlignmentPortrait";
import { HunterPublicShell } from "@/components/HunterPublicShell";
import { HUNTER_EXAMPLE, walkthroughMeasures, walkthroughModel, type HunterJourney } from "@shared/hunterWalkthrough";

const chapters = ["Your thesis", "The evidence", "Pressure test", "Next decision"];
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export default function HunterWalkthrough() {
  const [path, setPath] = useState<HunterJourney>("asset");
  const [step, setStep] = useState(0);
  const [focus, setFocus] = useState<"portrait" | "reasoning">("portrait");
  const [changes, setChanges] = useState({ asset: -20, capital: -10 });
  const heading = useRef<HTMLHeadingElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const change = changes[path];
  const model = walkthroughModel(path, change);
  const asset = path === "asset";
  const go = (next: number) => { const bounded = Math.max(0, Math.min(3, next)); setStep(bounded); requestAnimationFrame(() => { if (heading.current?.offsetParent) heading.current.focus({ preventScroll: true }); else document.querySelector<HTMLButtonElement>(`.hunter-step-nav button:nth-child(${bounded + 1})`)?.focus({ preventScroll: true }); }); };
  const headlines = asset ? ["The price fits. Does the business?", "Reported cash is the start of a question.", "Move the cash. Watch the cushion.", "A reason to investigate. Not a reason to skip evidence."] : ["An idea needs a risk boundary.", "A price is not a thesis.", "Move the price. See the exposure.", "A paper review. Not an order."];
  const bodies = asset ? ["A business can fit your price range and still miss your operating thesis. Start with the numbers; reveal the conditions beneath them.", "The composite reports $720k SDE, including $223k of add-backs. Removing all of those add-backs would leave $497k before other adjustments—not an independently verified earnings figure.", "Keep debt fixed while changing the cash-flow assumption. Taxes, reserves, working capital and capital expenditure still sit outside this calculation.", "Reconcile the add-backs, examine customer contracts, and cost a manager to replace the owner's work. The unresolved conditions remain unresolved at every slider setting."] : ["Set an allocation, then ask what would make the idea wrong. This example uses a hypothetical security—not a market recommendation.", "Ten shares at $100 says what you might allocate. It says nothing about demand, valuation or earnings. Those need their own sources.", "Change only the price assumption. Fees, taxes and dividends are excluded. A planned loss threshold does not guarantee an exit price.", "No account is connected and no order exists. A real paper workflow still requires fresh evidence, exposure checks and explicit human submission."];
  return <HunterPublicShell><main className="hunter-public-main hunter-walkthrough" data-reader-focus={focus}>
    <p className="hunter-eyebrow">Interactive example / no agents running</p>
    <div className="hunter-paths" aria-label="Choose a workflow">{(["asset", "capital"] as const).map(p => <button key={p} aria-pressed={path === p} onClick={() => { setPath(p); go(0); }}>{p === "asset" ? "Acquire a business" : "Explore capital · paper only"}</button>)}</div>
    <nav className="hunter-step-nav" aria-label="Walkthrough chapters">{chapters.map((label, i) => <button key={label} aria-current={step === i ? "step" : undefined} onClick={() => go(i)}>{String(i + 1).padStart(2, "0")} / {label}</button>)}</nav>
    <div className="hunter-reader-switch" aria-label="Reader focus"><button aria-pressed={focus === "portrait"} onClick={() => setFocus("portrait")}>The portrait</button><button aria-pressed={focus === "reasoning"} onClick={() => setFocus("reasoning")}>{step >= 2 ? "Move the lever" : "Read the reasoning"}</button></div>
    <section className="hunter-stage" onTouchStart={e => { if ((e.target as HTMLElement).closest("button,input,a,summary")) return; touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }} onTouchEnd={e => { if (!touch.current) return; const dx = e.changedTouches[0].clientX - touch.current.x, dy = e.changedTouches[0].clientY - touch.current.y; touch.current = null; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(step + (dx < 0 ? 1 : -1)); }}>
      <div className="hunter-spread"><div><p className="hunter-eyebrow">{step + 1} / 4 · {chapters[step]}</p><h1 ref={heading} tabIndex={-1}>{headlines[step]}</h1><p className="hunter-lead">{bodies[step]}</p>
        {step >= 2 && <div className="hunter-worksheet"><label htmlFor="scenario-change">{asset ? "Cash-flow" : "Price"} change: <strong>{change}%</strong></label><input id="scenario-change" type="range" min="-80" max="30" step="5" value={change} onChange={e => setChanges({ ...changes, [path]: Number(e.target.value) })} /><output htmlFor="scenario-change">{asset ? `${model.coverage.toFixed(2)}×` : money(model.pnl)}</output><p>{asset ? "Modeled debt coverage" : "Modeled profit / loss"}</p></div>}
        <details className="mt-5 border-t border-rule py-2"><summary>Follow the calculation & source</summary><p className="text-sm leading-6">{asset ? `Sanctioned composite fixture GT-001: ${money(HUNTER_EXAMPLE.asking)} asking; ${money(HUNTER_EXAMPLE.cash)} stated SDE. Illustrative debt: 70% financed, 10% fixed annual rate, 10-year monthly amortization. Annual payments ${money(model.debt)}. Coverage = scenario SDE / annual debt service; not lender approval.` : "Synthetic equity fixture: 10 shares × $100 = $1,000. P/L = $1,000 × price-change percentage. No real ticker, quote, forecast or account."}</p></details>
        {step === 3 && <Link className="hunter-cta mt-4" href="/#request-access">Discuss your own thesis <ArrowRight size={16} /></Link>}
      </div><AlignmentPortrait key={path} title={asset ? HUNTER_EXAMPLE.name : "The bounded capital idea"} subtitle="Illustrative — composite example, not a real customer" measures={walkthroughMeasures(path, step >= 2 ? change : 0)} /></div>
    </section>
    <div className="hunter-stage-footer"><button className="inline-flex items-center gap-2" disabled={step === 0} onClick={() => go(step - 1)}><ArrowLeft size={16} />Back</button><button className="inline-flex items-center gap-2 text-sm" onClick={() => { setChanges({ asset: -20, capital: -10 }); go(0); }}><RotateCcw size={14} />Reset</button><button className="hunter-cta" disabled={step === 3} onClick={() => go(step + 1)}>Next <ArrowRight size={16} /></button></div>
    <p className="text-xs mt-5 text-muted-foreground">Illustrative — composite example, not a real customer. Local calculations only. Nothing sent, saved, approved or ordered.</p>
    <Link href="/walkthrough/capital-desk" className="hunter-cta mt-5">Preview the Capital reading desk <ArrowRight size={16} /></Link>
  </main></HunterPublicShell>;
}
