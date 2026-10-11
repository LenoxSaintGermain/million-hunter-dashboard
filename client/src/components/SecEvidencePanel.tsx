import React, { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import type { EvidenceReceipt } from "../../../server/evidenceRepository";
export type { EvidenceReceipt } from "../../../server/evidenceRepository";
const muted = "text-xs text-[var(--sh-text-secondary)]";
const button =
  "min-h-11 h-auto whitespace-normal bg-[var(--sh-primary)] text-[var(--sh-primary-fg)] hover:bg-[var(--sh-primary)] hover:opacity-90";
const options = {
  retry: false as const,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
};
function stamp(date: Date | string | null) {
  if (!date) return "Unknown";
  const parsed = new Date(date);
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleString()
    : "Unknown";
}
function Source({ url, children }: { url: string; children: React.ReactNode }) {
  return /^https:\/\/(?:www\.|data\.)?sec\.gov\//i.test(url) ? (
    <a
      className="underline underline-offset-4 break-all"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children} ↗
    </a>
  ) : (
    <span>{children} — source link unavailable</span>
  );
}

export function ReceiptView({
  receipt,
  historical = false,
  now = Date.now(),
}: {
  receipt: EvidenceReceipt;
  historical?: boolean;
  now?: number;
}) {
  const expiry = receipt.expiresAt
    ? new Date(receipt.expiresAt).getTime()
    : NaN;
  const stale =
    receipt.status !== "unavailable" &&
    Number.isFinite(expiry) &&
    expiry <= now;
  const filings = receipt.status === "ok" ? receipt.payload.filings : [];
  const forms = Object.entries(
    filings.reduce<Record<string, number>>((counts, filing) => {
      counts[filing.form] = (counts[filing.form] || 0) + 1;
      return counts;
    }, {})
  ).sort(([a, aCount], [b, bCount]) => bCount - aCount || a.localeCompare(b));
  const remainingForms = forms.slice(6);
  const remainingFilingCount = remainingForms.reduce((sum, [, count]) => sum + count, 0);
  const dates = filings
    .map(f => f.filingDate)
    .filter(Boolean)
    .sort();
  const row = (filing: EvidenceReceipt["payload"]["filings"][number]) => (
    <li
      key={filing.accessionNumber}
      className="space-y-1 border-t border-[var(--sh-border)] py-3 break-words"
    >
      <p className="text-sm font-mono tabular-nums">
        <Source url={filing.url}>
          {filing.form} · {filing.filingDate}
        </Source>
      </p>
      <p className={muted}>
        Report date: {filing.reportDate || "Unknown"} · {filing.primaryDocument}
      </p>
      <p className={`${muted} break-all`}>Accession {filing.accessionNumber}</p>
    </li>
  );
  return (
    <article
      className="min-w-0 space-y-3"
      aria-label="Selected SEC evidence receipt"
    >
      <p role="status" className="text-sm font-medium">
        {historical
          ? "Historical receipt — not the latest capture. "
          : "Latest saved receipt. "}
        {receipt.status === "unavailable"
          ? "Provider unavailable — failed capture saved."
          : receipt.status === "empty"
            ? "No filings returned in this capture."
            : "SEC filings snapshot saved."}
        {stale ? " Stale — capture has expired." : ""}
      </p>
      {(receipt.message || receipt.payload.message) && (
        <p className={muted}>{receipt.message || receipt.payload.message}</p>
      )}
      {receipt.status === "unavailable" && (
        <p className={muted}>
          Filing count unknown; this failure is not evidence of no filings.
        </p>
      )}
      {receipt.status === "empty" && (
        <p className={muted}>
          0 filings in the captured response; not proof that the issuer has
          never filed.
        </p>
      )}
      {receipt.status === "ok" && (
        <>
          <p className="text-sm tabular-nums">
            {filings.length} captured filings
            {dates.length ? ` · ${dates[0]} to ${dates[dates.length - 1]}` : ""}
          </p>
          <ul
            aria-label="Captured filings by form"
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {forms.slice(0, 6).map(([form, count]) => (
              <li
                key={form}
                className="min-w-0 break-words border border-[var(--sh-border)] p-2 text-xs font-mono tabular-nums"
              >
                {form}: {count}
                <div
                  aria-hidden="true"
                  className="mt-2 h-1 bg-[var(--sh-surface-2)]"
                >
                  <div
                    className="h-1 bg-[var(--sh-primary)]"
                    style={{ width: `${(count / filings.length) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          {remainingForms.length > 0 && (
            <details>
              <summary className="min-h-11 cursor-pointer py-3 text-xs font-mono">
                Show remaining {remainingForms.length} form types · {remainingFilingCount} captured filings
              </summary>
              <ul aria-label="Remaining captured filings by form" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {remainingForms.map(([form, count]) => (
                  <li key={form} className="min-w-0 break-words border border-[var(--sh-border)] p-2 text-xs font-mono tabular-nums">
                    {form}: {count}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className={muted}>
            {forms.length > 6 && "Showing the six most frequent form types. "}
            Counts describe this bounded snapshot only, not the issuer’s
            complete filing history.
          </p>
          <ul aria-label="Filing preview">{filings.slice(0, 3).map(row)}</ul>
          {filings.length > 3 && (
            <details>
              <summary className="min-h-11 cursor-pointer py-3 text-xs font-mono">
                Show remaining {filings.length - 3} filings
              </summary>
              <ul>{filings.slice(3).map(row)}</ul>
            </details>
          )}
        </>
      )}
      <details className="border-t border-[var(--sh-border)]">
        <summary className="min-h-11 cursor-pointer py-3 text-xs font-mono">
          Receipt provenance
        </summary>
        <dl className="grid min-w-0 gap-2 text-xs [overflow-wrap:anywhere]">
          {Object.entries({
            Issuer: receipt.payload.company?.name || "Unknown",
            "CIK / subject": receipt.subjectKey,
            "Receipt ID": receipt.id,
            "Request ID": receipt.requestId,
            "Payload hash": receipt.payloadHash,
            Provider: receipt.provider,
            "Schema version": receipt.schemaVersion,
            Recorded: stamp(receipt.recordedAt),
            "Successfully retrieved": receipt.retrievedAt
              ? stamp(receipt.retrievedAt)
              : "No successful fetch",
            "Provider retrieved": receipt.payload.retrievedAt
              ? stamp(receipt.payload.retrievedAt)
              : "No successful fetch",
            Expires: receipt.expiresAt
              ? stamp(receipt.expiresAt)
              : "Not applicable",
            "Failure code": receipt.failureCode || "None reported",
          }).map(([label, value]) => (
            <div key={label}>
              <dt className="text-[var(--sh-text-secondary)]">{label}</dt>
              <dd className="font-mono">{value}</dd>
            </div>
          ))}
          <div>
            <dt>Source</dt>
            <dd>
              <Source url={receipt.sourceUrl}>{receipt.sourceUrl}</Source>
            </dd>
          </div>
        </dl>
      </details>
    </article>
  );
}

export function createCaptureRequests() {
  const ids = new Map<string, string>();
  return {
    async run(
      cik: string,
      mutate: (input: {
        cik: string;
        requestId: string;
      }) => Promise<EvidenceReceipt>
    ) {
      const requestId = ids.get(cik) || crypto.randomUUID();
      ids.set(cik, requestId);
      const receipt = await mutate({ cik, requestId });
      ids.delete(cik);
      return receipt;
    },
  };
}

export default function SecEvidencePanel({
  cik,
  name,
  captureRequests,
}: {
  cik: string;
  name: string;
  captureRequests?: ReturnType<typeof createCaptureRequests>;
}) {
  const normalizedCik = cik.padStart(10, "0");
  const list = trpc.publicEvidence.list.useQuery(
    { cik: normalizedCik },
    options
  );
  const capture = trpc.publicEvidence.capture.useMutation({ retry: false });
  const requests = useRef(captureRequests || createCaptureRequests());
  const busy = useRef(false);
  const [saved, setSaved] = useState<EvidenceReceipt | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [knownId, setKnownId] = useState("");
  const [idError, setIdError] = useState("");
  const [localError, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [localPending, setPending] = useState(false);
  const pending = localPending || capture.isPending;
  const error = localError || capture.error?.message || null;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const receipts: Omit<EvidenceReceipt, "payload">[] = [...(list.data || [])];
  if (saved && !receipts.some(r => r.id === saved.id)) receipts.push(saved);
  receipts.sort(
    (a, b) =>
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  );
  receipts.splice(20);
  const latest = receipts[0];
  const activeId = selected || latest?.id;
  const detail = trpc.publicEvidence.get.useQuery(
    { id: activeId || "00000000-0000-4000-8000-000000000000" },
    { ...options, enabled: Boolean(activeId), staleTime: Infinity }
  );
  const active =
    saved?.id === activeId
      ? saved
      : detail.data?.id === activeId
        ? detail.data
        : undefined;
  const subjectMatches = active?.subjectKey === `sec:CIK${normalizedCik}`;
  async function captureSelected() {
    if (busy.current || !confirmed) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const receipt = await requests.current.run(
        normalizedCik,
        capture.mutateAsync
      );
      setSaved(receipt);
      setSelected(receipt.id);
      // A saved unavailable receipt is a completed attempt too. Only unknown
      // transport/save outcomes retain the same idempotency key for retry.
      void list.refetch();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Capture or save failed."
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <section
      aria-label="SEC evidence receipts"
      className="min-w-0 space-y-4 rounded-lg border border-[var(--sh-border)] bg-[var(--sh-surface-1)] p-4 text-[var(--sh-text-primary)]"
    >
      <header>
        <h2 className="font-serif text-lg">SEC evidence receipts</h2>
        <p className="mt-1 break-words text-sm">
          Selected issuer: {name} · CIK {normalizedCik}
        </p>
        <p className={`mt-2 ${muted}`}>
          Viewing saved receipts makes no external SEC request. Capture
          retrieves and saves a new snapshot. Nothing is attached to a deal
          automatically; this is not investment approval.
        </p>
      </header>
      <label className="flex min-h-11 items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={pending}
          onChange={e => setConfirmed(e.target.checked)}
          className="mt-1 size-4 shrink-0"
        />
        <span>
          Confirm {name} (CIK {normalizedCik}) for this capture.
        </span>
      </label>
      <Button
        type="button"
        className={button}
        disabled={!confirmed || pending}
        onClick={captureSelected}
      >
        {pending
          ? "Capturing and saving…"
          : error
            ? "Retry capture (same request)"
            : "Capture SEC filings"}
      </Button>
      {pending && (
        <p role="status" className={muted}>
          Capture pending; no saved result confirmed yet.
        </p>
      )}
      {error && (
        <div role="alert" className="space-y-1 text-sm">
          <p>Capture/save not confirmed: {error}</p>
          <p className={muted}>
            Outcome may be unknown. Retry uses the same request ID to recover a
            saved receipt, not create a duplicate.
          </p>
        </div>
      )}
      {list.error ? (
        <div role="alert" className="space-y-2 text-sm">
          <p>Saved history could not be loaded: {list.error.message}</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={list.isFetching}
            onClick={() => list.refetch()}
          >
            Retry saved history
          </Button>
        </div>
      ) : list.isFetching ? (
        <p role="status" className={muted}>
          Loading saved receipt history…
        </p>
      ) : (
        !receipts.length && (
          <p role="status" className={muted}>
            No saved receipts for this issuer.
          </p>
        )
      )}
      {latest?.status === "unavailable" && (
        <p role="status" className="text-sm">
          Latest saved capture failed. Older snapshots are historical, not a
          current successful capture.
        </p>
      )}
      <p className={muted}>
        History lists up to 20 latest saved receipts, ordered by recorded time.
        Older receipts remain readable by receipt ID.
      </p>
      {receipts.length > 0 && (
        <label className={`block space-y-2 ${muted}`}>
          Immutable receipt history
          <select
            className="block min-h-11 w-full min-w-0 rounded border border-[var(--sh-border)] bg-[var(--sh-surface-1)] px-2 text-sm"
            value={activeId || ""}
            onChange={e => setSelected(e.target.value)}
          >
            {activeId && !receipts.some(r => r.id === activeId) && (
              <option value={activeId}>
                Requested receipt · {activeId.slice(0, 8)}
              </option>
            )}
            {receipts.map(receipt => (
              <option key={receipt.id} value={receipt.id}>
                {stamp(receipt.recordedAt)} · {receipt.status} ·{" "}
                {receipt.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
      )}
      <details>
        <summary className="min-h-11 cursor-pointer py-3 text-xs font-mono">
          Open a known receipt ID
        </summary>
        <form
          className="space-y-2"
          onSubmit={e => {
            e.preventDefault();
            const id = knownId.trim();
            if (
              !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                id
              )
            ) {
              setIdError("Enter a valid receipt UUID.");
              return;
            }
            setIdError("");
            setSelected(id.toLowerCase());
          }}
        >
          <label className={`block ${muted}`}>
            Receipt ID
            <input
              value={knownId}
              onChange={e => setKnownId(e.target.value)}
              maxLength={36}
              className="mt-1 block min-h-11 w-full min-w-0 border border-[var(--sh-border)] bg-[var(--sh-surface-1)] p-2"
            />
          </label>
          <Button type="submit" variant="outline" className="min-h-11">
            Open saved receipt
          </Button>
          {idError && (
            <p role="alert" className="text-sm">
              {idError}
            </p>
          )}
        </form>
      </details>
      {activeId && detail.isFetching && !active && (
        <p role="status" className={muted}>
          Loading saved receipt detail…
        </p>
      )}
      {activeId && detail.error && (
        <div role="alert" className="space-y-2 text-sm">
          <p>Saved receipt could not be loaded: {detail.error.message}</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={detail.isFetching}
            onClick={() => detail.refetch()}
          >
            Retry receipt detail
          </Button>
        </div>
      )}
      {active && !subjectMatches && (
        <p role="alert" className="text-sm">
          This receipt belongs to a different issuer. Select that issuer to view
          its evidence.
        </p>
      )}
      {active && subjectMatches && (
        <>
          <p className={muted}>
            {pending || error || list.error || detail.error
              ? "Saved snapshot below; latest capture outcome or history is not confirmed."
              : "Saved snapshots never update in place."}
          </p>
          <ReceiptView
            receipt={active}
            historical={
              active.id !== latest?.id ||
              Boolean(pending || error || list.error || detail.error)
            }
            now={now}
          />
        </>
      )}
    </section>
  );
}
