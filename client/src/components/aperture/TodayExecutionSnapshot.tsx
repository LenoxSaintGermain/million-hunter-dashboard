import { Button } from "@/components/ui/button";
import { buildDeskGlance, type GlanceAccount, type GlanceOrder } from "@shared/deskGlance";
import { deskOrderQuantities } from "@shared/deskOrderQuantities";
import { deskOrderReturn, formatSignedCents } from "@shared/positionReturn";
import type { ApertureMotionItem } from "@shared/apertureAttention";
import { paperInstrumentDisplayLabel, parseOccOptionSymbol } from "@shared/paperInstrument";

export interface TodayExecutionOrder extends GlanceOrder {
  id: number;
  accountId: number;
  accountLabel: string | null;
  symbol: string;
  orderType?: string | null;
  limitPriceCents?: number | null;
  timeInForce?: string | null;
  side?: string | null;
}
export interface TodayExecutionData {
  account: (GlanceAccount & { id?: number }) | null;
  accountUnavailable?: string | null;
  orders: TodayExecutionOrder[];
}

const money = (cents: number | null | undefined) => cents == null || !Number.isFinite(cents) ? "Not measured" : `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const stamp = (at: number | null) => at == null || !Number.isFinite(at) ? "Time unavailable" : new Date(at).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
const border = { borderColor: "var(--sh-border-1)" };

/** Reads the existing desk response. No provider call, polling or mutation. */
export function TodayExecutionSnapshot({ data, loading, failed, now = Date.now() }: {
  data?: TodayExecutionData;
  loading: boolean;
  failed: boolean;
  now?: number;
}) {
  if (!data) return <p role="status" className="border-b px-4 py-3 text-sm" style={border}>{failed ? "Broker snapshot unavailable. Retry status refresh." : loading ? "Loading broker snapshot…" : "Broker snapshot not available."}</p>;
  const account = data.accountUnavailable ? null : data.account;
  const scoped = account?.id != null;
  const orders = scoped ? data.orders.filter(order => order.accountId === account.id) : [];
  const summary = buildDeskGlance(orders, account, now);
  const { unrealized, atRisk, deployable } = summary;
  const partialFills = orders.filter(order => order.status !== "filled" && (order.filledQty ?? 0) > 0).length;
  const partial = unrealized.marked < unrealized.openPositions || partialFills > 0;
  return <section aria-label="Broker snapshot" className="border-b px-4 py-3" style={border}>
    <p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Broker snapshots · not streaming{failed ? " · Refresh failed; last saved data" : loading ? " · Refreshing saved data" : ""}</p>
    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-3">
      <div><dt className="text-sm">Unrealized{partial ? " · partial" : ""}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{scoped && unrealized.measured ? formatSignedCents(unrealized.pnlCents!) : "Not measured"}</dd>
        <dd className="mt-1 text-xs leading-5">{!scoped ? "Account scope unavailable." : `${unrealized.marked}/${unrealized.openPositions} fully filled positions marked${partialFills ? `; ${partialFills} partial fill(s) excluded` : ""}.`}{unrealized.measured && <> {unrealized.stale ? "Stale · " : "As of "}{stamp(unrealized.asOf)}</>}</dd>
      </div>
      <div><dt className="text-sm">Broker {account?.buyingPowerCents != null ? "buying power" : "cash"}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{money(deployable.cents)}</dd><dd className="mt-1 text-xs leading-5">{deployable.cents == null ? "Sync account to verify balance." : `${deployable.stale ? "Stale · " : "As of "}${stamp(deployable.asOf)}`}</dd></div>
      <div className="col-span-2 lg:col-span-1"><dt className="text-sm">Recorded order risk{atRisk.uncounted ? " · partial" : ""}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{scoped && atRisk.counted > 0 ? money(atRisk.cents) : "Not measured"}</dd><dd className="mt-1 text-xs leading-5">{atRisk.counted > 0 ? `${atRisk.label} · ${atRisk.counted}/${atRisk.counted + atRisk.uncounted} orders.` : "No measured order risk in this snapshot."}</dd></div>
    </dl>
    <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Order-linked positions{account?.label ? ` · ${account.label}` : ""}, not all holdings. Buying power is not mission allocation; portfolio limits still apply.</p>
    <details className="mt-1"><summary className="min-h-11 cursor-pointer py-3 text-sm">Snapshot details</summary><div className="space-y-1 pb-2 text-sm">
      <p>Balance source: {deployable.source ?? "Unavailable"}. {deployable.unavailableReason}</p>
      {scoped && unrealized.caveat && <p>{unrealized.caveat}</p>}
      <p>Risk uses recorded order plans, not a fresh portfolio calculation. Share stops do not guarantee an exit price. Open a play to inspect its risk; use Portfolio for account constraints.</p>
      <p>Day P&amp;L, streaming quotes and portfolio Greeks are not supplied by this snapshot.</p>
    </div></details>
  </section>;
}

/** State and destination come from the shared lifecycle briefing, not array order. */
export function TodayOrderRows({ items, data, fingerprints, changedKeys, onOpen, now = Date.now() }: {
  items: ApertureMotionItem[];
  data: TodayExecutionData;
  fingerprints: Map<string, string>;
  changedKeys: Set<string>;
  onOpen: (href: string) => void;
  now?: number;
}) {
  return <div aria-label="Recorded positions and orders">
    {items.map(item => {
      const order = data.orders.find(order => item.key === `order:${order.id}`);
      const parsed = parseOccOptionSymbol(item.symbol);
      const label = parsed ? paperInstrumentDisplayLabel({ symbol: item.symbol, instrumentType: parsed.instrumentType }) : item.symbol;
      const quantities = order ? deskOrderQuantities(order) : null;
      const result = order ? deskOrderReturn(order, now) : null;
      return <article key={item.key} data-attention-key={item.key} data-attention-fingerprint={fingerprints.get(item.key)} className="grid min-w-0 grid-cols-2 gap-2 border-t px-4 py-3 first:border-t-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center lg:gap-4" style={border}>
        <div className="col-span-2 min-w-0 lg:col-span-1"><h3 className="break-words text-sm font-semibold">{label}</h3><p className="text-sm" style={{ color: "var(--sh-signal)" }}>{item.stateLabel}{changedKeys.has(item.key) ? " · Changed" : ""}</p><p className="text-xs leading-5">{item.detail}</p></div>
        <div className="min-w-0 break-words text-sm leading-6 tabular-nums">{order ? <><p>{order.side === "buy" ? "Buy" : order.side === "sell" ? "Sell" : "Side not recorded"} · {order.orderType === "limit" ? `Limit ${money(order.limitPriceCents)}` : order.orderType === "market" ? "Market" : "Type not recorded"} · {order.timeInForce === "day" ? "Day" : order.timeInForce === "gtc" ? "GTC" : "TIF not recorded"}</p><p>{quantities!.filled} filled · {quantities!.remaining} remaining</p></> : <p>Order details unavailable. Open status to reconcile.</p>}</div>
        <div className="min-w-0 break-words text-sm leading-6 tabular-nums">{result?.measured ? <><p>Unrealized {formatSignedCents(result.pnlCents)}</p><p>Basis {money(order!.latestMark?.avgCostCents)} · Mark {money(order!.latestMark?.lastPriceCents)}</p><p className="text-xs">{result.stale ? "Stale · " : "As of "}{stamp(result.markAsOf)} · {result.markSource}</p></> : <p>{order?.status === "filled" ? "Unrealized not measured" : (order?.filledQty ?? 0) > 0 ? "Partial-fill return not measured" : "No position mark shown"}</p>}</div>
        <Button variant="outline" size="sm" className="col-span-2 min-h-11 justify-self-end lg:col-span-1" onClick={() => onOpen(item.href)}>View status</Button>
        {order && <p className="col-span-2 text-xs lg:col-span-4" style={{ color: "var(--sh-fg-muted)" }}>{order.accountLabel ?? "Account label unavailable"}{result && !result.measured && order.status === "filled" ? ` · ${result.reason}` : ""}</p>}
      </article>;
    })}
  </div>;
}
