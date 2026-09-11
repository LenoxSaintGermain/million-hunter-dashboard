import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApertureAttentionItem } from "@shared/apertureAttention";
import { coveredByInvariant } from "@shared/operatingInvariant";
import Markdown from "react-markdown";

function evidenceUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? value : undefined;
  } catch { return undefined; }
}

/** Provenance stays one deliberate action away once it would dominate the card. */
const INLINE_SOURCE_LIMIT = 3;

function sourceLinks(citations: string[]) {
  return citations.map((url, index) => evidenceUrl(url)
    ? <a key={`${index}:${url}`} href={evidenceUrl(url)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-all underline underline-offset-4" style={{ color: "var(--sh-signal)" }}>Source {index + 1}</a>
    : <span key={`${index}:${url}`} className="inline-flex min-h-11 items-center">Source {index + 1} · link unavailable</span>);
}

export function FindingEvidence({ evidence, label = "Evidence", expanded = false }: { evidence: NonNullable<ApertureAttentionItem["evidence"]>; label?: string; expanded?: boolean }) {
  const date = Number.isFinite(evidence.checkedAt) && Number.isFinite(new Date(evidence.checkedAt).getTime()) ? new Date(evidence.checkedAt).toLocaleString() : "Not recorded";
  return <details open={expanded || undefined} className="mt-2 border-t" style={{ borderColor: "var(--sh-border-1)" }}>
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">{label}</summary>
    <div className="space-y-3 pb-3 text-sm leading-6">
      <p>Recorded check: {date}. Opening evidence does not acknowledge or resolve this finding.</p>
      <p><strong>Selected-play rationale:</strong> {evidence.rationale ?? "Not included in this record. Inspect the selected play’s thesis before deciding; hedge intent is not assumed."}</p>
      <div className="min-w-0 break-words [&_p]:my-2 [&_li]:ml-5 [&_ul]:list-disc [&_ol]:list-decimal"><Markdown
        rehypePlugins={[]}
        remarkPlugins={[]}
        skipHtml
        allowedElements={["p", "strong", "em", "ul", "ol", "li", "blockquote", "br", "a", "code", "pre", "hr", "h1", "h2", "h3", "h4", "h5", "h6"]}
        components={{
          a: ({ href, children }) => evidenceUrl(href) ? <a href={evidenceUrl(href)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4" style={{ color: "var(--sh-signal)" }}>{children}</a> : <span>{children} (link unavailable)</span>,
          code: ({ children }) => <code className="whitespace-pre-wrap break-words">{children}</code>,
          pre: ({ children }) => <pre className="whitespace-pre-wrap break-words">{children}</pre>,
          h1: ({ children }) => <p className="font-semibold">{children}</p>,
          h2: ({ children }) => <p className="font-semibold">{children}</p>,
          h3: ({ children }) => <p className="font-semibold">{children}</p>,
          h4: ({ children }) => <p className="font-semibold">{children}</p>,
          h5: ({ children }) => <p className="font-semibold">{children}</p>,
          h6: ({ children }) => <p className="font-semibold">{children}</p>,
        }}
      >{evidence.finding}</Markdown></div>
      {evidence.citations.length ? (evidence.citations.length > INLINE_SOURCE_LIMIT
        ? <details className="rounded-lg border" style={{ borderColor: "var(--sh-border-1)" }}><summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">Sources · {evidence.citations.length}</summary><div className="flex flex-wrap gap-2 border-t px-3 py-2" style={{ borderColor: "var(--sh-border-1)" }}>{sourceLinks(evidence.citations)}</div></details>
        : <div className="flex flex-wrap gap-2">{sourceLinks(evidence.citations)}</div>) : <p>No source links recorded. This finding is not verified evidence.</p>}
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
  // The workspace banner states the operating invariant once. A consequence it
  // covers in full, matched as a whole sentence, moves behind the disclosure
  // rather than repeating on every row. Unknown or newly written consequences
  // always stay visible; warnings are never classified by keyword.
  const routine = coveredByInvariant(item.consequence);
  const checkpointGuidance = routine ? item.consequence : null;
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
        {!routine && <p className="mt-1 break-words text-sm leading-5" style={{ color: "var(--sh-text-secondary)" }}>{item.consequence}</p>}
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
    {!routine && <p className="mt-2 text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>{item.consequence}</p>}
    {evidenceWarnings}
    {item.evidence && <FindingEvidence evidence={item.evidence} />}
  </article>;
}
