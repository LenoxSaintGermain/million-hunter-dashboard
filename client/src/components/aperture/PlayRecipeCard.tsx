import { AlertTriangle, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { PriceRiskVisual } from "@/components/aperture/PriceRiskVisual";

function money(cents: number | null | undefined) {
  return cents == null ? "Not measured" : `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function when(epochMs: number | null | undefined) {
  return epochMs == null ? "Not measured" : new Date(epochMs).toLocaleString();
}

function label(value: string | null | undefined) {
  return (value ?? "Not classified").replaceAll("_", " ");
}

const readinessCopy = {
  constructed: { label: "Modeled recipe ready for human confirmation", color: "var(--sh-signal)" },
  needs_tape: { label: "No paper play — tape required", color: "var(--sh-signal)" },
  needs_equity: { label: "No paper play — equity required", color: "var(--sh-signal)" },
  needs_range: { label: "No paper play — opening range required", color: "var(--sh-signal)" },
  budget_too_small: { label: "No paper play — budget cannot size one share", color: "var(--sh-signal)" },
  expired: { label: "No paper play — catalyst window expired", color: "var(--sh-signal)" },
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
  proposalBlockedReason,
}: {
  candidate: any;
  run: any;
  reviewedChecks: Iterable<string>;
  alreadyHeld: boolean;
  thesisContext?: { name?: string | null; rawText?: string | null } | null;
  onReviewEvidence: () => void;
  onPrepareProposal: () => void;
  onOpenResearch: () => void;
  proposalBlockedReason?: string | null;
}) {
  const { data, isLoading } = trpc.aperture.play.construct.useQuery(
    { runId: run.id, candidateId: candidate.id },
    { staleTime: 30_000 },
  );

  if (isLoading || !data) {
    return <section className="rounded-xl border p-5" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}>
      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--sh-fg-muted)" }}>
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        Constructing a modeled recipe from the available tape, mandate, and paper account context…
      </div>
    </section>;
  }

  const { play, disclosure } = data;
  const copy = readinessCopy[play.readiness];
  const noPlay = ["budget_too_small", "needs_equity", "needs_tape", "needs_range", "expired"].includes(play.readiness);
  const taxonomy = play.taxonomy;
  const optionIntent = taxonomy?.execution?.instrument === "option";
  const decisiveChecks = Array.isArray(candidate.verifyFields)
    ? candidate.verifyFields.filter((check: unknown): check is string => typeof check === "string")
    : [];
  const reviewedCheckSet = new Set(reviewedChecks);
  const allChecksReviewed = decisiveChecks.length > 0 && decisiveChecks.every((check: string) => reviewedCheckSet.has(check));
  const level = (title: string, value: string, basis?: string | null) => <div className="space-y-1.5 p-4" style={{ background: "var(--sh-surface)" }}>
    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.13em]" style={{ color: "var(--sh-fg-muted)" }}>{title} · modeled</p>
    <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{value}</p>
    {basis && <p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{basis}</p>}
  </div>;

  return <section className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}>
    <div className="border-b px-4 py-4 sm:px-5" style={{ borderColor: "var(--sh-border-1)" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Your play</p><p className="mt-1 font-serif text-2xl capitalize" style={{ color: "var(--sh-text-primary)" }} translate="no">{candidate.symbol} · {label(taxonomy?.execution?.strategy)}</p><p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>{label(taxonomy?.marketPlay?.specificPlay)} · {taxonomy?.horizon?.label ?? "Horizon not classified"}</p></div>
        <Badge variant="outline" className="shrink-0" style={{ color: copy.color, borderColor: copy.color }}>{noPlay ? "Blocked" : "Ready to review"}</Badge>
      </div>
    </div>

    {noPlay ? <div className="space-y-4 p-4 sm:p-5">
      <div className="rounded-lg border p-4" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface)" }}>
        <div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--sh-signal)" }} /><div>
          <p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>This play cannot move yet.</p>
          <p className="mt-1 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{play.unavailableReasons[0] ?? "Required inputs are not measurable."}</p>
        </div></div>
      </div>
      <div className="flex flex-wrap gap-2"><Button type="button" size="sm" className="min-h-11" onClick={onReviewEvidence}>Resolve blocker</Button><Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={onOpenResearch}>View research</Button></div>
      {play.unavailableReasons.length > 1 && <details className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}><summary className="cursor-pointer font-semibold" style={{ color: "var(--sh-text-primary)" }}>Other blockers</summary><ul className="mt-2 space-y-1">{play.unavailableReasons.slice(1).map((reason: string) => <li key={reason}>{reason}</li>)}</ul></details>}
    </div> : <>
      <div className="space-y-4 p-4 sm:p-5">
        <PriceRiskVisual entryCents={play.entry?.priceCents} stopCents={play.stop?.priceCents} targets={optionIntent ? [] : play.targets.map((target: any) => ({ label: `${target.rMultiple}R`, priceCents: target.priceCents }))} label={optionIntent ? `${candidate.symbol} underlying plan` : `${candidate.symbol} price plan`} />
        <div className="grid grid-cols-3 overflow-hidden rounded-lg border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
          {level(optionIntent ? "Contract" : "Quantity", optionIntent ? "Choose next" : play.qty == null ? "Not measured" : `${play.qty.toLocaleString()} shares`)}
          {level(optionIntent ? "Max loss" : "Planned loss", optionIntent ? "Premium paid" : money(play.plannedLossCents))}
          {level(optionIntent ? "Review" : "Capital", optionIntent ? when(play.timeStopAt) : money(play.notionalCents))}
        </div>
        <aside className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: proposalBlockedReason ? "var(--sh-signal)" : "var(--sh-border-1)", background: "var(--sh-surface)" }}><div><p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}><ShieldCheck className="h-4 w-4" style={{ color: allChecksReviewed ? "var(--sh-emerald)" : "var(--sh-signal)" }} />{proposalBlockedReason ? "One blocker remains" : allChecksReviewed ? "Ready for ticket preflight" : "Ready to inspect"}</p>{proposalBlockedReason && <p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>{proposalBlockedReason}</p>}</div><div className="flex shrink-0 gap-2">{proposalBlockedReason ? <Button type="button" size="sm" className="min-h-11" onClick={onReviewEvidence}><LockKeyhole className="mr-1.5 h-3.5 w-3.5" />Resolve here</Button> : <Button type="button" size="sm" className="min-h-11" onClick={onPrepareProposal}><LockKeyhole className="mr-1.5 h-3.5 w-3.5" />Review paper ticket</Button>}<Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={onOpenResearch}>Evidence</Button></div></aside>
      </div>
    </>}
    <details className="border-t px-4 py-3 sm:px-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><summary className="cursor-pointer text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Evidence &amp; assumptions</summary><div className="mt-3 space-y-3 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}><p>{disclosure}</p><p>Tape basis: {play.tapeBasis}</p>{play.noTradeConditions.length > 0 && <div><p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>Do not take when</p><ul className="mt-1 list-disc space-y-1 pl-5">{play.noTradeConditions.map((condition: string) => <li key={condition}>{condition}</li>)}</ul></div>}{play.assumptions.length > 0 && <div><p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>Assumptions</p><ul className="mt-1 list-disc space-y-1 pl-5">{play.assumptions.map((assumption: string) => <li key={assumption}>{assumption}</li>)}</ul></div>}<p><strong style={{ color: "var(--sh-text-primary)" }}>Thesis:</strong> {thesisContext?.name || "Saved Capital / Trade thesis"}. {alreadyHeld ? `${candidate.symbol} is already held in paper context.` : `No ${candidate.symbol} paper exposure exists until approval and submission.`}</p></div></details>
  </section>;
}
