import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import ApertureShell from "@/components/aperture/ApertureShell";
import { AlertTriangle, CheckCircle2, Clock3, FileClock, Loader2, PlayCircle, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const outcomeTone = (result: string) => result === "win"
  ? "oklch(0.55 0.15 145)"
  : result === "loss"
    ? "var(--sh-red)"
    : result === "breakeven"
      ? "var(--sh-signal)"
      : "var(--sh-fg-muted)";

const outcomeLabel = (result: string) => ({
  win: "Target window closed positive",
  loss: "Modelled stop reached",
  breakeven: "Near break-even at time stop",
  not_triggered: "Trigger never occurred",
  unresolved: "Outcome not measured",
}[result] ?? result.replaceAll("_", " "));

const cents = (value: number | null | undefined) => value == null ? "—" : `$${(value / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const signedCents = (value: number | null | undefined) => value == null ? "Not measured" : `${value >= 0 ? "+" : "−"}${cents(Math.abs(value))}`;

export default function ApertureRecord() {
  const utils = trpc.useUtils();
  const [selectedSlateId, setSelectedSlateId] = useState<number | null>(null);
  const { data: slates = [], isLoading: loadingSlates } = trpc.aperture.ledger.list.useQuery();
  const { data: cohorts = [], isLoading: loadingCohorts } = trpc.aperture.ledger.availableCohorts.useQuery();
  const { data: activePlays } = trpc.aperture.play.list.useQuery();
  const { data: dailyRefresh } = trpc.aperture.ledger.dailyRefreshSchedule.useQuery();
  const { data: oneTimeResearch } = trpc.aperture.ledger.oneTimeResearchSchedule.useQuery();
  const { data: portfolioImpactTrend } = trpc.aperture.ledger.portfolioImpactTrend.useQuery();
  const canCaptureLiveSlate = (activePlays?.plays?.length ?? 0) > 0;
  const reconstruct = trpc.aperture.ledger.reconstructRecentRun.useMutation({
    onSuccess: async ({ slateId, created }) => {
      await utils.aperture.ledger.list.invalidate();
      setSelectedSlateId(slateId);
      toast.success(created ? "Historical postmortem captured" : "Existing postmortem opened");
    },
    onError: (error) => toast.error(error.message),
  });
  const captureWindow = trpc.aperture.ledger.captureCurrentWindow.useMutation({
    onSuccess: async ({ slateId, created }) => {
      await utils.aperture.ledger.list.invalidate();
      setSelectedSlateId(slateId);
      toast.success(created ? "Live paper slate captured" : "Existing paper slate opened");
    },
    onError: (error) => toast.error(error.message),
  });
  const recordSlateDecision = trpc.aperture.ledger.recordSlateDecision.useMutation({
    onSuccess: async () => {
      await utils.aperture.ledger.list.invalidate();
      toast.success("Paper posture recorded — no order was created");
    },
    onError: (error) => toast.error(error.message),
  });
  const refreshLiveOutcomes = trpc.aperture.ledger.refreshLiveOutcomes.useMutation({
    onSuccess: async ({ refreshed, terminalCount }) => {
      await utils.aperture.ledger.list.invalidate();
      toast.success(`${terminalCount} of ${refreshed} paper outcomes are now terminal`);
    },
    onError: (error) => toast.error(error.message),
  });
  const configureDailyRefresh = trpc.aperture.ledger.configureDailyRefresh.useMutation({
    onSuccess: async ({ enabled }) => {
      await utils.aperture.ledger.dailyRefreshSchedule.invalidate();
      toast.success(enabled ? "Daily paper-outcome refresh is on" : "Daily paper-outcome refresh is paused");
    },
    onError: (error) => toast.error(error.message),
  });
  const configureOneTimeResearch = trpc.aperture.ledger.configureOneTimeGlp1Research.useMutation({
    onSuccess: async ({ enabled }) => {
      await utils.aperture.ledger.oneTimeResearchSchedule.invalidate();
      toast.success(enabled ? "GLP-1 post-open research is queued" : "GLP-1 post-open research is paused");
    },
    onError: (error) => toast.error(error.message),
  });
  const selectedSlate = useMemo(
    () => slates.find((slate) => slate.id === selectedSlateId) ?? slates[0] ?? null,
    [selectedSlateId, slates],
  );

  return (
    <ApertureShell>
      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-eyebrow text-eyebrow uppercase tracking-widest" style={{ color: "var(--sh-signal)" }}>Capital Aperture · record</p>
            <h1 className="mt-1 font-display text-3xl tracking-tight" style={{ color: "var(--sh-text-primary)" }}>What did the system see—and what happened next?</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>This is a paper-only decision ledger. It keeps the system’s opportunity set, your recorded posture, and the source-observed counterfactual separate. It never treats a modelled level as a broker fill.</p>
          </div>
          <Badge variant="outline" className="w-fit text-[10px]" style={{ color: "var(--sh-signal)", borderColor: "color-mix(in srgb, var(--sh-signal) 35%, var(--sh-border-1))" }}>NO AUTONOMOUS ACTION</Badge>
        </div>

        <section className="rounded-xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }} aria-labelledby="portfolio-impact-trend-title">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-eyebrow text-[10px] uppercase tracking-widest" style={{ color: "var(--sh-signal)" }}>Live paper cohorts only</p>
              <h2 id="portfolio-impact-trend-title" className="mt-1 text-lg font-semibold" style={{ color: "var(--sh-text-primary)" }}>Portfolio impact trend</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{portfolioImpactTrend?.evidenceNote ?? "Loading captured cohort evidence…"}</p>
            </div>
            <Badge variant="outline" className="w-fit text-[10px]" style={{ color: "var(--sh-fg-muted)", borderColor: "var(--sh-border-1)" }}>{portfolioImpactTrend?.historicalCohortCountExcluded ?? 0} historical cohort{portfolioImpactTrend?.historicalCohortCountExcluded === 1 ? "" : "s"} excluded</Badge>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg p-3" style={{ background: "var(--sh-surface-2)" }}><p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--sh-fg-muted)" }}>Cohort evidence</p><p className="mt-1 text-xl font-semibold" style={{ color: "var(--sh-text-primary)" }}>{portfolioImpactTrend?.measuredSelectedOutcomeCount ?? 0} / {portfolioImpactTrend?.selectedPaperPlayCount ?? 0}</p><p className="text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>verified selected outcomes</p></div>
            <div className="rounded-lg p-3" style={{ background: "var(--sh-surface-2)" }}><p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--sh-fg-muted)" }}>Modelled exposure</p><p className="mt-1 text-xl font-semibold" style={{ color: "var(--sh-text-primary)" }}>{cents(portfolioImpactTrend?.modeledExposureCents)}</p><p className="text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>cumulative; not simultaneous</p></div>
            <div className="rounded-lg p-3" style={{ background: "var(--sh-surface-2)" }}><p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--sh-fg-muted)" }}>Bounded planned loss</p><p className="mt-1 text-xl font-semibold" style={{ color: "var(--sh-text-primary)" }}>{cents(portfolioImpactTrend?.plannedLossCents)}</p><p className="text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>from captured recipes</p></div>
            <div className="rounded-lg p-3" style={{ background: "var(--sh-surface-2)" }}><p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--sh-fg-muted)" }}>Observed paper impact</p><p className="mt-1 text-xl font-semibold" style={{ color: portfolioImpactTrend?.observedImpactCents != null && portfolioImpactTrend.observedImpactCents < 0 ? "var(--sh-red)" : "var(--sh-text-primary)" }}>{signedCents(portfolioImpactTrend?.observedImpactCents)}</p><p className="text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>{portfolioImpactTrend?.nonTriggeredSelectedCount ?? 0} non-triggered · {portfolioImpactTrend?.unavailableSelectedCount ?? 0} unavailable</p></div>
          </div>
        </section>

        <div className="grid gap-3 lg:grid-cols-[1.05fr_1.95fr]">
          <Card style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
            <CardContent className="space-y-4 p-4">
              <div className="rounded-lg border p-3" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 35%, var(--sh-border-1))", background: "color-mix(in srgb, var(--sh-signal) 5%, var(--sh-surface))" }}>
                <div className="flex items-center gap-2"><Clock3 className="h-4 w-4" style={{ color: "var(--sh-signal)" }} /><h2 className="font-medium" style={{ color: "var(--sh-text-primary)" }}>Capture today’s decision windows</h2></div>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{canCaptureLiveSlate ? "Each button preserves the active thesis, paper-account boundary, evidence state, modelled recipe, and tape basis exactly as they are now. It never prepares or submits an order." : "No active, non-expired play is currently available under this thesis, so capture is disabled rather than creating an empty record."}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">{[
                  ["opening", "Opening"],
                  ["mid_session", "Mid-session"],
                  ["catalyst", "Catalyst"],
                ].map(([windowKey, label]) => <Button key={windowKey} size="sm" variant="outline" className="px-1.5 text-[11px]" disabled={captureWindow.isPending || !canCaptureLiveSlate} onClick={() => captureWindow.mutate({ windowKey })}>{captureWindow.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : label}</Button>)}</div>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
                <div className="flex items-center gap-2"><Clock3 className="h-4 w-4" style={{ color: dailyRefresh?.enabled ? "oklch(0.55 0.15 145)" : "var(--sh-fg-muted)" }} /><h2 className="font-medium" style={{ color: "var(--sh-text-primary)" }}>Daily outcome refresh</h2></div>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{dailyRefresh?.enabled ? "On — after each regular session, the system refreshes only due live paper captures from source-timed tape. It never creates an order." : "Off — turn on to refresh future live paper captures after the regular session closes. Historical reconstructions remain excluded."}</p>
                {dailyRefresh?.lastResult && <p className="mt-2 text-[11px] leading-5" style={{ color: "var(--sh-fg-muted)" }}>Last run: {dailyRefresh.lastResult}{dailyRefresh.lastRunAt ? ` · ${new Date(dailyRefresh.lastRunAt).toLocaleString()}` : ""}</p>}
                <Button className="mt-3 w-full" size="sm" variant="outline" disabled={configureDailyRefresh.isPending} onClick={() => configureDailyRefresh.mutate({ enabled: !dailyRefresh?.enabled })}>
                  {configureDailyRefresh.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Clock3 className="mr-1.5 h-3.5 w-3.5" />}
                  {dailyRefresh?.enabled ? "Pause daily refresh" : "Turn on daily refresh"}
                </Button>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 35%, var(--sh-border-1))", background: "color-mix(in srgb, var(--sh-signal) 5%, var(--sh-surface))" }}>
                <div className="flex items-center gap-2"><PlayCircle className="h-4 w-4" style={{ color: oneTimeResearch?.enabled ? "oklch(0.55 0.15 145)" : "var(--sh-signal)" }} /><h2 className="font-medium" style={{ color: "var(--sh-text-primary)" }}>GLP-1 post-open research</h2></div>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{oneTimeResearch?.enabled ? `Queued for ${oneTimeResearch.targetAt ? new Date(oneTimeResearch.targetAt).toLocaleString() : "the next measurable opening-range window"}. It creates research only; you will still choose a paper posture.` : oneTimeResearch?.status === "completed" ? "Research is complete. Review the opportunity set, then choose a paper posture yourself—no order was created." : "One paper-only GLP-1 research brief can run after the opening range. It cannot record a posture, create a proposal, or submit an order."}</p>
                {oneTimeResearch?.lastResult && <p className="mt-2 text-[11px] leading-5" style={{ color: "var(--sh-fg-muted)" }}>{oneTimeResearch.lastResult}</p>}
                {oneTimeResearch?.runId && <Link href={`/aperture/run/${oneTimeResearch.runId}`} className="mt-3 inline-flex text-xs font-medium underline underline-offset-4" style={{ color: "var(--sh-signal)" }}>Open the research brief</Link>}
                {oneTimeResearch?.status !== "completed" && <Button className="mt-3 w-full" size="sm" variant="outline" disabled={configureOneTimeResearch.isPending} onClick={() => configureOneTimeResearch.mutate({ enabled: !oneTimeResearch?.enabled })}>
                  {configureOneTimeResearch.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="mr-1.5 h-3.5 w-3.5" />}
                  {oneTimeResearch?.enabled ? "Pause GLP-1 research" : "Queue GLP-1 post-open research"}
                </Button>}
              </div>
              <div>
                <div className="flex items-center gap-2"><FileClock className="h-4 w-4" style={{ color: "var(--sh-signal)" }} /><h2 className="font-medium" style={{ color: "var(--sh-text-primary)" }}>Start a recent postmortem</h2></div>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>A reconstruction retains the full cohort and is clearly labelled as after-the-fact. It cannot be used as a live recommendation capture or a trust-rate observation.</p>
              </div>
              {loadingCohorts ? <p className="flex items-center gap-2 text-xs" style={{ color: "var(--sh-fg-muted)" }}><Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding completed cohorts…</p> : cohorts.length ? cohorts.map((cohort) => (
                <div key={cohort.id} className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
                  <p className="text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>{cohort.thesisName}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>{cohort.candidateCount ?? 0} surfaced symbols · {cohort.holdingPeriod?.replaceAll("_", " ") ?? "horizon not recorded"}</p>
                  <Button className="mt-3 w-full" size="sm" variant="outline" disabled={reconstruct.isPending || cohort.holdingPeriod !== "intraday"} onClick={() => reconstruct.mutate({ runId: cohort.id })}>
                    {reconstruct.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="mr-1.5 h-3.5 w-3.5" />}
                    {cohort.holdingPeriod === "intraday" ? "Run postmortem" : "Intraday POC only"}
                  </Button>
                </div>
              )) : <p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>There is no completed short-horizon research cohort to reconstruct yet.</p>}
            </CardContent>
          </Card>

          <Card style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
            <CardContent className="p-4">
              {loadingSlates ? <div className="flex items-center gap-2 py-12 text-sm" style={{ color: "var(--sh-fg-muted)" }}><Loader2 className="h-4 w-4 animate-spin" /> Loading recorded paper-play history…</div> : !selectedSlate ? <div className="py-10 text-center"><Clock3 className="mx-auto h-6 w-6" style={{ color: "var(--sh-fg-muted)" }} /><p className="mt-3 text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>No dated slate yet</p><p className="mx-auto mt-1 max-w-md text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Choose a completed intraday cohort to create the first source-traceable postmortem. Future live decision windows will be captured separately and will not overwrite this record.</p></div> : <>
                <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between" style={{ borderColor: "var(--sh-border-1)" }}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h2 className="font-medium" style={{ color: "var(--sh-text-primary)" }}>{selectedSlate.sessionDateEt} · {selectedSlate.windowKey.replaceAll("_", " ")}</h2><Badge variant="outline" className="text-[10px]" style={{ color: selectedSlate.snapshotBasis === "historical_reconstruction" ? "var(--sh-signal)" : "oklch(0.55 0.15 145)" }}>{selectedSlate.snapshotBasis === "historical_reconstruction" ? "HISTORICAL RECONSTRUCTION" : "LIVE CAPTURE"}</Badge></div>
                    <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{selectedSlate.items.length} surfaced plays · decision: {selectedSlate.operatorDecision.replaceAll("_", " ")}</p>
                  </div>
                  <div className="flex max-w-full items-center gap-1 overflow-x-auto" aria-label="Choose recorded paper-play slate">{selectedSlate.snapshotBasis === "live_capture" && <Button size="sm" variant="outline" className="shrink-0 text-[11px]" disabled={refreshLiveOutcomes.isPending} onClick={() => refreshLiveOutcomes.mutate({ slateId: selectedSlate.id })}>{refreshLiveOutcomes.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Clock3 className="mr-1 h-3.5 w-3.5" />}Refresh outcomes</Button>}{slates.map((slate) => <button type="button" key={slate.id} onClick={() => setSelectedSlateId(slate.id)} className="shrink-0 rounded border px-2 py-1 text-[11px]" style={{ borderColor: slate.id === selectedSlate.id ? "var(--sh-signal)" : "var(--sh-border-1)", color: slate.id === selectedSlate.id ? "var(--sh-signal)" : "var(--sh-fg-muted)" }}>{slate.sessionDateEt} · {slate.windowKey}</button>)}</div>
                </div>

                {selectedSlate.snapshotBasis === "live_capture" && selectedSlate.operatorDecision === "not_recorded" && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
                  <p className="mr-auto text-xs" style={{ color: "var(--sh-fg-muted)" }}>Record your posture for comparison. This does not create a paper proposal or order.</p>
                  <Button size="sm" variant="outline" disabled={recordSlateDecision.isPending} onClick={() => recordSlateDecision.mutate({ slateId: selectedSlate.id, decision: "cash", reason: "Recorded cash posture for paper-outcome comparison." })}>Stay in cash</Button>
                </div>}

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg p-3" style={{ background: "var(--sh-surface-2)" }}><p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--sh-fg-muted)" }}>System opportunity set</p><p className="mt-1 text-xl font-semibold" style={{ color: "var(--sh-text-primary)" }}>{selectedSlate.items.length}</p><p className="text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>all surfaced candidates retained</p></div>
                  <div className="rounded-lg p-3" style={{ background: "var(--sh-surface-2)" }}><p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--sh-fg-muted)" }}>Observed counterfactuals</p><p className="mt-1 text-xl font-semibold" style={{ color: "var(--sh-text-primary)" }}>{selectedSlate.items.filter((item) => item.outcomeStatus === "resolved" && item.outcomeResult !== "not_triggered").length}</p><p className="text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>not broker fills</p></div>
                  <div className="rounded-lg p-3" style={{ background: "var(--sh-surface-2)" }}><p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--sh-fg-muted)" }}>Unavailable or ambiguous</p><p className="mt-1 text-xl font-semibold" style={{ color: "var(--sh-text-primary)" }}>{selectedSlate.items.filter((item) => item.outcomeStatus !== "resolved" || item.outcomeResult === "unresolved").length}</p><p className="text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>never filled with assumptions</p></div>
                </div>

                {selectedSlate.postmortemFinding && <div className="mt-4 flex gap-2 rounded-lg border px-3 py-2.5" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 35%, var(--sh-border-1))", background: "color-mix(in srgb, var(--sh-signal) 7%, var(--sh-surface))" }}>
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--sh-signal)" }} />
                  <div><p className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>What this cohort actually tells us</p><p className="mt-0.5 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{selectedSlate.postmortemFinding}</p></div>
                </div>}

                <div className="mt-4 rounded-lg border px-3 py-2.5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Trust calibration</p><span className="text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>{selectedSlate.snapshotBasis === "historical_reconstruction" ? "Historical reconstructions excluded" : `${selectedSlate.trustCalibration.eligibleCount} verified live observations`}</span></div>
                  <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{selectedSlate.snapshotBasis === "historical_reconstruction" ? "This postmortem helps improve the capture process, but it cannot be counted as a live recommendation or a signal-quality observation." : selectedSlate.trustCalibration.claim}</p>
                </div>

                <div className="mt-4 space-y-2">{selectedSlate.items.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
                    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-mono text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{item.symbol}</p><p className="mt-0.5 text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>{item.triggerObservation.replaceAll("_", " ")} trigger · {item.exitObservation.replaceAll("_", " ")} exit · {item.outcomeBasis} observation</p></div><div className="flex items-center gap-2">{selectedSlate.snapshotBasis === "live_capture" && selectedSlate.operatorDecision === "not_recorded" && <Button size="sm" variant="outline" disabled={recordSlateDecision.isPending} onClick={() => recordSlateDecision.mutate({ slateId: selectedSlate.id, decision: "selected", itemId: item.id, reason: `Recorded ${item.symbol} as the operator's paper selection for outcome comparison.` })}>Record as selected</Button>}<Badge variant="outline" className="text-[10px]" style={{ borderColor: outcomeTone(item.outcomeResult), color: outcomeTone(item.outcomeResult) }}>{item.outcomeResult === "win" ? <TrendingUp className="mr-1 h-3 w-3" /> : item.outcomeResult === "loss" ? <TrendingDown className="mr-1 h-3 w-3" /> : item.outcomeResult === "unresolved" ? <AlertTriangle className="mr-1 h-3 w-3" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}{outcomeLabel(item.outcomeResult)}</Badge></div></div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs"><span style={{ color: "var(--sh-fg-muted)" }}>Model entry <b style={{ color: "var(--sh-text-primary)" }}>{cents(item.entryPriceCents)}</b></span><span style={{ color: "var(--sh-fg-muted)" }}>Observed exit <b style={{ color: "var(--sh-text-primary)" }}>{cents(item.settlementPriceCents)}</b></span><span style={{ color: "var(--sh-fg-muted)" }}>R multiple <b style={{ color: "var(--sh-text-primary)" }}>{item.rMultiple == null ? "—" : `${item.rMultiple.toFixed(2)}R`}</b></span></div>
                    <p className="mt-2 text-[11px] leading-5" style={{ color: "var(--sh-fg-muted)" }}>{item.outcomeExplanation}</p>
                  </div>
                ))}</div>
              </>}
            </CardContent>
          </Card>
        </div>
      </section>
    </ApertureShell>
  );
}
