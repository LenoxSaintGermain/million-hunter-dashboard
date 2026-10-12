import React from "react";
import { compareEvidenceSnapshots } from "@shared/dealEvidenceChanges";
import type { DealEvidenceSnapshot } from "@shared/dealEvidence";

const descriptions = {
  added: "Added source",
  removed: "Removed source",
  changed: "Captured content changed",
  recaptured: "Recaptured · same content hash",
  unchanged: "Unchanged version",
} as const;

export function DealEvidenceRunComparison({
  previous,
  next,
}: {
  previous: DealEvidenceSnapshot | null;
  next: DealEvidenceSnapshot;
}) {
  if (!previous)
    return (
      <p className="text-xs text-[var(--sh-text-secondary)]">
        No previous saved input snapshot available for comparison.
      </p>
    );
  if (previous.deal.id !== next.deal.id)
    return (
      <p role="alert" className="text-sm">
        Cannot compare evidence across different deals.
      </p>
    );
  const comparison = compareEvidenceSnapshots(previous, next);
  return (
    <section
      aria-label="Recorded input changes"
      className="min-w-0 space-y-3 border-t border-[var(--sh-border)] py-3 text-[var(--sh-text-primary)]"
    >
      <h4 className="font-serif text-base">
        What changed from the previous run?
      </h4>
      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-[var(--sh-text-secondary)]">
            Changed deal fields
          </dt>
          <dd className="font-mono text-lg tabular-nums">
            {comparison.dealFields.length}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--sh-text-secondary)]">
            Sources with version changes
          </dt>
          <dd className="font-mono text-lg tabular-nums">
            {comparison.changedSources}
          </dd>
        </div>
      </dl>
      {comparison.dealFields.length > 0 && (
        <p className="break-words text-xs">
          Deal fields: {comparison.dealFields.join(", ")}
        </p>
      )}
      <ul className="space-y-2 text-xs">
        {comparison.versions.map(version => (
          <li
            key={version.cik}
            className="min-w-0 border border-[var(--sh-border)] px-3"
          >
            <details>
              <summary className="min-h-11 cursor-pointer py-3 focus-visible:outline focus-visible:outline-2">
                <span className="font-mono">CIK {version.cik}</span>
                <span className="mt-1 block">{descriptions[version.kind]}</span>
              </summary>
              <dl className="space-y-2 pb-3 [overflow-wrap:anywhere]">
                <div>
                  <dt className="text-[var(--sh-text-secondary)]">
                    Previous receipt IDs
                  </dt>
                  <dd className="font-mono">
                    {version.previousReceiptIds.join(", ") || "None selected"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--sh-text-secondary)]">
                    Selected run receipt IDs
                  </dt>
                  <dd className="font-mono">
                    {version.nextReceiptIds.join(", ") || "None selected"}
                  </dd>
                </div>
              </dl>
            </details>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--sh-text-secondary)]">
        {comparison.limitation} Recapture alone does not establish a content
        change.
      </p>
    </section>
  );
}
