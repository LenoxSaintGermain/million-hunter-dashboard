/**
 * One line per unattributed shared-account order (Refs #122). Alpaca dollar
 * (notional) orders return qty: null with notional and filled_qty set, so
 * show the dollar amount and the fill instead of "?". Never invents a value.
 */
export type UnattributedOrderLine = {
  symbol: string | null;
  side: string | null;
  qty: number | null;
  notional?: number | null;
  filledQty?: number | null;
  filledAvgPrice?: number | null;
  status: string;
  clientOrderId: string | null;
  brokerOrderId: string;
};

const usd = (dollars: number) => { const whole = Number.isInteger(dollars); return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(dollars); };
const shares = (n: number) => `${Number(n.toFixed(6))} sh`;

export function unattributedOrderLabel(order: UnattributedOrderLine): string {
  const side = order.side ?? "side not reported";
  const size = order.qty != null ? shares(order.qty)
    : order.notional != null ? `${usd(order.notional)} notional`
      : "quantity not reported";
  const fill = order.filledQty != null && order.filledQty > 0
    ? ` · filled ${shares(order.filledQty)}${order.filledAvgPrice != null ? ` at ${usd(order.filledAvgPrice)}` : ""}`
    : "";
  return `${order.symbol ?? "symbol not reported"} · ${side} ${size}${fill} · ${order.status} · client id ${order.clientOrderId ?? "none"} · ${order.brokerOrderId}`;
}
