import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleAlert, Clock3, FlaskConical, Layers3, PlayCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { buildResearchJourneys, type ResearchJourney } from "@shared/runWorkspace";
import { formatDistanceToNow } from "date-fns";

const toneFor = (state: ResearchJourney["state"]) => state === "ready_to_review"
  ? "oklch(0.52 0.15 145)"
  : state === "needs_attention" ? "var(--sh-red)" : "var(--sh-signal)";

const labelFor = (state: ResearchJourney["state"]) => ({
  in_progress: "Researching",
  needs_attention: "Needs attention",
  ready_to_review: "Decision ready",
  more_research_available: "More evidence available",
})[state];

const actionFor = (journey: ResearchJourney) => {
  if (journey.state === "ready_to_review") return {
    label: "Review the lead",
    detail: "Open the priority candidate, record the few checks that could change the decision, then unlock paper-proposal preparation.",
    route: `/aperture/run/${journey.latest.id}?view=evidence`,
  };
  if (journey.state === "more_research_available") return {
    label: "Review current recommendation",
    detail: "See the current lead first. You can then continue the deferred research without starting over.",
    route: `/aperture/run/${journey.latest.id}`,
  };
  if (journey.state === "needs_attention") return {
    label: "Resolve the research interruption",
    detail: "Open the latest brief to see the interruption and restart option. No order can be created from this state.",
    route: `/aperture/run/${journey.latest.id}`,
  };
  return {
    label: "Watch evidence build",
    detail: "Open the active brief to see research progress in place. There is no action to take until it completes.",
    route: `/aperture/run/${journey.latest.id}`,
  };
};

export default function ApertureRuns() {
  const [, navigate] = useLocation();
  const { data: runs, isLoading, refetch } = trpc.aperture.run.list.useQuery();
  const journeys = buildResearchJourneys((runs ?? []) as any[]);

  return <DashboardLayout><div className="mx-auto max-w-6xl space-y-6 pb-12">
    <div className="flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium" style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", borderColor: "var(--sh-border-1)" }}><AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} />Internal research tool — not investment advice. Research journeys never create or submit an order.</div>
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>Capital Aperture · Research journeys</p><h1 className="mt-1 font-serif text-3xl" style={{ color: "var(--sh-text-primary)" }}>One question. One connected research trail.</h1><p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>A follow-up batch belongs to the same decision. Start with the journey that has a clear next human action—not a raw list of brief IDs.</p></div>
      <Button onClick={() => navigate("/aperture")}>Start a research brief <ArrowRight className="ml-2 h-4 w-4" /></Button>
    </header>
    {isLoading && <p className="py-12 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Loading your research journeys…</p>}
    <div className="grid gap-4">
      {journeys.map((journey) => {
        const action = actionFor(journey);
        return <Card key={journey.rootId} className="overflow-hidden" style={{ borderColor: journey.state === "ready_to_review" ? "color-mix(in srgb, oklch(0.52 0.15 145) 35%, var(--sh-border-1))" : "var(--sh-border-1)" }}><CardContent className="p-0">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between" style={{ background: "var(--sh-surface-2)" }}>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" style={{ color: toneFor(journey.state), borderColor: toneFor(journey.state) }}>{labelFor(journey.state)}</Badge><span className="text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>Updated {formatDistanceToNow(Number(journey.latest.createdAt))} ago</span></div><h2 className="mt-2 font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}>{journey.thesisName}</h2><p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>{journey.runs.length} research chapter{journey.runs.length === 1 ? "" : "s"} · {journey.symbolsReviewed} symbols reviewed · {journey.evidenceCandidates} evidence candidates</p></div>
          <Button size="sm" onClick={() => navigate(action.route)}>{journey.state === "in_progress" ? <PlayCircle className="mr-1.5 h-3.5 w-3.5" /> : <ArrowRight className="mr-1.5 h-3.5 w-3.5" />}{action.label}</Button>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          <Metric icon={<Layers3 className="h-4 w-4" />} label="Research coverage" value={`${journey.symbolsReviewed} symbols`} detail={journey.remainingDeferred ? `${journey.remainingDeferred} still available for research` : "Full discovered universe reviewed"} />
          <Metric icon={<FlaskConical className="h-4 w-4" />} label="Current decision state" value={labelFor(journey.state)} detail={journey.remainingDeferred ? "You can research more without clearing every check." : "Move into the priority evidence review."} />
          <Metric icon={<CheckCircle2 className="h-4 w-4" />} label="What to do now" value={action.label} detail={action.detail} />
        </div>
        <div className="flex flex-wrap gap-2 border-t px-5 py-3" style={{ borderColor: "var(--sh-border-1)" }}>{journey.runs.map((run, index) => <button key={run.id} onClick={() => navigate(`/aperture/run/${run.id}`)} className="rounded-full border px-2.5 py-1 text-[11px] transition-colors hover:bg-muted" style={{ borderColor: run.id === journey.latest.id ? "var(--sh-signal)" : "var(--sh-border-1)", color: run.id === journey.latest.id ? "var(--sh-text-primary)" : "var(--sh-fg-muted)" }}>Chapter {index + 1} · {run.candidateCount ?? 0} candidates</button>)}</div>
      </CardContent></Card>})}
      {!isLoading && !journeys.length && <Card><CardContent className="py-12 text-center"><Clock3 className="mx-auto h-6 w-6" style={{ color: "var(--sh-signal)" }} /><p className="mt-3 text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>No research journeys yet</p><p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Build a paper research brief to start one connected trail.</p></CardContent></Card>}
    </div>
    <Button variant="ghost" size="sm" onClick={() => refetch()}>Refresh journeys</Button>
  </div></DashboardLayout>;
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="rounded-xl border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>{icon}{label}</div><p className="mt-2 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{value}</p><p className="mt-1 text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>{detail}</p></div>;
}
