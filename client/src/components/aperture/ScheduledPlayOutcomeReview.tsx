import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Review = inferRouterOutputs<AppRouter>["aperture"]["playOutcome"]["list"][number];

export function ScheduledPlayOutcomeReview({ runId, candidateId }: { runId: number; candidateId?: number }) {
  const query = trpc.aperture.playOutcome.list.useQuery({ runId });
  if (query.isLoading) return <p role="status">Loading scheduled outcome reviews…</p>;
  if (query.isError) return <section role="alert"><p>Scheduled reviews could not be loaded. Nothing was resolved.</p><Button variant="outline" onClick={() => void query.refetch()}>Retry scheduled reviews</Button></section>;
  const reviews = (query.data ?? []).filter(row => candidateId == null || row.evidence.candidateId === candidateId);
  if (!reviews.length) return <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>No order-linked scheduled review is available for this selection. This does not establish that its outcome is resolved.</p>;
  return <section aria-label="Scheduled outcome reviews" className="space-y-4">
    {reviews.map(review => <ScheduledOutcomeForm key={`${review.evidence.reviewId}:${review.evidenceVersion}:${review.status}`} review={review} onSaved={() => void query.refetch()} />)}
  </section>;
}

export function ScheduledOutcomeForm({ review, onSaved }: { review: Review; onSaved: () => void }) {
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saved, setSaved] = useState(false);
  const utils = trpc.useUtils();
  const record = trpc.aperture.playOutcome.record.useMutation({
    onSuccess: () => {
      setSaved(true); onSaved();
      void utils.aperture.runway.pending.invalidate();
      void utils.aperture.desk.summary.invalidate();
      void utils.aperture.cockpit.invalidate();
    },
  });
  const { evidence } = review;
  const order = evidence.orders.find(row => row.id === evidence.orderId);
  const resolved = review.status === "resolved" || saved;
  const noteId = `outcome-note-${evidence.reviewId}`;
  return <article className="space-y-3 border-t-2 py-4" style={{ borderColor: "var(--sh-text-primary)" }}>
    <p className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--sh-signal)" }}>Scheduled review · #{evidence.reviewId}</p>
    <h3 className="font-serif text-xl">{order?.symbol ?? "Paper play"} · {resolved ? "Review recorded" : "Record your outcome review"}</h3>
    {resolved ? <div role="status" className="space-y-2">
      <p className="text-sm">This scheduled review is complete. Orders and positions are unchanged.</p>
      <p className="text-sm whitespace-pre-wrap">{typeof review.result?.note === "string" ? review.result.note : note}</p>
      {typeof review.result?.recordedAt === "number" && <p className="text-xs">Recorded {new Date(review.result.recordedAt).toLocaleString()} · evidence snapshot preserved</p>}
    </div> : <>
      <p className="text-sm">{evidence.reviewBasis}</p>
      <p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>Due {new Date(evidence.dueAt).toLocaleString()} · order #{evidence.orderId} · decision #{evidence.decisionRunId} / revision #{evidence.revisionId}</p>
      <details className="border-y py-3" style={{ borderColor: "var(--sh-border-1)" }}>
        <summary className="cursor-pointer text-sm">Review saved order evidence · {evidence.orders.length} records</summary>
        <ul className="mt-3 space-y-2 text-sm">{evidence.orders.map(row => <li key={row.id}>
          #{row.id} · {row.side.toUpperCase()} · {row.intent ?? "Intent unknown"} · {row.status}
          <span className="block text-xs">Filled quantity: {row.filledQty ?? "Not recorded"} · Average fill: {row.filledAvgPriceCents == null ? "Not recorded" : `$${(row.filledAvgPriceCents / 100).toFixed(2)}`} · Recorded {new Date(row.updatedAt).toLocaleString()}</span>
        </li>)}</ul>
        <p className="mt-3 text-xs">Saved broker records, not a fresh balance check. Related buys and sells do not establish a matched round trip or verified P&amp;L.</p>
      </details>
      {review.canRecord ? <form className="space-y-3" onSubmit={event => {
        event.preventDefault();
        if (!confirmed || note.trim().length < 10 || record.isPending) return;
        record.mutate({ runId: evidence.runId, reviewId: evidence.reviewId, evidenceVersion: review.evidenceVersion, note: note.trim(), confirm: true });
      }}>
        <label htmlFor={noteId} className="block text-sm">What did you learn? Note any remaining uncertainty.</label>
        <Textarea id={noteId} value={note} onChange={event => { setNote(event.target.value); setConfirmed(false); }} minLength={10} maxLength={2000} required disabled={record.isPending} />
        <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={record.isPending} onChange={event => setConfirmed(event.target.checked)} />
          <span>I reviewed these saved records. Close this scheduled review only—not a position, order, or risk check. The saved note cannot be overwritten.</span>
        </label>
        {record.error && <p role="alert" className="text-sm">{record.error.message} Nothing was auto-dismissed. <button type="button" className="underline" onClick={() => { setConfirmed(false); onSaved(); }}>Reload review evidence</button></p>}
        <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={!confirmed || note.trim().length < 10 || record.isPending}>{record.isPending ? "Recording review…" : "Record review & close reminder"}</Button>
      </form> : <p className="text-sm">{review.status === "cancelled" ? "This scheduled review was cancelled; no new review can be recorded here." : "Recording is unavailable until the scheduled time and a recorded fill. Refresh saved records after those conditions change."}</p>}
    </>}
  </article>;
}
