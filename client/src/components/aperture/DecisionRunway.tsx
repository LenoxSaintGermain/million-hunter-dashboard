import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, BookOpen, CalendarClock, CheckCircle2, ChevronDown, CircleSlash2, FileSearch, Pencil, ShieldCheck, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { missionLibraryBindingState } from "@shared/missionLibraryQuery";
import { aperturePathForFixture, readIsolatedUatCase, readIsolatedUatIdentity } from "@shared/isolatedUatIdentity";
import { easternDateTimeInputFromEpoch, easternDateTimeInputToEpoch } from "@shared/easternMarketTime";
import { canonicalThesisLabel } from "@shared/canonicalThesisLabel";
import { ArgumentRail, BasisMark, RiskBudgetBar, StateMark, TypedStatusStrip, type WorkflowState } from "./DecisionVisualLanguage";
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

export function DecisionRunway({ onNewResearch, onOpenResearchRun, receiptTarget = null }: Props) {
  const utils = trpc.useUtils();
  const { data: runway, error: receiptError, isLoading: receiptLoading } = trpc.aperture.runway.latest.useQuery(receiptTarget ?? undefined, { retry: false });
  const { data: pendingOutcomes } = trpc.aperture.runway.pending.useQuery();
  const { data: canonicalTheses } = trpc.thesis.list.useQuery();
  const { data: capitalTheses } = trpc.aperture.thesis.list.useQuery();
  const { data: accounts } = trpc.aperture.account.list.useQuery();
  const [selectedCanonicalId, setSelectedCanonicalId] = useState<number | null>(null);
  const immutableReceipt = receiptTarget && runway?.latest?.authority === "authoritative" ? runway.latest : null;
  const currentDecisionRunId = runway?.latest?.authority === "authoritative" ? runway.latest.decisionRunId : null;
  const currentDecisionRevisionId = runway?.latest?.authority === "authoritative" ? runway.latest.decisionRevisionId : null;
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
  const [expandedMissionSection, setExpandedMissionSection] = useState<1 | 2 | 3 | null>(null);
  const [branch, setBranch] = useState<Branch>("research");
  const [reason, setReason] = useState("");
  const [blocker, setBlocker] = useState("");
  const [reopen, setReopen] = useState("");
  const [gateLabel, setGateLabel] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newBelief, setNewBelief] = useState("");
  const [revisingReceipt, setRevisingReceipt] = useState(false);
  const [underwritingDirty, setUnderwritingDirty] = useState(false);
  const [declaredCatalystAt, setDeclaredCatalystAt] = useState<number | null>(null);
  const [declaredCatalystLabel, setDeclaredCatalystLabel] = useState<string | null>(null);
  const [eligibilityReviewAt, setEligibilityReviewAt] = useState("");
  const [outcomeReviewAtInput, setOutcomeReviewAtInput] = useState("");
  const hydratedProjectionId = useRef<number | null>(null);
  const hydratedDecisionRevisionId = useRef<number | null>(null);
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
    if (!projection || immutableReceipt || hydratedProjectionId.current === projection.id) return;
    hydratedProjectionId.current = projection.id;
    const defaults = projection.missionDefaults;
    setCapital(defaults.deployableCapitalCents == null ? "" : String(defaults.deployableCapitalCents / 100));
    // A legacy desired-ending value has no target-period semantics. Do not
    // resurrect it as a visible aspiration or a profit target.
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
    setBranch("research");
    setMissionDirty(false);
    setUnderwritingDirty(false);
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
  const currentUnderwriting = trpc.aperture.underwriter.get.useQuery(
    { decisionRunId: currentDecisionRunId ?? 0 },
    { enabled: currentDecisionRunId != null, retry: false },
  );
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
  const persistedUnderwritingUnavailable = currentDecisionRunId != null && currentUnderwriting.isError && currentUnderwriting.data == null && runUnderwriting.data == null;
  const busy = createThesis.isPending || projectThesis.isPending || saveMission.isPending || runUnderwriting.isPending || validatePlay.isPending || startResearch.isPending || resolveCashOutcome.isPending;
  const underwritingResult = runUnderwriting.data ?? currentUnderwriting.data ?? null;

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

  const commit = async () => {
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
          toast.error("Mission saved; underwriting stopped safely.", {
            description: `${error?.message ?? "The analysis could not be completed."} No research run, paper ticket, approval, submission, or broker order was created.`,
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

  const validateUnderwrittenPlay = async (playId: string) => {
    if (!underwritingResult) return;
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
  useEffect(() => {
    const receipt = runway?.latest;
    if (receiptTarget || !currentBindingMatches || receipt?.authority !== "authoritative" || hydratedDecisionRevisionId.current === receipt.decisionRevisionId) return;
    hydratedDecisionRevisionId.current = receipt.decisionRevisionId;
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
  }, [currentBindingMatches, receiptTarget, runway?.latest]);
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
  const activeMissionSection = !activeThesis ? 1 : !missionConfigured ? 2 : 3;
  const visibleMissionSection = expandedMissionSection ?? activeMissionSection;
  const previewFeasibility = missionConfigured ? authoritativePreview.data?.feasibility ?? null : null;
  const previewPortfolioRisk = authoritativePreview.data?.portfolioRisk ?? null;
  const portfolioHeadroomExhausted = previewPortfolioRisk?.bindingConstraint === "portfolio_headroom_exhausted"
    || previewPortfolioRisk?.remainingHeadroomCents === 0;
  const resultTargetProfitCents = underwritingResult?.objective.targetProfitCents != null && underwritingResult.objective.targetPeriod != null
    ? underwritingResult.objective.targetProfitCents
    : null;
  const resultHoldingPeriods = underwritingResult?.objective.holdingPeriods?.slice().sort().join(",") ?? "";
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
  const feasibilityHasExplicitTarget = feasibilityForDisplay?.targetProfitCents != null && feasibilityForDisplay.targetPeriod != null;
  const primaryActionBlocker = persistedUnderwritingUnavailable
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
    const sectionId = target === "thesis" ? "assigned-thesis" : target === "risk" ? "mission-math" : "mission-disposition";
    setExpandedMissionSection(target === "thesis" ? 1 : target === "risk" ? 2 : 3);
    window.setTimeout(() => {
      const section = document.getElementById(sectionId);
      section?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      section?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    }, 0);
  };
  const reviseReceipt = () => {
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

  if (receiptTarget && receiptLoading) {
    return <section className="mx-auto max-w-3xl rounded-2xl border p-6 text-sm" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Loading immutable decision receipt…</section>;
  }
  if (receiptTarget && (receiptError || !immutableReceipt || !immutableReceipt.binding)) {
    const fixture = readIsolatedUatIdentity();
    return <section className="mx-auto max-w-3xl rounded-2xl border p-6" style={{ borderColor: "var(--sh-red)", background: "var(--sh-surface)" }}><p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>Decision binding unavailable</p><p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>This receipt cannot be safely reconstructed from its stored owner, thesis, account, mandate, and revision binding. No proposal or research continuation is available.</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => window.location.assign(aperturePathForFixture("/aperture/runs", fixture))}>Return to Research Journeys</Button><Button variant="outline" onClick={() => window.location.assign(aperturePathForFixture("/aperture", fixture))}>Return to Decision Center</Button></div>{import.meta.env.DEV && receiptError ? <details className="mt-4 text-xs" style={{ color: "var(--sh-fg-muted)" }}><summary>Development diagnostic</summary><pre className="mt-2 whitespace-pre-wrap">{receiptError.message}</pre></details> : null}</section>;
  }
  if (immutableReceipt && !revisingReceipt && (latestBranch === "cash" || latestBranch === "conditional")) {
    return <section className="mx-auto max-w-4xl space-y-5 pb-24"><div className="grid gap-px overflow-hidden rounded-xl border sm:grid-cols-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}><ReceiptFact label="Owner" value="Owner scoped" /><ReceiptFact label="Thesis snapshot" value={immutableReceipt.binding.canonicalThesisName} /><ReceiptFact label="Paper account" value={immutableReceipt.binding.accountLabel} /><ReceiptFact label="Mandate / revision" value={`${immutableReceipt.binding.mandateVersion} · v${immutableReceipt.binding.decisionVersion}`} /></div><article className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><DecisionReceipt branch={latestBranch as "cash" | "conditional"} reason={latestReason} blocker={latestBlocker} reopen={latestReopen} gateLabel={latestGate} reviewAt={latestReviewAt} revision={latestRevision} recordedAt={latestRecordedAt} binding={immutableReceipt.binding} pendingCashOutcome={currentCashOutcome} recordedCashOutcome={authoritativeLatest?.cashOutcome} onRecordCashOutcome={recordCashOutcome} resolvingCashOutcome={resolveCashOutcome.isPending} onGateReview={reviseReceipt} onRevise={reviseReceipt} /></article></section>;
  }

  return <section className="mx-auto max-w-[1440px] space-y-5 pb-24">
    <div className="grid gap-px overflow-hidden rounded-xl border md:grid-cols-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}>
      {[
        ["Assigned thesis · from saved thesis", activeThesis?.name ?? "Not assigned"],
        ["Paper account · account snapshot", paperAccount ? paperAccount.label + (paperAccount.equityValueCents ? " · $" + Math.round(paperAccount.equityValueCents / 100).toLocaleString() : "") : "Not connected"],
        ["Freshness", paperAccount?.lastSyncedAt ? new Date(paperAccount.lastSyncedAt).toLocaleString() : "Not measured"],
        ["Current decision", persistedUnderwritingLoading ? "Checking saved underwriting…" : persistedUnderwritingUnavailable ? "Saved underwriting unavailable" : underwritingComplete ? "Underwriting complete" : currentBindingMatches ? branchLabel(latestBranch) : "New draft context"],
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
        <header className="flex items-center justify-between gap-3 border-b p-4 sm:p-5" style={{ borderColor: "var(--sh-border-1)" }}><div className="min-w-0"><div className="flex items-center gap-1"><p className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}><Target className="h-3.5 w-3.5" />Set the Capital Mission</p><ContextHelp title="What is a Capital Mission?" what="Your instruction for one decision: what to look for, the target to test, and the most you will risk." next="Underwrite the mission, validate one conditional play, then enter the existing research and paper lifecycle." /></div><p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>Set the objective. The target never increases allowed risk.</p></div><span className="shrink-0 rounded border px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>{holdingPeriod.replace("_", " ")}</span></header>
        <nav aria-label="Capital Mission sections" className="border-b" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><ol className="grid gap-px sm:grid-cols-3" style={{ background: "var(--sh-border-1)" }}>{[
          { number: 1, label: "Thesis & horizon", summary: `${canonicalThesisLabel(activeThesis)} · ${horizonLabel(holdingPeriod)}` },
          { number: 2, label: "Account & risk", summary: missionConfigured ? persistedUnderwritingLoading ? `${formatCents(capitalCents)} allocated · checking saved risk` : `${formatCents(capitalCents)} allocated · ${formatCents(feasibilityForDisplay?.riskBudgetCents ?? plannedRiskCeiling ?? parseMoney(maxLoss))} effective risk` : "Capital or loss limit missing" },
          { number: 3, label: "Review & underwrite", summary: persistedUnderwritingLoading ? "Checking saved result" : persistedUnderwritingUnavailable ? "Saved result unavailable" : underwritingComplete ? "Underwriting complete · review result" : primaryActionBlocker ?? "Ready to underwrite" },
        ].map((section) => <li key={section.number}><button type="button" aria-current={visibleMissionSection === section.number ? "step" : undefined} className="flex min-h-14 w-full items-start gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" style={{ background: visibleMissionSection === section.number ? "color-mix(in srgb, var(--sh-signal) 8%, var(--sh-surface-2))" : "var(--sh-surface-2)", color: visibleMissionSection === section.number ? "var(--sh-signal)" : "var(--sh-text-primary)" }} onClick={() => setExpandedMissionSection(section.number as 1 | 2 | 3)}><span className="font-mono text-xs tabular-nums">{section.number}</span><span className="min-w-0"><span className="block text-[0.62rem] font-semibold uppercase tracking-[0.08em]">{section.label}{section.number < activeMissionSection ? <span className="sr-only"> complete</span> : null}</span><span className="mt-0.5 block truncate text-[0.68rem] font-normal normal-case tracking-normal" style={{ color: "var(--sh-fg-muted)" }}>{section.summary}</span></span></button></li>)}</ol></nav>
        {receiptActive ? <DecisionReceipt branch={latestBranch as "cash" | "conditional"} reason={latestReason} blocker={latestBlocker} reopen={latestReopen} gateLabel={latestGate} reviewAt={latestReviewAt} revision={latestRevision} recordedAt={latestRecordedAt} binding={immutableReceipt?.binding} pendingCashOutcome={currentCashOutcome} recordedCashOutcome={authoritativeLatest?.cashOutcome} onRecordCashOutcome={recordCashOutcome} resolvingCashOutcome={resolveCashOutcome.isPending} onGateReview={reviseReceipt} onRevise={reviseReceipt} /> : <><div className="space-y-5 p-5 sm:p-7">
          <div hidden={visibleMissionSection !== 1} className="space-y-5"><section aria-labelledby="mission-section-thesis" className="space-y-3"><div className="flex items-center justify-between"><div><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>1 · Thesis & horizon</p><h2 id="mission-section-thesis" className="mt-1 text-sm font-semibold">What do you believe, and for how long?</h2></div><span className="text-xs" style={{ color: "var(--sh-emerald)" }}>Saved thesis</span></div><div id="assigned-thesis" className="rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 32%, var(--sh-border-1))", background: "color-mix(in srgb, var(--sh-signal) 6%, var(--sh-surface))" }}>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="flex gap-3"><BookOpen className="mt-0.5 h-5 w-5" style={{ color: "var(--sh-signal)" }} /><div><p className="text-[0.62rem] font-semibold uppercase tracking-[0.13em]" style={{ color: "var(--sh-fg-muted)" }}>Assigned thesis loaded</p><p className="mt-1 text-sm font-semibold">{canonicalThesisLabel(activeThesis)}</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Run-specific edits create a new receipt. The saved thesis remains unchanged.</p></div></div><select aria-label="Switch assigned thesis" className="min-h-10 rounded-md border bg-transparent px-2 text-xs" style={{ borderColor: "var(--sh-border-1)" }} value={activeCanonicalId ?? ""} onChange={(event) => { setSelectedCanonicalId(Number(event.target.value)); setMissionDirty(false); setUnderwritingDirty(true); }}><option value="" disabled>Switch thesis</option>{(canonicalTheses ?? []).map((item) => <option key={item.id} value={item.id}>{canonicalThesisLabel(item)}</option>)}</select></div>
          </div>

          <div><div className="flex items-start justify-between gap-3"><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Capital Mission</p><Button variant="ghost" size="sm" className="min-h-10" onClick={() => setEditing((value) => !value)}><Pencil className="mr-2 h-3.5 w-3.5" />{editing ? "Done" : "Edit mission"}</Button></div>
            {editing ? <><Textarea value={mission} onChange={(event) => { setMission(event.target.value); setMissionDirty(true); setUnderwritingDirty(true); }} className="mt-2 min-h-28 font-serif text-lg leading-snug sm:text-xl" /><div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Frame it as</span>{["Where can I…", "How can I…", "What must…"].map((starter) => <button key={starter} type="button" className="min-h-9 rounded-md border px-2.5 text-xs" style={{ borderColor: "var(--sh-border-1)" }} onClick={() => { setMission(starter + " "); setMissionDirty(true); setUnderwritingDirty(true); }}>{starter}</button>)}</div></> : <h1 className="mt-2 max-w-3xl font-serif text-[1.25rem] leading-[1.2] sm:text-[1.65rem] lg:text-[1.9rem]" style={{ color: "var(--sh-text-primary)" }}>{mission}</h1>}
          </div><p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Your horizon determines which catalysts and review dates matter.</p><Button type="button" variant="outline" className="min-h-11" onClick={() => setExpandedMissionSection(2)}>Review account & risk<ArrowRight className="ml-2 h-4 w-4" /></Button></section>

          <TypedStatusStrip state={visualWorkflowState} horizon={horizonLabel(holdingPeriod)} operatorCapCents={parseMoney(maxLoss) || null} syncedAt={paperAccount?.lastSyncedAt ?? null} catalystLabel={(currentBindingMatches ? latestGate : null) ?? (declaredCatalystAt != null ? `Declared ${new Date(declaredCatalystAt).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}` : declaredCatalystLabel ? `Declared · ${declaredCatalystLabel} · date/time not normalized` : null)} />
          <ArgumentRail state={visualWorkflowState} operatorCapCents={parseMoney(maxLoss) || null} evidenceLabel={latestGate ?? "—"} gateLabel={latestBranch === "conditional" ? "Conditional / opening held" : latestBranch === "cash" ? "Cash / opening held" : "Research only"} onDiagnosticSelect={openDiagnostic} /></div>

          <div hidden={visibleMissionSection !== 2} className="space-y-5"><section id="mission-math" aria-labelledby="mission-section-risk"><div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: visibleMissionSection === 2 ? "var(--sh-signal)" : "var(--sh-fg-muted)" }}>2 · Account & risk</p><h2 id="mission-section-risk" className="mt-1 text-sm font-semibold">Confirm the capital and loss boundary.</h2></div><span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Operator-declared inputs</span></div><div className="grid overflow-hidden rounded-xl border sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "var(--sh-border-1)" }}>
            <MoneyField label="Capital" value={capital} onChange={(value) => {
              setCapital(value);
              setMissionDirty(true); // Preserve the operator-authored mission across parameter edits.
              setUnderwritingDirty(true);
            }} help="Allocated to this mission · not total account value" />
            {branch === "research" ? <TargetProfitField value={targetProfit} onChange={(value) => { setTargetProfit(value); setUnderwritingDirty(true); }} period={targetPeriod} onPeriodChange={(value) => { setTargetPeriod(value); setUnderwritingDirty(true); }} /> : <div className="border-b p-3 text-[0.68rem] sm:border-b-0 sm:border-r" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Profit target<p className="mt-1 font-serif text-xl" style={{ color: "var(--sh-text-primary)" }}>Not used</p><span className="text-[10px]">{branch === "cash" ? "Cash carries $0 risk." : "Gate review, not return target."}</span></div>}
            <label className="border-b p-3 text-[0.68rem] sm:border-b-0 sm:border-r" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Horizon<select aria-label="Holding horizon" className="mt-1 min-h-11 w-full bg-transparent font-serif text-xl" style={{ color: "var(--sh-text-primary)" }} value={holdingPeriod} onChange={(event) => { setHoldingPeriod(event.target.value as HoldingPeriod); setMissionDirty(true); setUnderwritingDirty(true); }}><option value="intraday">Today</option><option value="overnight">Next close</option><option value="swing">This week</option><option value="catalyst_window">Named catalyst</option><option value="position">Long term · review every 30 days</option></select><span className="text-[10px]">Determines relevant catalysts and review dates</span></label>
            <MoneyField label="Max planned loss" value={maxLoss} onChange={(value) => { setMaxLoss(value); setUnderwritingDirty(true); }} help={`${capitalCents > 0 ? `${((parseMoney(maxLoss) / capitalCents) * 100).toFixed(1)}% of mission capital` : "Can tighten, never loosen"}`} />
          </div>{!missionConfigured && <div role="status" className="mt-2 rounded-lg border px-3 py-2 text-xs leading-5" style={{ borderColor: "var(--sh-signal)", background: "color-mix(in srgb, var(--sh-signal) 6%, var(--sh-surface))", color: "var(--sh-fg-muted)" }}><strong style={{ color: "var(--sh-text-primary)" }}>Mission not configured.</strong> Enter Capital and Max planned loss above $0. Preserve cash is a separate recorded decision.</div>}</section>
          {branch === "research" && targetStretchPct != null && explicitTargetProfitCents != null && <div className="flex flex-col gap-2 rounded-lg border px-3 py-3 text-xs" style={{ borderColor: sameSessionStretch ? "var(--sh-red)" : "var(--sh-border-1)", background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)" }}><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-serif text-lg" style={{ color: "var(--sh-text-primary)" }}>+{formatCents(explicitTargetProfitCents)} · +{targetStretchPct.toFixed(0)}% · aspiration</p><BasisMark basis="aspirational" label="Aspirational" /></div><p>Research may conclude that no qualifying play reaches this value within the declared risk limit.{sameSessionStretch ? " Same-session stretch requires horizon verification." : ""}</p></div>}
          <RiskBudgetBar operatorCapCents={parseMoney(maxLoss) || null} perPlayCeilingCents={plannedRiskCeiling} accountEquityCents={paperAccount?.equityValueCents ?? null} accountMandatePct={cockpit.data?.mandate.maxPlannedRiskPctPerPlay ?? null} concentrationBlocked={concentrationBlocked} />

        {missionConfigured && authoritativePreview.isLoading && !underwritingComplete && <p role="status" aria-live="polite" className="rounded-lg border p-3 text-xs" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Checking the effective account and portfolio constraint…</p>}
        {missionConfigured && authoritativePreview.isError && !underwritingComplete && <p role="alert" className="rounded-lg border p-3 text-xs leading-5" style={{ borderColor: "var(--sh-red)", color: "var(--sh-red)" }}>The effective portfolio constraint could not be verified. The Mission remains saved locally in this view; underwriting will fail closed and recheck before analysis.</p>}
        {feasibilityForDisplay && <section className="rounded-xl border p-4" style={{ borderColor: feasibilityForDisplay.classification === "extreme" || portfolioHeadroomExhausted ? "var(--sh-red)" : "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Target feasibility · {underwritingComplete ? "completed result" : "before underwriting"}</p><p className="mt-1 font-serif text-xl">{!feasibilityHasExplicitTarget || feasibilityForDisplay.requiredReturnPct == null ? "No profit target requested" : `${feasibilityForDisplay.requiredReturnPct}% ${feasibilityForDisplay.targetPeriod} return required · ${feasibilityForDisplay.classification}`}</p></div><BasisMark basis="calculated" label="Target excluded from risk sizing" formula="tightest of mission, mandate, and measured headroom" /></div><p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{feasibilityForDisplay.assessment} Effective normal-play risk: <strong style={{ color: "var(--sh-text-primary)" }}>{formatCents(feasibilityForDisplay.riskBudgetCents)}</strong>.{portfolioHeadroomExhausted && !underwritingComplete ? ` Portfolio headroom is exhausted: ${formatCents(previewPortfolioRisk?.beforeCents)} open risk is at or above the ${formatCents(feasibilityForDisplay.maxOpenRiskCents)} aggregate limit; your planned-loss limit remains configured.` : ""}</p></section>}

          <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
            <div><p className="text-xs font-semibold">Declared catalyst</p><p className="mt-1 text-sm" style={{ color: "var(--sh-text-primary)" }}>{declaredCatalystAt != null ? new Date(declaredCatalystAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " ET" : declaredCatalystLabel ? `${declaredCatalystLabel} · date/time not normalized` : "Not declared in thesis"}</p><p className="mt-1 text-[10px]" style={{ color: "var(--sh-fg-muted)" }}>Source-preserved from the assigned thesis; declaration is not verification.</p></div>
            <DateTimeField label={branch === "conditional" ? "Gate review (ET)" : "Outcome look-back (ET)"} value={branch === "conditional" ? eligibilityReviewAt : outcomeReviewAtInput} onChange={branch === "conditional" ? setEligibilityReviewAt : setOutcomeReviewAtInput} help={branch === "conditional" ? "When the named gate reopens for operator review." : "When the operator should record what happened; never an automatic exit."} />
          </div>

          <details open={showTune} onToggle={(event) => setShowTune(event.currentTarget.open)} className="rounded-xl border" style={{ borderColor: "var(--sh-border-1)" }}><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold"><span>Tune this run</span><ChevronDown className={"h-4 w-4 transition-transform " + (showTune ? "rotate-180" : "")} /></summary><div className="grid gap-4 border-t p-4 sm:grid-cols-3" style={{ borderColor: "var(--sh-border-1)" }}>
            <label className="text-xs font-semibold">Objective<select aria-label="Mission objective" className="mt-1 min-h-10 w-full rounded-md border bg-transparent px-2" style={{ borderColor: "var(--sh-border-1)" }} value={objective} onChange={(event) => { setObjective(event.target.value as Objective); setUnderwritingDirty(true); }}><option value="best_qualified_play">Best qualified play</option><option value="deploy_today">Deploy today</option><option value="verify_catalyst">Verify catalyst</option><option value="portfolio_gap">Portfolio gap</option><option value="preserve_optionality">Preserve optionality</option></select></label>
            <label className="text-xs font-semibold">Instrument preference<select aria-label="Instrument preference" className="mt-1 min-h-10 w-full rounded-md border bg-transparent px-2" style={{ borderColor: "var(--sh-border-1)" }} value={instrument} onChange={(event) => { setInstrument(event.target.value as "shares" | "options" | "either"); setUnderwritingDirty(true); }}><option value="shares">Shares</option><option value="either">Either, if eligible</option><option value="options">Defined-risk options</option></select></label>
            <label className="flex min-h-10 items-center gap-2 self-end text-xs font-semibold"><input type="checkbox" checked={includeHeld} onChange={(event) => { setIncludeHeld(event.target.checked); setUnderwritingDirty(true); }} /> Include held research</label>
          </div><fieldset className="border-t p-4" style={{ borderColor: "var(--sh-border-1)" }}><legend className="px-1 text-xs font-semibold">Underwriting horizons</legend><div className="mt-2 flex flex-wrap gap-2">{(["intraday", "overnight", "swing", "catalyst_window", "position"] as HoldingPeriod[]).map((period) => <label key={period} className="flex min-h-10 items-center gap-2 rounded-md border px-3 text-xs" style={{ borderColor: holdingPeriods.includes(period) ? "var(--sh-signal)" : "var(--sh-border-1)" }}><input type="checkbox" checked={holdingPeriods.includes(period)} onChange={(event) => { setHoldingPeriods((current) => event.target.checked ? Array.from(new Set([...current, period])) : current.length === 1 ? current : current.filter((item) => item !== period)); setUnderwritingDirty(true); }} />{horizonLabel(period)}</label>)}</div></fieldset></details><Button type="button" className="min-h-11" disabled={!missionConfigured} onClick={() => setExpandedMissionSection(3)}>Review mission<ArrowRight className="ml-2 h-4 w-4" /></Button></div>

          <div hidden={visibleMissionSection !== 3}><section id="mission-disposition" aria-labelledby="mission-section-review" className="rounded-xl border p-4" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>3 · Review & underwrite</p><h2 id="mission-section-review" className="mt-1 text-sm font-semibold">Confirm the mission before analysis.</h2><dl className="mt-3 grid gap-px overflow-hidden rounded-lg border text-xs sm:grid-cols-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}><ReceiptFact label="Thesis / horizon" value={`${canonicalThesisLabel(activeThesis)} · ${horizonLabel(holdingPeriod)}`} /><ReceiptFact label="Capital / instruments" value={`${formatCents(capitalCents)} · ${instrument === "either" ? "Shares or options" : instrument}`} /><ReceiptFact label="Target / effective risk" value={`${explicitTargetProfitCents != null ? `${formatCents(explicitTargetProfitCents)} / ${targetPeriod}` : "No explicit target"} · ${persistedUnderwritingLoading ? "Checking saved risk" : formatCents(feasibilityForDisplay?.riskBudgetCents ?? plannedRiskCeiling ?? parseMoney(maxLoss))}`} /></dl><p className="mt-3 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Choose how to finish setup. Underwriting builds a research playbook; it does not create or submit an order.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">{([
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
          {!libraryBindings.ready ? <p className="mt-3 rounded-lg border border-dashed p-3 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Mission Library is waiting for {libraryBindings.missing.join(", ")}. No contextual mission can be shown yet.</p> : library.isLoading ? <p className="mt-3 rounded-lg border border-dashed p-3 text-xs" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Loading contextual Mission Library…</p> : library.isError ? <p role="alert" className="mt-3 rounded-lg border border-dashed p-3 text-xs leading-5" style={{ borderColor: "var(--sh-red)", color: "var(--sh-red)" }}>Mission Library is unavailable. Contextual ranking is withheld until the API returns verified data.</p> : (library.data?.length ?? 0) === 0 ? <p className="mt-3 rounded-lg border border-dashed p-3 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>No contextual missions are available for this thesis, account, and horizon. No fallback missions are shown.</p> : <><div className="mt-3 space-y-2">{(showAllMissions ? library.data ?? [] : (library.data ?? []).slice(0, 3)).map((item, index) => <article key={item.key} className="rounded-xl border p-3" style={{ borderColor: item.objective === objective ? "var(--sh-signal)" : "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{index + 1}. {item.label}</p><StateMark state={item.readiness === "conditional" ? "conditional" : "researchable"} compact /></div><p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{item.reasons[0]}</p><Button type="button" variant="outline" size="sm" className="mt-3 min-h-11 w-full" onClick={() => chooseMission(item)}>Apply mission parameters</Button></article>)}</div>{(library.data?.length ?? 0) > 3 && <Button variant="ghost" size="sm" className="mt-2 w-full min-h-10" aria-expanded={showAllMissions} onClick={() => setShowAllMissions((value) => !value)}>{showAllMissions ? "Show common missions" : "Show " + ((library.data?.length ?? 3) - 3) + " more"}<ChevronDown className={"ml-2 h-4 w-4 " + (showAllMissions ? "rotate-180" : "")} /></Button>}</>}
        </section>
        <section className="rounded-2xl border p-4 text-xs" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)" }}><p className="flex items-center gap-2 font-semibold" style={{ color: "var(--sh-text-primary)" }}><CheckCircle2 className="h-4 w-4" style={{ color: "var(--sh-emerald)" }} />Decision integrity</p><div className="mt-3 grid gap-2"><StateMark state="rule_qualified" label="Thesis bound" compact /><StateMark state="rule_qualified" label="Account bound" compact /><BasisMark basis="calculated" label={`Revision v${latestRevision ?? "—"}`} formula="immutable revision sequence" /><StateMark state={latestBranch === "cash" || latestBranch === "conditional" ? "blocked" : "researchable"} label={latestBranch === "cash" || latestBranch === "conditional" ? "Opening held" : "Evidence path"} compact /><StateMark state={paperAccount?.lastSyncedAt && Date.now() - paperAccount.lastSyncedAt <= 60 * 60 * 1000 ? "rule_qualified" : "stale"} label={paperAccount?.lastSyncedAt ? `Freshness ${new Date(paperAccount.lastSyncedAt).toLocaleString()}` : "Freshness —"} compact /></div><Button variant="ghost" size="sm" className="mt-3 min-h-10 px-0" onClick={onNewResearch}>Open research-only advanced setup</Button></section>
      </aside>
    </div>}

    {underwritingResult && !underwritingComplete && !runUnderwriting.isPending && <section role="status" className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}><strong>Mission assumptions changed.</strong> The result below is from the previous revision; underwrite again to refresh it.</section>}
    {runUnderwriting.isPending && currentUnderwriting.data && <section role="status" aria-live="polite" className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}><strong>Updating the underwriting result.</strong> The last successful result from {new Date(currentUnderwriting.data.asOf).toLocaleString()} remains available below.</section>}
    {runUnderwriting.error && underwritingResult && <section role="alert" className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--sh-red)", background: "var(--sh-surface)" }}><strong>Updated analysis failed.</strong> The last successful result remains visible and is not presented as fresh. No research, ticket, approval, submission, or order was created.</section>}
    {underwritingResult && branch === "research" && <section id="mission-underwriting-result" aria-labelledby="mission-underwriting-title" className="space-y-4 rounded-2xl border p-4 sm:p-6" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><header><p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>Underwriting result · {new Date(underwritingResult.asOf).toLocaleString()}</p><h2 id="mission-underwriting-title" className="mt-1 font-serif text-3xl">What the market context means for this mission.</h2><p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>Review the conditional plays or the no-trade conclusion. Validating a play opens only the unresolved evidence checks.</p></header><PlayUnderwritingBrief result={underwritingResult} selectedPlayId={underwritingResult.selectedPlayId} busy={busy} onValidate={validateUnderwrittenPlay} /></section>}

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

function ReceiptFact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 p-3" style={{ background: "var(--sh-surface-2)" }}><dt className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>{label}</dt><dd className="mt-1 break-words text-sm" style={{ color: "var(--sh-text-primary)" }}>{value}</dd></div>;
}

function MoneyField({ label, value, onChange, help }: { label: string; value: string; onChange: (value: string) => void; help: string }) {
  return <label className="border-b p-3 text-[0.68rem] sm:border-b-0 sm:border-r" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>{label}<div className="mt-1 flex items-center font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}><span aria-hidden="true">$</span><input aria-label={label} inputMode="decimal" placeholder="Enter amount" value={value ? displayMoney(value) : ""} onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, ""))} className="min-w-0 w-full bg-transparent outline-none placeholder:font-sans placeholder:text-sm" /></div><span className="text-[10px]">{help}</span></label>;
}

function TargetProfitField({ value, onChange, period, onPeriodChange }: { value: string; onChange: (value: string) => void; period: "session" | "week" | "month"; onPeriodChange: (value: "session" | "week" | "month") => void }) {
  return <label className="border-b p-3 text-[0.68rem] sm:border-b-0 sm:border-r" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Target profit<div className="mt-1 flex items-center font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}><span aria-hidden="true">$</span><input aria-label="Target profit" inputMode="decimal" placeholder="Optional" value={value ? displayMoney(value) : ""} onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, ""))} className="min-w-0 w-full bg-transparent outline-none placeholder:font-sans placeholder:text-sm" /></div><select aria-label="Target period" className="mt-1 min-h-11 w-full rounded border bg-transparent px-2 text-xs" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }} value={period} onChange={(event) => onPeriodChange(event.target.value as typeof period)}><option value="session">Per session</option><option value="week">Per week</option><option value="month">Per month</option></select><span className="mt-1 block text-[10px]">Aspiration to test · never sizes risk</span></label>;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-xs font-semibold">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>;
}

function DateTimeField({ label, value, onChange, help }: { label: string; value: string; onChange: (value: string) => void; help: string }) {
  return <label className="text-xs font-semibold">{label}<input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /><span className="mt-1 block text-[10px] font-normal" style={{ color: "var(--sh-fg-muted)" }}>{help}</span></label>;
}
