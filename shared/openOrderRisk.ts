import { sumMeasuredOpenRiskCents, type MeasuredOpenRiskSum } from "./measuredOpenRisk";

type OrderRisk = { accountId: number; symbol: string; instrumentType: string; side: string; intent: string | null; status: string; filledQty: number | null; plannedRiskCents: number | null };
/** Conservative order-led risk: only an exact, fully filled offset removes an
 * opening risk. Partial reductions retain the entire opening risk. No mutation
 * of historical fills or approvals; symbols include exact option identifiers. */
export function sumOpenOrderRisk(rows: readonly OrderRisk[]): MeasuredOpenRiskSum {
  const invalid = { ok: false, reason: "unmeasured_or_invalid_risk" } as const;
  const key = (row: OrderRisk) => JSON.stringify([row.accountId, row.symbol, row.instrumentType,
    (row.intent === "close" ? row.side === "sell" : row.side === "buy") ? "long" : "short"]);
  const groups = new Map<string, { opened: number; closed: number }>();
  for (const row of rows) {
    if (row.status !== "filled") continue;
    if (!['open', 'close'].includes(row.intent ?? '') || !['buy', 'sell'].includes(row.side)
      || row.filledQty == null || !Number.isFinite(row.filledQty) || row.filledQty <= 0) return invalid;
    const group = groups.get(key(row)) ?? { opened: 0, closed: 0 };
    if (row.intent === "close") group.closed += row.filledQty;
    else group.opened += row.filledQty;
    groups.set(key(row), group);
  }
  for (const group of Array.from(groups.values())) {
    if (!Number.isFinite(group.opened) || !Number.isFinite(group.closed) || group.closed > group.opened) return invalid;
  }
  return sumMeasuredOpenRiskCents(rows.filter(row => {
    if (row.intent === "close") return false; // validated reduce-only intents add no opening risk
    if (row.status !== "filled") return true;
    const group = groups.get(key(row))!;
    return group.opened !== group.closed;
  }));
}
