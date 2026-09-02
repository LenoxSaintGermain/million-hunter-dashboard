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

const money = (cents?: number | null) => cents == null
  ? "—"
  : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

const instrumentLabel = (instrumentType: string) => instrumentType === "long_call" ? "Call" : instrumentType === "long_put" ? "Put" : "Shares";
const instrumentFilter = (instrumentType: string) => instrumentType === "long_call" ? "calls" : instrumentType === "long_put" ? "puts" : "shares";

const orderState = (order: { status: string; brokerOrderId?: string | null; dispatchError?: string | null }) => order.status === "submitted" && !order.brokerOrderId
  ? { label: "Dispatch unresolved", action: "Reconcile paper dispatch" }
  : ({
    pending_approval: { label: "Review needed", action: "Review & approve" },
    approved: { label: "Ready to send", action: "Submit / queue" },
    submitted: { label: "Accepted / queued at paper broker", action: "View order" },
    filled: { label: "In motion", action: "Monitor" },
    rejected: { label: "Rejected", action: "View decision" },
    cancelled: { label: "Cancelled", action: "View decision" },
  })[order.status] ?? { label: order.status, action: "Open play" };

type PlayFilter = "all" | "shares" | "calls" | "puts";

export default function AperturePlayDesk() {
  const [, navigate] = useLocation();
  const [playFilter, setPlayFilter] = useState<PlayFilter>("all");
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
  const decisionReady = researchActions.filter((journey) => journey.state === "ready_to_review" || deferredByRun.has(journey.latest.id));
  const researchBacklog = researchActions.filter((journey) => !decisionReady.includes(journey));
  const count = researchActions.length + orderActions.length + inMotionOrders.length + activePlays.length + pendingOutcomes.length;
  const visibleOrders = inMotionOrders.filter((order) => playFilter === "all" || instrumentFilter(order.instrumentType) === playFilter);
  const visibleActivePlays = activePlays.filter((play) => playFilter === "all" || instrumentFilter(play.instrumentType) === playFilter);

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

    <section className="grid grid-cols-3 overflow-hidden rounded-xl border" aria-label="Paper play progress" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <StageMetric label="Choose" value={decisionReady.length} detail="plays to decide" />
      <StageMetric label="Approve / send" value={orderActions.length} detail="paper tickets" />
      <StageMetric label="Monitor" value={inMotionOrders.length + activePlays.length} detail="plays in motion" />
    </section>

    {isLoading ? <p className="py-12 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Loading your plays…</p> : null}
    {!isLoading && count === 0 ? <Card><CardContent className="py-12 text-center"><CheckCircle2 className="mx-auto h-7 w-7" style={{ color: "var(--sh-emerald)" }} /><h2 className="mt-3 font-serif text-2xl">You are clear.</h2><p className="mt-2 text-sm" style={{ color: "var(--sh-fg-muted)" }}>No play needs a decision right now.</p><Button className="mt-4" onClick={() => navigate("/thesis")}>Start a thesis <ArrowRight className="ml-2 h-4 w-4" /></Button></CardContent></Card> : null}

    {!isLoading && orderActions.length > 0 && <section className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface)" }}>
      <SectionHead title="Ready for you" detail="The next click is approval or paper submission." count={orderActions.length} />
      <div className="divide-y" style={{ borderColor: "var(--sh-border-1)" }}>{orderActions.map((order) => {
        const state = orderState(order);
        return <DeskItem key={order.id} eyebrow={state.label} title={`${order.symbol} · ${instrumentLabel(order.instrumentType)}`} meta={`${money(order.plannedRiskCents)} max loss · ${order.accountLabel}`} action={state.action} primary onAction={() => navigate(`/aperture/run/${order.runId}/execute?candidate=${order.candidateId ?? ""}`)} />;
      })}</div>
    </section>}

    {!isLoading && decisionReady.length > 0 && <section className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <SectionHead title="Choose a play" detail="Research is complete enough to decide. Evidence is optional unless a named blocker remains." count={decisionReady.length} />
      <div className="divide-y" style={{ borderColor: "var(--sh-border-1)" }}>{decisionReady.slice(0, 4).map((journey) => {
        const deferred = deferredByRun.get(journey.latest.id);
        return <DeskItem key={journey.rootId} eyebrow={deferred ? "Queued for next regular session" : "Ready to choose"} title={journey.thesisName} meta={deferred ? `Returns ${new Date(deferred.resumeAt!).toLocaleString()} · ${deferred.reason}` : `${journey.evidenceCandidates} play${journey.evidenceCandidates === 1 ? "" : "s"} compared · ${formatDistanceToNow(Number(journey.latest.createdAt))} ago`} action={deferred ? "Review queue" : "Choose play"} primary={!deferred} onAction={() => navigate(`/aperture/run/${journey.latest.id}`)} />;
      })}</div>
    </section>}

    {!isLoading && (inMotionOrders.length > 0 || activePlays.length > 0) && <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>In motion</p><h2 className="mt-1 font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}>Your paper plays</h2></div>
        <div className="flex flex-wrap gap-1" aria-label="Filter plays by type">{(["all", "shares", "calls", "puts"] as PlayFilter[]).map((filter) => <button key={filter} type="button" aria-pressed={playFilter === filter} onClick={() => setPlayFilter(filter)} className="min-h-9 rounded-full border px-3 text-xs font-medium" style={{ borderColor: playFilter === filter ? "var(--sh-signal)" : "var(--sh-border-1)", background: playFilter === filter ? "color-mix(in srgb, var(--sh-signal) 10%, var(--sh-surface))" : "var(--sh-surface)", color: "var(--sh-text-primary)" }}>{filter === "all" ? "All" : filter === "shares" ? "Shares" : filter === "calls" ? "Calls" : "Puts"}</button>)}</div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">{visibleOrders.map((order) => {
        const state = orderState(order);
        return <article key={`order-${order.id}`} className="rounded-xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
          <div className="flex items-start justify-between gap-3"><div><Badge variant="outline">{instrumentLabel(order.instrumentType)}</Badge><h3 className="mt-2 font-mono text-xl font-semibold tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{order.symbol}</h3></div><span className="text-xs font-medium" style={{ color: "var(--sh-emerald)" }}>{state.label}</span></div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-y py-3" style={{ borderColor: "var(--sh-border-1)" }}><SmallValue label="Quantity" value={order.qty == null ? "—" : String(order.qty)} /><SmallValue label="Max loss" value={money(order.plannedRiskCents)} /><SmallValue label="Review" value={order.timeStopAt ? new Date(order.timeStopAt).toLocaleDateString([], { month: "short", day: "numeric" }) : "Open"} /></div>
          <div className="mt-3 flex items-center justify-between gap-3"><p className="truncate text-xs" style={{ color: "var(--sh-fg-muted)" }}>{order.thesisName ?? order.accountLabel}</p><Button size="sm" variant="outline" onClick={() => navigate(`/aperture/run/${order.runId}/execute?candidate=${order.candidateId ?? ""}`)}>{state.action}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></div>
        </article>;
      })}{visibleActivePlays.map((play) => <article key={`play-${play.id}`} className="rounded-xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><div className="flex items-start justify-between gap-3"><div><Badge variant="outline">{instrumentLabel(play.instrumentType)}</Badge><h3 className="mt-2 font-mono text-xl font-semibold tabular-nums">{play.symbol}</h3></div><span className="text-xs font-medium" style={{ color: "var(--sh-signal)" }}>{play.status === "watching" ? "Watching" : "Active"}</span></div><p className="mt-4 text-xs" style={{ color: "var(--sh-fg-muted)" }}>{play.horizon ?? "No review horizon declared"}</p><Button size="sm" variant="outline" className="mt-3" onClick={() => navigate("/aperture/accounts")}>Open portfolio<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></article>)}</div>
      {visibleOrders.length === 0 && visibleActivePlays.length === 0 && <p className="rounded-xl border px-4 py-6 text-center text-sm" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>No {playFilter} plays are in motion.</p>}
    </section>}

    {!isLoading && pendingOutcomes.length > 0 && <section className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><SectionHead title="Reviews due" detail="Scheduled check-ins, not automatic exits." count={pendingOutcomes.length} /><div className="divide-y" style={{ borderColor: "var(--sh-border-1)" }}>{pendingOutcomes.slice(0, 3).map((item) => <DeskItem key={item.id} eyebrow={item.kind === "gate_review" ? "Gate review" : "Outcome due"} title={item.gateLabel ?? item.thesisName ?? "Decision review"} meta={`Due ${new Date(item.dueAt).toLocaleString()}`} action="Open" onAction={() => navigate(`/aperture/decision/${item.decisionRunId}/revision/${item.revisionId}`)} />)}</div></section>}

    {!isLoading && researchBacklog.length > 0 && <details className="rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}><span>Show research backlog</span><Badge variant="outline">{researchBacklog.length}</Badge></summary>
      <div className="divide-y border-t" style={{ borderColor: "var(--sh-border-1)" }}>{researchBacklog.map((journey) => <DeskItem key={journey.rootId} eyebrow={journey.state === "paper_stage_declined" ? "Cash / no paper stage" : "Research follow-up"} title={journey.thesisName} meta={`${journey.evidenceCandidates} research candidate${journey.evidenceCandidates === 1 ? "" : "s"}`} action={journey.state === "paper_stage_declined" ? "View receipt" : "Open research"} onAction={() => navigate(`/aperture/run/${journey.latest.id}?view=evidence`)} />)}</div>
    </details>}
  </div></DashboardLayout>;
}

function StageMetric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="border-r px-3 py-3 last:border-r-0 sm:px-5" style={{ borderColor: "var(--sh-border-1)" }}><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>{label}</p><div className="mt-1 flex items-baseline gap-2"><p className="font-mono text-2xl tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{value}</p><p className="hidden text-[11px] sm:block" style={{ color: "var(--sh-fg-muted)" }}>{detail}</p></div></div>;
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
