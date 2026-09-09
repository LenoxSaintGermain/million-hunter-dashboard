import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApertureAttentionItem } from "@shared/apertureAttention";

export function FindingEvidence({ evidence, label = "Evidence" }: { evidence: NonNullable<ApertureAttentionItem["evidence"]>; label?: string }) {
  const date = Number.isFinite(evidence.checkedAt) ? new Date(evidence.checkedAt).toLocaleString() : "Not recorded";
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

/** Same decision-depth card on Today and Play Desk; complete narrative is evidence-depth. */
export function AttentionDecisionCard({ item, prominent = false, fingerprint, onOpen, busy = false }: {
  item: ApertureAttentionItem; prominent?: boolean; fingerprint?: string;
  onOpen: (href: string) => void; busy?: boolean;
}) {
  return <article data-attention-key={item.key} data-attention-fingerprint={fingerprint} className="min-w-0 border-t p-4 first:border-t-0" style={{ borderColor: "var(--sh-border-1)", background: prominent ? "color-mix(in srgb, var(--sh-signal) 6%, var(--sh-surface))" : "var(--sh-surface)" }}>
    <p className="text-xs font-semibold" style={{ color: item.critical ? "var(--sh-red)" : "var(--sh-signal)" }}>{prominent ? "Needs you now · " : ""}{item.stateLabel}</p>
    <h2 className={prominent ? "mt-1 font-serif text-xl leading-tight" : "mt-1 text-base font-semibold"}>{item.title}</h2>
    <p className="mt-2 text-sm leading-5">{item.reason}</p>
    <Button variant={prominent ? "default" : "outline"} className="mt-3 min-h-11 w-full whitespace-normal sm:w-auto" aria-disabled={busy} onClick={() => { if (!busy) onOpen(item.href); }}>{item.actionLabel}<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4 shrink-0" /></Button>
    <p className="mt-2 text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>{item.consequence}</p>
    {item.evidence && <FindingEvidence evidence={item.evidence} />}
  </article>;
}
