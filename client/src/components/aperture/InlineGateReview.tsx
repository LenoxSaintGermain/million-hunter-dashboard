import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

type Target = { decisionRunId: number; revisionId: number };

/** Route selection only; the existing receipt query enforces owner and binding. */
export function inlineGateTarget(item: { kind: string; key: string; href: string; reviewKind?: string }): Target | null {
  if (item.kind !== "review_due" || item.reviewKind !== "gate_review") return null;
  const match = /^\/aperture\/decision\/(\d+)\/revision\/(\d+)$/.exec(item.href);
  if (!match) return null;
  const decisionRunId = Number(match[1]), revisionId = Number(match[2]);
  return [decisionRunId, revisionId].every(id => Number.isSafeInteger(id) && id > 0) ? { decisionRunId, revisionId } : null;
}

/** Read the original receipt, not the latest unrelated mission. No mutation on mount. */
export function InlineGateReview({ target, onRevise }: { target: Target; onRevise: () => void }) {
  const query = trpc.aperture.runway.latest.useQuery(target, { refetchOnWindowFocus: false, retry: false });
  const receipt = query.data?.latest;
  if (query.isLoading) return <p role="status" className="text-sm">Loading this saved condition…</p>;
  if (query.isError || !receipt || receipt.authority !== "authoritative"
    || receipt.decisionRunId !== target.decisionRunId || receipt.decisionRevisionId !== target.revisionId
    || receipt.branch !== "conditional") return <div role="alert" className="space-y-2 text-sm">
    <p>This gate record could not be verified. No gate was cleared or order changed.</p>
    <Button variant="outline" className="min-h-11" onClick={() => void query.refetch()}>Retry saved gate</Button>
  </div>;
  return <div className="space-y-3 text-sm leading-6">
    <p className="font-semibold">{receipt.binding.accountLabel} · revision {receipt.binding.decisionVersion}</p>
    <dl className="space-y-2">
      <div><dt className="font-semibold">Why it was held</dt><dd>{receipt.blocker || receipt.reason || "No blocker was recorded."}</dd></div>
      <div><dt className="font-semibold">What must change</dt><dd>{receipt.reopenCondition || "The reopening condition was not recorded. Clarify it before reassessing."}</dd></div>
    </dl>
    <p>This is the saved condition; it has not been re-evaluated against fresh data. No gate was cleared or order changed.</p>
    <Button variant="outline" className="min-h-11" onClick={onRevise}>Revise this condition</Button>
    <p style={{ color: "var(--sh-fg-muted)" }}>Opens this exact decision for deliberate revision. Existing approvals and orders stay unchanged.</p>
  </div>;
}
