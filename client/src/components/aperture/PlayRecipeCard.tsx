import { CheckCircle2, CircleDashed, LockKeyhole, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildPlayRecipe } from "@shared/playRecipe";

function money(cents: number | null) {
  return cents == null ? "Not set" : `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

const READINESS_COPY = {
  needs_evidence: { label: "Research play — evidence first", color: "var(--sh-signal)" },
  needs_risk_plan: { label: "Research play — risk plan needed", color: "var(--sh-signal)" },
  ready_to_prepare: { label: "Ready to prepare for human approval", color: "oklch(0.55 0.15 145)" },
} as const;

export function PlayRecipeCard({
  candidate,
  run,
  reviewedChecks,
  alreadyHeld,
  thesisContext,
  onReviewEvidence,
  onPrepareProposal,
  onOpenResearch,
}: {
  candidate: any;
  run: any;
  reviewedChecks: Iterable<string>;
  alreadyHeld: boolean;
  thesisContext?: { name?: string | null; rawText?: string | null } | null;
  onReviewEvidence: () => void;
  onPrepareProposal: () => void;
  onOpenResearch: () => void;
}) {
  const play = buildPlayRecipe({ candidate, run, reviewedChecks });
  const copy = READINESS_COPY[play.readiness];
  const amountCaption = play.amountBasis === "operator_stated"
    ? "Operator-stated paper amount"
    : play.amountBasis === "modeled_research_range"
      ? "Modeled research range — not a recommendation"
      : "No amount is available yet";

  return <section className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}>
    <div className="border-b px-4 py-4 sm:px-5" style={{ borderColor: "var(--sh-border-1)" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Start here · the paper play</p>
          <h2 className="mt-1 font-serif text-xl" style={{ color: "var(--sh-text-primary)" }}>{candidate.symbol}: {play.readiness === "ready_to_prepare" ? "a reviewed paper play can be prepared" : "a research play, not a trade instruction"}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>A play is the recipe: what must happen, how much paper capital is at stake, what makes the setup invalid, and when to do nothing. The thesis and research explain why this symbol reached the recipe—they do not replace it.</p>
        </div>
        <Badge variant="outline" className="shrink-0" style={{ color: copy.color, borderColor: copy.color }}>{copy.label}</Badge>
      </div>
    </div>

    <div className="grid gap-px sm:grid-cols-3" style={{ background: "var(--sh-border-1)" }}>
      <div className="space-y-1.5 p-4" style={{ background: "var(--sh-surface)" }}><p className="text-[0.65rem] font-semibold uppercase tracking-[0.13em]" style={{ color: "var(--sh-fg-muted)" }}>Paper amount</p><p className="text-lg font-semibold tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{money(play.estimatedAmountCents)}</p><p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{amountCaption}</p></div>
      <div className="space-y-1.5 p-4" style={{ background: "var(--sh-surface)" }}><p className="text-[0.65rem] font-semibold uppercase tracking-[0.13em]" style={{ color: "var(--sh-fg-muted)" }}>Portfolio change</p><p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{alreadyHeld ? `${candidate.symbol} is already held in paper context` : `No ${candidate.symbol} paper exposure yet`}</p><p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Nothing changes until a person creates, approves, and submits a paper proposal.</p></div>
      <div className="space-y-1.5 p-4" style={{ background: "var(--sh-surface)" }}><p className="text-[0.65rem] font-semibold uppercase tracking-[0.13em]" style={{ color: "var(--sh-fg-muted)" }}>No-trade rule</p><p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{play.readiness === "ready_to_prepare" ? "Reject the proposal if the setup changes" : "Do not prepare a paper order yet"}</p><p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{run.invalidationRule || "The research premise must remain supported before a human can proceed."}</p></div>
    </div>

    <div className="grid gap-4 px-4 py-4 sm:grid-cols-[1.25fr_0.85fr] sm:px-5">
      <div>
        <p className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Recipe sequence</p>
        <div className="mt-3 space-y-2">
          {play.steps.map((step, index) => <div key={step.label} className="flex gap-3 rounded-lg border px-3 py-2.5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
            {step.complete ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "oklch(0.55 0.15 145)" }} /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--sh-signal)" }} />}
            <div><p className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>{index + 1}. {step.label}</p><p className="mt-0.5 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{step.detail}</p></div>
          </div>)}
        </div>
      </div>
      <aside className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
        <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}><ShieldCheck className="h-4 w-4" style={{ color: "var(--sh-signal)" }} />What keeps this honest</p>
        <ul className="mt-2 space-y-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>
          {play.blockingReasons.map((reason) => <li key={reason}>• {reason}</li>)}
          {!play.blockingReasons.length && <li>• All stated research and sizing inputs are present; approval is still separate.</li>}
        </ul>
        <div className="mt-3 flex flex-col gap-2">
          {play.readiness === "ready_to_prepare" ? <Button size="sm" onClick={onPrepareProposal}><LockKeyhole className="mr-1.5 h-3.5 w-3.5" />Prepare paper proposal</Button> : <Button size="sm" onClick={onReviewEvidence}>Review play blockers</Button>}
          <Button variant="outline" size="sm" onClick={onOpenResearch}>Why this play? See research trail</Button>
        </div>
      </aside>
    </div>

    <details className="border-t px-4 py-3 sm:px-5" style={{ borderColor: "var(--sh-border-1)" }}>
      <summary className="cursor-pointer text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Why this play exists · thesis and research provenance</summary>
      <div className="mt-3 grid gap-3 text-xs leading-5 sm:grid-cols-2">
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>Thesis that informed it</p><p className="mt-1 whitespace-pre-line" style={{ color: "var(--sh-fg-muted)" }}>{thesisContext?.name || "Saved Capital / Trade thesis"}{thesisContext?.rawText ? `\n${thesisContext.rawText.slice(0, 520)}${thesisContext.rawText.length > 520 ? "…" : ""}` : "\nNo saved thesis text was returned for this run."}</p></div>
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>Evidence still required</p><p className="mt-1" style={{ color: "var(--sh-fg-muted)" }}>{play.requiredChecks.length ? play.requiredChecks.join(" · ") : "No decision-critical evidence check was generated for this candidate. A human should still confirm current data before preparing a paper proposal."}</p></div>
      </div>
    </details>
  </section>;
}
