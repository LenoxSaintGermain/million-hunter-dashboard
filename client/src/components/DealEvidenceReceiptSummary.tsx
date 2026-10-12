import React from "react";
import type { EvidenceReceipt } from "../../../server/evidenceRepository";

const muted = "text-xs text-[var(--sh-text-secondary)]";
function dateLabel(value: Date | string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Unknown";
}

/** Read-only evidence preview. It never resolves a newer version or calls a provider. */
export function DealEvidenceReceiptSummary({
  receipt,
  attached = false,
  now = Date.now(),
}: {
  receipt: EvidenceReceipt;
  attached?: boolean;
  now?: number;
}) {
  const observed = receipt.status === "ok" || receipt.status === "empty";
  const filings = observed ? receipt.payload.filings : [];
  const forms = new Set(filings.map(filing => filing.form));
  const dates = filings
    .map(filing => filing.filingDate)
    .filter(Boolean)
    .sort();
  const expiry = receipt.expiresAt
    ? new Date(receipt.expiresAt).getTime()
    : null;
  const expired = expiry !== null && Number.isFinite(expiry) && expiry <= now;
  const safeSource = /^https:\/\/(?:www\.|data\.)?sec\.gov\//i.test(
    receipt.sourceUrl
  );
  return (
    <article
      aria-label={
        attached ? "Attached receipt version" : "Selected receipt version"
      }
      className="min-w-0 space-y-3 border border-[var(--sh-border)] bg-[var(--sh-surface-1)] p-3 text-[var(--sh-text-primary)] sm:p-4"
    >
      <header className="space-y-1">
        <p className={`${muted} font-mono`}>
          {attached
            ? "Attached immutable version"
            : "Selected version · not attached"}
        </p>
        <h3 className="break-words font-serif text-lg">
          {receipt.payload.company?.name || "Issuer not verified"}
        </h3>
        <p className={`${muted} break-all`}>
          {receipt.subjectKey} · SEC submissions
        </p>
      </header>
      <p role="status" className="text-sm">
        {receipt.status === "unavailable"
          ? "Failed capture — no usable filing evidence."
          : receipt.status === "empty"
            ? "No filings in this saved response."
            : "Saved filing metadata."}
        {observed &&
          (expired
            ? " Expired snapshot; not current evidence."
            : expiry === null
              ? " Freshness unknown."
              : "")}
      </p>
      {receipt.message && (
        <details>
          <summary className="min-h-11 cursor-pointer py-3 text-xs">
            Source response note
          </summary>
          <p className="whitespace-pre-wrap break-words text-sm">
            {receipt.message}
          </p>
        </details>
      )}
      <dl className="grid grid-cols-2 gap-3 border-y border-[var(--sh-border)] py-3">
        <div>
          <dt className={muted}>Captured filings</dt>
          <dd className="font-mono text-lg tabular-nums">
            {observed ? filings.length : "Unknown"}
          </dd>
        </div>
        <div>
          <dt className={muted}>Form types</dt>
          <dd className="font-mono text-lg tabular-nums">
            {observed ? forms.size : "Unknown"}
          </dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className={muted}>Filing dates in this version</dt>
          <dd className="break-words font-mono text-xs tabular-nums">
            {dates.length
              ? `${dates[0]} – ${dates[dates.length - 1]}`
              : observed
                ? "None returned"
                : "Unknown"}
          </dd>
        </div>
      </dl>
      <p className={muted}>
        Filing metadata only; not verified financials, filing-content analysis,
        or investment approval. A newer capture does not replace this version.
      </p>
      <details>
        <summary className="min-h-11 cursor-pointer py-3 text-xs font-mono focus-visible:outline focus-visible:outline-2">
          Source & version provenance
        </summary>
        <dl className="space-y-2 text-xs [overflow-wrap:anywhere]">
          {Object.entries({
            "Receipt ID": receipt.id,
            "Payload hash": receipt.payloadHash,
            Recorded: dateLabel(receipt.recordedAt),
            "Successful retrieval": receipt.retrievedAt
              ? dateLabel(receipt.retrievedAt)
              : "No successful fetch",
            Expires: receipt.expiresAt
              ? dateLabel(receipt.expiresAt)
              : "Not applicable",
          }).map(([label, value]) => (
            <div key={label}>
              <dt className={muted}>{label}</dt>
              <dd className="font-mono">{value}</dd>
            </div>
          ))}
          <div>
            <dt className={muted}>Source</dt>
            <dd>
              {safeSource ? (
                <a
                  className="underline underline-offset-4"
                  href={receipt.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {receipt.sourceUrl} ↗
                </a>
              ) : (
                "Source link unavailable"
              )}
            </dd>
          </div>
        </dl>
      </details>
    </article>
  );
}
