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
type OutcomeChoice = "thesis_held" | "mixed" | "invalidated" | null;

type Stage = {
  id: string;
  short: string;
  label: string;
  eyebrow: string;
  question: string;
};

const STAGES: Stage[] = [
  { id: "thesis", short: "Thesis", label: "Day-Trade Thesis", eyebrow: "Set the capital mission", question: "What are we trying to deploy, by when, and under what thesis?" },
  { id: "slate", short: "Plays", label: "Today’s Play Slate", eyebrow: "Compress the universe", question: "Where is the strongest evidence-backed deployment today?" },
  { id: "decision", short: "Top play", label: "Top Play", eyebrow: "Decision-sized answer", question: "Is this the best available deployment for the stated mission?" },
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
  { symbol: "CRDO", state: "top play", tone: "amber" },
  { symbol: "ANET", state: "alternative", tone: "muted" },
  { symbol: "CASH", state: "control", tone: "muted" },
  { symbol: "WATCH", state: "5 plays", tone: "clay" },
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

function PlayEvidence({ onInspect }: { onInspect: () => void }) {
  return (
    <div className="ap-evidence-anchors">
      <button onClick={onInspect}><CheckCircle2 size={16} /><span><strong>Thesis fit</strong>Inference-networking demand is directly expressed.</span><small>3 sources</small></button>
      <button onClick={onInspect}><CheckCircle2 size={16} /><span><strong>Tradable setup</strong>Opening range and liquidity checks are complete.</span><small>verified</small></button>
      <button onClick={onInspect}><ShieldCheck size={16} /><span><strong>Risk boundary</strong>Planned loss stays below the $150 mission ceiling.</span><small>passes</small></button>
    </div>
  );
}

function StageContent({ step, acknowledgement, setAcknowledgement, outcome, setOutcome, onInspect }: {
  step: number;
  acknowledgement: string;
  setAcknowledgement: (value: string) => void;
  outcome: OutcomeChoice;
  setOutcome: (value: OutcomeChoice) => void;
  onInspect: () => void;
}) {
  if (step === 0) return (
    <div className="ap-stage-content">
      <StatusPill tone="ink">Today · flat by close</StatusPill>
      <h2>Where can I best deploy $5,000 against my AI-infrastructure thesis today?</h2>
      <p className="ap-lede">Start with the operator’s capital mission and thesis. Aperture can search for the strongest qualifying paper play; it will not manufacture a promise to satisfy the desired return.</p>
      <div className="ap-mission-statement">
        <div><span>Capital available</span><strong>$5,000</strong></div>
        <div><span>Desired ending value</span><strong>$8,000</strong><small>Aspiration · not forecast</small></div>
        <div><span>Time boundary</span><strong>Today</strong><small>Flat by market close</small></div>
        <div><span>Maximum planned loss</span><strong>$150</strong><small>Hard paper ceiling</small></div>
      </div>
      <div className="ap-target-boundary"><AlertTriangle size={17} /><div><strong>The target requires a 60% same-day gain.</strong><span>Aperture will rank qualifying plays, but it will explicitly say when no credible setup reaches the target inside the loss ceiling.</span></div></div>
      <button className="ap-amendment" onClick={onInspect}><Sparkles size={16} /><span><strong>Thesis expression</strong>Look for liquid equities benefiting from AI infrastructure demand. Use shares for today’s flow; longer-dated options remain a separate paper-research expression.</span><PanelRightOpen size={16} /></button>
    </div>
  );

  if (step === 1) return (
    <div className="ap-stage-content">
      <StatusPill tone="green">Play slate ready</StatusPill>
      <h2>57 candidates became three operator choices.</h2>
      <p className="ap-lede">The operator reviews plays, not every ticker. Correlated names, failed triggers and weaker expressions are parked with reasons.</p>
      <div className="ap-research-stats">
        <div><strong>57</strong><span>researched</span></div>
        <div><strong>8</strong><span>cleared hard gates</span></div>
        <div><strong>2 + cash</strong><span>operator choices</span></div>
        <div><strong>49</strong><span>parked with reasons</span></div>
      </div>
      <div className="ap-play-slate">
        <button className="is-top"><span className="ap-mono-label">TOP PLAY</span><strong>CRDO · Opening-range breakout</strong><p>Deploy up to $4,643 · $145 planned loss · all required evidence present</p><small>Best thesis fit and risk-adjusted setup</small></button>
        <button><span className="ap-mono-label">ALTERNATIVE</span><strong>ANET · Momentum continuation</strong><p>Deploy up to $4,910 · $150 planned loss</p><small>Lower setup quality · same factor exposure</small></button>
        <button><span className="ap-mono-label">CONTROL</span><strong>Preserve cash</strong><p>Deploy $0 · planned loss $0</p><small>Correct outcome if the live trigger fails</small></button>
      </div>
      <button className="ap-parked-link" onClick={onInspect}>View grouped reasons, watchlist and parked universe</button>
    </div>
  );

  if (step === 2) return (
    <div className="ap-stage-content">
      <StatusPill tone="green">Top qualifying play</StatusPill>
      <h2>CRDO is the best available deployment—without pretending it turns $5K into $8K.</h2>
      <p className="ap-lede">The top-level answer includes the play, the risk, the modeled payoff range and the gap to the operator’s aspiration. Deep evidence is optional because all required gates are source-backed.</p>
      <div className="ap-payoff-strip">
        <div><span>Deploy</span><strong>$4,643</strong><small>$357 remains cash</small></div>
        <div><span>Planned loss</span><strong>−$145</strong><small>0.15% account equity</small></div>
        <div><span>1.5R outcome</span><strong>$4,860</strong><small>+$217 modeled gain</small></div>
        <div><span>2.5R outcome</span><strong>$5,005</strong><small>+$362 modeled gain</small></div>
      </div>
      <div className="ap-target-boundary is-neutral"><Target size={17} /><div><strong>No qualifying play credibly models the requested $8,000 ending value.</strong><span>Meeting that target would require violating the stated loss ceiling or inventing unsupported probability.</span></div></div>
      <PlayEvidence onInspect={onInspect} />
      <button className="ap-analysis-fork" onClick={onInspect}><FileSearch size={17} /><span><strong>Want to inspect the logic?</strong>Open the analysis, opposing evidence, calculations and 12 source records.</span><PanelRightOpen size={16} /></button>
    </div>
  );

  if (step === 3) return (
    <div className="ap-stage-content">
      <StatusPill tone="green">Plan eligible</StatusPill>
      <h2>CRDO · bounded opening-range paper plan</h2>
      <p className="ap-lede">The operator can reach this plan directly from the trusted summary. Assumptions, arithmetic and provenance remain available without becoming mandatory reading.</p>
      <div className="ap-plan-hero">
        <div><span>Entry condition</span><strong>$232.14</strong><small>30m range + 6 bps</small></div>
        <div><span>Protective stop</span><strong>$224.96</strong><small>opening-range low</small></div>
        <div><span>Paper size</span><strong>20 shares</strong><small>$4,643 notional</small></div>
        <div><span>Planned loss</span><strong>$145</strong><small>0.15% equity</small></div>
      </div>
      <div className="ap-mandate-line"><ShieldCheck size={17} /><div><strong>All required gates source-backed</strong><span>Thesis fit · liquidity · horizon · loss ceiling · invalidation</span></div><button onClick={onInspect}>Inspect evidence</button></div>
      <div className="ap-stop-line"><Target size={17} /><div><strong>Live refusal condition</strong><span>Do not stage if VWAP hold fails, price gaps more than 1%, or the liquidity record becomes stale.</span></div></div>
    </div>
  );

  if (step === 4) return (
    <div className="ap-stage-content">
      <StatusPill tone="ink">Human approval required</StatusPill>
      <h2>Approve the version you reviewed—not a moving target.</h2>
      <p className="ap-lede">The approved receipt binds to Top Play v1 and Paper Plan v1. This creates a paper-tracking record only.</p>
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

  if (step === 5) return (
    <div className="ap-stage-content">
      <StatusPill tone="green">Paper study active</StatusPill>
      <h2>Monitor only what can change the play.</h2>
      <p className="ap-lede">No wall of market data. The record watches the trigger, invalidation, time stop and material evidence changes.</p>
      <div className="ap-monitor-grid">
        <div><Clock3 size={18} /><span>Time boundary</span><strong>3h 18m</strong><small>flat by market close</small></div>
        <div><Activity size={18} /><span>Trigger</span><strong>Watching</strong><small>VWAP hold not yet met</small></div>
        <div><ShieldCheck size={18} /><span>Invalidation</span><strong>Intact</strong><small>no material breach</small></div>
      </div>
      <div className="ap-change-log"><span className="ap-mono-label">NEW SINCE APPROVAL</span><div><Circle size={8} fill="currentColor" /><p><strong>No decision-changing evidence.</strong> Market data refreshed 4 minutes ago.</p></div></div>
    </div>
  );

  return (
    <div className="ap-stage-content">
      <StatusPill tone={outcome ? "green" : "ink"}>{outcome ? "Closure ready" : "Outcome required"}</StatusPill>
      <h2>Close the loop while the play is still legible.</h2>
      <p className="ap-lede">Record what happened to the thesis and setup—not just whether the modeled price moved up or down.</p>
      <fieldset className="ap-outcomes">
        <legend>What did the paper study show?</legend>
        {[
          ["thesis_held", "Thesis and setup held", "Evidence and price behavior supported the original play"],
          ["mixed", "Mixed", "Thesis held but the intraday setup needs refinement"],
          ["invalidated", "Invalidated", "A named condition broke the original play"],
        ].map(([value, label, detail]) => (
          <button type="button" key={value} data-selected={outcome === value} onClick={() => setOutcome(value as OutcomeChoice)}><span>{outcome === value ? <CheckCircle2 size={18} /> : <Circle size={18} />}</span><strong>{label}</strong><small>{detail}</small></button>
        ))}
      </fieldset>
      <div className="ap-learning-record"><FileCheck2 size={18} /><div><span className="ap-mono-label">PROPOSED LEARNING RECORD</span><p>{outcome === "thesis_held" ? "The thesis-to-play compression was useful; retain the opening-range and liquidity gates." : outcome === "mixed" ? "Separate long-horizon thesis confidence from same-day trigger quality in the next trial." : outcome === "invalidated" ? "Park this expression and preserve the source-backed invalidation as a future exclusion." : "Choose an outcome to preview the durable learning record."}</p></div></div>
    </div>
  );
}

function Inspector({ step, onClose }: { step: number; onClose?: () => void }) {
  const items = [
    ["Mission compiler", "Aperture separated the operator’s desired ending value from the evidence-backed outcome range and treated $150 as a hard loss ceiling."],
    ["Universe compression", "57 researched names became three distinct plays. Correlated duplicates, failed triggers and lower-quality expressions remain parked with reasons."],
    ["Full play logic", "CRDO leads on thesis fit, live setup quality and bounded loss. Twelve source records support the required gates; none represents a return guarantee."],
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
      <section><span className="ap-mono-label">READINESS EFFECT</span><p>Inspecting the analysis adds understanding but does not change a gate. Required gates are evaluated before the top play is presented as plan-eligible.</p></section>
      <div className="ap-inspector-stamp"><LockKeyhole size={15} /> Audit detail remains attached to the decision</div>
    </aside>
  );
}

function PrimaryAction({ step, acknowledgement, outcome, onAdvance, onBack }: {
  step: number; acknowledgement: string; outcome: OutcomeChoice; onAdvance: () => void; onBack: () => void;
}) {
  const labels = ["Compile day-trade thesis", "Open the top play", "Review paper plan", "Review paper approval", "Approve for paper tracking", "Close paper study", "Restart prototype"];
  const disabled = (step === 4 && acknowledgement !== "PAPER") || (step === 6 && !outcome);
  const hints = [
    "Captures a target and risk boundary; it does not promise a return.", "Opens one play, not 57 candidate reviews.", "Deep analysis is optional because required gates pass.",
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
  return <StageContent step={props.step} acknowledgement={props.acknowledgement} setAcknowledgement={props.setAcknowledgement} outcome={props.outcome} setOutcome={props.setOutcome} onInspect={() => props.setInspectorOpen(true)} />;
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
          <button className="ap-view-all">Open grouped universe</button>
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
  const [acknowledgement, setAcknowledgement] = useState("");
  const [outcome, setOutcome] = useState<OutcomeChoice>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const updateVariant = (next: VariantKey) => { setVariant(next); setVariantInUrl(next); };
  const restart = () => { setStep(0); setAcknowledgement(""); setOutcome(null); setInspectorOpen(false); };
  const onAdvance = () => {
    if (step === STAGES.length - 1) return restart();
    setInspectorOpen(false);
    setStep((current) => Math.min(current + 1, STAGES.length - 1));
  };
  const onBack = () => { setInspectorOpen(false); setStep((current) => Math.max(current - 1, 0)); };
  const props = useMemo<VariantProps>(() => ({ step, setStep, acknowledgement, setAcknowledgement, outcome, setOutcome, inspectorOpen, setInspectorOpen, onAdvance, onBack }), [step, acknowledgement, outcome, inspectorOpen]);

  return (
    <div className="ap-runway">
      <PrototypeHeader onRestart={restart} />
      {variant === "A" ? <VariantA {...props} /> : variant === "B" ? <VariantB {...props} /> : <VariantC {...props} />}
      {import.meta.env.DEV && <PrototypeSwitcher variant={variant} setVariant={updateVariant} />}
    </div>
  );
}
