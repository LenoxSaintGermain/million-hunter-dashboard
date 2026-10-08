import React from "react";

export const SYNC_NOW_TITLE = "Reads balances and positions from the broker. No order is placed, approved or cancelled.";

/**
 * Inline "Sync now" next to a snapshot age. Only the person can start it:
 * nothing calls it on a timer. The caller runs the existing read-only
 * account sync (aperture.account.sync) and owns the syncing state.
 */
export function SyncNowButton({ onSync, syncing, tone = "signal", className = "" }: {
  onSync: () => void;
  syncing: boolean;
  /** "inherit" for dark editorial panels where the accent would not read. */
  tone?: "signal" | "inherit";
  className?: string;
}) {
  return <button type="button" onClick={onSync} disabled={syncing} title={SYNC_NOW_TITLE}
    className={`ml-2 inline-flex min-h-6 items-center font-mono text-[10px] font-semibold uppercase tracking-[0.13em] underline underline-offset-4 disabled:cursor-wait disabled:opacity-60 ${className}`}
    style={{ color: tone === "signal" ? "var(--sh-signal)" : "inherit" }}>
    {syncing ? "Syncing…" : "Sync now"}
  </button>;
}
