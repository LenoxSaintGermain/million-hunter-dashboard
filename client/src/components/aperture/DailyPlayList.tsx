import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, CircleSlash2, FileSearch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { buildPlayRecipe } from "@shared/playRecipe";
import { PlayRecipeCard } from "./PlayRecipeCard";

function money(cents: number | null | undefined) {
  return cents == null ? "Not set" : `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function confidenceLabel(score: number | null | undefined) {
  if (score == null) return "Not measured";
  if (score >= 0.75) return "High";
  if (score >= 0.5) return "Medium";
  return "Medium-low";
}

export function DailyPlayList({ onNewResearch, onOpenRun }: { onNewResearch: () => void; onOpenRun: (runId: number, candidateId: number, view?: string) => void }) {
  const { data: plays, isLoading } = trpc.aperture.play.list.useQuery();
  const utils = trpc.useUtils();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const decide = trpc.aperture.play.decide.useMutation({
    onSuccess: () => { setReason(""); void utils.aperture.play.list.invalidate(); },
  });
  const ranked = useMemo(() => (plays ?? []).filter((play) => !play.decision), [plays]);

  return <section className="space-y-5">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>Capital Aperture · today</p>
        <h1 className="mt-1 font-serif text-3xl leading-tight" style={{ color: "var(--sh-text-primary)" }}>Today’s paper plays</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>Start with the decision. Open a play, record a skip, or keep capital in cash. Research provenance is one click away, never required before the list.</p>
      </div>
      <Button variant="outline" onClick={onNewResearch}><FileSearch className="mr-2 h-4 w-4" />New research brief</Button>
    </header>

    <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)" }}>
      <strong style={{ color: "var(--sh-text-primary)" }}>Correlation at this decision point:</strong> the permanent rail shows your measured planned-loss theme ceiling. A per-play list-level theme comparison is <strong>not measured</strong> from the current daily-play contract; live preflight rechecks the factual cluster before any paper proposal can be created.
    </div>

    <div className="flex gap-3 rounded-xl border px-4 py-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <CircleSlash2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--sh-signal)" }} />
      <div><p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Cash / no trade is an active outcome.</p><p className="mt-0.5 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Use it when none of today’s recipes clear the trigger, risk, evidence, or correlation conditions. Recording a skip beside a play makes that judgment visible in the scorecard.</p></div>
    </div>

    {isLoading && <div className="flex items-center gap-2 py-10 text-sm" style={{ color: "var(--sh-fg-muted)" }}><Loader2 className="h-4 w-4 animate-spin" />Building today’s ranked play list…</div>}
    {!isLoading && ranked.length === 0 && <div className="rounded-xl border p-6" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><div className="flex gap-3"><CircleSlash2 className="mt-0.5 h-5 w-5" style={{ color: "var(--sh-signal)" }} /><div><p className="font-serif text-xl" style={{ color: "var(--sh-text-primary)" }}>Cash is the right play today.</p><p className="mt-1 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>No completed intraday or catalyst-window research play is available. That is not a missing screen—it is a decision to avoid inventing an actionable setup.</p></div></div></div>}

    <div className="space-y-3">
      {ranked.map((item, index) => {
        const play = buildPlayRecipe({ candidate: item.candidate, run: item.run, reviewedChecks: item.reviews.filter((review) => review.status === "reviewed").map((review) => review.checkLabel) });
        const expanded = expandedId === item.candidate.id;
        const mainBlocker = play.blockingReasons[0] ?? "No research blocker was generated; approval is still separate.";
        return <article key={item.candidate.id} className="overflow-hidden rounded-xl border" style={{ borderColor: expanded ? "var(--sh-signal)" : "var(--sh-border-1)", background: "var(--sh-surface)" }}>
          <button className="grid w-full gap-3 p-4 text-left sm:grid-cols-[2rem_8rem_1fr_auto] sm:items-center sm:p-5" onClick={() => setExpandedId(expanded ? null : item.candidate.id)} aria-expanded={expanded}>
            <span className="font-mono text-sm" style={{ color: "var(--sh-signal)" }}>{index + 1}</span>
            <div><p className="font-serif text-xl" style={{ color: "var(--sh-text-primary)" }}>{item.candidate.symbol}</p><p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>{item.run.holdingPeriod ?? "research"}</p></div>
            <div className="min-w-0"><p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{item.thesisName ?? "Capital research play"}</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{play.readiness === "ready_to_prepare" ? "Ready to prepare for human approval." : mainBlocker}</p></div>
            <div className="flex items-center gap-2 sm:text-right"><span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>{confidenceLabel(item.candidate.confidenceScore)} · {item.confidenceReason}</span><ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} /></div>
          </button>
          {expanded && <div className="border-t p-4 sm:p-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
            <div className="mb-4 grid gap-3 rounded-lg border p-3 text-xs sm:grid-cols-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
              <div><p style={{ color: "var(--sh-fg-muted)" }}>Plan amount</p><p className="mt-1 font-semibold" style={{ color: "var(--sh-text-primary)" }}>{money(play.estimatedAmountCents)} <span className="font-normal" style={{ color: "var(--sh-fg-muted)" }}>{play.amountBasis === "modeled_research_range" ? "· modeled" : play.amountBasis === "not_set" ? "· not measured" : "· operator-stated"}</span></p></div>
              <div><p style={{ color: "var(--sh-fg-muted)" }}>Trigger state</p><p className="mt-1 font-semibold" style={{ color: "var(--sh-text-primary)" }}>Unknown · task for you</p><p className="mt-1 leading-5" style={{ color: "var(--sh-fg-muted)" }}>Confirm the VWAP hold and opening-range condition on a real-time terminal. This list has no verified tape observation attached.</p></div>
              <div><p style={{ color: "var(--sh-fg-muted)" }}>Catalyst / time</p><p className="mt-1 font-semibold" style={{ color: "var(--sh-text-primary)" }}>{item.run.catalystDeadlineAt ? new Date(item.run.catalystDeadlineAt).toLocaleString() : "Not measured"}</p><p className="mt-1 leading-5" style={{ color: "var(--sh-fg-muted)" }}>Source and catalyst detail remain in the research trail.</p></div>
            </div>
            <PlayRecipeCard candidate={item.candidate} run={item.run} reviewedChecks={item.reviews.filter((review) => review.status === "reviewed").map((review) => review.checkLabel)} alreadyHeld={false} thesisContext={{ name: item.thesisName, rawText: item.thesisRawText }} onReviewEvidence={() => onOpenRun(item.run.id, item.candidate.id, "evidence")} onPrepareProposal={() => onOpenRun(item.run.id, item.candidate.id, "execute")} onOpenResearch={() => onOpenRun(item.run.id, item.candidate.id, "research")} />
            <div className="mt-4 rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><p className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Not taking this play?</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Record why. A skipped play is decision data for the weekly scorecard, not an invisible non-event.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Textarea value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-10 text-xs" placeholder="Why cash, delay, or another play is better today…" /><div className="flex gap-2"><Button size="sm" variant="outline" disabled={reason.trim().length < 3 || decide.isPending} onClick={() => decide.mutate({ runId: item.run.id, candidateId: item.candidate.id, decision: "skipped", reason })}>Record skip</Button><Button size="sm" variant="ghost" disabled={reason.trim().length < 3 || decide.isPending} onClick={() => decide.mutate({ runId: item.run.id, candidateId: item.candidate.id, decision: "deferred", reason })}>Defer</Button></div></div></div>
          </div>}
        </article>;
      })}
    </div>
  </section>;
}
