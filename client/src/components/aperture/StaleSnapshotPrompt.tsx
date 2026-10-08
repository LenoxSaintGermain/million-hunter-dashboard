import { useState } from "react";
import { toast } from "sonner";
import "@/styles/capital-limit-bars.css";
import { trpc } from "@/lib/trpc";
import { invalidateAccountRefreshReads } from "@/lib/accountRefreshInvalidation";
import { snapshotAge, snapshotSyncAvailability } from "@shared/snapshotAge";
import { SYNC_NOW_TITLE } from "./SnapshotSyncNow";

/**
 * POC v3 HM-01: when the practice account's saved numbers are stale, syncing
 * is the first thing Today asks for. Display plus the existing read-only
 * account sync; nothing runs on a timer and no order is touched.
 */
export function StaleSnapshotPrompt({ account }: { account: { linked: boolean; accountId: number | null; brokerId: string | null; stalenessMs: number | null; label?: string | null } | null | undefined }) {
  // Defensive like the cockpit rail: fixtures and previews may not provide these.
  const t = trpc as any;
  const utils = typeof t.useUtils === "function" ? t.useUtils() : null;
  const sync = t.aperture?.account?.sync?.useMutation ? t.aperture.account.sync.useMutation() : null;
  const [syncing, setSyncing] = useState(false);
  if (!account?.linked) return null;
  const age = snapshotAge(account.stalenessMs);
  if (!age.stale) return null;
  const target = snapshotSyncAvailability({ accountId: account.accountId, brokerId: account.brokerId });
  const run = async () => {
    if (!target.canSync || syncing || !sync) return;
    setSyncing(true);
    try {
      await sync.mutateAsync({ id: target.accountId });
      if (utils?.aperture) await invalidateAccountRefreshReads(utils.aperture, target.accountId);
      toast.success("Practice account synced. No order was created or changed.");
    } catch (error: any) {
      toast.error(`Sync didn't finish: ${error?.message ?? "try again"}`);
    } finally {
      setSyncing(false);
    }
  };
  return <section className="stale-snapshot-prompt" role="status" aria-labelledby="stale-snapshot-title" data-stale-snapshot>
    <div className="min-w-0">
      <p className="kicker">Do this first</p>
      <h2 id="stale-snapshot-title">Sync your practice account</h2>
      <p>{age.text === "never synced"
        ? "Your practice account has never synced, so your limits and plays can't be measured yet."
        : `Your account numbers were ${age.text}. Limits and plays are measured against them, so sync before you decide anything.`}</p>
    </div>
    {target.canSync
      ? <button type="button" className="stale-snapshot-sync" onClick={() => void run()} disabled={syncing} title={SYNC_NOW_TITLE}>{syncing ? "Syncing…" : "Sync now"}</button>
      : <p>{target.reason ?? "Open Portfolio to update this account."}</p>}
  </section>;
}
