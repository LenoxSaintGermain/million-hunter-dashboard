import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { PlayUnderwritingBrief } from "@/components/aperture/PlayUnderwritingBrief";
import { trpc } from "@/lib/trpc";
import type { CapitalObjective, UnderwritingHoldingPeriod } from "@shared/playUnderwriting";
import { readIsolatedUatCase } from "@shared/isolatedUatIdentity";

const moneyInput = (cents: number | null | undefined) => cents == null ? "" : String(Math.round(cents / 100));
const parseMoney = (value: string) => Math.max(0, Math.round(Number(value.replace(/[^0-9.]/g, "")) * 100) || 0);

export default function ApertureUnderwriting() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/aperture/decision/:decisionRunId/revision/:revisionId/underwrite");
  const decisionRunId = Number(params?.decisionRunId);
  const decisionRevisionId = Number(params?.revisionId);
  const valid = Number.isInteger(decisionRunId) && decisionRunId > 0 && Number.isInteger(decisionRevisionId) && decisionRevisionId > 0;
  const utils = trpc.useUtils();
  const current = trpc.aperture.underwriter.get.useQuery({ decisionRunId }, { enabled: valid, retry: false });
  const job = trpc.aperture.underwriter.status.useQuery({ decisionRunId, decisionRevisionId }, { enabled: valid, retry: false, refetchInterval: (query) => query.state.data?.state === "running" ? 3000 : false });
  const retry = trpc.aperture.underwriter.retry.useMutation();
  const revise = trpc.aperture.underwriter.revise.useMutation();
  const validatePlay = trpc.aperture.underwriter.validatePlay.useMutation();
  const startResearch = trpc.aperture.runway.startResearch.useMutation();
  const result = revise.data ?? retry.data ?? current.data ?? null;
  const revisionRequest = useRef<{ assumptions: string; id: string } | null>(null);
  const [capital, setCapital] = useState("");
  const [target, setTarget] = useState("");
  const [maxLoss, setMaxLoss] = useState("");
  const [maxOpenRisk, setMaxOpenRisk] = useState("");
  const [weeklyLossLimit, setWeeklyLossLimit] = useState("");
  const [eventRiskLimit, setEventRiskLimit] = useState("");
  const [targetPeriod, setTargetPeriod] = useState<"session" | "week" | "month">("week");
  const [instrument, setInstrument] = useState<"shares" | "options" | "either">("either");
  const [horizons, setHorizons] = useState<UnderwritingHoldingPeriod[]>(["swing"]);
  const [reviewChanges, setReviewChanges] = useState(false);
  const uatCase = readIsolatedUatCase();

  useEffect(() => {
    // A status read may reconcile a completed result, never authorize more work.
    if (job.data?.state === "complete") void utils.aperture.underwriter.get.invalidate({ decisionRunId });
  }, [job.data?.state, job.data?.updatedAt, decisionRunId, utils]);

  useEffect(() => {
    if (!result) return;
    setCapital(moneyInput(result.objective.deployableCapitalCents));
    setTarget(moneyInput(result.objective.targetProfitCents));
    setMaxLoss(moneyInput(result.objective.maxPlannedLossCents));
    setMaxOpenRisk(moneyInput(result.objective.maxPortfolioOpenRiskCents));
    setWeeklyLossLimit(moneyInput(result.objective.weeklyLossLimitCents));
    setEventRiskLimit(moneyInput(result.objective.eventRiskLimitCents));
    setTargetPeriod(result.objective.targetPeriod ?? "week");
    setInstrument(result.objective.instrumentPreference);
    setHorizons(result.objective.holdingPeriods);
    setReviewChanges(false);
  }, [result?.underwritingRevisionId]);

  const revisedObjective = useMemo<CapitalObjective | null>(() => result ? ({
      ...result.objective,
      deployableCapitalCents: parseMoney(capital),
      targetProfitCents: parseMoney(target) || null,
      targetPeriod: parseMoney(target) ? targetPeriod : null,
      maxPlannedLossCents: parseMoney(maxLoss),
      maxPortfolioOpenRiskCents: parseMoney(maxOpenRisk) || null,
      weeklyLossLimitCents: parseMoney(weeklyLossLimit) || null,
      eventRiskLimitCents: parseMoney(eventRiskLimit) || null,
      holdingPeriods: horizons,
      instrumentPreference: instrument,
    }) : null, [result, capital, target, maxLoss, maxOpenRisk, weeklyLossLimit, eventRiskLimit, targetPeriod, horizons, instrument]);
  const revisionChanges = useMemo(() => !result || !revisedObjective ? [] : [
    ["Deployable capital", result.objective.deployableCapitalCents, revisedObjective.deployableCapitalCents],
    ["Target profit", result.objective.targetProfitCents, revisedObjective.targetProfitCents],
    ["Target period", result.objective.targetPeriod, revisedObjective.targetPeriod],
    ["Maximum planned loss", result.objective.maxPlannedLossCents, revisedObjective.maxPlannedLossCents],
    ["Maximum portfolio open risk", result.objective.maxPortfolioOpenRiskCents, revisedObjective.maxPortfolioOpenRiskCents],
    ["Weekly loss limit", result.objective.weeklyLossLimitCents, revisedObjective.weeklyLossLimitCents],
    ["Event-risk limit", result.objective.eventRiskLimitCents, revisedObjective.eventRiskLimitCents],
    ["Instruments", result.objective.instrumentPreference, revisedObjective.instrumentPreference],
    ["Horizons", result.objective.holdingPeriods.join(", "), revisedObjective.holdingPeriods.join(", ")],
  ].filter(([, before, after]) => String(before ?? "") !== String(after ?? "")), [result, revisedObjective]);

  const reunderwrite = async () => {
    if (!result || !revisedObjective) return;
    const objective = revisedObjective;
    if (!objective.deployableCapitalCents || !objective.maxPlannedLossCents || !objective.holdingPeriods.length) return toast.error("Enter capital, maximum planned loss, and at least one horizon.");
    try {
      const assumptions = JSON.stringify(objective);
      if (revisionRequest.current?.assumptions !== assumptions) revisionRequest.current = { assumptions, id: crypto.randomUUID() };
      await revise.mutateAsync({ decisionRunId, decisionRevisionId, requestedPlayCount: 3, objective, revisionRequestId: revisionRequest.current.id });
      await utils.aperture.underwriter.get.invalidate({ decisionRunId });
      setReviewChanges(false);
      toast.success("Underwriting revision recorded. Previous assumptions remain in history.");
    } catch (error: any) {
      toast.error(error?.message ?? "The mission could not be re-underwritten.");
    } finally {
      void job.refetch();
    }
  };

  const validate = async (playId: string) => {
    if (!result) return;
    try {
      const selection = await validatePlay.mutateAsync({ underwritingRunId: result.underwritingRunId, underwritingRevisionId: result.underwritingRevisionId, playId });
      const started = await startResearch.mutateAsync({ decisionRunId: selection.decisionRunId, revisionId: selection.decisionRevisionId, uatCase: uatCase ?? undefined });
      if (started.status === "blocked") {
        toast.error(started.message, { description: "No proposal or broker order was created." });
        return;
      }
      toast.success("Play selected. Research opened; no ticket or order exists yet.");
      navigate(`/aperture/run/${started.runId}`);
    } catch (error: any) {
      toast.error(error?.message ?? "The play could not enter research.");
    }
  };

  useEffect(() => {
    if (!retry.isPending && !revise.isPending) return;
    const timer = window.setInterval(() => { void job.refetch(); }, 2_000);
    return () => window.clearInterval(timer);
  }, [retry.isPending, revise.isPending]);
  const busy = retry.isPending || revise.isPending || validatePlay.isPending || startResearch.isPending || job.isLoading || job.data?.state === "running";
  const priorResultOnly = job.data?.canRetry || job.data?.state === "running" || !!current.error || !!job.error || result?.decisionRevisionId !== decisionRevisionId;
  const failure = current.error ?? job.error ?? retry.error ?? revise.error;
  const resumeAnalysis = async () => {
    if (!job.data?.canRetry || job.data.jobId == null) return;
    try { await retry.mutateAsync({ jobId: job.data.jobId }); await current.refetch(); }
    catch (error: any) { toast.error(error?.message ?? "Analysis could not be resumed."); }
    finally { void job.refetch(); }
  };

  return <DashboardLayout><main className="mx-auto max-w-6xl space-y-5 pb-24">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><Button variant="ghost" className="min-h-11 px-0" onClick={() => navigate(`/aperture/decision/${decisionRunId}/revision/${decisionRevisionId}`)}><ArrowLeft className="mr-2 h-4 w-4" />Capital Mission</Button><p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>Play Underwriter · strategy generation</p><h1 className="mt-1 font-serif text-3xl">Underwriting brief.</h1><p className="mt-2 text-sm" style={{ color: "var(--sh-fg-muted)" }}>Target feasibility, sourced market context, and at most three conditional plays. No order is created here.</p></div>{result && <span className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Revision {result.version} · {new Date(result.asOf).toLocaleString()}</span>}</header>
    {failure && <section role="alert" className="rounded-xl border p-5" style={{ borderColor: "var(--sh-red)", background: "var(--sh-surface)" }}><p className="font-semibold">Current analysis status could not be confirmed.</p><p className="mt-2 text-sm" style={{ color: "var(--sh-fg-muted)" }}>Saved analysis or progress is temporarily unavailable. Your previous result has not been replaced.</p><p className="mt-2 text-sm">The request may still be running. Refresh its status before retrying. The last recorded result, if any, remains below; it is not a new result.</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => { void job.refetch(); void current.refetch(); }}>Reconcile analysis status</Button></section>}
    {(job.isLoading || current.isLoading) && !result && <p role="status" className="p-5">Loading saved analysis status…</p>}
    {job.data && job.data.state !== "complete" && <section role="status" aria-live="polite" className="rounded-xl border p-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><p className="font-semibold">{job.data.state === "running" ? "Analysis in progress" : job.data.state === "not_started" ? "Ready for your mission review" : "Analysis needs recovery"}</p><p className="mt-2 text-sm">{job.data.message}</p>{job.data.state === "running" && <p className="mt-2 text-sm">You can leave this view. Returning reads the same job; closing the view does not cancel it.</p>}{job.data.canRetry && <Button className="mt-3 min-h-11" disabled={busy} onClick={resumeAnalysis}>Resume this analysis</Button>}{job.data.state === "not_started" && !result && <Button variant="outline" className="mt-3 min-h-11" onClick={() => navigate(`/aperture/decision/${decisionRunId}/revision/${decisionRevisionId}`)}>Review mission assumptions</Button>}</section>}
    {result && <><details className="rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">Change an assumption</summary><div className="grid gap-3 border-t p-4 sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "var(--sh-border-1)" }}><MoneyControl label="Deployable capital" value={capital} onChange={setCapital} /><MoneyControl label="Target profit" value={target} onChange={setTarget} /><label className="text-xs font-semibold">Target period<select className="mt-1 min-h-11 w-full rounded border bg-transparent px-2" style={{ borderColor: "var(--sh-border-1)" }} value={targetPeriod} onChange={(event) => setTargetPeriod(event.target.value as typeof targetPeriod)}><option value="session">Session</option><option value="week">Week</option><option value="month">Month</option></select></label><MoneyControl label="Maximum planned loss" value={maxLoss} onChange={setMaxLoss} /><MoneyControl label="Maximum portfolio open risk" value={maxOpenRisk} onChange={setMaxOpenRisk} optional /><MoneyControl label="Weekly loss limit" value={weeklyLossLimit} onChange={setWeeklyLossLimit} optional /><MoneyControl label="Event-risk limit" value={eventRiskLimit} onChange={setEventRiskLimit} optional /><label className="text-xs font-semibold">Instrument<select className="mt-1 min-h-11 w-full rounded border bg-transparent px-2" style={{ borderColor: "var(--sh-border-1)" }} value={instrument} onChange={(event) => setInstrument(event.target.value as typeof instrument)}><option value="shares">Shares</option><option value="options">Options</option><option value="either">Either</option></select></label><fieldset className="sm:col-span-2 lg:col-span-3"><legend className="text-xs font-semibold">Horizons</legend><div className="mt-1 flex flex-wrap gap-2">{(["intraday", "overnight", "swing", "catalyst_window", "position"] as UnderwritingHoldingPeriod[]).map((period) => <label key={period} className="flex min-h-11 items-center gap-2 rounded border px-3 text-xs capitalize" style={{ borderColor: horizons.includes(period) ? "var(--sh-signal)" : "var(--sh-border-1)" }}><input type="checkbox" checked={horizons.includes(period)} onChange={(event) => setHorizons((currentHorizons) => event.target.checked ? Array.from(new Set([...currentHorizons, period])) : currentHorizons.length === 1 ? currentHorizons : currentHorizons.filter((item) => item !== period))} />{period.replaceAll("_", " ")}</label>)}</div></fieldset><Button className="min-h-11 self-end" disabled={busy || revisionChanges.length === 0} onClick={() => setReviewChanges(true)}><RefreshCw className="mr-2 h-4 w-4" />Review changes</Button>{reviewChanges && <section className="rounded-lg border p-4 sm:col-span-2 lg:col-span-4" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}><h2 className="text-sm font-semibold">Review the revision before applying it</h2><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Affected calculations and eligibility will be re-evaluated. Existing orders and prior approvals are not changed.</p><dl className="mt-3 grid gap-2">{revisionChanges.map(([label, before, after]) => <div key={String(label)} className="grid gap-1 text-xs sm:grid-cols-[12rem_1fr_1fr]"><dt className="font-semibold">{label}</dt><dd>Before: {typeof before === "number" || before == null ? moneyInput(before as number | null) || "—" : String(before)}</dd><dd>After: {typeof after === "number" || after == null ? moneyInput(after as number | null) || "—" : String(after)}</dd></div>)}</dl><div className="mt-4 flex flex-wrap gap-2"><Button className="min-h-11" disabled={busy} onClick={reunderwrite}>Apply revision & re-underwrite</Button><Button variant="outline" className="min-h-11" onClick={() => setReviewChanges(false)}>Keep editing</Button></div></section>}</div></details><PlayUnderwritingBrief result={result} selectedPlayId={result.selectedPlayId} busy={busy || priorResultOnly} onValidate={validate} /></>}
  </main></DashboardLayout>;
}

function MoneyControl({ label, value, onChange, optional = false }: { label: string; value: string; onChange: (value: string) => void; optional?: boolean }) {
  return <label className="text-xs font-semibold">{label}<div className="mt-1 flex min-h-11 items-center rounded border px-3" style={{ borderColor: "var(--sh-border-1)" }}><span>$</span><input aria-label={label} inputMode="decimal" placeholder={optional ? "Use mandate" : undefined} className="min-w-0 flex-1 bg-transparent px-1 outline-none placeholder:text-xs" value={value} onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, ""))} /></div></label>;
}
