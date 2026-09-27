import { Button } from "@/components/ui/button";
import type { AttentionSourceIssue } from "@shared/apertureAttention";

export function AttentionSourceRecovery({ issues, onOpen, onRetry, busy = false }: {
  issues: AttentionSourceIssue[]; onOpen: (href: string) => void; onRetry: () => void; busy?: boolean;
}) {
  if (!issues.length) return null;
  const impacts = Array.from(new Set(issues.map(issue => issue.impact)));
  return <section aria-label="Source gaps and recovery" className="border-t px-4 py-3" style={{ borderColor: "var(--sh-border-1)" }}>
    <h2 className="text-sm font-semibold">Checks needing attention · {issues.length}</h2>
    {impacts.map(impact => <p key={impact} className="mt-1 text-sm leading-5">{impact}</p>)}
    {issues.some(issue => issue.recovery === "review_checks") && <p className="mt-1 text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>Review a play to request fresh checks. Refresh reads saved status only.</p>}
    {issues.map((issue, index) => <div key={`${issue.source}:${issue.href}:${index}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b py-2 last:border-0 last:pb-0" style={{ borderColor: "var(--sh-border-1)" }}>
      <div className="min-w-0">
      <p className="text-sm font-semibold">{issue.label} · {issue.state}</p>
      <p className="text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>Last successful check: {issue.lastSuccessAt != null && Number.isFinite(issue.lastSuccessAt) ? new Date(issue.lastSuccessAt).toLocaleString() : "Not recorded"}.</p>
      </div>
      <Button variant="outline" className="min-h-11 whitespace-normal" aria-disabled={busy && issue.recovery === "refresh_status"} onClick={() => {
        if (issue.recovery === "refresh_status") { if (!busy) onRetry(); }
        else if (issue.href) onOpen(issue.href);
      }}>{busy && issue.recovery === "refresh_status" ? "Refreshing status…" : issue.actionLabel}</Button>
    </div>)}
  </section>;
}
