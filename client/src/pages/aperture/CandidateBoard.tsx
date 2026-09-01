/** Capital Aperture — decision-first evidence queue. Paper-only internal research. */
import { useEffect, useRef, useState } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleAlert, ClipboardCheck, FileText, Loader2, RefreshCw, SearchCheck, TrendingUp, XCircle } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { CapitalBrief } from "@/components/aperture/CapitalBrief";
import { ResearchLedger } from "@/components/aperture/ResearchLedger";
import { DecisionFocusCard } from "@/components/aperture/DecisionFocusCard";
import { PlayRecipeCard } from "@/components/aperture/PlayRecipeCard";
import { SetAsideHistory } from "@/components/aperture/SetAsideHistory";
import { decisionPriority, describeCandidateRecommendation, rankResearchCandidates } from "@shared/decisionFocus";
import { buildDecisionPath } from "@shared/decisionPath";
import { getEvidenceReviewReadiness } from "@shared/evidenceReview";

type Role = "core" | "complementary" | "remainder" | "alternative_expression";

const ROLE_LABELS: Record<Role, string> = { core: "Direct expression", complementary: "Portfolio complement", remainder: "Reserve-capital idea", alternative_expression: "Alternative expression" };
const ROLE_DESCRIPTIONS: Record<Role, string> = {
  core: "Most directly connected to the thesis; validate its evidence and invalidation first.",
  complementary: "May strengthen, diversify, or balance the thesis exposure.",
  remainder: "A lower-priority research path for capital not committed to the thesis.",
  alternative_expression: "A different instrument for the same underlying thesis exposure.",
};

function evidenceConfidenceLabel(value: number | null | undefined) {
  return value == null ? "Not measured" : `${Math.round(value * 100)}% evidence confidence`;
}

function researchContextLabel(note: string | null | undefined) {
  if (!note) return "";
  if (/ILLUSTRATIVE_UAT_QUALIFIED_PLAY/i.test(note)) return "Illustrative test data · no live market request";
  return note;
}

const RUN_STEPS = [
  { key: "queued", label: "Queued", detail: "Your paper research brief is waiting to start.", pct: 5 },
  { key: "compiling", label: "Framing your thesis", detail: "Preparing the belief and guardrails for evidence research.", pct: 15 },
  { key: "discovering", label: "Mapping the evidence universe", detail: "Finding the thesis paths and securities worth researching.", pct: 30 },
  { key: "researching", label: "Gathering fact-traced evidence", detail: "Collecting company, price, and macro facts. Candidates appear as they clear the evidence threshold.", pct: 58 },
  { key: "scoring", label: "Testing thesis fit", detail: "Scoring evidence against your thesis and portfolio context.", pct: 78 },
  { key: "constructing", label: "Preparing your decision brief", detail: "Building the research queue and paper-research postures.", pct: 92 },
] as const;

const ACTIVE_RUN_STATUSES = new Set(RUN_STEPS.map((step) => step.key));

function RunProgress({ run, candidateCount, stale, retrying, onRefresh, onStartFresh, onRetry }: {
  run: any;
  candidateCount: number;
  stale: boolean;
  retrying: boolean;
  onRefresh: () => void;
  onStartFresh: () => void;
  onRetry: () => void;
}) {
  const stepIndex = RUN_STEPS.findIndex((step) => step.key === run.status);
  const step = stepIndex >= 0 ? RUN_STEPS[stepIndex] : null;
  const active = Boolean(step);
  const failed = run.status === "failed";
  const completedWithoutCandidates = run.status === "completed" && candidateCount === 0;
  const elapsedSeconds = run.startedAt ? Math.max(0, Math.floor((Date.now() - Number(run.startedAt)) / 1000)) : null;

  if (!active && !failed && !completedWithoutCandidates) return null;

  return (
    <section className="overflow-hidden rounded-xl border" style={{ borderColor: failed ? "color-mix(in srgb, var(--sh-red) 38%, var(--sh-border-1))" : "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between" style={{ background: failed ? "color-mix(in srgb, var(--sh-red) 6%, var(--sh-surface))" : "var(--sh-surface-2)" }}>
        <div className="flex min-w-0 items-start gap-3">
          {failed ? <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--sh-red)" }} /> : active ? <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" style={{ color: "var(--sh-signal)" }} /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--sh-signal)" }} />}
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>
              {stale ? "Research needs a restart to continue" : failed ? "Research paused before a decision brief was ready" : completedWithoutCandidates ? "Research finished with no evidence candidates" : `${step?.label} · your brief is updating here`}
            </p>
            <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>
              {stale
                ? "This brief stopped receiving updates after a background interruption. Its inputs are preserved. Restarting resumes the same paper-research question in a traceable new brief; it never creates an order."
                : failed
                ? (run.error || "The research process stopped unexpectedly before it returned enough evidence.")
                : completedWithoutCandidates
                  ? "No securities met the current evidence and guardrail threshold. This is a research result, not a silent failure."
                  : `${step?.detail} ${run.universeCount ? `${run.universeCount} securities are in scope.` : ""}`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {active && elapsedSeconds != null && <span className="text-[11px] tabular-nums" style={{ color: "var(--sh-fg-muted)" }}>{elapsedSeconds}s elapsed</span>}
          <Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Refresh status</Button>
          {stale ? <Button size="sm" disabled={retrying} onClick={onRetry}>{retrying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}Restart this brief</Button> : (failed || completedWithoutCandidates) && <Button size="sm" onClick={onStartFresh}>Start a new brief</Button>}
        </div>
      </div>
      {active && (
        <>
          <div className="h-1" style={{ background: "var(--sh-border-1)" }}><div className="h-full transition-all duration-700" style={{ width: `${step?.pct ?? 5}%`, background: "var(--sh-signal)" }} /></div>
          <div className="grid grid-cols-3 gap-2 px-4 py-3 text-[11px] sm:grid-cols-6">
            {RUN_STEPS.map((item, index) => {
              const past = index < stepIndex;
              const current = index === stepIndex;
              return <div key={item.key} className="flex items-center gap-1.5" style={{ color: current ? "var(--sh-text-primary)" : past ? "var(--sh-signal)" : "var(--sh-fg-muted)" }}>
                {past ? <CheckCircle2 className="h-3.5 w-3.5" /> : current ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-2 w-2 rounded-full" style={{ background: "var(--sh-border-1)" }} />}
                <span>{item.label}</span>
              </div>;
            })}
          </div>
        </>
      )}
    </section>
  );
}

export default function CandidateBoard() {
  const [, params] = useRoute("/aperture/run/:id");
  const [location, navigate] = useLocation();
  const search = useSearch();
  const runId = Number(params?.id);
  const [view, setView] = useState<"play" | "brief" | "evidence" | "ledger">(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    return requested === "brief" || requested === "evidence" || requested === "ledger" ? requested : "play";
  });
  const [activeRole, setActiveRole] = useState<Role | "all">("all");
  const [showSupporting, setShowSupporting] = useState(false);
  const [showInlineRecord, setShowInlineRecord] = useState(false);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [reviewProgressMessage, setReviewProgressMessage] = useState("");
  const [reviewCompletedAt, setReviewCompletedAt] = useState<number | null>(null);
  const nextActionRef = useRef<HTMLDivElement>(null);
  const [generatingMemo, setGeneratingMemo] = useState<number | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const { data, isLoading, refetch } = trpc.aperture.run.get.useQuery(
    { id: runId },
    {
      enabled: !!runId,
      refetchInterval: (query) => ACTIVE_RUN_STATUSES.has((query.state.data as any)?.run?.status) ? 1_500 : false,
      refetchIntervalInBackground: true,
    },
  );
  const requestedCandidateId = Number(new URLSearchParams(search).get("candidate")) || null;
  useEffect(() => {
    if (!requestedCandidateId || !data?.candidates?.some((candidate: any) => candidate.id === requestedCandidateId)) return;
    setSelectedCandidateId(requestedCandidateId);
  }, [data?.candidates, requestedCandidateId]);
  useEffect(() => {
    if (!reviewCompletedAt) return;
    const timer = window.setTimeout(() => {
      nextActionRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [reviewCompletedAt, data?.evidenceReviews?.length]);
  const refreshMacro = trpc.aperture.macro.refresh.useMutation({
    onSuccess: (result) => { toast.success(`Macro ledger refreshed — ${result.factsWritten} FRED observations recorded`); refetch(); },
    onError: (error) => toast.error(`Could not refresh macro evidence: ${error.message}`),
  });
  const retryRun = trpc.aperture.run.retry.useMutation({
    onSuccess: ({ runId: restartedRunId }) => {
      toast.success("Research restarted in a new traceable brief — progress will update here.");
      navigate(`/aperture/run/${restartedRunId}`);
    },
    onError: (error) => toast.error(error.message),
  });
  const followUpRun = trpc.aperture.run.followUp.useMutation({
    onSuccess: ({ runId: followUpRunId }) => {
      toast.success("Starting the next bounded evidence batch — progress will update in its own paper-research brief.");
      navigate(`/aperture/run/${followUpRunId}`);
    },
    onError: (error) => toast.error(error.message),
  });
  const reviewEvidence = trpc.aperture.run.evidence.review.useMutation({
    onSuccess: () => { setReviewProgressMessage("Review recorded. The next guarded action is highlighted below; no paper order was created."); setReviewCompletedAt(Date.now()); toast.success("Human review recorded. This does not create a paper order."); refetch(); },
    onError: (error) => toast.error(error.message),
  });
  const genMemo = trpc.aperture.generateMemo.useMutation({
    onSuccess: (_result, variables) => { toast.success("Memo generated — opening the fact-traced record"); refetch(); setGeneratingMemo(null); navigate(`/aperture/memos/${variables.candidateId}`); },
    onError: (error) => { toast.error(error.message); setGeneratingMemo(null); },
  });

  if (isLoading) return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium" style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", borderColor: "var(--sh-border-1)" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} /> Internal research tool — not investment advice. Paper-only decisions require human approval.
        </div>
        <section className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
          <div className="flex items-start gap-3 px-5 py-5" style={{ background: "var(--sh-surface-2)" }}>
            <Loader2 className="mt-0.5 h-5 w-5 animate-spin" style={{ color: "var(--sh-signal)" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Opening your paper research brief</p>
              <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>This page stays with the brief. You will see its phase, evidence count, and any recovery action here—not in a separate status page.</p>
            </div>
          </div>
          <div className="h-1" style={{ background: "var(--sh-border-1)" }}><div className="h-full w-[12%] animate-pulse" style={{ background: "var(--sh-signal)" }} /></div>
          <div className="grid grid-cols-3 gap-3 p-5 sm:grid-cols-6">
            {RUN_STEPS.map((step, index) => <div key={step.key} className="space-y-2"><div className={`h-2 rounded ${index === 0 ? "animate-pulse" : ""}`} style={{ background: index === 0 ? "var(--sh-signal)" : "var(--sh-surface-2)" }} /><p className="text-[10px]" style={{ color: "var(--sh-fg-muted)" }}>{step.label}</p></div>)}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
  if (!data) return <DashboardLayout><div className="p-8 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Run not found.</div></DashboardLayout>;

  const { run, stale, candidates, macroFacts, brief, thesisContext, setAside, setAsideNote } = data;
  const roles: Array<Role | "all"> = ["all", "core", "complementary", "remainder", "alternative_expression"];
  const filtered = (activeRole === "all" ? candidates : candidates.filter((candidate) => candidate.role === activeRole))
    .slice().sort((a, b) => decisionPriority(b) - decisionPriority(a));
  const researchRankedCandidates = rankResearchCandidates(candidates);
  const leadCandidate = candidates.find((candidate) => candidate.id === brief?.priorityCandidate?.id)
    ?? researchRankedCandidates[0];
  const candidateSequence = leadCandidate
    ? [leadCandidate, ...researchRankedCandidates.filter((candidate) => candidate.id !== leadCandidate.id)]
    : [];
  const focusCandidate = candidateSequence.find((candidate) => candidate.id === selectedCandidateId) ?? leadCandidate;
  const focusIndex = focusCandidate ? candidateSequence.findIndex((candidate) => candidate.id === focusCandidate.id) : -1;
  const selectCandidate = (delta: number) => {
    if (!candidateSequence.length || focusIndex < 0) return;
    const next = (focusIndex + delta + candidateSequence.length) % candidateSequence.length;
    setSelectedCandidateId(candidateSequence[next]!.id);
  };
  const paperPositions = data.paperContext?.positions ?? [];
  const focusChecks = Array.isArray(focusCandidate?.verifyFields) ? focusCandidate.verifyFields as string[] : [];
  const evidenceReadiness = getEvidenceReviewReadiness(focusChecks, (data.evidenceReviews ?? []).filter((review: any) => review.candidateId === focusCandidate?.id));
  const reviewedChecks = new Set(evidenceReadiness.reviewedChecks);
  const unreviewedChecks = evidenceReadiness.unreviewedChecks;
  const paperProposalReady = evidenceReadiness.paperProposalReady;
  const paperStageDeclined = evidenceReadiness.paperStageDeclined;
  const negativeChecks = evidenceReadiness.negativeChecks;
  const currentEvidenceQuestion = unreviewedChecks[0] ?? null;
  const focusMemo = (focusCandidate as any)?.memo;
  const sourceExcerpt = typeof focusMemo === "string"
    ? focusMemo.slice(0, 420)
    : focusMemo && typeof focusMemo === "object"
      ? Object.values(focusMemo as Record<string, unknown>).flatMap((value) => Array.isArray(value) ? value : [value]).filter((value): value is string => typeof value === "string").join(" ").slice(0, 420)
      : null;
  const alreadyHeld = Boolean(focusCandidate && paperPositions.some((position: any) => position.symbol === focusCandidate.symbol));
  const proposalBlockedReason = paperStageDeclined
    ? "A required evidence answer was not confirmed. This revision preserves cash and cannot open a paper ticket."
    : unreviewedChecks.length
      ? `Review the required evidence before opening the paper ticket — ${unreviewedChecks.length} decision-critical check${unreviewedChecks.length === 1 ? " remains" : "s remain"}.`
      : null;

  const openEvidence = () => { setView("evidence"); setActiveRole("all"); };
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium" style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", borderColor: "var(--sh-border-1)" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} /> Internal research tool — not investment advice. Paper-only decisions require human approval.
        </div>

        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between" style={{ borderColor: "var(--sh-border-1)" }}>
          <div className="flex min-w-0 items-start gap-2">
            <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 shrink-0" onClick={() => navigate("/aperture")}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-fg-muted)" }}>Capital Aperture · run #{runId}</p>
              <h1 className="mt-1 font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}>Start with the play. Work backward to the evidence.</h1>
              <p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>{run.candidateCount ?? candidates.length} evidence candidates · {run.status} {run.droppedNote ? `· ${researchContextLabel(run.droppedNote)}` : ""}</p>
            </div>
          </div>
          <div className="flex w-full min-w-0 max-w-full overflow-x-auto rounded-lg border p-1 sm:w-auto" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
            <button onClick={() => setView("play")} className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: view === "play" ? "var(--sh-surface)" : "transparent", color: view === "play" ? "var(--sh-text-primary)" : "var(--sh-fg-muted)" }}>Your play</button>
            <button onClick={() => setView("brief")} className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: view === "brief" ? "var(--sh-surface)" : "transparent", color: view === "brief" ? "var(--sh-text-primary)" : "var(--sh-fg-muted)" }}>Decision detail</button>
            <button onClick={() => setView("evidence")} className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: view === "evidence" ? "var(--sh-surface)" : "transparent", color: view === "evidence" ? "var(--sh-text-primary)" : "var(--sh-fg-muted)" }}>Evidence</button>
            <button onClick={() => setView("ledger")} className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: view === "ledger" ? "var(--sh-surface)" : "transparent", color: view === "ledger" ? "var(--sh-text-primary)" : "var(--sh-fg-muted)" }}>Research</button>
          </div>
        </header>

        <RunProgress
          run={run}
          candidateCount={candidates.length}
          stale={stale}
          retrying={retryRun.isPending}
          onRefresh={() => refetch()}
          onStartFresh={() => navigate("/aperture")}
          onRetry={() => retryRun.mutate({ id: runId })}
        />

        {view === "play" ? (
          <div className="space-y-5">
            {focusCandidate && <section className="rounded-xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Candidate review · {focusIndex + 1} of {candidateSequence.length}</p><p className="mt-1 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{focusCandidate.id === leadCandidate?.id ? <><strong style={{ color: "var(--sh-text-primary)" }}>{focusCandidate.symbol} leads this brief.</strong> {brief?.priorityCandidate?.leadReason ?? "It is the current lead candidate in the brief's deterministic decision order."}</> : <><strong style={{ color: "var(--sh-text-primary)" }}>{focusCandidate.symbol} is candidate {focusIndex + 1}.</strong> {leadCandidate?.symbol} remains the brief lead; this candidate is available for deliberate comparison, not hidden supporting research.</>}</p></div><div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" disabled={candidateSequence.length < 2} onClick={() => selectCandidate(-1)}>Previous</Button><Button size="sm" variant="outline" disabled={candidateSequence.length < 2} onClick={() => selectCandidate(1)}>Next</Button></div></div>
              {candidateSequence.length > 1 && <div className="mt-3 flex flex-wrap gap-1"><span className="mr-1 self-center text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>Lead + alternatives</span>{candidateSequence.slice(0, 3).map((candidate, index) => <button key={candidate.id} onClick={() => setSelectedCandidateId(candidate.id)} className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium" style={{ borderColor: candidate.id === focusCandidate.id ? "var(--sh-signal)" : "var(--sh-border-1)", background: candidate.id === focusCandidate.id ? "color-mix(in srgb, var(--sh-signal) 10%, var(--sh-surface))" : "transparent", color: candidate.id === focusCandidate.id ? "var(--sh-text-primary)" : "var(--sh-fg-muted)" }}>{index + 1}. {candidate.symbol}{candidate.id === leadCandidate?.id ? " · lead" : ""}</button>)}{candidateSequence.length > 3 && <button type="button" className="rounded-full border px-2.5 py-1 text-[11px] font-medium" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }} onClick={() => { setView("evidence"); setShowSupporting(true); }}>View all ({candidateSequence.length})</button>}</div>}
            </section>}
            {focusCandidate ? <PlayRecipeCard
              candidate={focusCandidate}
              run={run}
              reviewedChecks={reviewedChecks}
              alreadyHeld={alreadyHeld}
              thesisContext={thesisContext}
              proposalBlockedReason={proposalBlockedReason}
              onReviewEvidence={openEvidence}
              onPrepareProposal={() => navigate(`/aperture/run/${runId}/execute?candidate=${focusCandidate.id}`)}
              onOpenResearch={() => setView("ledger")}
            /> : <section className="rounded-xl border p-5 text-sm" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>No paper play is available until research returns a candidate.</section>}
            {focusCandidate && <DecisionFocusCard candidate={focusCandidate} positions={paperPositions} reviewedChecks={reviewedChecks} onOpenMemo={focusCandidate.memoStatus === "ok" ? () => navigate(`/aperture/memos/${focusCandidate.id}`) : undefined} onReviewEvidence={openEvidence} onComparePostures={() => navigate(`/aperture/run/${runId}/strategies`)} onViewPaperAccount={() => navigate("/aperture/accounts")} onPrepareProposal={() => navigate(`/aperture/run/${runId}/execute?candidate=${focusCandidate.id}`)} />}
          </div>
        ) : view === "brief" ? (
          <div className="space-y-5">
            {focusCandidate && <section className="rounded-xl border p-4 sm:p-5" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Your current recommendation</p>
                  <h2 className="mt-1 font-serif text-xl" style={{ color: "var(--sh-text-primary)" }}>{paperStageDeclined ? `Preserve cash for ${focusCandidate.symbol} — the current evidence declined the paper stage.` : `Keep ${focusCandidate.symbol} in research — do not change the paper portfolio yet.`}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{describeCandidateRecommendation({ focusSymbol: focusCandidate.symbol, leadSymbol: leadCandidate?.symbol ?? focusCandidate.symbol, alreadyHeld })}</p>
                </div>
                <Badge variant="outline" className="shrink-0" style={{ color: paperStageDeclined ? "var(--sh-red)" : "var(--sh-signal)" }}>{paperStageDeclined ? "Paper stage declined" : paperProposalReady ? "Proposal can be prepared" : `${unreviewedChecks.length} review${unreviewedChecks.length === 1 ? "" : "s"} before proposal`}</Badge>
              </div>
              <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[1.2fr_1fr]" style={{ borderColor: "var(--sh-border-1)" }}>
                <div>
                  <p className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>What you need to verify</p>
                  <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Record your review of the few questions that would change whether a paper proposal is reasonable. Supporting research can continue separately.</p>
                  <div className="mt-3 space-y-2">
                    {focusChecks.map((check) => {
                      const reviewed = reviewedChecks.has(check);
                      return <div key={check} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: "var(--sh-surface)" }}>
                        <span className="text-xs" style={{ color: "var(--sh-text-primary)" }}>{check}</span>
                        {reviewed ? <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium" style={{ color: "oklch(0.55 0.15 145)" }}><CheckCircle2 className="h-3.5 w-3.5" /> answer recorded</span> : <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => { setView("evidence"); setShowInlineRecord(true); }}><ClipboardCheck className="mr-1 h-3.5 w-3.5" />Answer question</Button>}
                      </div>;
                    })}
                  </div>
                </div>
                <div className="rounded-lg p-3" style={{ background: "var(--sh-surface)" }}>
                  <p className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>What happens next</p>
                  {paperStageDeclined ? <div className="mt-2 rounded-lg border px-3 py-2 text-xs leading-5" style={{ borderColor: "color-mix(in srgb, var(--sh-red) 45%, var(--sh-border-1))", color: "var(--sh-fg-muted)" }}><strong style={{ color: "var(--sh-text-primary)" }}>No paper proposal can be prepared from this revision.</strong><br />The recorded not-confirmed answer is durable. Start a new research decision only after the underlying evidence changes.</div> : <ol className="mt-2 space-y-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>
                    <li><strong style={{ color: "var(--sh-text-primary)" }}>1. Review evidence.</strong> Nothing changes in the portfolio.</li>
                    <li><strong style={{ color: "var(--sh-text-primary)" }}>2. Prepare a paper proposal.</strong> You choose the size and rationale; it enters pending approval.</li>
                    <li><strong style={{ color: "var(--sh-text-primary)" }}>3. Approve, submit, and monitor.</strong> Each step stays human-controlled and paper-only.</li>
                  </ol>}
                  {paperStageDeclined ? <Button variant="outline" className="mt-3 w-full" size="sm" onClick={() => navigate("/aperture")}>Return to Today</Button> : paperProposalReady ? <Button className="mt-3 w-full" size="sm" onClick={() => navigate(`/aperture/run/${runId}/execute?candidate=${focusCandidate.id}`)}>Prepare paper proposal</Button> : <Button variant="outline" className="mt-3 w-full" size="sm" onClick={() => { setView("evidence"); setShowInlineRecord(true); }}>Review questions here</Button>}
                </div>
              </div>
            </section>}
            {focusCandidate && <DecisionFocusCard candidate={focusCandidate} positions={paperPositions} reviewedChecks={reviewedChecks} onOpenMemo={focusCandidate.memoStatus === "ok" ? () => navigate(`/aperture/memos/${focusCandidate.id}`) : undefined} onReviewEvidence={openEvidence} onComparePostures={() => navigate(`/aperture/run/${runId}/strategies`)} onViewPaperAccount={() => navigate("/aperture/accounts")} onPrepareProposal={() => navigate(`/aperture/run/${runId}/execute?candidate=${focusCandidate.id}`)} />}
            {run.status === "completed" && /deferred/i.test(run.droppedNote ?? "") && <section className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><div><p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>More thesis evidence is available</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{run.droppedNote} You may continue research now; decisive checks only control whether a human can begin paper-order review. This starts research, never an order.</p></div><Button size="sm" disabled={followUpRun.isPending} onClick={() => followUpRun.mutate({ id: runId })}>{followUpRun.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <SearchCheck className="mr-1.5 h-3.5 w-3.5" />}Research next batch</Button></section>}
            <CapitalBrief
              brief={brief}
              onReviewEvidence={openEvidence}
              onComparePostures={() => navigate(`/aperture/run/${runId}/strategies`)}
              onReviewGaps={() => navigate(`/aperture/run/${runId}/exposure`)}
              onSetHorizon={() => navigate("/thesis?scope=capital")}
            />
            <SetAsideHistory records={setAside ?? []} note={setAsideNote ?? null} />
          </div>
        ) : view === "ledger" ? (
          <ResearchLedger macroFacts={macroFacts} onRefresh={() => refreshMacro.mutate()} refreshing={refreshMacro.isPending} />
        ) : (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
              <div><p className="text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>Review the few questions that could change this decision</p><p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>{brief?.evidence.decisionCriticalCheckCount ?? 0} question{brief?.evidence.decisionCriticalCheckCount === 1 ? "" : "s"} must be reviewed before a paper proposal can be prepared. {brief?.evidence.researchFollowUpCheckCount ?? 0} supporting research items can continue without blocking that step.</p></div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate(`/aperture/run/${runId}/strategies`)}>Compare postures</Button>
                <Button variant="ghost" size="sm" onClick={() => setView("brief")}>Recommendation</Button>
              </div>
            </div>
            {focusCandidate && currentEvidenceQuestion && <Card className="border" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}><CardContent className="space-y-4 pt-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Current decision-critical question</p><h2 className="mt-1 text-lg font-semibold" style={{ color: "var(--sh-text-primary)" }}>{currentEvidenceQuestion}</h2><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Why this matters: a confirmed answer can clear this gate; a not-confirmed answer declines the current paper stage rather than quietly passing it.</p></div><Badge variant="outline" style={{ color: "var(--sh-signal)" }}>{unreviewedChecks.length} open</Badge></div>
              <div className="rounded-lg border p-3 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>Source record · provenance</p><p className="mt-1" style={{ color: "var(--sh-fg-muted)" }}>{sourceExcerpt ? `${sourceExcerpt}${sourceExcerpt.length >= 420 ? "…" : ""}` : "No fact-traced source record is available yet. Build it inline before resolving this question; no paper order is created."}</p><div className="mt-2 flex gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => setShowInlineRecord(true)}><FileText className="mr-1.5 h-3.5 w-3.5" />View source record</Button>{focusCandidate.memoStatus !== "ok" && <Button type="button" variant="outline" size="sm" disabled={generatingMemo === focusCandidate.id} onClick={() => { setGeneratingMemo(focusCandidate.id); genMemo.mutate({ runId, candidateId: focusCandidate.id }); }}>{generatingMemo === focusCandidate.id ? "Building source…" : "Build source record"}</Button>}</div></div>
              <div><label htmlFor="current-evidence-note" className="text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Optional review note</label><Textarea id="current-evidence-note" value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} placeholder="Record the observable fact, uncertainty, or reason for this answer…" className="mt-1 min-h-20 text-xs" /></div>
              <div className="flex flex-wrap gap-2"><Button type="button" size="sm" className="min-h-11" disabled={reviewEvidence.isPending} onClick={() => reviewEvidence.mutate({ runId, candidateId: focusCandidate.id, checkLabel: currentEvidenceQuestion, status: "confirmed", note: evidenceNote || undefined })}>Confirmed · clear this gate</Button><Button type="button" variant="outline" size="sm" className="min-h-11" disabled={reviewEvidence.isPending} onClick={() => reviewEvidence.mutate({ runId, candidateId: focusCandidate.id, checkLabel: currentEvidenceQuestion, status: "not_confirmed", note: evidenceNote || undefined })}>Not confirmed · decline paper stage</Button><Button type="button" variant="outline" size="sm" className="min-h-11" disabled={reviewEvidence.isPending} onClick={() => reviewEvidence.mutate({ runId, candidateId: focusCandidate.id, checkLabel: currentEvidenceQuestion, status: "not_applicable", note: evidenceNote || undefined })}>Not applicable</Button><Button type="button" variant="ghost" size="sm" className="min-h-11" disabled={reviewEvidence.isPending} onClick={() => reviewEvidence.mutate({ runId, candidateId: focusCandidate.id, checkLabel: currentEvidenceQuestion, status: "needs_follow_up", note: evidenceNote || undefined })}>Need more evidence</Button></div>
            </CardContent></Card>}
            {focusCandidate && (() => {
              const checks = Array.isArray(focusCandidate.verifyFields) ? focusCandidate.verifyFields as string[] : [];
              const path = buildDecisionPath({ symbol: focusCandidate.symbol, memoStatus: focusCandidate.memoStatus, decisionCriticalChecks: checks.length });
              const memoValue = (focusCandidate as any).memo;
              const memoSections = memoValue && typeof memoValue === "object"
                ? Object.entries(memoValue as Record<string, unknown>)
                  .map(([key, value]) => ({
                    label: key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()),
                    text: Array.isArray(value) ? value.filter(Boolean).join(" ") : typeof value === "string" ? value.trim() : "",
                  }))
                  .filter((section) => section.text)
                : typeof memoValue === "string" && memoValue.trim() ? [{ label: "Fact record", text: memoValue.trim() }] : [];
              return <Card className="border" style={{ borderColor: paperStageDeclined ? "var(--sh-red)" : "var(--sh-signal)", background: "var(--sh-surface-2)" }}><CardContent className="space-y-3 pt-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em]" style={{ color: paperStageDeclined ? "var(--sh-red)" : "var(--sh-signal)" }}>{paperStageDeclined ? "Paper stage declined" : "Answer the questions here"}</p><h2 className="mt-1 text-lg font-semibold" style={{ color: "var(--sh-text-primary)" }}>{focusCandidate.symbol} · resolve this decision</h2><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{paperStageDeclined ? "A required evidence answer was recorded as not confirmed. This revision cannot prepare a proposal or create an order." : "Open the source record, then answer the current question as Confirmed, Not confirmed, Not applicable, or Need more evidence. A generic acknowledgement never clears a gate."}</p></div><Badge variant="outline" style={{ color: paperStageDeclined ? "var(--sh-red)" : "var(--sh-signal)" }}>{paperStageDeclined ? "Declined" : `${unreviewedChecks.length} left`}</Badge></div>{checks.length ? <ol className="space-y-2">{checks.map((check, index) => { const reviewed = reviewedChecks.has(check); const declined = negativeChecks.includes(check); return <li key={check} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: declined ? "color-mix(in srgb, var(--sh-red) 45%, var(--sh-border-1))" : "var(--sh-border-1)", background: "var(--sh-surface)" }}><div className="flex min-w-0 gap-2 text-sm" style={{ color: "var(--sh-text-primary)" }}><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]" style={{ background: "color-mix(in oklab, var(--sh-signal) 14%, transparent)", color: "var(--sh-signal)" }}>{index + 1}</span><span>{check}</span></div>{declined ? <span className="flex shrink-0 items-center gap-1 text-xs font-medium" style={{ color: "var(--sh-red)" }}><XCircle className="h-3.5 w-3.5" /> not confirmed</span> : reviewed ? <span className="flex shrink-0 items-center gap-1 text-xs font-medium" style={{ color: "oklch(0.55 0.15 145)" }}><CheckCircle2 className="h-3.5 w-3.5" /> answer recorded</span> : <Button variant="outline" size="sm" className="shrink-0" onClick={() => { setView("evidence"); setShowInlineRecord(true); }}><ClipboardCheck className="mr-1 h-3.5 w-3.5" />Answer above</Button>}</li>; })}</ol> : <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>No required reviews remain in this research record.</p>}{reviewProgressMessage && <p role="status" className="rounded-lg border px-3 py-2 text-xs leading-5" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 38%, var(--sh-border-1))", background: "var(--sh-surface)", color: "var(--sh-text-primary)" }}>{reviewProgressMessage}</p>}{paperStageDeclined ? <div ref={nextActionRef} tabIndex={-1} className="flex scroll-mt-5 flex-col gap-2 rounded-lg border p-3 outline-none sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "color-mix(in srgb, var(--sh-red) 45%, var(--sh-border-1))", background: "var(--sh-surface)" }}><div><p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Preserve cash for this candidate.</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>The not-confirmed evidence answer is recorded on this revision. No proposal or order was created.</p></div><Button variant="outline" className="shrink-0" size="sm" onClick={() => navigate("/aperture")}>Return to Today</Button></div> : unreviewedChecks.length === 0 && <div ref={nextActionRef} tabIndex={-1} className="flex scroll-mt-5 flex-col gap-2 rounded-lg border p-3 outline-none motion-safe:animate-pulse sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 38%, var(--sh-border-1))", background: "var(--sh-surface)" }}><div><p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Reviews complete. Next: inspect the modeled paper plan.</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>The plan page will either show source-backed entry, stop, and portfolio impact, or tell you exactly what tape is still missing. Nothing is sent automatically.</p></div><Button className="shrink-0" size="sm" onClick={() => navigate(`/aperture/run/${runId}/execute?candidate=${focusCandidate.id}`)}>Inspect paper plan</Button></div>}<div className="border-t pt-3" style={{ borderColor: "var(--sh-border-1)" }}><Button variant="ghost" size="sm" onClick={() => setShowInlineRecord((value) => !value)}><FileText className="mr-1.5 h-3.5 w-3.5" />{showInlineRecord ? "Hide source record" : "Open source record"}</Button>{showInlineRecord && <div className="mt-3 max-h-[32rem] space-y-3 overflow-y-auto rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>{memoSections.length ? memoSections.map((section) => <section key={section.label}><h3 className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>{section.label}</h3><p className="mt-1 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{section.text}</p></section>) : <p className="text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>No source record is ready yet. Build it here before reviewing the question; it never creates an order.</p>}</div>}</div><div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--sh-border-1)" }}>{focusCandidate.memoStatus !== "ok" && <Button size="sm" disabled={generatingMemo === focusCandidate.id} onClick={() => { setGeneratingMemo(focusCandidate.id); genMemo.mutate({ runId, candidateId: focusCandidate.id }); }}>{generatingMemo === focusCandidate.id ? "Building source record…" : "Build source record"}</Button>}<Button variant="ghost" size="sm" onClick={() => setShowSupporting((value) => !value)}>{showSupporting ? "Hide other candidates" : `Compare ${Math.max(0, candidates.length - 1)} other candidates`}</Button></div></CardContent></Card>;
            })()}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {roles.map((role) => {
                const count = role === "all" ? candidates.length : candidates.filter((candidate) => candidate.role === role).length;
                return <button key={role} onClick={() => setActiveRole(role)} className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: activeRole === role ? "var(--sh-signal)" : "var(--sh-surface-2)", color: activeRole === role ? "var(--sh-primary-fg)" : "var(--sh-fg-muted)" }}>{role === "all" ? "All research" : ROLE_LABELS[role]} ({count})</button>;
              })}
            </div>
            {showSupporting && <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filtered.filter((candidate) => candidate.id !== focusCandidate?.id).map((candidate) => {
                const verifyFields = Array.isArray(candidate.verifyFields) ? candidate.verifyFields as string[] : [];
                const role = candidate.role as Role;
                return (
                  <Card key={candidate.id} className="border transition-shadow hover:shadow-md" style={{ borderColor: "var(--sh-border-1)" }}>
                    <CardContent className="space-y-4 pt-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>{ROLE_LABELS[role]}</p>
                          <h2 className="mt-1 text-base font-semibold" style={{ color: "var(--sh-text-primary)" }}>{candidate.symbol} · {candidate.id === brief?.priorityCandidate?.id && verifyFields.length ? `${verifyFields.length} decision-critical check${verifyFields.length === 1 ? "" : "s"}` : verifyFields.length ? `${verifyFields.length} supporting check${verifyFields.length === 1 ? "" : "s"}` : "evidence review ready"}</h2>
                          <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{ROLE_DESCRIPTIONS[role]}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-xs">{evidenceConfidenceLabel(candidate.confidenceScore)}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 rounded-lg p-3" style={{ background: "var(--sh-surface-2)" }}>
                        <div><p className="text-[0.64rem] uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Research fit</p><p className="mt-1 text-lg font-semibold" style={{ color: "var(--sh-text-primary)" }}>{candidate.compositeScore ?? "—"}<span className="ml-1 text-xs font-normal" style={{ color: "var(--sh-fg-muted)" }}>/100</span></p></div>
                        <div><p className="text-[0.64rem] uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Open checks</p><p className="mt-1 text-lg font-semibold" style={{ color: verifyFields.length ? "var(--sh-signal)" : "var(--sh-text-primary)" }}>{verifyFields.length}</p></div>
                      </div>
                      {verifyFields.length > 0 ? <div className="flex flex-wrap gap-1">{verifyFields.slice(0, 4).map((field) => <Badge key={field} variant="outline" className="text-[0.65rem]" style={{ color: "var(--sh-signal)" }}>verify: {field}</Badge>)}</div> : <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--sh-fg-muted)" }}><SearchCheck className="h-3.5 w-3.5" /> No open evidence checks recorded for this candidate.</p>}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "var(--sh-border-1)" }}>
                        <span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>{candidate.memoStatus === "ok" ? "Fact-traced memo ready" : "Decision memo not generated"}</span>
                        <div className="flex gap-1.5"><Button variant="ghost" size="sm" onClick={() => { setSelectedCandidateId(candidate.id); setView("play"); }}>Review candidate</Button>{candidate.memoStatus === "ok" ? <Button variant="ghost" size="sm" onClick={() => navigate(`/aperture/memos/${candidate.id}`)}><FileText className="mr-1.5 h-3.5 w-3.5" /> Read decision memo</Button> : <Button variant="outline" size="sm" disabled={generatingMemo === candidate.id} onClick={() => { setGeneratingMemo(candidate.id); genMemo.mutate({ runId, candidateId: candidate.id }); }}>{generatingMemo === candidate.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="mr-1.5 h-3.5 w-3.5" />} Generate evidence memo</Button>}</div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>}
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
