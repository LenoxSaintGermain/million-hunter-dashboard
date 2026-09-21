import React from "react";
import { Button } from "@/components/ui/button";

export interface PositionSummaryBarProps {
  order?: { id: number; symbol: string; underlyingSymbol?: string | null; instrumentType?: string | null; qty?: number | null; filledQty?: number | null; filledAvgPriceCents?: number | null; filledPriceCents?: number | null; limitPriceCents?: number | null; stopPriceCents?: number | null; optionExpirationDate?: string | null; optionStrikePriceCents?: number | null; contractMultiplier?: number | null; reason?: string | null; invalidationRule?: string | null; plannedRiskCents?: number | null; accountId?: number } | null;
  position?: unknown;
  thesisSummary?: string | null;
  postureStatus?: string;
  postureBias?: string;
  postureThreat?: string;
  onOpenExit?: () => void;
  onOpenHedge?: () => void;
}
const money = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value)
  ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100) : "Not recorded";

/** Order facts only. A fill or limit is not a current quote or proof of thesis validity. */
export function PositionSummaryBar({ order, onOpenExit }: PositionSummaryBarProps) {
  if (!order) return null;
  const shares = order.instrumentType === "shares";
  const filled = typeof order.filledQty === "number" && order.filledQty > 0;
  return <section aria-label="Selected paper order" className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs">PAPER · ORDER #{order.id}</p><h2 className="text-lg font-semibold">{order.symbol} · {shares ? "Shares" : order.instrumentType ?? "Instrument not recorded"}</h2></div>
      {filled && onOpenExit && <Button className="min-h-11" variant="outline" onClick={onOpenExit}>Review exit draft</Button>}
    </div>
    <dl className="grid grid-cols-2 gap-3">
      <div><dt>Recorded filled quantity</dt><dd>{order.filledQty ?? "Not recorded"}</dd></div>
      <div><dt>Recorded average fill</dt><dd>{money(order.filledAvgPriceCents ?? order.filledPriceCents)}</dd></div>
      <div><dt>Current mark / unrealized P&amp;L</dt><dd>Not measured</dd></div>
      <div><dt>Recorded stop</dt><dd>{money(order.stopPriceCents)}</dd></div>
    </dl>
    <p className="text-sm">No verified current quote is available in this view. Stop proximity and current profit or loss are unknown.</p>
    {!shares && <p className="text-sm">Option Greeks and bid/ask: not measured.</p>}
  </section>;
}
