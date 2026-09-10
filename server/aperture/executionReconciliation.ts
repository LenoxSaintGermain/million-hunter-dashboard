import { orderExecutionReceiptSchema, type OrderExecutionReceipt } from "./brokers/orderExecutions";

type Order = { symbol: string; side: string; qty: number | null; instrumentType: string; contractMultiplier: number | null };
type Decimal = { value: bigint; scale: number };
function decimal(value: string): Decimal {
  if (value.length > 48 || !/^\d+(?:\.\d+)?$/.test(value)) throw new Error("Invalid decimal");
  const [whole, fraction = ""] = value.split(".");
  return { value: BigInt(whole + fraction), scale: fraction.length };
}
const pow = (n: number) => BigInt(`1${"0".repeat(n)}`);
function add(a: Decimal, b: Decimal): Decimal {
  const scale = Math.max(a.scale, b.scale);
  return { value: a.value * pow(scale - a.scale) + b.value * pow(scale - b.scale), scale };
}
function compare(a: Decimal, b: Decimal) {
  const scale = Math.max(a.scale, b.scale);
  const difference = a.value * pow(scale - a.scale) - b.value * pow(scale - b.scale);
  return difference < BigInt(0) ? -1 : difference > BigInt(0) ? 1 : 0;
}
function text(value: Decimal): string {
  const raw = value.value.toString().padStart(value.scale + 1, "0");
  return value.scale ? `${raw.slice(0, -value.scale)}.${raw.slice(-value.scale)}`.replace(/\.?0+$/, "") : raw;
}
export type ExecutionReconciliation = {
  state: "not_measured" | "inconsistent" | "matched";
  reason: string;
  filledQuantity: string | null;
  grossProceedsUsd: string | null;
  /** Gross fill value only. Never availability, net profit, or a ledger claim. */
  basis: "recorded_executions_only";
  orderFullyFilled: boolean | null;
};
const unavailable = (state: "not_measured" | "inconsistent", reason: string): ExecutionReconciliation => ({
  state, reason, filledQuantity: null, grossProceedsUsd: null, basis: "recorded_executions_only", orderFullyFilled: null,
});

/** Exact decimal arithmetic with no per-fill cent rounding. No FIFO/cost-basis
 * inference: attribution, fees, settlement and commitments are separate gates. */
export function reconcileClosingExecutions(raw: OrderExecutionReceipt | null, order: Order): ExecutionReconciliation {
  if (!raw) return unavailable("not_measured", "No saved execution receipt.");
  const parsed = orderExecutionReceiptSchema.safeParse(raw);
  if (!parsed.success) return unavailable("inconsistent", "Execution receipt is malformed or duplicated.");
  if (!parsed.data.executions.length) return unavailable("not_measured", "No fills were returned; proceeds are not measured.");
  if (order.side !== "sell" || !order.symbol.trim() || !Number.isFinite(order.qty) || order.qty! <= 0) {
    return unavailable("inconsistent", "The recorded closing order terms are incomplete.");
  }
  const multiplier = order.instrumentType === "shares" ? 1
    : ["long_call", "long_put"].includes(order.instrumentType) ? order.contractMultiplier : null;
  if (!Number.isSafeInteger(multiplier) || multiplier! <= 0) return unavailable("not_measured", "A verified contract multiplier is required.");
  try {
    const expected = decimal(String(order.qty));
    const fills = [...parsed.data.executions].sort((a, b) => compare(decimal(a.cum_qty), decimal(b.cum_qty)));
    let cumulative: Decimal = { value: BigInt(0), scale: 0 }, gross = cumulative;
    let lastTime = -Infinity;
    for (const fill of fills) {
      if (fill.symbol !== order.symbol || fill.side !== "sell") return unavailable("inconsistent", "Fills do not match the selected symbol and closing side.");
      const quantity = decimal(fill.qty), price = decimal(fill.price), reported = decimal(fill.cum_qty), remaining = decimal(fill.leaves_qty);
      cumulative = add(cumulative, quantity);
      if (compare(cumulative, reported) !== 0 || compare(cumulative, expected) > 0 || compare(add(reported, remaining), expected) !== 0
        || Date.parse(fill.transaction_time) < lastTime) return unavailable("inconsistent", "Fill totals or sequence do not reconcile to the recorded order quantity.");
      lastTime = Date.parse(fill.transaction_time);
      gross = add(gross, { value: quantity.value * price.value * BigInt(multiplier!), scale: quantity.scale + price.scale });
    }
    return { state: "matched", reason: "Recorded fills match this closing order. Cost basis, fees and available proceeds remain unverified.",
      filledQuantity: text(cumulative), grossProceedsUsd: text(gross), basis: "recorded_executions_only", orderFullyFilled: compare(cumulative, expected) === 0 };
  } catch { return unavailable("inconsistent", "Recorded quantities cannot be reconciled without precision loss."); }
}
