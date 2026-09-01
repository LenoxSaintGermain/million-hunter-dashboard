import { AlertTriangle, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

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
  reviewedChecks: _reviewedChecks,
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
  const level = (title: string, value: string, basis?: string | null) => <div className="space-y-1.5 p-4" style={{ background: "var(--sh-surface)" }}>
    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.13em]" style={{ color: "var(--sh-fg-muted)" }}>{title} · modeled</p>
    <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{value}</p>
    {basis && <p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{basis}</p>}
  </div>;

  return <section className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}>
    <div className="border-b px-4 py-4 sm:px-5" style={{ borderColor: "var(--sh-border-1)" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Start here · modeled paper recipe</p>
          <p className="mt-1 font-serif text-xl capitalize" style={{ color: "var(--sh-text-primary)" }} translate="no">{candidate.symbol} · {label(taxonomy?.marketPlay?.specificPlay)}</p>
          <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>Market play, execution choice, horizon, and confirmation signals are separate objects. The modeled levels are a human confirmation surface—not a trading instruction.</p>
        </div>
        <Badge variant="outline" className="shrink-0" style={{ color: copy.color, borderColor: copy.color }}>{copy.label}</Badge>
      </div>
    </div>

    <div className="grid gap-px border-b sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}>
      <div className="p-3" style={{ background: "var(--sh-surface)" }}>
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Market play</p>
        <p className="mt-1 text-sm font-semibold capitalize" style={{ color: "var(--sh-text-primary)" }}>{label(taxonomy?.marketPlay?.specificPlay)}</p>
        <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{taxonomy?.marketPlay?.basis ?? "Market setup not classified from source data."}</p>
      </div>
      <div className="p-3" style={{ background: "var(--sh-surface)" }}>
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Execution choice</p>
        <p className="mt-1 text-sm font-semibold capitalize" style={{ color: "var(--sh-text-primary)" }}>{label(taxonomy?.execution?.direction)} · {label(taxonomy?.execution?.strategy)}</p>
        <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{taxonomy?.execution?.instrument ?? "unknown"} expression; it is not the market play.</p>
      </div>
      <div className="p-3" style={{ background: "var(--sh-surface)" }}>
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Time horizon</p>
        <p className="mt-1 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{taxonomy?.horizon?.label ?? "Not classified"}</p>
        <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{taxonomy?.horizon?.basis ?? "No horizon basis is available."}</p>
      </div>
      <div className="p-3" style={{ background: "var(--sh-surface)" }}>
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Confirmation signals</p>
        <p className="mt-1 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{taxonomy?.signals?.map((signal: any) => `${signal.label}: ${signal.status}`).join(" · ") ?? "Not measured"}</p>
        <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Signals confirm or reject the setup; they are never execution strategies.</p>
      </div>
    </div>

    {noPlay ? <div className="space-y-4 p-4 sm:p-5">
      <div className="rounded-lg border p-4" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface)" }}>
        <div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--sh-signal)" }} /><div>
          <p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>There is no paper play to prepare.</p>
          <p className="mt-1 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{play.unavailableReasons[0] ?? "Required inputs are not measurable."}</p>
        </div></div>
      </div>
      <ul className="space-y-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{play.unavailableReasons.slice(1).map((reason: string) => <li key={reason}>{reason}</li>)}</ul>
      <div className="flex flex-wrap gap-2"><Button type="button" size="sm" className="min-h-11" onClick={onReviewEvidence}>Review blockers</Button><Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onOpenResearch}>Why this candidate? See research</Button></div>
    </div> : <>
      {optionIntent ? <>
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4" style={{ background: "var(--sh-border-1)" }}>
          {level("Underlying confirmation", money(play.entry?.priceCents), play.entry?.basis)}
          {level("Underlying invalidation", money(play.stop?.priceCents), play.stop?.basis)}
          {level("Exact contract", "Choose at paper ticket", "Expiration, strike, and limit premium require current option-chain evidence and human review.")}
          {level("Maximum planned loss", "Premium paid", "For a long call or put, the ticket computes contracts × 100 × limit premium. Share quantity is not substituted.")}
        </div>
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4" style={{ background: "var(--sh-border-1)" }}>
          {level("Instrument", label(taxonomy.execution.strategy), "Defined-risk option intent carried from the immutable run.")}
          {level("Contract quantity", "Choose at paper ticket", "Whole contracts only; bounded by the declared premium-at-risk ceiling.")}
          {level("Outcome range", "Not modeled", "No share-based R target is presented as an option-price forecast.")}
          {level("Human review time", when(play.timeStopAt), "A review point, not an automatic exit.")}
        </div>
      </> : <>
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4" style={{ background: "var(--sh-border-1)" }}>
          {level("Entry", money(play.entry?.priceCents), play.entry?.basis)}
          {level("Protective stop", money(play.stop?.priceCents), play.stop?.basis)}
          {level("Slippage / share", money(play.slippage?.priceCents), play.slippage?.basis)}
          {level("Modeled quantity", play.qty == null ? "Not measured" : `${play.qty.toLocaleString()} shares`, play.sizeLimitedByNotionalCeiling ? "Quantity is limited by the single-order notional ceiling." : "Quantity equals planned-loss budget ÷ (entry-to-stop distance + slippage).")}
        </div>
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4" style={{ background: "var(--sh-border-1)" }}>
          {level("Notional", money(play.notionalCents), "Derived from modeled entry × quantity.")}
          {level("Planned loss", `${money(play.plannedLossCents)}${play.plannedLossPctOfEquity == null ? "" : ` · ${play.plannedLossPctOfEquity.toFixed(2)}% equity`}`, "Stop-distance loss plus modeled slippage; it is not a return forecast.")}
          {level("Targets", play.targets.length ? play.targets.map((target: any) => `${target.rMultiple}R ${money(target.priceCents)}`).join(" · ") : "Not measured", play.targets[0]?.basis)}
          {level("Human review time", when(play.timeStopAt), "A review point, not an automatic exit.")}
        </div>
      </>}
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-[1.25fr_0.85fr] sm:px-5">
        <div><p className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Do not take the recipe when</p><ul className="mt-3 space-y-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{play.noTradeConditions.map((condition: string) => <li key={condition} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>{condition}</li>)}</ul></div>
        <aside className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}><ShieldCheck className="h-4 w-4" style={{ color: "var(--sh-signal)" }} />What must be confirmed</p><p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{proposalBlockedReason ?? play.trigger?.basis ?? "No trigger observation is available."}</p><div className="mt-3 flex flex-col gap-2">{proposalBlockedReason ? <Button type="button" size="sm" className="min-h-11" onClick={onReviewEvidence}><LockKeyhole className="mr-1.5 h-3.5 w-3.5" />Resolve before paper ticket</Button> : <><Button type="button" size="sm" className="min-h-11" onClick={onPrepareProposal}><LockKeyhole className="mr-1.5 h-3.5 w-3.5" />Review paper ticket</Button><Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onReviewEvidence}>Review evidence</Button></>}<Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onOpenResearch}>Why this recipe?</Button></div></aside>
      </div>
    </>}

    <div className="border-t px-4 py-3 text-xs leading-5 sm:px-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><p style={{ color: "var(--sh-fg-muted)" }}>{disclosure}</p><p className="mt-2" style={{ color: "var(--sh-fg-muted)" }}>Tape basis: {play.tapeBasis}</p>{play.assumptions.length > 0 && <details className="mt-2"><summary className="cursor-pointer font-semibold" style={{ color: "var(--sh-text-primary)" }}>Assumptions used in this recipe</summary><ul className="mt-2 space-y-1" style={{ color: "var(--sh-fg-muted)" }}>{play.assumptions.map((assumption: string) => <li key={assumption}>{assumption}</li>)}</ul></details>}</div>
    <details className="border-t px-4 py-3 sm:px-5" style={{ borderColor: "var(--sh-border-1)" }}><summary className="cursor-pointer text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Why this recipe exists · thesis and research provenance</summary><div className="mt-3 grid gap-3 text-xs leading-5 sm:grid-cols-2"><div className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>Thesis that informed it</p><p className="mt-1 whitespace-pre-line" style={{ color: "var(--sh-fg-muted)" }}>{thesisContext?.name || "Saved Capital / Trade thesis"}{thesisContext?.rawText ? `\n${thesisContext.rawText.slice(0, 520)}${thesisContext.rawText.length > 520 ? "…" : ""}` : "\nNo saved thesis text was returned for this run."}</p></div><div className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>Portfolio impact</p><p className="mt-1" style={{ color: "var(--sh-fg-muted)" }}>{alreadyHeld ? `${candidate.symbol} is already held in paper context.` : `No ${candidate.symbol} paper exposure exists until a human creates, approves, and submits a proposal.`}</p></div></div></details>
  </section>;
}
