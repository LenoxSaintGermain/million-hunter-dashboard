import React from "react";

export function AcquisitionSourceBrief({ listingUrl, description, isSynthetic }: {
  listingUrl?: string | null; description?: string | null; isSynthetic?: boolean;
}) {
  let source: string | null = null;
  try {
    const url = new URL(listingUrl ?? "");
    if (url.protocol === "https:" || url.protocol === "http:") source = url.href;
  } catch { /* Missing or malformed source is not evidence. */ }
  return <section aria-label="Listing evidence" className="mb-6 border border-rule p-4">
    <p className="font-semibold">{isSynthetic
      ? "Illustrative record — not a verified business opportunity"
      : source ? "Source-reported listing — not independently verified" : "Listing source missing — opportunity unverified"}</p>
    <p>Verify the business identity, availability and financial claims before relying on these figures.</p>
    {source && <a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">Open original listing</a>}
    {description && <details><summary className="cursor-pointer py-2">Discovery record</summary><p className="whitespace-pre-wrap">{description}</p></details>}
  </section>;
}
