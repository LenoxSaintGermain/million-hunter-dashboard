import { useEffect, useState } from "react";
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
  const run = trpc.aperture.underwriter.run.useMutation();
  const revise = trpc.aperture.underwriter.revise.useMutation();
  const validatePlay = trpc.aperture.underwriter.validatePlay.useMutation();
  const startResearch = trpc.aperture.runway.startResearch.useMutation();
  const result = revise.data ?? run.data ?? current.data ?? null;
  const [capital, setCapital] = useState("");
  const [target, setTarget] = useState("");
  const [maxLoss, setMaxLoss] = useState("");
  const [maxOpenRisk, setMaxOpenRisk] = useState("");
  const [weeklyLossLimit, setWeeklyLossLimit] = useState("");
  const [eventRiskLimit, setEventRiskLimit] = useState("");
  const [targetPeriod, setTargetPeriod] = useState<"session" | "week" | "month">("week");
  const [instrument, setInstrument] = useState<"shares" | "options" | "either">("either");
  const [horizons, setHorizons] = useState<UnderwritingHoldingPeriod[]>(["swing"]);
  const uatCase = readIsolatedUatCase();

  useEffect(() => {
    if (!valid || current.isLoading || current.data !== null || run.isPending || run.data || run.error) return;
    run.mutate({ decisionRunId, decisionRevisionId, requestedPlayCount: 3, uatCase: uatCase ?? undefined });
  }, [valid, current.isLoading, current.data, run.isPending, run.data, run.error, decisionRunId, decisionRevisionId]);

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
  }, [result?.underwritingRevisionId]);

  const reunderwrite = async () => {
    if (!result) return;
    const objective: CapitalObjective = {
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
    };
    if (!objective.deployableCapitalCents || !objective.maxPlannedLossCents || !objective.holdingPeriods.length) return toast.error("Enter capital, maximum planned loss, and at least one horizon.");
    try {
      await revise.mutateAsync({ decisionRunId, decisionRevisionId, requestedPlayCount: 3, objective });
      await utils.aperture.underwriter.get.invalidate({ decisionRunId });
      toast.success("Underwriting revision recorded. Previous assumptions remain in history.");
    } catch (error: any) {
      toast.error(error?.message ?? "The mission could not be re-underwritten.");
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

  const busy = run.isPending || revise.isPending || validatePlay.isPending || startResearch.isPending;
  const failure = current.error ?? run.error ?? revise.error;

  return <DashboardLayout><main className="mx-auto max-w-6xl space-y-5 pb-24">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><Button variant="ghost" className="min-h-11 px-0" onClick={() => navigate(`/aperture/decision/${decisionRunId}/revision/${decisionRevisionId}`)}><ArrowLeft className="mr-2 h-4 w-4" />Capital Mission</Button><p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>Play Underwriter · strategy generation</p><h1 className="mt-1 font-serif text-3xl">Underwriting brief.</h1><p className="mt-2 text-sm" style={{ color: "var(--sh-fg-muted)" }}>Target feasibility, sourced market context, and at most three conditional plays. No order is created here.</p></div>{result && <span className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Revision {result.version} · {new Date(result.asOf).toLocaleString()}</span>}</header>
    {failure && <section role="alert" className="rounded-xl border p-5" style={{ borderColor: "var(--sh-red)", background: "var(--sh-surface)" }}><p className="font-semibold">Underwriting stopped safely.</p><p className="mt-2 text-sm" style={{ color: "var(--sh-fg-muted)" }}>{failure.message}</p><p className="mt-2 text-xs">No research run, proposal, approval, submission, or broker order was created.</p></section>}
    {!result && !failure && <section className="rounded-xl border p-8 text-center" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><RefreshCw className="mx-auto h-5 w-5 animate-spin" style={{ color: "var(--sh-signal)" }} /><p className="mt-3 font-semibold">Underwriting the mission…</p><p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Checking measured risk and provider-backed market facts.</p></section>}
    {result && <><details className="rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">Change an assumption</summary><div className="grid gap-3 border-t p-4 sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "var(--sh-border-1)" }}><MoneyControl label="Deployable capital" value={capital} onChange={setCapital} /><MoneyControl label="Target profit" value={target} onChange={setTarget} /><label className="text-xs font-semibold">Target period<select className="mt-1 min-h-11 w-full rounded border bg-transparent px-2" style={{ borderColor: "var(--sh-border-1)" }} value={targetPeriod} onChange={(event) => setTargetPeriod(event.target.value as typeof targetPeriod)}><option value="session">Session</option><option value="week">Week</option><option value="month">Month</option></select></label><MoneyControl label="Maximum planned loss" value={maxLoss} onChange={setMaxLoss} /><MoneyControl label="Maximum portfolio open risk" value={maxOpenRisk} onChange={setMaxOpenRisk} optional /><MoneyControl label="Weekly loss limit" value={weeklyLossLimit} onChange={setWeeklyLossLimit} optional /><MoneyControl label="Event-risk limit" value={eventRiskLimit} onChange={setEventRiskLimit} optional /><label className="text-xs font-semibold">Instrument<select className="mt-1 min-h-11 w-full rounded border bg-transparent px-2" style={{ borderColor: "var(--sh-border-1)" }} value={instrument} onChange={(event) => setInstrument(event.target.value as typeof instrument)}><option value="shares">Shares</option><option value="options">Options</option><option value="either">Either</option></select></label><fieldset className="sm:col-span-2 lg:col-span-3"><legend className="text-xs font-semibold">Horizons</legend><div className="mt-1 flex flex-wrap gap-2">{(["intraday", "overnight", "swing", "catalyst_window", "position"] as UnderwritingHoldingPeriod[]).map((period) => <label key={period} className="flex min-h-11 items-center gap-2 rounded border px-3 text-xs capitalize" style={{ borderColor: horizons.includes(period) ? "var(--sh-signal)" : "var(--sh-border-1)" }}><input type="checkbox" checked={horizons.includes(period)} onChange={(event) => setHorizons((currentHorizons) => event.target.checked ? Array.from(new Set([...currentHorizons, period])) : currentHorizons.length === 1 ? currentHorizons : currentHorizons.filter((item) => item !== period))} />{period.replaceAll("_", " ")}</label>)}</div></fieldset><Button className="min-h-11 self-end" disabled={busy} onClick={reunderwrite}><RefreshCw className="mr-2 h-4 w-4" />Re-underwrite</Button></div></details><PlayUnderwritingBrief result={result} selectedPlayId={result.selectedPlayId} busy={busy} onValidate={validate} /></>}
  </main></DashboardLayout>;
}

function MoneyControl({ label, value, onChange, optional = false }: { label: string; value: string; onChange: (value: string) => void; optional?: boolean }) {
  return <label className="text-xs font-semibold">{label}<div className="mt-1 flex min-h-11 items-center rounded border px-3" style={{ borderColor: "var(--sh-border-1)" }}><span>$</span><input aria-label={label} inputMode="decimal" placeholder={optional ? "Use mandate" : undefined} className="min-w-0 flex-1 bg-transparent px-1 outline-none placeholder:text-xs" value={value} onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, ""))} /></div></label>;
}
