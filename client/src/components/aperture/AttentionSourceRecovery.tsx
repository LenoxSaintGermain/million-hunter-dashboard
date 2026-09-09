import { Button } from "@/components/ui/button";
import type { AttentionSourceIssue } from "@shared/apertureAttention";

export function AttentionSourceRecovery({ issues, onOpen, onRetry, busy = false }: {
  issues: AttentionSourceIssue[]; onOpen: (href: string) => void; onRetry: () => void; busy?: boolean;
}) {
  if (!issues.length) return null;
  return <section aria-label="Source gaps and recovery" className="border-t px-4 py-3" style={{ borderColor: "var(--sh-border-1)" }}>
    {issues.map((issue, index) => <div key={`${issue.source}:${issue.href}:${index}`} className="border-b py-3 first:pt-0 last:border-0 last:pb-0" style={{ borderColor: "var(--sh-border-1)" }}>
      <p className="text-sm font-semibold">{issue.label} · {issue.state}</p>
      <p className="mt-1 text-sm leading-5">{issue.impact}</p>
      <p className="mt-1 text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>Last successful check: {issue.lastSuccessAt != null && Number.isFinite(issue.lastSuccessAt) ? new Date(issue.lastSuccessAt).toLocaleString() : "Not recorded"}.</p>
      <Button variant="outline" className="mt-2 min-h-11 whitespace-normal" aria-disabled={busy && issue.recovery === "refresh_status"} onClick={() => {
        if (issue.recovery === "refresh_status") { if (!busy) onRetry(); }
        else if (issue.href) onOpen(issue.href);
      }}>{busy && issue.recovery === "refresh_status" ? "Refreshing status…" : issue.actionLabel}</Button>
      {issue.recovery === "review_checks" && <p className="mt-1 text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>Open the play to request sourced checks. Refresh reads saved status only.</p>}
    </div>)}
  </section>;
}
