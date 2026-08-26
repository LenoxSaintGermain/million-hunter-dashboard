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
import {
  APERTURE_PRESSURE_TEST_SCENARIOS,
  findApertureScenario,
  type CapitalMission,
  type HorizonKey,
  type PressureTestScenario,
  type ScenarioResult,
} from "./aperturePressureTestScenarios";

type VariantKey = "A" | "B" | "C";
type OutcomeChoice = "thesis_held" | "mixed" | "invalidated" | null;
type ThesisEntryMode = "assigned" | "new";

type MissionPreset = {
  id: "smart" | "mandate" | "cash";
  label: string;
  badge: string;
  reason: string;
  mission: CapitalMission;
};

type MissionMath = {
  requiredReturn: number;
  units: number;
  notional: number;
  cash: number;
  plannedLoss: number;
  gainAtOneFiveR: number;
  gainAtTwoFiveR: number;
  endingAtOneFiveR: number;
  endingAtTwoFiveR: number;
};

type Stage = {
  id: string;
  short: string;
  label: string;
  eyebrow: string;
  question: string;
};

const STAGES: Stage[] = [
  { id: "thesis", short: "Thesis", label: "Capital Thesis", eyebrow: "Set the capital mission", question: "What are we trying to deploy, by when, and under what thesis?" },
  { id: "slate", short: "Plays", label: "Play Slate", eyebrow: "Compress the universe", question: "Where is the strongest evidence-backed deployment?" },
  { id: "decision", short: "Top play", label: "Top Play", eyebrow: "Decision-sized answer", question: "Is this the best available deployment for the stated mission?" },
  { id: "plan", short: "Plan", label: "Paper Plan", eyebrow: "Modeled, not submitted", question: "Does this bounded paper plan fit the thesis and mandate?" },
  { id: "approval", short: "Approve", label: "Human Approval", eyebrow: "Explicit authorization", question: "Do you approve this paper-only plan for tracking?" },
  { id: "monitor", short: "Monitor", label: "Monitoring Record", eyebrow: "Watch what could change", question: "Has the thesis, catalyst, or invalidation changed?" },
  { id: "outcome", short: "Outcome", label: "Outcome Queue", eyebrow: "Wait, then learn", question: "When is this paper study ready to evaluate?" },
];

const HORIZONS: Record<HorizonKey, { label: string; detail: string; due: string }> = {
  today: { label: "Today", detail: "Flat by market close", due: "Today · 4:00 PM ET" },
  week: { label: "This week", detail: "Review after Friday close", due: "Friday · 4:00 PM ET" },
  thirty_days: { label: "30 days", detail: "Review at the declared horizon", due: "In 30 calendar days" },
  long_term: { label: "Long term", detail: "Review at the named catalyst", due: "At the named catalyst date" },
};

const formatCurrency = (value: number, decimals = 0) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: decimals,
  minimumFractionDigits: decimals,
}).format(Number.isFinite(value) ? value : 0);

function missionForScenario(scenario: PressureTestScenario, mode: ThesisEntryMode): CapitalMission {
  return mode === "assigned" && scenario.thesisTitle
    ? { ...scenario.mission }
    : { ...scenario.mission, thesis: scenario.thesisTitle ? "" : scenario.mission.thesis };
}

function missionPresetsFor(scenario: PressureTestScenario): MissionPreset[] {
  const groupLabels: Record<PressureTestScenario["group"], string> = {
    Intraday: "Thesis-aligned day trade",
    Swing: "Catalyst swing",
    Options: "Defined-risk options study",
    Portfolio: "Portfolio-gap deployment",
    Disclosure: "Disclosure-pattern follow-through",
    Novice: "Guardrailed first paper play",
  };
  const researchAligned = scenario.group === "Disclosure";
  const boundedTarget = scenario.mission.capital + (scenario.mission.maxLoss * 2.5);
  return [
    {
      id: "smart",
      label: groupLabels[scenario.group],
      badge: researchAligned ? "research match" : "common playbook",
      reason: researchAligned
        ? "Ranked first because the active research fixture contains a thesis-aligned disclosure pattern. Production still requires verified sources and collision gates."
        : `A common ${HORIZONS[scenario.mission.horizon].label.toLowerCase()} frame filtered by the active thesis, available capital, and the ${formatCurrency(scenario.mission.maxLoss)} paper-loss ceiling.`,
      mission: { ...scenario.mission },
    },
    {
      id: "mandate",
      label: "Mandate-first deployment",
      badge: "account fit",
      reason: `Uses the fixture account size and loss ceiling, then bounds the modeled ending value at 2.5R instead of promising the requested return.`,
      mission: { ...scenario.mission, prompt: scenario.promptStarters[1], target: Math.round(boundedTarget) },
    },
    {
      id: "cash",
      label: "Cash until the setup qualifies",
      badge: "risk check",
      reason: `Starts from the binding gate—${scenario.blockingGate}—and keeps no-trade visible as a valid answer.`,
      mission: { ...scenario.mission, prompt: scenario.promptStarters[2], target: scenario.mission.capital },
    },
  ];
}

function deriveMissionMath(mission: CapitalMission, scenario: PressureTestScenario): MissionMath {
  const capital = Math.max(0, mission.capital || 0);
  const target = Math.max(0, mission.target || 0);
  const maxLoss = Math.max(0, mission.maxLoss || 0);
  const lead = scenario.plays[0];
  const notionalPerUnit = Math.max(0.01, lead?.notionalPerUnit ?? 1);
  const riskPerUnit = Math.max(0.01, lead?.riskPerUnit ?? maxLoss);
  const units = scenario.result === "no_trade" ? 0 : Math.max(0, Math.min(Math.floor(capital / notionalPerUnit), Math.floor(maxLoss / riskPerUnit)));
  const notional = units * notionalPerUnit;
  const plannedLoss = units * riskPerUnit;
  const gainAtOneFiveR = plannedLoss * 1.5;
  const gainAtTwoFiveR = plannedLoss * 2.5;
  return {
    requiredReturn: capital > 0 ? ((target - capital) / capital) * 100 : 0,
    units,
    notional,
    cash: Math.max(0, capital - notional),
    plannedLoss,
    gainAtOneFiveR,
    gainAtTwoFiveR,
    endingAtOneFiveR: capital + gainAtOneFiveR,
    endingAtTwoFiveR: capital + gainAtTwoFiveR,
  };
}

const VARIANTS: Record<VariantKey, { name: string; description: string }> = {
  A: { name: "Decision Runway", description: "One packet, optional depth, one next action" },
  B: { name: "Review Desk", description: "Workset, focused canvas, persistent inspector" },
  C: { name: "Case File", description: "Durable artifacts with one expanded record" },
};

function readVariant(): VariantKey {
  const value = new URLSearchParams(window.location.search).get("variant")?.toUpperCase();
  return value === "B" || value === "C" ? value : "A";
}

function readScenario() {
  return findApertureScenario(new URLSearchParams(window.location.search).get("scenario"));
}

function setScenarioInUrl(scenario: PressureTestScenario) {
  const url = new URL(window.location.href);
  url.searchParams.set("scenario", scenario.id);
  window.history.replaceState({}, "", url);
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

function PrototypeHeader({ scenario, onSelectScenario, onRestart }: { scenario: PressureTestScenario; onSelectScenario: (scenario: PressureTestScenario) => void; onRestart: () => void }) {
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
        <div className="ap-prototype-banner-copy"><span><Sparkles size={13} /> LOCAL PROTOTYPE</span><small>Fixture-only interaction study · no API · no database · no order path</small></div>
        <details className="ap-test-case-menu">
          <summary><span>TEST CASE</span>{scenario.name}</summary>
          <div className="ap-test-case-popover">
            <span className="ap-mono-label">PROTOTYPE-ONLY PRESSURE TEST</span>
            <strong>Switch the simulated operator and gate outcome</strong>
            <label>
              <span className="ap-sr-only">Pressure test scenario</span>
              <select aria-label="Pressure test scenario" value={scenario.id} onChange={(event) => onSelectScenario(findApertureScenario(event.target.value))}>
                {Array.from(new Set(APERTURE_PRESSURE_TEST_SCENARIOS.map((item) => item.group))).map((group) => (
                  <optgroup key={group} label={group}>
                    {APERTURE_PRESSURE_TEST_SCENARIOS.filter((item) => item.group === group).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="ap-scenario-meta"><span>{scenario.group}</span><span>{HORIZONS[scenario.mission.horizon].label}</span><span data-result={scenario.result}>{scenario.result.replace("_", " ")}</span></div>
            <p>This control belongs to the test harness. It is not a customer preset or product navigation.</p>
          </div>
        </details>
      </div>
    </>
  );
}

function ContextBar({ scenario, thesisMode, onInspector }: { scenario: PressureTestScenario; thesisMode: ThesisEntryMode; onInspector: () => void }) {
  return (
    <section className="ap-context-bar" aria-label="Active Capital Aperture context">
      <div className="ap-context-primary">
        <span className="ap-mono-label">{thesisMode === "assigned" ? "ASSIGNED THESIS" : "THESIS STATUS"}</span>
        <strong>{thesisMode === "assigned" ? scenario.thesisTitle : "No thesis assigned · builder open"}</strong>
      </div>
      <div><span className="ap-mono-label">PAPER ACCOUNT</span><strong>Alpaca Paper · $97,429</strong></div>
      <div><span className="ap-mono-label">FRESHNESS</span><strong>{scenario.dataFreshness}</strong></div>
      <button className="ap-context-warning" onClick={onInspector}>
        <AlertTriangle size={15} /> {scenario.contextWarning} <span>Review</span>
      </button>
    </section>
  );
}

function stageIndexesFor(result: ScenarioResult) {
  if (result === "no_trade") return [0, 1, 2, 6];
  if (result === "conditional") return [0, 1, 2, 3, 6];
  return STAGES.map((_, index) => index);
}

function StageRail({ current, result, onSelect }: { current: number; result: ScenarioResult; onSelect: (index: number) => void }) {
  const activeIndexes = stageIndexesFor(result);
  const currentPosition = activeIndexes.indexOf(current);
  return (
    <ol className="ap-stage-rail" aria-label="Decision lifecycle">
      {activeIndexes.map((index, position) => {
        const stage = STAGES[index];
        const state = position < currentPosition ? "complete" : position === currentPosition ? "current" : "future";
        return (
          <li key={stage.id} data-state={state}>
            <button onClick={() => position <= currentPosition && onSelect(index)} disabled={position > currentPosition} aria-current={index === current ? "step" : undefined}>
              <span className="ap-stage-dot">{position < currentPosition ? <Check size={12} /> : position + 1}</span>
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

function AnimatedPromptEditor({ mission, scenario, onChange }: { mission: CapitalMission; scenario: PressureTestScenario; onChange: (value: CapitalMission) => void }) {
  const [animatedText, setAnimatedText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const phrases = scenario.promptStarters;

  useEffect(() => {
    setEditing(false);
  }, [scenario.id]);

  useEffect(() => {
    if (mission.prompt || editing) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setAnimatedText(phrases[0]);
      return;
    }
    const phrase = phrases[phraseIndex];
    let delay = deleting ? 18 : 34;
    const timer = window.setTimeout(() => {
      if (!deleting && animatedText.length < phrase.length) {
        setAnimatedText(phrase.slice(0, animatedText.length + 1));
      } else if (!deleting) {
        setDeleting(true);
      } else if (animatedText.length > 0) {
        setAnimatedText(animatedText.slice(0, -1));
      } else {
        setDeleting(false);
        setPhraseIndex((current) => (current + 1) % phrases.length);
      }
    }, !deleting && animatedText.length === phrase.length ? 1600 : delay);
    return () => window.clearTimeout(timer);
  }, [animatedText, deleting, editing, mission.prompt, phraseIndex, phrases]);

  const chooseStarter = (index: number) => {
    onChange({ ...mission, prompt: phrases[index] });
    setEditing(true);
  };

  return (
    <div className="ap-prompt-composer">
      {editing ? (
        <div className="ap-prompt-edit-panel">
          <div className="ap-prompt-edit-heading"><div><span className="ap-mono-label">EDIT CAPITAL MISSION</span><strong>What do you want this capital to do?</strong></div><button type="button" disabled={!mission.prompt.trim()} onClick={() => setEditing(false)}><Check size={14} /> Done</button></div>
          <label>
            <span className="ap-sr-only">Describe the capital mission</span>
            <textarea aria-label="Describe the capital mission" value={mission.prompt} rows={3} autoFocus onChange={(event) => onChange({ ...mission, prompt: event.target.value })} placeholder="Ask Aperture what you want this capital to do…" />
          </label>
          <div className="ap-prompt-starters" aria-label="Capital mission starters">
            <span>Try a frame</span>
            <button type="button" onClick={() => chooseStarter(0)}>Where can I…</button>
            <button type="button" onClick={() => chooseStarter(1)}>How can I…</button>
            <button type="button" onClick={() => chooseStarter(2)}>What must…</button>
          </div>
        </div>
      ) : (
        <>
          <div className="ap-mission-question">
            <div><span className="ap-mono-label">CAPITAL MISSION</span><h2>{mission.prompt || <>{animatedText}<i /></>}</h2></div>
            <button type="button" onClick={() => setEditing(true)}>Edit mission</button>
          </div>
          <div className="ap-prompt-starters" aria-label="Capital mission starters">
            <span>Frame it as</span>
            <button type="button" onClick={() => chooseStarter(0)}>Where can I…</button>
            <button type="button" onClick={() => chooseStarter(1)}>How can I…</button>
            <button type="button" onClick={() => chooseStarter(2)}>What must…</button>
          </div>
        </>
      )}
    </div>
  );
}

function MissionBuilder({ mission, scenario, thesisMode, onChange, onChangeMode }: { mission: CapitalMission; scenario: PressureTestScenario; thesisMode: ThesisEntryMode; onChange: (value: CapitalMission) => void; onChangeMode: (mode: ThesisEntryMode) => void }) {
  const presets = useMemo(() => missionPresetsFor(scenario), [scenario]);
  const [selectedPreset, setSelectedPreset] = useState<MissionPreset["id"]>("smart");
  const activePreset = presets.find((preset) => preset.id === selectedPreset) ?? presets[0];
  useEffect(() => setSelectedPreset("smart"), [scenario.id]);
  const setNumber = (key: "capital" | "target" | "maxLoss", value: string) => onChange({ ...mission, [key]: Math.max(0, Number(value) || 0) });
  const hasAssignedThesis = Boolean(scenario.thesisTitle);
  const sourceAction = () => {
    if (hasAssignedThesis) return onChangeMode(thesisMode === "assigned" ? "new" : "assigned");
    onChange({ ...mission, thesis: mission.thesis ? "" : scenario.draftThesis ?? "" });
  };
  const choosePreset = (id: MissionPreset["id"]) => {
    const preset = presets.find((item) => item.id === id) ?? presets[0];
    setSelectedPreset(preset.id);
    onChange({ ...preset.mission, thesis: mission.thesis });
  };
  return (
    <>
      <div className="ap-thesis-start-row">
        <div className="ap-thesis-source" data-mode={thesisMode}>
          <div className="ap-thesis-source-icon">{thesisMode === "assigned" ? <BookOpen size={17} /> : <Sparkles size={17} />}</div>
          <div><span className="ap-mono-label">{thesisMode === "assigned" ? "ASSIGNED THESIS LOADED" : "NO THESIS ASSIGNED"}</span><strong>{thesisMode === "assigned" ? scenario.thesisTitle : "Build a thesis in this surface"}</strong><p>{thesisMode === "assigned" ? "Run-specific edits leave the saved thesis unchanged." : "Build here without losing the capital mission."}</p></div>
          <button type="button" onClick={sourceAction}>{hasAssignedThesis ? (thesisMode === "assigned" ? "New thesis" : "Reload thesis") : (mission.thesis ? "Clear draft" : "Use draft")}</button>
        </div>
        <label className="ap-mission-library">
          <span className="ap-mono-label">MISSION LIBRARY · RANKED FOR THIS RUN</span>
          <select aria-label="Choose a contextual capital mission" value={selectedPreset} onChange={(event) => choosePreset(event.target.value as MissionPreset["id"])}>
            {presets.map((preset, index) => <option key={preset.id} value={preset.id}>{index + 1}. {preset.label}</option>)}
          </select>
          <div><span>{activePreset.badge}</span><p>{activePreset.reason}</p></div>
        </label>
      </div>
      <AnimatedPromptEditor mission={mission} scenario={scenario} onChange={onChange} />
      <p className="ap-lede">This is the thesis builder. {thesisMode === "assigned" ? "Review or edit the loaded thesis for this run" : "Build the thesis directly here"}; Aperture compiles it into a small paper-play slate without promising the requested return.</p>
      <div className="ap-mission-statement">
        <label><span>Capital available</span><div className="ap-money-input"><b>$</b><input aria-label="Capital available" type="number" min="0" step="500" value={mission.capital} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setNumber("capital", event.target.value)} /></div><small>Available for this mission</small></label>
        <label><span>Desired ending value</span><div className="ap-money-input"><b>$</b><input aria-label="Desired ending value" type="number" min="0" step="500" value={mission.target} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setNumber("target", event.target.value)} /></div><small>Aspiration · not forecast</small></label>
        <label><span>Time boundary</span><select aria-label="Time boundary" value={mission.horizon} onChange={(event) => onChange({ ...mission, horizon: event.target.value as HorizonKey })}>{Object.entries(HORIZONS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select><small>{HORIZONS[mission.horizon].detail}</small></label>
        <label><span>Maximum planned loss</span><div className="ap-money-input"><b>$</b><input aria-label="Maximum planned loss" type="number" min="0" step="25" value={mission.maxLoss} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setNumber("maxLoss", event.target.value)} /></div><small>Hard paper ceiling</small></label>
      </div>
      <label className="ap-thesis-expression-editor">
        <Sparkles size={16} />
        <span><strong>Thesis expression</strong><textarea aria-label="Thesis expression" rows={2} value={mission.thesis} onChange={(event) => onChange({ ...mission, thesis: event.target.value })} /></span>
        <small>editable</small>
      </label>
    </>
  );
}

function PlayEvidence({ scenario, onInspect }: { scenario: PressureTestScenario; onInspect: () => void }) {
  return (
    <div className="ap-evidence-anchors">
      {scenario.requiredNow.slice(0, 3).map((item, index) => <button key={item} onClick={onInspect}>{index === 2 ? <ShieldCheck size={16} /> : <CheckCircle2 size={16} />}<span><strong>{["Decision evidence", "Current gate", "Risk boundary"][index]}</strong>{item}</span><small>{scenario.result === "eligible" ? "verified" : scenario.result === "conditional" ? "review" : "blocked"}</small></button>)}
    </div>
  );
}

function StageContent({ step, scenario, mission, setMission, thesisMode, setThesisMode, missionMath, acknowledgement, setAcknowledgement, outcome, setOutcome, outcomeReady, onInspect }: {
  step: number;
  scenario: PressureTestScenario;
  mission: CapitalMission;
  setMission: (value: CapitalMission) => void;
  thesisMode: ThesisEntryMode;
  setThesisMode: (value: ThesisEntryMode) => void;
  missionMath: MissionMath;
  acknowledgement: string;
  setAcknowledgement: (value: string) => void;
  outcome: OutcomeChoice;
  setOutcome: (value: OutcomeChoice) => void;
  outcomeReady: boolean;
  onInspect: () => void;
}) {
  const horizon = HORIZONS[mission.horizon];
  const targetGap = mission.target - missionMath.endingAtTwoFiveR;
  const changeThesisMode = (mode: ThesisEntryMode) => {
    setThesisMode(mode);
    setMission(missionForScenario(scenario, mode));
  };
  if (step === 0) return (
    <div className="ap-stage-content">
      <StatusPill tone="ink">{horizon.label} · {horizon.detail}</StatusPill>
      <MissionBuilder mission={mission} scenario={scenario} thesisMode={thesisMode} onChange={setMission} onChangeMode={changeThesisMode} />
      <div className="ap-target-boundary"><AlertTriangle size={17} /><div><strong>The target requires a {missionMath.requiredReturn.toFixed(0)}% return inside this horizon.</strong><span>Aperture will rank qualifying plays, but it will explicitly say when no credible setup reaches the target inside the loss ceiling.</span></div></div>
    </div>
  );

  if (step === 1) return (
    <div className="ap-stage-content">
      <StatusPill tone={scenario.result === "eligible" ? "green" : scenario.result === "conditional" ? "amber" : "clay"}>{scenario.result === "eligible" ? "Play slate ready" : scenario.result === "conditional" ? "Condition review" : "No qualifying play"}</StatusPill>
      <h2>{scenario.universe.researched} candidates became {scenario.result === "no_trade" ? "one capital decision" : `${scenario.plays.length + 1} operator choices`}.</h2>
      <p className="ap-lede">The operator reviews decision-distinct plays, not every ticker. Correlated names, failed triggers and weaker expressions are parked with explicit reasons.</p>
      <div className="ap-research-stats">
        <div><strong>{scenario.universe.researched}</strong><span>researched</span></div>
        <div><strong>{scenario.universe.cleared}</strong><span>cleared hard gates</span></div>
        <div><strong>{scenario.result === "no_trade" ? "cash" : `${scenario.plays.length} + cash`}</strong><span>operator choices</span></div>
        <div><strong>{scenario.universe.parked}</strong><span>parked with reasons</span></div>
      </div>
      {scenario.result === "no_trade" ? (
        <>
          <div className="ap-control-decision"><ShieldCheck size={20} /><div><span className="ap-mono-label">PRIMARY OUTCOME</span><strong>Preserve cash</strong><p>{scenario.summary}</p></div><StatusPill tone="clay">no trade</StatusPill></div>
          <div className="ap-blocked-candidates">{scenario.plays.map((play) => <button key={`${play.symbol}-${play.title}`} onClick={onInspect}><span><strong>{play.symbol} · {play.title}</strong><small>{play.evidenceLabel}</small></span><StatusPill tone="clay">blocked</StatusPill></button>)}</div>
        </>
      ) : (
        <div className="ap-play-slate">
          {scenario.plays.map((play, index) => <button key={`${play.symbol}-${play.title}`} className={index === 0 ? "is-top" : undefined}><span className="ap-mono-label">{index === 0 ? (scenario.result === "conditional" ? "LEADING CONDITION" : "TOP PLAY") : "ALTERNATIVE"}</span><strong>{play.symbol} · {play.title}</strong><p>{play.playType} · {formatCurrency(play.plannedLoss)} planned loss</p><small>{play.evidenceLabel}</small></button>)}
          <button><span className="ap-mono-label">CONTROL</span><strong>Preserve cash</strong><p>Deploy $0 · planned loss $0</p><small>{scenario.noTradeCondition}</small></button>
        </div>
      )}
      <button className="ap-parked-link" onClick={onInspect}>View grouped reasons, watchlist and parked universe</button>
    </div>
  );

  if (step === 2) return (
    <div className="ap-stage-content">
      <StatusPill tone={scenario.result === "eligible" ? "green" : scenario.result === "conditional" ? "amber" : "clay"}>{scenario.result === "eligible" ? "Top qualifying play" : scenario.result === "conditional" ? "Best available condition" : "No-trade decision"}</StatusPill>
      <h2>{scenario.result === "no_trade" ? `Preserve cash—${scenario.blockingGate}` : `${scenario.plays[0].symbol} ${scenario.result === "eligible" ? "is the best available deployment" : "leads, but is not ready"}—without pretending it turns ${formatCurrency(mission.capital)} into ${formatCurrency(mission.target)}.`}</h2>
      <p className="ap-lede">{scenario.summary} Deep evidence remains optional; the decisive gate is visible here.</p>
      {scenario.result !== "no_trade" && <div className="ap-payoff-strip">
        <div><span>Deploy</span><strong>{formatCurrency(missionMath.notional)}</strong><small>{formatCurrency(missionMath.cash)} remains cash</small></div>
        <div><span>Planned loss</span><strong>−{formatCurrency(missionMath.plannedLoss)}</strong><small>{formatCurrency(mission.maxLoss)} hard ceiling</small></div>
        <div><span>1.5R mission value</span><strong>{formatCurrency(missionMath.endingAtOneFiveR)}</strong><small>+{formatCurrency(missionMath.gainAtOneFiveR)} modeled gain</small></div>
        <div><span>2.5R mission value</span><strong>{formatCurrency(missionMath.endingAtTwoFiveR)}</strong><small>+{formatCurrency(missionMath.gainAtTwoFiveR)} modeled gain</small></div>
      </div>}
      <div className="ap-target-boundary is-neutral"><Target size={17} /><div><strong>{scenario.result === "no_trade" ? scenario.blockingGate : targetGap > 0 ? `The 2.5R model remains ${formatCurrency(targetGap)} below the requested ending value.` : "The modeled range reaches the aspiration, but it is not a forecast."}</strong><span>{scenario.result === "no_trade" ? scenario.noTradeCondition : targetGap > 0 ? "Closing that gap would require violating the stated loss ceiling or inventing unsupported probability." : "The outcome still depends on the named trigger, stop and evidence remaining valid."}</span></div></div>
      <PlayEvidence scenario={scenario} onInspect={onInspect} />
      <button className="ap-analysis-fork" onClick={onInspect}><FileSearch size={17} /><span><strong>Want to inspect the logic?</strong>Open the analysis, opposing evidence, calculations and 12 source records.</span><PanelRightOpen size={16} /></button>
    </div>
  );

  if (step === 3) return (
    <div className="ap-stage-content">
      <StatusPill tone={scenario.result === "eligible" ? "green" : "amber"}>{scenario.result === "eligible" ? "Plan eligible" : "Plan held"}</StatusPill>
      <h2>{scenario.plays[0].symbol} · {scenario.plays[0].title}</h2>
      <p className="ap-lede">{scenario.result === "eligible" ? "The operator can reach this plan directly from the trusted summary." : `This plan remains visible for review, but cannot advance: ${scenario.blockingGate}`} Assumptions and provenance remain optional depth.</p>
      <div className="ap-plan-hero">
        <div><span>Entry condition</span><strong>{scenario.plays[0].playType}</strong><small>{scenario.plays[0].entry}</small></div>
        <div><span>Invalidation</span><strong>{scenario.plays[0].evidenceState}</strong><small>{scenario.plays[0].stop}</small></div>
        <div><span>Paper size</span><strong>{missionMath.units} {scenario.plays[0].unitLabel}</strong><small>{formatCurrency(missionMath.notional)} notional</small></div>
        <div><span>Planned loss</span><strong>{formatCurrency(missionMath.plannedLoss)}</strong><small>{formatCurrency(mission.maxLoss)} ceiling</small></div>
      </div>
      <div className="ap-mandate-line"><ShieldCheck size={17} /><div><strong>{scenario.result === "eligible" ? "All required gates source-backed" : "Approval remains unavailable"}</strong><span>{scenario.result === "eligible" ? "Thesis fit · liquidity · horizon · loss ceiling · invalidation" : scenario.blockingGate}</span></div><button onClick={onInspect}>Inspect evidence</button></div>
      <div className="ap-stop-line"><Target size={17} /><div><strong>Refusal condition</strong><span>{scenario.noTradeCondition}</span></div></div>
    </div>
  );

  if (step === 4) return (
    <div className="ap-stage-content">
      <StatusPill tone="ink">Human approval required</StatusPill>
      <h2>Approve the version you reviewed—not a moving target.</h2>
      <p className="ap-lede">The approved receipt binds to Top Play v1 and Paper Plan v1. This creates a paper-tracking record only.</p>
      <div className="ap-approval-receipt">
        <div><span>Decision</span><strong>{scenario.plays[0].symbol} · {scenario.plays[0].title}</strong></div>
        <div><span>Maximum planned loss</span><strong>{formatCurrency(missionMath.plannedLoss)} · {formatCurrency(mission.maxLoss)} ceiling</strong></div>
        <div><span>Live preflight</span><strong>{scenario.plays[0].entry}</strong></div>
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
        <div><Clock3 size={18} /><span>Outcome due</span><strong>{horizon.label}</strong><small>{horizon.due}</small></div>
        <div><Activity size={18} /><span>Trigger</span><strong>Watching</strong><small>{scenario.plays[0].entry}</small></div>
        <div><ShieldCheck size={18} /><span>Invalidation</span><strong>Intact</strong><small>{scenario.plays[0].stop}</small></div>
      </div>
      <div className="ap-change-log"><span className="ap-mono-label">NEW SINCE APPROVAL</span><div><Circle size={8} fill="currentColor" /><p><strong>No decision-changing evidence.</strong> Market data refreshed 4 minutes ago.</p></div></div>
    </div>
  );

  if (scenario.result === "no_trade") return (
    <div className="ap-stage-content">
      <StatusPill tone="green">No-trade record ready</StatusPill>
      <h2>Cash preserved. The workflow still produced a decision.</h2>
      <p className="ap-lede">No approval or monitoring record is created. The decisive blocker and conditions that would reopen research remain attached to this fixture.</p>
      <div className="ap-control-decision"><ShieldCheck size={20} /><div><span className="ap-mono-label">CONTROL OUTCOME</span><strong>{scenario.blockingGate}</strong><p>{scenario.noTradeCondition}</p></div><StatusPill tone="ink">$0 at risk</StatusPill></div>
      <div className="ap-learning-record"><FileCheck2 size={18} /><div><span className="ap-mono-label">TEST ASSERTION</span><p>{scenario.acceptance}</p></div></div>
    </div>
  );

  if (scenario.result === "conditional") return (
    <div className="ap-stage-content">
      <StatusPill tone="amber">Pending condition</StatusPill>
      <h2>Queue the gate—not a premature approval.</h2>
      <p className="ap-lede">The proposal returns when the named condition can be evaluated. It does not pass through approval or monitoring while the gate remains unresolved.</p>
      <div className="ap-outcome-queue-card">
        <div className="ap-outcome-queue-icon"><Clock3 size={20} /></div>
        <div><span className="ap-mono-label">PENDING GATE REVIEW · 1</span><strong>{scenario.plays[0].symbol} · {scenario.name}</strong><p>{scenario.blockingGate} · review {horizon.due}</p></div>
        <StatusPill tone="ink">held</StatusPill>
      </div>
      <div className="ap-queue-policy"><ShieldCheck size={17} /><div><strong>Approval remains unavailable.</strong><span>{scenario.noTradeCondition}</span></div></div>
    </div>
  );

  if (!outcomeReady) return (
    <div className="ap-stage-content">
      <StatusPill tone="amber">Pending outcome</StatusPill>
      <h2>Come back when the play reaches its review time.</h2>
      <p className="ap-lede">Approval starts monitoring; it does not force an immediate verdict. Aperture places the study in Pending Outcomes and prompts the operator when the declared horizon arrives.</p>
      <div className="ap-outcome-queue-card">
        <div className="ap-outcome-queue-icon"><Clock3 size={20} /></div>
        <div><span className="ap-mono-label">PENDING OUTCOMES · 1</span><strong>{scenario.plays[0].symbol} · {scenario.thesisTitle}</strong><p>{horizon.detail} · review due {horizon.due}</p></div>
        <StatusPill tone="ink">waiting</StatusPill>
      </div>
      <div className="ap-queue-policy"><ShieldCheck size={17} /><div><strong>Safe to leave this workflow.</strong><span>Day trades return at market close. Weekly, 30-day and long-term studies stay queued until their declared review point.</span></div></div>
    </div>
  );

  return (
    <div className="ap-stage-content">
      <StatusPill tone={outcome ? "green" : "ink"}>{outcome ? "Closure ready" : "Review time reached"}</StatusPill>
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

function Inspector({ step, scenario, missionMath, onClose }: { step: number; scenario: PressureTestScenario; missionMath: MissionMath; onClose?: () => void }) {
  const items = [
    ["Mission compiler", "Aperture separates the operator’s desired ending value from the evidence-backed outcome range and treats the edited loss value as a hard ceiling."],
    ["Universe compression", `${scenario.universe.researched} researched candidates became ${scenario.result === "no_trade" ? "one cash decision" : `${scenario.plays.length} modeled expressions plus cash`}. ${scenario.universe.parked} remain parked with reasons.`],
    ["Full decision logic", scenario.summary],
    ["Modeled arithmetic", `${missionMath.units} ${scenario.plays[0].unitLabel} represent ${formatCurrency(missionMath.notional, 2)} notional and ${formatCurrency(missionMath.plannedLoss, 2)} planned loss. These are fixture calculations, not quotes.`],
    ["Approval boundary", scenario.result === "eligible" ? "Paper Plan v1 is bound to Top Play v1. No live brokerage action is represented." : `Approval is unavailable while this fixture remains ${scenario.result.replace("_", " ")}.`],
    ["Monitoring scope", `Only the trigger, invalidation and time boundary matter: ${scenario.plays[0].timeBoundary}.`],
    ["Outcome queue", scenario.result === "eligible" ? "The approved study waits until its declared horizon." : "The held or no-trade decision skips brokerage approval and keeps its blocker attached."],
  ][step];
  return (
    <aside className="ap-inspector" aria-label="Context inspector">
      <header><div><span className="ap-mono-label">CONTEXT INSPECTOR</span><strong>{items[0]}</strong></div>{onClose && <button onClick={onClose} aria-label="Close inspector"><X size={16} /></button>}</header>
      <section><span className="ap-mono-label">WHY THIS MATTERS</span><p>{items[1]}</p></section>
      <section><span className="ap-mono-label">OPTIONAL DEPTH</span><p>{scenario.optionalDepth.join(" · ")}</p></section>
      <section><span className="ap-mono-label">PRESSURE POINTS</span><p>{scenario.uiRisks.join(" · ")}</p></section>
      <section><span className="ap-mono-label">PROVENANCE</span><p>Illustrative/modelled fixture · viewed locally · no external request · no market claim</p></section>
      <section><span className="ap-mono-label">ACCEPTANCE ASSERTION</span><p>{scenario.acceptance}</p></section>
      <div className="ap-inspector-stamp"><LockKeyhole size={15} /> Audit detail remains attached to the decision</div>
    </aside>
  );
}

function PrimaryAction({ step, scenario, mission, acknowledgement, outcome, outcomeReady, onAdvance, onBack }: {
  step: number; scenario: PressureTestScenario; mission: CapitalMission; acknowledgement: string; outcome: OutcomeChoice; outcomeReady: boolean; onAdvance: () => void; onBack: () => void;
}) {
  const eligibleLabels = ["Compile capital thesis", "Open the top play", "Review paper plan", "Review paper approval", "Approve for paper tracking", "Queue outcome review", outcomeReady ? "Save outcome & restart" : "Prototype: simulate review time"];
  const conditionalLabels: Record<number, string> = { 0: "Compile capital thesis", 1: "Open the leading condition", 2: "Review held paper plan", 3: "Queue gate review", 6: "Restart scenario" };
  const noTradeLabels: Record<number, string> = { 0: "Compile capital thesis", 1: "Review the cash decision", 2: "Record no-trade", 6: "Restart scenario" };
  const label = scenario.result === "eligible" ? eligibleLabels[step] : scenario.result === "conditional" ? conditionalLabels[step] : noTradeLabels[step];
  const disabled = (step === 0 && (!mission.prompt.trim() || !mission.thesis.trim())) || (scenario.result === "eligible" && step === 4 && acknowledgement !== "PAPER") || (scenario.result === "eligible" && step === 6 && outcomeReady && !outcome);
  const eligibleHints = [
    "Captures a target and risk boundary; it does not promise a return.", "Opens one play, not 57 candidate reviews.", "Deep analysis is optional because required gates pass.",
    "No proposal is submitted.", "Creates a fixture-only approval receipt.", "Schedules the review at the declared horizon.", outcomeReady ? "The local fixture resets after closure." : "Production users leave and return; this advances the local fixture.",
  ];
  const hint = scenario.result === "eligible" ? eligibleHints[step] : step === 0 ? "Compile the mission without inventing a thesis or promised return." : step === 6 ? "The fixture resets; no order or database record is created." : scenario.result === "conditional" ? "The unresolved gate stays visible and approval remains unavailable." : "Cash is recorded as an intentional, controlled outcome.";
  return (
    <footer className="ap-action-dock">
      <div><span className="ap-mono-label">NEXT GUARDED ACTION</span><p>{hint}</p></div>
      <div className="ap-action-buttons">
        {step > 0 && <button className="ap-button-secondary" onClick={onBack}><ArrowLeft size={15} /> Back</button>}
        <button className="ap-button-primary" onClick={onAdvance} disabled={disabled}>{label} <ArrowRight size={15} /></button>
      </div>
    </footer>
  );
}

type VariantProps = {
  step: number;
  setStep: (step: number) => void;
  scenario: PressureTestScenario;
  mission: CapitalMission;
  setMission: (value: CapitalMission) => void;
  thesisMode: ThesisEntryMode;
  setThesisMode: (value: ThesisEntryMode) => void;
  missionMath: MissionMath;
  acknowledgement: string;
  setAcknowledgement: (value: string) => void;
  outcome: OutcomeChoice;
  setOutcome: (value: OutcomeChoice) => void;
  outcomeReady: boolean;
  setOutcomeReady: (value: boolean) => void;
  inspectorOpen: boolean;
  setInspectorOpen: (value: boolean) => void;
  onAdvance: () => void;
  onBack: () => void;
};

function CurrentStage(props: VariantProps) {
  return <StageContent step={props.step} scenario={props.scenario} mission={props.mission} setMission={props.setMission} thesisMode={props.thesisMode} setThesisMode={props.setThesisMode} missionMath={props.missionMath} acknowledgement={props.acknowledgement} setAcknowledgement={props.setAcknowledgement} outcome={props.outcome} setOutcome={props.setOutcome} outcomeReady={props.outcomeReady} onInspect={() => props.setInspectorOpen(true)} />;
}

function VariantA(props: VariantProps) {
  return (
    <main className="ap-variant ap-variant-runway">
      <ContextBar scenario={props.scenario} thesisMode={props.thesisMode} onInspector={() => props.setInspectorOpen(true)} />
      <StageRail current={props.step} result={props.scenario.result} onSelect={props.setStep} />
      <div className="ap-runway-layout" data-inspector={props.inspectorOpen}>
        <article className="ap-decision-packet">
          <header className="ap-packet-header"><div><span className="ap-mono-label">{STAGES[props.step].eyebrow}</span><h1>{STAGES[props.step].label}</h1></div><span className="ap-version">VERSION {props.step < 2 ? 1 : 4}</span></header>
          <CurrentStage {...props} />
          <PrimaryAction {...props} />
        </article>
        {props.inspectorOpen && <Inspector step={props.step} scenario={props.scenario} missionMath={props.missionMath} onClose={() => props.setInspectorOpen(false)} />}
      </div>
    </main>
  );
}

function VariantB(props: VariantProps) {
  return (
    <main className="ap-variant ap-variant-desk">
      <ContextBar scenario={props.scenario} thesisMode={props.thesisMode} onInspector={() => props.setInspectorOpen(true)} />
      <div className="ap-desk-grid">
        <aside className="ap-workset">
          <header><span className="ap-mono-label">ACTIVE WORKSET</span><button aria-label="Search candidates"><Search size={15} /></button></header>
          {props.scenario.plays.map((play, index) => <button key={`${play.symbol}-${play.title}`} data-active={index === 0}><span className="ap-workset-symbol">{play.symbol}</span><small data-tone={play.evidenceState === "verified" ? "amber" : play.evidenceState === "blocked" ? "clay" : "muted"}>{play.evidenceState}</small></button>)}
          <button><span className="ap-workset-symbol">CASH</span><small data-tone="muted">control</small></button>
          <button className="ap-view-all">Open grouped universe</button>
        </aside>
        <article className="ap-desk-canvas">
          <StageRail current={props.step} result={props.scenario.result} onSelect={props.setStep} />
          <header className="ap-packet-header"><div><span className="ap-mono-label">{STAGES[props.step].eyebrow}</span><h1>{STAGES[props.step].question}</h1></div><span className="ap-version">{props.scenario.plays[0].symbol}</span></header>
          <CurrentStage {...props} />
          <PrimaryAction {...props} />
        </article>
        <Inspector step={props.step} scenario={props.scenario} missionMath={props.missionMath} />
      </div>
    </main>
  );
}

function VariantC(props: VariantProps) {
  return (
    <main className="ap-variant ap-variant-file">
      <ContextBar scenario={props.scenario} thesisMode={props.thesisMode} onInspector={() => props.setInspectorOpen(true)} />
      <div className="ap-case-layout">
        <aside className="ap-artifact-stack">
          <span className="ap-mono-label">APERTURE CASE FILE</span>
          <h2>{props.scenario.thesisTitle ?? "Thesis builder"}</h2>
          <ol>{stageIndexesFor(props.scenario.result).map((index, position) => { const stage = STAGES[index]; const currentPosition = stageIndexesFor(props.scenario.result).indexOf(props.step); return <li key={stage.id} data-state={position < currentPosition ? "complete" : position === currentPosition ? "current" : "future"}><button disabled={position > currentPosition} onClick={() => props.setStep(index)}><span>{position < currentPosition ? <Check size={13} /> : position + 1}</span><div><strong>{stage.label}</strong><small>{position < currentPosition ? "receipt saved" : position === currentPosition ? "open now" : "locked"}</small></div></button></li>; })}</ol>
          <button className="ap-context-capsule" onClick={() => props.setInspectorOpen(!props.inspectorOpen)}><Landmark size={16} /><span><strong>Context capsule</strong><small>Account, mandate, provenance</small></span><PanelRightOpen size={15} /></button>
        </aside>
        <article className="ap-case-document">
          <header className="ap-document-header"><div><span className="ap-mono-label">{STAGES[props.step].eyebrow}</span><h1>{STAGES[props.step].label}</h1><p>{STAGES[props.step].question}</p></div><div className="ap-document-stamp">PAPER ONLY<br /><small>VERSION {props.step < 2 ? 1 : 4}</small></div></header>
          <CurrentStage {...props} />
          {props.inspectorOpen && <Inspector step={props.step} scenario={props.scenario} missionMath={props.missionMath} onClose={() => props.setInspectorOpen(false)} />}
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
  const [scenario, setScenario] = useState<PressureTestScenario>(readScenario);
  const [step, setStep] = useState(0);
  const [mission, setMission] = useState<CapitalMission>(() => { const initial = readScenario(); return missionForScenario(initial, initial.thesisTitle ? "assigned" : "new"); });
  const [thesisMode, setThesisMode] = useState<ThesisEntryMode>(() => readScenario().thesisTitle ? "assigned" : "new");
  const [acknowledgement, setAcknowledgement] = useState("");
  const [outcome, setOutcome] = useState<OutcomeChoice>(null);
  const [outcomeReady, setOutcomeReady] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const missionMath = useMemo(() => deriveMissionMath(mission, scenario), [mission, scenario]);

  const updateVariant = (next: VariantKey) => { setVariant(next); setVariantInUrl(next); };
  const resetScenario = (next: PressureTestScenario) => { const mode = next.thesisTitle ? "assigned" : "new"; setStep(0); setMission(missionForScenario(next, mode)); setThesisMode(mode); setAcknowledgement(""); setOutcome(null); setOutcomeReady(false); setInspectorOpen(false); };
  const updateScenario = (next: PressureTestScenario) => { setScenario(next); setScenarioInUrl(next); resetScenario(next); };
  const restart = () => resetScenario(scenario);
  const onAdvance = () => {
    const activeIndexes = stageIndexesFor(scenario.result);
    const position = activeIndexes.indexOf(step);
    if (position === activeIndexes.length - 1) {
      if (scenario.result === "eligible" && !outcomeReady) return setOutcomeReady(true);
      return restart();
    }
    setInspectorOpen(false);
    setStep(activeIndexes[position + 1]);
  };
  const onBack = () => { const activeIndexes = stageIndexesFor(scenario.result); const position = activeIndexes.indexOf(step); setInspectorOpen(false); setStep(activeIndexes[Math.max(0, position - 1)]); };
  const props = useMemo<VariantProps>(() => ({ step, setStep, scenario, mission, setMission, thesisMode, setThesisMode, missionMath, acknowledgement, setAcknowledgement, outcome, setOutcome, outcomeReady, setOutcomeReady, inspectorOpen, setInspectorOpen, onAdvance, onBack }), [step, scenario, mission, thesisMode, missionMath, acknowledgement, outcome, outcomeReady, inspectorOpen]);

  return (
    <div className="ap-runway">
      <PrototypeHeader scenario={scenario} onSelectScenario={updateScenario} onRestart={restart} />
      {variant === "A" ? <VariantA {...props} /> : variant === "B" ? <VariantB {...props} /> : <VariantC {...props} />}
      {import.meta.env.DEV && <PrototypeSwitcher variant={variant} setVariant={updateVariant} />}
    </div>
  );
}
