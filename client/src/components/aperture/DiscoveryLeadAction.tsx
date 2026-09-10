import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

type Identity = { decisionRunId: number; decisionRevisionId: number; discoveryReceiptId: number; hypothesisId: string };
const control = "min-h-11 w-full rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
const path = (value: { decisionRunId: number; decisionRevisionId: number }) => `/aperture/decision/${value.decisionRunId}/revision/${value.decisionRevisionId}/underwrite`;

/** Reads reconcile an exact selection. Only the deliberate button starts work. */
export function DiscoveryLeadAction({ identity, blockedReason }: { identity: Identity; blockedReason?: string | null }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const source = { decisionRunId: identity.decisionRunId, decisionRevisionId: identity.decisionRevisionId };
  const saved = trpc.aperture.underwriter.discoverySelections.useQuery(source, { retry: false, refetchOnWindowFocus: false });
  const select = trpc.aperture.underwriter.selectDiscovery.useMutation({ retry: false });
  const [failure, setFailure] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [working, setWorking] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = useRef(identity); current.current = identity;
  const exact = (value: typeof identity) => mounted.current && JSON.stringify(current.current) === JSON.stringify(value);
  const match = (rows: NonNullable<typeof saved.data>) => rows.find(row => row.sourceDecisionRunId === identity.decisionRunId
    && row.sourceRevisionId === identity.decisionRevisionId && row.discoveryReceiptId === identity.discoveryReceiptId && row.hypothesisId === identity.hypothesisId);
  const selected = saved.data ? match(saved.data) : null;
  const readBlocked = saved.isLoading || saved.isFetching || !!saved.error || saved.data == null;
  const missingRead = saved.data == null && !saved.isLoading && !saved.isFetching;
  const readMessage = saved.error || missingRead ? "Saved selection is unavailable. Check it before starting another analysis."
    : saved.isLoading || saved.isFetching ? "Checking for a saved selection…" : null;
  async function refresh() {
    const attempted = { ...identity };
    try {
      const refreshed = await saved.refetch();
      if (!exact(attempted)) return;
      if (!refreshed.error && refreshed.data != null) { setUncertain(false); setFailure(null); }
      else { setUncertain(true); setFailure("Saved selection is still unavailable. Check again before starting another analysis."); }
    } catch {
      if (exact(attempted)) { setUncertain(true); setFailure("Saved selection is still unavailable. Check again before starting another analysis."); }
    }
  }
  async function act() {
    if (pending.current || blockedReason || readBlocked || uncertain) return;
    if (selected) { navigate(path(selected)); return; }
    pending.current = true; setWorking(true); setFailure(null);
    const attempted = { ...identity };
    try {
      // Another tab/device may have selected it since render. Reuse that task;
      // do not silently restart an interrupted job or generate another child.
      const rows = await utils.aperture.underwriter.discoverySelections.fetch(source, { staleTime: 0 });
      if (!exact(attempted)) return;
      const previous = match(rows);
      if (previous) { navigate(path(previous)); return; }
      const result = await select.mutateAsync(attempted);
      if (!exact(attempted)) return;
      if (result.sourceDecisionRunId !== attempted.decisionRunId || result.sourceRevisionId !== attempted.decisionRevisionId
        || result.discoveryReceiptId !== attempted.discoveryReceiptId || result.hypothesisId !== attempted.hypothesisId) throw new Error("Selection identity mismatch");
      navigate(path(result));
    } catch {
      if (!exact(attempted)) return;
      setUncertain(true);
      setFailure("Selection or analysis could not be confirmed. Check the saved selection before trying again; no order is created here.");
      // Retain this exact identity. Reconciliation is a read, never a retry.
      try { await saved.refetch(); } catch { /* Keep the unresolved outcome and explicit read-only recovery. */ }
    } finally { pending.current = false; if (mounted.current) setWorking(false); }
  }
  return <div className="space-y-2 border-t pt-3" style={{ borderColor: "var(--sh-border-1)" }}>
    <p className="text-sm">Research only. Capital is not allocated; source and eligibility checks remain.</p>
    {selected ? <a className={`${control} inline-flex items-center justify-center`} href={path(selected)}>Open saved analysis</a>
      : <button type="button" className={control} style={{ background: "var(--sh-primary)", color: "var(--sh-primary-fg)" }}
        disabled={readBlocked || !!blockedReason || working || uncertain} onClick={act}>{working ? "Underwriting this lead…" : "Underwrite this lead"}</button>}
    {blockedReason && <p role="alert" className="text-sm">{blockedReason}</p>}
    {(failure || readMessage) && <p role={failure || saved.error || missingRead ? "alert" : "status"} className="text-sm">
      {failure || readMessage}
    </p>}
    {(uncertain || saved.error || missingRead) && <button type="button" className={control} disabled={saved.isFetching || select.isPending} onClick={refresh}>Check saved selection</button>}
  </div>;
}
