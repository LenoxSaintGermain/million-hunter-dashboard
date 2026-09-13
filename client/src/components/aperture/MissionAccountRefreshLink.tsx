import React from "react";
import { aperturePathForFixture, readIsolatedUatIdentity } from "@shared/isolatedUatIdentity";

/** Navigation only: neither inspection nor this link syncs the broker. */
export function MissionAccountRefreshLink({ accountLabel }: { accountLabel: string }) {
  return <p className="text-sm leading-6">
    <a className="inline-flex min-h-11 items-center underline underline-offset-4" style={{ color: "var(--sh-signal)" }}
      href={aperturePathForFixture("/aperture/accounts", readIsolatedUatIdentity())}>
      Open Accounts to refresh {accountLabel}
    </a>
    <span className="block" style={{ color: "var(--sh-fg-muted)" }}>Save any draft edits before leaving. Choose Refresh balances for {accountLabel}, then return to Mission and inspect the effective constraint. Opening Accounts does not refresh balances or authorize underwriting.</span>
  </p>;
}
