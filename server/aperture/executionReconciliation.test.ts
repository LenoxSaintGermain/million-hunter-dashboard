import { expect, it } from "vitest";
import { reconcileClosingExecutions } from "./executionReconciliation";
import type { OrderExecutionReceipt } from "./brokers/orderExecutions";
const order = { symbol: "TEST", side: "sell", qty: 1, instrumentType: "shares", contractMultiplier: null };
const brokerOrderId = "00000000-0000-4000-8000-000000000001";
const fill = { id: "f1", order_id: brokerOrderId, activity_type: "FILL" as const, symbol: "TEST", side: "sell" as const, type: "fill" as const,
  qty: "1", cum_qty: "1", leaves_qty: "0", price: "118", transaction_time: "2026-09-10T14:00:00Z" };
const receipt = (executions = [fill]): OrderExecutionReceipt => ({ provider: "alpaca_paper", brokerOrderId, externalAccountId: "fixture-paper",
  observedAt: Date.UTC(2026, 8, 10, 15), coverage: "complete_order_execution_query", executions,
  feesVerified: false, costBasisVerified: false, proceedsAvailabilityVerified: false });
it("does not infer net proceeds or gains from a matched sale", () => {
  expect(reconcileClosingExecutions(receipt(), order)).toMatchObject({ state: "matched", filledQuantity: "1", grossProceedsUsd: "118", basis: "recorded_executions_only" });
  expect(reconcileClosingExecutions(receipt(), order)).not.toHaveProperty("availableCapitalCents");
});
it.each([null, receipt([])])("missing fills remain unmeasured, not zero proceeds", input => {
  expect(reconcileClosingExecutions(input, order)).toMatchObject({ state: "not_measured", grossProceedsUsd: null });
});
it("sums decimal fractional fills exactly without intermediate cent rounding", () => {
  const fills = [{ ...fill, qty: "0.1", cum_qty: "0.1", leaves_qty: "0.2", price: "0.03" },
    { ...fill, id: "f2", qty: "0.2", cum_qty: "0.3", leaves_qty: "0", price: "0.07" }];
  expect(reconcileClosingExecutions(receipt(fills), { ...order, qty: 0.3 })).toMatchObject({ state: "matched", grossProceedsUsd: "0.017", filledQuantity: "0.3" });
});
it("supports partial fills without asserting the whole order filled", () => {
  expect(reconcileClosingExecutions(receipt([{ ...fill, qty: "0.5", cum_qty: "0.5", leaves_qty: "0.5" }]), order)).toMatchObject({ state: "matched", grossProceedsUsd: "59", orderFullyFilled: false });
});
it("requires an explicit option multiplier and applies it once", () => {
  expect(reconcileClosingExecutions(receipt(), { ...order, instrumentType: "long_call" })).toMatchObject({ state: "not_measured" });
  expect(reconcileClosingExecutions(receipt(), { ...order, instrumentType: "long_put", contractMultiplier: 100 })).toMatchObject({ grossProceedsUsd: "11800" });
});
it.each([{ symbol: "OTHER" }, { side: "buy" }, { qty: "2" }, { cum_qty: "2" }, { leaves_qty: "1" }])("refuses mismatched execution terms %j", patch => {
  expect(reconcileClosingExecutions(receipt([{ ...fill, ...patch } as typeof fill]), order)).toMatchObject({ state: "inconsistent", grossProceedsUsd: null });
});
it("rejects duplicate fills and missing sequence portions", () => {
  expect(reconcileClosingExecutions(receipt([fill, fill]), order).state).toBe("inconsistent");
  expect(reconcileClosingExecutions(receipt([{ ...fill, qty: "0.5" }]), order).state).toBe("inconsistent");
});
