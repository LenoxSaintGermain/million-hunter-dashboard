import { ArrowRight, CheckCircle2, CircleAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildDecisionFocus, type DecisionCandidate, type PaperPosition } from "@shared/decisionFocus";
import { buildDecisionPath } from "@shared/decisionPath";

export function DecisionFocusCard({ candidate, positions, onOpenMemo, onReviewEvidence, onComparePostures, onViewPaperAccount }: {
  candidate: DecisionCandidate;
  positions: PaperPosition[];
  onOpenMemo?: () => void;
  onReviewEvidence?: () => void;
  onComparePostures?: () => void;
  onViewPaperAccount?: () => void;
}) {
  const focus = buildDecisionFocus(candidate, positions);
  const decisiveChecks = Array.isArray(candidate.verifyFields)
    ? candidate.verifyFields.filter((check): check is string => typeof check === "string")
    : [];
  const invalidationGuardrail = focus.humanChecks.find((check) => /invalidation/i.test(check));
  const path = buildDecisionPath({ symbol: candidate.symbol, memoStatus: candidate.memoStatus, decisionCriticalChecks: decisiveChecks.length });
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
        <div className="p-4"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.13em]" style={{ color: "var(--sh-fg-muted)" }}>Human decision checklist</p><p className="mt-1 text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>{decisiveChecks.length} decisive evidence check{decisiveChecks.length === 1 ? "" : "s"}{invalidationGuardrail ? " · plus one invalidation guardrail" : ""}</p><ol className="mt-2 space-y-2">{decisiveChecks.map((check, index) => <li key={check} className="flex gap-2 text-sm leading-5" style={{ color: "var(--sh-text-primary)" }}><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold" style={{ color: "var(--sh-signal)", background: "color-mix(in oklab, var(--sh-signal) 14%, transparent)" }}>{index + 1}</span>{check.replace(/^\w:\s*/, "")}</li>)}</ol>{invalidationGuardrail && <p className="mt-3 border-t pt-2 text-[11px] leading-4" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}><span className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>Guardrail:</span> {invalidationGuardrail}</p>}<p className="mt-2 text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>Decisive checks gate paper-order review only. They do not block research navigation or posture comparison.</p></div>
      </div>
      <div className="flex flex-col gap-3 border-t px-5 py-3 sm:flex-row sm:items-center" style={{ borderColor: "var(--sh-border-1)" }}>
        <div className="flex min-w-0 items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--sh-signal)" }} /><div><p className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Next: {path.label}</p><p className="mt-0.5 text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>{path.detail}</p></div></div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto">
          {path.stage === "read_memo" && onOpenMemo && <Button size="sm" onClick={onOpenMemo}>Read decision record <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>}
          {path.stage === "resolve_checks" && onReviewEvidence && <Button size="sm" onClick={onReviewEvidence}>Open decisive checks</Button>}
          {path.stage === "prepare_paper_review" && onViewPaperAccount && <Button size="sm" onClick={onViewPaperAccount}>Review paper readiness</Button>}
          {onReviewEvidence && path.stage !== "resolve_checks" && <button className="text-xs underline-offset-4 hover:underline" style={{ color: "var(--sh-fg-muted)" }} onClick={onReviewEvidence}>Evidence</button>}
          {onComparePostures && <button className="text-xs underline-offset-4 hover:underline" style={{ color: "var(--sh-fg-muted)" }} onClick={onComparePostures}>Postures</button>}
        </div>
      </div>
    </section>
  );
}
