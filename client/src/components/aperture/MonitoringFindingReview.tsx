import { useRef, useState } from "react";
import { ShieldCheck, Layers, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { type MonitoringFindingSelection, type MonitoringReviewDecision, type MonitoringReviewReceipt } from "@shared/monitoringFinding";
import { isPresetReviewNote, monitoringReviewPresets } from "@shared/monitoringReviewPresets";

type Target = MonitoringFindingSelection & { runId: number; candidateId: number };

/** This form owns only a review receipt. Rendering and opening evidence never save. */
export function MonitoringFindingReview({
  target,
  onHedge,
  onExit,
  onClose,
}: {
  target: Target;
  onHedge?: () => void;
  onExit?: () => void;
  onClose?: () => void;
}) {
  const utils = (trpc as any).useUtils?.();
  const receipts = trpc.aperture.monitor.reviews.list.useQuery(target, { refetchOnWindowFocus: false });
  const [decision, setDecision] = useState<MonitoringReviewDecision | "">("");
  const [note, setNote] = useState("");
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState("");
  const [saved, setSaved] = useState<MonitoringReviewReceipt | null>(null);
  const [editing, setEditing] = useState(false);
  const request = useRef<(Target & { requestId: string; decision: MonitoringReviewDecision; note: string }) | null>(null);
  const record = trpc.aperture.monitor.reviews.record.useMutation({
    onSuccess: async (result) => {
      setSaved(result.receipt);
      setEditing(false);
      request.current = null;
      void receipts.refetch();
      if (utils?.aperture) {
        await Promise.allSettled([
          utils.aperture.desk.summary.invalidate(),
          utils.aperture.cockpit.invalidate(),
          utils.aperture.play.list.invalidate(),
          utils.aperture.monitor.list.invalidate(),
          utils.aperture.monitor.reviews.invalidate(),
        ]);
      }
      toast.success(
        result.receipt.decision === "resolved"
          ? "Finding signed off and closed. Removed from attention briefing."
          : "Review recorded."
      );
      if (result.receipt.decision === "resolved" && onClose) {
        onClose();
      }
    },
    onError: (err) => {
      toast.error(`Failed to record review: ${err.message}`);
    },
  });
  const latest = saved ?? receipts.data?.receipts.at(-1) ?? null;
  const uncertain = record.isError && request.current != null;
  const chooseDecision = (value: MonitoringReviewDecision) => {
    setDecision(value); setPendingPreset(null);
    if (isPresetReviewNote(note)) { setNote(""); setDraftNotice(""); }
    else setDraftNotice(note ? "Your note is unchanged. Check it matches this assessment." : "");
  };
  const applyPreset = (value: string) => {
    setNote(value); setPendingPreset(null); setDraftNotice("Draft added. Edit if needed, then save your review.");
  };
  const submit = () => {
    if (record.isPending || pendingPreset) return;
    if (!request.current) {
      if (!decision || note.trim().length < 10 || !receipts.data || receipts.isError) return;
      request.current = { ...target, decision, note: note.trim(), requestId: crypto.randomUUID() };
    }
    record.mutate(request.current);
  };
  return <section className="mt-3 rounded-lg border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }} aria-label="Record finding review">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
      <h3 className="text-base font-semibold">Your review</h3>
      <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "var(--sh-surface-3)", color: "var(--sh-fg-muted)" }}>
        Paper Fill Recorded · Discretionary Exit
      </span>
    </div>
    <p className="mt-1 text-sm leading-5">Saves your assessment of this finding only—not an order change or exit.</p>
    {receipts.isLoading && <p className="mt-2 text-sm" role="status">Loading saved review…</p>}
    {receipts.isError && <div className="mt-2 text-sm" role="alert"><p>Saved reviews could not load. No new review has been confirmed.</p><Button variant="outline" className="mt-2 min-h-11" onClick={() => void receipts.refetch()}>Reload saved review</Button></div>}

    {/* Primary Decision Hierarchy */}
    <div className="mt-3 rounded-lg border p-3.5 space-y-2.5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <p className="text-[11px] font-bold tracking-tight uppercase" style={{ color: "var(--sh-fg-muted)" }}>Primary Decision Actions</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Action 1: Maintain Thesis & Clear Review (Primary Solid Action) */}
        <Button
          type="button"
          className="h-auto py-2.5 px-3 flex flex-col items-start gap-1 text-left bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm border border-emerald-500"
          disabled={record.isPending || !receipts.data || receipts.isError}
          onClick={() => {
            const resolveNote = "Sign Off / Maintain: Operator verified catalyst condition; thesis and risk parameters remain intact.";
            request.current = { ...target, decision: "resolved", note: resolveNote, requestId: crypto.randomUUID() };
            setDecision("resolved");
            setNote(resolveNote);
            record.mutate(request.current);
          }}
        >
          <div className="flex items-center gap-1.5 font-bold text-xs text-white">
            <ShieldCheck className="h-4 w-4" />
            <span>Maintain Thesis & Clear Review</span>
          </div>
          <span className="text-[10px] text-emerald-100 leading-tight">Sign Off / Maintain · Acknowledge & clear</span>
        </Button>

        {/* Action 2: Hedge / Adjust (Secondary Action) */}
        <Button
          type="button"
          variant="outline"
          className="h-auto py-2.5 px-3 flex flex-col items-start gap-1 text-left border-amber-500/40 hover:bg-amber-500/10 hover:border-amber-500"
          onClick={onHedge}
        >
          <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-500">
            <Layers className="h-3.5 w-3.5" />
            <span>Hedge / Adjust</span>
          </div>
          <span className="text-[10px] text-muted-foreground leading-tight">Spread or delta hedge</span>
        </Button>

        {/* Action 3: Take Profit / Cut Loss (Secondary Action) */}
        <Button
          type="button"
          variant="outline"
          className="h-auto py-2.5 px-3 flex flex-col items-start gap-1 text-left border-primary/40 hover:bg-primary/10 hover:border-primary"
          onClick={onExit}
        >
          <div className="flex items-center gap-1.5 font-semibold text-xs text-primary">
            <DollarSign className="h-3.5 w-3.5" />
            <span>Take Profit / Exit</span>
          </div>
          <span className="text-[10px] text-muted-foreground leading-tight">Route instant paper exit</span>
        </Button>
      </div>
    </div>
    {latest && !editing ? <div className="mt-3 space-y-2">
      <p role="status" className="text-sm font-semibold">Review saved · {latest.decision === "needs_fresh_evidence" ? "Needs fresh evidence" : latest.decision === "resolved" ? "Closed" : "Concern kept open"}</p>
      <p className="text-sm">{latest.note}</p>
      <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>{new Date(latest.reviewedAt).toLocaleString()} · No check was scheduled or order changed.{latest.decision === "resolved" ? " This version has left your attention list. A later check that flags again will return." : ""}</p>
      <Button variant="outline" className="min-h-11" onClick={() => { request.current = null; setDecision(""); setNote(""); setPendingPreset(null); setDraftNotice(""); record.reset(); setEditing(true); }}>Record another review</Button>
    </div> : <div className="mt-3 space-y-3">
      <fieldset disabled={record.isPending || uncertain || !receipts.data || receipts.isError} className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">What is your assessment?</legend>
        {([
          ["resolved", "Closed — I have dealt with this", "Removes it from your attention list. A later check that flags again comes back."],
          ["reviewed_unresolved", "Still open — I have read it", "Stays on your list. Use this when you have looked but nothing is settled."],
          ["needs_fresh_evidence", "Need fresh evidence", "Stays on your list. Use this when the recorded evidence is too old to judge."],
        ] as const).map(([value, label, detail]) => <label key={value} data-review-option={value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm" style={{ borderColor: decision === value ? "var(--sh-signal)" : "var(--sh-border-1)" }}><input className="mt-1" type="radio" name={`review-${target.orderId}-${target.findingId}`} checked={decision === value} onChange={() => chooseDecision(value)} /><span className="min-w-0"><span className="block font-semibold">{label}</span><span className="block text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{detail}</span></span></label>)}
        {decision && <div className="space-y-2 pt-2" role="group" aria-label="Suggested review notes">
          <p className="text-sm">Start with a reason, or write your own.</p>
          <div className="flex flex-wrap gap-2">{monitoringReviewPresets[decision].map(preset => <Button key={preset.label} type="button" variant="outline" className="min-h-11 h-auto whitespace-normal" aria-pressed={note === preset.note} onClick={() => {
            if (note.trim() && note !== preset.note) setPendingPreset(preset.note);
            else applyPreset(preset.note);
          }}>{preset.label}</Button>)}</div>
          {pendingPreset && <div className="rounded-md border p-3 text-sm" role="group" aria-label="Replace draft note">
            <p className="font-semibold">Replace your current note?</p><p className="mt-1">{pendingPreset}</p>
            <div className="mt-2 flex flex-wrap gap-2"><Button type="button" variant="outline" className="min-h-11" onClick={() => applyPreset(pendingPreset)}>Replace note</Button><Button type="button" variant="ghost" className="min-h-11" onClick={() => setPendingPreset(null)}>Keep my note</Button></div>
          </div>}
        </div>}
        <label className="block text-sm font-semibold" htmlFor={`review-note-${target.findingId}`}>{decision === "resolved" ? "Why you are closing it" : "Reason or next check"}</label>
        <textarea id={`review-note-${target.findingId}`} rows={2} maxLength={1000} value={note} onChange={event => { setNote(event.target.value); setPendingPreset(null); setDraftNotice(""); }} className="w-full rounded-md border p-3 text-base" style={{ background: "var(--sh-surface)" }} placeholder={decision === "resolved" ? "Why is this closed?" : "What still needs to be verified for this play?"} />
        {draftNotice && <p role="status" className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>{draftNotice}</p>}
      </fieldset>
      {record.isError && <div role="alert" className="text-sm"><p>Saving was not confirmed. Check the saved receipt or retry this same request; do not assume the finding was reviewed.</p><Button variant="outline" className="mt-2 min-h-11" onClick={() => void receipts.refetch()}>Check saved receipt</Button></div>}
      <Button className="min-h-11 w-full sm:w-auto" disabled={record.isPending || !!pendingPreset || (!uncertain && (!decision || note.trim().length < 10 || !receipts.data || receipts.isError))} onClick={submit}>{record.isPending ? "Saving review…" : uncertain ? "Retry same review" : "Save review"}</Button>
      {pendingPreset && <p className="text-sm">Choose which note to keep before saving.</p>}
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
