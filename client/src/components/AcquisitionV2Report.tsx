import React, { useId, useState } from "react";
import { trpc } from "@/lib/trpc";
import { simulateAcquisitionV2, exampleGamePriors, type WaterfallCosts } from "@shared/acquisitionGameTheory";
import type { evaluateAcquisitionV2 } from "@shared/acquisitionV2";
import "@/styles/acquisition-v2-editorial.css";

type Report = ReturnType<typeof evaluateAcquisitionV2>;
type FieldKey = keyof Report["fields"];
const money = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fieldNames: Record<FieldKey, string> = { ask: "Asking price", revenue: "Annual revenue", sde: "Seller’s discretionary earnings", ebitda: "EBITDA", inventory: "Inventory", ffe: "Furniture & equipment" };
const gateNames: Record<string, string> = { GEO: "Geography", G1: "Price discipline", G2: "Earnings floor", G3: "Operating margin", G4: "Financing & coverage", G5: "Management continuity", G6: "Listing availability", G7: "Watchlist eligibility", G10: "Customer concentration", G11: "Revenue durability", G12: "Precision of the evidence" };
const stateNames: Record<string, string> = { pass: "Cleared", fail: "Outside mandate", cap: "Watchlist ceiling", unknown: "Evidence needed", value: "Source reported", not_disclosed: "Not disclosed", on_request: "Available on request", extraction_failed: "Could not extract", approximate: "Approximate claim", conflicting: "Conflicting claims" };
const costRows = [["ownerReplacement", "Replace the owner", "Salary and employer costs"], ["marketRent", "Normalize the rent", "Annual adjustment—not rent already expensed"], ["capexReserve", "Keep the assets working", "Annual capital expenditure reserve"], ["qualifierFee", "Retain the license", "Annual qualifier cost"], ["investorReturn", "Pay the preferred return", "Annual investor distribution"]] as const;
const costGuidance: Record<keyof WaterfallCosts, string> = {
  ownerReplacement: "Which owner duties need replacing? Include salary, payroll costs and benefits. Check what is already expensed before subtracting again.",
  marketRent: "Compare the existing lease with a supported market rent. Enter only the annual adjustment, not the full rent already in expenses.",
  capexReserve: "Ask for the equipment register, age and maintenance history. A reserve needs a replacement plan, not a percentage chosen to make the deal work.",
  qualifierFee: "Does a license depend on the departing owner? Verify transfer rules and the cost of a replacement qualifier before excluding this line.",
  investorReturn: "Use the proposed annual preferred distribution. This worksheet does not model a complete investor waterfall or taxes.",
};

export function financialReading(report: Report, selected: FieldKey) {
  const exact = (key: FieldKey) => report.fields[key].state === "value" ? report.fields[key].value : null;
  const ask = exact("ask"), sde = exact("sde"), revenue = exact("revenue");
  if (exact(selected) == null) return { title: "The missing number is the story.", metric: "Unresolved", label: stateNames[report.fields[selected].state], meaning: "No exact, consistent claim is available for this measure. A comparison would imply precision we do not have.", question: `Request the underlying ${fieldNames[selected].toLowerCase()} record and reconcile it to the listing.` };
  if (selected === "ask") {
    const inside = ask! >= report.mandate.priceMin && ask! <= report.mandate.priceMax;
    return { title: inside ? "Price fits. Value is still unproven." : "Price sits outside your boundary.", metric: sde != null && sde > 0 ? `${(ask! / sde).toFixed(2)}×` : "Unresolved", label: "Price / claimed annual SDE", meaning: inside ? "Inside your price band—not evidence of a bargain. The multiple depends on earnings surviving diligence." : "The captured ask is outside your mandate. The earnings multiple does not override that boundary.", question: "What is included in the price—property, inventory, equipment or working capital—and which earnings add-backs survive?" };
  }
  if (selected === "sde") {
    const delta = sde! - report.mandate.sdeMin;
    return { title: delta >= 0 ? "How much earnings can disappear?" : "Earnings miss the pursue floor.", metric: money(Math.abs(delta)), label: delta >= 0 ? "Above your annual SDE floor" : "Below your annual SDE floor", meaning: delta >= 0 ? "This is the claimed cushion before the pursue floor is lost. Owner replacement, rent and capital needs still affect take-home cash." : "The captured earnings do not reach your pursue threshold. Other gates still determine whether this belongs on a watchlist.", question: "Can tax returns and an itemized add-back schedule support this SDE—and which owner duties must be replaced?" };
  }
  return { title: "Revenue is scale. Retention is the test.", metric: sde != null && revenue != null && revenue > 0 ? `${(sde / revenue * 100).toFixed(1)}%` : "Unresolved", label: "Claimed SDE / annual revenue", meaning: `Your margin floor is ${(report.mandate.marginMin * 100).toFixed(1)}%. This ratio is not a net-profit margin or proof that customers will stay.`, question: "How much revenue is contracted, concentrated or tied to the seller? Request customer-level sales and renewal terms." };
}

function FinancialMargin({ report, selected, stale, id }: { report: Report; selected: FieldKey; stale: boolean; id: string }) {
  const reading = financialReading(report, selected);
  const focused = report.fields[selected];
  return <aside className="v2-margin v2-source-margin" id={id} aria-live="polite">
    <span className="v2-kicker">The analytical margin / {fieldNames[selected]}</span>
    <div key={selected} className="v2-soft-reveal">
      <h4>{reading.title}</h4>
      <div className="v2-margin-stat"><strong>{reading.metric}</strong><small>{reading.label}</small></div>
      <p>{reading.meaning}</p>
      <div className="v2-margin-question"><span className="v2-kicker">Test the claim</span><p>{reading.question}</p></div>
      <details className="v2-note-disclosure"><summary>Source & calculation ↗</summary>
        <span className="v2-source-state">{stateNames[focused.state]}</span>
        <blockquote>{focused.span || "No source span captured. Request the underlying record."}</blockquote>
        <p>{selected === "ask" ? report.ratios.multiple?.formula : selected === "revenue" ? report.ratios.sdeMargin?.formula : focused.state === "value" ? `${focused.value} − ${report.mandate.sdeMin} = claimed SDE less pursue floor` : "Exact SDE required."}</p>
        <p>Captured {new Date(report.source.fetchedAt).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric"})} · not a fresh availability check.</p>
        <p className="v2-version">Mandate {report.mandateVersion}</p>
      </details>
    </div>
    {stale && <p role="alert" className="v2-stale">This evidence is stale. Recheck the listing.</p>}
    <small className="v2-reading-disclaimer">Calculated from captured claims. Diligence prompts—not a new agent assessment.</small>
  </aside>;
}

function GateMap({ report }: { report: Report }) {
  const [selected, setSelected] = useState<string | null>(null);
  const id = useId();
  const focused = report.gates.find(g => g.id === selected) ?? report.gates.find(g => g.result !== "pass");
  const counts = (["pass", "unknown", "fail", "cap"] as const).map(state => ({ state, count: report.gates.filter(g => g.result === state).length }));
  return <div className="v2-gate-map">
    <div className="v2-check-overview" aria-label="Rule check status breakdown">
      <div className="v2-check-tally">{counts.filter(c => c.count > 0).map(c => <span key={c.state} data-result={c.state}><strong>{c.count}</strong>{stateNames[c.state]}</span>)}<span data-result="unavailable"><strong>{report.disabledDetectors.length}</strong>Unavailable detectors</span></div>
      <div className="v2-check-strip" aria-hidden="true">{report.gates.map(g => <i key={g.id} data-result={g.result}/>)}{report.disabledDetectors.map(d => <i key={d.id} data-result="unavailable"/>)}</div>
      <small>Rule outcomes—not a quality score. Unavailable detectors have not run.</small>
    </div>
    <p className="v2-map-guide">Select a check. Read its basis.</p>
    <div className="v2-gate-tiles" aria-label="Screening checks">{report.gates.map(g => <button type="button" key={g.id} data-result={g.result} aria-pressed={focused?.id === g.id} aria-controls={`${id}-detail`} onClick={() => setSelected(g.id)}><span className="v2-tile-top"><span>{g.id}</span><span aria-hidden="true">{g.result === "pass" ? "✓" : g.result === "fail" ? "×" : g.result === "cap" ? "↔" : "○"}</span></span><strong>{gateNames[g.id] || g.id}</strong><small>{stateNames[g.result] || g.result}</small></button>)}</div>
    <div id={`${id}-detail`} aria-live="polite">{focused && <div className="v2-gate-focus" data-result={focused.result}><div key={focused.id} className="v2-soft-reveal"><span className="v2-kicker">{focused.id} / {stateNames[focused.result] || focused.result}</span><h5>{gateNames[focused.id] || focused.id}</h5><p>{focused.detail}</p></div></div>}</div>
  </div>;
}

function Scenario({ report }: { report: Report }) {
  const [costs, setCosts] = useState<WaterfallCosts>({ ownerReplacement: null, marketRent: null, capexReserve: null, qualifierFee: null, investorReturn: null });
  const [accepted, setAccepted] = useState(false);
  const [editing, setEditing] = useState<keyof WaterfallCosts>("ownerReplacement");
  const updateCost = (key: keyof WaterfallCosts, value: number | null) => { setCosts(previous => ({ ...previous, [key]: value })); setAccepted(false); setEditing(key); };
  const ask = report.fields.ask.state === "value" ? report.fields.ask.value : null;
  const sde = report.fields.sde.state === "value" ? report.fields.sde.value : null;
  const missing = Object.values(costs).filter(v => v == null || !Number.isFinite(v) || v < 0).length;
  const entered = Object.values(costs).reduce<number>((sum, v) => sum + (v != null && Number.isFinite(v) && v >= 0 ? v : 0), 0);
  const beforeCosts = sde != null && report.financing.annualDebtService != null ? sde - report.financing.annualDebtService : null;
  let result: ReturnType<typeof simulateAcquisitionV2> | null = null;
  if (accepted && ask && sde) { try { result = simulateAcquisitionV2({ ask, sde, mandate: report.mandate, costs, flags: report.redFlags.map(f => f.id), priors: exampleGamePriors }); } catch { /* Unknown costs never become zero. */ } }
  return <section className="v2-cash-chapter" aria-label="Cash scenario">
    <header className="v2-chapter-heading"><span className="v2-kicker">02 / Pencil the economics</span><h3>The asking price is only<br/>the first subtraction.</h3><p>What could remain after the business pays for its next owner?</p></header>
    {!ask || !sde ? <p className="v2-margin-note">An exact asking price and SDE are needed before we can pencil this ledger.</p> : <div className="v2-spread">
      <div className="v2-ledger">
        <div className="v2-ledger-head"><span>Annual cash worksheet</span><span>USD / pre-tax</span></div>
        <div className="v2-ledger-opening"><span>Start with reported SDE<small>Seller claim · not reconciled earnings</small></span><strong>{money(sde)}</strong></div>
        <div className="v2-debt-line"><span>Less modeled debt service<small>Confirmed mandate assumptions</small></span><span>{report.financing.annualDebtService == null ? "Not calculated" : money(report.financing.annualDebtService)}</span></div>
        {costRows.map(([key,label,hint],i) => <label className="v2-ledger-entry" data-entered={costs[key] != null && Number.isFinite(costs[key]) && costs[key]! >= 0} key={key}><span className="v2-ledger-number">0{i+1}</span><span>{label}<small>{hint}</small></span><span className="v2-pencil-amount"><span aria-hidden="true">− $</span><input aria-label={`${label} annual dollars`} type="number" min="0" value={costs[key] ?? ""} placeholder="Pencil in" onFocus={() => setEditing(key)} onChange={e => updateCost(key, e.target.value === "" ? null : Number(e.target.value))} /></span></label>)}
        <div className="v2-cost-progress" aria-live="polite"><div><span>{5-missing}/5 costs entered</span><strong>{money(entered)} / year entered</strong></div><div className="v2-cost-steps" aria-hidden="true">{costRows.map(([key]) => <i key={key} data-complete={costs[key] != null && Number.isFinite(costs[key]) && costs[key]! >= 0}/>)}</div><p>{missing ? "Incomplete subtotal. Blank costs are still unknown." : "All lines entered. Review the assumptions to reveal the comparison."}</p>{beforeCosts != null && entered > beforeCosts && <p className="v2-stale">Entered costs exceed reported SDE after modeled debt service by {money(entered-beforeCosts)}. Check the assumptions; no positive distributable cash is implied.</p>}</div>
        <div className="v2-ledger-total" aria-live="polite"><span>Distributable cash<small>Modeled annual amount · pre-tax</small></span>{result ? <strong>{money(result.waterfall.distributable)}</strong> : <em>{missing ? `${missing} ${missing === 1 ? "assumption" : "assumptions"} to resolve` : "Review to reveal"}</em>}</div>
      </div>
      <aside className="v2-margin"><span className="v2-kicker">In the margin</span><h4>Don’t confuse<br/>SDE with take-home.</h4><p>Every line needs an amount. Enter zero only when you have deliberately excluded that cost—not because it is unknown.</p><p>This is a local worksheet. It does not save a valuation or change the screening verdict.</p>
        <div className="v2-cost-coach"><div key={editing} className="v2-soft-reveal"><span className="v2-kicker">At your pencil</span><h5>{costRows.find(([key]) => key === editing)?.[1]}</h5><p>{costGuidance[editing]}</p></div><button type="button" onClick={() => updateCost(editing, 0)}>Exclude this cost · $0</button><small>Explicit local assumption—not a finding that this cost is absent.</small></div>
        <details className="v2-note-disclosure"><summary>Read the scenario assumptions ↗</summary><p>Example priors: clean 60%, haircut 20%, hold-up 12%, collapse 8%, before risk shifts. Haircut: 15% of SDE; hold-up loss: 25%. Hypothetical protections halve hold-up and collapse probability and reprice half the haircut cases.</p><p>Version {exampleGamePriors.version}. Judgment-based priors—not a statistical forecast. Collapse means zero distributable cash, not zero loss of invested capital.</p></details>
        <label className="v2-approval"><input type="checkbox" checked={accepted} disabled={missing > 0} onChange={e => setAccepted(e.target.checked)} /><span>I have reviewed these costs and the example priors.<small>Reveal the hypothetical comparison. Editing a figure clears this approval.</small></span></label>
      </aside>
    </div>}
    {result && <div className="v2-scenario-result" aria-live="polite"><span className="v2-kicker">A counterfactual, not a promise</span><h4>What if the protections held?</h4><div className="v2-result-measures"><p>Unprotected expected cash<strong>{money(result.evUnprotected)}</strong></p><span aria-hidden="true">→</span><p>Hypothetically protected<strong>{money(result.evProtected)}</strong></p></div><p>The modeled difference is {money(result.difference)}. No executed agreement or proven probability reduction is assumed. This is neither guaranteed savings nor an expected investment return.</p><details><summary>Follow the arithmetic ↗</summary><div className="v2-audit-grid">{Object.entries(result.waterfall).map(([k,v]) => <p key={k}>{k.replace(/([A-Z])/g," $1")}<strong>{money(v)}</strong></p>)}</div>{result.states.map(s => <p key={s.id}>{s.id.replaceAll("_"," ")}: {money(s.cash)} · {(s.unprotected*100).toFixed(1)}% → {(s.protected*100).toFixed(1)}%</p>)}</details></div>}
  </section>;
}

function Reading({ report, stale, number }: { report: Report; stale: boolean; number: number }) {
  const [selected, setSelected] = useState<FieldKey>("ask");
  const id = useId();
  const value = (key: FieldKey) => report.fields[key].state === "value" && report.fields[key].value != null ? money(report.fields[key].value!) : stateNames[report.fields[key].state];
  const heading = report.excluded ? "This listing leaves the shortlist." : ({ PURSUE: "The screen clears.\nThe work begins.", HOLD: "The story has gaps.\nKeep the decision open.", FAIL: "This one falls outside\nthe mandate.", WATCHLIST: "Worth watching.\nNot yet a clear case." }[report.verdict.value]);
  const passed = report.gates.filter(g => g.result === "pass").length;
  return <article className="v2-reading">
    <div className="v2-article-meta"><span>Field note {String(number).padStart(2,"0")}</span><a href={report.source.url} target="_blank" rel="noopener noreferrer">Original listing ↗</a></div>
    <div className="v2-spread v2-lead-spread">
      <div><span className="v2-verdict" data-verdict={report.verdict.value}>{report.excluded ? "Excluded" : report.verdict.value} / screening only</span><h3 className="v2-story-headline">{heading}</h3><p className="v2-deck">{report.verdict.reason} The captured claims are not independently verified finances.</p>
        <div className="v2-portrait" aria-label="Reported financial portrait"><div className="v2-portrait-label"><span>Thesis × reported reality</span><span>Tap a figure ↗</span></div><div className="v2-portrait-measures">{(["ask","sde","revenue"] as const).map(k => <button key={k} type="button" aria-pressed={selected === k} aria-controls={`${id}-source`} onClick={() => setSelected(k)}><span>{fieldNames[k]}</span><strong data-unresolved={report.fields[k].state !== "value"}>{value(k)}</strong><small>{k === "ask" ? `Mandate ${money(report.mandate.priceMin)}–${money(report.mandate.priceMax)}` : k === "sde" ? `Pursue floor ${money(report.mandate.sdeMin)}` : "A source claim, not audited revenue"}</small></button>)}</div></div>
        <p className="v2-readout">{report.ratios.multiple ? <><strong>{report.ratios.multiple.value.toFixed(2)}×</strong> asking price / reported SDE</> : "Multiple unresolved"}<span> · </span>{passed} of {report.gates.length} rule checks cleared. <a href={`#${id}-gates`}>Read the basis ↓</a></p>
      </div>
      <FinancialMargin report={report} selected={selected} stale={stale} id={`${id}-source`}/>
    </div>
    <section className="v2-basis" id={`${id}-gates`}><div className="v2-section-label"><span className="v2-kicker">01 / Read the case</span><span>Code computes. You decide.</span></div><div className="v2-spread">
      <div><h4 className="v2-section-title">Behind the verdict.</h4><GateMap report={report}/><details className="v2-gate-index"><summary>Full rulebook <span>{passed}/{report.gates.length} cleared ↗</span></summary><div>{report.gates.map(g => <details className="v2-gate" key={g.id}><summary><span className="v2-gate-id">{g.id}</span><span>{gateNames[g.id] || g.id}</span><small data-result={g.result}>{stateNames[g.result] || g.result}</small></summary><p>{g.detail}</p></details>)}</div></details>
        <details className="v2-note-disclosure"><summary>Financial sourcebook & formulas ↗</summary><div className="v2-formulas">{Object.entries(report.ratios).map(([k,r]) => <p key={k}><strong>{k === "sdeMargin" ? "SDE margin" : k === "dscr" ? "Modeled cash coverage" : "Asking multiple"}</strong><span>{r ? r.value.toFixed(3) : "Unresolved"}</span><small>{r?.formula || "Required values not available"}</small></p>)}</div>{Object.entries(report.fields).map(([k,f]) => <blockquote className="v2-source-entry" key={k}><strong>{fieldNames[k as FieldKey]} · {value(k as FieldKey)}</strong><p>{f.span || "No field captured."}</p></blockquote>)}</details>
      </div>
      <aside className="v2-margin"><span className="v2-kicker">The Senior / reading notes</span><h4>{report.redFlags.length ? "Questions before conviction." : "Clear rules are not a clean bill of health."}</h4><p>Rule-based prompts from this capture—not a new agent analysis.</p>{report.redFlags.map(f => <details className="v2-note-disclosure" key={f.id}><summary>{f.brokerQuestion}</summary><p>{f.id} · {f.severity}</p><blockquote>{f.span}</blockquote></details>)}{!report.redFlags.length && <p>No supported risk triggers were found by these rules. Missing and disabled checks are not an all-clear.</p>}{report.games.map(g => <p className="v2-margin-note" key={g.id}>{g.question}</p>)}<details className="v2-note-disclosure"><summary>{report.disabledDetectors.length} checks remain unavailable ↗</summary>{report.disabledDetectors.map(d => <p key={d.id}>{d.id}: {d.reason}</p>)}</details></aside>
    </div></section>
    <Scenario report={report}/>
  </article>;
}

export function AcquisitionV2Report({ jobId }: { jobId: number }) {
  const stateQuery = trpc.scan.getV2State.useQuery({ jobId }, { refetchInterval: false });
  const run = stateQuery.data;
  const query = trpc.scan.getV2Report.useQuery({ jobId }, { enabled: run?.capturesSaved === true && !stateQuery.isError, refetchInterval: false });
  const refresh = () => {
    void stateQuery.refetch();
    if (run?.capturesSaved && !stateQuery.isError) void query.refetch();
  };
  const refreshing = stateQuery.isFetching || query.isFetching;
  // Do not display cached evidence after an ownership/manifest error or for a legacy job.
  if (!stateQuery.isError && run === null) return null;
  const loading = !stateQuery.isError && !run;
  const versionMismatch = stateQuery.isError && stateQuery.error?.message.includes("engine version mismatch");
  const evidenceUnavailable = !!run?.capturesSaved && (query.isError || (!!query.data && query.data.length !== run.captures.length));
  const rows = !stateQuery.isError && run?.capturesSaved && !evidenceUnavailable ? query.data ?? [] : [];
  const empty = run?.state === "completed" && run.capturesSaved && run.captures.length === 0;
  const notice = stateQuery.isError
    ? { title: versionMismatch ? "This receipt needs a new review." : "The saved receipt is unavailable.", body: versionMismatch ? "Its engine version differs. A new evaluation needs explicit review; refreshing will not rerun research." : "We could not verify this run’s receipt. No outcome or saved figures are shown." }
    : loading ? { title: "Reading the saved receipt.", body: "Checking the run record—not starting research." }
    : run?.state === "failed" ? { title: "The search did not finish.", body: "Any captures below are an incomplete record. No completed search conclusion can be drawn." }
    : run?.state === "capturing" ? { title: "The capture is still open.", body: "The last saved state is capturing, not proof that a worker is still running. Refresh the receipt to check for an outcome." }
    : empty ? { title: "No listing captures were returned.", body: "This run completed with an empty capture receipt. That does not establish that no matching businesses exist." }
    : null;
  return <section className="v2-edition" aria-label="V2 evidence and gate receipt"><header className="v2-masthead"><span>Signal Hunter / The acquisition papers</span><span>Research edition · V2</span></header>
    {notice && <div className="v2-reading" role={stateQuery.isError || run?.state === "failed" ? "alert" : "status"}>
      <span className="v2-kicker">Run receipt / {stateQuery.isError ? "unavailable" : loading ? "loading" : run?.state}</span>
      <h3 className="v2-story-headline">{notice.title}</h3><p className="v2-deck">{notice.body}</p>
    </div>}
    {!stateQuery.isError && run && <details className="v2-note-disclosure"><summary>Run record & approval ↗</summary>
      <p>Mandate {run.mandate.version} · {run.engineVersion}</p>
      <p>Approval recorded <time dateTime={run.approvedAt}>{run.approvedAt}</time>. Screening approval only—not approval to buy or contact anyone.</p>
      <p className="v2-version">Mandate hash: {run.mandateHash}</p><p className="v2-version">Receipt hash: {run.contentHash}</p>
      {run.reason && <p>Recorded reason: {run.reason}</p>}
    </details>}
    {evidenceUnavailable && <p className="v2-margin-note" role="alert">The saved evidence could not be verified. No listing figures are shown; this is not an empty search result.</p>}
    {!stateQuery.isError && run?.capturesSaved && !query.data && !query.isError && <p role="status" className="v2-readout">Reading the saved listing evidence.</p>}
    <div className="v2-cost-coach"><button type="button" disabled={refreshing} onClick={refresh}>{refreshing ? "Refreshing receipt…" : "Refresh saved receipt"}</button><small>Reloads saved records only. It does not start research, place an order or change approval.</small></div>
    {rows.map((row,i) => row.report ? <Reading key={`${jobId}-${run?.contentHash}-${row.url}-${i}`} report={row.report} stale={row.stale} number={i+1}/> : <article key={`${row.url}-${i}`} className="v2-reading"><span className="v2-kicker">Field note {String(i+1).padStart(2,"0")} / {row.state}</span><h3 className="v2-story-headline">The source could not<br/>make the case.</h3><p className="v2-deck">{row.reason}</p><a href={row.url} target="_blank" rel="noopener noreferrer">Inspect original listing ↗</a>{row.stale && <p className="v2-stale">Saved evidence is stale.</p>}</article>)}
    <footer className="v2-colophon">Source-reported claims · deterministic screening · human decision.<br/>HOLD and FAIL records stay in this edition. They are never promoted to fill a shortlist.</footer>
  </section>;
}
