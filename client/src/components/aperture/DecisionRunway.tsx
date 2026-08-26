import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, ChevronDown, CircleSlash2, FileSearch, Pencil, ShieldCheck, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { DailyPlayList } from "./DailyPlayList";

type Branch = "research" | "conditional" | "cash";
type HoldingPeriod = "intraday" | "overnight" | "swing" | "catalyst_window";
type Objective = "best_qualified_play" | "deploy_today" | "verify_catalyst" | "portfolio_gap" | "preserve_optionality";

type Props = {
  onNewResearch: () => void;
  onOpenResearchRun: (runId: number) => void;
  onOpenRun: (runId: number, candidateId: number, view?: string) => void;
};

function parseMoney(value: string) {
  const amount = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function displayMoney(value: string) {
  const amount = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) ? amount.toLocaleString("en-US", { maximumFractionDigits: 0 }) : value;
}

function missionFor(thesis: string, capital: string, holding: HoldingPeriod) {
  const horizon = holding === "intraday" ? "today" : holding === "overnight" ? "through the next close" : holding === "swing" ? "this week" : "inside the named catalyst window";
  return "Where can I best deploy $" + displayMoney(capital) + " against my " + thesis + " thesis " + horizon + " without exceeding the planned-loss ceiling?";
}

function branchLabel(branch?: string) {
  if (branch === "cash") return "Cash / no-trade recorded";
  if (branch === "conditional") return "Conditional · queued for review";
  if (branch === "eligible") return "Eligible for paper preparation";
  return "Paper research context";
}

export function DecisionRunway({ onNewResearch, onOpenResearchRun, onOpenRun }: Props) {
  const utils = trpc.useUtils();
  const { data: runway } = trpc.aperture.runway.latest.useQuery();
  const { data: canonicalTheses } = trpc.thesis.list.useQuery();
  const { data: capitalTheses } = trpc.aperture.thesis.list.useQuery();
  const { data: accounts } = trpc.aperture.account.list.useQuery();
  const [selectedCanonicalId, setSelectedCanonicalId] = useState<number | null>(null);
  const activeCanonicalId = selectedCanonicalId ?? runway?.activeCanonicalThesisId ?? null;
  const activeThesis = useMemo(() => (canonicalTheses ?? []).find((item) => item.id === activeCanonicalId) ?? null, [canonicalTheses, activeCanonicalId]);
  const projection = useMemo(() => (capitalTheses ?? []).find((item) => item.sourceCompilationId === activeCanonicalId) ?? null, [capitalTheses, activeCanonicalId]);
  const paperAccount = useMemo(() => (accounts ?? []).find((item) => item.isPaper && item.brokerId === "alpaca_paper") ?? (accounts ?? []).find((item) => item.isPaper) ?? null, [accounts]);

  const [capital, setCapital] = useState("5000");
  const [desiredEnding, setDesiredEnding] = useState("8000");
  const [maxLoss, setMaxLoss] = useState("150");
  const [holdingPeriod, setHoldingPeriod] = useState<HoldingPeriod>("intraday");
  const [objective, setObjective] = useState<Objective>("deploy_today");
  const [instrument, setInstrument] = useState<"shares" | "options" | "either">("shares");
  const [includeHeld, setIncludeHeld] = useState(false);
  const [mission, setMission] = useState("");
  const [missionDirty, setMissionDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showTune, setShowTune] = useState(false);
  const [showAllMissions, setShowAllMissions] = useState(false);
  const [branch, setBranch] = useState<Branch>("research");
  const [reason, setReason] = useState("");
  const [blocker, setBlocker] = useState("");
  const [reopen, setReopen] = useState("");
  const [gateLabel, setGateLabel] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newBelief, setNewBelief] = useState("");

  useEffect(() => {
    if (!activeThesis || missionDirty) return;
    setMission(missionFor(activeThesis.name ?? "active Capital", capital, holdingPeriod));
  }, [activeThesis, capital, holdingPeriod, missionDirty]);

  const library = trpc.aperture.runway.library.useQuery({
    canonicalThesisId: activeCanonicalId,
    capitalThesisId: projection?.id ?? null,
    accountId: paperAccount?.id ?? null,
    deployableCapitalCents: Math.max(parseMoney(capital), 1),
    holdingPeriod,
    objective,
  });
  const createThesis = trpc.thesis.createCapital.useMutation();
  const projectThesis = trpc.thesis.useInAperture.useMutation();
  const saveMission = trpc.aperture.runway.begin.useMutation();
  const startResearch = trpc.aperture.runway.startResearch.useMutation();
  const busy = createThesis.isPending || projectThesis.isPending || saveMission.isPending || startResearch.isPending;

  const buildThesisHere = async () => {
    try {
      const created = await createThesis.mutateAsync({ name: newTitle.trim(), thesisText: newBelief.trim() });
      await projectThesis.mutateAsync({ compilationId: created.compilationId });
      setSelectedCanonicalId(created.compilationId);
      await Promise.all([
        utils.thesis.list.invalidate(),
        utils.thesis.activeCapital.invalidate(),
        utils.aperture.thesis.list.invalidate(),
        utils.aperture.runway.latest.invalidate(),
      ]);
      toast.success("Thesis assigned to this Capital Mission");
    } catch (error: any) {
      toast.error(error?.message ?? "The thesis could not be prepared.");
    }
  };

  const chooseMission = (item: NonNullable<typeof library.data>[number]) => {
    setMission(item.missionText);
    setMissionDirty(true);
    setObjective(item.objective);
    setEditing(false);
    const nextBranch = item.key === "preserve_cash" ? "cash" : item.readiness === "conditional" ? "conditional" : "research";
    setBranch(nextBranch);
    if (nextBranch !== "research") {
      setReason(item.reasons[0] ?? "A named boundary must clear before research proceeds.");
      setBlocker(nextBranch === "cash" ? "No setup clears the current evidence, freshness, and portfolio boundaries." : "Required context is not verified.");
      setReopen("Re-rank after the blocker changes or new verified evidence arrives.");
      setGateLabel(item.label);
    }
  };

  const commit = async () => {
    if (!activeCanonicalId || !projection || !paperAccount) return toast.error("Assign a thesis projection and paper account first.");
    try {
      const receipt = await saveMission.mutateAsync({
        missionText: mission.trim(),
        canonicalThesisId: activeCanonicalId,
        capitalThesisId: projection.id,
        accountId: paperAccount.id,
        decisionRunId: branch !== "research" && runway?.latest?.authority === "authoritative" && runway.latest.runId != null
          && runway.latest.canonicalThesisId === activeCanonicalId && runway.latest.capitalThesisId === projection.id && runway.latest.accountId === paperAccount.id
          ? runway.latest.id : null,
        branch,
        missionSource: missionDirty ? "edited" : "assigned",
        objective,
        instrumentPreference: instrument,
        includeHeldResearch: includeHeld,
        deployableCapitalCents: parseMoney(capital),
        desiredEndingValueCents: parseMoney(desiredEnding) || null,
        maxPlannedLossCents: parseMoney(maxLoss),
        holdingPeriod,
        invalidationRule: "Invalidate this mission if the assigned thesis, named horizon, liquidity evidence, or planned-loss boundary is no longer true.",
        reason: branch === "research" ? null : reason.trim(),
        blocker: branch === "research" ? null : blocker.trim(),
        reopenCondition: branch === "research" ? null : reopen.trim(),
        reviewAt: branch === "conditional" ? Date.now() + (holdingPeriod === "intraday" ? 1 : holdingPeriod === "swing" ? 7 : 30) * 86_400_000 : null,
        namedGateKey: branch === "conditional" ? "operator-" + objective : null,
        namedGateLabel: branch === "conditional" ? gateLabel.trim() : null,
      });
      await utils.aperture.runway.latest.invalidate();
      if (branch === "research") {
        const started = await startResearch.mutateAsync({ decisionRunId: receipt.decisionRunId, revisionId: receipt.revisionId });
        toast.success("Paper research started from the exact mission revision");
        onOpenResearchRun(started.runId);
      } else {
        toast.success(branch === "cash" ? "Cash / no-trade recorded at $0 risk" : "Conditional review queued");
      }
    } catch (error: any) {
      toast.error(error?.message ?? "The Capital Mission could not be recorded.");
    }
  };

  const latestBranch = runway?.latest?.branch;
  const latestReason = runway?.latest && "reason" in runway.latest ? runway.latest.reason : null;
  const latestBlocker = runway?.latest && "blocker" in runway.latest ? runway.latest.blocker : null;
  const latestReopen = runway?.latest && "reopenCondition" in runway.latest ? runway.latest.reopenCondition : null;
  const dispositionReady = branch === "research" || (reason.trim().length >= 3 && blocker.trim().length >= 3 && reopen.trim().length >= 3 && (branch !== "conditional" || gateLabel.trim().length >= 3));

  return <section className="mx-auto max-w-[1440px] space-y-5 pb-24">
    <div className="grid gap-px overflow-hidden rounded-xl border md:grid-cols-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}>
      {[
        ["Assigned thesis", activeThesis?.name ?? "Not assigned"],
        ["Paper account", paperAccount ? paperAccount.label + (paperAccount.equityValueCents ? " · $" + Math.round(paperAccount.equityValueCents / 100).toLocaleString() : "") : "Not connected"],
        ["Freshness", paperAccount?.lastSyncedAt ? new Date(paperAccount.lastSyncedAt).toLocaleString() : "Not measured"],
        ["Current decision", branchLabel(latestBranch)],
      ].map(([label, value]) => <div key={label} className="p-4" style={{ background: "var(--sh-surface)" }}><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>{label}</p><p className="mt-1 text-sm font-semibold" style={{ color: label === "Current decision" && latestBranch === "cash" ? "var(--sh-signal)" : "var(--sh-text-primary)" }}>{value}</p></div>)}
    </div>

    {!activeThesis && <section className="rounded-2xl border p-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Start here</p>
      <h1 className="mt-1 font-serif text-3xl" style={{ color: "var(--sh-text-primary)" }}>Build the thesis for this mission.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>Name the belief and state what you expect to be true. Aperture keeps you on this operator surface.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-[18rem_1fr_auto] md:items-end">
        <label className="text-xs font-semibold">Thesis name<input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 text-sm" style={{ borderColor: "var(--sh-border-1)" }} placeholder="AI Infrastructure Momentum" /></label>
        <label className="text-xs font-semibold">Belief<textarea value={newBelief} onChange={(event) => setNewBelief(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} placeholder="Liquid infrastructure suppliers may benefit from..." /></label>
        <Button className="min-h-11" disabled={busy || newTitle.trim().length < 2 || newBelief.trim().length < 20} onClick={buildThesisHere}>Assign thesis <ArrowRight className="ml-2 h-4 w-4" /></Button>
      </div>
    </section>}

    {activeThesis && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <article className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
        <header className="flex items-center justify-between gap-4 border-b p-5" style={{ borderColor: "var(--sh-border-1)" }}><div><p className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}><Target className="h-3.5 w-3.5" />Set the Capital Mission</p><p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>One packet, optional depth, one next action.</p></div><span className="rounded border px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>{holdingPeriod.replace("_", " ")}</span></header>
        <div className="space-y-5 p-5 sm:p-7">
          <div className="rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 32%, var(--sh-border-1))", background: "color-mix(in srgb, var(--sh-signal) 6%, var(--sh-surface))" }}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="flex gap-3"><BookOpen className="mt-0.5 h-5 w-5" style={{ color: "var(--sh-signal)" }} /><div><p className="text-[0.62rem] font-semibold uppercase tracking-[0.13em]" style={{ color: "var(--sh-fg-muted)" }}>Assigned thesis loaded</p><p className="mt-1 text-sm font-semibold">{activeThesis.name ?? "Capital thesis"}</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Run-specific edits create a new receipt. The saved thesis remains unchanged.</p></div></div><select aria-label="Switch assigned thesis" className="min-h-10 rounded-md border bg-transparent px-2 text-xs" style={{ borderColor: "var(--sh-border-1)" }} value={activeCanonicalId ?? ""} onChange={(event) => { setSelectedCanonicalId(Number(event.target.value)); setMissionDirty(false); }}><option value="" disabled>Switch thesis</option>{(canonicalTheses ?? []).map((item) => <option key={item.id} value={item.id}>{item.name ?? "Thesis " + item.id}</option>)}</select></div>
          </div>

          <div><div className="flex items-start justify-between gap-3"><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Capital Mission</p><Button variant="ghost" size="sm" className="min-h-10" onClick={() => setEditing((value) => !value)}><Pencil className="mr-2 h-3.5 w-3.5" />{editing ? "Done" : "Edit mission"}</Button></div>
            {editing ? <><Textarea value={mission} onChange={(event) => { setMission(event.target.value); setMissionDirty(true); }} className="mt-2 min-h-32 font-serif text-xl leading-snug sm:text-2xl" /><div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Frame it as</span>{["Where can I…", "How can I…", "What must…"].map((starter) => <button key={starter} type="button" className="min-h-9 rounded-md border px-2.5 text-xs" style={{ borderColor: "var(--sh-border-1)" }} onClick={() => { setMission(starter + " "); setMissionDirty(true); }}>{starter}</button>)}</div></> : <h1 className="mt-2 max-w-4xl font-serif text-3xl leading-[1.08] sm:text-5xl" style={{ color: "var(--sh-text-primary)" }}>{mission}</h1>}
          </div>

          <div className="grid overflow-hidden rounded-xl border sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "var(--sh-border-1)" }}>
            <MoneyField label="Capital available" value={capital} onChange={(value) => { setCapital(value); setMissionDirty(false); }} help="Available for this mission" />
            <MoneyField label="Desired ending value" value={desiredEnding} onChange={setDesiredEnding} help="Aspiration · not forecast" />
            <label className="border-b p-3 text-[0.68rem] sm:border-b-0 sm:border-r" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Time boundary<select className="mt-1 min-h-9 w-full bg-transparent font-serif text-xl" style={{ color: "var(--sh-text-primary)" }} value={holdingPeriod} onChange={(event) => { setHoldingPeriod(event.target.value as HoldingPeriod); setMissionDirty(false); }}><option value="intraday">Today</option><option value="overnight">Next close</option><option value="swing">This week</option><option value="catalyst_window">Catalyst window</option></select><span className="text-[10px]">Outcome queued at horizon</span></label>
            <MoneyField label="Maximum planned loss" value={maxLoss} onChange={setMaxLoss} help="Can tighten, never loosen" />
          </div>

          <details open={showTune} onToggle={(event) => setShowTune(event.currentTarget.open)} className="rounded-xl border" style={{ borderColor: "var(--sh-border-1)" }}><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold"><span>Tune this run</span><ChevronDown className={"h-4 w-4 transition-transform " + (showTune ? "rotate-180" : "")} /></summary><div className="grid gap-4 border-t p-4 sm:grid-cols-3" style={{ borderColor: "var(--sh-border-1)" }}>
            <label className="text-xs font-semibold">Objective<select className="mt-1 min-h-10 w-full rounded-md border bg-transparent px-2" style={{ borderColor: "var(--sh-border-1)" }} value={objective} onChange={(event) => setObjective(event.target.value as Objective)}><option value="best_qualified_play">Best qualified play</option><option value="deploy_today">Deploy today</option><option value="verify_catalyst">Verify catalyst</option><option value="portfolio_gap">Portfolio gap</option><option value="preserve_optionality">Preserve optionality</option></select></label>
            <label className="text-xs font-semibold">Instrument preference<select className="mt-1 min-h-10 w-full rounded-md border bg-transparent px-2" style={{ borderColor: "var(--sh-border-1)" }} value={instrument} onChange={(event) => setInstrument(event.target.value as "shares" | "options" | "either")}><option value="shares">Shares</option><option value="either">Either, if eligible</option><option value="options">Defined-risk options</option></select></label>
            <label className="flex min-h-10 items-center gap-2 self-end text-xs font-semibold"><input type="checkbox" checked={includeHeld} onChange={(event) => setIncludeHeld(event.target.checked)} /> Include held research</label>
          </div></details>

          <div className="rounded-xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><p className="text-sm font-semibold">Choose the disposition</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Research builds a Play Slate. Conditional and cash require a receipt now.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">{([
              { id: "research", label: "Build Play Slate", icon: FileSearch },
              { id: "conditional", label: "Hold for a condition", icon: ShieldCheck },
              { id: "cash", label: "Preserve cash", icon: CircleSlash2 },
            ] as const).map((item) => <button key={item.id} type="button" className="min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-semibold" style={{ borderColor: branch === item.id ? "var(--sh-signal)" : "var(--sh-border-1)", background: branch === item.id ? "color-mix(in srgb, var(--sh-signal) 7%, var(--sh-surface))" : "var(--sh-surface)" }} onClick={() => setBranch(item.id)}><item.icon className="mr-2 inline h-4 w-4" />{item.label}</button>)}</div>
            {branch !== "research" && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold sm:col-span-2">Why this is the right outcome<Textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-16" placeholder="State the decision basis." /></label><TextField label="Current blocker" value={blocker} onChange={setBlocker} /><TextField label="Reopen when" value={reopen} onChange={setReopen} />{branch === "conditional" && <div className="sm:col-span-2"><TextField label="Named gate" value={gateLabel} onChange={setGateLabel} /></div>}</div>}
          </div>
        </div>
        <footer className="flex flex-col gap-3 border-t p-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><p className="max-w-xl text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{branch === "cash" ? "Records $0 at risk and removes Plan, Approval, and Monitor from this journey." : branch === "conditional" ? "Queues the named gate; no proposal or broker path opens." : "Creates research only. A paper proposal remains separate and human-approved."}</p><Button className="min-h-11" disabled={busy || mission.trim().length < 20 || parseMoney(capital) <= 0 || parseMoney(maxLoss) <= 0 || !dispositionReady} onClick={commit}>{busy ? "Recording…" : branch === "cash" ? "Record cash · $0 risk" : branch === "conditional" ? "Queue conditional review" : "Compile Play Slate"}<ArrowRight className="ml-2 h-4 w-4" /></Button></footer>
      </article>

      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <section className="rounded-2xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><div className="flex items-center gap-2"><Sparkles className="h-4 w-4" style={{ color: "var(--sh-signal)" }} /><p className="text-sm font-semibold">Mission Library · ranked for this run</p></div><p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Thesis, holdings, freshness, horizon, and your tune set the order. Ranking never means approval.</p><div className="mt-3 space-y-2">{(showAllMissions ? library.data ?? [] : (library.data ?? []).slice(0, 3)).map((item, index) => <button key={item.key} type="button" className="w-full rounded-xl border p-3 text-left" style={{ borderColor: item.objective === objective ? "var(--sh-signal)" : "var(--sh-border-1)", background: "var(--sh-surface-2)" }} onClick={() => chooseMission(item)}><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{index + 1}. {item.label}</p><span className="text-[0.58rem] font-semibold uppercase tracking-[0.1em]" style={{ color: item.readiness === "conditional" ? "var(--sh-signal)" : "var(--sh-fg-muted)" }}>{item.readiness}</span></div><p className="mt-1 text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>{item.reasons[0]}</p></button>)}</div>{(library.data?.length ?? 0) > 3 && <Button variant="ghost" size="sm" className="mt-2 w-full min-h-10" onClick={() => setShowAllMissions((value) => !value)}>{showAllMissions ? "Show common missions" : "Show " + ((library.data?.length ?? 3) - 3) + " more"}<ChevronDown className={"ml-2 h-4 w-4 " + (showAllMissions ? "rotate-180" : "")} /></Button>}</section>
        <section className="rounded-2xl border p-4 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)" }}><p className="flex items-center gap-2 font-semibold" style={{ color: "var(--sh-text-primary)" }}><CheckCircle2 className="h-4 w-4" style={{ color: "var(--sh-signal)" }} />Decision integrity</p><ul className="mt-2 space-y-1"><li>• Exact thesis, projection, account, and revision binding.</li><li>• Cash and unresolved conditions fail-close opening actions.</li><li>• Desired ending value is an aspiration, not a forecast.</li><li>• Evidence and full math stay one click away.</li></ul><Button variant="ghost" size="sm" className="mt-3 min-h-10 px-0" onClick={onNewResearch}>Open research-only advanced setup</Button></section>
      </aside>
    </div>}

    {latestBranch === "cash" && <section className="rounded-2xl border p-5" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 45%, var(--sh-border-1))", background: "color-mix(in srgb, var(--sh-signal) 7%, var(--sh-surface))" }}><div className="flex items-start justify-between gap-4"><div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Cash receipt · current mission</p><h2 className="mt-1 font-serif text-3xl">$0 at risk.</h2><p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{latestReason ?? "Cash was recorded for the current mission."}</p><p className="mt-2 text-xs"><strong>Blocked by:</strong> {latestBlocker ?? "Named decision boundary"} · <strong>Reopen when:</strong> {latestReopen ?? "A new revision is recorded"}</p></div><CircleSlash2 className="h-7 w-7" style={{ color: "var(--sh-signal)" }} /></div></section>}

    <DailyPlayList onNewResearch={onNewResearch} onOpenRun={onOpenRun} />
  </section>;
}

function MoneyField({ label, value, onChange, help }: { label: string; value: string; onChange: (value: string) => void; help: string }) {
  return <label className="border-b p-3 text-[0.68rem] sm:border-b-0 sm:border-r" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>{label}<div className="mt-1 flex items-center font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}><span>$</span><input inputMode="decimal" value={displayMoney(value)} onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, ""))} className="min-w-0 w-full bg-transparent outline-none" /></div><span className="text-[10px]">{help}</span></label>;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-xs font-semibold">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>;
}
