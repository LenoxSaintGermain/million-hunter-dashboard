import { buildCockpitRailSummary, type CockpitHeadroomLine } from "./cockpitRailSummary";
import { snapshotAge } from "./snapshotAge";

/**
 * Whether Guided mode may say "All clear". An empty decision list is not an
 * all-clear on its own: the practice account must be synced recently and every
 * measured limit must have room. Anything unknown fails closed.
 */
export type GuidedAccountCheck = {
  verified: boolean;
  /** Plain-language reason, shown to the user. */
  reason: string;
};

export function guidedAccountCheck(
  account: { linked: boolean; stalenessMs: number | null } | null | undefined,
  lines: CockpitHeadroomLine[] | null | undefined,
): GuidedAccountCheck {
  if (!account || !account.linked) {
    return { verified: false, reason: "No practice account is linked, so your limits can't be checked yet." };
  }
  if (account.stalenessMs == null) {
    return { verified: false, reason: "Your practice account has never synced, so we can't confirm you're inside your limits." };
  }
  const age = snapshotAge(account.stalenessMs);
  if (age.stale) {
    return { verified: false, reason: `Your account numbers were ${age.text}. Sync your account before you decide anything.` };
  }
  const summary = buildCockpitRailSummary(lines ?? [], account.stalenessMs);
  if (summary.severity === "unmeasurable") {
    return { verified: false, reason: "Your limits couldn't be measured from the saved account numbers." };
  }
  if (summary.severity !== "quiet") {
    return { verified: false, reason: `You're getting close to a limit (${summary.binding?.label ?? "a desk limit"}). Check how much room is left before a new trade.` };
  }
  return { verified: true, reason: `Your practice account ${age.text} and every measured limit has room.` };
}
