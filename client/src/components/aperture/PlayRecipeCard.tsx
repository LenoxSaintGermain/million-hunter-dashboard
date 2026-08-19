import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

function money(cents: number | null | undefined) {
  return cents == null ? "Not measured" : `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function when(epochMs: number | null | undefined) {
  return epochMs == null ? "Not measured" : new Date(epochMs).toLocaleString();
}

const readinessCopy = {
  constructed: { label: "Modeled recipe ready for human confirmation", color: "oklch(0.55 0.15 145)" },
  needs_tape: { label: "No paper play — tape required", color: "var(--sh-signal)" },
  needs_equity: { label: "No paper play — equity required", color: "var(--sh-signal)" },
  needs_range: { label: "No paper play — opening range required", color: "var(--sh-signal)" },
  budget_too_small: { label: "No paper play — budget cannot size one share", color: "var(--sh-signal)" },
  expired: { label: "No paper play — catalyst window expired", color: "var(--sh-signal)" },
} as const;

export function PlayRecipeCard({
  candidate,
  run,
  reviewedChecks: _reviewedChecks,
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
  const { data, isLoading } = trpc.aperture.play.construct.useQuery({ runId: run.id, candidateId: candidate.id }, { staleTime: 30_000 });
  if (isLoading || !data) return <section className="rounded-xl border p-5" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}><div className="flex items-center gap-2 text-sm" style={{ color: "var(--sh-fg-muted)" }}><Loader2 className="h-4 w-4 animate-spin" />Constructing a modeled recipe from the available tape, mandate, and paper account context…</div></section>;

  const { play, disclosure } = data;
  const copy = readinessCopy[play.readiness];
  const noPlay = play.readiness === "budget_too_small" || play.readiness === "needs_equity" || play.readiness === "needs_tape" || play.readiness === "needs_range" || play.readiness === "expired";
  const level = (label: string, value: string, basis?: string | null) => <div className="space-y-1.5 p-4" style={{ background: "var(--sh-surface)" }}><p className="text-[0.65rem] font-semibold uppercase tracking-[0.13em]" style={{ color: "var(--sh-fg-muted)" }}>{label} · modeled</p><p className="text-lg font-semibold tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{value}</p>{basis && <p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{basis}</p>}</div>;

  return <section className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}>
    <div className="border-b px-4 py-4 sm:px-5" style={{ borderColor: "var(--sh-border-1)" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Start here · modeled paper recipe</p><h2 className="mt-1 font-serif text-xl" style={{ color: "var(--sh-text-primary)" }}>{candidate.symbol} · {play.side} {run.holdingPeriod ?? "research"} setup</h2><p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>The levels below are derived from available minute bars, stated assumptions, and the paper mandate. They are a confirmation surface—not a trading instruction.</p></div>
        <Badge variant="outline" className="shrink-0" style={{ color: copy.color, borderColor: copy.color }}>{copy.label}</Badge>
      </div>
    </div>

    {noPlay ? <div className="space-y-4 p-4 sm:p-5"><div className="rounded-lg border p-4" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface)" }}><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--sh-signal)" }} /><div><p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>There is no paper play to prepare.</p><p className="mt-1 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{play.unavailableReasons[0] ?? "Required inputs are not measurable."}</p></div></div></div><ul className="space-y-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{play.unavailableReasons.slice(1).map((reason) => <li key={reason}>• {reason}</li>)}</ul><div className="flex flex-wrap gap-2"><Button size="sm" onClick={onReviewEvidence}>Review blockers</Button><Button variant="outline" size="sm" onClick={onOpenResearch}>Why this candidate? See research</Button></div></div> : <>
      <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4" style={{ background: "var(--sh-border-1)" }}>
        {level("Entry", money(play.entry?.priceCents), play.entry?.basis)}
        {level("Protective stop", money(play.stop?.priceCents), play.stop?.basis)}
        {level("Slippage / share", money(play.slippage?.priceCents), play.slippage?.basis)}
        {level("Modeled quantity", play.qty == null ? "Not measured" : `${play.qty.toLocaleString()} shares`, play.sizeLimitedByNotionalCeiling ? "Quantity is limited by the single-order notional ceiling." : "Quantity equals planned-loss budget ÷ (entry-to-stop distance + slippage).")}
      </div>
      <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4" style={{ background: "var(--sh-border-1)" }}>
        {level("Notional", money(play.notionalCents), "Derived from modeled entry × quantity.")}
        {level("Planned loss", `${money(play.plannedLossCents)}${play.plannedLossPctOfEquity == null ? "" : ` · ${play.plannedLossPctOfEquity.toFixed(2)}% equity`}`, "Stop-distance loss plus modeled slippage; it is not a return forecast.")}
        {level("Targets", play.targets.length ? play.targets.map((target) => `${target.rMultiple}R ${money(target.priceCents)}`).join(" · ") : "Not measured", play.targets[0]?.basis)}
        {level("Human review time", when(play.timeStopAt), "A review point, not an automatic exit.")}
      </div>
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-[1.25fr_0.85fr] sm:px-5"><div><p className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Do not take the recipe when</p><ul className="mt-3 space-y-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{play.noTradeConditions.map((condition) => <li key={condition} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>• {condition}</li>)}</ul></div><aside className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}><ShieldCheck className="h-4 w-4" style={{ color: "var(--sh-signal)" }} />What must be confirmed</p><p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{play.trigger?.basis ?? "No trigger observation is available."}</p><div className="mt-3 flex flex-col gap-2"><Button size="sm" onClick={onPrepareProposal}><LockKeyhole className="mr-1.5 h-3.5 w-3.5" />Review paper ticket</Button><Button variant="outline" size="sm" onClick={onReviewEvidence}>Review evidence</Button><Button variant="outline" size="sm" onClick={onOpenResearch}>Why this recipe?</Button></div></aside></div>
    </>}

    <div className="border-t px-4 py-3 text-xs leading-5 sm:px-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><p style={{ color: "var(--sh-fg-muted)" }}>{disclosure}</p><p className="mt-2" style={{ color: "var(--sh-fg-muted)" }}>Tape basis: {play.tapeBasis}</p>{play.assumptions.length > 0 && <details className="mt-2"><summary className="cursor-pointer font-semibold" style={{ color: "var(--sh-text-primary)" }}>Assumptions used in this recipe</summary><ul className="mt-2 space-y-1" style={{ color: "var(--sh-fg-muted)" }}>{play.assumptions.map((assumption) => <li key={assumption}>• {assumption}</li>)}</ul></details>}</div>
    <details className="border-t px-4 py-3 sm:px-5" style={{ borderColor: "var(--sh-border-1)" }}><summary className="cursor-pointer text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Why this recipe exists · thesis and research provenance</summary><div className="mt-3 grid gap-3 text-xs leading-5 sm:grid-cols-2"><div className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>Thesis that informed it</p><p className="mt-1 whitespace-pre-line" style={{ color: "var(--sh-fg-muted)" }}>{thesisContext?.name || "Saved Capital / Trade thesis"}{thesisContext?.rawText ? `\n${thesisContext.rawText.slice(0, 520)}${thesisContext.rawText.length > 520 ? "…" : ""}` : "\nNo saved thesis text was returned for this run."}</p></div><div className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>Portfolio impact</p><p className="mt-1" style={{ color: "var(--sh-fg-muted)" }}>{alreadyHeld ? `${candidate.symbol} is already held in paper context.` : `No ${candidate.symbol} paper exposure exists until a human creates, approves, and submits a proposal.`}</p></div></div></details>
  </section>;
}
