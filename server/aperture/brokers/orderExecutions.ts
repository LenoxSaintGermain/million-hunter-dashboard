import { z } from "zod";
import { BrokerUnavailableError } from "./types";

// Source contract: https://docs.alpaca.markets/us/docs/account-activities
// and /us/reference/getaccountactivities-2. Preserve decimal strings: execution
// prices and fractional quantities must not be rounded before reconciliation.
const decimal = z.string().max(48).regex(/^\d+(?:\.\d+)?$/).refine(value => /[1-9]/.test(value));
const nonnegativeDecimal = z.string().max(48).regex(/^\d+(?:\.\d+)?$/);
const activity = z.object({
  id: z.string().min(1).max(160), activity_type: z.literal("FILL"),
  order_id: z.string().uuid(), symbol: z.string().min(1).max(100),
  side: z.enum(["buy", "sell"]), type: z.enum(["fill", "partial_fill"]),
  price: decimal, qty: decimal, cum_qty: decimal, leaves_qty: nonnegativeDecimal,
  transaction_time: z.iso.datetime({ offset: true }),
});
export type BrokerExecution = z.infer<typeof activity>;
export const orderExecutionReceiptSchema = z.object({
  provider: z.literal("alpaca_paper"), externalAccountId: z.string().min(1).max(128),
  brokerOrderId: z.string().uuid(), observedAt: z.number().int().positive().safe(),
  coverage: z.literal("complete_order_execution_query"), executions: z.array(activity).max(2000),
  feesVerified: z.literal(false), costBasisVerified: z.literal(false), proceedsAvailabilityVerified: z.literal(false),
}).strict().refine(receipt => new Set(receipt.executions.map(item => item.id)).size === receipt.executions.length
  && receipt.executions.every(item => item.order_id === receipt.brokerOrderId && Date.parse(item.transaction_time) <= receipt.observedAt));
export type OrderExecutionReceipt = {
  provider: "alpaca_paper";
  externalAccountId: string;
  brokerOrderId: string;
  observedAt: number;
  coverage: "complete_order_execution_query";
  executions: BrokerExecution[];
  feesVerified: false;
  costBasisVerified: false;
  proceedsAvailabilityVerified: false;
};
type Dependencies = {
  readAccount: () => Promise<{ externalAccountId: string | null; isPaper: boolean }>;
  readPage: (input: { orderId: string; pageSize: 100; pageToken?: string }) => Promise<unknown>;
  now?: () => number;
};
const refuse = (reason: string): never => { throw new BrokerUnavailableError(`Paper execution evidence unavailable: ${reason}`); };

/** A complete query is not proof an order filled, settled, or produced gains.
 * Returns nothing on a partial/failing query; caller must retain its prior receipt.
 * No provider request, source event or broker mutation occurs until called. */
export async function readOrderExecutions(input: { brokerOrderId: string; expectedExternalAccountId: string }, dependencies: Dependencies): Promise<OrderExecutionReceipt> {
  const parsed = z.object({ brokerOrderId: z.string().uuid(), expectedExternalAccountId: z.string().trim().min(1).max(128) }).strict().safeParse(input);
  if (!parsed.success) refuse("select the exact bound order and paper account.");
  const { brokerOrderId, expectedExternalAccountId } = parsed.data!;
  const checkAccount = async () => {
    const account = await dependencies.readAccount();
    if (!account.isPaper || account.externalAccountId !== expectedExternalAccountId) refuse("the execution account does not match the selected paper account.");
  };
  await checkAccount();
  const executions: BrokerExecution[] = [], ids = new Set<string>();
  let pageToken: string | undefined;
  for (let page = 0; page < 20; page++) {
    const response = await dependencies.readPage({ orderId: brokerOrderId, pageSize: 100, ...(pageToken ? { pageToken } : {}) });
    const batch = z.array(activity).max(100).safeParse(response);
    if (!batch.success) refuse("an execution page is malformed; no complete receipt was produced.");
    for (const execution of batch.data!) {
      if (execution.order_id !== brokerOrderId || ids.has(execution.id)) refuse("execution identity overlaps or belongs to a different order.");
      ids.add(execution.id); executions.push(execution);
    }
    if (batch.data!.length < 100) {
      await checkAccount();
      const observedAt = (dependencies.now ?? Date.now)();
      if (!Number.isSafeInteger(observedAt) || observedAt <= 0 || executions.some(item => Date.parse(item.transaction_time) > observedAt)) {
        refuse("execution timestamps are not valid at this observation time.");
      }
      return { provider: "alpaca_paper", externalAccountId: expectedExternalAccountId, brokerOrderId,
        observedAt, coverage: "complete_order_execution_query", executions,
        feesVerified: false, costBasisVerified: false, proceedsAvailabilityVerified: false };
    }
    pageToken = batch.data![99].id;
  }
  return refuse("the bounded history limit was reached; reconciliation must continue before using these proceeds.");
}
