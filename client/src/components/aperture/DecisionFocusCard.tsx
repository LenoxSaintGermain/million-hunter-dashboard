import { ArrowRight, CheckCircle2, CircleAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildDecisionFocus, type DecisionCandidate, type PaperPosition } from "@shared/decisionFocus";

export function DecisionFocusCard({ candidate, positions, onOpenMemo, onReviewEvidence, onComparePostures }: {
  candidate: DecisionCandidate;
  positions: PaperPosition[];
  onOpenMemo?: () => void;
  onReviewEvidence?: () => void;
  onComparePostures?: () => void;
}) {
  const focus = buildDecisionFocus(candidate, positions);
  const blocked = focus.verdict === "not_ready";
  return (
    <section className="overflow-hidden rounded-2xl border" style={{ borderColor: blocked ? "color-mix(in oklab, var(--sh-signal) 65%, var(--sh-border-1))" : "oklch(0.55 0.15 145)", background: "var(--sh-surface)" }}>
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
        <div className="flex gap-3">
          {blocked ? <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--sh-signal)" }} /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "oklch(0.55 0.15 145)" }} />}
          <div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.15em]" style={{ color: blocked ? "var(--sh-signal)" : "oklch(0.55 0.15 145)" }}>Machine POV · research only</p><h2 className="mt-1 font-serif text-xl" style={{ color: "var(--sh-text-primary)" }}>{focus.headline}</h2></div>
        </div>
        <span className="rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em]" style={{ color: blocked ? "var(--sh-signal)" : "oklch(0.55 0.15 145)", borderColor: "var(--sh-border-1)" }}>{blocked ? "Human review required" : "Ready for human review"}</span>
      </div>
      <div className="grid gap-0 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0" style={{ borderColor: "var(--sh-border-1)" }}>
        <div className="p-4"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.13em]" style={{ color: "var(--sh-fg-muted)" }}>Portfolio effect</p><p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-text-primary)" }}>{focus.portfolioEffect}</p></div>
        <div className="p-4"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.13em]" style={{ color: "var(--sh-fg-muted)" }}>Return impact</p><p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-text-primary)" }}>{focus.returnOutlook}</p></div>
        <div className="p-4"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.13em]" style={{ color: "var(--sh-fg-muted)" }}>Human must clear</p><ol className="mt-2 space-y-2">{focus.humanChecks.map((check, index) => <li key={check} className="flex gap-2 text-sm leading-5" style={{ color: "var(--sh-text-primary)" }}><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold" style={{ color: "var(--sh-signal)", background: "color-mix(in oklab, var(--sh-signal) 14%, transparent)" }}>{index + 1}</span>{check}</li>)}</ol></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3" style={{ borderColor: "var(--sh-border-1)" }}>
        <ShieldCheck className="h-4 w-4" style={{ color: "var(--sh-signal)" }} /><span className="mr-auto text-xs" style={{ color: "var(--sh-fg-muted)" }}>{focus.nextAction}</span>
        {onOpenMemo && <Button variant="ghost" size="sm" onClick={onOpenMemo}>Read research record <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>}
        {onReviewEvidence && <Button variant="outline" size="sm" onClick={onReviewEvidence}>Open evidence checks</Button>}
        {onComparePostures && <Button size="sm" onClick={onComparePostures}>See portfolio effect</Button>}
      </div>
    </section>
  );
}
