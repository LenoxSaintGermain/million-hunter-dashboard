import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, BookOpen, CalendarClock, CheckCircle2, ChevronDown, CircleSlash2, FileSearch, Pencil, ShieldCheck, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { missionLibraryBindingState } from "@shared/missionLibraryQuery";
import { aperturePathForFixture, readIsolatedUatIdentity } from "@shared/isolatedUatIdentity";
import { easternDateTimeInputFromEpoch, easternDateTimeInputToEpoch } from "@shared/easternMarketTime";
import { canonicalThesisLabel } from "@shared/canonicalThesisLabel";
import { DailyPlayList } from "./DailyPlayList";
import { ArgumentRail, BasisMark, RiskBudgetBar, StateMark, TypedStatusStrip, type WorkflowState } from "./DecisionVisualLanguage";

type Branch = "research" | "conditional" | "cash";
type HoldingPeriod = "intraday" | "overnight" | "swing" | "catalyst_window" | "position";
type Objective = "best_qualified_play" | "deploy_today" | "verify_catalyst" | "portfolio_gap" | "preserve_optionality";

type Props = {
  onNewResearch: () => void;
  onOpenResearchRun: (runId: number) => void;
  onOpenRun: (runId: number, candidateId: number, view?: string) => void;
  receiptTarget?: { decisionRunId: number; revisionId: number } | null;
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
  const horizon = holding === "intraday" ? "today" : holding === "overnight" ? "through the next close" : holding === "swing" ? "this week" : holding === "position" ? "for the long-term review window" : "inside the named catalyst window";
  const capitalPhrase = capital.trim() ? `$${displayMoney(capital)}` : "the capital available for this mission";
  return "Where can I best deploy " + capitalPhrase + " against my " + thesis + " thesis " + horizon + " without exceeding the planned-loss ceiling?";
}

function branchLabel(branch?: string) {
  if (branch === "cash") return "Cash / no-trade recorded";
  if (branch === "conditional") return "Conditional · queued for review";
  if (branch === "eligible") return "Eligible for paper preparation";
  return "Paper research context";
}

function formatCents(cents: number | null | undefined) {
  return cents == null ? "Not measured" : `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function horizonLabel(holding: HoldingPeriod) {
  return holding === "intraday" ? "Today / by close" : holding === "overnight" ? "Next close" : holding === "swing" ? "This week" : holding === "position" ? "Long term / recurring review" : "Catalyst window";
}

function branchState(branch: Branch | string | null | undefined): WorkflowState {
  if (branch === "cash") return "cash";
  if (branch === "conditional") return "conditional";
  if (branch === "eligible") return "rule_qualified";
  return "researchable";
}

export function DecisionRunway({ onNewResearch, onOpenResearchRun, onOpenRun, receiptTarget = null }: Props) {
  const utils = trpc.useUtils();
  const { data: runway, error: receiptError, isLoading: receiptLoading } = trpc.aperture.runway.latest.useQuery(receiptTarget ?? undefined, { retry: false });
  const { data: canonicalTheses } = trpc.thesis.list.useQuery();
  const { data: capitalTheses } = trpc.aperture.thesis.list.useQuery();
  const { data: accounts } = trpc.aperture.account.list.useQuery();
  const [selectedCanonicalId, setSelectedCanonicalId] = useState<number | null>(null);
  const immutableReceipt = receiptTarget && runway?.latest?.authority === "authoritative" ? runway.latest : null;
  const activeCanonicalId = immutableReceipt?.canonicalThesisId ?? selectedCanonicalId ?? runway?.activeCanonicalThesisId ?? null;
  const activeThesis = useMemo(() => (canonicalTheses ?? []).find((item) => item.id === activeCanonicalId) ?? null, [canonicalTheses, activeCanonicalId]);
  const projection = useMemo(() => immutableReceipt
    ? (capitalTheses ?? []).find((item) => item.id === immutableReceipt.capitalThesisId) ?? null
    : (capitalTheses ?? []).find((item) => item.sourceCompilationId === activeCanonicalId) ?? null, [capitalTheses, activeCanonicalId, immutableReceipt]);
  const paperAccount = useMemo(() => immutableReceipt
    ? (accounts ?? []).find((item) => item.id === immutableReceipt.accountId) ?? null
    : (accounts ?? []).find((item) => item.isPaper && item.brokerId === "alpaca_paper") ?? (accounts ?? []).find((item) => item.isPaper) ?? null, [accounts, immutableReceipt]);
  const cockpit = trpc.aperture.cockpit.useQuery(paperAccount ? { accountId: paperAccount.id } : undefined, { enabled: Boolean(paperAccount) });

  const [capital, setCapital] = useState("");
  const [desiredEnding, setDesiredEnding] = useState("");
  const [maxLoss, setMaxLoss] = useState("");
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
  const [revisingReceipt, setRevisingReceipt] = useState(false);
  const [declaredCatalystAt, setDeclaredCatalystAt] = useState<number | null>(null);
  const [eligibilityReviewAt, setEligibilityReviewAt] = useState("");
  const [outcomeReviewAtInput, setOutcomeReviewAtInput] = useState("");
  const hydratedProjectionId = useRef<number | null>(null);
  const hydratedDecisionRevisionId = useRef<number | null>(null);
  const libraryBindings = missionLibraryBindingState({
    canonicalThesisId: activeCanonicalId,
    capitalThesisId: projection?.id ?? null,
    accountId: paperAccount?.id ?? null,
  });

  useEffect(() => {
    if (!projection || immutableReceipt || hydratedProjectionId.current === projection.id) return;
    hydratedProjectionId.current = projection.id;
    const defaults = projection.missionDefaults;
    setCapital(defaults.deployableCapitalCents == null ? "" : String(defaults.deployableCapitalCents / 100));
    setDesiredEnding(defaults.desiredEndingValueCents == null ? "" : String(defaults.desiredEndingValueCents / 100));
    setMaxLoss(defaults.maxPlannedLossCents == null ? "" : String(defaults.maxPlannedLossCents / 100));
    setHoldingPeriod(defaults.holdingPeriod ?? "intraday");
    setInstrument(defaults.instrumentPreference ?? "either");
    setDeclaredCatalystAt(defaults.catalystAt);
    setEligibilityReviewAt(defaults.eligibilityReviewAt == null ? "" : easternDateTimeInputFromEpoch(defaults.eligibilityReviewAt));
    setOutcomeReviewAtInput(defaults.outcomeReviewAt == null ? "" : easternDateTimeInputFromEpoch(defaults.outcomeReviewAt));
    setObjective(defaults.holdingPeriod === "intraday" ? "deploy_today" : "best_qualified_play");
    setBranch("research");
    setMissionDirty(false);
    setRevisingReceipt(false);
  }, [projection, immutableReceipt]);

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
  }, { enabled: libraryBindings.ready, retry: false });
  const createThesis = trpc.thesis.createCapital.useMutation();
  const projectThesis = trpc.thesis.useInAperture.useMutation();
  const saveMission = trpc.aperture.runway.begin.useMutation();
  const startResearch = trpc.aperture.runway.startResearch.useMutation();
  const busy = createThesis.isPending || projectThesis.isPending || saveMission.isPending || startResearch.isPending;

  const buildThesisHere = async () => {
    try {
      const created = await createThesis.mutateAsync({ name: newTitle.trim(), thesisText: newBelief.trim() });
      const projected = await projectThesis.mutateAsync({ compilationId: created.compilationId });
      setSelectedCanonicalId(created.compilationId);
      await Promise.all([
        utils.thesis.list.invalidate(),
        utils.thesis.activeCapital.invalidate(),
        utils.aperture.thesis.list.invalidate(),
        utils.aperture.runway.latest.invalidate(),
      ]);
      if (projected.compilerStatus === "needs_structure") {
        toast.warning(`Thesis saved. Add ${projected.missingFields.join(", ")} before research; no empty run was created.`);
      } else if (projected.compilerStatus === "operator_structured") {
        toast.success("Operator-declared thesis structure preserved without inferred fields");
      } else {
        toast.success("Thesis assigned to this Capital Mission");
      }
    } catch (error: any) {
      toast.error(error?.message ?? "The thesis could not be prepared.");
    }
  };

  const chooseMission = (item: NonNullable<typeof library.data>[number]) => {
    setMission(item.missionText);
    setMissionDirty(true);
    setObjective(item.objective);
    setEditing(false);
    setRevisingReceipt(true);
    const catalystPreset = item.key === "dated_catalyst";
    const nextBranch = item.key === "preserve_cash" ? "cash" : catalystPreset || item.readiness === "conditional" ? "conditional" : "research";
    setBranch(nextBranch);
    if (catalystPreset) {
      setHoldingPeriod("catalyst_window");
      setDesiredEnding("");
    }
    if (item.key === "preserve_cash") setDesiredEnding("");
    if (nextBranch !== "research") {
      setReason(item.reasons[0] ?? "A named boundary must clear before research proceeds.");
      setBlocker(nextBranch === "cash" ? "No setup clears the current evidence, freshness, and portfolio boundaries." : catalystPreset ? "No verified dated catalyst is attached to this mission." : "Required context is not verified.");
      setReopen(catalystPreset ? "Attach dated catalyst evidence, then re-rank the mission." : "Re-rank after the blocker changes or new verified evidence arrives.");
      setGateLabel(catalystPreset ? "Verify dated catalyst evidence" : item.label);
    }
  };

  const commit = async () => {
    if (!activeCanonicalId || !projection || !paperAccount) return toast.error("Assign a thesis projection and paper account first.");
    const reviewAt = branch === "conditional"
      ? easternDateTimeInputToEpoch(eligibilityReviewAt)
      : easternDateTimeInputToEpoch(outcomeReviewAtInput);
    if (holdingPeriod === "catalyst_window" && reviewAt == null) {
      return toast.error("Set an ET review / look-back time for this catalyst-window decision.");
    }
    if (branch === "conditional" && reviewAt == null) {
      return toast.error("Set the ET time when this named gate should be reviewed.");
    }
    if (branch === "cash" && reviewAt == null) {
      return toast.error("Set the ET outcome look-back time for this cash decision.");
    }
    try {
      const receipt = await saveMission.mutateAsync({
        missionText: mission.trim(),
        canonicalThesisId: activeCanonicalId,
        capitalThesisId: projection.id,
        accountId: paperAccount.id,
        // `runId` is the optional provider-backed research run. Conditional and
        // cash receipts do not have one, but they still belong to a durable
        // Decision Run and revisions must append to that run. Requiring
        // `runId` here silently opened a second v1 receipt instead of revising
        // the existing conditional decision.
        decisionRunId: runway?.latest?.authority === "authoritative"
          && runway.latest.canonicalThesisId === activeCanonicalId && runway.latest.capitalThesisId === projection.id && runway.latest.accountId === paperAccount.id
          ? runway.latest.decisionRunId : null,
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
        reviewAt,
        namedGateKey: branch === "conditional" ? "operator-" + objective : null,
        namedGateLabel: branch === "conditional" ? gateLabel.trim() : null,
      });
      await utils.aperture.runway.latest.invalidate();
      if (branch === "research") {
        const uatCase = new URLSearchParams(window.location.search).get("uat_case") === "qualified-play" ? "qualified-play" as const : undefined;
        const started = await startResearch.mutateAsync({ decisionRunId: receipt.decisionRunId, revisionId: receipt.revisionId, uatCase });
        await Promise.all([utils.aperture.runway.latest.invalidate(), utils.aperture.runway.pending.invalidate()]);
        if (started.status === "blocked") {
          setRevisingReceipt(false);
          toast.error(started.message, { description: "No research run, provider dispatch, proposal, or broker action occurred. Open the conditional receipt to review the required recovery step." });
          return;
        }
        toast.success("Paper research started from the exact mission revision");
        onOpenResearchRun(started.runId);
      } else {
        setRevisingReceipt(false);
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
  const latestGate = runway?.latest && "namedGateLabel" in runway.latest ? runway.latest.namedGateLabel : null;
  const latestReviewAt = runway?.latest && "reviewAt" in runway.latest ? runway.latest.reviewAt : null;
  const latestRevision = runway?.latest && "version" in runway.latest ? runway.latest.version : null;
  const latestRecordedAt = runway?.latest && "createdAt" in runway.latest ? runway.latest.createdAt : null;
  const currentBindingMatches = runway?.latest?.authority === "authoritative"
    && runway.latest.canonicalThesisId === activeCanonicalId
    && runway.latest.capitalThesisId === projection?.id
    && runway.latest.accountId === paperAccount?.id;
  useEffect(() => {
    const receipt = runway?.latest;
    if (receiptTarget || !currentBindingMatches || receipt?.authority !== "authoritative" || hydratedDecisionRevisionId.current === receipt.decisionRevisionId) return;
    hydratedDecisionRevisionId.current = receipt.decisionRevisionId;
    setMission(receipt.missionText);
    setCapital(String(Math.round(receipt.deployableCapitalCents / 100)));
    setDesiredEnding(receipt.desiredEndingValueCents == null ? "" : String(Math.round(receipt.desiredEndingValueCents / 100)));
    setMaxLoss(String(Math.round(receipt.maxPlannedLossCents / 100)));
    setHoldingPeriod(receipt.holdingPeriod as HoldingPeriod);
    setObjective(receipt.objective as Objective);
    setInstrument(receipt.instrumentPreference);
    setIncludeHeld(receipt.includeHeldResearch);
    setBranch(receipt.branch as Branch);
    setReason(receipt.reason ?? "");
    setBlocker(receipt.blocker ?? "");
    setReopen(receipt.reopenCondition ?? "");
    setGateLabel(receipt.namedGateLabel ?? "");
    const receiptReview = receipt.reviewAt == null ? "" : easternDateTimeInputFromEpoch(receipt.reviewAt);
    setEligibilityReviewAt(receipt.branch === "conditional" ? receiptReview : "");
    setOutcomeReviewAtInput(receipt.branch === "research" ? receiptReview : "");
    setMissionDirty(true); // Immutable receipt text must never be regenerated from parameter defaults.
    setRevisingReceipt(false);
  }, [currentBindingMatches, receiptTarget, runway?.latest]);
  const plannedRiskCeiling = cockpit.data?.headroom.lines.find((line) => line.key === "planned_risk_per_play")?.ceilingCents ?? null;
  const concentrationLine = cockpit.data?.headroom.lines.find((line) => /single name/i.test(line.label)) ?? null;
  const receiptActive = !receiptTarget && !revisingReceipt && currentBindingMatches && (latestBranch === "cash" || latestBranch === "conditional");
  const visualWorkflowState = branchState(receiptActive ? latestBranch : branch);
  const concentrationBlocked = (concentrationLine?.usedPct ?? 0) >= 85;
  const capitalCents = parseMoney(capital);
  const desiredCents = parseMoney(desiredEnding);
  const targetStretchPct = capitalCents > 0 && desiredCents > capitalCents ? ((desiredCents - capitalCents) / capitalCents) * 100 : null;
  const sameSessionStretch = holdingPeriod === "intraday" && targetStretchPct != null && targetStretchPct >= 20;
  const dispositionReady = branch === "research" || (reason.trim().length >= 3 && blocker.trim().length >= 3 && reopen.trim().length >= 3 && (branch !== "conditional" || gateLabel.trim().length >= 3));
  const reviseReceipt = () => {
    const receipt = runway?.latest;
    if (!receipt || !("deployableCapitalCents" in receipt)) return;
    setMission(receipt.missionText);
    setMissionDirty(true);
    setCapital(String(Math.round(receipt.deployableCapitalCents / 100)));
    setDesiredEnding(receipt.desiredEndingValueCents == null ? "" : String(Math.round(receipt.desiredEndingValueCents / 100)));
    setMaxLoss(String(Math.round(receipt.maxPlannedLossCents / 100)));
    setHoldingPeriod(receipt.holdingPeriod as HoldingPeriod);
    setObjective(receipt.objective as Objective);
    setInstrument(receipt.instrumentPreference);
    setIncludeHeld(receipt.includeHeldResearch);
    setBranch(receipt.branch as Branch);
    setReason(receipt.reason ?? "");
    setBlocker(receipt.blocker ?? "");
    setReopen(receipt.reopenCondition ?? "");
    setGateLabel(receipt.namedGateLabel ?? "");
    const receiptReview = receipt.reviewAt == null ? "" : easternDateTimeInputFromEpoch(receipt.reviewAt);
    setEligibilityReviewAt(receipt.branch === "conditional" ? receiptReview : "");
    setOutcomeReviewAtInput(receipt.branch === "research" ? receiptReview : "");
    setRevisingReceipt(true);
  };

  if (receiptTarget && receiptLoading) {
    return <section className="mx-auto max-w-3xl rounded-2xl border p-6 text-sm" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Loading immutable decision receipt…</section>;
  }
  if (receiptTarget && (receiptError || !immutableReceipt || !immutableReceipt.binding)) {
    const fixture = readIsolatedUatIdentity();
    return <section className="mx-auto max-w-3xl rounded-2xl border p-6" style={{ borderColor: "var(--sh-red)", background: "var(--sh-surface)" }}><p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>Decision binding unavailable</p><p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>This receipt cannot be safely reconstructed from its stored owner, thesis, account, mandate, and revision binding. No proposal or research continuation is available.</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => window.location.assign(aperturePathForFixture("/aperture/runs", fixture))}>Return to Research Journeys</Button><Button variant="outline" onClick={() => window.location.assign(aperturePathForFixture("/aperture", fixture))}>Return to Decision Center</Button></div>{import.meta.env.DEV && receiptError ? <details className="mt-4 text-xs" style={{ color: "var(--sh-fg-muted)" }}><summary>Development diagnostic</summary><pre className="mt-2 whitespace-pre-wrap">{receiptError.message}</pre></details> : null}</section>;
  }
  if (immutableReceipt && !revisingReceipt && (latestBranch === "cash" || latestBranch === "conditional")) {
    return <section className="mx-auto max-w-4xl space-y-5 pb-24"><div className="grid gap-px overflow-hidden rounded-xl border sm:grid-cols-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}><ReceiptFact label="Owner" value="Owner scoped" /><ReceiptFact label="Thesis snapshot" value={immutableReceipt.binding.canonicalThesisName} /><ReceiptFact label="Paper account" value={immutableReceipt.binding.accountLabel} /><ReceiptFact label="Mandate / revision" value={`${immutableReceipt.binding.mandateVersion} · v${immutableReceipt.binding.decisionVersion}`} /></div><article className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><DecisionReceipt branch={latestBranch as "cash" | "conditional"} reason={latestReason} blocker={latestBlocker} reopen={latestReopen} gateLabel={latestGate} reviewAt={latestReviewAt} revision={latestRevision} recordedAt={latestRecordedAt} binding={immutableReceipt.binding} onGateReview={reviseReceipt} onRevise={reviseReceipt} /></article></section>;
  }

  return <section className="mx-auto max-w-[1440px] space-y-5 pb-24">
    <div className="grid gap-px overflow-hidden rounded-xl border md:grid-cols-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}>
      {[
        ["Assigned thesis", activeThesis?.name ?? "Not assigned"],
        ["Paper account", paperAccount ? paperAccount.label + (paperAccount.equityValueCents ? " · $" + Math.round(paperAccount.equityValueCents / 100).toLocaleString() : "") : "Not connected"],
        ["Freshness", paperAccount?.lastSyncedAt ? new Date(paperAccount.lastSyncedAt).toLocaleString() : "Not measured"],
        ["Current decision", currentBindingMatches ? branchLabel(latestBranch) : "New draft context"],
      ].map(([label, value]) => <div key={label} className="p-4" style={{ background: "var(--sh-surface)" }}><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>{label}</p><p className="mt-1 text-sm font-semibold" style={{ color: label === "Current decision" && currentBindingMatches && latestBranch === "cash" ? "var(--sh-signal)" : "var(--sh-text-primary)" }}>{value}</p></div>)}
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
        {receiptActive ? <DecisionReceipt branch={latestBranch as "cash" | "conditional"} reason={latestReason} blocker={latestBlocker} reopen={latestReopen} gateLabel={latestGate} reviewAt={latestReviewAt} revision={latestRevision} recordedAt={latestRecordedAt} binding={immutableReceipt?.binding} onGateReview={reviseReceipt} onRevise={reviseReceipt} /> : <><div className="space-y-5 p-5 sm:p-7">
          <div className="rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 32%, var(--sh-border-1))", background: "color-mix(in srgb, var(--sh-signal) 6%, var(--sh-surface))" }}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="flex gap-3"><BookOpen className="mt-0.5 h-5 w-5" style={{ color: "var(--sh-signal)" }} /><div><p className="text-[0.62rem] font-semibold uppercase tracking-[0.13em]" style={{ color: "var(--sh-fg-muted)" }}>Assigned thesis loaded</p><p className="mt-1 text-sm font-semibold">{canonicalThesisLabel(activeThesis)}</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Run-specific edits create a new receipt. The saved thesis remains unchanged.</p></div></div><select aria-label="Switch assigned thesis" className="min-h-10 rounded-md border bg-transparent px-2 text-xs" style={{ borderColor: "var(--sh-border-1)" }} value={activeCanonicalId ?? ""} onChange={(event) => { setSelectedCanonicalId(Number(event.target.value)); setMissionDirty(false); }}><option value="" disabled>Switch thesis</option>{(canonicalTheses ?? []).map((item) => <option key={item.id} value={item.id}>{canonicalThesisLabel(item)}</option>)}</select></div>
          </div>

          <div><div className="flex items-start justify-between gap-3"><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Capital Mission</p><Button variant="ghost" size="sm" className="min-h-10" onClick={() => setEditing((value) => !value)}><Pencil className="mr-2 h-3.5 w-3.5" />{editing ? "Done" : "Edit mission"}</Button></div>
            {editing ? <><Textarea value={mission} onChange={(event) => { setMission(event.target.value); setMissionDirty(true); }} className="mt-2 min-h-28 font-serif text-lg leading-snug sm:text-xl" /><div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Frame it as</span>{["Where can I…", "How can I…", "What must…"].map((starter) => <button key={starter} type="button" className="min-h-9 rounded-md border px-2.5 text-xs" style={{ borderColor: "var(--sh-border-1)" }} onClick={() => { setMission(starter + " "); setMissionDirty(true); }}>{starter}</button>)}</div></> : <h1 className="mt-2 max-w-3xl font-serif text-[1.45rem] leading-[1.18] sm:text-[1.85rem] lg:text-[2.1rem]" style={{ color: "var(--sh-text-primary)" }}>{mission}</h1>}
          </div>

          <TypedStatusStrip state={visualWorkflowState} horizon={horizonLabel(holdingPeriod)} operatorCapCents={parseMoney(maxLoss) || null} syncedAt={paperAccount?.lastSyncedAt ?? null} catalystLabel={(currentBindingMatches ? latestGate : null) ?? (declaredCatalystAt == null ? null : `Declared ${new Date(declaredCatalystAt).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`)} />
          <ArgumentRail state={visualWorkflowState} operatorCapCents={parseMoney(maxLoss) || null} evidenceLabel={latestGate ?? "—"} gateLabel={latestBranch === "conditional" ? "Conditional / opening held" : latestBranch === "cash" ? "Cash / opening held" : "Research only"} />

          <div><div className="mb-2 flex items-center justify-between gap-3"><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Mission Math</p><span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Measured inputs only</span></div><div className="grid overflow-hidden rounded-xl border sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "var(--sh-border-1)" }}>
            <MoneyField label="Capital" value={capital} onChange={(value) => {
              setCapital(value);
              setMissionDirty(true); // Preserve the operator-authored mission across parameter edits.
            }} help="Mission capital" />
            {branch === "research" ? <MoneyField label="Target stretch" value={desiredEnding} onChange={setDesiredEnding} help="Aspiration · never a forecast" /> : <div className="border-b p-3 text-[0.68rem] sm:border-b-0 sm:border-r" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Target stretch<p className="mt-1 font-serif text-xl" style={{ color: "var(--sh-text-primary)" }}>Not used</p><span className="text-[10px]">{branch === "cash" ? "Cash carries $0 risk." : "Gate review, not return target."}</span></div>}
            <label className="border-b p-3 text-[0.68rem] sm:border-b-0 sm:border-r" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Horizon<select className="mt-1 min-h-11 w-full bg-transparent font-serif text-xl" style={{ color: "var(--sh-text-primary)" }} value={holdingPeriod} onChange={(event) => { setHoldingPeriod(event.target.value as HoldingPeriod); setMissionDirty(true); }}><option value="intraday">Today</option><option value="overnight">Next close</option><option value="swing">This week</option><option value="catalyst_window">Named catalyst</option><option value="position">Long term · review every 30 days</option></select><span className="text-[10px]">Outcome or review queued at horizon</span></label>
            <MoneyField label="Max planned loss" value={maxLoss} onChange={setMaxLoss} help={`${capitalCents > 0 ? `${((parseMoney(maxLoss) / capitalCents) * 100).toFixed(1)}% of mission capital` : "Can tighten, never loosen"}`} />
          </div></div>
          {branch === "research" && targetStretchPct != null && <div className="flex flex-col gap-2 rounded-lg border px-3 py-3 text-xs" style={{ borderColor: sameSessionStretch ? "var(--sh-red)" : "var(--sh-border-1)", background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)" }}><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-serif text-lg" style={{ color: "var(--sh-text-primary)" }}>+{formatCents(desiredCents - capitalCents)} · +{targetStretchPct.toFixed(0)}% · aspiration</p><BasisMark basis="aspirational" label="Aspirational" /></div><p>Research may conclude that no qualifying play reaches this value within the declared risk limit.{sameSessionStretch ? " Same-session stretch requires horizon verification." : ""}</p></div>}
          <RiskBudgetBar operatorCapCents={parseMoney(maxLoss) || null} perPlayCeilingCents={plannedRiskCeiling} concentrationBlocked={concentrationBlocked} />

          <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
            <div><p className="text-xs font-semibold">Declared catalyst</p><p className="mt-1 text-sm" style={{ color: "var(--sh-text-primary)" }}>{declaredCatalystAt == null ? "Not declared in thesis" : new Date(declaredCatalystAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " ET"}</p><p className="mt-1 text-[10px]" style={{ color: "var(--sh-fg-muted)" }}>Source-preserved from the assigned thesis; declaration is not verification.</p></div>
            <DateTimeField label={branch === "conditional" ? "Gate review (ET)" : "Outcome look-back (ET)"} value={branch === "conditional" ? eligibilityReviewAt : outcomeReviewAtInput} onChange={branch === "conditional" ? setEligibilityReviewAt : setOutcomeReviewAtInput} help={branch === "conditional" ? "When the named gate reopens for operator review." : "When the operator should record what happened; never an automatic exit."} />
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
            ] as const).map((item) => <button key={item.id} type="button" aria-pressed={branch === item.id} className="min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-semibold" style={{ borderColor: branch === item.id ? "var(--sh-signal)" : "var(--sh-border-1)", background: branch === item.id ? "color-mix(in srgb, var(--sh-signal) 7%, var(--sh-surface))" : "var(--sh-surface)" }} onClick={() => setBranch(item.id)}><item.icon className="mr-2 inline h-4 w-4" />{item.label}</button>)}</div>
            {branch !== "research" && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold sm:col-span-2">Why this is the right outcome<Textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-16" placeholder="State the decision basis." /></label><TextField label="Current blocker" value={blocker} onChange={setBlocker} /><TextField label="Reopen when" value={reopen} onChange={setReopen} />{branch === "conditional" && <div className="sm:col-span-2"><TextField label="Named gate" value={gateLabel} onChange={setGateLabel} /></div>}</div>}
          </div>
        </div>
        <footer className="flex flex-col gap-3 border-t p-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><p className="max-w-xl text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{branch === "cash" ? "Records $0 at risk and removes Plan, Approval, and Monitor from this journey." : branch === "conditional" ? "Queues the named gate; no proposal or broker path opens." : "Creates research only. A paper proposal remains separate and human-approved."}</p><Button className="min-h-11" disabled={busy || mission.trim().length < 20 || parseMoney(capital) <= 0 || parseMoney(maxLoss) <= 0 || !dispositionReady} onClick={commit}>{busy ? "Recording…" : branch === "cash" ? "Record cash · $0 risk" : branch === "conditional" ? "Queue conditional review" : "Compile Play Slate"}<ArrowRight className="ml-2 h-4 w-4" /></Button></footer></>}
      </article>

      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <section className="rounded-2xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4" style={{ color: "var(--sh-signal)" }} /><p className="text-sm font-semibold">Mission Library · ranked for this run</p></div>
          <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Top missions only. Ranking reflects known thesis, portfolio, evidence, and horizon context—not approval or a forecast.</p>
          {!libraryBindings.ready ? <p className="mt-3 rounded-lg border border-dashed p-3 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Mission Library is waiting for {libraryBindings.missing.join(", ")}. No contextual mission can be shown yet.</p> : library.isLoading ? <p className="mt-3 rounded-lg border border-dashed p-3 text-xs" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Loading contextual Mission Library…</p> : library.isError ? <p role="alert" className="mt-3 rounded-lg border border-dashed p-3 text-xs leading-5" style={{ borderColor: "var(--sh-red)", color: "var(--sh-red)" }}>Mission Library is unavailable. Contextual ranking is withheld until the API returns verified data.</p> : (library.data?.length ?? 0) === 0 ? <p className="mt-3 rounded-lg border border-dashed p-3 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>No contextual missions are available for this thesis, account, and horizon. No fallback missions are shown.</p> : <><div className="mt-3 space-y-2">{(showAllMissions ? library.data ?? [] : (library.data ?? []).slice(0, 3)).map((item, index) => <button key={item.key} type="button" aria-pressed={item.objective === objective} className="w-full rounded-xl border p-3 text-left" style={{ borderColor: item.objective === objective ? "var(--sh-signal)" : "var(--sh-border-1)", background: "var(--sh-surface-2)" }} onClick={() => chooseMission(item)}><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{index + 1}. {item.label}</p><StateMark state={item.readiness === "conditional" ? "conditional" : "researchable"} compact /></div><div className="mt-2 flex flex-wrap gap-1.5"><BasisMark basis="measured" label="Thesis match" /><BasisMark basis={item.key === "portfolio_gap" || item.key === "preserve_cash" ? "measured" : "unknown"} label="Headroom" /><BasisMark basis={item.readiness === "conditional" ? "unknown" : "measured"} label={item.readiness === "conditional" ? "Evidence gap" : "Evidence"} /><BasisMark basis="declared" label={item.key === "dated_catalyst" ? "Catalyst window" : horizonLabel(holdingPeriod)} /><BasisMark basis={item.readiness === "conditional" ? "unknown" : "declared"} label={item.readiness === "conditional" ? "Eligibility held" : "Research only"} /></div></button>)}</div>{(library.data?.length ?? 0) > 3 && <Button variant="ghost" size="sm" className="mt-2 w-full min-h-10" aria-expanded={showAllMissions} onClick={() => setShowAllMissions((value) => !value)}>{showAllMissions ? "Show common missions" : "Show " + ((library.data?.length ?? 3) - 3) + " more"}<ChevronDown className={"ml-2 h-4 w-4 " + (showAllMissions ? "rotate-180" : "")} /></Button>}</>}
        </section>
        <section className="rounded-2xl border p-4 text-xs" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)" }}><p className="flex items-center gap-2 font-semibold" style={{ color: "var(--sh-text-primary)" }}><CheckCircle2 className="h-4 w-4" style={{ color: "var(--sh-emerald)" }} />Decision integrity</p><div className="mt-3 grid gap-2"><StateMark state="rule_qualified" label="Thesis bound" compact /><StateMark state="rule_qualified" label="Paper account bound" compact /><BasisMark basis="calculated" label={`Revision v${latestRevision ?? "—"}`} formula="immutable revision sequence" /><StateMark state={latestBranch === "cash" || latestBranch === "conditional" ? "blocked" : "researchable"} label={latestBranch === "cash" || latestBranch === "conditional" ? "Opening held" : "Evidence path"} compact /><StateMark state={paperAccount?.lastSyncedAt && Date.now() - paperAccount.lastSyncedAt <= 60 * 60 * 1000 ? "rule_qualified" : "stale"} label={paperAccount?.lastSyncedAt ? `Freshness ${new Date(paperAccount.lastSyncedAt).toLocaleString()}` : "Freshness —"} compact /></div><Button variant="ghost" size="sm" className="mt-3 min-h-10 px-0" onClick={onNewResearch}>Open research-only advanced setup</Button></section>
      </aside>
    </div>}

    {currentBindingMatches && latestBranch === "cash" && <section className="rounded-2xl border p-5" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 45%, var(--sh-border-1))", background: "color-mix(in srgb, var(--sh-signal) 7%, var(--sh-surface))" }}><div className="flex items-start justify-between gap-4"><div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Cash receipt · current mission</p><h2 className="mt-1 font-serif text-3xl">$0 at risk.</h2><p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{latestReason ?? "Cash was recorded for the current mission."}</p><p className="mt-2 text-xs"><strong>Blocked by:</strong> {latestBlocker ?? "Named decision boundary"} · <strong>Reopen when:</strong> {latestReopen ?? "A new revision is recorded"}</p></div><CircleSlash2 className="h-7 w-7" style={{ color: "var(--sh-signal)" }} /></div></section>}

    <DailyPlayList onNewResearch={onNewResearch} onOpenRun={onOpenRun} />
  </section>;
}

function DecisionReceipt({ branch, reason, blocker, reopen, gateLabel, reviewAt, revision, recordedAt, binding, onGateReview, onRevise }: { branch: "cash" | "conditional"; reason: string | null; blocker: string | null; reopen: string | null; gateLabel: string | null; reviewAt: number | null; revision: number | null; recordedAt: number | null; binding?: { canonicalThesisName: string; capitalThesisName: string; accountLabel: string; mandateVersion: string; decisionVersion: number }; onGateReview: () => void; onRevise: () => void }) {
  const conditional = branch === "conditional";
  return <div className="space-y-4 p-5 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 gap-3"><div className="mt-0.5 rounded-full p-2" style={{ background: conditional ? "color-mix(in srgb, var(--sh-signal) 14%, var(--sh-surface))" : "color-mix(in srgb, var(--sh-signal) 8%, var(--sh-surface))", color: "var(--sh-signal)" }}>{conditional ? <CalendarClock className="h-5 w-5" /> : <CircleSlash2 className="h-5 w-5" />}</div><div><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>{conditional ? "Conditional receipt" : "Cash receipt"}</p><h2 className="mt-1 font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}>{conditional ? (gateLabel ?? "Named gate queued") : "$0 at risk"}</h2><p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>{conditional ? "A named operator review is queued. No proposal or broker path opens." : "Cash is the recorded control outcome for this mission."}</p></div></div><div className="flex flex-wrap gap-2">{conditional ? <Button className="min-h-11" onClick={onGateReview}>Resolve evidence gap</Button> : null}<Button variant="outline" className="min-h-11 shrink-0" onClick={onRevise}><Pencil className="mr-2 h-4 w-4" />Revise decision</Button></div></div><dl className="grid gap-px overflow-hidden rounded-xl border text-sm sm:grid-cols-2" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}><ReceiptFact label={conditional ? "Named gate" : "Reason"} value={conditional ? gateLabel ?? "Named gate not recorded" : reason ?? "Reason not recorded"} /><ReceiptFact label="Blocker" value={blocker ?? "Not recorded"} /><ReceiptFact label="Reopen when" value={reopen ?? "Not recorded"} /><ReceiptFact label={conditional ? "Due / horizon" : "Outcome look-back"} value={reviewAt ? new Date(reviewAt).toLocaleString() : recordedAt ? new Date(recordedAt).toLocaleString() : "Not measured"} /></dl>{binding ? <dl className="grid gap-px overflow-hidden rounded-xl border text-sm sm:grid-cols-2" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}><ReceiptFact label="Thesis snapshot" value={binding.canonicalThesisName} /><ReceiptFact label="Capital projection" value={binding.capitalThesisName} /><ReceiptFact label="Paper account" value={binding.accountLabel} /><ReceiptFact label="Mandate / revision" value={`${binding.mandateVersion} · v${binding.decisionVersion}`} /></dl> : null}<div className="flex flex-wrap gap-2 text-[11px]" style={{ color: "var(--sh-fg-muted)" }}><span className="rounded-full border px-2 py-1" style={{ borderColor: "var(--sh-border-1)" }}>Owner scoped</span><span className="rounded-full border px-2 py-1" style={{ borderColor: "var(--sh-border-1)" }}>Revision v{revision ?? "?"}</span><span className="rounded-full border px-2 py-1" style={{ borderColor: "var(--sh-border-1)" }}>{conditional ? "Gate review pending" : "No paper exposure"}</span></div></div>;
}

function ReceiptFact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 p-3" style={{ background: "var(--sh-surface-2)" }}><dt className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>{label}</dt><dd className="mt-1 break-words text-sm" style={{ color: "var(--sh-text-primary)" }}>{value}</dd></div>;
}

function MoneyField({ label, value, onChange, help }: { label: string; value: string; onChange: (value: string) => void; help: string }) {
  return <label className="border-b p-3 text-[0.68rem] sm:border-b-0 sm:border-r" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>{label}<div className="mt-1 flex items-center font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}><span>$</span><input inputMode="decimal" value={displayMoney(value)} onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, ""))} className="min-w-0 w-full bg-transparent outline-none" /></div><span className="text-[10px]">{help}</span></label>;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-xs font-semibold">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>;
}

function DateTimeField({ label, value, onChange, help }: { label: string; value: string; onChange: (value: string) => void; help: string }) {
  return <label className="text-xs font-semibold">{label}<input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /><span className="mt-1 block text-[10px] font-normal" style={{ color: "var(--sh-fg-muted)" }}>{help}</span></label>;
}
