import { releaseStampLabel } from "@shared/releaseStamp";

const RELEASE_STAMP = releaseStampLabel(import.meta.env.VITE_RELEASE_SHA);

/** Quiet release stamp for bug reports (#123). Never invents a SHA. */
export function ReleaseStamp({ className = "" }: { className?: string }) {
  return <footer data-release-stamp className={`border-t border-rule pt-3 text-[11px] text-muted-foreground ${className}`}>
    {RELEASE_STAMP.short ? (
      <button
        type="button"
        className="font-mono hover:text-ink focus-visible:outline focus-visible:outline-2"
        title="Copy the release for a bug report"
        onClick={() => { void navigator.clipboard?.writeText(RELEASE_STAMP.label); }}
      >
        {RELEASE_STAMP.label} · copy for bug reports
      </button>
    ) : (
      <span>{RELEASE_STAMP.label}</span>
    )}
  </footer>;
}
