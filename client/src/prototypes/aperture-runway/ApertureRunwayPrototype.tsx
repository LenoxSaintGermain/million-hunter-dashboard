/**
 * PROTOTYPE — throwaway, fixture-only UI for testing the Capital Aperture
 * decision-runway paradigm. Three variants are switchable with ?variant=A|B|C.
 * This surface has no API, persistence, brokerage, or production route.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  FileCheck2,
  FileSearch,
  Landmark,
  Layers3,
  LockKeyhole,
  PanelRightOpen,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";

type VariantKey = "A" | "B" | "C";
type EvidenceAnswer = "confirmed" | "not_confirmed" | "need_more" | null;
type OutcomeChoice = "thesis_held" | "mixed" | "invalidated" | null;

type Stage = {
  id: string;
  short: string;
  label: string;
  eyebrow: string;
  question: string;
};

const STAGES: Stage[] = [
  { id: "charter", short: "Thesis", label: "Thesis Charter", eyebrow: "Define the aperture", question: "Is this the market belief we intend to test?" },
  { id: "research", short: "Research", label: "Research Progress", eyebrow: "Machine work", question: "Has enough evidence accumulated to review a lead?" },
  { id: "decision", short: "Decision", label: "Decision Packet", eyebrow: "Human judgment", question: "Should CRDO remain under consideration?" },
  { id: "evidence", short: "Evidence", label: "Evidence Resolution", eyebrow: "One decisive check", question: "Does CRDO clear the liquidity requirement?" },
  { id: "plan", short: "Plan", label: "Paper Plan", eyebrow: "Modeled, not submitted", question: "Does this bounded paper plan fit the thesis and mandate?" },
  { id: "approval", short: "Approve", label: "Human Approval", eyebrow: "Explicit authorization", question: "Do you approve this paper-only plan for tracking?" },
  { id: "monitor", short: "Monitor", label: "Monitoring Record", eyebrow: "Watch what could change", question: "Has the thesis, catalyst, or invalidation changed?" },
  { id: "outcome", short: "Outcome", label: "Outcome Record", eyebrow: "Close and learn", question: "What did this paper study teach us?" },
];

const VARIANTS: Record<VariantKey, { name: string; description: string }> = {
  A: { name: "Decision Runway", description: "One packet, optional depth, one next action" },
  B: { name: "Review Desk", description: "Workset, focused canvas, persistent inspector" },
  C: { name: "Case File", description: "Durable artifacts with one expanded record" },
};

const CANDIDATES = [
  { symbol: "CRDO", state: "2 blockers", tone: "amber" },
  { symbol: "ANET", state: "watch", tone: "muted" },
  { symbol: "NVDA", state: "held", tone: "muted" },
  { symbol: "AVGO", state: "stale", tone: "clay" },
];

function readVariant(): VariantKey {
  const value = new URLSearchParams(window.location.search).get("variant")?.toUpperCase();
  return value === "B" || value === "C" ? value : "A";
}

function setVariantInUrl(variant: VariantKey) {
  const url = new URL(window.location.href);
  url.searchParams.set("variant", variant);
  window.history.replaceState({}, "", url);
}

function AppMark() {
  return (
    <div className="ap-brand" aria-label="Signal Hunter OS Editorial">
      <div className="ap-brand-mark"><BarChart3 size={17} /></div>
      <div><strong>Signal Hunter</strong><span>OS EDITORIAL</span></div>
    </div>
  );
}

function PrototypeHeader({ onRestart }: { onRestart: () => void }) {
  return (
    <>
      <header className="ap-global-header">
        <AppMark />
        <nav aria-label="Prototype navigation">
          <span>Command Center</span><span>Scout</span><span>Wingate</span><strong>Capital</strong><span>Analyze</span>
        </nav>
        <button className="ap-icon-button" onClick={onRestart} aria-label="Restart prototype"><RefreshCcw size={15} /></button>
      </header>
      <div className="ap-prototype-banner">
        <span><Sparkles size={13} /> LOCAL PROTOTYPE</span>
        Fixture-only interaction study · no API · no database · no order path
      </div>
    </>
  );
}

function ContextBar({ onInspector }: { onInspector: () => void }) {
  return (
    <section className="ap-context-bar" aria-label="Active Capital Aperture context">
      <div className="ap-context-primary">
        <span className="ap-mono-label">ACTIVE THESIS</span>
        <strong>AI Infrastructure Cycle</strong>
      </div>
      <div><span className="ap-mono-label">PAPER ACCOUNT</span><strong>Alpaca Paper · $97,429</strong></div>
      <div><span className="ap-mono-label">FRESHNESS</span><strong>Market data · 6m ago</strong></div>
      <button className="ap-context-warning" onClick={onInspector}>
        <AlertTriangle size={15} /> NVDA uses 96% of its single-name allowance <span>Review</span>
      </button>
    </section>
  );
}

function StageRail({ current, onSelect }: { current: number; onSelect: (index: number) => void }) {
  return (
    <ol className="ap-stage-rail" aria-label="Decision lifecycle">
      {STAGES.map((stage, index) => {
        const state = index < current ? "complete" : index === current ? "current" : "future";
        return (
          <li key={stage.id} data-state={state}>
            <button onClick={() => index <= current && onSelect(index)} disabled={index > current} aria-current={index === current ? "step" : undefined}>
              <span className="ap-stage-dot">{index < current ? <Check size={12} /> : index + 1}</span>
              <span>{stage.short}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StatusPill({ children, tone = "amber" }: { children: React.ReactNode; tone?: "amber" | "green" | "clay" | "ink" }) {
  return <span className="ap-status" data-tone={tone}>{children}</span>;
}

function DecisionEvidence({ onInspect }: { onInspect: () => void }) {
  return (
    <div className="ap-evidence-anchors">
      <button onClick={onInspect}><CheckCircle2 size={16} /><span><strong>Thesis fit</strong>Inference networking demand is directly expressed.</span><small>3 sources</small></button>
      <button onClick={onInspect}><CheckCircle2 size={16} /><span><strong>Catalyst</strong>Next earnings window falls inside the thesis horizon.</span><small>verified</small></button>
      <button className="is-blocker" onClick={onInspect}><AlertTriangle size={16} /><span><strong>Liquidity</strong>Required 30-day dollar-volume source is missing.</span><small>blocks plan</small></button>
    </div>
  );
}

function StageContent({
  step,
  evidenceAnswer,
  setEvidenceAnswer,
  acknowledgement,
  setAcknowledgement,
  outcome,
  setOutcome,
  onInspect,
}: {
  step: number;
  evidenceAnswer: EvidenceAnswer;
  setEvidenceAnswer: (value: EvidenceAnswer) => void;
  acknowledgement: string;
  setAcknowledgement: (value: string) => void;
  outcome: OutcomeChoice;
  setOutcome: (value: OutcomeChoice) => void;
  onInspect: () => void;
}) {
  if (step === 0) return (
    <div className="ap-stage-content">
      <StatusPill tone="amber">2 assumptions to confirm</StatusPill>
      <h2>AI infrastructure is the dominant capital cycle of the next five years.</h2>
      <p className="ap-lede">Aperture converted the operator’s market belief into a bounded research charter. Review the interpretation—not a twelve-field intake form.</p>
      <div className="ap-charter-grid">
        <div><span>Research horizon</span><strong>3–5 years</strong></div>
        <div><span>Paper-study horizon</span><strong>Intraday catalyst windows</strong></div>
        <div><span>Eligible expression</span><strong>Liquid U.S. equities</strong></div>
        <div><span>Maximum planned loss</span><strong>0.75% per play</strong></div>
      </div>
      <button className="ap-amendment" onClick={onInspect}><Sparkles size={16} /><span><strong>One definition needs review</strong>What event ends the thesis if demand continues but multiples compress?</span><PanelRightOpen size={16} /></button>
    </div>
  );

  if (step === 1) return (
    <div className="ap-stage-content">
      <StatusPill tone="ink">Research complete</StatusPill>
      <h2>One lead is ready for operator review.</h2>
      <p className="ap-lede">The machine searched broadly, then reduced the result to a bounded slate. The candidate universe stays available without becoming the interface.</p>
      <div className="ap-research-meter"><span style={{ width: "100%" }} /></div>
      <div className="ap-research-stats">
        <div><strong>57</strong><span>screened</span></div>
        <div><strong>18</strong><span>mandate-eligible</span></div>
        <div><strong>3</strong><span>decision slate</span></div>
        <div><strong>1</strong><span>lead</span></div>
      </div>
      <div className="ap-shortlist">
        <div className="is-lead"><span>01</span><strong>CRDO</strong><small>Best research fit · 2 blockers</small></div>
        <div><span>02</span><strong>ANET</strong><small>Alternative expression</small></div>
        <div><span>03</span><strong>AVGO</strong><small>Existing exposure overlap</small></div>
      </div>
    </div>
  );

  if (step === 2) return (
    <div className="ap-stage-content">
      <StatusPill tone="amber">Keep researching</StatusPill>
      <h2>Should CRDO remain under consideration?</h2>
      <p className="ap-lede">CRDO is the strongest current research lead, but it is not yet eligible for a paper plan.</p>
      <DecisionEvidence onInspect={onInspect} />
      <div className="ap-decision-callout">
        <span className="ap-mono-label">ONE THING TO RESOLVE</span>
        <strong>Confirm whether 30-day average dollar volume clears the mandate.</strong>
        <p>Missing source · blocks paper-plan preparation · existing paper positions unchanged</p>
      </div>
    </div>
  );

  if (step === 3) return (
    <div className="ap-stage-content">
      <StatusPill tone={evidenceAnswer === "confirmed" ? "green" : "amber"}>{evidenceAnswer === "confirmed" ? "Evidence resolved" : "Plan remains locked"}</StatusPill>
      <h2>Does CRDO clear the liquidity requirement?</h2>
      <p className="ap-lede">One question, its reason, its source and its readiness consequence live in the same working surface.</p>
      <button className="ap-source-card" onClick={onInspect}>
        <div className="ap-source-icon"><FileSearch size={20} /></div>
        <div><span className="ap-mono-label">SIP CONSOLIDATED TAPE · AS OF AUG 25, 2026</span><strong>30-day median dollar volume: $186.4M</strong><p>Current source clears the minimum liquidity requirement of $25M.</p></div>
        <PanelRightOpen size={18} />
      </button>
      <fieldset className="ap-answer-set">
        <legend>Record the human review</legend>
        {[
          ["confirmed", "Confirmed", "Source is current and requirement passes"],
          ["not_confirmed", "Not confirmed", "Source fails or contradicts the requirement"],
          ["need_more", "Need more evidence", "Keep the case open without advancing"],
        ].map(([value, label, detail]) => (
          <button key={value} type="button" data-selected={evidenceAnswer === value} onClick={() => setEvidenceAnswer(value as EvidenceAnswer)}>
            <span className="ap-radio">{evidenceAnswer === value && <Check size={12} />}</span><span><strong>{label}</strong><small>{detail}</small></span>
          </button>
        ))}
      </fieldset>
      <p className="ap-consequence">{evidenceAnswer === "confirmed" ? "Consequence: liquidity gate clears; VWAP confirmation will remain a live preflight condition." : "Consequence: paper-plan preparation remains unavailable."}</p>
    </div>
  );

  if (step === 4) return (
    <div className="ap-stage-content">
      <StatusPill tone="green">Plan eligible</StatusPill>
      <h2>CRDO · bounded opening-range paper plan</h2>
      <p className="ap-lede">Only the decision-sized summary is open. Assumptions, arithmetic and provenance remain one deliberate reveal away.</p>
      <div className="ap-plan-hero">
        <div><span>Entry condition</span><strong>$232.14</strong><small>30m range + 6 bps</small></div>
        <div><span>Protective stop</span><strong>$224.96</strong><small>opening-range low</small></div>
        <div><span>Paper size</span><strong>20 shares</strong><small>$4,643 notional</small></div>
        <div><span>Planned loss</span><strong>$145</strong><small>0.15% equity</small></div>
      </div>
      <div className="ap-mandate-line"><ShieldCheck size={17} /><div><strong>Within modeled mandate</strong><span>$145 planned loss / $731 per-play ceiling</span></div><button onClick={onInspect}>Inspect math</button></div>
      <div className="ap-stop-line"><Target size={17} /><div><strong>Do not stage when</strong><span>VWAP hold is unconfirmed, price gaps more than 1%, or liquidity evidence becomes stale.</span></div></div>
    </div>
  );

  if (step === 5) return (
    <div className="ap-stage-content">
      <StatusPill tone="ink">Human approval required</StatusPill>
      <h2>Approve the version you reviewed—not a moving target.</h2>
      <p className="ap-lede">The approved receipt binds to Decision Packet v4 and Paper Plan v1. This creates a paper-tracking record only.</p>
      <div className="ap-approval-receipt">
        <div><span>Decision</span><strong>CRDO · opening-range paper study</strong></div>
        <div><span>Maximum planned loss</span><strong>$145 · 0.15% equity</strong></div>
        <div><span>Live preflight</span><strong>VWAP hold must pass</strong></div>
        <div><span>Broker action</span><strong>None from this prototype</strong></div>
      </div>
      <label className="ap-acknowledgement">
        <span>Type <code>PAPER</code> to acknowledge a paper-only plan</span>
        <input value={acknowledgement} onChange={(event) => setAcknowledgement(event.target.value.toUpperCase())} placeholder="PAPER" autoComplete="off" />
      </label>
      <p className="ap-consequence">{acknowledgement === "PAPER" ? "Acknowledgement recognized. The paper-tracking action is available." : "Approval remains unavailable until the acknowledgement is exact."}</p>
    </div>
  );

  if (step === 6) return (
    <div className="ap-stage-content">
      <StatusPill tone="green">Paper study active</StatusPill>
      <h2>Monitor only what can change the decision.</h2>
      <p className="ap-lede">No wall of market data. The record watches the catalyst, invalidation, time stop and material evidence changes.</p>
      <div className="ap-monitor-grid">
        <div><Clock3 size={18} /><span>Catalyst clock</span><strong>6d 04h</strong><small>earnings window</small></div>
        <div><Activity size={18} /><span>Trigger</span><strong>Watching</strong><small>VWAP hold not yet met</small></div>
        <div><ShieldCheck size={18} /><span>Invalidation</span><strong>Intact</strong><small>no material breach</small></div>
      </div>
      <div className="ap-change-log"><span className="ap-mono-label">NEW SINCE APPROVAL</span><div><Circle size={8} fill="currentColor" /><p><strong>No decision-changing evidence.</strong> Market data refreshed 4 minutes ago.</p></div></div>
    </div>
  );

  return (
    <div className="ap-stage-content">
      <StatusPill tone={outcome ? "green" : "ink"}>{outcome ? "Closure ready" : "Outcome required"}</StatusPill>
      <h2>Close the loop while the decision is still legible.</h2>
      <p className="ap-lede">Record what happened to the thesis—not just whether the modeled price moved up or down.</p>
      <fieldset className="ap-outcomes">
        <legend>What did the study show?</legend>
        {[
          ["thesis_held", "Thesis held", "Evidence and price behavior supported the original case"],
          ["mixed", "Mixed", "Some conditions held; the decision needs refinement"],
          ["invalidated", "Invalidated", "A named condition broke the original case"],
        ].map(([value, label, detail]) => (
          <button type="button" key={value} data-selected={outcome === value} onClick={() => setOutcome(value as OutcomeChoice)}><span>{outcome === value ? <CheckCircle2 size={18} /> : <Circle size={18} />}</span><strong>{label}</strong><small>{detail}</small></button>
        ))}
      </fieldset>
      <div className="ap-learning-record"><FileCheck2 size={18} /><div><span className="ap-mono-label">PROPOSED LEARNING RECORD</span><p>{outcome === "thesis_held" ? "The liquidity gate and opening-range structure were decision-useful; keep both in the next trial." : outcome === "mixed" ? "Separate thesis evidence from intraday trigger quality in the next trial." : outcome === "invalidated" ? "Retire this expression and preserve the source-backed invalidation as a future exclusion." : "Choose an outcome to preview the durable learning record."}</p></div></div>
    </div>
  );
}

function Inspector({ step, onClose }: { step: number; onClose?: () => void }) {
  const items = [
    ["Compiler diff", "Aperture added a paper-study horizon and separated it from the long-term thesis horizon."],
    ["Research diagnostics", "57 screened · 18 mandate-eligible · 3 shortlisted. Fourteen extra exposure nodes were deferred, not silently discarded."],
    ["Decision provenance", "CRDO leads on thesis fit and current evidence confidence. It is not a return forecast."],
    ["Liquidity source", "SIP consolidated bars · 30 sessions · median daily dollar volume · observed Aug 25, 2026."],
    ["Modeled arithmetic", "20 × $232.14 = $4,642.80 notional. Stop distance plus slippage models $144.80 planned loss."],
    ["Approval boundary", "Paper Plan v1 is bound to Decision Packet v4. No live brokerage action is represented."],
    ["Monitoring scope", "Only catalyst, invalidation, time stop and decision-changing evidence trigger attention."],
    ["Closure provenance", "Outcome records remain attached to the approved versions and the operator identity that closed them."],
  ][step];
  return (
    <aside className="ap-inspector" aria-label="Context inspector">
      <header><div><span className="ap-mono-label">CONTEXT INSPECTOR</span><strong>{items[0]}</strong></div>{onClose && <button onClick={onClose} aria-label="Close inspector"><X size={16} /></button>}</header>
      <section><span className="ap-mono-label">WHY THIS MATTERS</span><p>{items[1]}</p></section>
      <section><span className="ap-mono-label">PROVENANCE</span><p>Fixture-backed prototype record · viewed locally · no external request</p></section>
      <section><span className="ap-mono-label">READINESS EFFECT</span><p>{step === 3 ? "A confirmed human review clears only the liquidity evidence gate." : "Inspecting this record does not change readiness."}</p></section>
      <div className="ap-inspector-stamp"><LockKeyhole size={15} /> Audit detail remains attached to the decision</div>
    </aside>
  );
}

function PrimaryAction({ step, evidenceAnswer, acknowledgement, outcome, onAdvance, onBack }: {
  step: number; evidenceAnswer: EvidenceAnswer; acknowledgement: string; outcome: OutcomeChoice; onAdvance: () => void; onBack: () => void;
}) {
  const labels = ["Confirm Thesis Charter", "Review the lead", "Resolve liquidity evidence", "Continue to paper plan", "Review paper approval", "Approve for paper tracking", "Close paper study", "Restart prototype"];
  const disabled = (step === 3 && evidenceAnswer !== "confirmed") || (step === 5 && acknowledgement !== "PAPER") || (step === 7 && !outcome);
  const hints = [
    "Creates a research charter, not an order.", "Moves one candidate into human review.", "Paper plan remains locked.", "Only confirmed evidence can advance.",
    "No proposal is submitted.", "Creates a fixture-only approval receipt.", "Outcome is recorded separately.", "The local fixture resets.",
  ];
  return (
    <footer className="ap-action-dock">
      <div><span className="ap-mono-label">NEXT GUARDED ACTION</span><p>{hints[step]}</p></div>
      <div className="ap-action-buttons">
        {step > 0 && <button className="ap-button-secondary" onClick={onBack}><ArrowLeft size={15} /> Back</button>}
        <button className="ap-button-primary" onClick={onAdvance} disabled={disabled}>{labels[step]} <ArrowRight size={15} /></button>
      </div>
    </footer>
  );
}

type VariantProps = {
  step: number;
  setStep: (step: number) => void;
  evidenceAnswer: EvidenceAnswer;
  setEvidenceAnswer: (value: EvidenceAnswer) => void;
  acknowledgement: string;
  setAcknowledgement: (value: string) => void;
  outcome: OutcomeChoice;
  setOutcome: (value: OutcomeChoice) => void;
  inspectorOpen: boolean;
  setInspectorOpen: (value: boolean) => void;
  onAdvance: () => void;
  onBack: () => void;
};

function CurrentStage(props: VariantProps) {
  return <StageContent step={props.step} evidenceAnswer={props.evidenceAnswer} setEvidenceAnswer={props.setEvidenceAnswer} acknowledgement={props.acknowledgement} setAcknowledgement={props.setAcknowledgement} outcome={props.outcome} setOutcome={props.setOutcome} onInspect={() => props.setInspectorOpen(true)} />;
}

function VariantA(props: VariantProps) {
  return (
    <main className="ap-variant ap-variant-runway">
      <ContextBar onInspector={() => props.setInspectorOpen(true)} />
      <StageRail current={props.step} onSelect={props.setStep} />
      <div className="ap-runway-layout" data-inspector={props.inspectorOpen}>
        <article className="ap-decision-packet">
          <header className="ap-packet-header"><div><span className="ap-mono-label">{STAGES[props.step].eyebrow}</span><h1>{STAGES[props.step].label}</h1></div><span className="ap-version">VERSION {props.step < 2 ? 1 : 4}</span></header>
          <CurrentStage {...props} />
          <PrimaryAction {...props} />
        </article>
        {props.inspectorOpen && <Inspector step={props.step} onClose={() => props.setInspectorOpen(false)} />}
      </div>
    </main>
  );
}

function VariantB(props: VariantProps) {
  return (
    <main className="ap-variant ap-variant-desk">
      <ContextBar onInspector={() => props.setInspectorOpen(true)} />
      <div className="ap-desk-grid">
        <aside className="ap-workset">
          <header><span className="ap-mono-label">ACTIVE WORKSET</span><button aria-label="Search candidates"><Search size={15} /></button></header>
          {CANDIDATES.map((candidate, index) => <button key={candidate.symbol} data-active={index === 0}><span className="ap-workset-symbol">{candidate.symbol}</span><small data-tone={candidate.tone}>{candidate.state}</small></button>)}
          <button className="ap-view-all">View 53 parked candidates</button>
        </aside>
        <article className="ap-desk-canvas">
          <StageRail current={props.step} onSelect={props.setStep} />
          <header className="ap-packet-header"><div><span className="ap-mono-label">{STAGES[props.step].eyebrow}</span><h1>{STAGES[props.step].question}</h1></div><span className="ap-version">CRDO</span></header>
          <CurrentStage {...props} />
          <PrimaryAction {...props} />
        </article>
        <Inspector step={props.step} />
      </div>
    </main>
  );
}

function VariantC(props: VariantProps) {
  return (
    <main className="ap-variant ap-variant-file">
      <ContextBar onInspector={() => props.setInspectorOpen(true)} />
      <div className="ap-case-layout">
        <aside className="ap-artifact-stack">
          <span className="ap-mono-label">APERTURE CASE FILE</span>
          <h2>AI Infrastructure Cycle</h2>
          <ol>{STAGES.map((stage, index) => <li key={stage.id} data-state={index < props.step ? "complete" : index === props.step ? "current" : "future"}><button disabled={index > props.step} onClick={() => props.setStep(index)}><span>{index < props.step ? <Check size={13} /> : index + 1}</span><div><strong>{stage.label}</strong><small>{index < props.step ? "receipt saved" : index === props.step ? "open now" : "locked"}</small></div></button></li>)}</ol>
          <button className="ap-context-capsule" onClick={() => props.setInspectorOpen(!props.inspectorOpen)}><Landmark size={16} /><span><strong>Context capsule</strong><small>Account, mandate, provenance</small></span><PanelRightOpen size={15} /></button>
        </aside>
        <article className="ap-case-document">
          <header className="ap-document-header"><div><span className="ap-mono-label">{STAGES[props.step].eyebrow}</span><h1>{STAGES[props.step].label}</h1><p>{STAGES[props.step].question}</p></div><div className="ap-document-stamp">PAPER ONLY<br /><small>VERSION {props.step < 2 ? 1 : 4}</small></div></header>
          <CurrentStage {...props} />
          {props.inspectorOpen && <Inspector step={props.step} onClose={() => props.setInspectorOpen(false)} />}
          <PrimaryAction {...props} />
        </article>
      </div>
    </main>
  );
}

function PrototypeSwitcher({ variant, setVariant }: { variant: VariantKey; setVariant: (variant: VariantKey) => void }) {
  const keys = Object.keys(VARIANTS) as VariantKey[];
  const move = (direction: -1 | 1) => {
    const current = keys.indexOf(variant);
    setVariant(keys[(current + direction + keys.length) % keys.length]);
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
  return (
    <div className="ap-prototype-switcher" aria-label="Prototype variant switcher">
      <button onClick={() => move(-1)} aria-label="Previous variant"><ChevronLeft size={17} /></button>
      <div><strong>{variant} — {VARIANTS[variant].name}</strong><span>{VARIANTS[variant].description}</span></div>
      <button onClick={() => move(1)} aria-label="Next variant"><ChevronRight size={17} /></button>
    </div>
  );
}

export function ApertureRunwayPrototype() {
  const [variant, setVariant] = useState<VariantKey>(readVariant);
  const [step, setStep] = useState(0);
  const [evidenceAnswer, setEvidenceAnswer] = useState<EvidenceAnswer>(null);
  const [acknowledgement, setAcknowledgement] = useState("");
  const [outcome, setOutcome] = useState<OutcomeChoice>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const updateVariant = (next: VariantKey) => { setVariant(next); setVariantInUrl(next); };
  const restart = () => { setStep(0); setEvidenceAnswer(null); setAcknowledgement(""); setOutcome(null); setInspectorOpen(false); };
  const onAdvance = () => {
    if (step === 7) return restart();
    setInspectorOpen(false);
    setStep((current) => Math.min(current + 1, STAGES.length - 1));
  };
  const onBack = () => { setInspectorOpen(false); setStep((current) => Math.max(current - 1, 0)); };
  const props = useMemo<VariantProps>(() => ({ step, setStep, evidenceAnswer, setEvidenceAnswer, acknowledgement, setAcknowledgement, outcome, setOutcome, inspectorOpen, setInspectorOpen, onAdvance, onBack }), [step, evidenceAnswer, acknowledgement, outcome, inspectorOpen]);

  return (
    <div className="ap-runway">
      <PrototypeHeader onRestart={restart} />
      {variant === "A" ? <VariantA {...props} /> : variant === "B" ? <VariantB {...props} /> : <VariantC {...props} />}
      {import.meta.env.DEV && <PrototypeSwitcher variant={variant} setVariant={updateVariant} />}
    </div>
  );
}
