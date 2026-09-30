import { ACCOUNT_FRESHNESS_MS, buildDeskGlance, type GlanceAccount, type GlanceOrder } from "@shared/deskGlance";
import { formatSignedCents } from "@shared/positionReturn";

const money = (value: number | null) => value == null || !Number.isFinite(value) ? "Not measured" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value / 100);

/** Saved evidence only. Buying power is never risk clearance or a deployment budget. */
export function PlayDeskEvidence({ orders, account, accountUnavailable }: { orders: GlanceOrder[]; account: GlanceAccount | null; accountUnavailable?: string | null }) {
  const now = Date.now();
  const glance = buildDeskGlance(orders, account, now);
  const pnl = glance.unrealized;
  const syncTime = account?.lastSyncedAt;
  const validSyncTime = syncTime != null && Number.isFinite(new Date(syncTime).getTime()) && syncTime > 0 && syncTime <= now;
  const balanceVerified = validSyncTime && !!account?.syncSource?.trim();
  const staleBalance = validSyncTime && now - syncTime > ACCOUNT_FRESHNESS_MS;
  return <section className="desk-evidence" aria-label="Saved desk evidence">
    <div data-desk-evidence="risk">
      <p className="desk-annotation">Recorded risk</p><h2>{money(glance.atRisk.counted ? glance.atRisk.cents : null)}</h2>
      <p>{glance.atRisk.label}</p>
      {glance.atRisk.uncounted > 0 && <small>{glance.atRisk.uncounted} missing risk figures · excluded from total.</small>}
      <details><summary>Risk basis</summary><p>{glance.atRisk.counted} orders counted. Stop execution may differ.</p></details>
    </div>
    <div data-desk-evidence="return">
      <p className="desk-annotation">Unrealized return</p><h2>{pnl.pnlCents == null ? "Not measured" : formatSignedCents(pnl.pnlCents)}</h2>
      <p>{pnl.marked} of {pnl.openPositions} filled positions marked</p>
      {pnl.caveat && <small>{pnl.caveat}</small>}
      {pnl.stale > 0 && <small>Stale marks: {pnl.stale}. Not current pricing.</small>}
      <details><summary>Mark provenance</summary><p>{pnl.asOf != null ? `Oldest mark: ${new Date(pnl.asOf).toLocaleString()}.` : "No measured mark timestamp."} Order-level sources remain in each play’s receipts.</p></details>
    </div>
    <div data-desk-evidence="buying-power">
      <p className="desk-annotation">Broker buying power</p><h2>{money(balanceVerified ? account?.buyingPowerCents ?? null : null)}</h2>
      <p>Not deployable capital. Risk gates and human approval still apply.</p>
      <small>{!balanceVerified ? "Snapshot unverified" : staleBalance ? "Stale snapshot · over 15 minutes old" : "Saved snapshot · within 15 minutes"}</small>
      {accountUnavailable && <small>{accountUnavailable}</small>}
      <details><summary>Broker source &amp; time</summary><p>{!account ? "No paper account is connected" : !balanceVerified ? "No verified synced balance is available" : account.syncSource} · {validSyncTime ? new Date(syncTime).toLocaleString() : "Sync time not recorded or invalid"}</p></details>
    </div>
    <p className="desk-evidence-note">Saved snapshots, not fresh checks. Portfolio Greeks and portfolio-wide risk clearance are not established here.</p>
  </section>;
}
