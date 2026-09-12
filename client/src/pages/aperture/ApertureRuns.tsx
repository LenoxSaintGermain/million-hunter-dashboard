import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, Clock3 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { buildResearchJourneys, type ResearchJourney } from "@shared/runWorkspace";
import { formatDistanceToNow } from "date-fns";
import { ResearchJourneyDrawer, type JourneyAction } from "@/components/aperture/ResearchJourneyDrawer";

/**
 * Research, as a scannable list.
 *
 * Measured 2026-09-12: this page was 8.3 screens and 1,830 words — 32.7 words
 * per interactive control, the densest surface in the product — because every
 * journey rendered three explanatory cards, each with a full sentence, stacked
 * down the page. The sentences are worth keeping. Repeating them on every row
 * is what made the page unreadable, so they moved behind the same slide-over
 * the Play Desk uses. One row answers state, coverage and next action; the
 * receipts are one click away and do not cost you your place in the list.
 */

const toneFor = (state: ResearchJourney["state"]) => state === "ready_to_review"
  ? "oklch(0.52 0.15 145)"
  : state === "needs_attention" || state === "paper_stage_declined" ? "var(--sh-red)" : "var(--sh-signal)";

const labelFor = (state: ResearchJourney["state"]) => ({
  in_progress: "Researching",
  needs_attention: "Needs attention",
  paper_stage_declined: "Paper stage declined",
  ready_to_review: "Decision ready",
  more_research_available: "More evidence available",
})[state];

export const actionFor = (journey: ResearchJourney): JourneyAction => {
  if (journey.state === "paper_stage_declined") return {
    label: "Review preserve-cash receipt",
    detail: "A required evidence answer was not confirmed. Review the durable decision; this revision cannot prepare a proposal or create an order.",
    route: `/aperture/run/${journey.latest.id}?view=evidence`,
  };
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

/** URL is the reading context, matching the Play Desk: Back closes the drawer. */
export function readResearchInspect(search: string): number | null {
  const value = new URLSearchParams(search).get("inspect");
  return value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
}

export function researchHref(search: string, inspect: number | null) {
  const params = new URLSearchParams(search);
  if (inspect == null) params.delete("inspect"); else params.set("inspect", String(inspect));
  return `/aperture/runs${params.size ? `?${params}` : ""}`;
}

export default function ApertureRuns() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const inspectId = readResearchInspect(search);
  const { data: runs, isLoading, refetch } = trpc.aperture.run.list.useQuery();
  const { data: pendingOutcomes } = trpc.aperture.runway.pending.useQuery();
  const journeys = buildResearchJourneys((runs ?? []) as any[]);
  const inspected = journeys.find((journey) => journey.rootId === inspectId) ?? null;

  return <DashboardLayout><div className="mx-auto max-w-6xl space-y-5 pb-12">
    <div className="flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium" style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", borderColor: "var(--sh-border-1)" }}><AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} />Internal research tool — not investment advice. Research journeys never create or submit an order.</div>

    <header data-research-header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-serif text-2xl sm:text-3xl" style={{ color: "var(--sh-text-primary)" }}>Research</h1>
      <Button className="min-h-11" onClick={() => navigate("/aperture?setup=1&draft=1")}>Start a research brief<ArrowRight className="ml-2 h-4 w-4" /></Button>
    </header>

    {isLoading && <p role="status" className="py-12 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Loading your research journeys…</p>}

    {!isLoading && journeys.length > 0 && <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead><tr className="border-b text-left text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>
          <th scope="col" className="px-3 py-2">Question</th>
          <th scope="col" className="px-3 py-2">State</th>
          <th scope="col" className="px-3 py-2 text-right">Coverage</th>
          <th scope="col" className="px-3 py-2 text-right">Next</th>
        </tr></thead>
        <tbody>
          {journeys.map((journey) => {
            const action = actionFor(journey);
            return <tr key={journey.rootId} data-journey-row className="border-b last:border-b-0" style={{ borderColor: "var(--sh-border-1)" }}>
              <th scope="row" className="px-3 py-2.5 text-left font-semibold" style={{ color: "var(--sh-text-primary)" }}><button
                type="button"
                data-inspect-journey={journey.rootId}
                aria-haspopup="dialog"
                aria-expanded={inspectId === journey.rootId}
                className="min-h-11 text-left font-semibold underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => navigate(researchHref(search, journey.rootId))}
              >{journey.thesisName}<span className="sr-only"> — inspect coverage, chapters and next step</span></button>
                <span className="block text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>Updated {formatDistanceToNow(Number(journey.latest.createdAt))} ago · {journey.runs.length} chapter{journey.runs.length === 1 ? "" : "s"}</span>
              </th>
              <td className="px-3 py-2.5"><span className="whitespace-nowrap text-xs font-semibold" style={{ color: toneFor(journey.state) }}>{labelFor(journey.state)}</span></td>
              <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{journey.symbolsReviewed} symbols<span className="block text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>{journey.evidenceCandidates} candidates{journey.remainingDeferred ? ` · ${journey.remainingDeferred} deferred` : ""}</span></td>
              <td className="px-3 py-2.5 text-right"><Button size="sm" variant="outline" className="min-h-11 whitespace-nowrap" onClick={() => navigate(action.route)}>{action.label}</Button></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>}

    {!isLoading && !journeys.length && <div className="rounded-xl border py-12 text-center" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <Clock3 className="mx-auto h-6 w-6" style={{ color: "var(--sh-signal)" }} />
      <p className="mt-3 text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>No research journeys yet</p>
      <p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Build a paper research brief to start one connected trail.</p>
    </div>}

    {(pendingOutcomes?.length ?? 0) > 0 && <details data-pending-decisions className="rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>
        <span>Scheduled decisions and outcome reviews</span>
        <span className="tabular-nums" style={{ color: "var(--sh-fg-muted)" }}>{pendingOutcomes!.length}</span>
      </summary>
      <p className="px-4 pb-2 text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>Durable gates and outcome reviews. These are not research journeys, and a recorded checkpoint is not proof that a check ran.</p>
      <ul className="divide-y border-t" style={{ borderColor: "var(--sh-border-1)" }}>{(pendingOutcomes ?? []).map((item) => <li key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{item.gateLabel ?? item.thesisName ?? "Decision review"}</p>
          <p className="mt-0.5 text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>{item.kind === "gate_review" ? "Named gate" : "Outcome review"} · due <time dateTime={new Date(item.dueAt).toISOString()}>{new Date(item.dueAt).toLocaleString()}</time></p>
        </div>
        <Button variant="outline" size="sm" className="min-h-11 shrink-0" onClick={() => navigate(`/aperture/decision/${item.decisionRunId}/revision/${item.revisionId}`)}>Open decision</Button>
      </li>)}</ul>
    </details>}

    <Button variant="ghost" size="sm" className="min-h-11" onClick={() => refetch()}>Refresh journeys</Button>

    <ResearchJourneyDrawer
      journey={inspected}
      stateLabel={inspected ? labelFor(inspected.state) : ""}
      action={inspected ? actionFor(inspected) : { label: "", detail: "", route: "" }}
      onClose={() => navigate(researchHref(search, null))}
      onOpenChapter={(runId) => navigate(`/aperture/run/${runId}`)}
      onTakeAction={() => inspected && navigate(actionFor(inspected).route)}
    />
  </div></DashboardLayout>;
}
