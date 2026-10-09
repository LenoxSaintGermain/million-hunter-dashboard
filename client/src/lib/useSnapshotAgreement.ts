import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { invalidateAccountRefreshReads } from "@/lib/accountRefreshInvalidation";
import { newerSnapshotAccountIds, snapshotStamps, type SnapshotRow } from "@shared/snapshotAgreement";

// Shared across every mounted screen in this tab, so a newer snapshot read on
// Portfolio also refreshes Today's cached cockpit and desk (#120).
const lastSeen = new Map<number, number | null>();

export function useSnapshotAgreement(accounts: readonly SnapshotRow[] | null | undefined) {
  const utils = typeof (trpc as any).useUtils === "function" ? (trpc as any).useUtils() : null;
  const signature = (accounts ?? []).map((a) => `${a.id}:${a.lastSyncedAt ?? ""}`).join("|");
  useEffect(() => {
    if (!accounts) return;
    const next = snapshotStamps(accounts);
    const changed = newerSnapshotAccountIds(lastSeen, next);
    next.forEach((stamp, id) => lastSeen.set(id, stamp));
    if (!changed.length || !utils?.aperture) return;
    void Promise.all(changed.map((id) => invalidateAccountRefreshReads(utils.aperture, id)));
  }, [signature]);
}
