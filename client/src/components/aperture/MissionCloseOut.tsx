import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * "I am done with this mission."
 *
 * Until now nothing could be cleared: no mutation closed a mission, cancelled a
 * research run, or emptied the desk, so finished work accumulated permanently.
 *
 * Closing is a recorded decision, not a delete. The consequence is shown before
 * the operator commits, the refusals are the server's own, and the reason is
 * required — a cleared desk with no record of why is just a lost one.
 */
export function MissionCloseOut({ decisionRunId, onClosed }: {
  decisionRunId: number;
  onClosed?: () => void;
}) {
  const preview = trpc.aperture.runway.closePreview.useQuery({ decisionRunId }, { retry: false });
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const close = trpc.aperture.runway.close.useMutation({
    onSuccess: () => { setOpen(false); setReason(""); void preview.refetch(); onClosed?.(); },
  });

  if (preview.isLoading) return null;
  if (preview.isError) {
    return <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>Closure status could not be read. Nothing has been closed.</p>;
  }
  if (preview.data?.lifecycle === "closed") {
    return <p data-mission-closed role="status" className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>
      This mission is closed. Its research, evidence and receipts stay readable.
    </p>;
  }

  const assessment = preview.data;
  const blocked = assessment != null && !assessment.canClose;

  return <section data-mission-close-out className="rounded-xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <h3 className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Done with this mission?</h3>
    <p className="mt-1 text-sm leading-6" style={{ color: blocked ? "var(--sh-red)" : "var(--sh-fg-muted)" }}>
      {assessment?.consequence}
    </p>

    {!open && <Button
      data-open-close-out
      variant="outline"
      className="mt-3 h-auto min-h-11 whitespace-normal"
      aria-disabled={blocked}
      onClick={() => { if (!blocked) setOpen(true); }}
    >Close out this mission</Button>}

    {open && <div className="mt-3 space-y-2">
      <label className="block text-sm font-semibold" htmlFor={`close-reason-${decisionRunId}`}>Why are you closing it?</label>
      <Textarea
        id={`close-reason-${decisionRunId}`}
        value={reason}
        maxLength={1000}
        onChange={(event) => setReason(event.target.value)}
        className="min-h-20 text-sm"
        placeholder="Recorded with the closure. A cleared desk with no reason is a lost one."
      />
      {close.isError && <p role="alert" className="text-sm" style={{ color: "var(--sh-red)" }}>{close.error.message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          data-confirm-close-out
          className="min-h-11"
          disabled={close.isPending || reason.trim().length < 10}
          onClick={() => close.mutate({ decisionRunId, reason: reason.trim() })}
        >{close.isPending ? "Closing…" : "Close it"}</Button>
        <Button variant="ghost" className="min-h-11" disabled={close.isPending} onClick={() => { setOpen(false); setReason(""); close.reset(); }}>Keep it open</Button>
      </div>
      {reason.trim().length < 10 && <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>Add a reason of at least 10 characters.</p>}
    </div>}
  </section>;
}
