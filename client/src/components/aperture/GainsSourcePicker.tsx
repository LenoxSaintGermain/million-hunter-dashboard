import React, { useId, useState } from "react";
import { trpc } from "@/lib/trpc";
import { paperInstrumentDisplayLabel } from "@shared/paperInstrument";

type Source = { accountId: number; runId: number; candidateId: number; orderId: number };
const control = "min-h-11 rounded-md border px-3 py-2 text-sm disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export function GainsSourcePicker({ source, disabled, onChoose }: { source: Source | null; disabled: boolean; onChoose: (source: Source) => void }) {
  const selectId = useId();
  const [pages, setPages] = useState<number[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const beforeId = pages.at(-1);
  const result = trpc.aperture.strategy.executionSources.useQuery(beforeId ? { beforeId } : {}, { retry: false, refetchOnWindowFocus: false });
  const rows = result.data?.sources ?? [];
  const selected = rows.find(row => row.orderId === selectedId);
  const unavailable = disabled || result.isLoading || result.isFetching || !!result.error || !result.data;
  return <section aria-label="Choose gains source" className="space-y-2 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--sh-border-1)" }}>
    <label htmlFor={selectId} className="block font-semibold">Choose a source order</label>
    <p>Recorded closing orders in your Alpaca Paper accounts. Selection does not verify profit.</p>
    {source && <p>Current source: order #{source.orderId} · account #{source.accountId}</p>}
    {result.error ? <p role="alert">Source orders could not be loaded. Retry; the saved draft is unchanged.</p>
      : result.isLoading ? <p role="status">Reading recorded orders…</p>
      : rows.length === 0 && <p>No source orders on this page. Keep this as opportunity research or return to Play Desk to inspect your orders.</p>}
    <select id={selectId} className={`${control} w-full`} disabled={unavailable} value={selectedId ?? ""}
      onChange={event => setSelectedId(event.target.value ? Number(event.target.value) : null)}>
      <option value="">Select a closing order</option>
      {rows.map(row => <option key={row.orderId} value={row.orderId}>{paperInstrumentDisplayLabel(row)} · {row.accountLabel} · order #{row.orderId}</option>)}
    </select>
    {selected && <div className="space-y-2">
      <p>Use order #{selected.orderId} in {selected.accountLabel}. Intent becomes gains research; declared capital stays unchanged. Save and review the draft before analysis.</p>
      <p>Recorded status: {selected.status} · {new Date(selected.recordedAt).toLocaleString()}. This is not current broker verification.</p>
      <button type="button" className={control} disabled={unavailable} onClick={() => {
        if (unavailable || !selected) return;
        onChoose({ accountId: selected.accountId, runId: selected.runId, candidateId: selected.candidateId, orderId: selected.orderId });
      }}>Use this source</button>
    </div>}
    <div className="flex flex-wrap gap-2">
      {result.error && <button type="button" className={control} disabled={disabled || result.isFetching} onClick={() => result.refetch()}>Retry source list</button>}
      {pages.length > 0 && <button type="button" className={control} disabled={unavailable} onClick={() => { setPages(pages.slice(0, -1)); setSelectedId(null); }}>Newer orders</button>}
      {result.data?.nextCursor && <button type="button" className={control} disabled={unavailable} onClick={() => { if (result.data?.nextCursor) setPages([...pages, result.data.nextCursor]); setSelectedId(null); }}>Older orders</button>}
      <a className={`${control} inline-flex items-center`} href="/aperture/plays">Inspect Play Desk</a>
    </div>
  </section>;
}
