import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApertureAttentionItem } from "@shared/apertureAttention";

export function FindingEvidence({ evidence, label = "Evidence" }: { evidence: NonNullable<ApertureAttentionItem["evidence"]>; label?: string }) {
  const date = Number.isFinite(evidence.checkedAt) && Number.isFinite(new Date(evidence.checkedAt).getTime()) ? new Date(evidence.checkedAt).toLocaleString() : "Not recorded";
  return <details className="mt-2 border-t" style={{ borderColor: "var(--sh-border-1)" }}>
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">{label}</summary>
    <div className="space-y-3 pb-3 text-sm leading-6">
      <p>Recorded check: {date}. Opening evidence does not acknowledge or resolve this finding.</p>
      <p><strong>Selected-play rationale:</strong> {evidence.rationale ?? "Not included in this record. Inspect the selected play’s thesis before deciding; hedge intent is not assumed."}</p>
      <p className="whitespace-pre-wrap break-words">{evidence.finding}</p>
      {evidence.citations.length ? <div className="flex flex-wrap gap-2">{evidence.citations.map((url, index) => <a key={`${index}:${url}`} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-all underline underline-offset-4" style={{ color: "var(--sh-signal)" }}>Source {index + 1}</a>)}</div> : <p>No source links recorded. This finding is not verified evidence.</p>}
    </div>
  </details>;
}

function AttentionTime({ value, kind }: { value: number | null | undefined; kind: "checked" | "deadline" }) {
  if (value == null || !Number.isFinite(value) || !Number.isFinite(new Date(value).getTime())) return null;
  return <p className="mt-1 text-sm leading-5" style={{ color: "var(--sh-text-secondary)" }}>
    {kind === "checked" ? "Check recorded " : "Review due "}
    <time data-attention-time={kind} dateTime={new Date(value).toISOString()}>{new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</time>
  </p>;
}

/** Presentation only. The shared attention record remains the authority for priority and actions. */
export function AttentionDecisionCard({ item, prominent = false, compact = false, fingerprint, onOpen, busy = false }: {
  item: ApertureAttentionItem; prominent?: boolean; compact?: boolean; fingerprint?: string;
  onOpen: (href: string) => void; busy?: boolean;
}) {
  // Only this exact, routine explanation has a shorter equivalent. Unknown/new
  // consequences always remain visible; never classify warnings from keywords.
  const checkpointGuidance = compact && !prominent && item.consequence === "This is a human checkpoint, not proof that an automatic check or exit occurred."
    ? item.consequence : null;
  const titleId = `attention-title-${item.key}`;
  const busyId = `attention-busy-${item.key}`;
  const evidenceWarnings = item.evidence && <>
    {!item.evidence.citations.length && <p className="mt-1 text-sm leading-5">No source links recorded; finding unverified.</p>}
    {(!Number.isFinite(item.evidence.checkedAt) || !Number.isFinite(new Date(item.evidence.checkedAt).getTime())) && <p className="mt-1 text-sm leading-5">Check time not recorded.</p>}
  </>;
  const action = <Button
    variant={prominent ? "default" : "outline"}
    className={compact && !prominent ? "h-auto min-h-11 w-full whitespace-normal motion-reduce:transition-none lg:w-auto lg:self-start" : "mt-3 h-auto min-h-11 w-full whitespace-normal motion-reduce:transition-none sm:w-auto"}
    aria-disabled={busy}
    aria-describedby={busy ? busyId : undefined}
    aria-label={compact && !prominent ? `${item.actionLabel} — ${item.title}` : undefined}
    onClick={() => { if (!busy) onOpen(item.href); }}
  >{item.actionLabel}<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4 shrink-0" /></Button>;

  if (compact && !prominent) return <article aria-labelledby={titleId} data-attention-key={item.key} data-attention-layout="compact" data-attention-fingerprint={fingerprint} className="min-w-0 border-t px-4 py-3 first:border-t-0" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <div data-attention-row className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(8rem,0.7fr)_minmax(0,3fr)_minmax(10rem,1fr)] lg:items-start lg:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: item.critical ? "var(--sh-red)" : "var(--sh-signal)" }}>{item.stateLabel}</p>
        <AttentionTime value={item.deadlineAt} kind="deadline" />
        {item.evidence && <AttentionTime value={item.evidence.checkedAt} kind="checked" />}
      </div>
      <div className="min-w-0">
        <h3 id={titleId} className="break-words text-base font-semibold leading-6">{item.title}</h3>
        <p className="mt-1 break-words text-sm leading-5">{item.reason}</p>
        <p className="mt-1 break-words text-sm leading-5" style={{ color: "var(--sh-text-secondary)" }}>{checkpointGuidance ? "Human review; no automatic check or exit." : item.consequence}</p>
        {evidenceWarnings}
      </div>
      <div className="min-w-0">{action}{busy && <p id={busyId} role="status" className="mt-2 text-sm leading-5">Refreshing this task. Its action will be available when status returns.</p>}</div>
      {(item.evidence || checkpointGuidance) && <div className="min-w-0 lg:col-span-2 lg:col-start-2">
        {item.evidence && <FindingEvidence evidence={item.evidence} />}
        {checkpointGuidance && <details className="border-t" style={{ borderColor: "var(--sh-border-1)" }}><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Review details</summary><p className="pb-3 text-sm leading-6">{checkpointGuidance}</p></details>}
      </div>}
    </div>
  </article>;

  return <article aria-labelledby={titleId} data-attention-key={item.key} data-attention-layout={prominent ? "primary" : "card"} data-attention-fingerprint={fingerprint} className="min-w-0 border-t p-4 first:border-t-0" style={{ borderColor: "var(--sh-border-1)", background: prominent ? "color-mix(in srgb, var(--sh-signal) 6%, var(--sh-surface))" : "var(--sh-surface)" }}>
    <p className="text-xs font-semibold" style={{ color: item.critical ? "var(--sh-red)" : "var(--sh-signal)" }}>{prominent ? "Needs you now · " : ""}{item.stateLabel}</p>
    <h2 id={titleId} className={prominent ? "mt-1 font-serif text-xl leading-tight" : "mt-1 text-base font-semibold"}>{item.title}</h2>
    <p className="mt-2 text-sm leading-5">{item.reason}</p>
    {action}
    {busy && <p id={busyId} role="status" className="mt-2 text-sm leading-5">Refreshing this task. Its action will be available when status returns.</p>}
    <p className="mt-2 text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>{item.consequence}</p>
    {evidenceWarnings}
    {item.evidence && <FindingEvidence evidence={item.evidence} />}
  </article>;
}
