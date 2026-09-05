import { useState } from "react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { buildResearchJourneys } from "@shared/runWorkspace";
import { playDeskJourneyLane } from "@shared/playDeskState";
import { isOptionInstrument, paperInstrumentDisplayLabel, parseOccOptionSymbol } from "@shared/paperInstrument";

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

const orderState = (order: { status: string; brokerOrderId?: string | null; dispatchError?: string | null }) => order.status === "submitted" && !order.brokerOrderId
  ? { label: "Dispatch unresolved", action: "Reconcile paper dispatch" }
  : ({
    pending_approval: { label: "Review needed", action: "Review & approve" },
    approved: { label: "Ready to send", action: "Submit / queue" },
    submitted: { label: "Queued at paper broker", action: "View queued order" },
    filled: { label: "Position open", action: "Monitor position" },
    rejected: { label: "Rejected", action: "View decision" },
    cancelled: { label: "Cancelled", action: "View decision" },
  })[order.status] ?? { label: order.status, action: "Open play" };

type PlayFilter = "all" | "shares" | "calls" | "puts";
type StageFilter = "all" | "choose" | "approve" | "monitor";

export default function AperturePlayDesk() {
  const [, navigate] = useLocation();
  const [playFilter, setPlayFilter] = useState<PlayFilter>("all");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const desk = trpc.aperture.desk.summary.useQuery();
  const runs = trpc.aperture.run.list.useQuery();
  const playList = trpc.aperture.play.list.useQuery();
  const outcomes = trpc.aperture.runway.pending.useQuery();
  const journeys = buildResearchJourneys((runs.data ?? []) as any[]);
  const researchActions = journeys.filter((journey) => ["needs_attention", "paper_stage_declined", "ready_to_review", "more_research_available"].includes(journey.state));
  const deferredByRun = new Map((playList.data?.plays ?? [])
    .filter((play) => play.decision?.decision === "deferred" && play.decision.resumeAt != null && play.decision.resumeAt > Date.now())
    .map((play) => [play.run.id, play.decision!] as const));
  const orderActions = (desk.data?.orders ?? []).filter((order) => ["pending_approval", "approved"].includes(order.status));
  const inMotionOrders = (desk.data?.orders ?? []).filter((order) => order.status === "submitted" || (order.status === "filled" && order.intent !== "close"));
  const activePlays = (desk.data?.activePlays ?? []).filter((play) => !inMotionOrders.some((order) => order.accountId === play.accountId && order.symbol === play.symbol));
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

  const selectStage = (stage: Exclude<StageFilter, "all">) => {
    const next = stageFilter === stage ? "all" : stage;
    setStageFilter(next);
    if (next !== "all") window.requestAnimationFrame(() => document.getElementById(`play-desk-${next}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const refresh = () => Promise.all([desk.refetch(), runs.refetch(), playList.refetch(), outcomes.refetch()]);

  return <DashboardLayout><div className="mx-auto max-w-6xl space-y-5 pb-12">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>Capital Aperture · Play Desk</p>
        <h1 className="mt-1 font-serif text-3xl" style={{ color: "var(--sh-text-primary)" }}>Make the next decision.</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>Choose a play, move a paper ticket, or monitor what is already in motion.</p>
      </div>
      <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
    </header>

    <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", borderColor: "var(--sh-border-1)" }}>
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} />Review, approval, and submission remain separate human actions.
    </div>

    <section className="grid grid-cols-3 overflow-hidden rounded-xl border" aria-label="Filter by workflow stage" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <StageMetric label="Choose" value={decisionReady.length} detail="plays to decide" active={stageFilter === "choose"} onSelect={() => selectStage("choose")} />
      <StageMetric label="Approve / send" value={visibleOrderActions.length} detail="tickets to move" active={stageFilter === "approve"} onSelect={() => selectStage("approve")} />
      <StageMetric label="Monitor" value={visibleOrders.length + visibleActivePlays.length} detail={`${visiblePendingOutcomes.length} reviews due`} active={stageFilter === "monitor"} onSelect={() => selectStage("monitor")} />
    </section>

    {stageFilter !== "all" && <div role="status" className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--sh-signal)", background: "color-mix(in srgb, var(--sh-signal) 7%, var(--sh-surface))", color: "var(--sh-text-primary)" }}><span>Showing {stageFilter === "choose" ? "plays to choose" : stageFilter === "approve" ? "tickets to approve or send" : "plays and reviews to monitor"}.</span><button type="button" className="min-h-9 shrink-0 font-semibold underline underline-offset-4" onClick={() => setStageFilter("all")}>Show all stages</button></div>}

    <section className="flex flex-col gap-2 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="instrument-filter-label" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
      <div><p id="instrument-filter-label" className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Instrument</p><p className="mt-0.5 text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>Filter applies to plays and scheduled order reviews. Thesis-only reviews remain under All.</p></div>
      <div className="flex flex-wrap gap-1" aria-label="Filter plays and reviews by instrument">{(["all", "shares", "calls", "puts"] as PlayFilter[]).map((filter) => <button key={filter} type="button" aria-pressed={playFilter === filter} onClick={() => setPlayFilter(filter)} className="min-h-9 rounded-full border px-3 text-xs font-medium" style={{ borderColor: playFilter === filter ? "var(--sh-signal)" : "var(--sh-border-1)", background: playFilter === filter ? "color-mix(in srgb, var(--sh-signal) 10%, var(--sh-surface))" : "var(--sh-surface)", color: "var(--sh-text-primary)" }}>{filter === "all" ? "All" : filter === "shares" ? "Shares" : filter === "calls" ? "Calls" : "Puts"}</button>)}</div>
    </section>

    {isLoading ? <p className="py-12 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Loading your plays…</p> : null}
    {!isLoading && count === 0 ? <Card><CardContent className="py-12 text-center"><CheckCircle2 className="mx-auto h-7 w-7" style={{ color: "var(--sh-emerald)" }} /><h2 className="mt-3 font-serif text-2xl">You are clear.</h2><p className="mt-2 text-sm" style={{ color: "var(--sh-fg-muted)" }}>No play needs a decision right now.</p><Button className="mt-4" onClick={() => navigate("/thesis")}>Start a thesis <ArrowRight className="ml-2 h-4 w-4" /></Button></CardContent></Card> : null}

    {!isLoading && showApprove && (orderActions.length > 0 || stageFilter === "approve") && <section id="play-desk-approve" className="scroll-mt-5 overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface)" }}>
      <SectionHead title="Ready for you" detail="The next click is approval or paper submission." count={visibleOrderActions.length} />
      <div className="divide-y" style={{ borderColor: "var(--sh-border-1)" }}>{visibleOrderActions.map((order) => {
        const state = orderState(order);
        return <DeskItem key={order.id} eyebrow={state.label} title={paperInstrumentDisplayLabel(order)} meta={`${isOptionInstrument(order.instrumentType) ? `Raw contract ${order.symbol} · ` : ""}${money(order.plannedRiskCents)} max loss · ${order.accountLabel}`} action={state.action} primary onAction={() => navigate(`/aperture/run/${order.runId}/execute?candidate=${order.candidateId ?? ""}`)} />;
      })}</div>
      {visibleOrderActions.length === 0 && <p className="px-4 py-6 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>No {playFilter === "all" ? "" : `${playFilter} `}tickets need approval or submission.</p>}
    </section>}

    {!isLoading && showChoose && (decisionReady.length > 0 || stageFilter === "choose") && <section id="play-desk-choose" className="scroll-mt-5 overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <SectionHead title="Choose a play" detail="Research is complete enough to decide. Evidence is optional unless a named blocker remains." count={decisionReady.length} />
      <div className="divide-y" style={{ borderColor: "var(--sh-border-1)" }}>{decisionReady.map((journey) => {
        const deferred = deferredByRun.get(journey.latest.id);
        const candidateStates = journey.latest.candidateStates;
        const actionableCandidateId = journey.latest.actionableCandidateId ?? candidateStates?.actionableCandidateId;
        const actionableSymbol = journey.latest.actionableSymbol ?? candidateStates?.actionableSymbol;
        const destination = actionableCandidateId == null
          ? `/aperture/run/${journey.latest.id}`
          : `/aperture/run/${journey.latest.id}?candidate=${actionableCandidateId}`;
        return <DeskItem key={journey.rootId} eyebrow={deferred ? "Queued for next regular session" : "Ready to choose"} title={journey.thesisName} meta={deferred ? `Returns ${new Date(deferred.resumeAt!).toLocaleString()} · ${deferred.reason}` : `${journey.latest.candidateStates?.label ?? `${journey.evidenceCandidates} plays compared`} · ${formatDistanceToNow(Number(journey.latest.createdAt))} ago`} action={deferred ? "Review queue" : actionableSymbol ? `Review ${actionableSymbol}` : "Choose play"} primary={!deferred} onAction={() => navigate(deferred ? `/aperture/run/${journey.latest.id}` : destination)} />;
      })}</div>
      {decisionReady.length === 0 && <p className="px-4 py-6 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>No researched play is waiting for a choice.</p>}
    </section>}

    {!isLoading && showMonitor && (inMotionOrders.length > 0 || activePlays.length > 0 || stageFilter === "monitor") && <section id="play-desk-monitor" className="scroll-mt-5 space-y-3">
      <div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>In motion</p><h2 className="mt-1 font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}>Your plays</h2><p className="mt-1 text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>Queued orders and open positions are labeled separately.</p></div>
      <div className="grid gap-3 md:grid-cols-2">{visibleOrders.map((order) => {
        const state = orderState(order);
        return <article key={`order-${order.id}`} className="min-w-0 rounded-xl border p-4" style={{ borderColor: order.status === "filled" ? "color-mix(in srgb, var(--sh-emerald) 45%, var(--sh-border-1))" : "color-mix(in srgb, var(--sh-signal) 45%, var(--sh-border-1))", background: "var(--sh-surface)" }}>
          <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><Badge variant="outline">{instrumentLabel(order.instrumentType)}</Badge><h3 className="mt-2 break-words font-serif text-lg font-semibold" style={{ color: "var(--sh-text-primary)" }}>{paperInstrumentDisplayLabel(order)}</h3>{isOptionInstrument(order.instrumentType) && <p className="mt-1 break-all font-mono text-[10px]" style={{ color: "var(--sh-fg-muted)" }}>Raw contract · {order.symbol}</p>}</div><span className="max-w-[10rem] shrink-0 text-right text-xs font-semibold leading-4" style={{ color: order.status === "filled" ? "var(--sh-emerald)" : "var(--sh-signal)" }}>{state.label}</span></div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-y py-3" style={{ borderColor: "var(--sh-border-1)" }}><SmallValue label="Quantity" value={order.qty == null ? "—" : String(order.qty)} /><SmallValue label="Max loss" value={money(order.plannedRiskCents)} /><SmallValue label="Review" value={order.timeStopAt ? new Date(order.timeStopAt).toLocaleDateString([], { month: "short", day: "numeric" }) : "Open"} /></div>
          <div className="mt-3 flex items-center justify-between gap-3"><p className="truncate text-xs" style={{ color: "var(--sh-fg-muted)" }}>{order.thesisName ?? order.accountLabel}</p><Button size="sm" variant="outline" onClick={() => navigate(`/aperture/run/${order.runId}/execute?candidate=${order.candidateId ?? ""}${order.status === "filled" ? "&lifecycle=monitoring" : ""}`)}>{state.action}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></div>
        </article>;
      })}{visibleActivePlays.map((play) => <article key={`play-${play.id}`} className="min-w-0 rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 45%, var(--sh-border-1))", background: "var(--sh-surface)" }}><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><Badge variant="outline">{instrumentLabel(play.instrumentType)}</Badge><h3 className="mt-2 break-words font-serif text-lg font-semibold">{readableSymbol(play.symbol)}</h3>{isOptionInstrument(play.instrumentType) && <p className="mt-1 break-all font-mono text-[10px]" style={{ color: "var(--sh-fg-muted)" }}>Raw contract · {play.symbol}</p>}</div><span className="shrink-0 text-xs font-semibold" style={{ color: "var(--sh-signal)" }}>{play.status === "watching" ? "Watching" : "Portfolio position"}</span></div><p className="mt-4 text-xs" style={{ color: "var(--sh-fg-muted)" }}>{play.horizon ?? "No review horizon declared"}</p><Button size="sm" variant="outline" className="mt-3" onClick={() => navigate("/aperture/accounts")}>{play.status === "watching" ? "Review watch" : "View portfolio position"}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></article>)}</div>
      {visibleOrders.length === 0 && visibleActivePlays.length === 0 && <p className="rounded-xl border px-4 py-6 text-center text-sm" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>No {playFilter} plays are in motion.</p>}
    </section>}

    {!isLoading && showMonitor && pendingOutcomes.length > 0 && <section className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><SectionHead title="Reviews due" detail="Scheduled check-ins, not automatic exits." count={visiblePendingOutcomes.length} /><div className="divide-y" style={{ borderColor: "var(--sh-border-1)" }}>{visiblePendingOutcomes.slice(0, 3).map((item) => <DeskItem key={item.id} eyebrow={item.kind === "gate_review" ? "Gate review" : "Outcome due"} title={item.kind === "play_outcome" && item.orderSymbol ? `${readableSymbol(item.orderSymbol)} review` : item.gateLabel ?? item.thesisName ?? "Decision review"} meta={`${item.orderStatus ? `${item.orderStatus.replaceAll("_", " ")} · ` : ""}Due ${new Date(item.dueAt).toLocaleString()}${item.orderSymbol && parseOccOptionSymbol(item.orderSymbol) ? ` · Raw contract ${item.orderSymbol}` : ""}`} action={item.kind === "play_outcome" ? "Review play" : "Open"} onAction={() => navigate(pendingOutcomeRoute(item))} />)}</div>{visiblePendingOutcomes.length === 0 && <p className="px-4 py-6 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>No {playFilter} reviews are due. Thesis-only reviews are visible under All.</p>}</section>}

    {!isLoading && stageFilter === "all" && researchBacklog.length > 0 && <details className="rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}><span>Show research backlog</span><Badge variant="outline">{researchBacklog.length}</Badge></summary>
      <div className="divide-y border-t" style={{ borderColor: "var(--sh-border-1)" }}>{researchBacklog.map((journey) => <DeskItem key={journey.rootId} eyebrow={journey.state === "paper_stage_declined" ? "Cash / no paper stage" : journey.latest.candidateStates?.expired ? "Expired setup" : "Research follow-up"} title={journey.thesisName} meta={journey.latest.candidateStates?.label ?? `${journey.evidenceCandidates} research candidate${journey.evidenceCandidates === 1 ? "" : "s"}`} action={journey.state === "paper_stage_declined" ? "View receipt" : journey.latest.candidateStates?.expired ? "Review expiry" : "Open research"} onAction={() => navigate(`/aperture/run/${journey.latest.id}?view=evidence`)} />)}</div>
    </details>}
  </div></DashboardLayout>;
}

function StageMetric({ label, value, detail, active, onSelect }: { label: string; value: number; detail: string; active: boolean; onSelect: () => void }) {
  return <button
    type="button"
    aria-pressed={active}
    onClick={onSelect}
    className="min-h-16 border-r px-3 py-3 text-left transition-colors last:border-r-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none sm:px-5"
    style={{ borderColor: "var(--sh-border-1)", background: active ? "color-mix(in srgb, var(--sh-signal) 10%, var(--sh-surface))" : undefined }}
  ><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: active ? "var(--sh-signal)" : "var(--sh-fg-muted)" }}>{label}</p><div className="mt-1 flex items-baseline gap-2"><p className="font-mono text-2xl tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{value}</p><p className="hidden text-[11px] sm:block" style={{ color: "var(--sh-fg-muted)" }}>{detail}</p></div></button>;
}

function SmallValue({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>{label}</p><p className="mt-1 truncate font-mono text-sm font-semibold tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{value}</p></div>;
}

function SectionHead({ title, detail, count }: { title: string; detail: string; count: number }) {
  return <header className="flex items-start justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><div><h2 className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{title}</h2><p className="mt-0.5 text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>{detail}</p></div><Badge variant="outline" className="tabular-nums">{count}</Badge></header>;
}

function DeskItem({ eyebrow, title, meta, action, primary = false, onAction }: { eyebrow: string; title: string; meta: string; action: string; primary?: boolean; onAction: () => void }) {
  return <article className="px-4 py-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>{eyebrow}</p><h3 className="mt-0.5 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{title}</h3><p className="mt-0.5 truncate text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>{meta}</p></div><Button size="sm" variant={primary ? "default" : "outline"} className="min-h-10 shrink-0" onClick={onAction}>{action}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></div></article>;
}
