import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AttentionDecisionCard } from "@/components/aperture/AttentionDecisionCard";
import { AttentionSourceRecovery } from "@/components/aperture/AttentionSourceRecovery";
import { buildResearchJourneys } from "@shared/runWorkspace";
import { playDeskJourneyLane } from "@shared/playDeskState";
import { isOptionInstrument, paperInstrumentDisplayLabel, parseOccOptionSymbol } from "@shared/paperInstrument";
import { arbitrateTodayRead, canShowQuietBriefing, type ApertureAttentionBriefing, type ApertureAttentionItem } from "@shared/apertureAttention";
import { deskOrderReturn, formatMarkProvenance, formatReturnAmount, formatReturnPercent } from "@shared/positionReturn";
import { DeskGlanceLayer } from "@/components/aperture/DeskGlanceLayer";
import { PlayInspectionDrawer, type InspectableOrder } from "@/components/aperture/PlayInspectionDrawer";

const money = (cents?: number | null) => cents == null
  ? "—"
  : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

const instrumentLabel = (instrumentType: string) => instrumentType === "long_call" ? "Call" : instrumentType === "long_put" ? "Put" : "Shares";
const instrumentFilter = (instrumentType: string) => instrumentType === "long_call" ? "calls" : instrumentType === "long_put" ? "puts" : "shares";
const symbolFilter = (symbol?: string | null): PlayFilter | "unscoped" => {
  if (!symbol) return "unscoped";
  const option = parseOccOptionSymbol(symbol);
  if (option) return instrumentFilter(option.instrumentType);
  return "shares";
};
const readableSymbol = (symbol: string) => {
  const option = parseOccOptionSymbol(symbol);
  return option ? paperInstrumentDisplayLabel({ ...option, symbol }) : `${symbol.toUpperCase()} shares`;
};

const pendingOutcomeRoute = (item: {
  kind: string;
  orderRunId?: number | null;
  orderCandidateId?: number | null;
  decisionRunId: number;
  revisionId: number;
}) => item.kind === "play_outcome" && item.orderRunId != null && item.orderCandidateId != null
  ? `/aperture/run/${item.orderRunId}/execute?candidate=${item.orderCandidateId}&lifecycle=monitoring`
  : `/aperture/decision/${item.decisionRunId}/revision/${item.revisionId}`;

type PlayFilter = "all" | "shares" | "calls" | "puts";
type StageFilter = "all" | "choose" | "approve" | "monitor";

/** URL is the reading context; filters survive reload/back without a second local truth. */
export function readPlayDeskLocation(search: string) {
  const params = new URLSearchParams(search);
  const instrument = params.get("instrument");
  const stage = params.get("stage");
  const play = params.get("play");
  const inspect = params.get("inspect");
  return {
    playFilter: (["shares", "calls", "puts"].includes(instrument ?? "") ? instrument : "all") as PlayFilter,
    stageFilter: (["choose", "approve", "monitor"].includes(stage ?? "") ? stage : "all") as StageFilter,
    selectedPlayId: play && /^[1-9]\d*$/.test(play) && Number.isSafeInteger(Number(play)) ? Number(play) : null,
    inspectOrderId: inspect && /^[1-9]\d*$/.test(inspect) && Number.isSafeInteger(Number(inspect)) ? Number(inspect) : null,
  };
}

export function playDeskFilterHref(search: string, changes: { instrument?: PlayFilter; stage?: StageFilter; play?: number | null; inspect?: number | null }) {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(changes)) {
    if (value == null || value === "all") params.delete(key);
    else params.set(key, String(value));
  }
  return `/aperture/plays${params.size ? `?${params}` : ""}`;
}

/** Use the same server-derived tasks/motion as Today. No second order-state machine. */
export function deskOrderPresentation(id: number, briefing?: ApertureAttentionBriefing | null) {
  const tasks = briefing ? [briefing.primary, ...briefing.otherCritical, ...briefing.otherAttention] : [];
  const task = tasks.find((item) => item?.key === `order:${id}:dispatch`) ?? tasks.find((item) => item?.key === `order:${id}`);
  const motion = briefing?.inMotion.find((item) => item.key === `order:${id}`);
  return {
    label: task?.stateLabel ?? motion?.stateLabel ?? "Status unavailable",
    detail: task?.reason ?? motion?.detail ?? "Refresh status to recover this order's recorded next action.",
    action: task?.actionLabel ?? (motion ? "View order status" : "Refresh status"),
    href: task?.href ?? motion?.href ?? null,
  };
}

export function deskAttentionOutsideFilters(item: ApertureAttentionItem, filters: ReturnType<typeof readPlayDeskLocation>, orders: ReadonlyArray<{ id: number; instrumentType: string }>, reviews: ReadonlyArray<{ id: number; orderSymbol?: string | null }>) {
  const orderId = item.key.match(/^(?:order|finding):(\d+)(?::|$)/)?.[1];
  const order = orders.find((value) => value.id === Number(orderId));
  const reviewId = item.key.match(/^review:(\d+)$/)?.[1];
  const review = reviews.find((value) => value.id === Number(reviewId));
  const instrument = order ? instrumentFilter(order.instrumentType) : symbolFilter(review?.orderSymbol ?? item.symbol);
  const stage = item.kind === "ready_for_paper_review" || item.kind === "approved_not_submitted" ? "approve"
    : ["dispatch_unresolved", "invalidation_evidence", "review_due"].includes(item.kind) ? "monitor"
    : item.kind === "evidence_missing" ? "choose" : "unscoped";
  return (filters.playFilter !== "all" && instrument !== filters.playFilter)
    || (filters.stageFilter !== "all" && stage !== filters.stageFilter);
}

export default function AperturePlayDesk() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const filters = readPlayDeskLocation(search);
  const { playFilter, stageFilter, selectedPlayId, inspectOrderId } = filters;
  const setPlayFilter = (instrument: PlayFilter) => navigate(playDeskFilterHref(search, { instrument }));
  const setStageFilter = (stage: StageFilter) => navigate(playDeskFilterHref(search, { stage }));
  const desk = trpc.aperture.desk.summary.useQuery(undefined, { retry: false });
  const runs = trpc.aperture.run.list.useQuery(undefined, { retry: false });
  const playList = trpc.aperture.play.list.useQuery(undefined, { retry: false });
  const outcomes = trpc.aperture.runway.pending.useQuery(undefined, { retry: false });
  const [primaryKey, setPrimaryKey] = useState<string | null>(null);
  const refreshInFlight = useRef(false);
  const briefing = desk.data?.attention;
  const read = arbitrateTodayRead({ briefing: briefing ?? null, refreshing: desk.isFetching, failed: !!desk.error, primaryKey });
  const disclosure = read.layout;
  useEffect(() => {
    if (disclosure?.primary) setPrimaryKey(disclosure.primary.key);
  }, [disclosure?.primary?.key]);
  const sources = [
    { label: "Play and order", query: desk }, { label: "Research", query: runs },
    { label: "Play decisions", query: playList }, { label: "Scheduled review", query: outcomes },
  ];
  const unavailable = sources.filter(({ query }) => query.error || (!query.isLoading && query.data == null));
  const isRefreshing = sources.some(({ query }) => query.isFetching);
  const journeys = buildResearchJourneys((runs.data ?? []) as any[]);
  const researchActions = journeys.filter((journey) => ["needs_attention", "paper_stage_declined", "ready_to_review", "more_research_available"].includes(journey.state));
  const deferredByRun = new Map((playList.data?.plays ?? [])
    .filter((play) => play.decision?.decision === "deferred" && play.decision.resumeAt != null && play.decision.resumeAt > Date.now())
    .map((play) => [play.run.id, play.decision!] as const));
  const orderActions = (desk.data?.orders ?? []).filter((order) => ["pending_approval", "approved"].includes(order.status));
  const inMotionOrders = (desk.data?.orders ?? []).filter((order) => order.status === "submitted" || (order.status === "filled" && order.intent !== "close"));
  const selectedPlay = desk.data?.activePlays.find((play) => play.id === selectedPlayId);
  const activePlays = (desk.data?.activePlays ?? []).filter((play) => play.id !== selectedPlayId && !inMotionOrders.some((order) => order.accountId === play.accountId && order.symbol === play.symbol));
  const pendingOutcomes = outcomes.data ?? [];
  const isLoading = desk.isLoading || runs.isLoading || playList.isLoading || outcomes.isLoading;
  const decisionReady = researchActions.filter((journey) => deferredByRun.has(journey.latest.id) || playDeskJourneyLane(journey.latest.candidateStates) === "choose");
  const researchBacklog = researchActions.filter((journey) => !decisionReady.includes(journey) && playDeskJourneyLane(journey.latest.candidateStates) !== "in_motion_only");
  const count = decisionReady.length + researchBacklog.length + orderActions.length + inMotionOrders.length + activePlays.length + pendingOutcomes.length;
  const visibleOrderActions = orderActions.filter((order) => playFilter === "all" || instrumentFilter(order.instrumentType) === playFilter);
  const visibleOrders = inMotionOrders.filter((order) => playFilter === "all" || instrumentFilter(order.instrumentType) === playFilter);
  const visibleActivePlays = activePlays.filter((play) => playFilter === "all" || instrumentFilter(play.instrumentType) === playFilter);
  const visiblePendingOutcomes = pendingOutcomes.filter((item) => playFilter === "all" || symbolFilter(item.orderSymbol) === playFilter);
  const showChoose = stageFilter === "all" || stageFilter === "choose";
  const showApprove = stageFilter === "all" || stageFilter === "approve";
  const showMonitor = stageFilter === "all" || stageFilter === "monitor";
  const critical = [disclosure?.primary, ...(disclosure?.otherCritical ?? [])].filter((item): item is ApertureAttentionItem => !!item?.critical);
  const outsideFilters = critical.filter((item) => deskAttentionOutsideFilters(item, filters, desk.data?.orders ?? [], pendingOutcomes));
  const showQuiet = count === 0 && selectedPlayId == null && sources.every(({ query }) => query.data != null)
    && canShowQuietBriefing(briefing ?? null, isLoading || isRefreshing, unavailable.length ? "status unavailable" : null);

  const selectStage = (stage: Exclude<StageFilter, "all">) => {
    const next = stageFilter === stage ? "all" : stage;
    setStageFilter(next);
  };

  const refresh = async () => {
    // Keep the initiating control focusable while blocking repeated activation,
    // including a second event before query state has repainted.
    if (isRefreshing || refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      // One failed source must not unlock another refresh while others still run.
      // Each query retains its own error and last successful records for recovery.
      await Promise.allSettled([desk.refetch(), runs.refetch(), playList.refetch(), outcomes.refetch()]);
    } finally {
      refreshInFlight.current = false;
    }
  };

  return <DashboardLayout><div className="mx-auto max-w-6xl space-y-5 pb-12">
    <header data-desk-header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-serif text-2xl sm:text-3xl" style={{ color: "var(--sh-text-primary)" }}>Play Desk</h1>
      <Button type="button" variant="outline" size="sm" className="min-h-11 aria-disabled:opacity-50" onClick={refresh} aria-disabled={isRefreshing} aria-describedby="desk-refresh-scope"><RefreshCw className="mr-2 h-4 w-4" />{isRefreshing ? "Refreshing…" : "Refresh status"}</Button>
    </header>

    <div id="desk-refresh-scope" role="status" aria-live="polite" className="text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>
      <p>{isRefreshing ? "Loading status; existing records stay visible." : desk.dataUpdatedAt ? <>Records loaded <time dateTime={new Date(desk.dataUpdatedAt).toISOString()}>{new Date(desk.dataUpdatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>.</> : "Status has not loaded yet."}</p>
      <p>Refresh reads records only; no new checks.</p>
    </div>
    {unavailable.length > 0 && <section role="alert" className="rounded-xl border p-4" style={{ borderColor: "var(--sh-red)", background: "var(--sh-surface)" }}>
      {unavailable.map(({ label, query }) => <div key={label} className="mb-3 last:mb-0"><p className="font-semibold">{label} status unavailable</p><p className="mt-1 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{query.data != null ? "Refresh failed. Last known records remain visible; they may be stale." : "This part of the desk could not be verified."}</p></div>)}
      <p className="text-sm">This is not an all-clear. Refresh status to retry; no order will be resubmitted.</p>
      <Button type="button" variant="outline" className="mt-3 min-h-11 aria-disabled:opacity-50" onClick={refresh} aria-disabled={isRefreshing} aria-describedby="desk-refresh-scope">Retry status</Button>
    </section>}
    {briefing && read.state !== "complete" && <section role="status" className="rounded-xl border px-4 py-3 text-sm leading-5" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface)" }}><p className="font-semibold">Recorded checks: {read.state}. Status is not an all-clear.</p>{!briefing.sourceIssues?.length && <p>Missing source not identified in this saved snapshot. Refresh status to identify the gap.</p>}</section>}

    {desk.data && <DeskGlanceLayer
      orders={desk.data.orders ?? []}
      account={desk.data.account ?? null}
      accountUnavailable={desk.data.accountUnavailable ?? null}
      attentionCount={(disclosure?.primary ? 1 : 0) + (disclosure?.otherCritical.length ?? 0)}
      primaryLabel={disclosure?.primary?.actionLabel ?? null}
      onPrimary={() => disclosure?.primary?.href && navigate(disclosure.primary.href)}
      onFindBestPlay={() => navigate("/aperture/deploy")}
    />}

    <section id="desk-attention" aria-label="Attention across all plays" className="space-y-3">
      {disclosure?.primary && <AttentionTask item={disclosure.primary} prominent onOpen={navigate} />}
      {!!disclosure?.otherCritical.length && <section id="desk-critical" aria-labelledby="desk-critical-heading" className="rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
        <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b px-4 py-3" style={{ borderColor: "var(--sh-border-1)" }}><h2 id="desk-critical-heading" className="text-base font-semibold">Also needs you · {disclosure.otherCritical.length}</h2><p className="text-sm" style={{ color: "var(--sh-text-secondary)" }}>Visible across all filters</p></header>
        <div>{disclosure.otherCritical.map((item) => <AttentionTask key={item.key} item={item} compact onOpen={navigate} />)}</div>
      </section>}
      {outsideFilters.length > 0 && <p role="status" className="text-sm leading-6" style={{ color: "var(--sh-text-primary)" }}>{outsideFilters.length} critical issue{outsideFilters.length === 1 ? "" : "s"} outside these filters. Their review actions remain above. <button type="button" className="min-h-11 font-semibold underline underline-offset-4" onClick={() => navigate(playDeskFilterHref(search, { instrument: "all", stage: "all" }))}>Show all plays and stages</button></p>}
      {!!disclosure?.otherAttention.length && <details className="rounded-xl border" style={{ borderColor: "var(--sh-border-1)" }}><summary className="min-h-11 cursor-pointer p-3 text-sm font-semibold">Other decisions ({disclosure.otherAttention.length})</summary><div className="space-y-2 p-3 pt-0">{disclosure.otherAttention.map((item) => <AttentionTask key={item.key} item={item} onOpen={navigate} />)}</div></details>}
    </section>

    <AttentionSourceRecovery issues={briefing?.sourceIssues ?? []} onOpen={navigate} onRetry={refresh} busy={isRefreshing} />

    {selectedPlayId != null && <section id={`play-${selectedPlayId}`} tabIndex={-1} aria-label={`Selected play ${selectedPlayId}`} className="scroll-mt-24 rounded-xl border-2 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Selected play · #{selectedPlayId}</h2><Button variant="outline" className="min-h-11" onClick={() => navigate(playDeskFilterHref(search, { play: null }))}>Return to filtered desk</Button></div>
      {selectedPlay ? <><ActivePlayDetails play={selectedPlay} state={briefing?.inMotion.find((item) => item.key === `play:${selectedPlayId}`)?.stateLabel} />
        <p className="mt-3 text-sm leading-6">This exact record is shown regardless of filters. Opening it does not acknowledge a finding, resolve a review, or change an order.</p>
        {(desk.data?.orders ?? []).filter((order) => order.accountId === selectedPlay.accountId && order.symbol === selectedPlay.symbol).map((order) => {
          const state = deskOrderPresentation(order.id, briefing);
          return <div key={order.id} className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)" }}><p className="text-sm font-semibold">Linked order #{order.id} · {state.label}</p><p className="mt-1 text-sm">{state.detail}</p><Button className="mt-2 min-h-11" variant="outline" onClick={() => state.href ? navigate(state.href) : refresh()}>{state.action}</Button></div>;
        })}
      </> : <div role="status" className="mt-3 text-sm leading-6">{desk.isLoading ? "Loading this play's saved record…" : desk.error ? "The selected play could not be loaded. Retry status; this does not mean the play is closed." : "This play is not in the returned active records. It may be outside this account's active view; closure is not confirmed."}<div className="mt-2 flex flex-wrap gap-2"><Button type="button" className="min-h-11 aria-disabled:opacity-50" variant="outline" onClick={refresh} aria-disabled={isRefreshing} aria-describedby="desk-refresh-scope">Retry selected play</Button><Button className="min-h-11" variant="outline" onClick={() => navigate("/aperture/accounts")}>Inspect account records</Button></div></div>}
    </section>}

    <section className="grid grid-cols-3 overflow-hidden rounded-xl border" aria-label="Filter by workflow stage" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <StageMetric label="Choose" value={runs.data == null ? null : decisionReady.length} detail="plays to decide" active={stageFilter === "choose"} onSelect={() => selectStage("choose")} />
      <StageMetric label="Approve / send" value={desk.data == null ? null : visibleOrderActions.length} detail="tickets to move" active={stageFilter === "approve"} onSelect={() => selectStage("approve")} />
      <StageMetric label="Monitor" value={desk.data == null ? null : visibleOrders.length + visibleActivePlays.length} detail={outcomes.data == null ? "reviews unavailable" : `${visiblePendingOutcomes.length} scheduled reviews`} active={stageFilter === "monitor"} onSelect={() => selectStage("monitor")} />
    </section>

    {stageFilter !== "all" && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--sh-signal)", background: "color-mix(in srgb, var(--sh-signal) 7%, var(--sh-surface))", color: "var(--sh-text-primary)" }}><span>Showing {stageFilter === "choose" ? "plays to choose" : stageFilter === "approve" ? "tickets to approve or send" : "plays and reviews to monitor"}.</span><button type="button" className="min-h-11 shrink-0 font-semibold underline underline-offset-4" onClick={() => setStageFilter("all")}>Show all stages</button></div>}

    <section className="flex flex-col gap-2 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="instrument-filter-label" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
      <div><p id="instrument-filter-label" className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Instrument</p><p className="mt-0.5 text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>Filter applies to plays and scheduled order reviews. Thesis-only reviews remain under All.</p></div>
      <div className="flex flex-wrap gap-1" aria-label="Filter plays and reviews by instrument">{(["all", "shares", "calls", "puts"] as PlayFilter[]).map((filter) => <button key={filter} type="button" aria-pressed={playFilter === filter} onClick={() => setPlayFilter(filter)} className="min-h-11 min-w-11 rounded-full border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ borderColor: playFilter === filter ? "var(--sh-signal)" : "var(--sh-border-1)", background: playFilter === filter ? "color-mix(in srgb, var(--sh-signal) 10%, var(--sh-surface))" : "var(--sh-surface)", color: "var(--sh-text-primary)" }}>{filter === "all" ? "All" : filter === "shares" ? "Shares" : filter === "calls" ? "Calls" : "Puts"}</button>)}</div>
    </section>

    {isLoading ? <p role="status" className="py-4 text-sm" style={{ color: "var(--sh-fg-muted)" }}>Loading remaining records: {sources.filter(({ query }) => query.isLoading).map(({ label }) => label.toLowerCase()).join(", ")}. Available records remain below.</p> : null}
    {showQuiet ? <Card><CardContent className="py-8"><CheckCircle2 className="h-6 w-6" style={{ color: "var(--sh-emerald)" }} /><h2 className="mt-3 font-serif text-2xl">No new action identified in the available records.</h2><p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{briefing?.quietMessage} {briefing?.scopeNote} No new trade is required. Existing positions and portfolio risk are unchanged.</p></CardContent></Card> : null}

    {desk.data && showApprove && (orderActions.length > 0 || stageFilter === "approve") && <section id="play-desk-approve" className="scroll-mt-5 overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface)" }}>
      <SectionHead title="Ready for you" detail="The next click is approval or paper submission." count={visibleOrderActions.length} />
      <div className="divide-y" style={{ borderColor: "var(--sh-border-1)" }}>{visibleOrderActions.map((order) => {
        const state = deskOrderPresentation(order.id, briefing);
        return <DeskItem key={order.id} eyebrow={state.label} title={paperInstrumentDisplayLabel(order)} meta={`${isOptionInstrument(order.instrumentType) ? `Raw contract ${order.symbol} · ` : ""}${money(order.plannedRiskCents)} ${isOptionInstrument(order.instrumentType) ? "premium at risk" : "planned loss at the modeled stop (execution may differ)"} · ${order.accountLabel}. ${state.detail}`} action={state.action} primary onAction={() => state.href ? navigate(state.href) : refresh()} />;
      })}</div>
      {visibleOrderActions.length === 0 && <p className="px-4 py-6 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>No matching tickets in the returned records. Critical issues remain above all filters.</p>}
    </section>}

    {runs.data && showChoose && (decisionReady.length > 0 || stageFilter === "choose") && <section id="play-desk-choose" className="scroll-mt-5 overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <SectionHead title="Choose a play" detail="Research is complete enough to decide. Evidence is optional unless a named blocker remains." count={decisionReady.length} />
      <div className="divide-y" style={{ borderColor: "var(--sh-border-1)" }}>{decisionReady.map((journey) => {
        const deferred = deferredByRun.get(journey.latest.id);
        const candidateStates = journey.latest.candidateStates;
        const actionableCandidateId = journey.latest.actionableCandidateId ?? candidateStates?.actionableCandidateId;
        const actionableSymbol = journey.latest.actionableSymbol ?? candidateStates?.actionableSymbol;
        const destination = actionableCandidateId == null
          ? `/aperture/run/${journey.latest.id}`
          : `/aperture/run/${journey.latest.id}?candidate=${actionableCandidateId}`;
        return <DeskItem key={journey.rootId} eyebrow={deferred ? "Queued for next regular session" : "Ready to choose"} title={journey.thesisName} meta={`Run #${journey.latest.id} · ${deferred ? `Returns ${new Date(deferred.resumeAt!).toLocaleString()} · ${deferred.reason}` : `${journey.latest.candidateStates?.label ?? `${journey.evidenceCandidates} plays compared`} · ${formatDistanceToNow(Number(journey.latest.createdAt))} ago`}`} action={deferred ? "Review queue" : actionableSymbol ? `Review ${actionableSymbol}` : "Choose play"} primary={!deferred} onAction={() => navigate(deferred ? `/aperture/run/${journey.latest.id}` : destination)} />;
      })}</div>
      {decisionReady.length === 0 && <p className="px-4 py-6 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>No choice-ready play in the returned research records.</p>}
    </section>}

    {desk.data && showMonitor && (inMotionOrders.length > 0 || activePlays.length > 0 || stageFilter === "monitor") && <section id="play-desk-monitor" className="scroll-mt-5 space-y-3">
      <div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>In motion</p><h2 className="mt-1 font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}>Your plays</h2><p className="mt-1 text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>Queued orders and open positions are labeled separately.</p></div>
      {/* A dense decision table. The 2x2 card grid put five labelled stats and
          three sentences on every play; a scan should answer state, risk and
          next action in one line. Full receipts stay one click away. */}
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <thead><tr className="border-b text-left text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>
            <th scope="col" className="px-3 py-2">Play</th>
            <th scope="col" className="px-3 py-2">State</th>
            <th scope="col" className="px-3 py-2 text-right">Return</th>
            <th scope="col" className="px-3 py-2 text-right">Risk / filled</th>
            <th scope="col" className="px-3 py-2 text-right">Action</th>
          </tr></thead>
          <tbody>
            {visibleOrders.map((order) => {
              const state = deskOrderPresentation(order.id, briefing);
              const quantities = deskOrderQuantities(order);
              return <tr key={`order-${order.id}`} id={`order-${order.id}`} data-play-row className="border-b last:border-b-0" style={{ borderColor: "var(--sh-border-1)" }}>
                <th scope="row" className="px-3 py-2.5 text-left font-semibold" style={{ color: "var(--sh-text-primary)" }}><button
                  type="button"
                  data-inspect-order={order.id}
                  aria-haspopup="dialog"
                  aria-expanded={inspectOrderId === order.id}
                  className="min-h-11 text-left font-semibold underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => navigate(playDeskFilterHref(search, { inspect: order.id }))}
                >{paperInstrumentDisplayLabel(order)}<span className="sr-only"> — inspect receipts and thesis context</span></button></th>
                <td className="px-3 py-2.5"><span className="whitespace-nowrap text-xs font-semibold" style={{ color: "var(--sh-signal)" }}>{state.label}</span><span className="block text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>{state.detail}</span></td>
                <td data-play-return className="px-3 py-2.5 text-right tabular-nums align-top">{(() => {
                  const result = deskOrderReturn(order, Date.now());
                  if (!result.measured) return <><span className="text-xs font-semibold" style={{ color: "var(--sh-fg-muted)" }}>Not measured</span><span className="block text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>{result.reason}</span></>;
                  // The sign is carried by the +/− prefix, never by colour alone.
                  const tone = result.pnlCents > 0 ? "var(--sh-emerald)" : result.pnlCents < 0 ? "var(--sh-red)" : "var(--sh-text-primary)";
                  const percent = formatReturnPercent(result);
                  return <><span className="font-semibold" style={{ color: tone }}>{formatReturnAmount(result)}</span>{percent && <span className="block text-[11px] leading-4" style={{ color: tone }}>{percent}</span>}<span className="block text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>{formatMarkProvenance(result)}</span></>;
                })()}</td>
                <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{money(order.plannedRiskCents)}<span className="block text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>{isOptionInstrument(order.instrumentType) ? "Premium at risk" : "Planned loss at modeled stop"} · {quantities.ordered} ordered · {quantities.filled} filled · {quantities.remaining} remaining{!isOptionInstrument(order.instrumentType) ? " · Stop execution may differ from the modeled price." : ""}<span className="block">Human review: {(() => { const humanReview = deskHumanReview(order, pendingOutcomes); return humanReview ? new Date(humanReview.dueAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : outcomes.error || outcomes.data == null ? "Review status unavailable" : "No checkpoint recorded"; })()}</span></span></td>
                <td className="px-3 py-2.5 text-right"><Button size="sm" variant="outline" className="min-h-11 whitespace-nowrap" onClick={() => state.href ? navigate(state.href) : navigate(playDeskFilterHref(search, { inspect: order.id }))}>{state.href ? "Open" : "Inspect"}</Button></td>
              </tr>;
            })}
            {visibleActivePlays.map((play) => <tr key={`play-${play.id}`} data-play-row className="border-b last:border-b-0" style={{ borderColor: "var(--sh-border-1)" }}>
              <th scope="row" className="px-3 py-2.5 text-left font-semibold" style={{ color: "var(--sh-text-primary)" }}>{readableSymbol(play.symbol)}</th>
              <td className="px-3 py-2.5"><span className="whitespace-nowrap text-xs font-semibold" style={{ color: "var(--sh-signal)" }}>{briefing?.inMotion.find((item) => item.key === `play:${play.id}`)?.stateLabel ?? "Open position"}</span></td>
              <td className="px-3 py-2.5 text-right" style={{ color: "var(--sh-fg-muted)" }}>—</td>
              <td className="px-3 py-2.5 text-right" style={{ color: "var(--sh-fg-muted)" }}>—</td>
              <td className="px-3 py-2.5 text-right"><Button size="sm" variant="outline" className="min-h-11 whitespace-nowrap" onClick={() => navigate(playDeskFilterHref(search, { play: play.id }))}>Open</Button></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Return is unrealized, marked from the broker’s last reported price for the exact contract; the mark time and source are shown on every figure and nothing is estimated between syncs. Sync the account to take a current mark. A share stop is a modeled scenario; stop execution may differ from the modeled price and the loss can be greater.</p>
      {visibleOrders.length === 0 && visibleActivePlays.length === 0 && <p className="rounded-xl border px-4 py-6 text-center text-sm" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>No matching plays in the returned records.{selectedPlay && " The selected play remains open above."} Critical issues remain above all filters.</p>}
    </section>}

    {outcomes.data && showMonitor && pendingOutcomes.length > 0 && <section className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><SectionHead title="Scheduled reviews" detail="Recorded check-ins, not proof of automatic checks or exits." count={visiblePendingOutcomes.length} /><div className="divide-y" style={{ borderColor: "var(--sh-border-1)" }}>{visiblePendingOutcomes.map((item) => <DeskItem key={item.id} eyebrow={item.dueAt <= Date.now() ? "Review due" : "Upcoming review"} title={item.kind === "play_outcome" && item.orderSymbol ? `${readableSymbol(item.orderSymbol)} review` : item.gateLabel ?? item.thesisName ?? "Decision review"} meta={`Review ${new Date(item.dueAt).toLocaleString()}${item.orderSymbol && parseOccOptionSymbol(item.orderSymbol) ? ` · Raw contract ${item.orderSymbol}` : ""}`} action={item.kind === "play_outcome" ? "Review play" : "Review exact gate"} onAction={() => navigate(pendingOutcomeRoute(item))} />)}</div>{visiblePendingOutcomes.length === 0 && <p className="px-4 py-6 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>No matching reviews in the returned records. Thesis-only reviews remain under All; critical issues remain above.</p>}</section>}

    {stageFilter === "all" && researchBacklog.length > 0 && <details className="rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}><span>Show research backlog</span><Badge variant="outline">{researchBacklog.length}</Badge></summary>
      <div className="divide-y border-t" style={{ borderColor: "var(--sh-border-1)" }}>{researchBacklog.map((journey) => <DeskItem key={journey.rootId} eyebrow={journey.state === "paper_stage_declined" ? "Cash / no paper stage" : journey.latest.candidateStates?.expired ? "Expired setup" : "Research follow-up"} title={journey.thesisName} meta={`Run #${journey.latest.id} · ${journey.latest.candidateStates?.label ?? `${journey.evidenceCandidates} research candidate${journey.evidenceCandidates === 1 ? "" : "s"}`}`} action={journey.state === "paper_stage_declined" ? "View receipt" : journey.latest.candidateStates?.expired ? "Review expiry" : "Open research"} onAction={() => navigate(`/aperture/run/${journey.latest.id}?view=evidence`)} />)}</div>
    </details>}
    {(() => {
      // Inspection is read-only and URL-bound, so Back closes it and a reload
      // reopens the same ticket. An `inspect` id that is not in the returned
      // records leaves the drawer shut rather than opening an empty panel.
      const inspected = (desk.data?.orders ?? []).find((order) => order.id === inspectOrderId) ?? null;
      const humanReview = inspected ? deskHumanReview(inspected, pendingOutcomes) : null;
      return <PlayInspectionDrawer
        order={inspected as InspectableOrder | null}
        stateLabel={inspected ? deskOrderPresentation(inspected.id, briefing).label : ""}
        humanReviewAt={humanReview?.dueAt ?? null}
        reviewsUnavailable={Boolean(outcomes.error) || outcomes.data == null}
        onClose={() => navigate(playDeskFilterHref(search, { inspect: null }))}
        onOpenFull={(order) => navigate(deskOrderPresentation(order.id, briefing).href
          ?? `/aperture/run/${order.runId}/execute?candidate=${order.candidateId ?? ""}`)}
      />;
    })()}
  </div></DashboardLayout>;
}

export function deskOrderQuantities(order: { qty: number | null; filledQty: number | null }) {
  const measured = (value: number | null) => value != null && Number.isFinite(value) && value >= 0 ? value : null;
  const ordered = measured(order.qty);
  const filled = measured(order.filledQty);
  return {
    ordered: ordered == null ? "Not measured" : String(ordered),
    filled: filled == null ? "Not measured" : String(filled),
    remaining: ordered == null || filled == null || filled > ordered ? "Not measured" : String(ordered - filled),
  };
}

function AttentionTask({ item, prominent = false, compact = false, onOpen }: { item: ApertureAttentionItem; prominent?: boolean; compact?: boolean; onOpen: (href: string) => void }) {
  return <AttentionDecisionCard item={item} prominent={prominent} compact={compact} onOpen={onOpen} />;
}

/** Match the persisted order identity, never another position in the same ticker. */
export function deskHumanReview(order: { id: number; runId: number; candidateId: number | null; symbol: string }, reviews: ReadonlyArray<{ orderId?: number | null; orderRunId?: number | null; orderCandidateId?: number | null; orderSymbol?: string | null; kind: string; dueAt: number }>) {
  return reviews.filter(review => review.kind === "play_outcome" && Number.isFinite(review.dueAt) && (review.orderId != null
    ? review.orderId === order.id
    : review.orderRunId === order.runId && order.candidateId != null && review.orderCandidateId === order.candidateId && review.orderSymbol === order.symbol))
    .sort((a, b) => a.dueAt - b.dueAt)[0] ?? null;
}

function ActivePlayDetails({ play, state, compact = false }: { play: { id: number; symbol: string; instrumentType: string; accountLabel: string; thesisNote?: string | null; horizon?: string | null; asOf: number | null }; state?: string; compact?: boolean }) {
  return <div className="mt-3 min-w-0"><Badge variant="outline">{instrumentLabel(play.instrumentType)}</Badge><h3 className="mt-2 break-words font-serif text-xl">{readableSymbol(play.symbol)}</h3><p className="mt-2 text-sm font-semibold" style={{ color: "var(--sh-signal)" }}>{state ?? "Recorded context · status not verified"}</p><p className="mt-2 text-sm">{play.accountLabel}</p>{!compact && <p className="mt-3 whitespace-pre-line break-words text-sm leading-6">{play.thesisNote || "No thesis note recorded. Inspect the linked order or account record before taking action."}</p>}<p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{play.horizon ?? "No review horizon declared"} · Account context as of {play.asOf ? new Date(play.asOf).toLocaleString() : "not measured"}. Monitoring is not implied by this timestamp.</p>{isOptionInstrument(play.instrumentType) && <p className="mt-2 break-all font-mono text-xs" style={{ color: "var(--sh-fg-muted)" }}>Raw contract · {play.symbol}</p>}</div>;
}

function StageMetric({ label, value, detail, active, onSelect }: { label: string; value: number | null; detail: string; active: boolean; onSelect: () => void }) {
  return <button
    type="button"
    aria-pressed={active}
    onClick={onSelect}
    className="min-h-16 border-r px-3 py-3 text-left transition-colors last:border-r-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none sm:px-5"
    style={{ borderColor: "var(--sh-border-1)", background: active ? "color-mix(in srgb, var(--sh-signal) 10%, var(--sh-surface))" : undefined }}
  ><p className="text-xs font-semibold uppercase tracking-wide" style={{ color: active ? "var(--sh-signal)" : "var(--sh-fg-muted)" }}>{label}</p><div className="mt-1 flex items-baseline gap-2"><p className="font-mono text-2xl tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{value ?? "—"}</p><p className="hidden text-xs sm:block" style={{ color: "var(--sh-fg-muted)" }}>{detail}</p></div></button>;
}

function SmallValue({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-xs font-semibold" style={{ color: "var(--sh-fg-muted)" }}>{label}</p><p className="mt-1 break-words font-mono text-sm font-semibold tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{value}</p></div>;
}

function SectionHead({ title, detail, count }: { title: string; detail: string; count: number }) {
  return <header className="flex items-start justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><div><h2 className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{title}</h2><p className="mt-0.5 text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>{detail}</p></div><Badge variant="outline" className="tabular-nums">{count}</Badge></header>;
}

function DeskItem({ eyebrow, title, meta, action, primary = false, onAction }: { eyebrow: string; title: string; meta: string; action: string; primary?: boolean; onAction: () => void }) {
  return <article className="px-4 py-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--sh-signal)" }}>{eyebrow}</p><h3 className="mt-0.5 text-base font-semibold" style={{ color: "var(--sh-text-primary)" }}>{title}</h3><p className="mt-1 break-words text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{meta}</p></div><Button size="sm" variant={primary ? "default" : "outline"} className="min-h-11 shrink-0 whitespace-normal" onClick={onAction}>{action}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></div></article>;
}
