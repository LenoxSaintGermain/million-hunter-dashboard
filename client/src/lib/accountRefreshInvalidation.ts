import type { trpc } from "./trpc";

type RefreshUtils = Pick<ReturnType<typeof trpc.useUtils>["aperture"], "account" | "cockpit" | "desk">;

/** Read-cache recovery after a successful balance sync; never starts research or orders. */
export async function invalidateAccountRefreshReads(utils: RefreshUtils, accountId: number) {
  await Promise.all([
    utils.account.list.invalidate(),
    utils.account.getPositions.invalidate({ accountId }),
    // Cockpits may be keyed by accountId, runId, both, or no input. Refresh
    // the read family without changing any consumer's selected account/run.
    utils.cockpit.invalidate(),
    // The desk derives current balances and marks from the synced snapshot.
    utils.desk.summary.invalidate(),
  ]);
}
