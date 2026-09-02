import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, CalendarClock, CheckCircle2, CircleDashed, Eye, FileSearch, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { buildResearchJourneys } from "@shared/runWorkspace";

const money = (cents?: number | null) => cents == null
  ? "—"
  : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

const orderState = (order: { status: string; brokerOrderId?: string | null; dispatchError?: string | null }) => order.status === "submitted" && !order.brokerOrderId
  ? { label: "Dispatch unresolved", action: "Reconcile paper dispatch" }
  : ({
  pending_approval: { label: "Awaiting review", action: "Review paper ticket" },
  approved: { label: "Ready to submit or queue", action: "Submit / queue paper order" },
  submitted: { label: "Accepted / queued at paper broker", action: "Check broker status" },
  filled: { label: "In motion", action: "Monitor play" },
  rejected: { label: "Rejected", action: "Review decision" },
  cancelled: { label: "Cancelled", action: "Review decision" },
})[order.status] ?? { label: order.status, action: "Open play" };

export default function AperturePlayDesk() {
  const [, navigate] = useLocation();
  const desk = trpc.aperture.desk.summary.useQuery();
  const runs = trpc.aperture.run.list.useQuery();
  const outcomes = trpc.aperture.runway.pending.useQuery();
  const journeys = buildResearchJourneys((runs.data ?? []) as any[]);
  const researchActions = journeys.filter((journey) => ["needs_attention", "paper_stage_declined", "ready_to_review", "more_research_available"].includes(journey.state));
  const orderActions = (desk.data?.orders ?? []).filter((order) => ["pending_approval", "approved"].includes(order.status));
  const inMotionOrders = (desk.data?.orders ?? []).filter((order) => order.status === "submitted" || (order.status === "filled" && order.intent !== "close"));
  const activePlays = (desk.data?.activePlays ?? []).filter((play) => !inMotionOrders.some((order) => order.accountId === play.accountId && order.symbol === play.symbol));
  const pendingOutcomes = outcomes.data ?? [];
  const isLoading = desk.isLoading || runs.isLoading || outcomes.isLoading;
  const count = researchActions.length + orderActions.length + inMotionOrders.length + activePlays.length + pendingOutcomes.length;

  const refresh = () => Promise.all([desk.refetch(), runs.refetch(), outcomes.refetch()]);

  return <DashboardLayout><div className="mx-auto max-w-6xl space-y-6 pb-12">
    <div className="flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium" style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", borderColor: "var(--sh-border-1)" }}>
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} />Paper research only. Review, approval, and submission remain separate human actions.
    </div>
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>Capital Aperture · Play Desk</p>
        <h1 className="mt-1 font-serif text-3xl" style={{ color: "var(--sh-text-primary)" }}>What needs you next.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>One cross-run view for evidence, paper tickets, plays in motion, and outcomes due. Each item exposes one next action.</p>
      </div>
      <Button variant="outline" onClick={refresh} disabled={isLoading}><RefreshCw className="mr-2 h-4 w-4" />Refresh desk</Button>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <DeskMetric label="Research" value={researchActions.length} detail="needs evidence or review" />
      <DeskMetric label="Paper tickets" value={orderActions.length} detail="waiting on you" />
      <DeskMetric label="In motion" value={inMotionOrders.length + activePlays.length} detail="paper or mirrored plays" />
      <DeskMetric label="Outcomes" value={pendingOutcomes.length} detail="scheduled look-backs" />
      <DeskMetric label="Total" value={count} detail="visible desk items" />
    </section>

    {isLoading ? <p className="py-12 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Assembling your Play Desk…</p> : null}
    {!isLoading && count === 0 ? <Card><CardContent className="py-14 text-center"><CheckCircle2 className="mx-auto h-7 w-7" style={{ color: "oklch(0.52 0.15 145)" }} /><h2 className="mt-3 font-serif text-2xl">Nothing needs attention.</h2><p className="mt-2 text-sm" style={{ color: "var(--sh-fg-muted)" }}>Start with a thesis when you are ready to open a new paper research journey.</p><Button className="mt-4" onClick={() => navigate("/thesis")}>Start from a thesis <ArrowRight className="ml-2 h-4 w-4" /></Button></CardContent></Card> : null}

    {!isLoading && count > 0 ? <div className="grid gap-5 lg:grid-cols-2">
      <DeskLane icon={<FileSearch className="h-4 w-4" />} title="Research & evidence" detail="Resolve gaps before a proposal can exist." count={researchActions.length}>
        {researchActions.map((journey) => <DeskItem key={journey.rootId} eyebrow={journey.state === "ready_to_review" ? "Decision ready" : journey.state === "paper_stage_declined" ? "Cash / no paper stage" : "Research follow-up"} title={journey.thesisName} meta={`${journey.evidenceCandidates} candidates · updated ${formatDistanceToNow(Number(journey.latest.createdAt))} ago`} action={journey.state === "ready_to_review" ? "Review lead" : journey.state === "paper_stage_declined" ? "Review receipt" : "Open journey"} onAction={() => navigate(`/aperture/run/${journey.latest.id}?view=evidence`)} />)}
      </DeskLane>

      <DeskLane icon={<WalletCards className="h-4 w-4" />} title="Paper tickets" detail="Approval and submission are separate checkpoints." count={orderActions.length}>
        {orderActions.map((order) => { const state = orderState(order); return <DeskItem key={order.id} eyebrow={state.label} title={`${order.symbol} · ${order.instrumentType.replaceAll("_", " ")}`} meta={`${order.thesisName ?? "Bound thesis"} · ${money(order.plannedRiskCents)} max planned loss · ${order.accountLabel}`} action={state.action} onAction={() => navigate(`/aperture/run/${order.runId}/execute?candidate=${order.candidateId ?? ""}`)} />; })}
      </DeskLane>

      <DeskLane icon={<Eye className="h-4 w-4" />} title="In motion" detail="Monitor verified state; nothing exits automatically." count={inMotionOrders.length + activePlays.length}>
        {inMotionOrders.map((order) => { const state = orderState(order); return <DeskItem key={`order-${order.id}`} eyebrow={state.label} title={`${order.symbol} · ${order.instrumentType.replaceAll("_", " ")}`} meta={`${order.thesisName ?? "Bound thesis"} · ${order.accountLabel}${order.dispatchError ? ` · dispatch note: ${order.dispatchError}` : ""}${order.timeStopAt ? ` · time review ${new Date(order.timeStopAt).toLocaleString()}` : ""}`} action={state.action} onAction={() => navigate(`/aperture/run/${order.runId}/execute?candidate=${order.candidateId ?? ""}`)} />; })}
        {activePlays.map((play) => <DeskItem key={`play-${play.id}`} eyebrow={play.status === "watching" ? "Watching" : "Operator-recorded play"} title={`${play.symbol} · ${play.instrumentType.replaceAll("_", " ")}`} meta={`${play.accountLabel} · ${play.horizon ?? "No horizon declared"} · as of ${new Date(play.asOf).toLocaleString()}`} action="Open portfolio" onAction={() => navigate("/aperture/accounts")} />)}
      </DeskLane>

      <DeskLane icon={<CalendarClock className="h-4 w-4" />} title="Outcome & gate reviews" detail="Close the learning loop at the declared horizon." count={pendingOutcomes.length}>
        {pendingOutcomes.map((item) => <DeskItem key={item.id} eyebrow={item.kind === "gate_review" ? "Gate review" : "Outcome due"} title={item.gateLabel ?? item.thesisName ?? "Decision review"} meta={`${item.thesisName ?? "Assigned thesis"} · due ${new Date(item.dueAt).toLocaleString()} · revision v${item.revisionVersion}`} action="Open decision" onAction={() => navigate(`/aperture/decision/${item.decisionRunId}/revision/${item.revisionId}`)} />)}
      </DeskLane>
    </div> : null}

    {!isLoading && researchActions.length === 0 && orderActions.length === 0 && count > 0 ? <div className="flex items-center gap-2 rounded-xl border px-4 py-3 text-xs" style={{ color: "var(--sh-fg-muted)", borderColor: "var(--sh-border-1)" }}><CircleDashed className="h-4 w-4" />No evidence or approval action is waiting right now.</div> : null}
  </div></DashboardLayout>;
}

function DeskMetric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="rounded-xl border px-4 py-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>{label}</p><p className="mt-1 font-mono text-2xl tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{value}</p><p className="text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>{detail}</p></div>;
}

function DeskLane({ icon, title, detail, count, children }: { icon: React.ReactNode; title: string; detail: string; count: number; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><header className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><div className="flex gap-2"><span style={{ color: "var(--sh-signal)" }}>{icon}</span><div><h2 className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{title}</h2><p className="mt-1 text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>{detail}</p></div></div><Badge variant="outline" className="tabular-nums">{count}</Badge></header><div className="divide-y" style={{ borderColor: "var(--sh-border-1)" }}>{count ? children : <p className="px-5 py-6 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Nothing in this lane.</p>}</div></section>;
}

function DeskItem({ eyebrow, title, meta, action, onAction }: { eyebrow: string; title: string; meta: string; action: string; onAction: () => void }) {
  return <article className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>{eyebrow}</p><h3 className="mt-1 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{title}</h3><p className="mt-1 text-[11px] leading-5" style={{ color: "var(--sh-fg-muted)" }}>{meta}</p></div><Button size="sm" variant="outline" className="min-h-10 shrink-0" onClick={onAction}>{action}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></div></article>;
}
