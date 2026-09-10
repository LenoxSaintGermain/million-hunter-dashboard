import React, { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

type Source = { accountId: number; runId: number; candidateId: number; orderId: number };
const control = "min-h-11 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

/** Key this component by the exact source. Opening it only reads saved evidence. */
export function SourceExecutionEvidence({ source, refreshEnabled }: { source: Source; refreshEnabled: boolean }) {
  const saved = trpc.aperture.strategy.executionEvidence.useQuery(source, { retry: false, refetchOnWindowFocus: false });
  const refresh = trpc.aperture.strategy.refreshExecutionEvidence.useMutation({ retry: false });
  const abandon = trpc.aperture.strategy.abandonExecutionEvidence.useMutation({ retry: false });
  const [uncertain, setUncertain] = useState(false);
  const [working, setWorking] = useState(false);
  const request = useRef<string | null>(null);
  const busy = useRef(false);
  const latest = saved.data?.latest;
  const receipt = saved.data?.lastSuccessful?.receipt;
  const reconciliation = saved.data?.reconciliation;
  const blocked = !refreshEnabled || saved.isLoading || saved.isFetching || !!saved.error || !saved.data || latest?.state === "pending" || uncertain || working;
  async function check() {
    if (busy.current) return;
    busy.current = true; setWorking(true);
    try {
      const result = await saved.refetch();
      if (!result.error && result.data) {
        setUncertain(false);
        if (result.data.latest?.requestId === request.current && result.data.latest.state !== "pending") request.current = null;
      }
    } finally { busy.current = false; setWorking(false); }
  }
  async function readBroker() {
    if (busy.current || blocked) return;
    busy.current = true; setWorking(true);
    // Keep this identity after an uncertain response, including when no saved
    // attempt has appeared yet. Retrying cannot launch a duplicate refresh.
    request.current ??= crypto.randomUUID();
    try {
      await refresh.mutateAsync({ ...source, requestId: request.current });
      const result = await saved.refetch();
      if (result.error || !result.data) setUncertain(true);
      else if (result.data.latest?.requestId === request.current && result.data.latest.state !== "pending") request.current = null;
    } catch { setUncertain(true); }
    finally { busy.current = false; setWorking(false); }
  }
  async function discard() {
    if (busy.current || latest?.state !== "pending" || saved.error || saved.isFetching) return;
    busy.current = true; setWorking(true);
    try {
      await abandon.mutateAsync({ ...source, requestId: latest.requestId });
      const result = await saved.refetch();
      setUncertain(!!result.error || !result.data);
      if (!result.error && result.data?.latest?.requestId === latest.requestId && result.data.latest.state !== "pending") request.current = null;
    } catch { setUncertain(true); }
    finally { busy.current = false; setWorking(false); }
  }
  const warning = saved.error ? "Saved execution evidence is unavailable. Check again or inspect the source order."
    : uncertain ? "Refresh outcome unconfirmed. Check the saved result before retrying."
    : latest?.state === "pending" ? "A refresh was requested; completion is unconfirmed. Check its saved status."
    : latest?.failureCode === "execution_abandoned" ? "Refresh discarded. Earlier evidence is unchanged; you can start a new check."
    : latest?.state === "failed" ? "The last refresh failed. Earlier evidence, if shown, is unchanged."
    : null;
  return <section aria-label="Source execution evidence" className="space-y-2 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--sh-border-1)" }}>
    <h4 className="font-semibold">Gains not verified</h4>
    <p>Fills alone do not establish profit. Cost basis, fees and available proceeds still need reconciliation.</p>
    <div role="status" aria-live="polite">
      {saved.isLoading ? "Reading saved evidence…" : receipt
        ? `${receipt.executions.length} recorded fill${receipt.executions.length === 1 ? "" : "s"} · checked ${new Date(receipt.observedAt).toLocaleString()}`
        : !saved.error ? "No completed execution check recorded." : null}
    </div>
    {latest?.state === "pending" && <details>
      <summary className="min-h-11 cursor-pointer py-2">Refresh interrupted?</summary>
      <p>Discard this attempt to allow a new check. Its record is kept; any late response is ignored. This does not stop the broker request or cancel an order.</p>
      <button type="button" className={control} disabled={working || !!saved.error || saved.isFetching} onClick={discard}>Discard unconfirmed refresh</button>
    </details>}
    {warning && <p role="alert">{warning}</p>}
    {reconciliation?.state === "matched" && <p className="tabular-nums">Recorded gross proceeds: ${reconciliation.grossProceedsUsd} before fees · {reconciliation.filledQuantity} filled. Not available profit.</p>}
    {reconciliation?.state === "inconsistent" && <p role="alert">{reconciliation.reason} Inspect the source order before using these proceeds.</p>}
    {!refreshEnabled && <p>Broker refresh is unavailable in this environment. Planning remains hypothetical.</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={control} disabled={blocked} onClick={readBroker}>{working ? "Checking…" : "Refresh paper executions"}</button>
      <button type="button" className={control} disabled={working || saved.isFetching} onClick={check}>Check saved status</button>
      <a className={`${control} inline-flex items-center`} href={`/aperture/run/${source.runId}/execute?candidate=${source.candidateId}&order=${source.orderId}&account=${source.accountId}`}>Inspect source order</a>
    </div>
    <p>Refresh reads the paper broker; it does not allocate capital or change an order.</p>
  </section>;
}
