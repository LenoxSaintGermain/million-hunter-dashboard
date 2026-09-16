import { ArrowRight, ExternalLink } from "lucide-react";
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

export function getCitationDomain(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host.includes("sec.gov")) return "SEC EDGAR 10-Q";
    if (host.includes("bloomberg.com")) return "Bloomberg";
    if (host.includes("reuters.com")) return "Reuters";
    if (host.includes("wsj.com")) return "WSJ";
    if (host.includes("cnbc.com")) return "CNBC";
    if (host.includes("ft.com")) return "Financial Times";
    if (host.includes("yahoo.com")) return "Yahoo Finance";
    if (host.includes("seekingalpha.com")) return "Seeking Alpha";
    if (host.includes("prnewswire.com")) return "PR Newswire";
    if (host.includes("globenewswire.com")) return "GlobeNewswire";
    const parts = host.split(".");
    return parts[0]?.toUpperCase() || host;
  } catch {
    return "Source";
  }
}

/** Provenance stays one deliberate action away once it would dominate the card. */
const INLINE_SOURCE_LIMIT = 3;

function parseCatalystSummary(text: string | undefined) {
  if (!text) return null;
  const isEarnings = /earnings|q[1-4]\s*(?:results|report|release)|consensus|eps/i.test(text);
  const isCatalyst = isEarnings || /catalyst|invalidation|fda|guidance|announcement|trial/i.test(text);
  if (!isCatalyst) return null;

  const daysMatch = text.match(/\bin\s+(\d+)\s+days?\b|\b(\d+)\s+days?\s+away\b|\b(\d+)d\b/i);
  const days = daysMatch ? (daysMatch[1] ?? daysMatch[2] ?? daysMatch[3]) : null;
  const dateMatch = text.match(/(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember))\s+\d{1,2}(?:,\s*\d{4})?/i);
  const moveMatch = text.match(/[±+-]?\d+(?:\.\d+)?%/);
  const epsMatch = text.match(/\$\d+(?:\.\d+)?\s*(?:consensus|EPS)?/i);

  return {
    isEarnings,
    headline: isEarnings ? (days ? `Earnings in ${days}d` : "Earnings Catalyst") : "Event Catalyst",
    date: dateMatch ? dateMatch[0] : null,
    expectedMove: moveMatch ? moveMatch[0] : null,
    consensusEps: epsMatch ? epsMatch[0] : null,
  };
}

function sourceLinks(citations: string[]) {
  return citations.map((url, index) => {
    const valid = evidenceUrl(url);
    const domain = valid ? getCitationDomain(valid) : "Link";
    return valid ? (
      <a
        key={`${index}:${url}`}
        href={valid}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:underline"
        style={{
          borderColor: "var(--sh-border-1)",
          background: "var(--sh-surface-2)",
          color: "var(--sh-signal)",
        }}
      >
        <span>Source {index + 1} · {domain}</span>
        <ExternalLink className="h-3 w-3 opacity-60" />
      </a>
    ) : (
      <span
        key={`${index}:${url}`}
        className="inline-flex min-h-8 items-center rounded-md border px-2 py-1 text-xs"
        style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}
      >
        Source {index + 1} · link unavailable
      </span>
    );
  });
}

export function FindingEvidence({ evidence, label = "Evidence", expanded = false }: { evidence: NonNullable<ApertureAttentionItem["evidence"]>; label?: string; expanded?: boolean }) {
  const date = Number.isFinite(evidence.checkedAt) && Number.isFinite(new Date(evidence.checkedAt).getTime()) ? new Date(evidence.checkedAt).toLocaleString() : "Not recorded";
  const catalyst = parseCatalystSummary(evidence.finding);

  return <details open={expanded || undefined} className="mt-2 border-t" style={{ borderColor: "var(--sh-border-1)" }}>
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">{label}</summary>
    <div className="space-y-3 pb-3 text-sm leading-6">
      <p>Recorded check: {date}. Opening evidence does not acknowledge or resolve this finding.</p>
      <p><strong>Selected-play rationale:</strong> {evidence.rationale ?? "Not included in this record. Inspect the selected play’s thesis before deciding; hedge intent is not assumed."}</p>
      {catalyst && (
        <div data-catalyst-summary className="rounded-lg border p-3 text-xs" style={{ background: "var(--sh-surface-2)", borderColor: "color-mix(in srgb, var(--sh-signal) 30%, var(--sh-border-1))" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: "color-mix(in srgb, var(--sh-signal) 15%, transparent)", color: "var(--sh-signal)" }}>
              ⚠️ {catalyst.headline}
            </span>
            {catalyst.date && <span className="font-mono text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>{catalyst.date}</span>}
          </div>
          {(catalyst.expectedMove || catalyst.consensusEps) && (
            <div className="mt-2 flex flex-wrap gap-4 text-xs font-mono">
              {catalyst.expectedMove && <div><span style={{ color: "var(--sh-fg-muted)" }}>Expected Move: </span><span className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>{catalyst.expectedMove}</span></div>}
              {catalyst.consensusEps && <div><span style={{ color: "var(--sh-fg-muted)" }}>Consensus EPS: </span><span className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>{catalyst.consensusEps}</span></div>}
            </div>
          )}
        </div>
      )}
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
      {evidence.citations.length ? (() => {
        const domainList = Array.from(new Set(evidence.citations.map(getCitationDomain))).filter(Boolean);
        const domainSummary = domainList.length > 0 ? ` · ${domainList.slice(0, 3).join(", ")}${domainList.length > 3 ? "..." : ""}` : "";
        return evidence.citations.length > INLINE_SOURCE_LIMIT
          ? <details className="rounded-lg border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground">Sourced from {evidence.citations.length} market feeds ▾{domainSummary}</summary><div className="flex flex-wrap gap-2 border-t p-3" style={{ borderColor: "var(--sh-border-1)" }}>{sourceLinks(evidence.citations)}</div></details>
          : <div className="flex flex-wrap gap-2">{sourceLinks(evidence.citations)}</div>;
      })() : <p>No source links recorded. This finding is not verified evidence.</p>}
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
export function AttentionDecisionCard({ item, prominent = false, compact = false, fingerprint, onOpen, busy = false, onDismiss, reviewOpen }: {
  item: ApertureAttentionItem; prominent?: boolean; compact?: boolean; fingerprint?: string;
  onOpen: (href: string) => void; busy?: boolean;
  /** Quiets this row on this device only. Resolves nothing. */
  onDismiss?: () => void;
  /** The parent renders the exact evidence below this card while open. */
  reviewOpen?: boolean;
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
    aria-expanded={reviewOpen}
    aria-label={compact && !prominent ? `${reviewOpen ? "Close review" : item.actionLabel} — ${item.title}` : undefined}
    onClick={() => { if (!busy) onOpen(item.href); }}
  >{reviewOpen ? "Close review" : item.actionLabel}{!reviewOpen && <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4 shrink-0" />}</Button>;

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
      <div className="min-w-0">{action}{onDismiss && <Button variant="ghost" size="sm" data-dismiss-attention className="mt-2 h-auto min-h-11 w-full whitespace-normal lg:w-auto" onClick={onDismiss} title="Hide on this device. Nothing is resolved; it returns if its state changes.">Dismiss</Button>}{busy && <p id={busyId} role="status" className="mt-2 text-sm leading-5">Refreshing this task. Its action will be available when status returns.</p>}</div>
      {(item.evidence || checkpointGuidance) && <div className="min-w-0 lg:col-span-2 lg:col-start-2">
        {item.evidence && !reviewOpen && <FindingEvidence evidence={item.evidence} />}
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
    {item.evidence && !reviewOpen && <FindingEvidence evidence={item.evidence} />}
  </article>;
}
