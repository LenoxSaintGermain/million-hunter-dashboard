import { useId } from "react";
import type { compareAcquisitionToThesis } from "@shared/acquisitionThesisComparison";

type Comparison = ReturnType<typeof compareAcquisitionToThesis>;

/** Read-only portrait of saved evidence. Never upgrades source support to verification. */
export function AcquisitionEvidencePortrait({ comparison, stale }: { comparison: Comparison; stale: boolean }) {
  const id = useId();
  const supported = comparison.dimensions.filter(row => row.score != null).length;
  return <section aria-label="Saved thesis evidence portrait" className="my-4 border-y border-border bg-[var(--sh-surface)]">
    <div className="px-3 py-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Thesis × evidence {stale ? "· stale snapshot" : "· saved snapshot"}</p>
      <p className="mt-2 font-serif text-2xl leading-tight">{supported === comparison.dimensions.length && supported > 0 ? "The criteria have source support." : "The case still has blanks to fill."}</p>
      <p className="mt-2 text-xs text-muted-foreground">{supported} of {comparison.dimensions.length} criteria supported. Source claims—not independently verified.</p>
    </div>
    <div className="divide-y divide-border">
      {comparison.dimensions.map((row, index) => <details key={row.dimension} className="group px-3 open:bg-[var(--sh-surface-2,var(--sh-surface))]">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${row.score == null ? "border-dashed border-[var(--sh-fg-muted)] text-muted-foreground" : "border-[var(--sh-text-primary)]"}`}>{row.score == null ? "…" : "○"}</span>
          <span className="min-w-0 flex-1"><span className={`block text-sm ${row.score == null ? "italic text-muted-foreground" : "font-semibold"}`}>{row.dimension}</span><span className="block text-[11px] text-muted-foreground">{row.score == null ? "Thesis criterion · evidence needed" : "Source support recorded"}</span></span>
          <span className="text-xs tabular-nums text-muted-foreground">{row.weight}% weight</span>
          <span aria-hidden="true" className="group-open:rotate-45 motion-safe:transition-transform">+</span>
        </summary>
        <div id={`${id}-${index}`} className="border-l-2 border-[var(--sh-signal)] pb-4 pl-3 text-sm leading-6">
          <p>{row.score == null ? "This criterion needs supporting evidence. Opening it does not resolve the gap or change your thesis." : row.explanation}</p>
          {row.evidence.map((evidence, i) => <blockquote key={i} className="mt-3 border-t border-border pt-2"><p>{evidence.quote}</p><a href={evidence.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">Inspect source claim ↗</a></blockquote>)}
          {stale && <p className="mt-2 font-medium">Recheck this saved evidence before relying on it.</p>}
        </div>
      </details>)}
    </div>
    <p className="border-t border-border px-3 py-3 text-[11px] text-muted-foreground">Evidence coverage is not a return forecast. Changing a requirement does not create evidence.</p>
  </section>;
}
