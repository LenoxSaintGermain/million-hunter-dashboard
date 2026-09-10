import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { type MonitoringFindingSelection, type MonitoringReviewDecision, type MonitoringReviewReceipt } from "@shared/monitoringFinding";

type Target = MonitoringFindingSelection & { runId: number; candidateId: number };

/** This form owns only a review receipt. Rendering and opening evidence never save. */
export function MonitoringFindingReview({ target }: { target: Target }) {
  const receipts = trpc.aperture.monitor.reviews.list.useQuery(target, { refetchOnWindowFocus: false });
  const [decision, setDecision] = useState<MonitoringReviewDecision | "">("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<MonitoringReviewReceipt | null>(null);
  const [editing, setEditing] = useState(false);
  const request = useRef<(Target & { requestId: string; decision: MonitoringReviewDecision; note: string }) | null>(null);
  const record = trpc.aperture.monitor.reviews.record.useMutation({
    onSuccess: result => { setSaved(result.receipt); setEditing(false); request.current = null; void receipts.refetch(); },
  });
  const latest = saved ?? receipts.data?.receipts.at(-1) ?? null;
  const uncertain = record.isError && request.current != null;
  const submit = () => {
    if (record.isPending) return;
    if (!request.current) {
      if (!decision || note.trim().length < 10 || !receipts.data || receipts.isError) return;
      request.current = { ...target, decision, note: note.trim(), requestId: crypto.randomUUID() };
    }
    record.mutate(request.current);
  };
  return <section className="mt-3 rounded-lg border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }} aria-label="Record finding review">
    <h3 className="text-base font-semibold">Your review</h3>
    <p className="mt-1 text-sm leading-5">Records your assessment of this version. It does not clear the finding or change an order.</p>
    {receipts.isLoading && <p className="mt-2 text-sm" role="status">Loading saved review…</p>}
    {receipts.isError && <div className="mt-2 text-sm" role="alert"><p>Saved reviews could not load. No new review has been confirmed.</p><Button variant="outline" className="mt-2 min-h-11" onClick={() => void receipts.refetch()}>Reload saved review</Button></div>}
    {latest && !editing ? <div className="mt-3 space-y-2">
      <p role="status" className="text-sm font-semibold">Review saved · {latest.decision === "needs_fresh_evidence" ? "Needs fresh evidence" : "Concern kept open"}</p>
      <p className="text-sm">{latest.note}</p>
      <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>{new Date(latest.reviewedAt).toLocaleString()} · No check was scheduled or order changed.</p>
      <Button variant="outline" className="min-h-11" onClick={() => { request.current = null; setDecision(""); setNote(""); record.reset(); setEditing(true); }}>Record another review</Button>
    </div> : <div className="mt-3 space-y-3">
      <fieldset disabled={record.isPending || uncertain || !receipts.data || receipts.isError} className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">What is your assessment?</legend>
        {([ ["needs_fresh_evidence", "Need fresh evidence"], ["reviewed_unresolved", "Reviewed; keep concern open"] ] as const).map(([value, label]) => <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm"><input type="radio" name={`review-${target.orderId}-${target.findingId}`} checked={decision === value} onChange={() => setDecision(value)} />{label}</label>)}
        <label className="block text-sm font-semibold" htmlFor={`review-note-${target.findingId}`}>Reason or next check</label>
        <textarea id={`review-note-${target.findingId}`} rows={2} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} className="w-full rounded-md border p-3 text-base" style={{ background: "var(--sh-surface)" }} placeholder="What still needs to be verified for this play?" />
      </fieldset>
      {record.isError && <div role="alert" className="text-sm"><p>Saving was not confirmed. Check the saved receipt or retry this same request; do not assume the finding was reviewed.</p><Button variant="outline" className="mt-2 min-h-11" onClick={() => void receipts.refetch()}>Check saved receipt</Button></div>}
      <Button className="min-h-11 w-full sm:w-auto" disabled={record.isPending || (!uncertain && (!decision || note.trim().length < 10 || !receipts.data || receipts.isError))} onClick={submit}>{record.isPending ? "Saving review…" : uncertain ? "Retry same review" : "Save review"}</Button>
      {!decision || note.trim().length < 10 ? <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>Choose an assessment and add a reason (at least 10 characters).</p> : null}
    </div>}
    {(receipts.data?.receipts.length ?? 0) > 1 && <details className="mt-3 border-t"><summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">Earlier reviews of this version</summary><ul className="space-y-2 text-sm">{receipts.data!.receipts.slice(0, -1).map(receipt => <li key={receipt.requestId}>{new Date(receipt.reviewedAt).toLocaleString()} · {receipt.note}</li>)}</ul></details>}
  </section>;
}

/** Called only for an explicit exact-finding navigation, not a provider refresh. */
export function revealMonitoringFinding(element: Pick<HTMLElement, "querySelectorAll" | "focus" | "scrollIntoView">, interrupted = false) {
  for (const details of Array.from(element.querySelectorAll("details")).slice(0, 1)) (details as HTMLDetailsElement).open = true;
  if (interrupted) return;
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: "start", behavior: "instant" });
}
