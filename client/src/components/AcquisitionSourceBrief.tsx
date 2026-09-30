import React from "react";

export function AcquisitionSourceBrief({ listingUrl, description, isSynthetic }: {
  listingUrl?: string | null; description?: string | null; isSynthetic?: boolean;
}) {
  let source: string | null = null;
  try {
    const url = new URL(listingUrl ?? "");
    if (url.protocol === "https:" || url.protocol === "http:") source = url.href;
  } catch { /* Missing or malformed source is not evidence. */ }
  return <section aria-label="Listing evidence" className="deal-source-receipt">
    <div className="deal-source-mark" aria-hidden="true">↗</div>
    <div className="min-w-0"><span className="hunter-eyebrow">Source receipt</span>
    <h3>{isSynthetic
      ? "Illustrative record — not a verified business opportunity"
      : source ? "Source-reported listing — not independently verified" : "Listing source missing — opportunity unverified"}</h3>
    <p className="deal-source-caution">Identity, availability and financial claims still need verification.</p>
    {source && <a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">Open original listing</a>}
    {description && <details><summary>Discovery record · original capture</summary><p className="deal-source-capture">{description}</p></details>}
    </div>
  </section>;
}
