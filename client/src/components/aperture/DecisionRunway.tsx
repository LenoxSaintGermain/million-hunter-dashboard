import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, BookOpen, CalendarClock, CheckCircle2, ChevronDown, CircleSlash2, FileSearch, Pencil, ShieldCheck, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { missionLibraryBindingState } from "@shared/missionLibraryQuery";
import { aperturePathForFixture, readIsolatedUatCase, readIsolatedUatIdentity } from "@shared/isolatedUatIdentity";
import { easternDateTimeInputFromEpoch, easternDateTimeInputToEpoch } from "@shared/easternMarketTime";
import { canonicalThesisLabel } from "@shared/canonicalThesisLabel";
import { initialMissionSection, missionSectionReducer, missionDraftFingerprint, missionDraftSaveState, validMissionHorizonCollection, validReceiptHorizonShape, replacePrimaryMissionHorizon, type MissionDraftRecord, type MissionDraftValues } from "@shared/apertureMissionDraft";
import type { TargetFeasibility, UnderwritingRiskPolicy } from "@shared/playUnderwriting";
import { STALE_ACCOUNT_MS, type CockpitHeadroomLine } from "@shared/cockpitRailSummary";
import { ArgumentRail, BasisMark, StateMark, TypedStatusStrip, type WorkflowState } from "./DecisionVisualLanguage";
import { ContextHelp } from "./ContextHelp";
import { PlayUnderwritingBrief } from "./PlayUnderwritingBrief";

type Branch = "research" | "conditional" | "cash";
type HoldingPeriod = "intraday" | "overnight" | "swing" | "catalyst_window" | "position";
type Objective = "best_qualified_play" | "deploy_today" | "verify_catalyst" | "portfolio_gap" | "preserve_optionality";

type Props = {
  onNewResearch: () => void;
  onOpenResearchRun: (runId: number) => void;
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
  if (branch === "eligible") return "Eligible for proposal review";
  return "Research context";
}

function formatCents(cents: number | null | undefined) {
  return cents == null ? "Not measured" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100);
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

export function DecisionRunway({ onNewResearch, onOpenResearchRun, receiptTarget = null }: Props) {
  const utils = trpc.useUtils();
  const { data: runwayResponse, error: receiptError, isLoading: receiptLoading } = trpc.aperture.runway.latest.useQuery(receiptTarget ?? undefined, { retry: false });
  const receiptStructureInvalid = runwayResponse?.latest?.authority === "authoritative" && !validReceiptHorizonShape(runwayResponse.latest);
  const runway = receiptStructureInvalid ? undefined : runwayResponse;
  const { data: pendingOutcomes } = trpc.aperture.runway.pending.useQuery();
  const canonicalQuery = trpc.thesis.list.useQuery(undefined, { retry: false });
  const { data: canonicalTheses } = canonicalQuery;
  const capitalQuery = trpc.aperture.thesis.list.useQuery(undefined, { retry: false });
  const { data: capitalTheses } = capitalQuery;
  const accountQuery = trpc.aperture.account.list.useQuery(undefined, { retry: false });
  const { data: accounts } = accountQuery;
  const draftQuery = trpc.aperture.runway.draft.get.useQuery(undefined, { enabled: !receiptTarget, retry: false, refetchOnWindowFocus: false });
  const saveDraftMutation = trpc.aperture.runway.draft.save.useMutation();
  const completeDraftMutation = trpc.aperture.runway.draft.complete.useMutation();
  const [selectedCanonicalId, setSelectedCanonicalId] = useState<number | null | undefined>(undefined);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null | undefined>(undefined);
  const immutableReceipt = receiptTarget && runway?.latest?.authority === "authoritative" ? runway.latest : null;
  const currentDecisionRunId = runway?.latest?.authority === "authoritative" ? runway.latest.decisionRunId : null;
  const currentDecisionRevisionId = runway?.latest?.authority === "authoritative" ? runway.latest.decisionRevisionId : null;
  const activeCanonicalId = immutableReceipt?.canonicalThesisId ?? (selectedCanonicalId !== undefined ? selectedCanonicalId : runway?.activeCanonicalThesisId ?? null);
  const activeThesis = useMemo(() => (canonicalTheses ?? []).find((item) => item.id === activeCanonicalId) ?? null, [canonicalTheses, activeCanonicalId]);
  const projection = useMemo(() => immutableReceipt
    ? (capitalTheses ?? []).find((item) => item.id === immutableReceipt.capitalThesisId) ?? null
    : (capitalTheses ?? []).find((item) => item.sourceCompilationId === activeCanonicalId) ?? null, [capitalTheses, activeCanonicalId, immutableReceipt]);
  const paperAccount = useMemo(() => immutableReceipt
    ? (accounts ?? []).find((item) => item.id === immutableReceipt.accountId) ?? null
    : selectedAccountId !== undefined ? (accounts ?? []).find((item) => item.id === selectedAccountId && item.isPaper) ?? null
    : (accounts ?? []).find((item) => item.isPaper && item.brokerId === "alpaca_paper") ?? (accounts ?? []).find((item) => item.isPaper) ?? null, [accounts, immutableReceipt, selectedAccountId]);
  const cockpit = trpc.aperture.cockpit.useQuery(paperAccount ? { accountId: paperAccount.id } : undefined, { enabled: Boolean(paperAccount) });

  const [capital, setCapital] = useState("");
  const [targetProfit, setTargetProfit] = useState("");
  const [targetPeriod, setTargetPeriod] = useState<"session" | "week" | "month">("week");
  const [maxLoss, setMaxLoss] = useState("");
  const [holdingPeriod, setHoldingPeriod] = useState<HoldingPeriod>("intraday");
  const [holdingPeriods, setHoldingPeriods] = useState<HoldingPeriod[]>(["intraday"]);
  const [objective, setObjective] = useState<Objective>("deploy_today");
  const [instrument, setInstrument] = useState<"shares" | "options" | "either">("shares");
  const [includeHeld, setIncludeHeld] = useState(false);
  const [mission, setMission] = useState("");
  const [missionDirty, setMissionDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showTune, setShowTune] = useState(false);
  const [showAllMissions, setShowAllMissions] = useState(false);
  const [visibleMissionSection, dispatchMissionSection] = useReducer(missionSectionReducer, 1);
  const [branch, setBranch] = useState<Branch>("research");
  const [reason, setReason] = useState("");
  const [blocker, setBlocker] = useState("");
  const [reopen, setReopen] = useState("");
  const [gateLabel, setGateLabel] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newBelief, setNewBelief] = useState("");
  const [revisingReceipt, setRevisingReceipt] = useState(false);
  const [underwritingDirty, setUnderwritingDirty] = useState(false);
  const [committing, setCommitting] = useState(false);
  const commitLatch = useRef(false);
  const [declaredCatalystAt, setDeclaredCatalystAt] = useState<number | null>(null);
  const [declaredCatalystLabel, setDeclaredCatalystLabel] = useState<string | null>(null);
  const [eligibilityReviewAt, setEligibilityReviewAt] = useState("");
  const [outcomeReviewAtInput, setOutcomeReviewAtInput] = useState("");
  const hydratedDecisionRevisionId = useRef<number | null>(null);
  const [draftInitialized, setDraftInitialized] = useState(false);
  const [draftTouched, setDraftTouched] = useState(false);
  const [savedDraft, setSavedDraft] = useState<MissionDraftRecord | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftConflict, setDraftConflict] = useState(false);
  const [remoteDraft, setRemoteDraft] = useState<MissionDraftRecord | null>(null);
  const [baseMission, setBaseMission] = useState<{ decisionRunId: number | null; decisionRevisionId: number | null }>({ decisionRunId: null, decisionRevisionId: null });
  const [reviewedAssumptions, setReviewedAssumptions] = useState<string | null>(null);
  const savedDraftRef = useRef<MissionDraftRecord | null>(null);
  const draftWriteRef = useRef<Promise<MissionDraftRecord> | null>(null);
  const completedDraftRef = useRef(false);
  const draftFailureRef = useRef<string | null>(null);
  const markDraftEdited = () => { completedDraftRef.current = false; setDraftTouched(true); dispatchMissionSection({ type: "input_changed" }); };
  const setExpandedMissionSection = (section: 1 | 2 | 3) => { markDraftEdited(); dispatchMissionSection({ type: "choose", section }); };
  const uatCase = readIsolatedUatCase();
  const libraryBindings = missionLibraryBindingState({
    canonicalThesisId: activeCanonicalId,
    capitalThesisId: projection?.id ?? null,
    accountId: paperAccount?.id ?? null,
  });
  const explicitTargetProfitCents = parseMoney(targetProfit) > 0 && targetPeriod != null ? parseMoney(targetProfit) : null;
  const previewObjective = {
    deployableCapitalCents: parseMoney(capital),
    targetProfitCents: explicitTargetProfitCents,
    targetPeriod: explicitTargetProfitCents == null ? null : targetPeriod,
    maxPlannedLossCents: parseMoney(maxLoss),
    maxPortfolioOpenRiskCents: null,
    weeklyLossLimitCents: null,
    eventRiskLimitCents: null,
    holdingPeriods: holdingPeriods.length ? holdingPeriods : [holdingPeriod],
    instrumentPreference: instrument,
  };

  useEffect(() => {
    if (!activeThesis || missionDirty || (!receiptTarget && !draftInitialized)
      || (!draftTouched && savedDraftRef.current?.completedAt === null)) return;
    setMission(missionFor(activeThesis.name ?? "active Capital", capital, holdingPeriod));
  }, [activeThesis, capital, holdingPeriod, missionDirty, receiptTarget, draftInitialized, draftTouched]);

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
  const currentUnderwriting = trpc.aperture.underwriter.get.useQuery(
    { decisionRunId: currentDecisionRunId ?? 0 },
    { enabled: currentDecisionRunId != null, retry: false },
  );
  const underwritingJob = trpc.aperture.underwriter.status.useQuery(
    { decisionRunId: currentDecisionRunId ?? 0, decisionRevisionId: currentDecisionRevisionId ?? 0 },
    { enabled: currentDecisionRunId != null && currentDecisionRevisionId != null, retry: false,
      refetchInterval: (query) => query.state.data?.state === "running" ? 3000 : false },
  );
  const underwritingTaskPath = currentDecisionRunId != null && currentDecisionRevisionId != null
    ? aperturePathForFixture(`/aperture/decision/${currentDecisionRunId}/revision/${currentDecisionRevisionId}/underwrite`, readIsolatedUatIdentity()) : null;
  const jobNeedsReconciliation = underwritingJob.data?.state === "running" || underwritingJob.data?.state === "failed" || underwritingJob.data?.state === "interrupted";
  const missionContextError = receiptStructureInvalid ? new Error("Saved Mission horizons are malformed. Reload the corrected receipt; no new analysis can start.") : receiptError || draftQuery.error || canonicalQuery.error || capitalQuery.error || accountQuery.error;
  const missionContextLoading = !receiptTarget && (!draftInitialized || receiptLoading || draftQuery.isLoading || canonicalQuery.isLoading || capitalQuery.isLoading || accountQuery.isLoading);
  const refreshMissionContext = () => Promise.all([
    utils.aperture.runway.latest.invalidate(), utils.aperture.runway.draft.get.invalidate(),
    utils.thesis.list.invalidate(), utils.aperture.thesis.list.invalidate(), utils.aperture.account.list.invalidate(),
  ]);
  const authoritativePreview = trpc.aperture.underwriter.preview.useQuery(
    { accountId: paperAccount?.id ?? 0, objective: previewObjective },
    {
      enabled: Boolean(paperAccount?.id) && previewObjective.deployableCapitalCents > 0 && previewObjective.maxPlannedLossCents > 0,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );
  const runUnderwriting = trpc.aperture.underwriter.run.useMutation();
  const validatePlay = trpc.aperture.underwriter.validatePlay.useMutation();
  const startResearch = trpc.aperture.runway.startResearch.useMutation();
  const resolveCashOutcome = trpc.aperture.runway.resolveCashOutcome.useMutation();
  const persistedUnderwritingLoading = currentDecisionRunId != null && currentUnderwriting.isLoading && runUnderwriting.data == null;
  const rawUnderwritingResult = runUnderwriting.data ?? currentUnderwriting.data ?? null;
  const underwritingStructureInvalid = rawUnderwritingResult != null && !validMissionHorizonCollection(rawUnderwritingResult.objective?.holdingPeriods);
  const persistedUnderwritingUnavailable = underwritingStructureInvalid || (currentDecisionRunId != null && currentUnderwriting.isError && currentUnderwriting.data == null && runUnderwriting.data == null);
  const busy = committing || createThesis.isPending || projectThesis.isPending || saveMission.isPending || runUnderwriting.isPending || validatePlay.isPending || startResearch.isPending || resolveCashOutcome.isPending;
  const underwritingResult = underwritingStructureInvalid ? null : rawUnderwritingResult;

  const buildThesisHere = async () => {
    if (missionContextLoading || missionContextError || draftError || draftConflict) return;
    try {
      await flushDraft();
      const created = await createThesis.mutateAsync({ name: newTitle.trim(), thesisText: newBelief.trim() });
      const projected = await projectThesis.mutateAsync({ compilationId: created.compilationId });
      setSelectedCanonicalId(created.compilationId);
      markDraftEdited();
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
    markDraftEdited();
    setMission(item.missionText);
    setMissionDirty(true);
    setObjective(item.objective);
    setEditing(false);
    setRevisingReceipt(true);
    setUnderwritingDirty(true);
    const catalystPreset = item.key === "dated_catalyst";
    const nextBranch = item.key === "preserve_cash" ? "cash" : catalystPreset || item.readiness === "conditional" ? "conditional" : "research";
    setBranch(nextBranch);
    if (catalystPreset) {
      setHoldingPeriod("catalyst_window");
      setHoldingPeriods(["catalyst_window"]);
      setTargetProfit("");
    }
    if (item.key === "preserve_cash") {
      setTargetProfit("");
    }
    if (nextBranch !== "research") {
      setReason(item.reasons[0] ?? "A named boundary must clear before research proceeds.");
      setBlocker(nextBranch === "cash" ? "No setup clears the current evidence, freshness, and portfolio boundaries." : catalystPreset ? "No verified dated catalyst is attached to this mission." : "Required context is not verified.");
      setReopen(catalystPreset ? "Attach dated catalyst evidence, then re-rank the mission." : "Re-rank after the blocker changes or new verified evidence arrives.");
      setGateLabel(catalystPreset ? "Verify dated catalyst evidence" : item.label);
    }
  };

  const commitOnce = async () => {
    if (missionContextLoading || missionContextError || draftError || draftConflict) return toast.error("Restore or save the Mission draft before starting analysis.");
    if (horizonMismatch) return toast.info("Resolve the primary/underwriting horizon mismatch in Review & underwrite before starting a new analysis.");
    if (needsRevisionReview) return toast.info("Review the changed Mission assumptions before applying this revision.");
    if (jobNeedsReconciliation || underwritingJob.isLoading || underwritingJob.isError) return toast.info("Review the saved underwriting task before starting new analysis.");
    if (!activeCanonicalId || !paperAccount) return toast.error("Assign a thesis and paper account first.");
    if (branch === "research" && (persistedUnderwritingLoading || persistedUnderwritingUnavailable)) {
      toast.info("Checking saved underwriting state.", { description: "New analysis remains unavailable until the saved result is reconciled." });
      return;
    }
    if (branch === "research" && underwritingComplete) {
      toast.info("Underwriting is already complete for this mission.", { description: "Review the result below or change an assumption before running it again." });
      return;
    }
    let projectionId = projection?.id ?? null;
    if (projectionId == null) {
      try {
        const repaired = await projectThesis.mutateAsync({ compilationId: activeCanonicalId });
        if (repaired.compilerStatus === "needs_structure") {
          return toast.error(`Finish the thesis structure first: ${repaired.missingFields.join(", ")}.`);
        }
        if (repaired.incompatibilities.length) {
          return toast.error(repaired.incompatibilities.join(" "));
        }
        projectionId = repaired.apertureThesisId;
        await utils.aperture.thesis.list.invalidate();
      } catch (error: any) {
        return toast.error(error?.message ?? "The thesis could not be bound to this Capital Mission.");
      }
    }
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
      const confirmedDraft = await flushDraft();
      const receipt = await saveMission.mutateAsync({
        missionText: mission.trim(),
        canonicalThesisId: activeCanonicalId,
        capitalThesisId: projectionId,
        accountId: paperAccount.id,
        // Conditional and cash receipts revise the durable Decision Run even
        // when that run already has research attached. A new research request,
        // however, must open a new Decision Run once the current one is bound
        // to a research run. Otherwise begin() appends an immutable revision and
        // startResearch() can only reject it as a duplicate of the older run.
        decisionRunId: runway?.latest?.authority === "authoritative"
          && runway.latest.canonicalThesisId === activeCanonicalId && runway.latest.capitalThesisId === projectionId && runway.latest.accountId === paperAccount.id
          && !(branch === "research" && runway.latest.runId != null)
          ? runway.latest.decisionRunId : null,
        branch,
        missionSource: missionDirty ? "edited" : "assigned",
        objective,
        instrumentPreference: instrument,
        includeHeldResearch: includeHeld,
        deployableCapitalCents: parseMoney(capital),
        desiredEndingValueCents: explicitTargetProfitCents == null ? null : parseMoney(capital) + explicitTargetProfitCents,
        targetProfitCents: explicitTargetProfitCents,
        targetPeriod: explicitTargetProfitCents == null ? null : targetPeriod,
        maxPlannedLossCents: parseMoney(maxLoss),
        holdingPeriod,
        holdingPeriods: holdingPeriods.length ? holdingPeriods : [holdingPeriod],
        invalidationRule: "Invalidate this mission if the assigned thesis, named horizon, liquidity evidence, or planned-loss boundary is no longer true.",
        reason: branch === "research" ? null : reason.trim(),
        blocker: branch === "research" ? null : blocker.trim(),
        reopenCondition: branch === "research" ? null : reopen.trim(),
        reviewAt,
        namedGateKey: branch === "conditional" ? "operator-" + objective : null,
        namedGateLabel: branch === "conditional" ? gateLabel.trim() : null,
      });
      // A successful explicit Mission action retires only the exact draft that
      // was used. Another device's intervening edit remains intact.
      completedDraftRef.current = true;
      setBaseMission({ decisionRunId: receipt.decisionRunId, decisionRevisionId: receipt.revisionId });
      hydratedDecisionRevisionId.current = receipt.revisionId;
      if (confirmedDraft) {
        try {
          const completed = await completeDraftMutation.mutateAsync({ expectedVersion: confirmedDraft.version, decisionRunId: receipt.decisionRunId, decisionRevisionId: receipt.revisionId });
          savedDraftRef.current = completed;
          setSavedDraft(completed);
          setDraftTouched(false);
          utils.aperture.runway.draft.get.setData(undefined, completed);
        } catch (error: any) {
          setDraftError("The Mission was recorded, but the draft could not be retired. Review the saved task; do not create the Mission again.");
          draftFailureRef.current = "The saved Mission must be reconciled before editing this draft.";
          toast.warning("Mission recorded; draft reconciliation required.", { description: error?.message });
        }
      }
      await utils.aperture.runway.latest.invalidate();
      if (branch === "research") {
        toast.success("Mission recorded. Underwriting is checking the target, risk envelope, and sourced market context.", {
          description: "No research run, paper ticket, approval, submission, or broker order has been created.",
        });
        try {
          await runUnderwriting.mutateAsync({
            decisionRunId: receipt.decisionRunId,
            decisionRevisionId: receipt.revisionId,
            requestedPlayCount: 3,
            uatCase: uatCase ?? undefined,
          });
          await Promise.all([
            utils.aperture.underwriter.get.invalidate({ decisionRunId: receipt.decisionRunId }),
            utils.aperture.desk.summary.invalidate(),
          ]);
          toast.success("Underwriting complete. Review the playbook below.", {
            description: "No paper ticket has been created.",
          });
          setUnderwritingDirty(false);
          setRevisingReceipt(false);
        } catch (error: any) {
          void utils.aperture.underwriter.status.invalidate();
          toast.error("Mission saved; check underwriting progress.", {
            description: `${error?.message ?? "The analysis response was interrupted."} The server task may still be running. Open its progress before retrying. No paper ticket or broker order was requested.`,
          });
        }
      } else {
        setRevisingReceipt(false);
        toast.success(branch === "cash" ? "Cash / no-trade recorded at $0 risk" : "Conditional review queued");
      }
    } catch (error: any) {
      toast.error(error?.message ?? "The Capital Mission could not be recorded.");
    }
  };

  const commit = async () => {
    if (commitLatch.current) return;
    commitLatch.current = true;
    setCommitting(true);
    try { await commitOnce(); }
    finally { commitLatch.current = false; setCommitting(false); }
  };

  const validateUnderwrittenPlay = async (playId: string) => {
    if (!underwritingResult) return;
    if (horizonMismatch) return toast.info("The recorded horizons disagree. Resolve them through an explicit Mission revision before selecting a play.");
    try {
      const selection = await validatePlay.mutateAsync({
        underwritingRunId: underwritingResult.underwritingRunId,
        underwritingRevisionId: underwritingResult.underwritingRevisionId,
        playId,
      });
      const started = await startResearch.mutateAsync({
        decisionRunId: selection.decisionRunId,
        revisionId: selection.decisionRevisionId,
        uatCase: uatCase ?? undefined,
      });
      if (started.status === "blocked") {
        toast.error(started.message, { description: "No paper ticket or broker order was created." });
        return;
      }
      toast.success("Play selected. Research validation opened.", {
        description: "No paper ticket has been created. Approval and submission remain separate.",
      });
      onOpenResearchRun(started.runId);
    } catch (error: any) {
      toast.error(error?.message ?? "The play could not enter research.", { description: "No paper ticket or broker order was created." });
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
  const applyDraftValues = (values: MissionDraftValues) => {
    setSelectedCanonicalId(values.canonicalThesisId);
    setSelectedAccountId(values.accountId);
    setBaseMission({ decisionRunId: values.baseDecisionRunId, decisionRevisionId: values.baseDecisionRevisionId });
    dispatchMissionSection({ type: "hydrate", section: values.activeSection });
    setCapital(values.capital);
    setMaxLoss(values.maxLoss);
    setTargetProfit(values.targetProfit);
    setTargetPeriod(values.targetPeriod);
    setHoldingPeriod(values.holdingPeriod);
    setHoldingPeriods(values.holdingPeriods);
    setObjective(values.objective);
    setInstrument(values.instrument);
    setIncludeHeld(values.includeHeld);
    setMission(values.mission);
    setMissionDirty(values.missionDirty);
    setEditing(values.editingMission);
    setShowTune(values.showTune);
    setBranch(values.branch);
    setReason(values.reason);
    setBlocker(values.blocker);
    setReopen(values.reopen);
    setGateLabel(values.gateLabel);
    setNewTitle(values.newTitle);
    setNewBelief(values.newBelief);
    setDeclaredCatalystAt(values.declaredCatalystAt);
    setDeclaredCatalystLabel(values.declaredCatalystLabel);
    setEligibilityReviewAt(values.eligibilityReviewAt);
    setOutcomeReviewAtInput(values.outcomeReviewAtInput);
    setRevisingReceipt(values.revisingReceipt);
    setUnderwritingDirty(values.underwritingDirty);
  };

  useEffect(() => {
    // One hydration decision. Late receipt/projection queries must never replace
    // a resumed draft or edits the operator has already made in this view.
    if (receiptTarget || draftInitialized || receiptLoading || draftQuery.isLoading
      || canonicalQuery.isLoading || capitalQuery.isLoading || accountQuery.isLoading
      || receiptStructureInvalid || receiptError || draftQuery.isError || canonicalQuery.isError || capitalQuery.isError || accountQuery.isError) return;
    const persisted = draftQuery.data ?? null;
    savedDraftRef.current = persisted;
    setSavedDraft(persisted);
    setDraftInitialized(true);
    if (persisted && persisted.completedAt == null) {
      applyDraftValues(persisted.values);
      return;
    }
    const receipt = runway?.latest;
    if (receipt?.authority !== "authoritative") {
      const defaults = projection?.missionDefaults;
      dispatchMissionSection({ type: "hydrate", section: initialMissionSection({ hasThesis: activeThesis != null, capitalCents: defaults?.deployableCapitalCents ?? 0, maxLossCents: defaults?.maxPlannedLossCents ?? 0 }) });
      if (defaults) {
        setCapital(defaults.deployableCapitalCents == null ? "" : String(defaults.deployableCapitalCents / 100));
        // A legacy desired-ending value has no target-period semantics.
        setTargetProfit("");
        setMaxLoss(defaults.maxPlannedLossCents == null ? "" : String(defaults.maxPlannedLossCents / 100));
        setHoldingPeriod(defaults.holdingPeriod ?? "intraday");
        setHoldingPeriods([defaults.holdingPeriod ?? "intraday"]);
        setInstrument(defaults.instrumentPreference ?? "either");
        setDeclaredCatalystAt(defaults.catalystAt);
        setDeclaredCatalystLabel(defaults.catalystLabel);
        setEligibilityReviewAt(defaults.eligibilityReviewAt == null ? "" : easternDateTimeInputFromEpoch(defaults.eligibilityReviewAt));
        setOutcomeReviewAtInput(defaults.outcomeReviewAt == null ? "" : easternDateTimeInputFromEpoch(defaults.outcomeReviewAt));
        setObjective(defaults.holdingPeriod === "intraday" ? "deploy_today" : "best_qualified_play");
      }
      return;
    }
    hydratedDecisionRevisionId.current = receipt.decisionRevisionId;
    dispatchMissionSection({ type: "hydrate", section: initialMissionSection({ hasThesis: true, capitalCents: receipt.deployableCapitalCents, maxLossCents: receipt.maxPlannedLossCents }) });
    setSelectedCanonicalId(receipt.canonicalThesisId);
    setSelectedAccountId(receipt.accountId);
    setBaseMission({ decisionRunId: receipt.decisionRunId, decisionRevisionId: receipt.decisionRevisionId });
    setMission(receipt.missionText);
    setCapital(String(Math.round(receipt.deployableCapitalCents / 100)));
    const receiptTargetProfitCents = receipt.targetProfitCents;
    const hasExplicitTarget = receiptTargetProfitCents != null && receipt.targetPeriod != null;
    setTargetProfit(receiptTargetProfitCents == null || receipt.targetPeriod == null ? "" : String(Math.round((receiptTargetProfitCents ?? 0) / 100)));
    setTargetPeriod((hasExplicitTarget ? receipt.targetPeriod : "week") as "session" | "week" | "month");
    setMaxLoss(String(Math.round(receipt.maxPlannedLossCents / 100)));
    setHoldingPeriod(receipt.holdingPeriod as HoldingPeriod);
    setHoldingPeriods((receipt.holdingPeriods?.length ? receipt.holdingPeriods : [receipt.holdingPeriod]) as HoldingPeriod[]);
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
    setOutcomeReviewAtInput(receipt.branch === "cash" ? receiptReview : "");
    setMissionDirty(true); // Immutable receipt text must never be regenerated from parameter defaults.
    setUnderwritingDirty(false);
    setRevisingReceipt(false);
  }, [receiptTarget, draftInitialized, receiptLoading, receiptError, draftQuery.data, draftQuery.isLoading, draftQuery.isError, canonicalQuery.isLoading, canonicalQuery.isError, capitalQuery.isLoading, capitalQuery.isError, accountQuery.isLoading, accountQuery.isError, runway?.latest, projection]);
  const plannedRiskCeiling = cockpit.data?.headroom.lines.find((line) => line.key === "planned_risk_per_play")?.ceilingCents ?? null;
  const concentrationLine = cockpit.data?.headroom.lines.find((line) => /single name/i.test(line.label)) ?? null;
  const receiptActive = !receiptTarget && !revisingReceipt && currentBindingMatches && (latestBranch === "cash" || latestBranch === "conditional");
  const visualWorkflowState = branchState(receiptActive ? latestBranch : branch);
  const concentrationBlocked = (concentrationLine?.usedPct ?? 0) >= 85;
  const capitalCents = parseMoney(capital);
  const targetStretchPct = capitalCents > 0 && explicitTargetProfitCents != null ? (explicitTargetProfitCents / capitalCents) * 100 : null;
  const sameSessionStretch = holdingPeriod === "intraday" && targetStretchPct != null && targetStretchPct >= 20;
  const dispositionReady = branch === "research" || (reason.trim().length >= 3 && blocker.trim().length >= 3 && reopen.trim().length >= 3 && (branch !== "conditional" || gateLabel.trim().length >= 3));
  const missionConfigured = capitalCents > 0 && parseMoney(maxLoss) > 0;
  const savedMission = runway?.latest?.authority === "authoritative" ? runway.latest : null;
  const changedAssumptions = savedMission ? [
    { label: "Thesis", before: String(savedMission.canonicalThesisId), after: String(activeCanonicalId ?? "Not assigned") },
    { label: "Paper account", before: String(savedMission.accountId), after: String(paperAccount?.id ?? "Not selected") },
    { label: "Deployable capital", before: formatCents(savedMission.deployableCapitalCents), after: capital.trim() ? formatCents(capitalCents) : "Not entered" },
    { label: "Planned-loss limit", before: formatCents(savedMission.maxPlannedLossCents), after: maxLoss.trim() ? formatCents(parseMoney(maxLoss)) : "Not entered" },
    { label: "Target", before: savedMission.targetProfitCents != null && savedMission.targetPeriod != null ? `${formatCents(savedMission.targetProfitCents)} / ${savedMission.targetPeriod}` : "Not requested", after: explicitTargetProfitCents != null ? `${formatCents(explicitTargetProfitCents)} / ${targetPeriod}` : "Not requested" },
    { label: "Primary horizon", before: horizonLabel(savedMission.holdingPeriod as HoldingPeriod), after: horizonLabel(holdingPeriod) },
    { label: "Underwriting horizons", before: (savedMission.holdingPeriods?.length ? savedMission.holdingPeriods : [savedMission.holdingPeriod]).slice().sort().map((period) => horizonLabel(period as HoldingPeriod)).join(", "), after: holdingPeriods.slice().sort().map(horizonLabel).join(", ") },
    { label: "Instruments", before: savedMission.instrumentPreference, after: instrument },
  ].filter((item) => item.before !== item.after) : [];
  const assumptionFingerprint = JSON.stringify(changedAssumptions);
  const needsRevisionReview = changedAssumptions.length > 0 && reviewedAssumptions !== assumptionFingerprint;
  const horizonMismatch = !holdingPeriods.includes(holdingPeriod);
  const activeMissionSection = !activeThesis ? 1 : !missionConfigured ? 2 : 3;
  const draftValues: MissionDraftValues = {
    schemaVersion: 1, canonicalThesisId: activeCanonicalId, accountId: selectedAccountId ?? paperAccount?.id ?? null,
    baseDecisionRunId: baseMission.decisionRunId, baseDecisionRevisionId: baseMission.decisionRevisionId,
    activeSection: visibleMissionSection as 1 | 2 | 3, capital, maxLoss, targetProfit, targetPeriod, holdingPeriod, holdingPeriods,
    objective, instrument, includeHeld, mission, missionDirty, editingMission: editing, showTune,
    branch, reason, blocker, reopen, gateLabel, newTitle, newBelief, declaredCatalystAt, declaredCatalystLabel,
    eligibilityReviewAt, outcomeReviewAtInput, revisingReceipt, underwritingDirty,
  };
  const latestDraftValues = useRef(draftValues);
  latestDraftValues.current = draftValues;
  const draftFingerprint = missionDraftFingerprint(draftValues);
  const draftState = missionDraftSaveState({ initialized: draftInitialized, values: draftValues, saved: savedDraft, saving: saveDraftMutation.isPending, error: draftError });
  const flushDraft = async (): Promise<MissionDraftRecord | null> => {
    if (receiptTarget) return null;
    if (!draftInitialized || draftFailureRef.current) throw new Error(draftFailureRef.current ?? "Wait for the saved Mission draft to load.");
    while (draftWriteRef.current) await draftWriteRef.current;
    if (draftFailureRef.current) throw new Error(draftFailureRef.current);
    const values = latestDraftValues.current;
    const previous = savedDraftRef.current;
    if (previous && previous.completedAt == null && missionDraftFingerprint(previous.values) === missionDraftFingerprint(values)) return previous;
    const request = saveDraftMutation.mutateAsync({ expectedVersion: previous?.version ?? 0, values });
    draftWriteRef.current = request;
    try {
      const saved = await request;
      savedDraftRef.current = saved;
      setSavedDraft(saved);
      utils.aperture.runway.draft.get.setData(undefined, saved);
      setDraftError(null);
      return saved;
    } catch (error: any) {
      const message = error?.message ?? "Draft could not be saved. Keep this view open and retry.";
      draftFailureRef.current = message;
      setDraftError(message);
      if (error?.data?.code === "CONFLICT") {
        setDraftConflict(true);
        void utils.aperture.runway.draft.get.fetch().then(setRemoteDraft).catch(() => {});
      }
      throw error;
    } finally {
      if (draftWriteRef.current === request) draftWriteRef.current = null;
    }
  };
  const flushDraftRef = useRef(flushDraft);
  flushDraftRef.current = flushDraft;
  useEffect(() => {
    if (receiptTarget || !draftInitialized || !draftTouched || draftError || busy || completedDraftRef.current) return;
    const timer = window.setTimeout(() => { void flushDraftRef.current().catch(() => {}); }, 650);
    return () => window.clearTimeout(timer);
  }, [receiptTarget, draftInitialized, draftTouched, draftFingerprint, draftError, busy]);
  useEffect(() => {
    if (receiptTarget || !draftTouched || draftState === "saved") return;
    const warnUnsaved = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnUnsaved);
    return () => window.removeEventListener("beforeunload", warnUnsaved);
  }, [receiptTarget, draftTouched, draftState]);
  const retryDraft = async () => {
    draftFailureRef.current = null;
    setDraftError(null);
    try { await flushDraft(); } catch { /* nearby status preserves the edits */ }
  };
  const useRemoteDraft = () => {
    if (!remoteDraft) return;
    applyDraftValues(remoteDraft.values);
    savedDraftRef.current = remoteDraft;
    setSavedDraft(remoteDraft);
    setDraftConflict(false);
    setDraftError(null);
    draftFailureRef.current = null;
    setDraftTouched(false);
    setRemoteDraft(null);
  };
  const saveReviewedLocalDraft = async () => {
    if (!remoteDraft) return;
    // Explicit acceptance of the displayed before/after is required. A second
    // remote edit still fails CAS; it is never a force-write.
    savedDraftRef.current = remoteDraft;
    setSavedDraft(remoteDraft);
    setDraftConflict(false);
    setRemoteDraft(null);
    await retryDraft();
  };
  const previewFeasibility = missionConfigured ? authoritativePreview.data?.feasibility ?? null : null;
  const previewPortfolioRisk = authoritativePreview.data?.portfolioRisk ?? null;
  const portfolioHeadroomExhausted = previewPortfolioRisk?.bindingConstraint === "portfolio_headroom_exhausted"
    || previewPortfolioRisk?.remainingHeadroomCents === 0;
  const resultTargetProfitCents = underwritingResult?.objective.targetProfitCents != null && underwritingResult.objective.targetPeriod != null
    ? underwritingResult.objective.targetProfitCents
    : null;
  // The invalid-shape flag above blocks every authoritative action. This local
  // guard also prevents a stale mutation cache from invoking .sort on a string.
  const resultHoldingPeriods = Array.isArray(underwritingResult?.objective.holdingPeriods)
    ? underwritingResult.objective.holdingPeriods.slice().sort().join(",") : null;
  const underwritingMatchesInputs = underwritingResult != null
    && underwritingResult.decisionRevisionId === currentDecisionRevisionId
    && underwritingResult.objective.deployableCapitalCents === capitalCents
    && resultTargetProfitCents === explicitTargetProfitCents
    && underwritingResult.objective.targetPeriod === (explicitTargetProfitCents == null ? null : targetPeriod)
    && underwritingResult.objective.maxPlannedLossCents === parseMoney(maxLoss)
    && underwritingResult.objective.instrumentPreference === instrument
    && resultHoldingPeriods === holdingPeriods.slice().sort().join(",");
  const underwritingComplete = branch === "research"
    && !revisingReceipt
    && !underwritingDirty
    && underwritingMatchesInputs
    && !runUnderwriting.isPending
    && !runUnderwriting.error;
  const feasibilityForDisplay = persistedUnderwritingLoading ? null : underwritingComplete ? underwritingResult?.feasibility ?? previewFeasibility : previewFeasibility;
  const effectiveRiskSummary = missionEffectiveRiskSummary(feasibilityForDisplay);
  // Inspect current limits without editing the draft, navigating away, or
  // mixing another account's cached cockpit with the selected account.
  const previewForAccount = authoritativePreview.data?.account.id === paperAccount?.id ? authoritativePreview.data : null;
  const cockpitForAccount = cockpit.data?.account.accountId === paperAccount?.id ? cockpit.data : null;
  const riskInspection: MissionRiskInspectionContext = {
    accountId: paperAccount?.id ?? null,
    accountLabel: paperAccount?.label ?? "No paper account selected",
    accountAsOf: previewForAccount?.account.lastSyncedAt ?? paperAccount?.lastSyncedAt ?? null,
    calculationAsOf: previewForAccount?.asOf ?? null,
    calculationBasis: "Current mission preview",
    feasibility: previewForAccount?.feasibility ?? null,
    risk: previewForAccount?.risk ?? null,
    loading: authoritativePreview.isFetching || cockpit.isFetching,
    failed: authoritativePreview.isError || cockpit.isError,
    lines: cockpitForAccount?.headroom.lines ?? [],
    headroomAsOf: cockpitForAccount?.generatedAt ?? null,
  };
  const refreshRiskInspection = () => {
    if (!paperAccount) return;
    void cockpit.refetch();
    if (missionConfigured) void authoritativePreview.refetch();
  };
  const feasibilityHasExplicitTarget = feasibilityForDisplay?.targetProfitCents != null && feasibilityForDisplay.targetPeriod != null;
  const primaryActionBlocker = missionContextError
    ? "Saved context is unavailable. Refresh saved context; your visible edits will not be replaced."
    : draftError ? "Resolve the draft save issue above before continuing."
    : draftConflict ? "Review the other device's draft before continuing."
    : horizonMismatch ? "Primary and underwriting horizons disagree. Inspect both in Review & underwrite and explicitly choose the intended scope."
    : needsRevisionReview ? "Review the before/after assumptions in Review & underwrite."
    : !paperAccount ? "Select an available paper account in Account & risk."
    : branch === "research" && missionConfigured && authoritativePreview.isError ? "Refresh the effective risk constraint in Account & risk before underwriting."
    : branch === "research" && missionConfigured && authoritativePreview.isLoading ? "Checking the effective account and portfolio constraint."
    : jobNeedsReconciliation ? "Open the saved underwriting task to view progress or deliberately retry."
    : currentDecisionRunId != null && (underwritingJob.isLoading || underwritingJob.isError) ? "Check saved task status before starting new analysis."
    : persistedUnderwritingUnavailable
    ? "Refresh the page to reconcile the saved underwriting result before starting new analysis."
    : mission.trim().length < 20
    ? "Complete the mission statement in Thesis & horizon."
    : !missionConfigured
      ? capitalCents <= 0
        ? "Enter deployable capital in Account & risk."
        : "Enter a planned-loss limit in Account & risk."
      : !dispositionReady
        ? "Complete the required decision fields in Review & underwrite."
        : null;
  const openDiagnostic = (target: "thesis" | "evidence" | "mechanism" | "risk" | "gate") => {
    markDraftEdited();
    const sectionId = target === "thesis" ? "assigned-thesis" : target === "risk" ? "mission-math" : "mission-disposition";
    setExpandedMissionSection(target === "thesis" ? 1 : target === "risk" ? 2 : 3);
    window.setTimeout(() => {
      const section = document.getElementById(sectionId);
      section?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      section?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    }, 0);
  };
  const reviseReceipt = () => {
    markDraftEdited();
    const receipt = runway?.latest;
    if (!receipt || !("deployableCapitalCents" in receipt)) return;
    setMission(receipt.missionText);
    setMissionDirty(true);
    setCapital(String(Math.round(receipt.deployableCapitalCents / 100)));
    const receiptTargetProfitCents = receipt.targetProfitCents;
    const hasExplicitTarget = receiptTargetProfitCents != null && receipt.targetPeriod != null;
    setTargetProfit(receiptTargetProfitCents == null || receipt.targetPeriod == null ? "" : String(Math.round((receiptTargetProfitCents ?? 0) / 100)));
    setTargetPeriod((hasExplicitTarget ? receipt.targetPeriod : "week") as "session" | "week" | "month");
    setMaxLoss(String(Math.round(receipt.maxPlannedLossCents / 100)));
    setHoldingPeriod(receipt.holdingPeriod as HoldingPeriod);
    setHoldingPeriods((receipt.holdingPeriods?.length ? receipt.holdingPeriods : [receipt.holdingPeriod]) as HoldingPeriod[]);
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
    setOutcomeReviewAtInput(receipt.branch === "cash" ? receiptReview : "");
    setRevisingReceipt(true);
  };
  const authoritativeLatest = runway?.latest?.authority === "authoritative" ? runway.latest : null;
  const currentCashOutcome = authoritativeLatest
    ? (pendingOutcomes ?? []).find((item) => item.revisionId === authoritativeLatest.decisionRevisionId && item.kind === "play_outcome") ?? null
    : null;
  const recordCashOutcome = async (pendingOutcomeId: number, outcome: "cash_remained_correct" | "cash_too_early" | "cash_too_conservative" | "inconclusive", note: string) => {
    await resolveCashOutcome.mutateAsync({ pendingOutcomeId, outcome, note });
    await Promise.all([utils.aperture.runway.pending.invalidate(), utils.aperture.runway.latest.invalidate(), utils.aperture.desk.summary.invalidate()]);
    toast.success("Cash look-back recorded. The original receipt remains immutable.");
  };

  if (!receiptTarget && !draftInitialized && missionContextError) {
    return <section role="alert" className="mx-auto max-w-3xl rounded-2xl border p-5" style={{ borderColor: "var(--sh-red)", background: "var(--sh-surface)" }}><h1 className="font-serif text-2xl">Saved Mission context unavailable</h1><p className="mt-2 text-sm leading-6">The saved draft, receipt, thesis, or account could not be loaded. This is not an empty Mission. No new analysis has started.</p><Button className="mt-4 min-h-11" onClick={() => void refreshMissionContext()}>Retry loading saved context</Button></section>;
  }
  if (missionContextLoading || (receiptTarget && receiptLoading)) {
    return <section role="status" aria-live="polite" className="mx-auto max-w-3xl rounded-2xl border p-6 text-sm" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>{receiptTarget ? "Loading immutable decision receipt…" : "Loading saved Mission and draft… No new analysis is starting."}</section>;
  }
  if (receiptTarget && (receiptError || !immutableReceipt || !immutableReceipt.binding)) {
    const fixture = readIsolatedUatIdentity();
    return <section className="mx-auto max-w-3xl rounded-2xl border p-6" style={{ borderColor: "var(--sh-red)", background: "var(--sh-surface)" }}><p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>Decision binding unavailable</p><p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>This receipt cannot be safely reconstructed from its stored owner, thesis, account, mandate, and revision binding. No proposal or research continuation is available.</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => window.location.assign(aperturePathForFixture("/aperture/runs", fixture))}>Return to Research Journeys</Button><Button variant="outline" onClick={() => window.location.assign(aperturePathForFixture("/aperture", fixture))}>Return to Decision Center</Button></div>{import.meta.env.DEV && receiptError ? <details className="mt-4 text-xs" style={{ color: "var(--sh-fg-muted)" }}><summary>Development diagnostic</summary><pre className="mt-2 whitespace-pre-wrap">{receiptError.message}</pre></details> : null}</section>;
  }
  if (immutableReceipt && !revisingReceipt && (latestBranch === "cash" || latestBranch === "conditional")) {
    return <section className="mx-auto max-w-4xl space-y-5 pb-24"><div className="grid gap-px overflow-hidden rounded-xl border sm:grid-cols-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}><ReceiptFact label="Owner" value="Owner scoped" /><ReceiptFact label="Thesis snapshot" value={immutableReceipt.binding.canonicalThesisName} /><ReceiptFact label="Paper account" value={immutableReceipt.binding.accountLabel} /><ReceiptFact label="Mandate / revision" value={`${immutableReceipt.binding.mandateVersion} · v${immutableReceipt.binding.decisionVersion}`} /></div><article className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><DecisionReceipt branch={latestBranch as "cash" | "conditional"} reason={latestReason} blocker={latestBlocker} reopen={latestReopen} gateLabel={latestGate} reviewAt={latestReviewAt} revision={latestRevision} recordedAt={latestRecordedAt} binding={immutableReceipt.binding} pendingCashOutcome={currentCashOutcome} recordedCashOutcome={authoritativeLatest?.cashOutcome} onRecordCashOutcome={recordCashOutcome} resolvingCashOutcome={resolveCashOutcome.isPending} onGateReview={reviseReceipt} onRevise={reviseReceipt} /></article></section>;
  }

  return <section className="mx-auto max-w-[1440px] space-y-5 pb-24" onChangeCapture={markDraftEdited} onClickCapture={(event) => { if (event.target instanceof Element && event.target.closest("[data-draft-edit]")) markDraftEdited(); }}>
    {!receiptTarget && <div className="flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: "var(--sh-fg-muted)" }}><p><strong style={{ color: "var(--sh-text-primary)" }}>{paperAccount?.label ?? "Select paper account"}</strong> · Paper</p><p role="status" aria-live="polite">{draftError ? "Draft not saved" : draftState === "saving" ? "Saving draft…" : draftState === "saved" ? `Saved · ${new Date(savedDraft!.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : draftTouched ? "Changes not yet saved" : savedDraft?.completedAt != null ? "From your saved Mission" : "Draft saves as you edit"}</p></div>}
    {missionContextError && draftInitialized && <div role="alert" className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--sh-red)" }}><p>Saved context could not be refreshed. Your last loaded values remain visible; underwriting is withheld.</p><Button variant="outline" className="mt-2 min-h-11" onClick={() => void refreshMissionContext()}>Refresh saved context</Button></div>}
    {draftError && <section role="alert" className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--sh-red)", background: "var(--sh-surface)" }}><h2 className="font-semibold">{draftConflict ? "Another device changed this draft" : "Draft save needs attention"}</h2><p className="mt-2 leading-6">{draftError}</p>{draftConflict ? <><p className="mt-2">Your edits are still here. Compare before choosing which version to keep.</p>{remoteDraft ? <><DraftDifference local={draftValues} remote={remoteDraft.values} /><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" onClick={useRemoteDraft}>Use saved draft</Button><Button className="min-h-11" onClick={() => void saveReviewedLocalDraft()}>Save these edits as a new revision</Button></div></> : <Button variant="outline" className="mt-3 min-h-11" onClick={() => void utils.aperture.runway.draft.get.fetch().then(setRemoteDraft).catch(() => toast.error("The saved draft could not be loaded. Your edits remain here."))}>Load saved draft for comparison</Button>}</> : !completedDraftRef.current ? <Button variant="outline" className="mt-3 min-h-11" onClick={() => void retryDraft()}>Retry saving draft</Button> : <Button variant="outline" className="mt-3 min-h-11" onClick={() => window.location.reload()}>Reload saved Mission</Button>}</section>}
    {(jobNeedsReconciliation || runUnderwriting.error || underwritingStructureInvalid) && underwritingTaskPath && <section role="status" aria-live="polite" className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface)" }}><h2 className="font-semibold">Saved underwriting task</h2><p className="mt-2 leading-6">{underwritingStructureInvalid ? "The saved result has malformed horizon data. Reload its corrected record; do not restart the completed job." : underwritingJob.data?.message ?? "The analysis response was interrupted. Check actual progress before retrying."}</p><Button className="mt-3 min-h-11" onClick={() => window.location.assign(underwritingTaskPath)}>{underwritingJob.data?.state === "running" ? "View underwriting progress" : "Review underwriting task"}</Button><p className="mt-2">Leaving this view does not cancel the task. No paper ticket has been requested.</p></section>}
    <details className="rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm">Saved context & provenance</summary><div className="grid gap-px overflow-hidden rounded-b-xl border-t md:grid-cols-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}>
      {[
        ["Assigned thesis · from saved thesis", activeThesis?.name ?? "Not assigned"],
        ["Paper account · account snapshot", paperAccount ? paperAccount.label + (paperAccount.equityValueCents ? " · $" + Math.round(paperAccount.equityValueCents / 100).toLocaleString() : "") : "Not connected"],
        ["Freshness", paperAccount?.lastSyncedAt ? new Date(paperAccount.lastSyncedAt).toLocaleString() : "Not measured"],
        ["Current decision", persistedUnderwritingLoading ? "Checking saved underwriting…" : persistedUnderwritingUnavailable ? "Saved underwriting unavailable" : underwritingComplete ? "Underwriting complete" : currentBindingMatches ? branchLabel(latestBranch) : "New draft context"],
      ].map(([label, value]) => <div key={label} className="p-4" style={{ background: "var(--sh-surface)" }}><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>{label}</p><p className="mt-1 text-sm font-semibold" style={{ color: label === "Current decision" && currentBindingMatches && latestBranch === "cash" ? "var(--sh-signal)" : "var(--sh-text-primary)" }}>{value}</p></div>)}
    </div>

    </details>
    <fieldset disabled={busy} className="min-w-0 space-y-5">
    {!activeThesis && <section className="rounded-2xl border p-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Start here</p>
      <h1 className="mt-1 font-serif text-3xl" style={{ color: "var(--sh-text-primary)" }}>Build the thesis for this mission.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>Name the belief and state what you expect to be true. Aperture keeps you on this operator surface.</p>
      {(canonicalTheses?.length ?? 0) > 0 && <label className="mt-4 block text-sm font-semibold">Or choose a saved thesis<select aria-label="Choose saved thesis" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3" style={{ borderColor: "var(--sh-border-1)" }} value={activeCanonicalId ?? ""} onChange={(event) => { setSelectedCanonicalId(Number(event.target.value)); setMissionDirty(false); setUnderwritingDirty(true); }}><option value="">Choose a thesis</option>{canonicalTheses?.map((thesis) => <option key={thesis.id} value={thesis.id}>{canonicalThesisLabel(thesis)}</option>)}</select></label>}
      <div className="mt-4 grid gap-3 md:grid-cols-[18rem_1fr_auto] md:items-end">
        <label className="text-xs font-semibold">Thesis name<input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 text-sm" style={{ borderColor: "var(--sh-border-1)" }} placeholder="AI Infrastructure Momentum" /></label>
        <label className="text-xs font-semibold">Belief<textarea value={newBelief} onChange={(event) => setNewBelief(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} placeholder="Liquid infrastructure suppliers may benefit from..." /></label>
        <Button className="min-h-11" disabled={busy || newTitle.trim().length < 2 || newBelief.trim().length < 20} onClick={buildThesisHere}>Assign thesis <ArrowRight className="ml-2 h-4 w-4" /></Button>
      </div>
      <p className="mt-2 text-sm" style={{ color: "var(--sh-fg-muted)" }}>To assign a thesis, enter at least 2 characters for its name and 20 for your belief. Incomplete input is saved as a draft.</p>
    </section>}

    {activeThesis && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <article className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
        <header className="flex items-center justify-between gap-3 border-b p-4 sm:p-5" style={{ borderColor: "var(--sh-border-1)" }}><div className="min-w-0"><div className="flex items-center gap-1"><p className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}><Target className="h-3.5 w-3.5" />Set the Capital Mission</p><ContextHelp title="What is a Capital Mission?" what="Your instruction for one decision: what to look for, the target to test, and the most you will risk." next="Underwrite the mission, validate one conditional play, then enter the existing research and paper lifecycle." /></div><p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>Set the objective. The target never increases allowed risk.</p></div><span className="shrink-0 rounded border px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>{holdingPeriod.replace("_", " ")}</span></header>
        <nav aria-label="Capital Mission sections" className="border-b" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><ol className="grid grid-cols-3 gap-px" style={{ background: "var(--sh-border-1)" }}>{[
          { number: 1, label: "Thesis & horizon", summary: `${canonicalThesisLabel(activeThesis)} · ${horizonLabel(holdingPeriod)}` },
          { number: 2, label: "Account & risk", summary: missionConfigured ? `${formatCents(capitalCents)} allocated · ${effectiveRiskSummary}` : "Capital or loss limit missing" },
          { number: 3, label: "Review & underwrite", summary: persistedUnderwritingLoading ? "Checking saved result" : persistedUnderwritingUnavailable ? "Saved result unavailable" : underwritingComplete ? "Underwriting complete · review result" : primaryActionBlocker ?? "Ready to underwrite" },
        ].map((section) => <li key={section.number}><button type="button" aria-current={visibleMissionSection === section.number ? "step" : undefined} className="flex min-h-14 w-full items-start gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" style={{ background: visibleMissionSection === section.number ? "color-mix(in srgb, var(--sh-signal) 8%, var(--sh-surface-2))" : "var(--sh-surface-2)", color: visibleMissionSection === section.number ? "var(--sh-signal)" : "var(--sh-text-primary)" }} onClick={() => setExpandedMissionSection(section.number as 1 | 2 | 3)}><span className="font-mono text-xs tabular-nums">{section.number}</span><span className="min-w-0"><span className="block text-[0.62rem] font-semibold uppercase tracking-[0.08em]">{section.label}{section.number < activeMissionSection ? <span className="sr-only"> complete</span> : null}</span><span className="mt-1 hidden text-xs sm:block font-normal normal-case tracking-normal" style={{ color: "var(--sh-fg-muted)" }}>{section.summary}</span></span></button></li>)}</ol></nav>
        {receiptActive ? <DecisionReceipt branch={latestBranch as "cash" | "conditional"} reason={latestReason} blocker={latestBlocker} reopen={latestReopen} gateLabel={latestGate} reviewAt={latestReviewAt} revision={latestRevision} recordedAt={latestRecordedAt} binding={immutableReceipt?.binding} pendingCashOutcome={currentCashOutcome} recordedCashOutcome={authoritativeLatest?.cashOutcome} onRecordCashOutcome={recordCashOutcome} resolvingCashOutcome={resolveCashOutcome.isPending} onGateReview={reviseReceipt} onRevise={reviseReceipt} /> : <><div className="space-y-5 p-5 sm:p-7">
          <div hidden={visibleMissionSection !== 1} className="space-y-5"><section aria-labelledby="mission-section-thesis" className="space-y-3"><div className="flex items-center justify-between"><div><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>1 · Thesis & horizon</p><h2 id="mission-section-thesis" className="mt-1 text-sm font-semibold">What do you believe, and for how long?</h2></div><span className="text-xs" style={{ color: "var(--sh-emerald)" }}>Saved thesis</span></div><div id="assigned-thesis" className="rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 32%, var(--sh-border-1))", background: "color-mix(in srgb, var(--sh-signal) 6%, var(--sh-surface))" }}>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="flex gap-3"><BookOpen className="mt-0.5 h-5 w-5" style={{ color: "var(--sh-signal)" }} /><div><p className="text-[0.62rem] font-semibold uppercase tracking-[0.13em]" style={{ color: "var(--sh-fg-muted)" }}>Assigned thesis loaded</p><p className="mt-1 text-sm font-semibold">{canonicalThesisLabel(activeThesis)}</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Run-specific edits create a new receipt. The saved thesis remains unchanged.</p></div></div><select aria-label="Switch assigned thesis" className="min-h-11 rounded-md border bg-transparent px-2 text-xs" style={{ borderColor: "var(--sh-border-1)" }} value={activeCanonicalId ?? ""} onChange={(event) => { setSelectedCanonicalId(Number(event.target.value)); setMissionDirty(false); setUnderwritingDirty(true); }}><option value="" disabled>Switch thesis</option>{(canonicalTheses ?? []).map((item) => <option key={item.id} value={item.id}>{canonicalThesisLabel(item)}</option>)}</select></div>
          </div>

          <div><div className="flex items-start justify-between gap-3"><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Capital Mission</p><Button data-draft-edit variant="ghost" size="sm" className="min-h-11" onClick={() => setEditing((value) => !value)}><Pencil className="mr-2 h-3.5 w-3.5" />{editing ? "Done" : "Edit mission"}</Button></div>
            {editing ? <><Textarea value={mission} onChange={(event) => { setMission(event.target.value); setMissionDirty(true); setUnderwritingDirty(true); }} className="mt-2 min-h-28 font-serif text-lg leading-snug sm:text-xl" /><div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Frame it as</span>{["Where can I…", "How can I…", "What must…"].map((starter) => <button key={starter} type="button" className="min-h-11 rounded-md border px-2.5 text-xs" style={{ borderColor: "var(--sh-border-1)" }} onClick={() => { setMission(starter + " "); setMissionDirty(true); setUnderwritingDirty(true); }}>{starter}</button>)}</div></> : <h1 className="mt-2 max-w-3xl font-serif text-[1.25rem] leading-[1.2] sm:text-[1.65rem] lg:text-[1.9rem]" style={{ color: "var(--sh-text-primary)" }}>{mission}</h1>}
          </div><p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Your horizon determines which catalysts and review dates matter.</p><Button type="button" variant="outline" className="min-h-11" onClick={() => setExpandedMissionSection(2)}>Review account & risk<ArrowRight className="ml-2 h-4 w-4" /></Button></section>

          <TypedStatusStrip state={visualWorkflowState} horizon={horizonLabel(holdingPeriod)} operatorCapCents={parseMoney(maxLoss) || null} syncedAt={paperAccount?.lastSyncedAt ?? null} catalystLabel={(currentBindingMatches ? latestGate : null) ?? (declaredCatalystAt != null ? `Declared ${new Date(declaredCatalystAt).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}` : declaredCatalystLabel ? `Declared · ${declaredCatalystLabel} · date/time not normalized` : null)} />
          <ArgumentRail state={visualWorkflowState} operatorCapCents={parseMoney(maxLoss) || null} evidenceLabel={latestGate ?? "—"} gateLabel={latestBranch === "conditional" ? "Conditional / opening held" : latestBranch === "cash" ? "Cash / opening held" : "Research only"} onDiagnosticSelect={openDiagnostic} /></div>

          {visibleMissionSection === 2 && <label className="block text-sm font-semibold">Paper account<select aria-label="Mission paper account" value={paperAccount?.id ?? ""} onChange={(event) => { setSelectedAccountId(Number(event.target.value)); setUnderwritingDirty(true); }} className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3" style={{ borderColor: "var(--sh-border-1)" }}><option value="" disabled>Choose a paper account</option>{accounts?.filter((account) => account.isPaper).map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select><span className="mt-1 block font-normal" style={{ color: "var(--sh-fg-muted)" }}>Account snapshot is context, not capital allocated to this Mission.</span></label>}
          <div hidden={visibleMissionSection !== 2} className="space-y-5"><section id="mission-math" aria-labelledby="mission-section-risk"><div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: visibleMissionSection === 2 ? "var(--sh-signal)" : "var(--sh-fg-muted)" }}>2 · Account & risk</p><h2 id="mission-section-risk" className="mt-1 text-sm font-semibold">Confirm the capital and loss boundary.</h2></div><span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Operator-declared inputs</span></div><div className="grid overflow-hidden rounded-xl border sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "var(--sh-border-1)" }}>
            <MoneyField label="Capital" value={capital} onChange={(value) => {
              setCapital(value);
              setMissionDirty(true); // Preserve the operator-authored mission across parameter edits.
              setUnderwritingDirty(true);
            }} help="Allocated to this mission · not total account value" />
            {branch === "research" ? <TargetProfitField value={targetProfit} onChange={(value) => { setTargetProfit(value); setUnderwritingDirty(true); }} period={targetPeriod} onPeriodChange={(value) => { setTargetPeriod(value); setUnderwritingDirty(true); }} /> : <div className="border-b p-3 text-[0.68rem] sm:border-b-0 sm:border-r" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Profit target<p className="mt-1 font-serif text-xl" style={{ color: "var(--sh-text-primary)" }}>Not used</p><span className="text-[10px]">{branch === "cash" ? "Cash carries $0 risk." : "Gate review, not return target."}</span></div>}
            <label className="border-b p-3 text-[0.68rem] sm:border-b-0 sm:border-r" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Horizon<select aria-label="Holding horizon" className="mt-1 min-h-11 w-full bg-transparent font-serif text-xl" style={{ color: "var(--sh-text-primary)" }} value={holdingPeriod} onChange={(event) => { setHoldingPeriod(event.target.value as HoldingPeriod); setHoldingPeriods((current) => replacePrimaryMissionHorizon(holdingPeriod, event.target.value as HoldingPeriod, current)); setMissionDirty(true); setUnderwritingDirty(true); }}><option value="intraday">Today</option><option value="overnight">Next close</option><option value="swing">This week</option><option value="catalyst_window">Named catalyst</option><option value="position">Long term · review every 30 days</option></select><span className="text-[10px]">Determines relevant catalysts and review dates</span></label>
            <MoneyField label="Max planned loss" value={maxLoss} onChange={(value) => { setMaxLoss(value); setUnderwritingDirty(true); }} help={`${capitalCents > 0 ? `${((parseMoney(maxLoss) / capitalCents) * 100).toFixed(1)}% of mission capital` : "Can tighten, never loosen"}`} />
          </div>{!missionConfigured && <div role="status" className="mt-2 rounded-lg border px-3 py-2 text-xs leading-5" style={{ borderColor: "var(--sh-signal)", background: "color-mix(in srgb, var(--sh-signal) 6%, var(--sh-surface))", color: "var(--sh-fg-muted)" }}><strong style={{ color: "var(--sh-text-primary)" }}>Mission not configured.</strong> Enter Capital and Max planned loss above $0. Preserve cash is a separate recorded decision.</div>}</section>
          {branch === "research" && targetStretchPct != null && explicitTargetProfitCents != null && <div className="flex flex-col gap-2 rounded-lg border px-3 py-3 text-xs" style={{ borderColor: sameSessionStretch ? "var(--sh-red)" : "var(--sh-border-1)", background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)" }}><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-serif text-lg" style={{ color: "var(--sh-text-primary)" }}>+{formatCents(explicitTargetProfitCents)} · +{targetStretchPct.toFixed(0)}% · aspiration</p><BasisMark basis="aspirational" label="Aspirational" /></div><p>Research may conclude that no qualifying play reaches this value within the declared risk limit.{sameSessionStretch ? " Same-session stretch requires horizon verification." : ""}</p></div>}
          <p className="text-xs font-semibold" style={{ color: "var(--sh-fg-muted)" }}>Target feasibility · {underwritingComplete ? "completed result" : "before underwriting"}</p><MissionReviewFeasibility feasibility={feasibilityForDisplay} enteredLossCents={parseMoney(maxLoss)} normalPolicyPct={cockpit.data?.mandate.maxPlannedRiskPctPerPlay ?? null} policyVersion={cockpit.data?.mandate.version ?? null} accountCeilingCents={plannedRiskCeiling} openRiskCents={previewPortfolioRisk?.beforeCents ?? null} remainingHeadroomCents={previewPortfolioRisk?.remainingHeadroomCents ?? null} inspection={riskInspection} onInspect={refreshRiskInspection} />

        {missionConfigured && authoritativePreview.isLoading && !underwritingComplete && <p role="status" aria-live="polite" className="rounded-lg border p-3 text-xs" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Checking the effective account and portfolio constraint…</p>}
        {missionConfigured && authoritativePreview.isError && !underwritingComplete && <p role="alert" className="rounded-lg border p-3 text-xs leading-5" style={{ borderColor: "var(--sh-red)", color: "var(--sh-red)" }}>The effective portfolio constraint could not be verified. Your current inputs remain visible; check draft status above. Underwriting is withheld until the constraint can be verified.</p>}

          <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
            <div><p className="text-xs font-semibold">Declared catalyst</p><p className="mt-1 text-sm" style={{ color: "var(--sh-text-primary)" }}>{declaredCatalystAt != null ? new Date(declaredCatalystAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " ET" : declaredCatalystLabel ? `${declaredCatalystLabel} · date/time not normalized` : "Not declared in thesis"}</p><p className="mt-1 text-[10px]" style={{ color: "var(--sh-fg-muted)" }}>Source-preserved from the assigned thesis; declaration is not verification.</p></div>
            <DateTimeField label={branch === "conditional" ? "Gate review (ET)" : "Outcome look-back (ET)"} value={branch === "conditional" ? eligibilityReviewAt : outcomeReviewAtInput} onChange={branch === "conditional" ? setEligibilityReviewAt : setOutcomeReviewAtInput} help={branch === "conditional" ? "When the named gate reopens for operator review." : "When the operator should record what happened; never an automatic exit."} />
          </div>

          <details data-draft-edit open={showTune} onToggle={(event) => setShowTune(event.currentTarget.open)} className="rounded-xl border" style={{ borderColor: "var(--sh-border-1)" }}><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold"><span>Tune this run</span><ChevronDown className={"h-4 w-4 transition-transform " + (showTune ? "rotate-180" : "")} /></summary><div className="grid gap-4 border-t p-4 sm:grid-cols-3" style={{ borderColor: "var(--sh-border-1)" }}>
            <label className="text-xs font-semibold">Objective<select aria-label="Mission objective" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2" style={{ borderColor: "var(--sh-border-1)" }} value={objective} onChange={(event) => { setObjective(event.target.value as Objective); setUnderwritingDirty(true); }}><option value="best_qualified_play">Best qualified play</option><option value="deploy_today">Deploy today</option><option value="verify_catalyst">Verify catalyst</option><option value="portfolio_gap">Portfolio gap</option><option value="preserve_optionality">Preserve optionality</option></select></label>
            <label className="text-xs font-semibold">Instrument preference<select aria-label="Instrument preference" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2" style={{ borderColor: "var(--sh-border-1)" }} value={instrument} onChange={(event) => { setInstrument(event.target.value as "shares" | "options" | "either"); setUnderwritingDirty(true); }}><option value="shares">Shares</option><option value="either">Either, if eligible</option><option value="options">Defined-risk options</option></select></label>
            <label className="flex min-h-11 items-center gap-2 self-end text-xs font-semibold"><input type="checkbox" checked={includeHeld} onChange={(event) => { setIncludeHeld(event.target.checked); setUnderwritingDirty(true); }} /> Include held research</label>
          </div><fieldset className="border-t p-4" style={{ borderColor: "var(--sh-border-1)" }}><legend className="px-1 text-xs font-semibold">Underwriting horizons</legend><div className="mt-2 flex flex-wrap gap-2">{(["intraday", "overnight", "swing", "catalyst_window", "position"] as HoldingPeriod[]).map((period) => <label key={period} className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-xs" style={{ borderColor: holdingPeriods.includes(period) ? "var(--sh-signal)" : "var(--sh-border-1)" }}><input type="checkbox" checked={holdingPeriods.includes(period)} onChange={(event) => { setHoldingPeriods((current) => event.target.checked ? Array.from(new Set([...current, period])) : current.length === 1 ? current : current.filter((item) => item !== period)); setUnderwritingDirty(true); }} />{horizonLabel(period)}</label>)}</div></fieldset></details><Button type="button" className="min-h-11" disabled={!missionConfigured} onClick={() => setExpandedMissionSection(3)}>Review mission<ArrowRight className="ml-2 h-4 w-4" /></Button></div>

          <div hidden={visibleMissionSection !== 3}><section id="mission-disposition" aria-labelledby="mission-section-review" className="rounded-xl border p-4" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>3 · Review & underwrite</p><h2 id="mission-section-review" className="mt-1 text-sm font-semibold">Confirm the mission before analysis.</h2><dl className="mt-3 grid gap-px overflow-hidden rounded-lg border text-xs sm:grid-cols-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}><ReceiptFact label="Thesis" value={canonicalThesisLabel(activeThesis)} /><ReceiptFact label="Capital / instruments" value={`${formatCents(capitalCents)} · ${instrument === "either" ? "Shares or options" : instrument}`} /><ReceiptFact label="Target / effective risk" value={`${explicitTargetProfitCents != null ? `${formatCents(explicitTargetProfitCents)} / ${targetPeriod}` : "No explicit target"} · ${effectiveRiskSummary}`} /></dl><p className="mt-3 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Choose how to finish setup. Underwriting builds a research playbook; it does not create or submit an order.</p>
            <MissionHorizonSummary primary={holdingPeriod} underwriting={holdingPeriods} onUsePrimary={() => { markDraftEdited(); setHoldingPeriods([holdingPeriod]); setUnderwritingDirty(true); setRevisingReceipt(true); }} />
            {branch === "research" && <MissionReviewFeasibility feasibility={feasibilityForDisplay} enteredLossCents={parseMoney(maxLoss)} normalPolicyPct={cockpit.data?.mandate.maxPlannedRiskPctPerPlay ?? null} policyVersion={cockpit.data?.mandate.version ?? null} accountCeilingCents={plannedRiskCeiling} openRiskCents={previewPortfolioRisk?.beforeCents ?? null} remainingHeadroomCents={previewPortfolioRisk?.remainingHeadroomCents ?? null} inspection={riskInspection} onInspect={refreshRiskInspection} />}
            {changedAssumptions.length > 0 && <section className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--sh-signal)" }}><h3 className="font-semibold">Review changed assumptions</h3><dl className="mt-2 space-y-3">{changedAssumptions.map((item) => <div key={item.label}><dt className="font-semibold">{item.label}</dt><dd className="mt-1 break-words"><span style={{ color: "var(--sh-fg-muted)" }}>{item.before}</span> → {item.after}</dd></div>)}</dl><p className="mt-3 leading-6">A new Mission revision will re-evaluate eligibility. Existing orders, approvals, and history remain unchanged.</p><label className="mt-2 flex min-h-11 items-center gap-2"><input type="checkbox" checked={!needsRevisionReview} onChange={(event) => setReviewedAssumptions(event.target.checked ? assumptionFingerprint : null)} />I reviewed these changed assumptions</label></section>}
            <div data-draft-edit className="mt-3 grid gap-2 sm:grid-cols-3">{([
              { id: "research", label: "Search for a play", icon: FileSearch },
              { id: "conditional", label: "Hold for a condition", icon: ShieldCheck },
              { id: "cash", label: "Preserve cash", icon: CircleSlash2 },
            ] as const).map((item) => <button key={item.id} type="button" aria-pressed={branch === item.id} className="min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-semibold" style={{ borderColor: branch === item.id ? "var(--sh-signal)" : "var(--sh-border-1)", background: branch === item.id ? "color-mix(in srgb, var(--sh-signal) 7%, var(--sh-surface))" : "var(--sh-surface)" }} onClick={() => { setBranch(item.id); setUnderwritingDirty(true); }}><item.icon className="mr-2 inline h-4 w-4" />{item.label}</button>)}</div>
            {branch !== "research" && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold sm:col-span-2">Why this is the right outcome<Textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-16" placeholder="State the decision basis." /></label><TextField label="Current blocker" value={blocker} onChange={setBlocker} /><TextField label="Reopen when" value={reopen} onChange={setReopen} />{branch === "conditional" && <div className="sm:col-span-2"><TextField label="Named gate" value={gateLabel} onChange={setGateLabel} /></div>}</div>}
          </section></div>
        </div>
        <footer className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><div className="max-w-xl text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}><p>{persistedUnderwritingLoading ? "Checking saved underwriting. No new analysis can start until the saved result is known." : persistedUnderwritingUnavailable ? "Saved underwriting status is unavailable. Refresh this page before starting new analysis." : underwritingComplete && branch === "research" ? "Underwriting complete. Review the result below; no paper ticket has been created." : branch === "cash" ? "Records $0 at risk, removes the order path, and keeps the outcome look-back." : branch === "conditional" ? "Queues the named gate; no proposal or broker path opens." : "Builds a research playbook. Does not create or submit an order."}</p>{primaryActionBlocker && !busy && !persistedUnderwritingLoading ? <p role={persistedUnderwritingUnavailable ? "alert" : "status"} className="mt-1 font-semibold" style={{ color: "var(--sh-signal)" }}>Before this action: {primaryActionBlocker}</p> : null}</div><Button id="mission-primary-action" className="min-h-11 w-full sm:w-auto" disabled={busy || primaryActionBlocker != null || persistedUnderwritingLoading || underwritingComplete || persistedUnderwritingUnavailable} onClick={commit}>{runUnderwriting.isPending ? "Underwriting…" : saveMission.isPending ? "Saving mission…" : persistedUnderwritingLoading ? "Checking saved underwriting…" : persistedUnderwritingUnavailable ? "Saved result unavailable" : branch === "cash" ? "Record cash · $0 risk" : branch === "conditional" ? "Queue conditional review" : underwritingComplete ? "Underwriting complete · review result" : "Underwrite my mission"}{!underwritingComplete && !persistedUnderwritingLoading && !persistedUnderwritingUnavailable && <ArrowRight className="ml-2 h-4 w-4" />}</Button></footer>{underwritingComplete && <section id="mission-underwriting-receipt" role="status" aria-live="polite" className="border-t p-4 sm:p-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Underwriting complete</p><p className="mt-1 text-sm font-semibold">Underwriting complete. Review the result below.</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>No paper ticket has been created. Validate a play only after its evidence checks are complete.</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => document.getElementById("mission-underwriting-result")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })}>Review result<ArrowRight className="ml-2 h-4 w-4" /></Button></section>}</>}
      </article>

      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <section className="rounded-2xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4" style={{ color: "var(--sh-signal)" }} /><p className="text-sm font-semibold">Suggested missions</p><ContextHelp title="How are these ranked?" what="The system compares thesis fit, account headroom, available evidence, and timing." next="Apply one to fill the mission. Underwrite it to test feasibility before research; no order is sent." align="start" /></div>
          <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Ranked for this thesis, account, and timeframe. #1 is the best-supported research path—not the highest-return forecast.</p>
          {!libraryBindings.ready ? <p className="mt-3 rounded-lg border border-dashed p-3 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Mission Library is waiting for {libraryBindings.missing.join(", ")}. No contextual mission can be shown yet.</p> : library.isLoading ? <p className="mt-3 rounded-lg border border-dashed p-3 text-xs" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Loading contextual Mission Library…</p> : library.isError ? <p role="alert" className="mt-3 rounded-lg border border-dashed p-3 text-xs leading-5" style={{ borderColor: "var(--sh-red)", color: "var(--sh-red)" }}>Mission Library is unavailable. Contextual ranking is withheld until the API returns verified data.</p> : (library.data?.length ?? 0) === 0 ? <p className="mt-3 rounded-lg border border-dashed p-3 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>No contextual missions are available for this thesis, account, and horizon. No fallback missions are shown.</p> : <><div className="mt-3 space-y-2">{(showAllMissions ? library.data ?? [] : (library.data ?? []).slice(0, 3)).map((item, index) => <article key={item.key} className="rounded-xl border p-3" style={{ borderColor: item.objective === objective ? "var(--sh-signal)" : "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{index + 1}. {item.label}</p><StateMark state={item.readiness === "conditional" ? "conditional" : "researchable"} compact /></div><p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{item.reasons[0]}</p><Button type="button" variant="outline" size="sm" className="mt-3 min-h-11 w-full" onClick={() => chooseMission(item)}>Apply mission parameters</Button></article>)}</div>{(library.data?.length ?? 0) > 3 && <Button variant="ghost" size="sm" className="mt-2 w-full min-h-11" aria-expanded={showAllMissions} onClick={() => setShowAllMissions((value) => !value)}>{showAllMissions ? "Show common missions" : "Show " + ((library.data?.length ?? 3) - 3) + " more"}<ChevronDown className={"ml-2 h-4 w-4 " + (showAllMissions ? "rotate-180" : "")} /></Button>}</>}
        </section>
        <section className="rounded-2xl border p-4 text-xs" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)" }}><p className="flex items-center gap-2 font-semibold" style={{ color: "var(--sh-text-primary)" }}><CheckCircle2 className="h-4 w-4" style={{ color: "var(--sh-emerald)" }} />Decision integrity</p><div className="mt-3 grid gap-2"><StateMark state="rule_qualified" label="Thesis bound" compact /><StateMark state="rule_qualified" label="Account bound" compact /><BasisMark basis="calculated" label={`Revision v${latestRevision ?? "—"}`} formula="immutable revision sequence" /><StateMark state={latestBranch === "cash" || latestBranch === "conditional" ? "blocked" : "researchable"} label={latestBranch === "cash" || latestBranch === "conditional" ? "Opening held" : "Evidence path"} compact /><StateMark state={paperAccount?.lastSyncedAt && Date.now() - paperAccount.lastSyncedAt <= 60 * 60 * 1000 ? "rule_qualified" : "stale"} label={paperAccount?.lastSyncedAt ? `Freshness ${new Date(paperAccount.lastSyncedAt).toLocaleString()}` : "Freshness —"} compact /></div><Button variant="ghost" size="sm" className="mt-3 min-h-11 px-0" onClick={onNewResearch}>Open research-only advanced setup</Button></section>
      </aside>
    </div>}

    </fieldset>
    {underwritingResult && !underwritingComplete && !runUnderwriting.isPending && <section role="status" className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}><strong>Mission assumptions changed.</strong> The result below is from the previous revision; review changed assumptions before new analysis.</section>}
    {runUnderwriting.isPending && currentUnderwriting.data && <section role="status" aria-live="polite" className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}><strong>Updating the underwriting result.</strong> The last successful result from {new Date(currentUnderwriting.data.asOf).toLocaleString()} remains available below.</section>}
    {runUnderwriting.error && underwritingResult && <section role="alert" className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--sh-red)", background: "var(--sh-surface)" }}><strong>Updated analysis failed.</strong> The last successful result remains visible and is not presented as fresh. No research, ticket, approval, submission, or order was created.</section>}
    {underwritingResult && branch === "research" && <section id="mission-underwriting-result" aria-labelledby="mission-underwriting-title" className="scroll-mt-20 space-y-4 rounded-2xl border p-4 sm:p-6" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><header><p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>Underwriting result · {new Date(underwritingResult.asOf).toLocaleString()}</p><h2 id="mission-underwriting-title" className="mt-1 font-serif text-3xl">What the market context means for this mission.</h2><p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>Review the conditional plays or the no-trade conclusion. Validating a play opens only the unresolved evidence checks.</p></header><PlayUnderwritingBrief result={underwritingResult} selectedPlayId={underwritingResult.selectedPlayId} busy={busy} onValidate={validateUnderwrittenPlay} /></section>}

    {currentBindingMatches && latestBranch === "cash" && <section className="rounded-2xl border p-5" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 45%, var(--sh-border-1))", background: "color-mix(in srgb, var(--sh-signal) 7%, var(--sh-surface))" }}><div className="flex items-start justify-between gap-4"><div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Cash receipt · current mission</p><h2 className="mt-1 font-serif text-3xl">$0 at risk.</h2><p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{latestReason ?? "Cash was recorded for the current mission."}</p><p className="mt-2 text-xs"><strong>Blocked by:</strong> {latestBlocker ?? "Named decision boundary"} · <strong>Reopen when:</strong> {latestReopen ?? "A new revision is recorded"}</p></div><CircleSlash2 className="h-7 w-7" style={{ color: "var(--sh-signal)" }} /></div></section>}

  </section>;
}

function DecisionReceipt({ branch, reason, blocker, reopen, gateLabel, reviewAt, revision, recordedAt, binding, pendingCashOutcome, recordedCashOutcome, onRecordCashOutcome, resolvingCashOutcome = false, onGateReview, onRevise }: { branch: "cash" | "conditional"; reason: string | null; blocker: string | null; reopen: string | null; gateLabel: string | null; reviewAt: number | null; revision: number | null; recordedAt: number | null; binding?: { canonicalThesisName: string; capitalThesisName: string; accountLabel: string; mandateVersion: string; decisionVersion: number }; pendingCashOutcome?: { id: number; dueAt: number; status: string } | null; recordedCashOutcome?: { result: Record<string, unknown> | null; resolvedAt: number | null } | null; onRecordCashOutcome?: (id: number, outcome: "cash_remained_correct" | "cash_too_early" | "cash_too_conservative" | "inconclusive", note: string) => Promise<void>; resolvingCashOutcome?: boolean; onGateReview: () => void; onRevise: () => void }) {
  const conditional = branch === "conditional";
  const [cashOutcome, setCashOutcome] = useState<"cash_remained_correct" | "cash_too_early" | "cash_too_conservative" | "inconclusive">("cash_remained_correct");
  const [cashNote, setCashNote] = useState("");
  const lookBackDue = pendingCashOutcome ? Date.now() >= pendingCashOutcome.dueAt : false;
  const outcomeLabel = recordedCashOutcome?.result?.outcome === "cash_remained_correct" ? "Cash remained correct" : recordedCashOutcome?.result?.outcome === "cash_too_early" ? "Cash was too early" : recordedCashOutcome?.result?.outcome === "cash_too_conservative" ? "Cash was too conservative" : "Inconclusive at the look-back";
  return <div className="space-y-4 p-5 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 gap-3"><div className="mt-0.5 rounded-full p-2" style={{ background: conditional ? "color-mix(in srgb, var(--sh-signal) 14%, var(--sh-surface))" : "color-mix(in srgb, var(--sh-signal) 8%, var(--sh-surface))", color: "var(--sh-signal)" }}>{conditional ? <CalendarClock className="h-5 w-5" /> : <CircleSlash2 className="h-5 w-5" />}</div><div><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>{conditional ? "Conditional receipt" : "Cash receipt"}</p><h2 className="mt-1 font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}>{conditional ? (gateLabel ?? "Named gate queued") : "$0 at risk"}</h2><p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>{conditional ? "A named operator review is queued. No proposal or broker path opens." : "Cash is the recorded control outcome for this mission."}</p></div></div><div className="flex flex-wrap gap-2">{conditional ? <Button className="min-h-11" onClick={onGateReview}>Resolve evidence gap</Button> : null}<Button variant="outline" className="min-h-11 shrink-0" onClick={onRevise}><Pencil className="mr-2 h-4 w-4" />Revise decision</Button></div></div><dl className="grid gap-px overflow-hidden rounded-xl border text-sm sm:grid-cols-2" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}><ReceiptFact label={conditional ? "Named gate" : "Reason"} value={conditional ? gateLabel ?? "Named gate not recorded" : reason ?? "Reason not recorded"} /><ReceiptFact label="Blocker" value={blocker ?? "Not recorded"} /><ReceiptFact label="Reopen when" value={reopen ?? "Not recorded"} /><ReceiptFact label={conditional ? "Due / horizon" : "Outcome look-back"} value={reviewAt ? new Date(reviewAt).toLocaleString() : recordedAt ? new Date(recordedAt).toLocaleString() : "Not measured"} /></dl>{binding ? <dl className="grid gap-px overflow-hidden rounded-xl border text-sm sm:grid-cols-2" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}><ReceiptFact label="Thesis snapshot" value={binding.canonicalThesisName} /><ReceiptFact label="Capital projection" value={binding.capitalThesisName} /><ReceiptFact label="Paper account" value={binding.accountLabel} /><ReceiptFact label="Mandate / revision" value={`${binding.mandateVersion} · v${binding.decisionVersion}`} /></dl> : null}{!conditional && pendingCashOutcome ? <section className="rounded-xl border p-4" style={{ borderColor: lookBackDue ? "var(--sh-signal)" : "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><p className="text-sm font-semibold">{lookBackDue ? "Record the cash look-back" : "Cash look-back scheduled"}</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{lookBackDue ? "Use observed evidence to close this learning step. This never creates an order." : `Available ${new Date(pendingCashOutcome.dueAt).toLocaleString()}. The original receipt remains unchanged.`}</p>{lookBackDue ? <div className="mt-3 grid gap-3"><select aria-label="Cash outcome" value={cashOutcome} onChange={(event) => setCashOutcome(event.target.value as typeof cashOutcome)} className="min-h-11 rounded-md border bg-transparent px-3 text-sm" style={{ borderColor: "var(--sh-border-1)" }}><option value="cash_remained_correct">Cash remained correct</option><option value="cash_too_early">Cash was too early</option><option value="cash_too_conservative">Cash was too conservative</option><option value="inconclusive">Inconclusive at this look-back</option></select><Textarea value={cashNote} onChange={(event) => setCashNote(event.target.value)} placeholder="Record the observed evidence and what changed." className="min-h-20" /><Button className="w-fit min-h-11" disabled={resolvingCashOutcome || cashNote.trim().length < 10} onClick={() => onRecordCashOutcome?.(pendingCashOutcome.id, cashOutcome, cashNote.trim())}>{resolvingCashOutcome ? "Recording…" : "Record outcome"}</Button></div> : null}</section> : null}{!conditional && recordedCashOutcome ? <section className="rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--sh-emerald) 45%, var(--sh-border-1))", background: "var(--sh-surface-2)" }}><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-emerald)" }}>Cash look-back recorded</p><p className="mt-1 text-sm font-semibold">{outcomeLabel}</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{String(recordedCashOutcome.result?.note ?? "No note recorded.")}{recordedCashOutcome.resolvedAt ? ` · ${new Date(recordedCashOutcome.resolvedAt).toLocaleString()}` : ""}</p></section> : null}<div className="flex flex-wrap gap-2 text-[11px]" style={{ color: "var(--sh-fg-muted)" }}><span className="rounded-full border px-2 py-1" style={{ borderColor: "var(--sh-border-1)" }}>Owner scoped</span><span className="rounded-full border px-2 py-1" style={{ borderColor: "var(--sh-border-1)" }}>Revision v{revision ?? "?"}</span><span className="rounded-full border px-2 py-1" style={{ borderColor: "var(--sh-border-1)" }}>{conditional ? "Gate review pending" : pendingCashOutcome ? "Outcome look-back open" : recordedCashOutcome ? "Learning closed" : "No paper exposure"}</span></div></div>;
}

export function missionEffectiveRiskSummary(feasibility: TargetFeasibility | null) {
  return feasibility == null ? "Checking effective risk…" : `${formatCents(feasibility.riskBudgetCents)} effective risk`;
}

export function MissionHorizonSummary({ primary, underwriting, onUsePrimary }: { primary: HoldingPeriod; underwriting: HoldingPeriod[]; onUsePrimary: () => void }) {
  const mismatch = !underwriting.includes(primary);
  return <section className="mt-3 text-sm" aria-label="Mission horizons"><dl className="grid gap-3 sm:grid-cols-2"><div><dt className="font-semibold">Primary horizon</dt><dd>{horizonLabel(primary)}</dd></div><div><dt className="font-semibold">Underwriting horizons</dt><dd>{underwriting.map(horizonLabel).join(", ") || "None selected"}</dd></div></dl>{mismatch && <div role="alert" className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--sh-signal)" }}><p className="font-semibold">The recorded horizons disagree.</p><p className="mt-2 leading-6">The primary horizon is not included in the underwriting scope. Choose the intended scope before new analysis. Previous receipts and jobs remain unchanged.</p><Button variant="outline" className="mt-2 min-h-11" onClick={onUsePrimary}>Use primary horizon only</Button><p className="mt-2 text-xs">Changes the draft only. Review the difference, then explicitly underwrite a new revision.</p></div>}</section>;
}

function DraftDifference({ local, remote }: { local: MissionDraftValues; remote: MissionDraftValues }) {
  const changed = (Object.keys(local) as (keyof MissionDraftValues)[]).filter((key) => JSON.stringify(local[key]) !== JSON.stringify(remote[key]));
  const display = (value: MissionDraftValues[keyof MissionDraftValues]) => value === "" || value == null ? "Not entered" : Array.isArray(value) ? value.join(", ") : String(value);
  return <dl className="mt-3 divide-y rounded-lg border px-3" style={{ borderColor: "var(--sh-border-1)" }}>{changed.map((key) => <div key={key} className="py-3"><dt className="font-semibold">{key.replace(/([A-Z])/g, " $1")}</dt><dd className="mt-1 break-words"><strong>Saved:</strong> {display(remote[key])}</dd><dd className="mt-1 break-words"><strong>Your edits:</strong> {display(local[key])}</dd></div>)}{changed.length === 0 && <div className="py-3">Both versions contain the same input. Accept the saved version to continue.</div>}</dl>;
}

export function MissionReviewFeasibility({ feasibility, enteredLossCents, normalPolicyPct, policyVersion = null, accountCeilingCents = null, openRiskCents = null, remainingHeadroomCents, inspection, onInspect }: { feasibility: TargetFeasibility | null; enteredLossCents: number; normalPolicyPct: number | null; policyVersion?: string | null; accountCeilingCents?: number | null; openRiskCents?: number | null; remainingHeadroomCents: number | null; inspection?: MissionRiskInspectionContext; onInspect: () => void }) {
  const disclosure = inspection
    ? <>{(inspection.loading || inspection.failed) && <p role="status" className="mt-2 leading-6" style={{ color: "var(--sh-signal)" }}>{inspection.loading ? "Refreshing constraints." : "Constraint refresh failed."} Recorded values remain visible; current eligibility is not confirmed.</p>}<MissionRiskInspection context={inspection} enteredLossCents={enteredLossCents} policyVersion={policyVersion} onRefresh={onInspect} /></>
    : <Button variant="outline" className="mt-2 min-h-11" onClick={onInspect}>{feasibility ? "Inspect effective constraint" : "Inspect account & risk"}</Button>;
  if (!feasibility) return <section className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--sh-signal)" }}><p role="status">Effective risk and target feasibility are not verified yet. No analysis can start while the saved constraint is unavailable.</p>{disclosure}</section>;
  const hasTarget = feasibility.targetProfitCents != null && feasibility.targetPeriod != null;
  const policyCents = normalPolicyPct == null ? null : Math.floor(feasibility.capitalBaseCents * normalPolicyPct / 100);
  const policyBinds = policyCents != null && policyCents === feasibility.riskBudgetCents && policyCents < enteredLossCents;
  return <section aria-label="Target feasibility and effective risk" className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: feasibility.classification === "extreme" ? "var(--sh-red)" : "var(--sh-border-1)" }}>
    <h3 className="font-semibold">Effective normal-play risk <span className="mt-1 block font-serif text-2xl tabular-nums">{formatCents(feasibility.riskBudgetCents)}</span></h3>
    <p className="mt-3 font-semibold">{hasTarget && feasibility.requiredReturnPct != null ? `${feasibility.requiredReturnPct}% per ${feasibility.targetPeriod} required · ${feasibility.classification}` : "No profit target requested"}</p>
    <p className="mt-2 leading-6" style={{ color: "var(--sh-fg-muted)" }}>{hasTarget ? `${formatCents(feasibility.targetProfitCents)} target ÷ ${formatCents(feasibility.capitalBaseCents)} declared mission capital. ` : ""}The target is an aspiration, not a forecast, and never increases allowed risk.</p><BasisMark basis="calculated" label="Target excluded from risk sizing" formula="minimum of mission, mandate, normal-play policy, aggregate and loss headroom" />
    <p className="mt-2 leading-6"><strong>You entered {formatCents(enteredLossCents)}.</strong> This is an input ceiling, not the final proposal allowance.</p>
    <p className="mt-2 leading-6" style={{ color: "var(--sh-fg-muted)" }}>{policyBinds ? `The normal-play policy caps risk at ${normalPolicyPct}% of your ${formatCents(feasibility.capitalBaseCents)} declared capital (${formatCents(policyCents)}).` : remainingHeadroomCents === 0 ? "Existing open risk has exhausted the aggregate portfolio headroom." : "The smallest measured mission, normal-play policy, account, aggregate, or loss headroom limit controls."} Your entered loss limit has not been changed.</p>
    {policyVersion != null && <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Policy source: loaded account mandate {policyVersion}. {normalPolicyPct != null ? `Normal-play setting: ${normalPolicyPct}% of declared mission capital, not total account value.` : "Normal-play setting unavailable."}{accountCeilingCents != null ? ` Account ceiling: ${formatCents(accountCeilingCents)}; a higher ceiling does not override the effective limit above.` : ""}</p>}
    {openRiskCents != null && remainingHeadroomCents != null && <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Aggregate open risk: {formatCents(openRiskCents)}. Remaining aggregate headroom: {formatCents(remainingHeadroomCents)}.</p>}
    {disclosure}
  </section>;
}

type MissionRiskInspectionContext = {
  accountId: number | null;
  accountLabel: string;
  accountAsOf: number | null;
  calculationAsOf: number | null;
  calculationBasis: string;
  feasibility: TargetFeasibility | null;
  risk: UnderwritingRiskPolicy | null;
  loading: boolean;
  failed: boolean;
  lines: CockpitHeadroomLine[];
  headroomAsOf: number | null;
};

function RiskTimestamp({ at }: { at: number | null }) {
  return at == null ? <>Not measured</> : <time dateTime={new Date(at).toISOString()}>{new Date(at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" })} ET</time>;
}

export function MissionRiskInspection({ context, enteredLossCents, policyVersion, onRefresh }: { context: MissionRiskInspectionContext; enteredLossCents: number; policyVersion: string | null; onRefresh: () => void }) {
  const { feasibility, risk } = context;
  const capitalCents = feasibility?.capitalBaseCents ?? null;
  const normalCents = capitalCents != null && risk ? Math.floor(capitalCents * risk.normalPlayRiskPct / 100) : null;
  const aggregateUsed = risk?.aggregateOpenRiskBeforeCents ?? null;
  const aggregateRemaining = feasibility && aggregateUsed != null ? Math.max(0, feasibility.maxOpenRiskCents - aggregateUsed) : null;
  const weeklyUsed = risk?.weeklyLossUsedCents ?? null;
  const weeklyRemaining = feasibility && weeklyUsed != null ? Math.max(0, feasibility.lossLimitCents - weeklyUsed) : null;
  const limits = [
    { label: "Mission planned-loss limit", value: enteredLossCents, basis: "Operator-declared; unchanged by inspection" },
    { label: "Normal-play policy", value: normalCents, basis: normalCents == null ? "Policy calculation unavailable" : `${risk!.normalPlayRiskPct}% × ${formatCents(capitalCents)} = ${formatCents(normalCents)}` },
    { label: "Account per-play ceiling", value: risk?.perPlayHeadroomCents ?? null, basis: "Loaded account mandate and account snapshot" },
    { label: "Aggregate risk headroom", value: aggregateRemaining, basis: aggregateRemaining == null ? "Open-risk calculation unavailable" : `${formatCents(feasibility!.maxOpenRiskCents)} − ${formatCents(aggregateUsed)} = ${formatCents(aggregateRemaining)} (floor at $0)` },
    { label: "Loss-budget headroom", value: weeklyRemaining, basis: weeklyRemaining == null ? "Loss-budget calculation unavailable" : `${formatCents(feasibility!.lossLimitCents)} − ${formatCents(weeklyUsed)} = ${formatCents(weeklyRemaining)} (floor at $0). Uses the server's recorded loss-budget usage; not verified weekly realized P&L.` },
  ];
  const binding = feasibility ? limits.filter(line => line.value === feasibility.riskBudgetCents).map(line => line.label) : [];
  return <details data-risk-inspection className="mt-3 rounded-lg border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
    <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Inspect effective constraint</summary>
    <div className="space-y-3 border-t p-3 text-sm leading-6" style={{ borderColor: "var(--sh-border-1)" }}>
      <p className="font-semibold">{context.accountLabel} · Paper{context.accountId != null ? ` · Account #${context.accountId}` : ""}</p>
      <p style={{ color: "var(--sh-fg-muted)" }}>Account snapshot as of <RiskTimestamp at={context.accountAsOf} />. {context.calculationBasis} as of <RiskTimestamp at={context.calculationAsOf} />.</p>
      {context.accountAsOf != null && context.calculationAsOf != null && context.calculationAsOf - context.accountAsOf > STALE_ACCOUNT_MS && <p style={{ color: "var(--sh-signal)" }}>Account snapshot was stale at calculation time. Refreshing constraints reads saved account data; sync the paper account before relying on current capacity.</p>}
      <p><strong>Effective normal-play risk: {formatCents(feasibility?.riskBudgetCents)}.</strong> {binding.length ? `Binding: ${binding.join(" and ")}.` : "The binding limit is not fully measured here."}</p>
      <p>The smallest applicable measured limit controls. Policy {policyVersion ?? "not available"}; declared mission capital {formatCents(capitalCents)} is not total account equity.</p>
      <dl className="divide-y" style={{ borderColor: "var(--sh-border-1)" }}>{limits.map(line => <div key={line.label} className="py-2">
        <dt className="flex flex-wrap justify-between gap-2 font-semibold"><span>{line.label}</span><span className="tabular-nums">{formatCents(line.value)}</span></dt>
        <dd style={{ color: "var(--sh-fg-muted)" }}>{line.basis}</dd>
      </div>)}</dl>
      <p style={{ color: "var(--sh-fg-muted)" }}>This preview does not set an event-specific limit. Exact play, liquidity, concentration, and ticket checks still apply. Planned loss at a share stop is not a guaranteed maximum loss.</p>
      <h4 className="font-semibold">Portfolio constraints</h4>
      <p style={{ color: "var(--sh-fg-muted)" }}>Cockpit snapshot as of <RiskTimestamp at={context.headroomAsOf} />. These are account limits, not additional mission capital; notional capacity is distinct from planned-loss capacity.</p>
      {context.lines.length ? <dl className="divide-y">{context.lines.map(line => <div key={line.key} className="py-2">
        <dt className="font-semibold">{line.label}{line.subject ? ` · ${line.subject}` : ""}</dt>
        <dd>Used {formatCents(line.usedCents)} · Limit {formatCents(line.ceilingCents)} · Remaining {formatCents(line.remainingCents)}</dd>
        <dd style={{ color: "var(--sh-fg-muted)" }}>Basis: {line.basis.replaceAll("_", " ")}.{line.reason ? ` ${line.reason}` : ""}</dd>
      </div>)}</dl> : <p>Portfolio headroom not measured. Refresh constraints to inspect it.</p>}
      <p>Your saved inputs, account selection, approvals, and orders remain unchanged.</p>
      <Button type="button" variant="outline" className="min-h-11" aria-disabled={context.loading || context.accountId == null} onClick={() => { if (!context.loading && context.accountId != null) onRefresh(); }}>Refresh constraints</Button>
      {context.accountId == null && <p>Select a paper account in this Mission before refreshing.</p>}
    </div>
  </details>;
}

function ReceiptFact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 p-3" style={{ background: "var(--sh-surface-2)" }}><dt className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>{label}</dt><dd className="mt-1 break-words text-sm" style={{ color: "var(--sh-text-primary)" }}>{value}</dd></div>;
}

function MoneyField({ label, value, onChange, help }: { label: string; value: string; onChange: (value: string) => void; help: string }) {
  return <label className="border-b p-3 text-[0.68rem] sm:border-b-0 sm:border-r" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>{label}<div className="mt-1 flex items-center font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}><span aria-hidden="true">$</span><input aria-label={label} inputMode="decimal" placeholder="Enter amount" maxLength={80} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 min-w-0 w-full bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 placeholder:font-sans placeholder:text-sm" /></div><span className="text-[10px]">{help}</span></label>;
}

function TargetProfitField({ value, onChange, period, onPeriodChange }: { value: string; onChange: (value: string) => void; period: "session" | "week" | "month"; onPeriodChange: (value: "session" | "week" | "month") => void }) {
  return <label className="border-b p-3 text-[0.68rem] sm:border-b-0 sm:border-r" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Target profit<div className="mt-1 flex items-center font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}><span aria-hidden="true">$</span><input aria-label="Target profit" inputMode="decimal" placeholder="Optional" maxLength={80} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 min-w-0 w-full bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 placeholder:font-sans placeholder:text-sm" /></div><select aria-label="Target period" className="mt-1 min-h-11 w-full rounded border bg-transparent px-2 text-xs" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }} value={period} onChange={(event) => onPeriodChange(event.target.value as typeof period)}><option value="session">Per session</option><option value="week">Per week</option><option value="month">Per month</option></select><span className="mt-1 block text-[10px]">Aspiration to test · never sizes risk</span></label>;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-xs font-semibold">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>;
}

function DateTimeField({ label, value, onChange, help }: { label: string; value: string; onChange: (value: string) => void; help: string }) {
  return <label className="text-xs font-semibold">{label}<input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /><span className="mt-1 block text-[10px] font-normal" style={{ color: "var(--sh-fg-muted)" }}>{help}</span></label>;
}
