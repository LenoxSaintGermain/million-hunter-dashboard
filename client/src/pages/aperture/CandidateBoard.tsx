/** Capital Aperture — decision-first evidence queue. Paper-only internal research. */
import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleAlert, FileText, Loader2, RefreshCw, SearchCheck, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { CapitalBrief } from "@/components/aperture/CapitalBrief";
import { ResearchLedger } from "@/components/aperture/ResearchLedger";
import { DecisionFocusCard } from "@/components/aperture/DecisionFocusCard";
import { decisionPriority } from "@shared/decisionFocus";
import { buildDecisionPath } from "@shared/decisionPath";

type Role = "core" | "complementary" | "remainder" | "alternative_expression";

const ROLE_LABELS: Record<Role, string> = { core: "Direct expression", complementary: "Portfolio complement", remainder: "Reserve-capital idea", alternative_expression: "Alternative expression" };
const ROLE_DESCRIPTIONS: Record<Role, string> = {
  core: "Most directly connected to the thesis; validate its evidence and invalidation first.",
  complementary: "May strengthen, diversify, or balance the thesis exposure.",
  remainder: "A lower-priority research path for capital not committed to the thesis.",
  alternative_expression: "A different instrument for the same underlying thesis exposure.",
};

function percent(value: number | null | undefined) { return `${Math.round((value ?? 0) * 100)}%`; }

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
  const [, navigate] = useLocation();
  const runId = Number(params?.id);
  const [view, setView] = useState<"brief" | "evidence" | "ledger">(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    return requested === "evidence" || requested === "ledger" ? requested : "brief";
  });
  const [activeRole, setActiveRole] = useState<Role | "all">("all");
  const [showSupporting, setShowSupporting] = useState(false);
  const [generatingMemo, setGeneratingMemo] = useState<number | null>(null);
  const { data, isLoading, refetch } = trpc.aperture.run.get.useQuery(
    { id: runId },
    {
      enabled: !!runId,
      refetchInterval: (query) => ACTIVE_RUN_STATUSES.has((query.state.data as any)?.run?.status) ? 1_500 : false,
      refetchIntervalInBackground: true,
    },
  );
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

  const { run, stale, candidates, macroFacts, brief } = data;
  const roles: Array<Role | "all"> = ["all", "core", "complementary", "remainder", "alternative_expression"];
  const filtered = (activeRole === "all" ? candidates : candidates.filter((candidate) => candidate.role === activeRole))
    .slice().sort((a, b) => decisionPriority(b) - decisionPriority(a));
  const focusCandidate = candidates.find((candidate) => candidate.symbol === brief?.priorityCandidate?.symbol)
    ?? candidates.slice().sort((a, b) => decisionPriority(b) - decisionPriority(a))[0];
  const paperPositions = data.paperContext?.positions ?? [];

  const openEvidence = () => { setView("evidence"); setActiveRole("all"); };
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium" style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", borderColor: "var(--sh-border-1)" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} /> Internal research tool — not investment advice. Paper-only decisions require human approval.
        </div>

        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between" style={{ borderColor: "var(--sh-border-1)" }}>
          <div className="flex items-start gap-2">
            <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 shrink-0" onClick={() => navigate("/aperture")}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-fg-muted)" }}>Capital Aperture · run #{runId}</p>
              <h1 className="mt-1 font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}>From research signals to a deliberate portfolio decision</h1>
              <p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>{run.candidateCount ?? candidates.length} evidence candidates · {run.status} {run.droppedNote ? `· ${run.droppedNote}` : ""}</p>
            </div>
          </div>
          <div className="flex rounded-lg border p-1" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
            <button onClick={() => setView("brief")} className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: view === "brief" ? "var(--sh-surface)" : "transparent", color: view === "brief" ? "var(--sh-text-primary)" : "var(--sh-fg-muted)" }}>Decision brief</button>
            <button onClick={() => setView("evidence")} className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: view === "evidence" ? "var(--sh-surface)" : "transparent", color: view === "evidence" ? "var(--sh-text-primary)" : "var(--sh-fg-muted)" }}>Evidence queue</button>
            <button onClick={() => setView("ledger")} className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: view === "ledger" ? "var(--sh-surface)" : "transparent", color: view === "ledger" ? "var(--sh-text-primary)" : "var(--sh-fg-muted)" }}>Research ledger</button>
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

        {view === "brief" ? (
          <div className="space-y-5">
            {focusCandidate && <DecisionFocusCard candidate={focusCandidate} positions={paperPositions} onOpenMemo={focusCandidate.memoStatus === "ok" ? () => navigate(`/aperture/memos/${focusCandidate.id}`) : undefined} onReviewEvidence={openEvidence} onComparePostures={() => navigate(`/aperture/run/${runId}/strategies`)} onViewPaperAccount={() => navigate("/aperture/accounts")} />}
            {run.status === "completed" && /deferred/i.test(run.droppedNote ?? "") && <section className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><div><p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>More thesis evidence is available</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{run.droppedNote} You may continue research now; decisive checks only control whether a human can begin paper-order review. This starts research, never an order.</p></div><Button size="sm" disabled={followUpRun.isPending} onClick={() => followUpRun.mutate({ id: runId })}>{followUpRun.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <SearchCheck className="mr-1.5 h-3.5 w-3.5" />}Research next batch</Button></section>}
            <CapitalBrief
              brief={brief}
              onReviewEvidence={openEvidence}
              onComparePostures={() => navigate(`/aperture/run/${runId}/strategies`)}
              onReviewGaps={() => navigate(`/aperture/run/${runId}/exposure`)}
              onSetHorizon={() => navigate("/thesis?scope=capital")}
            />
          </div>
        ) : view === "ledger" ? (
          <ResearchLedger macroFacts={macroFacts} onRefresh={() => refreshMacro.mutate()} refreshing={refreshMacro.isPending} />
        ) : (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
              <div><p className="text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>Only the decisive evidence first</p><p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>{brief?.evidence.decisionCriticalCheckCount ?? 0} decision-critical check{brief?.evidence.decisionCriticalCheckCount === 1 ? "" : "s"} determine whether paper-order review is even available. {brief?.evidence.researchFollowUpCheckCount ?? 0} supporting checks are optional for this moment.</p></div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate(`/aperture/run/${runId}/strategies`)}>Compare postures</Button>
                <Button variant="ghost" size="sm" onClick={() => setView("brief")}>Back to brief</Button>
              </div>
            </div>
            {focusCandidate && (() => {
              const checks = Array.isArray(focusCandidate.verifyFields) ? focusCandidate.verifyFields as string[] : [];
              const path = buildDecisionPath({ symbol: focusCandidate.symbol, memoStatus: focusCandidate.memoStatus, decisionCriticalChecks: checks.length });
              return <Card className="border" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}><CardContent className="space-y-3 pt-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Your decision checklist</p><h2 className="mt-1 text-lg font-semibold" style={{ color: "var(--sh-text-primary)" }}>{focusCandidate.symbol} · {path.label}</h2></div><Badge variant="outline" style={{ color: "var(--sh-signal)" }}>{checks.length} decisive</Badge></div>{checks.length ? <ol className="space-y-2">{checks.map((check, index) => <li key={check} className="flex gap-2 text-sm" style={{ color: "var(--sh-text-primary)" }}><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]" style={{ background: "color-mix(in oklab, var(--sh-signal) 14%, transparent)", color: "var(--sh-signal)" }}>{index + 1}</span>{check}</li>)}</ol> : <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>No decision-critical checks remain in this research record.</p>}<div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--sh-border-1)" }}>{focusCandidate.memoStatus === "ok" ? <Button size="sm" onClick={() => navigate(`/aperture/memos/${focusCandidate.id}`)}>Read decision record</Button> : <Button size="sm" disabled={generatingMemo === focusCandidate.id} onClick={() => { setGeneratingMemo(focusCandidate.id); genMemo.mutate({ runId, candidateId: focusCandidate.id }); }}>Create decision record</Button>}<Button variant="ghost" size="sm" onClick={() => setShowSupporting((value) => !value)}>{showSupporting ? "Hide supporting research" : `See ${Math.max(0, candidates.length - 1)} supporting candidates`}</Button></div></CardContent></Card>;
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
                        <Badge variant="outline" className="shrink-0 text-xs">{percent(candidate.confidenceScore)} evidence confidence</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 rounded-lg p-3" style={{ background: "var(--sh-surface-2)" }}>
                        <div><p className="text-[0.64rem] uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Research fit</p><p className="mt-1 text-lg font-semibold" style={{ color: "var(--sh-text-primary)" }}>{candidate.compositeScore ?? "—"}<span className="ml-1 text-xs font-normal" style={{ color: "var(--sh-fg-muted)" }}>/100</span></p></div>
                        <div><p className="text-[0.64rem] uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Open checks</p><p className="mt-1 text-lg font-semibold" style={{ color: verifyFields.length ? "var(--sh-signal)" : "var(--sh-text-primary)" }}>{verifyFields.length}</p></div>
                      </div>
                      {verifyFields.length > 0 ? <div className="flex flex-wrap gap-1">{verifyFields.slice(0, 4).map((field) => <Badge key={field} variant="outline" className="text-[0.65rem]" style={{ color: "var(--sh-signal)" }}>verify: {field}</Badge>)}</div> : <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--sh-fg-muted)" }}><SearchCheck className="h-3.5 w-3.5" /> No open evidence checks recorded for this candidate.</p>}
                      <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--sh-border-1)" }}>
                        <span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>{candidate.memoStatus === "ok" ? "Fact-traced memo ready" : "Decision memo not generated"}</span>
                        {candidate.memoStatus === "ok" ? <Button variant="ghost" size="sm" onClick={() => navigate(`/aperture/memos/${candidate.id}`)}><FileText className="mr-1.5 h-3.5 w-3.5" /> Read decision memo</Button> : <Button variant="outline" size="sm" disabled={generatingMemo === candidate.id} onClick={() => { setGeneratingMemo(candidate.id); genMemo.mutate({ runId, candidateId: candidate.id }); }}>{generatingMemo === candidate.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="mr-1.5 h-3.5 w-3.5" />} Generate evidence memo</Button>}
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
